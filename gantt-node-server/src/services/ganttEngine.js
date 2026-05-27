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
// WORK DAYS & HOLIDAYS VALIDATION
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
    // Scan outward to find the closest active calendar block
    for (let i = 0; i < 30; i++) {
        candidate.setDate(candidate.getDate() + delta);
        if (isWorking(candidate)) return jsDateToGantt(candidate);
    }
    return ganttDate;
};

// ────────────────────────────────────────────────
// NATIVE CYCLE DETECTION GUARD (DAG CHECK)
// ────────────────────────────────────────────────
const validateCircularLinks = (links) => {
    const adjList = new Map();
    links.forEach(l => {
        if (!adjList.has(l.source_task_id)) adjList.set(l.source_task_id, []);
        adjList.get(l.source_task_id).push(l.target_task_id);
    });

    const visited = new Set();
    const recStack = new Set();

    const hasCycle = (node) => {
        if (recStack.has(node)) return true;
        if (visited.has(node)) return false;

        visited.add(node);
        recStack.add(node);

        const neighbors = adjList.get(node) || [];
        for (const neighbor of neighbors) {
            if (hasCycle(neighbor)) return true;
        }

        recStack.delete(node);
        return false;
    };

    for (const node of adjList.keys()) {
        if (hasCycle(node)) {
            throw new Error(`Circular dependency detected in project link paths! Scheduling stopped.`);
        }
    }
};

// ────────────────────────────────────────────────
// HIERARCHY EXPAND
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
// NORMALISERS
// ────────────────────────────────────────────────
const normaliseTask = (t, allTasks) => {
    // Dynamically flag container summary items as 'project' type blocks
    const isContainer = allTasks.some(child => child.parent_id === t.id);
    return {
        id: t.id,
        text: t.name || `Task ${t.id}`,
        type: isContainer ? 'project' : 'task',
        parent: t.parent_id ?? 0,
        start_date: t.start_date,
        end_date: t.end_date,
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
// DHTMLX LINK SCHEDULING WITH ESCAPE RE-SNAPPING
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

    let afterTasks = gantt.serialize().data;
    gantt.destructor();

    // POST-PROCESSOR SANITATION RULE: Force ALL shifted tasks back off non-working days
    if (config.restrict_to_working_days) {
        afterTasks = afterTasks.map(t => {
            if (t.type === 'project') return t; // Let boundaries map cleanly later
            const snappedStart = snapToWorkingDay(t.start_date, 'forward', workDays, config.holidays);
            const snappedEnd = snapToWorkingDay(t.end_date, 'backward', workDays, config.holidays);
            return { ...t, start_date: snappedStart, end_date: snappedEnd };
        });
    }

    const linkAdjustments = afterTasks
        .map(t => {
            const before = beforeMap.get(t.id);
            if (before && (before.start_date !== t.start_date || before.end_date !== t.end_date)) {
                return {
                    id: t.id,
                    start_at: toMysqlDate(t.start_date),
                    due_at: toMysqlDate(t.end_date),
                };
            }
            return null;
        })
        .filter(Boolean);

    return { linkAdjustments, afterTasks };
};

// ────────────────────────────────────────────────
// CONNECTED COMPONENT
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
// FETCH PROJECT TASK IDS
// ────────────────────────────────────────────────
async function fetchProjectTaskIds(workspace_id, project_id) {
    const rootRows = await query(
        `SELECT task_id FROM ph_project_tasks WHERE workspace_id = ? AND project_id = ?`,
        [workspace_id, project_id]
    );
    const rootIds = rootRows.map(r => r.task_id);
    if (rootIds.length === 0) return [];

    const allIds = new Set(rootIds);
    let currentLevel = [...rootIds];

    while (currentLevel.length > 0) {
        const placeholders = currentLevel.map(() => '?').join(',');
        const childRows = await query(
            `SELECT id FROM ph_tasks
             WHERE workspace_id = ? AND parent_id IN (${placeholders})
               AND deleted_at IS NULL AND deleted_ancestor_id IS NULL
               AND start_at IS NOT NULL AND due_at IS NOT NULL`,
            [workspace_id, ...currentLevel]
        );
        const newIds = childRows.map(r => r.id).filter(id => !allIds.has(id));
        newIds.forEach(id => allIds.add(id));
        currentLevel = newIds;
    }
    return [...allIds];
}

// ────────────────────────────────────────────────
// RECALCULATE SCOPE
// ────────────────────────────────────────────────
const recalculateScope = ({
    tasksInScope,
    linksInScope,
    config,
    triggeredTaskId,
    dbOriginalDates,
    hasActualChange
}) => {
    let tasksForScheduling = [...tasksInScope];

    if (config.restrict_to_working_days && triggeredTaskId && hasActualChange) {
        const task = tasksForScheduling.find(t => t.id === triggeredTaskId);
        if (task) {
            const gStart = toGanttDate(task.start_at);
            const gEnd = toGanttDate(task.due_at);
            task.start_at = toMysqlDate(snapToWorkingDay(gStart, 'forward', config.work_days, config.holidays));
            task.due_at = toMysqlDate(snapToWorkingDay(gEnd, 'backward', config.work_days, config.holidays));
        }
    }

    const ganttReadyTasks = tasksForScheduling.map(t => ({
        ...t,
        start_date: toGanttDate(t.start_at),
        end_date: toGanttDate(t.due_at),
    }));

    const currentMysqlMap = new Map(tasksForScheduling.map(t => [t.id, { start_at: t.start_at, due_at: t.due_at }]));

    const hierarchyExpandAdjustments = enforceHierarchyExpand(ganttReadyTasks, currentMysqlMap);

    let dhtmlxAdjustments = [];
    let afterTasks = ganttReadyTasks;

    if (hasActualChange && linksInScope.length > 0) {
        const result = runLinkScheduling({
            tasksGantt: ganttReadyTasks,
            links: linksInScope,
            config,
            triggeredTaskId
        });
        dhtmlxAdjustments = result.linkAdjustments;
        afterTasks = result.afterTasks;
    }

    const afterMap = new Map(afterTasks.map(t => [t.id, {
        start_at: toMysqlDate(t.start_date),
        due_at: toMysqlDate(t.end_date)
    }]));

    const afterGanttArray = afterTasks.map(t => ({
        id: t.id,
        parent_id: tasksInScope.find(orig => orig.id === t.id)?.parent_id ?? 0,
        start_date: t.start_date,
        end_date: t.end_date,
    }));

    const postLinkExpandAdjustments = enforceHierarchyExpand(afterGanttArray, afterMap);

    const allAdj = [...hierarchyExpandAdjustments, ...dhtmlxAdjustments, ...postLinkExpandAdjustments];

    const finalAdjustments = allAdj.filter(adj => {
        const orig = dbOriginalDates.get(adj.id);
        return orig && (orig.start_at !== adj.start_at || orig.due_at !== adj.due_at);
    });

    return {
        hierarchyAdjustments: finalAdjustments,
        linkAdjustments: finalAdjustments,
    };
};

// ────────────────────────────────────────────────
// PROJECT RANGE CALCULATION
// ────────────────────────────────────────────────
const calculateProjectRange = (allTasks, adjustments, project) => {
    const taskMap = new Map(allTasks.map(t => [t.id, { ...t }]));

    adjustments.forEach(adj => {
        const t = taskMap.get(adj.id);
        if (t) {
            t.start_at = adj.start_at;
            t.due_at = adj.due_at;
        }
    });

    const allGantt = Array.from(taskMap.values()).map(t => ({
        start_date: toGanttDate(t.start_at),
        end_date: toGanttDate(t.due_at),
    }));

    const range = allGantt.reduce((acc, t) => {
        const s = toComparable(t.start_date);
        const e = toComparable(t.end_date);
        if (s && (!acc.min || s < acc.min)) { acc.min = s; acc.minGantt = t.start_date; }
        if (e && (!acc.max || e > acc.max)) { acc.max = e; acc.maxGantt = t.end_date; }
        return acc;
    }, { min: null, max: null, minGantt: null, maxGantt: null });

    if (!range.minGantt || !range.maxGantt) return null;

    return {
        start_at: toMysqlDate(range.minGantt),
        due_at: toMysqlDate(range.maxGantt)
    };
};

// ────────────────────────────────────────────────
// MAIN RECALCULATE IMPACT (DB-First)
// ────────────────────────────────────────────────
export const recalculateImpact = async ({
    workspace_id,
    project_id,
    task_id,
    taskUpdates   // optional - for backward compatibility only
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

    const [project] = await query(`
        SELECT auto_schedule_tasks, auto_schedule_tasks_gap, move_subtasks_with_parent,
               restrict_tasks_to_working_days, start_date AS project_start, due_date AS project_end
        FROM ph_projects WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL`,
        [workspace_id, finalProjectId]
    );
    if (!project) throw new Error(`Project ${finalProjectId} not found`);

    if (!project.auto_schedule_tasks) {
        return {
            hierarchyAdjustments: [],
            linkAdjustments: [],
            impactedTaskIds: [],
            project: null,
            triggeredTask: null
        };
    }

    const [workspace] = await query(`SELECT weekend FROM ph_workspaces WHERE id = ? LIMIT 1`, [workspace_id]);
    const workDays = parseWorkDays(workspace?.weekend);

    const projectTaskIds = await fetchProjectTaskIds(workspace_id, finalProjectId);
    let allTasks = [];
    if (projectTaskIds.length > 0) {
        const placeholders = projectTaskIds.map(() => '?').join(',');
        allTasks = await query(`
            SELECT id, name, start_at, due_at, parent_id, constraint_type, constraint_date
            FROM ph_tasks WHERE id IN (${placeholders}) AND workspace_id = ?
            AND deleted_at IS NULL AND deleted_ancestor_id IS NULL
            AND start_at IS NOT NULL AND due_at IS NOT NULL`,
            [...projectTaskIds, workspace_id]
        );
    }

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

    // Dynamic Database Flag Configurations Interventions
    const config = {
        work_days: workDays,
        holidays: GANTT_HOLIDAYS,
        scheduling_mode: GANTT_AUTO_SCHEDULING_MODE,
        duration_unit: GANTT_DURATION_UNIT,
        gap_mode: project.auto_schedule_tasks_gap || 'keep',
        move_subtasks_with_parent: !!project.move_subtasks_with_parent,
        restrict_to_working_days: !!project.restrict_tasks_to_working_days,
    };

    // Protect our network loop calculation engine before initializing DHTMLX instances
    validateCircularLinks(allLinks);

    const dbOriginalDates = new Map(allTasks.map(t => [t.id, { start_at: t.start_at, due_at: t.due_at }]));
    const hasActualChange = !!(taskUpdates?.start_at && taskUpdates?.due_at) || (!taskUpdates && !!task_id);
    let allAdjustments = [];

    if (task_id) {
        const componentIds = getConnectedComponent(task_id, allTasks, allLinks);
        const tasksInScope = allTasks.filter(t => componentIds.has(t.id));
        const linksInScope = allLinks.filter(l =>
            componentIds.has(l.source_task_id) && componentIds.has(l.target_task_id)
        );

        const result = recalculateScope({
            tasksInScope,
            linksInScope,
            config,
            triggeredTaskId: task_id,
            dbOriginalDates,
            hasActualChange
        });
        allAdjustments = [...result.hierarchyAdjustments, ...result.linkAdjustments];
    } else {
        const processed = new Set();
        const roots = allTasks.filter(t => !t.parent_id || t.parent_id === 0);
        for (const root of roots) {
            if (processed.has(root.id)) continue;
            const componentIds = getConnectedComponent(root.id, allTasks, allLinks);
            const tasksInScope = allTasks.filter(t => componentIds.has(t.id));
            const linksInScope = allLinks.filter(l =>
                componentIds.has(l.source_task_id) && componentIds.has(l.target_task_id)
            );

            const result = recalculateScope({
                tasksInScope,
                linksInScope,
                config,
                triggeredTaskId: null,
                dbOriginalDates,
                hasActualChange: false
            });
            allAdjustments.push(...result.hierarchyAdjustments, ...result.linkAdjustments);
            componentIds.forEach(id => processed.add(id));
        }
    }

    const dedup = (arr) => [...arr.reduce((m, a) => m.set(a.id, a), new Map()).values()];
    const finalAdjustments = dedup(allAdjustments);

    let triggeredTask = null;
    if (task_id) {
        const finalTask = allTasks.find(t => t.id === task_id);
        if (finalTask) {
            triggeredTask = {
                id: task_id,
                start_at: finalTask.start_at,
                due_at: finalTask.due_at
            };
        }
    }

    const projectResponse = calculateProjectRange(allTasks, finalAdjustments, project);

    return {
        hierarchyAdjustments: finalAdjustments.filter(a => a.id !== task_id),
        linkAdjustments: finalAdjustments.filter(a => a.id !== task_id),
        impactedTaskIds: [...new Set(finalAdjustments.map(a => a.id))],
        project: projectResponse,
        triggeredTask
    };
};

// ────────────────────────────────────────────────
// GET PROJECT DATA
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

    const [workspace] = await query(`SELECT weekend FROM ph_workspaces WHERE id = ? LIMIT 1`, [workspace_id]);
    const workDays = parseWorkDays(workspace?.weekend);

    const projectTaskIds = await fetchProjectTaskIds(workspace_id, project_id);
    let tasks = [];
    if (projectTaskIds.length > 0) {
        const placeholders = projectTaskIds.map(() => '?').join(',');
        tasks = await query(`
            SELECT id, name, start_at, due_at, parent_id, constraint_type, constraint_date
            FROM ph_tasks WHERE id IN (${placeholders}) AND workspace_id = ?
            AND deleted_at IS NULL AND deleted_ancestor_id IS NULL
            AND start_at IS NOT NULL AND due_at IS NOT NULL`,
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
            constraint_type: t.constraint_type,
            constraint_date: t.constraint_date,
        })),
        links: links.map(l => ({
            id: l.id,
            source: l.source_task_id,
            target: l.target_task_id,
            type: l.type,
        })),
    };
};