v1 — Original stable implementation. Basic link types (FTS/SST/FTF/STF),
     constraint types (ASAP/SNET/SNLT/FNET/FNLT/MSO/MFO), circular/hierarchy
     validation, gap_behavior handling. Uses duration_unit: 'day'.

v2 — Refined production version. Fixes v1's apply_constraints bug (constraints
     were being silently ignored under certain gap settings — now always
     enforced). Adds update_link operation, unified single "tasks" response
     array (replaces separate linkAdjustments/constraintUpdates), time_used
     field passthrough, move_subtasks_with_parent flag. Still duration_unit: 'day'.

v3 — Whole-day + hour-precision hybrid approach. Introduces the time_used
     flag as a real scheduling behavior (not just passthrough): true = hour-
     precision tasks, false = whole-day tasks. Switches duration_unit to
     'minute' (avoids rounding bugs found in both 'day' and 'hour' units).
     Adds inclusive/exclusive date boundary conversion (DHTMLX's end_date is
     exclusive; product needs inclusive "10th to 12th = 3 days"). Adds
     whole-day normalization: a time_used=false task linked to a time_used=true
     predecessor snaps to the next clean midnight instead of inheriting a
     mid-day clock time. First version to correctly handle MIXED time_used
     tasks linked together, including across weekends.