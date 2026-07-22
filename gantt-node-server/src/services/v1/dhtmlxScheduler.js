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

export const runScheduling = ({ context, task_id, triggeredDates, operation, link_id, link }) => { // <-- Add 'link' here
    const { project, workDays, holidays, allTasks, allLinks } = context;

    const linksForValidation = (operation === 'add_link' && link)
        ? [...allLinks, { source_task_id: Number(link.source), target_task_id: Number(link.target) }]
        : allLinks;

    // ── Validations ──
    const circularCheck = hasCircularLink(allTasks, allLinks);
    if (circularCheck) return { success: false, error: 'Circular link detected — scheduling blocked' };

    const hierarchyCheck = hasHierarchyLink(allTasks, allLinks);
    if (hierarchyCheck.found) return { success: false, error: `Hierarchy link blocked: ${hierarchyCheck.reason}` };

    if (!project.auto_schedule_tasks) {
        return {
            success: false,
            message: 'Auto-scheduling is disabled for this project',
            data: { triggeredTask: null, linkAdjustments: [], constraintUpdates: [], impactedTaskIds: [], project: null }
        };
    }

    // ── 1. Baseline Snapshot (before any changes) ──
    const snapshot = new Map(allTasks.map(t => [t.id, {
        name: t.name || `Task ${t.id}`,
        start_at: anyToMysql(t.start_at) ?? t.start_at,
        due_at: anyToMysql(t.due_at) ?? t.due_at,
        constraint_type: t.constraint_type || 'asap',
        constraint_date: t.constraint_date ? (anyToMysql(t.constraint_date) ?? (toDateOnly(t.constraint_date) + ' 00:00:00')) : null
    }]));

    const gantt = createGanttInstance({ workDays, holidays, project });

    // ── 2. Format Tasks and Links ──
    const normTasks = allTasks.map(t => ({
        id: t.id,
        text: t.name || `Task ${t.id}`,
        parent: t.parent_id ?? 0,
        start_date: toDate(t.start_at),
        end_date: toDate(t.due_at),
        progress: t.progress || 0,
        constraint_type: t.constraint_type || 'asap',
        constraint_date: t.constraint_date ? toDate(t.constraint_date) : null
    }));

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


    gantt.config.auto_scheduling.gap_behavior = project.auto_schedule_tasks_gap === 'compress' ? 'compress' : 'preserve';
    gantt.config.auto_scheduling.apply_constraints = true;


    // ── 2b. Snap constraint dates to correct working day per constraint type ──
    // DHTMLX Node package does not consistently snap constraint dates that fall
    // on non-working days. This pass corrects them before autoSchedule runs.
    // DB stores user's original intent — engine works with calendar-corrected values.
    // This also handles calendar changes (holidays added/changed after constraint was set).

    if (project.restrict_tasks_to_working_days) {
        gantt.eachTask(t => {
            if (!t.constraint_date) return;
            const type = (t.constraint_type || 'asap').toLowerCase();
            if (type === 'asap') return;
            if (gantt.isWorkTime(t.constraint_date)) return;

            // Always snap to next future working day
            // For FNLT/SNLT this makes constraint slightly looser
            // but is the only reliable direction given getClosestWorkTime 'past' bug
            t.constraint_date = gantt.getClosestWorkTime({
                date: t.constraint_date,
                dir: 'future'
            });
        });
    }

    // ── 3. Apply Triggered Task Update (drag / resize) ──
    if (task_id && triggeredDates) {
        const task = gantt.getTask(task_id);
        if (task) {
            const oldStart = task.start_date.getTime();
            let newStart = toDate(triggeredDates.start_at);
            let newEnd = toDate(triggeredDates.due_at);

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
            const t = gantt.getTask(derivedTaskId);
            // console.log(`Auto-scheduled run for task ${derivedTaskId}: new start=${t.start_date}, new end=${t.end_date}`);
        } else {
            throw new Error(`Scheduling blocked: Task ${derivedTaskId} does not exist in Project ${project.id}`);
            console.warn(`Warning: Task ${derivedTaskId} was not found in the Gantt instance. Skipping localized autoSchedule.`);
        }
    } else {
        gantt.autoSchedule();
        console.log(`Auto-scheduled run for entire project`);
    }

    // ── 5. Build Diff ──
    const linkAdjustments = [];
    const constraintUpdates = [];
    let triggeredFinal = null;

    let projectStartMin = null;
    let projectEndMax = null;

    gantt.eachTask(t => {

        if (!projectStartMin || t.start_date < projectStartMin) projectStartMin = t.start_date;
        if (!projectEndMax || t.end_date > projectEndMax) projectEndMax = t.end_date;

        const before = snapshot.get(t.id);
        if (!before) return;

        const newStart = anyToMysql(t.start_date);
        const newEnd = anyToMysql(t.end_date);
        const newConstraintType = t.constraint_type || 'asap';
        const newConstraintDate = t.constraint_date ? anyToMysql(t.constraint_date) : null;

        const dateChanged = toMin(newStart) !== toMin(before.start_at) || toMin(newEnd) !== toMin(before.due_at);
        const constraintChanged = newConstraintType !== before.constraint_type || toMin(newConstraintDate) !== toMin(before.constraint_date);

        const taskOutput = {
            id: t.id,
            name: before.name,
            start_at: newStart,
            due_at: newEnd,
            constraint_type: newConstraintType,
            constraint_date: newConstraintDate
        };

        if (t.id === task_id && (dateChanged || constraintChanged)) {
            triggeredFinal = taskOutput;
        } else {
            if (dateChanged) linkAdjustments.push(taskOutput);
        }

        if (constraintChanged) {
            constraintUpdates.push({
                id: t.id,
                constraint_type: newConstraintType,
                constraint_date: newConstraintDate
            });
        }
    });

    gantt.destructor();

    const allIds = [task_id, ...linkAdjustments.map(t => t.id), ...constraintUpdates.map(t => t.id)].filter(Boolean);
    const impactedTaskIds = [...new Set(allIds)];

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
            linkAdjustments,
            constraintUpdates,
            impactedTaskIds,
            project: calculatedProjectBounds
        }
    };
};