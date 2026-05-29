import { Task } from '../types.js';
import {
    cleanupOldTasks,
    closeDatabase,
    createTask as createSqliteTask,
    deleteTask,
    findExistingTask,
    getTask,
    updateTask,
} from './sqliteTaskManager.js';
import type { CreateTaskParams } from './memoryTaskAdapter.js';

export class SqliteTaskAdapter {
    createTask(params: CreateTaskParams): Task {
        createSqliteTask(params.videoId, params.format, params.taskId, params);
        const task = getTask(params.taskId);
        if (task) {
            return task;
        }

        console.warn('[TaskStore] SQLite task create succeeded but follow-up read was empty', {
            taskId: params.taskId,
            videoId: params.videoId,
            format: params.format
        });

        return {
            taskId: params.taskId,
            videoId: params.videoId,
            format: params.format,
            state: params.state ?? 'processing',
            progress: params.progress ?? 0,
            status: params.status,
            title: params.title,
        };
    }

    getTask(taskId: string): Task | null {
        return getTask(taskId);
    }

    findExistingTask(videoId: string, format: string): Task | null {
        return findExistingTask(videoId, format);
    }

    updateTask(taskId: string, updates: Partial<Task>): Task | null {
        return updateTask(taskId, updates);
    }

    deleteTask(taskId: string): void {
        deleteTask(taskId);
    }

    cleanupOldTasks(maxAgeMs?: number): number {
        return cleanupOldTasks(maxAgeMs);
    }

    close(): void {
        closeDatabase();
    }
}
