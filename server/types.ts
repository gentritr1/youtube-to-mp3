export interface Task {
    taskId: string;
    videoId: string;
    format: string;
    state: 'processing' | 'completed' | 'error';
    progress: number;
    status?: string;
    title?: string;
    filename?: string;
    downloadUrl?: string;
    error?: string;
    createdAt?: number;
    updatedAt?: number;
    audioStats?: AudioStats;
}

export interface AudioStats {
    bitrate: number;
    sampleRate: number;
    lufs: number;
    peakDb: number;
    duration: number;
    fileSize: number;
}

export interface QueueStats {
    enabled: boolean;
    waiting?: number;
    active?: number;
    completed?: number;
    failed?: number;
    delayed?: number;
    total?: number;
    message?: string;
}

export interface VideoInfo {
    id: string;
    title: string;
    thumbnail: string;
    author: string;
    duration: string | null;
}

/**
 * Batch Download Types
 */
export interface BatchItem {
    videoId: string;
    format: 'mp3' | 'mp4';
    title?: string;
    taskId?: string;  // Assigned when batch is created
}

export interface BatchJob {
    batchId: string;
    items: BatchItem[];
    state: 'processing' | 'completed' | 'partial' | 'error';
    totalItems: number;
    completedItems: number;
    failedItems: number;
    processingItems: number;
    createdAt: number;
    updatedAt: number;
}

export interface BatchProgress {
    batchId: string;
    state: BatchJob['state'];
    overallProgress: number;
    totalItems: number;
    completedItems: number;
    failedItems: number;
    processingItems: number;
    items: Array<{
        videoId: string;
        taskId: string;
        state: Task['state'];
        progress: number;
        title?: string;
        downloadUrl?: string;
        error?: string;
    }>;
}
