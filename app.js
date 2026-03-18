/**
 * YT Converter - YouTube to MP3/MP4 Converter
 * Minimal ES6+ implementation with backend integration
 */

import { LyricsController } from './js/lyrics.js';
import { AnimationController } from './js/ui/animationController.js';
import { animationRegistry } from './js/ui/animationRegistry.js';
import { KaraokePanel } from './js/ui/karaokePanel.js';
import { ThemeController } from './js/ui/themeController.js';

// Configuration
const API_URL = '';

// DOM Elements
const elements = {
    form: document.getElementById('converter-form'),
    urlInput: document.getElementById('url-input'),
    pasteBtn: document.getElementById('paste-btn'),
    formatBtns: document.querySelectorAll('.format-btn'),
    convertBtn: document.getElementById('convert-btn'),
    btnText: document.querySelector('.btn-text'),
    btnLoader: document.querySelector('.btn-loader'),
    preview: document.getElementById('preview'),
    thumbnail: document.getElementById('thumbnail'),
    videoTitle: document.getElementById('video-title'),
    videoDuration: document.getElementById('video-duration'),
    progressSection: document.getElementById('progress-section'),
    progressFill: document.getElementById('progress-fill'),
    progressText: document.getElementById('progress-text'),
    downloadSection: document.getElementById('download-section'),
    downloadLink: document.getElementById('download-link'),
    errorSection: document.getElementById('error-section'),
    errorMessage: document.getElementById('error-message'),
    conversionAnimation: document.getElementById('conversion-animation'),
    nerdStats: document.getElementById('nerd-stats'),
    nerdStatsToggle: document.getElementById('nerd-stats-toggle'),
    nerdStatsGrid: document.getElementById('nerd-stats-grid'),
    statBitrate: document.getElementById('stat-bitrate'),
    statSampleRate: document.getElementById('stat-sample-rate'),
    statLufs: document.getElementById('stat-lufs'),
    statPeak: document.getElementById('stat-peak'),
    statDuration: document.getElementById('stat-duration'),
    statFilesize: document.getElementById('stat-filesize'),
    themeSwitcher: document.getElementById('theme-switcher'),
    karaokeCard: document.getElementById('karaoke-card'),
    karaokeTabs: document.querySelectorAll('.karaoke-tab'),
    karaokeView: document.getElementById('karaoke-view'),
    arcadeView: document.getElementById('arcade-view'),
    karaokeLines: document.getElementById('karaoke-lines'),
    karaokeStatusBadge: document.getElementById('karaoke-status-badge'),
    karaokeStatusTitle: document.getElementById('karaoke-status-title'),
    karaokeStatusDetail: document.getElementById('karaoke-status-detail'),
    arcadeLaunchButtons: document.querySelectorAll('[data-game-launch]')
};

// State
const state = {
    format: 'mp3',
    isLoading: false,
    isConverting: false,
    videoInfo: null,
    activeLyricsRequestId: 0,
};

const lyricsController = new LyricsController();
const animationController = new AnimationController(animationRegistry);
const themeController = new ThemeController({
    mount: elements.themeSwitcher,
    metaThemeColor: document.querySelector('meta[name="theme-color"]')
});
const karaokePanel = new KaraokePanel({
    root: elements.karaokeCard,
    tabs: elements.karaokeTabs,
    views: {
        karaoke: elements.karaokeView,
        arcade: elements.arcadeView
    },
    linesContainer: elements.karaokeLines,
    statusBadge: elements.karaokeStatusBadge,
    statusTitle: elements.karaokeStatusTitle,
    statusDetail: elements.karaokeStatusDetail,
    launchButtons: elements.arcadeLaunchButtons
});

// Module-level timers
let nerdStatsTimeout = null;
let statsIntervalId = null;

// YouTube URL regex patterns
const YT_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

try {
    themeController.init();
} catch (error) {
    console.error('themeController.init failed', error);
}

try {
    karaokePanel.init();
} catch (error) {
    console.error('karaokePanel.init failed', error);
}

lyricsController.on('loaded', ({ lyrics, requestId }) => {
    if (requestId !== state.activeLyricsRequestId) return;
    karaokePanel.setLyrics(lyrics);
});

lyricsController.on('start', ({ requestId }) => {
    if (requestId !== state.activeLyricsRequestId) return;
    karaokePanel.setStatus(
        'Live',
        'Lyrics are moving now.',
        'The current line will stay highlighted here while your file finishes preparing.',
        'live'
    );
});

lyricsController.on('linechange', ({ index, requestId }) => {
    if (requestId !== state.activeLyricsRequestId) return;
    karaokePanel.setActiveLine(index);
});

lyricsController.on('stop', ({ preserveLyrics, lyrics, requestId }) => {
    if (requestId !== null && requestId !== state.activeLyricsRequestId) return;
    if (preserveLyrics && Array.isArray(lyrics) && lyrics.length > 0) {
        karaokePanel.finishPlayback();
    }
});

lyricsController.on('empty', ({ requestId }) => {
    if (requestId !== state.activeLyricsRequestId) return;
    karaokePanel.setEmpty();
});

/**
 * Extract video ID from YouTube URL
 */
const extractVideoId = (url) => {
    const match = url.match(YT_REGEX);
    return match ? match[1] : null;
};

/**
 * Validate YouTube URL
 */
const isValidYoutubeUrl = (url) => YT_REGEX.test(url);

/**
 * Show error message
 */
const showError = (message) => {
    elements.errorMessage.textContent = message;
    elements.errorSection.classList.remove('hidden');

    setTimeout(() => {
        elements.errorSection.classList.add('hidden');
    }, 5000);
};

/**
 * Hide all result sections
 */
const hideResults = () => {
    elements.preview.classList.add('hidden');
    elements.preview.classList.remove('loading');
    elements.progressSection.classList.add('hidden');
    elements.downloadSection.classList.add('hidden');
    // Reset download animation classes
    elements.downloadSection.classList.remove('animating', 'complete', 'show-icon', 'show-content', 'show-button');
    elements.errorSection.classList.add('hidden');
    // Stop any running conversion animation
    animationController.stop(elements.conversionAnimation);

    lyricsController.stop({ preserveLyrics: false });
    state.isConverting = false;
    state.activeLyricsRequestId = 0;
    karaokePanel.setIdle();

    // Clear background timers
    if (nerdStatsTimeout) {
        clearTimeout(nerdStatsTimeout);
        nerdStatsTimeout = null;
    }
    if (statsIntervalId) {
        clearInterval(statsIntervalId);
        statsIntervalId = null;
    }

    // Reset nerd stats
    elements.nerdStats.classList.add('hidden');
    elements.nerdStatsToggle.setAttribute('aria-expanded', 'false');
    // We DO NOT hide game container here to allow playing across sessions
};

/**
 * Set loading state
 */
const setLoading = (loading) => {
    state.isLoading = loading;
    elements.convertBtn.disabled = loading;
    elements.urlInput.disabled = loading; // Disable input
    elements.pasteBtn.disabled = loading; // Disable paste
    elements.formatBtns.forEach(btn => btn.disabled = loading); // Disable format toggle

    elements.btnText.classList.toggle('hidden', loading);
    elements.btnLoader.classList.toggle('hidden', !loading);
};

/**
 * Update progress bar
 */
const updateProgress = (percent, text) => {
    elements.progressFill.style.width = `${percent}%`;
    elements.progressText.textContent = text;
};

/**
 * Nerd Stats formatting helpers
 */
const formatBitrate = (bps) => {
    if (!Number.isFinite(bps)) return 'N/A';
    const kbps = Math.round(bps / 1000);
    return `${kbps} kbps`;
};
const formatSampleRate = (hz) => {
    if (!Number.isFinite(hz)) return 'N/A';
    return `${(hz / 1000).toFixed(1)} kHz`;
};
const formatLufs = (lufs) => {
    if (!Number.isFinite(lufs)) return 'N/A';
    return `${lufs.toFixed(1)} LUFS`;
};
const formatPeak = (db) => {
    if (!Number.isFinite(db)) return 'N/A';
    return `${db.toFixed(1)} dBTP`;
};
const formatFileSize = (bytes) => {
    if (!Number.isFinite(bytes)) return 'N/A';
    return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${(bytes / 1e3).toFixed(0)} KB`;
};

const populateNerdStats = (stats) => {
    if (!stats) return;
    elements.statBitrate.textContent = formatBitrate(stats.bitrate);
    elements.statSampleRate.textContent = formatSampleRate(stats.sampleRate);
    elements.statLufs.textContent = formatLufs(stats.lufs);
    elements.statPeak.textContent = formatPeak(stats.peakDb);

    // Format duration nicely (e.g. 3:42)
    const d = stats.duration;
    if (Number.isFinite(d)) {
        const mins = Math.floor(d / 60);
        const secs = Math.floor(d % 60).toString().padStart(2, '0');
        elements.statDuration.textContent = `${mins}:${secs}`;
    } else {
        elements.statDuration.textContent = 'N/A';
    }

    elements.statFilesize.textContent = formatFileSize(stats.fileSize);
};

/**
 * Fetch video info from backend
 */
const fetchVideoInfo = async (videoId) => {
    try {
        const response = await fetch(`${API_URL}/api/info?videoId=${videoId}`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Video not found');
        }

        return await response.json();
    } catch (error) {
        // Fallback to oEmbed if backend is unavailable
        console.warn('Backend unavailable, using oEmbed fallback');
        const response = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        );

        if (!response.ok) throw new Error('Video not found');

        const data = await response.json();
        return {
            id: videoId,
            title: data.title,
            thumbnail: data.thumbnail_url,
            author: data.author_name,
            duration: null,
        };
    }
};

/**
 * Convert video via backend
 */
const convertVideo = async (videoId, format, title) => {
    updateProgress(10, 'Starting conversion...');

    try {
        const response = await fetch(`${API_URL}/api/convert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId, format, title }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Conversion failed');
        }

        // Poll for progress
        const { taskId } = await response.json();
        return await pollProgress(taskId);

    } catch (error) {
        if (error.message.includes('fetch')) {
            throw new Error('Backend server not running. Start with: npm start');
        }
        throw error;
    }
};

/**
 * Poll conversion progress
 */
const pollProgress = async (taskId) => {
    const maxAttempts = 600; // 10 minutes max (at 1s interval)
    let attempts = 0;

    while (attempts < maxAttempts) {
        const response = await fetch(`${API_URL}/api/progress/${taskId}`);
        const data = await response.json();

        updateProgress(data.progress, data.status);

        if (data.state === 'completed') {
            // Populate stats if present
            if (data.audioStats) {
                populateNerdStats(data.audioStats);
            } else {
                // Fire a background poll loop to get stats after UI is unblocked
                if (statsIntervalId) clearInterval(statsIntervalId);
                let statsAttempts = 0;
                statsIntervalId = setInterval(async () => {
                    if (statsAttempts > 10) { clearInterval(statsIntervalId); statsIntervalId = null; return; }
                    try {
                        const r = await fetch(`${API_URL}/api/progress/${taskId}`);
                        const d = await r.json();
                        if (d.audioStats) {
                            populateNerdStats(d.audioStats);
                            clearInterval(statsIntervalId);
                            statsIntervalId = null;
                        }
                    } catch (e) {
                        console.debug("background polling error", e);
                    }
                    statsAttempts++;
                }, 1000);
            }

            // Ensure download URL is absolute if it starts with /
            const url = data.downloadUrl.startsWith('/')
                ? `${API_URL}${data.downloadUrl}`
                : data.downloadUrl;

            return {
                url,
                filename: data.filename
            };
        }

        if (data.state === 'error') {
            throw new Error(data.error || 'Conversion failed');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
    }

    throw new Error('Conversion timed out');
};

/**
 * Handle format button click
 */
const handleFormatChange = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const btn = e.currentTarget;
    const format = btn.dataset.format;

    if (!format) return; // Only guard against missing data

    state.format = format;

    // Update UI - Always force update to ensure sync
    elements.formatBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.format === format);
    });

    console.log('Format changed to:', state.format);
};

/**
 * Handle paste button click
 */
const handlePaste = async (e) => {
    e.preventDefault();
    try {
        const text = await navigator.clipboard.readText();
        elements.urlInput.value = text;
        elements.urlInput.focus();
    } catch (error) {
        showError('Could not access clipboard');
    }
};

/**
 * Handle form submission
 */
const handleSubmit = async (e) => {
    e.preventDefault();

    if (state.isLoading) return;

    const url = elements.urlInput.value.trim();

    if (!url) {
        showError('Please enter a YouTube URL');
        return;
    }

    if (!isValidYoutubeUrl(url)) {
        showError('Please enter a valid YouTube URL');
        return;
    }

    const videoId = extractVideoId(url);

    if (!videoId) {
        showError('Could not extract video ID');
        return;
    }

    // Check if batch mode is enabled
    if (window.batchDownloads && window.batchDownloads.isEnabled()) {
        // Batch mode: fetch info and add to batch
        setLoading(true);

        try {
            const videoInfo = await fetchVideoInfo(videoId);
            const added = window.batchDownloads.add(
                videoId,
                state.format,
                videoInfo.title,
                url,
                {
                    thumbnail: videoInfo.thumbnail,
                    artist: videoInfo.author,
                    duration: videoInfo.duration,
                    isLive: videoInfo.duration === 'LIVE'
                }
            );

            if (added) {
                // Clear input for next URL
                elements.urlInput.value = '';
                elements.urlInput.focus();
            }
        } catch (error) {
            showError(error.message || 'Could not fetch video info');
        } finally {
            setLoading(false);
        }
        return;
    }

    // Single video mode: original behavior
    hideResults();
    setLoading(true);
    state.isConverting = true;
    karaokePanel.setLoading();

    // Show progress section with fun animation immediately
    elements.progressSection.classList.remove('hidden');
    animationController.start('conversionProgress', elements.conversionAnimation);
    updateProgress(0, 'Fetching video info...');

    // START THE GAME!
    showGame();

    try {
        // Fetch video info
        const videoInfo = await fetchVideoInfo(videoId);
        state.videoInfo = videoInfo;

        // Now show preview with data (no skeleton needed — data is ready)
        elements.thumbnail.src = videoInfo.thumbnail;
        elements.videoTitle.textContent = videoInfo.title;

        // Safely format duration and author to avoid "By undefined"
        if (videoInfo.duration && videoInfo.author) {
            elements.videoDuration.textContent = `${videoInfo.duration} • ${videoInfo.author}`;
        } else if (videoInfo.duration) {
            elements.videoDuration.textContent = videoInfo.duration;
        } else if (videoInfo.author) {
            elements.videoDuration.textContent = `By ${videoInfo.author}`;
        } else {
            elements.videoDuration.textContent = 'Unknown';
        }
        elements.preview.classList.remove('hidden', 'loading');

        // Check for subtitles and start karaoke
        if (videoInfo.subtitles && videoInfo.subtitles.length > 0) {
            fetchLyricsAndStartKaraoke(videoInfo.subtitles);
        } else {
            karaokePanel.setEmpty();
        }

        // Convert video
        const { url: downloadUrl } = await convertVideo(videoId, state.format, videoInfo.title);

        // Stop conversion animation and hide progress
        animationController.stop(elements.conversionAnimation);
        elements.progressSection.classList.add('hidden');
        state.isConverting = false;
        lyricsController.finishPlayback();
        elements.downloadLink.href = downloadUrl;

        // Start orchestrated download animation
        await showDownloadAnimation();

    } catch (error) {
        hideResults();
        showError(error.message || 'An error occurred');
    } finally {
        state.isConverting = false;
        setLoading(false);
    }
};

/**
 * Handle karaoke lyrics fetch & start
 */
const fetchLyricsAndStartKaraoke = async (subtitles) => {
    const requestId = Date.now() + Math.random();
    state.activeLyricsRequestId = requestId;
    karaokePanel.setLoading();

    try {
        const loaded = await lyricsController.loadSubtitles(subtitles, { requestId });

        if (requestId !== state.activeLyricsRequestId) {
            return;
        }

        if (loaded && state.isConverting) {
            lyricsController.start();
        } else if (loaded) {
            lyricsController.finishPlayback();
        } else if (!loaded) {
            karaokePanel.setEmpty();
        }
    } catch (e) {
        console.warn('Silent fail for lyrics', e);
        if (requestId !== state.activeLyricsRequestId) {
            return;
        }
        karaokePanel.setEmpty();
    }
};

/**
 * Orchestrated download section animation
 * 1. Show section & animate border filling left-to-right (2.5s)
 * 2. Pop in checkmark with draw animation
 * 3. Fade in "Ready to download!" text
 * 4. Pop in download button
 */
const showDownloadAnimation = () => {
    return new Promise((resolve) => {
        const section = elements.downloadSection;

        // Reset all classes first
        section.classList.remove('animating', 'complete', 'show-icon', 'show-content', 'show-button');
        section.classList.remove('hidden');

        // Force browser to register the initial state, then trigger animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Step 1: Start border sweep animation (2.5s)
                section.classList.add('animating');

                // Step 2: After border fully fills (2.5s), complete and show icon
                setTimeout(() => {
                    section.classList.remove('animating');
                    section.classList.add('complete', 'show-icon');
                }, 2500);

                // Step 3: After icon appears (400ms after step 2), show content
                setTimeout(() => {
                    section.classList.add('show-content');
                }, 2900);

                // Step 4: After content (300ms after step 3), show download button
                setTimeout(() => {
                    section.classList.add('show-button');
                    resolve();
                }, 3200);

                // Step 5: Show nerd stats toggle bar
                if (nerdStatsTimeout) {
                    clearTimeout(nerdStatsTimeout);
                }
                nerdStatsTimeout = setTimeout(() => {
                    elements.nerdStats.classList.remove('hidden');
                    nerdStatsTimeout = null;
                }, 3500);
            });
        });
    });
};

/**
 * Handle URL input change
 */
const handleUrlInput = () => {
    const url = elements.urlInput.value.trim();

    if (state.videoInfo && !url.includes(state.videoInfo.id)) {
        hideResults();
        state.videoInfo = null;
    }
};

/**
 * ========================================
 * SNAKE GAME (Modular Version)
 * ========================================
 */
const gameElements = {
    container: document.getElementById('game-container'),
    canvas: document.getElementById('game-canvas'),
    score: document.getElementById('score'),
    restartBtn: document.getElementById('restart-btn'),
    highScoresList: document.getElementById('high-scores-list'),
    snakeLength: document.getElementById('snake-length'),
    comboDisplay: document.getElementById('combo-display'),
    comboCount: document.getElementById('combo-count'),
    powerupIndicator: document.getElementById('powerup-indicator'),
    powerupIcon: document.getElementById('powerup-icon'),
    powerupTimer: document.getElementById('powerup-timer'),
    splitIndicator: document.getElementById('split-indicator'),
    splitSnakeNum: document.getElementById('split-snake-num')
};

const gtElements = {
    container: document.getElementById('guess-track-container'),
    scoreDisplay: document.getElementById('gt-score'),
    livesDisplay: document.getElementById('gt-lives-count'),
    streakDisplay: document.getElementById('gt-streak-count'),
    streakMeterFill: document.getElementById('gt-streak-meter-fill'),
    timerBarContainer: document.getElementById('gt-timer-bar-container'),
    timerBar: document.getElementById('gt-timer-bar'),
    visualizer: document.getElementById('gt-audio-visualizer'),
    statusBadge: document.getElementById('gt-status-badge'),
    statusText: document.getElementById('gt-status-text'),
    statusDetail: document.getElementById('gt-status-detail'),
    feedbackLayer: document.getElementById('gt-feedback-layer'),
    options: document.querySelectorAll('.gt-option'),
    startBtn: document.getElementById('gt-start-btn')
};

// Initialize the Mini Games
let snakeGame = null;
let guessTrackGame = null;
let activeMiniGame = 'snake';
const allowedGames = new Set(['snake', 'guesstrack']);

const syncMiniGameControls = () => {
    document.querySelectorAll('.mini-game-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.game === activeMiniGame);
    });
    karaokePanel.setActiveGame(activeMiniGame);
};

const showGame = () => {
    if (activeMiniGame === 'snake') {
        if (!snakeGame) {
            snakeGame = new SnakeGame(gameElements);
        }
        if (guessTrackGame) guessTrackGame.hide();
        snakeGame.show();
    } else {
        if (!guessTrackGame) {
            guessTrackGame = new GuessTrackGame(gtElements);
        }
        if (snakeGame) snakeGame.hide();
        guessTrackGame.show();
    }
};

const launchMiniGame = (gameId) => {
    if (!gameId || !allowedGames.has(gameId)) {
        return;
    }

    activeMiniGame = gameId;
    syncMiniGameControls();
    showGame();
};

karaokePanel.setOnLaunchGame(launchMiniGame);
syncMiniGameControls();

// Mini-game toggles
document.querySelectorAll('.mini-game-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const nextGame = e.currentTarget?.dataset?.game;
        launchMiniGame(nextGame);
    });
});

// Game panel minimize toggle
const gameMinimizeBtn = document.getElementById('game-minimize');
if (gameMinimizeBtn) {
    gameMinimizeBtn.addEventListener('click', () => {
        gameElements.container.classList.toggle('minimized');
    });
}
const gtMinimizeBtn = document.getElementById('gt-minimize');
if (gtMinimizeBtn) {
    gtMinimizeBtn.addEventListener('click', () => {
        gtElements.container.classList.toggle('minimized');
    });
}

// Event Listeners
elements.form.addEventListener('submit', handleSubmit);
elements.pasteBtn.addEventListener('click', handlePaste);
elements.urlInput.addEventListener('input', handleUrlInput);
if (elements.nerdStatsToggle) {
    elements.nerdStatsToggle.addEventListener('click', () => {
        const isExpanded = elements.nerdStatsToggle.getAttribute('aria-expanded') === 'true';
        elements.nerdStatsToggle.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
    });
}

// Fix: Use explicit click handlers for format buttons, Removed mousedown preventDefault to fix click issues
elements.formatBtns.forEach(btn => {
    btn.addEventListener('click', handleFormatChange);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && document.activeElement !== elements.urlInput) {
        elements.urlInput.focus();
    }
});

// Initialize
elements.urlInput.focus();
console.log('YT Converter initialized. Current format:', state.format);
