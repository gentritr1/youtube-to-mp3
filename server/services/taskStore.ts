import { config } from '../config.js';
import { Task } from '../types.js';
import { MemoryTaskAdapter, type CreateTaskParams } from './memoryTaskAdapter.js';
import { SqliteTaskAdapter } from './sqliteTaskAdapter.js';

type TaskAdapter = {
    createTask(params: CreateTaskParams): Task;
    getTask(taskId: string): Task | null;
    findExistingTask(videoId: string, format: string): Task | null;
    updateTask(taskId: string, updates: Partial<Task>): Task | null;
    deleteTask(taskId: string): void;
    cleanupOldTasks(maxAgeMs?: number): number;
    close(): void;
};

const storeType = config.TASK_STORE === 'memory' ? 'memory' : 'sqlite';

const adapter: TaskAdapter = storeType === 'memory'
    ? new MemoryTaskAdapter()
    : new SqliteTaskAdapter();

export { storeType };
export type { CreateTaskParams };

export function createTask(params: CreateTaskParams): Task {
    return adapter.createTask(params);
}

export function getTask(taskId: string): Task | null {
    return adapter.getTask(taskId);
}

export function findExistingTask(videoId: string, format: string): Task | null {
    return adapter.findExistingTask(videoId, format);
}

export function updateTask(taskId: string, updates: Partial<Task>): Task | null {
    return adapter.updateTask(taskId, updates);
}

export function deleteTask(taskId: string): void {
    adapter.deleteTask(taskId);
}

export function cleanupOldTasks(maxAgeMs?: number): number {
    return adapter.cleanupOldTasks(maxAgeMs);
}

export function close(): void {
    adapter.close();
}
