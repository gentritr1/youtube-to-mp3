import { describe, expect, it } from 'vitest';
import {
    applyNeedsReviewFix,
    buildPointSnapshot,
    buildPoints,
    createAutosyncState,
    createHistoryState,
    findPointForTime,
    getLoopEndTime,
    nudgePointTiming,
    runAutosyncPass,
    undoPointChange
} from '../js/ui/pointTimingEngine.js';

const formatTime = (timeMs: number | null) => {
    if (!Number.isFinite(timeMs)) {
        return '';
    }

    const totalSeconds = Math.floor((timeMs ?? 0) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    const milliseconds = String((timeMs ?? 0) % 1000).padStart(3, '0');
    return `${minutes}:${seconds}.${milliseconds}`;
};

describe('pointTimingEngine', () => {
    it('builds points and runs autosync with review flags', () => {
        const points = buildPoints([
            { text: 'Intro', time: 0, hasTiming: true },
            { text: 'Guess', hasTiming: false },
            { text: 'Late entry', time: 10000, hasTiming: true },
            { text: 'Crowded', time: 10200, hasTiming: true }
        ]);

        const result = runAutosyncPass({
            points,
            estimateGapMs: 2200,
            selectedPointId: points[0].id
        });

        expect(result.selectedPointId).toBe(points[1].id);
        expect(result.stage).toBe('review');
        expect(result.autosync.coverage).toBe(0.75);
        expect(result.autosync.confidence).toBe('medium');
        expect(result.points.map((point) => point.status)).toEqual([
            'synced',
            'needs_review',
            'needs_review',
            'needs_review'
        ]);
        expect(result.autosync.issuesByPointId[points[1].id]).toEqual(['timing_estimated']);
        expect(result.autosync.issuesByPointId[points[2].id]).toEqual(['late_start']);
        expect(result.autosync.issuesByPointId[points[3].id]).toEqual(['early_start']);
    });

    it('nudges a point, clamps to media duration, and clears the last review issue', () => {
        const result = nudgePointTiming({
            points: [
                { id: 'P1', index: 0, textPreview: 'Intro', draftTimeMs: 0, timeMs: 0, status: 'synced', issues: [] },
                { id: 'P2', index: 1, textPreview: 'Hook', draftTimeMs: 3000, timeMs: 4900, status: 'needs_review', issues: ['late_start'] }
            ],
            pointId: 'P2',
            deltaMs: 200,
            history: createHistoryState(),
            autosync: createAutosyncState({
                status: 'done',
                coverage: 0.5,
                confidence: 'medium',
                issuesByPointId: { P2: ['late_start'] }
            }),
            stage: 'review',
            clampTimeMs: (timeMs: number) => Math.min(Math.max(Math.round(timeMs), 0), 5000),
            getMediaDurationMs: () => 5000,
            formatTime
        });

        expect(result).toBeTruthy();
        expect(result?.points[1].timeMs).toBe(5000);
        expect(result?.points[1].status).toBe('synced');
        expect(result?.stage).toBe('export');
        expect(result?.status?.title).toBe('All flagged points are now confirmed.');
        expect(result?.editorFeedback).toEqual({
            message: 'Reached the end of the video at 0:05.000.',
            tone: 'warning'
        });
        expect(result?.autosync.issuesByPointId).toEqual({});
        expect(result?.history.undoStack).toHaveLength(1);
    });

    it('falls back safely when formatTime or loop callbacks are missing', () => {
        const result = nudgePointTiming({
            points: [
                { id: 'P1', index: 0, textPreview: 'Only', draftTimeMs: 1000, timeMs: 4900, status: 'needs_review', issues: ['late_start'] }
            ],
            pointId: 'P1',
            deltaMs: 500,
            history: createHistoryState(),
            autosync: createAutosyncState({
                issuesByPointId: { P1: ['late_start'] }
            }),
            stage: 'review',
            clampTimeMs: (timeMs: number) => Math.min(timeMs, 5000),
            getMediaDurationMs: () => 5000
        });

        expect(result?.editorFeedback).toEqual({
            message: 'Reached the end of the video.',
            tone: 'warning'
        });
        expect(
            getLoopEndTime({
                points: [
                    { id: 'P1', index: 0, textPreview: 'A', draftTimeMs: 0, timeMs: 1000, status: 'synced', issues: [] },
                    { id: 'P2', index: 1, textPreview: 'B', draftTimeMs: 0, timeMs: 2500, status: 'synced', issues: [] }
                ],
                pointId: 'P1'
            })
        ).toBe(2500);
        expect(
            getLoopEndTime({
                points: [
                    { id: 'P1', index: 0, textPreview: 'A', draftTimeMs: 0, timeMs: 1000, status: 'synced', issues: [] }
                ],
                pointId: 'P1'
            })
        ).toBeNull();
    });

    it('falls back safely when clampTimeMs is missing', () => {
        const result = nudgePointTiming({
            points: [
                { id: 'P1', index: 0, textPreview: 'Only', draftTimeMs: 1000, timeMs: 4900, status: 'needs_review', issues: ['late_start'] }
            ],
            pointId: 'P1',
            deltaMs: 500,
            history: createHistoryState(),
            autosync: createAutosyncState({
                issuesByPointId: { P1: ['late_start'] }
            }),
            stage: 'review',
            getMediaDurationMs: () => 5000
        });

        expect(result?.points[0].timeMs).toBe(5400);
        expect(result?.editorFeedback).toBeNull();
    });

    it('applies a batch fix and undo restores the review state', () => {
        const fixed = applyNeedsReviewFix({
            points: [
                { id: 'P1', index: 0, textPreview: 'Line 1', draftTimeMs: 0, timeMs: 0, status: 'synced', issues: [] },
                { id: 'P2', index: 1, textPreview: 'Line 2', draftTimeMs: 2000, timeMs: 2100, status: 'needs_review', issues: ['early_start'] },
                { id: 'P3', index: 2, textPreview: 'Line 3', draftTimeMs: 5000, timeMs: 5000, status: 'needs_review', issues: ['timing_estimated'] }
            ],
            history: createHistoryState(),
            autosync: createAutosyncState({
                status: 'done',
                coverage: 0.33,
                confidence: 'low',
                issuesByPointId: {
                    P2: ['early_start'],
                    P3: ['timing_estimated']
                }
            }),
            payload: { scope: 'needs_review' }
        });

        expect(fixed).toBeTruthy();
        expect(fixed?.stage).toBe('export');
        expect(fixed?.points.every((point) => point.status === 'synced')).toBe(true);
        expect(fixed?.history.undoStack).toHaveLength(1);

        const undone = undoPointChange({
            points: fixed?.points,
            history: fixed?.history,
            autosync: fixed?.autosync
        });

        expect(undone.applied).toBe(true);
        expect(undone.stage).toBe('review');
        expect(undone.points?.[1].status).toBe('needs_review');
        expect(undone.points?.[2].issues).toEqual(['timing_estimated']);
        expect(undone.autosync?.issuesByPointId).toEqual({
            P2: ['early_start'],
            P3: ['timing_estimated']
        });
    });

    it('treats unsupported undo operations as a no-op', () => {
        const autosync = createAutosyncState({
            issuesByPointId: { P2: ['late_start'] }
        });
        const history = createHistoryState({
            undoStack: [{ type: 'UNKNOWN_OPERATION', id: 'P2' }]
        });

        const result = undoPointChange({
            points: [
                { id: 'P1', index: 0, textPreview: 'A', draftTimeMs: 0, timeMs: 0, status: 'synced', issues: [] },
                { id: 'P2', index: 1, textPreview: 'B', draftTimeMs: 2000, timeMs: 2500, status: 'needs_review', issues: ['late_start'] }
            ],
            history,
            autosync
        });

        expect(result).toEqual({ applied: false });
        expect(history.undoStack).toHaveLength(1);
        expect(autosync.issuesByPointId).toEqual({ P2: ['late_start'] });
    });

    it('finds the active point, computes loop ends, and builds assistant snapshots', () => {
        const points = [
            { id: 'P1', index: 0, textPreview: 'A', draftTimeMs: 0, timeMs: 0, status: 'synced', issues: [] },
            { id: 'P2', index: 1, textPreview: 'B', draftTimeMs: 2000, timeMs: 2200, status: 'needs_review', issues: ['late_start'] },
            { id: 'P3', index: 2, textPreview: 'C', draftTimeMs: 5000, timeMs: 5200, status: 'pending', issues: [] }
        ];

        expect(findPointForTime(points, 2500)?.id).toBe('P2');
        expect(
            getLoopEndTime({
                points,
                pointId: 'P2',
                clampTimeMs: (timeMs: number) => timeMs,
                getMediaDurationMs: () => 9000
            })
        ).toBe(5200);
        expect(
            getLoopEndTime({
                points,
                pointId: 'P3',
                clampTimeMs: (timeMs: number) => timeMs,
                getMediaDurationMs: () => 9000
            })
        ).toBe(9000);

        const snapshot = buildPointSnapshot({
            stage: 'review',
            sessionId: 'sync-123',
            getProjectTitle: () => 'Demo Track',
            selectedPointId: 'P2',
            points,
            pointWindowSize: 3,
            currentPlayheadMs: 2500,
            isPlaying: true,
            reviewLoopEnabled: true,
            reducedMotion: false,
            lastInputMode: 'keyboard',
            getLoopEndTime: (pointId: string | undefined) => (
                getLoopEndTime({
                    points,
                    pointId,
                    clampTimeMs: (timeMs: number) => timeMs,
                    getMediaDurationMs: () => 9000
                })
            )
        });

        expect(snapshot.project.title).toBe('Demo Track');
        expect(snapshot.pointFlow.counts).toEqual({
            pending: 1,
            synced: 1,
            needsReview: 1
        });
        expect(snapshot.pointFlow.currentPointId).toBe('P2');
        expect(snapshot.playback).toEqual({
            playheadMs: 2500,
            isPlaying: true,
            loop: {
                on: true,
                startMs: 2200,
                endMs: 5200
            }
        });
    });
});
