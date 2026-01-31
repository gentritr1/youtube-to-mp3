/**
 * Format duration in seconds to MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string|null} Formatted duration or null
 */
export function formatDuration(seconds: number): string | null {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
