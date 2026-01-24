/**
 * Game UI Manager
 * Handles DOM-based UI updates
 */

export class UIManager {
    constructor(elements) {
        this.elements = elements;
    }

    updateScore(score) {
        this.elements.score.textContent = score;
    }

    updateLength(length) {
        this.elements.snakeLength.textContent = length;
    }

    updateCombo(comboCount) {
        if (comboCount >= 2) {
            this.elements.comboDisplay.classList.add('active');
            this.elements.comboCount.textContent = `x${comboCount}`;
        } else {
            this.elements.comboDisplay.classList.remove('active');
        }
    }

    updatePowerup(activePowerup, powerupEndTime) {
        if (activePowerup && powerupEndTime > Date.now()) {
            const remaining = Math.ceil((powerupEndTime - Date.now()) / 1000);
            this.elements.powerupIndicator.classList.add('active');
            this.elements.powerupIndicator.classList.remove('ghost', 'speed', 'split');
            this.elements.powerupIndicator.classList.add(activePowerup);

            const icons = { ghost: '👻', speed: '⚡', split: '✂️' };
            this.elements.powerupIcon.textContent = icons[activePowerup] || '✨';
            this.elements.powerupTimer.textContent = `${remaining}s`;
        } else {
            this.elements.powerupIndicator.classList.remove('active');
        }
    }

    updateSplitIndicator(hasSplitSnake, activeIndex) {
        if (hasSplitSnake) {
            this.elements.splitIndicator?.classList.add('active');
            if (this.elements.splitSnakeNum) {
                this.elements.splitSnakeNum.textContent = activeIndex + 1;
            }
        } else {
            this.elements.splitIndicator?.classList.remove('active');
        }
    }

    showRestartButton() {
        this.elements.restartBtn.classList.remove('hidden');
    }

    hideRestartButton() {
        this.elements.restartBtn.classList.add('hidden');
    }

    showContainer() {
        this.elements.container.classList.remove('hidden');
    }

    setPlaying(isPlaying) {
        if (isPlaying) {
            this.elements.canvas.classList.add('playing');
        } else {
            this.elements.canvas.classList.remove('playing');
        }
    }

    reset() {
        this.elements.comboDisplay.classList.remove('active');
        this.elements.powerupIndicator.classList.remove('active');
        this.elements.splitIndicator?.classList.remove('active');
        this.hideRestartButton();
    }
}
