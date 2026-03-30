/**
 * Popular Videos & Audio Preview Module
 * Handles curated music suggestions and 30-second audio previews
 */

import { drawWaveform as renderWaveform } from './waveformRenderer.js';
import { PreviewAudioEngine } from './previewAudioEngine.js';

let _onConvertRequest = null;
let _audioVisualizer = null;
let _previewAudioEngine = null;

const FeaturesModule = (() => {
    // State
    const state = {
        genres: [],
        activeGenre: 'global',
        previewVideoId: null,
        previewSource: 'popular'
    };

    // DOM Elements (populated on init)
    let elements = {};
    const previewAudioEngine = new PreviewAudioEngine({
        onStateChange: ({ isPlaying, isLoading }) => {
            elements.previewPlayBtn?.classList.toggle('playing', Boolean(isPlaying));
            setPreviewLoadingState(isLoading);
            emitPreviewStateChange();
        },
        onProgress: ({ currentTime, duration, percent }) => {
            renderPreviewProgress({ currentTime, duration, percent });
        },
        onStatus: (message) => {
            updatePreviewStatus(message);
        },
        onMetadata: ({ duration, seedSource }) => {
            if (elements.previewTimeTotal) {
                elements.previewTimeTotal.textContent = formatTime(duration);
            }
            renderWaveform(elements.waveformCanvas, { seedSource });
        },
        onError: (message) => {
            setPreviewLoadingState(true);
            if (elements.previewLoadingText) {
                elements.previewLoadingText.textContent = `⚠️ ${message}`;
                elements.previewLoadingText.style.color = 'var(--destructive)';
            }
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
                    <span class="popular-eyebrow">Fresh discovery</span>
                    <h2 class="popular-title">
                        <span class="popular-title-icon">🔥</span>
                        Popular Music
                    </h2>
                    <p class="popular-subtitle">Easy picks to preview, explore, and convert right away.</p>
                </div>
                <div class="popular-header-pulse" aria-hidden="true">
                    <span class="popular-pulse-dot"></span>
                    Updated picks
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
                                <span class="preview-source-badge" id="preview-source-badge">Popular Preview</span>
                                <span class="preview-transition-note" id="preview-transition-note">Ready to preview</span>
                            </div>
                            <span class="preview-title" id="preview-title">Loading...</span>
                            <span class="preview-artist" id="preview-artist"></span>
                        </div>
                        <span class="preview-badge">30s Preview</span>
                    </div>
                    <button class="preview-close" id="preview-close" aria-label="Close preview">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="preview-waveform" id="preview-waveform">
                    <div class="waveform-live-meter" aria-hidden="true">
                        <span class="waveform-live-bar"></span>
                        <span class="waveform-live-bar"></span>
                        <span class="waveform-live-bar"></span>
                        <span class="waveform-live-bar"></span>
                    </div>
                    <div class="waveform-theme-charm" aria-hidden="true">
                        <span class="theme-charm theme-charm-space">Moon mix</span>
                        <span class="theme-charm theme-charm-green">Forest bounce</span>
                        <span class="theme-charm theme-charm-frutiger">Aero splash</span>
                        <span class="theme-charm theme-charm-sunshine">Sunset ride</span>
                    </div>
                    <canvas class="waveform-canvas" id="waveform-canvas"></canvas>
                    <div class="waveform-grid" aria-hidden="true"></div>
                    <div class="waveform-progress" id="waveform-progress"></div>
                    <div class="waveform-playhead" id="waveform-playhead"></div>
                    <div class="waveform-scrub-hint">Click or scroll the energy line</div>
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
                            Lyrics Lounge
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
        elements.previewLyricsBtn?.addEventListener('click', focusLyricsPanel);
        elements.previewConvertBtn?.addEventListener('click', convertFromPreview);
    };

    const focusLyricsPanel = () => {
        const karaokeCard = document.getElementById('karaoke-card');
        if (!karaokeCard) return;

        karaokeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        karaokeCard.classList.add('is-targeted');
        window.setTimeout(() => {
            karaokeCard.classList.remove('is-targeted');
        }, 1800);
    };

    const resetPreviewProgress = () => {
        elements.previewProgressFill?.style.setProperty('transform', 'scaleX(0)');
        elements.waveformProgress?.style.setProperty('transform', 'scaleX(0)');
        elements.waveformPlayhead?.style.setProperty('left', '0%');
        if (elements.previewTimeCurrent) {
            elements.previewTimeCurrent.textContent = '0:00';
        }
        if (elements.previewTimeTotal) {
            elements.previewTimeTotal.textContent = '0:30';
        }
    };

    const setPreviewLoadingState = (isLoading) => {
        elements.previewPlayer?.classList.toggle('is-loading', Boolean(isLoading));
        elements.previewPlayer?.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    };

    const updatePreviewStatus = (message) => {
        if (elements.previewTransitionNote) {
            elements.previewTransitionNote.textContent = message;
        }
    };

    const emitPreviewStateChange = () => {
        const isPlaying = previewAudioEngine.isPlaying();
        const isLoading = previewAudioEngine.isLoading();
        elements.previewPlayer?.classList.toggle('is-playing', Boolean(isPlaying));
        document.dispatchEvent(new CustomEvent('preview-state-change', {
            detail: {
                videoId: state.previewVideoId,
                source: state.previewSource,
                isPlaying,
                isLoading
            }
        }));
    };

    const updatePreviewMetadata = (video) => {
        elements.previewThumb.src = video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`;
        elements.previewTitle.textContent = video.title || 'Unknown Track';
        elements.previewArtist.textContent = video.artist || video.author || 'Queued track';
        state.previewSource = video.previewSource === 'batch' ? 'batch' : 'popular';
        if (elements.previewSourceBadge) {
            elements.previewSourceBadge.textContent = state.previewSource === 'batch' ? 'Batch Queue' : 'Popular Preview';
        }
        state.previewVideoId = video.videoId;
        emitPreviewStateChange();
    };

    const resetLoadingText = () => {
        if (!elements.previewLoadingText) return;
        elements.previewLoadingText.textContent = 'Generating preview...';
        elements.previewLoadingText.style.color = '';
    };

    /**
     * Load genres from API
     */
    const loadGenres = async () => {
        try {
            const response = await fetch('/api/popular');

            // Check HTTP status before parsing JSON
            if (!response.ok) {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success && data.genres) {
                state.genres = data.genres;
                if (!state.genres.some(genre => genre.id === state.activeGenre)) {
                    state.activeGenre = state.genres.find(genre => genre.id === 'global')?.id || state.genres[0]?.id || '';
                }
                renderGenreTabs();
                renderVideoCarousel(state.activeGenre);
            } else {
                throw new Error(data.message || 'Invalid response from server');
            }
        } catch (error) {
            console.error('[Features] Failed to load genres:', error);
            // Show placeholder or retry option (safe - no user input interpolated)
            if (elements.videoCarousel) {
                elements.videoCarousel.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: var(--muted-foreground);">
                        Unable to load suggestions. <button class="popular-retry-btn" type="button" style="color: var(--foreground); text-decoration: underline; background: none; border: none; cursor: pointer;">Retry</button>
                    </div>
                `;
                elements.videoCarousel.querySelector('.popular-retry-btn')?.addEventListener('click', reload);
            }
        }
    };

    /**
     * Render genre tabs
     */
    const renderGenreTabs = () => {
        if (!elements.genreTabs) return;

        elements.genreTabs.innerHTML = state.genres.map(genre => `
            <button 
                class="genre-tab ${genre.id === state.activeGenre ? 'active' : ''}" 
                data-genre="${escapeAttr(genre.id)}"
                style="${genre.id === state.activeGenre ? `background: ${escapeAttr(genre.color)};` : ''}"
            >
                <span class="genre-tab-icon">${escapeHtml(genre.icon)}</span>
                <span>${escapeHtml(genre.name)}</span>
            </button>
        `).join('');

        // Bind tab click events
        elements.genreTabs.querySelectorAll('.genre-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const genreId = tab.dataset.genre;
                setActiveGenre(genreId);
            });
        });
    };

    /**
     * Set active genre and update UI
     */
    const setActiveGenre = (genreId) => {
        state.activeGenre = genreId;
        const genre = state.genres.find(g => g.id === genreId);

        // Update tab styles
        elements.genreTabs.querySelectorAll('.genre-tab').forEach(tab => {
            const isActive = tab.dataset.genre === genreId;
            tab.classList.toggle('active', isActive);
            if (isActive && genre) {
                tab.style.background = genre.color;
            } else {
                tab.style.background = '';
            }
        });

        renderVideoCarousel(genreId);
    };

    /**
     * Render video carousel for a genre
     */
    const renderVideoCarousel = (genreId) => {
        if (!elements.videoCarousel) return;

        const genre = state.genres.find(g => g.id === genreId);
        if (!genre) return;

        if (elements.activeGenreSummary) {
            elements.activeGenreSummary.innerHTML = `
                <div class="popular-genre-card" style="--genre-accent: ${escapeAttr(genre.color)}">
                    <span class="popular-genre-icon">${escapeHtml(genre.icon)}</span>
                    <div class="popular-genre-copy">
                        <span class="popular-genre-label">${escapeHtml(genre.name)}</span>
                        <p class="popular-genre-description">${escapeHtml(genre.description || 'Curated tracks for preview and conversion.')}</p>
                    </div>
                    <span class="popular-genre-count">${genre.videos.length} tracks</span>
                </div>
            `;
        }

        // Check if video is a live stream (preview not supported)
        const isLive = (video) => video.isLive || video.duration === 'LIVE';

        elements.videoCarousel.innerHTML = genre.videos.map((video, index) => `
            <article class="video-card" data-video-id="${escapeAttr(video.videoId)}" ${isLive(video) ? 'data-is-live="true"' : ''} style="--card-index: ${index}; --card-accent: ${escapeAttr(genre.color)}">
                <div class="video-card-thumbnail">
                    <img src="${escapeAttr(video.thumbnail)}" alt="${escapeAttr(video.title)}" loading="lazy">
                    <span class="video-card-duration">${escapeHtml(video.duration)}</span>
                    ${video.tag ? `<span class="video-card-tag">${escapeHtml(video.tag)}</span>` : ''}
                    <div class="video-card-overlay">
                        <div class="video-card-play">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        </div>
                    </div>
                    <div class="video-card-actions">
                        <button class="video-action-btn${isLive(video) ? ' disabled' : ''}" data-action="preview" title="${isLive(video) ? 'Preview unavailable for live streams' : 'Preview'}" ${isLive(video) ? 'disabled' : ''}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                            </svg>
                        </button>
                        <button class="video-action-btn" data-action="convert" title="Convert">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="video-card-info">
                    <span class="video-card-rank">${String(index + 1).padStart(2, '0')}</span>
                    <h3 class="video-card-title">${escapeHtml(video.title)}</h3>
                    <p class="video-card-artist">${escapeHtml(video.artist)}</p>
                </div>
            </article>
        `).join('');

        // Bind video card events
        elements.videoCarousel.querySelectorAll('.video-card').forEach(card => {
            const videoId = card.dataset.videoId;
            const video = genre.videos.find(v => v.videoId === videoId);
            const videoIsLive = card.dataset.isLive === 'true';

            // Preview button (disabled for live streams)
            const previewBtn = card.querySelector('[data-action="preview"]');
            if (previewBtn && !videoIsLive) {
                previewBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showPreview(video);
                });
            }

            // Convert button
            card.querySelector('[data-action="convert"]')?.addEventListener('click', (e) => {
                e.stopPropagation();
                convertVideo(video);
            });

            // Card click - show preview (unless live stream)
            card.addEventListener('click', () => {
                if (!videoIsLive) {
                    showPreview(video);
                } else {
                    // For live streams, go straight to convert
                    convertVideo(video);
                }
            });
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
            updatePreviewMetadata(video);
            updatePreviewStatus(previewAudioEngine.isPlaying() ? 'Now playing' : 'Ready to preview');
            return;
        }

        elements.previewPlayer.classList.add('active');
        updatePreviewMetadata(video);
        resetPreviewProgress();
        resetLoadingText();
        const { requestId, controller, outgoingAudio } = previewAudioEngine.beginRequest();
        updatePreviewStatus(outgoingAudio && previewAudioEngine.isPlaying() ? 'Preparing next preview...' : 'Generating preview...');

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

            await previewAudioEngine.loadPreview(data.previewUrl, {
                requestId,
                outgoingAudio,
                shouldAutoplay,
                seedSource: `${state.previewVideoId || 'preview'}:${elements.previewTitle?.textContent || ''}`
            });
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }
            if (!previewAudioEngine.isCurrentRequest(requestId)) return;
            console.error('[Preview] Error:', error);
            if (elements.previewLoadingText) {
                elements.previewLoadingText.textContent = '⚠️ ' + (error.message || 'Failed to generate preview');
                elements.previewLoadingText.style.color = 'var(--destructive)';
            }
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
        elements.previewPlayer.classList.remove('active');
        resetPreviewProgress();

        resetLoadingText();
        updatePreviewStatus('Ready to preview');
        emitPreviewStateChange();
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
        updatePreviewStatus('Scroll to scrub');
    };

    /**
     * Update preview progress UI
     */
    const renderPreviewProgress = ({ currentTime, duration, percent }) => {
        if (!Number.isFinite(duration) || duration <= 0) {
            elements.previewProgressFill.style.transform = 'scaleX(0)';
            elements.waveformProgress.style.transform = 'scaleX(0)';
            elements.waveformPlayhead.style.left = '0%';
            elements.previewTimeCurrent.textContent = '0:00';
            return;
        }

        elements.previewProgressFill.style.transform = `scaleX(${percent})`;
        elements.waveformProgress.style.transform = `scaleX(${percent})`;
        elements.waveformPlayhead.style.left = `${percent * 100}%`;
        elements.previewTimeCurrent.textContent = formatTime(currentTime);
    };

    /**
     * Draw waveform visualization (placeholder - actual would use Web Audio API)
     */
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
        if (!state.genres || state.genres.length === 0) return [];

        const globalVideos = state.genres
            .filter(g => g.id === 'global')
            .flatMap(g => g.videos || []);

        const otherVideos = state.genres
            .filter(g => g.id !== 'global')
            .flatMap(g => g.videos || []);

        const allVideos = [...globalVideos, ...otherVideos]
            .filter(v => !v.isLive && v.duration !== 'LIVE')
            .filter((video, index, videos) => videos.findIndex(candidate => candidate.videoId === video.videoId) === index);

        if (allVideos.length < count) {
            return [...allVideos].sort(() => 0.5 - Math.random());
        }

        const shuffled = [...allVideos].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    };

    // Public API
    return {
        init,
        reload,
        showPreview,
        closePreview,
        getRandomTracks
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
 * Avoids a direct import that would change when features.js is split in Phase 4.
 */
export function setAudioVisualizer(visualizer) {
    _audioVisualizer = visualizer;
    _previewAudioEngine?.setAudioVisualizer(visualizer);
}

export { FeaturesModule };
