/**
 * Game Renderer
 * Handles all canvas drawing operations
 */

import { GAME_CONFIG, COLORS } from './config.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    clear() {
        this.ctx.fillStyle = COLORS.bg;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGrid() {
        const ts = GAME_CONFIG.tileSize;
        this.ctx.strokeStyle = COLORS.grid;
        this.ctx.lineWidth = 0.5;

        for (let i = 0; i <= this.canvas.width; i += ts) {
            this.ctx.beginPath();
            this.ctx.moveTo(i, 0);
            this.ctx.lineTo(i, this.canvas.height);
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.moveTo(0, i);
            this.ctx.lineTo(this.canvas.width, i);
            this.ctx.stroke();
        }
    }

    drawGameOver(score, comboCount, hasSplitSnake) {
        const ctx = this.ctx;
        const canvas = this.canvas;

        // Dark overlay with gradient
        const gradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, canvas.width / 2
        );
        gradient.addColorStop(0, COLORS.overlayStart);
        gradient.addColorStop(1, COLORS.overlayEnd);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Game Over text with stronger glow
        ctx.shadowBlur = 30;
        ctx.shadowColor = COLORS.gameOverShadow;
        ctx.fillStyle = COLORS.gameOverText;
        ctx.font = 'bold 32px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 25);

        // Score with emerald glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = COLORS.gameOverScore;
        ctx.font = 'bold 24px Inter, sans-serif';
        ctx.fillStyle = COLORS.gameOverScore;
        ctx.fillText(score.toString(), canvas.width / 2, canvas.height / 2 + 15);

        ctx.shadowBlur = 0;
        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = COLORS.gameOverMuted;
        ctx.fillText('FINAL SCORE', canvas.width / 2, canvas.height / 2 + 32);

        // Show combo if achieved
        if (comboCount >= 2) {
            ctx.font = '13px Inter, sans-serif';
            ctx.fillStyle = COLORS.gameOverCombo;
            ctx.fillText(`🔥 Best Combo: x${comboCount}`, canvas.width / 2, canvas.height / 2 + 55);
        }

        // Show split achievement
        if (hasSplitSnake) {
            ctx.fillStyle = COLORS.gameOverSplit;
            ctx.fillText('✂️ Split Master!', canvas.width / 2, canvas.height / 2 + (comboCount >= 2 ? 75 : 55));
        }
    }

    drawSwitchHint(activeSnakeIndex, totalSnakes) {
        if (totalSnakes <= 1) return;

        const ctx = this.ctx;

        // Draw switch indicator at top
        ctx.fillStyle = COLORS.switchHintBg;
        ctx.roundRect(this.canvas.width / 2 - 60, 8, 120, 24, 6);
        ctx.fill();

        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = COLORS.switchHintText;
        ctx.textAlign = 'center';
        ctx.fillText(`🐍 Snake ${activeSnakeIndex + 1}/${totalSnakes} • Press X`, this.canvas.width / 2, 24);
    }
}
