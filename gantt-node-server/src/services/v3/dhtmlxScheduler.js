// src/services/v3/dhtmlxScheduler.js
//
// v3 — whole-day approach + milestone support.
// FIX: removed redundant enforceMixedTimeUsedLinks; use existing whole-day normalization.
// FIX: store duration from Gantt after parse for accurate date updates.

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

    // ── Build snapshot (duration will be filled after parse) ──
    const snapshot = new Map(allTasks.map(t => {
        return [t.id, {
            name: t.name || `Task ${t.id}`,
            start_at: anyToMysql(t.start_at) ?? t.start_at,
            due_at: anyToMysql(t.due_at) ?? t.due_at,
            constraint_type: t.constraint_type || 'asap',
            constraint_date: t.constraint_date ? (anyToMysql(t.constraint_date) ?? (toDateOnly(t.constraint_date) + ' 00:00:00')) : null,
            time_used: !!t.time_used,
            type: t.task_type_handler || 'task',
            duration: null // will be set after parse
        }];
    }));

    const gantt = createGanttInstance({ workDays, holidays, project });

    // ── Convert tasks to Gantt format ──
    const normTasks = allTasks.map(t => {
        const timeUsed = !!t.time_used;
        const type = t.task_type_handler || 'task';
        let startDate = toDate(t.start_at);
        let endDate = toDate(t.due_at);
        let duration = null;

        if (type === 'milestone') {
            startDate = endDate;
            duration = 0;
        } else {
            endDate = toGanttEnd(endDate, timeUsed);
        }

        return {
            id: t.id,
            text: t.name || `Task ${t.id}`,
            parent: t.parent_id ?? 0,
            start_date: startDate,
            end_date: endDate,
            duration: duration,
            progress: t.progress || 0,
            constraint_type: t.constraint_type || 'asap',
            constraint_date: t.constraint_date ? toDate(t.constraint_date) : null,
            time_used: timeUsed,
            type: type
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

    // ── FIX: Store duration from Gantt into snapshot ──
    gantt.eachTask(t => {
        const snap = snapshot.get(t.id);
        if (snap) {
            snap.duration = t.duration;
        }
    });

    gantt.config.auto_scheduling.gap_behavior = project.auto_schedule_tasks_gap === 'compress' ? 'compress' : 'preserve';
    gantt.config.auto_scheduling.apply_constraints = true;

    // ── Apply triggered date updates (use stored duration) ──
    if (task_id && triggeredDates) {
        const task = gantt.getTask(task_id);
        if (task) {
            const oldStart = task.start_date.getTime();
            let newStart = toDate(triggeredDates.start_at);
            let newEnd = toDate(triggeredDates.due_at);

            if (task.type === 'milestone') {
                const singleDate = newEnd || newStart || new Date();
                newStart = singleDate;
                newEnd = singleDate;
            } else {
                const snap = snapshot.get(task_id);
                let originalDuration = snap ? snap.duration : null;      // ✅ let, not const

                // ✅ FIX: for whole-day tasks (time_used = false), Gantt's duration is
                // working minutes and collapses to 0 when the original start lands on
                // a non-working day. Use the calendar day span from the input instead.
                if (!task.time_used) {
                    const origStart = toDate(triggeredDates.start_at);
                    const origDue = toDate(triggeredDates.due_at);
                    const daySpan = Math.max(
                        1,
                        Math.round((origDue - origStart) / 86400000) + 1
                    );
                    originalDuration = daySpan * 1440;
                }

                if (originalDuration !== null) {
                    if (gantt.config.work_time && !gantt.isWorkTime(newStart)) {
                        newStart = gantt.getClosestWorkTime({ date: newStart, dir: 'future' });
                    }
                    newEnd = gantt.calculateEndDate({
                        start_date: newStart,
                        duration: originalDuration,
                        unit: 'minute',
                        task
                    });
                } else {
                    // Fallback (should not happen)
                    if (gantt.config.work_time) {
                        const minDuration = task.time_used ? 1 : 1440;
                        const duration = Math.max(minDuration, gantt.calculateDuration({ start_date: newStart, end_date: newEnd, task }));
                        if (!gantt.isWorkTime(newStart)) newStart = gantt.getClosestWorkTime({ date: newStart, dir: 'future' });
                        newEnd = gantt.calculateEndDate({ start_date: newStart, duration, unit: 'minute', task });
                    } else {
                        newEnd = toGanttEnd(newEnd, task.time_used);
                    }
                }
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

    // ── Handle link operations ──
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

    // ── Run auto‑scheduling ──
    if (derivedTaskId) {
        if (gantt.isTaskExists(derivedTaskId)) {
            gantt.autoSchedule(derivedTaskId);
        } else {
            throw new Error(`Scheduling blocked: Task ${derivedTaskId} does not exist in Project ${project.id}`);
        }
    } else {
        gantt.autoSchedule();
    }

    // ── Whole-day normalization pass (skip milestones) ──
    // Preserve WORKING-DAY span from the original DB values, not calendar-day span.
    // Weekends/holidays are excluded from the count; zero-working-day spans get
    // promoted to 1 working day and snap forward to the next working day.
    gantt.batchUpdate(() => {
        gantt.eachTask(t => {
            if (t.type === 'milestone') return;
            if (t.time_used) return;

            const snap = snapshot.get(t.id);
            if (!snap || !snap.start_at || !snap.due_at) return;

            const origStart = toDate(snap.start_at);
            const origDue = toDate(snap.due_at);

            // ── Count working days inside [origStart, origDue] inclusive ──
            let workingDays = 0;
            const cursor = new Date(origStart.getTime());
            while (cursor <= origDue) {
                if (!gantt.config.work_time || gantt.isWorkTime(cursor)) {
                    workingDays++;
                }
                cursor.setDate(cursor.getDate() + 1);
            }

            // ── Snap start forward if it sits on a non-working day ──
            let start = gantt.date.day_start(t.start_date);
            if (gantt.config.work_time && !gantt.isWorkTime(start)) {
                start = gantt.getClosestWorkTime({ date: start, dir: 'future' });
                start = gantt.date.day_start(start);
            }

            // ── Zero working days in the original span → promote to 1 ──
            if (workingDays === 0) {
                workingDays = 1;
            }

            // ── Advance end by (workingDays - 1) working days ──
            let end = new Date(start.getTime());
            let remaining = workingDays - 1;
            while (remaining > 0) {
                end.setDate(end.getDate() + 1);
                if (!gantt.config.work_time || gantt.isWorkTime(end)) {
                    remaining--;
                }
            }
            end = addOneDay(end);   // Gantt uses exclusive end

            t.start_date = start;
            t.end_date = end;
            gantt.updateTask(t.id);
        });
    });

    // ── Build Diff ──
    const tasks = [];
    let triggeredFinal = null;

    gantt.eachTask(t => {
        let inclusiveEnd;
        if (t.type === 'milestone') {
            inclusiveEnd = t.end_date;
        } else {
            inclusiveEnd = fromGanttEnd(t.end_date, t.time_used);
        }

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
            constraint_date: newConstraintDate,
            type: before.type
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