import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import { Task } from '../types.js';

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
        title TEXT,
        status TEXT,
        filename TEXT,
        download_url TEXT,
        error TEXT,
        audio_stats TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_video_format ON tasks(video_id, format);
    CREATE INDEX IF NOT EXISTS idx_state ON tasks(state);
    CREATE INDEX IF NOT EXISTS idx_created_at ON tasks(created_at);
`);

try {
    db.exec('ALTER TABLE tasks ADD COLUMN title TEXT');
} catch {
    // Column already exists.
}

try {
    db.exec('ALTER TABLE tasks ADD COLUMN status TEXT');
} catch {
    // Column already exists.
}

try {
    db.exec('ALTER TABLE tasks ADD COLUMN audio_stats TEXT');
} catch {
    // Column already exists.
}

// Prepared statements for better performance
const statements = {
    insert: db.prepare(`
        INSERT INTO tasks (id, video_id, format, state, progress, title, status, audio_stats)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        SET state = ?, progress = ?, title = ?, status = ?, filename = ?, download_url = ?, error = ?, audio_stats = ?,
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

    markProcessingInterrupted: db.prepare(`
        UPDATE tasks
        SET state = 'error',
            progress = 0,
            status = 'Interrupted',
            error = 'Conversion was interrupted by a server restart',
            updated_at = strftime('%s', 'now')
        WHERE state = 'processing'
    `),

    delete: db.prepare(`
        DELETE FROM tasks WHERE id = ?
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

interface TaskRow {
    id: string;
    video_id: string;
    format: string;
    state: Task['state'];
    progress: number;
    filename: string | null;
    download_url: string | null;
    error: string | null;
    audio_stats: string | null;
    title: string | null;
    status: string | null;
    created_at: number;
    updated_at: number;
}

const serializeAudioStats = (audioStats: Task['audioStats'] | null | undefined): string | null => {
    return audioStats ? JSON.stringify(audioStats) : null;
};

const parseAudioStats = (audioStats: string | null): Task['audioStats'] | undefined => {
    if (!audioStats) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(audioStats);
        return parsed && typeof parsed === 'object' ? parsed as Task['audioStats'] : undefined;
    } catch {
        return undefined;
    }
};

const mapTaskRow = (row: TaskRow): Task => ({
    taskId: row.id,
    videoId: row.video_id,
    format: row.format,
    state: row.state,
    progress: row.progress,
    title: row.title || undefined,
    status: row.status || undefined,
    filename: row.filename || undefined,
    downloadUrl: row.download_url || undefined,
    error: row.error || undefined,
    audioStats: parseAudioStats(row.audio_stats),
    createdAt: row.created_at * 1000,
    updatedAt: row.updated_at * 1000
});

/**
 * Generate unique task ID
 */
const generateTaskId = (): string => {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
};

/**
 * Create a new task
 * @param videoId - YouTube video ID
 * @param format - Output format (mp3/mp4)
 * @param externalId - Optional caller-provided task ID. If omitted, one is generated.
 * @param taskData - Optional task metadata for richer facade callers.
 */
export const createTask = (
    videoId: string,
    format: string,
    externalId?: string,
    taskData: Partial<Task> = {}
): Partial<Task> => {
    const taskId = externalId ?? generateTaskId();
    const state = taskData.state ?? 'processing';
    const progress = taskData.progress ?? 0;
    const title = taskData.title ?? null;
    const status = taskData.status ?? null;
    const audioStats = serializeAudioStats(taskData.audioStats);

    statements.insert.run(taskId, videoId, format, state, progress, title, status, audioStats);

    return {
        taskId,
        videoId,
        format,
        state,
        progress,
        title: taskData.title,
        status: taskData.status,
        audioStats: taskData.audioStats
    };
};

/**
 * Get task by ID
 */
export const getTask = (taskId: string): Task | null => {
    const row = statements.getById.get(taskId) as TaskRow | undefined;

    if (!row) return null;

    return mapTaskRow(row);
};

/**
 * Find existing task for video/format combo (idempotency)
 */
export const findExistingTask = (videoId: string, format: string): Task | null => {
    const row = statements.findExisting.get(videoId, format) as TaskRow | undefined;

    if (!row) return null;

    // Check if completed task still has file
    if (row.state === 'completed' && row.filename) {
        const filePath = path.join(config.DOWNLOADS_DIR, row.filename);
        if (!fs.existsSync(filePath)) {
            // File was cleaned up, don't reuse this task
            return null;
        }
    }

    return mapTaskRow(row);
};

/**
 * Update task state
 */
export const updateTask = (taskId: string, updates: Partial<Task>): Task | null => {
    const current = getTask(taskId);
    if (!current) return null;

    const state = updates.state ?? current.state;
    const progress = updates.progress ?? current.progress;
    const title = updates.title ?? current.title ?? null;
    const status = updates.status ?? current.status ?? null;
    const filename = updates.filename ?? current.filename ?? null;
    const downloadUrl = updates.downloadUrl ?? current.downloadUrl ?? null;
    const error = updates.error ?? current.error ?? null;
    const audioStats = serializeAudioStats(updates.audioStats ?? current.audioStats);

    statements.update.run(state, progress, title, status, filename, downloadUrl, error, audioStats, taskId);

    return getTask(taskId);
};

/**
 * Update just the progress (optimized)
 */
export const updateProgress = (taskId: string, progress: number): void => {
    statements.updateProgress.run(progress, taskId);
};

/**
 * Cleanup old tasks
 */
export const cleanupOldTasks = (maxAgeMs: number = config.FILE_MAX_AGE_MS): number => {
    const cutoff = Math.floor((Date.now() - maxAgeMs) / 1000);
    const result = statements.cleanup.run(cutoff);
    return result.changes;
};

export const markProcessingTasksInterrupted = (): number => {
    const result = statements.markProcessingInterrupted.run();
    return result.changes;
};

/**
 * Delete a task by ID.
 */
export const deleteTask = (taskId: string): void => {
    statements.delete.run(taskId);
};

/**
 * Get task statistics
 */
export const getStats = (): any => {
    return statements.getStats.get();
};

/**
 * Close database connection (for clean shutdown)
 */
export const closeDatabase = (): void => {
    db.close();
};

// Handle process exit
process.on('exit', () => db.close());
