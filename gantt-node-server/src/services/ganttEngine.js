// ganttEngine.js
import { createRequire } from 'module';
import { query } from '../utils/db.js';
import logger from '../utils/logger.js';
import {
    GANTT_DURATION_UNIT,
    GANTT_HOLIDAYS,
    GANTT_AUTO_SCHEDULING_MODE,
} from '../config/constants.js';

const require = createRequire(import.meta.url);
const { Gantt } = require('@dhx/gantt-node');

// ────────────────────────────────────────────────
// DATE HELPERS
// ────────────────────────────────────────────────
const toGanttDate = (str) => {
    if (!str) return null;
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!m) return null;
    const [, y, mo, d, h = '00', min = '00'] = m;
    return `${d}-${mo}-${y} ${h}:${min}`;
};

const toMysqlDate = (ganttStr) => {
    if (!ganttStr) return null;
    const m = ganttStr.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})/);
    if (!m) return null;
    const [, d, mo, y, h, min] = m;
    return `${y}-${mo}-${d} ${h}:${min}:00`;
};

const toComparable = (ganttDate) => {
    if (!ganttDate) return null;
    const m = ganttDate.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}:\d{2})/);
    if (!m) return null;
    return `${m[3]}-${m[2]}-${m[1]} ${m[4]}`;
};

const ganttToJsDate = (ganttDate) => {
    if (!ganttDate) return null;
    const m = ganttDate.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
};

const jsDateToGantt = (date) => {
    if (!date) return null;
    const pad = n => String(n).padStart(2, '0');
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// ────────────────────────────────────────────────
// WORK DAYS FORMAT HANDLING (ph_workspaces.weekend)
// ────────────────────────────────────────────────
const ISO_TO_JS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 0 };

export const parseWorkDays = (weekendJson) => {
    const ALL = [0, 1, 2, 3, 4, 5, 6];
    let parsed = weekendJson;
    if (typeof weekendJson === 'string') {
        try { parsed = JSON.parse(weekendJson); } catch { return [1, 2, 3, 4, 5]; }
    }
    const offDays = (parsed?.weekend ?? []).map(d => ISO_TO_JS[d]).filter(d => d !== undefined);
    return ALL.filter(d => !offDays.includes(d));
};

// ────────────────────────────────────────────────
// WORKING DAY SNAPPING
// ────────────────────────────────────────────────
const snapToWorkingDay = (ganttDate, direction, workDays, holidays) => {
    if (!ganttDate) return ganttDate;
    const d = ganttToJsDate(ganttDate);
    if (!d) return ganttDate;

    const holidaySet = new Set((holidays || []).map(h => String(h).slice(0, 10)));

    const isWorking = (date) => {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return workDays.includes(date.getDay()) && !holidaySet.has(key);
    };

    if (isWorking(d)) return ganttDate;

    const delta = direction === 'forward' ? 1 : -1;
    const candidate = new Date(d);
    for (let i = 0; i < 30; i++) {
        candidate.setDate(candidate.getDate() + delta);
        if (isWorking(candidate)) return jsDateToGantt(candidate);
    }
    return ganttDate;
};

// ────────────────────────────────────────────────
// CIRCULAR LINK DETECTION
// ────────────────────────────────────────────────
const detectCircularLinks = (tasks, links) => {
    const adj = new Map();
    tasks.forEach(t => adj.set(t.id, []));
    links.forEach(l => {
        const neighbors = adj.get(l.source_task_id);
        if (neighbors) neighbors.push(l.target_task_id);
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
        if (color.get(task.id) === WHITE) {
            if (hasCycle(task.id)) return true;
        }
    }
    return false;
};

// ────────────────────────────────────────────────
// HIERARCHY EXPAND (Parent Task Boundaries)
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

// ────────────────────────────────────────────────
// NORMALIZERS
// ────────────────────────────────────────────────
const normaliseTask = (t, allTasks) => {
    const isContainer = allTasks.some(child => child.parent_id === t.id);
    return {
        id: t.id,
        text: t.name || `Task ${t.id}`,
        type: isContainer ? 'project' : 'task',
        parent: t.parent_id ?? 0,
        start_date: t.start_date,
        end_date: t.due_date, // mapping database due_at boundaries
        ...(t.constraint_type ? { constraint_type: t.constraint_type } : {}),
        ...(t.constraint_date ? { constraint_date: toGanttDate(t.constraint_date) } : {}),
    };
};

const normaliseLink = (l) => ({
    id: l.id,
    source: l.source_task_id,
    target: l.target_task_id,
    type: String(l.type ?? 0),
});

// ────────────────────────────────────────────────
// DHTMLX AUTO-SCHEDULER ENGINE RUNNER
// ────────────────────────────────────────────────
const runLinkScheduling = ({ tasksGantt, links, config, triggeredTaskId }) => {
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

    if (triggeredTaskId) {
        gantt.autoSchedule(triggeredTaskId);
    } else {
        gantt.autoSchedule();
    }

    const afterTasks = gantt.serialize().data;
    gantt.destructor();

    const constraintUpdates = new Map();
    afterTasks.forEach(t => {
        if (t.constraint_type || t.constraint_date) {
            constraintUpdates.set(t.id, {
                constraint_type: t.constraint_type || null,
                constraint_date: t.constraint_date ? toMysqlDate(t.constraint_date) : null,
            });
        }
    });

    const linkAdjustments = afterTasks
        .map(t => {
            const before = beforeMap.get(t.id);
            if (before && (before.start_date !== t.start_date || before.end_date !== t.end_date)) {
                return { id: t.id, start_at: toMysqlDate(t.start_date), due_at: toMysqlDate(t.end_date) };
            }
            return null;
        })
        .filter(Boolean);

    return { linkAdjustments, afterTasks, constraintUpdates };
};

// ────────────────────────────────────────────────
// MOVEMENT GRAPH SEGMENTATION LOGIC
// ────────────────────────────────────────────────
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

    const visited = new Set();
    const queue = [startId];
    visited.add(startId);

    while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = graph.get(current) || new Set();
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push(neighbor);
            }
        }
    }
    return visited;
};

// ────────────────────────────────────────────────
// FIXED HIERARCHICAL IDS GENERATOR (Laravel Context)
// ────────────────────────────────────────────────
async function fetchProjectTaskIds(workspace_id, project_id) {
    // 1. Fetch only root tasks assigned directly to project_tasks table using the 'task_id' FK column
    const rootRows = await query(
        `SELECT pt.task_id AS primary_db_id 
         FROM ph_project_tasks pt
         JOIN ph_tasks t ON t.id = pt.task_id
         WHERE pt.workspace_id = ? AND pt.project_id = ?
           AND t.deleted_at IS NULL AND t.deleted_ancestor_id IS NULL`,
        [workspace_id, project_id]
    );

    // 2. Map directly to our tracking set of primary increment keys (e.g., 47264)
    const allIds = new Set(rootRows.map(r => Number(r.primary_db_id)));
    if (allIds.size === 0) return [];

    let currentLevel = [...allIds];

    // 3. Dig down the tree via 'parent_id' column mappings inside ph_tasks
    while (currentLevel.length > 0) {
        const placeholders = currentLevel.map(() => '?').join(',');
        const childRows = await query(
            `SELECT id FROM ph_tasks
             WHERE workspace_id = ?
               AND parent_id IN (${placeholders})
               AND deleted_at IS NULL
               AND deleted_ancestor_id IS NULL`,
            [workspace_id, ...currentLevel]
        );
        const newIds = childRows.map(r => Number(r.id)).filter(id => !allIds.has(id));
        newIds.forEach(id => allIds.add(id));
        currentLevel = newIds;
    }

    return [...allIds];
}

// ────────────────────────────────────────────────
// CALCULATION ENGINE SCOPING WRAPPER
// ────────────────────────────────────────────────
const recalculateScope = ({
    tasksInScope,
    linksInScope,
    config,
    triggeredTaskId,
    dbOriginalDates,
    hasActualChange,
    triggeredHierarchyIds,
}) => {
    let tasksForScheduling = [...tasksInScope];

    if (config.restrict_to_working_days && triggeredTaskId && hasActualChange) {
        const task = tasksForScheduling.find(t => t.id === triggeredTaskId);
        if (task) {
            const gStart = toGanttDate(task.start_at);
            const gEnd = toGanttDate(task.due_at);
            const snappedStart = toMysqlDate(snapToWorkingDay(gStart, 'forward', config.work_days, config.holidays));
            const snappedEnd = toMysqlDate(snapToWorkingDay(gEnd, 'backward', config.work_days, config.holidays));
            if (snappedStart) task.start_at = snappedStart;
            if (snappedEnd) task.due_at = snappedEnd;
        }
    }

    const ganttReadyTasks = tasksForScheduling.map(t => ({
        ...t,
        start_date: toGanttDate(t.start_at),
        end_date: toGanttDate(t.due_at),
    }));

    const currentMysqlMap = new Map(tasksForScheduling.map(t => [t.id, { start_at: t.start_at, due_at: t.due_at }]));

    enforceHierarchyExpand(ganttReadyTasks, currentMysqlMap);

    let dhtmlxLinkAdjustments = [];
    let afterTasks = ganttReadyTasks;
    let constraintUpdates = new Map();

    if (hasActualChange && linksInScope.length > 0) {
        if (detectCircularLinks(tasksInScope, linksInScope)) {
            logger.error(`Circular link detected in scope (task_id=${triggeredTaskId}). Skipping link scheduling.`);
        } else {
            const result = runLinkScheduling({
                tasksGantt: ganttReadyTasks,
                links: linksInScope,
                config,
                triggeredTaskId,
            });
            dhtmlxLinkAdjustments = result.linkAdjustments;
            afterTasks = result.afterTasks;
            constraintUpdates = result.constraintUpdates;
        }
    }

    const afterMap = new Map(afterTasks.map(t => [t.id, {
        start_at: toMysqlDate(t.start_date),
        due_at: toMysqlDate(t.end_date),
    }]));

    const afterGanttArray = afterTasks.map(t => ({
        id: t.id,
        parent_id: tasksInScope.find(orig => orig.id === t.id)?.parent_id ?? 0,
        start_date: t.start_date,
        end_date: t.end_date,
    }));

    const expandTargets = triggeredHierarchyIds ? afterGanttArray.filter(t => triggeredHierarchyIds.has(t.id)) : afterGanttArray;

    const postLinkExpandAdjustments = enforceHierarchyExpand(expandTargets, afterMap);

    const allAdj = [...dhtmlxLinkAdjustments, ...postLinkExpandAdjustments];
    const dedup = (arr) => [...arr.reduce((m, a) => m.set(a.id, a), new Map()).values()];

    const finalAdjustments = dedup(allAdj).filter(adj => {
        const orig = dbOriginalDates.get(adj.id);
        return orig && (orig.start_at !== adj.start_at || orig.due_at !== adj.due_at);
    });

    const parentIds = new Set(
        tasksInScope
            .filter(t => t.parent_id && tasksInScope.some(p => p.id === t.parent_id))
            .map(t => t.parent_id)
    );

    const hierarchyAdjustments = finalAdjustments.filter(a => parentIds.has(a.id));
    const linkAdjustments = finalAdjustments.filter(a => !parentIds.has(a.id));

    return { hierarchyAdjustments, linkAdjustments, constraintUpdates };
};

// ────────────────────────────────────────────────
// PROJECT RUNTIME DATE BOUNDARIES CALCULATION
// ────────────────────────────────────────────────
const calculateProjectRange = (allTasks, allAdjustments, project) => {
    const taskMap = new Map(allTasks.map(t => [t.id, { ...t }]));

    allAdjustments.forEach(adj => {
        const t = taskMap.get(adj.id);
        if (t) { t.start_at = adj.start_at; t.due_at = adj.due_at; }
    });

    const range = Array.from(taskMap.values()).reduce(
        (acc, t) => {
            const s = toComparable(toGanttDate(t.start_at));
            const e = toComparable(toGanttDate(t.due_at));
            if (s && (!acc.min || s < acc.min)) { acc.min = s; acc.minMysql = t.start_at; }
            if (e && (!acc.max || e > acc.max)) { acc.max = e; acc.maxMysql = t.due_at; }
            return acc;
        },
        { min: null, max: null, minMysql: null, maxMysql: null }
    );

    if (!range.minMysql || !range.maxMysql) return null;

    const origStart = toComparable(toGanttDate(project.project_start));
    const origEnd = toComparable(toGanttDate(project.project_end));

    if (range.min < origStart || range.max > origEnd) {
        return { start_at: range.minMysql, due_at: range.maxMysql };
    }
    return null;
};

// ────────────────────────────────────────────────
// POST /api/gantt/recalculate-impact ENTRYPOINT
// ────────────────────────────────────────────────
export const recalculateImpact = async ({
    workspace_id,
    project_id,
    task_id,
    taskUpdates
}) => {
    let finalProjectId = project_id;
    if (!finalProjectId && task_id) {
        const [row] = await query(
            `SELECT project_id FROM ph_project_tasks WHERE workspace_id = ? AND task_id = ? LIMIT 1`,
            [workspace_id, task_id]
        );
        if (!row) throw new Error(`Task ${task_id} not found in any project`);
        finalProjectId = row.project_id;
    }
    if (!finalProjectId) throw new Error('project_id is required');

    // Safe SQL selector mapping only verified table column names
    const [project] = await query(
        `SELECT auto_schedule_tasks, auto_schedule_tasks_gap, move_subtasks_with_parent,
                restrict_tasks_to_working_days, start_date AS project_start, due_date AS project_end
         FROM ph_projects WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL`,
        [workspace_id, finalProjectId]
    );
    if (!project) throw new Error(`Project ${finalProjectId} not found`);

    if (!project.auto_schedule_tasks) {
        return {
            triggeredTask: null, hierarchyAdjustments: [], linkAdjustments: [],
            impactedTaskIds: [], project: null, constraintUpdates: []
        };
    }

    const [workspace] = await query(
        `SELECT weekend FROM ph_workspaces WHERE id = ? LIMIT 1`, [workspace_id]
    );
    const workDays = parseWorkDays(workspace?.weekend);

    const projectTaskIds = await fetchProjectTaskIds(workspace_id, finalProjectId);
    let allTasks = [];
    if (projectTaskIds.length > 0) {
        const placeholders = projectTaskIds.map(() => '?').join(',');
        allTasks = await query(
            `SELECT id, name, start_at, due_at, parent_id, constraint_type, constraint_date
             FROM ph_tasks
             WHERE id IN (${placeholders}) AND workspace_id = ?
               AND deleted_at IS NULL AND deleted_ancestor_id IS NULL
               AND start_at IS NOT NULL AND due_at IS NOT NULL`,
            [...projectTaskIds, workspace_id]
        );
    }

    const dbOriginalDates = new Map(allTasks.map(t => [t.id, { start_at: t.start_at, due_at: t.due_at }]));

    if (task_id && taskUpdates?.start_at && taskUpdates?.due_at) {
        const task = allTasks.find(t => t.id === task_id);
        if (task) {
            task.start_at = taskUpdates.start_at;
            task.due_at = taskUpdates.due_at;
        }
    }

    const allLinks = await query(
        `SELECT id, source_task_id, target_task_id, \`type\`
         FROM ph_task_links WHERE workspace_id = ? AND project_id = ?`,
        [workspace_id, finalProjectId]
    );

    const config = {
        work_days: workDays,
        holidays: GANTT_HOLIDAYS,
        scheduling_mode: GANTT_AUTO_SCHEDULING_MODE,
        duration_unit: GANTT_DURATION_UNIT,
        gap_mode: project.auto_schedule_tasks_gap || 'keep',
        move_subtasks_with_parent: !!project.move_subtasks_with_parent,
        restrict_to_working_days: !!project.restrict_tasks_to_working_days,
        manage_linked_hierarchies: true,
    };

    let allHierarchyAdjustments = [];
    let allLinkAdjustments = [];
    let allConstraintUpdates = new Map();
    const hasActualChange = !!(taskUpdates?.start_at && taskUpdates?.due_at) || !!task_id;

    if (task_id) {
        const componentIds = getConnectedComponent(task_id, allTasks, allLinks);

        const triggeredHierarchyIds = new Set();
        const buildHierarchy = (id) => {
            triggeredHierarchyIds.add(id);
            allTasks.filter(t => t.parent_id === id).forEach(c => buildHierarchy(c.id));
        };

        let rootId = task_id;
        let cur = allTasks.find(t => t.id === task_id);
        while (cur?.parent_id && cur.parent_id !== 0) {
            rootId = cur.parent_id;
            cur = allTasks.find(t => t.id === cur.parent_id);
        }
        buildHierarchy(rootId);

        const tasksInScope = allTasks.filter(t => componentIds.has(t.id));
        const linksInScope = allLinks.filter(
            l => componentIds.has(l.source_task_id) && componentIds.has(l.target_task_id)
        );

        const result = recalculateScope({
            tasksInScope, linksInScope, config,
            triggeredTaskId: task_id,
            dbOriginalDates, hasActualChange,
            triggeredHierarchyIds,
        });
        allHierarchyAdjustments = result.hierarchyAdjustments;
        allLinkAdjustments = result.linkAdjustments;
        allConstraintUpdates = result.constraintUpdates;
    } else {
        const processed = new Set();
        const roots = allTasks.filter(t => !t.parent_id || t.parent_id === 0);
        for (const root of roots) {
            if (processed.has(root.id)) continue;
            const componentIds = getConnectedComponent(root.id, allTasks, allLinks);
            const tasksInScope = allTasks.filter(t => componentIds.has(t.id));
            const linksInScope = allLinks.filter(
                l => componentIds.has(l.source_task_id) && componentIds.has(l.target_task_id)
            );

            const result = recalculateScope({
                tasksInScope, linksInScope, config,
                triggeredTaskId: null,
                dbOriginalDates, hasActualChange: false,
                triggeredHierarchyIds: null,
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

    const enrichWithConstraints = (adj) => {
        const task = allTasks.find(t => t.id === adj.id);
        const dhtmlxConstraint = allConstraintUpdates.get(adj.id);
        return {
            ...adj,
            constraint_type: dhtmlxConstraint?.constraint_type ?? task?.constraint_type ?? null,
            constraint_date: dhtmlxConstraint?.constraint_date ?? task?.constraint_date ?? null,
        };
    };

    let triggeredTask = null;
    if (task_id) {
        const task = allTasks.find(t => t.id === task_id);
        const dhtmlxConstraint = allConstraintUpdates.get(task_id);
        triggeredTask = {
            id: task_id,
            start_at: task?.start_at ?? null,
            due_at: task?.due_at ?? null,
            constraint_type: dhtmlxConstraint?.constraint_type ?? task?.constraint_type ?? null,
            constraint_date: dhtmlxConstraint?.constraint_date ?? task?.constraint_date ?? null,
        };
    }

    const projectResponse = calculateProjectRange(allTasks, allFinalAdj, project);

    if (allFinalAdj.length > 0) {
        for (const t of allFinalAdj) {
            await query(
                `UPDATE ph_tasks SET start_at = ?, due_at = ?, updated_at = NOW() 
                 WHERE id = ? AND workspace_id = ?`,
                [t.start_at, t.due_at, t.id, workspace_id]
            );
        }
    }

    return {
        triggeredTask,
        hierarchyAdjustments: finalHierarchyAdj.map(enrichWithConstraints),
        linkAdjustments: finalLinkAdj.map(enrichWithConstraints),
        impactedTaskIds: [...new Set([
            ...(triggeredTask ? [triggeredTask.id] : []),
            ...allFinalAdj.map(a => a.id),
        ])],
        project: projectResponse,
        constraintUpdates: [...allConstraintUpdates.entries()].map(([id, c]) => ({ id, ...c })),
    };
};

// ────────────────────────────────────────────────
// GET /api/gantt/project-data ENTRYPOINT
// ────────────────────────────────────────────────
export const getProjectData = async ({ workspace_id, project_id }) => {
    const [project] = await query(
        `SELECT id, name, start_date, due_date,
                auto_schedule_tasks, auto_schedule_tasks_gap,
                move_subtasks_with_parent, restrict_tasks_to_working_days
         FROM ph_projects WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL`,
        [workspace_id, project_id]
    );
    if (!project) throw new Error('Project not found');

    const [workspace] = await query(
        `SELECT weekend FROM ph_workspaces WHERE id = ? LIMIT 1`, [workspace_id]
    );
    const workDays = parseWorkDays(workspace?.weekend);

    const projectTaskIds = await fetchProjectTaskIds(workspace_id, project_id);

    let tasks = [];
    if (projectTaskIds.length > 0) {
        const placeholders = projectTaskIds.map(() => '?').join(',');
        tasks = await query(
            `SELECT id, name, start_at, due_at, parent_id, constraint_type, constraint_date
             FROM ph_tasks
             WHERE id IN (${placeholders}) AND workspace_id = ?
               AND deleted_at IS NULL AND deleted_ancestor_id IS NULL
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
            name: project.name,
        },
        workspace: {
            work_days: workDays,
            holidays: GANTT_HOLIDAYS,
        },
        tasks: tasks.map(t => ({
            id: t.id,
            text: t.name,
            start_date: t.start_at,
            end_date: t.due_at,
            parent: t.parent_id || 0,
            constraint_type: t.constraint_type || null,
            constraint_date: t.constraint_date || null,
        })),
        links: links.map(l => ({
            id: l.id,
            source: l.source_task_id,
            target: l.target_task_id,
            type: l.type,
        })),
    };
};