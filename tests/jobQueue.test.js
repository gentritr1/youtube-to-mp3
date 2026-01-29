/**
 * Tests for Job Queue Service
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as jobQueue from '../server/services/jobQueue.js';

describe('Job Queue Service', () => {
    it('should export initializeQueue function', () => {
        assert.ok(jobQueue.initializeQueue, 'initializeQueue should be exported');
        assert.strictEqual(typeof jobQueue.initializeQueue, 'function');
    });

    it('should export addConversionJob function', () => {
        assert.ok(jobQueue.addConversionJob, 'addConversionJob should be exported');
        assert.strictEqual(typeof jobQueue.addConversionJob, 'function');
    });

    it('should export getQueueStats function', () => {
        assert.ok(jobQueue.getQueueStats, 'getQueueStats should be exported');
        assert.strictEqual(typeof jobQueue.getQueueStats, 'function');
    });

    it('should export isEnabled function', () => {
        assert.ok(jobQueue.isEnabled, 'isEnabled should be exported');
        assert.strictEqual(typeof jobQueue.isEnabled, 'function');
    });

    it('isEnabled should return false when queue not initialized', () => {
        const enabled = jobQueue.isEnabled();
        assert.strictEqual(enabled, false, 'Queue should be disabled by default');
    });

    it('getQueueStats should return disabled status when no Redis', async () => {
        const stats = await jobQueue.getQueueStats();

        assert.strictEqual(stats.enabled, false, 'Queue should be disabled');
        assert.ok(stats.message, 'Should include a message about Redis');
    });

    it('addConversionJob should return null when queue disabled', async () => {
        const result = await jobQueue.addConversionJob(
            'test-task-123',
            'video-id',
            'mp3',
            'Test Video'
        );

        assert.strictEqual(result, null, 'Should return null when queue disabled');
    });

    it('should export pauseQueue and resumeQueue functions', () => {
        assert.ok(jobQueue.pauseQueue, 'pauseQueue should be exported');
        assert.ok(jobQueue.resumeQueue, 'resumeQueue should be exported');
        assert.strictEqual(typeof jobQueue.pauseQueue, 'function');
        assert.strictEqual(typeof jobQueue.resumeQueue, 'function');
    });

    it('should export closeQueue function', () => {
        assert.ok(jobQueue.closeQueue, 'closeQueue should be exported');
        assert.strictEqual(typeof jobQueue.closeQueue, 'function');
    });
});

describe('Job Queue Integration (requires Redis)', () => {
    it('should gracefully handle Redis connection failure', async () => {
        // This test verifies graceful fallback when Redis is unavailable
        const result = await jobQueue.initializeQueue();

        // If Redis is not available, should return false
        // If Redis IS available (CI environment), should return true
        assert.strictEqual(typeof result, 'boolean', 'Should return boolean');
    });
});
