/**
 * Main Game Controller
 * Orchestrates all game systems
 */

import { GAME_CONFIG, FOOD_TYPES, KEYS } from './config.js';
import { Snake } from './snake.js';
import { FoodSystem } from './food.js';
import { ParticleSystem } from './particles.js';
import { Renderer } from './renderer.js';
import { UIManager } from './ui.js';
import { ScoreManager } from './scores.js';

export class SnakeGame {
    constructor(elements) {
        this.elements = elements;
        this.renderer = new Renderer(elements.canvas);
        this.ui = new UIManager(elements);
        this.scores = new ScoreManager(elements.highScoresList);
        this.particles = new ParticleSystem();
        this.food = new FoodSystem();

        // Game state
        this.snakes = [];
        this.activeSnakeIndex = 0;
        this.isRunning = false;
        this.score = 0;

        // Timing
        this.lastTime = 0;
        this.timeAccumulator = 0;
        this.animationFrameId = null;
        this.currentTickRate = GAME_CONFIG.baseTickRate;

        // Power-ups
        this.activePowerup = null;
        this.powerupEndTime = 0;
        this.canSplit = false;

        // Combo
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

        // Movement
        if ([KEYS.UP, KEYS.DOWN, KEYS.LEFT, KEYS.RIGHT].includes(e.key)) {
            e.preventDefault();

            const directions = {
                [KEYS.UP]: { x: 0, y: -1 },
                [KEYS.DOWN]: { x: 0, y: 1 },
                [KEYS.LEFT]: { x: -1, y: 0 },
                [KEYS.RIGHT]: { x: 1, y: 0 }
            };

            activeSnake.setDirection(directions[e.key]);
        }

        // Switch snake (X key or Tab)
        if ((e.code === KEYS.SWITCH || e.code === KEYS.SWITCH_ALT) && this.snakes.length > 1) {
            e.preventDefault();
            this.switchSnake();
        }
    }

    switchSnake() {
        if (this.snakes.length <= 1) return;

        // Deactivate current
        this.snakes[this.activeSnakeIndex].isActive = false;

        // Switch to next
        this.activeSnakeIndex = (this.activeSnakeIndex + 1) % this.snakes.length;
        this.snakes[this.activeSnakeIndex].isActive = true;

        // Visual feedback
        this.particles.createParticles(
            this.snakes[this.activeSnakeIndex].head.x,
            this.snakes[this.activeSnakeIndex].head.y,
            'golden',
            6
        );
    }

    init() {
        // Reset state
        this.snakes = [new Snake(10, 10, false)];
        this.activeSnakeIndex = 0;
        this.score = 0;
        this.comboCount = 0;
        this.lastEatTime = 0;
        this.activePowerup = null;
        this.powerupEndTime = 0;
        this.canSplit = false;
        this.currentTickRate = GAME_CONFIG.baseTickRate;

        this.particles.clear();
        this.food.spawn(this.snakes);

        // UI
        this.ui.reset();
        this.ui.updateScore(0);
        this.ui.updateLength(3);
        this.ui.showContainer();
        this.ui.setPlaying(true);
        this.scores.display();

        // Start game loop
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

        // Check power-up expiry
        if (this.activePowerup && Date.now() > this.powerupEndTime) {
            this.activePowerup = null;
            this.currentTickRate = GAME_CONFIG.baseTickRate;
            this.canSplit = false;
        }

        // Check combo timeout
        if (Date.now() - this.lastEatTime > GAME_CONFIG.comboWindow && this.comboCount > 0) {
            this.comboCount = 0;
        }

        // Update all snakes
        for (let i = 0; i < this.snakes.length; i++) {
            const snake = this.snakes[i];
            snake.savePreviousState();

            // Add trail
            if (snake.head) {
                this.particles.addTrail(
                    snake.head.x,
                    snake.head.y,
                    this.activePowerup === 'ghost',
                    snake.isSecondary
                );
            }

            const head = snake.move(tileCount);

            // Self collision (skip if ghost)
            if (snake.checkSelfCollision(this.activePowerup === 'ghost')) {
                this.gameOver();
                return;
            }

            // Cross-snake collision (active snake hitting other snake)
            if (this.snakes.length > 1 && snake.isActive) {
                for (let j = 0; j < this.snakes.length; j++) {
                    if (i !== j && snake.checkCollisionWith(this.snakes[j])) {
                        // Collided with other snake - game over
                        if (this.activePowerup !== 'ghost') {
                            this.gameOver();
                            return;
                        }
                    }
                }
            }

            // Food collision (only active snake can eat)
            if (snake.isActive && this.food.checkCollision(head)) {
                this.eatFood(snake);
            } else {
                snake.shrink();
            }
        }

        // Update UI
        this.updateUI();
    }

    eatFood(snake) {
        const foodConfig = this.food.getConfig();
        const now = Date.now();

        // Update combo
        if (now - this.lastEatTime < GAME_CONFIG.comboWindow) {
            this.comboCount = Math.min(
                this.comboCount + 1,
                GAME_CONFIG.comboMultipliers.length - 1
            );
        } else {
            this.comboCount = 1;
        }
        this.lastEatTime = now;

        // Calculate score
        const multiplier = GAME_CONFIG.comboMultipliers[
            Math.min(this.comboCount, GAME_CONFIG.comboMultipliers.length - 1)
        ];
        const points = Math.round(foodConfig.points * multiplier);
        this.score += points;

        // Create particles
        this.particles.createParticles(
            this.food.food.x,
            this.food.food.y,
            this.food.food.type,
            this.food.food.type === 'golden' ? 20 : 12
        );

        // Apply growth
        if (foodConfig.growth > 0) {
            snake.grow(foodConfig.growth);
        }

        // Apply power-up effect
        if (foodConfig.effect) {
            this.activePowerup = foodConfig.effect;
            this.powerupEndTime = now + foodConfig.duration;

            if (foodConfig.effect === 'speed') {
                this.currentTickRate = GAME_CONFIG.fastTickRate;
            } else if (foodConfig.effect === 'split') {
                this.canSplit = true;
                this.trySplit(snake);
            }
        }

        this.food.spawn(this.snakes);
    }

    trySplit(snake) {
        const newSnake = snake.split();
        if (newSnake) {
            this.snakes.push(newSnake);
            this.particles.createParticles(
                newSnake.head.x,
                newSnake.head.y,
                'split',
                15
            );
        }
    }

    updateUI() {
        const activeSnake = this.snakes[this.activeSnakeIndex];
        const totalLength = this.snakes.reduce((sum, s) => sum + s.length, 0);

        this.ui.updateScore(this.score);
        this.ui.updateLength(totalLength);
        this.ui.updateCombo(this.comboCount);
        this.ui.updatePowerup(this.activePowerup, this.powerupEndTime);
        this.ui.updateSplitIndicator(this.snakes.length > 1, this.activeSnakeIndex);
    }

    render(alpha) {
        this.renderer.clear();
        this.renderer.drawGrid();

        // Draw particles and trails
        this.particles.draw(this.renderer.ctx);

        // Draw food
        this.food.draw(this.renderer.ctx);

        // Draw all snakes
        for (const snake of this.snakes) {
            snake.draw(this.renderer.ctx, alpha, this.activePowerup);
        }

        // Draw switch hint if multiple snakes
        this.renderer.drawSwitchHint(this.activeSnakeIndex, this.snakes.length);
    }

    gameOver() {
        this.isRunning = false;
        cancelAnimationFrame(this.animationFrameId);

        this.scores.save(this.score);
        this.ui.showRestartButton();
        this.ui.setPlaying(false);

        this.renderer.drawGameOver(
            this.score,
            this.comboCount,
            this.snakes.length > 1
        );
    }

    show() {
        this.ui.showContainer();
        this.scores.display();
        if (!this.isRunning) this.init();
    }
}
