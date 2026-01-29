/**
 * Tests for SQLite Task Manager
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../server/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = path.join(__dirname, 'test_tasks.db');
const PREV_DB_PATH = config.DB_PATH;

// Set up test database path in config
config.DB_PATH = TEST_DB_PATH;

describe('SQLite Task Manager', () => {
    let taskManager;

    beforeAll(async () => {
        // Clean up any existing test database
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        if (fs.existsSync(TEST_DB_PATH + '-wal')) {
            fs.unlinkSync(TEST_DB_PATH + '-wal');
        }
        if (fs.existsSync(TEST_DB_PATH + '-shm')) {
            fs.unlinkSync(TEST_DB_PATH + '-shm');
        }

        // Dynamic import to use test database
        taskManager = await import('../server/services/sqliteTaskManager.js');
    });

    afterAll(() => {
        // Restore previous DB path
        config.DB_PATH = PREV_DB_PATH;

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

        expect(result.taskId).toBeDefined();
        expect(result.state).toBe('processing');
        expect(result.progress).toBe(0);
    });

    it('should get task by ID', () => {
        const created = taskManager.createTask('test_video_2', 'mp4');
        const retrieved = taskManager.getTask(created.taskId);

        expect(retrieved).toBeDefined();
        expect(retrieved.taskId).toBe(created.taskId);
        expect(retrieved.videoId).toBe('test_video_2');
        expect(retrieved.format).toBe('mp4');
        expect(retrieved.state).toBe('processing');
    });

    it('should return null for non-existent task', () => {
        const result = taskManager.getTask('non_existent_id');
        expect(result).toBeNull();
    });

    it('should find existing task for video/format combo', () => {
        const created = taskManager.createTask('test_video_3', 'mp3');
        const found = taskManager.findExistingTask('test_video_3', 'mp3');

        expect(found).toBeDefined();
        expect(found.taskId).toBe(created.taskId);
    });

    it('should not find task for different format', () => {
        taskManager.createTask('test_video_4', 'mp3');
        const found = taskManager.findExistingTask('test_video_4', 'mp4');

        expect(found).toBeNull();
    });

    it('should update task state', () => {
        const created = taskManager.createTask('test_video_5', 'mp3');

        const updated = taskManager.updateTask(created.taskId, {
            state: 'completed',
            progress: 100,
            filename: 'test_file.mp3',
            downloadUrl: '/api/download/test'
        });

        expect(updated.state).toBe('completed');
        expect(updated.progress).toBe(100);
        expect(updated.filename).toBe('test_file.mp3');
        expect(updated.downloadUrl).toBe('/api/download/test');
    });

    it('should update progress efficiently', () => {
        const created = taskManager.createTask('test_video_6', 'mp3');

        taskManager.updateProgress(created.taskId, 50);

        const retrieved = taskManager.getTask(created.taskId);
        expect(retrieved.progress).toBe(50);
    });

    it('should get statistics', () => {
        const stats = taskManager.getStats();

        expect(stats.total).toBeGreaterThanOrEqual(0);
        expect(stats.processing).toBeGreaterThanOrEqual(0);
        expect(stats.completed).toBeGreaterThanOrEqual(0);
    });

    it('should handle error state', () => {
        const created = taskManager.createTask('test_video_7', 'mp3');

        const updated = taskManager.updateTask(created.taskId, {
            state: 'error',
            error: 'Test error message'
        });

        expect(updated.state).toBe('error');
        expect(updated.error).toBe('Test error message');
    });
});
