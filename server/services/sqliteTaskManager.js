/**
 * SQLite Task Manager
 * Persistent task storage using SQLite database
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

// Database file path
// Database file path
const DB_PATH = config.DB_PATH || path.join(config.ROOT_DIR, 'tasks.db');

// Initialize database
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tasks table if not exists
db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        format TEXT NOT NULL,
        state TEXT DEFAULT 'processing',
        progress INTEGER DEFAULT 0,
        filename TEXT,
        download_url TEXT,
        error TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_video_format ON tasks(video_id, format);
    CREATE INDEX IF NOT EXISTS idx_state ON tasks(state);
    CREATE INDEX IF NOT EXISTS idx_created_at ON tasks(created_at);
`);

// Prepared statements for better performance
const statements = {
    insert: db.prepare(`
        INSERT INTO tasks (id, video_id, format, state, progress)
        VALUES (?, ?, ?, 'processing', 0)
    `),

    getById: db.prepare(`
        SELECT * FROM tasks WHERE id = ?
    `),

    findExisting: db.prepare(`
        SELECT * FROM tasks 
        WHERE video_id = ? AND format = ? AND state != 'error'
        ORDER BY created_at DESC
        LIMIT 1
    `),

    update: db.prepare(`
        UPDATE tasks 
        SET state = ?, progress = ?, filename = ?, download_url = ?, error = ?,
            updated_at = strftime('%s', 'now')
        WHERE id = ?
    `),

    updateProgress: db.prepare(`
        UPDATE tasks SET progress = ?, updated_at = strftime('%s', 'now')
        WHERE id = ?
    `),

    cleanup: db.prepare(`
        DELETE FROM tasks 
        WHERE created_at < ? OR state = 'error'
    `),

    getStats: db.prepare(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN state = 'processing' THEN 1 ELSE 0 END) as processing,
            SUM(CASE WHEN state = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN state = 'error' THEN 1 ELSE 0 END) as errors
        FROM tasks
    `)
};

/**
 * Generate unique task ID
 */
const generateTaskId = () => {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create a new task
 */
export const createTask = (videoId, format) => {
    const taskId = generateTaskId();

    statements.insert.run(taskId, videoId, format);

    return {
        taskId,
        state: 'processing',
        progress: 0
    };
};

/**
 * Get task by ID
 */
export const getTask = (taskId) => {
    const row = statements.getById.get(taskId);

    if (!row) return null;

    return {
        taskId: row.id,
        videoId: row.video_id,
        format: row.format,
        state: row.state,
        progress: row.progress,
        filename: row.filename,
        downloadUrl: row.download_url,
        error: row.error,
        createdAt: row.created_at * 1000,
        updatedAt: row.updated_at * 1000
    };
};

/**
 * Find existing task for video/format combo (idempotency)
 */
export const findExistingTask = (videoId, format) => {
    const row = statements.findExisting.get(videoId, format);

    if (!row) return null;

    // Check if completed task still has file
    if (row.state === 'completed' && row.filename) {
        const filePath = path.join(config.DOWNLOADS_DIR, row.filename);
        if (!fs.existsSync(filePath)) {
            // File was cleaned up, don't reuse this task
            return null;
        }
    }

    return {
        taskId: row.id,
        videoId: row.video_id,
        format: row.format,
        state: row.state,
        progress: row.progress,
        filename: row.filename,
        downloadUrl: row.download_url,
        error: row.error
    };
};

/**
 * Update task state
 */
export const updateTask = (taskId, updates) => {
    const current = getTask(taskId);
    if (!current) return null;

    const state = updates.state || current.state;
    const progress = updates.progress ?? current.progress;
    const filename = updates.filename || current.filename;
    const downloadUrl = updates.downloadUrl || current.downloadUrl;
    const error = updates.error || current.error;

    statements.update.run(state, progress, filename, downloadUrl, error, taskId);

    return getTask(taskId);
};

/**
 * Update just the progress (optimized)
 */
export const updateProgress = (taskId, progress) => {
    statements.updateProgress.run(progress, taskId);
};

/**
 * Cleanup old tasks
 */
export const cleanupOldTasks = (maxAgeMs = config.FILE_MAX_AGE_MS) => {
    const cutoff = Math.floor((Date.now() - maxAgeMs) / 1000);
    const result = statements.cleanup.run(cutoff);
    return result.changes;
};

/**
 * Get task statistics
 */
export const getStats = () => {
    return statements.getStats.get();
};

/**
 * Close database connection (for clean shutdown)
 */
export const closeDatabase = () => {
    db.close();
};

// Handle process exit
// Handle process exit
process.on('exit', () => db.close());
// Remove SIGINT handler that forces exit - let main process handle graceful shutdown
// process.on('SIGINT', ...);
