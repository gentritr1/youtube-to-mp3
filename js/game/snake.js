/**
 * Snake Entity
 * Handles snake state and movement logic
 */

import { GAME_CONFIG, COLORS } from './config.js';

export class Snake {
    constructor(startX = 10, startY = 10, isSecondary = false) {
        this.segments = [
            { x: startX, y: startY },
            { x: startX - 1, y: startY },
            { x: startX - 2, y: startY }
        ];
        this.prevSegments = JSON.parse(JSON.stringify(this.segments));
        this.velocity = { x: 1, y: 0 };
        this.nextVelocity = { x: 1, y: 0 };
        this.isSecondary = isSecondary;
        this.isActive = !isSecondary;
    }

    get head() {
        return this.segments[0];
    }

    get length() {
        return this.segments.length;
    }

    setDirection(direction) {
        // Prevent 180-degree turns
        if (direction.x !== 0 && this.velocity.x === 0) {
            this.nextVelocity = direction;
        } else if (direction.y !== 0 && this.velocity.y === 0) {
            this.nextVelocity = direction;
        }
    }

    savePreviousState() {
        this.prevSegments = JSON.parse(JSON.stringify(this.segments));
    }

    move(tileCount) {
        this.velocity = { ...this.nextVelocity };

        const head = {
            x: this.segments[0].x + this.velocity.x,
            y: this.segments[0].y + this.velocity.y
        };

        // Wall wrapping
        if (head.x < 0) head.x = tileCount - 1;
        if (head.x >= tileCount) head.x = 0;
        if (head.y < 0) head.y = tileCount - 1;
        if (head.y >= tileCount) head.y = 0;

        this.segments.unshift(head);
        return head;
    }

    grow(amount = 1) {
        // Add segments at tail position
        for (let i = 0; i < amount; i++) {
            const tail = this.segments[this.segments.length - 1];
            this.segments.push({ x: tail.x, y: tail.y });
        }
    }

    shrink() {
        this.segments.pop();
    }

    checkSelfCollision(skipGhost = false) {
        if (skipGhost) return false;

        const head = this.head;
        for (let i = 1; i < this.segments.length; i++) {
            if (head.x === this.segments[i].x && head.y === this.segments[i].y) {
                return true;
            }
        }
        return false;
    }

    checkCollisionWith(otherSnake) {
        const head = this.head;
        for (const segment of otherSnake.segments) {
            if (head.x === segment.x && head.y === segment.y) {
                return true;
            }
        }
        return false;
    }

    split() {
        // Can only split if snake has at least 6 segments
        if (this.segments.length < 6) return null;

        const halfLength = Math.floor(this.segments.length / 2);
        const newSegments = this.segments.splice(halfLength);

        // Create new snake from the tail half
        const newSnake = new Snake(0, 0, true);
        newSnake.segments = newSegments;
        newSnake.prevSegments = JSON.parse(JSON.stringify(newSegments));

        // Reverse velocity for the new snake (moves opposite)
        newSnake.velocity = { x: -this.velocity.x, y: -this.velocity.y };
        newSnake.nextVelocity = { ...newSnake.velocity };

        return newSnake;
    }

    draw(ctx, alpha, activePowerup) {
        const ts = GAME_CONFIG.tileSize;
        const isGhost = activePowerup === 'ghost';

        this.segments.forEach((part, i) => {
            let drawX = part.x * ts;
            let drawY = part.y * ts;

            // Interpolation
            if (this.prevSegments[i]) {
                const px = this.prevSegments[i].x * ts;
                const py = this.prevSegments[i].y * ts;

                if (Math.abs(px - drawX) < ts * 2 && Math.abs(py - drawY) < ts * 2) {
                    drawX = px + (drawX - px) * alpha;
                    drawY = py + (drawY - py) * alpha;
                }
            }

            const size = ts - 2;
            const cornerRadius = i === 0 ? 5 : 3;

            if (i === 0) {
                // Head
                ctx.shadowBlur = isGhost ? 20 : (this.isSecondary ? 18 : 15);

                if (isGhost) {
                    ctx.shadowColor = 'rgba(167, 139, 250, 0.8)';
                    ctx.fillStyle = COLORS.snakeGhostHead;
                } else if (this.isSecondary) {
                    ctx.shadowColor = 'rgba(251, 191, 36, 0.8)';
                    ctx.fillStyle = COLORS.snakeSplitHead;
                } else {
                    ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
                    ctx.fillStyle = COLORS.snakeHead;
                }

                if (isGhost) ctx.globalAlpha = 0.85;

                // Active indicator ring
                if (this.isActive) {
                    ctx.strokeStyle = this.isSecondary ? '#fbbf24' : '#10b981';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(drawX + size / 2, drawY + size / 2, size / 2 + 3, 0, Math.PI * 2);
                    ctx.stroke();
                }
            } else {
                // Body
                ctx.shadowBlur = 0;
                const gradientIndex = Math.min(
                    Math.floor((i / this.segments.length) * COLORS.snakeGradient.length),
                    COLORS.snakeGradient.length - 1
                );

                if (isGhost) {
                    ctx.fillStyle = COLORS.snakeGhostBody;
                    ctx.globalAlpha = 0.5 + (1 - i / this.segments.length) * 0.3;
                } else if (this.isSecondary) {
                    ctx.fillStyle = COLORS.snakeSplitBody;
                    ctx.globalAlpha = 0.85 - (i / this.segments.length) * 0.2;
                } else {
                    ctx.fillStyle = COLORS.snakeGradient[gradientIndex];
                    ctx.globalAlpha = 0.95 - (i / this.segments.length) * 0.25;
                }
            }

            ctx.beginPath();
            ctx.roundRect(drawX, drawY, size, size, cornerRadius);
            ctx.fill();

            // Eyes on head
            if (i === 0) {
                this.drawEyes(ctx, drawX, drawY, ts, isGhost);
            }

            ctx.globalAlpha = 1;
        });

        ctx.shadowBlur = 0;
    }

    drawEyes(ctx, drawX, drawY, ts, isGhost) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = isGhost ? '#1a1a2e' : (this.isSecondary ? '#1a1a2e' : '#0a0a0f');

        let eye1X = drawX + ts / 2 - 3;
        let eye1Y = drawY + ts / 2 - 2;
        let eye2X = drawX + ts / 2 + 1;
        let eye2Y = drawY + ts / 2 - 2;

        if (this.velocity.x === 1) {
            eye1X = drawX + ts - 6;
            eye2X = drawX + ts - 6;
            eye1Y = drawY + 4;
            eye2Y = drawY + ts - 6;
        } else if (this.velocity.x === -1) {
            eye1X = drawX + 3;
            eye2X = drawX + 3;
            eye1Y = drawY + 4;
            eye2Y = drawY + ts - 6;
        } else if (this.velocity.y === -1) {
            eye1Y = drawY + 3;
            eye2Y = drawY + 3;
        } else if (this.velocity.y === 1) {
            eye1Y = drawY + ts - 5;
            eye2Y = drawY + ts - 5;
        }

        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, 1.5, 0, Math.PI * 2);
        ctx.arc(eye2X, eye2Y, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
}
