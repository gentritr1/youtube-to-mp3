/**
 * Tests for Server Configuration
 */

import { describe, it, expect } from 'vitest';
import { config } from '../server/config.js';

describe('Server Configuration', () => {
    describe('Basic Config', () => {
        it('should have PORT configured', () => {
            expect(config.PORT).toBeDefined();
            expect(typeof config.PORT).toBe('number');
        });

        it('should have IS_PROD flag', () => {
            expect(typeof config.IS_PROD).toBe('boolean');
        });
    });

    describe('Paths', () => {
        it('should have ROOT_DIR defined', () => {
            expect(config.ROOT_DIR).toBeDefined();
            expect(config.ROOT_DIR.length).toBeGreaterThan(0);
        });

        it('should have DOWNLOADS_DIR defined', () => {
            expect(config.DOWNLOADS_DIR).toBeDefined();
            expect(config.DOWNLOADS_DIR).toContain('downloads');
        });

        it('should have DB_PATH defined', () => {
            expect(config.DB_PATH).toBeDefined();
            expect(config.DB_PATH).toContain('tasks.db');
        });
    });

    describe('Redis Config', () => {
        it('should have REDIS_URL configured', () => {
            expect(config.REDIS_URL).toBeDefined();
            expect(config.REDIS_URL.startsWith('redis://')).toBe(true);
        });

        it('should have USE_QUEUE flag', () => {
            expect(typeof config.USE_QUEUE).toBe('boolean');
        });
    });

    describe('Timeouts', () => {
        it('should have CLEANUP_INTERVAL_MS configured', () => {
            expect(config.CLEANUP_INTERVAL_MS).toBeGreaterThan(0);
        });

        it('should have FILE_MAX_AGE_MS configured', () => {
            expect(config.FILE_MAX_AGE_MS).toBeGreaterThan(0);
        });
    });

    describe('Rate Limiting Config', () => {
        it('should have RATE_LIMIT object', () => {
            expect(config.RATE_LIMIT).toBeDefined();
            expect(typeof config.RATE_LIMIT).toBe('object');
        });

        it('should have API rate limit settings', () => {
            expect(config.RATE_LIMIT.API_WINDOW_MS).toBeGreaterThan(0);
            expect(config.RATE_LIMIT.API_MAX_REQUESTS).toBeGreaterThan(0);
        });

        it('should have conversion rate limit settings', () => {
            expect(config.RATE_LIMIT.CONVERSION_WINDOW_MS).toBeGreaterThan(0);
            expect(config.RATE_LIMIT.CONVERSION_MAX_REQUESTS).toBeGreaterThan(0);
        });

        it('should have info rate limit settings', () => {
            expect(config.RATE_LIMIT.INFO_WINDOW_MS).toBeGreaterThan(0);
            expect(config.RATE_LIMIT.INFO_MAX_REQUESTS).toBeGreaterThan(0);
        });

        it('conversion limit should be stricter than API limit', () => {
            expect(config.RATE_LIMIT.CONVERSION_MAX_REQUESTS).toBeLessThan(config.RATE_LIMIT.API_MAX_REQUESTS);
        });
    });

    describe('Queue Config', () => {
        it('should have QUEUE object', () => {
            expect(config.QUEUE).toBeDefined();
            expect(typeof config.QUEUE).toBe('object');
        });

        it('should have CONCURRENCY setting', () => {
            expect(config.QUEUE.CONCURRENCY).toBeGreaterThan(0);
        });

        it('should have MAX_RETRIES setting', () => {
            expect(config.QUEUE.MAX_RETRIES).toBeGreaterThanOrEqual(0);
        });

        it('should have RETRY_DELAY_MS setting', () => {
            expect(config.QUEUE.RETRY_DELAY_MS).toBeGreaterThan(0);
        });
    });
});
