/**
 * Tests for SQLite Task Manager
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = path.join(__dirname, 'test_tasks.db');

// Set up test database path before importing
process.env.TEST_DB_PATH = TEST_DB_PATH;

describe('SQLite Task Manager', async () => {
    let taskManager;

    before(async () => {
        // Clean up any existing test database
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }

        // Dynamic import to use test database
        taskManager = await import('../server/services/sqliteTaskManager.js');
    });

    after(() => {
        // Clean up test database
        try {
            taskManager.closeDatabase();
            if (fs.existsSync(TEST_DB_PATH)) {
                fs.unlinkSync(TEST_DB_PATH);
            }
            // Clean up WAL files
            if (fs.existsSync(TEST_DB_PATH + '-wal')) {
                fs.unlinkSync(TEST_DB_PATH + '-wal');
            }
            if (fs.existsSync(TEST_DB_PATH + '-shm')) {
                fs.unlinkSync(TEST_DB_PATH + '-shm');
            }
        } catch (e) {
            // Ignore cleanup errors
        }
    });

    it('should create a new task', () => {
        const result = taskManager.createTask('test_video_1', 'mp3');

        assert.ok(result.taskId, 'Task ID should be generated');
        assert.strictEqual(result.state, 'processing');
        assert.strictEqual(result.progress, 0);
    });

    it('should get task by ID', () => {
        const created = taskManager.createTask('test_video_2', 'mp4');
        const retrieved = taskManager.getTask(created.taskId);

        assert.ok(retrieved, 'Task should be retrieved');
        assert.strictEqual(retrieved.taskId, created.taskId);
        assert.strictEqual(retrieved.videoId, 'test_video_2');
        assert.strictEqual(retrieved.format, 'mp4');
        assert.strictEqual(retrieved.state, 'processing');
    });

    it('should return null for non-existent task', () => {
        const result = taskManager.getTask('non_existent_id');
        assert.strictEqual(result, null);
    });

    it('should find existing task for video/format combo', () => {
        const created = taskManager.createTask('test_video_3', 'mp3');
        const found = taskManager.findExistingTask('test_video_3', 'mp3');

        assert.ok(found, 'Existing task should be found');
        assert.strictEqual(found.taskId, created.taskId);
    });

    it('should not find task for different format', () => {
        taskManager.createTask('test_video_4', 'mp3');
        const found = taskManager.findExistingTask('test_video_4', 'mp4');

        assert.strictEqual(found, null, 'Should not find task for different format');
    });

    it('should update task state', () => {
        const created = taskManager.createTask('test_video_5', 'mp3');

        const updated = taskManager.updateTask(created.taskId, {
            state: 'completed',
            progress: 100,
            filename: 'test_file.mp3',
            downloadUrl: '/api/download/test'
        });

        assert.strictEqual(updated.state, 'completed');
        assert.strictEqual(updated.progress, 100);
        assert.strictEqual(updated.filename, 'test_file.mp3');
        assert.strictEqual(updated.downloadUrl, '/api/download/test');
    });

    it('should update progress efficiently', () => {
        const created = taskManager.createTask('test_video_6', 'mp3');

        taskManager.updateProgress(created.taskId, 50);

        const retrieved = taskManager.getTask(created.taskId);
        assert.strictEqual(retrieved.progress, 50);
    });

    it('should get statistics', () => {
        const stats = taskManager.getStats();

        assert.ok(stats.total >= 0, 'Total should be a number');
        assert.ok(stats.processing >= 0, 'Processing count should be a number');
        assert.ok(stats.completed >= 0, 'Completed count should be a number');
    });

    it('should handle error state', () => {
        const created = taskManager.createTask('test_video_7', 'mp3');

        const updated = taskManager.updateTask(created.taskId, {
            state: 'error',
            error: 'Test error message'
        });

        assert.strictEqual(updated.state, 'error');
        assert.strictEqual(updated.error, 'Test error message');
    });
});
