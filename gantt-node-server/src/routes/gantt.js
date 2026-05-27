import { Router } from 'express';
import { recalculate, recalculateImpact, fetchProjectData, validateTaskLink } from '../controllers/ganttController.js';

const router = Router();
router.post('/recalculate', recalculate);
router.post('/recalculate-impact', recalculateImpact);
router.post('/validate-link', validateTaskLink);
router.get('/project-data', fetchProjectData);

export default router;