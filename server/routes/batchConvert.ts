/**
 * Batch Convert Route
 * POST /api/batch-convert
 * 
 * Creates a new batch conversion job for multiple videos.
 * This is a thin route layer that delegates to batchService.
 */

import { Router, Request, Response } from 'express';
import { createBatch, addItemToBatch, MAX_BATCH_SIZE } from '../services/batchService.js';
import { BatchItem } from '../types.js';

const router = Router();

/**
 * POST /api/batch-convert
 * Create a new batch job with multiple videos
 * 
 * Body: {
 *   items: [{ videoId, format, title? }, ...]
 * }
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { items } = req.body as { items: BatchItem[] };

        if (!items || !Array.isArray(items)) {
            return res.status(400).json({
                message: 'Items array is required',
                example: { items: [{ videoId: 'dQw4w9WgXcQ', format: 'mp3', title: 'Never Gonna Give You Up' }] }
            });
        }

        const batch = createBatch(items);

        res.json({
            batchId: batch.batchId,
            totalItems: batch.totalItems,
            state: batch.state,
            message: `Batch created with ${batch.totalItems} items`
        });
    } catch (error: any) {
        console.error('[BatchConvert] Error:', error.message);

        // Return user-friendly error for validation failures
        if (error.message.includes('must') || error.message.includes('required') || error.message.includes('exceed')) {
            return res.status(400).json({ message: error.message });
        }

        res.status(500).json({ message: 'Failed to create batch' });
    }
});

/**
 * POST /api/batch-convert/:batchId/add
 * Add an item to an existing batch
 * 
 * Body: { videoId, format, title? }
 */
router.post('/:batchId/add', async (req: Request, res: Response) => {
    try {
        const { batchId } = req.params as { batchId: string };
        const item = req.body as BatchItem;

        if (!item.videoId || !item.format) {
            return res.status(400).json({ message: 'videoId and format are required' });
        }

        const batch = addItemToBatch(batchId, item);

        res.json({
            batchId: batch.batchId,
            totalItems: batch.totalItems,
            state: batch.state,
            message: 'Item added to batch'
        });
    } catch (error: any) {
        console.error('[BatchConvert] Add error:', error.message);

        if (error.message === 'Batch not found') {
            return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('Cannot add') || error.message.includes('exceed')) {
            return res.status(400).json({ message: error.message });
        }

        res.status(500).json({ message: 'Failed to add item to batch' });
    }
});

/**
 * GET /api/batch-convert/limits
 * Get batch limits for frontend use
 */
router.get('/limits', (_req: Request, res: Response) => {
    res.json({
        maxBatchSize: MAX_BATCH_SIZE,
        supportedFormats: ['mp3', 'mp4']
    });
});

export default router;
