/**
 * Game Configuration
 * Central configuration for the Snake game
 */

export const GAME_CONFIG = {
    tileSize: 16,
    baseTickRate: 85,
    fastTickRate: 50,
    canvasSize: 320,

    // Combo system
    comboWindow: 2000, // 2 seconds to maintain combo
    comboMultipliers: [1, 1.5, 2, 2.5, 3, 4],
};

export const COLORS = {
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

// Food types with their effects
export const FOOD_TYPES = {
    normal: { weight: 50, points: 10, growth: 1, effect: null },
    golden: { weight: 18, points: 25, growth: 3, effect: null },
    speed: { weight: 12, points: 15, growth: 1, effect: 'speed', duration: 5000 },
    ghost: { weight: 10, points: 20, growth: 1, effect: 'ghost', duration: 4000 },
    split: { weight: 10, points: 30, growth: 0, effect: 'split', duration: 8000 }
};

// Key bindings
export const KEYS = {
    UP: 'ArrowUp',
    DOWN: 'ArrowDown',
    LEFT: 'ArrowLeft',
    RIGHT: 'ArrowRight',
    SWITCH: 'KeyX',
    SWITCH_ALT: 'Tab'
};
