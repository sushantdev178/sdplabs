// src/services/dhtmlxScheduler.js
import { createRequire } from 'module';
import { toMysqlDate, toGanttDate, jsDateToGantt, toDateObject } from '../utils/dateHelper.js';
import { GANTT_DURATION_UNIT } from '../config/constants.js';

const require = createRequire(import.meta.url);
const { Gantt } = require('@dhx/gantt-node');

const normaliseTask = (t) => {
    const startDateObj = toDateObject(t.start_at || t.start_date);
    const endDateObj = toDateObject(t.due_at || t.end_date);
    const constraintDateObj = t.constraint_date ? toDateObject(t.constraint_date) : null;

    return {
        id: t.id,
        text: t.name || t.text || `Task ${t.id}`,
        type: 'task',
        parent: t.parent_id ?? t.parent ?? 0,
        start_date: startDateObj,
        end_date: endDateObj,
        progress: t.progress || 0,
        open: true,
        constraint_type: t.constraint_type || 'asap',
        constraint_date: constraintDateObj
    };
};

const normaliseLink = (l) => ({
    id: l.id,
    source: l.source_task_id ?? l.source,
    target: l.target_task_id ?? l.target,
    type: String(l.type ?? '0')
});

const createGanttInstance = (config) => {
    const gantt = Gantt.getGanttInstance({ plugins: { auto_scheduling: true } });

    gantt.config.date_format = "%Y-%m-%d %H:%i:%s";
    gantt.config.duration_unit = config.duration_unit || GANTT_DURATION_UNIT;
    gantt.config.work_time = !!config.restrict_to_working_days;
    gantt.config.auto_types = false;
    gantt.config.drag_project = !!config.move_subtasks_with_parent;
    gantt.config.auto_scheduling = {
        enabled: false,
        show_constraints: true,
        apply_constraints: true,
        gap_behavior: config.gap_mode || 'keep',
        strict: config.gap_mode === 'compress'
    };
    gantt.config.auto_scheduling_descendant_links = !!config.move_subtasks_with_parent;

    const workDays = config.work_days || [1, 2, 3, 4, 5];
    [0, 1, 2, 3, 4, 5, 6].forEach(day => {
        gantt.setWorkTime({ day, hours: workDays.includes(day) ? ['08:00-17:00'] : false });
    });
    (config.holidays || []).forEach(dateStr => {
        gantt.setWorkTime({ date: new Date(dateStr + 'T00:00:00'), hours: false });
    });

    return gantt;
};

export const runLinkScheduling = ({ tasksGantt, links, config, triggeredTaskId }) => {
    console.log('\n========== DHTMLX SCHEDULER START ==========');
    console.log('triggeredTaskId:', triggeredTaskId);

    try {
        const normTasks = tasksGantt.map(normaliseTask);
        const normLinks = links.map(normaliseLink);

        // Snapshot before state (as MySQL strings)
        const beforeMap = new Map(normTasks.map(t => [t.id, {
            start_at: toMysqlDate(t.start_date),
            due_at: toMysqlDate(t.end_date),
            constraint_type: t.constraint_type,
            constraint_date: t.constraint_date ? toMysqlDate(t.constraint_date) : null
        }]));

        const gantt = createGanttInstance(config);
        gantt.parse({ data: normTasks, links: normLinks });

        // Apply SNET constraint on triggered task
        if (triggeredTaskId) {
            const task = gantt.getTask(triggeredTaskId);
            if (task) {
                if (!task.constraint_type || task.constraint_type === 'asap') {
                    task.constraint_type = 'snet';
                    task.constraint_date = new Date(task.start_date);
                } else if (task.constraint_type !== 'alap') {
                    task.constraint_date = new Date(task.start_date);
                }
                gantt.updateTask(task.id);
            }
        }

        gantt.config.auto_scheduling.enabled = true;
        if (triggeredTaskId) {
            gantt.autoSchedule(triggeredTaskId);
        } else {
            gantt.autoSchedule();
        }

        // ✅ Collect results directly from each task
        const allTaskIds = normTasks.map(t => t.id);
        const afterTasksRaw = [];

        for (const id of allTaskIds) {
            const task = gantt.getTask(id);
            if (task) {
                const startMysql = toMysqlDate(jsDateToGantt(task.start_date));
                const endMysql = toMysqlDate(jsDateToGantt(task.end_date));
                const constraintDateMysql = task.constraint_date
                    ? toMysqlDate(jsDateToGantt(task.constraint_date))
                    : null;

                afterTasksRaw.push({
                    id: task.id,
                    start_date: startMysql,
                    end_date: endMysql,
                    constraint_type: task.constraint_type,
                    constraint_date: constraintDateMysql
                });
            }
        }

        // Diff against before
        const linkAdjustments = [];
        const constraintUpdates = new Map();

        afterTasksRaw.forEach(t => {
            const before = beforeMap.get(t.id);
            if (!before) return;

            const newStart = t.start_date;
            const newEnd = t.end_date;
            const newCDate = t.constraint_date;

            if (t.constraint_type !== before.constraint_type || newCDate !== before.constraint_date) {
                constraintUpdates.set(t.id, {
                    constraint_type: t.constraint_type || null,
                    constraint_date: newCDate
                });
            }

            const toMin = (s) => s ? String(s).slice(0, 16) : null;
            if (toMin(newStart) !== toMin(before.start_at) || toMin(newEnd) !== toMin(before.due_at)) {
                linkAdjustments.push({
                    id: t.id,
                    start_at: newStart,
                    due_at: newEnd,
                    constraint_type: t.constraint_type || null,
                    constraint_date: newCDate
                });
            }
        });

        console.log('[DIFF RESULT] linkAdjustments count:', linkAdjustments.length);
        if (linkAdjustments.length) console.log('  First:', JSON.stringify(linkAdjustments[0]));

        gantt.destructor();
        return { linkAdjustments, afterTasks: afterTasksRaw, constraintUpdates };

    } catch (error) {
        console.error('DHTMLX Scheduling Error:', error);
        throw new Error(`DHTMLX scheduling failed: ${error.message}`);
    }
};

export const detectCircularLinks = (tasks, links) => {
    const adj = new Map(tasks.map(t => [t.id, []]));
    links.forEach(l => {
        const src = l.source_task_id ?? l.source;
        const tgt = l.target_task_id ?? l.target;
        if (adj.has(src)) adj.get(src).push(tgt);
    });
    tasks.forEach(t => {
        const pid = t.parent_id ?? t.parent;
        if (pid && pid !== 0 && adj.has(pid)) adj.get(pid).push(t.id);
    });
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map(tasks.map(t => [t.id, WHITE]));
    const hasCycle = (node) => {
        color.set(node, GRAY);
        for (const neighbor of (adj.get(node) || [])) {
            if (color.get(neighbor) === GRAY) return true;
            if (color.get(neighbor) === WHITE && hasCycle(neighbor)) return true;
        }
        color.set(node, BLACK);
        return false;
    };
    for (const task of tasks) {
        if (color.get(task.id) === WHITE && hasCycle(task.id)) return true;
    }
    return false;
};