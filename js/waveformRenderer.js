export const drawWaveform = (canvas, { seedSource = 'preview', root = document.documentElement } = {}) => {
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

    const styles = getComputedStyle(root);
    const sky = styles.getPropertyValue('--sky').trim() || '#38bdf8';
    const emerald = styles.getPropertyValue('--emerald').trim() || '#34d399';
    const heroOrb = styles.getPropertyValue('--hero-orb').trim() || sky;
    const mutedForeground = styles.getPropertyValue('--muted-foreground').trim() || 'rgba(255,255,255,0.35)';
    const glassHighlight = styles.getPropertyValue('--glass-highlight').trim() || 'rgba(255,255,255,0.1)';
    const surfaceGlassSoft = styles.getPropertyValue('--surface-glass-soft').trim() || 'rgba(255,255,255,0.08)';

    ctx.clearRect(0, 0, width, height);

    const backdrop = ctx.createLinearGradient(0, 0, 0, height);
    backdrop.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    backdrop.addColorStop(0.55, 'rgba(255, 255, 255, 0.02)');
    backdrop.addColorStop(1, 'rgba(255, 255, 255, 0)');
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
        return seed / 4294967295;
    };

    const barWidth = 5;
    const gap = 2;
    const barCount = Math.max(24, Math.floor(width / (barWidth + gap)));
    const centerY = height / 2;
    const maxAmplitude = height * 0.46;
    const waveformGradient = ctx.createLinearGradient(0, 0, width, 0);
    waveformGradient.addColorStop(0, sky);
    waveformGradient.addColorStop(0.42, heroOrb);
    waveformGradient.addColorStop(1, emerald);

    const shadowGradient = ctx.createLinearGradient(0, 0, width, height);
    shadowGradient.addColorStop(0, glassHighlight);
    shadowGradient.addColorStop(1, 'transparent');

    for (let i = 0; i < barCount; i += 1) {
        const x = i * (barWidth + gap);
        const normalized = i / Math.max(barCount - 1, 1);
        const contour = 0.24 + Math.sin(normalized * Math.PI) * 0.56;
        const ripple = Math.sin((normalized * 11) + (random() * 2.4)) * 0.12;
        const jitter = random() * 0.18;
        const amplitude = Math.max(0.12, Math.min(1, contour + ripple + jitter));
        const barHeight = Math.max(8, amplitude * maxAmplitude);
        const y = centerY - (barHeight / 2);

        ctx.fillStyle = bedGradient;
        ctx.globalAlpha = 0.42;
        ctx.fillRect(x, centerY - Math.max(5, (barHeight * 0.44)), barWidth, Math.max(10, barHeight * 0.88));
        ctx.globalAlpha = 1;

        ctx.fillStyle = shadowGradient;
        ctx.fillRect(x, y - 1, barWidth, barHeight + 2);

        ctx.fillStyle = waveformGradient;
        ctx.fillRect(x, y, barWidth, barHeight);

        ctx.fillStyle = mutedForeground;
        ctx.globalAlpha = 0.18;
        ctx.fillRect(x, centerY - 0.5, barWidth, 1);
        ctx.globalAlpha = 1;
    }

    const accentGlow = ctx.createRadialGradient(width * 0.22, centerY, 0, width * 0.22, centerY, width * 0.38);
    accentGlow.addColorStop(0, 'rgba(255,255,255,0.16)');
    accentGlow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = accentGlow;
    ctx.fillRect(0, 0, width, height);
};
