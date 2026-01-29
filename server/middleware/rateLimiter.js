/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse
 */

import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

const { RATE_LIMIT } = config;

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
    // Skip rate limiting for health checks
    skip: (req) => req.path === '/health'
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
    validate: { trustProxy: false } // Disable validation error in tests
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
    legacyHeaders: false
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
    legacyHeaders: false
});
