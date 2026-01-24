/**
 * Particle System
 * Handles visual particle effects for the game
 */

import { COLORS, GAME_CONFIG } from './config.js';

export class ParticleSystem {
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
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                size,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }
    }

    addTrail(x, y, isGhost = false, isSplit = false) {
        const ts = GAME_CONFIG.tileSize;
        this.trails.push({
            x: x * ts + ts / 2,
            y: y * ts + ts / 2,
            life: 1.0,
            isGhost,
            isSplit
        });
    }

    update() {
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.vy += 0.05;
            p.life -= 0.04;
            p.size *= 0.97;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // Update trails
        for (let i = this.trails.length - 1; i >= 0; i--) {
            this.trails[i].life -= 0.08;
            if (this.trails[i].life <= 0) this.trails.splice(i, 1);
        }
    }

    draw(ctx) {
        // Draw trails
        this.trails.forEach(t => {
            ctx.globalAlpha = t.life * 0.15;
            ctx.fillStyle = t.isGhost ? '#a78bfa' : (t.isSplit ? '#fbbf24' : '#10b981');
            ctx.beginPath();
            ctx.arc(t.x, t.y, GAME_CONFIG.tileSize / 3, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0;

        // Draw particles
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
