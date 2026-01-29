/**
 * Video Info Route
 * GET /api/info
 */

import { Router } from 'express';
import { getVideoInfo } from '../services/ytdlp.js';

const router = Router();

router.get('/', async (req, res) => {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ message: 'Video ID required' });
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;

    try {
        const info = await getVideoInfo(url);
        res.json(info);
    } catch (error) {
        console.error('Info error:', error);
        res.status(500).json({ message: error.message || 'Failed to get video info' });
    }
});

export default router;
