import { describe, expect, it } from 'vitest';
import { parsePreviewRange } from '../server/routes/preview.js';

describe('preview range parsing', () => {
    it('parses normal and open-ended byte ranges', () => {
        expect(parsePreviewRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
        expect(parsePreviewRange('bytes=95-', 100)).toEqual({ start: 95, end: 99 });
    });

    it('parses suffix byte ranges from the end of the file', () => {
        expect(parsePreviewRange('bytes=-25', 100)).toEqual({ start: 75, end: 99 });
        expect(parsePreviewRange('bytes=-150', 100)).toEqual({ start: 0, end: 99 });
    });

    it('rejects malformed or unsatisfiable byte ranges', () => {
        expect(parsePreviewRange('bytes=-0', 100)).toBeNull();
        expect(parsePreviewRange('bytes=-', 100)).toBeNull();
        expect(parsePreviewRange('bytes=150-200', 100)).toBeNull();
        expect(parsePreviewRange('bytes=20-10', 100)).toBeNull();
        expect(parsePreviewRange('items=0-10', 100)).toBeNull();
    });
});
