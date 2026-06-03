import { Router } from 'express';
import { recalculateImpact, fetchProjectData, validateTaskLink } from '../controllers/ganttController.js';

const router = Router();
router.post('/calculate', recalculateImpact);
router.post('/validate-link', validateTaskLink);
router.get('/project-data', fetchProjectData);

export default router;