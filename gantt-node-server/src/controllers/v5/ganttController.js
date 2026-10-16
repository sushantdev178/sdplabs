// src/controllers/v5/ganttController.js
//
// v5 — working days from ph_project_working_days + use_working_time flag.
//      Mirrors v4's controller shape exactly. Routed through v5's
//      ganttEngine.js which carries duration + duration_unit through
//      the snapshot and task diff.

import {
    validateCalculateRequest,
    validateImpactRequest,
    validateProjectDataRequest,
    validateStandaloneLinkRequest
} from '../../validators/ganttValidator.js';
import {
    recalculateImpact,
    calculateImpactPreview,
    validateStandaloneLink,
    getProjectData
} from '../../services/v5/ganttEngine.js';
import { successResponse, errorResponse, validationError } from '../../utils/response.js';

// POST /api/gantt/v5/calculate
export const calculate = async (req, res) => {
    try {
        const { isValid, errors } = validateCalculateRequest(req.body);
        if (!isValid) return validationError(res, errors, 'Invalid calculation request');

        const { workspace_id, project_id, task_id, start_at, due_at, operation, link_id, new_type } = req.body;

        const result = await recalculateImpact({
            workspace_id,
            project_id,
            task_id,
            start_at,
            due_at,
            operation: operation || null,
            link_id,
            new_type: new_type || null
        });

        if (!result.success) {
            return validationError(res, [result.error], 'Scheduling blocked !');
        }

        return successResponse(res, result.data, result.message);
    } catch (err) {
        return errorResponse(res, err, 'Failed to calculate gantt schedule');
    }
};

// POST /api/gantt/v5/calculate-impact
export const calculateImpact = async (req, res) => {
    try {
        const { isValid, errors } = validateImpactRequest(req.body);
        if (!isValid) return validationError(res, errors, 'Invalid impact calculation request');

        const { workspace_id, project_id, task_id, start_at, due_at, operation, link_id, link, new_type } = req.body;

        const result = await calculateImpactPreview({
            workspace_id,
            project_id,
            task_id,
            start_at,
            due_at,
            operation: operation || null,
            link_id: link_id || null,
            link: link || null,
            new_type: new_type || null
        });

        if (!result.success) {
            return validationError(res, [result.error], 'Scheduling blocked !');
        }

        return successResponse(res, result.data, 'Impact calculation complete');
    } catch (err) {
        return errorResponse(res, err, 'Failed to calculate gantt impact');
    }
};

// POST /api/gantt/v5/validate
export const validateLink = async (req, res) => {
    try {
        const { isValid, errors } = validateStandaloneLinkRequest(req.body);
        if (!isValid) return validationError(res, errors, 'Invalid validation request');

        const { workspace_id, project_id, type, link } = req.body;

        const result = await validateStandaloneLink({ workspace_id, project_id, type, link });

        if (!result.success) {
            return successResponse(res, {
                valid: false,
                reason: result.reason,
                detail: result.detail || null
            }, 'Link validation failed');
        }

        return successResponse(res, { valid: true }, 'Link is valid');
    } catch (err) {
        console.error('[v5/validate] error:', err);
        return res.status(500).json({
            success: false,
            message: 'Scheduling blocked !',
            errors: [err?.message ?? String(err)]
        });
    }
};

// GET /api/gantt/v5/project-data
export const getProject = async (req, res) => {
    try {
        const { isValid, errors } = validateProjectDataRequest(req.query);
        if (!isValid) return validationError(res, errors, 'Invalid project data request');

        const { workspace_id, project_id } = req.query;

        const data = await getProjectData({ workspace_id, project_id });

        return successResponse(res, data, 'Project data loaded successfully');
    } catch (err) {
        console.error('[v5/project-data] error:', err);
        return res.status(500).json({
            success: false,
            message: 'Scheduling blocked !',
            errors: [err?.message ?? String(err)]
        });
    }
};