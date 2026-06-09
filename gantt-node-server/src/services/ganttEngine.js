// src/services/ganttEngine.js
import { query } from '../utils/db.js';
import { toGanttDate, toMysqlDate, toComparable, parseWorkDays } from '../utils/dateHelper.js';
import { runLinkScheduling, detectCircularLinks } from './dhtmlxScheduler.js';
import { GANTT_DURATION_UNIT } from '../config/constants.js';

// ─────────────────────────────────────────────────────────────
// DB HELPERS
// ─────────────────────────────────────────────────────────────

async function fetchWorkspaceHolidays(workspace_id) {
    try {
        const rows = await query(
            `SELECT date FROM ph_off_days 
             WHERE workspace_id = ? AND type IN ('holidays', 'others')`,
            [workspace_id]
        );
        return rows.map(r => (r.date instanceof Date ? r.date.toISOString() : String(r.date)).slice(0, 10));
    } catch (error) {
        console.error('Error fetching holidays:', error);
        return [];
    }
}

// Deep tree traversal — collects all task IDs in the project including nested subtasks
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

        while (currentLevel.length > 0 && depth < 50) {
            const childRows = await query(
                `SELECT id FROM ph_tasks 
                 WHERE workspace_id = ? AND parent_id IN (${currentLevel.map(() => '?').join(',')})
                   AND deleted_at IS NULL AND deleted_ancestor_id IS NULL
                   AND start_at IS NOT NULL AND due_at IS NOT NULL`,
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

// ─────────────────────────────────────────────────────────────
// PROJECT RANGE CALCULATION
// ─────────────────────────────────────────────────────────────

const calculateProjectRange = (allTasks, allAdjustments, project) => {
    // Apply adjustments on top of current task dates
    const taskMap = new Map(allTasks.map(t => [t.id, { ...t }]));
    allAdjustments.forEach(adj => {
        const t = taskMap.get(adj.id);
        if (t) { t.start_at = adj.start_at; t.due_at = adj.due_at; }
    });

    const range = Array.from(taskMap.values()).reduce((acc, t) => {
        const s = toComparable(toGanttDate(t.start_at));
        const e = toComparable(toGanttDate(t.due_at));
        if (s && (!acc.min || s < acc.min)) { acc.min = s; acc.minMysql = t.start_at; }
        if (e && (!acc.max || e > acc.max)) { acc.max = e; acc.maxMysql = t.due_at; }
        return acc;
    }, { min: null, max: null, minMysql: null, maxMysql: null });

    if (!range.minMysql || !range.maxMysql) return null;

    // No project dates set — use task range as project range
    if (!project.project_start || !project.project_end) {
        return { start_at: range.minMysql, due_at: range.maxMysql, isNewProjectRange: true };
    }

    const projectStart = toComparable(toGanttDate(project.project_start));
    const projectEnd = toComparable(toGanttDate(project.project_end));
    let newStart = project.project_start;
    let newEnd = project.project_end;
    let needsUpdate = false;

    if (range.min < projectStart) { newStart = range.minMysql; needsUpdate = true; }
    if (range.max > projectEnd) { newEnd = range.maxMysql; needsUpdate = true; }

    return needsUpdate ? { start_at: newStart, due_at: newEnd, isExtension: true } : null;
};

// ─────────────────────────────────────────────────────────────
// SAME-HIERARCHY LINK VALIDATION
// Tasks can only link to siblings (same parent), never within the same hierarchy chain.
// ─────────────────────────────────────────────────────────────

const validateLinks = (tasks, links) => {
    const parentOf = new Map(tasks.map(t => [t.id, t.parent_id ?? t.parent ?? 0]));

    const isAncestorOf = (ancestorId, taskId) => {
        let current = taskId;
        const seen = new Set();
        while (current && current !== 0) {
            if (seen.has(current)) break; // cycle guard
            seen.add(current);
            const p = parentOf.get(current);
            if (p === ancestorId) return true;
            current = p;
        }
        return false;
    };

    for (const link of links) {
        const src = link.source_task_id ?? link.source;
        const tgt = link.target_task_id ?? link.target;
        if (isAncestorOf(src, tgt) || isAncestorOf(tgt, src)) {
            return { valid: false, reason: `Link ${link.id}: tasks ${src} and ${tgt} are in the same hierarchy` };
        }
    }
    return { valid: true };
};

// ─────────────────────────────────────────────────────────────
// CORE SCHEDULING WRAPPER
// Passes all tasks + links to DHTMLX in one shot — mirrors frontend renderGantt() exactly.
// DHTMLX with auto_types:false treats every task as type:'task'.
// Parent sizing comes from actual DB dates, same as frontend.
// ─────────────────────────────────────────────────────────────

const recalculateScope = ({ tasksInScope, linksInScope, config, triggeredTaskId, dbOriginalDates }) => {
    // Validate: no same-hierarchy links
    const linkCheck = validateLinks(tasksInScope, linksInScope);
    if (!linkCheck.valid) {
        console.warn('Same-hierarchy link blocked:', linkCheck.reason);
        return { linkAdjustments: [], constraintUpdates: new Map() };
    }

    // Validate: no circular links
    if (detectCircularLinks(tasksInScope, linksInScope)) {
        console.warn('Circular link detected — scheduling skipped');
        return { linkAdjustments: [], constraintUpdates: new Map() };
    }

    try {
        const result = runLinkScheduling({
            tasksGantt: tasksInScope,
            links: linksInScope,
            config,
            triggeredTaskId
        });

        // Diff DHTMLX output against original DB dates
        // Compare at minute precision — DHTMLX may zero seconds during scheduling
        const toMin = (s) => s ? String(s).slice(0, 16) : null;

        const linkAdjustments = result.linkAdjustments.filter(adj => {
            const orig = dbOriginalDates.get(adj.id);
            return orig && (toMin(orig.start_at) !== toMin(adj.start_at) || toMin(orig.due_at) !== toMin(adj.due_at));
        });

        return { linkAdjustments, constraintUpdates: result.constraintUpdates };
    } catch (error) {
        console.error('DHTMLX scheduling error:', error);
        return { linkAdjustments: [], constraintUpdates: new Map() };
    }
};

// ─────────────────────────────────────────────────────────────
// MAIN DRIVER
// ─────────────────────────────────────────────────────────────

export const recalculateImpact = async ({ workspace_id, project_id, task_id, taskUpdates }) => {
    try {
        // Resolve project_id if not provided
        let finalProjectId = project_id;
        if (!finalProjectId && task_id) {
            let currentTaskId = task_id;
            for (let steps = 0; steps < 50; steps++) {
                const [row] = await query(
                    `SELECT parent_id FROM ph_tasks WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL LIMIT 1`,
                    [currentTaskId, workspace_id]
                );
                if (!row) break;
                if (!row.parent_id || row.parent_id === 0) { finalProjectId = currentTaskId; break; }
                currentTaskId = row.parent_id;
            }
        }

        if (!finalProjectId) throw new Error('Could not determine project ID');

        // Fetch project config
        const [project] = await query(
            `SELECT id, name, start_date AS project_start, due_date AS project_end,
                    auto_schedule_tasks, auto_schedule_tasks_gap,
                    move_subtasks_with_parent, restrict_tasks_to_working_days
             FROM ph_projects WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL`,
            [workspace_id, finalProjectId]
        );

        if (!project) throw new Error('Project not found');

        // Auto-scheduling disabled — return current state, no calculations
        if (!project.auto_schedule_tasks) {
            return {
                success: true,
                message: "Auto-scheduling is disabled for this project",
                data: {
                    triggeredTask: null,
                    linkAdjustments: [],
                    impactedTaskIds: [],
                    project: null,
                    constraintUpdates: []
                }
            };
        }

        // Fetch workspace
        const [workspace] = await query(
            `SELECT weekend FROM ph_workspaces WHERE id = ? LIMIT 1`,
            [workspace_id]
        );

        // Fetch all task IDs in project
        const projectTaskIds = await fetchProjectTaskIds(workspace_id, finalProjectId);

        if (!projectTaskIds.length) {
            return {
                success: true,
                message: "No tasks found in project",
                data: { triggeredTask: null, linkAdjustments: [], impactedTaskIds: [], project: null, constraintUpdates: [] }
            };
        }

        // Fetch all tasks
        const allTasks = await query(
            `SELECT id, name, start_at, due_at, parent_id, constraint_type, constraint_date
             FROM ph_tasks
             WHERE id IN (${projectTaskIds.map(() => '?').join(',')})
               AND workspace_id = ? AND deleted_at IS NULL AND deleted_ancestor_id IS NULL
               AND start_at IS NOT NULL AND due_at IS NOT NULL`,
            [...projectTaskIds, workspace_id]
        );

        // Snapshot original DB dates
        const dbOriginalDates = new Map(allTasks.map(t => [t.id, { start_at: t.start_at, due_at: t.due_at }]));

        // Apply incoming task date update before scheduling
        if (task_id && taskUpdates?.start_at && taskUpdates?.due_at) {
            const t = allTasks.find(x => x.id === task_id);
            if (t) { t.start_at = taskUpdates.start_at; t.due_at = taskUpdates.due_at; }
        }

        // Fetch links
        const allLinks = await query(
            `SELECT id, source_task_id, target_task_id, \`type\`
             FROM ph_task_links WHERE workspace_id = ? AND project_id = ?`,
            [workspace_id, finalProjectId]
        );

        // Fetch holidays
        const holidays = await fetchWorkspaceHolidays(workspace_id);

        // Build config — all driven by DB flags, no static values
        const config = {
            work_days: parseWorkDays(workspace?.weekend),
            holidays,
            duration_unit: GANTT_DURATION_UNIT,
            gap_mode: project.auto_schedule_tasks_gap || 'keep',
            move_subtasks_with_parent: !!project.move_subtasks_with_parent,
            restrict_to_working_days: !!project.restrict_tasks_to_working_days
        };

        // Run scheduling:
        // - task_id + dates provided → triggered task update, autoSchedule(taskId)
        // - nothing provided        → full project recalc, autoSchedule()
        const triggeredTaskId = (task_id && taskUpdates?.start_at && taskUpdates?.due_at) ? task_id : null;

        const { linkAdjustments, constraintUpdates } = recalculateScope({
            tasksInScope: allTasks,
            linksInScope: allLinks,
            config,
            triggeredTaskId,
            dbOriginalDates
        });

        // Dedup by id (last write wins)
        const dedup = (arr) => [...arr.reduce((m, a) => m.set(a.id, a), new Map()).values()];
        const finalAdjustments = dedup(linkAdjustments);

        // Enrich adjustments with constraint data
        const enrich = (adj) => {
            const dc = constraintUpdates.get(adj.id);
            const orig = allTasks.find(x => x.id === adj.id);
            return {
                ...adj,
                constraint_type: dc?.constraint_type ?? orig?.constraint_type ?? null,
                constraint_date: dc?.constraint_date ?? orig?.constraint_date ?? null
            };
        };

        const projectRange = calculateProjectRange(allTasks, finalAdjustments, project);
        const triggeredTaskFinal = task_id ? allTasks.find(t => t.id === task_id) : null;

        return {
            success: true,
            message: "Impact recalculation complete",
            data: {
                triggeredTask: triggeredTaskFinal ? {
                    id: task_id,
                    start_at: triggeredTaskFinal.start_at,
                    due_at: triggeredTaskFinal.due_at,
                    constraint_type: constraintUpdates.get(task_id)?.constraint_type ?? triggeredTaskFinal.constraint_type ?? null,
                    constraint_date: constraintUpdates.get(task_id)?.constraint_date ?? triggeredTaskFinal.constraint_date ?? null
                } : null,
                linkAdjustments: finalAdjustments.map(enrich),
                impactedTaskIds: [...new Set([...(task_id ? [task_id] : []), ...finalAdjustments.map(a => a.id)])],
                project: projectRange,
                constraintUpdates: [...constraintUpdates.entries()].map(([id, c]) => ({ id, ...c }))
            }
        };

    } catch (error) {
        console.error('Recalculate Impact Error:', error);
        throw error;
    }
};

// ─────────────────────────────────────────────────────────────
// FRONTEND DATA ENDPOINT
// Returns project + workspace config + tasks + links for frontend renderGantt()
// ─────────────────────────────────────────────────────────────

export const getProjectData = async ({ workspace_id, project_id }) => {
    try {
        const [project] = await query(
            `SELECT id, name, start_date, due_date, auto_schedule_tasks,
                    auto_schedule_tasks_gap, move_subtasks_with_parent,
                    restrict_tasks_to_working_days
             FROM ph_projects WHERE workspace_id = ? AND id = ? AND deleted_at IS NULL`,
            [workspace_id, project_id]
        );

        if (!project) throw new Error('Project not found');

        const [workspace] = await query(
            `SELECT weekend FROM ph_workspaces WHERE id = ? LIMIT 1`,
            [workspace_id]
        );

        const holidays = await fetchWorkspaceHolidays(workspace_id);
        const projectTaskIds = await fetchProjectTaskIds(workspace_id, project_id);

        let tasks = [];
        if (projectTaskIds.length > 0) {
            tasks = await query(
                `SELECT id, name, start_at, due_at, parent_id, constraint_type, constraint_date
                 FROM ph_tasks
                 WHERE id IN (${projectTaskIds.map(() => '?').join(',')})
                   AND workspace_id = ? AND deleted_at IS NULL AND deleted_ancestor_id IS NULL
                   AND start_at IS NOT NULL AND due_at IS NOT NULL
                 ORDER BY id`,
                [...projectTaskIds, workspace_id]
            );
        }

        const links = await query(
            `SELECT id, source_task_id, target_task_id, type
             FROM ph_task_links WHERE workspace_id = ? AND project_id = ?`,
            [workspace_id, project_id]
        );

        // Project date fallback from task range
        let projectStart = project.start_date;
        let projectEnd = project.due_date;
        if ((!projectStart || !projectEnd) && tasks.length > 0) {
            const starts = tasks.map(t => t.start_at).sort();
            const ends = tasks.map(t => t.due_at).sort();
            projectStart = projectStart || starts[0];
            projectEnd = projectEnd || ends[ends.length - 1];
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
                holidays
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