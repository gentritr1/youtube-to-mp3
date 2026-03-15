/**
 * Guess the Track - Mini Game Logic
 */
class GuessTrackGame {
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
        this.targetTrack = null;
        this.options = [];
        this.roundActive = false;
        this.isLoading = false;

        this.bindEvents();
    }

    bindEvents() {
        if (this.elements.startBtn) {
            this.elements.startBtn.addEventListener('click', () => {
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
        this.startRound();
    }

    show() {
        this.elements.container.classList.remove('hidden');
        this.updateStatsUI();
        if (this.lives > 0 && !this.isActive && !this.isLoading) {
            this.elements.statusText.textContent = "Click Start to Play!";
            this.elements.startBtn.classList.remove('hidden');
            this.elements.startBtn.textContent = "Start Game";
        }
    }

    hide() {
        this.elements.container.classList.add('hidden');
        if (this.audio) this.audio.pause();
        this.stopTimer();
        this.isActive = false;
    }

    async startRound() {
        if (this.lives <= 0) return;
        
        this.isActive = true;
        this.roundActive = false;
        this.isLoading = true;
        
        this.stopAudio();
        this.stopTimer();
        
        // UI Reset
        this.elements.startBtn.classList.add('hidden');
        this.elements.options.forEach(btn => {
            btn.classList.add('hidden');
            btn.classList.remove('correct', 'wrong');
            btn.disabled = false;
        });
        
        this.elements.visualizer.classList.remove('playing');
        this.elements.statusText.textContent = "Loading next track...";
        this.elements.timerBarContainer.classList.add('hidden');
        this.elements.timerBar.style.width = '100%';

        if (typeof FeaturesModule === 'undefined' || !FeaturesModule.getRandomTracks) {
            this.elements.statusText.textContent = "Error: Features module not loaded.";
            this.isLoading = false;
            return;
        }
        const tracks = FeaturesModule.getRandomTracks(4);
        if (tracks.length === 0) {
             this.elements.statusText.textContent = "Waiting for music feed to load...";
             // Retry in 1 second
             setTimeout(() => this.startRound(), 1000);
             return;
        }

        if (tracks.length < 4) {
             this.elements.statusText.textContent = "Almost ready... fetching more tracks.";
             setTimeout(() => this.startRound(), 1500);
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
            
            if (!data.success) throw new Error(data.message);

            this.audio = new Audio(data.previewUrl);
            this.audio.volume = 0.5; // reasonable volume
            
            const onCanPlay = () => {
                if (!this.isActive || !this.isLoading) return;
                this.isLoading = false;
                this.beginPlayback();
                this.audio.removeEventListener('canplaythrough', onCanPlay);
                this.audio.removeEventListener('loadeddata', onCanPlay);
            };

            this.audio.addEventListener('canplaythrough', onCanPlay);
            this.audio.addEventListener('loadeddata', onCanPlay);
            
            this.audio.addEventListener('error', () => {
                if (!this.isActive) return;
                this.elements.statusText.textContent = "Audio failed. Skipping...";
                this.isLoading = false;
                setTimeout(() => this.startRound(), 1500);
            }, { once: true });

            this.audio.load();
            
            // If already loaded
            if (this.audio.readyState >= 3) {
                onCanPlay();
            }

        } catch (e) {
            console.error("[GuessTrack] Error loading preview:", e);
            if (this.isActive) {
                this.elements.statusText.textContent = "Track unavailable. Skipping...";
                this.isLoading = false;
                setTimeout(() => this.startRound(), 1500);
            }
        }
    }

    beginPlayback() {
        if (!this.audio) return;
        
        this.audio.play().then(() => {
            this.elements.visualizer.classList.add('playing');
            this.elements.statusText.textContent = "Guess the track!";
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
            });
            
            this.roundActive = true;
            this.currentTimeLeft = 5;
            this.startTimer();
            
        }).catch(err => {
            console.error("Audio playback blocked", err);
            this.elements.statusText.textContent = "Click anywhere to allow audio.";
            this.elements.startBtn.classList.remove('hidden');
            this.elements.startBtn.textContent = "Play manually";
        });
    }

    startTimer() {
        const totalDuration = 5; // seconds
        let startTime = Date.now();
        
        this.timerInterval = setInterval(() => {
            if (!this.roundActive) {
                this.stopTimer();
                return;
            }
            
            let elapsed = (Date.now() - startTime) / 1000;
            this.currentTimeLeft = Math.max(0, totalDuration - elapsed);
            
            let percent = (this.currentTimeLeft / totalDuration) * 100;
            this.elements.timerBar.style.width = `${percent}%`;
            
            if (this.currentTimeLeft <= 0) {
                this.stopTimer();
                this.handleTimeout();
            }
        }, 50);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
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
        this.elements.options.forEach(b => b.disabled = true);
        
        const btn = e.target;
        const guessedId = btn.dataset.videoId;
        
        if (guessedId === this.targetTrack.videoId) {
            // Correct
            btn.classList.add('correct');
            this.score += 10 + (this.streak * 5);
            this.streak++;
            this.elements.statusText.textContent = "Correct! 🎯";
        } else {
            // Wrong
            btn.classList.add('wrong');
            // Highlight correct one
            const correctBtn = Array.from(this.elements.options).find(b => b.dataset.videoId === this.targetTrack.videoId);
            if (correctBtn) correctBtn.classList.add('correct');
            
            this.streak = 0;
            this.lives--;
            this.elements.statusText.textContent = "Wrong! ❌";
        }
        
        this.updateStatsUI();
        this.scheduleNext();
    }

    handleTimeout() {
        if (!this.roundActive) return;
        this.roundActive = false;
        this.stopAudio();
        
        this.elements.options.forEach(b => b.disabled = true);
        
        const correctBtn = Array.from(this.elements.options).find(b => b.dataset.videoId === this.targetTrack.videoId);
        if (correctBtn) correctBtn.classList.add('correct');
        
        this.streak = 0;
        this.lives--;
        this.elements.statusText.textContent = "Time's UP! ⏰";
        
        this.updateStatsUI();
        this.scheduleNext();
    }

    scheduleNext() {
        if (this.lives <= 0) {
            setTimeout(() => {
                this.elements.statusText.textContent = `Game Over! Final Score: ${this.score}`;
                this.elements.startBtn.classList.remove('hidden');
                this.elements.startBtn.textContent = "Play Again";
            }, 1500);
        } else {
            setTimeout(() => {
                this.startRound();
            }, 1500);
        }
    }

    updateStatsUI() {
        this.elements.scoreDisplay.textContent = this.score;
        this.elements.livesDisplay.textContent = '❤️'.repeat(this.lives) + '🖤'.repeat(3 - this.lives);
        this.elements.streakDisplay.textContent = this.streak;
    }
}
