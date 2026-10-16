// src/routes/gantt.js
import express from 'express';

import * as v4Controller from '../controllers/v4/ganttController.js';
import * as v5Controller from '../controllers/v5/ganttController.js';

import * as taskUtilityController from '../controllers/utility/taskController.js';


const router = express.Router();


// ── v4 routes (whole-day approach) ──
router.post('/v4/calculate', v4Controller.calculate);
router.post('/v4/calculate-impact', v4Controller.calculateImpact);
router.post('/v4/validate', v4Controller.validateLink);
router.get('/v4/project-data', v4Controller.getProject);
router.post('/v4/utility/duration', taskUtilityController.duration);


// ── v5 routes (whole-day approach) ──
router.post('/v5/calculate', v5Controller.calculate);
router.post('/v5/calculate-impact', v5Controller.calculateImpact);
router.post('/v5/validate', v5Controller.validateLink);
router.get('/v5/project-data', v5Controller.getProject);

// ── v5 utility (duration) ──
router.post('/v5/utility/duration', taskUtilityController.duration);

export default router;