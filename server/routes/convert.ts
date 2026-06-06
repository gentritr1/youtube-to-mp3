/**
 * Convert Route
 * POST /api/convert
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { findExistingTask, createTask } from '../services/taskStore.js';
import { startConversion } from '../services/conversionRunner.js';
import { validateYouTubeVideoId } from '../utils/youtube.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
    const { format, title } = req.body as { videoId: string; format: string; title?: string };
    const videoId = validateYouTubeVideoId(req.body?.videoId);

    if (!videoId || !format) {
        return res.status(400).json({ message: 'Valid video ID and format required' });
    }

    if (!['mp3', 'mp4'].includes(format)) {
        return res.status(400).json({ message: 'Format must be mp3 or mp4' });
    }

    // Idempotency check
    const existingTask = findExistingTask(videoId, format);
    if (existingTask) {
        return res.json({ taskId: existingTask.taskId });
    }

    const taskId = randomUUID();
    const safeTitle = title || 'video';

    // Initialize task
    createTask({
        taskId,
        videoId,
        format,
        title: safeTitle,
        state: 'processing',
        progress: 0,
        status: 'Starting...',
    });

    // Start conversion in background
    startConversion(taskId, videoId, format, safeTitle);

    res.json({ taskId });
});

export default router;
