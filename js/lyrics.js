/**
 * Karaoke Lyrics Controller
 * Handles subtitle loading, parsing, and timed line updates.
 */

export class LyricsController {
    constructor() {
        this.active = false;
        this.lyrics = [];
        this.currentIndex = 0;
        this.intervalId = null;
        this.listeners = new Map();
    }

    on(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }

        this.listeners.get(eventName).add(callback);

        return () => {
            this.listeners.get(eventName)?.delete(callback);
        };
    }

    emit(eventName, payload = {}) {
        this.listeners.get(eventName)?.forEach((callback) => {
            callback(payload);
        });
    }

    getLyrics() {
        return [...this.lyrics];
    }

    async loadSubtitles(subtitles) {
        this.stop({ preserveLyrics: false });

        if (!subtitles || !subtitles.length) {
            this.emit('empty');
            return false;
        }

        // Try to find English, otherwise fallback to the first available.
        const sub = subtitles.find((entry) => entry.lang?.startsWith('en')) || subtitles[0];

        try {
            const response = await fetch(`/api/lyrics?url=${encodeURIComponent(sub.url)}`);
            if (!response.ok) throw new Error('Lyrics fetch failed');

            const text = await response.text();
            this.parseSubtitles(text, sub.ext);

            if (!this.lyrics.length) {
                this.emit('empty');
                return false;
            }

            this.emit('loaded', { lyrics: this.getLyrics() });
            return true;
        } catch (error) {
            console.error('[Lyrics] Error loading subtitles:', error);
            this.emit('empty');
            return false;
        }
    }

    parseSubtitles(text, ext) {
        this.lyrics = [];

        if (ext === 'json3') {
            try {
                const data = JSON.parse(text);
                if (data.events) {
                    data.events.forEach((event) => {
                        if (!event.segs || !event.segs.length) return;

                        const line = event.segs
                            .filter((segment) => typeof segment.utf8 === 'string')
                            .map((segment) => segment.utf8)
                            .join('')
                            .trim();

                        if (line) {
                            this.lyrics.push({ text: line, time: event.tStartMs });
                        }
                    });
                }
            } catch (error) {
                console.error('[Lyrics] Error parsing JSON3:', error);
            }
            return;
        }

        const lines = text.split(/\r?\n/);
        let currentTime = 0;

        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i].trim();
            if (!line || line.includes('-->') || !Number.isNaN(parseInt(line, 10)) || line === 'WEBVTT') {
                continue;
            }

            this.lyrics.push({ text: line, time: currentTime });
            currentTime += 2000;
        }
    }

    start() {
        if (!this.lyrics.length) {
            this.emit('empty');
            return false;
        }

        this.active = true;
        this.currentIndex = 0;
        this.emit('start', { lyrics: this.getLyrics() });

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.advanceTarget();

        // Approximate karaoke pacing while conversion runs.
        this.intervalId = setInterval(() => {
            this.advanceTarget();
        }, 2500);

        return true;
    }

    advanceTarget() {
        if (!this.active) return;

        if (this.currentIndex >= this.lyrics.length) {
            this.stop({ preserveLyrics: true });
            return;
        }

        this.emit('linechange', {
            index: this.currentIndex,
            lyric: this.lyrics[this.currentIndex],
            previousIndex: this.currentIndex - 1
        });

        this.currentIndex += 1;
    }

    stop({ preserveLyrics = true } = {}) {
        const wasActive = this.active;
        this.active = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        if (!preserveLyrics) {
            this.lyrics = [];
            this.currentIndex = 0;
        }

        if (wasActive || !preserveLyrics) {
            this.emit('stop', { lyrics: this.getLyrics(), preserveLyrics });
        }
    }
}
