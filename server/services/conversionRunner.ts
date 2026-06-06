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
    runConversion(taskId, videoId, format, title).catch((error: Error) => {
        console.error(`[Conversion] Failed for task ${taskId} (${videoId}):`, error.message);
        updateTask(taskId, {
            state: 'error',
            progress: 0,
            error: error.message || 'Conversion failed'
        });
    });
};
