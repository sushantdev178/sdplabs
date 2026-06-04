// src/controllers/ganttController.js
import { recalculateImpact, getProjectData } from '../services/ganttEngine.js';
import { successResponse, errorResponse, validationError } from '../utils/response.js';
import { validateCalculateRequest, validateProjectDataRequest } from '../validators/ganttValidator.js';

/**
 * Calculate impact of task date changes
 * POST /api/gantt/calculate
 */
export const calculate = async (req, res) => {
    try {
        const { workspace_id, project_id, task_id, start_at, due_at } = req.body;

        // Validate request
        const validation = validateCalculateRequest(req.body);
        if (!validation.isValid) {
            return validationError(res, validation.errors);
        }

        // Prepare task updates if provided
        const taskUpdates = task_id && start_at ? {
            start_at,
            due_at: due_at || start_at
        } : null;

        // Calculate impact
        const result = await recalculateImpact({
            workspace_id: parseInt(workspace_id),
            project_id: project_id ? parseInt(project_id) : null,
            task_id: task_id ? parseInt(task_id) : null,
            taskUpdates
        });

        // Return in format matching frontend expectations
        return res.status(200).json({
            success: true,
            message: result.message || "Impact recalculation complete",
            data: result.data
        });
    } catch (error) {
        console.error('Calculate endpoint error:', error);
        return res.status(500).json({
            success: false,
            message: `Calculation failed: ${error.message}`,
            error: {
                type: error.constructor.name,
                message: error.message
            }
        });
    }
};

/**
 * Get project data for frontend
 * GET /api/gantt/project-data
 */
export const getProject = async (req, res) => {
    try {
        const { workspace_id, project_id } = req.query;

        // Validate request
        const validation = validateProjectDataRequest(req.query);
        if (!validation.isValid) {
            return validationError(res, validation.errors);
        }

        // Get project data
        const data = await getProjectData({
            workspace_id: parseInt(workspace_id),
            project_id: parseInt(project_id)
        });

        // Return the data directly (frontend expects this format)
        return res.status(200).json(data);
    } catch (error) {
        console.error('Get project endpoint error:', error);
        return res.status(500).json({
            success: false,
            message: `Failed to get project data: ${error.message}`,
            error: {
                type: error.constructor.name,
                message: error.message
            }
        });
    }
};