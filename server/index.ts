/**
 * YT Converter Backend Server
 * Modular Express application with rate limiting and job queue
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import routes from './routes/index.js';
import { cleanupOldTasks, close as closeTaskStore, markProcessingTasksInterrupted } from './services/taskStore.js';
import { initializeQueue, closeQueue, getQueueStats, isEnabled as isQueueEnabled, registerProcessor } from './services/jobQueue.js';
import { initializeGenreCatalog, stopGenreCatalogWatcher } from './services/genreCatalog.js';
import { cleanupPreviews } from './services/previewService.js';
import { convertVideo } from './services/ytdlp.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { buildYouTubeWatchUrl } from './utils/youtube.js';

const app = express();

// Trust proxy for rate limiting behind reverse proxy (Render, etc.)
if (config.IS_PROD) {
    app.set('trust proxy', 1);
}

// Middleware
app.use(cors({
    origin: (origin, callback) => {
        if (!config.IS_PROD || !origin || config.ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error('CORS origin not allowed'));
    }
}));
app.use(express.json());

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Serve only explicit frontend assets. Runtime data such as downloads, SQLite
// files, cookies, source files, and node_modules must never be reachable via
// the static middleware.
const sendRootFile = (fileName: string) => (_req: express.Request, res: express.Response) => {
    res.sendFile(path.join(config.ROOT_DIR, fileName));
};

app.get('/', sendRootFile('index.html'));
for (const fileName of [
    'index.html',
    'time-sync-studio.html',
    'app.js',
    'style.css',
    'manifest.json',
    'service-worker.js',
    'service-worker-assets.js'
]) {
    app.get(`/${fileName}`, sendRootFile(fileName));
}

app.use('/css', express.static(path.join(config.ROOT_DIR, 'css')));
app.use('/js', express.static(path.join(config.ROOT_DIR, 'js')));
app.use('/assets', express.static(path.join(config.ROOT_DIR, 'assets')));

// Ensure downloads directory exists
if (!fs.existsSync(config.DOWNLOADS_DIR)) {
    console.warn('Downloads folder does not exist, creating it...');
    fs.mkdirSync(config.DOWNLOADS_DIR, { recursive: true });
}



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
app.get('/health', async (req: express.Request, res: express.Response) => {
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
    } catch (error: any) {
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
    try {
        fs.readdirSync(config.DOWNLOADS_DIR).forEach(file => {
            // Only clean up mp3/mp4 files we created
            if (!file.endsWith('.mp3') && !file.endsWith('.mp4')) return;

            const filePath = path.join(config.DOWNLOADS_DIR, file);
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
    } catch (e: any) {
        console.error('[Cleanup] Error reading downloads directory:', e.message);
    }

    // Clean up old tasks from SQLite
    try {
        const deletedTasks = cleanupOldTasks();
        if (deletedTasks > 0) {
            console.log(`[Cleanup] Removed ${deletedTasks} old tasks from database`);
        }
    } catch (e: any) {
        console.error('[Cleanup] Error cleaning tasks:', e.message);
    }

    try {
        const deletedPreviews = cleanupPreviews();
        if (deletedPreviews > 0) {
            console.log(`[Cleanup] Removed ${deletedPreviews} expired previews`);
        }
    } catch (e: any) {
        console.error('[Cleanup] Error cleaning previews:', e.message);
    }
};

setInterval(runCleanup, config.CLEANUP_INTERVAL_MS);

// Initialize and start server
const startServer = async () => {
    await initializeGenreCatalog();
    const interruptedTasks = markProcessingTasksInterrupted();
    if (interruptedTasks > 0) {
        console.warn(`[Startup] Marked ${interruptedTasks} interrupted processing task(s) as errored`);
    }

    // Try to initialize job queue (optional, falls back to direct processing)
    if (config.USE_QUEUE) {
        const queueReady = await initializeQueue();
        if (queueReady) {
            registerProcessor(async (taskId, videoId, format) => {
                await convertVideo(taskId, buildYouTubeWatchUrl(videoId), format);
            });
        }
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
const shutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);

    try {
        stopGenreCatalogWatcher();
        await closeQueue();
        closeTaskStore();
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
