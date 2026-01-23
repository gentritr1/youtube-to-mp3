/**
 * YT Converter - YouTube to MP3/MP4 Converter
 * Minimal ES6+ implementation with backend integration
 */

// Configuration
const API_URL = 'http://localhost:3000';

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
};

// State
const state = {
    format: 'mp3',
    isLoading: false,
    videoInfo: null,
};

// YouTube URL regex patterns
const YT_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

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
    elements.progressSection.classList.add('hidden');
    elements.downloadSection.classList.add('hidden');
    elements.errorSection.classList.add('hidden');
    // We DO NOT hide game container here to allow playing across sessions
};

/**
 * Set loading state
 */
const setLoading = (loading) => {
    state.isLoading = loading;
    elements.convertBtn.disabled = loading;
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
    elements.progressSection.classList.remove('hidden');
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
    const maxAttempts = 120; // 2 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
        const response = await fetch(`${API_URL}/api/progress/${taskId}`);
        const data = await response.json();

        updateProgress(data.progress, data.status);

        if (data.state === 'completed') {
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

    if (!format || format === state.format) return;

    state.format = format;

    // Update UI
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

    hideResults();
    setLoading(true);

    // START THE GAME!
    showGame();

    try {
        // Fetch video info
        const videoInfo = await fetchVideoInfo(videoId);
        state.videoInfo = videoInfo;

        // Show preview
        elements.thumbnail.src = videoInfo.thumbnail;
        elements.videoTitle.textContent = videoInfo.title;
        elements.videoDuration.textContent = videoInfo.duration
            ? `${videoInfo.duration} • ${videoInfo.author}`
            : `By ${videoInfo.author}`;
        elements.preview.classList.remove('hidden');

        // Convert video
        const { url: downloadUrl, filename } = await convertVideo(videoId, state.format, videoInfo.title);

        // Show download section
        elements.progressSection.classList.add('hidden');
        elements.downloadLink.href = downloadUrl;
        elements.downloadSection.classList.remove('hidden');

    } catch (error) {
        hideResults();
        showError(error.message || 'An error occurred');
    } finally {
        setLoading(false);
    }
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
 * SNAKE GAME LOGIC
 * ========================================
 */
const gameElements = {
    container: document.getElementById('game-container'),
    canvas: document.getElementById('game-canvas'),
    ctx: document.getElementById('game-canvas').getContext('2d'),
    score: document.getElementById('score'),
    restartBtn: document.getElementById('restart-btn'),
    highScoresList: document.getElementById('high-scores-list')
};

const gameConfig = {
    tileSize: 16,
    speed: 100,
    colors: {
        snake: '#ffffff',
        food: '#10b981',
        head: '#a1a1aa'
    }
};

let gameLoop = null;
let snake = [];
let food = { x: 0, y: 0 };
let velocity = { x: 0, y: 0 };
let score = 0;
let isGameRunning = false;

// Load High Scores
const getHighScores = () => {
    const scores = localStorage.getItem('snakeHighScores');
    return scores ? JSON.parse(scores) : [];
};

const saveHighScore = (score) => {
    const scores = getHighScores();
    scores.push({
        score,
        date: new Date().toLocaleDateString()
    });

    // Sort descending and keep top 5
    scores.sort((a, b) => b.score - a.score);
    const topScores = scores.slice(0, 5);

    localStorage.setItem('snakeHighScores', JSON.stringify(topScores));
    displayHighScores();
};

const displayHighScores = () => {
    const scores = getHighScores();
    gameElements.highScoresList.innerHTML = scores.length
        ? scores.map((s, i) => `
            <li>
                <span>#${i + 1}</span>
                <span>${s.score}</span>
            </li>
        `).join('')
        : '<li><span style="width:100%;text-align:center">No scores yet</span></li>';
};

// Initialize specific game state
const initGame = () => {
    const startX = 10;
    const startY = 10;
    snake = [
        { x: startX, y: startY },
        { x: startX - 1, y: startY },
        { x: startX - 2, y: startY }
    ];

    velocity = { x: 1, y: 0 };
    score = 0;
    gameElements.score.textContent = score;
    gameElements.restartBtn.classList.add('hidden');

    spawnFood();
    isGameRunning = true;
    displayHighScores();

    if (gameElements.ctx) {
        gameElements.container.classList.remove('hidden');
        if (gameLoop) clearInterval(gameLoop);
        gameLoop = setInterval(updateGame, gameConfig.speed);
    }
};

const spawnFood = () => {
    const tileCount = gameElements.canvas.width / gameConfig.tileSize;
    food.x = Math.floor(Math.random() * tileCount);
    food.y = Math.floor(Math.random() * tileCount);

    for (let part of snake) {
        if (part.x === food.x && part.y === food.y) {
            spawnFood();
            break;
        }
    }
};

const updateGame = () => {
    if (!isGameRunning) return;

    const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };
    const tileCount = gameElements.canvas.width / gameConfig.tileSize;

    // Wall Collision (Wrap around)
    if (head.x < 0) head.x = tileCount - 1;
    if (head.x >= tileCount) head.x = 0;
    if (head.y < 0) head.y = tileCount - 1;
    if (head.y >= tileCount) head.y = 0;

    // Self Collision
    for (let part of snake) {
        if (head.x === part.x && head.y === part.y) {
            gameOver();
            return;
        }
    }

    snake.unshift(head);

    // Food Collision
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        gameElements.score.textContent = score;
        spawnFood();
    } else {
        snake.pop();
    }

    drawGame();
};

const drawGame = () => {
    // Clear Screen
    gameElements.ctx.fillStyle = 'rgba(10, 10, 12, 0.8)';
    gameElements.ctx.fillRect(0, 0, gameElements.canvas.width, gameElements.canvas.height);

    // Draw Snake
    snake.forEach((part, index) => {
        gameElements.ctx.fillStyle = index === 0 ? gameConfig.colors.head : gameConfig.colors.snake;
        gameElements.ctx.fillRect(
            part.x * gameConfig.tileSize,
            part.y * gameConfig.tileSize,
            gameConfig.tileSize - 2,
            gameConfig.tileSize - 2
        );
    });

    // Draw Food
    gameElements.ctx.fillStyle = gameConfig.colors.food;
    gameElements.ctx.beginPath();
    const centerX = (food.x * gameConfig.tileSize) + (gameConfig.tileSize / 2);
    const centerY = (food.y * gameConfig.tileSize) + (gameConfig.tileSize / 2);
    gameElements.ctx.arc(centerX, centerY, (gameConfig.tileSize / 2) - 2, 0, 2 * Math.PI);
    gameElements.ctx.fill();
};

const gameOver = () => {
    isGameRunning = false;
    clearInterval(gameLoop);
    saveHighScore(score);
    gameElements.restartBtn.classList.remove('hidden');

    // Draw "Game Over"
    gameElements.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    gameElements.ctx.fillRect(0, 0, gameElements.canvas.width, gameElements.canvas.height);
    gameElements.ctx.fillStyle = '#fff';
    gameElements.ctx.font = '24px Inter';
    gameElements.ctx.textAlign = 'center';
    gameElements.ctx.fillText('Game Over', gameElements.canvas.width / 2, gameElements.canvas.height / 2);
};

// Start waiting for user to play
const showGame = () => {
    gameElements.container.classList.remove('hidden');
    displayHighScores();
    if (!isGameRunning) {
        initGame();
    }
};

// Game Controls
document.addEventListener('keydown', (e) => {
    if (!isGameRunning) return;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
    }

    switch (e.key) {
        case 'ArrowUp':
            if (velocity.y !== 1) velocity = { x: 0, y: -1 };
            break;
        case 'ArrowDown':
            if (velocity.y !== -1) velocity = { x: 0, y: 1 };
            break;
        case 'ArrowLeft':
            if (velocity.x !== 1) velocity = { x: -1, y: 0 };
            break;
        case 'ArrowRight':
            if (velocity.x !== -1) velocity = { x: 1, y: 0 };
            break;
    }
});

// Event Listeners
elements.form.addEventListener('submit', handleSubmit);
elements.pasteBtn.addEventListener('click', handlePaste);
elements.urlInput.addEventListener('input', handleUrlInput);
gameElements.restartBtn.addEventListener('click', initGame);

// Fix: Use explicit click handlers for format buttons
elements.formatBtns.forEach(btn => {
    btn.addEventListener('click', handleFormatChange);
    btn.addEventListener('mousedown', (e) => e.preventDefault()); // Prevent focus issues
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
