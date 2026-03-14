import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import lyricsRoute from '../server/routes/lyrics.js';

const app = express();
app.use('/api/lyrics', lyricsRoute);

// Mock global fetch
const originalFetch = global.fetch;

describe('Lyrics API Route', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('requires a url query parameter', async () => {
        const response = await request(app).get('/api/lyrics');
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
        const response = await request(app).get(`/api/lyrics?url=${encodeURIComponent(targetUrl)}`);
        
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
        const response = await request(app).get(`/api/lyrics?url=${encodeURIComponent(targetUrl)}`);
        
        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Failed to fetch subtitles');
    });

    it('catches network errors', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

        const targetUrl = 'https://youtube.com/api/timedtext?v=123';
        const response = await request(app).get(`/api/lyrics?url=${encodeURIComponent(targetUrl)}`);
        
        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to fetch subtitles');
        expect(response.body.error).toBe('Network failure');
    });
});
