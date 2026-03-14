/**
 * Karaoke Lyrics Controller
 */

export class LyricsController {
    constructor(container) {
        this.container = container;
        this.active = false;
        this.lyrics = [];
        this.currentIndex = 0;
        this.intervalId = null;
    }

    async loadSubtitles(subtitles) {
        if (!subtitles || !subtitles.length) return false;
        
        // Try to find English, otherwise fallback to the first available
        const sub = subtitles.find(s => s.lang.startsWith('en')) || subtitles[0];
        
        try {
            console.log(`[Lyrics] Fetching subtitles for lang: ${sub.lang}`);
            const response = await fetch(`/api/lyrics?url=${encodeURIComponent(sub.url)}`);
            if (!response.ok) throw new Error('Lyrics fetch failed');
            
            const text = await response.text();
            this.parseSubtitles(text, sub.ext);
            return true;
        } catch (error) {
            console.error('[Lyrics] Error loading subtitles:', error);
            return false;
        }
    }

    parseSubtitles(text, ext) {
        this.lyrics = [];
        
        if (ext === 'json3') {
            try {
                const data = JSON.parse(text);
                if (data.events) {
                    data.events.forEach(event => {
                        if (event.segs && event.segs.length > 0) {
                            const line = event.segs.map(s => s.utf8).join('').trim();
                            if (line) {
                                this.lyrics.push({ text: line, time: event.tStartMs });
                            }
                        }
                    });
                }
            } catch (e) {
                console.error('[Lyrics] Error parsing JSON3:', e);
            }
        } else {
            // Basic VTT/SRT parsing fallback
            const lines = text.split(/\r?\n/);
            let currentTime = 0;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Very basic fallback logic for text segments
                if (line && !line.includes('-->') && isNaN(parseInt(line, 10)) && line !== 'WEBVTT') {
                    // Spread text out if no timestamps parsed properly yet
                    this.lyrics.push({ text: line, time: currentTime });
                    currentTime += 2000; // Fake 2 seconds per line for un-timestamped text
                }
            }
        }
        
        console.log(`[Lyrics] Parsed ${this.lyrics.length} lines`);
    }

    start() {
        if (this.lyrics.length === 0) return;
        
        this.active = true;
        this.currentIndex = 0;
        this.container.innerHTML = '';
        this.container.classList.remove('hidden');
        
        // Render all lines (hidden by default)
        this.lyrics.forEach((lyric, index) => {
            const el = document.createElement('p');
            el.className = 'lyric-line';
            el.textContent = lyric.text;
            el.id = `lyric-${index}`;
            this.container.appendChild(el);
        });

        // Simple mock playback - display one line every 2.5 seconds
        // Real sync would need audio timing, but this provides the karaoke vibe during wait
        this.intervalId = setInterval(() => {
            this.advanceTarget();
        }, 2200);

        this.advanceTarget(); // Show first line immediately
    }
    
    advanceTarget() {
        if (!this.active || this.currentIndex >= this.lyrics.length) {
            this.stop();
            return;
        }

        // Mark previous as past
        if (this.currentIndex > 0) {
            const prev = document.getElementById(`lyric-${this.currentIndex - 1}`);
            if (prev) {
                prev.classList.remove('active');
                prev.classList.add('past');
            }
        }

        // Mark current as active
        const current = document.getElementById(`lyric-${this.currentIndex}`);
        if (current) {
            current.classList.add('active');
        }

        this.currentIndex++;
    }

    stop() {
        this.active = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}
