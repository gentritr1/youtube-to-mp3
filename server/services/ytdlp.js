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
 * Helper to get common yt-dlp arguments
 */
const getCommonArgs = () => {
    const args = [
        '--no-warnings',
        '--no-check-certificates',
        '--force-ipv4',
        '--referer', 'https://www.youtube.com/'
    ];

    // Use /tmp for cookies as it's guaranteed writable on almost all cloud hosts
    const cookiesPath = '/tmp/yt_cookies.txt';

    // Add modern user agent and headers to look more like a real browser
    args.push('--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    args.push('--add-header', 'Accept-Language: en-US,en;q=0.9');
    args.push('--add-header', 'Sec-Ch-Ua: "Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"');
    args.push('--add-header', 'Sec-Ch-Ua-Mobile: ?0');
    args.push('--add-header', 'Sec-Ch-Ua-Platform: "Windows"');

    // Handle Cookies from Environment Variable (for Render/Deployment)
    if (process.env.YT_COOKIES) {
        try {
            fs.writeFileSync(cookiesPath, process.env.YT_COOKIES);
            console.log('Updated /tmp/yt_cookies.txt from environment variable');
            args.push('--cookies', cookiesPath);
        } catch (e) {
            console.error('Failed to write cookies to /tmp', e);
        }
    }
    // Fallback: Check if a local cookies.txt exists (for local dev)
    else {
        const localCookies = path.join(config.ROOT_DIR, 'cookies.txt');
        if (fs.existsSync(localCookies)) {
            args.push('--cookies', localCookies);
        }
    }

    return args;
};

/**
 * Get video info using yt-dlp
 * @param {string} url - YouTube URL
 * @returns {Promise<object>} Video metadata
 */
export function getVideoInfo(url) {
    return new Promise((resolve, reject) => {
        const args = [
            '--dump-json',
            ...getCommonArgs(),
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
                console.error('yt-dlp error:', stderr);
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

    const commonArgs = getCommonArgs();

    const args = format === 'mp3'
        ? [
            '-x',
            '--audio-format', 'mp3',
            '--audio-quality', config.IS_PROD ? '192K' : '0',
            '--no-playlist',
            ...(config.IS_PROD ? ['--concurrent-fragments', '1'] : []),
            '-o', outputTemplate,
            ...commonArgs,
            '--progress',
            url
        ]
        : [
            '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '--merge-output-format', 'mp4',
            '--no-playlist',
            ...(config.IS_PROD ? ['--concurrent-fragments', '1'] : []),
            '-o', outputTemplate,
            ...commonArgs,
            '--progress',
            url
        ];

    const ytdlp = spawn('yt-dlp', args);
    let lastError = '';

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
        } else {
            lastError += output;
        }
    });

    ytdlp.on('close', (code) => {
        if (code !== 0) {
            console.error(`yt-dlp failed with code ${code}. Error: ${lastError}`);
            updateTask(taskId, {
                state: 'error',
                error: lastError.includes('Sign in to confirm your age')
                    ? 'This video requires age verification. (Cookies needed)'
                    : lastError.slice(-100).trim() || 'Conversion failed'
            });
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
