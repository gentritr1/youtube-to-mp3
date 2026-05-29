import {
    COLOR_NORMALIZE_SENTINEL,
    RUNTIME_THEME_TOKEN_DEFAULTS
} from './ui/runtimeColorFallbacks.js';

const DEFAULT_ROOT = typeof document !== 'undefined' ? document.documentElement : null;

const readThemeValue = (styles, name, fallback) => styles?.getPropertyValue(name).trim() || fallback;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getColorContext = (documentRef) => {
    if (!documentRef) return null;
    const canvas = documentRef.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.getContext('2d');
};

const withAlpha = (color, alpha, documentRef) => {
    const context = getColorContext(documentRef);
    if (!context || !color) {
        return color;
    }

    context.fillStyle = COLOR_NORMALIZE_SENTINEL;
    context.fillStyle = color;
    const normalized = context.fillStyle;

    if (normalized.startsWith('#')) {
        let hex = normalized.slice(1);
        if (hex.length === 3) {
            hex = hex.split('').map((part) => part + part).join('');
        }
        const red = Number.parseInt(hex.slice(0, 2), 16);
        const green = Number.parseInt(hex.slice(2, 4), 16);
        const blue = Number.parseInt(hex.slice(4, 6), 16);
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }

    const rgbaMatch = normalized.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbaMatch) {
        const [red, green, blue] = rgbaMatch[1].split(',').map((part) => part.trim());
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }

    return color;
};

const readSignalSample = (samples, normalizedPosition) => {
    if (!samples || typeof samples.length !== 'number' || samples.length === 0) {
        return null;
    }

    const index = Math.min(samples.length - 1, Math.max(0, Math.round(normalizedPosition * (samples.length - 1))));
    const value = Number(samples[index]);
    return Number.isFinite(value) ? clamp(value, 0, 1) : null;
};

export const drawWaveform = (canvas, { seedSource = 'preview', root = DEFAULT_ROOT, samples = null } = {}) => {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    if (!ctx || width === 0 || height === 0) return;

    const view = root?.ownerDocument?.defaultView || window;
    const dpr = view.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const documentRef = root?.ownerDocument || view.document || (typeof document !== 'undefined' ? document : null);
    const styleRoot = root || documentRef?.documentElement || documentRef?.body;
    const styles = styleRoot ? getComputedStyle(styleRoot) : null;
    const sky = readThemeValue(styles, '--sky', RUNTIME_THEME_TOKEN_DEFAULTS.sky);
    const emerald = readThemeValue(styles, '--emerald', RUNTIME_THEME_TOKEN_DEFAULTS.emerald);
    const heroOrb = readThemeValue(styles, '--hero-orb', RUNTIME_THEME_TOKEN_DEFAULTS.heroOrb);
    const foreground = readThemeValue(styles, '--foreground', RUNTIME_THEME_TOKEN_DEFAULTS.foreground);
    const mutedForeground = readThemeValue(styles, '--muted-foreground', RUNTIME_THEME_TOKEN_DEFAULTS.mutedForeground);
    const glassHighlight = readThemeValue(styles, '--glass-highlight', RUNTIME_THEME_TOKEN_DEFAULTS.glassHighlight);
    const surfaceGlassSoft = readThemeValue(styles, '--surface-glass-soft', RUNTIME_THEME_TOKEN_DEFAULTS.surfaceGlassSoft);
    const energyStart = readThemeValue(styles, '--preview-energy-start', sky);
    const energyMid = readThemeValue(styles, '--preview-energy-mid', heroOrb);
    const energyEnd = readThemeValue(styles, '--preview-energy-end', emerald);
    const energyGlow = readThemeValue(styles, '--preview-energy-glow', heroOrb);

    ctx.clearRect(0, 0, width, height);

    const backdrop = ctx.createLinearGradient(0, 0, 0, height);
    backdrop.addColorStop(0, withAlpha(foreground, 0.08, documentRef));
    backdrop.addColorStop(0.55, withAlpha(foreground, 0.02, documentRef));
    backdrop.addColorStop(1, withAlpha(foreground, 0, documentRef));
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);

    const bedGradient = ctx.createLinearGradient(0, 0, width, 0);
    bedGradient.addColorStop(0, surfaceGlassSoft);
    bedGradient.addColorStop(1, glassHighlight);

    let seed = 0;
    for (let i = 0; i < seedSource.length; i += 1) {
        seed = (seed * 31 + seedSource.charCodeAt(i)) >>> 0;
    }

    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };

    const fillBar = (x, y, barWidth, barHeight, radius) => {
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, radius);
            ctx.fill();
            return;
        }

        ctx.fillRect(x, y, barWidth, barHeight);
    };

    const barWidth = width > 720 ? 5 : 4;
    const gap = 3;
    const barCount = Math.max(24, Math.floor(width / (barWidth + gap)));
    const centerY = height / 2;
    const maxAmplitude = height * 0.5;
    const waveformGradient = ctx.createLinearGradient(0, 0, width, 0);
    waveformGradient.addColorStop(0, energyStart);
    waveformGradient.addColorStop(0.46, energyMid);
    waveformGradient.addColorStop(0.72, energyMid);
    waveformGradient.addColorStop(1, energyEnd);

    const shadowGradient = ctx.createLinearGradient(0, 0, width, height);
    shadowGradient.addColorStop(0, glassHighlight);
    shadowGradient.addColorStop(1, 'transparent');

    for (let i = 0; i < barCount; i += 1) {
        const x = i * (barWidth + gap);
        const normalized = i / Math.max(barCount - 1, 1);
        const signalSample = readSignalSample(samples, normalized);
        const amplitude = signalSample === null
            ? (() => {
                const contour = 0.26 + Math.sin(normalized * Math.PI) * 0.38;
                const bassPulse = Math.max(0, Math.sin((normalized * Math.PI * 5.4) + 0.45)) * 0.18;
                const syncopation = Math.max(0, Math.sin((normalized * Math.PI * 17) + (random() * 0.65))) * 0.14;
                const beat = (i % 17 === 4 || i % 17 === 5 || i % 23 === 11) ? 0.18 : 0;
                const jitter = random() * 0.16;
                return clamp(contour + bassPulse + syncopation + beat + jitter, 0.16, 1);
            })()
            : clamp(0.14 + (signalSample ** 0.72) * 0.86, 0.14, 1);
        const barHeight = Math.max(8, amplitude * maxAmplitude);
        const y = centerY - (barHeight / 2);

        ctx.fillStyle = bedGradient;
        ctx.globalAlpha = 0.32;
        fillBar(x, centerY - Math.max(5, (barHeight * 0.36)), barWidth, Math.max(10, barHeight * 0.72), 3);
        ctx.globalAlpha = 1;

        ctx.fillStyle = shadowGradient;
        fillBar(x, y - 1, barWidth, barHeight + 2, 3);

        ctx.fillStyle = waveformGradient;
        ctx.shadowColor = withAlpha(energyGlow, 0.3, documentRef);
        ctx.shadowBlur = amplitude > 0.72 ? 12 : 5;
        fillBar(x, y, barWidth, barHeight, 3);
        ctx.shadowBlur = 0;

        ctx.fillStyle = withAlpha(foreground, amplitude > 0.72 ? 0.24 : 0.12, documentRef);
        fillBar(x, y, barWidth, Math.max(2, barHeight * 0.12), 2);

        ctx.fillStyle = mutedForeground;
        ctx.globalAlpha = 0.12;
        ctx.fillRect(x, centerY - 0.5, barWidth, 1);
        ctx.globalAlpha = 1;
    }

    const accentGlow = ctx.createRadialGradient(width * 0.22, centerY, 0, width * 0.22, centerY, width * 0.38);
    accentGlow.addColorStop(0, withAlpha(foreground, 0.16, documentRef));
    accentGlow.addColorStop(1, withAlpha(foreground, 0, documentRef));
    ctx.fillStyle = accentGlow;
    ctx.fillRect(0, 0, width, height);
};
