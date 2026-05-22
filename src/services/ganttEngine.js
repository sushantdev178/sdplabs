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
// DATE HELPERS (unchanged)
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
// WORK DAYS (unchanged)
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
// WORKING DAY SNAPPING (unchanged)
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
    for (let i = 0; i < 14; i++) {
        candidate.setDate(candidate.getDate() + delta);
        if (isWorking(candidate)) return jsDateToGantt(candidate);
    }

    logger.warn(`snapToWorkingDay: no working day found within 14 days of ${ganttDate}`);
    return ganttDate;
};

const applyWorkingDaySnap = (tasks, workDays, holidays) => {
    const adjustments = [];
    const snappedTasks = tasks.map(t => {
        const ganttStart = toGanttDate(t.start_at);
        const ganttEnd = toGanttDate(t.due_at);
        const snappedStart = snapToWorkingDay(ganttStart, 'forward', workDays, holidays);
        const snappedEnd = snapToWorkingDay(ganttEnd, 'backward', workDays, holidays);
        const newStart = toMysqlDate(snappedStart);
        const newEnd = toMysqlDate(snappedEnd);
        if (newStart !== t.start_at || newEnd !== t.due_at) {
            adjustments.push({ id: t.id, start_at: newStart, due_at: newEnd });
        }
        return { ...t, start_at: newStart, due_at: newEnd };
    });
    return { snappedTasks, adjustments };
};

// ────────────────────────────────────────────────
// HIERARCHY EXPAND (unchanged)
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
// NORMALISERS (unchanged)
// ────────────────────────────────────────────────

const normaliseTask = (t) => ({
    id: t.id,
    text: t.name || `Task ${t.id}`,
    type: 'task',
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

// ────────────────────────────────────────────────
// DHTMLX LINK SCHEDULING (with full‑day work time)
// ────────────────────────────────────────────────

const runLinkScheduling = ({ tasksGantt, links, config, triggeredTaskId }) => {
    const normTasks = tasksGantt.map(normaliseTask);
    const normLinks = links.map(normaliseLink);

    const beforeMap = new Map();
    normTasks.forEach(t => {
        beforeMap.set(t.id, { start_date: t.start_date, end_date: t.end_date });
    });

    const moveAsap = config.gap_mode === 'compress';

    const gantt = Gantt.getGanttInstance({
        plugins: { auto_scheduling: true },
        config: {
            duration_unit: config.duration_unit || GANTT_DURATION_UNIT,
            work_time: true,
            auto_types: false,
            auto_scheduling: {
                enabled: true,
                schedule_on_parse: false,
                mode: config.scheduling_mode || GANTT_AUTO_SCHEDULING_MODE,
                move_asap_tasks: moveAsap,
            },
            auto_scheduling_descendant_links: !!config.move_subtasks_with_parent,
        },
        data: { tasks: normTasks, links: normLinks },
    });

    // Set working hours for whole day (00:00–24:00)
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

    const linkAdjustments = afterTasks
        .map(t => {
            const before = beforeMap.get(t.id);
            if (!before) return null;
            if (before.start_date !== t.start_date || before.end_date !== t.end_date) {
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
// RECURSIVE TASK FETCH (new)
// ────────────────────────────────────────────────

async function fetchProjectTaskIds(workspace_id, project_id) {
    const rootRows = await query(
        `SELECT task_id FROM ph_project_tasks
         WHERE workspace_id = ? AND project_id = ?`,
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
// RECALCULATE SCOPE (unchanged)
// ────────────────────────────────────────────────

const recalculateScope = ({
    tasksInScope,
    linksInScope,
    config,
    triggeredTaskId,
}) => {
    let hierarchyAdjustments = [];
    let tasksForScheduling = tasksInScope;

    if (config.restrict_to_working_days) {
        const { snappedTasks, adjustments } = applyWorkingDaySnap(
            tasksInScope,
            config.work_days,
            config.holidays
        );
        tasksForScheduling = snappedTasks;
        hierarchyAdjustments = adjustments;
    }

    const ganttReadyTasks = tasksForScheduling.map(t => ({
        ...t,
        start_date: toGanttDate(t.start_at),
        end_date: toGanttDate(t.due_at),
    }));

    const currentMysqlMap = new Map();
    tasksForScheduling.forEach(t =>
        currentMysqlMap.set(t.id, { start_at: t.start_at, due_at: t.due_at })
    );
    const hierarchyExpandAdjustments = enforceHierarchyExpand(ganttReadyTasks, currentMysqlMap);
    hierarchyAdjustments.push(...hierarchyExpandAdjustments);

    const { linkAdjustments: dhtmlxAdjustments, afterTasks } = runLinkScheduling({
        tasksGantt: ganttReadyTasks,
        links: linksInScope,
        config,
        triggeredTaskId,
    });

    const afterMap = new Map();
    afterTasks.forEach(t => {
        afterMap.set(t.id, {
            start_at: toMysqlDate(t.start_date),
            due_at: toMysqlDate(t.end_date),
        });
    });

    const afterGanttArray = afterTasks.map(t => ({
        id: t.id,
        parent_id: tasksInScope.find(orig => orig.id === t.id)?.parent_id ?? 0,
        name: '',
        start_date: t.start_date,
        end_date: t.end_date,
    }));

    const postLinkExpandAdjustments = enforceHierarchyExpand(afterGanttArray, afterMap);

    const linkAdjustments = [
        ...dhtmlxAdjustments,
        ...postLinkExpandAdjustments,
    ].reduce((acc, adj) => {
        acc.set(adj.id, adj);
        return acc;
    }, new Map());

    return {
        hierarchyAdjustments,
        linkAdjustments: [...linkAdjustments.values()],
        afterGanttArray,
    };
};

// ────────────────────────────────────────────────
// HIERARCHY TREE RESOLVER (unchanged)
// ────────────────────────────────────────────────

const getHierarchyTree = (taskId, allTasks) => {
    const taskMap = new Map(allTasks.map(t => [t.id, t]));

    let rootId = taskId;
    let current = taskMap.get(taskId);
    const visited = new Set();

    while (current && current.parent_id && current.parent_id !== 0) {
        if (visited.has(current.id)) {
            logger.warn(`getHierarchyTree: circular parent reference at ${current.id}`);
            break;
        }
        visited.add(current.id);
        const parent = taskMap.get(current.parent_id);
        if (!parent) break;
        rootId = parent.id;
        current = parent;
    }

    const ids = new Set();
    const collect = (id) => {
        ids.add(id);
        allTasks.filter(t => t.parent_id === id).forEach(t => collect(t.id));
    };
    collect(rootId);
    return { rootId, ids };
};

// ────────────────────────────────────────────────
// MAIN RECALCULATE IMPACT
// ────────────────────────────────────────────────

export const recalculateImpact = async ({
    workspace_id,
    project_id,
    task_id,
    taskUpdates
}) => {
    // 1. Resolve project ID
    let finalProjectId = project_id;
    if (!finalProjectId && task_id) {
        const [row] = await query(
            `SELECT project_id FROM ph_project_tasks
             WHERE workspace_id = ? AND task_id = ? LIMIT 1`,
            [workspace_id, task_id]
        );
        if (!row) throw new Error(`Task ${task_id} not found in any project`);
        finalProjectId = row.project_id;
    }
    if (!finalProjectId) {
        throw new Error('project_id is required when task_id is not provided');
    }

    // 2. Fetch project config
    const [project] = await query(
        `SELECT auto_schedule_tasks,
                auto_schedule_tasks_gap,
                move_subtasks_with_parent,
                restrict_tasks_to_working_days,
                start_date AS project_start,
                due_date   AS project_end
         FROM ph_projects
         WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL`,
        [workspace_id, finalProjectId]
    );
    if (!project) throw new Error(`Project ${finalProjectId} not found`);

    if (!project.auto_schedule_tasks) {
        return {
            hierarchyAdjustments: [],
            linkAdjustments: [],
            impactedTaskIds: [],
            project: null,
        };
    }

    // 3. Fetch workspace weekend
    const [workspace] = await query(
        `SELECT weekend FROM ph_workspaces WHERE id = ? LIMIT 1`,
        [workspace_id]
    );
    const workDays = parseWorkDays(workspace?.weekend);

    // 4. Fetch ALL project tasks recursively
    const projectTaskIds = await fetchProjectTaskIds(workspace_id, finalProjectId);
    let allTasks = [];
    if (projectTaskIds.length > 0) {
        const placeholders = projectTaskIds.map(() => '?').join(',');
        allTasks = await query(
            `SELECT id, name, start_at, due_at, parent_id,
                    constraint_type, constraint_date
             FROM ph_tasks
             WHERE id IN (${placeholders})
               AND workspace_id = ?
               AND deleted_at IS NULL AND deleted_ancestor_id IS NULL
               AND start_at IS NOT NULL AND due_at IS NOT NULL
             ORDER BY id`,
            [...projectTaskIds, workspace_id]
        );
    }

    // 5. Override triggered task's dates if provided
    if (taskUpdates && taskUpdates.start_at && taskUpdates.due_at && task_id) {
        const task = allTasks.find(t => t.id === task_id);
        if (task) {
            task.start_at = taskUpdates.start_at;
            task.due_at = taskUpdates.due_at;
        }
    }

    // 6. Fetch all links
    const allLinks = await query(
        `SELECT id, source_task_id, target_task_id, \`type\`
         FROM ph_task_links
         WHERE workspace_id = ? AND project_id = ?`,
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
    };

    let allHierarchyAdjustments = [];
    let allLinkAdjustments = [];
    let allAfterGanttArrays = [];

    if (task_id) {
        const { rootId, ids: hierarchyIds } = getHierarchyTree(task_id, allTasks);
        const tasksInScope = allTasks.filter(t => hierarchyIds.has(t.id));
        const linksInScope = allLinks.filter(
            l => hierarchyIds.has(l.source_task_id) && hierarchyIds.has(l.target_task_id)
        );

        const { hierarchyAdjustments, linkAdjustments, afterGanttArray } = recalculateScope({
            tasksInScope,
            linksInScope,
            config,
            triggeredTaskId: task_id,
        });

        allHierarchyAdjustments = hierarchyAdjustments;
        allLinkAdjustments = linkAdjustments;
        allAfterGanttArrays = afterGanttArray;

        // For project range, include all tasks (not just this hierarchy)
        // We'll use the full allTasks for range calculation below.
    } else {
        const allTaskIdsSet = new Set(allTasks.map(t => t.id));
        const rootTasks = allTasks.filter(
            t => !t.parent_id || t.parent_id === 0 || !allTaskIdsSet.has(t.parent_id)
        );

        for (const root of rootTasks) {
            const { ids: hierarchyIds } = getHierarchyTree(root.id, allTasks);
            const tasksInScope = allTasks.filter(t => hierarchyIds.has(t.id));
            const linksInScope = allLinks.filter(
                l => hierarchyIds.has(l.source_task_id) && hierarchyIds.has(l.target_task_id)
            );

            const { hierarchyAdjustments, linkAdjustments, afterGanttArray } = recalculateScope({
                tasksInScope,
                linksInScope,
                config,
                triggeredTaskId: null,
            });

            allHierarchyAdjustments.push(...hierarchyAdjustments);
            allLinkAdjustments.push(...linkAdjustments);
            allAfterGanttArrays.push(...afterGanttArray);
        }
    }

    // Phase 3: Project date range (use ALL project tasks, not just processed ones)
    const allGanttTasks = allTasks.map(t => ({
        ...t,
        start_date: toGanttDate(t.start_at),
        end_date: toGanttDate(t.due_at),
    }));
    // Override with processed dates where available
    for (const adj of [...allHierarchyAdjustments, ...allLinkAdjustments]) {
        const ganttTask = allGanttTasks.find(t => t.id === adj.id);
        if (ganttTask) {
            ganttTask.start_date = toGanttDate(adj.start_at);
            ganttTask.end_date = toGanttDate(adj.due_at);
        }
    }

    const projectRange = allGanttTasks.reduce(
        (acc, t) => {
            const startComp = toComparable(t.start_date);
            const endComp = toComparable(t.end_date);
            if (startComp && (!acc.minComp || startComp < acc.minComp)) {
                acc.minGantt = t.start_date;
                acc.minComp = startComp;
            }
            if (endComp && (!acc.maxComp || endComp > acc.maxComp)) {
                acc.maxGantt = t.end_date;
                acc.maxComp = endComp;
            }
            return acc;
        },
        { minGantt: null, minComp: null, maxGantt: null, maxComp: null }
    );

    let projectResponse = null;
    if (projectRange.minGantt && projectRange.maxGantt) {
        const newStart = toMysqlDate(projectRange.minGantt);
        const newEnd = toMysqlDate(projectRange.maxGantt);
        const origStart = toComparable(toGanttDate(project.project_start));
        const origEnd = toComparable(toGanttDate(project.project_end));

        if (projectRange.minComp < origStart || projectRange.maxComp > origEnd) {
            projectResponse = { start_at: newStart, due_at: newEnd };
        }
    }

    const dedup = (arr) => [...arr.reduce((m, a) => m.set(a.id, a), new Map()).values()];
    const finalHierarchyAdjustments = dedup(allHierarchyAdjustments);
    const finalLinkAdjustments = dedup(allLinkAdjustments);

    const allImpactedIds = [
        ...new Set([
            ...finalHierarchyAdjustments.map(a => a.id),
            ...finalLinkAdjustments.map(a => a.id),
        ])
    ];

    return {
        hierarchyAdjustments: finalHierarchyAdjustments,
        linkAdjustments: finalLinkAdjustments,
        impactedTaskIds: allImpactedIds,
        project: projectResponse,
    };
};

// ────────────────────────────────────────────────
// GET PROJECT DATA (for frontend loading)
// ────────────────────────────────────────────────

export const getProjectData = async ({ workspace_id, project_id }) => {
    const [project] = await query(
        `SELECT id, name, start_date, due_date,
                auto_schedule_tasks,
                auto_schedule_tasks_gap,
                move_subtasks_with_parent,
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
    const workDays = parseWorkDays(workspace?.weekend);

    // Use the same recursive fetch for frontend loading
    const projectTaskIds = await fetchProjectTaskIds(workspace_id, project_id);
    let tasks = [];
    if (projectTaskIds.length > 0) {
        const placeholders = projectTaskIds.map(() => '?').join(',');
        tasks = await query(
            `SELECT id, name, start_at, due_at, parent_id,
                    constraint_type, constraint_date
             FROM ph_tasks
             WHERE id IN (${placeholders})
               AND workspace_id = ?
               AND deleted_at IS NULL AND deleted_ancestor_id IS NULL
               AND start_at IS NOT NULL AND due_at IS NOT NULL
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