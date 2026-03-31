// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
    buildReviewPlayerViewModel,
    getReviewPlayerDurationMs,
    getReviewPlayerPlayheadMs,
    normalizeReviewMediaSource,
    renderReviewPlayerPanel,
    stepReviewPlaybackLoop
} from '../js/ui/reviewPlayerPanel.js';

const formatTime = (timeMs: number | null) => {
    if (!Number.isFinite(timeMs)) {
        return '';
    }

    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    const milliseconds = String(timeMs % 1000).padStart(3, '0');
    return `${minutes}:${seconds}.${milliseconds}`;
};

describe('reviewPlayerPanel helpers', () => {
    it('normalizes youtube media sources defensively', () => {
        expect(normalizeReviewMediaSource({
            kind: 'youtube',
            videoId: 'abc123',
            title: '',
            durationMs: 92000
        })).toEqual({
            kind: 'youtube',
            videoId: 'abc123',
            title: 'UNSPECIFIED',
            durationMs: 92000
        });

        expect(normalizeReviewMediaSource({ kind: 'file', videoId: 'abc123' })).toBeNull();
        expect(normalizeReviewMediaSource(null)).toBeNull();
    });

    it('prefers player duration and playhead over fallbacks', () => {
        const reviewPlayer = {
            getDuration: () => 123.456,
            getCurrentTime: () => 4.321
        };

        expect(getReviewPlayerDurationMs({
            reviewPlayerReady: true,
            reviewPlayer,
            mediaSource: { durationMs: 90000 }
        })).toBe(123456);

        expect(getReviewPlayerPlayheadMs({
            reviewPlayerReady: true,
            reviewPlayer,
            fallbackPlayheadMs: 9000
        })).toBe(4321);

        expect(getReviewPlayerPlayheadMs({
            explicitPlayheadMs: 2500,
            reviewPlayerReady: true,
            reviewPlayer,
            fallbackPlayheadMs: 9000
        })).toBe(2500);
    });

    it('builds view state and renders the review panel controls', () => {
        const summary = document.createElement('p');
        const playButton = document.createElement('button');
        const jumpButton = document.createElement('button');
        const loopButton = document.createElement('button');
        const timeReadout = document.createElement('p');
        const loopRange = document.createElement('p');
        const frame = document.createElement('div');

        const viewModel = buildReviewPlayerViewModel({
            mediaSource: { kind: 'youtube', videoId: 'abc123' },
            selectedPoint: { id: 'P2', index: 1, timeMs: 2200, draftTimeMs: 2000 },
            selectedTimeMs: 2200,
            currentPlayheadMs: 2800,
            reviewPlayerReady: true,
            isPlaying: true,
            reviewLoopEnabled: true,
            loopEndMs: 5200,
            hasFrame: true,
            formatTime
        });

        renderReviewPlayerPanel({
            reviewPlayerSummary: summary,
            reviewPlayButton: playButton,
            reviewJumpButton: jumpButton,
            reviewLoopButton: loopButton,
            reviewTimeReadout: timeReadout,
            reviewLoopRange: loopRange,
            reviewPlayerFrame: frame
        }, viewModel);

        expect(summary.textContent).toContain('Review Point 2');
        expect(playButton.textContent).toBe('Pause');
        expect(playButton.disabled).toBe(false);
        expect(jumpButton.disabled).toBe(false);
        expect(loopButton.disabled).toBe(false);
        expect(loopButton.getAttribute('aria-pressed')).toBe('true');
        expect(loopButton.classList.contains('is-active')).toBe(true);
        expect(timeReadout.textContent).toBe('0:02.800');
        expect(loopRange.textContent).toBe('Loop range: 0:02.200 -> 0:05.200');
        expect(frame.hidden).toBe(false);
        expect(frame.classList.contains('is-ready')).toBe(true);
    });

    it('computes loop playback decisions from the current playhead', () => {
        const result = stepReviewPlaybackLoop({
            reviewPlayer: {
                getCurrentTime: () => 5.4
            },
            reviewLoopEnabled: true,
            selectedPoint: {
                id: 'P2',
                timeMs: 2200,
                draftTimeMs: 2000
            },
            nowPlayingPointId: 'P1',
            findPointForTime: (timeMs: number) => timeMs >= 5000 ? { id: 'P3' } : { id: 'P2' },
            getLoopEndTime: () => 5000
        });

        expect(result).toEqual({
            playheadMs: 5400,
            nextNowPlayingPointId: 'P3',
            shouldLoopToMs: 2200
        });
    });
});
