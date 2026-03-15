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
        this.requestId = null;
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

    async loadSubtitles(subtitles, { requestId = null } = {}) {
        this.stop({ preserveLyrics: false });
        const reqId = requestId;
        this.requestId = reqId;

        if (!subtitles || !subtitles.length) {
            if (this.requestId === reqId) {
                this.emit('empty', { requestId: reqId });
            }
            return false;
        }

        // Try to find English, otherwise fallback to the first available.
        const sub = subtitles.find((entry) => entry.lang?.startsWith('en')) || subtitles[0];

        try {
            const response = await fetch(`/api/lyrics?url=${encodeURIComponent(sub.url)}`);
            if (!response.ok) throw new Error('Lyrics fetch failed');

            const text = await response.text();
            const parsedLyrics = this.parseSubtitles(text, sub.ext);

            if (this.requestId !== reqId) {
                return false;
            }

            this.requestId = reqId;
            this.lyrics = parsedLyrics;

            if (!this.lyrics.length) {
                this.emit('empty', { requestId: reqId });
                return false;
            }

            this.emit('loaded', { lyrics: this.getLyrics(), requestId: reqId });
            return true;
        } catch (error) {
            console.error('[Lyrics] Error loading subtitles:', error);
            if (this.requestId === reqId) {
                this.emit('empty', { requestId: reqId });
            }
            return false;
        }
    }

    parseSubtitles(text, ext) {
        const parsedLyrics = [];

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
                            parsedLyrics.push({ text: line, time: event.tStartMs });
                        }
                    });
                }
            } catch (error) {
                console.error('[Lyrics] Error parsing JSON3:', error);
            }
            return parsedLyrics;
        }

        const lines = text.split(/\r?\n/);
        let currentTime = 0;
        const metadataPrefixes = ['Kind:', 'Language:', 'NOTE', 'X-TIMESTAMP-MAP', 'Region:'];

        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i].trim();
            const isMetadata = metadataPrefixes.some((prefix) => line.startsWith(prefix));
            const isCueId = /^\d+$/.test(line);
            if (!line || line.includes('-->') || isCueId || line === 'WEBVTT' || isMetadata) {
                continue;
            }

            parsedLyrics.push({ text: line, time: currentTime });
            currentTime += 2000;
        }

        return parsedLyrics;
    }

    start() {
        if (!this.lyrics.length) {
            this.emit('empty', { requestId: this.requestId });
            return false;
        }

        this.active = true;
        this.currentIndex = 0;
        this.emit('start', { lyrics: this.getLyrics(), requestId: this.requestId });

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
            previousIndex: this.currentIndex - 1,
            requestId: this.requestId
        });

        this.currentIndex += 1;
    }

    stop({ preserveLyrics = true } = {}) {
        const wasActive = this.active;
        const stopRequestId = this.requestId;
        this.active = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        if (!preserveLyrics) {
            this.lyrics = [];
            this.currentIndex = 0;
            this.requestId = null;
        }

        if (wasActive || !preserveLyrics) {
            this.emit('stop', { lyrics: this.getLyrics(), preserveLyrics, requestId: stopRequestId });
        }
    }

    finishPlayback() {
        if (!this.lyrics.length) {
            return false;
        }

        if (this.active) {
            this.stop({ preserveLyrics: true });
            return true;
        }

        this.emit('stop', {
            lyrics: this.getLyrics(),
            preserveLyrics: true,
            requestId: this.requestId
        });
        return true;
    }
}
