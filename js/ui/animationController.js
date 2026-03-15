export class AnimationController {
    constructor(registry = {}) {
        this.registry = registry;
    }

    getRandom(slot) {
        const animations = this.registry[slot] || [];
        if (!animations.length) return null;

        return animations[Math.floor(Math.random() * animations.length)];
    }

    start(slot, container) {
        if (!container) return null;

        const animation = this.getRandom(slot);
        if (!animation) {
            container.innerHTML = '';
            return null;
        }

        const reducedMotion = window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        container.dataset.animationSlot = slot;
        container.dataset.animationName = animation.name;
        container.innerHTML = reducedMotion
            ? `<div class="anim-label">${animation.label}</div>`
            : `${animation.html}<div class="anim-label">${animation.label}</div>`;

        return animation.name;
    }

    stop(container) {
        if (!container) return;

        delete container.dataset.animationSlot;
        delete container.dataset.animationName;
        container.innerHTML = '';
    }
}
