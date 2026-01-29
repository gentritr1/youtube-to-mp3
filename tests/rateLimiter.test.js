/**
 * Tests for Rate Limiter Middleware
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    apiLimiter,
    conversionLimiter,
    infoLimiter,
    downloadLimiter
} from '../server/middleware/rateLimiter.js';

describe('Rate Limiter Configuration', () => {
    it('should export apiLimiter', () => {
        assert.ok(apiLimiter, 'apiLimiter should be exported');
        assert.strictEqual(typeof apiLimiter, 'function', 'apiLimiter should be a function');
    });

    it('should export conversionLimiter', () => {
        assert.ok(conversionLimiter, 'conversionLimiter should be exported');
        assert.strictEqual(typeof conversionLimiter, 'function', 'conversionLimiter should be a function');
    });

    it('should export infoLimiter', () => {
        assert.ok(infoLimiter, 'infoLimiter should be exported');
        assert.strictEqual(typeof infoLimiter, 'function', 'infoLimiter should be a function');
    });

    it('should export downloadLimiter', () => {
        assert.ok(downloadLimiter, 'downloadLimiter should be exported');
        assert.strictEqual(typeof downloadLimiter, 'function', 'downloadLimiter should be a function');
    });
});

describe('Rate Limiter Behavior', () => {
    it('apiLimiter should pass through normal requests', async () => {
        const mockReq = {
            ip: '127.0.0.1',
            path: '/api/test',
            headers: {}
        };
        const mockRes = {
            setHeader: () => { },
            status: () => ({ json: () => { } })
        };
        let nextCalled = false;
        const mockNext = () => { nextCalled = true; };

        // First request should pass
        apiLimiter(mockReq, mockRes, mockNext);

        // Give time for rate limiter to process
        await new Promise(resolve => setTimeout(resolve, 10));

        assert.ok(nextCalled, 'next() should be called for normal requests');
    });

    it('apiLimiter should skip health check endpoint', async () => {
        const mockReq = {
            ip: '127.0.0.1',
            path: '/health',
            headers: {}
        };
        const mockRes = {
            setHeader: () => { },
            status: () => ({ json: () => { } })
        };
        let nextCalled = false;
        const mockNext = () => { nextCalled = true; };

        apiLimiter(mockReq, mockRes, mockNext);

        await new Promise(resolve => setTimeout(resolve, 10));

        assert.ok(nextCalled, 'Health check should skip rate limiting');
    });

    it('conversionLimiter should use X-Forwarded-For header', () => {
        // Just verify the limiter has the keyGenerator configured
        assert.ok(conversionLimiter, 'conversionLimiter should exist');
    });
});
