// src/utils/dateHelper.js

// DB weekend column uses: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
// JS/Gantt uses:           0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
// weekend:[1,7] (Sun+Sat off) → work_days:[1,2,3,4,5] (Mon-Fri) in JS format
const API_TO_JS = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 };

/**
 * Convert MySQL datetime string to a JavaScript Date object (local time).
 * This mimics frontend's parseDate() exactly.
 * Input:  "2026-05-01 11:55:35" or "2026-05-01"
 * Output: Date object (local)
 */
export const toDateObject = (str) => {
    if (!str) return null;
    if (str instanceof Date) return str;
    const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    const [, y, mo, d, h = '0', min = '0', sec = '0'] = m;
    // Month is 0-indexed in JS Date constructor
    return new Date(+y, +mo - 1, +d, +h, +min, +sec);
};

/**
 * Convert MySQL date to DHTMLX Gantt string format.
 * MUST match gantt.config.date_format = "%Y-%m-%d %H:%i:%s" exactly.
 * Input:  "2025-05-04 10:30:00" or Date object
 * Output: "2025-05-04 10:30:00"
 */
export const toGanttDate = (str) => {
    if (!str) return null;
    // If it's already a Date, format it
    if (str instanceof Date) {
        if (isNaN(str.getTime())) return null;
        const pad = n => String(n).padStart(2, '0');
        return `${str.getFullYear()}-${pad(str.getMonth() + 1)}-${pad(str.getDate())} ${pad(str.getHours())}:${pad(str.getMinutes())}:00`;
    }
    const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    const [, y, mo, d, h = '00', min = '00', sec = '00'] = m;
    return `${y}-${mo}-${d} ${h}:${min}:${sec}`;
};

/**
 * Convert DHTMLX Gantt format back to MySQL date string.
 * Input:  "2025-05-04 10:30:00" or Date object
 * Output: "2025-05-04 10:30:00"
 */
export const toMysqlDate = (ganttStr) => {
    if (!ganttStr) return null;
    if (ganttStr instanceof Date) {
        if (isNaN(ganttStr.getTime())) return null;
        const pad = n => String(n).padStart(2, '0');
        return `${ganttStr.getFullYear()}-${pad(ganttStr.getMonth() + 1)}-${pad(ganttStr.getDate())} ${pad(ganttStr.getHours())}:${pad(ganttStr.getMinutes())}:00`;
    }
    const m = String(ganttStr).match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    const [, y, mo, d, h, min, sec = '00'] = m;
    return `${y}-${mo}-${d} ${h}:${min}:${sec}`;
};

/**
 * Convert DHTMLX date to comparable format for sorting (minute precision).
 * Input:  "2025-05-04 10:30:00"
 * Output: "2025-05-04 10:30"
 */
export const toComparable = (ganttDate) => {
    if (!ganttDate) return null;
    return ganttDate.slice(0, 16);
};

/**
 * Convert DHTMLX date string to JavaScript Date object.
 * Input:  "2025-05-04 10:30:00"
 * Output: Date object
 */
export const ganttToJsDate = (ganttDate) => {
    if (!ganttDate) return null;
    const m = ganttDate.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
    if (!m) return null;
    const [, y, mo, d, h, min] = m;
    return new Date(+y, +mo - 1, +d, +h, +min);
};

/**
 * Convert JavaScript Date to DHTMLX Gantt format string.
 * Input:  Date object
 * Output: "2025-05-04 10:30:00"
 */
export const jsDateToGantt = (date) => {
    if (!date) return null;
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
};

/**
 * Parse workspace weekend setting to working days array in JS/Gantt format.
 * Input:  {"weekend": [1, 7]}  — DB format: 1=Sun, 7=Sat
 * Output: [1, 2, 3, 4, 5]     — JS format: Mon-Fri (0=Sun,1=Mon,...,6=Sat)
 */
export const parseWorkDays = (weekendJson) => {
    const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
    let parsed = weekendJson;
    if (typeof weekendJson === 'string') {
        try {
            parsed = JSON.parse(weekendJson);
        } catch {
            return [1, 2, 3, 4, 5];
        }
    }
    const offDays = (parsed?.weekend ?? [])
        .map(d => API_TO_JS[d])
        .filter(d => d !== undefined);
    return ALL_DAYS.filter(d => !offDays.includes(d));
};

/**
 * Snap date to nearest working day
 */
export const snapToWorkingDay = (ganttDate, direction, workDays, holidays) => {
    if (!ganttDate) return ganttDate;
    const d = ganttToJsDate(ganttDate);
    if (!d) return ganttDate;
    const holidaySet = new Set((holidays || []).map(h => String(h).slice(0, 10)));
    const isWorking = (date) => {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return workDays.includes(date.getDay()) && !holidaySet.has(key);
    };
    if (isWorking(d)) return ganttDate;
    const delta = direction === 'forward' ? 1 : -1;
    const candidate = new Date(d);
    for (let i = 0; i < 30; i++) {
        candidate.setDate(candidate.getDate() + delta);
        if (isWorking(candidate)) return jsDateToGantt(candidate);
    }
    return ganttDate;
};

/**
 * Check if a date is a working day
 */
export const isWorkingDay = (date, workDays, holidays) => {
    if (!date) return false;
    const holidaySet = new Set((holidays || []).map(h => String(h).slice(0, 10)));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return workDays.includes(date.getDay()) && !holidaySet.has(key);
};

/**
 * Format date for display
 */
export const formatDisplayDate = (mysqlDate) => {
    if (!mysqlDate) return '';
    const d = new Date(mysqlDate);
    if (isNaN(d.getTime())) return mysqlDate;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Add days to a MySQL date
 */
export const addDays = (mysqlDate, days) => {
    if (!mysqlDate) return null;
    const d = new Date(mysqlDate);
    if (isNaN(d.getTime())) return mysqlDate;
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
};

/**
 * Calculate duration between two MySQL dates in days
 */
export const calculateDuration = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};