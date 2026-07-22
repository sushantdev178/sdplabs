// src/config/constants.js

// ─── Server ──────────────────────────────────────────────────────────────────
export const PORT = 3001;
export const BASE_URL = `http://localhost:${PORT}`;
export const SERVICE_NAME = 'gantt-node-server';
export const JSON_LIMIT = '10mb';

// ─── Database (read‑only) ────────────────────────────────────────────────────
export const DB_HOST = 'indev.phdb1';
export const DB_PORT = 3306;
export const DB_USER = 'proofhubadminrem_nodev5_limited';
export const DB_PASSWORD = '03B#k&`fXyv4';
export const DB_NAME = 'proofhub2_v5_indev';

// DHTMLX Configuration Constants
export const GANTT_DURATION_UNIT = 'day';
// Debug mode - shows detailed error messages in response
export const DEBUG_MODE = true;

// API Configuration
export const API_BASE = 'http://192.168.1.44:3001';
export const API_PREFIX = '/api/gantt';

// IMPACT TASKS LIMIT
export const IMPACT_TASKS_LIMIT = 10;

// ─── Logging ─────────────────────────────────────────────────────────────────
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const LOG_DIR = 'logs';
export const LOG_FILE_NAME_PATTERN = 'gantt-%DATE%.log';
export const LOG_MAX_SIZE = '20m';
export const LOG_MAX_FILES = '14d';

// Add this line to your existing constants exports
export const HMAC_TIME_WINDOW_SECONDS = 30;

export const GANTT_NODE_SECRET = '3626433bcc1b5c1cb17bc5bd2bcba47992fcba985a22c26f6d19b350bc494822'