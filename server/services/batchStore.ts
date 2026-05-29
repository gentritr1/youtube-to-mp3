import { BatchJob, BatchItem } from '../types.js';

const cloneBatchItem = (item: BatchItem): BatchItem => ({ ...item });

const cloneBatch = (batch: BatchJob): BatchJob => ({
    ...batch,
    items: batch.items.map(cloneBatchItem),
});

class MemoryBatchStore {
    private readonly batches = new Map<string, BatchJob>();

    saveBatch(batch: BatchJob): BatchJob {
        const next = cloneBatch(batch);
        this.batches.set(next.batchId, next);
        return cloneBatch(next);
    }

    getBatch(batchId: string): BatchJob | null {
        const batch = this.batches.get(batchId);
        return batch ? cloneBatch(batch) : null;
    }

    updateBatch(batchId: string, updates: Partial<BatchJob>): BatchJob | null {
        const current = this.batches.get(batchId);
        if (!current) {
            return null;
        }

        const next: BatchJob = {
            ...current,
            ...updates,
            batchId: current.batchId,
            items: updates.items ? updates.items.map(cloneBatchItem) : current.items.map(cloneBatchItem),
            updatedAt: updates.updatedAt ?? Date.now(),
        };

        this.batches.set(batchId, next);
        return cloneBatch(next);
    }

    getAllBatches(): Map<string, BatchJob> {
        return new Map(
            Array.from(this.batches.entries()).map(([batchId, batch]) => [batchId, cloneBatch(batch)])
        );
    }

    clearBatches(): void {
        this.batches.clear();
    }
}

const store = new MemoryBatchStore();

export const batchStoreType = 'memory';

export function saveBatch(batch: BatchJob): BatchJob {
    return store.saveBatch(batch);
}

export function getBatch(batchId: string): BatchJob | null {
    return store.getBatch(batchId);
}

export function updateBatch(batchId: string, updates: Partial<BatchJob>): BatchJob | null {
    return store.updateBatch(batchId, updates);
}

export function getAllBatches(): Map<string, BatchJob> {
    return store.getAllBatches();
}

export function clearBatches(): void {
    store.clearBatches();
}
