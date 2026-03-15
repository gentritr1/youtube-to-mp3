export class KaraokePanel {
    constructor({
        root,
        tabs = [],
        views = {},
        linesContainer,
        statusBadge,
        statusTitle,
        statusDetail,
        launchButtons = [],
        onLaunchGame = () => {}
    } = {}) {
        this.root = root;
        this.tabs = Array.from(tabs);
        this.views = views;
        this.linesContainer = linesContainer;
        this.statusBadge = statusBadge;
        this.statusTitle = statusTitle;
        this.statusDetail = statusDetail;
        this.launchButtons = Array.from(launchButtons);
        this.onLaunchGame = onLaunchGame;
        this.lines = [];
        this.mode = 'karaoke';
        this._tabHandlers = [];
        this._launchHandlers = [];
    }

    init() {
        if (!this.root) return;

        this.bindEvents();
        this.setIdle();
        this.setMode(this.mode);
    }

    bindEvents() {
        this.destroy();

        this.tabs.forEach((tab) => {
            const handler = () => {
                this.setMode(tab.dataset.panelMode || 'karaoke');
            };

            tab.addEventListener('click', handler);
            this._tabHandlers.push({ element: tab, handler });
        });

        this.launchButtons.forEach((button) => {
            const handler = () => {
                const gameId = button.dataset.gameLaunch;
                if (!gameId) return;

                this.setMode('arcade');
                this.onLaunchGame(gameId);
            };

            button.addEventListener('click', handler);
            this._launchHandlers.push({ element: button, handler });
        });
    }

    destroy() {
        this._tabHandlers.forEach(({ element, handler }) => {
            element.removeEventListener('click', handler);
        });
        this._launchHandlers.forEach(({ element, handler }) => {
            element.removeEventListener('click', handler);
        });
        this._tabHandlers = [];
        this._launchHandlers = [];
    }

    setOnLaunchGame(onLaunchGame) {
        this.onLaunchGame = onLaunchGame;
    }

    setMode(mode) {
        this.mode = mode === 'arcade' ? 'arcade' : 'karaoke';

        this.tabs.forEach((tab) => {
            const isActive = tab.dataset.panelMode === this.mode;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        Object.entries(this.views).forEach(([viewMode, view]) => {
            if (!view) return;
            view.classList.toggle('hidden', viewMode !== this.mode);
        });
    }

    setStatus(badge, title, detail, tone = 'idle') {
        if (this.statusBadge) {
            this.statusBadge.textContent = badge;
            this.statusBadge.dataset.tone = tone;
        }

        if (this.statusTitle) {
            this.statusTitle.textContent = title;
        }

        if (this.statusDetail) {
            this.statusDetail.textContent = detail;
        }
    }

    setIdle() {
        this.setStatus(
            'Waiting',
            'Paste a video to get started.',
            'If the video has subtitles, the lyrics will stay visible here while your file is being prepared.',
            'idle'
        );
        this.renderPlaceholder([
            'Lyrics will appear here instead of hiding behind the page.',
            'You can switch to Arcade if you want a quick game while you wait.'
        ]);
    }

    setLoading() {
        this.setStatus(
            'Syncing',
            'Looking for subtitles now.',
            'If lyrics are available, they will appear here while the conversion continues.',
            'loading'
        );
        this.renderPlaceholder([
            'Checking the video for lyrics.',
            'If none are available, this panel will stay open with a simple fallback message.'
        ]);
    }

    setEmpty() {
        this.setStatus(
            'No lyrics',
            'This video does not include subtitles.',
            'You can still download the file as usual or open a mini game while you wait.',
            'muted'
        );
        this.renderPlaceholder([
            'No usable lyric track was found for this video.',
            'Try another video or use the Arcade tab while your conversion finishes.'
        ]);
    }

    setLyrics(lines) {
        this.lines = Array.isArray(lines) ? lines : [];

        if (!this.lines.length) {
            this.setEmpty();
            return;
        }

        this.linesContainer.innerHTML = this.lines.map((line, index) => `
            <article class="karaoke-line-card" data-line-index="${index}">
                <span class="karaoke-line-index">${String(index + 1).padStart(2, '0')}</span>
                <p class="karaoke-line-text">${this.escapeHtml(line.text)}</p>
            </article>
        `).join('');

        this.setStatus(
            'Lyrics ready',
            'Lyrics are ready to show.',
            'The current line will stay highlighted here while your file is being prepared.',
            'ready'
        );
    }

    setActiveLine(index) {
        if (!this.linesContainer) return;

        const cards = this.linesContainer.querySelectorAll('[data-line-index]');
        cards.forEach((card) => {
            const lineIndex = Number(card.dataset.lineIndex);
            card.classList.toggle('active', lineIndex === index);
            card.classList.toggle('past', lineIndex < index);
            card.classList.toggle('upcoming', lineIndex > index);
        });

        const activeCard = this.linesContainer.querySelector(`[data-line-index="${index}"]`);
        if (activeCard) {
            activeCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    finishPlayback() {
        if (!this.lines.length) {
            this.setIdle();
            return;
        }

        this.setStatus(
            'Complete',
            'Lyrics finished.',
            'The last loaded lines will stay here until you start another conversion.',
            'done'
        );
    }

    setActiveGame(gameId) {
        this.launchButtons.forEach((button) => {
            const isActive = button.dataset.gameLaunch === gameId;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    renderPlaceholder(lines) {
        if (!this.linesContainer) return;

        this.lines = [];
        const icons = ['🎤', '🎮', '✨'];

        this.linesContainer.innerHTML = lines.map((line, index) => `
            <article class="karaoke-line-card placeholder">
                <span class="karaoke-line-index">${icons[index] || '•'}</span>
                <p class="karaoke-line-text">${this.escapeHtml(line)}</p>
            </article>
        `).join('');
    }

    escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
