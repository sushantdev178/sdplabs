// src/routes/taskUtility.js
import express from 'express';

import * as taskUtilityController from '../controllers/utility/taskController.js';

const router = express.Router();

// ── Gantt-independent task utility routes ──
router.post('/v3/utility/duration', taskUtilityController.duration);

export default router;