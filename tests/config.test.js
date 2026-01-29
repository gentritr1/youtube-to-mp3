/**
 * Tests for Server Configuration
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { config } from '../server/config.js';

describe('Server Configuration', () => {
    describe('Basic Config', () => {
        it('should have PORT configured', () => {
            assert.ok(config.PORT, 'PORT should be defined');
            assert.strictEqual(typeof config.PORT, 'number');
        });

        it('should have IS_PROD flag', () => {
            assert.strictEqual(typeof config.IS_PROD, 'boolean');
        });
    });

    describe('Paths', () => {
        it('should have ROOT_DIR defined', () => {
            assert.ok(config.ROOT_DIR, 'ROOT_DIR should be defined');
            assert.ok(config.ROOT_DIR.length > 0, 'ROOT_DIR should not be empty');
        });

        it('should have DOWNLOADS_DIR defined', () => {
            assert.ok(config.DOWNLOADS_DIR, 'DOWNLOADS_DIR should be defined');
            assert.ok(config.DOWNLOADS_DIR.includes('downloads'), 'Should include downloads folder');
        });

        it('should have DB_PATH defined', () => {
            assert.ok(config.DB_PATH, 'DB_PATH should be defined');
            assert.ok(config.DB_PATH.includes('tasks.db'), 'Should include tasks.db');
        });
    });

    describe('Redis Config', () => {
        it('should have REDIS_URL configured', () => {
            assert.ok(config.REDIS_URL, 'REDIS_URL should be defined');
            assert.ok(config.REDIS_URL.startsWith('redis://'), 'Should be a valid Redis URL');
        });

        it('should have USE_QUEUE flag', () => {
            assert.strictEqual(typeof config.USE_QUEUE, 'boolean');
        });
    });

    describe('Timeouts', () => {
        it('should have CLEANUP_INTERVAL_MS configured', () => {
            assert.ok(config.CLEANUP_INTERVAL_MS > 0, 'Cleanup interval should be positive');
        });

        it('should have FILE_MAX_AGE_MS configured', () => {
            assert.ok(config.FILE_MAX_AGE_MS > 0, 'File max age should be positive');
        });
    });

    describe('Rate Limiting Config', () => {
        it('should have RATE_LIMIT object', () => {
            assert.ok(config.RATE_LIMIT, 'RATE_LIMIT should be defined');
            assert.strictEqual(typeof config.RATE_LIMIT, 'object');
        });

        it('should have API rate limit settings', () => {
            assert.ok(config.RATE_LIMIT.API_WINDOW_MS > 0);
            assert.ok(config.RATE_LIMIT.API_MAX_REQUESTS > 0);
        });

        it('should have conversion rate limit settings', () => {
            assert.ok(config.RATE_LIMIT.CONVERSION_WINDOW_MS > 0);
            assert.ok(config.RATE_LIMIT.CONVERSION_MAX_REQUESTS > 0);
        });

        it('should have info rate limit settings', () => {
            assert.ok(config.RATE_LIMIT.INFO_WINDOW_MS > 0);
            assert.ok(config.RATE_LIMIT.INFO_MAX_REQUESTS > 0);
        });

        it('conversion limit should be stricter than API limit', () => {
            assert.ok(
                config.RATE_LIMIT.CONVERSION_MAX_REQUESTS < config.RATE_LIMIT.API_MAX_REQUESTS,
                'Conversion limit should be more restrictive'
            );
        });
    });

    describe('Queue Config', () => {
        it('should have QUEUE object', () => {
            assert.ok(config.QUEUE, 'QUEUE should be defined');
            assert.strictEqual(typeof config.QUEUE, 'object');
        });

        it('should have CONCURRENCY setting', () => {
            assert.ok(config.QUEUE.CONCURRENCY > 0, 'Concurrency should be positive');
        });

        it('should have MAX_RETRIES setting', () => {
            assert.ok(config.QUEUE.MAX_RETRIES >= 0, 'Max retries should be non-negative');
        });

        it('should have RETRY_DELAY_MS setting', () => {
            assert.ok(config.QUEUE.RETRY_DELAY_MS > 0, 'Retry delay should be positive');
        });
    });
});
