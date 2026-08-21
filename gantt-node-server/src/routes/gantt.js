// src/routes/gantt.js
import express from 'express';

import * as v1Controller from '../controllers/v1/ganttController.js';
import * as v2Controller from '../controllers/v2/ganttController.js';

const router = express.Router();

// ── v1 routes (stable, production) ──
router.post('/v1/calculate', v1Controller.calculate);
router.post('/v1/calculate-impact', v1Controller.calculateImpact);
router.post('/v1/validate', v1Controller.validateLink);
router.get('/v1/project-data', v1Controller.getProject);

// ── v2 routes (in development — DHTMLX support fixes go here) ──
router.post('/v2/calculate', v2Controller.calculate);
router.post('/v2/calculate-impact', v2Controller.calculateImpact);
router.post('/v2/validate', v2Controller.validateLink);
router.get('/v2/project-data', v2Controller.getProject);

export default router;