/**
 * Popular Videos & Audio Preview Module
 * Handles curated music suggestions and 30-second audio previews
 */

import { drawWaveform as renderWaveform } from './waveformRenderer.js';
import { loadWaveformSamples } from './waveformSignal.js';
import { PreviewAudioEngine } from './previewAudioEngine.js';
import { iconSvg } from './ui/icons.js';
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
} from './previewPanel.js';
import {
    getRandomTracksFromGenres,
    loadPopularGenres,
    renderPopularGenreTabs,
    renderPopularRetryState,
    renderPopularVideoCarousel,
    resolveActiveGenreId,
    updatePopularGenreTabStyles
} from './popularBrowser.js';

let _onConvertRequest = null;
let _audioVisualizer = null;
let _previewAudioEngine = null;

const FeaturesModule = (() => {
    // State
    const state = {
        genres: [],
        activeGenre: 'global',
        previewVideoId: null,
        previewSource: 'popular',
        previewSeedSource: '',
        previewWaveformSamples: null
    };

    // DOM Elements (populated on init)
    let elements = {};
    const getPreviewErrorMessage = (error) => {
        const rawMessage = error?.message || String(error || '');
        if (!rawMessage) {
            return 'Preview is unavailable for this track. You can still convert it or try another video.';
        }

        const isTechnicalFailure = /ffmpeg|yt-dlp|exited with code|failed to load audio preview/i.test(rawMessage);
        return isTechnicalFailure
            ? 'Preview is unavailable for this track. You can still convert it or try another video.'
            : rawMessage;
    };

    const previewAudioEngine = new PreviewAudioEngine({
        onStateChange: ({ isPlaying, isLoading }) => {
            elements.previewPlayBtn?.classList.toggle('playing', Boolean(isPlaying));
            setPreviewLoadingState(elements, isLoading);
            emitPreviewStateChange({
                elements,
                state,
                previewAudioEngine
            });
        },
        onProgress: ({ currentTime, duration, percent }) => {
            renderPreviewProgress(elements, { currentTime, duration, percent }, formatTime);
        },
        onStatus: (message) => {
            updatePreviewStatus(elements, message);
        },
        onMetadata: ({ duration, seedSource }) => {
            if (elements.previewTimeTotal) {
                elements.previewTimeTotal.textContent = formatTime(duration);
            }
            state.previewSeedSource = seedSource || `${state.previewVideoId || 'preview'}:${elements.previewTitle?.textContent || ''}`;
            renderCurrentWaveform();
        },
        onError: (message) => {
            setPreviewLoadingState(elements, true);
            showPreviewError(elements, getPreviewErrorMessage({ message }));
        },
        audioVisualizer: _audioVisualizer
    });
    _previewAudioEngine = previewAudioEngine;

    /**
     * HTML escape helper to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} HTML-safe string
     */
    const escapeHtml = (str) => {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    /**
     * Escape HTML for use in attributes (more strict)
     * @param {string} str - String to escape
     * @returns {string} Attribute-safe string
     */
    const escapeAttr = (str) => {
        if (typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

    /**
     * Initialize the features module
     */
    const init = async () => {
        createDOM();
        bindEvents();
        await loadGenres();
    };

    /**
     * Create the DOM structure for both features
     */
    const createDOM = () => {
        const converterCard = document.querySelector('.converter-card');
        const popularContainer = document.getElementById('popular-videos-container');

        if (!converterCard) return;

        // Create Popular Videos section (goes OUTSIDE the card)
        const popularSection = document.createElement('div');
        popularSection.className = 'popular-section';
        popularSection.id = 'popular-section';
        popularSection.innerHTML = `
            <div class="popular-header">
                <div class="popular-header-copy">
                    <span class="popular-eyebrow">Suggestions</span>
                    <h2 class="popular-title">
                        ${iconSvg('music', 'ui-icon popular-title-icon')}
                        Popular Music
                    </h2>
                    <p class="popular-subtitle">Easy picks to preview, explore, and convert right away.</p>
                </div>
                <div class="popular-header-pulse" aria-hidden="true">
                    <span class="popular-pulse-dot"></span>
                    Popular Music
                </div>
            </div>
            <div class="popular-active-genre" id="popular-active-genre"></div>
            <div class="genre-tabs" id="genre-tabs"></div>
            <div class="video-carousel" id="video-carousel"></div>
        `;

        // Create Preview Player section (stays INSIDE the card)
        const previewPlayer = document.createElement('div');
        previewPlayer.className = 'preview-player';
        previewPlayer.id = 'preview-player';
        previewPlayer.innerHTML = `
            <div class="preview-loading" id="preview-loading">
                <div class="preview-loading-spinner"></div>
                <span class="preview-loading-text">Generating preview...</span>
            </div>
            <div class="preview-content" id="preview-content">
                <div class="preview-header">
                    <div class="preview-info">
                        <img class="preview-thumb" id="preview-thumb" src="" alt="">
                        <div class="preview-meta">
                            <div class="preview-meta-topline">
                                <span class="preview-source-badge" id="preview-source-badge">Preview</span>
                                <span class="preview-transition-note" id="preview-transition-note">Ready to preview</span>
                            </div>
                            <span class="preview-title" id="preview-title">Loading...</span>
                            <span class="preview-artist" id="preview-artist"></span>
                        </div>
                        <span class="preview-badge">${iconSvg('timer', 'ui-icon preview-badge-icon')}<span>30s preview</span></span>
                    </div>
                    <button class="preview-close" id="preview-close" aria-label="Close preview">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="preview-waveform" id="preview-waveform" tabindex="0" role="slider" aria-label="Preview scrubber" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="0:00 of 0:30">
                    <div class="waveform-theme-charm" aria-hidden="true">
                        <span class="theme-charm theme-charm-space">Preview</span>
                        <span class="theme-charm theme-charm-green">Preview</span>
                        <span class="theme-charm theme-charm-frutiger">Preview</span>
                        <span class="theme-charm theme-charm-sunshine">Preview</span>
                    </div>
                    <canvas class="waveform-canvas" id="waveform-canvas"></canvas>
                    <div class="waveform-grid" aria-hidden="true"></div>
                    <div class="waveform-progress" id="waveform-progress"></div>
                    <div class="waveform-playhead" id="waveform-playhead"></div>
                    <div class="waveform-scrub-hint">Click to scrub</div>
                </div>
                <div class="preview-controls">
                    <button class="preview-play-btn" id="preview-play-btn" aria-label="Play/Pause">
                        <svg class="icon-play" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        <svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="4" width="4" height="16"></rect>
                            <rect x="14" y="4" width="4" height="16"></rect>
                        </svg>
                    </button>
                    <div class="preview-time">
                        <span class="preview-time-current" id="preview-time-current">0:00</span>
                        <div class="preview-progress-bar" id="preview-progress-bar">
                            <div class="preview-progress-fill" id="preview-progress-fill"></div>
                        </div>
                        <span class="preview-time-total" id="preview-time-total">0:30</span>
                    </div>
                    <div class="preview-actions">
                        <button class="preview-lyrics-btn" id="preview-lyrics-btn" type="button">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 18V5l12-2v13"></path>
                                <circle cx="6" cy="18" r="3"></circle>
                                <circle cx="18" cy="16" r="3"></circle>
                            </svg>
                            Lyrics
                        </button>
                        <button class="preview-convert-btn" id="preview-convert-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Convert
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Insert preview player INSIDE the card (after form)
        const form = converterCard.querySelector('#converter-form');
        if (form) {
            form.after(previewPlayer);
        } else {
            converterCard.appendChild(previewPlayer);
        }

        // Insert popular section OUTSIDE the card (into dedicated container)
        if (popularContainer) {
            popularContainer.appendChild(popularSection);
        } else {
            // Fallback: insert after the converter card
            converterCard.after(popularSection);
        }

        // Cache elements
        elements = {
            popularSection,
            activeGenreSummary: document.getElementById('popular-active-genre'),
            genreTabs: document.getElementById('genre-tabs'),
            videoCarousel: document.getElementById('video-carousel'),
            previewPlayer,
            previewLoading: document.getElementById('preview-loading'),
            previewLoadingText: document.querySelector('#preview-loading .preview-loading-text'),
            previewContent: document.getElementById('preview-content'),
            previewThumb: document.getElementById('preview-thumb'),
            previewTitle: document.getElementById('preview-title'),
            previewArtist: document.getElementById('preview-artist'),
            previewSourceBadge: document.getElementById('preview-source-badge'),
            previewTransitionNote: document.getElementById('preview-transition-note'),
            previewClose: document.getElementById('preview-close'),
            previewPlayBtn: document.getElementById('preview-play-btn'),
            previewProgressBar: document.getElementById('preview-progress-bar'),
            previewProgressFill: document.getElementById('preview-progress-fill'),
            previewTimeCurrent: document.getElementById('preview-time-current'),
            previewTimeTotal: document.getElementById('preview-time-total'),
            previewLyricsBtn: document.getElementById('preview-lyrics-btn'),
            previewConvertBtn: document.getElementById('preview-convert-btn'),
            waveformCanvas: document.getElementById('waveform-canvas'),
            waveform: document.getElementById('preview-waveform'),
            waveformProgress: document.getElementById('waveform-progress'),
            waveformPlayhead: document.getElementById('waveform-playhead')
        };
    };

    /**
     * Bind event listeners
     */
    const bindEvents = () => {
        // Preview controls
        elements.previewClose?.addEventListener('click', closePreview);
        elements.previewPlayBtn?.addEventListener('click', togglePreviewPlayback);
        elements.previewProgressBar?.addEventListener('click', seekPreview);
        elements.waveform?.addEventListener('click', seekPreview);
        elements.waveform?.addEventListener('wheel', seekPreviewByWheel, { passive: false });
        elements.waveform?.addEventListener('keydown', seekPreviewByKeyboard);
        elements.previewLyricsBtn?.addEventListener('click', focusLyricsPanel);
        elements.previewConvertBtn?.addEventListener('click', convertFromPreview);
    };

    const focusLyricsPanel = () => {
        const karaokeCard = document.getElementById('karaoke-card');
        if (!karaokeCard) return;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        karaokeCard.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        karaokeCard.classList.add('is-targeted');
        window.setTimeout(() => {
            karaokeCard.classList.remove('is-targeted');
        }, 1800);
    };

    /**
     * Load genres from API
     */
    const loadGenres = async () => {
        try {
            state.genres = await loadPopularGenres();
            state.activeGenre = resolveActiveGenreId(state.genres, state.activeGenre);
            renderGenreTabs();
            renderVideoCarousel(state.activeGenre);
        } catch (error) {
            console.error('[Features] Failed to load genres:', error);
            renderPopularRetryState({
                videoCarousel: elements.videoCarousel,
                onRetry: reload
            });
        }
    };

    /**
     * Render genre tabs
     */
    const renderGenreTabs = () => {
        renderPopularGenreTabs({
            genreTabs: elements.genreTabs,
            genres: state.genres,
            activeGenre: state.activeGenre,
            escapeHtml,
            escapeAttr,
            onSelectGenre: (genreId) => {
                setActiveGenre(genreId);
            }
        });
    };

    /**
     * Set active genre and update UI
     */
    const setActiveGenre = (genreId) => {
        state.activeGenre = genreId;
        updatePopularGenreTabStyles({
            genreTabs: elements.genreTabs,
            genres: state.genres,
            genreId
        });

        renderVideoCarousel(genreId);
    };

    /**
     * Render video carousel for a genre
     */
    const renderVideoCarousel = (genreId) => {
        renderPopularVideoCarousel({
            videoCarousel: elements.videoCarousel,
            activeGenreSummary: elements.activeGenreSummary,
            genres: state.genres,
            genreId,
            escapeHtml,
            escapeAttr,
            onShowPreview: (video) => {
                showPreview(video);
            },
            onConvertVideo: (video) => {
                convertVideo(video);
            }
        });
    };

    /**
     * Show audio preview for a video
     */
    const showPreview = async (video) => {
        // Check if live stream
        if (video.isLive || video.duration === 'LIVE') {
            alert('Preview is not available for live streams. You can still convert the video.');
            return;
        }

        const isSamePreview = elements.previewPlayer.classList.contains('active')
            && state.previewVideoId === video.videoId
            && previewAudioEngine.hasAudio();

        if (isSamePreview) {
            updatePreviewMetadata({ elements, state, video, emitPreviewStateChange: () => emitPreviewStateChange({
                elements,
                state,
                previewAudioEngine
            }) });
            updatePreviewStatus(elements, previewAudioEngine.isPlaying() ? 'Now playing' : 'Ready to preview');
            return;
        }

        activatePreviewPanel(elements);
        updatePreviewMetadata({ elements, state, video, emitPreviewStateChange: () => emitPreviewStateChange({
            elements,
            state,
            previewAudioEngine
        }) });
        resetPreviewProgress(elements);
        resetPreviewLoadingText(elements);
        state.previewWaveformSamples = null;
        const { requestId, controller, outgoingAudio } = previewAudioEngine.beginRequest();
        updatePreviewStatus(elements, outgoingAudio && previewAudioEngine.isPlaying() ? 'Preparing next preview...' : 'Generating preview...');

        try {
            const response = await fetch('/api/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId: video.videoId }),
                signal: controller.signal
            });

            // Check HTTP status before parsing JSON
            if (!response.ok) {
                let errorMsg = `Server error: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.message) {
                        errorMsg = errorData.message;
                    }
                } catch (e) {
                    // Ignore JSON parse error on error response
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to generate preview');
            }

            const shouldAutoplay = Boolean(
                outgoingAudio
                && previewAudioEngine.isCurrentRequest(requestId)
                && previewAudioEngine.isPlaying()
                && previewAudioEngine.getCurrentAudio() === outgoingAudio
            );

            const loaded = await previewAudioEngine.loadPreview(data.previewUrl, {
                requestId,
                outgoingAudio,
                shouldAutoplay,
                seedSource: `${state.previewVideoId || 'preview'}:${elements.previewTitle?.textContent || ''}`
            });

            if (loaded) {
                void updateWaveformFromPreviewSignal(data.previewUrl, requestId, controller.signal);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }
            if (!previewAudioEngine.isCurrentRequest(requestId)) return;
            console.error('[Preview] Error:', error);
            previewAudioEngine.stopAll();
            showPreviewError(elements, getPreviewErrorMessage(error));
            emitPreviewStateChange({
                elements,
                state,
                previewAudioEngine
            });
        } finally {
            previewAudioEngine.endRequest(requestId, controller);
        }
    };

    /**
     * Close preview player
     */
    const closePreview = () => {
        previewAudioEngine.stopAll();
        state.previewVideoId = null;
        state.previewSource = 'popular';
        state.previewWaveformSamples = null;
        deactivatePreviewPanel(elements);
        resetPreviewProgress(elements);

        resetPreviewLoadingText(elements);
        updatePreviewStatus(elements, 'Ready to preview');
        emitPreviewStateChange({
            elements,
            state,
            previewAudioEngine
        });
    };

    /**
     * Toggle preview playback
     */
    const togglePreviewPlayback = () => {
        previewAudioEngine.togglePlayback();
    };

    /**
     * Seek in preview
     */
    const seekPreview = (e) => {
        const target = e.currentTarget instanceof HTMLElement ? e.currentTarget : elements.previewProgressBar;
        const rect = target.getBoundingClientRect();
        let percent = (e.clientX - rect.left) / rect.width;

        // Clamp to [0, 1]
        percent = Math.max(0, Math.min(1, percent));

        previewAudioEngine.seekToPercent(percent);
    };

    const seekPreviewByWheel = (e) => {
        e.preventDefault();

        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        const currentAudio = previewAudioEngine.getCurrentAudio();
        const duration = currentAudio?.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;

        const stepSeconds = Math.max(0.6, Math.min(duration * 0.045, 2.4));
        const direction = delta > 0 ? 1 : -1;
        previewAudioEngine.seekByDelta(direction * stepSeconds);
        updatePreviewStatus(elements, 'Preview position updated');
    };

    const seekPreviewByKeyboard = (e) => {
        const currentAudio = previewAudioEngine.getCurrentAudio();
        const duration = currentAudio?.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;

        const currentTime = Number.isFinite(currentAudio.currentTime) ? currentAudio.currentTime : 0;
        let nextTime = currentTime;

        switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowDown':
                nextTime = currentTime - Math.max(1, duration * 0.05);
                break;
            case 'ArrowRight':
            case 'ArrowUp':
                nextTime = currentTime + Math.max(1, duration * 0.05);
                break;
            case 'PageDown':
                nextTime = currentTime - Math.max(3, duration * 0.15);
                break;
            case 'PageUp':
                nextTime = currentTime + Math.max(3, duration * 0.15);
                break;
            case 'Home':
                nextTime = 0;
                break;
            case 'End':
                nextTime = duration;
                break;
            default:
                return;
        }

        e.preventDefault();
        const percent = Math.max(0, Math.min(1, nextTime / duration));
        previewAudioEngine.seekToPercent(percent);
        updatePreviewStatus(elements, 'Preview position updated');
    };

    const renderCurrentWaveform = () => {
        if (!state.previewSeedSource || !elements.waveformCanvas) {
            return;
        }

        renderWaveform(elements.waveformCanvas, {
            seedSource: state.previewSeedSource,
            root: elements.previewPlayer || document.documentElement,
            samples: state.previewWaveformSamples
        });
    };

    const updateWaveformFromPreviewSignal = async (previewUrl, requestId, signal) => {
        try {
            const samples = await loadWaveformSamples(previewUrl, { signal });
            if (!samples.length || !previewAudioEngine.isCurrentRequest(requestId)) {
                return;
            }

            state.previewWaveformSamples = samples;
            renderCurrentWaveform();
        } catch (error) {
            if (error?.name === 'AbortError') {
                return;
            }

            console.warn('[Preview] Falling back to seeded waveform:', error);
        }
    };

    /**
     * Convert from preview
     */
    const convertFromPreview = () => {
        if (!state.previewVideoId) return;

        const url = `https://www.youtube.com/watch?v=${state.previewVideoId}`;
        if (_onConvertRequest) {
            _onConvertRequest(url);
        }

        closePreview();
    };

    /**
     * Convert video directly (from popular videos)
     */
    const convertVideo = (video) => {
        const url = `https://www.youtube.com/watch?v=${video.videoId}`;
        if (_onConvertRequest) {
            _onConvertRequest(url);
        }
    };

    /**
     * Format time in M:SS format
     */
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    /**
     * Reload genres (public method for retry)
     */
    const reload = () => {
        loadGenres();
    };

    /**
     * Get random tracks from loaded genres
     */
    const getRandomTracks = (count = 4) => {
        return getRandomTracksFromGenres(state.genres, count);
    };

    const redrawWaveform = () => {
        renderCurrentWaveform();
    };

    // Public API
    return {
        init,
        reload,
        showPreview,
        closePreview,
        getRandomTracks,
        redrawWaveform
    };
})();

/**
 * Inject convert request callback. Called by app.js during init.
 * Replaces the old synthetic event dispatch on converter-form.
 */
export function setOnConvertRequest(callback) {
    _onConvertRequest = callback;
}

/**
 * Inject AudioVisualizer reference. Called by app.js during init.
 * Keeps preview rendering independent from the visualizer implementation.
 */
export function setAudioVisualizer(visualizer) {
    _audioVisualizer = visualizer;
    _previewAudioEngine?.setAudioVisualizer(visualizer);
}

export { FeaturesModule };
