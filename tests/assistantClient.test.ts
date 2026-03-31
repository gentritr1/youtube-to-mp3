import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantClient } from '../js/ui/assistantClient.js';
import { deferred } from './helpers/deferred.ts';

const makeOkResponse = (payload) => ({
    ok: true,
    json: async () => payload
});

describe('AssistantClient request races', () => {
    let originalFetch;
    let onRender;
    let onFallback;
    let onResponseChange;
    let client;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        onRender = vi.fn();
        onFallback = vi.fn();
        onResponseChange = vi.fn();
        client = new AssistantClient({
            sessionId: 'session-1',
            onRender,
            onFallback,
            onResponseChange
        });
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('drops a stale success response when a newer assistant request has replaced it', async () => {
        const firstRequest = deferred();
        const secondRequest = deferred();
        let fetchCallCount = 0;

        globalThis.fetch = vi.fn(() => {
            fetchCallCount += 1;
            return fetchCallCount === 1 ? firstRequest.promise : secondRequest.promise;
        });

        const promiseA = client.requestUpdate(() => ({ version: 'A' }), 'first');
        const promiseB = client.requestUpdate(() => ({ version: 'B' }), 'second');

        firstRequest.resolve(makeOkResponse({ assistantText: 'stale', nextAction: null }));
        await expect(promiseA).resolves.toBe(null);
        expect(onRender).not.toHaveBeenCalled();
        expect(client.getCurrentResponse()).toBe(null);

        secondRequest.resolve(makeOkResponse({ assistantText: 'fresh', nextAction: null }));
        await expect(promiseB).resolves.toEqual({ assistantText: 'fresh', nextAction: null });

        expect(onRender).toHaveBeenCalledTimes(1);
        expect(onRender).toHaveBeenCalledWith({ assistantText: 'fresh', nextAction: null });
        expect(client.getCurrentResponse()).toEqual({ assistantText: 'fresh', nextAction: null });
    });

    it('ignores a stale failure after a newer assistant request succeeds', async () => {
        const firstRequest = deferred();
        const secondRequest = deferred();
        let fetchCallCount = 0;

        globalThis.fetch = vi.fn(() => {
            fetchCallCount += 1;
            return fetchCallCount === 1 ? firstRequest.promise : secondRequest.promise;
        });

        const promiseA = client.requestUpdate(() => ({ version: 'A' }), 'first');
        const promiseB = client.requestUpdate(() => ({ version: 'B' }), 'second');

        firstRequest.reject(new Error('network failure'));
        await expect(promiseA).resolves.toBe(null);
        expect(onFallback).not.toHaveBeenCalled();
        expect(onResponseChange).not.toHaveBeenCalledWith(null);

        secondRequest.resolve(makeOkResponse({ assistantText: 'fresh', nextAction: null }));
        await expect(promiseB).resolves.toEqual({ assistantText: 'fresh', nextAction: null });

        expect(onRender).toHaveBeenCalledTimes(1);
        expect(onFallback).not.toHaveBeenCalled();
        expect(client.getCurrentResponse()).toEqual({ assistantText: 'fresh', nextAction: null });
    });

    it('invalidates an in-flight request when the response is cleared', async () => {
        const pendingRequest = deferred();

        globalThis.fetch = vi.fn(() => pendingRequest.promise);

        const pending = client.requestUpdate(() => ({ version: 'A' }), 'first');
        client.clearResponse();

        pendingRequest.resolve(makeOkResponse({ assistantText: 'stale', nextAction: null }));

        await expect(pending).resolves.toBe(null);
        expect(onRender).not.toHaveBeenCalled();
        expect(client.getCurrentResponse()).toBe(null);
    });
});
