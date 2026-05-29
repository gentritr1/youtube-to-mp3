import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PassThrough, Writable } from 'stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnMock } = vi.hoisted(() => ({
    spawnMock: vi.fn()
}));

vi.mock('child_process', () => ({
    spawn: spawnMock
}));

const createMockProcess = () => {
    const process = new EventEmitter() as EventEmitter & {
        stdin: Writable;
        stdout: PassThrough;
        stderr: PassThrough;
        killed: boolean;
        kill: ReturnType<typeof vi.fn>;
    };

    process.stdin = new Writable({
        write(_chunk, _encoding, callback) {
            callback();
        }
    });
    process.stdout = new PassThrough();
    process.stderr = new PassThrough();
    process.killed = false;
    process.kill = vi.fn(() => {
        process.killed = true;
        return true;
    });

    return process;
};

describe('previewService', () => {
    let config: typeof import('../server/config.ts').config;
    let cleanupPreviews: typeof import('../server/services/previewService.ts').cleanupPreviews;
    let generatePreview: typeof import('../server/services/previewService.ts').generatePreview;
    let getPreviewPath: typeof import('../server/services/previewService.ts').getPreviewPath;
    let validatePreviewVideoId: typeof import('../server/services/previewService.ts').validatePreviewVideoId;
    let downloadsDir: string;
    let previousDownloadsDir: string;

    beforeEach(async () => {
        vi.resetModules();

        ({ config } = await import('../server/config.ts'));
        previousDownloadsDir = config.DOWNLOADS_DIR;
        downloadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-service-'));
        config.DOWNLOADS_DIR = downloadsDir;

        ({
            cleanupPreviews,
            generatePreview,
            getPreviewPath,
            validatePreviewVideoId,
        } = await import('../server/services/previewService.ts'));

        spawnMock.mockReset();
        spawnMock.mockImplementation((command: string, args: string[]) => {
            const process = createMockProcess();

            if (command === 'ffmpeg') {
                const previewPath = args[args.length - 1];
                fs.mkdirSync(path.dirname(previewPath), { recursive: true });
                fs.writeFileSync(previewPath, 'preview-bytes');

                queueMicrotask(() => {
                    process.emit('close', 0);
                });

                return process;
            }

            if (command === 'yt-dlp') {
                queueMicrotask(() => {
                    process.emit('close', 0);
                });

                return process;
            }

            throw new Error(`Unexpected command: ${command}`);
        });
    });

    afterEach(() => {
        config.DOWNLOADS_DIR = previousDownloadsDir;
        fs.rmSync(downloadsDir, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    it('validates preview video IDs defensively', () => {
        expect(validatePreviewVideoId('abc123_DEF-')).toBe('abc123_DEF-');
        expect(validatePreviewVideoId('../escape')).toBeNull();
        expect(validatePreviewVideoId('bad/slash')).toBeNull();
        expect(validatePreviewVideoId('bad space')).toBeNull();
        expect(validatePreviewVideoId('too-short')).toBeNull();
        expect(validatePreviewVideoId(42)).toBeNull();
    });

    it('rejects invalid video ids at exported API boundaries', async () => {
        await expect(generatePreview('../escape')).rejects.toThrow('Invalid preview video ID');
        expect(getPreviewPath('../escape')).toBeNull();
        expect(spawnMock).not.toHaveBeenCalled();
    });

    it('generates and reuses cached previews', async () => {
        const first = await generatePreview('preview1234');
        const previewPath = getPreviewPath('preview1234');

        expect(first.cached).toBe(false);
        expect(first.previewUrl).toBe('/api/preview/preview1234');
        expect(previewPath).toBe(path.join(downloadsDir, 'previews', 'preview1234_preview.mp3'));
        expect(fs.existsSync(previewPath!)).toBe(true);
        expect(spawnMock).toHaveBeenCalledTimes(2);

        const second = await generatePreview('preview1234');

        expect(second.cached).toBe(true);
        expect(spawnMock).toHaveBeenCalledTimes(2);
    });

    it('passes an explicit MP3 muxer for temp preview output paths', async () => {
        await generatePreview('muxer123456');

        const ffmpegCall = spawnMock.mock.calls.find(([command]) => command === 'ffmpeg');
        expect(ffmpegCall).toBeDefined();

        const args = ffmpegCall?.[1] as string[];
        const outputPath = args[args.length - 1];
        expect(outputPath).toContain('_preview.mp3.tmp.');
        expect(args.slice(-3)).toEqual(['-f', 'mp3', outputPath]);
    });

    it('drops cache entries when the preview file disappears', async () => {
        await generatePreview('vanish12345');
        const previewPath = getPreviewPath('vanish12345');

        expect(previewPath).toBeTruthy();
        fs.unlinkSync(previewPath!);

        expect(getPreviewPath('vanish12345')).toBeNull();
    });

    it('reconstructs preview paths from disk after the in-memory cache is reset', async () => {
        await generatePreview('restart1234');
        vi.resetModules();

        ({ config } = await import('../server/config.ts'));
        config.DOWNLOADS_DIR = downloadsDir;

        ({
            cleanupPreviews,
            generatePreview,
            getPreviewPath,
            validatePreviewVideoId,
        } = await import('../server/services/previewService.ts'));

        const previewPath = getPreviewPath('restart1234');
        expect(previewPath).toBe(path.join(downloadsDir, 'previews', 'restart1234_preview.mp3'));
    });

    it('deduplicates concurrent preview generation for the same video id', async () => {
        let ffmpegProcessCount = 0;
        spawnMock.mockImplementation((command: string, args: string[]) => {
            const process = createMockProcess();

            if (command === 'ffmpeg') {
                ffmpegProcessCount += 1;
                const previewPath = args[args.length - 1];
                fs.mkdirSync(path.dirname(previewPath), { recursive: true });
                fs.writeFileSync(previewPath, 'preview-bytes');
                setTimeout(() => {
                    process.emit('close', 0);
                }, 10);
                return process;
            }

            if (command === 'yt-dlp') {
                setTimeout(() => {
                    process.emit('close', 0);
                }, 10);
                return process;
            }

            throw new Error(`Unexpected command: ${command}`);
        });

        const [first, second] = await Promise.all([
            generatePreview('dupebuild12'),
            generatePreview('dupebuild12')
        ]);

        expect(first.previewUrl).toBe('/api/preview/dupebuild12');
        expect(second.previewUrl).toBe('/api/preview/dupebuild12');
        expect(fs.existsSync(path.join(downloadsDir, 'previews', 'dupebuild12_preview.mp3'))).toBe(true);
        expect(ffmpegProcessCount).toBe(1);
        expect(spawnMock).toHaveBeenCalledTimes(2);
    });

    it('retries preview generation from the beginning when the offset has no audio', async () => {
        const offsets: string[] = [];
        let ffmpegAttempt = 0;

        spawnMock.mockImplementation((command: string, args: string[]) => {
            const process = createMockProcess();

            if (command === 'ffmpeg') {
                ffmpegAttempt += 1;
                offsets.push(args[args.indexOf('-ss') + 1]);

                if (ffmpegAttempt === 1) {
                    queueMicrotask(() => {
                        process.stderr.write('ffmpeg version 8.0.1\nOutput file is empty, nothing was encoded\n');
                        process.emit('close', 234);
                    });
                    return process;
                }

                const previewPath = args[args.length - 1];
                fs.mkdirSync(path.dirname(previewPath), { recursive: true });
                fs.writeFileSync(previewPath, 'preview-bytes');
                queueMicrotask(() => {
                    process.emit('close', 0);
                });
                return process;
            }

            if (command === 'yt-dlp') {
                queueMicrotask(() => {
                    process.emit('close', 0);
                });
                return process;
            }

            throw new Error(`Unexpected command: ${command}`);
        });

        const result = await generatePreview('shortvid123');

        expect(result.previewUrl).toBe('/api/preview/shortvid123');
        expect(offsets).toEqual(['30', '0']);
        expect(fs.existsSync(path.join(downloadsDir, 'previews', 'shortvid123_preview.mp3'))).toBe(true);
    });

    it('omits FFmpeg banner noise from preview generation errors', async () => {
        spawnMock.mockImplementation((command: string) => {
            const process = createMockProcess();

            if (command === 'ffmpeg') {
                queueMicrotask(() => {
                    process.stderr.write([
                        'ffmpeg version 8.0.1 Copyright (c) 2000-2025 the FFmpeg developers',
                        'built with Apple clang version 17.0.0',
                        'configuration: --prefix=/opt/homebrew/Cellar/ffmpeg',
                        'Output file is empty, nothing was encoded'
                    ].join('\n'));
                    process.emit('close', 234);
                });
                return process;
            }

            if (command === 'yt-dlp') {
                queueMicrotask(() => {
                    process.emit('close', 0);
                });
                return process;
            }

            throw new Error(`Unexpected command: ${command}`);
        });

        await expect(generatePreview('failvid1234')).rejects.toThrow('Output file is empty');
        await expect(generatePreview('failvid1234')).rejects.not.toThrow('ffmpeg version');
    });

    it('cleans up expired previews', async () => {
        await generatePreview('stale123456');
        const previewPath = getPreviewPath('stale123456');

        expect(previewPath).toBeTruthy();
        expect(fs.existsSync(previewPath!)).toBe(true);

        const staleTimeSeconds = (Date.now() - (31 * 60 * 1000)) / 1000;
        fs.utimesSync(previewPath!, staleTimeSeconds, staleTimeSeconds);

        expect(cleanupPreviews()).toBe(1);
        expect(fs.existsSync(previewPath!)).toBe(false);
        expect(getPreviewPath('stale123456')).toBeNull();
    });
});
