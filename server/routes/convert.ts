/**
 * Convert Route
 * POST /api/convert
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { findExistingTask, createTask } from '../services/taskStore.js';
import { convertVideo } from '../services/ytdlp.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
    const { videoId, format, title } = req.body as { videoId: string; format: string; title?: string };

    if (!videoId || !format) {
        return res.status(400).json({ message: 'Video ID and format required' });
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
    const url = `https://www.youtube.com/watch?v=${videoId}`;
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
    convertVideo(taskId, url, format);

    res.json({ taskId });
});

export default router;
