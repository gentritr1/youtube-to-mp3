/**
 * Task Store Facade
 *
 * Canonical task persistence API. All route and service code imports from here.
 * Backed by SQLite (via sqliteTaskManager). Replaces the legacy in-memory
 * taskManager.ts.
 *
 * Phase 2 of the Architecture Cleanup.
 *
 * Design notes:
 *  - Function signatures match what consumers already use (legacy taskManager API)
 *    so migration is a one-line import swap per file.
 *  - findExistingTask returns string|null (taskId) to match the legacy contract,
 *    even though the SQLite layer returns a full Task.
 *  - updateTask is void to match legacy, even though SQLite returns Task|null.
 */

import {
    createTask as sqliteCreate,
    getTask as sqliteGet,
    findExistingTask as sqliteFindExisting,
    updateTask as sqliteUpdate,
    cleanupOldTasks as sqliteCleanup,
    closeDatabase as sqliteClose,
} from './sqliteTaskManager.js';
import { Task } from '../types.js';

// ── Create ──────────────────────────────────────────────────────────────────

/**
 * Create a new task.
 *
 * Matches legacy signature: createTask(taskId, partialTask) => void
 * Delegates to SQLite with the caller-provided taskId.
 */
export function createTask(taskId: string, taskData: Partial<Task>): void {
    sqliteCreate(
        taskData.videoId ?? '',
        taskData.format ?? 'mp3',
        taskId
    );
}

// ── Read ────────────────────────────────────────────────────────────────────

/**
 * Get a task by ID.
 * Returns Task | undefined (legacy used undefined, SQLite uses null).
 */
export function getTask(taskId: string): Task | undefined {
    return sqliteGet(taskId) ?? undefined;
}

/**
 * Find an existing task for the same video+format (idempotency check).
 * Returns the taskId string or null — matches legacy taskManager contract.
 */
export function findExistingTask(videoId: string, format: string): string | null {
    const task = sqliteFindExisting(videoId, format);
    return task?.taskId ?? null;
}

// ── Update ──────────────────────────────────────────────────────────────────

/**
 * Update an existing task.
 * Matches legacy signature: (taskId, updates) => void
 */
export function updateTask(taskId: string, updates: Partial<Task>): void {
    sqliteUpdate(taskId, updates);
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

/**
 * Clean up old tasks from the database.
 */
export function cleanupOldTasks(maxAgeMs?: number): number {
    return sqliteCleanup(maxAgeMs);
}

/**
 * Close the database connection (for graceful shutdown).
 */
export function closeDatabase(): void {
    sqliteClose();
}
