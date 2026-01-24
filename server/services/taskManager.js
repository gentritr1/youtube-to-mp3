/**
 * Task Manager Service
 * Handles task CRUD, persistence, and idempotency
 */

import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

// In-memory task store
let tasks = new Map();

/**
 * Load tasks from disk
 */
export function loadTasks() {
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
export function saveTasks() {
    try {
        fs.writeFileSync(config.TASKS_FILE, JSON.stringify([...tasks]), 'utf8');
    } catch (error) {
        console.error('[TaskManager] Failed to save tasks:', error);
    }
}

/**
 * Get a task by ID
 * @param {string} taskId
 * @returns {object|undefined}
 */
export function getTask(taskId) {
    return tasks.get(taskId);
}

/**
 * Create a new task
 * @param {string} taskId 
 * @param {object} taskData 
 */
export function createTask(taskId, taskData) {
    tasks.set(taskId, taskData);
    saveTasks();
}

/**
 * Update an existing task
 * @param {string} taskId 
 * @param {object} updates 
 */
export function updateTask(taskId, updates) {
    const task = tasks.get(taskId);
    if (task) {
        Object.assign(task, updates);
        saveTasks();
    }
}

/**
 * Delete a task
 * @param {string} taskId 
 */
export function deleteTask(taskId) {
    tasks.delete(taskId);
    saveTasks();
}

/**
 * Find existing task for idempotency
 * @param {string} videoId 
 * @param {string} format 
 * @returns {string|null} Existing task ID or null
 */
export function findExistingTask(videoId, format) {
    for (const [existingId, task] of tasks.entries()) {
        const isSameRequest = task.videoId === videoId && task.format === format;

        if (isSameRequest) {
            // Case 1: Processing - Reuse task
            if (task.state === 'processing') {
                console.log(`[Idempotency] Reusing processing task ${existingId}`);
                return existingId;
            }

            // Case 2: Completed - Check if file still exists
            if (task.state === 'completed') {
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
 * @returns {Map}
 */
export function getAllTasks() {
    return tasks;
}
