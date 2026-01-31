/**
 * Download Route
 * GET /api/download/:taskId/:filename?
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import { getTask } from '../services/taskManager.js';

const router = Router();

router.get('/:taskId/:filename?', (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;
    const task = getTask(taskId);

    if (!task || task.state !== 'completed' || !task.filename) {
        return res.status(404).json({ message: 'File not found or still processing' });
    }

    const filePath = path.join(config.DOWNLOADS_DIR, task.filename);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return res.status(404).json({ message: 'File no longer exists' });
    }

    // Explicitly set content type
    const contentType = task.format === 'mp3' ? 'audio/mpeg' : 'video/mp4';
    res.setHeader('Content-Type', contentType);

    console.log(`[Download] Serving file: ${task.filename}`);
    res.download(filePath, task.filename);
});

export default router;
