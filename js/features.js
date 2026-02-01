/**
 * Popular Videos & Audio Preview Module
 * Handles curated music suggestions and 30-second audio previews
 */

const FeaturesModule = (() => {
    // State
    const state = {
        genres: [],
        activeGenre: 'pop',
        previewAudio: null,
        previewVideoId: null,
        isPreviewPlaying: false,
        isPreviewLoading: false
    };

    // DOM Elements (populated on init)
    let elements = {};

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
        if (!converterCard) return;

        // Create Popular Videos section
        const popularSection = document.createElement('section');
        popularSection.className = 'popular-section';
        popularSection.id = 'popular-section';
        popularSection.innerHTML = `
            <div class="popular-header">
                <h2 class="popular-title">
                    <span class="popular-title-icon">🔥</span>
                    Popular Music
                </h2>
            </div>
            <div class="genre-tabs" id="genre-tabs"></div>
            <div class="video-carousel" id="video-carousel"></div>
        `;

        // Create Preview Player section
        const previewPlayer = document.createElement('div');
        previewPlayer.className = 'preview-player';
        previewPlayer.id = 'preview-player';
        previewPlayer.innerHTML = `
            <div class="preview-loading" id="preview-loading" style="display: none;">
                <div class="preview-loading-spinner"></div>
                <span class="preview-loading-text">Generating preview...</span>
            </div>
            <div class="preview-content" id="preview-content">
                <div class="preview-header">
                    <div class="preview-info">
                        <img class="preview-thumb" id="preview-thumb" src="" alt="">
                        <div class="preview-meta">
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
                    <canvas class="waveform-canvas" id="waveform-canvas"></canvas>
                    <div class="waveform-progress" id="waveform-progress"></div>
                    <div class="waveform-playhead" id="waveform-playhead"></div>
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
        `;

        // Insert after the form but before progress/download sections
        const form = converterCard.querySelector('#converter-form');
        if (form) {
            form.after(previewPlayer);
            previewPlayer.after(popularSection);
        } else {
            converterCard.appendChild(previewPlayer);
            converterCard.appendChild(popularSection);
        }

        // Cache elements
        elements = {
            popularSection,
            genreTabs: document.getElementById('genre-tabs'),
            videoCarousel: document.getElementById('video-carousel'),
            previewPlayer,
            previewLoading: document.getElementById('preview-loading'),
            previewLoadingText: document.querySelector('#preview-loading .preview-loading-text'),
            previewContent: document.getElementById('preview-content'),
            previewThumb: document.getElementById('preview-thumb'),
            previewTitle: document.getElementById('preview-title'),
            previewArtist: document.getElementById('preview-artist'),
            previewClose: document.getElementById('preview-close'),
            previewPlayBtn: document.getElementById('preview-play-btn'),
            previewProgressBar: document.getElementById('preview-progress-bar'),
            previewProgressFill: document.getElementById('preview-progress-fill'),
            previewTimeCurrent: document.getElementById('preview-time-current'),
            previewTimeTotal: document.getElementById('preview-time-total'),
            previewConvertBtn: document.getElementById('preview-convert-btn'),
            waveformCanvas: document.getElementById('waveform-canvas'),
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
        elements.previewConvertBtn?.addEventListener('click', convertFromPreview);
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
                        Unable to load suggestions. <button onclick="FeaturesModule.reload()" style="color: var(--foreground); text-decoration: underline; background: none; border: none; cursor: pointer;">Retry</button>
                    </div>
                `;
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
                style="${genre.id === state.activeGenre ? `background: ${escapeAttr(genre.color)}; border-color: ${escapeAttr(genre.color)};` : ''}"
            >
                <span class="genre-tab-icon">${escapeHtml(genre.icon)}</span>
                ${escapeHtml(genre.name)}
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
                tab.style.borderColor = genre.color;
            } else {
                tab.style.background = '';
                tab.style.borderColor = '';
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

        // Check if video is a live stream (preview not supported)
        const isLive = (video) => video.isLive || video.duration === 'LIVE';

        elements.videoCarousel.innerHTML = genre.videos.map(video => `
            <article class="video-card" data-video-id="${escapeAttr(video.videoId)}" ${isLive(video) ? 'data-is-live="true"' : ''}>
                <div class="video-card-thumbnail">
                    <img src="${escapeAttr(video.thumbnail)}" alt="${escapeAttr(video.title)}" loading="lazy">
                    <span class="video-card-duration">${escapeHtml(video.duration)}</span>
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
        if (state.isPreviewLoading) return;

        // Check if live stream
        if (video.isLive || video.duration === 'LIVE') {
            alert('Preview is not available for live streams. You can still convert the video.');
            return;
        }

        // Update UI with video info (using textContent for safety)
        elements.previewPlayer.classList.add('active');
        elements.previewThumb.src = video.thumbnail;
        elements.previewTitle.textContent = video.title;
        elements.previewArtist.textContent = video.artist;
        state.previewVideoId = video.videoId;

        // Show loading state
        state.isPreviewLoading = true;
        elements.previewLoading.style.display = 'flex';
        elements.previewContent.style.display = 'none';

        // Reset loading text to default
        if (elements.previewLoadingText) {
            elements.previewLoadingText.textContent = 'Generating preview...';
        }

        try {
            // Request preview generation
            const response = await fetch('/api/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId: video.videoId })
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

            // Create audio element
            if (state.previewAudio) {
                state.previewAudio.pause();
                state.previewAudio = null;
            }

            state.previewAudio = new Audio(data.previewUrl);
            state.previewAudio.addEventListener('loadedmetadata', () => {
                elements.previewTimeTotal.textContent = formatTime(state.previewAudio.duration);
                drawWaveform();
            });

            state.previewAudio.addEventListener('timeupdate', updatePreviewProgress);
            state.previewAudio.addEventListener('ended', () => {
                state.isPreviewPlaying = false;
                elements.previewPlayBtn.classList.remove('playing');
            });

            // Show content
            elements.previewLoading.style.display = 'none';
            elements.previewContent.style.display = 'block';

        } catch (error) {
            console.error('[Preview] Error:', error);
            // Use textContent to prevent XSS - no innerHTML with user/error data
            if (elements.previewLoadingText) {
                elements.previewLoadingText.textContent = '⚠️ ' + (error.message || 'Failed to generate preview');
                elements.previewLoadingText.style.color = 'var(--destructive)';
            }
        } finally {
            state.isPreviewLoading = false;
        }
    };

    /**
     * Close preview player
     */
    const closePreview = () => {
        if (state.previewAudio) {
            state.previewAudio.pause();
            state.previewAudio = null;
        }
        state.isPreviewPlaying = false;
        state.previewVideoId = null;
        elements.previewPlayer.classList.remove('active');
        elements.previewPlayBtn.classList.remove('playing');

        // Reset loading text styles
        if (elements.previewLoadingText) {
            elements.previewLoadingText.style.color = '';
        }
    };

    /**
     * Toggle preview playback
     */
    const togglePreviewPlayback = () => {
        if (!state.previewAudio) return;

        if (state.isPreviewPlaying) {
            state.previewAudio.pause();
            state.isPreviewPlaying = false;
            elements.previewPlayBtn.classList.remove('playing');
        } else {
            state.previewAudio.play();
            state.isPreviewPlaying = true;
            elements.previewPlayBtn.classList.add('playing');
        }
    };

    /**
     * Seek in preview
     */
    const seekPreview = (e) => {
        if (!state.previewAudio) return;

        const rect = elements.previewProgressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        state.previewAudio.currentTime = percent * state.previewAudio.duration;
    };

    /**
     * Update preview progress UI
     */
    const updatePreviewProgress = () => {
        if (!state.previewAudio) return;

        const percent = (state.previewAudio.currentTime / state.previewAudio.duration) * 100;
        elements.previewProgressFill.style.width = `${percent}%`;
        elements.waveformProgress.style.width = `${percent}%`;
        elements.waveformPlayhead.style.left = `${percent}%`;
        elements.previewTimeCurrent.textContent = formatTime(state.previewAudio.currentTime);
    };

    /**
     * Draw waveform visualization (placeholder - actual would use Web Audio API)
     */
    const drawWaveform = () => {
        const canvas = elements.waveformCanvas;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;

        canvas.width = width * 2;
        canvas.height = height * 2;
        ctx.scale(2, 2);

        // Generate random waveform bars (placeholder)
        const barCount = Math.floor(width / 4);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';

        for (let i = 0; i < barCount; i++) {
            const barHeight = Math.random() * (height * 0.8) + height * 0.1;
            const x = i * 4;
            const y = (height - barHeight) / 2;
            ctx.fillRect(x, y, 2, barHeight);
        }
    };

    /**
     * Convert from preview
     */
    const convertFromPreview = () => {
        if (!state.previewVideoId) return;

        const url = `https://www.youtube.com/watch?v=${state.previewVideoId}`;
        const urlInput = document.getElementById('url-input');
        if (urlInput) {
            urlInput.value = url;
            // Trigger form submission
            document.getElementById('converter-form')?.dispatchEvent(new Event('submit'));
        }

        closePreview();
    };

    /**
     * Convert video directly (from popular videos)
     */
    const convertVideo = (video) => {
        const url = `https://www.youtube.com/watch?v=${video.videoId}`;
        const urlInput = document.getElementById('url-input');
        if (urlInput) {
            urlInput.value = url;
            document.getElementById('converter-form')?.dispatchEvent(new Event('submit'));
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

    // Public API
    return {
        init,
        reload,
        showPreview,
        closePreview
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FeaturesModule.init());
} else {
    FeaturesModule.init();
}
