// src/utils/dateHelper.js
//
// ─────────────────────────────────────────────────────────────
// DATE HELPERS — shared by dhtmlxScheduler.js and ganttEngine.js
// ─────────────────────────────────────────────────────────────
// All DB datetime columns are "YYYY-MM-DD HH:mm:ss" strings (or Date
// objects depending on mysql2 config — both are handled below).
// DHTMLX works with JS Date objects internally, parsed/serialized in
// LOCAL time. We parse strings → Date using LOCAL constructors and
// format Date → strings using LOCAL getters, so with TZ=UTC the
// round-trip through DHTMLX is lossless.
//
// TIMEZONE RULE:
// Node process MUST run with TZ=UTC (set in package.json scripts:
//   "dev": "TZ=UTC nodemon src/index.js", "start": "TZ=UTC node src/index.js")
// ph_tasks.start_at / due_at are stored in UTC. TZ=UTC makes Node local
// time = UTC = DB time → no offset corruption when DHTMLX parses dates
// using its internal LOCAL-time logic.
// ─────────────────────────────────────────────────────────────

const pad = n => String(n).padStart(2, '0');

// Any DB value (string "YYYY-MM-DD[ HH:mm:ss]", or Date object) → JS Date (local)
export const toDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return val;
    const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    const [, y, mo, d, h = '0', min = '0', sec = '0'] = m;
    return new Date(+y, +mo - 1, +d, +h, +min, +sec); // LOCAL — matches DHTMLX internal parsing
};

// JS Date → MySQL datetime string (local getters)
export const toMysql = (date) => {
    if (!date) return null;
    if (!(date instanceof Date) || isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
};

// Any value (Date object or string) → MySQL datetime string
export const anyToMysql = (val) => {
    if (!val) return null;
    if (val instanceof Date) return toMysql(val);
    const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return null;
    const [, y, mo, d, h, min] = m;
    return `${y}-${mo}-${d} ${h}:${min}:00`;
};

// DB DATE column (date-only) → "YYYY-MM-DD" string, handles Date objects too
export const toDateOnly = (val) => {
    if (!val) return null;
    if (val instanceof Date) return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}`;
    return String(val).slice(0, 10);
};

// Minute-precision string for comparison (ignores seconds)
export const toMin = (s) => s ? String(s).slice(0, 16) : null;

// ─────────────────────────────────────────────────────────────
// WEEKEND / WORK-DAY CONVERSION
// DB weekend format: 1=Sun, 2=Mon … 7=Sat  →  JS day format: 0=Sun … 6=Sat
// ─────────────────────────────────────────────────────────────

export const DB_TO_JS_DAY = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 };

// ph_workspaces.weekend may come back as a JSON string, a plain array [1,7],
// or wrapped as { weekend: [1,7] } — handle all three shapes.
export const parseWeekendArray = (weekendJson) => {
    let parsed = weekendJson;
    if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch { return [1, 7]; }
    }
    if (Array.isArray(parsed)) return parsed;
    if (parsed?.weekend && Array.isArray(parsed.weekend)) return parsed.weekend;
    return [1, 7]; // default Sun+Sat off
};