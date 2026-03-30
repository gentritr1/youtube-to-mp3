let youTubeApiPromise = null;

const resetYouTubeApiPromise = (error, reject) => {
    youTubeApiPromise = null;
    reject(error);
};

const loadYouTubeApi = () => {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('YouTube API is not available in this environment.'));
    }

    if (window.YT?.Player) {
        return Promise.resolve(window.YT);
    }

    if (youTubeApiPromise) {
        return youTubeApiPromise;
    }

    youTubeApiPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-youtube-iframe-api]');
        const previousReady = window.onYouTubeIframeAPIReady;

        window.onYouTubeIframeAPIReady = () => {
            previousReady?.();
            if (window.YT?.Player) {
                resolve(window.YT);
            } else {
                resetYouTubeApiPromise(new Error('YouTube API loaded without player support.'), reject);
            }
        };

        if (!existing) {
            const script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            script.async = true;
            script.dataset.youtubeIframeApi = 'true';
            script.onerror = () => resetYouTubeApiPromise(new Error('Could not load YouTube player API.'), reject);
            document.head.appendChild(script);
        }
    });

    return youTubeApiPromise;
};

export class YouTubePlayerAdapter {
    constructor({
        frameElement,
        mountId,
        onReady = () => {},
        onStateChange = () => {},
        onError = () => {}
    } = {}) {
        this.frameElement = frameElement;
        this.mountId = mountId;
        this.onReady = onReady;
        this.onStateChange = onStateChange;
        this.onError = onError;
        this.player = null;
        this.ready = false;
        this.videoId = null;
    }

    getPlayer() {
        return this.player;
    }

    isReady() {
        return this.ready;
    }

    hasVideo(videoId) {
        return Boolean(this.player && this.player.__videoId === videoId);
    }

    async loadForVideo(videoId, { isCurrentRequest = () => true } = {}) {
        if (!this.frameElement) {
            return;
        }

        if (this.hasVideo(videoId)) {
            return;
        }

        this.destroy();
        this.frameElement.innerHTML = `<div id="${this.mountId}" class="review-player-embed"></div>`;

        try {
            const YT = await loadYouTubeApi();
            if (!isCurrentRequest()) {
                return;
            }

            this.player = new YT.Player(this.mountId, {
                videoId,
                playerVars: {
                    playsinline: 1,
                    rel: 0,
                    modestbranding: 1
                },
                events: {
                    onReady: () => {
                        this.ready = true;
                        this.videoId = videoId;
                        if (this.player) {
                            this.player.__videoId = videoId;
                        }
                        this.onReady();
                    },
                    onStateChange: (event) => this.onStateChange(event, YT)
                }
            });
            this.ready = false;
            this.videoId = videoId;
        } catch (error) {
            this.destroy();
            this.onError(error);
        }
    }

    destroy() {
        if (this.player?.destroy) {
            this.player.destroy();
        }
        this.player = null;
        this.ready = false;
        this.videoId = null;
        if (this.frameElement) {
            this.frameElement.innerHTML = '';
        }
    }
}
