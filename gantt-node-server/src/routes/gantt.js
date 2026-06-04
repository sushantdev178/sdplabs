// src/routes/gantt.js
import { Router } from 'express';
import { calculate, getProject } from '../controllers/ganttController.js';

const router = Router();

// POST /api/gantt/calculate - Calculate impact of task date changes
router.post('/calculate', calculate);

// GET /api/gantt/project-data - Get project data for frontend
router.get('/project-data', getProject);

export default router;