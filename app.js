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
 * SNAKE GAME LOGIC (Canvas + 60FPS Interpolation)
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
    tickRate: 80, // Logic updates every 80ms (faster gameplay)
    colors: {
        snake: '#ffffff',
        snakeHead: '#ffffff',
        food: '#10b981', // Emerald 500
        bg: 'rgba(10, 10, 12, 0.8)',
        particles: ['#10b981', '#34d399', '#6ee7b7'] // Green shades
    }
};

// Game State
let lastTime = 0;
let timeAccumulator = 0;
let animationFrameId = null;

let snake = [];
let prevSnake = []; // For interpolation
let food = { x: 0, y: 0 };
let particles = []; // Explosion particles

// Movement
let velocity = { x: 0, y: 0 };
let nextVelocity = { x: 0, y: 0 }; // Buffer for next input
let isGameRunning = false;
let score = 0;

// Load High Scores
const getHighScores = () => {
    try {
        const scores = localStorage.getItem('snakeHighScores');
        return scores ? JSON.parse(scores) : [];
    } catch (e) { return []; }
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

// --- Particle System ---
const createParticles = (x, y) => {
    const headerX = (x * gameConfig.tileSize) + (gameConfig.tileSize / 2);
    const headerY = (y * gameConfig.tileSize) + (gameConfig.tileSize / 2);

    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1;
        particles.push({
            x: headerX,
            y: headerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: gameConfig.colors.particles[Math.floor(Math.random() * gameConfig.colors.particles.length)]
        });
    }
};

const updateParticles = () => {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) particles.splice(i, 1);
    }
};

const drawParticles = (ctx) => {
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });
};

// --- Game Loop ---

const initGame = () => {
    const startX = 10;
    const startY = 10;

    // Initial state
    snake = [
        { x: startX, y: startY },
        { x: startX - 1, y: startY },
        { x: startX - 2, y: startY }
    ];
    // Clone for interpolation
    prevSnake = JSON.parse(JSON.stringify(snake));

    velocity = { x: 1, y: 0 };
    nextVelocity = { x: 1, y: 0 };

    score = 0;
    particles = [];
    gameElements.score.textContent = score;
    gameElements.restartBtn.classList.add('hidden');

    spawnFood();

    isGameRunning = true;
    lastTime = performance.now();
    timeAccumulator = 0;

    displayHighScores();
    gameElements.container.classList.remove('hidden');

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    requestAnimationFrame(gameLoop);
};

const gameLoop = (timestamp) => {
    if (!isGameRunning) return;

    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    timeAccumulator += deltaTime;

    // Logic Update (Fixed Time Step)
    while (timeAccumulator >= gameConfig.tickRate) {
        updateGameLogic();
        timeAccumulator -= gameConfig.tickRate;
    }

    // Render Update (Interpolated)
    const interpolationAlpha = timeAccumulator / gameConfig.tickRate;
    drawGame(interpolationAlpha);
    updateParticles(); // Update effects every frame

    animationFrameId = requestAnimationFrame(gameLoop);
};

const spawnFood = () => {
    const tileCount = gameElements.canvas.width / gameConfig.tileSize;
    let valid = false;

    while (!valid) {
        food.x = Math.floor(Math.random() * tileCount);
        food.y = Math.floor(Math.random() * tileCount);

        valid = !snake.some(part => part.x === food.x && part.y === food.y);
    }
};

const updateGameLogic = () => {
    // Save current state as previous for interpolation
    prevSnake = JSON.parse(JSON.stringify(snake));

    // Apply buffered input
    velocity = { ...nextVelocity };

    const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };
    const tileCount = gameElements.canvas.width / gameConfig.tileSize;

    // Wall Collision (Wrap)
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
        createParticles(food.x, food.y); // Boom!
        spawnFood();
    } else {
        snake.pop();
    }
};

const drawGame = (alpha) => {
    const ctx = gameElements.ctx;
    const ts = gameConfig.tileSize;

    // Clear with semi-transparent black for trails? No, clean clear is better for clarity
    ctx.fillStyle = gameConfig.colors.bg;
    ctx.fillRect(0, 0, gameElements.canvas.width, gameElements.canvas.height);

    // Draw Particles
    drawParticles(ctx);

    // Draw Food (Pulse effect)
    const time = Date.now() / 200;
    const pulse = Math.sin(time) * 2;

    ctx.shadowBlur = 15;
    ctx.shadowColor = gameConfig.colors.food;
    ctx.fillStyle = gameConfig.colors.food;

    ctx.beginPath();
    const fx = (food.x * ts) + (ts / 2);
    const fy = (food.y * ts) + (ts / 2);
    ctx.arc(fx, fy, (ts / 2) - 2 + (pulse * 0.5), 0, Math.PI * 2);
    ctx.fill();

    // Reset Shadow
    ctx.shadowBlur = 0;

    // Draw Snake
    snake.forEach((part, i) => {
        // Interpolation logic
        let drawX = part.x * ts;
        let drawY = part.y * ts;

        // If we have a previous state, interpolate
        if (prevSnake[i]) {
            const px = prevSnake[i].x * ts;
            const py = prevSnake[i].y * ts;

            // Handle wrapping interpolation edge case
            // If distance is huge (wrapped), don't interpolate visual to avoid flying across screen
            if (Math.abs(px - drawX) < ts * 2 && Math.abs(py - drawY) < ts * 2) {
                drawX = px + (drawX - px) * alpha;
                drawY = py + (drawY - py) * alpha;
            }
        }

        ctx.shadowBlur = i === 0 ? 15 : 0; // Glow for head
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.fillStyle = i === 0 ? gameConfig.colors.snakeHead : gameConfig.colors.snake;

        // Draw rounded rects for style
        ctx.beginPath();
        const size = ts - 2;
        ctx.roundRect(drawX, drawY, size, size, i === 0 ? 4 : 2);
        ctx.fill();
    });
};

const gameOver = () => {
    isGameRunning = false;
    cancelAnimationFrame(animationFrameId);
    saveHighScore(score);
    gameElements.restartBtn.classList.remove('hidden');

    // Draw Game Over Overlay
    const ctx = gameElements.ctx;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, gameElements.canvas.width, gameElements.canvas.height);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', gameElements.canvas.width / 2, gameElements.canvas.height / 2);
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText(`Final Score: ${score}`, gameElements.canvas.width / 2, gameElements.canvas.height / 2 + 25);
};

const showGame = () => {
    gameElements.container.classList.remove('hidden');
    displayHighScores();
    if (!isGameRunning) initGame();
};

// Controls
document.addEventListener('keydown', (e) => {
    if (!isGameRunning) return;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();

        switch (e.key) {
            case 'ArrowUp':
                if (velocity.y === 0) nextVelocity = { x: 0, y: -1 };
                break;
            case 'ArrowDown':
                if (velocity.y === 0) nextVelocity = { x: 0, y: 1 };
                break;
            case 'ArrowLeft':
                if (velocity.x === 0) nextVelocity = { x: -1, y: 0 };
                break;
            case 'ArrowRight':
                if (velocity.x === 0) nextVelocity = { x: 1, y: 0 };
                break;
        }
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
