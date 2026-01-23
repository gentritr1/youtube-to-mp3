/**
 * YT Converter Backend Server
 * Uses yt-dlp for YouTube video/audio extraction
 */

import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(__dirname));

// Use user's Downloads folder instead of project folder
const downloadsDir = path.join(process.env.HOME || process.env.USERPROFILE, 'Downloads');
console.log('Downloads directory:', downloadsDir);

// Ensure downloads directory exists (it should already exist)
if (!fs.existsSync(downloadsDir)) {
    console.warn('Downloads folder does not exist, creating it...');
    fs.mkdirSync(downloadsDir, { recursive: true });
}

// Persistent task store
const TASKS_FILE = path.join(__dirname, 'tasks.json');
let tasks = new Map();

// Load tasks from disk
try {
    if (fs.existsSync(TASKS_FILE)) {
        const data = fs.readFileSync(TASKS_FILE, 'utf8');
        tasks = new Map(JSON.parse(data));
        console.log(`Loaded ${tasks.size} tasks from disk`);
    }
} catch (error) {
    console.error('Failed to load tasks:', error);
}

// Save tasks to disk
function saveTasks() {
    try {
        fs.writeFileSync(TASKS_FILE, JSON.stringify([...tasks]), 'utf8');
    } catch (error) {
        console.error('Failed to save tasks:', error);
    }
}

/**
 * Get video info using yt-dlp
 */
app.get('/api/info', async (req, res) => {
    const { videoId } = req.query;

    if (!videoId) {
        return res.status(400).json({ message: 'Video ID required' });
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;

    try {
        const info = await getVideoInfo(url);
        res.json(info);
    } catch (error) {
        console.error('Info error:', error);
        res.status(500).json({ message: error.message || 'Failed to get video info' });
    }
});

/**
 * Start conversion task
 */
app.post('/api/convert', async (req, res) => {
    const { videoId, format } = req.body;

    if (!videoId || !format) {
        return res.status(400).json({ message: 'Video ID and format required' });
    }

    if (!['mp3', 'mp4'].includes(format)) {
        return res.status(400).json({ message: 'Format must be mp3 or mp4' });
    }

    const taskId = randomUUID();
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    // Get video title first if not provided in request
    let title = req.body.title || 'video';

    // Initialize task
    tasks.set(taskId, {
        state: 'processing',
        progress: 0,
        status: 'Starting...',
        videoId,
        format,
        title,
    });

    // Start conversion in background
    convertVideo(taskId, url, format);

    res.json({ taskId });
});

/**
 * Get conversion progress
 */
app.get('/api/progress/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = tasks.get(taskId);

    if (!task) {
        return res.status(404).json({ message: 'Task not found' });
    }

    res.json(task);
});

/**
 * Download file with human-friendly name
 * The :filename param is optional and helps browsers set the name
 */
app.get('/api/download/:taskId/:filename?', (req, res) => {
    const { taskId } = req.params;
    const task = tasks.get(taskId);

    if (!task || task.state !== 'completed') {
        return res.status(404).json({ message: 'File not found or still processing' });
    }

    // Use the sanitized filename stored in the task
    const filePath = path.join(downloadsDir, task.filename);

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return res.status(404).json({ message: 'File no longer exists' });
    }

    // Explicitly set content type
    const contentType = task.format === 'mp3' ? 'audio/mpeg' : 'video/mp4';
    res.setHeader('Content-Type', contentType);

    console.log(`[Download] Serving file: ${task.filename}`);
    res.download(filePath, task.filename);
});

/**
 * Get video info using yt-dlp
 */
function getVideoInfo(url) {
    return new Promise((resolve, reject) => {
        const args = [
            '--dump-json',
            '--no-warnings',
            url
        ];

        const ytdlp = spawn('yt-dlp', args);
        let stdout = '';
        let stderr = '';

        ytdlp.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        ytdlp.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ytdlp.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr || 'Failed to get video info'));
                return;
            }

            try {
                const info = JSON.parse(stdout);
                resolve({
                    id: info.id,
                    title: info.title,
                    thumbnail: info.thumbnail,
                    author: info.uploader || info.channel,
                    duration: formatDuration(info.duration),
                });
            } catch (e) {
                reject(new Error('Failed to parse video info'));
            }
        });

        ytdlp.on('error', (err) => {
            if (err.code === 'ENOENT') {
                reject(new Error('yt-dlp not installed. Run: brew install yt-dlp'));
            } else {
                reject(err);
            }
        });
    });
}

/**
 * Convert video using yt-dlp
 */
function convertVideo(taskId, url, format) {
    const task = tasks.get(taskId);

    // Generate sanitized filename for the output
    const safeTitle = (task.title || 'video')
        .replace(/[<>:"/\\|?*✦]/g, '')  // Remove invalid chars and special symbols
        .replace(/[^\x00-\x7F]/g, '')    // Remove non-ASCII characters
        .replace(/\s+/g, '_')            // Replace spaces with underscores
        .replace(/_{2,}/g, '_')          // Replace multiple underscores with single
        .replace(/^_|_$/g, '')           // Remove leading/trailing underscores
        .substring(0, 100)               // Limit length
        || 'download';                   // Fallback if empty

    const filename = `${safeTitle}.%(ext)s`;
    const outputTemplate = path.join(downloadsDir, filename);

    // Store the expected filename for later
    task.filename = `${safeTitle}.${format}`;

    const args = format === 'mp3'
        ? [
            '-x',                           // Extract audio
            '--audio-format', 'mp3',        // Convert to MP3
            '--audio-quality', '0',         // Best quality
            '-o', outputTemplate,
            '--no-warnings',
            '--progress',
            url
        ]
        : [
            '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '--merge-output-format', 'mp4',
            '-o', outputTemplate,
            '--no-warnings',
            '--progress',
            url
        ];


    const ytdlp = spawn('yt-dlp', args);

    ytdlp.stdout.on('data', (data) => {
        const output = data.toString();
        const progress = parseProgress(output);

        if (progress) {
            task.progress = progress.percent;
            task.status = progress.status;
        }
    });

    ytdlp.stderr.on('data', (data) => {
        const output = data.toString();
        const progress = parseProgress(output);

        if (progress) {
            task.progress = progress.percent;
            task.status = progress.status;
        }
    });

    ytdlp.on('close', (code) => {
        if (code !== 0) {
            task.state = 'error';
            task.error = 'Conversion failed';
            saveTasks();
            return;
        }

        // Find the output file using the sanitized filename
        const outputPath = path.join(downloadsDir, task.filename);

        if (fs.existsSync(outputPath)) {
            task.state = 'completed';
            task.progress = 100;
            task.status = 'Complete!';
            task.downloadUrl = `/api/download/${taskId}/${encodeURIComponent(task.filename)}`;
            saveTasks();
        } else {
            task.state = 'error';
            task.error = `Output file not found: ${task.filename}`;
            saveTasks();
        }
    });

    ytdlp.on('error', (err) => {
        task.state = 'error';
        task.error = err.code === 'ENOENT'
            ? 'yt-dlp not installed'
            : err.message;
        saveTasks();
    });
}

/**
 * Parse yt-dlp progress output
 */
function parseProgress(output) {
    // Match: [download] 45.3% of 10.5MiB at 1.2MiB/s
    const downloadMatch = output.match(/\[download\]\s+([\d.]+)%/);
    if (downloadMatch) {
        return {
            percent: Math.round(parseFloat(downloadMatch[1]) * 0.8), // 80% for download
            status: `Downloading... ${downloadMatch[1]}%`
        };
    }

    // Post-processing
    if (output.includes('[ExtractAudio]') || output.includes('[Merger]')) {
        return {
            percent: 90,
            status: 'Processing audio...'
        };
    }

    if (output.includes('[ffmpeg]')) {
        return {
            percent: 95,
            status: 'Converting...'
        };
    }

    return null;
}

/**
 * Format duration in seconds to MM:SS
 */
function formatDuration(seconds) {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Cleanup old downloads (run every hour)
setInterval(() => {
    const maxAge = 60 * 60 * 1000; // 1 hour
    const now = Date.now();

    fs.readdirSync(downloadsDir).forEach(file => {
        const filePath = path.join(downloadsDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtimeMs > maxAge) {
            fs.unlinkSync(filePath);
            console.log('Cleaned up:', file);
        }
    });
}, 60 * 60 * 1000);

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║  YT Converter Server running on port ${PORT}  ║
╚════════════════════════════════════════════╝

Open: http://localhost:${PORT}

Requirements:
  • yt-dlp: brew install yt-dlp
  • ffmpeg: brew install ffmpeg
`);
});
