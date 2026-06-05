// src/utils/dateHelper.js

// API/Laravel backend numbering: 1=Sat, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sun
// JS/Gantt numbering:              0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
// Backend: 1=Sun,2=Mon,3=Tue,4=Wed,5=Thu,6=Fri,7=Sat  →  JS: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
const API_TO_JS = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 };

/**
 * Convert MySQL date to DHTMLX Gantt format.
 * MUST match gantt.config.date_format = "%Y-%m-%d %H:%i:%s" exactly.
 * Input:  "2025-05-04 10:30:00" or "2025-05-04"
 * Output: "2025-05-04 10:30:00"
 *
 * NOTE: We keep YYYY-MM-DD so Gantt's date_format "%Y-%m-%d %H:%i:%s" can
 * parse it correctly without any day/month swap risk.
 */
export const toGanttDate = (str) => {
    if (!str) return null;
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    const [, y, mo, d, h = '00', min = '00', sec = '00'] = m;
    return `${y}-${mo}-${d} ${h}:${min}:${sec}`;
};

/**
 * Convert DHTMLX Gantt format back to MySQL date.
 * Input:  "2025-05-04 10:30:00"
 * Output: "2025-05-04 10:30:00"
 */
export const toMysqlDate = (ganttStr) => {
    if (!ganttStr) return null;
    // Accept both "YYYY-MM-DD HH:MM:SS" and "YYYY-MM-DD HH:MM"
    const m = ganttStr.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    const [, y, mo, d, h, min, sec = '00'] = m;
    return `${y}-${mo}-${d} ${h}:${min}:${sec}`;
};

/**
 * Convert DHTMLX date to comparable format for sorting/comparison.
 * Since gantt format is now "YYYY-MM-DD HH:MM:SS", this is a direct passthrough.
 * Input:  "2025-05-04 10:30:00"
 * Output: "2025-05-04 10:30:00"
 */
export const toComparable = (ganttDate) => {
    if (!ganttDate) return null;
    return ganttDate.slice(0, 16); // "YYYY-MM-DD HH:MM" — enough for comparison
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
 * Convert JavaScript Date to DHTMLX Gantt format.
 * Input:  Date object
 * Output: "2025-05-04 10:30:00"
 */
export const jsDateToGantt = (date) => {
    if (!date) return null;
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
};

/**
 * Parse workspace weekend setting to working days array
 * Input: {"weekend": [6, 7]} (Sunday, Saturday in ISO format)
 * Output: [1, 2, 3, 4, 5] (Monday-Friday in JS format)
 * 
 * ISO weekday: 1=Monday, 7=Sunday
 * JS weekday: 0=Sunday, 1=Monday, 6=Saturday
 */
export const parseWorkDays = (weekendJson) => {
    const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]; // JS weekday format

    let parsed = weekendJson;

    // Parse JSON string if needed
    if (typeof weekendJson === 'string') {
        try {
            parsed = JSON.parse(weekendJson);
        } catch {
            // Default to Mon-Fri if parsing fails
            return [1, 2, 3, 4, 5];
        }
    }

    // Extract weekend days and convert from ISO to JS format
    const offDays = (parsed?.weekend ?? [])
        .map(d => API_TO_JS[d])
        .filter(d => d !== undefined);

    // Return working days (all days except weekends)
    return ALL_DAYS.filter(d => !offDays.includes(d));
};

/**
 * Snap date to nearest working day
 * @param {string} ganttDate - Date in DHTMLX format "04-05-2025 10:30"
 * @param {string} direction - 'forward' or 'backward'
 * @param {number[]} workDays - Array of working days in JS format [1,2,3,4,5]
 * @param {string[]} holidays - Array of holiday dates in "YYYY-MM-DD" format
 * @returns {string} Date in DHTMLX format
 */
export const snapToWorkingDay = (ganttDate, direction, workDays, holidays) => {
    if (!ganttDate) return ganttDate;

    const d = ganttToJsDate(ganttDate);
    if (!d) return ganttDate;

    // Create holiday set for quick lookup
    const holidaySet = new Set(
        (holidays || []).map(h => String(h).slice(0, 10))
    );

    // Check if a date is a working day
    const isWorking = (date) => {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return workDays.includes(date.getDay()) && !holidaySet.has(key);
    };

    // If already a working day, return as is
    if (isWorking(d)) return ganttDate;

    // Try to find nearest working day
    const delta = direction === 'forward' ? 1 : -1;
    const candidate = new Date(d);

    // Limit search to 30 days to prevent infinite loops
    for (let i = 0; i < 30; i++) {
        candidate.setDate(candidate.getDate() + delta);
        if (isWorking(candidate)) {
            return jsDateToGantt(candidate);
        }
    }

    // If no working day found within 30 days, return original
    return ganttDate;
};

/**
 * Check if a date is a working day
 * @param {Date} date - JavaScript Date object
 * @param {number[]} workDays - Array of working days in JS format
 * @param {string[]} holidays - Array of holiday dates in "YYYY-MM-DD" format
 * @returns {boolean}
 */
export const isWorkingDay = (date, workDays, holidays) => {
    if (!date) return false;

    const holidaySet = new Set(
        (holidays || []).map(h => String(h).slice(0, 10))
    );

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return workDays.includes(date.getDay()) && !holidaySet.has(key);
};

/**
 * Format date for display
 * @param {string} mysqlDate - Date in MySQL format "2025-05-04 10:30:00"
 * @returns {string} Formatted date "May 4, 2025"
 */
export const formatDisplayDate = (mysqlDate) => {
    if (!mysqlDate) return '';
    const d = new Date(mysqlDate);
    if (isNaN(d.getTime())) return mysqlDate;

    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

/**
 * Add days to a MySQL date
 * @param {string} mysqlDate - Date in MySQL format "2025-05-04 10:30:00"
 * @param {number} days - Number of days to add (can be negative)
 * @returns {string} Date in MySQL format
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
 * @param {string} startDate - Start date in MySQL format
 * @param {string} endDate - End date in MySQL format
 * @returns {number} Duration in days
 */
export const calculateDuration = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Include both start and end days
};