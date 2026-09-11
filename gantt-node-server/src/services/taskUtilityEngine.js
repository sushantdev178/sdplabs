// src/services/taskUtilityEngine.js
//
// Independent of Gantt on/off status — duration is calculated for every
// task regardless of whether the project uses auto-scheduling.
//
// NOTE: date-rounding to 15-minute intervals is handled in Laravel
// (Carbon) — pure arithmetic, no calendar/DB dependency, doesn't belong
// on the Node server. This file is duration-calculation only.
//
// Duration calc reuses the SAME Gantt instance config as the real
// scheduling engine (dhtmlxScheduler.js) so the result is guaranteed
// identical to what a real scheduling run would compute for the same
// dates — not a second, independently maintained implementation that
// could silently drift.

import { createRequire } from 'module';
import { query } from '../utils/db.js';
import { toDateOnly } from '../utils/dateHelper.js';
import { MINIMUM_DURATION_YEAR, MAXIMUM_DURATION_YEAR } from '../config/constants.js';

const require = createRequire(import.meta.url);
const { Gantt } = require('@dhx/gantt-node');

// ISO-8601 weekday numbering (1=Monday...7=Sunday), as stored in
// ph_projects.weekend, e.g. {"weekend": [1, 7]} = Mon+Sun off.
// Mapped to JS Date.getDay() convention (0=Sunday...6=Saturday), which is
// what gantt.setWorkTime({ day, ... }) expects.

const DB_TO_JS_DAY = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 };


const stripToDateOnly = (date) => {
    const d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    return d;
};

// ── Calculate duration (minutes) ──
// Calendar now sourced from ph_projects.weekend (JSON, ISO day numbers)
// instead of ph_workspaces.weekend. ph_off_days retains its existing
// workspace_id-based filter — the new project_id column on that table
// doesn't change holiday semantics for this calculation (off-days remain
// workspace-scoped).
//
// IMPORTANT: the REAL scheduling engine's fetchContext (ganttEngine.js,
// v3) must be updated with this identical change — same source
// (ph_projects.weekend, ISO day numbers), same mapping. If only this file
// is updated, duration calc and the actual scheduling engine will read
// two different calendars and silently disagree.
const fetchCalendarContext = async (workspace_id, project_id) => {
    const [project] = await query(
        `SELECT id, weekend         FROM ph_projects
         WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
        [project_id, workspace_id]
    );
    if (!project) throw new Error(`Project ${project_id} not found`);

    // JSON column — driver may return a JS array already, a string
    // needing parse, or NULL. NULL (or an empty array) means "no weekend
    // configured" — i.e. every day is a working day. This falls out
    // naturally from weekendIso defaulting to [] below (empty weekend list
    // -> weekendJs stays [] -> workDays includes all 7 days), but made
    // explicit here so the behavior isn't accidentally dependent on that
    // fallthrough surviving future edits unnoticed.
    let weekendIso = project.weekend;
    if (weekendIso === null || weekendIso === undefined) {
        weekendIso = []; // no weekend configured -> all days are working days
    } else if (typeof weekendIso === 'string') {
        try { weekendIso = JSON.parse(weekendIso); } catch { weekendIso = []; }
    }
    // The stored JSON is shaped {"weekend": [1, 7]}, not a bare array —
    // unwrap the nested key if present.
    if (weekendIso && !Array.isArray(weekendIso) && Array.isArray(weekendIso.weekend)) {
        weekendIso = weekendIso.weekend;
    }
    weekendIso = Array.isArray(weekendIso) ? weekendIso : [];

    const weekendJs = weekendIso
        .map(d => DB_TO_JS_DAY[Number(d)])
        .filter(d => d !== undefined);
    const workDays = [0, 1, 2, 3, 4, 5, 6].filter(d => !weekendJs.includes(d));

    const holidayRows = await query(
        `SELECT date FROM ph_off_days WHERE workspace_id = ?`,
        [workspace_id]
    );
    const holidays = holidayRows.map(r => toDateOnly(r.date));

    return { workDays, holidays, restrict: true };
};

// Ephemeral Gantt instance, config-identical to createGanttInstance() in
// dhtmlxScheduler.js, but only ever holds ONE dummy task — no autoSchedule,
// no links, just parse + read back t.duration.
const buildEphemeralGantt = ({ workDays, holidays, restrict }) => {
    const gantt = Gantt.getGanttInstance({ plugins: { auto_scheduling: true } });

    gantt.config.date_format = "%Y-%m-%d %H:%i:%s";
    gantt.config.duration_unit = 'minute';
    gantt.config.auto_types = false;
    gantt.config.work_time = restrict;
    gantt.config.correct_work_time = restrict;

    [0, 1, 2, 3, 4, 5, 6].forEach(day => {
        gantt.setWorkTime({ day, hours: workDays.includes(day) ? ['00:00-24:00'] : false });
    });
    holidays.forEach(dateStr => {
        gantt.setWorkTime({ date: new Date(dateStr + 'T00:00:00'), hours: false });
    });

    return gantt;
};

const isMidnight = (date) => (
    date.getHours() === 0 && date.getMinutes() === 0 &&
    date.getSeconds() === 0 && date.getMilliseconds() === 0
);
const addOneDay = (date) => {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + 1);
    return d;
};

export const calculateTaskDuration = async ({ workspace_id, project_id, start_at, due_at, time_used }) => {
    // If either date is null, return null
    if (start_at == null || due_at == null || time_used === undefined || time_used === null) {
        return {
            success: true,
            data: { duration_minutes: null, duration_days: null, working_days_count: null }
        };
    }

    const timeUsed = !!time_used;

    // If time_used is false, whole-day tasks → return null duration
    if (!timeUsed) {
        return {
            success: true,
            data: { duration_minutes: null, duration_days: null, working_days_count: null }
        };
    }

    let startDate = new Date(start_at);
    let dueDate = new Date(due_at);

    if (isNaN(startDate) || isNaN(dueDate)) {
        return { success: false, error: 'Invalid start_at or due_at' };
    }

    // ── YEAR RANGE VALIDATION ──
    const startYear = startDate.getFullYear();
    const dueYear = dueDate.getFullYear();
    if (startYear < MINIMUM_DURATION_YEAR || startYear > MAXIMUM_DURATION_YEAR || dueYear < MINIMUM_DURATION_YEAR || dueYear > MAXIMUM_DURATION_YEAR) {
        return {
            success: true,
            data: { duration_minutes: null, duration_days: null, working_days_count: null }
        };
    }

    // For time_used=true, we keep the original times (no stripping to midnight)
    // (No stripping needed)

    // Re-check start > due after possible normalisation (though we didn't change)
    if (startDate.getTime() > dueDate.getTime()) {
        return {
            success: true,
            data: { duration_minutes: null, duration_days: null, working_days_count: null }
        };
    }

    const calendar = await fetchCalendarContext(Number(workspace_id), Number(project_id));
    const gantt = buildEphemeralGantt(calendar);

    // For time_used=true, we do NOT add a day; end date is as given (exclusive end is the actual due time)
    const ganttEnd = dueDate; // no +1 for time-used

    gantt.parse({
        data: [{
            id: 1,
            text: 'duration-calc',
            start_date: startDate,
            end_date: ganttEnd,
            time_used: true
        }],
        links: []
    });

    const task = gantt.getTask(1);
    const duration = task.duration;

    // Compute working days count (optional)
    let workingDaysCount = 0;
    const current = new Date(startDate);
    while (current <= dueDate) {
        if (gantt.isWorkTime(current)) {
            workingDaysCount++;
        }
        current.setDate(current.getDate() + 1);
    }

    gantt.destructor();

    return {
        success: true,
        data: {
            duration_minutes: duration,
            duration_days: null,  // not applicable for time_used=true
            working_days_count: workingDaysCount,
        }
    };
};