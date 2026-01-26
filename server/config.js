/**
 * Server Configuration
 * Centralized constants and environment settings
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
    PORT: process.env.PORT || 3000,

    // Paths
    ROOT_DIR: path.resolve(__dirname, '..'),
    DOWNLOADS_DIR: path.resolve(__dirname, '..', 'downloads'),
    TASKS_FILE: path.resolve(__dirname, '..', 'tasks.json'),

    // Timeouts
    CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
    FILE_MAX_AGE_MS: 60 * 60 * 1000,     // 1 hour

    // Limits
    MAX_POLL_ATTEMPTS: 120,
    POLL_INTERVAL_MS: 1000,
};
