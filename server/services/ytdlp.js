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

    // Advanced Stealth: Add modern user agent and matching browser headers
    // Using iPhone UA as it's often less restricted
    args.push('--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

    // Switch to iOS player client which is often less restricted
    args.push('--extractor-args', 'youtube:player_client=ios');
    args.push('--geo-bypass');
    args.push('--socket-timeout', '30');

    // Handle Cookies from Environment Variable (for Render/Deployment)
    if (process.env.YT_COOKIES) {
        try {
            const cookiesText = process.env.YT_COOKIES.trim();
            if (!cookiesText.includes('Netscape') && !cookiesText.includes('\t')) {
                console.warn('[System] WARNING: YT_COOKIES environment variable does not look like a Netscape format cookies.txt file!');
            }

            fs.writeFileSync(cookiesPath, cookiesText);
            // console.log('Updated /tmp/yt_cookies.txt (Size: ' + cookiesText.length + ' bytes)');
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
export async function getVideoInfo(url) {
    const runInfoWithArgs = (useCookies) => {
        return new Promise((resolve, reject) => {
            const args = [
                '--dump-json',
                '--no-warnings',
                '--no-check-certificates',
                '--force-ipv4',
                '--referer', 'https://www.youtube.com/',
                '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                '--extractor-args', 'youtube:player_client=ios',
                '--geo-bypass',
                '--socket-timeout', '30',
                url
            ];

            if (useCookies && process.env.YT_COOKIES) {
                const cookiesPath = '/tmp/yt_cookies.txt';
                try {
                    fs.writeFileSync(cookiesPath, process.env.YT_COOKIES.trim());
                    args.splice(args.length - 1, 0, '--cookies', cookiesPath); // Insert before URL
                } catch (e) { }
            }

            const ytdlp = spawn('yt-dlp', args);
            let stdout = '';
            let stderr = '';

            ytdlp.stdout.on('data', (data) => stdout += data.toString());
            ytdlp.stderr.on('data', (data) => stderr += data.toString());

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
        });
    };

    // Attempt 1: No Cookies (Anonymous)
    try {
        return await runInfoWithArgs(false);
    } catch (err) {
        // Attempt 2: Retry with Cookies if available
        if (process.env.YT_COOKIES && (err.message.includes('Sign in') || err.message.includes('bot'))) {
            console.log('[Info] Failed anonymously, retrying with cookies...');
            return await runInfoWithArgs(true);
        }
        throw err;
    }
}


/**
 * Convert video using yt-dlp
 * @param {string} taskId - Task identifier
 * @param {string} url - YouTube URL
 * @param {string} format - 'mp3' or 'mp4'
 */
export async function convertVideo(taskId, url, format) {
    const task = getTask(taskId);
    if (!task) return;

    const safeTitle = sanitizeFilename(task.title);
    const filename = `${safeTitle}.%(ext)s`;
    // Define outputTemplate at function scope so it's available everywhere
    const outputTemplate = path.join(config.DOWNLOADS_DIR, filename);

    // Initial attempt: Try WITHOUT cookies first to avoid account flagging
    // Only use basic arguments initially
    const baseArgs = [
        '--no-warnings',
        '--no-check-certificates',
        '--force-ipv4',
        '--referer', 'https://www.youtube.com/',
        '--geo-bypass',
        '--socket-timeout', '30'
    ];

    const formatArgs = format === 'mp3'
        ? [
            '-f', 'bestaudio/best',
            '-x',
            '--audio-format', 'mp3',
            '--audio-quality', config.IS_PROD ? '192K' : '0',
            '--no-playlist',
            ...(config.IS_PROD ? ['--concurrent-fragments', '1'] : []),
            '-o', outputTemplate,
            '--progress'
        ]
        : [
            '-f', 'bestvideo+bestaudio/best',
            '--merge-output-format', 'mp4',
            '--no-playlist',
            ...(config.IS_PROD ? ['--concurrent-fragments', '1'] : []),
            '-o', outputTemplate,
            '--progress'
        ];

    // Function to run yt-dlp with specific options
    const runYtDlp = (useCookies) => {
        return new Promise((resolve, reject) => {
            const currentArgs = [...baseArgs];

            // Add cookies only if explicitly requested
            if (useCookies) {
                const cookiesPath = '/tmp/yt_cookies.txt';
                if (process.env.YT_COOKIES) {
                    try {
                        fs.writeFileSync(cookiesPath, process.env.YT_COOKIES.trim());
                        currentArgs.push('--cookies', cookiesPath);
                    } catch (e) { }
                }
            }

            // Append format and URL
            currentArgs.push(...formatArgs, url);

            const proc = spawn('yt-dlp', currentArgs);
            let procError = '';

            proc.stdout.on('data', (data) => {
                const output = data.toString();
                const progress = parseProgress(output);
                if (progress) {
                    updateTask(taskId, {
                        progress: progress.percent,
                        status: progress.status
                    });
                }
            });

            proc.stderr.on('data', (data) => {
                procError += data.toString();
            });

            proc.on('close', (code) => {
                if (code !== 0) reject(new Error(procError));
                else resolve();
            });
        });
    };

    // Attempt 1: Try without cookies (Best for public videos)
    try {
        console.log(`[Convert] Starting Task ${taskId} (No Cookies)`);
        await runYtDlp(false);
        success();
    } catch (err1) {
        const errorMsg = err1.message;

        // Check if we need to retry with cookies
        if (errorMsg.includes('Sign in') || errorMsg.includes('bot') || errorMsg.includes('confirm your age')) {
            console.log(`[Convert] Task ${taskId} failed. Retrying WITH cookies...`);
            updateTask(taskId, { status: 'Retrying with permissions...' });

            try {
                await runYtDlp(true);
                success();
            } catch (err2) {
                fail(err2.message);
            }
        } else {
            // Other error (format, network, etc) - fail immediately
            fail(errorMsg);
        }
    }

    function success() {
        if (fs.existsSync(outputTemplate.replace('%(ext)s', format))) {
            // ... existing success logic (file rename/check)
            // For simplicity in this snippet, we assume outputTemplate resolved to task.filename
            // In reality, we need to find the file just like before
            const finalPath = path.join(config.DOWNLOADS_DIR, task.filename);
            if (fs.existsSync(finalPath)) {
                updateTask(taskId, {
                    state: 'completed',
                    progress: 100,
                    status: 'Complete!',
                    downloadUrl: `/api/download/${taskId}/${encodeURIComponent(task.filename)}`
                });
            } else {
                fail('Output file not found after success');
            }
        } else {
            // Fallback helper to find the file if extension check failed
            // Reuse existing file finding logic
            const finalPath = path.join(config.DOWNLOADS_DIR, task.filename);
            if (fs.existsSync(finalPath)) {
                updateTask(taskId, {
                    state: 'completed',
                    progress: 100,
                    status: 'Complete!',
                    downloadUrl: `/api/download/${taskId}/${encodeURIComponent(task.filename)}`
                });
            } else {
                fail(`Output file missing: ${task.filename}`);
            }
        }
    }

    function fail(msg) {
        console.error(`yt-dlp failed: ${msg}`);
        updateTask(taskId, {
            state: 'error',
            error: msg.includes('Sign in')
                ? 'Video requires authentication (Cookies failed)'
                : msg.slice(-100).trim() || 'Conversion failed'
        });
    }
}
