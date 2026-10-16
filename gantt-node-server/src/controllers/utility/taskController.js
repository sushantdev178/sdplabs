// src/controllers/utility/taskController.js
import { calculateTaskDuration } from '../../services/taskUtilityEngine.js';

export const duration = async (req, res) => {
    try {
        const { workspace_id, project_id, start_at, due_at, time_used } = req.body;

        // 1. Required identifiers
        if (!workspace_id || !project_id) {
            return res.status(400).json({
                success: false,
                error: 'workspace_id and project_id are required',
            });
        }

        // 2. Dates must be present.
        //    time_used may be null/undefined → engine treats it as false.
        if (start_at == null || due_at == null) {
            return res.json({
                success: true,
                data: {
                    duration: null,
                    duration_unit: null,
                    duration_minutes: null,
                    duration_days: null,
                    working_days_count: null,
                },
            });
        }

        // 3. Hand off to the engine — it validates dates, applies the
        //    calendar, and picks duration_unit based on time_used.
        const result = await calculateTaskDuration({
            workspace_id,
            project_id,
            start_at,
            due_at,
            time_used,
        });

        return res.json(result);
    } catch (err) {
        console.error('[utility/duration] error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
};