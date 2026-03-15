import { DEFAULT_THEME, getThemeById, themes } from './themeRegistry.js';

const STORAGE_KEY = 'yt-converter-theme';

export class ThemeController {
    constructor({ root = document.documentElement, mount, metaThemeColor } = {}) {
        this.root = root;
        this.mount = mount;
        this.metaThemeColor = metaThemeColor;
        this.activeTheme = DEFAULT_THEME;
    }

    init() {
        if (!this.mount) return;

        this.render();
        this.bindEvents();

        let storedTheme = null;
        try {
            storedTheme = window.localStorage.getItem(STORAGE_KEY);
        } catch (_error) {
            storedTheme = null;
        }
        this.applyTheme(storedTheme || DEFAULT_THEME);
    }

    render() {
        this.mount.innerHTML = `
            <div class="theme-switcher-shell">
                <span class="theme-switcher-label">Themes</span>
                <div class="theme-switcher-options" role="group" aria-label="Color themes">
                    ${themes.map((theme) => `
                        <button
                            type="button"
                            class="theme-option"
                            data-theme-value="${theme.id}"
                            aria-pressed="false"
                            title="${theme.description}"
                        >
                            <span class="theme-option-swatch" aria-hidden="true"></span>
                            <span class="theme-option-copy">
                                <span class="theme-option-name">${theme.label}</span>
                                <span class="theme-option-short">${theme.shortLabel}</span>
                            </span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    bindEvents() {
        this.mount.addEventListener('click', (event) => {
            const button = event.target.closest('[data-theme-value]');
            if (!button) return;

            this.applyTheme(button.dataset.themeValue);
        });
    }

    applyTheme(themeId) {
        const theme = getThemeById(themeId);
        this.activeTheme = theme.id;

        this.root.dataset.theme = theme.id;
        try {
            window.localStorage.setItem(STORAGE_KEY, theme.id);
        } catch (_error) {
            // Ignore storage failures and keep the in-memory theme active.
        }

        if (this.metaThemeColor) {
            this.metaThemeColor.setAttribute('content', theme.metaColor);
        }

        this.mount.querySelectorAll('[data-theme-value]').forEach((button) => {
            const isActive = button.dataset.themeValue === theme.id;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }
}
