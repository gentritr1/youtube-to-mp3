/**
 * Popular Videos Route
 * GET /api/popular - Fetch curated music suggestions by genre
 */

import { Router, Request, Response } from 'express';
import { getGenreById, getGenres } from '../services/genreCatalog.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
    try {
        res.json({
            success: true,
            genres: getGenres(),
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

router.get('/:genre', async (req: Request, res: Response) => {
    const genre = req.params.genre as string;

    try {
        const genreData = getGenreById(genre);

        if (!genreData) {
            return res.status(404).json({
                success: false,
                message: `Genre '${genre}' not found`,
                availableGenres: getGenres().map(item => item.id)
            });
        }

        res.json({
            success: true,
            genre: genreData
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
