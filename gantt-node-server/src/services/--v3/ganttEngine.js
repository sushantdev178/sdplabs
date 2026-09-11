// src/services/v3/ganttEngine.js
//
// v3 — whole-day approach.
//
// CHANGES THIS PASS:
//   1. Project no longer acts as a date container. Project's own
//      start_date/due_date are no longer fetched, tracked, or returned —
//      project dates are independent of task/gantt calculation entirely.
//   2. Tasks can now be linked to their own sub-tasks, and tasks within
//      the same hierarchy can be linked to each other. hasHierarchyLink
//      validation is REMOVED for v3 (v1/v2 keep it unchanged).
//   3. Circular-link protection (hasCircularLink) is UNCHANGED — still
//      enforced regardless of hierarchy relationship.

import { query } from '../../utils/db.js';
import { toDateOnly, anyToMysql } from '../../utils/dateHelper.js';
import { hasCircularLink } from '../../validators/ganttValidator.js';
import { runScheduling } from './dhtmlxScheduler.js';
import { IMPACT_TASKS_LIMIT } from '../../config/constants.js';

// ── DATABASE FETCHING ──

const fetchProjectTaskIds = async (workspace_id, project_id) => {
    const rootRows = await query(
        `SELECT pt.task_id FROM ph_project_tasks pt
         JOIN ph_tasks t ON t.id = pt.task_id
         WHERE pt.workspace_id = ? AND pt.project_id = ?
           AND t.deleted_at IS NULL AND t.deleted_ancestor_id IS NULL
           AND t.start_at IS NOT NULL AND t.due_at IS NOT NULL`,
        [workspace_id, project_id]
    );

    const allIds = new Set(rootRows.map(r => Number(r.task_id)));
    if (!allIds.size) return [];

    let currentLevel = [...allIds];
    let depth = 0;
    while (currentLevel.length && depth < 50) {
        const placeholders = currentLevel.map(() => '?').join(',');
        const childRows = await query(
            `SELECT id FROM ph_tasks
             WHERE workspace_id = ? AND parent_id IN (${placeholders})
               AND deleted_at IS NULL AND deleted_ancestor_id IS NULL
               AND start_at IS NOT NULL AND due_at IS NOT NULL`,
            [workspace_id, ...currentLevel]
        );
        currentLevel = childRows.map(r => Number(r.id)).filter(id => !allIds.has(id));
        currentLevel.forEach(id => allIds.add(id));
        depth++;
    }
    return [...allIds];
};

const fetchContext = async (workspace_id, project_id) => {
    // start_date/due_date restored — the project's own stored dates are
    // still sent as-is. What was removed is the task-derived min/max
    // computation (calculatedProjectBounds) that used to live in
    // dhtmlxScheduler.js — that recalculated a "container" range from
    // task positions, which is no longer wanted. This is the project's
    // real, stored value, untouched by gantt calculation.
    const [project] = await query(
        `SELECT id, workspace_id, name, start_date, due_date,
                auto_schedule_tasks, auto_schedule_tasks_gap,
                move_subtasks_with_parent,
                weekend
        FROM ph_projects
        WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
        [project_id, workspace_id]
    );
    if (!project) throw new Error(`Project ${project_id} not found`);

    project.start_date = toDateOnly(project.start_date);
    project.due_date = toDateOnly(project.due_date);

    // weekend lives on ph_projects (JSON, ISO day numbers 1=Mon...7=Sun).
    // NULL/empty means no weekend configured — all days are working days.
    // Same DB_TO_JS_DAY mapping and null-handling as
    // taskUtilityEngine.js's fetchCalendarContext — must stay identical.
    const DB_TO_JS_DAY = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 };

    let weekendIso = project.weekend;
    if (weekendIso === null || weekendIso === undefined) {
        weekendIso = [];
    } else if (typeof weekendIso === 'string') {
        try { weekendIso = JSON.parse(weekendIso); } catch { weekendIso = []; }
    }
    // The stored JSON is shaped {"weekend": [1, 7]}, not a bare array —
    // unwrap the nested key if present.
    if (weekendIso && !Array.isArray(weekendIso) && Array.isArray(weekendIso.weekend)) {
        weekendIso = weekendIso.weekend;
    }
    weekendIso = Array.isArray(weekendIso) ? weekendIso : [];

    const weekendJs = weekendIso
        .map(d => DB_TO_JS_DAY[Number(d)])
        .filter(d => d !== undefined);
    const workDays = [0, 1, 2, 3, 4, 5, 6].filter(d => !weekendJs.includes(d));

    const holidayRows = await query(
        `SELECT date FROM ph_off_days WHERE workspace_id = ?`,
        [workspace_id]
    );
    const holidays = holidayRows.map(r => toDateOnly(r.date));

    const projectTaskIds = await fetchProjectTaskIds(workspace_id, project_id);
    let allTasks = [];
    if (projectTaskIds.length) {
        const placeholders = projectTaskIds.map(() => '?').join(',');
        allTasks = await query(
            `SELECT id, name, start_at, due_at, parent_id, progress,
                    constraint_type, constraint_date, time_used
             FROM ph_tasks
             WHERE id IN (${placeholders})
               AND workspace_id = ? AND deleted_at IS NULL AND deleted_ancestor_id IS NULL
               AND start_at IS NOT NULL AND due_at IS NOT NULL`,
            [...projectTaskIds, workspace_id]
        );
    }

    const allLinks = await query(
        `SELECT tl.id, tl.source_task_id, tl.target_task_id, tl.type
         FROM ph_task_links tl
         JOIN ph_tasks ts ON ts.id = tl.source_task_id
             AND ts.deleted_at IS NULL
             AND ts.deleted_ancestor_id IS NULL
             AND ts.start_at IS NOT NULL
             AND ts.due_at IS NOT NULL
         JOIN ph_tasks tt ON tt.id = tl.target_task_id
             AND tt.deleted_at IS NULL
             AND tt.deleted_ancestor_id IS NULL
             AND tt.start_at IS NOT NULL
             AND tt.due_at IS NOT NULL
         WHERE tl.workspace_id = ? AND tl.project_id = ?`,
        [workspace_id, project_id]
    );

    return { project, workDays, holidays, allTasks, allLinks };
};

// ─────────────────────────────────────────────────────────────
// SERVICE EXPORTS
// ─────────────────────────────────────────────────────────────

// 1. Calculate Full Impact (For Laravel DB updates)
export const recalculateImpact = async ({ workspace_id, project_id, task_id, start_at, due_at, operation, link_id, link, new_type }) => {
    const context = await fetchContext(Number(workspace_id), Number(project_id));
    const triggeredDates = (task_id && start_at && due_at) ? { start_at, due_at } : null;

    return runScheduling({
        context,
        task_id: task_id ? Number(task_id) : null,
        triggeredDates,
        operation: operation || null,
        link_id: link_id ? Number(link_id) : null,
        link: link || null,
        new_type: new_type || null
    });
};

// 2. Calculate Preview Impact (Max N tasks)
export const calculateImpactPreview = async ({ workspace_id, project_id, task_id, start_at, due_at, operation, link_id, link, new_type }) => {
    const result = await recalculateImpact({ workspace_id, project_id, task_id, start_at, due_at, operation, link_id, link, new_type });

    if (!result.success) return result;

    const impactedTasks = [];
    if (result.data.triggeredTask) impactedTasks.push(result.data.triggeredTask);
    if (result.data.tasks?.length) impactedTasks.push(...result.data.tasks);

    const uniqueImpacted = Array.from(
        new Map(impactedTasks.map(t => [t.id, t])).values()
    );

    const mappedImpact = uniqueImpacted.map(t => ({
        id: String(t.id),
        title: t.name,
        start_at: t.start_at,
        due_at: t.due_at
    }));

    return {
        success: true,
        data: {
            impacted_tasks_count: mappedImpact.length,
            impact_tasks: mappedImpact.slice(0, IMPACT_TASKS_LIMIT)
        }
    };
};

// 3. Standalone Link Validation (For Laravel pre-checks)
// hasHierarchyLink check REMOVED for v3 — tasks can now be linked to their
// own sub-tasks, and tasks within the same hierarchy can be linked to each
// other. hasCircularLink protection is unchanged and still enforced.
export const validateStandaloneLink = async ({ workspace_id, project_id, type, link }) => {
    const context = await fetchContext(Number(workspace_id), Number(project_id));
    const { allTasks, allLinks } = context;

    if (type === 'add_link') {
        const proposedLink = {
            source_task_id: Number(link.source),
            target_task_id: Number(link.target)
        };

        if (hasCircularLink(allTasks, [...allLinks, proposedLink])) {
            return { success: false, reason: 'circular_link' };
        }

        return { success: true };
    }
    throw new Error('Unknown validation type');
};

// 4. Get Project Data (For Frontend GUI)
// NOTE: project.start_date/due_date REMOVED from the response — project no
// longer acts as a date container in v3, and its own stored dates are
// never fetched by this service (see fetchContext). If the GUI still needs
// to display the project's own dates, they must come from a different,
// non-Gantt endpoint.
export const getProjectData = async ({ workspace_id, project_id }) => {
    const context = await fetchContext(Number(workspace_id), Number(project_id));
    const { project, workDays, holidays, allTasks, allLinks } = context;

    return {
        project: {
            id: project.id,
            name: project.name,
            auto_schedule_tasks: !!project.auto_schedule_tasks,
            auto_schedule_tasks_gap: project.auto_schedule_tasks_gap || 'keep',
            move_subtasks_with_parent: !!project.move_subtasks_with_parent,
            start_date: project.start_date,
            due_date: project.due_date
        },
        workspace: { work_days: workDays, holidays },
        tasks: allTasks.map(t => ({
            id: t.id,
            text: t.name,
            start_date: anyToMysql(t.start_at) ?? t.start_at,
            end_date: anyToMysql(t.due_at) ?? t.due_at,
            parent: t.parent_id || 0,
            time_used: !!t.time_used,
            constraint_type: t.constraint_type || 'asap',
            constraint_date: t.constraint_date ? (anyToMysql(t.constraint_date) ?? toDateOnly(t.constraint_date)) : null
        })),
        links: allLinks.map(l => ({
            id: l.id,
            source: l.source_task_id,
            target: l.target_task_id,
            type: l.type
        }))
    };
};