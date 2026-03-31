export const buildSyncExportPayload = ({ sessionId, title, points }) => ({
    schemaVersion: '1.0',
    exportedAt: new Date().toISOString(),
    project: {
        id: sessionId,
        title
    },
    points: points.map((point) => ({
        id: point.id,
        index: point.index,
        textPreview: point.textPreview,
        timeMs: point.timeMs,
        status: point.status
    }))
});

export const exportSyncProject = ({
    sessionId,
    title,
    points,
    fileName = 'lyrics-sync-points.json'
}) => {
    const exportPayload = buildSyncExportPayload({ sessionId, title, points });
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    let url = '';
    let link = null;

    try {
        url = URL.createObjectURL(blob);
        link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
    } finally {
        link?.remove();
        if (url) {
            URL.revokeObjectURL(url);
        }
    }

    return exportPayload;
};
