import { describe, expect, it } from 'vitest';
import { buildWaveformSamples } from '../js/waveformSignal.js';

const createAudioBuffer = (channels: number[][]) => ({
    length: channels[0]?.length ?? 0,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => Float32Array.from(channels[channel] ?? [])
});

describe('waveformSignal', () => {
    it('builds normalized waveform samples from audio energy', () => {
        const audioBuffer = createAudioBuffer([
            [0.02, 0.02, 0.04, 0.05, 0.8, 0.9, 0.7, 0.62],
            [0.01, 0.03, 0.02, 0.04, 0.68, 0.78, 0.72, 0.64]
        ]);

        const samples = buildWaveformSamples(audioBuffer, 4);

        expect(samples).toHaveLength(4);
        expect(Math.max(...samples)).toBeCloseTo(1);
        expect(samples[0]).toBeLessThan(samples[2]);
        expect(samples[1]).toBeLessThan(samples[3]);
    });

    it('returns no samples when audio data is unavailable', () => {
        expect(buildWaveformSamples(null, 4)).toEqual([]);
        expect(buildWaveformSamples(createAudioBuffer([]), 4)).toEqual([]);
    });
});
