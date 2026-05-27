import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    LOG_LEVEL,
    LOG_DIR,
    LOG_FILE_NAME_PATTERN,
    LOG_MAX_SIZE,
    LOG_MAX_FILES
} from '../config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom format for readable logs
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.printf(({ timestamp, level, message, requestId, duration, status, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]`;
        if (requestId) log += ` [${requestId}]`;
        log += ` ${message}`;
        if (duration) log += ` - ${duration}`;
        if (status) log += ` - ${status}`;
        if (Object.keys(meta).length) log += ` ${JSON.stringify(meta)}`;
        return log;
    })
);

const logger = winston.createLogger({
    level: LOG_LEVEL,
    format: logFormat,
    transports: [
        // Console output (for development)
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            )
        }),
        // Daily rotating file
        new DailyRotateFile({
            filename: path.join(__dirname, '../../', LOG_DIR, LOG_FILE_NAME_PATTERN),
            datePattern: 'YYYY-MM-DD',
            maxSize: LOG_MAX_SIZE,
            maxFiles: LOG_MAX_FILES,
            format: logFormat
        })
    ]
});

export default logger;