// src/services/v3/dhtmlxScheduler.js
//
// CHANGES THIS PASS:
//   1. Project date-bounds tracking removed.
//   2. hasHierarchyLink validation removed.
//   3. Dependency on project.restrict_tasks_to_working_days removed.
//      Now uses the 'weekend' JSON (already parsed into context.workDays)
//      to determine non-working weekdays. work_time is enabled if there
//      are any weekends or holidays.

import { createRequire } from 'module';
import { toDate, anyToMysql, toDateOnly, toMin } from '../../utils/dateHelper.js';
import { hasCircularLink } from '../../validators/ganttValidator.js';

const require = createRequire(import.meta.url);
const { Gantt } = require('@dhx/gantt-node');

const LINK_TYPE_MAP = {
    'finish_to_start': '0',
    'start_to_start': '1',
    'finish_to_finish': '2',
    'start_to_finish': '3'
};

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
const isMidnight = (date) => (
    date.getHours() === 0 && date.getMinutes() === 0 &&
    date.getSeconds() === 0 && date.getMilliseconds() === 0
);

const toGanttEnd = (date, timeUsed) => (timeUsed ? date : addOneDay(date));
const fromGanttEnd = (date, timeUsed) => (timeUsed || !isMidnight(date)) ? date : subOneDay(date);

const createGanttInstance = ({ workDays, holidays, project }) => {
    const gantt = Gantt.getGanttInstance({ plugins: { auto_scheduling: true } });

    gantt.config.date_format = "%Y-%m-%d %H:%i:%s";
    gantt.config.duration_unit = 'minute';
    gantt.config.auto_types = false;

    // Enable work_time if there are any non-working days (weekends or holidays)
    const hasWeekends = workDays.length < 7;
    const hasHolidays = holidays && holidays.length > 0;
    gantt.config.work_time = hasWeekends || hasHolidays;
    gantt.config.correct_work_time = gantt.config.work_time;

    gantt.config.auto_scheduling = {
        enabled: !!project.auto_schedule_tasks,
        apply_constraints: true,
        gap_behavior: project.auto_schedule_tasks_gap === 'compress' ? 'compress' : 'preserve',
        move_projects: false,
        schedule_on_parse: false
    };

    [0, 1, 2, 3, 4, 5, 6].forEach(day => {
        gantt.setWorkTime({ day, hours: workDays.includes(day) ? ['00:00-24:00'] : false });
    });

    (holidays || []).forEach(dateStr => {
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

    if (!project.auto_schedule_tasks) {
        return {
            success: true,
            message: 'Auto-scheduling is disabled for this project',
            data: {
                triggeredTask: null,
                tasks: [],
                impactedTaskIds: [],
                project: { id: project.id, start_date: project.start_date, due_date: project.due_date }
            }
        };
    }

    const snapshot = new Map(allTasks.map(t => [t.id, {
        name: t.name || `Task ${t.id}`,
        start_at: anyToMysql(t.start_at) ?? t.start_at,
        due_at: anyToMysql(t.due_at) ?? t.due_at,
        constraint_type: t.constraint_type || 'asap',
        constraint_date: t.constraint_date ? (anyToMysql(t.constraint_date) ?? (toDateOnly(t.constraint_date) + ' 00:00:00')) : null,
        time_used: !!t.time_used
    }]));

    const gantt = createGanttInstance({ workDays, holidays, project });

    const normTasks = allTasks.map(t => {
        const timeUsed = !!t.time_used;
        return {
            id: t.id,
            text: t.name || `Task ${t.id}`,
            parent: t.parent_id ?? 0,
            start_date: toDate(t.start_at),
            end_date: toGanttEnd(toDate(t.due_at), timeUsed),
            progress: t.progress || 0,
            constraint_type: t.constraint_type || 'asap',
            constraint_date: t.constraint_date ? toDate(t.constraint_date) : null,
            time_used: timeUsed
        };
    });

    let normLinks = allLinks.map(l => ({
        id: l.id,
        source: l.source_task_id,
        target: l.target_task_id,
        type: LINK_TYPE_MAP[l.type] ?? '0'
    }));

    let derivedTaskId = task_id;
    if (operation === 'delete_link' && link_id) {
        const deletedLink = normLinks.find(l => l.id === link_id);
        if (deletedLink) {
            derivedTaskId = deletedLink.target;
        } else {
            return { success: false, error: 'Link to delete not found' };
        }
        normLinks = normLinks.filter(l => l.id !== link_id);
    }

    gantt.parse({ data: normTasks, links: normLinks });

    gantt.config.auto_scheduling.gap_behavior = project.auto_schedule_tasks_gap === 'compress' ? 'compress' : 'preserve';
    gantt.config.auto_scheduling.apply_constraints = true;

    if (task_id && triggeredDates) {
        const task = gantt.getTask(task_id);
        if (task) {
            const oldStart = task.start_date.getTime();
            let newStart = toDate(triggeredDates.start_at);
            let newEnd = toGanttEnd(toDate(triggeredDates.due_at), task.time_used);

            if (gantt.config.work_time) {
                const minDuration = task.time_used ? 1 : 1440;
                const duration = Math.max(minDuration, gantt.calculateDuration({ start_date: newStart, end_date: newEnd, task }));
                if (!gantt.isWorkTime(newStart)) newStart = gantt.getClosestWorkTime({ date: newStart, dir: 'future' });
                newEnd = gantt.calculateEndDate({ start_date: newStart, duration, unit: 'minute', task });
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

    if (operation === 'delete_link' && derivedTaskId) {
        const task = gantt.getTask(derivedTaskId);
        if (task && task.constraint_type === 'snet') {
            task.constraint_type = 'asap';
            task.constraint_date = null;
            gantt.updateTask(derivedTaskId);
        }
    }

    if (operation === 'update_link' && link_id && new_type) {
        if (!gantt.isLinkExists(link_id)) {
            return { success: false, error: 'Link to update not found' };
        }
        const existingLink = gantt.getLink(link_id);
        const mappedType = LINK_TYPE_MAP[new_type] ?? new_type;
        const cascadeFrom = (mappedType === '3') ? existingLink.source : existingLink.target;
        const affectedTask = gantt.getTask(cascadeFrom);
        if (affectedTask && affectedTask.constraint_type === 'snet') {
            affectedTask.constraint_type = 'asap';
            affectedTask.constraint_date = null;
            gantt.updateTask(cascadeFrom);
        }
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
        gantt.addLink({ id: 'virtual_preview_link', source: sourceId, target: targetId, type: mappedType });
        derivedTaskId = targetId;
    }

    if (derivedTaskId) {
        if (gantt.isTaskExists(derivedTaskId)) {
            gantt.autoSchedule(derivedTaskId);
        } else {
            throw new Error(`Scheduling blocked: Task ${derivedTaskId} does not exist in Project ${project.id}`);
        }
    } else {
        gantt.autoSchedule();
    }

    // ── Whole-day normalization pass ──
    gantt.batchUpdate(() => {
        gantt.eachTask(t => {
            if (t.time_used) return;

            const isMidnightStart = (
                t.start_date.getHours() === 0 && t.start_date.getMinutes() === 0 &&
                t.start_date.getSeconds() === 0 && t.start_date.getMilliseconds() === 0
            );
            if (isMidnightStart) return;

            let target = gantt.date.add(gantt.date.day_start(t.start_date), 1, "day");
            if (gantt.config.work_time && !gantt.isWorkTime(target)) {
                target = gantt.getClosestWorkTime({ date: target, dir: 'future' });
                target = gantt.date.day_start(target);
            }

            const duration = t.duration;
            const newEnd = gantt.calculateEndDate({
                start_date: target,
                duration: duration,
                unit: 'minute'
            });

            t.start_date = target;
            t.end_date = newEnd;
            gantt.updateTask(t.id);
        });
    });

    // ── Build Diff ──
    const tasks = [];
    let triggeredFinal = null;

    gantt.eachTask(t => {
        const inclusiveEnd = fromGanttEnd(t.end_date, t.time_used);

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
            triggeredFinal = taskOutput;
            if (dateChanged || constraintChanged) tasks.push(taskOutput);
        } else if (dateChanged || constraintChanged) {
            tasks.push(taskOutput);
        }
    });

    gantt.destructor();

    const impactedTaskIds = [...new Set(tasks.map(t => t.id))];

    return {
        success: true,
        message: 'Calculation complete',
        data: {
            triggeredTask: triggeredFinal,
            tasks,
            impactedTaskIds,
            project: { id: project.id, start_date: project.start_date, due_date: project.due_date }
        }
    };
};