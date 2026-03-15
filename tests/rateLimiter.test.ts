/**
 * Tests for Rate Limiter Middleware
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
    apiLimiter,
    conversionLimiter,
    infoLimiter,
    downloadLimiter,
    skipOnLocalhost
} from '../server/middleware/rateLimiter.ts';
import { config } from '../server/config.ts';

const originalIsDev = config.IS_DEV;
const originalIsProd = config.IS_PROD;

afterEach(() => {
    config.IS_DEV = originalIsDev;
    config.IS_PROD = originalIsProd;
});

describe('Rate Limiter Configuration', () => {
    it('should export apiLimiter', () => {
        expect(apiLimiter).toBeDefined();
        expect(typeof apiLimiter).toBe('function');
    });

    it('should export conversionLimiter', () => {
        expect(conversionLimiter).toBeDefined();
        expect(typeof conversionLimiter).toBe('function');
    });

    it('should export infoLimiter', () => {
        expect(infoLimiter).toBeDefined();
        expect(typeof infoLimiter).toBe('function');
    });

    it('should export downloadLimiter', () => {
        expect(downloadLimiter).toBeDefined();
        expect(typeof downloadLimiter).toBe('function');
    });
});

describe('Rate Limiter Behavior', () => {
    it('apiLimiter should pass through normal requests', async () => {
        const mockReq = {
            ip: '127.0.0.1',
            path: '/api/test',
            headers: {},
            app: {
                get: (key) => {
                    if (key === 'trust proxy') return false;
                    return null;
                }
            }
        };
        const mockRes = {
            setHeader: () => { },
            status: () => ({ json: () => { } }),
            on: () => { } // Express response event emitter
        };
        let nextCalled = false;
        const mockNext = () => { nextCalled = true; };

        // First request should pass
        await apiLimiter(mockReq, mockRes, mockNext);

        expect(nextCalled).toBe(true);
    });

    it('apiLimiter should skip health check endpoint', async () => {
        const mockReq = {
            ip: '127.0.0.1',
            path: '/health',
            headers: {},
            app: {
                get: (key) => {
                    if (key === 'trust proxy') return false;
                    return null;
                }
            }
        };
        const mockRes = {
            setHeader: () => { },
            status: () => ({ json: () => { } }),
            on: () => { }
        };
        let nextCalled = false;
        const mockNext = () => { nextCalled = true; };

        await apiLimiter(mockReq, mockRes, mockNext);

        expect(nextCalled).toBe(true);
    });

    it('conversionLimiter should be configured', () => {
        expect(conversionLimiter).toBeDefined();
        expect(typeof conversionLimiter).toBe('function');
    });

    it('skipOnLocalhost should still detect localhost IPs in production mode', () => {
        config.IS_DEV = false;
        config.IS_PROD = true;

        expect(skipOnLocalhost({ ip: '127.0.0.1', socket: { remoteAddress: '10.0.0.5' } })).toBe(true);
        expect(skipOnLocalhost({ ip: '::1', socket: { remoteAddress: '10.0.0.5' } })).toBe(true);
        expect(skipOnLocalhost({ ip: undefined, socket: { remoteAddress: '::ffff:127.0.0.1' } })).toBe(true);
        expect(skipOnLocalhost({ ip: '203.0.113.10', socket: { remoteAddress: '203.0.113.10' } })).toBe(false);
    });
});
