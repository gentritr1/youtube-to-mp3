// @vitest-environment jsdom
/**
 * LyricsController Race-Condition Tests
 *
 * Validates that the request-scoped ID guard in loadSubtitles()
 * correctly drops stale responses when a newer request supersedes.
 *
 * Phase 3 of the Architecture Cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LyricsController } from '../js/lyrics.js';

// ── Helpers ────────────────────────────────────────────────────────

/** Build a minimal subtitles array that loadSubtitles expects. */
const makeSubs = (lang = 'en') => [
    { lang, url: `https://example.com/subs/${lang}.vtt`, ext: 'vtt' },
];

/** VTT payload that parseSubtitles can handle. */
const VTT_PAYLOAD = `WEBVTT

00:00:01.000 --> 00:00:03.000
Hello world

00:00:04.000 --> 00:00:06.000
Second line`;

/**
 * Create a deferred fetch that we can resolve/reject manually.
 * Returns { promise, resolve, reject } – the promise is what
 * globalThis.fetch returns.
 */
function deferredFetch() {
    let resolve!: (v: Response) => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<Response>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function makeOkResponse(body: string): Response {
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/vtt' } });
}

// ── Tests ──────────────────────────────────────────────────────────

describe('LyricsController race-condition guard', () => {
    let controller: InstanceType<typeof LyricsController>;
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        controller = new LyricsController();
        originalFetch = globalThis.fetch;
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('drops a stale response when a newer request has been issued', async () => {
        const firstDeferred = deferredFetch();
        const secondDeferred = deferredFetch();

        let fetchCallCount = 0;
        globalThis.fetch = vi.fn(() => {
            fetchCallCount++;
            return fetchCallCount === 1 ? firstDeferred.promise : secondDeferred.promise;
        }) as typeof fetch;

        const loadedEvents: any[] = [];
        const emptyEvents: any[] = [];
        controller.on('loaded', (e: any) => loadedEvents.push(e));
        controller.on('empty', (e: any) => emptyEvents.push(e));

        // Start request A
        const promiseA = controller.loadSubtitles(makeSubs(), { requestId: 'req-A' });

        // Start request B while A is still in flight — this overwrites requestId
        const promiseB = controller.loadSubtitles(makeSubs(), { requestId: 'req-B' });

        // Resolve A first (stale response)
        firstDeferred.resolve(makeOkResponse(VTT_PAYLOAD));
        const resultA = await promiseA;

        // A should have been dropped (requestId mismatch)
        expect(resultA).toBe(false);

        // Resolve B (current response)
        secondDeferred.resolve(makeOkResponse(VTT_PAYLOAD));
        const resultB = await promiseB;

        // B should succeed
        expect(resultB).toBe(true);

        // Only B should emit 'loaded'
        expect(loadedEvents).toHaveLength(1);
        expect(loadedEvents[0].requestId).toBe('req-B');
    });

    it('emits empty when the subtitle endpoint returns HTML instead of subtitles', async () => {
        globalThis.fetch = vi.fn(() => Promise.resolve(
            makeOkResponse('<!DOCTYPE html><html><body>not subtitles</body></html>')
        )) as typeof fetch;

        const emptyEvents: Array<{ requestId: string | null }> = [];
        const loadedEvents: Array<{ requestId: string | null }> = [];
        controller.on('empty', (event: { requestId: string | null }) => emptyEvents.push(event));
        controller.on('loaded', (event: { requestId: string | null }) => loadedEvents.push(event));

        const result = await controller.loadSubtitles(makeSubs(), { requestId: 'req-html' });

        expect(result).toBe(false);
        expect(loadedEvents).toHaveLength(0);
        expect(emptyEvents).toEqual([{ requestId: 'req-html' }]);
        expect(controller.getLyrics()).toEqual([]);
    });

    it('emits "empty" only for the current request on fetch error', async () => {
        const firstDeferred = deferredFetch();
        const secondDeferred = deferredFetch();

        let fetchCallCount = 0;
        globalThis.fetch = vi.fn(() => {
            fetchCallCount++;
            return fetchCallCount === 1 ? firstDeferred.promise : secondDeferred.promise;
        }) as typeof fetch;

        const emptyEvents: any[] = [];
        controller.on('empty', (e: any) => emptyEvents.push(e));

        // Start A then B
        const promiseA = controller.loadSubtitles(makeSubs(), { requestId: 'req-A' });
        const promiseB = controller.loadSubtitles(makeSubs(), { requestId: 'req-B' });

        // A fails after B has taken over
        firstDeferred.reject(new Error('Network error'));
        await promiseA;

        // B also fails — but B is the current request
        secondDeferred.reject(new Error('Server error'));
        await promiseB;

        // Only B's error should emit 'empty' (A was stale)
        const bEmpty = emptyEvents.filter((e) => e.requestId === 'req-B');
        const aEmpty = emptyEvents.filter((e) => e.requestId === 'req-A');
        expect(bEmpty.length).toBeGreaterThanOrEqual(1);
        // A should NOT emit empty since it was superseded
        expect(aEmpty).toHaveLength(0);
    });

    it('handles rapid sequential requests — only the last one wins', async () => {
        const deferreds = Array.from({ length: 5 }, () => deferredFetch());
        let fetchCallCount = 0;

        globalThis.fetch = vi.fn(() => {
            return deferreds[fetchCallCount++].promise;
        }) as typeof fetch;

        const loadedEvents: any[] = [];
        controller.on('loaded', (e: any) => loadedEvents.push(e));

        // Fire 5 rapid requests
        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(controller.loadSubtitles(makeSubs(), { requestId: `req-${i}` }));
        }

        // Resolve all in order
        for (const d of deferreds) {
            d.resolve(makeOkResponse(VTT_PAYLOAD));
        }

        const results = await Promise.all(promises);

        // Only the last request should succeed
        expect(results[4]).toBe(true);
        for (let i = 0; i < 4; i++) {
            expect(results[i]).toBe(false);
        }

        // Only one 'loaded' event from the last request
        expect(loadedEvents).toHaveLength(1);
        expect(loadedEvents[0].requestId).toBe('req-4');
    });

    it('finishPlayback emits stop after subtitles have loaded even if playback never started', async () => {
        globalThis.fetch = vi.fn(() => Promise.resolve(makeOkResponse(VTT_PAYLOAD))) as typeof fetch;

        const stopEvents: Array<{ preserveLyrics: boolean; requestId: string | null; lyrics: Array<{ text: string }> }> = [];
        controller.on('stop', (event: { preserveLyrics: boolean; requestId: string | null; lyrics: Array<{ text: string }> }) => {
            stopEvents.push(event);
        });

        const loaded = await controller.loadSubtitles(makeSubs(), { requestId: 'req-stop' });
        const didFinish = controller.finishPlayback();
        const finishEvent = stopEvents.find((event) => event.preserveLyrics && event.requestId === 'req-stop');

        expect(loaded).toBe(true);
        expect(didFinish).toBe(true);
        expect(finishEvent).toBeDefined();
        expect(finishEvent?.lyrics).toHaveLength(2);
        expect(controller.getLyrics()).toHaveLength(2);
    });
});
