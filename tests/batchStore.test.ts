import { beforeEach, describe, expect, it } from 'vitest';
import {
    batchStoreType,
    clearBatches,
    getAllBatches,
    getBatch,
    saveBatch,
    updateBatch
} from '../server/services/batchStore.js';
import type { BatchJob } from '../server/types.js';

const createBatch = (overrides: Partial<BatchJob> = {}): BatchJob => ({
    batchId: overrides.batchId ?? 'batch_test',
    items: overrides.items ?? [
        { videoId: 'video1', format: 'mp3', title: 'Song 1', taskId: 'task1' }
    ],
    state: overrides.state ?? 'processing',
    totalItems: overrides.totalItems ?? 1,
    completedItems: overrides.completedItems ?? 0,
    failedItems: overrides.failedItems ?? 0,
    processingItems: overrides.processingItems ?? 1,
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 1000
});

describe('batchStore', () => {
    beforeEach(() => {
        clearBatches();
    });

    it('uses the documented runtime memory store', () => {
        expect(batchStoreType).toBe('memory');
    });

    it('saves and returns batches by id', () => {
        const batch = saveBatch(createBatch());

        expect(batch.batchId).toBe('batch_test');
        expect(getBatch('batch_test')?.items[0].videoId).toBe('video1');
    });

    it('returns cloned batches so callers cannot mutate store state implicitly', () => {
        saveBatch(createBatch());

        const batch = getBatch('batch_test');
        batch?.items.push({ videoId: 'video2', format: 'mp4', title: 'Video 2' });

        expect(getBatch('batch_test')?.items).toHaveLength(1);
    });

    it('updates batch aggregate fields through the store API', () => {
        saveBatch(createBatch());

        const updated = updateBatch('batch_test', {
            state: 'completed',
            completedItems: 1,
            processingItems: 0
        });

        expect(updated?.state).toBe('completed');
        expect(getBatch('batch_test')?.completedItems).toBe(1);
        expect(getBatch('batch_test')?.processingItems).toBe(0);
    });

    it('returns a cloned map for debug/admin callers', () => {
        saveBatch(createBatch());

        const batches = getAllBatches();
        batches.get('batch_test')?.items.push({ videoId: 'video2', format: 'mp4' });

        expect(getBatch('batch_test')?.items).toHaveLength(1);
    });
});
