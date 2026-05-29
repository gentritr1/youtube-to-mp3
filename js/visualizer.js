/**
 * Web Audio Visualizer Module
 * Connects to the Audio preview elements and maps frequency data to CSS custom properties
 * to drive the background Zen animations dynamically based on the beat.
 */

const _AudioVisualizer = (() => {
    let audioContext = null;
    let analyserNode = null;
    let currentAudioElement = null;
    let sourceNode = null; // Track current source node
    const mediaSourceMap = new WeakMap(); // Cache nodes to avoid "already created" errors
    let animationFrameId = null;
    let dataArray = null;

    const initContext = () => {
        if (!audioContext) {
            // Support both standard and prefixed AudioContext
            const Ctx = window.AudioContext || window.webkitAudioContext;
            audioContext = new Ctx();
            analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = 256; // 128 frequency bins
            analyserNode.smoothingTimeConstant = 0.8;

            // Connect analyser to destination once
            analyserNode.connect(audioContext.destination);

            dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        }

        // Browsers require audio context to be resumed after user gesture
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    };

    const play = (audioElement) => {
        if (!audioElement) return;

        initContext();

        // If this is a new audio element, switch the source node connection
        if (currentAudioElement !== audioElement) {
            // Disconnect current source node from the analyser
            if (sourceNode) {
                sourceNode.disconnect();
            }

            currentAudioElement = audioElement;

            // Retrieve from cache or create new
            sourceNode = mediaSourceMap.get(audioElement);

            if (!sourceNode) {
                try {
                    // Cross origin needed in some browsers to capture audio from external domains
                    audioElement.crossOrigin = "anonymous";
                    sourceNode = audioContext.createMediaElementSource(audioElement);
                    mediaSourceMap.set(audioElement, sourceNode);
                } catch (error) {
                    console.warn('[AudioVisualizer] Failed to create source node.', error);
                }
            }

            // Connect the new/cached source to the analyser
            if (sourceNode) {
                try {
                    sourceNode.connect(analyserNode);
                } catch (error) {
                    console.warn('[AudioVisualizer] Failed to connect source node.', error);
                }
            }
        }

        startAnimationLoop();
    };

    const pause = () => {
        stopAnimationLoop();
        setCSSVariables(0, 0, 0); // Gracefully reset variables to zero
    };

    const startAnimationLoop = () => {
        if (animationFrameId) return; // Already running

        const loop = () => {
            animationFrameId = requestAnimationFrame(loop);
            analyserNode.getByteFrequencyData(dataArray);

            // Calculate frequency averages
            // For fftSize = 256, frequencyBinCount = 128
            // 0 - ~22kHz spread across 128 bins. Roughly ~172Hz per bin.

            // Lows (Bass): Bins 0 - 2 (~0Hz to 516Hz)
            const lows = getAverage(0, 2);
            // Mids: Bins 3 - 20 (~516Hz to 3.4kHz)
            const mids = getAverage(3, 20);
            // Highs: Bins 21 - 64 (~3.4kHz to 11kHz)
            const highs = getAverage(21, 64);

            // Normalize values from [0 - 255] to [0.0 - 1.0]
            setCSSVariables(lows / 255, mids / 255, highs / 255);
        };

        loop();
    };

    const stopAnimationLoop = () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    };

    const getAverage = (startIndex, endIndex) => {
        let sum = 0;
        for (let i = startIndex; i <= endIndex; i++) {
            sum += dataArray[i];
        }
        return sum / (endIndex - startIndex + 1);
    };

    const setCSSVariables = (lows, mids, highs) => {
        const root = document.documentElement;

        // Map lows to scale (adds up to 0.4x scale on heavy bass)
        // Map mids to opacity increase (adds up to 0.3 opacity)
        // Map highs to a slight hue rotation or brightness if desired

        // Cap values to prevent layout thrashing and extreme jumps
        const scaleBoost = (lows * 0.4).toFixed(3);
        const opacityBoost = (mids * 0.35).toFixed(3);

        root.style.setProperty('--audio-pulse-scale', scaleBoost);
        root.style.setProperty('--audio-pulse-opacity', opacityBoost);
    };

    return { play, pause };
})();

export { _AudioVisualizer as AudioVisualizer };
