/**
 * Tests for utility functions
 */

import { describe, it, expect } from 'vitest';
import { formatDuration } from '../server/utils/formatDuration.ts';
import { parseProgress } from '../server/utils/parseProgress.ts';
import { sanitizeFilename } from '../server/utils/sanitize.ts';

describe('formatDuration', () => {
    it('formats seconds to MM:SS', () => {
        expect(formatDuration(125)).toBe('2:05');
        expect(formatDuration(60)).toBe('1:00');
        expect(formatDuration(59)).toBe('0:59');
    });

    it('returns null for falsy values', () => {
        expect(formatDuration(null)).toBeNull();
        expect(formatDuration(0)).toBeNull();
        expect(formatDuration(undefined)).toBeNull();
    });

    it('handles long durations', () => {
        expect(formatDuration(3661)).toBe('61:01'); // Over an hour
    });
});

describe('parseProgress', () => {
    it('parses download progress', () => {
        const result = parseProgress('[download]  45.3% of 10.5MiB at 1.2MiB/s');
        expect(result).toEqual({
            percent: 36, // 45.3 * 0.8 rounded
            status: 'Downloading... 45.3%'
        });
    });

    it('detects audio extraction', () => {
        const result = parseProgress('[ExtractAudio] Destination: file.mp3');
        expect(result).toEqual({
            percent: 90,
            status: 'Processing audio...'
        });
    });

    it('detects ffmpeg processing', () => {
        const result = parseProgress('[ffmpeg] Merging formats');
        expect(result).toEqual({
            percent: 95,
            status: 'Converting...'
        });
    });

    it('returns null for unrecognized output', () => {
        expect(parseProgress('Some random log')).toBeNull();
        expect(parseProgress('')).toBeNull();
    });
});

describe('sanitizeFilename', () => {
    it('removes Official Video suffix', () => {
        expect(sanitizeFilename('Song Name (Official Video)')).toBe('Song Name');
        expect(sanitizeFilename('Song Name (Official Music Video)')).toBe('Song Name');
    });

    it('removes Lyrics suffix', () => {
        expect(sanitizeFilename('Song Name (Lyrics)')).toBe('Song Name');
        expect(sanitizeFilename('Song Name (Lyric Video)')).toBe('Song Name');
    });

    it('removes invalid filesystem characters', () => {
        expect(sanitizeFilename('Song: Name | Artist')).toBe('Song Name');
        expect(sanitizeFilename('Name <test>')).toBe('Name test');
    });

    it('handles empty or null input', () => {
        // Both empty string and null coerce to 'video' via (title || 'video')
        expect(sanitizeFilename('')).toBe('video');
        expect(sanitizeFilename(null)).toBe('video');
    });

    it('preserves accented characters', () => {
        expect(sanitizeFilename('Café Música')).toBe('Café Música');
    });

    it('truncates long titles', () => {
        const longTitle = 'A'.repeat(150);
        expect(sanitizeFilename(longTitle).length).toBeLessThanOrEqual(120);
    });
});
