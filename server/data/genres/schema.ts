export interface GenreVideoInput {
    videoId: string;
    title: string;
    artist: string;
    duration: string;
    tag?: string;
    thumbnail?: string;
    isLive?: boolean;
}

export interface GenreFileInput {
    name: string;
    icon: string;
    color: string;
    description: string;
    order: number;
    enabled?: boolean;
    videos: GenreVideoInput[];
}

export interface GenreVideo {
    videoId: string;
    title: string;
    artist: string;
    duration: string;
    tag?: string;
    thumbnail: string;
    isLive?: boolean;
}

export interface GenreDefinition {
    id: string;
    name: string;
    icon: string;
    color: string;
    description: string;
    order: number;
    enabled: boolean;
    videos: GenreVideo[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

const buildThumbnail = (videoId: string, thumbnail?: string): string =>
    isNonEmptyString(thumbnail) ? thumbnail : `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

const parseVideo = (value: unknown, index: number): GenreVideo => {
    if (!isRecord(value)) {
        throw new Error(`videos[${index}] must be an object`);
    }

    const { videoId, title, artist, duration, tag, thumbnail, isLive } = value;

    if (!isNonEmptyString(videoId)) {
        throw new Error(`videos[${index}].videoId is required`);
    }
    if (!isNonEmptyString(title)) {
        throw new Error(`videos[${index}].title is required`);
    }
    if (!isNonEmptyString(artist)) {
        throw new Error(`videos[${index}].artist is required`);
    }
    if (!isNonEmptyString(duration)) {
        throw new Error(`videos[${index}].duration is required`);
    }
    if (tag !== undefined && !isNonEmptyString(tag)) {
        throw new Error(`videos[${index}].tag must be a non-empty string when provided`);
    }
    if (thumbnail !== undefined && !isNonEmptyString(thumbnail)) {
        throw new Error(`videos[${index}].thumbnail must be a non-empty string when provided`);
    }
    if (isLive !== undefined && typeof isLive !== 'boolean') {
        throw new Error(`videos[${index}].isLive must be a boolean when provided`);
    }

    return {
        videoId: videoId.trim(),
        title: title.trim(),
        artist: artist.trim(),
        duration: duration.trim(),
        tag: typeof tag === 'string' ? tag.trim() : undefined,
        thumbnail: buildThumbnail(videoId.trim(), typeof thumbnail === 'string' ? thumbnail.trim() : undefined),
        isLive
    };
};

export const parseGenreDefinition = (id: string, value: unknown): GenreDefinition => {
    if (!isRecord(value)) {
        throw new Error('genre file must contain an object');
    }

    const { name, icon, color, description, order, enabled, videos } = value;

    if (!isNonEmptyString(name)) {
        throw new Error('name is required');
    }
    if (!isNonEmptyString(icon)) {
        throw new Error('icon is required');
    }
    if (!isNonEmptyString(color)) {
        throw new Error('color is required');
    }
    if (!isNonEmptyString(description)) {
        throw new Error('description is required');
    }
    if (typeof order !== 'number' || !Number.isFinite(order)) {
        throw new Error('order must be a finite number');
    }
    if (enabled !== undefined && typeof enabled !== 'boolean') {
        throw new Error('enabled must be a boolean when provided');
    }
    if (!Array.isArray(videos) || videos.length === 0) {
        throw new Error('videos must be a non-empty array');
    }

    return {
        id,
        name: name.trim(),
        icon: icon.trim(),
        color: color.trim(),
        description: description.trim(),
        order,
        enabled: enabled ?? true,
        videos: videos.map((video, index) => parseVideo(video, index))
    };
};
