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

const INVALID_VIDEO_ID_MESSAGE = 'Invalid YouTube video ID. Expected 11 URL-safe characters.';
const PREVIEW_UNAVAILABLE_MESSAGE = 'Preview is unavailable for this track. You can still convert it or try another video.';
const TECHNICAL_PREVIEW_ERROR_PATTERN = /ffmpeg|yt-dlp|exited with code|muxer|output format/i;

export interface PreviewRange {
    start: number;
    end: number;
}

export const parsePreviewRange = (range: string, fileSize: number): PreviewRange | null => {
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
        return null;
    }

    const rangeMatch = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!rangeMatch) {
        return null;
    }

    const [, startValue, endValue] = rangeMatch;
    if (!startValue && !endValue) {
        return null;
    }

    if (!startValue && endValue) {
        const suffixLength = parseInt(endValue, 10);
        if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
            return null;
        }

        return {
            start: Math.max(0, fileSize - suffixLength),
            end: fileSize - 1
        };
    }

    const start = parseInt(startValue, 10);
    const requestedEnd = endValue ? parseInt(endValue, 10) : fileSize - 1;
    if (
        !Number.isFinite(start)
        || !Number.isFinite(requestedEnd)
        || start < 0
        || requestedEnd < 0
        || start > requestedEnd
        || start >= fileSize
    ) {
        return null;
    }

    return {
        start,
        end: Math.min(requestedEnd, fileSize - 1)
    };
};

const sendRangeNotSatisfiable = (res: Response, fileSize: number) => {
    res.writeHead(416, {
        'Content-Range': `bytes */${fileSize}`
    });
    return res.end();
};

const getPreviewGenerationMessage = (error: unknown): string => {
    const message = error instanceof Error ? error.message : '';
    if (!message || TECHNICAL_PREVIEW_ERROR_PATTERN.test(message)) {
        return PREVIEW_UNAVAILABLE_MESSAGE;
    }

    return message;
};

const handlePreviewStreamError = (res: Response, error: Error) => {
    console.error('[Preview] Stream error:', error);
    if (res.headersSent) {
        res.destroy(error);
        return;
    }

    res.statusCode = 500;
    res.end();
};

const pipePreviewStream = (stream: fs.ReadStream, res: Response) => {
    const cleanup = () => {
        stream.off('error', onError);
        stream.off('end', onEnd);
        stream.off('close', onClose);
    };

    const onError = (error: Error) => {
        cleanup();
        handlePreviewStreamError(res, error);
    };

    const onEnd = () => {
        cleanup();
    };

    const onClose = () => {
        cleanup();
    };

    stream.on('error', onError);
    stream.on('end', onEnd);
    stream.on('close', onClose);
    stream.pipe(res);
};

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
            message: getPreviewGenerationMessage(error)
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

    const range = req.headers.range;

    if (range) {
        try {
            const stat = fs.statSync(previewPath);
            const fileSize = stat.size;
            const parsedRange = parsePreviewRange(range, fileSize);
            if (!parsedRange) {
                return sendRangeNotSatisfiable(res, fileSize);
            }

            const { start, end } = parsedRange;
            const chunkSize = end - start + 1;
            const stream = fs.createReadStream(previewPath, { start, end });

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': 'audio/mpeg'
            });

            pipePreviewStream(stream, res);
            return;
        } catch (error) {
            const fsError = error as NodeJS.ErrnoException;
            if (fsError.code === 'ENOENT') {
                return res.status(404).json({
                    success: false,
                    message: 'Preview not found. Generate it first via POST /api/preview'
                });
            }

            console.error('[Preview] Failed to stream ranged preview:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to stream preview'
            });
        }
    }

    try {
        const stat = fs.statSync(previewPath);
        const stream = fs.createReadStream(previewPath);

        res.writeHead(200, {
            'Content-Length': stat.size,
            'Content-Type': 'audio/mpeg',
            'Accept-Ranges': 'bytes'
        });

        pipePreviewStream(stream, res);
        return;
    } catch (error) {
        const fsError = error as NodeJS.ErrnoException;
        if (fsError.code === 'ENOENT') {
            return res.status(404).json({
                success: false,
                message: 'Preview not found. Generate it first via POST /api/preview'
            });
        }

        console.error('[Preview] Failed to stream preview:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to stream preview'
        });
    }
});

export default router;
