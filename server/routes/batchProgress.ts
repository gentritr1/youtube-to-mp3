/**
 * Batch Progress Route
 * GET /api/batch-progress/:batchId
 * 
 * Returns progress for a batch conversion job.
 * Aggregates progress from all individual tasks in the batch.
 */

import { Router, Request, Response } from 'express';
import { getBatchProgress, getBatch } from '../services/batchService.js';

const router = Router();

/**
 * GET /api/batch-progress/:batchId
 * Get progress for a batch job
 */
router.get('/:batchId', async (req: Request, res: Response) => {
    try {
        const { batchId } = req.params as { batchId: string };

        // First check if batch exists
        const batch = getBatch(batchId);
        if (!batch) {
            return res.status(404).json({ message: 'Batch not found' });
        }

        // Get detailed progress
        const progress = getBatchProgress(batchId);
        if (!progress) {
            return res.status(500).json({ message: 'Failed to retrieve batch progress' });
        }

        res.json(progress);
    } catch (error: any) {
        console.error('[BatchProgress] Error:', error.message);
        res.status(500).json({ message: 'Failed to get batch progress' });
    }
});

export default router;
