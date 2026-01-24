/**
 * Route Aggregator
 * Combines all API routes
 */

import { Router } from 'express';
import infoRoute from './info.js';
import convertRoute from './convert.js';
import progressRoute from './progress.js';
import downloadRoute from './download.js';

const router = Router();

router.use(infoRoute);
router.use(convertRoute);
router.use(progressRoute);
router.use(downloadRoute);

export default router;
