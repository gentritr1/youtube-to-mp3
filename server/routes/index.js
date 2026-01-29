/**
 * Route Aggregator
 * Combines all API routes with rate limiting
 */

import { Router } from 'express';
import infoRoute from './info.js';
import convertRoute from './convert.js';
import progressRoute from './progress.js';
import downloadRoute from './download.js';
import { conversionLimiter, infoLimiter, downloadLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Apply route-specific rate limits
router.use('/info', infoLimiter, infoRoute);
router.use('/convert', conversionLimiter, convertRoute);
router.use('/download', downloadLimiter, downloadRoute);

// Progress doesn't need strict rate limiting (polling)
router.use(progressRoute);

export default router;

