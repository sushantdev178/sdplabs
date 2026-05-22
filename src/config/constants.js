// src/config/constants.js

// ─── Server ──────────────────────────────────────────────────────────────────
export const PORT = 3001;
export const BASE_URL = `http://localhost:${PORT}`;
export const SERVICE_NAME = 'gantt-node-server';
export const JSON_LIMIT = '10mb';

// ─── Database (read‑only) ────────────────────────────────────────────────────
export const DB_HOST = 'indev.phdb1';
export const DB_PORT = 3306;
export const DB_USER = 'proofhubadminrem_apiv5_limited';
export const DB_PASSWORD = 'Md3DM7rmYATLRCug';
export const DB_NAME = 'proofhub2_v5_indev';

// ─── Gantt Scheduling Defaults ────────────────────────────────────────────────
export const GANTT_DURATION_UNIT = 'day';           // 'day' or 'hour'
export const GANTT_WORK_DAYS = [1, 2, 3, 4, 5];     // Mon–Fri (0=Sunday)
export const GANTT_HOLIDAYS = ['2026-03-30'];                   // e.g., ['2026-12-25']
export const GANTT_AUTO_SCHEDULING_MODE = 'auto';   // 'auto' or 'manual'
export const GANTT_MOVE_ASAP_TASKS = true;          // Move ASAP tasks when their dependencies change
export const GANTT_SCHEDULE_ON_PARSE = false;
export const GANTT_AUTO_SCHEDULING_DESCENDANT_LINKS = false;
export const GANTT_GAP_BEHAVIOR = 'keep';       // 'compress' or 'preserve'

// ─── Logging ─────────────────────────────────────────────────────────────────
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const LOG_DIR = 'logs';
export const LOG_FILE_NAME_PATTERN = 'gantt-%DATE%.log';
export const LOG_MAX_SIZE = '20m';
export const LOG_MAX_FILES = '14d';


// ─── Link Type Mapping (DHTMLX numeric codes) ────────────────────────────────
export const LINK_TYPE_MAP = {
    'finish_to_start': '0',
    'start_to_start': '1',
    'finish_to_finish': '2',
    'start_to_finish': '3',
};
