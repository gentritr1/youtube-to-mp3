/**
 * Convert Route
 * POST /api/convert
 */

import { Router } from 'express';
import { randomUUID } from 'crypto';
import { findExistingTask, createTask } from '../services/taskManager.js';
import { convertVideo } from '../services/ytdlp.js';

const router = Router();

router.post('/', async (req, res) => {
    const { videoId, format } = req.body;

    if (!videoId || !format) {
        return res.status(400).json({ message: 'Video ID and format required' });
    }

    if (!['mp3', 'mp4'].includes(format)) {
        return res.status(400).json({ message: 'Format must be mp3 or mp4' });
    }

    // Idempotency check
    const existingTaskId = findExistingTask(videoId, format);
    if (existingTaskId) {
        return res.json({ taskId: existingTaskId });
    }

    const taskId = randomUUID();
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const title = req.body.title || 'video';

    // Initialize task
    createTask(taskId, {
        state: 'processing',
        progress: 0,
        status: 'Starting...',
        videoId,
        format,
        title,
    });

    // Start conversion in background
    convertVideo(taskId, url, format);

    res.json({ taskId });
});

export default router;
