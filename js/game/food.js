/**
 * Food System
 * Handles food spawning and rendering
 */

import { GAME_CONFIG, COLORS, FOOD_TYPES } from './config.js';

export class FoodSystem {
    constructor() {
        this.food = { x: 0, y: 0, type: 'normal' };
    }

    spawn(snakes) {
        const tileCount = GAME_CONFIG.canvasSize / GAME_CONFIG.tileSize;
        let valid = false;

        while (!valid) {
            this.food.x = Math.floor(Math.random() * tileCount);
            this.food.y = Math.floor(Math.random() * tileCount);

            // Check against all snakes
            valid = true;
            for (const snake of snakes) {
                if (snake.segments.some(part =>
                    part.x === this.food.x && part.y === this.food.y
                )) {
                    valid = false;
                    break;
                }
            }
        }

        this.food.type = this.selectType();
    }

    selectType() {
        const totalWeight = Object.values(FOOD_TYPES).reduce((sum, f) => sum + f.weight, 0);
        let random = Math.random() * totalWeight;

        for (const [type, config] of Object.entries(FOOD_TYPES)) {
            random -= config.weight;
            if (random <= 0) return type;
        }
        return 'normal';
    }

    checkCollision(head) {
        return head.x === this.food.x && head.y === this.food.y;
    }

    getConfig() {
        return FOOD_TYPES[this.food.type];
    }

    draw(ctx) {
        const ts = GAME_CONFIG.tileSize;
        const time = Date.now() / 150;
        const pulse = Math.sin(time) * 2;
        const foodColor = COLORS.food[this.food.type];

        ctx.shadowBlur = 20 + pulse;
        ctx.shadowColor = foodColor;

        const fx = (this.food.x * ts) + (ts / 2);
        const fy = (this.food.y * ts) + (ts / 2);
        const baseRadius = (ts / 2) - 2;

        if (this.food.type === 'golden') {
            this.drawGolden(ctx, fx, fy, baseRadius, pulse);
        } else if (this.food.type === 'speed') {
            this.drawSpeed(ctx, fx, fy, baseRadius, pulse, foodColor);
        } else if (this.food.type === 'ghost') {
            this.drawGhost(ctx, fx, fy, baseRadius, pulse, time, foodColor);
        } else if (this.food.type === 'split') {
            this.drawSplit(ctx, fx, fy, baseRadius, pulse, time);
        } else {
            this.drawNormal(ctx, fx, fy, baseRadius, pulse, foodColor);
        }

        ctx.shadowBlur = 0;
    }

    drawGolden(ctx, fx, fy, baseRadius, pulse) {
        const gradient = ctx.createRadialGradient(fx, fy, 0, fx, fy, baseRadius + 4);
        gradient.addColorStop(0, '#fcd34d');
        gradient.addColorStop(0.6, '#fbbf24');
        gradient.addColorStop(1, '#f59e0b');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(fx, fy, baseRadius + pulse * 0.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(fx - 2, fy - 2, baseRadius * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }

    drawSpeed(ctx, fx, fy, baseRadius, pulse, foodColor) {
        ctx.fillStyle = foodColor;
        ctx.beginPath();
        ctx.arc(fx, fy, baseRadius + pulse * 0.5, 0, Math.PI * 2);
        ctx.fill();

        const sparkTime = Date.now() / 50;
        for (let i = 0; i < 3; i++) {
            const angle = (sparkTime + i * 2) % (Math.PI * 2);
            const sparkX = fx + Math.cos(angle) * (baseRadius + 4);
            const sparkY = fy + Math.sin(angle) * (baseRadius + 4);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.beginPath();
            ctx.arc(sparkX, sparkY, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawGhost(ctx, fx, fy, baseRadius, pulse, time, foodColor) {
        ctx.globalAlpha = 0.7 + Math.sin(time * 2) * 0.2;
        ctx.fillStyle = foodColor;
        ctx.beginPath();
        ctx.arc(fx, fy, baseRadius + pulse * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(fx - 2, fy - 1, 1.5, 0, Math.PI * 2);
        ctx.arc(fx + 2, fy - 1, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    drawSplit(ctx, fx, fy, baseRadius, pulse, time) {
        // Scissor-like icon for split
        const gradient = ctx.createRadialGradient(fx, fy, 0, fx, fy, baseRadius + 4);
        gradient.addColorStop(0, '#fda4af');
        gradient.addColorStop(0.6, '#f43f5e');
        gradient.addColorStop(1, '#e11d48');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(fx, fy, baseRadius + pulse * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Scissor symbol (two arcs crossing)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        const rotation = time * 0.5;

        ctx.beginPath();
        ctx.moveTo(fx - 4, fy - 3);
        ctx.lineTo(fx + 4, fy + 3);
        ctx.moveTo(fx - 4, fy + 3);
        ctx.lineTo(fx + 4, fy - 3);
        ctx.stroke();
    }

    drawNormal(ctx, fx, fy, baseRadius, pulse, foodColor) {
        ctx.fillStyle = foodColor;
        ctx.beginPath();
        ctx.arc(fx, fy, baseRadius + pulse * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
}
