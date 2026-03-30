export const setPreviewLoadingState = (elements, isLoading) => {
    elements?.previewPlayer?.classList.toggle('is-loading', Boolean(isLoading));
    elements?.previewPlayer?.setAttribute('aria-busy', isLoading ? 'true' : 'false');
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

    elements.previewLoadingText.textContent = 'Generating preview...';
    elements.previewLoadingText.style.color = '';
};

export const showPreviewError = (elements, message) => {
    if (!elements?.previewLoadingText) {
        return;
    }

    elements.previewLoadingText.textContent = `⚠️ ${message}`;
    elements.previewLoadingText.style.color = 'var(--destructive)';
};

export const resetPreviewProgress = (elements) => {
    elements?.previewProgressFill?.style.setProperty('transform', 'scaleX(0)');
    elements?.waveformProgress?.style.setProperty('transform', 'scaleX(0)');
    elements?.waveformPlayhead?.style.setProperty('left', '0%');
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
        return;
    }

    if (elements?.previewProgressFill) {
        elements.previewProgressFill.style.transform = `scaleX(${percent})`;
    }
    if (elements?.waveformProgress) {
        elements.waveformProgress.style.transform = `scaleX(${percent})`;
    }
    if (elements?.waveformPlayhead) {
        elements.waveformPlayhead.style.left = `${percent * 100}%`;
    }
    if (elements?.previewTimeCurrent) {
        elements.previewTimeCurrent.textContent = formatTime(currentTime);
    }
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
        elements.previewSourceBadge.textContent = state.previewSource === 'batch' ? 'Batch Queue' : 'Popular Preview';
    }
    state.previewVideoId = video.videoId;
    emitPreviewStateChange();
};

export const emitPreviewStateChange = ({ documentRef = document, elements, state, previewAudioEngine }) => {
    const isPlaying = previewAudioEngine.isPlaying();
    const isLoading = previewAudioEngine.isLoading();
    elements?.previewPlayer?.classList.toggle('is-playing', Boolean(isPlaying));
    documentRef.dispatchEvent(new CustomEvent('preview-state-change', {
        detail: {
            videoId: state.previewVideoId,
            source: state.previewSource,
            isPlaying,
            isLoading
        }
    }));
};

export const activatePreviewPanel = (elements) => {
    elements?.previewPlayer?.classList.add('active');
};

export const deactivatePreviewPanel = (elements) => {
    elements?.previewPlayer?.classList.remove('active');
};
