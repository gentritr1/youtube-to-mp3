/**
 * Audio Preview Route
 * POST /api/preview - Generate a 30-second audio preview
 * GET /api/preview/:id - Stream the preview audio
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import {
    generatePreview,
    getPreviewPath,
    validatePreviewVideoId,
} from '../services/previewService.js';

const router = Router();

const INVALID_VIDEO_ID_MESSAGE = 'Invalid video ID. Must be alphanumeric with dashes/underscores only.';

// Generate audio preview
router.post('/', async (req: Request, res: Response) => {
    const rawVideoId = req.body?.videoId;
    const videoId = validatePreviewVideoId(rawVideoId);
    if (!videoId) {
        return res.status(400).json({
            success: false,
            message: INVALID_VIDEO_ID_MESSAGE
        });
    }

    try {
        const preview = await generatePreview(videoId);
        return res.json({
            success: true,
            ...preview
        });
    } catch (error: any) {
        console.error('[Preview] Generation error details:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate preview'
        });
    }
});

// Stream preview audio
router.get('/:videoId', async (req: Request, res: Response) => {
    const rawVideoId = req.params.videoId;
    const videoId = validatePreviewVideoId(rawVideoId);
    if (!videoId) {
        return res.status(400).json({
            success: false,
            message: INVALID_VIDEO_ID_MESSAGE
        });
    }

    const previewPath = getPreviewPath(videoId);
    if (!previewPath) {
        return res.status(404).json({
            success: false,
            message: 'Preview not found. Generate it first via POST /api/preview'
        });
    }

    const stat = fs.statSync(previewPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        // Parse range header
        const rangeMatch = range.match(/bytes=(\d*)-(\d*)/);
        if (!rangeMatch) {
            // Malformed range header
            res.writeHead(416, {
                'Content-Range': `bytes */${fileSize}`
            });
            return res.end();
        }

        // Parse start and end
        let start = rangeMatch[1] ? parseInt(rangeMatch[1], 10) : 0;
        let end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;

        // Validate parsed values are finite and non-negative
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < 0) {
            res.writeHead(416, {
                'Content-Range': `bytes */${fileSize}`
            });
            return res.end();
        }

        // Clamp values within valid range
        start = Math.max(0, Math.min(start, fileSize - 1));
        end = Math.max(start, Math.min(end, fileSize - 1));

        // Validate start <= end
        if (start > end) {
            res.writeHead(416, {
                'Content-Range': `bytes */${fileSize}`
            });
            return res.end();
        }

        const chunkSize = end - start + 1;

        const stream = fs.createReadStream(previewPath, { start, end });

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'audio/mpeg'
        });

        stream.pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': 'audio/mpeg',
            'Accept-Ranges': 'bytes'
        });

        fs.createReadStream(previewPath).pipe(res);
    }
});

export default router;
