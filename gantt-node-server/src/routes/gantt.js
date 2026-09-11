// src/routes/gantt.js
import express from 'express';

import * as v1Controller from '../controllers/v1/ganttController.js';
import * as v2Controller from '../controllers/v2/ganttController.js';
import * as v3Controller from '../controllers/v3/ganttController.js';

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

// ── v3 routes (whole-day approach) ──
router.post('/v3/calculate', v3Controller.calculate);
router.post('/v3/calculate-impact', v3Controller.calculateImpact);
router.post('/v3/validate', v3Controller.validateLink);
router.get('/v3/project-data', v3Controller.getProject);

export default router;