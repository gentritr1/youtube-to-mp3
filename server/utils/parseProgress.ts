/**
 * Parse yt-dlp progress output
 * @param {string} output - Raw output from yt-dlp
 * @returns {object|null} Progress object with percent and status
 */
interface Progress {
    percent: number;
    status: string;
}

export function parseProgress(output: string): Progress | null {
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
