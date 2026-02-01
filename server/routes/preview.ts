/**
 * Audio Preview Route
 * POST /api/preview - Generate a 30-second audio preview
 * GET /api/preview/:id - Stream the preview audio
 */

import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

const router = Router();

// Preview cache - maps videoId to preview file path
const previewCache = new Map<string, { path: string; createdAt: number }>();
const PREVIEW_DURATION = 30; // seconds
const PREVIEW_START_OFFSET = 30; // Start 30 seconds into the song (skip intros)
const PREVIEW_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
const PREVIEWS_DIR = path.join(config.DOWNLOADS_DIR, 'previews');

// Ensure previews directory exists
if (!fs.existsSync(PREVIEWS_DIR)) {
    fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
}

// Generate audio preview
router.post('/', async (req: Request, res: Response) => {
    const { videoId } = req.body;

    if (!videoId) {
        return res.status(400).json({
            success: false,
            message: 'Video ID required'
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

    const previewPath = path.join(PREVIEWS_DIR, `${videoId}_preview.mp3`);
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    try {
        // Use yt-dlp to extract audio and ffmpeg to create 30s preview
        // This pipes directly without creating full file
        await new Promise<void>((resolve, reject) => {
            const ytdlp = spawn('yt-dlp', [
                '-f', 'bestaudio[ext=m4a]/bestaudio/best',
                '--no-playlist',
                '-o', '-', // Output to stdout
                url
            ]);

            const ffmpeg = spawn('ffmpeg', [
                '-y',
                '-i', 'pipe:0', // Input from stdin
                '-ss', String(PREVIEW_START_OFFSET), // Skip intro
                '-t', String(PREVIEW_DURATION), // Duration
                '-acodec', 'libmp3lame',
                '-ab', '128k', // Lower bitrate for preview
                '-ar', '44100',
                previewPath
            ]);

            // Pipe yt-dlp output to ffmpeg input
            ytdlp.stdout.pipe(ffmpeg.stdin);

            let ytdlpError = '';
            let ffmpegError = '';

            ytdlp.stderr.on('data', (data) => {
                ytdlpError += data.toString();
            });

            ffmpeg.stderr.on('data', (data) => {
                ffmpegError += data.toString();
            });

            ytdlp.on('error', (err) => {
                reject(new Error(`yt-dlp error: ${err.message}`));
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`FFmpeg exited with code ${code}: ${ffmpegError}`));
                }
            });

            ffmpeg.on('error', (err) => {
                reject(new Error(`FFmpeg error: ${err.message}`));
            });

            // Handle yt-dlp exit
            ytdlp.on('close', (code) => {
                if (code !== 0) {
                    ffmpeg.stdin.end();
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
    const videoId = req.params.videoId as string;

    const cached = previewCache.get(videoId);
    if (!cached || !fs.existsSync(cached.path)) {
        return res.status(404).json({
            success: false,
            message: 'Preview not found. Generate it first via POST /api/preview'
        });
    }

    const stat = fs.statSync(cached.path);
    const range = req.headers.range;

    if (range) {
        // Support range requests for seeking
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        const stream = fs.createReadStream(cached.path, { start, end });

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'audio/mpeg'
        });

        stream.pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': stat.size,
            'Content-Type': 'audio/mpeg'
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
