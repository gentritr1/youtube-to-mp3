import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: 'Subtitle URL is required' });
    }

    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return res.status(400).json({ message: 'Invalid URL protocol' });
        }
        
        const allowedDomains = ['youtube.com', 'youtu.be', 'google.com', 'googlevideo.com'];
        const isAllowed = allowedDomains.some(domain => 
            parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
        );

        if (!isAllowed) {
            return res.status(400).json({ message: 'Domain not allowed' });
        }
    } catch (e) {
        return res.status(400).json({ message: 'Invalid URL' });
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
