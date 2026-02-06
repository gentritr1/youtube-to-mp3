/**
 * Batch Service Tests (TDD)
 * 
 * Tests for the batch download functionality.
 * Following TDD: Write tests FIRST, then implement.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the taskManager before importing batchService
vi.mock('../server/services/taskManager.js', () => ({
    createTask: vi.fn(),
    getTask: vi.fn(),
    updateTask: vi.fn(),
    findExistingTask: vi.fn().mockReturnValue(null)
}));

// Mock ytdlp service
vi.mock('../server/services/ytdlp.js', () => ({
    convertVideo: vi.fn().mockResolvedValue(undefined),
    getVideoInfo: vi.fn().mockResolvedValue({
        id: 'test123',
        title: 'Test Video',
        thumbnail: 'https://example.com/thumb.jpg',
        author: 'Test Author',
        duration: '3:45'
    })
}));

// Import after mocks are set up
import {
    createBatch,
    getBatch,
    getBatchProgress,
    addItemToBatch,
    clearBatches,
    MAX_BATCH_SIZE
} from '../server/services/batchService.js';
import type { BatchItem } from '../server/types.js';
import { createTask, getTask } from '../server/services/taskManager.js';

describe('Batch Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearBatches();
    });

    describe('createBatch', () => {
        it('should create a batch with valid items', () => {
            const items: BatchItem[] = [
                { videoId: 'video1', format: 'mp3', title: 'Song 1' },
                { videoId: 'video2', format: 'mp3', title: 'Song 2' }
            ];

            const batch = createBatch(items);

            expect(batch).toBeDefined();
            expect(batch.batchId).toBeDefined();
            expect(batch.batchId).toMatch(/^batch_/);
            expect(batch.items).toHaveLength(2);
            expect(batch.state).toBe('processing');
            expect(batch.totalItems).toBe(2);
            expect(batch.completedItems).toBe(0);
            expect(batch.failedItems).toBe(0);
        });

        it('should reject empty batch', () => {
            expect(() => createBatch([])).toThrow('Batch must contain at least one item');
        });

        it('should reject batch exceeding MAX_BATCH_SIZE', () => {
            const tooManyItems: BatchItem[] = Array(MAX_BATCH_SIZE + 1)
                .fill(null)
                .map((_, i): BatchItem => ({ videoId: `video${i}`, format: 'mp3', title: `Song ${i}` }));

            expect(() => createBatch(tooManyItems)).toThrow(`Batch cannot exceed ${MAX_BATCH_SIZE} items`);
        });

        it('should validate item format', () => {
            const invalidItems = [
                { videoId: 'video1', format: 'wav', title: 'Song 1' } // Invalid format
            ] as unknown as BatchItem[];

            expect(() => createBatch(invalidItems)).toThrow('Format must be mp3 or mp4');
        });

        it('should validate videoId presence', () => {
            const invalidItems: BatchItem[] = [
                { videoId: '', format: 'mp3', title: 'Song 1' }
            ];

            expect(() => createBatch(invalidItems)).toThrow('Video ID is required');
        });

        it('should create individual tasks for each batch item', () => {
            const items: BatchItem[] = [
                { videoId: 'video1', format: 'mp3', title: 'Song 1' },
                { videoId: 'video2', format: 'mp4', title: 'Video 2' }
            ];

            createBatch(items);

            // Each item should create a task
            expect(createTask).toHaveBeenCalledTimes(2);
        });

        it('should assign unique taskIds to each batch item', () => {
            const items: BatchItem[] = [
                { videoId: 'video1', format: 'mp3', title: 'Song 1' },
                { videoId: 'video2', format: 'mp3', title: 'Song 2' }
            ];

            const batch = createBatch(items);

            const taskIds = batch.items.map((item: BatchItem) => item.taskId);
            const uniqueTaskIds = new Set(taskIds);
            expect(uniqueTaskIds.size).toBe(taskIds.length);
        });
    });

    describe('getBatch', () => {
        it('should return batch by ID', () => {
            const items: BatchItem[] = [
                { videoId: 'video1', format: 'mp3', title: 'Song 1' }
            ];

            const created = createBatch(items);
            const retrieved = getBatch(created.batchId);

            expect(retrieved).toBeDefined();
            expect(retrieved?.batchId).toBe(created.batchId);
        });

        it('should return null for non-existent batch', () => {
            const result = getBatch('batch_nonexistent');
            expect(result).toBeNull();
        });
    });

    describe('getBatchProgress', () => {
        it('should calculate overall progress from individual tasks', () => {
            // Setup mock task responses
            (getTask as ReturnType<typeof vi.fn>)
                .mockReturnValueOnce({ state: 'completed', progress: 100 })
                .mockReturnValueOnce({ state: 'processing', progress: 50 });

            const items: BatchItem[] = [
                { videoId: 'video1', format: 'mp3', title: 'Song 1' },
                { videoId: 'video2', format: 'mp3', title: 'Song 2' }
            ];

            const batch = createBatch(items);
            const progress = getBatchProgress(batch.batchId);

            expect(progress).toBeDefined();
            expect(progress?.overallProgress).toBe(75); // (100 + 50) / 2
            expect(progress?.completedItems).toBe(1);
            expect(progress?.processingItems).toBe(1);
        });

        it('should return null for non-existent batch', () => {
            const result = getBatchProgress('batch_nonexistent');
            expect(result).toBeNull();
        });

        it('should mark batch as completed when all items done', () => {
            (getTask as ReturnType<typeof vi.fn>)
                .mockReturnValue({ state: 'completed', progress: 100 });

            const items: BatchItem[] = [
                { videoId: 'video1', format: 'mp3', title: 'Song 1' }
            ];

            const batch = createBatch(items);
            const progress = getBatchProgress(batch.batchId);

            expect(progress?.state).toBe('completed');
        });

        it('should mark batch as error if any item fails', () => {
            (getTask as ReturnType<typeof vi.fn>)
                .mockReturnValueOnce({ state: 'completed', progress: 100 })
                .mockReturnValueOnce({ state: 'error', progress: 0, error: 'Download failed' });

            const items: BatchItem[] = [
                { videoId: 'video1', format: 'mp3', title: 'Song 1' },
                { videoId: 'video2', format: 'mp3', title: 'Song 2' }
            ];

            const batch = createBatch(items);
            const progress = getBatchProgress(batch.batchId);

            expect(progress?.failedItems).toBe(1);
            // Batch state should be 'partial' when some succeed and some fail
            expect(progress?.state).toBe('partial');
        });
    });

    describe('addItemToBatch', () => {
        it('should add item to existing batch', () => {
            // Mock tasks as still processing
            (getTask as ReturnType<typeof vi.fn>)
                .mockReturnValue({ state: 'processing', progress: 50 });

            const items: BatchItem[] = [
                { videoId: 'video1', format: 'mp3', title: 'Song 1' }
            ];

            const batch = createBatch(items);
            const newItem: BatchItem = { videoId: 'video3', format: 'mp3', title: 'Song 3' };

            const updated = addItemToBatch(batch.batchId, newItem);

            expect(updated?.items).toHaveLength(2);
            expect(updated?.totalItems).toBe(2);
        });

        it('should reject adding to non-existent batch', () => {
            const newItem: BatchItem = { videoId: 'video3', format: 'mp3', title: 'Song 3' };

            expect(() => addItemToBatch('batch_nonexistent', newItem)).toThrow('Batch not found');
        });

        it('should reject adding to completed batch', () => {
            // First create a batch, then manually mark it as completed
            const items: BatchItem[] = [
                { videoId: 'video1', format: 'mp3', title: 'Song 1' }
            ];

            const batch = createBatch(items);

            // Simulate all items completed
            (getTask as ReturnType<typeof vi.fn>)
                .mockReturnValue({ state: 'completed', progress: 100 });

            // This should update the batch state to completed
            getBatchProgress(batch.batchId);

            const newItem: BatchItem = { videoId: 'video3', format: 'mp3', title: 'Song 3' };

            expect(() => addItemToBatch(batch.batchId, newItem)).toThrow('Cannot add items to completed batch');
        });

        it('should reject adding if batch would exceed MAX_BATCH_SIZE', () => {
            // Mock all tasks as still processing
            (getTask as ReturnType<typeof vi.fn>)
                .mockReturnValue({ state: 'processing', progress: 50 });

            const items: BatchItem[] = Array(MAX_BATCH_SIZE)
                .fill(null)
                .map((_, i): BatchItem => ({ videoId: `video${i}`, format: 'mp3', title: `Song ${i}` }));

            const batch = createBatch(items);
            const newItem: BatchItem = { videoId: 'extra', format: 'mp3', title: 'Extra' };

            expect(() => addItemToBatch(batch.batchId, newItem)).toThrow(`Batch cannot exceed ${MAX_BATCH_SIZE} items`);
        });
    });

    describe('Batch Constants', () => {
        it('should have MAX_BATCH_SIZE defined', () => {
            expect(MAX_BATCH_SIZE).toBeDefined();
            expect(typeof MAX_BATCH_SIZE).toBe('number');
            expect(MAX_BATCH_SIZE).toBeGreaterThan(0);
            expect(MAX_BATCH_SIZE).toBeLessThanOrEqual(20); // Reasonable limit
        });
    });
});
