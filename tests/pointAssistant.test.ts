import { describe, expect, it } from 'vitest';
import { buildPointAssistantResponse } from '../server/services/pointAssistant.ts';

const buildSnapshot = (overrides: Record<string, any> = {}) => ({
    schemaVersion: '1.0',
    stage: 'lyrics',
    project: {
        projectId: 'proj_123',
        title: 'Test Song'
    },
    pointFlow: {
        totalPoints: 3,
        currentPointId: 'P1',
        nextIncompletePointId: 'P1',
        windowPointIds: ['P1', 'P2', 'P3'],
        counts: {
            pending: 3,
            synced: 0,
            needsReview: 0
        },
        confirmMode: 'implicit_undo'
    },
    pointsWindow: [
        { id: 'P1', index: 0, textPreview: 'Line one', timeMs: 0, status: 'pending', issues: [] },
        { id: 'P2', index: 1, textPreview: 'Line two', timeMs: 1200, status: 'pending', issues: [] },
        { id: 'P3', index: 2, textPreview: 'Line three', timeMs: 2400, status: 'pending', issues: [] }
    ],
    playback: {
        playheadMs: 0,
        isPlaying: false,
        loop: {
            on: false,
            startMs: 0,
            endMs: 0
        }
    },
    autosync: {
        status: 'not_run',
        coverage: 0,
        confidence: 'low',
        issuesByPointId: {}
    },
    ui: {
        reducedMotion: false,
        inputMode: 'keyboard'
    },
    history: {
        undoDepth: 0,
        redoDepth: 0
    },
    errors: [],
    ...overrides
});

describe('buildPointAssistantResponse', () => {
    it('starts autosync from the lyrics stage', () => {
        const response = buildPointAssistantResponse(buildSnapshot());

        expect(response.nextAction.type).toBe('START_AUTOSYNC');
        expect(response.nextAction.requiresConfirmation).toBe(false);
        expect(response.uiAction.type).toBe('START_AUTOSYNC');
        expect(response.hints).toHaveLength(1);
    });

    it('locks review to a single point and nudges late starts earlier', () => {
        const response = buildPointAssistantResponse(buildSnapshot({
            stage: 'review',
            pointFlow: {
                totalPoints: 3,
                currentPointId: 'P2',
                nextIncompletePointId: 'P2',
                windowPointIds: ['P1', 'P2', 'P3'],
                counts: {
                    pending: 0,
                    synced: 2,
                    needsReview: 1
                },
                confirmMode: 'implicit_undo'
            },
            pointsWindow: [
                { id: 'P1', index: 0, textPreview: 'Line one', timeMs: 0, status: 'synced', issues: [] },
                { id: 'P2', index: 1, textPreview: 'Line two', timeMs: 1200, status: 'needs_review', issues: ['late_start'] },
                { id: 'P3', index: 2, textPreview: 'Line three', timeMs: 2400, status: 'synced', issues: [] }
            ],
            autosync: {
                status: 'done',
                coverage: 1,
                confidence: 'medium',
                issuesByPointId: {
                    P2: ['late_start']
                }
            }
        }));

        expect(response.nextAction.type).toBe('NUDGE_POINT');
        expect(response.nextAction.targetPointId).toBe('P2');
        expect(response.nextAction.payload).toEqual({ pointId: 'P2', deltaMs: -80 });
        expect(response.nextAction.requiresConfirmation).toBe(false);
        expect(response.uiAction.type).toBe('NUDGE_POINT');
    });

    it('requires confirmation for export', () => {
        const response = buildPointAssistantResponse(buildSnapshot({
            stage: 'export',
            pointFlow: {
                totalPoints: 3,
                currentPointId: 'P3',
                nextIncompletePointId: null,
                windowPointIds: ['P1', 'P2', 'P3'],
                counts: {
                    pending: 0,
                    synced: 3,
                    needsReview: 0
                },
                confirmMode: 'implicit_undo'
            },
            pointsWindow: [
                { id: 'P1', index: 0, textPreview: 'Line one', timeMs: 0, status: 'synced', issues: [] },
                { id: 'P2', index: 1, textPreview: 'Line two', timeMs: 1200, status: 'synced', issues: [] },
                { id: 'P3', index: 2, textPreview: 'Line three', timeMs: 2400, status: 'synced', issues: [] }
            ],
            autosync: {
                status: 'done',
                coverage: 1,
                confidence: 'high',
                issuesByPointId: {}
            }
        }));

        expect(response.nextAction.type).toBe('EXPORT');
        expect(response.nextAction.requiresConfirmation).toBe(true);
        expect(response.nextAction.confirmUI?.prompt).toBeTruthy();
        expect(response.uiAction.type).toBe('EXPORT');
    });

    it('opens help when errors are present', () => {
        const response = buildPointAssistantResponse(buildSnapshot({
            errors: [
                {
                    code: 'autoplay_blocked',
                    message: 'Playback is blocked until the user interacts once.',
                    scope: 'setup'
                }
            ]
        }));

        expect(response.nextAction.type).toBe('OPEN_PANEL');
        expect(response.nextAction.payload).toEqual({ panel: 'setup_help', errorCode: 'autoplay_blocked' });
        expect(response.uiAction.type).toBe('OPEN_PANEL');
    });
});
