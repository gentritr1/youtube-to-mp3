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

// Curated genre data - Using classic, reliable videos that work consistently
// Updated periodically or cached with Redis
const GENRES: Record<string, GenreData> = {
    pop: {
        name: 'Pop Hits',
        icon: '🎤',
        color: '#10b981',
        videos: [
            {
                videoId: 'dQw4w9WgXcQ',
                title: 'Never Gonna Give You Up',
                artist: 'Rick Astley',
                thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
                duration: '3:33'
            },
            {
                videoId: 'djV11Xbc914',
                title: 'Take On Me',
                artist: 'a-ha',
                thumbnail: 'https://img.youtube.com/vi/djV11Xbc914/mqdefault.jpg',
                duration: '3:50'
            },
            {
                videoId: '9bZkp7q19f0',
                title: 'Gangnam Style',
                artist: 'PSY',
                thumbnail: 'https://img.youtube.com/vi/9bZkp7q19f0/mqdefault.jpg',
                duration: '4:13'
            },
            {
                videoId: 'kJQP7kiw5Fk',
                title: 'Despacito',
                artist: 'Luis Fonsi ft. Daddy Yankee',
                thumbnail: 'https://img.youtube.com/vi/kJQP7kiw5Fk/mqdefault.jpg',
                duration: '4:42'
            }
        ]
    },
    hiphop: {
        name: 'Hip-Hop & Rap',
        icon: '🎧',
        color: '#8b5cf6',
        videos: [
            {
                videoId: 'RgKAFK5djSk',
                title: 'See You Again',
                artist: 'Wiz Khalifa ft. Charlie Puth',
                thumbnail: 'https://img.youtube.com/vi/RgKAFK5djSk/mqdefault.jpg',
                duration: '3:57'
            },
            {
                videoId: 'hT_nvWreIhg',
                title: 'Counting Stars',
                artist: 'OneRepublic',
                thumbnail: 'https://img.youtube.com/vi/hT_nvWreIhg/mqdefault.jpg',
                duration: '4:44'
            },
            {
                videoId: 'fRh_vgS2dFE',
                title: 'Sorry',
                artist: 'Justin Bieber',
                thumbnail: 'https://img.youtube.com/vi/fRh_vgS2dFE/mqdefault.jpg',
                duration: '3:26'
            },
            {
                videoId: 'YqeW9_5kURI',
                title: "God's Plan",
                artist: 'Drake',
                thumbnail: 'https://img.youtube.com/vi/YqeW9_5kURI/mqdefault.jpg',
                duration: '5:56'
            }
        ]
    },
    electronic: {
        name: 'Electronic & EDM',
        icon: '🎛️',
        color: '#0ea5e9',
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
                videoId: 'FTQbiNvZqaY',
                title: 'Africa',
                artist: 'Toto',
                thumbnail: 'https://img.youtube.com/vi/FTQbiNvZqaY/mqdefault.jpg',
                duration: '4:55'
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
        color: '#ef4444',
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
                videoId: 'kXYiU_JCYtU',
                title: 'Numb',
                artist: 'Linkin Park',
                thumbnail: 'https://img.youtube.com/vi/kXYiU_JCYtU/mqdefault.jpg',
                duration: '3:07'
            }
        ]
    },
    chill: {
        name: 'Chill & Acoustic',
        icon: '☕',
        color: '#f59e0b',
        videos: [
            {
                videoId: 'YQHsXMglC9A',
                title: 'Hello',
                artist: 'Adele',
                thumbnail: 'https://img.youtube.com/vi/YQHsXMglC9A/mqdefault.jpg',
                duration: '6:07'
            },
            {
                videoId: 'lTRiuFIWV54',
                title: 'Let Her Go',
                artist: 'Passenger',
                thumbnail: 'https://img.youtube.com/vi/lTRiuFIWV54/mqdefault.jpg',
                duration: '4:15'
            },
            {
                videoId: 'PT2_F-1esPk',
                title: 'All of Me',
                artist: 'John Legend',
                thumbnail: 'https://img.youtube.com/vi/PT2_F-1esPk/mqdefault.jpg',
                duration: '4:30'
            },
            {
                videoId: 'pB-5XG-DbAA',
                title: 'All Star',
                artist: 'Smash Mouth',
                thumbnail: 'https://img.youtube.com/vi/pB-5XG-DbAA/mqdefault.jpg',
                duration: '3:21'
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
