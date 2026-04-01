const cloneIssuesByPointId = (issuesByPointId = {}) => Object.fromEntries(
    Object.entries(issuesByPointId).map(([pointId, issues]) => [pointId, Array.isArray(issues) ? [...issues] : []])
);
const EARLY_START_THRESHOLD_MS = 500;
const LATE_START_THRESHOLD_MS = 7000;
const FALLBACK_VIDEO_END_MESSAGE = 'Reached the end of the video.';

export const createAutosyncState = (overrides = {}) => ({
    status: overrides.status ?? 'not_run',
    coverage: Number.isFinite(overrides.coverage) ? overrides.coverage : 0,
    confidence: overrides.confidence ?? 'low',
    issuesByPointId: cloneIssuesByPointId(overrides.issuesByPointId)
});

export const createHistoryState = (overrides = {}) => ({
    undoStack: Array.isArray(overrides.undoStack) ? [...overrides.undoStack] : [],
    redoStack: Array.isArray(overrides.redoStack) ? [...overrides.redoStack] : []
});

export const buildPoints = (lines, createPointId = (index) => `P${index + 1}`) => (Array.isArray(lines) ? lines : []).map((line, index) => ({
    id: createPointId(index),
    index,
    textPreview: line.text || `Line ${index + 1}`,
    draftTimeMs: Number.isFinite(line.time) ? line.time : null,
    timeMs: null,
    status: 'pending',
    issues: [],
    sourceTimed: line.hasTiming !== false && Number.isFinite(line.time),
    isApproximate: Boolean(line.isApproximate)
}));

export const buildPointSnapshot = ({
    stage,
    sessionId,
    getProjectTitle = () => 'UNSPECIFIED',
    selectedPointId,
    points,
    pointWindowSize,
    currentPlayheadMs = 0,
    isPlaying = false,
    reviewLoopEnabled = false,
    reducedMotion = false,
    lastInputMode = 'mouse',
    getLoopEndTime
} = {}) => {
    const safePoints = Array.isArray(points) ? points : [];
    const selectedIndex = Math.max(0, safePoints.findIndex((point) => point.id === selectedPointId));
    const totalPoints = safePoints.length;
    const startIndex = Math.min(
        Math.max(0, selectedIndex - Math.floor(pointWindowSize / 2)),
        Math.max(0, totalPoints - pointWindowSize)
    );
    const pointsWindow = safePoints.slice(startIndex, startIndex + pointWindowSize);
    const counts = safePoints.reduce((acc, point) => {
        const status = typeof point?.status === 'string' ? point.status : 'pending';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, { pending: 0, synced: 0, needs_review: 0 });
    const selectedPoint = safePoints.find((point) => point.id === selectedPointId) ?? null;
    const loopStart = selectedPoint?.timeMs ?? selectedPoint?.draftTimeMs ?? 0;
    const loopEnd = typeof getLoopEndTime === 'function' ? getLoopEndTime(selectedPoint?.id) : null;

    return {
        schemaVersion: '1.0',
        stage,
        project: {
            projectId: sessionId,
            title: getProjectTitle()
        },
        pointFlow: {
            totalPoints,
            currentPointId: selectedPointId,
            nextIncompletePointId: safePoints.find((point) => point.status !== 'synced')?.id ?? null,
            windowPointIds: pointsWindow.map((point) => point.id),
            counts: {
                pending: counts.pending,
                synced: counts.synced,
                needsReview: counts.needs_review
            },
            confirmMode: 'implicit_undo'
        },
        pointsWindow: pointsWindow.map((point) => ({
            id: point.id,
            index: point.index,
            textPreview: point.textPreview,
            timeMs: Number.isFinite(point.timeMs) ? point.timeMs : point.draftTimeMs ?? 0,
            status: point.status,
            issues: [...point.issues]
        })),
        playback: {
            playheadMs: Number.isFinite(currentPlayheadMs) ? Math.round(currentPlayheadMs) : 0,
            isPlaying,
            loop: {
                on: reviewLoopEnabled,
                startMs: Number.isFinite(loopStart) ? loopStart : 0,
                endMs: Number.isFinite(loopEnd) ? loopEnd : (Number.isFinite(loopStart) ? loopStart : 0)
            }
        },
        ui: {
            reducedMotion,
            inputMode: lastInputMode
        }
    };
};

export const runAutosyncPass = ({
    points,
    estimateGapMs,
    selectedPointId = null
} = {}) => {
    let timedPoints = 0;
    let previousTime = 0;
    const safeEstimateGapMs = Number.isFinite(estimateGapMs) ? estimateGapMs : 0;
    const issuesByPointId = {};
    const nextPoints = (Array.isArray(points) ? points : []).map((point, index) => {
        const fallbackTime = index === 0 ? 0 : previousTime + safeEstimateGapMs;
        const nextTime = Number.isFinite(point.draftTimeMs) ? point.draftTimeMs : fallbackTime;
        const issues = [];

        if (point.sourceTimed) {
            timedPoints += 1;
        } else {
            issues.push('timing_estimated');
        }

        const gap = index === 0 ? 0 : nextTime - previousTime;
        if (index > 0 && gap < EARLY_START_THRESHOLD_MS) {
            issues.push('early_start');
        }
        if (index > 0 && gap > LATE_START_THRESHOLD_MS) {
            issues.push('late_start');
        }

        previousTime = nextTime;

        if (issues.length > 0) {
            issuesByPointId[point.id] = issues;
        }

        return {
            ...point,
            timeMs: nextTime,
            issues,
            status: issues.length > 0 ? 'needs_review' : 'synced'
        };
    });

    const reviewPoint = nextPoints.find((point) => point.status === 'needs_review') ?? null;
    const coverage = nextPoints.length ? timedPoints / nextPoints.length : 0;
    return {
        points: nextPoints,
        selectedPointId: reviewPoint?.id ?? selectedPointId ?? nextPoints[0]?.id ?? null,
        autosync: createAutosyncState({
            status: 'done',
            coverage,
            confidence: coverage > 0.85 ? 'high' : coverage > 0.5 ? 'medium' : 'low',
            issuesByPointId
        }),
        stage: reviewPoint ? 'review' : 'export',
        status: reviewPoint
            ? {
                badge: 'Review',
                title: 'Review the flagged points.',
                detail: 'Only the points that need attention stay in the critical path now.',
                tone: 'ready'
            }
            : {
                badge: 'Ready',
                title: 'Auto-sync is complete.',
                detail: 'No obvious timing issues were flagged. You can export the timing JSON now.',
                tone: 'done'
            }
    };
};

export const applyNeedsReviewFix = ({
    points,
    history,
    autosync,
    payload
} = {}) => {
    if (payload?.scope !== 'needs_review') {
        return null;
    }

    const changedPoints = [];
    const nextPoints = (Array.isArray(points) ? points : []).map((point) => {
        if (point.status !== 'needs_review') {
            return point;
        }

        changedPoints.push({
            id: point.id,
            prevTimeMs: point.timeMs,
            prevStatus: point.status,
            prevIssues: [...point.issues]
        });

        return {
            ...point,
            status: 'synced',
            issues: []
        };
    });

    if (changedPoints.length === 0) {
        return null;
    }

    return {
        points: nextPoints,
        history: createHistoryState({
            undoStack: [...(history?.undoStack ?? []), { type: 'APPLY_FIX', changes: changedPoints }],
            redoStack: []
        }),
        autosync: {
            ...createAutosyncState(autosync),
            issuesByPointId: {}
        },
        stage: 'export',
        status: {
            badge: 'Ready',
            title: 'Flagged points were cleaned up.',
            detail: 'You can still undo this batch fix if you want to inspect points one by one.',
            tone: 'done'
        }
    };
};

export const nudgePointTiming = ({
    points,
    pointId,
    deltaMs,
    history,
    autosync,
    stage,
    clampTimeMs,
    getMediaDurationMs,
    formatTime
} = {}) => {
    const pointIndex = (Array.isArray(points) ? points : []).findIndex((entry) => entry.id === pointId);
    if (pointIndex === -1) {
        return null;
    }

    const point = points[pointIndex];
    const previous = {
        id: point.id,
        prevTimeMs: point.timeMs,
        prevStatus: point.status,
        prevIssues: [...point.issues]
    };
    const requestedTime = (point.timeMs ?? point.draftTimeMs ?? 0) + deltaMs;
    const nextTime = typeof clampTimeMs === 'function' ? clampTimeMs(requestedTime) : requestedTime;
    const nextPoints = [...points];
    nextPoints[pointIndex] = {
        ...point,
        timeMs: nextTime,
        status: 'synced',
        issues: []
    };

    const nextAutosync = createAutosyncState(autosync);
    delete nextAutosync.issuesByPointId[pointId];

    const nextHistory = createHistoryState({
        undoStack: [...(history?.undoStack ?? []), { type: 'NUDGE_POINT', ...previous }],
        redoStack: []
    });
    const hasReviewPoints = nextPoints.some((entry) => entry.status === 'needs_review');
    const nextStage = !hasReviewPoints && stage !== 'lyrics' && stage !== 'autosync' ? 'export' : 'review';
    const mediaDurationMs = typeof getMediaDurationMs === 'function' ? getMediaDurationMs() : null;
    const safeVideoEndMessage = Number.isFinite(mediaDurationMs)
        ? typeof formatTime === 'function'
            ? `Reached the end of the video at ${formatTime(mediaDurationMs)}.`
            : FALLBACK_VIDEO_END_MESSAGE
        : null;

    return {
        points: nextPoints,
        history: nextHistory,
        autosync: nextAutosync,
        stage: nextStage,
        status: nextStage === 'export'
            ? {
                badge: 'Ready',
                title: 'All flagged points are now confirmed.',
                detail: 'Export the timing JSON when you want a clean handoff.',
                tone: 'done'
            }
            : null,
        editorFeedback: nextTime !== requestedTime
            ? requestedTime < 0
                ? { message: 'Reached the start of the track at 0:00.000.', tone: 'warning' }
                : Number.isFinite(mediaDurationMs)
                    ? { message: safeVideoEndMessage, tone: 'warning' }
                    : null
            : null
    };
};

export const undoPointChange = ({
    points,
    history,
    autosync
} = {}) => {
    const operation = history?.undoStack?.length
        ? history.undoStack[history.undoStack.length - 1]
        : undefined;
    if (!operation) {
        return { applied: false };
    }

    if (operation.type !== 'NUDGE_POINT' && operation.type !== 'APPLY_FIX') {
        return { applied: false };
    }

    const nextPoints = Array.isArray(points) ? [...points] : [];
    const nextAutosync = createAutosyncState(autosync);
    const nextUndoStack = history.undoStack.slice(0, -1);
    const nextRedoStack = [...(history.redoStack ?? [])];
    let nextStage = null;

    if (operation.type === 'NUDGE_POINT') {
        const pointIndex = nextPoints.findIndex((entry) => entry.id === operation.id);
        if (pointIndex === -1) {
            return { applied: false };
        }

        const current = nextPoints[pointIndex];
        nextRedoStack.push({
            type: 'NUDGE_POINT',
            id: current.id,
            prevTimeMs: current.timeMs,
            prevStatus: current.status,
            prevIssues: [...current.issues]
        });
        nextPoints[pointIndex] = {
            ...current,
            timeMs: operation.prevTimeMs,
            status: operation.prevStatus,
            issues: [...operation.prevIssues]
        };

        if (operation.prevIssues.length > 0) {
            nextAutosync.issuesByPointId[operation.id] = [...operation.prevIssues];
            nextStage = 'review';
        }
    }

    if (operation.type === 'APPLY_FIX') {
        operation.changes.forEach((change) => {
            const pointIndex = nextPoints.findIndex((entry) => entry.id === change.id);
            if (pointIndex === -1) {
                // Skipping missing point ids is intentional here so undo stays safe
                // even when nextPoints no longer contains one of operation.changes.
                return;
            }

            nextPoints[pointIndex] = {
                ...nextPoints[pointIndex],
                timeMs: change.prevTimeMs,
                status: change.prevStatus,
                issues: [...change.prevIssues]
            };

            if (change.prevIssues.length > 0) {
                nextAutosync.issuesByPointId[change.id] = [...change.prevIssues];
            }
        });

        nextRedoStack.push(operation);
        nextStage = 'review';
    }

    return {
        applied: true,
        points: nextPoints,
        history: createHistoryState({
            undoStack: nextUndoStack,
            redoStack: nextRedoStack
        }),
        autosync: nextAutosync,
        stage: nextStage
    };
};

export const findPointForTime = (points, timeMs) => {
    if (!Number.isFinite(timeMs) || !Array.isArray(points) || points.length === 0) {
        return null;
    }

    for (let index = points.length - 1; index >= 0; index -= 1) {
        const pointTime = points[index].timeMs ?? points[index].draftTimeMs;
        if (Number.isFinite(pointTime) && timeMs >= pointTime) {
            return points[index];
        }
    }

    return points[0];
};

export const getLoopEndTime = ({
    points,
    pointId,
    clampTimeMs,
    getMediaDurationMs
} = {}) => {
    const pointIndex = (Array.isArray(points) ? points : []).findIndex((point) => point.id === pointId);
    if (pointIndex === -1) {
        return null;
    }

    const nextTimedPoint = points
        .slice(pointIndex + 1)
        .find((point) => Number.isFinite(point.timeMs ?? point.draftTimeMs));
    const clamp = typeof clampTimeMs === 'function' ? clampTimeMs : (value) => value;
    const getDuration = typeof getMediaDurationMs === 'function' ? getMediaDurationMs : () => null;

    return nextTimedPoint
        ? clamp(nextTimedPoint.timeMs ?? nextTimedPoint.draftTimeMs)
        : getDuration();
};
