/**
 * Job Queue Service
 * Background job processing using Bull (Redis-backed)
 * 
 * Falls back to direct execution if Redis is not available
 */

import Bull from 'bull';
import { config } from '../config.js';

// Redis configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Queue instance
let conversionQueue = null;
let isQueueEnabled = false;

/**
 * Initialize the job queue
 * Returns true if Redis is available, false otherwise
 */
export const initializeQueue = async () => {
    try {
        conversionQueue = new Bull('video-conversion', REDIS_URL, {
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
    } catch (error) {
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
const setupQueueEvents = () => {
    if (!conversionQueue) return;

    conversionQueue.on('completed', (job, result) => {
        console.log(`✅ Job ${job.id} completed for video ${job.data.videoId}`);
    });

    conversionQueue.on('failed', (job, error) => {
        console.error(`❌ Job ${job.id} failed for video ${job.data.videoId}:`, error.message);
    });

    conversionQueue.on('stalled', (job) => {
        console.warn(`⚠️  Job ${job.id} stalled`);
    });

    conversionQueue.on('error', (error) => {
        console.error('Queue error:', error);
    });
};

/**
 * Add a conversion job to the queue
 */
export const addConversionJob = async (taskId, videoId, format, title) => {
    if (!isQueueEnabled || !conversionQueue) {
        return null; // Caller should fall back to direct processing
    }

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
};

/**
 * Register the job processor
 * This should be called when setting up workers
 */
export const registerProcessor = (processorFn) => {
    if (!isQueueEnabled || !conversionQueue) {
        console.warn('Queue not enabled, processor not registered');
        return;
    }

    // Process jobs with configured concurrency
    conversionQueue.process('convert', config.QUEUE.CONCURRENCY, async (job) => {
        const { taskId, videoId, format, title } = job.data;

        // Update job progress
        const updateProgress = (progress) => {
            job.progress(progress);
        };

        return processorFn(taskId, videoId, format, title, updateProgress);
    });

    console.log('📋 Job processor registered');
};

/**
 * Get job by task ID
 */
export const getJob = async (taskId) => {
    if (!isQueueEnabled || !conversionQueue) {
        return null;
    }

    return conversionQueue.getJob(taskId);
};

/**
 * Get queue statistics
 */
export const getQueueStats = async () => {
    if (!isQueueEnabled || !conversionQueue) {
        return {
            enabled: false,
            message: 'Queue not available (Redis not connected)'
        };
    }

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
};

/**
 * Pause the queue
 */
export const pauseQueue = async () => {
    if (conversionQueue) {
        await conversionQueue.pause();
        console.log('⏸️  Queue paused');
    }
};

/**
 * Resume the queue
 */
export const resumeQueue = async () => {
    if (conversionQueue) {
        await conversionQueue.resume();
        console.log('▶️  Queue resumed');
    }
};

/**
 * Clean up and close the queue
 */
export const closeQueue = async () => {
    if (conversionQueue) {
        await conversionQueue.close();
        console.log('🔒 Queue closed');
    }
};

/**
 * Check if queue is enabled
 */
export const isEnabled = () => isQueueEnabled;

// Handle process exit
process.on('SIGTERM', async () => {
    await closeQueue();
});
