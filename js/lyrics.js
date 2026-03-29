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
            if (this.looksLikeHtml(text)) {
                throw new Error('Unexpected HTML response instead of subtitles');
            }
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
                            parsedLyrics.push({
                                text: line,
                                time: event.tStartMs,
                                hasTiming: Number.isFinite(event.tStartMs),
                                isApproximate: false
                            });
                        }
                    });
                }
            } catch (error) {
                console.error('[Lyrics] Error parsing JSON3:', error);
            }
            return parsedLyrics;
        }

        const lines = text.split(/\r?\n/);
        const metadataPrefixes = ['Kind:', 'Language:', 'NOTE', 'X-TIMESTAMP-MAP', 'Region:'];
        let currentTime = 0;
        let fallbackIndex = 0;
        let lastCueTime = -Infinity;

        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i].trim();
            const isMetadata = metadataPrefixes.some((prefix) => line.startsWith(prefix));
            const isCueId = /^\d+$/.test(line);
            if (!line || isCueId || line === 'WEBVTT' || isMetadata) {
                continue;
            }

            if (line.includes('-->')) {
                const [startToken] = line.split('-->');
                const parsedTime = this.parseTimestampToMs(startToken.trim());
                currentTime = Number.isFinite(parsedTime)
                    ? parsedTime
                    : Math.max(lastCueTime + 2000, fallbackIndex * 2000);

                const cueLines = [];
                let cursor = i + 1;
                while (cursor < lines.length) {
                    const cueLine = lines[cursor].trim();
                    if (!cueLine) break;
                    if (/^\d+$/.test(cueLine)) break;
                    if (cueLine.includes('-->')) break;
                    cueLines.push(cueLine);
                    cursor += 1;
                }

                const textContent = cueLines.join(' ').trim();
                if (textContent) {
                    parsedLyrics.push({
                        text: textContent,
                        time: currentTime,
                        hasTiming: Number.isFinite(parsedTime),
                        isApproximate: !Number.isFinite(parsedTime)
                    });
                    lastCueTime = currentTime;
                    fallbackIndex += 1;
                }
                i = cursor - 1;
                continue;
            }

            parsedLyrics.push({
                text: line,
                time: currentTime,
                hasTiming: false,
                isApproximate: true
            });
            lastCueTime = currentTime;
            currentTime += 2000;
            fallbackIndex += 1;
        }

        return parsedLyrics;
    }

    looksLikeHtml(text) {
        const sample = String(text || '').slice(0, 1200).toLowerCase();
        return sample.includes('<!doctype html')
            || sample.includes('<html')
            || sample.includes('ytcfg.set(')
            || sample.includes('window.ytplayer');
    }

    parseTimestampToMs(token) {
        if (!token) return null;

        const normalized = token.replace(',', '.');
        const parts = normalized.split(':');
        if (parts.length < 2 || parts.length > 3) {
            return null;
        }

        const secondsPart = parts.pop();
        const minutesPart = parts.pop();
        const hoursPart = parts.pop() ?? '0';

        const seconds = Number.parseFloat(secondsPart);
        const minutes = Number.parseInt(minutesPart, 10);
        const hours = Number.parseInt(hoursPart, 10);

        if (![seconds, minutes, hours].every(Number.isFinite)) {
            return null;
        }

        return Math.round(((hours * 60 * 60) + (minutes * 60) + seconds) * 1000);
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
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }

        this.advanceTarget();

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

        const currentLyric = this.lyrics[this.currentIndex];
        const nextLyric = this.lyrics[this.currentIndex + 1];
        this.currentIndex += 1;

        if (!nextLyric) {
            return;
        }

        const hasRealTimestamps = Number.isFinite(nextLyric.time) && Number.isFinite(currentLyric?.time);
        const rawDelay = hasRealTimestamps
            ? nextLyric.time - currentLyric.time
            : 2500;
        const delay = hasRealTimestamps
            ? Math.max(rawDelay, 900)
            : Math.min(Math.max(rawDelay, 900), 5000);

        this.intervalId = setTimeout(() => {
            this.advanceTarget();
        }, delay);
    }

    stop({ preserveLyrics = true } = {}) {
        const wasActive = this.active;
        const stopRequestId = this.requestId;
        this.active = false;

        if (this.intervalId) {
            clearTimeout(this.intervalId);
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
