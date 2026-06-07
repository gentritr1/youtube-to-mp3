// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
    activatePreviewPanel,
    deactivatePreviewPanel,
    emitPreviewStateChange,
    renderPreviewProgress,
    resetPreviewLoadingText,
    resetPreviewProgress,
    setPreviewLoadingState,
    showPreviewError,
    updatePreviewMetadata,
    updatePreviewStatus
} from '../js/previewPanel.js';

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

describe('previewPanel', () => {
    const createElements = () => {
        const previewPlayer = document.createElement('div');
        const previewLoading = document.createElement('div');
        const previewTransitionNote = document.createElement('span');
        const previewLoadingText = document.createElement('span');
        const previewProgressFill = document.createElement('div');
        const waveformProgress = document.createElement('div');
        const waveformPlayhead = document.createElement('div');
        const previewTimeCurrent = document.createElement('span');
        const previewTimeTotal = document.createElement('span');
        const previewThumb = document.createElement('img');
        const previewTitle = document.createElement('span');
        const previewArtist = document.createElement('span');
        const previewSourceBadge = document.createElement('span');

        return {
            previewPlayer,
            previewLoading,
            previewTransitionNote,
            previewLoadingText,
            previewProgressFill,
            waveformProgress,
            waveformPlayhead,
            previewTimeCurrent,
            previewTimeTotal,
            previewThumb,
            previewTitle,
            previewArtist,
            previewSourceBadge
        };
    };

    it('updates loading, status, and error text on the preview panel', () => {
        const elements = createElements();

        setPreviewLoadingState(elements, true);
        expect(elements.previewPlayer.classList.contains('is-loading')).toBe(true);
        expect(elements.previewPlayer.getAttribute('aria-busy')).toBe('true');

        updatePreviewStatus(elements, 'Preparing next preview...');
        expect(elements.previewTransitionNote.textContent).toBe('Preparing next preview...');

        showPreviewError(elements, 'Preview failed');
        expect(elements.previewPlayer.classList.contains('has-error')).toBe(true);
        expect(elements.previewPlayer.classList.contains('is-loading')).toBe(false);
        expect(elements.previewPlayer.getAttribute('aria-busy')).toBe('false');
        expect(elements.previewLoading.getAttribute('role')).toBe('alert');
        expect(elements.previewTransitionNote.textContent).toBe('Preview unavailable');
        expect(elements.previewLoadingText.textContent).toBe('Preview failed');
        expect(elements.previewLoadingText.style.color).toBe('var(--destructive)');

        resetPreviewLoadingText(elements);
        expect(elements.previewPlayer.classList.contains('has-error')).toBe(false);
        expect(elements.previewLoading.getAttribute('role')).toBe('status');
        expect(elements.previewLoadingText.textContent).toBe('Generating preview...');
        expect(elements.previewLoadingText.style.color).toBe('');
    });

    it('renders preview metadata, progress, and playback state events', () => {
        const elements = createElements();
        const state = {
            previewVideoId: null,
            previewSource: 'popular'
        };
        const previewAudioEngine = {
            isPlaying: () => true,
            isLoading: () => false
        };
        const documentRef = document;
        const eventSpy = vi.fn();
        documentRef.addEventListener('preview-state-change', eventSpy);

        updatePreviewMetadata({
            elements,
            state,
            video: {
                videoId: 'abc123',
                thumbnail: '',
                title: 'Track One',
                artist: 'Artist One',
                previewSource: 'batch'
            },
            emitPreviewStateChange: () => emitPreviewStateChange({
                documentRef,
                elements,
                state,
                previewAudioEngine
            })
        });

        expect(elements.previewThumb.src).toContain('https://i.ytimg.com/vi/abc123/mqdefault.jpg');
        expect(elements.previewTitle.textContent).toBe('Track One');
        expect(elements.previewArtist.textContent).toBe('Artist One');
        expect(elements.previewSourceBadge.textContent).toBe('Batch Queue');
        expect(state.previewVideoId).toBe('abc123');
        expect(elements.previewPlayer.classList.contains('is-playing')).toBe(true);
        expect(eventSpy).toHaveBeenCalledTimes(1);
        expect(eventSpy.mock.calls[0][0].detail.hasError).toBe(false);

        showPreviewError(elements, 'Preview failed');
        emitPreviewStateChange({
            documentRef,
            elements,
            state,
            previewAudioEngine
        });
        expect(eventSpy.mock.calls[1][0].detail.hasError).toBe(true);

        renderPreviewProgress(elements, {
            currentTime: 12,
            duration: 30,
            percent: 0.4
        }, formatTime);
        expect(elements.previewProgressFill.style.transform).toBe('scaleX(0.4)');
        expect(elements.waveformProgress.style.transform).toBe('scaleX(0.4)');
        expect(elements.waveformPlayhead.style.left).toBe('40%');
        expect(elements.previewTimeCurrent.textContent).toBe('0:12');
    });

    it('resets progress and toggles panel visibility', () => {
        const elements = createElements();

        activatePreviewPanel(elements);
        expect(elements.previewPlayer.classList.contains('active')).toBe(true);

        resetPreviewProgress(elements);
        expect(elements.previewProgressFill.style.transform).toBe('scaleX(0)');
        expect(elements.waveformProgress.style.transform).toBe('scaleX(0)');
        expect(elements.waveformPlayhead.style.left).toBe('0%');
        expect(elements.previewTimeCurrent.textContent).toBe('0:00');
        expect(elements.previewTimeTotal.textContent).toBe('0:30');

        deactivatePreviewPanel(elements);
        expect(elements.previewPlayer.classList.contains('active')).toBe(false);
    });
});
