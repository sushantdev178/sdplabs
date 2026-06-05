// src/services/dhtmlxScheduler.js
import { createRequire } from 'module';
import { toMysqlDate, toGanttDate, ganttToJsDate } from '../utils/dateHelper.js';
import { GANTT_DURATION_UNIT } from '../config/constants.js';

const require = createRequire(import.meta.url);
const { Gantt } = require('@dhx/gantt-node');

/**
 * Normalize database task to DHTMLX format.
 * Always use type 'task' — auto_types config promotes parents automatically,
 * matching frontend behavior exactly.
 */
const normaliseTask = (t) => ({
    id: t.id,
    text: t.name || `Task ${t.id}`,
    type: 'task',
    parent: t.parent_id ?? 0,
    start_date: t.start_date,
    end_date: t.end_date,
    progress: t.progress || 0,
    open: t.open !== false,
    constraint_type: t.constraint_type || 'asap',
    constraint_date: t.constraint_date || null
});

/**
 * Normalize database link to DHTMLX format
 */
const normaliseLink = (l) => ({
    id: l.id,
    source: l.source_task_id,
    target: l.target_task_id,
    type: String(l.type ?? 0)
});

/**
 * Pure DHTMLX scheduling engine
 * Matches frontend GUI behavior exactly
 */
export const runLinkScheduling = ({ tasksGantt, links, config, triggeredTaskId }) => {
    try {
        const normTasks = tasksGantt.map(t => normaliseTask(t));
        const normLinks = links.map(normaliseLink);

        // Store before state for comparison
        const beforeMap = new Map(normTasks.map(t => [t.id, {
            start_date: t.start_date,
            end_date: t.end_date,
            constraint_type: t.constraint_type,
            constraint_date: t.constraint_date
        }]));

        // Initialize DHTMLX instance with EXACT frontend configuration
        const gantt = Gantt.getGanttInstance({
            plugins: {
                auto_scheduling: true,
                marker: true
            },
            config: {
                // MUST match toGanttDate output format and frontend date_format exactly
                date_format: "%Y-%m-%d %H:%i:%s",
                duration_unit: config.duration_unit || GANTT_DURATION_UNIT,
                work_time: config.restrict_to_working_days || false,

                // auto_types: auto-promote parents to project type (matches frontend)
                auto_types: true,

                // drag_project: move subtasks with parent (configurable)
                drag_project: !!config.move_subtasks_with_parent,

                // CRITICAL: Match frontend auto_scheduling config exactly
                auto_scheduling: {
                    enabled: true,
                    show_constraints: true,
                    apply_constraints: true,
                    gap_behavior: config.gap_mode || 'keep',
                    strict: config.gap_mode === 'compress'
                },

                auto_scheduling_descendant_links: !!config.move_subtasks_with_parent,
            },
            data: { tasks: normTasks, links: normLinks },
        });

        // Apply work days configuration
        // config.work_days arrives already converted to JS day numbers via parseWorkDays()
        // which uses API_TO_JS map (1=Sat->6, 2=Mon->1, ... 7=Sun->0)
        const workDays = config.work_days || [1, 2, 3, 4, 5]; // already in JS format
        [0, 1, 2, 3, 4, 5, 6].forEach(day => {
            gantt.setWorkTime({
                day,
                hours: workDays.includes(day) ? ['08:00-17:00'] : []
            });
        });

        // Apply holidays
        (config.holidays || []).forEach(dateStr => {
            gantt.setWorkTime({
                date: new Date(dateStr + "T00:00:00"),
                hours: []
            });
        });

        // Set project start if available
        if (config.project_start) {
            const startDate = ganttToJsDate(config.project_start);
            if (startDate) {
                gantt.config.project_start = startDate;
            }
        }

        // Apply SNET constraint on triggered task (matching frontend onAfterTaskDrag)
        if (triggeredTaskId) {
            const triggeredTask = gantt.getTask(triggeredTaskId);
            if (triggeredTask) {
                if (!triggeredTask.constraint_type || triggeredTask.constraint_type === 'asap') {
                    triggeredTask.constraint_type = 'snet';
                    triggeredTask.constraint_date = new Date(triggeredTask.start_date);
                } else if (triggeredTask.constraint_type !== 'asap' && triggeredTask.constraint_type !== 'alap') {
                    triggeredTask.constraint_date = new Date(triggeredTask.start_date);
                }
                gantt.updateTask(triggeredTask.id);
            }
        }

        // Run DHTMLX auto-scheduling (PURE DHTMLX CALCULATION)
        if (triggeredTaskId && config.gap_mode !== 'compress') {
            gantt.autoSchedule(triggeredTaskId);
        } else {
            gantt.autoSchedule();
        }

        // Get results
        const afterTasks = gantt.serialize().data;

        // Extract constraint updates and date changes
        const constraintUpdates = new Map();
        const linkAdjustments = [];

        afterTasks.forEach(t => {
            const before = beforeMap.get(t.id);

            // Track constraint changes
            if (t.constraint_type !== before?.constraint_type ||
                t.constraint_date !== before?.constraint_date) {
                constraintUpdates.set(t.id, {
                    constraint_type: t.constraint_type || null,
                    constraint_date: t.constraint_date ? toMysqlDate(t.constraint_date) : null,
                });
            }

            // Track date changes
            if (before && (before.start_date !== t.start_date || before.end_date !== t.end_date)) {
                linkAdjustments.push({
                    id: t.id,
                    start_at: toMysqlDate(t.start_date),
                    due_at: toMysqlDate(t.end_date),
                    constraint_type: t.constraint_type || null,
                    constraint_date: t.constraint_date ? toMysqlDate(t.constraint_date) : null
                });
            }
        });

        // Clean up DHTMLX instance
        gantt.destructor();

        return {
            linkAdjustments,
            afterTasks,
            constraintUpdates
        };
    } catch (error) {
        console.error('DHTMLX Scheduling Error:', error);
        throw new Error(`DHTMLX scheduling failed: ${error.message}`);
    }
};

/**
 * Detect circular links including hierarchy
 */
export const detectCircularLinks = (tasks, links) => {
    const adj = new Map(tasks.map(t => [t.id, []]));

    // Add explicit links
    links.forEach(l => {
        if (adj.has(l.source_task_id)) {
            adj.get(l.source_task_id).push(l.target_task_id);
        }
    });

    // Add implicit hierarchy links (parent -> child)
    tasks.forEach(t => {
        if (t.parent_id && t.parent_id !== 0 && adj.has(t.parent_id)) {
            adj.get(t.parent_id).push(t.id);
        }
    });

    // DFS cycle detection
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