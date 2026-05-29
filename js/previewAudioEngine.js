export class PreviewAudioEngine {
    constructor({
        onStateChange = () => { },
        onProgress = () => { },
        onStatus = () => { },
        onMetadata = () => { },
        onError = () => { },
        audioVisualizer = null
    } = {}) {
        this.previewAudio = null;
        this.fadingPreviewAudio = null;
        this.isPreviewPlaying = false;
        this.isPreviewLoading = false;
        this.previewRequestId = 0;
        this.previewRequestController = null;
        this.crossfadeFrameId = null;
        this.playbackProgressFrameId = null;
        this.audioVisualizer = audioVisualizer;
        this.callbacks = {
            onStateChange,
            onProgress,
            onStatus,
            onMetadata,
            onError
        };
    }

    setAudioVisualizer(audioVisualizer) {
        this.audioVisualizer = audioVisualizer;
    }

    getCurrentAudio() {
        return this.previewAudio;
    }

    hasAudio() {
        return this.previewAudio !== null;
    }

    isPlaying() {
        return this.isPreviewPlaying;
    }

    isLoading() {
        return this.isPreviewLoading;
    }

    beginRequest() {
        this.abortPreviewRequest();

        const controller = new AbortController();
        const requestId = this.previewRequestId + 1;
        const outgoingAudio = this.previewAudio;

        this.previewRequestId = requestId;
        this.previewRequestController = controller;
        this.isPreviewLoading = true;
        this.emitStateChange();

        return { requestId, controller, outgoingAudio };
    }

    endRequest(requestId, controller) {
        if (requestId !== this.previewRequestId) {
            return;
        }

        this.isPreviewLoading = false;
        if (this.previewRequestController === controller) {
            this.previewRequestController = null;
        }
        this.emitStateChange();
    }

    isCurrentRequest(requestId) {
        return requestId === this.previewRequestId;
    }

    abortPreviewRequest() {
        if (this.previewRequestController) {
            this.previewRequestController.abort();
            this.previewRequestController = null;
        }
    }

    async loadPreview(previewUrl, { requestId, outgoingAudio, shouldAutoplay, seedSource }) {
        const incomingAudio = this.buildPreviewAudio(previewUrl);
        this.attachPreviewAudioEvents(incomingAudio, seedSource, requestId);
        await this.awaitPreviewCanPlay(incomingAudio);
        if (!this.isCurrentRequest(requestId)) {
            this.disposeAudio(incomingAudio);
            return false;
        }

        this.resetAudioPosition(incomingAudio);
        this.previewAudio = incomingAudio;
        this.emitProgress(incomingAudio);

        if (shouldAutoplay && outgoingAudio) {
            incomingAudio.volume = 0;

            try {
                await incomingAudio.play();
                this.isPreviewPlaying = true;
                this.syncVisualizer('play', incomingAudio);
                this.startPreviewProgressLoop();
                this.startCrossfade(outgoingAudio, incomingAudio);
                this.emitStateChange();
                return true;
            } catch (error) {
                console.error('[Features] Crossfade playback failed:', error);
                this.isPreviewPlaying = false;
                this.disposeAudio(outgoingAudio);
                incomingAudio.volume = 1;
                this.callbacks.onStatus('Tap play to start preview');
                this.emitStateChange();
                return false;
            }
        }

        if (outgoingAudio) {
            this.disposeAudio(outgoingAudio);
        }
        this.syncVisualizer('pause');
        this.isPreviewPlaying = false;
        incomingAudio.volume = 1;
        this.stopPreviewProgressLoop();
        this.callbacks.onStatus('Tap play to start preview');
        this.emitStateChange();
        return true;
    }

    stopAll() {
        this.abortPreviewRequest();
        this.previewRequestId += 1;
        this.stopCrossfade();
        this.stopPreviewProgressLoop();
        this.disposeAudio(this.previewAudio);
        this.previewAudio = null;
        this.isPreviewPlaying = false;
        this.isPreviewLoading = false;
        this.syncVisualizer('pause');
        this.emitStateChange();
    }

    async togglePlayback() {
        if (!this.previewAudio) {
            return false;
        }

        if (this.isPreviewPlaying) {
            this.previewAudio.pause();
            this.isPreviewPlaying = false;
            this.syncVisualizer('pause');
            this.stopPreviewProgressLoop();
            this.callbacks.onStatus('Paused');
            this.emitStateChange();
            return true;
        }

        try {
            await this.previewAudio.play();
            this.isPreviewPlaying = true;
            this.syncVisualizer('play', this.previewAudio);
            this.startPreviewProgressLoop();
            this.callbacks.onStatus('Now playing');
            this.emitStateChange();
            return true;
        } catch (error) {
            console.error('[Features] Playback failed:', error);
            this.isPreviewPlaying = false;
            this.stopPreviewProgressLoop();
            this.callbacks.onStatus('Playback blocked');
            this.emitStateChange();
            return false;
        }
    }

    seekToPercent(percent) {
        if (!this.previewAudio) {
            return false;
        }

        const duration = this.previewAudio.duration;
        if (!Number.isFinite(duration) || duration <= 0) {
            return false;
        }

        const clampedPercent = Math.max(0, Math.min(1, percent));
        this.previewAudio.currentTime = clampedPercent * duration;
        this.emitProgress();
        return true;
    }

    seekByDelta(deltaSeconds) {
        if (!this.previewAudio) {
            return false;
        }

        const duration = this.previewAudio.duration;
        if (!Number.isFinite(duration) || duration <= 0) {
            return false;
        }

        const nextTime = Math.max(0, Math.min(duration, this.previewAudio.currentTime + deltaSeconds));
        this.previewAudio.currentTime = nextTime;
        this.emitProgress();
        return true;
    }

    resetAudioPosition(audio) {
        if (!audio || typeof audio.currentTime !== 'number') {
            return;
        }

        try {
            audio.currentTime = 0;
        } catch {
            // Some media sources reject seeks before their timeline is ready.
        }
    }

    stopCrossfade() {
        if (this.crossfadeFrameId) {
            cancelAnimationFrame(this.crossfadeFrameId);
            this.crossfadeFrameId = null;
        }

        if (this.fadingPreviewAudio) {
            if (typeof this.fadingPreviewAudio.currentTime === 'number') {
                this.fadingPreviewAudio.currentTime = 0;
            }
            this.disposeAudio(this.fadingPreviewAudio);
            this.fadingPreviewAudio = null;
        }
    }

    stopPreviewProgressLoop() {
        if (this.playbackProgressFrameId) {
            cancelAnimationFrame(this.playbackProgressFrameId);
            this.playbackProgressFrameId = null;
        }
    }

    startPreviewProgressLoop() {
        this.stopPreviewProgressLoop();

        const tick = () => {
            if (!this.previewAudio) {
                this.playbackProgressFrameId = null;
                return;
            }

            this.emitProgress();

            if (this.isPreviewPlaying && !this.previewAudio.paused && !this.previewAudio.ended) {
                this.playbackProgressFrameId = requestAnimationFrame(tick);
            } else {
                this.playbackProgressFrameId = null;
            }
        };

        this.playbackProgressFrameId = requestAnimationFrame(tick);
    }

    getAdaptiveCrossfadeDurationMs(outgoingAudio, incomingAudio) {
        const outgoingDuration = Number.isFinite(outgoingAudio?.duration) ? outgoingAudio.duration : 30;
        const incomingDuration = Number.isFinite(incomingAudio?.duration) ? incomingAudio.duration : 30;
        const outgoingCurrentTime = outgoingAudio?.currentTime ?? 0;
        const outgoingRemaining = Number.isFinite(outgoingAudio?.duration)
            ? Math.max(outgoingAudio.duration - outgoingCurrentTime, 0)
            : 30;
        const outgoingProgress = outgoingDuration > 0 ? outgoingCurrentTime / outgoingDuration : 0.5;

        let duration = Math.min(outgoingRemaining, incomingDuration, 8) * 180;

        if (outgoingProgress < 0.12) duration *= 0.72;
        if (outgoingRemaining < 2.5) duration *= 0.68;
        if (incomingDuration < 12) duration *= 0.9;

        return Math.max(320, Math.min(1600, duration));
    }

    disposeAudio(audio) {
        if (!audio) {
            return;
        }

        if (Array.isArray(audio._previewListeners)) {
            audio._previewListeners.forEach(({ type, handler }) => {
                audio.removeEventListener(type, handler);
            });
            delete audio._previewListeners;
        }

        audio.pause();
        audio.removeAttribute('src');
        audio.load();
    }

    attachPreviewAudioEvents(audio, seedSource, requestId = null) {
        const listeners = [];
        const addListener = (type, handler) => {
            audio.addEventListener(type, handler);
            listeners.push({ type, handler });
        };

        const onError = (error) => {
            console.error('[Preview] Audio load/play error:', error);
            if (this.previewAudio !== audio) {
                return;
            }

            this.disposeAudio(audio);
            this.previewAudio = null;
            this.isPreviewPlaying = false;
            this.syncVisualizer('pause');
            this.stopPreviewProgressLoop();
            this.callbacks.onStatus('Preview unavailable');
            this.callbacks.onError('Failed to load audio preview', error);
            this.emitStateChange();
        };

        const onLoadedMetadata = () => {
            if (this.previewAudio !== audio && !(Number.isFinite(requestId) && this.isCurrentRequest(requestId))) {
                return;
            }

            this.resetAudioPosition(audio);
            this.callbacks.onMetadata({
                duration: audio.duration,
                seedSource
            });
            this.emitProgress(audio);
        };

        const onTimeUpdate = () => {
            if (this.previewAudio !== audio) {
                return;
            }

            this.emitProgress();
        };

        const onEnded = () => {
            if (this.previewAudio !== audio) {
                return;
            }

            this.isPreviewPlaying = false;
            this.syncVisualizer('pause');
            this.stopPreviewProgressLoop();
            this.callbacks.onStatus('Preview ended');
            this.emitStateChange();
        };

        addListener('error', onError);
        addListener('loadedmetadata', onLoadedMetadata);
        addListener('timeupdate', onTimeUpdate);
        addListener('ended', onEnded);

        audio._previewListeners = listeners;
    }

    createPreviewAudio(previewUrl) {
        const audio = this.buildPreviewAudio(previewUrl);
        return this.awaitPreviewCanPlay(audio);
    }

    buildPreviewAudio(previewUrl) {
        const audio = new Audio(previewUrl);
        audio.preload = 'auto';
        return audio;
    }

    awaitPreviewCanPlay(audio) {
        return new Promise((resolve, reject) => {
            const onCanPlay = () => {
                cleanup();
                resolve(audio);
            };

            const onError = () => {
                cleanup();
                reject(new Error('Failed to load audio preview'));
            };

            const cleanup = () => {
                audio.removeEventListener('canplay', onCanPlay);
                audio.removeEventListener('loadeddata', onCanPlay);
                audio.removeEventListener('error', onError);
            };

            audio.addEventListener('canplay', onCanPlay, { once: true });
            audio.addEventListener('loadeddata', onCanPlay, { once: true });
            audio.addEventListener('error', onError, { once: true });
            audio.load();

            if (audio.readyState >= 3) {
                onCanPlay();
            }
        });
    }

    startCrossfade(outgoingAudio, incomingAudio) {
        this.stopCrossfade();

        this.fadingPreviewAudio = outgoingAudio;
        const startTime = performance.now();
        const durationMs = this.getAdaptiveCrossfadeDurationMs(outgoingAudio, incomingAudio);
        this.callbacks.onStatus(`Adaptive crossfade ${Math.round(durationMs / 10) / 100}s`);

        const fade = (now) => {
            const progress = Math.min((now - startTime) / durationMs, 1);
            const clampedProgress = Math.max(0, Math.min(1, progress));
            const incomingVolume = Math.max(0, Math.min(1, Math.sin(clampedProgress * Math.PI * 0.5)));
            const outgoingVolume = Math.max(0, Math.min(1, Math.cos(clampedProgress * Math.PI * 0.5)));

            incomingAudio.volume = incomingVolume;
            outgoingAudio.volume = outgoingVolume;

            if (clampedProgress < 1) {
                this.crossfadeFrameId = requestAnimationFrame(fade);
                return;
            }

            this.stopCrossfade();
            incomingAudio.volume = 1;
            this.callbacks.onStatus('Crossfade complete');
        };

        this.crossfadeFrameId = requestAnimationFrame(fade);
    }

    emitProgress(audio = this.previewAudio) {
        const currentTime = audio?.currentTime ?? 0;
        const duration = audio?.duration ?? NaN;
        const percent = Number.isFinite(duration) && duration > 0
            ? Math.max(0, Math.min(1, currentTime / duration))
            : 0;

        this.callbacks.onProgress({ currentTime, duration, percent });
    }

    emitStateChange() {
        this.callbacks.onStateChange({
            isPlaying: this.isPreviewPlaying,
            isLoading: this.isPreviewLoading,
            audio: this.previewAudio
        });
    }

    syncVisualizer(action, audio = this.previewAudio) {
        if (!this.audioVisualizer) {
            return;
        }

        if (action === 'play' && audio) {
            this.audioVisualizer.play(audio);
            return;
        }

        this.audioVisualizer.pause();
    }
}
