import { query } from '../../utils/db.js';
import { toDateOnly, anyToMysql, parseWeekendArray, DB_TO_JS_DAY } from '../../utils/dateHelper.js';
import { hasCircularLink, hasHierarchyLink } from '../../validators/ganttValidator.js';
import { runScheduling } from './dhtmlxScheduler2.js';   // <-- experimental2 engine
import { IMPACT_TASKS_LIMIT } from '../../config/constants.js';

// Database fetching functions are identical to the experimental track
// They are copied here for complete isolation.

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
    const [workspace] = await query(
        `SELECT weekend FROM ph_workspaces WHERE id = ? LIMIT 1`,
        [workspace_id]
    );
    if (!workspace) throw new Error(`Workspace ${workspace_id} not found`);

    const [project] = await query(
        `SELECT id, workspace_id, name, start_date, due_date,
                auto_schedule_tasks, auto_schedule_tasks_gap,
                restrict_tasks_to_working_days, move_subtasks_with_parent
         FROM ph_projects
         WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
        [project_id, workspace_id]
    );
    if (!project) throw new Error(`Project ${project_id} not found`);

    project.start_date = toDateOnly(project.start_date);
    project.due_date = toDateOnly(project.due_date);

    const weekendJs = parseWeekendArray(workspace.weekend)
        .map(d => DB_TO_JS_DAY[d])
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

// ── SERVICE EXPORTS ──

export const recalculateImpactExperimental2 = async ({ workspace_id, project_id, task_id, start_at, due_at, operation, link_id, link, new_type }) => {
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