import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { Task } from '../types.js';

// In-memory task store
let tasks = new Map<string, Task>();

/**
 * Load tasks from disk
 */
export function loadTasks(): void {
    try {
        if (fs.existsSync(config.TASKS_FILE)) {
            const data = fs.readFileSync(config.TASKS_FILE, 'utf8');
            tasks = new Map(JSON.parse(data));
            console.log(`[TaskManager] Loaded ${tasks.size} tasks from disk`);
        }
    } catch (error) {
        console.error('[TaskManager] Failed to load tasks:', error);
    }
}

/**
 * Save tasks to disk
 */
export function saveTasks(): void {
    try {
        fs.writeFileSync(config.TASKS_FILE, JSON.stringify([...tasks]), 'utf8');
    } catch (error) {
        console.error('[TaskManager] Failed to save tasks:', error);
    }
}

/**
 * Get a task by ID
 */
export function getTask(taskId: string): Task | undefined {
    return tasks.get(taskId);
}

/**
 * Create a new task
 */
export function createTask(taskId: string, taskData: Partial<Task>): void {
    const defaultTask: Partial<Task> = {
        taskId,
        state: 'processing',
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    // Merge defaults with provided data, ensuring taskId matches the argument
    const fullTask = {
        ...defaultTask,
        ...taskData,
        taskId // Enforce taskId from argument
    } as Task;

    // Validate required fields
    if (!fullTask.videoId || !fullTask.format) {
        console.warn(`[TaskManager] Created task ${taskId} missing videoId or format`);
    }

    tasks.set(taskId, fullTask);
    saveTasks();
}

/**
 * Update an existing task
 */
export function updateTask(taskId: string, updates: Partial<Task>): void {
    const task = tasks.get(taskId);
    if (task) {
        Object.assign(task, updates);
        saveTasks();
    }
}

/**
 * Delete a task
 */
export function deleteTask(taskId: string): void {
    tasks.delete(taskId);
    saveTasks();
}

/**
 * Find existing task for idempotency
 */
export function findExistingTask(videoId: string, format: string): string | null {
    for (const [existingId, task] of tasks.entries()) {
        const isSameRequest = task.videoId === videoId && task.format === format;

        if (isSameRequest) {
            // Case 1: Processing - Reuse task
            if (task.state === 'processing') {
                console.log(`[Idempotency] Reusing processing task ${existingId}`);
                return existingId;
            }

            // Case 2: Completed - Check if file still exists
            if (task.state === 'completed' && task.filename) {
                const filePath = path.join(config.DOWNLOADS_DIR, task.filename);
                if (fs.existsSync(filePath)) {
                    console.log(`[Idempotency] Serving cached file from task ${existingId}`);
                    return existingId;
                } else {
                    // File deleted (cleanup), remove stale task
                    tasks.delete(existingId);
                }
            }
        }
    }
    return null;
}

/**
 * Get all tasks (for debugging/admin)
 */
export function getAllTasks(): Map<string, Task> {
    return tasks;
}
