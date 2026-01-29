/**
 * YT Converter Backend Server
 * Modular Express application with rate limiting and job queue
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { config } from './config.js';
import routes from './routes/index.js';
import { loadTasks } from './services/taskManager.js';
import { cleanupOldTasks, closeDatabase } from './services/sqliteTaskManager.js';
import { initializeQueue, closeQueue, getQueueStats, isEnabled as isQueueEnabled } from './services/jobQueue.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

const app = express();

// Trust proxy for rate limiting behind reverse proxy (Render, etc.)
if (config.IS_PROD) {
    app.set('trust proxy', 1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Serve static frontend files
app.use(express.static(config.ROOT_DIR));

// Ensure downloads directory exists
if (!fs.existsSync(config.DOWNLOADS_DIR)) {
    console.warn('Downloads folder does not exist, creating it...');
    fs.mkdirSync(config.DOWNLOADS_DIR, { recursive: true });
}

// Load persisted tasks (legacy support)
loadTasks();

// Dependency Checks
import { execSync } from 'child_process';
try {
    const ytdlpVer = execSync('yt-dlp --version').toString().trim();
    console.log(`[System] yt-dlp version: ${ytdlpVer}`);
} catch (e) {
    console.error('[System] CRITICAL: yt-dlp not found in path!');
}

try {
    const ffmpegVer = execSync('ffmpeg -version').toString().split('\n')[0];
    console.log(`[System] ffmpeg version: ${ffmpegVer}`);
} catch (e) {
    console.error('[System] CRITICAL: ffmpeg not found in path!');
}

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const queueStats = await getQueueStats();
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            queue: queueStats,
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message || 'Health check failed'
        });
    }
});

// API Routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

// Cleanup old downloads and tasks (run every hour)
const runCleanup = () => {
    const now = Date.now();

    // Clean up old files
    fs.readdirSync(config.DOWNLOADS_DIR).forEach(file => {
        // Only clean up mp3/mp4 files we created
        if (!file.endsWith('.mp3') && !file.endsWith('.mp4')) return;

        const filePath = `${config.DOWNLOADS_DIR}/${file}`;
        try {
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > config.FILE_MAX_AGE_MS) {
                fs.unlinkSync(filePath);
                console.log('[Cleanup] Removed file:', file);
            }
        } catch (e) {
            // File may have been deleted already
        }
    });

    // Clean up old tasks from SQLite
    try {
        const deletedTasks = cleanupOldTasks();
        if (deletedTasks > 0) {
            console.log(`[Cleanup] Removed ${deletedTasks} old tasks from database`);
        }
    } catch (e) {
        console.error('[Cleanup] Error cleaning tasks:', e.message);
    }
};

setInterval(runCleanup, config.CLEANUP_INTERVAL_MS);

// Initialize and start server
const startServer = async () => {
    // Try to initialize job queue (optional, falls back to direct processing)
    if (config.USE_QUEUE) {
        await initializeQueue();
    }

    app.listen(config.PORT, () => {
        console.log(`
╔════════════════════════════════════════════════════════════╗
║     YT Converter Server running on port ${config.PORT}              ║
╠════════════════════════════════════════════════════════════╣
║  Open: http://localhost:${config.PORT}                              ║
╠════════════════════════════════════════════════════════════╣
║  Features:                                                 ║
║    ✓ Rate limiting enabled                                 ║
║    ✓ SQLite task persistence                               ║
║    ${isQueueEnabled() ? '✓' : '○'} Job queue (Redis): ${isQueueEnabled() ? 'Connected' : 'Not available'}                      ║
╠════════════════════════════════════════════════════════════╣
║  Requirements:                                             ║
║    • yt-dlp: brew install yt-dlp                           ║
║    • ffmpeg: brew install ffmpeg                           ║
╚════════════════════════════════════════════════════════════╝
`);
    });
};

// Graceful shutdown
const shutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);

    try {
        await closeQueue();
        closeDatabase();
        console.log('[Server] Cleanup complete, exiting.');
        process.exit(0);
    } catch (e) {
        console.error('[Server] Error during shutdown:', e);
        process.exit(1);
    }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the server
startServer();

export default app;

