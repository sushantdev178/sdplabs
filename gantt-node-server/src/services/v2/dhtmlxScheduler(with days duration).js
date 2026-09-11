// src/services/dhtmlxScheduler.js

import { createRequire } from 'module';
import { toDate, anyToMysql, toDateOnly, toMin } from '../../utils/dateHelper.js';
import { hasCircularLink, hasHierarchyLink } from '../../validators/ganttValidator.js';

const require = createRequire(import.meta.url);
const { Gantt } = require('@dhx/gantt-node');

const LINK_TYPE_MAP = {
    'finish_to_start': '0',
    'start_to_start': '1',
    'finish_to_finish': '2',
    'start_to_finish': '3'
};

// ── Inclusive/Exclusive end-date boundary conversion ──
// Our business rule: "10th to 12th" = 3 full inclusive days.
// DHTMLX's native rule: end_date is exclusive (midnight AFTER the last
// working day) — the same range is 2 days internally.
// Rather than injecting any time-of-day (e.g. 23:59:59) to bridge this —
// which reintroduces fractional-day remainders and triggers Gantt's
// day-unit rounding — we convert with pure whole-day arithmetic, always
// on exact midnight boundaries. This guarantees calculateDuration() only
// ever sees integer day spans, so there is nothing for it to round.
//
// IMPORTANT: this conversion applies ONLY when time_used === false
// (whole-day tasks). For time_used === true (hour-precision tasks), the
// due date is expected to carry a real time-of-day and is NOT a whole-day
// block — there is no inclusive/exclusive ambiguity to correct, and
// shifting it by a day would silently corrupt an hour-precision deadline.
const addOneDay = (date) => {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + 1);
    return d;
};
const subOneDay = (date) => {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() - 1);
    return d;
};
// Gated wrappers — use these everywhere instead of the raw helpers above.
const toGanttEnd = (date, timeUsed) => (timeUsed ? date : addOneDay(date));
const fromGanttEnd = (date, timeUsed) => (timeUsed ? date : subOneDay(date));

// NOTE: No module-level gantt instance here — removed rogue instance that was
// created at module load time and potentially corrupting shared internal state.

const createGanttInstance = ({ workDays, holidays, project }) => {
    const gantt = Gantt.getGanttInstance({ plugins: { auto_scheduling: true } });

    // 1. Core Configuration
    gantt.config.date_format = "%Y-%m-%d %H:%i:%s";
    gantt.config.duration_unit = 'day';
    gantt.config.auto_types = false;

    // 2. Database Flags → Native Gantt Config
    gantt.config.work_time = !!project.restrict_tasks_to_working_days;
    gantt.config.correct_work_time = !!project.restrict_tasks_to_working_days;

    // Set full auto_scheduling config object
    gantt.config.auto_scheduling = {
        enabled: !!project.auto_schedule_tasks,
        apply_constraints: true,
        gap_behavior: project.auto_schedule_tasks_gap === 'compress' ? 'compress' : 'preserve',
        move_projects: false,
        schedule_on_parse: false
    };

    // 3. Working Days
    [0, 1, 2, 3, 4, 5, 6].forEach(day => {
        gantt.setWorkTime({ day, hours: workDays.includes(day) ? ['00:00-24:00'] : false });
    });

    // 4. Holidays
    holidays.forEach(dateStr => {
        gantt.setWorkTime({ date: new Date(dateStr + 'T00:00:00'), hours: false });
    });

    return gantt;
};

export const runScheduling = ({ context, task_id, triggeredDates, operation, link_id, link, new_type }) => {
    const { project, workDays, holidays, allTasks, allLinks } = context;

    const linksForValidation = (operation === 'add_link' && link)
        ? [...allLinks, { source_task_id: Number(link.source), target_task_id: Number(link.target) }]
        : allLinks;

    // ── Validations ──
    const circularCheck = hasCircularLink(allTasks, linksForValidation);
    if (circularCheck) return { success: false, error: 'Circular link detected — scheduling blocked' };

    const hierarchyCheck = hasHierarchyLink(allTasks, linksForValidation);
    if (hierarchyCheck.found) return { success: false, error: `Hierarchy link blocked: ${hierarchyCheck.reason}` };

    if (!project.auto_schedule_tasks) {
        return {
            success: true,
            message: 'Auto-scheduling is disabled for this project',
            data: {
                triggeredTask: null,
                tasks: [],
                impactedTaskIds: [],
                project: null
            }
        };
    }

    // ── 1. Baseline Snapshot (before any changes) ──
    const snapshot = new Map(allTasks.map(t => [t.id, {
        name: t.name || `Task ${t.id}`,
        start_at: anyToMysql(t.start_at) ?? t.start_at,
        due_at: anyToMysql(t.due_at) ?? t.due_at,
        constraint_type: t.constraint_type || 'asap',
        constraint_date: t.constraint_date ? (anyToMysql(t.constraint_date) ?? (toDateOnly(t.constraint_date) + ' 00:00:00')) : null,
        time_used: !!t.time_used
    }]));

    const gantt = createGanttInstance({ workDays, holidays, project });

    // ── 2. Format Tasks and Links ──
    const normTasks = allTasks.map(t => {
        const timeUsed = !!t.time_used;
        return {
            id: t.id,
            text: t.name || `Task ${t.id}`,
            parent: t.parent_id ?? 0,
            start_date: toDate(t.start_at),
            end_date: toGanttEnd(toDate(t.due_at), timeUsed), // inclusive DB date -> exclusive Gantt date, only for whole-day tasks
            progress: t.progress || 0,
            constraint_type: t.constraint_type || 'asap',
            constraint_date: t.constraint_date ? toDate(t.constraint_date) : null,
            time_used: timeUsed // custom prop — round-trips through Gantt, read back at every later call site
        };
    });

    // If delete_link: remove all incoming links to successor before parse
    // so DHTMLX never sees the deleted link at all
    let normLinks = allLinks.map(l => ({
        id: l.id,
        source: l.source_task_id,
        target: l.target_task_id,
        type: LINK_TYPE_MAP[l.type] ?? '0'
    }));

    // For delete_link: find the target from the link, then remove only that link
    let derivedTaskId = task_id;
    if (operation === 'delete_link' && link_id) {
        const deletedLink = normLinks.find(l => l.id === link_id);
        if (deletedLink) {
            derivedTaskId = deletedLink.target;  // use as autoSchedule anchor
        } else {
            return { success: false, error: 'Link to delete not found' };
        }
        normLinks = normLinks.filter(l => l.id !== link_id);  // remove only deleted link
    }

    gantt.parse({ data: normTasks, links: normLinks });

    // Re-apply after parse — gantt.parse() resets the auto_scheduling config
    // object internally, so these must be set again before autoSchedule runs.
    gantt.config.auto_scheduling.gap_behavior = project.auto_schedule_tasks_gap === 'compress' ? 'compress' : 'preserve';
    gantt.config.auto_scheduling.apply_constraints = true;

    // ── NOTE: Constraint-date snap-pass logic REMOVED ──
    // Testing native DHTMLX behavior when a constraint_date falls on a
    // non-working day, with no manual correction applied.

    // ── 3. Apply Triggered Task Update (drag / resize) ──
    if (task_id && triggeredDates) {
        const task = gantt.getTask(task_id);
        if (task) {
            const oldStart = task.start_date.getTime();
            let newStart = toDate(triggeredDates.start_at);
            let newEnd = toGanttEnd(toDate(triggeredDates.due_at), task.time_used); // inclusive input -> exclusive for Gantt math, only for whole-day tasks

            if (project.restrict_tasks_to_working_days) {
                const duration = Math.max(1, gantt.calculateDuration({ start_date: newStart, end_date: newEnd, task }));
                if (!gantt.isWorkTime(newStart)) newStart = gantt.getClosestWorkTime({ date: newStart, dir: 'future' });
                newEnd = gantt.calculateEndDate({ start_date: newStart, duration, unit: 'day', task });
            }

            task.start_date = newStart;
            task.end_date = newEnd;

            if (newStart.getTime() !== oldStart) {
                task.constraint_type = 'snet';
                task.constraint_date = newStart;
            }

            gantt.updateTask(task_id);
        }
    }

    // Step 3b — clear stale SNET on derived target
    if (operation === 'delete_link' && derivedTaskId) {
        const task = gantt.getTask(derivedTaskId);
        if (task && task.constraint_type === 'snet') {
            task.constraint_type = 'asap';
            task.constraint_date = null;
            gantt.updateTask(derivedTaskId);
        }
    }

    // ── Step 3c — update_link: change an existing link's type ──
    if (operation === 'update_link' && link_id && new_type) {
        if (!gantt.isLinkExists(link_id)) {
            return { success: false, error: 'Link to update not found' };
        }

        const existingLink = gantt.getLink(link_id);
        const mappedType = LINK_TYPE_MAP[new_type] ?? new_type;

        // STF (type '3') has reversed dependency direction — source depends on target.
        // All other types — target depends on source.
        const cascadeFrom = (mappedType === '3') ? existingLink.source : existingLink.target;

        // Clear stale SNET on the cascade task — old constraint may not apply under new type
        const affectedTask = gantt.getTask(cascadeFrom);
        if (affectedTask && affectedTask.constraint_type === 'snet') {
            affectedTask.constraint_type = 'asap';
            affectedTask.constraint_date = null;
            gantt.updateTask(cascadeFrom);
        }

        // Update the link type directly on the already-parsed engine
        gantt.updateLink(link_id, { ...existingLink, type: mappedType });

        derivedTaskId = cascadeFrom;
    }

    if (operation === 'add_link' && link) {
        const sourceId = Number(link.source);
        const targetId = Number(link.target);

        if (!gantt.isTaskExists(sourceId) || !gantt.isTaskExists(targetId)) {
            throw new Error(`Scheduling blocked: Source (${sourceId}) or Target (${targetId}) does not exist in Project ${project.id}`);
        }

        const mappedType = LINK_TYPE_MAP[link.type] ?? link.type ?? '0';

        gantt.addLink({
            id: 'virtual_preview_link',
            source: sourceId,
            target: targetId,
            type: mappedType
        });

        derivedTaskId = targetId;  // ← cascade forward from target
    }

    // Step 4 — autoSchedule from derived target
    if (derivedTaskId) {
        if (gantt.isTaskExists(derivedTaskId)) {
            gantt.autoSchedule(derivedTaskId);
        } else {
            throw new Error(`Scheduling blocked: Task ${derivedTaskId} does not exist in Project ${project.id}`);
        }
    } else {
        gantt.autoSchedule();
    }

    // ── 5. Build Diff ──
    // Single unified list: every task whose dates OR constraint changed
    // (relative to its pre-scheduling snapshot) is reported once, with
    // its full current state. No more separate linkAdjustments /
    // constraintUpdates buckets — a task that had both a date shift and
    // a constraint change previously would've shown up in two places;
    // now it's one entry with both new values already reflected.
    const tasks = [];
    let triggeredFinal = null;

    let projectStartMin = null;
    let projectEndMax = null;

    gantt.eachTask(t => {

        const inclusiveEnd = fromGanttEnd(t.end_date, t.time_used); // exclusive Gantt date -> inclusive DB date, only for whole-day tasks

        if (!projectStartMin || t.start_date < projectStartMin) projectStartMin = t.start_date;
        if (!projectEndMax || inclusiveEnd > projectEndMax) projectEndMax = inclusiveEnd;

        const before = snapshot.get(t.id);
        if (!before) return;

        const newStart = anyToMysql(t.start_date);
        const newEnd = anyToMysql(inclusiveEnd);
        const newConstraintType = t.constraint_type || 'asap';
        const newConstraintDate = t.constraint_date ? anyToMysql(t.constraint_date) : null;

        const dateChanged = toMin(newStart) !== toMin(before.start_at) || toMin(newEnd) !== toMin(before.due_at);
        const constraintChanged = newConstraintType !== before.constraint_type || toMin(newConstraintDate) !== toMin(before.constraint_date);

        const taskOutput = {
            id: t.id,
            name: before.name,
            start_at: newStart,
            due_at: newEnd,
            time_used: before.time_used,
            constraint_type: newConstraintType,
            constraint_date: newConstraintDate
        };

        if (t.id === task_id) {
            // Triggered task is always reported as triggeredTask, regardless
            // of whether anything actually changed (matches prior behavior
            // where the trigger's outcome is always surfaced).
            triggeredFinal = taskOutput;
            if (dateChanged || constraintChanged) tasks.push(taskOutput);
        } else if (dateChanged || constraintChanged) {
            tasks.push(taskOutput);
        }
    });

    gantt.destructor();

    const impactedTaskIds = [...new Set(tasks.map(t => t.id))];

    const calculatedProjectBounds = (projectStartMin && projectEndMax) ? {
        id: project.id,
        start_date: anyToMysql(projectStartMin),
        due_date: anyToMysql(projectEndMax)
    } : null;

    return {
        success: true,
        message: 'Calculation complete',
        data: {
            triggeredTask: triggeredFinal,
            tasks,
            impactedTaskIds,
            project: calculatedProjectBounds
        }
    };
};