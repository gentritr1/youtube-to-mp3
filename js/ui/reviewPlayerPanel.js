export const normalizeReviewMediaSource = (source) => source?.kind === 'youtube' && source.videoId
    ? {
        kind: 'youtube',
        videoId: source.videoId,
        title: source.title || 'UNSPECIFIED',
        durationMs: Number.isFinite(source.durationMs) ? source.durationMs : null
    }
    : null;

export const getReviewPlayerDurationMs = ({
    reviewPlayerReady = false,
    reviewPlayer = null,
    mediaSource = null
} = {}) => {
    const playerDurationMs = reviewPlayerReady && typeof reviewPlayer?.getDuration === 'function'
        ? Math.round((reviewPlayer.getDuration() ?? 0) * 1000)
        : null;
    if (Number.isFinite(playerDurationMs) && playerDurationMs > 0) {
        return playerDurationMs;
    }

    return Number.isFinite(mediaSource?.durationMs) ? mediaSource.durationMs : null;
};

export const getReviewPlayerPlayheadMs = ({
    explicitPlayheadMs = null,
    reviewPlayerReady = false,
    reviewPlayer = null,
    fallbackPlayheadMs = 0
} = {}) => {
    if (Number.isFinite(explicitPlayheadMs)) {
        return explicitPlayheadMs;
    }

    if (reviewPlayerReady && typeof reviewPlayer?.getCurrentTime === 'function') {
        return Math.round(reviewPlayer.getCurrentTime() * 1000);
    }

    return Number.isFinite(fallbackPlayheadMs) ? fallbackPlayheadMs : 0;
};

export const buildReviewPlayerViewModel = ({
    mediaSource = null,
    selectedPoint = null,
    selectedTimeMs = null,
    currentPlayheadMs = 0,
    reviewPlayerReady = false,
    isPlaying = false,
    reviewLoopEnabled = false,
    loopEndMs = null,
    hasFrame = false,
    formatTime = (value) => String(value ?? '')
} = {}) => {
    const hasMediaSource = Boolean(mediaSource && hasFrame);
    let summary = 'Load a captioned YouTube video to review timing against playback.';

    if (mediaSource && !selectedPoint) {
        summary = 'Select a point to jump the review player to that line start.';
    } else if (mediaSource && selectedPoint && !Number.isFinite(selectedTimeMs)) {
        summary = `Point ${selectedPoint.index + 1} is still unassigned. Set a time first, then jump straight into review playback.`;
    } else if (mediaSource && selectedPoint) {
        summary = `Review Point ${selectedPoint.index + 1} against the player. Clicking a point chip or card seeks directly to ${formatTime(selectedTimeMs)}.`;
    }

    return {
        summary,
        playDisabled: !reviewPlayerReady || !selectedPoint || !Number.isFinite(selectedTimeMs),
        playLabel: isPlaying ? 'Pause' : 'Play',
        jumpDisabled: !reviewPlayerReady || !selectedPoint || !Number.isFinite(selectedTimeMs),
        loopDisabled: !reviewPlayerReady || !selectedPoint || !Number.isFinite(selectedTimeMs),
        loopPressed: reviewLoopEnabled,
        timeReadout: formatTime(currentPlayheadMs) || '0:00.000',
        loopRange: Number.isFinite(selectedTimeMs) && Number.isFinite(loopEndMs)
            ? `Loop range: ${formatTime(selectedTimeMs)} -> ${formatTime(loopEndMs)}`
            : 'Loop range appears when the selected point has timing.',
        frameHidden: !hasMediaSource,
        frameReady: hasMediaSource && reviewPlayerReady
    };
};

export const renderReviewPlayerPanel = ({
    reviewPlayerSummary,
    reviewPlayButton,
    reviewJumpButton,
    reviewLoopButton,
    reviewTimeReadout,
    reviewLoopRange,
    reviewPlayerFrame
} = {}, viewModel = {}) => {
    if (reviewPlayerSummary) {
        reviewPlayerSummary.textContent = viewModel.summary ?? '';
    }
    if (reviewPlayButton) {
        reviewPlayButton.disabled = Boolean(viewModel.playDisabled);
        reviewPlayButton.textContent = viewModel.playLabel ?? 'Play';
    }
    if (reviewJumpButton) {
        reviewJumpButton.disabled = Boolean(viewModel.jumpDisabled);
    }
    if (reviewLoopButton) {
        reviewLoopButton.disabled = Boolean(viewModel.loopDisabled);
        reviewLoopButton.setAttribute('aria-pressed', viewModel.loopPressed ? 'true' : 'false');
        reviewLoopButton.classList.toggle('is-active', Boolean(viewModel.loopPressed));
    }
    if (reviewTimeReadout) {
        reviewTimeReadout.textContent = viewModel.timeReadout ?? '0:00.000';
    }
    if (reviewLoopRange) {
        reviewLoopRange.textContent = viewModel.loopRange ?? '';
    }
    if (reviewPlayerFrame) {
        reviewPlayerFrame.hidden = Boolean(viewModel.frameHidden);
        reviewPlayerFrame.classList.toggle('is-ready', Boolean(viewModel.frameReady));
    }
};

export const stepReviewPlaybackLoop = ({
    reviewPlayer = null,
    reviewLoopEnabled = false,
    selectedPoint = null,
    nowPlayingPointId = null,
    findPointForTime = () => null,
    getLoopEndTime = () => null
} = {}) => {
    const seconds = typeof reviewPlayer?.getCurrentTime === 'function'
        ? reviewPlayer.getCurrentTime()
        : null;
    const playheadMs = Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
    if (!Number.isFinite(playheadMs)) {
        return {
            playheadMs: null,
            nextNowPlayingPointId: nowPlayingPointId,
            shouldLoopToMs: null
        };
    }

    const pointForPlayhead = findPointForTime(playheadMs);
    const loopStart = selectedPoint?.timeMs ?? selectedPoint?.draftTimeMs;
    const loopEnd = getLoopEndTime(selectedPoint?.id);

    return {
        playheadMs,
        nextNowPlayingPointId: pointForPlayhead?.id ?? nowPlayingPointId,
        shouldLoopToMs: reviewLoopEnabled
            && selectedPoint
            && Number.isFinite(loopStart)
            && Number.isFinite(loopEnd)
            && playheadMs >= loopEnd
            ? loopStart
            : null
    };
};
