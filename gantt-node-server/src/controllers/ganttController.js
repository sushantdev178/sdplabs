import { recalculateImpact as recalculateImpactService, getProjectData } from '../services/ganttEngine.js';
import { validateCalculatePayload } from '../validators/ganttValidator.js';

export const recalculateImpact = async (req, res, next) => {
    try {
        // 1. Run custom validation block (mimics $request->validate())
        await validateCalculatePayload(req.body);

        const { workspace_id, project_id, task_id, start_at, due_at } = req.body;
        const taskUpdates = (start_at && due_at) ? { start_at, due_at } : undefined;

        // 2. Execute calculation safely knowing data integrity is secured
        const result = await recalculateImpactService({
            workspace_id: Number(workspace_id),
            project_id: project_id ? Number(project_id) : undefined,
            task_id: task_id ? Number(task_id) : undefined,
            taskUpdates,
        });

        return res.json({
            success: true,
            message: 'Impact recalculation complete',
            data: result,
        });
    } catch (error) {
        // 3. Catch custom validation errors and return a clean 400 Bad Request
        if (error.message.startsWith('Validation failed:')) {
            return res.status(400).json({ error: error.message });
        }
        next(error);
    }
};

// ganttController.js

export const fetchProjectData = async (req, res, next) => {
    try {
        const { workspace_id, project_id } = req.query;
        if (!workspace_id || !project_id) {
            return res.status(400).json({ error: 'workspace_id and project_id are required' });
        }

        const data = await getProjectData({
            workspace_id: Number(workspace_id),
            project_id: Number(project_id)
        });

        return res.json(data);
    } catch (error) {
        // Intercept your explicit service errors cleanly
        if (error.message.includes('not found') || error.message.startsWith('Validation failed:')) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }

        // Pass actual unexpected operational crashes to your global console/logger middleware
        next(error);
    }
};

export const validateTaskLink = async (req, res, next) => {
    // keep existing implementation
};