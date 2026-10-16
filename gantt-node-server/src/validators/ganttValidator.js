// src/validators/ganttValidator.js

// ─────────────────────────────────────────────────────────────
// SHARED CONSTANTS
// ─────────────────────────────────────────────────────────────

const VALID_LINK_TYPES = ['0', '1', '2', '3'];

const MILESTONE_TYPE = 'milestone';
const VALID_TASK_TYPES = ['task', 'approval', 'milestone'];

const DATE_REGEX = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)$/;

// ─────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────

const validateBase = (body, errors) => {
    if (!body.workspace_id) errors.push('workspace_id is required');
    if (!body.project_id) errors.push('project_id is required');
};

const validatePositiveInteger = (value, fieldName, errors) => {
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) {
        errors.push(`${fieldName} must be a valid positive integer`);
        return false;
    }
    return true;
};

const validateDateFormat = (value, fieldName, errors) => {
    if (value && !DATE_REGEX.test(value)) {
        errors.push(`${fieldName} must be in format YYYY-MM-DD HH:MM:SS`);
        return false;
    }
    return true;
};

const validateLinkObject = (link, errors) => {
    if (!link || typeof link !== 'object') {
        errors.push('link object is required and must be an object');
        return;
    }

    if (link.source == null) {
        errors.push('link.source is required');
    } else {
        validatePositiveInteger(link.source, 'link.source', errors);
    }

    if (link.target == null) {
        errors.push('link.target is required');
    } else {
        validatePositiveInteger(link.target, 'link.target', errors);
    }

    if (
        link.source != null &&
        link.target != null &&
        Number(link.source) === Number(link.target)
    ) {
        errors.push('link.source and link.target cannot be the same task');
    }

    if (link.type == null) {
        errors.push('link.type is required');
    } else if (!VALID_LINK_TYPES.includes(String(link.type))) {
        errors.push(`Invalid link.type ,  Allowed values: 0 (finish_to_start), 1 (start_to_start), 2 (finish_to_finish), 3 (start_to_finish)`);
    }
};

const validateLinkId = (link_id, errors) => {
    if (!link_id) {
        errors.push('link_id is required');
        return;
    }
    validatePositiveInteger(link_id, 'link_id', errors);
};

/**
 * Shape-only validation of a date-update payload.
 *
 * DB-aware rules (e.g. "milestones may have null start_at") are enforced
 * in ganttEngine.recalculateImpact() after fetchContext() loads the task row.
 */
const validateDateUpdateShape = (body, errors) => {
    const { start_at, due_at, task_id, type } = body || {};

    const startKeyPresent = Object.prototype.hasOwnProperty.call(body, 'start_at');
    const dueKeyPresent = Object.prototype.hasOwnProperty.call(body, 'due_at');

    const hasStart = start_at !== undefined && start_at !== null;
    const hasDue = due_at !== undefined && due_at !== null;

    if (!startKeyPresent && !dueKeyPresent) return;

    if (!task_id) errors.push('task_id is required when providing dates');

    if (type !== undefined && type !== null && !VALID_TASK_TYPES.includes(type)) {
        errors.push(`Invalid type "${type}". Allowed: ${VALID_TASK_TYPES.join(', ')}`);
        return;
    }

    if (type === MILESTONE_TYPE) {
        if (!hasDue) {
            errors.push('due_at is required for milestone tasks');
        }
        if (hasStart) validateDateFormat(start_at, 'start_at', errors);
        if (hasDue) validateDateFormat(due_at, 'due_at', errors);

        if (hasStart && hasDue && DATE_REGEX.test(start_at) && DATE_REGEX.test(due_at)) {
            if (new Date(start_at) > new Date(due_at)) {
                errors.push('start_at cannot be after due_at');
            }
        }
        return;
    }

    // ── v4: when task_id is present but type is not specified, defer ──
    // type-aware validation to the engine. The engine reads the actual
    // task type from the DB (task_type_handler) and enforces milestone
    // vs regular-task rules there. This lets callers send
    // { task_id, due_at } (no start_at) for milestones without having
    // to also pass type: 'milestone'.
    if (task_id != null && (type === undefined || type === null)) {
        if (hasStart) validateDateFormat(start_at, 'start_at', errors);
        if (hasDue) validateDateFormat(due_at, 'due_at', errors);

        if (hasStart && hasDue && DATE_REGEX.test(start_at) && DATE_REGEX.test(due_at)) {
            if (new Date(start_at) > new Date(due_at)) {
                errors.push('start_at cannot be after due_at');
            }
        }
        return;
    }

    if (dueKeyPresent && hasDue && !startKeyPresent) {
        errors.push('start_at is required when due_at is provided');
    }
    if (startKeyPresent && hasStart && !dueKeyPresent) {
        errors.push('due_at is required when start_at is provided');
    }

    if (hasStart) validateDateFormat(start_at, 'start_at', errors);
    if (hasDue) validateDateFormat(due_at, 'due_at', errors);

    if (hasStart && hasDue && DATE_REGEX.test(start_at) && DATE_REGEX.test(due_at)) {
        if (new Date(start_at) > new Date(due_at)) {
            errors.push('start_at cannot be after due_at');
        }
    }
};

// ─────────────────────────────────────────────────────────────
// SECTION 1 — REQUEST-SHAPE VALIDATION
// ─────────────────────────────────────────────────────────────

export const validateCalculateRequest = (body) => {
    const errors = [];
    const {
        workspace_id, project_id, start_at, due_at, operation,
        link_id, task_id, link, new_type
    } = body || {};

    validateBase(body, errors);

    const VALID_OPERATIONS = ['delete_link', 'update_link'];

    if (operation) {
        if (!VALID_OPERATIONS.includes(operation)) {
            errors.push(`Invalid operation "${operation}" for /calculate. Allowed: delete_link. For add_link, omit operation and pass task_id = target instead.`);
        }

        if (task_id !== undefined) errors.push('task_id must not be provided when using operation');
        if (start_at !== undefined || due_at !== undefined) errors.push('start_at/due_at must not be provided when using operation');
        if (link !== undefined) errors.push('"link" object is not allowed for /calculate. Use link_id (the saved DB record)');

        if (operation === 'delete_link') {
            validateLinkId(link_id, errors);
        }

        if (operation === 'update_link') {
            validateLinkId(link_id, errors);
            if (!new_type) {
                errors.push('new_type is required when operation is update_link');
            } else if (!VALID_LINK_TYPES.includes(String(new_type))) {
                errors.push(`Invalid new_type "${new_type}". Allowed values: 0, 1, 2, 3`);
            }
        }

    } else {
        if (task_id !== undefined) {
            validatePositiveInteger(task_id, 'task_id', errors);
        }

        validateDateUpdateShape(body, errors);
    }

    return { isValid: errors.length === 0, errors };
};

export const validateImpactRequest = (body) => {
    const errors = [];
    const {
        workspace_id, project_id, start_at, due_at, operation,
        link_id, task_id, link, new_type
    } = body || {};

    validateBase(body, errors);

    const VALID_OPERATIONS = ['delete_link', 'add_link', 'update_link'];

    if (operation) {
        if (!VALID_OPERATIONS.includes(operation)) {
            errors.push(`Invalid operation "${operation}". Allowed: ${VALID_OPERATIONS.join(', ')}`);
        }

        if (task_id !== undefined) errors.push('task_id must not be provided when using operation');
        if (start_at !== undefined || due_at !== undefined) errors.push('start_at/due_at must not be provided when using operation');

        if (operation === 'add_link') {
            if (link_id !== undefined) {
                errors.push('link_id cannot be provided for add_link preview — link does not exist in DB yet');
            }
            validateLinkObject(link, errors);
        }

        if (operation === 'delete_link') {
            if (link !== undefined) {
                errors.push('"link" object must not be provided for delete_link — use link_id instead');
            }
            validateLinkId(link_id, errors);
        }

        if (operation === 'update_link') {
            if (link !== undefined) {
                errors.push('"link" object must not be provided for update_link — use link_id + new_type instead');
            }
            validateLinkId(link_id, errors);
            if (!new_type) {
                errors.push('new_type is required when operation is update_link');
            } else if (!VALID_LINK_TYPES.includes(String(new_type))) {
                errors.push(`Invalid new_type "${new_type}". Allowed values: 0, 1, 2, 3`);
            }
        }

    } else {
        if (task_id !== undefined) {
            validatePositiveInteger(task_id, 'task_id', errors);
        }

        validateDateUpdateShape(body, errors);
    }

    return { isValid: errors.length === 0, errors };
};

export const validateProjectDataRequest = (query) => {
    const errors = [];
    const { workspace_id, project_id } = query || {};

    if (!workspace_id) errors.push('workspace_id is required');
    if (!project_id) errors.push('project_id is required');

    return { isValid: errors.length === 0, errors };
};

export const validateStandaloneLinkRequest = (body) => {
    const errors = [];
    const { workspace_id, project_id, type, link } = body || {};

    if (!workspace_id) errors.push('workspace_id is required');
    if (!project_id) errors.push('project_id is required');
    if (!type) errors.push('type is required');

    if (type === 'add_link') {
        if (!link || link.source == null || link.target == null) {
            errors.push('link.source and link.target are required for add_link validation');
        } else {
            validatePositiveInteger(link.source, 'link.source', errors);
            validatePositiveInteger(link.target, 'link.target', errors);
            if (Number(link.source) === Number(link.target)) {
                errors.push('link.source and link.target cannot be the same task');
            }
        }
    }

    return { isValid: errors.length === 0, errors };
};

// ─────────────────────────────────────────────────────────────
// SECTION 2 — SCHEDULING VALIDATION (Pure JS)
// ─────────────────────────────────────────────────────────────

export const hasCircularLink = (tasks, links) => {
    const adj = new Map(tasks.map(t => [t.id, []]));
    links.forEach(l => {
        const src = l.source_task_id ?? l.source;
        const tgt = l.target_task_id ?? l.target;
        if (adj.has(src)) adj.get(src).push(tgt);
    });
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map(tasks.map(t => [t.id, WHITE]));
    const dfs = (node) => {
        color.set(node, GRAY);
        for (const nb of (adj.get(node) || [])) {
            if (!color.has(nb)) continue;
            if (color.get(nb) === GRAY) return true;
            if (color.get(nb) === WHITE && dfs(nb)) return true;
        }
        color.set(node, BLACK);
        return false;
    };
    for (const t of tasks) {
        if (color.get(t.id) === WHITE && dfs(t.id)) return true;
    }
    return false;
};

export const hasHierarchyLink = (tasks, links) => {
    const parentOf = new Map(tasks.map(t => [t.id, t.parent_id ?? t.parent ?? 0]));

    const isAncestorOf = (ancestorId, taskId) => {
        let cur = parentOf.get(taskId);
        const seen = new Set();
        while (cur && cur !== 0) {
            if (seen.has(cur)) break;
            seen.add(cur);
            if (cur === ancestorId) return true;
            cur = parentOf.get(cur);
        }
        return false;
    };

    for (const l of links) {
        const src = l.source_task_id ?? l.source;
        const tgt = l.target_task_id ?? l.target;
        if (isAncestorOf(src, tgt) || isAncestorOf(tgt, src)) {
            return { found: true, reason: `Tasks ${src} and ${tgt} are in the same hierarchy chain` };
        }
    }
    return { found: false };
};