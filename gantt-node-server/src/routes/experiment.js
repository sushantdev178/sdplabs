// src/routes/experiment.js
import express from 'express';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Gantt } = require('@dhx/gantt-node');

const router = express.Router();

// ── STATIC DATA ──────────────────────────────────────────────────────────
const staticTasks = [
    {
        id: 1,
        text: 'Task A (time_used true, 6h)',
        start_date: '2026-09-02 10:00:00',
        due_date: '2026-09-02 16:00:00',
        time_used: true,
    },
    {
        id: 2,
        text: 'Task B (time_used false, whole day)',
        start_date: '2026-09-04 10:00:00',
        due_date: '2026-09-04 19:00:00',
        time_used: false,
    },
    {
        id: 3,
        text: 'Task C (time_used true, 3h)',
        start_date: '2026-09-05 14:00:00',
        due_date: '2026-09-07 17:00:00',
        time_used: true,
    },
    {
        id: 4,
        text: 'Task D (time_used false, whole day, Sunday start)',
        start_date: '2026-09-07 10:00:00',
        due_date: '2026-09-07 19:00:00',
        time_used: false,
    },
];

const staticLinks = [
    { source: 1, target: 2, type: 'finish_to_start' },
    { source: 2, target: 3, type: 'finish_to_start' },
    { source: 3, target: 4, type: 'finish_to_start' },
];

// Custom working hours: 10:00 - 19:00, Mon-Fri (1=Monday ... 5=Friday)
const workingHours = {
    1: { start: '10:00', end: '19:00' },
    2: { start: '10:00', end: '19:00' },
    3: { start: '10:00', end: '19:00' },
    4: { start: '10:00', end: '18:00' },
    5: { start: '10:00', end: '19:00' },
};

// ── HELPERS ──────────────────────────────────────────────────────────────
function parseDate(str) {
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d) ? null : d;
}

function formatDate(date) {
    if (!date) return null;
    return date.toISOString().replace('T', ' ').slice(0, 19);
}

function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function isWorkingDay(date) {
    const day = date.getDay();
    const wh = workingHours[day];
    return !!(wh && wh.start && wh.end);
}

function getWorkingDayStart(date) {
    const day = date.getDay();
    const wh = workingHours[day];
    if (!wh) return null;
    const [h, m] = wh.start.split(':').map(Number);
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d;
}

function getWorkingDayEnd(date) {
    const day = date.getDay();
    const wh = workingHours[day];
    if (!wh) return null;
    const [h, m] = wh.end.split(':').map(Number);
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d;
}

function getWorkingDayDuration(date) {
    const day = date.getDay();
    const wh = workingHours[day];
    if (!wh) return 0;
    return timeToMinutes(wh.end) - timeToMinutes(wh.start);
}

function addMinutes(date, minutes) {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() + minutes);
    return d;
}

function getNextWorkingDayStart(date) {
    let d = new Date(date);
    d.setDate(d.getDate() + 1);
    while (!isWorkingDay(d)) {
        d.setDate(d.getDate() + 1);
    }
    return getWorkingDayStart(d);
}

// ── CUSTOM SCHEDULER ────────────────────────────────────────────────────
function scheduleProject(tasks, links) {
    // Build adjacency: for each task, list of successors
    const successors = {};
    tasks.forEach(t => { successors[t.id] = []; });
    links.forEach(l => {
        if (successors[l.source]) {
            successors[l.source].push(l.target);
        }
    });

    // Build indegree for topological sort
    const indegree = {};
    tasks.forEach(t => { indegree[t.id] = 0; });
    links.forEach(l => {
        if (indegree[l.target] !== undefined) {
            indegree[l.target] += 1;
        }
    });

    // Topological sort to process tasks in dependency order
    const queue = tasks.filter(t => indegree[t.id] === 0).map(t => t.id);
    const order = [];
    while (queue.length) {
        const id = queue.shift();
        order.push(id);
        const succ = successors[id] || [];
        succ.forEach(sid => {
            indegree[sid] -= 1;
            if (indegree[sid] === 0) queue.push(sid);
        });
    }

    // If there are cycles, order will be incomplete; but we assume no cycles.
    const taskMap = {};
    tasks.forEach(t => { taskMap[t.id] = t; });

    // Initialize start/end dates for each task
    const scheduled = {};
    tasks.forEach(t => {
        scheduled[t.id] = {
            start: parseDate(t.start_date),
            end: parseDate(t.due_date),
        };
    });

    // Process tasks in topological order
    order.forEach(id => {
        const task = taskMap[id];
        const timeUsed = task.time_used;
        let start = scheduled[id].start;
        let end = scheduled[id].end;

        // Find predecessors (incoming links)
        const preds = links.filter(l => l.target === id);
        let predEnd = null;
        preds.forEach(l => {
            const predId = l.source;
            if (scheduled[predId] && scheduled[predId].end) {
                const pe = scheduled[predId].end;
                if (!predEnd || pe > predEnd) predEnd = pe;
            }
        });

        if (predEnd) {
            // Predecessor exists
            if (timeUsed) {
                // Time-used: start at predEnd (if it's within working hours, else snap)
                let candidate = new Date(predEnd);
                // If candidate is not on a working day, move to next working day start
                if (!isWorkingDay(candidate)) {
                    candidate = getNextWorkingDayStart(candidate);
                } else {
                    // If candidate is before working hours start, snap to start
                    const dayStart = getWorkingDayStart(candidate);
                    if (candidate < dayStart) {
                        candidate = dayStart;
                    } else {
                        // If candidate is after working hours end, move to next working day
                        const dayEnd = getWorkingDayEnd(candidate);
                        if (candidate >= dayEnd) {
                            candidate = getNextWorkingDayStart(candidate);
                        }
                    }
                }
                start = candidate;
                // End = start + duration (duration from original data)
                // We need duration; for time-used, we have due_date - start_date originally
                // We'll compute duration from the original start/end if present, else default 60
                let duration = 60;
                if (task.start_date && task.due_date) {
                    const origStart = parseDate(task.start_date);
                    const origEnd = parseDate(task.due_date);
                    if (origStart && origEnd) {
                        duration = (origEnd - origStart) / (1000 * 60);
                        if (duration <= 0) duration = 60;
                    }
                }
                end = addMinutes(start, duration);
                // Ensure end does not exceed working day end; if it does, split to next day?
                // For simplicity, we keep it as is, assuming duration fits.
            } else {
                // Whole-day: start on the next working day after predEnd, at working day start
                let candidate = new Date(predEnd);
                // Move to next working day start
                candidate = getNextWorkingDayStart(candidate);
                start = candidate;
                // End = end of that working day
                end = getWorkingDayEnd(candidate);
                if (!end) {
                    // fallback: add duration
                    const dur = getWorkingDayDuration(candidate) || 540;
                    end = addMinutes(start, dur);
                }
            }
        } else {
            // No predecessor – use original dates, but ensure they are on working days
            // For whole-day, ensure start is at working day start and end at working day end
            if (!timeUsed) {
                if (!isWorkingDay(start)) {
                    start = getNextWorkingDayStart(start);
                } else {
                    const dayStart = getWorkingDayStart(start);
                    if (start < dayStart) start = dayStart;
                }
                end = getWorkingDayEnd(start);
                if (!end) {
                    const dur = getWorkingDayDuration(start) || 540;
                    end = addMinutes(start, dur);
                }
            } else {
                // Time-used: ensure start is within working hours
                if (!isWorkingDay(start)) {
                    start = getNextWorkingDayStart(start);
                } else {
                    const dayStart = getWorkingDayStart(start);
                    if (start < dayStart) start = dayStart;
                    const dayEnd = getWorkingDayEnd(start);
                    if (start >= dayEnd) {
                        start = getNextWorkingDayStart(start);
                    }
                }
                // If due_date is provided, compute duration from original start/end
                if (task.start_date && task.due_date) {
                    const origStart = parseDate(task.start_date);
                    const origEnd = parseDate(task.due_date);
                    if (origStart && origEnd) {
                        const dur = (origEnd - origStart) / (1000 * 60);
                        if (dur > 0) {
                            end = addMinutes(start, dur);
                        }
                    }
                }
                if (!end) {
                    // fallback: add 60 minutes
                    end = addMinutes(start, 60);
                }
            }
        }

        // Update scheduled
        scheduled[id].start = start;
        scheduled[id].end = end;
    });

    // Build result tasks
    const resultTasks = tasks.map(t => {
        const s = scheduled[t.id];
        return {
            id: t.id,
            text: t.text,
            start_date: s.start ? formatDate(s.start) : null,
            due_date: s.end ? formatDate(s.end) : null,
            duration: s.start && s.end ? (s.end - s.start) / (1000 * 60) : null,
            time_used: t.time_used,
            constraint_type: 'asap',
            constraint_date: null,
        };
    });

    return resultTasks;
}

// ── ROUTE ──────────────────────────────────────────────────────────────────
router.post('/schedule', async (req, res) => {
    try {
        const { task_id, start_at, due_at } = req.body;

        // 1. Clone static tasks and apply overrides (only dates)
        let tasks = staticTasks.map(t => ({ ...t }));
        if (task_id) {
            const idx = tasks.findIndex(t => t.id === task_id);
            if (idx !== -1) {
                if (start_at !== undefined) tasks[idx].start_date = start_at;
                if (due_at !== undefined) tasks[idx].due_date = due_at;
            }
        }

        // 2. Run custom scheduler
        const scheduledTasks = scheduleProject(tasks, staticLinks);

        return res.json({
            success: true,
            data: {
                tasks: scheduledTasks,
                links: staticLinks.map(l => ({
                    id: `link_${l.source}_${l.target}`,
                    source: l.source,
                    target: l.target,
                    type: '0',
                })),
                working_hours: workingHours,
            },
        });
    } catch (err) {
        console.error('[experiment/schedule] error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

export default router;