import { recalculateImpact as recalculateImpactService, getProjectData } from '../services/ganttEngine.js';

export const recalculate = async (req, res, next) => {
    // if you have a legacy /recalculate endpoint, keep it
};

export const recalculateImpact = async (req, res, next) => {
    try {
        const { workspace_id, project_id, task_id, start_at, due_at } = req.body;
        if (!workspace_id || (!project_id && !task_id)) {
            return res.status(400).json({ error: 'workspace_id and either project_id or task_id are required' });
        }

        // If both start_at and due_at are provided, use them as taskUpdates
        // let taskUpdates = undefined;
        // if (start_at && due_at) {
        //     taskUpdates = { start_at, due_at };
        // }

        const result = await recalculateImpactService({
            workspace_id: Number(workspace_id),
            project_id: project_id ? Number(project_id) : undefined,
            task_id: task_id ? Number(task_id) : undefined,
            // taskUpdates,
        });

        res.json({
            success: true,
            message: 'Impact recalculation complete',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

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
        res.json(data);
    } catch (error) {
        next(error);
    }
};

export const validateTaskLink = async (req, res, next) => {
    // keep existing implementation
};