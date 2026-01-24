/**
 * Sanitize a video title for use as a filename
 * @param {string} title - Raw video title
 * @returns {string} Filesystem-safe filename
 */
export function sanitizeFilename(title) {
    // Clean up common YouTube title patterns
    let cleanTitle = (title || 'video')
        // Remove common YouTube suffixes/prefixes
        .replace(/\s*\(Official\s*(Music\s*)?Video\)/gi, '')
        .replace(/\s*\(Official\s*Audio\)/gi, '')
        .replace(/\s*\(Lyric\s*Video\)/gi, '')
        .replace(/\s*\(Lyrics\)/gi, '')
        .replace(/\s*\[Official\s*(Music\s*)?Video\]/gi, '')
        .replace(/\s*\[Official\s*Audio\]/gi, '')
        .replace(/\s*\(Audio\)/gi, '')
        .replace(/\s*\(Visualizer\)/gi, '')
        .replace(/\s*\(HD\)/gi, '')
        .replace(/\s*\(HQ\)/gi, '')
        .replace(/\s*\(4K\)/gi, '')
        .replace(/\s*\(Remaster(ed)?\)/gi, '')
        .replace(/\s*\|\s*.*$/g, '')  // Remove everything after |
        .replace(/\s*\/\/\s*.*$/g, '') // Remove everything after //
        .trim();

    // Sanitize for filesystem - keep spaces and dashes for readability
    const safeTitle = cleanTitle
        .replace(/[<>:"/\\|?*✦]/g, '')  // Remove invalid filesystem chars
        .replace(/[^\x00-\x7F]/g, (char) => {
            // Keep common accented chars, remove others
            const commonAccents = 'àáâãäåèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÑÇ';
            return commonAccents.includes(char) ? char : '';
        })
        .replace(/\s{2,}/g, ' ')        // Replace multiple spaces with single
        .replace(/^\s+|\s+$/g, '')      // Trim whitespace
        .substring(0, 120)              // Limit length
        || 'download';                  // Fallback if empty

    return safeTitle;
}
