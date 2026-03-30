import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Task Store', () => {
    const previousTaskStore = process.env.TASK_STORE;

    beforeEach(() => {
        vi.resetModules();
        process.env.TASK_STORE = 'memory';
    });

    afterEach(() => {
        if (previousTaskStore === undefined) {
            delete process.env.TASK_STORE;
        } else {
            process.env.TASK_STORE = previousTaskStore;
        }
    });

    it('creates and returns tasks through the memory adapter', async () => {
        const taskStore = await import('../server/services/taskStore.ts');

        taskStore.createTask({
            taskId: 'task-1',
            videoId: 'abc123',
            format: 'mp3',
            state: 'processing',
            progress: 0,
            title: 'Track One',
        });

        const task = taskStore.getTask('task-1');
        expect(task).toBeDefined();
        expect(task?.videoId).toBe('abc123');
        expect(task?.title).toBe('Track One');
    });

    it('updates and deletes tasks', async () => {
        const taskStore = await import('../server/services/taskStore.ts');

        taskStore.createTask({
            taskId: 'task-2',
            videoId: 'xyz789',
            format: 'mp4',
        });

        const updated = taskStore.updateTask('task-2', {
            progress: 50,
            status: 'Downloading...',
        });

        expect(updated?.progress).toBe(50);
        expect(updated?.status).toBe('Downloading...');

        taskStore.deleteTask('task-2');
        expect(taskStore.getTask('task-2')).toBeNull();
    });

    it('returns matching tasks from idempotency lookup', async () => {
        const taskStore = await import('../server/services/taskStore.ts');

        taskStore.createTask({
            taskId: 'task-3',
            videoId: 'vid123',
            format: 'mp3',
            state: 'processing',
        });

        const found = taskStore.findExistingTask('vid123', 'mp3');
        expect(found?.taskId).toBe('task-3');
        expect(taskStore.findExistingTask('vid123', 'mp4')).toBeNull();
    });

    it('cleans up stale tasks in memory mode', async () => {
        const taskStore = await import('../server/services/taskStore.ts');
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(10_000);

        taskStore.createTask({
            taskId: 'task-4',
            videoId: 'old-task',
            format: 'mp3',
            createdAt: 1_000,
        });

        nowSpy.mockReturnValue(20_000);
        expect(taskStore.cleanupOldTasks(5_000)).toBe(1);
        expect(taskStore.getTask('task-4')).toBeNull();
    });
});
