// src/services/v4/dhtmlxScheduler.js
//
// v4 — working days + hours, use_working_time flag, my_tasks short-circuit.
//
// KEY BEHAVIORS:
//   1. correct_work_time = false → parse does NOT snap task dates.
//      Only the triggered task + its downstream dependents are moved.
//   2. snapConstraintDates(gantt) snaps constraint_date to the next
//      working DAY at midnight (constraint_date is a DATE column).
//   3. Diff is scoped to affectedIds = trigger + downstream dependents.
//   4. Milestones never get an auto-added SNET constraint.
//   5. Duration fallback: when a time-tracked task's DB span sits
//      entirely on a non-working day (working-minutes = 0), fall back
//      to the raw timestamp span so duration isn't collapsed.
//   6. Trigger task's requested working duration is preserved through
//      autoSchedule → post-pass (see EDIT 2 / EDIT 3).

import { createRequire } from 'module';
import { toDate, anyToMysql, toDateOnly, toMin } from '../../utils/dateHelper.js';
import { hasCircularLink } from '../../validators/ganttValidator.js';

const require = createRequire(import.meta.url);
const { Gantt } = require('@dhx/gantt-node');

const LINK_TYPE_MAP = {
    'finish_to_start': '0',
    'start_to_start': '1',
    'finish_to_finish': '2',
    'start_to_finish': '3',
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

const toDateOrNull = (value) => (value === null || value === undefined) ? null : toDate(value);

// ── WORKING-DAY WINDOWS ───────────────────────────────────────────────

const formatDay = (d) => {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const isWorkingDay = (dayMidnight, workingDaysConfig, holidays) => {
    const slot = workingDaysConfig[dayMidnight.getDay()];
    if (slot === null) return false;
    if (holidays && holidays.includes(formatDay(dayMidnight))) return false;
    return true;
};

const windowStartForDay = (dayMidnight, workingDaysConfig) => {
    const slot = workingDaysConfig[dayMidnight.getDay()];
    if (slot === null) return null;
    if (slot.start === '00:00' && slot.end === '24:00') {
        const d = new Date(dayMidnight.getTime());
        d.setHours(0, 0, 0, 0);
        return d;
    }
    const [h, m] = slot.start.split(':').map(Number);
    const d = new Date(dayMidnight.getTime());
    d.setHours(h, m, 0, 0);
    return d;
};

const windowEndForDay = (dayMidnight, workingDaysConfig) => {
    const slot = workingDaysConfig[dayMidnight.getDay()];
    if (slot === null) return null;
    if (slot.start === '00:00' && slot.end === '24:00') {
        const d = new Date(dayMidnight.getTime());
        d.setHours(0, 0, 0, 0);
        return addOneDay(d);
    }
    const [h, m] = slot.end.split(':').map(Number);
    const d = new Date(dayMidnight.getTime());
    d.setHours(h, m, 0, 0);
    return d;
};

const computeGanttSpanForWholeDay = (startMidnight, dueMidnight, workingDaysConfig, holidays) => {
    const startDay = new Date(startMidnight.getTime());
    startDay.setHours(0, 0, 0, 0);
    const dueDay = new Date(dueMidnight.getTime());
    dueDay.setHours(0, 0, 0, 0);

    let firstWorking = null;
    let cursor = new Date(startDay.getTime());
    while (cursor <= dueDay) {
        if (isWorkingDay(cursor, workingDaysConfig, holidays)) {
            firstWorking = new Date(cursor.getTime());
            break;
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    let lastWorking = null;
    cursor = new Date(dueDay.getTime());
    while (cursor >= startDay) {
        if (isWorkingDay(cursor, workingDaysConfig, holidays)) {
            lastWorking = new Date(cursor.getTime());
            break;
        }
        cursor.setDate(cursor.getDate() - 1);
    }

    if (!firstWorking || !lastWorking || lastWorking < firstWorking) {
        return { ganttStart: startDay, ganttEnd: addOneDay(dueDay) };
    }

    return {
        ganttStart: windowStartForDay(firstWorking, workingDaysConfig),
        ganttEnd: windowEndForDay(lastWorking, workingDaysConfig),
    };
};

const computeDbMidnightsForWholeDay = (ganttStart, ganttEnd) => {
    const startMidnight = new Date(ganttStart.getTime());
    startMidnight.setHours(0, 0, 0, 0);

    const lastMoment = new Date(ganttEnd.getTime() - 1000);
    const dueMidnight = new Date(lastMoment.getTime());
    dueMidnight.setHours(0, 0, 0, 0);

    return { startMidnight, dueMidnight };
};

// ── EDIT 1 ──
// Compute working minutes between two instants, respecting the workspace
// calendar. Used to capture the trigger task's requested duration before
// autoSchedule overwrites the span.
const computeWorkingMinutes = (start, end, workingDaysConfig, holidays) => {
    if (!start || !end || end <= start) return 0;

    let total = 0;
    const cursor = new Date(start.getTime());
    cursor.setHours(0, 0, 0, 0);

    const guardLimit = 365 * 5;
    let guard = 0;

    while (cursor < end && guard < guardLimit) {
        if (isWorkingDay(cursor, workingDaysConfig, holidays)) {
            const wStart = windowStartForDay(cursor, workingDaysConfig);
            const wEnd = windowEndForDay(cursor, workingDaysConfig);

            if (wStart && wEnd) {
                const ovStart = start > wStart ? start : wStart;
                const ovEnd = end < wEnd ? end : wEnd;
                if (ovEnd > ovStart) {
                    total += Math.round((ovEnd.getTime() - ovStart.getTime()) / 60000);
                }
            }
        }
        cursor.setDate(cursor.getDate() + 1);
        guard++;
    }

    return total;
};

// Snap a date to the next working day at midnight (for DATE-only columns).
const snapToNextWorkingDayMidnight = (date, workingDaysConfig, holidays) => {
    const d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    let guard = 0;
    while (!isWorkingDay(d, workingDaysConfig, holidays) && guard < 366) {
        d.setDate(d.getDate() + 1);
        guard++;
    }
    return d;
};

// ── GANTT INSTANCE ────────────────────────────────────────────────────

const applyWorkingDaysConfig = (gantt, workingDaysConfig, holidays, useWorkingTime) => {
    const hasWeekends = workingDaysConfig.some(slot => slot === null);
    const hasRestrictedHours = useWorkingTime && workingDaysConfig.some(
        slot => slot !== null && !(slot.start === '00:00' && slot.end === '24:00')
    );
    const hasHolidays = holidays && holidays.length > 0;

    gantt.config.work_time = hasWeekends || hasRestrictedHours || hasHolidays;
    gantt.config.correct_work_time = false;

    for (let day = 0; day <= 6; day++) {
        const slot = workingDaysConfig[day];
        if (slot === null) {
            gantt.setWorkTime({ day, hours: false });
        } else {
            gantt.setWorkTime({ day, hours: [`${slot.start}-${slot.end}`] });
        }
    }

    (holidays || []).forEach(dateStr => {
        gantt.setWorkTime({ date: new Date(dateStr + 'T00:00:00'), hours: false });
    });
};

const createGanttInstance = ({ workingDaysConfig, holidays, project }) => {
    const gantt = Gantt.getGanttInstance({ plugins: { auto_scheduling: true } });

    gantt.config.date_format = "%Y-%m-%d %H:%i:%s";
    gantt.config.duration_unit = 'minute';
    gantt.config.auto_types = false;

    applyWorkingDaysConfig(gantt, workingDaysConfig, holidays, !!project.use_working_time);

    gantt.config.auto_scheduling = {
        enabled: !!project.auto_schedule_tasks,
        apply_constraints: true,
        gap_behavior: project.auto_schedule_tasks_gap === 'compress' ? 'compress' : 'preserve',
        move_projects: false,
        schedule_on_parse: false,
    };

    return gantt;
};

// ── AFFECTED TASK SCOPE ───────────────────────────────────────────────

const computeAffectedIds = (triggerId, allLinks) => {
    const affected = new Set();
    if (triggerId == null) return affected;

    affected.add(Number(triggerId));

    const downstream = new Map();
    for (const l of allLinks) {
        const src = Number(l.source_task_id);
        const tgt = Number(l.target_task_id);
        if (!downstream.has(src)) downstream.set(src, []);
        downstream.get(src).push(tgt);
    }

    const queue = [Number(triggerId)];
    while (queue.length) {
        const id = queue.shift();
        const targets = downstream.get(id) || [];
        for (const t of targets) {
            if (!affected.has(t)) {
                affected.add(t);
                queue.push(t);
            }
        }
    }

    return affected;
};

// ── CONSTRAINT SNAPPING (affected tasks only, midnight for DATE column) ─

// const snapConstraintDates = (gantt, affectedIds, workingDaysConfig, holidays) => {
//     if (!gantt.config.work_time) return;
//     gantt.eachTask(t => {
//         if (!affectedIds.has(Number(t.id))) return;
//         if (!t.constraint_date) return;
//         const type = (t.constraint_type || 'asap').toLowerCase();
//         if (type === 'asap') return;

//         const snapped = snapToNextWorkingDayMidnight(t.constraint_date, workingDaysConfig, holidays);
//         if (snapped.getTime() !== t.constraint_date.getTime()) {
//             t.constraint_date = snapped;
//             gantt.updateTask(t.id);
//         }
//     });
// };

// ── MAIN ──────────────────────────────────────────────────────────────

export const runScheduling = ({ context, task_id, triggeredDates, operation, link_id, link, new_type }) => {
    const { project, workingDaysConfig, holidays, allTasks, allLinks } = context;

    if (project.type === 'my_tasks') {
        return {
            success: false,
            message: 'Gantt is not available for my_tasks projects',
            errors: ['my_tasks project'],
        };
    }

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
                project: { id: project.id, start_date: project.start_date, due_date: project.due_date },
            },
        };
    }

    const affectedIds = task_id
        ? computeAffectedIds(task_id, allLinks)
        : new Set(allTasks.map(t => Number(t.id)));

    // ── EDIT 2 (placement 1) ──
    // Run-scoped variable that captures the trigger task's requested
    // working duration before autoSchedule overwrites its span.
    let triggerRequestedWorkingMin = null;
    let triggerRequestedWorkingDays = null;   // ← NEW

    // ── Snapshot (with raw span for duration fallback) ──
    const snapshot = new Map(allTasks.map(t => {
        const rawStart = toDate(t.start_at);
        const rawDue = toDate(t.due_at);
        const rawSpanMinutes =
            (rawStart && rawDue && rawDue > rawStart)
                ? Math.round((rawDue.getTime() - rawStart.getTime()) / 60000)
                : 0;

        return [t.id, {
            name: t.name || `Task ${t.id}`,
            start_at: anyToMysql(t.start_at) ?? t.start_at,
            due_at: anyToMysql(t.due_at) ?? t.due_at,
            constraint_type: t.constraint_type || 'asap',
            constraint_date: t.constraint_date
                ? (anyToMysql(t.constraint_date) ?? (toDateOnly(t.constraint_date) + ' 00:00:00'))
                : null,
            time_used: !!t.time_used,
            type: t.task_type_handler || 'task',
            rawSpanMinutes,
            ganttWorkingMinutes: null,
        }];
    }));

    const gantt = createGanttInstance({ workingDaysConfig, holidays, project });

    // ── Convert tasks to Gantt format ──
    const normTasks = allTasks.map(t => {
        const timeUsed = !!t.time_used;
        const type = t.task_type_handler || 'task';
        let startDate = toDate(t.start_at);
        let endDate = toDate(t.due_at);
        let duration = null;

        if (type === 'milestone') {
            startDate = toDate(t.due_at);
            endDate = startDate;
            duration = 0;
        } else if (!timeUsed) {
            const { ganttStart, ganttEnd } = computeGanttSpanForWholeDay(
                startDate, endDate, workingDaysConfig, holidays
            );
            startDate = ganttStart;
            endDate = ganttEnd;
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
            type: type,
        };
    });

    let normLinks = allLinks.map(l => ({
        id: l.id,
        source: l.source_task_id,
        target: l.target_task_id,
        type: LINK_TYPE_MAP[l.type] ?? '0',
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

    // Capture Gantt's working-minute duration for time-tracked tasks.
    gantt.eachTask(t => {
        const snap = snapshot.get(t.id);
        if (snap) snap.ganttWorkingMinutes = t.duration;
    });

    // Snap constraint dates for affected tasks only.
    // snapConstraintDates(gantt, affectedIds, workingDaysConfig, holidays);

    gantt.config.auto_scheduling.gap_behavior = project.auto_schedule_tasks_gap === 'compress' ? 'compress' : 'preserve';
    gantt.config.auto_scheduling.apply_constraints = true;

    // ── Apply triggered date updates ──
    if (task_id && triggeredDates) {
        const task = gantt.getTask(task_id);
        if (task) {
            const oldStart = task.start_date.getTime();
            let newStart = toDateOrNull(triggeredDates.start_at);
            let newEnd = toDateOrNull(triggeredDates.due_at);

            if (task.type === 'milestone') {
                let singleDate = newEnd || task.start_date;
                if (task.time_used) {
                    if (gantt.config.work_time && !gantt.isWorkTime(singleDate)) {
                        singleDate = gantt.getClosestWorkTime({ date: singleDate, dir: 'future' });
                    }
                } else {
                    singleDate = new Date(singleDate.getTime());
                    singleDate.setHours(0, 0, 0, 0);
                    if (gantt.config.work_time && !gantt.isWorkTime(singleDate)) {
                        singleDate = gantt.getClosestWorkTime({ date: singleDate, dir: 'future' });
                        singleDate = new Date(singleDate.getTime());
                        singleDate.setHours(0, 0, 0, 0);
                    }
                }
                newStart = singleDate;
                newEnd = singleDate;
            } else if (task.time_used) {
                // ── Caller gave explicit dates → honor them (snap to working hours
                //    only if they land on non-working time). No duration preservation.

                if (gantt.config.work_time) {
                    if (!gantt.isWorkTime(newStart)) {
                        newStart = gantt.getClosestWorkTime({ date: newStart, dir: 'future' });
                    }
                    if (!gantt.isWorkTime(newEnd)) {
                        newEnd = gantt.getClosestWorkTime({ date: newEnd, dir: 'past' });
                    }
                }

                // Sanity: if snapping collapsed or inverted the span, extend to the
                // end of the working window on newStart's day.
                if (newEnd.getTime() <= newStart.getTime()) {
                    const slot = workingDaysConfig[newStart.getDay()];
                    const endStr = (slot && slot.end) || '17:00';
                    const [h, m] = endStr.split(':').map(Number);
                    newEnd = new Date(newStart.getTime());
                    newEnd.setHours(h, m, 0, 0);
                }
            } else {
                const { ganttStart, ganttEnd } = computeGanttSpanForWholeDay(
                    newStart, newEnd, workingDaysConfig, holidays
                );
                newStart = ganttStart;
                newEnd = ganttEnd;

                // ── NEW: capture the requested working-day span BEFORE autoSchedule
                //    can overwrite it. Used by the post-pass to rebuild the trigger
                //    task consistently with the user's resize intent.
                if (task.time_used === false || !task.time_used) {
                    const startDay = new Date(newStart.getTime());
                    startDay.setHours(0, 0, 0, 0);
                    const endDay = new Date(newEnd.getTime());
                    endDay.setHours(0, 0, 0, 0);

                    let wdCount = 0;
                    const cursor = new Date(startDay.getTime());
                    while (cursor <= endDay) {   // exclusive end — ganttEnd is next-day-boundary
                        if (isWorkingDay(cursor, workingDaysConfig, holidays)) wdCount++;
                        cursor.setDate(cursor.getDate() + 1);
                    }
                    // Handle the case where the span is within a single day
                    if (wdCount === 0 && isWorkingDay(startDay, workingDaysConfig, holidays)) {
                        wdCount = 1;
                    }
                    triggerRequestedWorkingDays = wdCount;
                }
            }

            // ── EDIT 2 (placement 2) ──
            // Capture the requested working duration BEFORE autoSchedule
            // can overwrite the span. Only for time-tracked, non-milestone
            // trigger tasks. Fall back to raw calendar span if the request
            // sits entirely on non-working time.
            if (task.time_used && task.type !== 'milestone') {
                triggerRequestedWorkingMin = computeWorkingMinutes(
                    newStart, newEnd, workingDaysConfig, holidays
                );
                if (triggerRequestedWorkingMin <= 0) {
                    triggerRequestedWorkingMin = Math.round(
                        (newEnd.getTime() - newStart.getTime()) / 60000
                    );
                }
            }

            task.start_date = newStart;
            task.end_date = newEnd;

            // Milestones never get SNET added.
            // constraint_date is a DATE column → floor to midnight.
            if (task.type !== 'milestone' && newStart.getTime() !== oldStart) {
                task.constraint_type = 'snet';
                const cdate = new Date(newStart.getTime());
                cdate.setHours(0, 0, 0, 0);
                task.constraint_date = cdate;
            }

            gantt.updateTask(task_id);
        }
    }

    // ── Link operations ──
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

    // ── Auto-schedule ──
    if (derivedTaskId) {
        if (gantt.isTaskExists(derivedTaskId)) {
            gantt.autoSchedule(derivedTaskId);
        } else {
            throw new Error(`Scheduling blocked: Task ${derivedTaskId} does not exist in Project ${project.id}`);
        }
    } else {
        gantt.autoSchedule();
    }

    // ── Whole-day normalization pass (affected tasks only) ──
    gantt.batchUpdate(() => {
        gantt.eachTask(t => {
            if (!affectedIds.has(Number(t.id))) return;

            // ── Milestones (unchanged) ──
            if (t.type === 'milestone') {
                let milestoneDate = new Date(t.start_date.getTime());
                if (t.time_used) {
                    if (gantt.config.work_time && !gantt.isWorkTime(milestoneDate)) {
                        milestoneDate = gantt.getClosestWorkTime({ date: milestoneDate, dir: 'future' });
                    }
                } else {
                    milestoneDate.setHours(0, 0, 0, 0);
                    if (gantt.config.work_time && !gantt.isWorkTime(milestoneDate)) {
                        milestoneDate = gantt.getClosestWorkTime({ date: milestoneDate, dir: 'future' });
                        milestoneDate = new Date(milestoneDate.getTime());
                        milestoneDate.setHours(0, 0, 0, 0);
                    }
                }
                t.start_date = milestoneDate;
                t.end_date = milestoneDate;
                gantt.updateTask(t.id);
                return;
            }

            // ── Time-tracked tasks — snap start to first working instant ──
            // ── EDIT 3 ──
            if (t.time_used) {
                if (gantt.config.work_time) {
                    let baseline = null;

                    allLinks.forEach(l => {
                        if (Number(l.target_task_id) !== Number(t.id)) return;
                        const pred = gantt.getTask(l.source_task_id);
                        if (!pred) return;

                        let candidate = null;
                        if (l.type === 'finish_to_start') candidate = pred.end_date;
                        else if (l.type === 'start_to_start') candidate = pred.start_date;

                        if (candidate && (!baseline || candidate.getTime() > baseline.getTime())) {
                            baseline = candidate;
                        }
                    });

                    if (t.constraint_type === 'snet' && t.constraint_date) {
                        const c = t.constraint_date;
                        if (!baseline || c.getTime() > baseline.getTime()) baseline = c;
                    }

                    if (!baseline) {
                        baseline = t.start_date;
                    }

                    let snapped = baseline;
                    if (!gantt.isWorkTime(snapped)) {
                        snapped = gantt.getClosestWorkTime({ date: snapped, dir: 'future' });
                    }

                    const isTrigger = Number(t.id) === Number(task_id);
                    const reqMin = isTrigger ? triggerRequestedWorkingMin : null;

                    if (reqMin && reqMin > 0) {
                        const rebuiltEnd = gantt.calculateEndDate({
                            start_date: snapped,
                            duration: reqMin,
                            unit: 'minute',
                        });
                        if (
                            t.start_date.getTime() !== snapped.getTime() ||
                            t.end_date.getTime() !== rebuiltEnd.getTime()
                        ) {
                            t.start_date = snapped;
                            t.end_date = rebuiltEnd;
                            gantt.updateTask(t.id);
                        }
                    } else if (t.start_date.getTime() !== snapped.getTime()) {
                        const spanMs = t.end_date.getTime() - t.start_date.getTime();
                        t.start_date = snapped;
                        t.end_date = new Date(snapped.getTime() + spanMs);
                        gantt.updateTask(t.id);
                    } else if (t.start_date.getTime() === t.end_date.getTime()) {
                        // ── NEW: zero-duration time-tracked task on working time
                        //    → extend end to the end of the working window on that day.
                        //    Matches the trigger block's sanity-check behavior so both
                        //    paths are consistent.
                        const slot = workingDaysConfig[t.start_date.getDay()];
                        const endStr = (slot && slot.end) || '17:00';
                        const [h, m] = endStr.split(':').map(Number);
                        const extended = new Date(t.start_date.getTime());
                        extended.setHours(h, m, 0, 0);

                        if (extended.getTime() > t.start_date.getTime()) {
                            t.end_date = extended;
                            gantt.updateTask(t.id);
                        }
                    }
                }
                return;
            }

            // ── Whole-day tasks ──
            const snap = snapshot.get(t.id);
            if (!snap || !snap.start_at || !snap.due_at) return;

            // ── Working-day span ──
            // For the trigger task, use the span captured in the trigger block
            // (the user's resize intent). For downstream tasks, fall back to the
            // snapshot's DB values — they were not resized by the user in this call.
            const isTriggerWholeDay = Number(t.id) === Number(task_id);

            let workingDays;

            if (isTriggerWholeDay && triggerRequestedWorkingDays !== null) {
                workingDays = triggerRequestedWorkingDays;
            } else {
                const origStartDay = toDate(snap.start_at);
                origStartDay.setHours(0, 0, 0, 0);
                const origDueDay = toDate(snap.due_at);
                origDueDay.setHours(0, 0, 0, 0);

                workingDays = 0;
                const cursor = new Date(origStartDay.getTime());
                while (cursor <= origDueDay) {
                    if (isWorkingDay(cursor, workingDaysConfig, holidays)) workingDays++;
                    cursor.setDate(cursor.getDate() + 1);
                }
                if (workingDays === 0) workingDays = 1;
            }

            // Start candidate from the task's LIVE position (post-autoSchedule).
            let startDay = new Date(t.start_date.getTime());
            startDay.setHours(0, 0, 0, 0);

            // If autoSchedule placed the task mid-day, advance to the next day —
            // a whole-day task cannot start mid-day.
            const wStart = windowStartForDay(startDay, workingDaysConfig);
            if (wStart && t.start_date.getTime() !== wStart.getTime()) {
                startDay.setDate(startDay.getDate() + 1);
            }

            // Advance to the next working day. Overlap with other tasks is allowed —
            // a whole-day successor simply lands on the first working day at/after
            // its current position.
            let guard = 0;
            while (!isWorkingDay(startDay, workingDaysConfig, holidays) && guard < 366) {
                startDay.setDate(startDay.getDate() + 1);
                guard++;
            }

            // Walk forward (workingDays - 1) working days to find the end day.
            let endDay = new Date(startDay.getTime());
            let remaining = workingDays - 1;
            while (remaining > 0) {
                endDay.setDate(endDay.getDate() + 1);
                if (isWorkingDay(endDay, workingDaysConfig, holidays)) remaining--;
            }

            t.start_date = windowStartForDay(startDay, workingDaysConfig);
            t.end_date = windowEndForDay(endDay, workingDaysConfig);
            gantt.updateTask(t.id);
        });
    });

    // ── Build Diff (affected tasks only) ──
    const tasks = [];
    let triggeredFinal = null;

    gantt.eachTask(t => {
        if (task_id && !affectedIds.has(Number(t.id))) return;

        const before = snapshot.get(t.id);
        if (!before) return;

        let dateChanged;
        let constraintChanged;
        let taskOutput;

        if (t.type === 'milestone') {
            const newEnd = anyToMysql(t.end_date);
            const newConstraintType = t.constraint_type || 'asap';
            const newConstraintDate = t.constraint_date ? anyToMysql(t.constraint_date) : null;
            dateChanged = toMin(newEnd) !== toMin(before.due_at);
            constraintChanged =
                newConstraintType !== before.constraint_type ||
                toMin(newConstraintDate) !== toMin(before.constraint_date);
            taskOutput = {
                id: t.id, name: before.name,
                start_at: null, due_at: newEnd,
                time_used: before.time_used,
                constraint_type: newConstraintType,
                constraint_date: newConstraintDate,
                type: before.type,
            };
        } else if (!t.time_used) {
            const { startMidnight, dueMidnight } = computeDbMidnightsForWholeDay(t.start_date, t.end_date);
            const newStart = anyToMysql(startMidnight);
            const newEnd = anyToMysql(dueMidnight);
            const newConstraintType = t.constraint_type || 'asap';
            const newConstraintDate = t.constraint_date ? anyToMysql(t.constraint_date) : null;
            dateChanged =
                toMin(newStart) !== toMin(before.start_at) ||
                toMin(newEnd) !== toMin(before.due_at);
            constraintChanged =
                newConstraintType !== before.constraint_type ||
                toMin(newConstraintDate) !== toMin(before.constraint_date);
            taskOutput = {
                id: t.id, name: before.name,
                start_at: newStart, due_at: newEnd,
                time_used: false,
                constraint_type: newConstraintType,
                constraint_date: newConstraintDate,
                type: before.type,
            };
        } else {
            const inclusiveEnd = fromGanttEnd(t.end_date, true);
            const newStart = anyToMysql(t.start_date);
            const newEnd = anyToMysql(inclusiveEnd);
            const newConstraintType = t.constraint_type || 'asap';
            const newConstraintDate = t.constraint_date ? anyToMysql(t.constraint_date) : null;
            dateChanged =
                toMin(newStart) !== toMin(before.start_at) ||
                toMin(newEnd) !== toMin(before.due_at);
            constraintChanged =
                newConstraintType !== before.constraint_type ||
                toMin(newConstraintDate) !== toMin(before.constraint_date);
            taskOutput = {
                id: t.id, name: before.name,
                start_at: newStart, due_at: newEnd,
                time_used: true,
                constraint_type: newConstraintType,
                constraint_date: newConstraintDate,
                type: before.type,
            };
        }

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
            project: { id: project.id, start_date: project.start_date, due_date: project.due_date },
        },
    };
};