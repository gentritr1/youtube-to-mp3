import { Router } from 'express';
import { buildPointAssistantResponse } from '../services/pointAssistant.js';

const router = Router();

router.post('/', (req, res) => {
    const { sessionId, userText = '', uiSnapshot } = req.body ?? {};

    if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ message: 'sessionId is required' });
    }

    if (!uiSnapshot || typeof uiSnapshot !== 'object') {
        return res.status(400).json({ message: 'uiSnapshot is required' });
    }

    if (uiSnapshot.schemaVersion !== '1.0') {
        return res.status(400).json({ message: 'Unsupported schemaVersion' });
    }

    try {
        const response = buildPointAssistantResponse(uiSnapshot, userText, sessionId);
        return res.json(response);
    } catch (error: any) {
        console.error('[assistant] Failed to build assistant response', error);
        return res.status(500).json({
            message: 'Failed to build assistant response',
            error: process.env.NODE_ENV === 'production'
                ? 'Internal server error'
                : (error?.message || 'Unknown error')
        });
    }
});

export default router;
