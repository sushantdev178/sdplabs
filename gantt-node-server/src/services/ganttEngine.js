// src/services/ganttEngine.js
import { query } from '../utils/db.js';
import {
    toGanttDate,
    toMysqlDate,
    toComparable,
    parseWorkDays,
    snapToWorkingDay,
    ganttToJsDate,
    jsDateToGantt
} from '../utils/dateHelper.js';
import { runLinkScheduling, detectCircularLinks } from './dhtmlxScheduler.js';
import {
    GANTT_DURATION_UNIT,
    GANTT_MANAGE_LINKED_HIERARCHIES
} from '../config/constants.js';

// ────────────────────────────────────────────────
// DATABASE UTILITIES & HOLIDAY LOOKUPS
// ────────────────────────────────────────────────
async function fetchWorkspaceHolidays(workspace_id) {
    try {
        const rows = await query(
            `SELECT date FROM ph_off_days 
             WHERE workspace_id = ? AND type IN ('holidays', 'others')`,
            [workspace_id]
        );
        return rows.map(r => {
            if (r.date instanceof Date) {
                return r.date.toISOString().slice(0, 10);
            }
            return String(r.date).slice(0, 10);
        });
    } catch (error) {
        console.error('Error fetching holidays:', error);
        return [];
    }
}

// Deep Scan Tree Traversal Collector for Tasks and Subtasks
async function fetchProjectTaskIds(workspace_id, project_id) {
    try {
        const rootRows = await query(
            `SELECT pt.task_id FROM ph_project_tasks pt
             JOIN ph_tasks t ON t.id = pt.task_id
             WHERE pt.workspace_id = ? AND pt.project_id = ? 
             AND t.deleted_at IS NULL AND t.deleted_ancestor_id IS NULL 
             AND t.start_at IS NOT NULL AND t.due_at IS NOT NULL`,
            [workspace_id, project_id]
        );

        const allIds = new Set(rootRows.map(r => Number(r.task_id)));
        if (allIds.size === 0) return [];

        let currentLevel = [...allIds];
        let depth = 0;
        const MAX_DEPTH = 50;

        while (currentLevel.length > 0 && depth < MAX_DEPTH) {
            const placeholders = currentLevel.map(() => '?').join(',');
            const childRows = await query(
                `SELECT id FROM ph_tasks 
                 WHERE workspace_id = ? 
                   AND parent_id IN (${placeholders}) 
                   AND deleted_at IS NULL 
                   AND deleted_ancestor_id IS NULL
                   AND start_at IS NOT NULL 
                   AND due_at IS NOT NULL`,
                [workspace_id, ...currentLevel]
            );
            currentLevel = childRows.map(r => Number(r.id)).filter(id => !allIds.has(id));
            currentLevel.forEach(id => allIds.add(id));
            depth++;
        }
        return [...allIds];
    } catch (error) {
        console.error('Error fetching project task IDs:', error);
        return [];
    }
}

// ────────────────────────────────────────────────
// HIERARCHY COMPUTATION LOGIC
// ────────────────────────────────────────────────
const enforceHierarchyExpand = (tasksGantt, currentMysqlMap) => {
    const adjustments = [];
    const childrenOf = {};

    tasksGantt.forEach(t => {
        if (t.parent_id && t.parent_id !== 0) {
            (childrenOf[t.parent_id] ??= []).push(t.id);
        }
    });

    const visited = new Set();

    const visit = (id) => {
        if (visited.has(id)) return;
        visited.add(id);

        (childrenOf[id] || []).forEach(visit);

        const kids = (childrenOf[id] || [])
            .map(cid => tasksGantt.find(t => t.id === cid))
            .filter(Boolean);

        if (!kids.length) return;

        const task = tasksGantt.find(t => t.id === id);
        if (!task) return;

        const minChildStart = kids.reduce((best, k) => {
            const cmp = toComparable(k.start_date);
            return (!best || cmp < best.cmp) ? { cmp, val: k.start_date } : best;
        }, null);

        const maxChildEnd = kids.reduce((best, k) => {
            const cmp = toComparable(k.end_date);
            return (!best || cmp > best.cmp) ? { cmp, val: k.end_date } : best;
        }, null);

        let changed = false;

        if (minChildStart && toComparable(task.start_date) > minChildStart.cmp) {
            task.start_date = minChildStart.val;
            changed = true;
        }
        if (maxChildEnd && toComparable(task.end_date) < maxChildEnd.cmp) {
            task.end_date = maxChildEnd.val;
            changed = true;
        }

        if (changed) {
            const newStart = toMysqlDate(task.start_date);
            const newEnd = toMysqlDate(task.end_date);
            currentMysqlMap.set(id, { start_at: newStart, due_at: newEnd });
            adjustments.push({ id, start_at: newStart, due_at: newEnd });
        }
    };

    tasksGantt.filter(t => !t.parent_id || t.parent_id === 0).forEach(t => visit(t.id));
    return adjustments;
};

const getConnectedComponent = (startId, allTasks, allLinks) => {
    const graph = new Map();

    const addEdge = (a, b) => {
        if (!graph.has(a)) graph.set(a, new Set());
        if (!graph.has(b)) graph.set(b, new Set());
        graph.get(a).add(b);
        graph.get(b).add(a);
    };

    allTasks.forEach(t => {
        if (t.parent_id && t.parent_id !== 0) addEdge(t.id, t.parent_id);
    });

    allLinks.forEach(l => addEdge(l.source_task_id, l.target_task_id));

    const visited = new Set([startId]);
    const queue = [startId];

    while (queue.length > 0) {
        const current = queue.shift();
        for (const neighbor of (graph.get(current) || [])) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
            }
        }
    }

    return visited;
};

const buildHierarchyTree = (rootId, allTasks) => {
    const hierarchyIds = new Set();

    const collect = (id) => {
        hierarchyIds.add(id);
        allTasks.filter(t => t.parent_id === id).forEach(child => collect(child.id));
    };

    let currentId = rootId;
    let currentTask = allTasks.find(t => t.id === currentId);

    while (currentTask?.parent_id && currentTask.parent_id !== 0) {
        currentId = currentTask.parent_id;
        currentTask = allTasks.find(t => t.id === currentId);
    }

    collect(currentId);
    return hierarchyIds;
};

const recalculateScope = ({ tasksInScope, linksInScope, config, triggeredTaskId, dbOriginalDates, triggeredHierarchyIds }) => {
    let tasksForScheduling = tasksInScope.map(t => ({ ...t }));

    if (config.restrict_to_working_days && triggeredTaskId) {
        const task = tasksForScheduling.find(t => t.id === triggeredTaskId);
        if (task) {
            task.start_at = toMysqlDate(snapToWorkingDay(toGanttDate(task.start_at), 'forward', config.work_days, config.holidays));
            task.due_at = toMysqlDate(snapToWorkingDay(toGanttDate(task.due_at), 'backward', config.work_days, config.holidays));
        }
    }

    const ganttReadyTasks = tasksForScheduling.map(t => ({
        ...t,
        start_date: toGanttDate(t.start_at),
        end_date: toGanttDate(t.due_at)
    }));

    let dhtmlxLinkAdjustments = [];
    let afterTasks = ganttReadyTasks;
    let constraintUpdates = new Map();

    if (linksInScope.length > 0 && !detectCircularLinks(tasksInScope, linksInScope)) {
        try {
            const result = runLinkScheduling({
                tasksGantt: ganttReadyTasks,
                links: linksInScope,
                config: {
                    ...config,
                    project_start: config.project_start ? toGanttDate(config.project_start) : null
                },
                triggeredTaskId
            });

            dhtmlxLinkAdjustments = result.linkAdjustments;
            afterTasks = result.afterTasks;
            constraintUpdates = result.constraintUpdates;
        } catch (error) {
            console.error('DHTMLX scheduling error, using original tasks:', error);
        }
    }

    const afterGanttArray = afterTasks.map(t => ({
        id: t.id,
        parent_id: tasksInScope.find(orig => orig.id === t.id)?.parent_id ?? 0,
        start_date: t.start_date,
        end_date: t.end_date,
        constraint_type: t.constraint_type,
        constraint_date: t.constraint_date
    }));

    const afterMap = new Map(afterTasks.map(t => [t.id, { start_at: toMysqlDate(t.start_date), due_at: toMysqlDate(t.end_date) }]));

    let expandTargets;
    if (!GANTT_MANAGE_LINKED_HIERARCHIES && triggeredHierarchyIds) {
        expandTargets = afterGanttArray.filter(t => triggeredHierarchyIds.has(t.id));
    } else {
        expandTargets = afterGanttArray;
    }

    const postLinkExpandAdjustments = enforceHierarchyExpand(expandTargets, afterMap);

    const finalAdjustments = [...dhtmlxLinkAdjustments, ...postLinkExpandAdjustments]
        .reduce((m, a) => m.set(a.id, a), new Map());

    const filteredFinal = [...finalAdjustments.values()].filter(adj => {
        const orig = dbOriginalDates.get(adj.id);
        return orig && (orig.start_at !== adj.start_at || orig.due_at !== adj.due_at);
    });

    const parentIds = new Set(
        tasksInScope.filter(t => t.parent_id && tasksInScope.some(p => p.id === t.parent_id)).map(t => t.parent_id)
    );

    return {
        hierarchyAdjustments: filteredFinal.filter(a => parentIds.has(a.id)),
        linkAdjustments: filteredFinal.filter(a => !parentIds.has(a.id)),
        constraintUpdates
    };
};

// CRITICAL: Project range calculation - DHTMLX standard behavior
const calculateProjectRange = (allTasks, allAdjustments, project) => {
    const taskMap = new Map(allTasks.map(t => [t.id, { ...t }]));

    allAdjustments.forEach(adj => {
        const t = taskMap.get(adj.id);
        if (t) {
            t.start_at = adj.start_at;
            t.due_at = adj.due_at;
        }
    });

    // Find min/max from all tasks
    const range = Array.from(taskMap.values()).reduce((acc, t) => {
        const s = toComparable(toGanttDate(t.start_at));
        const e = toComparable(toGanttDate(t.due_at));

        if (s && (!acc.min || s < acc.min)) {
            acc.min = s;
            acc.minMysql = t.start_at;
        }
        if (e && (!acc.max || e > acc.max)) {
            acc.max = e;
            acc.maxMysql = t.due_at;
        }
        return acc;
    }, { min: null, max: null, minMysql: null, maxMysql: null });

    if (!range.minMysql || !range.maxMysql) return null;

    // Handle missing project dates
    const projectStart = project.project_start ? toComparable(toGanttDate(project.project_start)) : null;
    const projectEnd = project.project_end ? toComparable(toGanttDate(project.project_end)) : null;

    // If project dates are missing, use task range as project range
    if (!projectStart || !projectEnd) {
        return {
            start_at: range.minMysql,
            due_at: range.maxMysql,
            isNewProjectRange: true // Flag to indicate project dates were not set
        };
    }

    // DHTMLX STANDARD: Project auto-extends when tasks go beyond
    // Frontend GUI behavior: Project bar expands to contain all tasks
    let needsUpdate = false;
    let newStart = project.project_start;
    let newEnd = project.project_end;

    if (range.min < projectStart) {
        newStart = range.minMysql;
        needsUpdate = true;
    }
    if (range.max > projectEnd) {
        newEnd = range.maxMysql;
        needsUpdate = true;
    }

    if (needsUpdate) {
        return {
            start_at: newStart,
            due_at: newEnd,
            isExtension: true // Flag to indicate project was extended
        };
    }

    // Project range contains all tasks - no update needed
    return null;
};

// ────────────────────────────────────────────────
// MAIN CALCULATION DRIVER
// ────────────────────────────────────────────────
export const recalculateImpact = async ({ workspace_id, project_id, task_id, taskUpdates }) => {
    try {
        // Find project if not provided
        let finalProjectId = project_id;
        if (!finalProjectId && task_id) {
            let currentTaskId = task_id;
            let steps = 0;

            while (steps < 50) {
                const [parentRow] = await query(
                    `SELECT parent_id FROM ph_tasks 
                     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL LIMIT 1`,
                    [currentTaskId, workspace_id]
                );
                if (!parentRow) break;
                if (!parentRow.parent_id || parentRow.parent_id === 0) {
                    finalProjectId = currentTaskId;
                    break;
                }
                currentTaskId = parentRow.parent_id;
                steps++;
            }
        }

        if (!finalProjectId) {
            throw new Error('Could not determine project ID');
        }

        // Fetch project configuration
        const [project] = await query(
            `SELECT id, name, start_date AS project_start, due_date AS project_end,
                    auto_schedule_tasks, auto_schedule_tasks_gap, 
                    move_subtasks_with_parent, restrict_tasks_to_working_days
             FROM ph_projects 
             WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL`,
            [workspace_id, finalProjectId]
        );

        if (!project) {
            throw new Error('Project not found');
        }

        // If auto-scheduling is disabled, just return current state
        if (!project.auto_schedule_tasks) {
            // Still fetch tasks for display
            const projectTaskIds = await fetchProjectTaskIds(workspace_id, finalProjectId);
            let allTasks = [];
            if (projectTaskIds.length > 0) {
                const placeholders = projectTaskIds.map(() => '?').join(',');
                allTasks = await query(
                    `SELECT id, name, start_at, due_at, parent_id, constraint_type, constraint_date
                     FROM ph_tasks
                     WHERE id IN (${placeholders}) 
                       AND workspace_id = ? 
                       AND deleted_at IS NULL 
                       AND deleted_ancestor_id IS NULL 
                       AND start_at IS NOT NULL
                       AND due_at IS NOT NULL`,
                    [...projectTaskIds, workspace_id]
                );
            }

            return {
                success: true,
                message: "Auto-scheduling is disabled for this project",
                data: {
                    triggeredTask: task_id ? allTasks.find(t => t.id === task_id) || null : null,
                    hierarchyAdjustments: [],
                    linkAdjustments: [],
                    impactedTaskIds: allTasks.map(t => t.id),
                    project: project.project_start ? null : calculateProjectRange(allTasks, [], project),
                    constraintUpdates: []
                }
            };
        }

        // Fetch workspace configuration
        const [workspace] = await query(
            `SELECT weekend FROM ph_workspaces WHERE id = ? LIMIT 1`,
            [workspace_id]
        );

        // Get all task IDs in project
        const projectTaskIds = await fetchProjectTaskIds(workspace_id, finalProjectId);

        if (!projectTaskIds.length) {
            return {
                success: true,
                message: "No tasks found in project",
                data: {
                    triggeredTask: null,
                    hierarchyAdjustments: [],
                    linkAdjustments: [],
                    impactedTaskIds: [],
                    project: project.project_start ? null : {
                        start_at: null,
                        due_at: null,
                        isNewProjectRange: true
                    },
                    constraintUpdates: []
                }
            };
        }

        // Fetch all tasks
        const allTasks = await query(
            `SELECT id, name, start_at, due_at, parent_id, constraint_type, constraint_date
             FROM ph_tasks
             WHERE id IN (${projectTaskIds.map(() => '?').join(',')}) 
               AND workspace_id = ? 
               AND deleted_at IS NULL 
               AND deleted_ancestor_id IS NULL 
               AND start_at IS NOT NULL
               AND due_at IS NOT NULL`,
            [...projectTaskIds, workspace_id]
        );

        // Store original dates
        const dbOriginalDates = new Map(allTasks.map(t => [t.id, { start_at: t.start_at, due_at: t.due_at }]));

        // Apply task updates only if task_id, start_at, AND due_at are provided
        if (task_id && taskUpdates?.start_at && taskUpdates?.due_at) {
            const t = allTasks.find(x => x.id === task_id);
            if (t) {
                t.start_at = taskUpdates.start_at;
                t.due_at = taskUpdates.due_at;
            }
        }

        // Fetch all links
        const allLinks = await query(
            `SELECT id, source_task_id, target_task_id, \`type\` 
             FROM ph_task_links 
             WHERE workspace_id = ? AND project_id = ?`,
            [workspace_id, finalProjectId]
        );

        // Fetch holidays
        const dynamicHolidays = await fetchWorkspaceHolidays(workspace_id);

        // Build configuration
        const config = {
            work_days: parseWorkDays(workspace?.weekend),
            holidays: dynamicHolidays,
            duration_unit: GANTT_DURATION_UNIT,
            gap_mode: project.auto_schedule_tasks_gap || 'keep',
            move_subtasks_with_parent: !!project.move_subtasks_with_parent,
            restrict_to_working_days: !!project.restrict_tasks_to_working_days,
            manage_linked_hierarchies: GANTT_MANAGE_LINKED_HIERARCHIES,
            project_start: project.project_start,
            project_end: project.project_end
        };

        let allHierarchyAdjustments = [];
        let allLinkAdjustments = [];
        let allConstraintUpdates = new Map();

        // If task_id with dates is provided, calculate impact for that change
        if (task_id && taskUpdates?.start_at && taskUpdates?.due_at) {
            const componentIds = getConnectedComponent(task_id, allTasks, allLinks);
            const triggeredHierarchyIds = buildHierarchyTree(task_id, allTasks);

            const result = recalculateScope({
                tasksInScope: allTasks.filter(t => componentIds.has(t.id)),
                linksInScope: allLinks.filter(l => componentIds.has(l.source_task_id) && componentIds.has(l.target_task_id)),
                config,
                triggeredTaskId: task_id,
                dbOriginalDates,
                triggeredHierarchyIds
            });

            allHierarchyAdjustments = result.hierarchyAdjustments;
            allLinkAdjustments = result.linkAdjustments;
            allConstraintUpdates = result.constraintUpdates;
        } else {
            // No specific task change - render entire project with DHTMLX configuration
            const processed = new Set();

            for (const root of allTasks.filter(t => !t.parent_id || t.parent_id === 0)) {
                if (processed.has(root.id)) continue;

                const componentIds = getConnectedComponent(root.id, allTasks, allLinks);

                const result = recalculateScope({
                    tasksInScope: allTasks.filter(t => componentIds.has(t.id)),
                    linksInScope: allLinks.filter(l => componentIds.has(l.source_task_id) && componentIds.has(l.target_task_id)),
                    config,
                    triggeredTaskId: null,
                    dbOriginalDates,
                    triggeredHierarchyIds: null
                });

                allHierarchyAdjustments.push(...result.hierarchyAdjustments);
                allLinkAdjustments.push(...result.linkAdjustments);
                result.constraintUpdates.forEach((v, k) => allConstraintUpdates.set(k, v));
                componentIds.forEach(id => processed.add(id));
            }
        }

        const dedup = (arr) => [...arr.reduce((m, a) => m.set(a.id, a), new Map()).values()];
        const finalHierarchyAdj = dedup(allHierarchyAdjustments);
        const finalLinkAdj = dedup(allLinkAdjustments);
        const allFinalAdj = dedup([...finalHierarchyAdj, ...finalLinkAdj]);

        const enrich = (adj) => {
            const t = allTasks.find(x => x.id === adj.id);
            const dc = allConstraintUpdates.get(adj.id);
            return {
                ...adj,
                constraint_type: dc?.constraint_type ?? t?.constraint_type ?? null,
                constraint_date: dc?.constraint_date ?? t?.constraint_date ?? null
            };
        };

        const triggeredTaskFinal = task_id ? allTasks.find(t => t.id === task_id) : null;

        // Calculate project range (handles extension and missing dates)
        const projectRange = calculateProjectRange(allTasks, allFinalAdj, project);

        return {
            success: true,
            message: "Impact recalculation complete",
            data: {
                triggeredTask: task_id && triggeredTaskFinal ? {
                    id: task_id,
                    start_at: triggeredTaskFinal.start_at,
                    due_at: triggeredTaskFinal.due_at,
                    constraint_type: allConstraintUpdates.get(task_id)?.constraint_type ?? triggeredTaskFinal.constraint_type ?? null,
                    constraint_date: allConstraintUpdates.get(task_id)?.constraint_date ?? triggeredTaskFinal.constraint_date ?? null
                } : null,
                hierarchyAdjustments: finalHierarchyAdj.map(enrich),
                linkAdjustments: finalLinkAdj.map(enrich),
                impactedTaskIds: [...new Set([...(task_id ? [task_id] : []), ...allFinalAdj.map(a => a.id)])],
                project: projectRange,
                constraintUpdates: [...allConstraintUpdates.entries()].map(([id, c]) => ({ id, ...c }))
            }
        };
    } catch (error) {
        console.error('Recalculate Impact Error:', error);
        throw error;
    }
};

// Get project data for frontend
export const getProjectData = async ({ workspace_id, project_id }) => {
    try {
        const [project] = await query(
            `SELECT id, name, start_date, due_date, auto_schedule_tasks, 
                    auto_schedule_tasks_gap, move_subtasks_with_parent, 
                    restrict_tasks_to_working_days 
             FROM ph_projects 
             WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL`,
            [workspace_id, project_id]
        );

        if (!project) throw new Error('Project not found');

        const [workspace] = await query(
            `SELECT weekend FROM ph_workspaces WHERE id = ? LIMIT 1`,
            [workspace_id]
        );

        const dynamicHolidays = await fetchWorkspaceHolidays(workspace_id);
        const projectTaskIds = await fetchProjectTaskIds(workspace_id, project_id);

        let tasks = [];
        if (projectTaskIds.length > 0) {
            const placeholders = projectTaskIds.map(() => '?').join(',');
            tasks = await query(
                `SELECT id, name, start_at, due_at, parent_id, constraint_type, constraint_date
                 FROM ph_tasks 
                 WHERE id IN (${placeholders}) 
                   AND workspace_id = ? 
                   AND deleted_at IS NULL 
                   AND deleted_ancestor_id IS NULL
                   AND start_at IS NOT NULL 
                   AND due_at IS NOT NULL 
                 ORDER BY id`,
                [...projectTaskIds, workspace_id]
            );
        }

        const links = await query(
            `SELECT id, source_task_id, target_task_id, type 
             FROM ph_task_links 
             WHERE workspace_id = ? AND project_id = ?`,
            [workspace_id, project_id]
        );

        // If project dates are missing, calculate from task range
        let projectStart = project.start_date;
        let projectEnd = project.due_date;

        if (!projectStart || !projectEnd) {
            const allTasksWithDates = tasks.filter(t => t.start_at && t.due_at);
            if (allTasksWithDates.length > 0) {
                const starts = allTasksWithDates.map(t => t.start_at).sort();
                const ends = allTasksWithDates.map(t => t.due_at).sort();
                projectStart = projectStart || starts[0];
                projectEnd = projectEnd || ends[ends.length - 1];
            }
        }

        return {
            project: {
                id: project.id,
                name: project.name,
                auto_schedule_tasks: !!project.auto_schedule_tasks,
                auto_schedule_tasks_gap: project.auto_schedule_tasks_gap || 'keep',
                move_subtasks_with_parent: !!project.move_subtasks_with_parent,
                restrict_tasks_to_working_days: !!project.restrict_tasks_to_working_days,
                start_date: projectStart,
                due_date: projectEnd
            },
            workspace: {
                work_days: parseWorkDays(workspace?.weekend),
                holidays: dynamicHolidays
            },
            tasks: tasks.map(t => ({
                id: t.id,
                text: t.name,
                start_date: t.start_at,
                end_date: t.due_at,
                parent: t.parent_id || 0,
                constraint_type: t.constraint_type || null,
                constraint_date: t.constraint_date || null
            })),
            links: links.map(l => ({
                id: l.id,
                source: l.source_task_id,
                target: l.target_task_id,
                type: l.type
            }))
        };
    } catch (error) {
        console.error('Get Project Data Error:', error);
        throw error;
    }
};