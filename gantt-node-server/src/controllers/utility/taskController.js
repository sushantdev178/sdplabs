import { calculateTaskDuration } from '../../services/taskUtilityEngine.js';

export const duration = async (req, res) => {
    try {
        const { workspace_id, project_id, start_at, due_at, time_used } = req.body;

        // 1. Required fields: workspace_id, project_id, start_at, due_at, time_used
        if (!workspace_id || !project_id) {
            return res.status(400).json({ success: false, error: 'workspace_id and project_id are required' });
        }

        // 2. All three date/time fields must be present (not null/undefined)
        if (start_at == null || due_at == null || time_used === undefined || time_used === null) {
            return res.json({
                success: true,
                data: {
                    duration_minutes: null,
                    duration_days: null,
                    working_days_count: null,
                }
            });
        }

        // 3. Validate date formats
        const startDate = new Date(start_at);
        const dueDate = new Date(due_at);
        if (isNaN(startDate) || isNaN(dueDate)) {
            return res.status(400).json({ success: false, error: 'Invalid date format' });
        }

        // 4. Prevent negative duration (start > due)
        if (startDate.getTime() > dueDate.getTime()) {
            return res.json({
                success: true,
                data: {
                    duration_minutes: null,
                    duration_days: null,
                    working_days_count: null,
                }
            });
        }

        // 5. If time_used is false, return null directly (whole-day tasks don't have minute duration)
        if (time_used === false) {
            return res.json({
                success: true,
                data: {
                    duration_minutes: null,
                    duration_days: null,
                    working_days_count: null,
                }
            });
        }

        // 6. Otherwise compute duration (time_used must be true)
        const result = await calculateTaskDuration({ workspace_id, project_id, start_at, due_at, time_used });
        return res.json(result);
    } catch (err) {
        console.error('[utility/duration] error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
};