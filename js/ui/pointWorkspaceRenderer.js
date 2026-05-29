const STAGE_LABELS = {
    setup: {
        badge: 'Setup',
        label: 'Add media and lyric lines first.'
    },
    lyrics: {
        badge: 'Lyrics',
        label: 'Points are parsed. Auto-sync is the next step.'
    },
    autosync: {
        badge: 'Auto-sync',
        label: 'Draft timings are being filled now.'
    },
    sync: {
        badge: 'Sync',
        label: 'Work one point at a time.'
    },
    review: {
        badge: 'Review',
        label: 'Only flagged points stay in view.'
    },
    export: {
        badge: 'Export',
        label: 'The current point pass is ready to hand off.'
    }
};

export class PointWorkspaceRenderer {
    constructor({
        stageBadge,
        stageLabel,
        progressLabel,
        progressFill,
        countPending,
        countSynced,
        countReview,
        pointRail,
        pointRailWindow,
        pointTooltip,
        pointList,
        selectedPointSummary,
        selectedPointMinuteInput,
        selectedPointSecondInput,
        selectedPointMillisecondInput,
        applyPointTimeButton,
        nudgeBackButton,
        nudgeForwardButton,
        formatTime,
        escapeHtml,
        splitTimeParts,
        clamp
    } = {}) {
        this.stageBadge = stageBadge;
        this.stageLabel = stageLabel;
        this.progressLabel = progressLabel;
        this.progressFill = progressFill;
        this.countPending = countPending;
        this.countSynced = countSynced;
        this.countReview = countReview;
        this.pointRail = pointRail;
        this.pointRailWindow = pointRailWindow;
        this.pointTooltip = pointTooltip;
        this.pointList = pointList;
        this.selectedPointSummary = selectedPointSummary;
        this.selectedPointMinuteInput = selectedPointMinuteInput;
        this.selectedPointSecondInput = selectedPointSecondInput;
        this.selectedPointMillisecondInput = selectedPointMillisecondInput;
        this.applyPointTimeButton = applyPointTimeButton;
        this.nudgeBackButton = nudgeBackButton;
        this.nudgeForwardButton = nudgeForwardButton;
        this.formatTime = formatTime;
        this.escapeHtml = escapeHtml;
        this.splitTimeParts = splitTimeParts;
        this.clamp = clamp;
    }

    renderStageMeta({ stage, points }) {
        const counts = points.reduce((acc, point) => {
            const status = point?.status;
            if (status && status in acc) {
                acc[status] += 1;
            }
            return acc;
        }, { pending: 0, synced: 0, needs_review: 0 });
        const confirmed = counts.synced;
        const total = points.length;
        const percent = total === 0 ? 0 : confirmed / total;
        const stageMeta = STAGE_LABELS[stage] ?? STAGE_LABELS.setup;

        if (this.stageBadge) {
            this.stageBadge.textContent = stageMeta.badge;
        }
        if (this.stageLabel) {
            this.stageLabel.textContent = stageMeta.label;
        }
        if (this.progressLabel) {
            this.progressLabel.textContent = `${confirmed}/${total} points confirmed`;
        }
        if (this.progressFill) {
            this.progressFill.style.transform = `scaleX(${percent})`;
        }
        if (this.countPending) {
            this.countPending.textContent = String(counts.pending);
        }
        if (this.countSynced) {
            this.countSynced.textContent = String(counts.synced);
        }
        if (this.countReview) {
            this.countReview.textContent = String(counts.needs_review);
        }
    }

    renderPointRail({ points, selectedPointId, nowPlayingPointId, pointWindowSize }) {
        if (!this.pointRailWindow) {
            return;
        }

        if (!points.length) {
            this.hideTooltip();
            this.pointRail?.classList.add('is-empty');
            this.pointRailWindow.innerHTML = '<p class="point-rail-empty">No points yet.</p>';
            return;
        }

        this.pointRail?.classList.remove('is-empty');

        const currentIndex = Math.max(0, points.findIndex((point) => point.id === selectedPointId));
        const startIndex = this.clamp(
            currentIndex - Math.floor(pointWindowSize / 2),
            0,
            Math.max(0, points.length - pointWindowSize)
        );
        const windowPoints = points.slice(startIndex, startIndex + pointWindowSize);

        this.pointRailWindow.innerHTML = windowPoints.map((point) => {
            const isSelected = point.id === selectedPointId;
            const isNowPlaying = point.id === nowPlayingPointId;
            const stateClass = `${point.status}${isSelected ? ' is-selected' : ''}${isNowPlaying ? ' is-now-playing' : ''}`;
            const timeLabel = this.formatTime(point.timeMs ?? point.draftTimeMs) || 'Unassigned';
            const lyricLabel = this.escapeHtml(point.textPreview.length > 22 ? `${point.textPreview.slice(0, 22)}…` : point.textPreview);
            return `
                <button
                    type="button"
                    class="point-hit ${stateClass}"
                    data-point-id="${point.id}"
                    aria-label="Point ${point.index + 1}, ${timeLabel}, ${point.status.replace('_', ' ')}"
                    aria-current="${isSelected ? 'true' : 'false'}">
                    <span class="point-label">${lyricLabel}</span>
                    <span class="point-dot" aria-hidden="true"></span>
                    <span class="point-time">${timeLabel}</span>
                </button>
            `;
        }).join('');
    }

    renderPointList({ points, stage, selectedPointId, nowPlayingPointId }) {
        if (!this.pointList) {
            return;
        }

        if (!points.length) {
            this.renderPointListPlaceholder(['No points yet.']);
            return;
        }

        const visiblePoints = stage === 'review'
            ? points.filter((point) => point.status === 'needs_review')
            : this.getPointWindowForList(points, selectedPointId);

        this.pointList.innerHTML = visiblePoints.map((point) => {
            const issueLabel = point.status === 'pending'
                ? 'waiting for timing'
                : point.issues.length > 0
                    ? point.issues.join(' · ').replaceAll('_', ' ')
                    : 'confirmed';
            const selected = point.id === selectedPointId ? ' is-selected' : '';
            const playing = point.id === nowPlayingPointId ? ' is-now-playing' : '';
            return `
                <article class="point-card${selected}${playing}" data-point-card="${point.id}">
                    <div class="point-card-meta">
                        <span class="point-card-index">Point ${point.index + 1}</span>
                        <span class="point-card-time">${this.formatTime(point.timeMs ?? point.draftTimeMs) || 'Unassigned'}</span>
                    </div>
                    <p class="point-card-text">${this.escapeHtml(point.textPreview)}</p>
                    <div class="point-card-footer">
                        <span class="point-card-status" data-status="${point.status}">${point.status.replace('_', ' ')}</span>
                        <span class="point-card-issues">${this.escapeHtml(issueLabel)}</span>
                    </div>
                </article>
            `;
        }).join('');
    }

    scrollSelectedPointCardIntoView(selectedPointId) {
        if (!this.pointList || !selectedPointId) {
            return;
        }

        const card = this.pointList.querySelector(`[data-point-card="${selectedPointId}"]`);
        card?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    renderPointListPlaceholder(lines) {
        if (!this.pointList) {
            return;
        }

        const icons = ['•', '•', '•'];
        this.pointList.innerHTML = lines.map((line, index) => `
            <article class="point-card placeholder">
                <div class="point-card-meta">
                    <span class="point-card-index">${icons[index] || '•'}</span>
                </div>
                <p class="point-card-text">${this.escapeHtml(line)}</p>
            </article>
        `).join('');
    }

    renderSelectedPointEditor({ selectedPoint, mediaDurationMs, onDeselect }) {
        if (this.selectedPointSummary) {
            this.selectedPointSummary.textContent = selectedPoint
                ? `Point ${selectedPoint.index + 1}: ${selectedPoint.textPreview}`
                : 'Select a point to edit its exact start time.';
        }
        if (!selectedPoint) {
            onDeselect?.();
        }

        const timeParts = this.splitTimeParts(selectedPoint ? (selectedPoint.timeMs ?? selectedPoint.draftTimeMs) : null);
        [this.selectedPointMinuteInput, this.selectedPointSecondInput, this.selectedPointMillisecondInput].forEach((input) => {
            if (!input) {
                return;
            }
            input.disabled = !selectedPoint;
        });
        if (this.selectedPointMinuteInput) {
            this.selectedPointMinuteInput.value = timeParts.minutes;
            this.selectedPointMinuteInput.max = Number.isFinite(mediaDurationMs)
                ? String(Math.floor(mediaDurationMs / 60000))
                : '';
        }
        if (this.selectedPointSecondInput) {
            this.selectedPointSecondInput.value = timeParts.seconds;
        }
        if (this.selectedPointMillisecondInput) {
            this.selectedPointMillisecondInput.value = timeParts.milliseconds;
        }

        [this.applyPointTimeButton, this.nudgeBackButton, this.nudgeForwardButton].forEach((button) => {
            if (!button) {
                return;
            }
            button.disabled = !selectedPoint;
        });
    }

    showTooltip({ points, pointId, anchor }) {
        if (!this.pointTooltip) {
            return;
        }

        const point = points.find((entry) => entry.id === pointId);
        if (!point) {
            return;
        }

        this.pointTooltip.hidden = false;
        this.pointTooltip.innerHTML = `
            <strong>Point ${point.index + 1}</strong>
            <span>${this.formatTime(point.timeMs ?? point.draftTimeMs) || 'Unassigned'} · ${this.escapeHtml(point.status.replace('_', ' '))}</span>
            <span>${this.escapeHtml(point.textPreview)}</span>
        `;

        const rect = anchor.getBoundingClientRect();
        const tooltipRect = this.pointTooltip.getBoundingClientRect();
        const desiredLeft = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        const maxLeft = Math.max(16, window.innerWidth - tooltipRect.width - 16);
        const left = this.clamp(desiredLeft, 16, maxLeft);
        const top = rect.top - tooltipRect.height - 10 < 16
            ? rect.bottom + 10
            : rect.top - tooltipRect.height - 10;
        this.pointTooltip.style.left = `${left}px`;
        this.pointTooltip.style.top = `${top}px`;
    }

    hideTooltip() {
        if (!this.pointTooltip) {
            return;
        }
        this.pointTooltip.hidden = true;
        this.pointTooltip.innerHTML = '';
    }

    getPointWindowForList(points, selectedPointId) {
        const currentIndex = Math.max(0, points.findIndex((point) => point.id === selectedPointId));
        const startIndex = this.clamp(currentIndex - 3, 0, Math.max(0, points.length - 7));
        return points.slice(startIndex, startIndex + 7);
    }
}
