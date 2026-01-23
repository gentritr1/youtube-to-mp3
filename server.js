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
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

// In-memory task store
const tasks = new Map();

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
 */
app.get('/api/download/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = tasks.get(taskId);

    if (!task || task.state !== 'completed') {
        return res.status(404).json({ message: 'File not found or still processing' });
    }

    const outputFile = `${taskId}.${task.format}`;
    const filePath = path.join(downloadsDir, outputFile);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File no longer exists' });
    }

    // Sanitize title for filename
    const safeTitle = (task.title || 'video')
        .replace(/[<>:"/\\|?*]/g, '') // Remove invalid chars
        .replace(/\s+/g, '_')         // Replace spaces with underscores
        .substring(0, 100);           // Limit length

    const downloadName = `${safeTitle}.${task.format}`;

    // Explicitly set content type to help the browser
    const contentType = task.format === 'mp3' ? 'audio/mpeg' : 'video/mp4';
    res.setHeader('Content-Type', contentType);

    res.download(filePath, downloadName);
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
    const outputTemplate = path.join(downloadsDir, `${taskId}.%(ext)s`);

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
            return;
        }

        // Find the output file
        const outputFile = `${taskId}.${format}`;
        const outputPath = path.join(downloadsDir, outputFile);

        if (fs.existsSync(outputPath)) {
            task.state = 'completed';
            task.progress = 100;
            task.status = 'Complete!';
            task.downloadUrl = `/api/download/${taskId}`;
        } else {
            task.state = 'error';
            task.error = 'Output file not found';
        }
    });

    ytdlp.on('error', (err) => {
        task.state = 'error';
        task.error = err.code === 'ENOENT'
            ? 'yt-dlp not installed'
            : err.message;
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
