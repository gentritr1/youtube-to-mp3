type Stage = 'setup' | 'lyrics' | 'autosync' | 'sync' | 'review' | 'export';
type ActionType = 'OPEN_PANEL' | 'SELECT_POINT' | 'NUDGE_POINT' | 'START_AUTOSYNC' | 'APPLY_FIX' | 'EXPORT';
type Tone = 'calm' | 'neutral' | 'cheerful';
type PointStatus = 'pending' | 'synced' | 'needs_review';

interface PointFlow {
    totalPoints: number;
    currentPointId: string | null;
    nextIncompletePointId: string | null;
    windowPointIds: string[];
    counts: {
        pending: number;
        synced: number;
        needsReview: number;
    };
    confirmMode: 'implicit_undo' | 'explicit';
}

interface PointWindowEntry {
    id: string;
    index: number;
    textPreview: string;
    timeMs: number;
    status: PointStatus;
    issues: string[];
}

interface UiSnapshot {
    schemaVersion: '1.0';
    stage: Stage;
    project: {
        projectId: string;
        title: string;
    };
    pointFlow: PointFlow;
    pointsWindow: PointWindowEntry[];
    playback: {
        playheadMs: number;
        isPlaying: boolean;
        loop: {
            on: boolean;
            startMs: number;
            endMs: number;
        };
    };
    autosync: {
        status: 'not_run' | 'running' | 'done' | 'failed';
        coverage: number;
        confidence: 'high' | 'medium' | 'low';
        issuesByPointId: Record<string, string[]>;
    };
    ui: {
        reducedMotion: boolean;
        inputMode: 'mouse' | 'touch' | 'keyboard';
    };
    history: {
        undoDepth: number;
        redoDepth: number;
    };
    errors: Array<{
        code: string;
        message: string;
        scope: 'setup' | 'lyrics' | 'autosync' | 'sync' | 'export';
    }>;
}

interface Hint {
    id: string;
    surface: 'tooltip' | 'coachmark' | 'inline';
    text: string;
    dismissAfter: 'action' | 'time' | 'manual';
    maxRepeats: number;
}

interface TelemetryEvent {
    event: string;
    properties: Record<string, unknown>;
}

interface NextAction {
    type: ActionType;
    label: string;
    why: string;
    requiresConfirmation: boolean;
    targetPointId: string | null;
    payload: Record<string, unknown>;
    confirmUI?: {
        prompt: string;
        confirmLabel: string;
        cancelLabel: string;
    } | null;
}

interface AssistantResponse {
    assistantText: string;
    tone: Tone;
    nextAction: NextAction;
    uiAction: {
        type: ActionType;
        payload: Record<string, unknown>;
    };
    hints: Hint[];
    telemetry: TelemetryEvent[];
}

const buildResponse = (
    sessionId: string,
    snapshot: UiSnapshot,
    assistantText: string,
    tone: Tone,
    nextAction: NextAction,
    hints: Hint[] = []
): AssistantResponse => ({
    assistantText,
    tone,
    nextAction,
    uiAction: {
        type: nextAction.type,
        payload: nextAction.payload
    },
    hints,
    telemetry: [
        {
            event: 'assistant_next_action_shown',
            properties: {
                sessionId,
                stage: snapshot.stage,
                type: nextAction.type,
                pointId: nextAction.targetPointId
            }
        }
    ]
});

const findCurrentPoint = (snapshot: UiSnapshot): PointWindowEntry | null => {
    const currentPointId = snapshot.pointFlow.currentPointId;
    if (!currentPointId) {
        return snapshot.pointsWindow[0] ?? null;
    }

    return snapshot.pointsWindow.find((point) => point.id === currentPointId) ?? snapshot.pointsWindow[0] ?? null;
};

const findReviewPoint = (snapshot: UiSnapshot): PointWindowEntry | null => {
    const current = findCurrentPoint(snapshot);
    if (current?.status === 'needs_review') {
        return current;
    }

    const flaggedWindowPoint = snapshot.pointsWindow.find((point) => point.status === 'needs_review');
    if (flaggedWindowPoint) {
        return flaggedWindowPoint;
    }

    const flaggedPointId = Object.keys(snapshot.autosync.issuesByPointId)[0];
    if (!flaggedPointId) {
        return current;
    }

    return snapshot.pointsWindow.find((point) => point.id === flaggedPointId) ?? {
        id: flaggedPointId,
        index: 0,
        textPreview: 'Flagged point',
        timeMs: snapshot.playback.playheadMs,
        status: 'needs_review',
        issues: snapshot.autosync.issuesByPointId[flaggedPointId] ?? []
    };
};

const formatPointLabel = (snapshot: UiSnapshot, point: PointWindowEntry | null): string => {
    if (!point) {
        return 'No points yet';
    }

    return `Point ${point.index + 1} of ${snapshot.pointFlow.totalPoints}`;
};

const getNudgeDelta = (point: PointWindowEntry | null): number => {
    const issues = point?.issues ?? [];

    if (issues.includes('late_start')) return -80;
    if (issues.includes('early_start')) return 80;
    if (issues.includes('timing_estimated')) return 50;

    return -50;
};

const getNudgeReason = (point: PointWindowEntry | null): string => {
    const issues = point?.issues ?? [];

    if (issues.includes('late_start')) return 'Small timing tweaks usually fix late line starts without redoing sync.';
    if (issues.includes('early_start')) return 'A small move later is the fastest fix for an early line start.';
    if (issues.includes('timing_estimated')) return 'Estimated points are best corrected with one small move before larger edits.';

    return 'A tiny nudge keeps the flow moving without opening heavier controls.';
};

const getNudgeDirection = (deltaMs: number): 'earlier' | 'later' => (deltaMs < 0 ? 'earlier' : 'later');

const selectPointAction = (sessionId: string, snapshot: UiSnapshot, point: PointWindowEntry): AssistantResponse => buildResponse(
    sessionId,
    snapshot,
    `${formatPointLabel(snapshot, point)} is the next point to inspect. Select it so the rail and lyric preview stay aligned.`,
    'calm',
    {
        type: 'SELECT_POINT',
        label: `Select Point ${point.index + 1}`,
        why: 'Staying locked to one point prevents accidental multi-point edits.',
        requiresConfirmation: false,
        targetPointId: point.id,
        payload: { pointId: point.id },
        confirmUI: null
    }
);

export const buildPointAssistantResponse = (snapshot: UiSnapshot, userText = '', sessionId = 'anonymous'): AssistantResponse => {
    const normalizedText = userText.trim().toLowerCase();

    if (snapshot.errors.length > 0) {
        const error = snapshot.errors[0];
        return buildResponse(
            sessionId,
            snapshot,
            `${error.message} Open the help panel for the smallest fix. Your point data stays intact.`,
            'calm',
            {
                type: 'OPEN_PANEL',
                label: 'Open help',
                why: 'Clear recovery steps reduce rework when playback or sync hits an error.',
                requiresConfirmation: false,
                targetPointId: null,
                payload: { panel: error.scope === 'setup' ? 'setup_help' : 'sync_help', errorCode: error.code },
                confirmUI: null
            }
        );
    }

    if (normalizedText.includes('messy') && snapshot.stage !== 'setup' && snapshot.pointFlow.counts.needsReview > 1) {
        return buildResponse(
            sessionId,
            snapshot,
            'A single cleanup pass on the flagged points will remove the roughest timing estimates without changing confirmed lines.',
            'neutral',
            {
                type: 'APPLY_FIX',
                label: 'Clean flagged points',
                why: 'Batch cleanup is the fastest polish move when several draft points still need review.',
                requiresConfirmation: true,
                targetPointId: null,
                payload: { scope: 'needs_review', operation: 'normalize_estimated_points' },
                confirmUI: {
                    prompt: 'Apply this cleanup to all flagged points?',
                    confirmLabel: 'Apply fix',
                    cancelLabel: 'Cancel'
                }
            }
        );
    }

    switch (snapshot.stage) {
    case 'setup':
        return buildResponse(
            sessionId,
            snapshot,
            'Open the lyrics panel first so the point rail has source lines to work from.',
            'neutral',
            {
                type: 'OPEN_PANEL',
                label: 'Open lyrics panel',
                why: 'The studio needs lyric lines before it can create sync points.',
                requiresConfirmation: false,
                targetPointId: null,
                payload: { panel: 'lyrics' },
                confirmUI: null
            }
        );

    case 'lyrics':
        return buildResponse(
            sessionId,
            snapshot,
            `The lyrics are parsed into ${snapshot.pointFlow.totalPoints} points. Run Auto-sync next so the line starts prefill before review.`,
            'calm',
            {
                type: 'START_AUTOSYNC',
                label: 'Run Auto-sync',
                why: 'Prefilling timestamps first is faster than placing every point by hand.',
                requiresConfirmation: false,
                targetPointId: null,
                payload: { granularity: 'line', scope: 'all_points' },
                confirmUI: null
            },
            [
                {
                    id: 'hint_autosync_first',
                    surface: 'inline',
                    text: 'Auto-sync uses one point per lyric line start by default.',
                    dismissAfter: 'action',
                    maxRepeats: 1
                }
            ]
        );

    case 'autosync':
        return buildResponse(
            sessionId,
            snapshot,
            'Auto-sync is running. Keep this panel open while the point rail fills in.',
            'neutral',
            {
                type: 'OPEN_PANEL',
                label: 'Keep sync panel open',
                why: 'Staying in the sync panel preserves orientation while processing finishes.',
                requiresConfirmation: false,
                targetPointId: null,
                payload: { panel: 'sync_progress' },
                confirmUI: null
            }
        );

    case 'sync':
    case 'review': {
        const reviewPoint = findReviewPoint(snapshot);
        if (!reviewPoint) {
            return buildResponse(
                sessionId,
                snapshot,
                'All visible points look stable. Export the timing JSON when you are ready.',
                'calm',
                {
                    type: 'EXPORT',
                    label: 'Export timing JSON',
                    why: 'Export is the final handoff once no points still need review.',
                    requiresConfirmation: true,
                    targetPointId: null,
                    payload: { format: 'json' },
                    confirmUI: {
                        prompt: 'Export this timing pass now?',
                        confirmLabel: 'Export',
                        cancelLabel: 'Keep editing'
                    }
                }
            );
        }

        if (snapshot.pointFlow.currentPointId !== reviewPoint.id) {
            return selectPointAction(sessionId, snapshot, reviewPoint);
        }

        const deltaMs = getNudgeDelta(reviewPoint);
        const direction = getNudgeDirection(deltaMs);

        return buildResponse(
            sessionId,
            snapshot,
            `${formatPointLabel(snapshot, reviewPoint)} looks slightly ${direction === 'earlier' ? 'late' : 'early'}. Make one small nudge ${direction}, then replay your loop once. Undo is available if it feels worse.`,
            'calm',
            {
                type: 'NUDGE_POINT',
                label: `Nudge Point ${reviewPoint.index + 1} ${direction}`,
                why: getNudgeReason(reviewPoint),
                requiresConfirmation: false,
                targetPointId: reviewPoint.id,
                payload: { pointId: reviewPoint.id, deltaMs },
                confirmUI: null
            },
            [
                {
                    id: 'hint_nudge_small',
                    surface: 'tooltip',
                    text: 'Start with ±50–100ms nudges before larger moves.',
                    dismissAfter: 'time',
                    maxRepeats: 1
                }
            ]
        );
    }

    case 'export':
    default:
        return buildResponse(
            sessionId,
            snapshot,
            'The point pass is ready. Export the timing JSON when you want a clean handoff.',
            'neutral',
            {
                type: 'EXPORT',
                label: 'Export timing JSON',
                why: 'Export packages the confirmed point timing into a reusable file.',
                requiresConfirmation: true,
                targetPointId: null,
                payload: { format: 'json' },
                confirmUI: {
                    prompt: 'Export this timing pass now?',
                    confirmLabel: 'Export',
                    cancelLabel: 'Cancel'
                }
            }
        );
    }
};

export type { UiSnapshot, AssistantResponse };
