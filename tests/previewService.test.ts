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

    it('drops cache entries when the preview file disappears', async () => {
        await generatePreview('vanish12345');
        const previewPath = getPreviewPath('vanish12345');

        expect(previewPath).toBeTruthy();
        fs.unlinkSync(previewPath!);

        expect(getPreviewPath('vanish12345')).toBeNull();
    });

    it('cleans up expired previews', async () => {
        const nowSpy = vi.spyOn(Date, 'now');
        nowSpy.mockReturnValue(1_000);

        await generatePreview('stale123456');
        const previewPath = getPreviewPath('stale123456');

        expect(previewPath).toBeTruthy();
        expect(fs.existsSync(previewPath!)).toBe(true);

        nowSpy.mockReturnValue(1_000 + (31 * 60 * 1000));

        expect(cleanupPreviews()).toBe(1);
        expect(fs.existsSync(previewPath!)).toBe(false);
        expect(getPreviewPath('stale123456')).toBeNull();
    });
});
