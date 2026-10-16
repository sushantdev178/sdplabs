// src/services/v5/ganttEngine.js
//
// v5 — same as v4, plus duration + duration_unit are read from ph_tasks
//      and returned on every task in getProjectData.
//
// Working days: ph_project_working_days, fallback to ph_configurations.working_days.
// my_tasks projects are rejected.

import { query } from '../../utils/db.js';
import { toDateOnly, anyToMysql } from '../../utils/dateHelper.js';
import { hasCircularLink } from '../../validators/ganttValidator.js';
import { runScheduling } from './dhtmlxScheduler.js';
import { IMPACT_TASKS_LIMIT } from '../../config/constants.js';

const DEFAULT_WORKING_DAY_NUMBERS = [2, 3, 4, 5, 6]; // Mon–Fri (1=Sun…7=Sat)

const DAY_NAMES = {
    1: 'Sunday',
    2: 'Monday',
    3: 'Tuesday',
    4: 'Wednesday',
    5: 'Thursday',
    6: 'Friday',
    7: 'Saturday',
};

// ── WORKING DAYS — RAW ROWS ───────────────────────────────────────────

const fetchWorkingDaysRows = async (workspace_id, project_id) => {
    const rows = await query(
        `SELECT day_of_week, start_time, end_time
         FROM ph_project_working_days
         WHERE workspace_id = ? AND project_id = ?
         ORDER BY day_of_week`,
        [workspace_id, project_id]
    );

    if (rows.length > 0) return rows;

    const [configRow] = await query(
        `SELECT configuration FROM ph_configurations WHERE name = 'working_days' LIMIT 1`
    );

    let defaultRows = [];
    if (configRow && configRow.configuration) {
        try {
            const parsed = typeof configRow.configuration === 'string'
                ? JSON.parse(configRow.configuration)
                : configRow.configuration;
            if (Array.isArray(parsed)) {
                defaultRows = parsed
                    .map(r => Number(r.day_of_week))
                    .filter(d => Number.isInteger(d) && d >= 1 && d <= 7)
                    .map(d => ({ day_of_week: d, start_time: null, end_time: null }));
            }
        } catch {
            defaultRows = [];
        }
    }

    if (defaultRows.length === 0) {
        defaultRows = DEFAULT_WORKING_DAY_NUMBERS.map(d => ({
            day_of_week: d,
            start_time: null,
            end_time: null,
        }));
    }

    return defaultRows;
};

// ── WORKING DAYS — SCHEDULER CONFIG (7 slots) ─────────────────────────

const buildWorkingDaysConfig = (rows, useWorkingTime) => {
    const config = new Array(7).fill(null);

    for (const row of rows) {
        const dbDay = Number(row.day_of_week);
        if (!Number.isInteger(dbDay) || dbDay < 1 || dbDay > 7) continue;

        const jsDay = dbDay - 1;

        if (!useWorkingTime) {
            config[jsDay] = { start: '00:00', end: '24:00' };
            continue;
        }

        const start = row.start_time;
        const end = row.end_time;

        if (start === null && end === null) {
            config[jsDay] = { start: '00:00', end: '24:00' };
            continue;
        }

        if (start === null || end === null) {
            config[jsDay] = null;
            continue;
        }

        const s = String(start).slice(0, 5);
        const e = String(end).slice(0, 5);
        config[jsDay] = { start: s, end: e };
    }

    return config;
};

// ── WORKING DAYS — API VIEW ───────────────────────────────────────────

const buildRawWorkingDaysPayload = (rows) => {
    return rows
        .map(r => {
            const dbDay = Number(r.day_of_week);
            if (!Number.isInteger(dbDay) || dbDay < 1 || dbDay > 7) return null;
            return {
                day_of_week: dbDay,
                name: DAY_NAMES[dbDay],
                start_time: r.start_time ? String(r.start_time).slice(0, 5) : null,
                end_time: r.end_time ? String(r.end_time).slice(0, 5) : null,
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.day_of_week - b.day_of_week);
};

// ── DATABASE FETCHING ─────────────────────────────────────────────────

const fetchProjectTaskIds = async (workspace_id, project_id) => {
    const rootRows = await query(
        `SELECT pt.task_id FROM ph_project_tasks pt
         JOIN ph_tasks t ON t.id = pt.task_id
         WHERE pt.workspace_id = ? AND pt.project_id = ?
           AND t.deleted_at IS NULL AND t.deleted_ancestor_id IS NULL
           AND t.due_at IS NOT NULL`,
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
               AND due_at IS NOT NULL`,
            [workspace_id, ...currentLevel]
        );
        currentLevel = childRows.map(r => Number(r.id)).filter(id => !allIds.has(id));
        currentLevel.forEach(id => allIds.add(id));
        depth++;
    }
    return [...allIds];
};

const fetchContext = async (workspace_id, project_id) => {
    const [project] = await query(
        `SELECT id, workspace_id, name, type, start_date, due_date,
                auto_schedule_tasks, auto_schedule_tasks_gap,
                move_subtasks_with_parent,
                use_working_time
        FROM ph_projects
        WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
        [project_id, workspace_id]
    );
    if (!project) throw new Error(`Project ${project_id} not found`);

    project.start_date = toDateOnly(project.start_date);
    project.due_date = toDateOnly(project.due_date);
    project.use_working_time = !!project.use_working_time;

    const workingDaysRows = await fetchWorkingDaysRows(workspace_id, project_id);

    const workingDaysConfig = buildWorkingDaysConfig(
        workingDaysRows,
        project.use_working_time
    );

    const holidayRows = await query(
        `SELECT date FROM ph_off_days
         WHERE workspace_id = ?
           AND (project_id IS NULL OR project_id = ?)`,
        [workspace_id, project_id]
    );
    const holidays = holidayRows.map(r => toDateOnly(r.date));

    const projectTaskIds = await fetchProjectTaskIds(workspace_id, project_id);
    let allTasks = [];
    if (projectTaskIds.length) {
        const placeholders = projectTaskIds.map(() => '?').join(',');
        allTasks = await query(
            `SELECT t.id, t.name, t.start_at, t.due_at, t.parent_id, t.progress,
                    t.constraint_type, t.constraint_date, t.time_used,
                    t.duration, t.duration_unit,
                    tt.handler as task_type_handler
             FROM ph_tasks t
             LEFT JOIN ph_task_types tt ON t.task_type_id = tt.id
                 AND (tt.workspace_id = t.workspace_id OR tt.workspace_id IS NULL)
             WHERE t.id IN (${placeholders})
               AND t.workspace_id = ? AND t.deleted_at IS NULL AND t.deleted_ancestor_id IS NULL
               AND t.due_at IS NOT NULL`,
            [...projectTaskIds, workspace_id]
        );
    }

    const allLinks = await query(
        `SELECT tl.id, tl.source_task_id, tl.target_task_id, tl.type
         FROM ph_task_links tl
         JOIN ph_tasks ts ON ts.id = tl.source_task_id
             AND ts.deleted_at IS NULL
             AND ts.deleted_ancestor_id IS NULL
             AND ts.due_at IS NOT NULL
         JOIN ph_tasks tt ON tt.id = tl.target_task_id
             AND tt.deleted_at IS NULL
             AND tt.deleted_ancestor_id IS NULL
             AND tt.due_at IS NOT NULL
         WHERE tl.workspace_id = ? AND tl.project_id = ?`,
        [workspace_id, project_id]
    );

    return {
        project,
        workingDaysRows,
        workingDaysConfig,
        holidays,
        allTasks,
        allLinks,
    };
};

// ─────────────────────────────────────────────────────────────
// SERVICE EXPORTS
// ─────────────────────────────────────────────────────────────

export const recalculateImpact = async ({
    workspace_id, project_id, task_id,
    start_at, due_at,
    operation, link_id, link, new_type,
}) => {
    const context = await fetchContext(Number(workspace_id), Number(project_id));

    if (task_id) {
        const idx = context.allTasks.findIndex(t => t.id === Number(task_id));

        if (idx === -1) {
            return { success: false, message: 'Invalid calculation request', errors: ['task not found'] };
        }

        const startKeyPresent = start_at !== undefined;
        const dueKeyPresent = due_at !== undefined;

        if (startKeyPresent || dueKeyPresent) {
            const task = context.allTasks[idx];
            const isMilestone = task.task_type_handler === 'milestone';
            const hasStart = startKeyPresent && start_at !== null;
            const hasDue = dueKeyPresent && due_at !== null;

            if (isMilestone) {
                if (hasStart) {
                    return {
                        success: false,
                        message: 'Invalid calculation request',
                        errors: ['milestone tasks cannot have a non-null start_at'],
                    };
                }
                if (!hasDue) {
                    return {
                        success: false,
                        message: 'Invalid calculation request',
                        errors: ['due_at is required for milestone tasks'],
                    };
                }
            } else {
                if (dueKeyPresent && hasDue && !hasStart) {
                    return {
                        success: false,
                        message: 'Invalid calculation request',
                        errors: ['start_at is required when due_at is provided'],
                    };
                }
                if (startKeyPresent && hasStart && !hasDue) {
                    return {
                        success: false,
                        message: 'Invalid calculation request',
                        errors: ['due_at is required when start_at is provided'],
                    };
                }
                if (hasStart && hasDue && new Date(start_at) > new Date(due_at)) {
                    return {
                        success: false,
                        message: 'Invalid calculation request',
                        errors: ['start_at cannot be after due_at'],
                    };
                }
            }
        }
    }

    const triggeredDates = (task_id && (start_at !== undefined || due_at !== undefined))
        ? { start_at: start_at ?? null, due_at: due_at ?? null }
        : null;

    return runScheduling({
        context,
        task_id: task_id ? Number(task_id) : null,
        triggeredDates,
        operation: operation || null,
        link_id: link_id ? Number(link_id) : null,
        link: link || null,
        new_type: new_type || null,
    });
};

export const calculateImpactPreview = async ({
    workspace_id, project_id, task_id,
    start_at, due_at,
    operation, link_id, link, new_type,
}) => {
    const result = await recalculateImpact({
        workspace_id, project_id, task_id,
        start_at, due_at,
        operation, link_id, link, new_type,
    });

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
        due_at: t.due_at,
    }));

    return {
        success: true,
        data: {
            impacted_tasks_count: mappedImpact.length,
            impact_tasks: mappedImpact.slice(0, IMPACT_TASKS_LIMIT),
        },
    };
};

export const validateStandaloneLink = async ({ workspace_id, project_id, type, link }) => {
    const context = await fetchContext(Number(workspace_id), Number(project_id));
    const { allTasks, allLinks } = context;

    if (type === 'add_link') {
        const proposedLink = {
            source_task_id: Number(link.source),
            target_task_id: Number(link.target),
        };
        if (hasCircularLink(allTasks, [...allLinks, proposedLink])) {
            return { success: false, reason: 'circular_link' };
        }
        return { success: true };
    }
    throw new Error('Unknown validation type');
};

export const getProjectData = async ({ workspace_id, project_id }) => {
    const context = await fetchContext(Number(workspace_id), Number(project_id));
    const { project, workingDaysRows, holidays, allTasks, allLinks } = context;

    return {
        project: {
            id: project.id,
            name: project.name,
            type: project.type,
            auto_schedule_tasks: !!project.auto_schedule_tasks,
            auto_schedule_tasks_gap: project.auto_schedule_tasks_gap || 'keep',
            move_subtasks_with_parent: !!project.move_subtasks_with_parent,
            use_working_time: project.use_working_time,
            start_date: project.start_date,
            due_date: project.due_date,
        },
        workspace: {
            holidays,
            working_days: buildRawWorkingDaysPayload(workingDaysRows),
        },
        tasks: allTasks.map(t => ({
            id: t.id,
            text: t.name,
            start_date: anyToMysql(t.start_at) ?? t.start_at,
            end_date: anyToMysql(t.due_at) ?? t.due_at,
            parent: t.parent_id || 0,
            time_used: !!t.time_used,
            // ── v5 ──
            duration: t.duration !== null && t.duration !== undefined ? Number(t.duration) : null,
            duration_unit: t.duration_unit ?? null,
            constraint_type: t.constraint_type || 'asap',
            constraint_date: t.constraint_date
                ? (anyToMysql(t.constraint_date) ?? toDateOnly(t.constraint_date))
                : null,
            type: t.task_type_handler || 'task',
        })),
        links: allLinks.map(l => ({
            id: l.id,
            source: l.source_task_id,
            target: l.target_task_id,
            type: l.type,
        })),
    };
};