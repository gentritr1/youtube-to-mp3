import { Task } from '../types.js';

export interface CreateTaskParams extends Partial<Task> {
    taskId: string;
    videoId: string;
    format: string;
}

export class MemoryTaskAdapter {
    private readonly tasks = new Map<string, Task>();

    createTask(params: CreateTaskParams): Task {
        const now = Date.now();
        const task: Task = {
            taskId: params.taskId,
            videoId: params.videoId,
            format: params.format,
            state: params.state ?? 'processing',
            progress: params.progress ?? 0,
            status: params.status,
            title: params.title,
            filename: params.filename,
            downloadUrl: params.downloadUrl,
            error: params.error,
            audioStats: params.audioStats,
            createdAt: params.createdAt ?? now,
            updatedAt: params.updatedAt ?? now,
        };

        this.tasks.set(task.taskId, task);
        return task;
    }

    getTask(taskId: string): Task | null {
        return this.tasks.get(taskId) ?? null;
    }

    findExistingTask(videoId: string, format: string): Task | null {
        const tasks = Array.from(this.tasks.values())
            .filter((task) => task.videoId === videoId && task.format === format && task.state !== 'error')
            .sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0));

        return tasks[0] ?? null;
    }

    updateTask(taskId: string, updates: Partial<Task>): Task | null {
        const current = this.tasks.get(taskId);
        if (!current) {
            return null;
        }

        const next: Task = {
            ...current,
            ...updates,
            taskId: current.taskId,
            videoId: updates.videoId ?? current.videoId,
            format: updates.format ?? current.format,
            updatedAt: Date.now(),
        };

        this.tasks.set(taskId, next);
        return next;
    }

    deleteTask(taskId: string): void {
        this.tasks.delete(taskId);
    }

    cleanupOldTasks(maxAgeMs: number = 60 * 60 * 1000): number {
        const cutoff = Date.now() - maxAgeMs;
        let deleted = 0;

        for (const [taskId, task] of this.tasks.entries()) {
            if ((task.createdAt ?? 0) < cutoff || task.state === 'error') {
                this.tasks.delete(taskId);
                deleted++;
            }
        }

        return deleted;
    }

    close(): void {
        // No-op for the in-memory adapter.
    }
}
