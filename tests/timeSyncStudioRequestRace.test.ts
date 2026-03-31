// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { TimeSyncStudio } from '../js/ui/timeSyncStudio.js';

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const createStudio = () => {
    const reviewPlayerFrame = document.createElement('div');
    const reviewPlayerSummary = document.createElement('div');
    const reviewPlayButton = document.createElement('button');
    const reviewJumpButton = document.createElement('button');
    const reviewLoopButton = document.createElement('button');
    const reviewTimeReadout = document.createElement('div');
    const reviewLoopRange = document.createElement('div');

    return new TimeSyncStudio({
        reviewPlayerFrame,
        reviewPlayerSummary,
        reviewPlayButton,
        reviewJumpButton,
        reviewLoopButton,
        reviewTimeReadout,
        reviewLoopRange
    });
};

describe('TimeSyncStudio review-player request races', () => {
    it('marks an older review-player load as stale when a newer media source replaces it', async () => {
        const studio = createStudio();
        const loads = [];
        const firstLoad = deferred();
        const secondLoad = deferred();

        studio.reviewPlayerAdapter = {
            getPlayer: () => null,
            isReady: () => false,
            hasVideo: () => false,
            destroy: vi.fn(),
            loadForVideo: vi.fn((videoId, options) => {
                loads.push({ videoId, isCurrentRequest: options.isCurrentRequest });
                return loads.length === 1 ? firstLoad.promise : secondLoad.promise;
            })
        };

        const promiseA = studio.setMediaSource({ kind: 'youtube', videoId: 'video-a', title: 'Video A' });
        const promiseB = studio.setMediaSource({ kind: 'youtube', videoId: 'video-b', title: 'Video B' });

        expect(loads).toHaveLength(2);
        expect(loads[0].videoId).toBe('video-a');
        expect(loads[1].videoId).toBe('video-b');
        expect(loads[0].isCurrentRequest()).toBe(false);
        expect(loads[1].isCurrentRequest()).toBe(true);
        expect(studio.mediaSource?.videoId).toBe('video-b');

        firstLoad.resolve();
        secondLoad.resolve();

        await Promise.all([promiseA, promiseB]);
    });

    it('invalidates an in-flight review-player load when the media source is cleared', async () => {
        const studio = createStudio();
        const loads = [];
        const pendingLoad = deferred();

        studio.reviewPlayerAdapter = {
            getPlayer: () => null,
            isReady: () => false,
            hasVideo: () => false,
            destroy: vi.fn(),
            loadForVideo: vi.fn((videoId, options) => {
                loads.push({ videoId, isCurrentRequest: options.isCurrentRequest });
                return pendingLoad.promise;
            })
        };

        const pending = studio.setMediaSource({ kind: 'youtube', videoId: 'video-a', title: 'Video A' });
        await Promise.resolve();

        const clearPromise = studio.setMediaSource(null);

        expect(loads).toHaveLength(1);
        expect(loads[0].isCurrentRequest()).toBe(false);
        expect(studio.mediaSource).toBe(null);
        expect(studio.reviewPlayerAdapter.destroy).toHaveBeenCalledTimes(1);

        pendingLoad.resolve();

        await Promise.all([pending, clearPromise]);
    });
});
