import { buildPoints, createAutosyncState, createHistoryState } from './pointTimingEngine.js';

const createStatus = (badge, title, detail, tone = 'idle') => ({
    badge,
    title,
    detail,
    tone
});

export const getIdleStudioState = () => ({
    stage: 'setup',
    points: [],
    selectedPointId: null,
    nowPlayingPointId: null,
    history: createHistoryState(),
    errors: [],
    autosync: createAutosyncState(),
    currentAssistantResponse: null,
    status: createStatus(
        'Setup',
        'Paste a video to build sync points.',
        'If subtitles are available, this panel turns them into line-start points you can review one by one.',
        'idle'
    ),
    assistantFallback: 'Add a video to create your first point rail.',
    pointListPlaceholder: [
        'The studio will create one point per lyric line start.',
        'Auto-sync fills draft timestamps before you review flagged points.',
        'You can also paste your own lyrics if the video does not include captions.'
    ],
    clearTooltip: true
});

export const getLoadingStudioState = ({ stage = 'setup', points = [] } = {}) => ({
    stage: points.length > 0 ? stage : 'setup',
    selectedPointId: points.length > 0 ? undefined : null,
    nowPlayingPointId: points.length > 0 ? undefined : null,
    status: createStatus(
        'Loading',
        'Looking for subtitle lines.',
        'When lyric data arrives, the point rail will appear here with one point per line start.',
        'loading'
    ),
    assistantFallback: 'Loading lyric lines and point data…',
    pointListPlaceholder: points.length > 0
        ? null
        : [
            'Checking the video for subtitle cues.',
            'If timing is missing, the studio will mark those points for review.'
        ],
    clearTooltip: points.length === 0
});

export const getEmptyStudioState = () => ({
    stage: 'setup',
    points: [],
    selectedPointId: null,
    nowPlayingPointId: null,
    autosync: createAutosyncState({
        status: 'failed',
        coverage: 0,
        confidence: 'low',
        issuesByPointId: {}
    }),
    status: createStatus(
        'No lyrics',
        'No subtitle track was found for this video.',
        'Paste your own lyric lines to create approximate points, or try another video with captions.',
        'muted'
    ),
    assistantFallback: 'No points were created because the video does not include usable subtitle lines.',
    pointListPlaceholder: [
        'Try a video that includes captions if you want to use the sync studio.',
        'Pasted lyrics will still work even when subtitle timing is unavailable.'
    ],
    clearTooltip: true
});

export const getLyricsStudioState = ({
    lines,
    createPointId
} = {}) => {
    const points = buildPoints(lines, createPointId);
    if (points.length === 0) {
        return {
            isEmpty: true,
            ...getEmptyStudioState()
        };
    }

    return {
        isEmpty: false,
        stage: 'lyrics',
        points,
        selectedPointId: points[0]?.id ?? null,
        nowPlayingPointId: null,
        history: createHistoryState(),
        autosync: createAutosyncState(),
        errors: [],
        status: createStatus(
            'Lyrics ready',
            'Points are ready for Auto-sync.',
            'Each point maps to a lyric line start. Run Auto-sync next, then fix only the flagged points.',
            'ready'
        )
    };
};

export const getFinishedPlaybackState = ({
    points = [],
    stage = 'setup'
} = {}) => {
    if (points.length === 0) {
        return {
            shouldResetToIdle: true
        };
    }

    const hasReviewPoints = points.some((point) => point.status === 'needs_review');
    return {
        shouldResetToIdle: false,
        stage: !hasReviewPoints && stage !== 'lyrics' && stage !== 'autosync' ? 'export' : stage,
        status: createStatus(
            'Ready',
            'The point pass is ready.',
            'Use the assistant CTA to keep moving one point at a time, or export the timing JSON when you are done.',
            'done'
        )
    };
};
