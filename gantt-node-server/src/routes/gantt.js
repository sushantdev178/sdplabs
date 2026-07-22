// src/routes/gantt.js
import express from 'express';
import {
    calculate,
    calculateImpact,
    validateLink,
    getProject
} from '../controllers/ganttController.js';

const router = express.Router();

// Full calculation for saving to database
router.post('/v1/calculate', calculate);
// Preview calculation (max 10 tasks) for UI warnings
router.post('/v1/calculate-impact', calculateImpact);

// Standalone validation (circular/hierarchy checks)
router.post('/validate', validateLink);

// Data fetching for the frontend GUI
router.get('/project-data', getProject);

export default router;