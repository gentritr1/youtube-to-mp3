import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAudio } from '../server/services/audioAnalysis';
import * as child_process from 'child_process';
import fs from 'fs';
import EventEmitter from 'events';

vi.mock('child_process');
vi.mock('fs');

describe('Audio Analysis Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should throw an error if file does not exist', async () => {
        (fs.existsSync as any).mockReturnValue(false);

        await expect(analyzeAudio('mock/file.mp3')).rejects.toThrow('File not found');
    });

    it('should extract correct stats using ffprobe and ffmpeg', async () => {
        (fs.existsSync as any).mockReturnValue(true);
        (fs.statSync as any).mockReturnValue({ size: 4800000 }); // 4.8MB

        const mockProc1 = new EventEmitter() as any;
        mockProc1.stdout = new EventEmitter();
        mockProc1.stderr = new EventEmitter();

        const mockProc2 = new EventEmitter() as any;
        mockProc2.stdout = new EventEmitter();
        mockProc2.stderr = new EventEmitter();

        (child_process.spawn as any).mockImplementation((command: string) => {
            if (command === 'ffprobe') return mockProc1;
            if (command === 'ffmpeg') return mockProc2;
        });

        const analysisPromise = analyzeAudio('mock/file.mp3');

        // Simulate ffprobe (metadata)
        const mockFfprobeOutput = JSON.stringify({
            format: { bit_rate: "320000", duration: "120.5" },
            streams: [{ codec_type: "audio", sample_rate: "44100" }]
        });
        mockProc1.stdout.emit('data', mockFfprobeOutput);
        mockProc1.emit('close', 0);

        // Simulate ffmpeg (ebur128)
        const mockFfmpegOutput = `
            [Parsed_ebur128_0 @ 0x123] Integrated loudness:
            [Parsed_ebur128_0 @ 0x123]   I:         -14.2 LUFS
            [Parsed_ebur128_0 @ 0x123] True peak:
            [Parsed_ebur128_0 @ 0x123]   Peak:      -1.2 dBFS
        `;
        mockProc2.stderr.emit('data', mockFfmpegOutput);
        mockProc2.emit('close', 0);

        const stats = await analysisPromise;

        expect(stats).toEqual({
            bitrate: 320000,
            sampleRate: 44100,
            duration: 120.5,
            fileSize: 4800000,
            lufs: -14.2,
            peakDb: -1.2
        });
    });

    it('should reject with ffprobe stderr on non-zero exit', async () => {
        (fs.existsSync as any).mockReturnValue(true);

        const mockProc1 = new EventEmitter() as any;
        mockProc1.stdout = new EventEmitter();
        mockProc1.stderr = new EventEmitter();

        (child_process.spawn as any).mockImplementation((command: string) => {
            if (command === 'ffprobe') return mockProc1;
        });

        const analysisPromise = analyzeAudio('mock/file.mp3');

        mockProc1.stderr.emit('data', 'some ffprobe error');
        mockProc1.emit('close', 1);

        await expect(analysisPromise).rejects.toThrow('ffprobe metadata analysis failed: some ffprobe error');
    });

    it('should reject when ffprobe returns invalid JSON', async () => {
        (fs.existsSync as any).mockReturnValue(true);

        const mockProc1 = new EventEmitter() as any;
        mockProc1.stdout = new EventEmitter();
        mockProc1.stderr = new EventEmitter();

        (child_process.spawn as any).mockImplementation((command: string) => {
            if (command === 'ffprobe') return mockProc1;
        });

        const analysisPromise = analyzeAudio('mock/file.mp3');

        mockProc1.stdout.emit('data', 'invalid JSON');
        mockProc1.emit('close', 0);

        await expect(analysisPromise).rejects.toThrow(SyntaxError);
    });

    it('should reject when ffmpeg misses LUFS/peak values', async () => {
        (fs.existsSync as any).mockReturnValue(true);
        (fs.statSync as any).mockReturnValue({ size: 4800000 });

        const mockProc1 = new EventEmitter() as any;
        mockProc1.stdout = new EventEmitter();
        mockProc1.stderr = new EventEmitter();

        const mockProc2 = new EventEmitter() as any;
        mockProc2.stdout = new EventEmitter();
        mockProc2.stderr = new EventEmitter();

        (child_process.spawn as any).mockImplementation((command: string) => {
            if (command === 'ffprobe') return mockProc1;
            if (command === 'ffmpeg') return mockProc2;
        });

        const analysisPromise = analyzeAudio('mock/file.mp3');

        const mockFfprobeOutput = JSON.stringify({
            format: { bit_rate: "320000", duration: "120.5" },
            streams: [{ codec_type: "audio", sample_rate: "44100" }]
        });
        mockProc1.stdout.emit('data', mockFfprobeOutput);
        mockProc1.emit('close', 0);

        mockProc2.stderr.emit('data', 'Missing LUFS output');
        mockProc2.emit('close', 0);

        await expect(analysisPromise).rejects.toThrow('missing LUFS/peak metadata');
    });
});
