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
