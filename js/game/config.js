/**
 * Game Configuration
 * Central configuration for the Snake game
 */

import {
    COLOR_NORMALIZE_SENTINEL,
    GAME_COLOR_DEFAULTS,
    RUNTIME_THEME_TOKEN_DEFAULTS
} from '../ui/runtimeColorFallbacks.js';

export const GAME_CONFIG = {
    tileSize: 16,
    baseTickRate: 85,
    fastTickRate: 50,
    canvasSize: 320,

    // Combo system
    comboWindow: 2000, // 2 seconds to maintain combo
    comboMultipliers: [1, 1.5, 2, 2.5, 3, 4],
};

const FALLBACK_COLORS = JSON.parse(JSON.stringify(GAME_COLOR_DEFAULTS));

/**
 * Shared runtime palette for the modular Snake game.
 * syncColors() mutates this exported object in place so existing importers
 * pick up theme updates without recreating their color references.
 */
export const COLORS = JSON.parse(JSON.stringify(FALLBACK_COLORS));
const DEFAULT_ROOT = typeof document !== 'undefined' ? document.documentElement : null;

let _colorContext = null;

const getColorContext = () => {
    if (_colorContext || typeof document === 'undefined') {
        return _colorContext;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    _colorContext = canvas.getContext('2d');
    return _colorContext;
};

const readToken = (styles, name, fallback) => {
    const value = styles?.getPropertyValue(name)?.trim();
    return value || fallback;
};

const normalizeColor = (value) => {
    const context = getColorContext();
    if (!context || !value) {
        return value;
    }

    context.fillStyle = COLOR_NORMALIZE_SENTINEL;
    context.fillStyle = value;
    return context.fillStyle || value;
};

const toRgba = (value, alpha) => {
    const normalized = normalizeColor(value);
    if (!normalized) {
        return value;
    }

    if (normalized.startsWith('#')) {
        let hex = normalized.slice(1);
        if (hex.length === 3) {
            hex = hex.split('').map((part) => part + part).join('');
        }
        if (hex.length === 6 || hex.length === 8) {
            const red = Number.parseInt(hex.slice(0, 2), 16);
            const green = Number.parseInt(hex.slice(2, 4), 16);
            const blue = Number.parseInt(hex.slice(4, 6), 16);
            const embeddedAlpha = hex.length === 8
                ? Number.parseInt(hex.slice(6, 8), 16) / 255
                : 1;
            return `rgba(${red}, ${green}, ${blue}, ${embeddedAlpha * alpha})`;
        }
    }

    const rgbaMatch = normalized.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbaMatch) {
        const parts = rgbaMatch[1].split(',').map((part) => part.trim());
        const [red, green, blue, existingAlphaValue] = parts;
        const existingAlpha = parts.length > 3 ? Number.parseFloat(existingAlphaValue) : 1;
        if (parts.length < 3 || !Number.isFinite(existingAlpha)) {
            return value;
        }

        return `rgba(${red}, ${green}, ${blue}, ${existingAlpha * alpha})`;
    }

    return value;
};

/**
 * Re-reads theme tokens and updates the shared COLORS export in place.
 * Clone COLORS after calling syncColors() if a caller needs immutability.
 */
export const syncColors = (root = DEFAULT_ROOT) => {
    if (!root || typeof getComputedStyle !== 'function') {
        return COLORS;
    }

    const styles = getComputedStyle(root);
    const foreground = readToken(styles, '--foreground', FALLBACK_COLORS.gameOverText);
    const background = readToken(styles, '--background', RUNTIME_THEME_TOKEN_DEFAULTS.background);
    const mutedForeground = readToken(styles, '--muted-foreground', FALLBACK_COLORS.gameOverMuted);
    const emerald = readToken(styles, '--emerald', FALLBACK_COLORS.food.normal);
    const amber = readToken(styles, '--amber', FALLBACK_COLORS.food.golden);
    const sky = readToken(styles, '--sky', FALLBACK_COLORS.food.speed);
    const violet = readToken(styles, '--violet', FALLBACK_COLORS.food.ghost);
    const rose = readToken(styles, '--rose', FALLBACK_COLORS.food.split);
    const gameCanvas = readToken(styles, '--game-canvas', FALLBACK_COLORS.bg);
    const glassHighlight = readToken(styles, '--glass-highlight', RUNTIME_THEME_TOKEN_DEFAULTS.glassHighlight);
    const heroOrb = readToken(styles, '--hero-orb', RUNTIME_THEME_TOKEN_DEFAULTS.heroOrb);
    const heroHeadlight = readToken(styles, '--hero-headlight', RUNTIME_THEME_TOKEN_DEFAULTS.heroHeadlight);

    COLORS.snakeHead = foreground;
    COLORS.snakeGradient = [emerald, heroOrb, sky];
    COLORS.snakeGhostHead = toRgba(violet, 0.9);
    COLORS.snakeGhostBody = toRgba(violet, 0.6);
    COLORS.snakeSplitHead = toRgba(amber, 0.95);
    COLORS.snakeSplitBody = toRgba(amber, 0.7);
    COLORS.snakeActiveRing = emerald;
    COLORS.snakeSecondaryRing = amber;
    COLORS.snakeEye = toRgba(background, 0.95);
    COLORS.snakeGhostEye = toRgba(gameCanvas, 0.9);

    COLORS.food.normal = emerald;
    COLORS.food.golden = amber;
    COLORS.food.speed = sky;
    COLORS.food.ghost = violet;
    COLORS.food.split = rose;

    COLORS.foodGradients.golden = [heroHeadlight, amber, toRgba(amber, 0.82)];
    COLORS.foodGradients.split = [toRgba(rose, 0.4), rose, toRgba(rose, 0.8)];
    COLORS.foodHighlight = toRgba(foreground, 0.4);
    COLORS.foodSpark = toRgba(foreground, 0.7);
    COLORS.foodGhostEye = toRgba(background, 0.4);
    COLORS.foodSplitStroke = toRgba(foreground, 0.6);

    COLORS.bg = toRgba(gameCanvas, 0.95);
    COLORS.grid = toRgba(glassHighlight, 0.18);
    COLORS.overlayStart = toRgba(background, 0.85);
    COLORS.overlayEnd = toRgba(background, 0.95);
    COLORS.gameOverShadow = rose;
    COLORS.gameOverText = foreground;
    COLORS.gameOverScore = emerald;
    COLORS.gameOverMuted = mutedForeground;
    COLORS.gameOverCombo = amber;
    COLORS.gameOverSplit = rose;
    COLORS.switchHintBg = toRgba(background, 0.6);
    COLORS.switchHintText = amber;

    COLORS.trail.normal = emerald;
    COLORS.trail.split = amber;
    COLORS.trail.ghost = violet;

    COLORS.particles.normal = [emerald, toRgba(emerald, 0.78), toRgba(emerald, 0.52)];
    COLORS.particles.golden = [heroHeadlight, amber, toRgba(amber, 0.6)];
    COLORS.particles.speed = [sky, toRgba(sky, 0.82), toRgba(sky, 0.56)];
    COLORS.particles.ghost = [violet, toRgba(violet, 0.82), toRgba(violet, 0.56)];
    COLORS.particles.split = [rose, toRgba(rose, 0.82), toRgba(rose, 0.56)];

    return COLORS;
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
