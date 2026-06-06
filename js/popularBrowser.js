export const isLivePopularVideo = (video) => Boolean(video?.isLive || video?.duration === 'LIVE');

export const resolveActiveGenreId = (genres, activeGenre) => {
    if (!Array.isArray(genres) || genres.length === 0) {
        return '';
    }

    if (genres.some((genre) => genre.id === activeGenre)) {
        return activeGenre;
    }

    return genres.find((genre) => genre.id === 'global')?.id || genres[0]?.id || '';
};

export const loadPopularGenres = async ({
    fetchImpl = fetch,
    endpoint = '/api/popular'
} = {}) => {
    const response = await fetchImpl(endpoint);

    if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success || !data.genres) {
        throw new Error(data.message || 'Invalid response from server');
    }

    return data.genres;
};

export const renderPopularRetryState = ({
    videoCarousel,
    onRetry = () => {}
} = {}) => {
    if (!videoCarousel) {
        return;
    }

    videoCarousel.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--muted-foreground);">
            Unable to load suggestions. <button class="popular-retry-btn" type="button" style="color: var(--foreground); text-decoration: underline; background: none; border: none; cursor: pointer;">Retry</button>
        </div>
    `;
    videoCarousel.querySelector('.popular-retry-btn')?.addEventListener('click', onRetry);
};

export const renderPopularGenreTabs = ({
    genreTabs,
    genres,
    activeGenre,
    escapeHtml = (value) => String(value ?? ''),
    escapeAttr = (value) => String(value ?? ''),
    onSelectGenre = () => {}
} = {}) => {
    if (!genreTabs) {
        return;
    }

    genreTabs.innerHTML = (Array.isArray(genres) ? genres : []).map((genre) => `
        <button
            type="button"
            class="genre-tab ${genre.id === activeGenre ? 'active' : ''}" 
            data-genre="${escapeAttr(genre.id)}"
            style="--genre-accent: ${escapeAttr(genre.color)};"
            aria-pressed="${genre.id === activeGenre ? 'true' : 'false'}"
        >
            <span class="genre-tab-icon">${escapeHtml(genre.icon)}</span>
            <span>${escapeHtml(genre.name)}</span>
        </button>
    `).join('');

    genreTabs.querySelectorAll('.genre-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            onSelectGenre(tab.dataset.genre);
        });
    });
};

export const updatePopularGenreTabStyles = ({
    genreTabs,
    genres,
    genreId
} = {}) => {
    genreTabs?.querySelectorAll('.genre-tab').forEach((tab) => {
        const isActive = tab.dataset.genre === genreId;
        const tabGenre = (Array.isArray(genres) ? genres : []).find((entry) => entry.id === tab.dataset.genre);
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        if (tabGenre?.color) {
            tab.style.setProperty('--genre-accent', tabGenre.color);
        }
    });
};

export const renderPopularVideoCarousel = ({
    videoCarousel,
    activeGenreSummary,
    genres,
    genreId,
    escapeHtml = (value) => String(value ?? ''),
    escapeAttr = (value) => String(value ?? ''),
    onShowPreview = () => {},
    onConvertVideo = () => {}
} = {}) => {
    if (!videoCarousel) {
        return null;
    }

    const genre = (Array.isArray(genres) ? genres : []).find((entry) => entry.id === genreId);
    if (!genre) {
        return null;
    }

    if (activeGenreSummary) {
        activeGenreSummary.innerHTML = `
            <div class="popular-genre-card" style="--genre-accent: ${escapeAttr(genre.color)}">
                <span class="popular-genre-icon">${escapeHtml(genre.icon)}</span>
                <div class="popular-genre-copy">
                    <span class="popular-genre-label">${escapeHtml(genre.name)}</span>
                    <p class="popular-genre-description">${escapeHtml(genre.description || 'Curated tracks for preview and conversion.')}</p>
                </div>
                <span class="popular-genre-count">${genre.videos.length} tracks</span>
            </div>
        `;
    }

    videoCarousel.innerHTML = genre.videos.map((video, index) => `
        <article class="video-card" data-video-id="${escapeAttr(video.videoId)}" ${isLivePopularVideo(video) ? 'data-is-live="true"' : ''} style="--card-index: ${index}; --card-accent: ${escapeAttr(genre.color)}">
            <div class="video-card-thumbnail">
                <img src="${escapeAttr(video.thumbnail)}" alt="${escapeAttr(video.title)}" loading="lazy">
                <span class="video-card-duration">${escapeHtml(video.duration)}</span>
                ${video.tag ? `<span class="video-card-tag">${escapeHtml(video.tag)}</span>` : ''}
            </div>
            <div class="video-card-info">
                <span class="video-card-rank">${String(index + 1).padStart(2, '0')}</span>
                <h3 class="video-card-title">${escapeHtml(video.title)}</h3>
                <p class="video-card-artist">${escapeHtml(video.artist)}</p>
                <div class="video-card-actions">
                    <button type="button" class="video-action-btn${isLivePopularVideo(video) ? ' disabled' : ''}" data-action="preview" aria-label="${isLivePopularVideo(video) ? 'Preview unavailable for live streams' : `Preview ${escapeAttr(video.title)}`}" title="${isLivePopularVideo(video) ? 'Preview unavailable for live streams' : 'Preview'}" ${isLivePopularVideo(video) ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                        </svg>
                        <span>Preview</span>
                    </button>
                    <button type="button" class="video-action-btn" data-action="convert" aria-label="Convert ${escapeAttr(video.title)}" title="Convert">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        <span>Convert</span>
                    </button>
                </div>
            </div>
        </article>
    `).join('');

    videoCarousel.querySelectorAll('.video-card').forEach((card) => {
        const videoId = card.dataset.videoId;
        const video = genre.videos.find((entry) => entry.videoId === videoId);
        const videoIsLive = card.dataset.isLive === 'true';

        const previewBtn = card.querySelector('[data-action="preview"]');
        if (previewBtn && !videoIsLive) {
            previewBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                onShowPreview(video);
            });
        }

        card.querySelector('[data-action="convert"]')?.addEventListener('click', (event) => {
            event.stopPropagation();
            onConvertVideo(video);
        });
    });

    return genre;
};

export const getRandomTracksFromGenres = (genres, count = 4) => {
    if (!Array.isArray(genres) || genres.length === 0) {
        return [];
    }

    const globalVideos = genres
        .filter((genre) => genre.id === 'global')
        .flatMap((genre) => genre.videos || []);

    const otherVideos = genres
        .filter((genre) => genre.id !== 'global')
        .flatMap((genre) => genre.videos || []);

    const allVideos = [...globalVideos, ...otherVideos]
        .filter((video) => !isLivePopularVideo(video))
        .filter((video, index, videos) => videos.findIndex((candidate) => candidate.videoId === video.videoId) === index);

    if (allVideos.length < count) {
        return [...allVideos].sort(() => 0.5 - Math.random());
    }

    const shuffled = [...allVideos].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};
