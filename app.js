/**
 * YT Converter - YouTube to MP3/MP4 Converter
 * Minimal ES6+ implementation with backend integration
 */

import { AnimationController } from './js/ui/animationController.js';
import { animationRegistry } from './js/ui/animationRegistry.js';
import { ThemeController } from './js/ui/themeController.js';
import { FeaturesModule, setOnConvertRequest, setAudioVisualizer } from './js/features.js';
import { batchDownloads, setApiBaseUrl, setPreviewCallback } from './js/batch.js';
import { SnakeGame } from './js/game/index.js';
import { GuessTrackGame, setTrackProvider } from './js/guess-track.js';
import { AudioVisualizer } from './js/visualizer.js';

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
    statBitrate: document.getElementById('stat-bitrate'),
    statSampleRate: document.getElementById('stat-sample-rate'),
    statLufs: document.getElementById('stat-lufs'),
    statPeak: document.getElementById('stat-peak'),
    statDuration: document.getElementById('stat-duration'),
    statFilesize: document.getElementById('stat-filesize'),
    themeSwitcher: document.getElementById('theme-switcher'),
    karaokeTabs: document.querySelectorAll('.karaoke-tab'),
    karaokeStatusBadge: document.getElementById('karaoke-status-badge'),
    karaokeStatusTitle: document.getElementById('karaoke-status-title'),
    karaokeStatusDetail: document.getElementById('karaoke-status-detail'),
    studioView: document.getElementById('studio-view'),
    arcadeView: document.getElementById('arcade-view'),
    arcadeLaunchButtons: document.querySelectorAll('[data-game-launch]')
};

// State
const state = {
    format: 'mp3',
    isLoading: false,
    videoInfo: null
};

const animationController = new AnimationController(animationRegistry);
const themeController = new ThemeController({
    mount: elements.themeSwitcher,
    metaThemeColor: document.querySelector('meta[name="theme-color"]')
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

themeController.subscribe(() => {
    snakeGame?.syncTheme();
    FeaturesModule.redrawWaveform();
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
    elements.downloadSection.classList.remove('animating', 'complete', 'show-icon', 'show-content', 'show-button');
    elements.errorSection.classList.add('hidden');
    animationController.stop(elements.conversionAnimation);

    if (nerdStatsTimeout) {
        clearTimeout(nerdStatsTimeout);
        nerdStatsTimeout = null;
    }
    if (statsIntervalId) {
        clearInterval(statsIntervalId);
        statsIntervalId = null;
    }

    elements.nerdStats.classList.add('hidden');
    elements.nerdStatsToggle.setAttribute('aria-expanded', 'false');
};

/**
 * Set loading state
 */
const setLoading = (loading) => {
    state.isLoading = loading;
    elements.convertBtn.disabled = loading;
    elements.urlInput.disabled = loading;
    elements.pasteBtn.disabled = loading;
    elements.formatBtns.forEach((btn) => {
        btn.disabled = loading;
    });

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
 * Audio details formatting helpers
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

    const duration = stats.duration;
    if (Number.isFinite(duration)) {
        const mins = Math.floor(duration / 60);
        const secs = Math.floor(duration % 60).toString().padStart(2, '0');
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
            duration: null
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
            body: JSON.stringify({ videoId, format, title })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Conversion failed');
        }

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
    const maxAttempts = 600;
    let attempts = 0;

    while (attempts < maxAttempts) {
        const response = await fetch(`${API_URL}/api/progress/${taskId}`);
        const data = await response.json();

        updateProgress(data.progress, data.status);

        if (data.state === 'completed') {
            if (data.audioStats) {
                populateNerdStats(data.audioStats);
            } else {
                if (statsIntervalId) clearInterval(statsIntervalId);
                let statsAttempts = 0;
                statsIntervalId = setInterval(async () => {
                    if (statsAttempts > 10) {
                        clearInterval(statsIntervalId);
                        statsIntervalId = null;
                        return;
                    }

                    try {
                        const progressResponse = await fetch(`${API_URL}/api/progress/${taskId}`);
                        const progressData = await progressResponse.json();
                        if (progressData.audioStats) {
                            populateNerdStats(progressData.audioStats);
                            clearInterval(statsIntervalId);
                            statsIntervalId = null;
                        }
                    } catch (backgroundError) {
                        console.debug('background polling error', backgroundError);
                    }

                    statsAttempts += 1;
                }, 1000);
            }

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

        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts += 1;
    }

    throw new Error('Conversion timed out');
};

/**
 * Handle format button click
 */
const handleFormatChange = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    const format = button.dataset.format;
    if (!format) return;

    state.format = format;
    elements.formatBtns.forEach((btn) => {
        const isActive = btn.dataset.format === format;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
};

/**
 * Handle paste button click
 */
const handlePaste = async (event) => {
    event.preventDefault();
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
const handleSubmit = async (event) => {
    event.preventDefault();

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

    if (batchDownloads.isEnabled()) {
        setLoading(true);

        try {
            const videoInfo = await fetchVideoInfo(videoId);
            const added = batchDownloads.add(
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

    hideResults();
    setLoading(true);

    elements.progressSection.classList.remove('hidden');
    animationController.start('conversionProgress', elements.conversionAnimation);
    updateProgress(0, 'Fetching video info...');

    try {
        const videoInfo = await fetchVideoInfo(videoId);
        state.videoInfo = videoInfo;

        elements.thumbnail.src = videoInfo.thumbnail;
        elements.videoTitle.textContent = videoInfo.title;

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

        const { url: downloadUrl } = await convertVideo(videoId, state.format, videoInfo.title);

        animationController.stop(elements.conversionAnimation);
        elements.progressSection.classList.add('hidden');
        elements.downloadLink.href = downloadUrl;

        await showDownloadAnimation();
    } catch (error) {
        hideResults();
        showError(error.message || 'An error occurred');
    } finally {
        setLoading(false);
    }
};

/**
 * Show completion state without delaying the download action
 */
const showDownloadAnimation = () => {
    const section = elements.downloadSection;

    section.classList.remove('animating', 'complete', 'show-icon', 'show-content', 'show-button');
    section.classList.remove('hidden');

    requestAnimationFrame(() => {
        section.classList.add('complete', 'show-icon', 'show-content', 'show-button');
    });

    if (nerdStatsTimeout) {
        clearTimeout(nerdStatsTimeout);
    }
    nerdStatsTimeout = setTimeout(() => {
        elements.nerdStats.classList.remove('hidden');
        nerdStatsTimeout = null;
    }, 500);

    return Promise.resolve();
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

let snakeGame = null;
let guessTrackGame = null;
let activeMiniGame = 'snake';
let sidecarMode = 'studio';
const allowedGames = new Set(['snake', 'guesstrack']);

const setSidecarMode = (mode) => {
    sidecarMode = mode === 'arcade' ? 'arcade' : 'studio';

    elements.karaokeTabs.forEach((tab) => {
        const isActive = tab.dataset.panelMode === sidecarMode;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    elements.studioView?.classList.toggle('hidden', sidecarMode !== 'studio');
    elements.arcadeView?.classList.toggle('hidden', sidecarMode !== 'arcade');

    if (sidecarMode === 'arcade') {
        if (elements.karaokeStatusBadge) {
            elements.karaokeStatusBadge.textContent = 'Arcade';
            elements.karaokeStatusBadge.dataset.tone = 'ready';
        }
        if (elements.karaokeStatusTitle) {
            elements.karaokeStatusTitle.textContent = 'Mini games are available here.';
        }
        if (elements.karaokeStatusDetail) {
            elements.karaokeStatusDetail.textContent = 'Launch Snake or Guess the Track only when you want a game.';
        }
        return;
    }

    if (elements.karaokeStatusBadge) {
        elements.karaokeStatusBadge.textContent = 'Studio';
        elements.karaokeStatusBadge.dataset.tone = 'ready';
    }
    if (elements.karaokeStatusTitle) {
        elements.karaokeStatusTitle.textContent = 'Open Time Sync Studio separately.';
    }
    if (elements.karaokeStatusDetail) {
        elements.karaokeStatusDetail.textContent = 'Use the converter here, or open the studio for detailed lyric timing.';
    }
};

const syncMiniGameControls = () => {
    document.querySelectorAll('.mini-game-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.game === activeMiniGame);
    });
    elements.arcadeLaunchButtons.forEach((button) => {
        const isActive = button.dataset.gameLaunch === activeMiniGame;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
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
    setSidecarMode('arcade');
    syncMiniGameControls();
    showGame();
};

syncMiniGameControls();
setSidecarMode(sidecarMode);

document.querySelectorAll('.mini-game-btn').forEach((btn) => {
    btn.addEventListener('click', (event) => {
        const nextGame = event.currentTarget?.dataset?.game;
        launchMiniGame(nextGame);
    });
});

elements.karaokeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
        setSidecarMode(tab.dataset.panelMode);
    });
});

elements.arcadeLaunchButtons.forEach((button) => {
    button.addEventListener('click', () => {
        launchMiniGame(button.dataset.gameLaunch);
    });
});

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

elements.formatBtns.forEach((btn) => {
    btn.addEventListener('click', handleFormatChange);
});

document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'v' && document.activeElement !== elements.urlInput) {
        elements.urlInput.focus();
    }
});

// Initialize
elements.urlInput.focus();
console.log('YT Converter initialized. Current format:', state.format);

// ── Module wiring (Phase 1: split-aware dependency injection) ──

// Wire convert handoff: features.js calls this instead of synthetic event dispatch
setOnConvertRequest((url) => {
    elements.urlInput.value = url;
    if (typeof elements.form.requestSubmit === 'function') {
        elements.form.requestSubmit();
        return;
    }

    void handleSubmit({ preventDefault: () => {} });
});

// Wire visualizer into features.js
setAudioVisualizer(AudioVisualizer);

// Wire preview callback into batch.js (instead of batch importing features directly)
setPreviewCallback((previewData) => FeaturesModule.showPreview(previewData));
setApiBaseUrl(API_URL);

// Wire track provider into guess-track.js (instead of bare FeaturesModule global)
setTrackProvider((count) => FeaturesModule.getRandomTracks(count));

// Initialize modules that were previously self-initializing via DOMContentLoaded
FeaturesModule.init();
batchDownloads.init();
