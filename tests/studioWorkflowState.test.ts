import { describe, expect, it } from 'vitest';
import {
    getFinishedPlaybackState,
    getIdleStudioState,
    getLoadingStudioState,
    getLyricsStudioState
} from '../js/ui/studioWorkflowState.js';

describe('studioWorkflowState', () => {
    it('returns the idle studio shell with reset state and guidance copy', () => {
        const state = getIdleStudioState();

        expect(state.stage).toBe('setup');
        expect(state.points).toEqual([]);
        expect(state.selectedPointId).toBeNull();
        expect(state.nowPlayingPointId).toBeNull();
        expect(state.autosync.status).toBe('not_run');
        expect(state.history.undoStack).toEqual([]);
        expect(state.status).toEqual({
            badge: 'Setup',
            title: 'Paste a video to build sync points.',
            detail: 'If subtitles are available, this panel turns them into line-start points you can review one by one.',
            tone: 'idle'
        });
        expect(state.pointListPlaceholder).toHaveLength(3);
        expect(state.clearTooltip).toBe(true);
    });

    it('keeps stage when loading existing points and resets selection when empty', () => {
        const withPoints = getLoadingStudioState({
            stage: 'review',
            points: [{ id: 'P1' }]
        });
        expect(withPoints.stage).toBe('review');
        expect(withPoints.selectedPointId).toBeUndefined();
        expect(withPoints.nowPlayingPointId).toBeUndefined();
        expect(withPoints.pointListPlaceholder).toBeNull();
        expect(withPoints.clearTooltip).toBe(false);

        const empty = getLoadingStudioState({
            stage: 'review',
            points: []
        });
        expect(empty.stage).toBe('setup');
        expect(empty.selectedPointId).toBeNull();
        expect(empty.nowPlayingPointId).toBeNull();
        expect(empty.pointListPlaceholder).toEqual([
            'Checking the video for subtitle cues.',
            'If timing is missing, the studio will mark those points for review.'
        ]);
        expect(empty.clearTooltip).toBe(true);
    });

    it('returns empty-state copy when lyric parsing yields no points', () => {
        const state = getLyricsStudioState({
            lines: [],
            createPointId: (index: number) => `P${index + 1}`
        });

        expect(state.isEmpty).toBe(true);
        expect(state.status.badge).toBe('No lyrics');
        expect(state.autosync.status).toBe('failed');
        expect(state.pointListPlaceholder).toEqual([
            'Try a video that includes captions if you want to use the sync studio.',
            'Pasted lyrics will still work even when subtitle timing is unavailable.'
        ]);
    });

    it('builds lyric points and playback finish state for export-ready sessions', () => {
        const lyricsState = getLyricsStudioState({
            lines: [
                { text: 'Line 1', time: 0, hasTiming: true },
                { text: 'Line 2', time: 2000, hasTiming: true }
            ],
            createPointId: (index: number) => `P${index + 1}`
        });

        expect(lyricsState.isEmpty).toBe(false);
        expect(lyricsState.stage).toBe('lyrics');
        expect(lyricsState.selectedPointId).toBe('P1');
        expect(lyricsState.points).toHaveLength(2);
        expect(lyricsState.status.title).toBe('Points are ready for Auto-sync.');

        const finishState = getFinishedPlaybackState({
            points: [
                { id: 'P1', status: 'synced' },
                { id: 'P2', status: 'synced' }
            ],
            stage: 'review'
        });

        expect(finishState.shouldResetToIdle).toBe(false);
        expect(finishState.stage).toBe('export');
        expect(finishState.status).toEqual({
            badge: 'Ready',
            title: 'The point pass is ready.',
            detail: 'Use the assistant CTA to keep moving one point at a time, or export the timing JSON when you are done.',
            tone: 'done'
        });

        const emptyFinish = getFinishedPlaybackState({
            points: [],
            stage: 'review'
        });
        expect(emptyFinish).toEqual({ shouldResetToIdle: true });
    });
});
