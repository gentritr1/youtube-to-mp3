export const COLOR_NORMALIZE_SENTINEL = '#000000';

export const GAME_COLOR_DEFAULTS = Object.freeze({
    snakeHead: '#ffffff',
    snakeGradient: ['#10b981', '#059669', '#047857'],
    snakeGhostHead: 'rgba(167, 139, 250, 0.9)',
    snakeGhostBody: 'rgba(139, 92, 246, 0.6)',
    snakeSplitHead: 'rgba(251, 191, 36, 0.95)',
    snakeSplitBody: 'rgba(245, 158, 11, 0.7)',
    snakeActiveRing: '#10b981',
    snakeSecondaryRing: '#fbbf24',
    snakeEye: '#0a0a0f',
    snakeGhostEye: '#1a1a2e',
    food: {
        normal: '#10b981',
        golden: '#fbbf24',
        speed: '#38bdf8',
        ghost: '#a78bfa',
        split: '#f43f5e'
    },
    foodGradients: {
        golden: ['#fcd34d', '#fbbf24', '#f59e0b'],
        split: ['#fda4af', '#f43f5e', '#e11d48']
    },
    foodHighlight: 'rgba(255, 255, 255, 0.4)',
    foodSpark: 'rgba(255, 255, 255, 0.7)',
    foodGhostEye: 'rgba(0, 0, 0, 0.4)',
    foodSplitStroke: 'rgba(255, 255, 255, 0.6)',
    bg: 'rgba(8, 8, 12, 0.95)',
    grid: 'rgba(255, 255, 255, 0.02)',
    overlayStart: 'rgba(0, 0, 0, 0.85)',
    overlayEnd: 'rgba(0, 0, 0, 0.95)',
    gameOverShadow: '#ef4444',
    gameOverText: '#ffffff',
    gameOverScore: '#10b981',
    gameOverMuted: '#71717a',
    gameOverCombo: '#fbbf24',
    gameOverSplit: '#f43f5e',
    switchHintBg: 'rgba(0, 0, 0, 0.6)',
    switchHintText: '#fbbf24',
    trail: {
        normal: '#10b981',
        split: '#fbbf24',
        ghost: '#a78bfa'
    },
    particles: {
        normal: ['#10b981', '#34d399', '#6ee7b7'],
        golden: ['#fbbf24', '#f59e0b', '#fcd34d'],
        speed: ['#38bdf8', '#0ea5e9', '#7dd3fc'],
        ghost: ['#a78bfa', '#8b5cf6', '#c4b5fd'],
        split: ['#f43f5e', '#fb7185', '#fda4af']
    }
});

export const RUNTIME_THEME_TOKEN_DEFAULTS = Object.freeze({
    background: 'hsl(225 15% 5%)',
    foreground: 'hsl(210 20% 96%)',
    mutedForeground: 'hsl(220 10% 54%)',
    emerald: 'hsl(160 84% 39%)',
    amber: 'hsl(38 92% 50%)',
    rose: 'hsl(347 77% 50%)',
    roseSoft: '#fda4af',
    sky: 'hsl(199 89% 48%)',
    violet: 'hsl(258 90% 66%)',
    heroHeadlight: 'hsl(48 100% 72%)',
    heroOrb: 'rgba(16, 185, 129, 0.92)',
    glassHighlight: 'rgba(255, 255, 255, 0.08)',
    surfaceGlassSoft: 'rgba(255, 255, 255, 0.08)',
    gameCanvas: 'hsl(225 18% 4%)'
});
