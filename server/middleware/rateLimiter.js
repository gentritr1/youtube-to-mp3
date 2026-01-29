/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse
 */

import rateLimit from 'express-rate-limit';

/**
 * Standard API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
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
 * 10 conversions per hour per IP
 */
export const conversionLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: {
        error: 'Conversion limit reached. You can convert up to 10 videos per hour.',
        retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use X-Forwarded-For for proxied requests (Render, etc.)
        return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    }
});

/**
 * Burst protection for info endpoint
 * 30 requests per minute per IP
 */
export const infoLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: {
        error: 'Too many info requests, please slow down.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Download rate limiter
 * 20 downloads per 10 minutes per IP
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
