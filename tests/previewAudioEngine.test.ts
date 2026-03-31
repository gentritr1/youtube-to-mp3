// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviewAudioEngine } from '../js/previewAudioEngine.js';
import { AudioStub } from './helpers/audiostub.ts';
import { deferred } from './helpers/deferred.ts';

describe('PreviewAudioEngine request races', () => {
    let engine: PreviewAudioEngine;
    let statusSpy: ReturnType<typeof vi.fn>;
    let errorSpy: ReturnType<typeof vi.fn>;
    let stateSpy: ReturnType<typeof vi.fn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let visualizer: { play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> };
    let originalRequestAnimationFrame: typeof globalThis.requestAnimationFrame;
    let originalCancelAnimationFrame: typeof globalThis.cancelAnimationFrame;

    beforeEach(() => {
        statusSpy = vi.fn();
        errorSpy = vi.fn();
        stateSpy = vi.fn();
        visualizer = {
            play: vi.fn(),
            pause: vi.fn()
        };
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        originalRequestAnimationFrame = globalThis.requestAnimationFrame;
        originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
        globalThis.requestAnimationFrame = vi.fn(() => 1) as typeof globalThis.requestAnimationFrame;
        globalThis.cancelAnimationFrame = vi.fn() as typeof globalThis.cancelAnimationFrame;

        engine = new PreviewAudioEngine({
            onStatus: statusSpy,
            onError: errorSpy,
            onStateChange: stateSpy,
            audioVisualizer: visualizer as any
        });
    });

    afterEach(() => {
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
        globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
        consoleErrorSpy.mockRestore();
        vi.restoreAllMocks();
    });

    it('keeps loading state until the current request ends', () => {
        const requestA = engine.beginRequest();
        const requestB = engine.beginRequest();

        engine.endRequest(requestA.requestId, requestA.controller);
        expect(engine.isLoading()).toBe(true);

        engine.endRequest(requestB.requestId, requestB.controller);
        expect(engine.isLoading()).toBe(false);
    });

    it('disposes a stale loaded preview when a newer request has replaced it', async () => {
        const firstAudio = new AudioStub('https://example.com/one.mp3');
        const secondAudio = new AudioStub('https://example.com/two.mp3');
        const firstLoad = deferred<AudioStub>();
        const secondLoad = deferred<AudioStub>();

        vi.spyOn(engine, 'buildPreviewAudio')
            .mockReturnValueOnce(firstAudio as any)
            .mockReturnValueOnce(secondAudio as any);
        vi.spyOn(engine, 'awaitPreviewCanPlay')
            .mockReturnValueOnce(firstLoad.promise as any)
            .mockReturnValueOnce(secondLoad.promise as any);

        const requestA = engine.beginRequest();
        const promiseA = engine.loadPreview('https://example.com/one.mp3', {
            requestId: requestA.requestId,
            outgoingAudio: requestA.outgoingAudio,
            shouldAutoplay: false,
            seedSource: 'track-a'
        });

        const requestB = engine.beginRequest();
        const promiseB = engine.loadPreview('https://example.com/two.mp3', {
            requestId: requestB.requestId,
            outgoingAudio: requestB.outgoingAudio,
            shouldAutoplay: false,
            seedSource: 'track-b'
        });

        firstLoad.resolve(firstAudio);
        await expect(promiseA).resolves.toBe(false);
        expect(firstAudio.paused).toBe(true);
        expect(firstAudio.src).toBe('');
        expect(firstAudio.loadCalls).toBe(1);
        expect(engine.getCurrentAudio()).toBe(null);

        secondLoad.resolve(secondAudio);
        await expect(promiseB).resolves.toBe(true);
        expect(engine.getCurrentAudio()).toBe(secondAudio);
    });

    it('ignores stale outgoing audio errors during crossfade handoff', async () => {
        const outgoingAudio = new AudioStub('https://example.com/outgoing.mp3');
        const incomingAudio = new AudioStub('https://example.com/incoming.mp3');

        engine.attachPreviewAudioEvents(outgoingAudio as any, 'track-a');
        engine.previewAudio = outgoingAudio as any;
        engine.isPreviewPlaying = true;

        vi.spyOn(engine, 'buildPreviewAudio').mockReturnValue(incomingAudio as any);
        vi.spyOn(engine, 'awaitPreviewCanPlay').mockResolvedValue(incomingAudio as any);

        const request = engine.beginRequest();
        // Direct assignment is intentional here: this test exercises a stale
        // outgoing audio instance during handoff, not the initial load path.
        await expect(engine.loadPreview('https://example.com/incoming.mp3', {
            requestId: request.requestId,
            outgoingAudio,
            shouldAutoplay: true,
            seedSource: 'track-b'
        })).resolves.toBe(true);

        outgoingAudio.emit('error');

        expect(engine.getCurrentAudio()).toBe(incomingAudio);
        expect(errorSpy).not.toHaveBeenCalled();
        expect(statusSpy).not.toHaveBeenCalledWith('Preview unavailable');
    });

    it('invalidates a pending preview load when stopAll runs before the audio resolves', async () => {
        const lateAudio = new AudioStub('https://example.com/late.mp3');
        const pendingLoad = deferred<AudioStub>();

        vi.spyOn(engine, 'buildPreviewAudio').mockReturnValueOnce(lateAudio as any);
        vi.spyOn(engine, 'awaitPreviewCanPlay').mockReturnValueOnce(pendingLoad.promise as any);

        const request = engine.beginRequest();
        const pending = engine.loadPreview('https://example.com/late.mp3', {
            requestId: request.requestId,
            outgoingAudio: request.outgoingAudio,
            shouldAutoplay: false,
            seedSource: 'late-track'
        });

        engine.stopAll();
        pendingLoad.resolve(lateAudio);

        await expect(pending).resolves.toBe(false);
        expect(engine.getCurrentAudio()).toBe(null);
        expect(engine.isLoading()).toBe(false);
        expect(visualizer.pause).toHaveBeenCalled();
        expect(lateAudio.src).toBe('');
        expect(lateAudio.loadCalls).toBe(1);
    });
});
