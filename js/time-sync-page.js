import { LyricsController } from './lyrics.js';
import { TimeSyncStudio } from './ui/timeSyncStudio.js';
import { ThemeController } from './ui/themeController.js';

const YT_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

const demoLyrics = [
    'The room goes quiet when the first beat lands',
    'Streetlights flicker on the edge of town',
    'Every late-night promise comes back around',
    'Hold the chorus just a little longer',
    'Let the silence open up the verse',
    'Catch the line before it starts to drift',
    'Bring the hook in clean and steady',
    'Leave the last word hanging in the dark'
];

const getRequiredElement = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Missing required element: #${id}`);
    }

    return element;
};

const elements = {
    urlInput: getRequiredElement('studio-url-input'),
    loadVideoBtn: getRequiredElement('studio-load-video-btn'),
    lyricsInput: getRequiredElement('studio-lyrics-input'),
    estimateGapInput: getRequiredElement('estimate-gap-input'),
    loadLyricsBtn: getRequiredElement('studio-load-lyrics-btn'),
    demoBtn: getRequiredElement('studio-demo-btn'),
    sourceNote: getRequiredElement('studio-source-note'),
    projectTitle: getRequiredElement('studio-project-title'),
    themeSwitcher: getRequiredElement('theme-switcher'),
    karaokeCard: getRequiredElement('karaoke-card'),
    studioView: getRequiredElement('studio-view'),
    karaokeStatusBadge: getRequiredElement('karaoke-status-badge'),
    karaokeStatusTitle: getRequiredElement('karaoke-status-title'),
    karaokeStatusDetail: getRequiredElement('karaoke-status-detail'),
    syncStageBadge: getRequiredElement('sync-stage-badge'),
    syncStageLabel: getRequiredElement('sync-stage-label'),
    syncProgressLabel: getRequiredElement('sync-progress-label'),
    syncProgressFill: getRequiredElement('sync-progress-fill'),
    syncCountPending: getRequiredElement('sync-count-pending'),
    syncCountSynced: getRequiredElement('sync-count-synced'),
    syncCountReview: getRequiredElement('sync-count-review'),
    assistantText: getRequiredElement('assistant-text'),
    assistantActionBtn: getRequiredElement('assistant-action-btn'),
    assistantHint: getRequiredElement('assistant-hint'),
    pointRail: getRequiredElement('point-rail'),
    pointRailWindow: getRequiredElement('point-rail-window'),
    pointTooltip: getRequiredElement('point-tooltip'),
    pointList: getRequiredElement('point-list'),
    reviewPlayerSummary: getRequiredElement('review-player-summary'),
    reviewPlayerFrame: getRequiredElement('review-player-frame'),
    reviewPlayToggleBtn: getRequiredElement('review-play-toggle-btn'),
    reviewJumpBtn: getRequiredElement('review-jump-btn'),
    reviewLoopBtn: getRequiredElement('review-loop-btn'),
    reviewTimeReadout: getRequiredElement('review-time-readout'),
    reviewLoopRange: getRequiredElement('review-loop-range'),
    selectedPointSummary: getRequiredElement('selected-point-summary'),
    selectedPointFeedback: getRequiredElement('selected-point-feedback'),
    selectedPointMinuteInput: getRequiredElement('selected-point-minute-input'),
    selectedPointSecondInput: getRequiredElement('selected-point-second-input'),
    selectedPointMillisecondInput: getRequiredElement('selected-point-millisecond-input'),
    applyPointTimeBtn: getRequiredElement('apply-point-time-btn'),
    nudgeBackBtn: getRequiredElement('nudge-back-btn'),
    nudgeForwardBtn: getRequiredElement('nudge-forward-btn')
};

const pageState = {
    projectTitle: 'UNSPECIFIED',
    currentRequestId: 0
};

const lyricsController = new LyricsController();
const themeController = new ThemeController({
    mount: elements.themeSwitcher,
    metaThemeColor: document.querySelector('meta[name="theme-color"]')
});
const studio = new TimeSyncStudio({
    root: elements.karaokeCard,
    views: {
        studio: elements.studioView
    },
    statusBadge: elements.karaokeStatusBadge,
    statusTitle: elements.karaokeStatusTitle,
    statusDetail: elements.karaokeStatusDetail,
    stageBadge: elements.syncStageBadge,
    stageLabel: elements.syncStageLabel,
    progressLabel: elements.syncProgressLabel,
    progressFill: elements.syncProgressFill,
    countPending: elements.syncCountPending,
    countSynced: elements.syncCountSynced,
    countReview: elements.syncCountReview,
    assistantText: elements.assistantText,
    assistantAction: elements.assistantActionBtn,
    assistantHint: elements.assistantHint,
    pointRail: elements.pointRail,
    pointRailWindow: elements.pointRailWindow,
    pointTooltip: elements.pointTooltip,
    pointList: elements.pointList,
    reviewPlayerSummary: elements.reviewPlayerSummary,
    reviewPlayerFrame: elements.reviewPlayerFrame,
    reviewPlayButton: elements.reviewPlayToggleBtn,
    reviewJumpButton: elements.reviewJumpBtn,
    reviewLoopButton: elements.reviewLoopBtn,
    reviewTimeReadout: elements.reviewTimeReadout,
    reviewLoopRange: elements.reviewLoopRange,
    selectedPointSummary: elements.selectedPointSummary,
    selectedPointFeedback: elements.selectedPointFeedback,
    selectedPointMinuteInput: elements.selectedPointMinuteInput,
    selectedPointSecondInput: elements.selectedPointSecondInput,
    selectedPointMillisecondInput: elements.selectedPointMillisecondInput,
    applyPointTimeButton: elements.applyPointTimeBtn,
    nudgeBackButton: elements.nudgeBackBtn,
    nudgeForwardButton: elements.nudgeForwardBtn,
    getProjectTitle: () => pageState.projectTitle
});

const setProjectTitle = (title) => {
    pageState.projectTitle = title?.trim() || 'UNSPECIFIED';
    elements.projectTitle.textContent = pageState.projectTitle;
};

const extractVideoId = (url) => {
    const match = url.match(YT_REGEX);
    return match ? match[1] : null;
};

const parseDurationLabelToMs = (value) => {
    const raw = String(value || '').trim();
    if (!raw) {
        return null;
    }

    const parts = raw.split(':').map((part) => Number.parseInt(part, 10));
    if (!parts.every(Number.isFinite) || parts.length < 2 || parts.length > 3) {
        return null;
    }

    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    if (parts.length === 3) {
        [hours, minutes, seconds] = parts;
    } else {
        [minutes, seconds] = parts;
    }

    return ((hours * 3600) + (minutes * 60) + seconds) * 1000;
};

const parseManualLyrics = (value) => value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({
        text,
        time: null,
        hasTiming: false,
        isApproximate: true
    }));

const fetchVideoInfo = async (videoId) => {
    const response = await fetch(`/api/info?videoId=${videoId}`);

    if (!response.ok) {
        let error = {};
        try {
            error = await response.json();
        } catch (parseError) {
            console.error('fetchVideoInfo failed to parse error response', parseError);
            throw new Error(`Could not load video info (error body parse failed: ${parseError.message})`);
        }

        throw new Error(error.message || 'Could not load video info');
    }

    return await response.json();
};

const attachMediaSourceFromUrlIfPresent = async () => {
    const url = elements.urlInput.value.trim();
    const videoId = extractVideoId(url);
    if (!url || !videoId) {
        return false;
    }

    const videoInfo = await fetchVideoInfo(videoId);
    setProjectTitle(videoInfo.title || pageState.projectTitle || 'UNSPECIFIED');
    await studio.setMediaSource({
        kind: 'youtube',
        videoId,
        title: videoInfo.title || 'UNSPECIFIED',
        durationMs: parseDurationLabelToMs(videoInfo.duration)
    });
    return true;
};

const loadSubtitlesForVideo = async () => {
    const url = elements.urlInput.value.trim();
    const videoId = extractVideoId(url);

    if (!url || !videoId) {
        elements.sourceNote.textContent = 'Paste a valid YouTube URL to load subtitle points.';
        elements.urlInput.focus();
        return;
    }

    const requestId = Date.now() + Math.random();
    pageState.currentRequestId = requestId;
    studio.setLoading();
    elements.sourceNote.textContent = 'Loading captions and creating point candidates…';

    try {
        const videoInfo = await fetchVideoInfo(videoId);
        if (pageState.currentRequestId !== requestId) {
            return;
        }

        setProjectTitle(videoInfo.title || 'UNSPECIFIED');
        studio.setMediaSource({
            kind: 'youtube',
            videoId,
            title: videoInfo.title || 'UNSPECIFIED',
            durationMs: parseDurationLabelToMs(videoInfo.duration)
        });

        if (videoInfo.subtitles && videoInfo.subtitles.length > 0) {
            const loaded = await lyricsController.loadSubtitles(videoInfo.subtitles, { requestId });
            if (!loaded && pageState.currentRequestId === requestId) {
                studio.setEmpty();
                elements.sourceNote.textContent = 'No usable subtitle track was available. Paste lyrics below to continue manually.';
            } else if (pageState.currentRequestId === requestId) {
                elements.sourceNote.textContent = 'Caption lines loaded. Run Auto-sync next to prefill the point timings.';
            }
            return;
        }

        studio.setEmpty();
        elements.sourceNote.textContent = 'This video does not expose captions. Paste lyrics below to create approximate points.';
    } catch (error) {
        if (pageState.currentRequestId !== requestId) {
            return;
        }

        studio.setEmpty();
        elements.sourceNote.textContent = error.message || 'Could not load video captions.';
    }
};

const loadManualLyrics = async () => {
    const parsed = parseManualLyrics(elements.lyricsInput.value);
    if (parsed.length === 0) {
        elements.sourceNote.textContent = 'Paste at least one lyric line to create points.';
        elements.lyricsInput.focus();
        return;
    }

    if (pageState.projectTitle === 'UNSPECIFIED') {
        setProjectTitle('Manual lyric draft');
    }

    let attached = false;
    try {
        attached = await attachMediaSourceFromUrlIfPresent();
    } catch (error) {
        attached = false;
    }
    studio.setLyrics(parsed);
    elements.sourceNote.textContent = attached
        ? 'Manual lyric points created and linked to the loaded YouTube video for review.'
        : 'Manual lyric points created. Run Auto-sync to prefill an initial pass.';
};

const loadDemoProject = () => {
    elements.lyricsInput.value = demoLyrics.join('\n');
    setProjectTitle('Demo point pass');
    studio.setLyrics(parseManualLyrics(elements.lyricsInput.value));
    elements.sourceNote.textContent = 'Demo project loaded. Use it to test the review and export flow.';
};

try {
    themeController.init();
} catch (error) {
    console.error('themeController.init failed', error);
}

try {
    studio.init();
    studio.setEstimateGapMs(Number(elements.estimateGapInput?.value || 2.2) * 1000);
} catch (error) {
    console.error('studio.init failed', error);
}

lyricsController.on('loaded', ({ lyrics, requestId }) => {
    if (requestId !== pageState.currentRequestId) return;
    elements.lyricsInput.value = lyrics.map((line) => line.text).join('\n');
    studio.setLyrics(lyrics);
});

lyricsController.on('empty', ({ requestId }) => {
    if (requestId !== pageState.currentRequestId) return;
    studio.setEmpty();
});

elements.loadVideoBtn.addEventListener('click', loadSubtitlesForVideo);
elements.loadLyricsBtn.addEventListener('click', loadManualLyrics);
elements.demoBtn.addEventListener('click', loadDemoProject);
elements.estimateGapInput.addEventListener('input', () => {
    studio.setEstimateGapMs(Number(elements.estimateGapInput.value || 2.2) * 1000);
});
elements.urlInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        loadSubtitlesForVideo();
    }
});

elements.lyricsInput.addEventListener('keydown', (event) => {
    const isSubmit = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'enter';
    if (isSubmit) {
        event.preventDefault();
        loadManualLyrics();
    }
});
