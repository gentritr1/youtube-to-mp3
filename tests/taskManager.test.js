/**
 * Tests for Task Manager service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    getTask,
    createTask,
    updateTask,
    deleteTask,
    findExistingTask,
    getAllTasks
} from '../server/services/taskManager.js';

describe('TaskManager', () => {
    beforeEach(() => {
        // Clear all tasks before each test
        const tasks = getAllTasks();
        for (const key of tasks.keys()) {
            tasks.delete(key);
        }
    });

    describe('createTask', () => {
        it('creates a new task', () => {
            createTask('task-1', { videoId: 'abc123', format: 'mp3', state: 'processing' });
            const task = getTask('task-1');
            expect(task).toBeDefined();
            expect(task.videoId).toBe('abc123');
        });
    });

    describe('getTask', () => {
        it('returns undefined for non-existent task', () => {
            expect(getTask('non-existent')).toBeUndefined();
        });

        it('returns the task if it exists', () => {
            createTask('task-2', { videoId: 'xyz789', format: 'mp4' });
            expect(getTask('task-2')).toBeDefined();
        });
    });

    describe('updateTask', () => {
        it('updates existing task properties', () => {
            createTask('task-3', { state: 'processing', progress: 0 });
            updateTask('task-3', { progress: 50, status: 'Downloading...' });

            const task = getTask('task-3');
            expect(task.progress).toBe(50);
            expect(task.status).toBe('Downloading...');
            expect(task.state).toBe('processing');
        });
    });

    describe('deleteTask', () => {
        it('removes a task', () => {
            createTask('task-4', { videoId: 'delete-me' });
            expect(getTask('task-4')).toBeDefined();

            deleteTask('task-4');
            expect(getTask('task-4')).toBeUndefined();
        });
    });

    describe('findExistingTask (idempotency)', () => {
        it('returns existing processing task ID', () => {
            createTask('idempotent-1', {
                videoId: 'vid123',
                format: 'mp3',
                state: 'processing'
            });

            const found = findExistingTask('vid123', 'mp3');
            expect(found).toBe('idempotent-1');
        });

        it('returns null if format differs', () => {
            createTask('idempotent-2', {
                videoId: 'vid456',
                format: 'mp3',
                state: 'processing'
            });

            const found = findExistingTask('vid456', 'mp4'); // Different format
            expect(found).toBeNull();
        });

        it('returns null if no matching task', () => {
            const found = findExistingTask('nonexistent', 'mp3');
            expect(found).toBeNull();
        });
    });
});
