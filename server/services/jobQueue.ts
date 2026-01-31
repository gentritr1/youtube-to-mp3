import Bull, { Job, JobOptions } from 'bull';
import { config } from '../config.js';
import { QueueStats } from '../types.js';

// Redis configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

interface JobData {
    taskId: string;
    videoId: string;
    format: string;
    title?: string;
    createdAt: number;
}

// Queue instance
let conversionQueue: Bull.Queue<JobData> | null = null;
let isQueueEnabled = false;

/**
 * Initialize the job queue
 * Returns true if Redis is available, false otherwise
 */
export const initializeQueue = async (): Promise<boolean> => {
    // Return existing queue if already connected
    if (isQueueEnabled && conversionQueue) {
        return true;
    }

    // Clean up existing closed/failed queue instance if it exists
    if (conversionQueue) {
        try {
            await conversionQueue.close();
        } catch (e) {
            // Ignore close error
        }
        conversionQueue = null;
    }

    try {
        conversionQueue = new Bull<JobData>('video-conversion', REDIS_URL, {
            defaultJobOptions: {
                attempts: config.QUEUE.MAX_RETRIES,
                backoff: {
                    type: 'exponential',
                    delay: config.QUEUE.RETRY_DELAY_MS
                },
                removeOnComplete: 100, // Keep last 100 completed jobs
                removeOnFail: 50       // Keep last 50 failed jobs
            },
            settings: {
                stalledInterval: 30000,    // Check for stalled jobs every 30s
                maxStalledCount: 2         // Mark job as stalled after 2 checks
            }
        });

        // Test Redis connection
        await conversionQueue.isReady();

        console.log('✅ Job queue connected to Redis');
        isQueueEnabled = true;

        // Set up event listeners
        setupQueueEvents();

        return true;
    } catch (error: any) {
        console.warn('⚠️  Redis not available, using direct processing:', error.message);
        // Clean up any dangling connections
        if (conversionQueue) {
            try {
                await conversionQueue.close();
            } catch (closeError) {
                // Ignore close errors
            }
            conversionQueue = null;
        }
        isQueueEnabled = false;
        return false;
    }
};

/**
 * Set up queue event listeners
 */
const setupQueueEvents = (): void => {
    if (!conversionQueue) return;

    conversionQueue.on('completed', (job: Job<JobData>, result: any) => {
        console.log(`✅ Job ${job.id} completed for video ${job.data.videoId}`);
    });

    conversionQueue.on('failed', (job: Job<JobData>, error: Error) => {
        console.error(`❌ Job ${job.id} failed for video ${job.data.videoId}:`, error.message);
    });

    conversionQueue.on('stalled', (job: Job<JobData>) => {
        console.warn(`⚠️  Job ${job.id} stalled`);
    });

    conversionQueue.on('error', (error: Error) => {
        console.error('Queue error:', error);
    });
};

/**
 * Add a conversion job to the queue
 */
export const addConversionJob = async (taskId: string, videoId: string, format: string, title?: string): Promise<Job<JobData> | null> => {
    if (!isQueueEnabled || !conversionQueue) {
        return null; // Caller should fall back to direct processing
    }

    try {
        const job = await conversionQueue.add(
            'convert',
            {
                taskId,
                videoId,
                format,
                title,
                createdAt: Date.now()
            },
            {
                jobId: taskId, // Use taskId as job ID for easy lookup
                priority: 1    // Normal priority
            }
        );

        return job;
    } catch (error: any) {
        console.error(`❌ Failed to add job for task ${taskId}:`, error.message);
        return null;
    }
};

/**
 * Register the job processor
 * This should be called when setting up workers
 */
export const registerProcessor = (processorFn: (taskId: string, videoId: string, format: string, title: string | undefined, updateProgress: (p: number) => void) => Promise<void>): void => {
    if (!isQueueEnabled || !conversionQueue) {
        console.warn('Queue not enabled, processor not registered');
        return;
    }

    // Process jobs with configured concurrency
    conversionQueue.process('convert', config.QUEUE.CONCURRENCY, async (job: Job<JobData>) => {
        const { taskId, videoId, format, title } = job.data;

        // Update job progress
        const updateProgress = (progress: number) => {
            job.progress(progress);
        };

        return processorFn(taskId, videoId, format, title, updateProgress);
    });

    console.log('📋 Job processor registered');
};

/**
 * Get job by task ID
 */
export const getJob = async (taskId: string): Promise<Job<JobData> | null> => {
    if (!isQueueEnabled || !conversionQueue) {
        return null;
    }

    try {
        return await conversionQueue.getJob(taskId);
    } catch (error: any) {
        console.error(`❌ Failed to get job for task ${taskId}:`, error.message);
        return null;
    }
};

/**
 * Get queue statistics
 */
export const getQueueStats = async (): Promise<QueueStats> => {
    if (!isQueueEnabled || !conversionQueue) {
        return {
            enabled: false,
            message: 'Queue not available (Redis not connected)'
        };
    }

    try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            conversionQueue.getWaitingCount(),
            conversionQueue.getActiveCount(),
            conversionQueue.getCompletedCount(),
            conversionQueue.getFailedCount(),
            conversionQueue.getDelayedCount()
        ]);

        return {
            enabled: true,
            waiting,
            active,
            completed,
            failed,
            delayed,
            total: waiting + active + completed + failed + delayed
        };
    } catch (error: any) {
        console.error('❌ Failed to get queue stats:', error.message);
        return {
            enabled: true,
            message: 'Queue stats unavailable (Redis error)',
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            total: 0
        };
    }
};

/**
 * Pause the queue
 */
export const pauseQueue = async (): Promise<void> => {
    if (conversionQueue) {
        await conversionQueue.pause();
        console.log('⏸️  Queue paused');
    }
};

/**
 * Resume the queue
 */
export const resumeQueue = async (): Promise<void> => {
    if (conversionQueue) {
        await conversionQueue.resume();
        console.log('▶️  Queue resumed');
    }
};

/**
 * Clean up and close the queue
 */
export const closeQueue = async (): Promise<void> => {
    if (conversionQueue) {
        await conversionQueue.close();
        conversionQueue = null;
        isQueueEnabled = false;
        console.log('🔒 Queue closed');
    }
};

/**
 * Check if queue is enabled
 */
export const isEnabled = (): boolean => isQueueEnabled;

// Handle process exit
process.on('SIGTERM', async () => {
    await closeQueue();
});
