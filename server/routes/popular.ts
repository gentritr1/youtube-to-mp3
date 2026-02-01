/**
 * Popular Videos Route
 * GET /api/popular - Fetch curated music suggestions by genre
 */

import { Router, Request, Response } from 'express';

const router = Router();

// Genre-based curated video suggestions
// In production, this would integrate with YouTube Data API v3
// For now, using curated static data that can be updated periodically
interface VideoSuggestion {
    videoId: string;
    title: string;
    artist: string;
    thumbnail: string;
    duration: string;
    isLive?: boolean; // Flag for live streams (preview not supported)
}

interface GenreData {
    name: string;
    icon: string;
    color: string;
    videos: VideoSuggestion[];
}

// Curated genre data - This would be fetched from YouTube API in production
// Updated periodically or cached with Redis
const GENRES: Record<string, GenreData> = {
    pop: {
        name: 'Pop Hits',
        icon: '🎤',
        color: '#ff6b9d',
        videos: [
            {
                videoId: 'dQw4w9WgXcQ',
                title: 'Never Gonna Give You Up',
                artist: 'Rick Astley',
                thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
                duration: '3:33'
            },
            {
                videoId: 'kJQP7kiw5Fk',
                title: 'Despacito',
                artist: 'Luis Fonsi ft. Daddy Yankee',
                thumbnail: 'https://img.youtube.com/vi/kJQP7kiw5Fk/mqdefault.jpg',
                duration: '4:41'
            },
            {
                videoId: 'JGwWNGJdvx8',
                title: 'Shape of You',
                artist: 'Ed Sheeran',
                thumbnail: 'https://img.youtube.com/vi/JGwWNGJdvx8/mqdefault.jpg',
                duration: '4:24'
            },
            {
                videoId: 'OPf0YbXqDm0',
                title: 'Uptown Funk',
                artist: 'Mark Ronson ft. Bruno Mars',
                thumbnail: 'https://img.youtube.com/vi/OPf0YbXqDm0/mqdefault.jpg',
                duration: '4:30'
            }
        ]
    },
    hiphop: {
        name: 'Hip-Hop & Rap',
        icon: '🎧',
        color: '#9b59b6',
        videos: [
            {
                videoId: 'RgKAFK5djSk',
                title: 'See You Again',
                artist: 'Wiz Khalifa ft. Charlie Puth',
                thumbnail: 'https://img.youtube.com/vi/RgKAFK5djSk/mqdefault.jpg',
                duration: '3:57'
            },
            {
                videoId: '2zNSgSzhBfM',
                title: 'Lose Yourself',
                artist: 'Eminem',
                thumbnail: 'https://img.youtube.com/vi/2zNSgSzhBfM/mqdefault.jpg',
                duration: '5:26'
            },
            {
                videoId: 'YqeW9_5kURI',
                title: "God's Plan",
                artist: 'Drake',
                thumbnail: 'https://img.youtube.com/vi/YqeW9_5kURI/mqdefault.jpg',
                duration: '5:56'
            },
            {
                videoId: 'hT_nvWreIhg',
                title: 'Counting Stars',
                artist: 'OneRepublic',
                thumbnail: 'https://img.youtube.com/vi/hT_nvWreIhg/mqdefault.jpg',
                duration: '4:44'
            }
        ]
    },
    electronic: {
        name: 'Electronic & EDM',
        icon: '🎛️',
        color: '#00d4ff',
        videos: [
            {
                videoId: 'y6120QOlsfU',
                title: "Sandstorm",
                artist: 'Darude',
                thumbnail: 'https://img.youtube.com/vi/y6120QOlsfU/mqdefault.jpg',
                duration: '3:45'
            },
            {
                videoId: 'gCYcHz2k5x0',
                title: 'Levels',
                artist: 'Avicii',
                thumbnail: 'https://img.youtube.com/vi/gCYcHz2k5x0/mqdefault.jpg',
                duration: '3:19'
            },
            {
                videoId: 'IxxstCcJlsc',
                title: 'Titanium',
                artist: 'David Guetta ft. Sia',
                thumbnail: 'https://img.youtube.com/vi/IxxstCcJlsc/mqdefault.jpg',
                duration: '4:05'
            },
            {
                videoId: '60ItHLz5WEA',
                title: 'Wake Me Up',
                artist: 'Avicii',
                thumbnail: 'https://img.youtube.com/vi/60ItHLz5WEA/mqdefault.jpg',
                duration: '4:32'
            }
        ]
    },
    rock: {
        name: 'Rock Classics',
        icon: '🎸',
        color: '#e74c3c',
        videos: [
            {
                videoId: 'fJ9rUzIMcZQ',
                title: 'Bohemian Rhapsody',
                artist: 'Queen',
                thumbnail: 'https://img.youtube.com/vi/fJ9rUzIMcZQ/mqdefault.jpg',
                duration: '5:55'
            },
            {
                videoId: 'hTWKbfoikeg',
                title: 'Smells Like Teen Spirit',
                artist: 'Nirvana',
                thumbnail: 'https://img.youtube.com/vi/hTWKbfoikeg/mqdefault.jpg',
                duration: '5:01'
            },
            {
                videoId: 'Xsp3_a-PMTw',
                title: 'Another One Bites the Dust',
                artist: 'Queen',
                thumbnail: 'https://img.youtube.com/vi/Xsp3_a-PMTw/mqdefault.jpg',
                duration: '3:35'
            },
            {
                videoId: '1w7OgIMMRc4',
                title: "Sweet Child O' Mine",
                artist: "Guns N' Roses",
                thumbnail: 'https://img.youtube.com/vi/1w7OgIMMRc4/mqdefault.jpg',
                duration: '5:56'
            }
        ]
    },
    chill: {
        name: 'Chill & Lofi',
        icon: '☕',
        color: '#2ecc71',
        videos: [
            {
                videoId: 'jfKfPfyJRdk',
                title: 'lofi hip hop radio - beats to relax/study to',
                artist: 'Lofi Girl',
                thumbnail: 'https://img.youtube.com/vi/jfKfPfyJRdk/mqdefault.jpg',
                duration: 'LIVE',
                isLive: true
            },
            {
                videoId: 'lTRiuFIWV54',
                title: 'Let Her Go',
                artist: 'Passenger',
                thumbnail: 'https://img.youtube.com/vi/lTRiuFIWV54/mqdefault.jpg',
                duration: '4:15'
            },
            {
                videoId: 'YQHsXMglC9A',
                title: 'Hello',
                artist: 'Adele',
                thumbnail: 'https://img.youtube.com/vi/YQHsXMglC9A/mqdefault.jpg',
                duration: '6:07'
            },
            {
                videoId: 'CvBfHwUxHIk',
                title: 'Blinding Lights',
                artist: 'The Weeknd',
                thumbnail: 'https://img.youtube.com/vi/CvBfHwUxHIk/mqdefault.jpg',
                duration: '4:22'
            }
        ]
    }
};

// Get all genres with their videos
router.get('/', async (_req: Request, res: Response) => {
    try {
        const genres = Object.entries(GENRES).map(([id, data]) => ({
            id,
            ...data
        }));

        res.json({
            success: true,
            genres,
            lastUpdated: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('[Popular] Error fetching genres:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch popular videos'
        });
    }
});

// Get videos for a specific genre
router.get('/:genre', async (req: Request, res: Response) => {
    const genre = req.params.genre as string;

    try {
        const genreData = GENRES[genre.toLowerCase()];

        if (!genreData) {
            return res.status(404).json({
                success: false,
                message: `Genre '${genre}' not found`,
                availableGenres: Object.keys(GENRES)
            });
        }

        res.json({
            success: true,
            genre: {
                id: genre.toLowerCase(),
                ...genreData
            }
        });
    } catch (error: any) {
        console.error('[Popular] Error fetching genre:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch genre'
        });
    }
});

export default router;
