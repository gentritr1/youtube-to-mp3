/**
 * Snake Game - Enhanced Edition (Bundled)
 * Self-contained game module with all dependencies
 * 
 * Features:
 * - Power-ups: Normal, Golden (3x growth), Speed, Ghost, Split
 * - Split ability: Cut snake in half, switch with X key
 * - Combo system for quick eating
 * - Smooth gradient snake with trail effects
 */

(function () {
    'use strict';

    // ========================================
    // CONFIGURATION
    // ========================================
    const GAME_CONFIG = {
        tileSize: 16,
        baseTickRate: 85,
        fastTickRate: 50,
        canvasSize: 320,
        comboWindow: 2000,
        comboMultipliers: [1, 1.5, 2, 2.5, 3, 4],
    };

    const COLORS = {
        snakeHead: '#ffffff',
        snakeGradient: ['#10b981', '#059669', '#047857'],
        snakeGhostHead: 'rgba(167, 139, 250, 0.9)',
        snakeGhostBody: 'rgba(139, 92, 246, 0.6)',
        snakeSplitHead: 'rgba(251, 191, 36, 0.95)',
        snakeSplitBody: 'rgba(245, 158, 11, 0.7)',
        food: {
            normal: '#10b981',
            golden: '#fbbf24',
            speed: '#38bdf8',
            ghost: '#a78bfa',
            split: '#f43f5e'
        },
        bg: 'rgba(8, 8, 12, 0.95)',
        grid: 'rgba(255, 255, 255, 0.02)',
        particles: {
            normal: ['#10b981', '#34d399', '#6ee7b7'],
            golden: ['#fbbf24', '#f59e0b', '#fcd34d'],
            speed: ['#38bdf8', '#0ea5e9', '#7dd3fc'],
            ghost: ['#a78bfa', '#8b5cf6', '#c4b5fd'],
            split: ['#f43f5e', '#fb7185', '#fda4af']
        }
    };

    const FOOD_TYPES = {
        normal: { weight: 50, points: 10, growth: 1, effect: null },
        golden: { weight: 18, points: 25, growth: 3, effect: null },
        speed: { weight: 12, points: 15, growth: 1, effect: 'speed', duration: 5000 },
        ghost: { weight: 10, points: 20, growth: 1, effect: 'ghost', duration: 4000 },
        split: { weight: 10, points: 30, growth: 0, effect: 'split', duration: 8000 }
    };

    // ========================================
    // PARTICLE SYSTEM
    // ========================================
    class ParticleSystem {
        constructor() {
            this.particles = [];
            this.trails = [];
        }

        createParticles(x, y, type = 'normal', count = 10) {
            const ts = GAME_CONFIG.tileSize;
            const centerX = (x * ts) + (ts / 2);
            const centerY = (y * ts) + (ts / 2);
            const colors = COLORS.particles[type] || COLORS.particles.normal;

            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 3 + 1.5;
                const size = Math.random() * 3 + 2;

                this.particles.push({
                    x: centerX, y: centerY,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1.0, size,
                    color: colors[Math.floor(Math.random() * colors.length)]
                });
            }
        }

        addTrail(x, y, isGhost = false, isSplit = false) {
            const ts = GAME_CONFIG.tileSize;
            this.trails.push({
                x: x * ts + ts / 2,
                y: y * ts + ts / 2,
                life: 1.0, isGhost, isSplit
            });
        }

        update() {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.x += p.vx; p.y += p.vy;
                p.vx *= 0.98; p.vy *= 0.98;
                p.vy += 0.05; p.life -= 0.04; p.size *= 0.97;
                if (p.life <= 0) this.particles.splice(i, 1);
            }

            for (let i = this.trails.length - 1; i >= 0; i--) {
                this.trails[i].life -= 0.08;
                if (this.trails[i].life <= 0) this.trails.splice(i, 1);
            }
        }

        draw(ctx) {
            // Trails
            this.trails.forEach(t => {
                ctx.globalAlpha = t.life * 0.15;
                ctx.fillStyle = t.isGhost ? '#a78bfa' : (t.isSplit ? '#fbbf24' : '#10b981');
                ctx.beginPath();
                ctx.arc(t.x, t.y, GAME_CONFIG.tileSize / 3, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1.0;

            // Particles
            this.particles.forEach(p => {
                ctx.globalAlpha = p.life * 0.8;
                ctx.fillStyle = p.color;
                ctx.shadowBlur = 8;
                ctx.shadowColor = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
        }

        clear() {
            this.particles = [];
            this.trails = [];
        }
    }

    // ========================================
    // SNAKE CLASS
    // ========================================
    class Snake {
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

        get head() { return this.segments[0]; }
        get length() { return this.segments.length; }

        setDirection(direction) {
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

            if (head.x < 0) head.x = tileCount - 1;
            if (head.x >= tileCount) head.x = 0;
            if (head.y < 0) head.y = tileCount - 1;
            if (head.y >= tileCount) head.y = 0;

            this.segments.unshift(head);
            return head;
        }

        grow(amount = 1) {
            for (let i = 0; i < amount; i++) {
                const tail = this.segments[this.segments.length - 1];
                this.segments.push({ x: tail.x, y: tail.y });
            }
        }

        shrink() { this.segments.pop(); }

        checkSelfCollision(skipGhost = false) {
            if (skipGhost) return false;
            const head = this.head;
            for (let i = 1; i < this.segments.length; i++) {
                if (head.x === this.segments[i].x && head.y === this.segments[i].y) return true;
            }
            return false;
        }

        checkCollisionWith(otherSnake) {
            const head = this.head;
            for (const segment of otherSnake.segments) {
                if (head.x === segment.x && head.y === segment.y) return true;
            }
            return false;
        }

        split() {
            if (this.segments.length < 6) return null;

            const halfLength = Math.floor(this.segments.length / 2);
            const newSegments = this.segments.splice(halfLength);

            const newSnake = new Snake(0, 0, true);
            newSnake.segments = newSegments;
            newSnake.prevSegments = JSON.parse(JSON.stringify(newSegments));
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

                    // Active indicator
                    if (this.isActive) {
                        ctx.strokeStyle = this.isSecondary ? '#fbbf24' : '#10b981';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(drawX + size / 2, drawY + size / 2, size / 2 + 3, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                } else {
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

                if (i === 0) this.drawEyes(ctx, drawX, drawY, ts, isGhost);
                ctx.globalAlpha = 1;
            });
            ctx.shadowBlur = 0;
        }

        drawEyes(ctx, drawX, drawY, ts, isGhost) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = isGhost ? '#1a1a2e' : (this.isSecondary ? '#1a1a2e' : '#0a0a0f');

            let eye1X = drawX + ts / 2 - 3, eye1Y = drawY + ts / 2 - 2;
            let eye2X = drawX + ts / 2 + 1, eye2Y = drawY + ts / 2 - 2;

            if (this.velocity.x === 1) {
                eye1X = drawX + ts - 6; eye2X = drawX + ts - 6;
                eye1Y = drawY + 4; eye2Y = drawY + ts - 6;
            } else if (this.velocity.x === -1) {
                eye1X = drawX + 3; eye2X = drawX + 3;
                eye1Y = drawY + 4; eye2Y = drawY + ts - 6;
            } else if (this.velocity.y === -1) {
                eye1Y = drawY + 3; eye2Y = drawY + 3;
            } else if (this.velocity.y === 1) {
                eye1Y = drawY + ts - 5; eye2Y = drawY + ts - 5;
            }

            ctx.beginPath();
            ctx.arc(eye1X, eye1Y, 1.5, 0, Math.PI * 2);
            ctx.arc(eye2X, eye2Y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ========================================
    // FOOD SYSTEM
    // ========================================
    class FoodSystem {
        constructor() {
            this.food = { x: 0, y: 0, type: 'normal' };
        }

        spawn(snakes) {
            const tileCount = GAME_CONFIG.canvasSize / GAME_CONFIG.tileSize;
            let valid = false;

            while (!valid) {
                this.food.x = Math.floor(Math.random() * tileCount);
                this.food.y = Math.floor(Math.random() * tileCount);
                valid = true;
                for (const snake of snakes) {
                    if (snake.segments.some(p => p.x === this.food.x && p.y === this.food.y)) {
                        valid = false;
                        break;
                    }
                }
            }
            this.food.type = this.selectType();
        }

        selectType() {
            const totalWeight = Object.values(FOOD_TYPES).reduce((s, f) => s + f.weight, 0);
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

        getConfig() { return FOOD_TYPES[this.food.type]; }

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
            } else if (this.food.type === 'speed') {
                ctx.fillStyle = foodColor;
                ctx.beginPath();
                ctx.arc(fx, fy, baseRadius + pulse * 0.5, 0, Math.PI * 2);
                ctx.fill();
                const sparkTime = Date.now() / 50;
                for (let i = 0; i < 3; i++) {
                    const angle = (sparkTime + i * 2) % (Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                    ctx.beginPath();
                    ctx.arc(fx + Math.cos(angle) * (baseRadius + 4), fy + Math.sin(angle) * (baseRadius + 4), 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (this.food.type === 'ghost') {
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
            } else if (this.food.type === 'split') {
                const gradient = ctx.createRadialGradient(fx, fy, 0, fx, fy, baseRadius + 4);
                gradient.addColorStop(0, '#fda4af');
                gradient.addColorStop(0.6, '#f43f5e');
                gradient.addColorStop(1, '#e11d48');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(fx, fy, baseRadius + pulse * 0.7, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(fx - 4, fy - 3);
                ctx.lineTo(fx + 4, fy + 3);
                ctx.moveTo(fx - 4, fy + 3);
                ctx.lineTo(fx + 4, fy - 3);
                ctx.stroke();
            } else {
                ctx.fillStyle = foodColor;
                ctx.beginPath();
                ctx.arc(fx, fy, baseRadius + pulse * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        }
    }

    // ========================================
    // MAIN GAME CLASS
    // ========================================
    class SnakeGame {
        constructor(elements) {
            this.elements = elements;
            this.canvas = elements.canvas;
            this.ctx = elements.canvas.getContext('2d');
            this.particles = new ParticleSystem();
            this.food = new FoodSystem();

            this.snakes = [];
            this.activeSnakeIndex = 0;
            this.isRunning = false;
            this.score = 0;

            this.lastTime = 0;
            this.timeAccumulator = 0;
            this.animationFrameId = null;
            this.currentTickRate = GAME_CONFIG.baseTickRate;

            this.activePowerup = null;
            this.powerupEndTime = 0;

            this.lastEatTime = 0;
            this.comboCount = 0;

            this.bindEvents();
        }

        bindEvents() {
            document.addEventListener('keydown', this.handleKeyDown.bind(this));
            this.elements.restartBtn.addEventListener('click', () => this.init());
        }

        handleKeyDown(e) {
            if (!this.isRunning) return;

            const activeSnake = this.snakes[this.activeSnakeIndex];
            if (!activeSnake) return;

            const directions = {
                'ArrowUp': { x: 0, y: -1 },
                'ArrowDown': { x: 0, y: 1 },
                'ArrowLeft': { x: -1, y: 0 },
                'ArrowRight': { x: 1, y: 0 }
            };

            if (directions[e.key]) {
                e.preventDefault();
                activeSnake.setDirection(directions[e.key]);
            }

            if ((e.code === 'KeyX' || e.code === 'Tab') && this.snakes.length > 1) {
                e.preventDefault();
                this.switchSnake();
            }
        }

        switchSnake() {
            if (this.snakes.length <= 1) return;

            this.snakes[this.activeSnakeIndex].isActive = false;
            this.activeSnakeIndex = (this.activeSnakeIndex + 1) % this.snakes.length;
            this.snakes[this.activeSnakeIndex].isActive = true;

            this.particles.createParticles(
                this.snakes[this.activeSnakeIndex].head.x,
                this.snakes[this.activeSnakeIndex].head.y,
                'golden', 6
            );
        }

        init() {
            this.snakes = [new Snake(10, 10, false)];
            this.activeSnakeIndex = 0;
            this.score = 0;
            this.comboCount = 0;
            this.lastEatTime = 0;
            this.activePowerup = null;
            this.powerupEndTime = 0;
            this.currentTickRate = GAME_CONFIG.baseTickRate;

            this.particles.clear();
            this.food.spawn(this.snakes);

            this.resetUI();
            this.updateUI();
            this.elements.container.classList.remove('hidden');
            this.canvas.classList.add('playing');
            this.displayHighScores();

            this.isRunning = true;
            this.lastTime = performance.now();
            this.timeAccumulator = 0;

            if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
            requestAnimationFrame(this.gameLoop.bind(this));
        }

        gameLoop(timestamp) {
            if (!this.isRunning) return;

            const deltaTime = timestamp - this.lastTime;
            this.lastTime = timestamp;
            this.timeAccumulator += deltaTime;

            while (this.timeAccumulator >= this.currentTickRate) {
                this.update();
                this.timeAccumulator -= this.currentTickRate;
            }

            const alpha = this.timeAccumulator / this.currentTickRate;
            this.render(alpha);
            this.particles.update();

            this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
        }

        update() {
            const tileCount = GAME_CONFIG.canvasSize / GAME_CONFIG.tileSize;

            if (this.activePowerup && Date.now() > this.powerupEndTime) {
                this.activePowerup = null;
                this.currentTickRate = GAME_CONFIG.baseTickRate;
            }

            if (Date.now() - this.lastEatTime > GAME_CONFIG.comboWindow && this.comboCount > 0) {
                this.comboCount = 0;
            }

            for (let i = 0; i < this.snakes.length; i++) {
                const snake = this.snakes[i];
                snake.savePreviousState();

                if (snake.head) {
                    this.particles.addTrail(
                        snake.head.x, snake.head.y,
                        this.activePowerup === 'ghost',
                        snake.isSecondary
                    );
                }

                const head = snake.move(tileCount);

                if (snake.checkSelfCollision(this.activePowerup === 'ghost')) {
                    this.gameOver();
                    return;
                }

                if (this.snakes.length > 1 && snake.isActive) {
                    for (let j = 0; j < this.snakes.length; j++) {
                        if (i !== j && snake.checkCollisionWith(this.snakes[j])) {
                            if (this.activePowerup !== 'ghost') {
                                this.gameOver();
                                return;
                            }
                        }
                    }
                }

                if (snake.isActive && this.food.checkCollision(head)) {
                    this.eatFood(snake);
                } else {
                    snake.shrink();
                }
            }

            this.updateUI();
        }

        eatFood(snake) {
            const foodConfig = this.food.getConfig();
            const now = Date.now();

            if (now - this.lastEatTime < GAME_CONFIG.comboWindow) {
                this.comboCount = Math.min(this.comboCount + 1, GAME_CONFIG.comboMultipliers.length - 1);
            } else {
                this.comboCount = 1;
            }
            this.lastEatTime = now;

            const multiplier = GAME_CONFIG.comboMultipliers[Math.min(this.comboCount, GAME_CONFIG.comboMultipliers.length - 1)];
            this.score += Math.round(foodConfig.points * multiplier);

            this.particles.createParticles(
                this.food.food.x, this.food.food.y,
                this.food.food.type,
                this.food.food.type === 'golden' ? 20 : 12
            );

            if (foodConfig.growth > 0) snake.grow(foodConfig.growth);

            if (foodConfig.effect) {
                this.activePowerup = foodConfig.effect;
                this.powerupEndTime = now + foodConfig.duration;

                if (foodConfig.effect === 'speed') {
                    this.currentTickRate = GAME_CONFIG.fastTickRate;
                } else if (foodConfig.effect === 'split') {
                    this.trySplit(snake);
                }
            }

            this.food.spawn(this.snakes);
        }

        trySplit(snake) {
            const newSnake = snake.split();
            if (newSnake) {
                this.snakes.push(newSnake);
                this.particles.createParticles(newSnake.head.x, newSnake.head.y, 'split', 15);
            }
        }

        updateUI() {
            const totalLength = this.snakes.reduce((sum, s) => sum + s.length, 0);

            this.elements.score.textContent = this.score;
            this.elements.snakeLength.textContent = totalLength;

            // Combo
            if (this.comboCount >= 2) {
                this.elements.comboDisplay.classList.add('active');
                this.elements.comboCount.textContent = `x${this.comboCount}`;
            } else {
                this.elements.comboDisplay.classList.remove('active');
            }

            // Power-up
            if (this.activePowerup && this.powerupEndTime > Date.now()) {
                const remaining = Math.ceil((this.powerupEndTime - Date.now()) / 1000);
                this.elements.powerupIndicator.classList.add('active');
                this.elements.powerupIndicator.classList.remove('ghost', 'speed', 'split');
                this.elements.powerupIndicator.classList.add(this.activePowerup);
                const icons = { ghost: '👻', speed: '⚡', split: '✂️' };
                this.elements.powerupIcon.textContent = icons[this.activePowerup] || '✨';
                this.elements.powerupTimer.textContent = `${remaining}s`;
            } else {
                this.elements.powerupIndicator.classList.remove('active');
            }

            // Split indicator
            if (this.snakes.length > 1) {
                this.elements.splitIndicator.classList.add('active');
                this.elements.splitSnakeNum.textContent = this.activeSnakeIndex + 1;
            } else {
                this.elements.splitIndicator.classList.remove('active');
            }
        }

        resetUI() {
            this.elements.comboDisplay.classList.remove('active');
            this.elements.powerupIndicator.classList.remove('active');
            this.elements.splitIndicator.classList.remove('active');
            this.elements.restartBtn.classList.add('hidden');
        }

        render(alpha) {
            const ctx = this.ctx;
            const canvas = this.canvas;

            // Background
            ctx.fillStyle = COLORS.bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Grid
            const ts = GAME_CONFIG.tileSize;
            ctx.strokeStyle = COLORS.grid;
            ctx.lineWidth = 0.5;
            for (let i = 0; i <= canvas.width; i += ts) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, canvas.height);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(canvas.width, i);
                ctx.stroke();
            }

            this.particles.draw(ctx);
            this.food.draw(ctx);

            for (const snake of this.snakes) {
                snake.draw(ctx, alpha, this.activePowerup);
            }

            // Switch hint
            if (this.snakes.length > 1) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.beginPath();
                ctx.roundRect(canvas.width / 2 - 60, 8, 120, 24, 6);
                ctx.fill();
                ctx.font = '11px Inter, sans-serif';
                ctx.fillStyle = '#fbbf24';
                ctx.textAlign = 'center';
                ctx.fillText(`🐍 Snake ${this.activeSnakeIndex + 1}/${this.snakes.length} • Press X`, canvas.width / 2, 24);
            }
        }

        gameOver() {
            this.isRunning = false;
            cancelAnimationFrame(this.animationFrameId);

            this.saveHighScore(this.score);
            this.elements.restartBtn.classList.remove('hidden');
            this.canvas.classList.remove('playing');

            const ctx = this.ctx;
            const canvas = this.canvas;
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;

            // FULLY OPAQUE solid black background
            ctx.fillStyle = '#0a0a0c';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Subtle red glow at edges
            const vignette = ctx.createRadialGradient(cx, cy, 80, cx, cy, canvas.width / 1.2);
            vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
            vignette.addColorStop(1, 'rgba(239, 68, 68, 0.12)');
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Skull emoji
            ctx.font = '48px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('💀', cx, cy - 55);

            // GAME OVER text - bright red with glow
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ef4444';
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 28px Inter, system-ui, sans-serif';
            ctx.fillText('GAME OVER', cx, cy);
            ctx.shadowBlur = 0;

            // Score label
            ctx.fillStyle = '#71717a';
            ctx.font = '12px Inter, system-ui, sans-serif';
            ctx.fillText('FINAL SCORE', cx, cy + 30);

            // Score number - large and bright green
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#10b981';
            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 40px Inter, system-ui, sans-serif';
            ctx.fillText(this.score.toString(), cx, cy + 75);
            ctx.shadowBlur = 0;

            // Achievement badges
            let badgeY = cy + 105;

            if (this.comboCount >= 2) {
                ctx.font = '13px Inter, system-ui, sans-serif';
                ctx.fillStyle = '#fbbf24';
                ctx.fillText(`🔥 Best Combo: x${this.comboCount}`, cx, badgeY);
                badgeY += 22;
            }

            if (this.snakes.length > 1) {
                ctx.font = '13px Inter, system-ui, sans-serif';
                ctx.fillStyle = '#f43f5e';
                ctx.fillText('✂️ Split Master!', cx, badgeY);
            }
        }

        getHighScores() {
            try {
                const scores = localStorage.getItem('snakeHighScores');
                return scores ? JSON.parse(scores) : [];
            } catch (e) { return []; }
        }

        saveHighScore(score) {
            const scores = this.getHighScores();
            scores.push({ score, date: new Date().toLocaleDateString() });
            scores.sort((a, b) => b.score - a.score);
            localStorage.setItem('snakeHighScores', JSON.stringify(scores.slice(0, 5)));
            this.displayHighScores();
        }

        displayHighScores() {
            const scores = this.getHighScores();
            this.elements.highScoresList.innerHTML = scores.length
                ? scores.map((s, i) => `<li><span>#${i + 1}</span><span>${s.score}</span></li>`).join('')
                : '<li><span style="width:100%;text-align:center">No scores yet</span></li>';
        }

        show() {
            this.elements.container.classList.remove('hidden');
            this.displayHighScores();
            if (!this.isRunning) this.init();
        }
    }

    // ========================================
    // EXPORT TO GLOBAL SCOPE
    // ========================================
    window.SnakeGame = SnakeGame;
})();
