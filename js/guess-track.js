/**
 * Guess the Track - Mini Game Logic
 */

import { RUNTIME_THEME_TOKEN_DEFAULTS } from './ui/runtimeColorFallbacks.js';

let _getRandomTracks = null;

const readThemeValue = (styles, name, fallback) => styles.getPropertyValue(name).trim() || fallback;

const getBurstConfigs = (root = document.documentElement) => {
    const styles = getComputedStyle(root);
    const emerald = readThemeValue(styles, '--emerald', RUNTIME_THEME_TOKEN_DEFAULTS.emerald);
    const amber = readThemeValue(styles, '--amber', RUNTIME_THEME_TOKEN_DEFAULTS.amber);
    const sky = readThemeValue(styles, '--sky', RUNTIME_THEME_TOKEN_DEFAULTS.sky);
    const rose = readThemeValue(styles, '--rose', RUNTIME_THEME_TOKEN_DEFAULTS.rose);
    const roseSoft = readThemeValue(styles, '--rose-soft', RUNTIME_THEME_TOKEN_DEFAULTS.roseSoft);
    const heroHeadlight = readThemeValue(styles, '--hero-headlight', RUNTIME_THEME_TOKEN_DEFAULTS.heroHeadlight);
    const foreground = readThemeValue(styles, '--foreground', RUNTIME_THEME_TOKEN_DEFAULTS.foreground);

    return {
        success: { count: 14, symbols: ['✦', '•', '♪'], colors: [emerald, amber, sky] },
        streak: { count: 18, symbols: ['🔥', '✦', '♫'], colors: [rose, amber, heroHeadlight] },
        miss: { count: 10, symbols: ['✕', '•'], colors: [rose, roseSoft, foreground] }
    };
};

/**
 * Inject the track provider callback. Called by app.js during init
 * so this module never imports the discovery controller directly.
 */
export function setTrackProvider(fn) {
    _getRandomTracks = fn;
}

export class GuessTrackGame {
    constructor(elements) {
        this.elements = elements;
        
        // State
        this.score = 0;
        this.lives = 3;
        this.streak = 0;
        this.isActive = false;
        this.audio = null;
        this.currentTimeLeft = 5;
        this.timerInterval = null;
        this.timerFrameId = null;
        this.targetTrack = null;
        this.options = [];
        this.roundActive = false;
        this.isLoading = false;
        this.feedbackTimer = null;
        this.retryTimeout = null;
        this.nextRoundTimeout = null;
        this.previewRequestId = 0;
        this.pendingRestart = false;

        this.bindEvents();
    }

    bindEvents() {
        if (this.elements.startBtn) {
            this.elements.startBtn.addEventListener('click', () => {
                this.pendingRestart = false;
                if (this.lives <= 0) {
                    this.resetGame();
                } else {
                    this.startRound();
                }
            });
        }

        this.elements.options.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleGuess(e));
        });
    }

    resetGame() {
        this.score = 0;
        this.lives = 3;
        this.streak = 0;
        this.updateStatsUI();
        this.setStatus('ready', 'Fresh run', 'Back to full lives. Hit start when you are ready.');
        this.startRound();
    }

    show() {
        this.elements.container.classList.remove('hidden');
        this.updateStatsUI();
        if (this.pendingRestart && !this.isActive && !this.isLoading) {
            this.setStatus('ready', 'Play Again', 'Your last run ended. Start a fresh round when ready.');
            this.elements.startBtn.classList.remove('hidden');
            this.elements.startBtn.textContent = "Play Again";
            return;
        }
        if (this.lives > 0 && !this.isActive && !this.isLoading) {
            this.setStatus('ready', 'Click Start to Play', 'You get one short preview and four options.');
            this.elements.startBtn.classList.remove('hidden');
            this.elements.startBtn.textContent = "Start Game";
        }
    }

    hide() {
        this.elements.container.classList.add('hidden');
        this.previewRequestId++;
        this.pendingRestart = this.pendingRestart || (this.nextRoundTimeout !== null && this.lives <= 0);
        this.clearPendingTimeouts();
        if (this.audio) this.audio.pause();
        this.stopTimer();
        this.stopFeedback();
        this.stopAudio();
        this.roundActive = false;
        this.isLoading = false;
        this.isActive = false;
    }

    async startRound() {
        if (this.lives <= 0) return;
        const requestId = ++this.previewRequestId;
        
        this.isActive = true;
        this.roundActive = false;
        this.isLoading = true;
        this.pendingRestart = false;
        this.clearPendingTimeouts();
        
        this.stopAudio();
        this.stopTimer();
        this.stopFeedback();
        
        // UI Reset
        this.elements.startBtn.classList.add('hidden');
        this.elements.options.forEach(btn => {
            btn.classList.add('hidden');
            btn.classList.remove('correct', 'wrong');
            btn.disabled = false;
        });
        
        this.elements.container.classList.remove('is-wrong', 'is-correct', 'is-streak-hot');
        this.elements.visualizer.classList.remove('playing');
        this.setStatus('loading', 'Loading next track...', 'Picking a preview from the music feed.');
        this.elements.timerBarContainer.classList.add('hidden');
        this.elements.timerBar.style.width = '100%';

        if (typeof _getRandomTracks !== 'function') {
            this.setStatus('danger', 'Feature unavailable', 'Track data is not ready yet.');
            this.isLoading = false;
            this.isActive = false;
            this.elements.startBtn.classList.remove('hidden');
            this.elements.startBtn.textContent = 'Start Game';
            return;
        }
        const tracks = _getRandomTracks(4);
        if (tracks.length === 0) {
             this.setStatus('loading', 'Waiting for music feed', 'No tracks yet. Retrying in a moment.');
             this.scheduleRetry(1000);
             return;
        }

        if (tracks.length < 4) {
             this.setStatus('loading', 'Almost ready...', 'Fetching enough options for a fair round.');
             this.scheduleRetry(1500);
             return;
        }

        this.options = [...tracks].sort(() => 0.5 - Math.random());
        // Select random target
        this.targetTrack = this.options[Math.floor(Math.random() * this.options.length)];
        
        // Fetch audio url
        try {
            const response = await fetch('/api/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId: this.targetTrack.videoId })
            });

            if (!response.ok) throw new Error('Preview fetch failed');
            const data = await response.json();

            if (requestId !== this.previewRequestId || !this.isActive) {
                return;
            }
            
            if (!data.success) throw new Error(data.message);
            if (typeof data.previewUrl !== 'string' || data.previewUrl.trim() === '') {
                throw new Error('Preview response missing data.previewUrl');
            }

            try {
                new URL(data.previewUrl, window.location.origin);
            } catch {
                throw new Error('Preview response contains invalid data.previewUrl');
            }

            this.audio = new Audio(data.previewUrl);
            this.audio.volume = 0.5; // reasonable volume
            
            const onCanPlay = () => {
                if (requestId !== this.previewRequestId || !this.isActive || !this.isLoading || !this.audio) return;
                this.isLoading = false;
                this.beginPlayback();
                this.audio.removeEventListener('canplaythrough', onCanPlay);
                this.audio.removeEventListener('loadeddata', onCanPlay);
            };

            this.audio.addEventListener('canplaythrough', onCanPlay);
            this.audio.addEventListener('loadeddata', onCanPlay);
            
            this.audio.addEventListener('error', () => {
                if (requestId !== this.previewRequestId || !this.isActive) return;
                this.setStatus('danger', 'Audio failed', 'Skipping to the next preview.');
                this.isLoading = false;
                this.scheduleRetry(1500);
            }, { once: true });

            this.audio.load();
            
            // If already loaded
            if (this.audio.readyState >= 3) {
                onCanPlay();
            }

        } catch (e) {
            console.error("[GuessTrack] Error loading preview:", e);
            if (requestId === this.previewRequestId && this.isActive) {
                this.setStatus('danger', 'Track unavailable', 'This preview could not be loaded. Skipping.');
                this.isLoading = false;
                this.scheduleRetry(1500);
            }
        }
    }

    beginPlayback() {
        if (!this.audio) return;
        
        this.audio.play().then(() => {
            this.elements.visualizer.classList.add('playing');
            this.setStatus('playing', 'Guess the track', 'Listen fast. You have 5 seconds to lock it in.');
            this.elements.timerBarContainer.classList.remove('hidden');
            
            // Show options
            this.elements.options.forEach((btn, index) => {
                const track = this.options[index];
                if (!track) {
                    btn.classList.add('hidden');
                    return;
                }
                const trackName = track.title || 'Unknown Title';
                const artistName = track.artist || track.author || 'Unknown Artist';
                
                btn.textContent = `${trackName} - ${artistName}`;
                btn.dataset.videoId = track.videoId;
                btn.title = `${trackName} - ${artistName}`;
                btn.classList.remove('hidden');
                btn.style.setProperty('--gt-option-index', index);
            });
            
            this.roundActive = true;
            this.currentTimeLeft = 5;
            this.startTimer();
            
        }).catch(err => {
            console.error("Audio playback blocked", err);
            this.setStatus('warning', 'Playback blocked', 'Use the button to retry once audio is allowed.');
            this.elements.startBtn.classList.remove('hidden');
            this.elements.startBtn.textContent = "Play manually";
        });
    }

    startTimer() {
        const totalDuration = 5; // seconds
        let startTime = null;

        const tick = (timestamp) => {
            if (!this.roundActive) {
                this.stopTimer();
                return;
            }

            if (startTime === null) {
                startTime = timestamp;
            }

            const elapsed = (timestamp - startTime) / 1000;
            this.currentTimeLeft = Math.max(0, totalDuration - elapsed);

            const percent = (this.currentTimeLeft / totalDuration) * 100;
            this.elements.timerBar.style.width = `${percent}%`;

            if (this.currentTimeLeft <= 0) {
                this.stopTimer();
                this.handleTimeout();
                return;
            }

            this.timerFrameId = requestAnimationFrame(tick);
        };

        this.timerFrameId = requestAnimationFrame(tick);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.timerFrameId) {
            cancelAnimationFrame(this.timerFrameId);
            this.timerFrameId = null;
        }
    }

    stopAudio() {
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
        }
        this.elements.visualizer.classList.remove('playing');
    }

    handleGuess(e) {
        if (!this.roundActive) return;
        this.roundActive = false;
        this.stopTimer();
        this.stopAudio();
        
        // Disable all
        this.elements.options.forEach(b => {
            b.disabled = true;
        });
        
        const btn = e.target;
        const guessedId = btn.dataset.videoId;
        
        if (guessedId === this.targetTrack.videoId) {
            // Correct
            btn.classList.add('correct');
            this.score += 10 + (this.streak * 5);
            this.streak++;
            this.handleCorrectAnswer();
        } else {
            // Wrong
            btn.classList.add('wrong');
            // Highlight correct one
            const correctBtn = Array.from(this.elements.options).find(b => b.dataset.videoId === this.targetTrack.videoId);
            if (correctBtn) correctBtn.classList.add('correct');
            
            this.streak = 0;
            this.lives--;
            this.handleWrongAnswer();
        }
        
        this.updateStatsUI();
        this.scheduleNext();
    }

    handleTimeout() {
        if (!this.roundActive) return;
        this.roundActive = false;
        this.stopAudio();
        
        this.elements.options.forEach(b => {
            b.disabled = true;
        });
        
        const correctBtn = Array.from(this.elements.options).find(b => b.dataset.videoId === this.targetTrack.videoId);
        if (correctBtn) correctBtn.classList.add('correct');
        
        this.streak = 0;
        this.lives--;
        this.elements.container.classList.add('is-wrong');
        this.spawnBurst('miss');
        this.setStatus('danger', "Time's up", `The right answer was ${this.targetTrack.title || 'the highlighted track'}.`);
        
        this.updateStatsUI();
        this.scheduleNext();
    }

    scheduleNext() {
        this.clearNextRoundTimeout();
        if (this.lives <= 0) {
            this.nextRoundTimeout = setTimeout(() => {
                this.setStatus('danger', `Game Over • ${this.score} pts`, 'Reset to start a new run and build a longer combo.');
                this.elements.startBtn.classList.remove('hidden');
                this.elements.startBtn.textContent = "Play Again";
                this.nextRoundTimeout = null;
            }, 1500);
        } else {
            this.nextRoundTimeout = setTimeout(() => {
                this.startRound();
                this.nextRoundTimeout = null;
            }, 1500);
        }
    }

    updateStatsUI() {
        this.elements.scoreDisplay.textContent = this.score;
        const clampedLives = Math.max(0, Math.min(this.lives, 3));
        this.elements.livesDisplay.textContent = '❤️'.repeat(clampedLives) + '🖤'.repeat(3 - clampedLives);
        this.elements.streakDisplay.textContent = this.streak;
        const streakProgress = Math.min((this.streak / 3) * 100, 100);
        if (this.elements.streakMeterFill) {
            this.elements.streakMeterFill.style.width = `${streakProgress}%`;
        }
        this.elements.container.classList.toggle('is-streak-hot', this.streak >= 3);
    }

    handleCorrectAnswer() {
        const milestoneHit = this.streak > 0 && this.streak % 3 === 0;
        this.elements.container.classList.remove('is-wrong');
        this.elements.container.classList.add('is-correct');

        if (milestoneHit) {
            this.spawnBurst('streak');
            this.setStatus('streak', `${this.streak} in a row`, 'Hot streak unlocked. Keep the combo alive.');
        } else {
            this.spawnBurst('success');
            this.setStatus('success', 'Correct', `+${10 + ((this.streak - 1) * 5)} points. Preview mastered.`);
        }
    }

    handleWrongAnswer() {
        const answerTitle = this.targetTrack?.title || 'the highlighted track';
        this.elements.container.classList.remove('is-correct', 'is-streak-hot');
        this.elements.container.classList.add('is-wrong');
        this.spawnBurst('miss');
        this.setStatus('danger', 'Wrong answer', `The right pick was ${answerTitle}. Resetting your combo.`);
    }

    setStatus(state, title, detail = '') {
        if (this.elements.statusBadge) {
            const badgeMap = {
                ready: 'Warmup',
                loading: 'Loading',
                playing: 'Live',
                success: 'Correct',
                streak: 'On Fire',
                danger: 'Miss',
                warning: 'Audio'
            };
            this.elements.statusBadge.textContent = badgeMap[state] || 'Update';
        }

        this.elements.container.dataset.gtState = state;
        this.elements.statusText.textContent = title;
        if (this.elements.statusDetail) {
            this.elements.statusDetail.textContent = detail;
        }
    }

    stopFeedback() {
        if (this.feedbackTimer) {
            clearTimeout(this.feedbackTimer);
            this.feedbackTimer = null;
        }
        if (this.elements.feedbackLayer) {
            this.elements.feedbackLayer.innerHTML = '';
        }
    }

    spawnBurst(type) {
        if (!this.elements.feedbackLayer) return;

        this.stopFeedback();

        const configs = getBurstConfigs();

        const config = configs[type] || configs.success;
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < config.count; i++) {
            const particle = document.createElement('span');
            particle.className = `gt-burst gt-burst-${type}`;
            particle.textContent = config.symbols[i % config.symbols.length];
            particle.style.setProperty('--gt-burst-x', `${(Math.random() * 120) - 60}px`);
            particle.style.setProperty('--gt-burst-y', `${-40 - (Math.random() * 70)}px`);
            particle.style.setProperty('--gt-burst-rotate', `${(Math.random() * 140) - 70}deg`);
            particle.style.setProperty('--gt-burst-delay', `${i * 35}ms`);
            particle.style.color = config.colors[i % config.colors.length];
            fragment.appendChild(particle);
        }

        this.elements.feedbackLayer.appendChild(fragment);
        this.feedbackTimer = setTimeout(() => {
            if (this.elements.feedbackLayer) {
                this.elements.feedbackLayer.innerHTML = '';
            }
            this.feedbackTimer = null;
        }, 1800);
    }

    clearPendingTimeouts() {
        this.clearRetryTimeout();
        this.clearNextRoundTimeout();
    }

    clearRetryTimeout() {
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
    }

    clearNextRoundTimeout() {
        if (this.nextRoundTimeout) {
            clearTimeout(this.nextRoundTimeout);
            if (this.lives <= 0) {
                this.pendingRestart = true;
            }
            this.nextRoundTimeout = null;
        }
    }

    scheduleRetry(delay) {
        this.clearRetryTimeout();
        this.retryTimeout = setTimeout(() => {
            this.retryTimeout = null;
            this.startRound();
        }, delay);
    }
}
