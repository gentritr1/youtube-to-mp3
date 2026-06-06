const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export const validateYouTubeVideoId = (videoId: unknown): string | null => {
    if (typeof videoId !== 'string') {
        return null;
    }

    const trimmed = videoId.trim();
    return YOUTUBE_VIDEO_ID_PATTERN.test(trimmed) ? trimmed : null;
};

export const buildYouTubeWatchUrl = (videoId: string): string => {
    const safeVideoId = validateYouTubeVideoId(videoId);
    if (!safeVideoId) {
        throw new Error('Invalid YouTube video ID');
    }

    return `https://www.youtube.com/watch?v=${safeVideoId}`;
};
