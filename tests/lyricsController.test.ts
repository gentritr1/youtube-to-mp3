import { describe, expect, it } from 'vitest';
import { LyricsController } from '../js/lyrics.js';

describe('LyricsController subtitle parsing', () => {
    it('parses WEBVTT cue start times instead of using synthetic 2-second spacing', () => {
        const controller = new LyricsController();
        const vtt = `WEBVTT

00:00:01.500 --> 00:00:03.000
First line

00:00:05.250 --> 00:00:07.000
Second line`;

        const parsed = controller.parseSubtitles(vtt, 'vtt');

        expect(parsed).toEqual([
            { text: 'First line', time: 1500, hasTiming: true, isApproximate: false },
            { text: 'Second line', time: 5250, hasTiming: true, isApproximate: false }
        ]);
    });

    it('marks plain text fallbacks as approximate timing', () => {
        const controller = new LyricsController();
        const parsed = controller.parseSubtitles('Line one\nLine two', 'txt');

        expect(parsed).toEqual([
            { text: 'Line one', time: 0, hasTiming: false, isApproximate: true },
            { text: 'Line two', time: 2000, hasTiming: false, isApproximate: true }
        ]);
    });
});
