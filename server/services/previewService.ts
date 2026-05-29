import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

const previewCache = new Map<string, { path: string; createdAt: number }>();
const previewBuilds = new Map<string, Promise<void>>();

export const PREVIEW_DURATION = 30;
const PREVIEW_START_OFFSET = 30;
const PREVIEW_MAX_AGE_MS = 30 * 60 * 1000;
const PREVIEW_TIMEOUT_MS = 60 * 1000;
const PREVIEW_TEMP_MAX_AGE_MS = PREVIEW_TIMEOUT_MS * 2;
const STDERR_BUFFER_LIMIT = 2048;
const SAFE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const PROCESS_BANNER_PATTERNS = [
    /^ffmpeg version/i,
    /^built with/i,
    /^configuration:/i,
    /^lib(?:av|sw|post)/i
];

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

const getPreviewTempFilePath = (videoId: string): string => (
    `${getPreviewFilePath(videoId)}.tmp.${process.pid}.${Date.now()}`
);

const getPreviewFileState = (videoId: string): { path: string; createdAt: number } | null => {
    const previewPath = getPreviewFilePath(videoId);
    try {
        const stat = fs.statSync(previewPath);
        const createdAt = stat.mtimeMs;
        previewCache.set(videoId, {
            path: previewPath,
            createdAt
        });

        return {
            path: previewPath,
            createdAt
        };
    } catch (error) {
        const fsError = error as NodeJS.ErrnoException;
        if (fsError.code === 'ENOENT') {
            previewCache.delete(videoId);
            return null;
        }

        throw error;
    }
};

const appendStderrChunk = (currentValue: string, chunk: Buffer | string): string => {
    if (currentValue.length >= STDERR_BUFFER_LIMIT) {
        return currentValue;
    }

    const text = chunk.toString();
    const remainingChars = STDERR_BUFFER_LIMIT - currentValue.length;
    const nextChunk = text.slice(0, remainingChars);
    const wasTruncated = text.length > remainingChars;
    return wasTruncated ? `${currentValue}${nextChunk}…(truncated)` : `${currentValue}${nextChunk}`;
};

const summarizeProcessOutput = (output: string): string => {
    const lines = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const diagnosticLines = lines.filter((line) => (
        !PROCESS_BANNER_PATTERNS.some((pattern) => pattern.test(line))
    ));
    const summary = (diagnosticLines.length > 0 ? diagnosticLines : lines)
        .slice(-4)
        .join(' ');

    return summary.slice(0, 600);
};

class PreviewProcessError extends Error {
    constructor(
        readonly processName: 'yt-dlp' | 'ffmpeg',
        readonly exitCode: number | null,
        stderr: string
    ) {
        const summary = summarizeProcessOutput(stderr);
        super(`${processName} exited with code ${exitCode ?? 'unknown'}${summary ? `: ${summary}` : ''}`);
    }
}

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

const createPreviewAtOffset = async (
    videoId: string,
    previewPath: string,
    startOffsetSeconds: number
): Promise<void> => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const tempPreviewPath = getPreviewTempFilePath(videoId);

    await new Promise<void>((resolve, reject) => {
        let ytdlp: ChildProcess | null = null;
        let ffmpeg: ChildProcess | null = null;
        let timeoutId: NodeJS.Timeout | null = null;
        let isSettled = false;

        const cleanupTempFile = () => {
            if (fs.existsSync(tempPreviewPath)) {
                fs.unlinkSync(tempPreviewPath);
            }
        };

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
                try {
                    cleanupTempFile();
                } catch {
                    // Ignore temp cleanup errors during rejection.
                }
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
            '-ss', String(startOffsetSeconds),
            '-t', String(PREVIEW_DURATION),
            '-acodec', 'libmp3lame',
            '-ab', '128k',
            '-ar', '44100',
            '-f', 'mp3',
            tempPreviewPath
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
            ytdlpError = appendStderrChunk(ytdlpError, data);
        });

        ffmpegStderr.on('data', (data) => {
            ffmpegError = appendStderrChunk(ffmpegError, data);
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

                settle(new PreviewProcessError('yt-dlp', code, ytdlpError));
            }
        });

        ffmpeg.on('error', (err) => {
            settle(new Error(`FFmpeg error: ${err.message}`));
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                try {
                    fs.renameSync(tempPreviewPath, previewPath);
                } catch (error) {
                    settle(error as Error);
                    return;
                }
                settle();
                return;
            }

            settle(new PreviewProcessError('ffmpeg', code, ffmpegError));
        });
    });
};

const shouldRetryPreviewFromStart = (error: unknown): boolean => (
    PREVIEW_START_OFFSET > 0
    && error instanceof PreviewProcessError
    && error.processName === 'ffmpeg'
    && Number.isFinite(error.exitCode)
);

const createPreview = async (videoId: string, previewPath: string): Promise<void> => {
    try {
        await createPreviewAtOffset(videoId, previewPath, PREVIEW_START_OFFSET);
    } catch (error) {
        if (!shouldRetryPreviewFromStart(error)) {
            throw error;
        }

        console.warn('[Preview] Retrying preview from the beginning after FFmpeg failed at offset', {
            videoId,
            offsetSeconds: PREVIEW_START_OFFSET,
            error: error instanceof Error ? error.message : error
        });
        await createPreviewAtOffset(videoId, previewPath, 0);
    }
};

export async function generatePreview(videoId: string): Promise<PreviewResult> {
    const safeVideoId = validatePreviewVideoId(videoId);
    if (!safeVideoId) {
        throw new Error('Invalid preview video ID');
    }

    const existingPreview = getPreviewFileState(safeVideoId);
    if (existingPreview) {
        const age = Date.now() - existingPreview.createdAt;
        if (age < PREVIEW_MAX_AGE_MS) {
            return {
                previewId: safeVideoId,
                previewUrl: `/api/preview/${safeVideoId}`,
                duration: PREVIEW_DURATION,
                cached: true
            };
        }
    }

    const previewPath = getPreviewFilePath(safeVideoId);
    let build = previewBuilds.get(safeVideoId);
    if (!build) {
        build = (async () => {
            try {
                await createPreview(safeVideoId, previewPath);
                const nextState = getPreviewFileState(safeVideoId);
                if (!nextState) {
                    throw new Error('Preview generation completed without a preview file');
                }
            } finally {
                previewBuilds.delete(safeVideoId);
            }
        })();
        previewBuilds.set(safeVideoId, build);
    }

    await build;

    return {
        previewId: safeVideoId,
        previewUrl: `/api/preview/${safeVideoId}`,
        duration: PREVIEW_DURATION,
        cached: false
    };
}

export function getPreviewPath(videoId: string): string | null {
    const safeVideoId = validatePreviewVideoId(videoId);
    if (!safeVideoId) {
        return null;
    }

    return getPreviewFileState(safeVideoId)?.path ?? null;
}

export function cleanupPreviews(): number {
    const now = Date.now();
    let cleaned = 0;
    const previewsDir = getPreviewsDir();

    if (!fs.existsSync(previewsDir)) {
        previewCache.clear();
        return 0;
    }

    for (const fileName of fs.readdirSync(previewsDir)) {
        const isPreviewFile = fileName.endsWith('_preview.mp3');
        const isTempFile = fileName.includes('_preview.mp3.tmp.');
        if (!isPreviewFile && !isTempFile) {
            continue;
        }

        const previewPath = path.join(previewsDir, fileName);
        const videoId = fileName.replace(/_preview\.mp3(?:\.tmp\..+)?$/, '');
        const maxAgeMs = isTempFile ? PREVIEW_TEMP_MAX_AGE_MS : PREVIEW_MAX_AGE_MS;

        try {
            const stat = fs.statSync(previewPath);
            if (now - stat.mtimeMs <= maxAgeMs) {
                if (!isTempFile) {
                    previewCache.set(videoId, {
                        path: previewPath,
                        createdAt: stat.mtimeMs
                    });
                }
                continue;
            }

            fs.unlinkSync(previewPath);
            previewCache.delete(videoId);
            cleaned++;
        } catch (error) {
            const fsError = error as NodeJS.ErrnoException;
            if (fsError.code === 'ENOENT') {
                previewCache.delete(videoId);
                continue;
            }

            console.debug('[Preview] Failed to clean expired preview', {
                videoId,
                path: previewPath,
                error
            });
        }
    }

    for (const [videoId, data] of previewCache.entries()) {
        if (!fs.existsSync(data.path)) {
            previewCache.delete(videoId);
        }
    }

    return cleaned;
}
