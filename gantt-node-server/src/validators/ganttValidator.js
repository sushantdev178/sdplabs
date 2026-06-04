// src/validators/ganttValidator.js

/**
 * Validate calculate endpoint request
 */
export const validateCalculateRequest = (body) => {
    const errors = [];

    if (!body.workspace_id) {
        errors.push('workspace_id is required');
    } else if (isNaN(parseInt(body.workspace_id))) {
        errors.push('workspace_id must be a number');
    }

    if (!body.project_id && !body.task_id) {
        errors.push('Either project_id or task_id is required');
    }

    if (body.project_id && isNaN(parseInt(body.project_id))) {
        errors.push('project_id must be a number');
    }

    // CRITICAL: start_at and due_at must come with task_id
    if ((body.start_at || body.due_at) && !body.task_id) {
        errors.push('task_id is required when start_at or due_at is provided');
    }

    // If task_id is provided, validate dates
    if (body.task_id) {
        if (isNaN(parseInt(body.task_id))) {
            errors.push('task_id must be a number');
        }

        // start_at and due_at must both be provided if one is
        if (body.start_at && !body.due_at) {
            errors.push('due_at is required when start_at is provided');
        }
        if (body.due_at && !body.start_at) {
            errors.push('start_at is required when due_at is provided');
        }

        if (body.start_at) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
            if (!dateRegex.test(body.start_at)) {
                errors.push('start_at must be in format: YYYY-MM-DD HH:MM:SS');
            }
        }

        if (body.due_at) {
            const dateRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
            if (!dateRegex.test(body.due_at)) {
                errors.push('due_at must be in format: YYYY-MM-DD HH:MM:SS');
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validate project data request
 */
export const validateProjectDataRequest = (query) => {
    const errors = [];

    if (!query.workspace_id) {
        errors.push('workspace_id is required');
    } else if (isNaN(parseInt(query.workspace_id))) {
        errors.push('workspace_id must be a number');
    }

    if (!query.project_id) {
        errors.push('project_id is required');
    } else if (isNaN(parseInt(query.project_id))) {
        errors.push('project_id must be a number');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};