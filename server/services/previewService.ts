import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

const previewCache = new Map<string, { path: string; createdAt: number }>();

export const PREVIEW_DURATION = 30;
const PREVIEW_START_OFFSET = 30;
const PREVIEW_MAX_AGE_MS = 30 * 60 * 1000;
const PREVIEW_TIMEOUT_MS = 60 * 1000;
const SAFE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{1,20}$/;

export interface PreviewResult {
    previewId: string;
    previewUrl: string;
    duration: number;
    cached: boolean;
}

const getPreviewsDir = (): string => path.join(config.DOWNLOADS_DIR, 'previews');

const ensurePreviewsDir = (): void => {
    const previewsDir = getPreviewsDir();
    if (!fs.existsSync(previewsDir)) {
        fs.mkdirSync(previewsDir, { recursive: true });
    }
};

const getPreviewFilePath = (videoId: string): string => {
    ensurePreviewsDir();
    return path.join(getPreviewsDir(), `${videoId}_preview.mp3`);
};

export const validatePreviewVideoId = (videoId: unknown): string | null => {
    if (typeof videoId !== 'string') {
        return null;
    }

    if (videoId.includes('..') || videoId.includes('/') || videoId.includes('\\')) {
        return null;
    }

    if (!SAFE_VIDEO_ID_PATTERN.test(videoId)) {
        return null;
    }

    return videoId;
};

const createPreview = async (videoId: string, previewPath: string): Promise<void> => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    await new Promise<void>((resolve, reject) => {
        let ytdlp: ChildProcess | null = null;
        let ffmpeg: ChildProcess | null = null;
        let timeoutId: NodeJS.Timeout | null = null;
        let isSettled = false;

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
                } catch {
                    // Ignore stdin shutdown errors during teardown.
                }

                if (!ffmpeg.killed) {
                    ffmpeg.kill('SIGTERM');
                }
            }
        };

        const settle = (error?: Error) => {
            if (isSettled) {
                return;
            }

            isSettled = true;
            cleanup();

            if (error) {
                reject(error);
                return;
            }

            resolve();
        };

        timeoutId = setTimeout(() => {
            settle(new Error('Preview generation timed out after 60 seconds'));
        }, PREVIEW_TIMEOUT_MS);

        ytdlp = spawn('yt-dlp', [
            '-f', 'bestaudio[ext=m4a]/bestaudio/best',
            '--no-playlist',
            '-o', '-',
            url
        ]);

        ffmpeg = spawn('ffmpeg', [
            '-y',
            '-i', 'pipe:0',
            '-ss', String(PREVIEW_START_OFFSET),
            '-t', String(PREVIEW_DURATION),
            '-acodec', 'libmp3lame',
            '-ab', '128k',
            '-ar', '44100',
            previewPath
        ]);

        const ytdlpStdout = ytdlp.stdout;
        const ytdlpStderr = ytdlp.stderr;
        const ffmpegStdin = ffmpeg.stdin;
        const ffmpegStderr = ffmpeg.stderr;

        if (!ytdlpStdout || !ytdlpStderr || !ffmpegStdin || !ffmpegStderr) {
            settle(new Error('Preview generation could not access process streams'));
            return;
        }

        ffmpegStdin.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EPIPE' || err.code === 'ERR_STREAM_DESTROYED') {
                console.log('[Preview] ffmpeg stdin closed early (EPIPE) - expected when yt-dlp fails');
                return;
            }

            console.error('[Preview] ffmpeg stdin error:', err.message);
        });

        ytdlpStdout.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code !== 'EPIPE') {
                console.error('[Preview] yt-dlp stdout error:', err.message);
            }
        });

        ytdlpStdout.pipe(ffmpegStdin, { end: true });

        let ytdlpError = '';
        let ffmpegError = '';

        ytdlpStderr.on('data', (data) => {
            ytdlpError += data.toString();
        });

        ffmpegStderr.on('data', (data) => {
            ffmpegError += data.toString();
        });

        ytdlp.on('error', (err) => {
            settle(new Error(`yt-dlp error: ${err.message}`));
        });

        ytdlp.on('close', (code) => {
            if (code !== 0) {
                try {
                    ffmpeg?.stdin?.end();
                } catch {
                    // Ignore stdin shutdown errors during yt-dlp failure handling.
                }

                settle(new Error(`yt-dlp exited with code ${code}: ${ytdlpError.slice(0, 500)}`));
            }
        });

        ffmpeg.on('error', (err) => {
            settle(new Error(`FFmpeg error: ${err.message}`));
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                settle();
                return;
            }

            settle(new Error(`FFmpeg exited with code ${code}: ${ffmpegError.slice(0, 500)}`));
        });
    });
};

export async function generatePreview(videoId: string): Promise<PreviewResult> {
    const cached = previewCache.get(videoId);
    if (cached && fs.existsSync(cached.path)) {
        const age = Date.now() - cached.createdAt;
        if (age < PREVIEW_MAX_AGE_MS) {
            return {
                previewId: videoId,
                previewUrl: `/api/preview/${videoId}`,
                duration: PREVIEW_DURATION,
                cached: true
            };
        }
    }

    const previewPath = getPreviewFilePath(videoId);
    await createPreview(videoId, previewPath);

    previewCache.set(videoId, {
        path: previewPath,
        createdAt: Date.now()
    });

    return {
        previewId: videoId,
        previewUrl: `/api/preview/${videoId}`,
        duration: PREVIEW_DURATION,
        cached: false
    };
}

export function getPreviewPath(videoId: string): string | null {
    const cached = previewCache.get(videoId);
    if (!cached) {
        return null;
    }

    if (!fs.existsSync(cached.path)) {
        previewCache.delete(videoId);
        return null;
    }

    return cached.path;
}

export function cleanupPreviews(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [videoId, data] of previewCache.entries()) {
        if (now - data.createdAt <= PREVIEW_MAX_AGE_MS) {
            continue;
        }

        try {
            if (fs.existsSync(data.path)) {
                fs.unlinkSync(data.path);
            }
            previewCache.delete(videoId);
            cleaned++;
        } catch {
            // Ignore cleanup errors and leave the cache entry untouched.
        }
    }

    return cleaned;
}
