// src/utils/response.js
import { DEBUG_MODE } from '../config/constants.js';

/**
 * Success response helper
 */
export const successResponse = (res, data, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

/**
 * Error response helper with debug information
 */
export const errorResponse = (res, error, message = 'Internal Server Error', statusCode = 500) => {
    const response = {
        success: false,
        message: DEBUG_MODE ? message : 'Internal Server Error',
        ...(DEBUG_MODE && {
            error: {
                type: error?.constructor?.name || 'Error',
                message: error?.message || 'Unknown error',
                stack: error?.stack?.split('\n').slice(0, 5),
                ...(error?.code && { code: error.code }),
                ...(error?.errno && { errno: error.errno }),
                ...(error?.sqlMessage && { sqlMessage: error.sqlMessage })
            }
        })
    };

    return res.status(statusCode).json(response);
};

/**
 * Validation error response
 */
export const validationError = (res, errors, message = 'Validation Error') => {
    return res.status(400).json({
        success: false,
        message,
        errors: Array.isArray(errors) ? errors : [errors]
    });
};