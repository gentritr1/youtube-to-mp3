/**
 * Video Info Route
 * GET /api/info
 */

import { Router, Request, Response } from 'express';
import { getVideoInfo } from '../services/ytdlp.js';
import { buildYouTubeWatchUrl, validateYouTubeVideoId } from '../utils/youtube.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
    const videoId = validateYouTubeVideoId(req.query.videoId);

    if (!videoId) {
        return res.status(400).json({ message: 'Invalid YouTube video ID' });
    }

    const url = buildYouTubeWatchUrl(videoId);

    try {
        const info = await getVideoInfo(url);
        res.json(info);
    } catch (error: any) {
        console.error('Info error:', error);
        res.status(500).json({ message: error.message || 'Failed to get video info' });
    }
});

export default router;
