/**
 * Server Configuration
 * Centralized constants and environment settings
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parsedPort = Number.parseInt(process.env.PORT ?? '', 10);

export const config = {
    PORT: Number.isFinite(parsedPort) ? parsedPort : 3000,
    IS_PROD: !!process.env.RENDER || process.env.NODE_ENV === 'production',

    // Paths
    ROOT_DIR: path.resolve(__dirname, '..'),
    DOWNLOADS_DIR: path.resolve(__dirname, '..', 'downloads'),
    TASKS_FILE: path.resolve(__dirname, '..', 'tasks.json'),
    DB_PATH: path.resolve(__dirname, '..', 'tasks.db'),

    // Redis (for job queue)
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    USE_QUEUE: process.env.USE_QUEUE === 'true' || false,

    // Timeouts
    CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
    FILE_MAX_AGE_MS: 60 * 60 * 1000,     // 1 hour

    // Limits
    MAX_POLL_ATTEMPTS: 120,
    POLL_INTERVAL_MS: 1000,

    // Rate Limiting
    RATE_LIMIT: {
        API_WINDOW_MS: 15 * 60 * 1000,      // 15 minutes
        API_MAX_REQUESTS: 100,               // per window
        CONVERSION_WINDOW_MS: 60 * 60 * 1000, // 1 hour
        CONVERSION_MAX_REQUESTS: 10,         // per window
        INFO_WINDOW_MS: 60 * 1000,           // 1 minute
        INFO_MAX_REQUESTS: 30                // per window
    },

    // Queue settings
    QUEUE: {
        CONCURRENCY: 2,                      // Parallel jobs
        MAX_RETRIES: 2,
        RETRY_DELAY_MS: 5000
    }
};
