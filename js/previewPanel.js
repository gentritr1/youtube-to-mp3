export const setPreviewLoadingState = (elements, isLoading) => {
    const previewPlayer = elements?.previewPlayer;
    previewPlayer?.classList.toggle('is-loading', Boolean(isLoading));
    previewPlayer?.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    if (isLoading) {
        previewPlayer?.classList.remove('has-error');
        elements?.previewLoading?.setAttribute('role', 'status');
    }
};

export const updatePreviewStatus = (elements, message) => {
    if (elements?.previewTransitionNote) {
        elements.previewTransitionNote.textContent = message;
    }
};

export const resetPreviewLoadingText = (elements) => {
    if (!elements?.previewLoadingText) {
        return;
    }

    elements?.previewPlayer?.classList.remove('has-error');
    elements?.previewLoading?.setAttribute('role', 'status');
    elements.previewLoadingText.textContent = 'Generating preview...';
    elements.previewLoadingText.style.color = '';
};

export const showPreviewError = (elements, message) => {
    if (!elements?.previewLoadingText) {
        return;
    }

    elements?.previewPlayer?.classList.add('has-error');
    elements?.previewPlayer?.classList.remove('is-loading');
    elements?.previewPlayer?.setAttribute('aria-busy', 'false');
    elements?.previewLoading?.setAttribute('role', 'alert');
    if (elements?.previewTransitionNote) {
        elements.previewTransitionNote.textContent = 'Preview unavailable';
    }
    elements.previewLoadingText.textContent = message;
    elements.previewLoadingText.style.color = 'var(--destructive)';
};

const syncWaveformSlider = (elements, percent, currentTime, duration, formatTime = (value) => {
    const safeValue = Number.isFinite(value) ? value : 0;
    const mins = Math.floor(safeValue / 60);
    const secs = Math.floor(safeValue % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}) => {
    const waveform = elements?.waveform;
    if (!waveform) {
        return;
    }

    const clampedPercent = Math.max(0, Math.min(1, Number.isFinite(percent) ? percent : 0));
    waveform.setAttribute('aria-valuenow', String(Math.round(clampedPercent * 100)));

    if (Number.isFinite(currentTime) && Number.isFinite(duration) && duration > 0) {
        waveform.setAttribute('aria-valuetext', `${formatTime(currentTime)} of ${formatTime(duration)}`);
        return;
    }

    waveform.setAttribute('aria-valuetext', '0:00 of 0:30');
};

export const resetPreviewProgress = (elements) => {
    elements?.previewProgressFill?.style.setProperty('transform', 'scaleX(0)');
    elements?.waveformProgress?.style.setProperty('transform', 'scaleX(0)');
    elements?.waveformPlayhead?.style.setProperty('left', '0%');
    syncWaveformSlider(elements, 0, 0, 30);
    if (elements?.previewTimeCurrent) {
        elements.previewTimeCurrent.textContent = '0:00';
    }
    if (elements?.previewTimeTotal) {
        elements.previewTimeTotal.textContent = '0:30';
    }
};

export const renderPreviewProgress = (elements, { currentTime, duration, percent }, formatTime) => {
    if (!Number.isFinite(duration) || duration <= 0) {
        if (elements?.previewProgressFill) {
            elements.previewProgressFill.style.transform = 'scaleX(0)';
        }
        if (elements?.waveformProgress) {
            elements.waveformProgress.style.transform = 'scaleX(0)';
        }
        if (elements?.waveformPlayhead) {
            elements.waveformPlayhead.style.left = '0%';
        }
        if (elements?.previewTimeCurrent) {
            elements.previewTimeCurrent.textContent = '0:00';
        }
        syncWaveformSlider(elements, 0, 0, duration, formatTime);
        return;
    }

    const clampedPercent = Number.isFinite(percent)
        ? Math.max(0, Math.min(1, percent))
        : 0;

    if (elements?.previewProgressFill) {
        elements.previewProgressFill.style.transform = `scaleX(${clampedPercent})`;
    }
    if (elements?.waveformProgress) {
        elements.waveformProgress.style.transform = `scaleX(${clampedPercent})`;
    }
    if (elements?.waveformPlayhead) {
        elements.waveformPlayhead.style.left = `${clampedPercent * 100}%`;
    }
    if (elements?.previewTimeCurrent) {
        elements.previewTimeCurrent.textContent = formatTime(currentTime);
    }
    syncWaveformSlider(elements, clampedPercent, currentTime, duration, formatTime);
};

export const updatePreviewMetadata = ({ elements, state, video, emitPreviewStateChange }) => {
    if (elements?.previewThumb) {
        elements.previewThumb.src = video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`;
    }
    if (elements?.previewTitle) {
        elements.previewTitle.textContent = video.title || 'Unknown Track';
    }
    if (elements?.previewArtist) {
        elements.previewArtist.textContent = video.artist || video.author || 'Queued track';
    }

    state.previewSource = video.previewSource === 'batch' ? 'batch' : 'popular';
    if (elements?.previewSourceBadge) {
        elements.previewSourceBadge.textContent = state.previewSource === 'batch' ? 'Batch Queue' : 'Preview';
    }
    state.previewVideoId = video.videoId;
    emitPreviewStateChange();
};

export const emitPreviewStateChange = ({ documentRef = document, elements, state, previewAudioEngine }) => {
    const isPlaying = previewAudioEngine.isPlaying();
    const isLoading = previewAudioEngine.isLoading();
    const hasError = elements?.previewPlayer?.classList.contains('has-error') ?? false;
    elements?.previewPlayer?.classList.toggle('is-playing', Boolean(isPlaying));
    documentRef.dispatchEvent(new CustomEvent('preview-state-change', {
        detail: {
            videoId: state.previewVideoId,
            source: state.previewSource,
            isPlaying,
            isLoading,
            hasError
        }
    }));
};

export const activatePreviewPanel = (elements) => {
    elements?.previewPlayer?.classList.add('active');
};

export const deactivatePreviewPanel = (elements) => {
    elements?.previewPlayer?.classList.remove('active');
};
