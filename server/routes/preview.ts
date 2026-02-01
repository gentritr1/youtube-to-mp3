/**
 * Audio Preview Route
 * POST /api/preview - Generate a 30-second audio preview
 * GET /api/preview/:id - Stream the preview audio
 */

import { Router, Request, Response } from 'express';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

const router = Router();

// Preview cache - maps videoId to preview file path
const previewCache = new Map<string, { path: string; createdAt: number }>();
const PREVIEW_DURATION = 30; // seconds
const PREVIEW_START_OFFSET = 30; // Start 30 seconds into the song (skip intros)
const PREVIEW_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
const PREVIEW_TIMEOUT_MS = 60 * 1000; // 60 seconds timeout for preview generation
const PREVIEWS_DIR = path.join(config.DOWNLOADS_DIR, 'previews');

// Safe video ID pattern (YouTube video IDs are alphanumeric with - and _)
const SAFE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{1,20}$/;

/**
 * Validate and sanitize video ID to prevent path traversal attacks
 */
const validateVideoId = (videoId: unknown): string | null => {
    if (typeof videoId !== 'string') {
        return null;
    }

    // Reject path traversal attempts
    if (videoId.includes('..') || videoId.includes('/') || videoId.includes('\\')) {
        return null;
    }

    // Only allow safe characters
    if (!SAFE_VIDEO_ID_PATTERN.test(videoId)) {
        return null;
    }

    return videoId;
};

// Ensure previews directory exists
if (!fs.existsSync(PREVIEWS_DIR)) {
    fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
}

// Generate audio preview
router.post('/', async (req: Request, res: Response) => {
    const rawVideoId = req.body?.videoId;

    // Validate and sanitize videoId
    const videoId = validateVideoId(rawVideoId);
    if (!videoId) {
        return res.status(400).json({
            success: false,
            message: 'Invalid video ID. Must be alphanumeric with dashes/underscores only.'
        });
    }

    // Check cache first
    const cached = previewCache.get(videoId);
    if (cached && fs.existsSync(cached.path)) {
        const age = Date.now() - cached.createdAt;
        if (age < PREVIEW_MAX_AGE_MS) {
            return res.json({
                success: true,
                previewId: videoId,
                previewUrl: `/api/preview/${videoId}`,
                duration: PREVIEW_DURATION,
                cached: true
            });
        }
    }

    // Use path.join with validated videoId for safe path construction
    const safeFilename = `${videoId}_preview.mp3`;
    const previewPath = path.join(PREVIEWS_DIR, safeFilename);
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    try {
        // Use yt-dlp to extract audio and ffmpeg to create 30s preview
        // This pipes directly without creating full file
        await new Promise<void>((resolve, reject) => {
            let ytdlp: ChildProcess | null = null;
            let ffmpeg: ChildProcess | null = null;
            let timeoutId: NodeJS.Timeout | null = null;
            let isSettled = false;

            /**
             * Cleanup function to kill processes and clear timeout
             */
            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (ytdlp && !ytdlp.killed) {
                    ytdlp.kill('SIGTERM');
                }
                if (ffmpeg) {
                    try {
                        ffmpeg.stdin?.end();
                    } catch (e) {
                        // Ignore stdin end errors
                    }
                    if (!ffmpeg.killed) {
                        ffmpeg.kill('SIGTERM');
                    }
                }
            };

            /**
             * Settle the promise (resolve or reject) only once
             */
            const settle = (error?: Error) => {
                if (isSettled) return;
                isSettled = true;
                cleanup();
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            };

            // Start timeout timer
            timeoutId = setTimeout(() => {
                settle(new Error('Preview generation timed out after 60 seconds'));
            }, PREVIEW_TIMEOUT_MS);

            ytdlp = spawn('yt-dlp', [
                '-f', 'bestaudio[ext=m4a]/bestaudio/best',
                '--no-playlist',
                '-o', '-', // Output to stdout
                url
            ]);

            ffmpeg = spawn('ffmpeg', [
                '-y',
                '-i', 'pipe:0', // Input from stdin
                '-ss', String(PREVIEW_START_OFFSET), // Skip intro
                '-t', String(PREVIEW_DURATION), // Duration
                '-acodec', 'libmp3lame',
                '-ab', '128k', // Lower bitrate for preview
                '-ar', '44100',
                previewPath
            ]);

            // Handle EPIPE errors on ffmpeg stdin to prevent crashes
            ffmpeg.stdin?.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EPIPE' || err.code === 'ERR_STREAM_DESTROYED') {
                    // Ignore EPIPE - this happens when ffmpeg closes before we finish writing
                    console.log('[Preview] ffmpeg stdin closed early (EPIPE) - expected when yt-dlp fails');
                } else {
                    console.error('[Preview] ffmpeg stdin error:', err.message);
                }
            });

            // Pipe yt-dlp output to ffmpeg input with error handling
            ytdlp.stdout?.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code !== 'EPIPE') {
                    console.error('[Preview] yt-dlp stdout error:', err.message);
                }
            });

            ytdlp.stdout?.pipe(ffmpeg.stdin!, { end: true });

            let ytdlpError = '';
            let ffmpegError = '';

            ytdlp.stderr?.on('data', (data) => {
                ytdlpError += data.toString();
            });

            ffmpeg.stderr?.on('data', (data) => {
                ffmpegError += data.toString();
            });

            ytdlp.on('error', (err) => {
                settle(new Error(`yt-dlp error: ${err.message}`));
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    settle();
                } else {
                    settle(new Error(`FFmpeg exited with code ${code}: ${ffmpegError.slice(0, 500)}`));
                }
            });

            ffmpeg.on('error', (err) => {
                settle(new Error(`FFmpeg error: ${err.message}`));
            });

            // Handle yt-dlp exit - this is important for error propagation
            ytdlp.on('close', (code) => {
                if (code !== 0) {
                    // End ffmpeg stdin cleanly
                    try {
                        ffmpeg?.stdin?.end();
                    } catch (e) {
                        // Ignore
                    }
                    // Reject with yt-dlp error
                    settle(new Error(`yt-dlp exited with code ${code}: ${ytdlpError.slice(0, 500)}`));
                }
            });
        });

        // Cache the preview
        previewCache.set(videoId, {
            path: previewPath,
            createdAt: Date.now()
        });

        res.json({
            success: true,
            previewId: videoId,
            previewUrl: `/api/preview/${videoId}`,
            duration: PREVIEW_DURATION,
            cached: false
        });

    } catch (error: any) {
        console.error('[Preview] Generation error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate preview'
        });
    }
});

// Stream preview audio
router.get('/:videoId', async (req: Request, res: Response) => {
    const rawVideoId = req.params.videoId;

    // Validate and sanitize videoId
    const videoId = validateVideoId(rawVideoId);
    if (!videoId) {
        return res.status(400).json({
            success: false,
            message: 'Invalid video ID'
        });
    }

    const cached = previewCache.get(videoId);
    if (!cached || !fs.existsSync(cached.path)) {
        return res.status(404).json({
            success: false,
            message: 'Preview not found. Generate it first via POST /api/preview'
        });
    }

    const stat = fs.statSync(cached.path);
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

        const stream = fs.createReadStream(cached.path, { start, end });

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

        fs.createReadStream(cached.path).pipe(res);
    }
});

// Cleanup old previews (called from main cleanup routine)
export const cleanupPreviews = (): number => {
    const now = Date.now();
    let cleaned = 0;

    for (const [videoId, data] of previewCache.entries()) {
        if (now - data.createdAt > PREVIEW_MAX_AGE_MS) {
            try {
                if (fs.existsSync(data.path)) {
                    fs.unlinkSync(data.path);
                }
                previewCache.delete(videoId);
                cleaned++;
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }

    return cleaned;
};

export default router;
