// src/services/dhtmlxScheduler.js
import { createRequire } from 'module';
import { toMysqlDate, toGanttDate } from '../utils/dateHelper.js';
import { GANTT_DURATION_UNIT, GANTT_AUTO_SCHEDULING_MODE } from '../config/constants.js';

const require = createRequire(import.meta.url);
const { Gantt } = require('@dhx/gantt-node');

const normaliseTask = (t, allTasks) => ({
    id: t.id,
    text: t.name || `Task ${t.id}`,
    type: allTasks.some(child => child.parent_id === t.id) ? 'project' : 'task',
    parent: t.parent_id ?? 0,
    start_date: t.start_date,
    end_date: t.end_date,
    ...(t.constraint_type ? { constraint_type: t.constraint_type } : {}),
    ...(t.constraint_date ? { constraint_date: toGanttDate(t.constraint_date) } : {}),
});

const normaliseLink = (l) => ({
    id: l.id,
    source: l.source_task_id,
    target: l.target_task_id,
    type: String(l.type ?? 0),
});

export const runLinkScheduling = ({ tasksGantt, links, config, triggeredTaskId }) => {
    const normTasks = tasksGantt.map(t => normaliseTask(t, tasksGantt));
    const normLinks = links.map(normaliseLink);
    const beforeMap = new Map(normTasks.map(t => [t.id, { start_date: t.start_date, end_date: t.end_date }]));

    const gantt = Gantt.getGanttInstance({
        plugins: { auto_scheduling: true },
        config: {
            duration_unit: config.duration_unit || GANTT_DURATION_UNIT,
            work_time: config.restrict_to_working_days,
            auto_types: false,
            auto_scheduling: {
                enabled: true,
                schedule_on_parse: false,
                apply_constraints: true,
                mode: config.scheduling_mode || GANTT_AUTO_SCHEDULING_MODE,
                move_asap_tasks: config.gap_mode === 'compress',
            },
            auto_scheduling_descendant_links: !!config.move_subtasks_with_parent,
        },
        data: { tasks: normTasks, links: normLinks },
    });

    const workDays = config.work_days || [1, 2, 3, 4, 5];
    [0, 1, 2, 3, 4, 5, 6].forEach(day => {
        gantt.setWorkTime({ day, hours: workDays.includes(day) ? ['00:00-24:00'] : [] });
    });
    (config.holidays || []).forEach(dateStr => {
        gantt.setWorkTime({ date: new Date(dateStr), hours: [] });
    });

    if (triggeredTaskId && config.gap_mode !== 'compress') {
        gantt.autoSchedule(triggeredTaskId);
    } else {
        gantt.autoSchedule();
    }

    const afterTasks = gantt.serialize().data;
    gantt.destructor();

    const constraintUpdates = new Map();
    const linkAdjustments = [];

    afterTasks.forEach(t => {
        if (t.constraint_type || t.constraint_date) {
            constraintUpdates.set(t.id, {
                constraint_type: t.constraint_type || null,
                constraint_date: t.constraint_date ? toMysqlDate(t.constraint_date) : null,
            });
        }
        const before = beforeMap.get(t.id);
        if (before && (before.start_date !== t.start_date || before.end_date !== t.end_date)) {
            linkAdjustments.push({ id: t.id, start_at: toMysqlDate(t.start_date), due_at: toMysqlDate(t.end_date) });
        }
    });

    return { linkAdjustments, afterTasks, constraintUpdates };
};

// src/services/dhtmlxScheduler.js

export const detectCircularLinks = (tasks, links) => {
    // 1. Initialize an adjacency list covering all tasks in the scope
    const adj = new Map(tasks.map(t => [t.id, []]));

    // 2. Map explicit dependency links (e.g., Finish-to-Start rows)
    links.forEach(l => {
        if (adj.has(l.source_task_id)) {
            adj.get(l.source_task_id).push(l.target_task_id);
        }
    });

    // 3. CRITICAL: Map implicit hierarchical structural links (Parent -> Child)
    // A parent's boundaries directly restrict and depend on its children.
    tasks.forEach(t => {
        if (t.parent_id && t.parent_id !== 0 && adj.has(t.parent_id)) {
            adj.get(t.parent_id).push(t.id);
        }
    });

    // 4. Run standard three-color Depth-First Search (DFS) tracking to pinpoint loops
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map(tasks.map(t => [t.id, WHITE]));

    const hasCycle = (node) => {
        color.set(node, GRAY); // Mark node as currently being explored

        for (const neighbor of (adj.get(node) || [])) {
            if (color.get(neighbor) === GRAY) {
                // We found a node currently in our traversal stack -> CYCLE DETECTED!
                return true;
            }
            if (color.get(neighbor) === WHITE) {
                if (hasCycle(neighbor)) return true;
            }
        }

        color.set(node, BLACK); // Mark node as fully completed
        return false;
    };

    // Run the traversal check across all tasks
    for (const task of tasks) {
        if (color.get(task.id) === WHITE) {
            if (hasCycle(task.id)) return true;
        }
    }

    return false;
};