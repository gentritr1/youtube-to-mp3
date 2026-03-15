/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse
 */

import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

const { RATE_LIMIT } = config;

/**
 * Helper to skip rate limits on explicit local development or localhost traffic
 */
export const skipOnLocalhost = (req: any) => {
    if (config.IS_DEV) return true;

    const clientIp = req.ip || req.socket?.remoteAddress;
    return clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
};

/**
 * Standard API rate limiter
 */
export const apiLimiter = rateLimit({
    windowMs: RATE_LIMIT.API_WINDOW_MS,
    max: RATE_LIMIT.API_MAX_REQUESTS,
    message: {
        error: 'Too many requests, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false,
    // Skip rate limiting for health checks and localhost
    skip: (req) => req.path === '/health' || skipOnLocalhost(req)
});

/**
 * Strict rate limiter for conversion endpoint
 */
export const conversionLimiter = rateLimit({
    windowMs: RATE_LIMIT.CONVERSION_WINDOW_MS,
    max: RATE_LIMIT.CONVERSION_MAX_REQUESTS,
    message: {
        error: `Conversion limit reached. You can convert up to ${RATE_LIMIT.CONVERSION_MAX_REQUESTS} videos per hour.`,
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Use default keyGenerator - works with trust proxy setting
    validate: { trustProxy: false }, // Disable validation error in tests
    skip: skipOnLocalhost
});

/**
 * Burst protection for info endpoint
 */
export const infoLimiter = rateLimit({
    windowMs: RATE_LIMIT.INFO_WINDOW_MS,
    max: RATE_LIMIT.INFO_MAX_REQUESTS,
    message: {
        error: 'Too many info requests, please slow down.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipOnLocalhost
});

/**
 * Download rate limiter
 */
export const downloadLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 20,
    message: {
        error: 'Download limit reached, please try again later.',
        retryAfter: '10 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipOnLocalhost
});
