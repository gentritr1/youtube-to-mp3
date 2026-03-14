import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: 'Subtitle URL is required' });
    }

    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            return res.status(response.status).json({ message: 'Failed to fetch subtitles' });
        }

        const text = await response.text();
        res.setHeader('Content-Type', 'text/plain');
        res.send(text);
    } catch (error: any) {
        console.error('[Lyrics API] Fetch error:', error);
        res.status(500).json({ message: 'Failed to fetch subtitles', error: error.message });
    }
});

export default router;
