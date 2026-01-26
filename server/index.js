/**
 * YT Converter Backend Server
 * Modular Express application
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { config } from './config.js';
import routes from './routes/index.js';
import { loadTasks } from './services/taskManager.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(config.ROOT_DIR));

// Ensure downloads directory exists
if (!fs.existsSync(config.DOWNLOADS_DIR)) {
    console.warn('Downloads folder does not exist, creating it...');
    fs.mkdirSync(config.DOWNLOADS_DIR, { recursive: true });
}

// Load persisted tasks
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

// API Routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

// Cleanup old downloads (run every hour)
setInterval(() => {
    const now = Date.now();

    fs.readdirSync(config.DOWNLOADS_DIR).forEach(file => {
        // Only clean up mp3/mp4 files we created
        if (!file.endsWith('.mp3') && !file.endsWith('.mp4')) return;

        const filePath = `${config.DOWNLOADS_DIR}/${file}`;
        try {
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > config.FILE_MAX_AGE_MS) {
                fs.unlinkSync(filePath);
                console.log('[Cleanup] Removed:', file);
            }
        } catch (e) {
            // File may have been deleted already
        }
    });
}, config.CLEANUP_INTERVAL_MS);

// Start server
app.listen(config.PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║  YT Converter Server running on port ${config.PORT}  ║
╚════════════════════════════════════════════╝

Open: http://localhost:${config.PORT}

Requirements:
  • yt-dlp: brew install yt-dlp
  • ffmpeg: brew install ffmpeg
`);
});

export default app;
