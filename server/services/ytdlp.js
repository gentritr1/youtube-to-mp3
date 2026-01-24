/**
 * yt-dlp Service
 * Wrapper around yt-dlp for video info and conversion
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import { formatDuration } from '../utils/formatDuration.js';
import { parseProgress } from '../utils/parseProgress.js';
import { sanitizeFilename } from '../utils/sanitize.js';
import { getTask, updateTask, saveTasks } from './taskManager.js';

/**
 * Get video info using yt-dlp
 * @param {string} url - YouTube URL
 * @returns {Promise<object>} Video metadata
 */
export function getVideoInfo(url) {
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
 * @param {string} taskId - Task identifier
 * @param {string} url - YouTube URL
 * @param {string} format - 'mp3' or 'mp4'
 */
export function convertVideo(taskId, url, format) {
    const task = getTask(taskId);
    if (!task) return;

    const safeTitle = sanitizeFilename(task.title);
    const filename = `${safeTitle}.%(ext)s`;
    const outputTemplate = path.join(config.DOWNLOADS_DIR, filename);

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
            updateTask(taskId, { state: 'error', error: 'Conversion failed' });
            return;
        }

        // Find the output file using the sanitized filename
        const outputPath = path.join(config.DOWNLOADS_DIR, task.filename);

        if (fs.existsSync(outputPath)) {
            updateTask(taskId, {
                state: 'completed',
                progress: 100,
                status: 'Complete!',
                downloadUrl: `/api/download/${taskId}/${encodeURIComponent(task.filename)}`
            });
        } else {
            updateTask(taskId, {
                state: 'error',
                error: `Output file not found: ${task.filename}`
            });
        }
    });

    ytdlp.on('error', (err) => {
        updateTask(taskId, {
            state: 'error',
            error: err.code === 'ENOENT' ? 'yt-dlp not installed' : err.message
        });
    });
}
