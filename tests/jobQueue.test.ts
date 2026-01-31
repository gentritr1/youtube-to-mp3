/**
 * Tests for Job Queue Service
 */

import { describe, it, afterAll, expect } from 'vitest';
import * as jobQueue from '../server/services/jobQueue.ts';

// Clean up after tests
afterAll(async () => {
    await jobQueue.closeQueue();
});

describe('Job Queue Service', () => {
    it('should export initializeQueue function', () => {
        expect(jobQueue.initializeQueue).toBeDefined();
        expect(typeof jobQueue.initializeQueue).toBe('function');
    });

    it('should export addConversionJob function', () => {
        expect(jobQueue.addConversionJob).toBeDefined();
        expect(typeof jobQueue.addConversionJob).toBe('function');
    });

    it('should export getQueueStats function', () => {
        expect(jobQueue.getQueueStats).toBeDefined();
        expect(typeof jobQueue.getQueueStats).toBe('function');
    });

    it('should export isEnabled function', () => {
        expect(jobQueue.isEnabled).toBeDefined();
        expect(typeof jobQueue.isEnabled).toBe('function');
    });

    it('isEnabled should return false when queue not initialized', () => {
        const enabled = jobQueue.isEnabled();
        expect(enabled).toBe(false);
    });

    it('getQueueStats should return disabled status when no Redis', async () => {
        const stats = await jobQueue.getQueueStats();

        expect(stats.enabled).toBe(false);
        expect(stats.message).toBeDefined();
    });

    it('addConversionJob should return null when queue disabled', async () => {
        const result = await jobQueue.addConversionJob(
            'test-task-123',
            'video-id',
            'mp3',
            'Test Video'
        );

        expect(result).toBeNull();
    });

    it('should export pauseQueue and resumeQueue functions', () => {
        expect(jobQueue.pauseQueue).toBeDefined();
        expect(jobQueue.resumeQueue).toBeDefined();
        expect(typeof jobQueue.pauseQueue).toBe('function');
        expect(typeof jobQueue.resumeQueue).toBe('function');
    });

    it('should export closeQueue function', () => {
        expect(jobQueue.closeQueue).toBeDefined();
        expect(typeof jobQueue.closeQueue).toBe('function');
    });
});

describe('Job Queue Integration (requires Redis)', () => {
    it('should gracefully handle Redis connection failure', async () => {
        // This test verifies graceful fallback when Redis is unavailable
        const result = await jobQueue.initializeQueue();

        // Return type check
        expect(typeof result).toBe('boolean');
    });
});
