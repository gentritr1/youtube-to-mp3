/**
 * Progress Route
 * GET /api/progress/:taskId
 */

import { Router, Request, Response } from 'express';
import { getTask } from '../services/taskManager.js';

const router = Router();

router.get('/progress/:taskId', (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;
    const task = getTask(taskId);

    if (!task) {
        return res.status(404).json({ message: 'Task not found' });
    }

    res.json(task);
});

export default router;
