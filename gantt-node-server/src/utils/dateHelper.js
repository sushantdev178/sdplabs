// src/utils/dateHelper.js

const ISO_TO_JS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 0 };

export const toGanttDate = (str) => {
    if (!str) return null;
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!m) return null;
    const [, y, mo, d, h = '00', min = '00'] = m;
    return `${d}-${mo}-${y} ${h}:${min}`;
};

export const toMysqlDate = (ganttStr) => {
    if (!ganttStr) return null;
    const m = ganttStr.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})/);
    if (!m) return null;
    const [, d, mo, y, h, min] = m;
    return `${y}-${mo}-${d} ${h}:${min}:00`;
};

export const toComparable = (ganttDate) => {
    if (!ganttDate) return null;
    const m = ganttDate.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}:\d{2})/);
    if (!m) return null;
    return `${m[3]}-${m[2]}-${m[1]} ${m[4]}`;
};

export const ganttToJsDate = (ganttDate) => {
    if (!ganttDate) return null;
    const m = ganttDate.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
};

export const jsDateToGantt = (date) => {
    if (!date) return null;
    const pad = n => String(n).padStart(2, '0');
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const parseWorkDays = (weekendJson) => {
    const ALL = [0, 1, 2, 3, 4, 5, 6];
    let parsed = weekendJson;
    if (typeof weekendJson === 'string') {
        try { parsed = JSON.parse(weekendJson); } catch { return [1, 2, 3, 4, 5]; }
    }
    const offDays = (parsed?.weekend ?? []).map(d => ISO_TO_JS[d]).filter(d => d !== undefined);
    return ALL.filter(d => !offDays.includes(d));
};

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