// src/services/ganttTestService.js
//
// SELF-CONTAINED GANTT SCHEDULING SERVICE
// ─────────────────────────────────────────────────────────────
// All logic in one place: date helpers, DHTMLX setup, scheduling, validation.
// Uses mockData.json instead of DB — no database dependency.
// Same logic will be used in production with real DB data.
//
// TIMEZONE RULE:
// Node process MUST run with TZ=UTC (set in package.json scripts).
// DHTMLX gantt-node parses dates in LOCAL time.
// DB stores dates in UTC.
// TZ=UTC makes local = UTC = DB → no offset corruption.
// ─────────────────────────────────────────────────────────────

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const { Gantt } = require('@dhx/gantt-node');

// Load mock data (replaces DB queries)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_DB = JSON.parse(readFileSync(path.join(__dirname, '../data/mockData.json'), 'utf8'));

// ─────────────────────────────────────────────────────────────
// SECTION 1 — DATE HELPERS
// All dates are plain "YYYY-MM-DD HH:mm:ss" strings in DB.
// DHTMLX works with JS Date objects internally.
// We parse strings → Date using LOCAL constructors (matches DHTMLX).
// We format Date → strings using LOCAL getters (matches DHTMLX output).
// ─────────────────────────────────────────────────────────────

const pad = n => String(n).padStart(2, '0');

// MySQL string → JS Date (local time)
const toDate = (str) => {
    if (!str) return null;
    if (str instanceof Date) return str;
    const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    const [, y, mo, d, h = '0', min = '0', sec = '0'] = m;
    return new Date(+y, +mo - 1, +d, +h, +min, +sec); // LOCAL — matches DHTMLX internal parsing
};

// JS Date → MySQL string (local getters)
const toMysql = (date) => {
    if (!date) return null;
    if (!(date instanceof Date) || isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
};

// Safely convert any value (Date object or string) → MySQL string
const anyToMysql = (val) => {
    if (!val) return null;
    if (val instanceof Date) return toMysql(val);
    // Already a string — normalise format
    const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return null;
    const [, y, mo, d, h, min] = m;
    return `${y}-${mo}-${d} ${h}:${min}:00`;
};

// Minute-precision string for comparison (ignores seconds)
const toMin = (s) => s ? String(s).slice(0, 16) : null;

// ─────────────────────────────────────────────────────────────
// SECTION 2 — MOCK DATA FETCHING
// Simulates what DB queries return in production.
// ─────────────────────────────────────────────────────────────

// DB weekend format: 1=Sun, 2=Mon … 7=Sat
// JS day format:     0=Sun, 1=Mon … 6=Sat
const DB_TO_JS_DAY = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 };

const fetchContext = (workspace_id, project_id) => {
    const workspace = MOCK_DB.workspaces.find(w => w.id === workspace_id);
    if (!workspace) throw new Error(`Workspace ${workspace_id} not found`);

    const project = MOCK_DB.projects.find(p => p.id === project_id && p.workspace_id === workspace_id);
    if (!project) throw new Error(`Project ${project_id} not found`);

    // Convert DB weekend array [1,7] → JS off-days [0,6]
    const weekendJs = (workspace.weekend || []).map(d => DB_TO_JS_DAY[d]).filter(d => d !== undefined);
    // Working days = all days NOT in weekend
    const workDays = [0, 1, 2, 3, 4, 5, 6].filter(d => !weekendJs.includes(d));

    // Holidays: all off_days for this workspace (type=holidays or others)
    const holidays = MOCK_DB.off_days
        .filter(o => o.workspace_id === workspace_id)
        .map(o => String(o.date).slice(0, 10));

    // All tasks for this project (root + all descendants via parent_id chain)
    // In production this is done recursively via DB queries
    const allTasks = MOCK_DB.tasks.filter(t => t.workspace_id === workspace_id && t.project_id === project_id);

    // All links for this project
    const allLinks = MOCK_DB.task_links.filter(l => l.workspace_id === workspace_id && l.project_id === project_id);

    return { project, workDays, holidays, allTasks, allLinks };
};

// ─────────────────────────────────────────────────────────────
// SECTION 3 — VALIDATION (Pure JS, no DHTMLX needed)
// These can be called independently by Laravel for pre-checks.
// ─────────────────────────────────────────────────────────────

// Circular link detection using DFS.
// Only link edges in adjacency graph — NOT parent-child edges
// (parent-child in adj causes false cycle positives).
const hasCircularLink = (tasks, links) => {
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

// Hierarchy link validation.
// Blocked: parent → child, child → parent (same ancestor chain).
// Allowed: sibling → sibling, cross-hierarchy.
const hasHierarchyLink = (tasks, links) => {
    const parentOf = new Map(tasks.map(t => [t.id, t.parent_id ?? t.parent ?? 0]));

    // Walk up ancestor chain — return true if ancestorId is found
    const isAncestorOf = (ancestorId, taskId) => {
        let cur = parentOf.get(taskId);
        const seen = new Set();
        while (cur && cur !== 0) {
            if (seen.has(cur)) break; // cycle guard
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

// ─────────────────────────────────────────────────────────────
// SECTION 4 — DHTMLX GANTT INSTANCE SETUP
// All config must be set BEFORE gantt.parse().
// correct_work_time especially must be before parse so DHTMLX
// snaps bad DB dates (weekends/holidays) during ingest.
// ─────────────────────────────────────────────────────────────

// DB link type string → DHTMLX numeric string
const LINK_TYPE_MAP = {
    'finish_to_start': '0',
    'start_to_start': '1',
    'finish_to_finish': '2',
    'start_to_finish': '3'
};

const createGanttInstance = ({ workDays, holidays, project }) => {
    const gantt = Gantt.getGanttInstance({ plugins: { auto_scheduling: true } });

    // Date format must match our string format exactly
    gantt.config.date_format = "%Y-%m-%d %H:%i:%s";

    // duration in days
    gantt.config.duration_unit = 'day';

    // auto_types: false — all tasks stay type "task".
    // Parent tasks have independent DB-stored dates, not computed from children.
    gantt.config.auto_types = false;

    // Work time flags — both must match the project flag
    gantt.config.work_time = !!project.restrict_tasks_to_working_days;
    gantt.config.correct_work_time = !!project.restrict_tasks_to_working_days;
    // correct_work_time BEFORE parse → snaps bad dates during ingest automatically

    // Auto scheduling — disabled at setup, enabled manually AFTER all changes applied
    gantt.config.auto_scheduling = {
        enabled: false,
        show_constraints: true,
        apply_constraints: true,
        gap_behavior: project.auto_schedule_tasks_gap || 'keep',
        strict: project.auto_schedule_tasks_gap === 'compress'
    };

    // Work calendar — JS days 0=Sun … 6=Sat
    [0, 1, 2, 3, 4, 5, 6].forEach(day => {
        gantt.setWorkTime({ day, hours: workDays.includes(day) ? ['08:00-17:00'] : false });
    });

    // Holidays — specific off dates
    holidays.forEach(dateStr => {
        gantt.setWorkTime({ date: new Date(dateStr + 'T00:00:00'), hours: false });
    });

    return gantt;
};

// ─────────────────────────────────────────────────────────────
// SECTION 5 — DESCENDANT SHIFT
// When a task moves, all its descendants shift by the same offset.
// Controlled by move_subtasks_with_parent flag.
// Called before autoSchedule so shifted positions feed into cascade.
// isBulkUpdating guard prevents onAfterTaskAutoSchedule re-triggering.
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// SECTION 5 — DESCENDANT SHIFT (FIXED)
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// SECTION 5 — DESCENDANT SHIFT (FIXED FOR WORKING DAYS & WEEKENDS)
// ─────────────────────────────────────────────────────────────

const shiftDescendants = (gantt, parentId, offsetMs, isBulkUpdating) => {
    if (!offsetMs) return;
    const ids = [];
    gantt.eachTask(t => ids.push(t.id), parentId); // collects all descendants recursively
    if (!ids.length) return;

    const checkWorkTime = !!gantt.config.work_time;

    gantt.batchUpdate(() => {
        ids.forEach(id => {
            const child = gantt.getTask(id);
            if (!child) return;

            if (checkWorkTime) {
                // 1. Calculate the actual working duration before making the shift
                const duration = Math.max(1, gantt.calculateDuration({
                    start_date: child.start_date,
                    end_date: child.end_date,
                    task: child
                }));

                // 2. Compute raw shifted start date
                let newStart = new Date(child.start_date.getTime() + offsetMs);

                // 3. If it lands on a weekend/off-day, snap it forward to a working day
                if (!gantt.isWorkTime(newStart)) {
                    newStart = gantt.getClosestWorkTime({ date: newStart, dir: 'future' });
                }

                // 4. Protect duration by letting DHTMLX project the end date accurately
                let newEnd = gantt.calculateEndDate({
                    start_date: newStart,
                    duration: duration,
                    unit: 'day',
                    task: child
                });

                // 5. Apply clean dates back to the child object
                child.start_date = newStart;
                child.end_date = newEnd;
            } else {
                // Fallback to raw math if restrict_tasks_to_working_days is disabled
                if (child.start_date instanceof Date) child.start_date = new Date(child.start_date.getTime() + offsetMs);
                if (child.end_date instanceof Date) child.end_date = new Date(child.end_date.getTime() + offsetMs);
            }

            isBulkUpdating.value = true;
            gantt.updateTask(id);
            isBulkUpdating.value = false;
        });
    });
};

// ─────────────────────────────────────────────────────────────
// SECTION 6 — MAIN SCHEDULING FUNCTION
// Full pipeline: validate → parse → apply changes → schedule → diff
// ─────────────────────────────────────────────────────────────

export const runScheduling = ({ context, task_id, triggeredDates }) => {
    const { project, workDays, holidays, allTasks, allLinks } = context;

    // ── Validation ──
    const circularCheck = hasCircularLink(allTasks, allLinks);
    if (circularCheck) {
        return { success: false, error: 'Circular link detected — scheduling blocked' };
    }
    const hierarchyCheck = hasHierarchyLink(allTasks, allLinks);
    if (hierarchyCheck.found) {
        return { success: false, error: `Hierarchy link blocked: ${hierarchyCheck.reason}` };
    }

    // ── auto_schedule_tasks flag OFF → return early ──
    if (!project.auto_schedule_tasks) {
        return {
            success: false,
            message: 'Auto-scheduling is disabled for this project'
            // data: { triggeredTask: null, linkAdjustments: [], impactedTaskIds: [], project: null, constraintUpdates: [] }
        };
    }

    // ── Snapshot: DB state BEFORE any processing ──
    // Taken from raw data before DHTMLX touches anything.
    // Used at end to detect all changes regardless of their source.
    const snapshot = new Map(allTasks.map(t => [t.id, {
        start_at: t.start_at,
        due_at: t.due_at,
        constraint_type: t.constraint_type,
        constraint_date: t.constraint_date
    }]));

    // ── Normalise tasks for DHTMLX ──
    const normTasks = allTasks.map(t => ({
        id: t.id,
        text: t.name || `Task ${t.id}`,
        type: 'task',
        parent: t.parent_id ?? 0,
        start_date: toDate(t.start_at),
        end_date: toDate(t.due_at),
        progress: 0,
        open: true,
        constraint_type: t.constraint_type || 'asap',
        constraint_date: t.constraint_date ? toDate(t.constraint_date) : null
    }));

    // ── Normalise links for DHTMLX ──
    const normLinks = allLinks.map(l => ({
        id: l.id,
        source: l.source_task_id,
        target: l.target_task_id,
        type: LINK_TYPE_MAP[l.type] ?? '0'
    }));

    // ── Create DHTMLX instance and parse ──
    const gantt = createGanttInstance({ workDays, holidays, project });
    // parse() with correct_work_time=true automatically snaps any bad DB dates
    gantt.parse({ data: normTasks, links: normLinks });

    const isUpdateTask = !!(task_id && triggeredDates?.start_at && triggeredDates?.due_at);

    // ── Phase 1: bring gantt to rendered state (mirrors GUI page load) ──
    // On the GUI, autoSchedule runs once after parse before the user can
    // interact. All tasks are already in their scheduled positions when the
    // user drags a task. We must match that state here so the triggered task
    // dates are applied on top of the scheduled state, not the raw DB state.
    // Without this, a parent task that moves due to links/constraints in
    // Phase 2 would incorrectly drag the triggered task with it, because the
    // parent's DB position ≠ its GUI-rendered position.
    // Only needed for update_task_dates — autoschedule-only skips to Phase 2.
    const phase1Snapshot = new Map(); // captures scheduled state as baseline for descendant shift offsets
    if (isUpdateTask) {
        gantt.config.auto_scheduling.enabled = true;
        gantt.autoSchedule();
        gantt.config.auto_scheduling.enabled = false; // disable again for Phase 2 setup

        // Capture Phase 1 state — used as "before" baseline in onAfterTaskAutoSchedule
        // so descendant shift offsets are relative to Phase 1 positions, not raw DB positions
        gantt.eachTask(t => {
            phase1Snapshot.set(t.id, {
                start_at: anyToMysql(t.start_date),
                due_at: anyToMysql(t.end_date)
            });
        });
    }

    // ── Apply triggered task date change ──
    let offsetMs = 0;

    if (isUpdateTask) {
        const task = gantt.getTask(task_id);
        if (task) {
            const oldStart = task.start_date.getTime();
            let newStart = toDate(triggeredDates.start_at);
            let newEnd = toDate(triggeredDates.due_at);

            if (project.restrict_tasks_to_working_days) {
                const workingDuration = Math.max(
                    1,
                    gantt.calculateDuration({ start_date: newStart, end_date: newEnd, task })
                );

                if (!gantt.isWorkTime(newStart)) {
                    newStart = gantt.getClosestWorkTime({ date: newStart, dir: 'future' });
                }
                newEnd = gantt.calculateEndDate({ start_date: newStart, duration: workingDuration, unit: 'day', task });

                // Final end snap
                if (!gantt.isWorkTime(newEnd)) {
                    newEnd = gantt.getClosestWorkTime({ date: newEnd, dir: 'future' });
                }
            }

            task.start_date = newStart;
            task.end_date = newEnd;

            const startChanged = newStart.getTime() !== oldStart;
            if (startChanged) {
                task.constraint_type = 'snet';
                task.constraint_date = newStart;
            }

            offsetMs = newStart.getTime() - oldStart;
            gantt.updateTask(task_id);
        }
    }
    // ── move_subtasks_with_parent: shift descendants of triggered task ──
    const isBulkUpdating = { value: false };

    if (project.move_subtasks_with_parent && task_id && offsetMs !== 0) {
        console.log(`[SHIFT] shifting descendants of ${task_id} by ${offsetMs / 86400000} days`);
        shiftDescendants(gantt, task_id, offsetMs, isBulkUpdating);
    }

    // ── onAfterTaskAutoSchedule: shift descendants when autoSchedule moves any task ──
    // This handles cascade: if autoSchedule moves Task B (due to a link from Task A),
    // Task B's descendants also follow — controlled by move_subtasks_with_parent flag.
    if (project.move_subtasks_with_parent) {
        gantt.attachEvent('onAfterTaskAutoSchedule', (task, newDate, constraint, predecessor) => {
            if (isBulkUpdating.value) return;
            const t = gantt.getTask(task.id);
            if (!t) return;

            // Use Phase 1 state as the "before" baseline — not raw DB snapshot.
            // Phase 1 already applied link/constraint scheduling, so the offset
            // must be relative to the Phase 1 position to avoid double-counting
            // movement that already happened before the user's action.
            const phase1State = phase1Snapshot.get(task.id);
            const snap = phase1State || snapshot.get(task.id);
            if (!snap) return;

            const before = toDate(snap.start_at);
            const after = t.start_date instanceof Date ? t.start_date : toDate(String(t.start_date));
            if (!before || !after) return;
            const autoOffset = after.getTime() - before.getTime();
            if (!autoOffset) return;
            console.log(`[AUTO SHIFT] task ${task.id} moved by autoSchedule → shifting its descendants by ${autoOffset / 86400000} days`);
            shiftDescendants(gantt, task.id, autoOffset, isBulkUpdating);
        });
    }

    // ── Enable auto_scheduling and run full project schedule ──
    // Always full gantt.autoSchedule() — never partial (taskId arg) which limits cascades.
    gantt.config.auto_scheduling.enabled = true;
    gantt.autoSchedule();

    // Post-autoSchedule end-date correction (critical for original dates on weekends/holidays)
    if (project.restrict_tasks_to_working_days) {
        gantt.eachTask(task => {
            if (!gantt.isWorkTime(task.end_date)) {
                task.end_date = gantt.getClosestWorkTime({ date: task.end_date, dir: 'future' });
                gantt.updateTask(task.id);
            }
        });
    }


    // ── Collect final state from DHTMLX ──
    const finalTasks = [];
    normTasks.forEach(({ id }) => {
        const t = gantt.getTask(id);
        if (!t) return;
        finalTasks.push({
            id,
            start_at: anyToMysql(t.start_date),
            due_at: anyToMysql(t.end_date),
            constraint_type: t.constraint_type || null,
            constraint_date: t.constraint_date ? anyToMysql(t.constraint_date) : null
        });
    });

    gantt.destructor();

    // ── Diff: final state vs DB snapshot ──
    // Catches ALL change sources in one pass:
    //   correct_work_time snap during parse
    //   triggered task manual change + snap
    //   descendant shift
    //   autoSchedule cascade
    // Principle: don't track the process, compare the outcome.
    const changed = [];
    const constraintMap = new Map();

    finalTasks.forEach(t => {
        const before = snapshot.get(t.id);
        if (!before) return;

        const dateChanged =
            toMin(t.start_at) !== toMin(before.start_at) ||
            toMin(t.due_at) !== toMin(before.due_at);

        const constraintChanged =
            t.constraint_type !== before.constraint_type ||
            toMin(t.constraint_date) !== toMin(before.constraint_date);

        if (constraintChanged) {
            constraintMap.set(t.id, { constraint_type: t.constraint_type, constraint_date: t.constraint_date });
        }

        if (dateChanged || constraintChanged) {
            changed.push(t);
        }
    });

    // ── Build response ──
    const triggeredFinal = isUpdateTask ? finalTasks.find(t => t.id === task_id) : null;
    const linkAdjustments = changed.filter(t => t.id !== task_id);
    const impactedTaskIds = [...new Set([
        ...(triggeredFinal ? [task_id] : []),
        ...linkAdjustments.map(t => t.id)
    ])];

    // Project date extension check
    const allFinalDates = finalTasks.filter(t => t.start_at && t.due_at);
    const minStart = allFinalDates.reduce((m, t) => (!m || t.start_at < m ? t.start_at : m), null);
    const maxEnd = allFinalDates.reduce((m, t) => (!m || t.due_at > m ? t.due_at : m), null);

    let projectResult = null;

    if (maxEnd) {
        const currentDue = project.due_date ? toDate(project.due_date) : null;
        const isExtension = !currentDue || maxEnd > project.due_date;

        if (isExtension) {
            projectResult = {
                start_at: minStart,
                due_at: maxEnd,
                isExtension: true
            };
        }
    }

    return {
        success: true,
        message: 'Impact recalculation complete',
        data: {
            triggeredTask: triggeredFinal ? {
                id: triggeredFinal.id,
                start_at: triggeredFinal.start_at,
                due_at: triggeredFinal.due_at,
                constraint_type: constraintMap.get(task_id)?.constraint_type ?? snapshot.get(task_id)?.constraint_type ?? null,
                constraint_date: constraintMap.get(task_id)?.constraint_date ?? snapshot.get(task_id)?.constraint_date ?? null
            } : null,

            linkAdjustments: linkAdjustments.map(t => ({
                id: t.id,
                start_at: t.start_at,
                due_at: t.due_at,
                constraint_type: constraintMap.get(t.id)?.constraint_type ?? snapshot.get(t.id)?.constraint_type ?? null,
                constraint_date: constraintMap.get(t.id)?.constraint_date ?? snapshot.get(t.id)?.constraint_date ?? null
            })),

            impactedTaskIds,
            project: projectResult,

            constraintUpdates: [...constraintMap.entries()].map(([id, c]) => ({
                id,
                constraint_type: c.constraint_type,
                constraint_date: c.constraint_date
            }))
        }
    };
};

// ─────────────────────────────────────────────────────────────
// SECTION 7 — PUBLIC API HANDLER
// Called by the route. Fetches context from mock data and runs scheduling.
// ─────────────────────────────────────────────────────────────

export const handleTestCalculate = (req, res) => {
    try {
        const { workspace_id, project_id, task_id, start_at, due_at } = req.body;

        if (!workspace_id || !project_id) {
            return res.status(400).json({ success: false, error: 'workspace_id and project_id are required' });
        }

        // Fetch all context from mock data (replaces DB queries in production)
        const context = fetchContext(Number(workspace_id), Number(project_id));

        // Determine operation
        const triggeredDates = (task_id && start_at && due_at)
            ? { start_at, due_at }
            : null;

        console.log('\n========== TEST CALCULATE ==========');
        console.log('Operation:', triggeredDates ? 'update_task_dates' : 'autoschedule');
        console.log('Flags:', {
            auto_schedule_tasks: context.project.auto_schedule_tasks,
            move_subtasks_with_parent: context.project.move_subtasks_with_parent,
            restrict_tasks_to_working_days: context.project.restrict_tasks_to_working_days,
            auto_schedule_tasks_gap: context.project.auto_schedule_tasks_gap
        });

        const result = runScheduling({
            context,
            task_id: task_id ? Number(task_id) : null,
            triggeredDates
        });

        return res.json(result);

    } catch (err) {
        console.error('Test calculate error:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
};