// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
    getRandomTracksFromGenres,
    isLivePopularVideo,
    loadPopularGenres,
    renderPopularGenreTabs,
    renderPopularRetryState,
    renderPopularVideoCarousel,
    resolveActiveGenreId,
    updatePopularGenreTabStyles
} from '../js/popularBrowser.js';

describe('popularBrowser', () => {
    it('loads genres and resolves the active genre defensively', async () => {
        const genres = await loadPopularGenres({
            fetchImpl: vi.fn(async () => ({
                ok: true,
                json: async () => ({
                    success: true,
                    genres: [
                        { id: 'global', videos: [] },
                        { id: 'rock', videos: [] }
                    ]
                })
            })) as any
        });

        expect(genres).toHaveLength(2);
        expect(resolveActiveGenreId(genres, 'rock')).toBe('rock');
        expect(resolveActiveGenreId(genres, 'missing')).toBe('global');
        expect(resolveActiveGenreId([], 'missing')).toBe('');
    });

    it('renders retry state and genre tabs with click handling', () => {
        const videoCarousel = document.createElement('div');
        const genreTabs = document.createElement('div');
        const onRetry = vi.fn();
        const onSelectGenre = vi.fn();

        renderPopularRetryState({ videoCarousel, onRetry });
        videoCarousel.querySelector<HTMLButtonElement>('.popular-retry-btn')?.click();
        expect(onRetry).toHaveBeenCalledTimes(1);

        renderPopularGenreTabs({
            genreTabs,
            genres: [
                { id: 'global', name: 'Global', icon: 'G', color: '#111' },
                { id: 'rock', name: 'Rock', icon: 'R', color: '#222' }
            ],
            activeGenre: 'rock',
            onSelectGenre
        });

        const buttons = genreTabs.querySelectorAll<HTMLButtonElement>('.genre-tab');
        expect(buttons).toHaveLength(2);
        expect(buttons[1].classList.contains('active')).toBe(true);
        buttons[0].click();
        expect(onSelectGenre).toHaveBeenCalledWith('global');

        updatePopularGenreTabStyles({
            genreTabs,
            genres: [
                { id: 'global', color: '#111' },
                { id: 'rock', color: '#222' }
            ],
            genreId: 'global'
        });
        expect(buttons[0].classList.contains('active')).toBe(true);
        expect(buttons[0].style.getPropertyValue('--genre-accent')).toBe('#111');
    });

    it('renders carousel cards and routes preview/convert interactions', () => {
        const activeGenreSummary = document.createElement('div');
        const videoCarousel = document.createElement('div');
        const onShowPreview = vi.fn();
        const onConvertVideo = vi.fn();
        const genres = [
            {
                id: 'global',
                name: 'Global',
                icon: 'G',
                color: '#111',
                description: 'Global picks',
                videos: [
                    { videoId: 'vid1', thumbnail: 'thumb1', title: 'Track One', duration: '3:20', artist: 'Artist One' },
                    { videoId: 'vid2', thumbnail: 'thumb2', title: 'Track Two', duration: 'LIVE', artist: 'Artist Two', isLive: true }
                ]
            }
        ];

        const genre = renderPopularVideoCarousel({
            videoCarousel,
            activeGenreSummary,
            genres,
            genreId: 'global',
            onShowPreview,
            onConvertVideo
        });

        expect(genre?.id).toBe('global');
        expect(activeGenreSummary.textContent).toContain('Global');
        expect(videoCarousel.querySelectorAll('.video-card')).toHaveLength(2);

        videoCarousel.querySelector<HTMLElement>('.video-card [data-action="preview"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(onShowPreview).toHaveBeenCalledWith(genres[0].videos[0]);

        videoCarousel.querySelectorAll<HTMLElement>('.video-card')[1]?.click();
        expect(onConvertVideo).toHaveBeenCalledWith(genres[0].videos[1]);
        expect(isLivePopularVideo(genres[0].videos[1])).toBe(true);
    });

    it('returns unique non-live random tracks from genres', () => {
        const trackA = { videoId: 'a', duration: '3:20' };
        const trackB = { videoId: 'b', duration: 'LIVE', isLive: true };
        const trackC = { videoId: 'c', duration: '2:50' };
        const genres = [
            { id: 'global', videos: [trackA, trackB] },
            { id: 'rock', videos: [trackA, trackC] }
        ];

        const result = getRandomTracksFromGenres(genres, 4);
        const ids = result.map((track) => track.videoId).sort();

        expect(ids).toEqual(['a', 'c']);
    });
});
