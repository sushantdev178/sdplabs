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

// Since all tasks are time_used=true, toGanttEnd and fromGanttEnd behave as identity.
// We keep them for consistency with other tracks; no shift will occur.
const toGanttEnd = (date, timeUsed) => (timeUsed ? date : addOneDay(date));
const fromGanttEnd = (date, timeUsed) => (timeUsed || !isMidnight(date)) ? date : subOneDay(date);

const createGanttInstance = ({ workDays, holidays, project }) => {
    const gantt = Gantt.getGanttInstance({ plugins: { auto_scheduling: true } });

    gantt.config.date_format = "%Y-%m-%d %H:%i:%s";
    gantt.config.duration_unit = 'minute';
    gantt.config.auto_types = false;

    // For this experiment we ALWAYS enable work_time / correct_work_time.
    // The flag from the project is ignored (we assume restrict_tasks_to_working_days is true,
    // but we enforce it here to be safe).
    gantt.config.work_time = true;
    gantt.config.correct_work_time = true;

    gantt.config.auto_scheduling = {
        enabled: !!project.auto_schedule_tasks,
        apply_constraints: true,
        gap_behavior: project.auto_schedule_tasks_gap === 'compress' ? 'compress' : 'preserve',
        move_projects: false,
        schedule_on_parse: false
    };

    // Set working days: Monday(1) to Friday(5) with fixed hours 10:00–19:00
    [0, 1, 2, 3, 4, 5, 6].forEach(day => {
        if (workDays.includes(day)) {
            gantt.setWorkTime({ day, hours: ['10:00-19:00'] });
        } else {
            gantt.setWorkTime({ day, hours: false });
        }
    });

    holidays.forEach(dateStr => {
        gantt.setWorkTime({ date: new Date(dateStr + 'T00:00:00'), hours: false });
    });

    // Debug: confirm plugin/config state
    console.log('[SNAP-DEBUG] createGanttInstance: auto_scheduling config =', JSON.stringify(gantt.config.auto_scheduling));
    console.log('[SNAP-DEBUG] createGanttInstance: duration_unit =', gantt.config.duration_unit, ' work_time =', gantt.config.work_time);

    return gantt;
};

export const runScheduling = ({ context, task_id, triggeredDates, operation, link_id, link, new_type }) => {
    const { project, workDays, holidays, allTasks, allLinks } = context;

    const linksForValidation = (operation === 'add_link' && link)
        ? [...allLinks, { source_task_id: Number(link.source), target_task_id: Number(link.target) }]
        : allLinks;

    const circularCheck = hasCircularLink(allTasks, linksForValidation);
    if (circularCheck) return { success: false, error: 'Circular link detected — scheduling blocked' };

    const hierarchyCheck = hasHierarchyLink(allTasks, linksForValidation);
    if (hierarchyCheck.found) return { success: false, error: `Hierarchy link blocked: ${hierarchyCheck.reason}` };

    if (!project.auto_schedule_tasks) {
        return {
            success: true,
            message: 'Auto-scheduling is disabled for this project',
            data: { triggeredTask: null, tasks: [], impactedTaskIds: [], project: null }
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

    console.log('[SNAP-DEBUG] runScheduling called. task_id=', task_id, ' operation=', operation, ' allTasks.length=', allTasks.length, ' allLinks.length=', allLinks.length);

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

    console.log('[SNAP-DEBUG] normTasks (id/time_used/start/end) =',
        normTasks.map(t => ({ id: t.id, time_used: t.time_used, start_date: t.start_date, end_date: t.end_date })));
    console.log('[SNAP-DEBUG] normLinks =', normLinks);

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

    // Debug: confirm time_used round-trips
    normTasks.forEach(t => {
        const parsed = gantt.getTask(t.id);
        console.log('[SNAP-DEBUG] post-parse getTask check: id=', t.id,
            ' time_used on parsed task=', parsed ? parsed.time_used : '(task not found)',
            ' typeof=', parsed ? typeof parsed.time_used : 'n/a');
    });

    gantt.config.auto_scheduling.gap_behavior = project.auto_schedule_tasks_gap === 'compress' ? 'compress' : 'preserve';
    gantt.config.auto_scheduling.apply_constraints = true;

    // Apply triggered dates (if any)
    if (task_id && triggeredDates) {
        const task = gantt.getTask(task_id);
        if (task) {
            const oldStart = task.start_date.getTime();
            let newStart = toDate(triggeredDates.start_at);
            let newEnd = toGanttEnd(toDate(triggeredDates.due_at), task.time_used);

            // With work_time=true, ensure newStart is inside working time
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

    console.log('[SNAP-DEBUG] about to call autoSchedule. derivedTaskId=', derivedTaskId);

    // Debug: log durations before autoSchedule
    gantt.eachTask(t => {
        console.log('[DUR-DEBUG] PRE-autoSchedule task', t.id,
            'time_used=', t.time_used,
            'duration=', t.duration,
            'start_date=', t.start_date,
            'end_date=', t.end_date);
    });

    // Attach a read-only listener for extra debugging (optional)
    gantt.attachEvent("onAfterTaskAutoSchedule", function (task, start, link, predecessor) {
        console.log('[DUR-DEBUG] onAfterTaskAutoSchedule for', task.id,
            'time_used=', task.time_used,
            'duration=', task.duration,
            'new start_date=', task.start_date,
            'new end_date=', task.end_date,
            'predecessor=', predecessor ? predecessor.id : null);
        return true;
    });

    if (derivedTaskId) {
        if (gantt.isTaskExists(derivedTaskId)) {
            gantt.autoSchedule(derivedTaskId);
        } else {
            throw new Error(`Scheduling blocked: Task ${derivedTaskId} does not exist in Project ${project.id}`);
        }
    } else {
        gantt.autoSchedule();
    }

    console.log('[SNAP-DEBUG] autoSchedule call completed.');

    // NO whole-day normalization pass in this track.

    // Debug: log durations after autoSchedule
    gantt.eachTask(t => {
        console.log('[DUR-DEBUG] POST-autoSchedule task', t.id,
            'time_used=', t.time_used,
            'duration=', t.duration,
            'start_date=', t.start_date,
            'end_date=', t.end_date);
    });

    const tasks = [];
    let triggeredFinal = null;
    let projectStartMin = null;
    let projectEndMax = null;

    gantt.eachTask(t => {
        const inclusiveEnd = fromGanttEnd(t.end_date, t.time_used);

        if (!projectStartMin || t.start_date < projectStartMin) projectStartMin = t.start_date;
        if (!projectEndMax || inclusiveEnd > projectEndMax) projectEndMax = inclusiveEnd;

        const before = snapshot.get(t.id);

        console.log('[DIFF-DEBUG] task', t.id, ' (typeof', typeof t.id, ')',
            ' snapshot lookup found=', !!before,
            ' snapshot has keys of type:', snapshot.size ? typeof [...snapshot.keys()][0] : 'n/a');

        if (!before) {
            console.log('[DIFF-DEBUG] SKIPPING task', t.id, '- no snapshot entry found. This task will be ABSENT from output.');
            return;
        }

        const newStart = anyToMysql(t.start_date);
        const newEnd = anyToMysql(inclusiveEnd);
        const newConstraintType = t.constraint_type || 'asap';
        const newConstraintDate = t.constraint_date ? anyToMysql(t.constraint_date) : null;

        const dateChanged = toMin(newStart) !== toMin(before.start_at) || toMin(newEnd) !== toMin(before.due_at);
        const constraintChanged = newConstraintType !== before.constraint_type || toMin(newConstraintDate) !== toMin(before.constraint_date);

        console.log('[DIFF-DEBUG] task', t.id, ' before.start_at=', before.start_at, ' newStart=', newStart,
            ' before.due_at=', before.due_at, ' newEnd=', newEnd, ' dateChanged=', dateChanged, ' constraintChanged=', constraintChanged);

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

    console.log('[SNAP-DEBUG] final tasks[] before return =', JSON.stringify(tasks, null, 2));

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