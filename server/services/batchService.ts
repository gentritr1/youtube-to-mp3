/**
 * Batch Service
 * 
 * Manages batch download operations - creating batches, tracking progress,
 * and coordinating between multiple individual conversion tasks.
 * 
 * This is a focused, single-responsibility service that:
 * - Creates and stores batch jobs
 * - Delegates individual conversions to the existing task system
 * - Aggregates progress from individual tasks
 */

import { randomUUID } from 'crypto';
import { BatchItem, BatchJob, BatchProgress, Task } from '../types.js';
import { createTask as createSingleTask, getTask, updateTask } from './taskManager.js';
import { convertVideo } from './ytdlp.js';

// Constants
export const MAX_BATCH_SIZE = 10;

// In-memory batch store (could be moved to SQLite later)
const batches = new Map<string, BatchJob>();

/**
 * Generate unique batch ID
 */
const generateBatchId = (): string => {
    return `batch_${Date.now()}_${randomUUID().split('-')[0]}`;
};

/**
 * Validate a single batch item
 */
const validateItem = (item: BatchItem, index: number): void => {
    if (!item.videoId || item.videoId.trim() === '') {
        throw new Error(`Video ID is required for item ${index + 1}`);
    }
    if (!item.format || !['mp3', 'mp4'].includes(item.format)) {
        throw new Error(`Format must be mp3 or mp4 for item ${index + 1}`);
    }
};

/**
 * Create a new batch job
 * 
 * @param items - Array of items to convert
 * @returns The created batch job
 * @throws Error if validation fails
 */
export const createBatch = (items: BatchItem[]): BatchJob => {
    // Validate batch size
    if (!items || items.length === 0) {
        throw new Error('Batch must contain at least one item');
    }
    if (items.length > MAX_BATCH_SIZE) {
        throw new Error(`Batch cannot exceed ${MAX_BATCH_SIZE} items`);
    }

    // Validate each item
    items.forEach((item, index) => validateItem(item, index));

    const batchId = generateBatchId();
    const now = Date.now();

    // Create individual tasks for each item
    const processedItems: BatchItem[] = items.map((item, index) => {
        const taskId = randomUUID();
        const url = `https://www.youtube.com/watch?v=${item.videoId}`;
        const safeTitle = item.title || `Video ${index + 1}`;

        // Create task in task manager
        createSingleTask(taskId, {
            taskId,
            state: 'processing',
            progress: 0,
            status: 'Queued...',
            videoId: item.videoId,
            format: item.format,
            title: safeTitle,
        });

        // Start conversion in background (non-blocking) with error handling
        convertVideo(taskId, url, item.format).catch((err: Error) => {
            console.error(`[BatchService] Conversion failed for ${taskId} (${item.videoId}):`, err.message);
            // Update task to error state
            updateTask(taskId, {
                state: 'error',
                progress: 0,
                error: err.message || 'Conversion failed'
            });
        });

        return {
            ...item,
            taskId,
            title: safeTitle
        };
    });

    // Create batch job
    const batch: BatchJob = {
        batchId,
        items: processedItems,
        state: 'processing',
        totalItems: processedItems.length,
        completedItems: 0,
        failedItems: 0,
        processingItems: processedItems.length,
        createdAt: now,
        updatedAt: now
    };

    batches.set(batchId, batch);
    console.log(`[BatchService] Created batch ${batchId} with ${items.length} items`);

    return batch;
};

/**
 * Get batch by ID
 */
export const getBatch = (batchId: string): BatchJob | null => {
    return batches.get(batchId) || null;
};

/**
 * Get detailed batch progress by aggregating individual task states
 */
export const getBatchProgress = (batchId: string): BatchProgress | null => {
    const batch = batches.get(batchId);
    if (!batch) return null;

    let totalProgress = 0;
    let completedItems = 0;
    let failedItems = 0;
    let processingItems = 0;

    const itemDetails = batch.items.map(item => {
        const task = item.taskId ? getTask(item.taskId) : null;

        const itemState = task?.state || 'processing';
        const itemProgress = task?.progress || 0;

        totalProgress += itemProgress;

        if (itemState === 'completed') {
            completedItems++;
        } else if (itemState === 'error') {
            failedItems++;
        } else {
            processingItems++;
        }

        return {
            videoId: item.videoId,
            taskId: item.taskId || '',
            state: itemState,
            progress: itemProgress,
            title: item.title,
            downloadUrl: task?.downloadUrl,
            error: task?.error
        };
    });

    // Calculate overall progress
    const overallProgress = batch.items.length > 0
        ? Math.round(totalProgress / batch.items.length)
        : 0;

    // Determine batch state
    let batchState: BatchJob['state'] = 'processing';
    if (processingItems === 0) {
        if (failedItems === 0) {
            batchState = 'completed';
        } else if (completedItems === 0) {
            batchState = 'error';
        } else {
            batchState = 'partial';
        }
    }

    // Update batch state in store
    batch.state = batchState;
    batch.completedItems = completedItems;
    batch.failedItems = failedItems;
    batch.processingItems = processingItems;
    batch.updatedAt = Date.now();

    return {
        batchId: batch.batchId,
        state: batchState,
        overallProgress,
        totalItems: batch.totalItems,
        completedItems,
        failedItems,
        processingItems,
        items: itemDetails
    };
};

/**
 * Add item to an existing batch
 * Only works if batch is still processing
 */
export const addItemToBatch = (batchId: string, item: BatchItem): BatchJob => {
    const batch = batches.get(batchId);

    if (!batch) {
        throw new Error('Batch not found');
    }

    // Refresh batch state
    getBatchProgress(batchId);

    if (batch.state === 'completed' || batch.state === 'partial' || batch.state === 'error') {
        throw new Error('Cannot add items to completed batch');
    }

    if (batch.items.length >= MAX_BATCH_SIZE) {
        throw new Error(`Batch cannot exceed ${MAX_BATCH_SIZE} items`);
    }

    // Validate item
    validateItem(item, batch.items.length);

    // Create task for new item
    const taskId = randomUUID();
    const url = `https://www.youtube.com/watch?v=${item.videoId}`;
    const safeTitle = item.title || `Video ${batch.items.length + 1}`;

    createSingleTask(taskId, {
        taskId,
        state: 'processing',
        progress: 0,
        status: 'Queued...',
        videoId: item.videoId,
        format: item.format,
        title: safeTitle,
    });

    // Start conversion in background with error handling
    convertVideo(taskId, url, item.format).catch((err: Error) => {
        console.error(`[BatchService] Conversion failed for ${taskId} (${item.videoId}):`, err.message);
        // Update task to error state
        updateTask(taskId, {
            state: 'error',
            progress: 0,
            error: err.message || 'Conversion failed'
        });
    });

    // Add to batch
    const newItem: BatchItem = {
        ...item,
        taskId,
        title: safeTitle
    };

    batch.items.push(newItem);
    batch.totalItems = batch.items.length;
    batch.processingItems++;
    batch.updatedAt = Date.now();

    console.log(`[BatchService] Added item to batch ${batchId}, now ${batch.items.length} items`);

    return batch;
};

/**
 * Get all batches (for debugging/admin)
 */
export const getAllBatches = (): Map<string, BatchJob> => {
    return batches;
};

/**
 * Clear batches (for testing)
 */
export const clearBatches = (): void => {
    batches.clear();
};

// Re-export types for convenience
export type { BatchItem, BatchJob, BatchProgress };
