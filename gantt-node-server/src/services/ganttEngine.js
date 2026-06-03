// src/services/ganttEngine.js
import { query } from '../utils/db.js';
import {
    toGanttDate,
    toMysqlDate,
    toComparable,
    parseWorkDays,
    snapToWorkingDay
} from '../utils/dateHelper.js';
import {
    runLinkScheduling,
    detectCircularLinks
} from './dhtmlxScheduler.js';
import {
    GANTT_DURATION_UNIT,
    GANTT_AUTO_SCHEDULING_MODE,
    GANTT_MANAGE_LINKED_HIERARCHIES
} from '../config/constants.js';

// ────────────────────────────────────────────────
// DATABASE UTILITIES & HOLIDAY LOOKUPS
// ────────────────────────────────────────────────
async function fetchWorkspaceHolidays(workspace_id) {
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
}

// Deep Scan Tree Traversal Collector for Tasks and Subtasks
async function fetchProjectTaskIds(workspace_id, project_id) {
    const rootRows = await query(
        `SELECT pt.task_id FROM ph_project_tasks pt
         JOIN ph_tasks t ON t.id = pt.task_id
         WHERE pt.workspace_id = ? AND pt.project_id = ? AND t.deleted_at IS NULL AND t.deleted_ancestor_id IS NULL AND t.start_at IS NOT NULL`,
        [workspace_id, project_id]
    );
    const allIds = new Set(rootRows.map(r => Number(r.task_id)));
    if (allIds.size === 0) return [];

    let currentLevel = [...allIds];
    while (currentLevel.length > 0) {
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
    }
    return [...allIds];
}

// ────────────────────────────────────────────────
// HIERARCHY COMPUTATION LOGIC
// ────────────────────────────────────────────────
const enforceHierarchyExpand = (tasksGantt, currentMysqlMap) => {
    const adjustments = [];
    const childrenOf = {};
    tasksGantt.forEach(t => {
        if (t.parent_id && t.parent_id !== 0) (childrenOf[t.parent_id] ??= []).push(t.id);
    });

    const visited = new Set();
    const visit = (id) => {
        if (visited.has(id)) return;
        visited.add(id);
        (childrenOf[id] || []).forEach(visit);

        const kids = (childrenOf[id] || []).map(cid => tasksGantt.find(t => t.id === cid)).filter(Boolean);
        if (!kids.length) return;

        const task = tasksGantt.find(t => t.id === id);
        if (!task) return;

        const minChildStart = kids.reduce((best, k) => (!best || toComparable(k.start_date) < best.cmp) ? { cmp: toComparable(k.start_date), val: k.start_date } : best, null);
        const maxChildEnd = kids.reduce((best, k) => (!best || toComparable(k.end_date) > best.cmp) ? { cmp: toComparable(k.end_date), val: k.end_date } : best, null);

        let changed = false;
        if (minChildStart && toComparable(task.start_date) > minChildStart.cmp) { task.start_date = minChildStart.val; changed = true; }
        if (maxChildEnd && toComparable(task.end_date) < maxChildEnd.cmp) { task.end_date = maxChildEnd.val; changed = true; }

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
        graph.get(a).add(b); graph.get(b).add(a);
    };
    allTasks.forEach(t => { if (t.parent_id && t.parent_id !== 0) addEdge(t.id, t.parent_id); });
    allLinks.forEach(l => addEdge(l.source_task_id, l.target_task_id));

    const visited = new Set([startId]);
    const queue = [startId];
    while (queue.length > 0) {
        const current = queue.shift();
        for (const neighbor of (graph.get(current) || [])) {
            if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
        }
    }
    return visited;
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

    const ganttReadyTasks = tasksForScheduling.map(t => ({ ...t, start_date: toGanttDate(t.start_at), end_date: toGanttDate(t.due_at) }));
    let dhtmlxLinkAdjustments = [];
    let afterTasks = ganttReadyTasks;
    let constraintUpdates = new Map();

    if (linksInScope.length > 0 && !detectCircularLinks(tasksInScope, linksInScope)) {
        const result = runLinkScheduling({ tasksGantt: ganttReadyTasks, links: linksInScope, config, triggeredTaskId });
        dhtmlxLinkAdjustments = result.linkAdjustments;
        afterTasks = result.afterTasks;
        constraintUpdates = result.constraintUpdates;
    }

    const afterGanttArray = afterTasks.map(t => ({ id: t.id, parent_id: tasksInScope.find(orig => orig.id === t.id)?.parent_id ?? 0, start_date: t.start_date, end_date: t.end_date }));
    const afterMap = new Map(afterTasks.map(t => [t.id, { start_at: toMysqlDate(t.start_date), due_at: toMysqlDate(t.end_date) }]));
    const expandTargets = (!config.manage_linked_hierarchies && triggeredHierarchyIds) ? afterGanttArray.filter(t => triggeredHierarchyIds.has(t.id)) : afterGanttArray;

    const postLinkExpandAdjustments = enforceHierarchyExpand(expandTargets, afterMap);
    const finalAdjustments = [...dhtmlxLinkAdjustments, ...postLinkExpandAdjustments]
        .reduce((m, a) => m.set(a.id, a), new Map());

    const parentIds = new Set(tasksInScope.filter(t => t.parent_id && tasksInScope.some(p => p.id === t.parent_id)).map(t => t.parent_id));
    const filteredFinal = [...finalAdjustments.values()].filter(adj => {
        const orig = dbOriginalDates.get(adj.id);
        return orig && (orig.start_at !== adj.start_at || orig.due_at !== adj.due_at);
    });

    return {
        hierarchyAdjustments: filteredFinal.filter(a => parentIds.has(a.id)),
        linkAdjustments: filteredFinal.filter(a => !parentIds.has(a.id)),
        constraintUpdates
    };
};

const calculateProjectRange = (allTasks, allAdjustments, project) => {
    const taskMap = new Map(allTasks.map(t => [t.id, { ...t }]));
    allAdjustments.forEach(adj => { const t = taskMap.get(adj.id); if (t) { t.start_at = adj.start_at; t.due_at = adj.due_at; } });

    const range = Array.from(taskMap.values()).reduce((acc, t) => {
        const s = toComparable(toGanttDate(t.start_at)), e = toComparable(toGanttDate(t.due_at));
        if (s && (!acc.min || s < acc.min)) { acc.min = s; acc.minMysql = t.start_at; }
        if (e && (!acc.max || e > acc.max)) { acc.max = e; acc.maxMysql = t.due_at; }
        return acc;
    }, { min: null, max: null, minMysql: null, maxMysql: null });

    if (!range.minMysql || !range.maxMysql) return null;
    if (range.min < toComparable(toGanttDate(project.project_start)) || range.max > toComparable(toGanttDate(project.project_end))) {
        return { start_at: range.minMysql, due_at: range.maxMysql };
    }
    return null;
};

// ────────────────────────────────────────────────
// MAIN CALCULATION DRIVER ENTRYPOINTS
// ────────────────────────────────────────────────
export const recalculateImpact = async ({ workspace_id, project_id, task_id, taskUpdates }) => {
    let finalProjectId = project_id;
    if (!finalProjectId && task_id) {
        let currentTaskId = task_id, rootTaskId = task_id, steps = 0;
        while (steps < 50) {
            const [parentRow] = await query(`SELECT parent_id FROM ph_tasks WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL LIMIT 1`, [currentTaskId, workspace_id]);
            if (!parentRow) break;
            if (!parentRow.parent_id || parentRow.parent_id === 0) { rootTaskId = currentTaskId; break; }
            currentTaskId = parentRow.parent_id; steps++;
        }
        finalProjectId = rootTaskId;
    }

    const [project] = await query(
        `SELECT auto_schedule_tasks, auto_schedule_tasks_gap, move_subtasks_with_parent, restrict_tasks_to_working_days, start_date AS project_start, due_date AS project_end
         FROM ph_projects WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL`, [workspace_id, finalProjectId]
    );
    if (!project || !project.auto_schedule_tasks) {
        return { triggeredTask: null, hierarchyAdjustments: [], linkAdjustments: [], impactedTaskIds: [], project: null, constraintUpdates: [] };
    }

    const [workspace] = await query(`SELECT weekend FROM ph_workspaces WHERE id = ? LIMIT 1`, [workspace_id]);
    const projectTaskIds = await fetchProjectTaskIds(workspace_id, finalProjectId);
    if (!projectTaskIds.length) return { triggeredTask: null, hierarchyAdjustments: [], linkAdjustments: [], impactedTaskIds: [], project: null, constraintUpdates: [] };

    const allTasks = await query(
        `SELECT id, name, start_at, due_at, parent_id, constraint_type, constraint_date FROM ph_tasks
         WHERE id IN (${projectTaskIds.map(() => '?').join(',')}) AND workspace_id = ? AND deleted_at IS NULL AND deleted_ancestor_id IS NULL AND start_at IS NOT NULL`,
        [...projectTaskIds, workspace_id]
    );

    const dbOriginalDates = new Map(allTasks.map(t => [t.id, { start_at: t.start_at, due_at: t.due_at }]));
    if (task_id && taskUpdates?.start_at) {
        const t = allTasks.find(x => x.id === task_id);
        if (t) { t.start_at = taskUpdates.start_at; t.due_at = taskUpdates.due_at; }
    }

    const allLinks = await query(`SELECT id, source_task_id, target_task_id, \`type\` FROM ph_task_links WHERE workspace_id = ? AND project_id = ?`, [workspace_id, finalProjectId]);
    const dynamicHolidays = await fetchWorkspaceHolidays(workspace_id);

    const config = {
        work_days: parseWorkDays(workspace?.weekend),
        holidays: dynamicHolidays,
        scheduling_mode: GANTT_AUTO_SCHEDULING_MODE,
        duration_unit: GANTT_DURATION_UNIT,
        gap_mode: project.auto_schedule_tasks_gap || 'keep',
        move_subtasks_with_parent: !!project.move_subtasks_with_parent,
        restrict_to_working_days: !!project.restrict_tasks_to_working_days,
        manage_linked_hierarchies: GANTT_MANAGE_LINKED_HIERARCHIES
    };

    let allHierarchyAdjustments = [], allLinkAdjustments = [], allConstraintUpdates = new Map();

    if (task_id) {
        const componentIds = getConnectedComponent(task_id, allTasks, allLinks);
        const triggeredHierarchyIds = new Set();
        const buildHierarchy = (id) => { triggeredHierarchyIds.add(id); allTasks.filter(t => t.parent_id === id).forEach(c => buildHierarchy(c.id)); };
        let rootId = task_id, cur = allTasks.find(t => t.id === task_id);
        while (cur?.parent_id && cur.parent_id !== 0) { rootId = cur.parent_id; cur = allTasks.find(t => t.id === cur.parent_id); }
        buildHierarchy(rootId);

        const result = recalculateScope({ tasksInScope: allTasks.filter(t => componentIds.has(t.id)), linksInScope: allLinks.filter(l => componentIds.has(l.source_task_id) && componentIds.has(l.target_task_id)), config, triggeredTaskId: task_id, dbOriginalDates, triggeredHierarchyIds });
        allHierarchyAdjustments = result.hierarchyAdjustments; allLinkAdjustments = result.linkAdjustments; allConstraintUpdates = result.constraintUpdates;
    } else {
        const processed = new Set();
        for (const root of allTasks.filter(t => !t.parent_id || t.parent_id === 0)) {
            if (processed.has(root.id)) continue;
            const componentIds = getConnectedComponent(root.id, allTasks, allLinks);
            const result = recalculateScope({ tasksInScope: allTasks.filter(t => componentIds.has(t.id)), linksInScope: allLinks.filter(l => componentIds.has(l.source_task_id) && componentIds.has(l.target_task_id)), config, triggeredTaskId: null, dbOriginalDates, triggeredHierarchyIds: null });
            allHierarchyAdjustments.push(...result.hierarchyAdjustments); allLinkAdjustments.push(...result.linkAdjustments);
            result.constraintUpdates.forEach((v, k) => allConstraintUpdates.set(k, v));
            componentIds.forEach(id => processed.add(id));
        }
    }

    const dedup = (arr) => [...arr.reduce((m, a) => m.set(a.id, a), new Map()).values()];
    const finalHierarchyAdj = dedup(allHierarchyAdjustments);
    const finalLinkAdj = dedup(allLinkAdjustments);
    const allFinalAdj = dedup([...finalHierarchyAdj, ...finalLinkAdj]);

    const enrich = (adj) => { const t = allTasks.find(x => x.id === adj.id); const dc = allConstraintUpdates.get(adj.id); return { ...adj, constraint_type: dc?.constraint_type ?? t?.constraint_type ?? null, constraint_date: dc?.constraint_date ?? t?.constraint_date ?? null }; };

    // SAFE DECLARATION FIX: Correctly mapping the contextual target task instance
    const contextualTargetTask = allTasks.find(t => t.id === task_id);

    return {
        triggeredTask: task_id ? { id: task_id, start_at: contextualTargetTask?.start_at ?? null, due_at: contextualTargetTask?.due_at ?? null, constraint_type: allConstraintUpdates.get(task_id)?.constraint_type ?? contextualTargetTask?.constraint_type ?? null, constraint_date: allConstraintUpdates.get(task_id)?.constraint_date ?? contextualTargetTask?.constraint_date ?? null } : null,
        hierarchyAdjustments: finalHierarchyAdj.map(enrich),
        linkAdjustments: finalLinkAdj.map(enrich),
        impactedTaskIds: [...new Set([(task_id || null), ...allFinalAdj.map(a => a.id)])].filter(Boolean),
        project: calculateProjectRange(allTasks, allFinalAdj, project),
        constraintUpdates: [...allConstraintUpdates.entries()].map(([id, c]) => ({ id, ...c })),
    };
};

export const getProjectData = async ({ workspace_id, project_id }) => {
    const [project] = await query(
        `SELECT id, name, start_date, due_date, auto_schedule_tasks, auto_schedule_tasks_gap, move_subtasks_with_parent, restrict_tasks_to_working_days 
         FROM ph_projects WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL`,
        [workspace_id, project_id]
    );
    if (!project) throw new Error('Project not found');

    const [workspace] = await query(`SELECT weekend FROM ph_workspaces WHERE id = ? LIMIT 1`, [workspace_id]);
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
         FROM ph_task_links WHERE workspace_id = ? AND project_id = ?`,
        [workspace_id, project_id]
    );

    return {
        project: {
            auto_schedule_tasks: !!project.auto_schedule_tasks,
            auto_schedule_tasks_gap: project.auto_schedule_tasks_gap || 'keep',
            move_subtasks_with_parent: !!project.move_subtasks_with_parent,
            restrict_tasks_to_working_days: !!project.restrict_tasks_to_working_days,
            start_date: project.start_date,
            due_date: project.due_date,
            name: project.name
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
        links: links.map(l => ({ id: l.id, source: l.source_task_id, target: l.target_task_id, type: l.type }))
    };
};