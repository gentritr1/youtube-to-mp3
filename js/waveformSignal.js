const DEFAULT_SAMPLE_COUNT = 192;
const TARGET_READS_PER_SAMPLE = 96;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getAudioContextConstructor = () => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.AudioContext || window.webkitAudioContext || null;
};

const decodeAudioData = (audioContext, audioData) => new Promise((resolve, reject) => {
    const maybePromise = audioContext.decodeAudioData(audioData, resolve, reject);
    if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(resolve, reject);
    }
});

const smoothSamples = (samples) => samples.map((sample, index) => {
    const previous = samples[index - 1] ?? sample;
    const next = samples[index + 1] ?? sample;
    return (previous * 0.22) + (sample * 0.56) + (next * 0.22);
});

export const buildWaveformSamples = (audioBuffer, sampleCount = DEFAULT_SAMPLE_COUNT) => {
    const length = audioBuffer?.length ?? 0;
    const channels = audioBuffer?.numberOfChannels ?? 0;
    if (!length || !channels || sampleCount <= 0) {
        return [];
    }

    const bins = Array.from({ length: sampleCount }, () => ({
        count: 0,
        peak: 0,
        squareSum: 0
    }));
    const stride = Math.max(1, Math.floor(length / (sampleCount * TARGET_READS_PER_SAMPLE)));

    for (let channel = 0; channel < channels; channel += 1) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let frame = 0; frame < length; frame += stride) {
            const binIndex = Math.min(sampleCount - 1, Math.floor((frame / length) * sampleCount));
            const value = Math.abs(channelData[frame] || 0);
            const bin = bins[binIndex];
            bin.peak = Math.max(bin.peak, value);
            bin.squareSum += value * value;
            bin.count += 1;
        }
    }

    const rawSamples = bins.map((bin) => {
        if (!bin.count) {
            return 0;
        }

        const rms = Math.sqrt(bin.squareSum / bin.count);
        return (rms * 0.78) + (bin.peak * 0.22);
    });
    const smoothedSamples = smoothSamples(rawSamples);
    const maxEnergy = Math.max(...smoothedSamples, 0.001);

    return smoothedSamples.map((sample) => clamp(sample / maxEnergy, 0, 1));
};

export const loadWaveformSamples = async (previewUrl, { signal, sampleCount = DEFAULT_SAMPLE_COUNT } = {}) => {
    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor || typeof fetch !== 'function') {
        return [];
    }

    const response = await fetch(previewUrl, { signal });
    if (!response.ok) {
        throw new Error(`Waveform audio request failed: ${response.status}`);
    }

    const audioData = await response.arrayBuffer();
    const audioContext = new AudioContextConstructor();

    try {
        const audioBuffer = await decodeAudioData(audioContext, audioData.slice(0));
        return buildWaveformSamples(audioBuffer, sampleCount);
    } finally {
        if (typeof audioContext.close === 'function') {
            const closeResult = audioContext.close();
            if (closeResult && typeof closeResult.catch === 'function') {
                closeResult.catch(() => {});
            }
        }
    }
};
