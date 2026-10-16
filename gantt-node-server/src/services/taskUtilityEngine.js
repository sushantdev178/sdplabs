// src/services/taskUtilityEngine.js
//
// v5 — duration for BOTH task types.
//      - time_used = true  → duration in working MINUTES
//      - time_used = false → duration in working DAYS
//
// FIXES IN THIS VERSION:
//   1. Working-day count inspects the calendar config directly, not
//      gantt.isWorkTime(midnight) — the latter returned 0 on
//      09:00–17:00 calendars.
//   2. Response carries `duration` + `duration_unit` as the canonical
//      fields. Legacy `duration_minutes` / `duration_days` /
//      `working_days_count` are kept for rollout safety.
//   3. Whole-day tasks are no longer short-circuited to null.
//   4. Weekend/holiday preservation: when the ENTIRE span sits on
//      non-working days, the user's wall-clock intent is preserved
//      instead of collapsing to zero. If even ONE working day exists
//      in the span, working-time accounting wins — non-working
//      stretches inside the span are ignored, not preserved.

import { createRequire } from 'module';
import { query } from '../utils/db.js';
import { toDateOnly } from '../utils/dateHelper.js';
import { MINIMUM_DURATION_YEAR, MAXIMUM_DURATION_YEAR } from '../config/constants.js';

const require = createRequire(import.meta.url);
const { Gantt } = require('@dhx/gantt-node');

const DEFAULT_WORKING_DAY_NUMBERS = [2, 3, 4, 5, 6];

const EMPTY_RESULT = () => ({
    success: true,
    data: {
        duration: null,
        duration_unit: null,
        // legacy fields, kept for rollout safety
        duration_minutes: null,
        duration_days: null,
        working_days_count: null,
    },
});

function buildWorkingDaysConfig(rows, useWorkingTime) {
    const config = new Array(7).fill(null);
    for (const row of rows) {
        const dbDay = Number(row.day_of_week);
        if (!Number.isInteger(dbDay) || dbDay < 1 || dbDay > 7) continue;
        const jsDay = dbDay - 1;
        if (!useWorkingTime) {
            config[jsDay] = { start: '00:00', end: '24:00' };
            continue;
        }
        const start = row.start_time;
        const end = row.end_time;
        if (start === null && end === null) {
            config[jsDay] = { start: '00:00', end: '24:00' };
            continue;
        }
        if (start === null || end === null) {
            config[jsDay] = null;
            continue;
        }
        config[jsDay] = { start: String(start).slice(0, 5), end: String(end).slice(0, 5) };
    }
    return config;
}

const formatDay = (d) => {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// A day counts as working if the calendar has a slot for it and it is
// not a holiday. Independent of the hours inside the slot.
const isWorkingDayByConfig = (dayMidnight, config, holidaySet) => {
    const slot = config[dayMidnight.getDay()];
    if (slot === null) return false;
    if (holidaySet.has(formatDay(dayMidnight))) return false;
    return true;
};

const countWorkingDaysByConfig = (start, end, config, holidays) => {
    const holidaySet = new Set(holidays || []);
    const cursor = new Date(start.getTime());
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(end.getTime());
    endDay.setHours(0, 0, 0, 0);

    let count = 0;
    const guardLimit = 365 * 5;
    let guard = 0;
    while (cursor <= endDay && guard < guardLimit) {
        if (isWorkingDayByConfig(cursor, config, holidaySet)) count++;
        cursor.setDate(cursor.getDate() + 1);
        guard++;
    }
    return count;
};

const fetchCalendarContext = async (workspace_id, project_id) => {
    const [project] = await query(
        `SELECT id, type, use_working_time FROM ph_projects
         WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
        [project_id, workspace_id]
    );
    if (!project) throw new Error(`Project ${project_id} not found`);
    if (project.type === 'my_tasks') throw new Error('Gantt is not available for my_tasks projects');

    const useWorkingTime = !!project.use_working_time;

    const rows = await query(
        `SELECT day_of_week, start_time, end_time
         FROM ph_project_working_days
         WHERE workspace_id = ? AND project_id = ?
         ORDER BY day_of_week`,
        [workspace_id, project_id]
    );

    let configRows = rows;
    if (configRows.length === 0) {
        const [cfg] = await query(
            `SELECT configuration FROM ph_configurations WHERE name = 'working_days' LIMIT 1`
        );
        if (cfg && cfg.configuration) {
            try {
                const parsed = typeof cfg.configuration === 'string'
                    ? JSON.parse(cfg.configuration)
                    : cfg.configuration;
                if (Array.isArray(parsed)) {
                    configRows = parsed
                        .map(r => Number(r.day_of_week))
                        .filter(d => Number.isInteger(d) && d >= 1 && d <= 7)
                        .map(d => ({ day_of_week: d, start_time: null, end_time: null }));
                }
            } catch { configRows = []; }
        }
    }

    if (configRows.length === 0) {
        configRows = DEFAULT_WORKING_DAY_NUMBERS.map(d => ({
            day_of_week: d, start_time: null, end_time: null,
        }));
    }

    const workingDaysConfig = buildWorkingDaysConfig(configRows, useWorkingTime);

    const holidayRows = await query(
        `SELECT date FROM ph_off_days
         WHERE workspace_id = ? AND (project_id IS NULL OR project_id = ?)`,
        [workspace_id, project_id]
    );
    const holidays = holidayRows.map(r => toDateOnly(r.date));

    return { workingDaysConfig, holidays, useWorkingTime };
};

const buildEphemeralGantt = ({ workingDaysConfig, holidays, useWorkingTime }) => {
    const gantt = Gantt.getGanttInstance({ plugins: { auto_scheduling: true } });

    gantt.config.date_format = "%Y-%m-%d %H:%i:%s";
    gantt.config.duration_unit = 'minute';
    gantt.config.auto_types = false;

    const hasWeekends = workingDaysConfig.some(slot => slot === null);
    const hasRestrictedHours = useWorkingTime && workingDaysConfig.some(
        slot => slot !== null && !(slot.start === '00:00' && slot.end === '24:00')
    );
    const hasHolidays = holidays && holidays.length > 0;

    gantt.config.work_time = hasWeekends || hasRestrictedHours || hasHolidays;
    gantt.config.correct_work_time = gantt.config.work_time;

    for (let day = 0; day <= 6; day++) {
        const slot = workingDaysConfig[day];
        if (slot === null) {
            gantt.setWorkTime({ day, hours: false });
        } else {
            gantt.setWorkTime({ day, hours: [`${slot.start}-${slot.end}`] });
        }
    }

    holidays.forEach(dateStr => {
        gantt.setWorkTime({ date: new Date(dateStr + 'T00:00:00'), hours: false });
    });

    return gantt;
};

export const calculateTaskDuration = async ({ workspace_id, project_id, start_at, due_at, time_used }) => {
    // Dates are the only hard requirement. Milestones arrive with
    // start_at = null and are handled by the Laravel caller.
    if (start_at == null || due_at == null) {
        return EMPTY_RESULT();
    }

    let startDate = new Date(start_at);
    let dueDate = new Date(due_at);

    if (isNaN(startDate) || isNaN(dueDate)) {
        return { success: false, error: 'Invalid start_at or due_at' };
    }

    const startYear = startDate.getFullYear();
    const dueYear = dueDate.getFullYear();
    if (startYear < MINIMUM_DURATION_YEAR || startYear > MAXIMUM_DURATION_YEAR
        || dueYear < MINIMUM_DURATION_YEAR || dueYear > MAXIMUM_DURATION_YEAR) {
        return EMPTY_RESULT();
    }

    if (startDate.getTime() > dueDate.getTime()) {
        return EMPTY_RESULT();
    }

    const calendar = await fetchCalendarContext(Number(workspace_id), Number(project_id));

    // If the project has no working days at all, there is nothing to compute.
    if (!calendar.workingDaysConfig.some(slot => slot !== null)) {
        return EMPTY_RESULT();
    }

    const timeUsed = !!time_used;

    const gantt = buildEphemeralGantt(calendar);

    gantt.parse({
        data: [{
            id: 1,
            text: 'duration-calc',
            start_date: startDate,
            end_date: dueDate,
            time_used: true,   // parsed as time-tracked so Gantt returns working minutes
        }],
        links: [],
    });

    const task = gantt.getTask(1);
    let minutes = task.duration;

    let workingDaysCount = countWorkingDaysByConfig(
        startDate,
        dueDate,
        calendar.workingDaysConfig,
        calendar.holidays
    );

    gantt.destructor();

    // ── v5 weekend/holiday preservation ──
    // If the ENTIRE span sits on non-working days (zero working days between
    // start and due), preserve the user's wall-clock intent instead of
    // collapsing to zero. The scheduler later places the task on the next
    // working day and rebuilds the end from this duration.
    //
    // If even ONE working day exists in the span, working-time accounting
    // wins — non-working stretches inside the span are ignored, not preserved.
    if (workingDaysCount === 0) {
        const startDayMid = new Date(startDate.getTime());
        startDayMid.setHours(0, 0, 0, 0);
        const endDayMid = new Date(dueDate.getTime());
        endDayMid.setHours(0, 0, 0, 0);

        workingDaysCount =
            Math.round((endDayMid.getTime() - startDayMid.getTime()) / 86400000) + 1;

        minutes = Math.round((dueDate.getTime() - startDate.getTime()) / 60000);
    }

    // v5: canonical fields are duration + duration_unit.
    //   time-tracked → minutes
    //   whole-day    → days
    const duration = timeUsed ? minutes : workingDaysCount;
    const durationUnit = timeUsed ? 'minutes' : 'days';

    return {
        success: true,
        data: {
            duration,
            duration_unit: durationUnit,
            // legacy fields, kept for rollout safety
            duration_minutes: minutes,
            duration_days: timeUsed ? null : workingDaysCount,
            working_days_count: workingDaysCount,
        },
    };
};