import { buildYouTubeWatchUrl } from '../utils/youtube.js';
import { addConversionJob } from './jobQueue.js';
import { updateTask } from './taskStore.js';
import { convertVideo } from './ytdlp.js';

export const runConversion = async (
    taskId: string,
    videoId: string,
    format: string,
    title?: string
): Promise<void> => {
    const job = await addConversionJob(taskId, videoId, format, title);
    if (job) {
        updateTask(taskId, {
            status: 'Queued...',
            progress: 0
        });
        return;
    }

    await convertVideo(taskId, buildYouTubeWatchUrl(videoId), format);
};

export const startConversion = (
    taskId: string,
    videoId: string,
    format: string,
    title?: string
): void => {
    runConversion(taskId, videoId, format, title).catch((reason: unknown) => {
        const message = reason instanceof Error
            ? reason.message
            : String(reason || 'Conversion failed');

        console.error(`[Conversion] Failed for task ${taskId} (${videoId}):`, message);
        updateTask(taskId, {
            state: 'error',
            status: 'Failed',
            progress: 0,
            error: message
        });
    });
};
