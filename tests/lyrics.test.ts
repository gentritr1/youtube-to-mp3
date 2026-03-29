import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import lyricsRoute from '../server/routes/lyrics.js';

// Mock global fetch
const originalFetch = global.fetch;

const invokeLyricsRoute = async (query: Record<string, string> = {}) => {
    return await new Promise<{ status: number; body: any; text: string }>((resolve, reject) => {
        const result = { status: 200, body: null, text: '' };
        const req: any = {
            method: 'GET',
            url: '/',
            query
        };
        const res: any = {
            status(code: number) {
                result.status = code;
                return this;
            },
            setHeader() {
                return this;
            },
            type() {
                return this;
            },
            json(payload: any) {
                result.body = payload;
                resolve(result);
                return this;
            },
            send(payload: string) {
                result.text = payload;
                resolve(result);
                return this;
            }
        };

        lyricsRoute.handle(req, res, reject);
    });
};

describe('Lyrics API Route', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('requires a url query parameter', async () => {
        const response = await invokeLyricsRoute();
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Subtitle URL is required');
    });

    it('proxies fetch to the subtitle URL successfully', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: () => Promise.resolve('WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nNever gonna give you up')
        });

        const targetUrl = 'https://youtube.com/api/timedtext?v=123';
        const response = await invokeLyricsRoute({ url: targetUrl });
        
        expect(response.status).toBe(200);
        expect(response.text).toBe('WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nNever gonna give you up');
        expect(global.fetch).toHaveBeenCalledWith(targetUrl);
    });

    it('returns appropriate error status if upstream fetch fails', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            text: () => Promise.resolve('Forbidden')
        });

        const targetUrl = 'https://youtube.com/api/timedtext?v=123';
        const response = await invokeLyricsRoute({ url: targetUrl });
        
        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Failed to fetch subtitles');
    });

    it('catches network errors', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

        const targetUrl = 'https://youtube.com/api/timedtext?v=123';
        const response = await invokeLyricsRoute({ url: targetUrl });
        
        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to fetch subtitles');
        expect(response.body.error).toBe('Network failure');
    });
});
