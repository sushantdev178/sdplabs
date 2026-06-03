// src/validators/ganttValidator.js
import { query } from '../utils/db.js';

export const validateCalculatePayload = async (body) => {
    const { workspace_id, project_id, task_id } = body || {};

    // Rule 1: Structural Null Validation
    if (!workspace_id || isNaN(Number(workspace_id))) {
        throw new Error('Validation failed: workspace_id is required and must be a valid number');
    }
    if (!project_id && !task_id) {
        throw new Error('Validation failed: Either project_id or task_id must be provided to determine layout context');
    }

    // Rule 2: Explicit Task Exists & Belongs to Workspace Check
    if (task_id) {
        const [taskRow] = await query(
            `SELECT workspace_id FROM ph_tasks WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
            [task_id]
        );

        if (!taskRow) {
            throw new Error(`Validation failed: Task ${task_id} does not exist in the system`);
        }
        if (Number(taskRow.workspace_id) !== Number(workspace_id)) {
            throw new Error(`Validation failed: Task ${task_id} does not belong to Workspace ${workspace_id}`);
        }
    }

    // Rule 3: Explicit Project Exists & Belongs to Workspace Check
    if (project_id) {
        const [projectWorkspaceCheck] = await query(
            `SELECT id FROM ph_projects WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL LIMIT 1`,
            [project_id, workspace_id]
        );
        if (!projectWorkspaceCheck) {
            throw new Error(`Validation failed: Project ${project_id} does not belong to Workspace ${workspace_id}`);
        }
    }

    return true;
};