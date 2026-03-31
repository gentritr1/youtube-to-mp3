import { AssistantClient, renderAssistantFallback, renderAssistantResponse } from './assistantClient.js';
import {
    applyNeedsReviewFix,
    buildPointSnapshot,
    createAutosyncState,
    createHistoryState,
    findPointForTime,
    getLoopEndTime,
    nudgePointTiming,
    runAutosyncPass,
    undoPointChange
} from './pointTimingEngine.js';
import {
    buildReviewPlayerViewModel,
    getReviewPlayerDurationMs,
    getReviewPlayerPlayheadMs,
    normalizeReviewMediaSource,
    renderReviewPlayerPanel,
    stepReviewPlaybackLoop
} from './reviewPlayerPanel.js';
import {
    getEmptyStudioState,
    getFinishedPlaybackState,
    getIdleStudioState,
    getLoadingStudioState,
    getLyricsStudioState
} from './studioWorkflowState.js';
import { bindStudioEvents } from './studioEventBindings.js';
import { exportSyncProject } from './syncExporter.js';
import { PointWorkspaceRenderer } from './pointWorkspaceRenderer.js';
import { YouTubePlayerAdapter } from './youtubePlayerAdapter.js';

const ACTION_TYPES = new Set(['OPEN_PANEL', 'SELECT_POINT', 'NUDGE_POINT', 'START_AUTOSYNC', 'APPLY_FIX', 'EXPORT']);
const POINT_WINDOW_SIZE = 9;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const formatTime = (timeMs) => {
    if (!Number.isFinite(timeMs)) {
        return '';
    }

    const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    const milliseconds = String(Math.max(0, timeMs % 1000)).padStart(3, '0');
    return `${minutes}:${seconds}.${milliseconds}`;
};

const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toPointId = (index) => `P${index + 1}`;

const splitTimeParts = (timeMs) => {
    if (!Number.isFinite(timeMs)) {
        return { minutes: '', seconds: '', milliseconds: '' };
    }

    const safeMs = Math.max(0, Math.round(timeMs));
    const totalSeconds = Math.floor(safeMs / 1000);
    return {
        minutes: String(Math.floor(totalSeconds / 60)),
        seconds: String(totalSeconds % 60).padStart(2, '0'),
        milliseconds: String(safeMs % 1000).padStart(3, '0')
    };
};

const parseTimeParts = (minutesValue, secondsValue, millisecondsValue) => {
    const minutes = Number.parseInt(String(minutesValue ?? '').trim() || '0', 10);
    const seconds = Number.parseInt(String(secondsValue ?? '').trim() || '0', 10);
    const milliseconds = Number.parseInt(String(millisecondsValue ?? '').trim() || '0', 10);

    if (![minutes, seconds, milliseconds].every(Number.isFinite)) {
        return null;
    }

    if (minutes < 0 || seconds < 0 || seconds > 59 || milliseconds < 0 || milliseconds > 999) {
        return null;
    }

    return ((minutes * 60) + seconds) * 1000 + milliseconds;
};

const getTimePartsError = (minutesValue, secondsValue, millisecondsValue) => {
    const minutes = Number.parseInt(String(minutesValue ?? '').trim() || '0', 10);
    const seconds = Number.parseInt(String(secondsValue ?? '').trim() || '0', 10);
    const milliseconds = Number.parseInt(String(millisecondsValue ?? '').trim() || '0', 10);

    if (![minutes, seconds, milliseconds].every(Number.isFinite)) {
        return 'Use whole numbers for minutes, seconds, and milliseconds.';
    }

    if (minutes < 0) {
        return 'Minutes cannot be negative.';
    }

    if (seconds < 0 || seconds > 59) {
        return 'Seconds must stay between 0 and 59.';
    }

    if (milliseconds < 0 || milliseconds > 999) {
        return 'Milliseconds must stay between 0 and 999.';
    }

    return '';
};

export class TimeSyncStudio {
    constructor({
        root,
        tabs = [],
        views = {},
        statusBadge,
        statusTitle,
        statusDetail,
        stageBadge,
        stageLabel,
        progressLabel,
        progressFill,
        countPending,
        countSynced,
        countReview,
        assistantText,
        assistantAction,
        assistantHint,
        pointRail,
        pointRailWindow,
        pointTooltip,
        pointList,
        reviewPlayerSummary,
        reviewPlayerFrame,
        reviewPlayButton,
        reviewJumpButton,
        reviewLoopButton,
        reviewTimeReadout,
        reviewLoopRange,
        selectedPointSummary,
        selectedPointFeedback,
        selectedPointMinuteInput,
        selectedPointSecondInput,
        selectedPointMillisecondInput,
        applyPointTimeButton,
        nudgeBackButton,
        nudgeForwardButton,
        getProjectTitle = () => 'UNSPECIFIED',
        launchButtons = [],
        onLaunchGame = () => {}
    } = {}) {
        this.root = root;
        this.tabs = Array.from(tabs);
        this.views = views;
        this.statusBadge = statusBadge;
        this.statusTitle = statusTitle;
        this.statusDetail = statusDetail;
        this.stageBadge = stageBadge;
        this.stageLabel = stageLabel;
        this.progressLabel = progressLabel;
        this.progressFill = progressFill;
        this.countPending = countPending;
        this.countSynced = countSynced;
        this.countReview = countReview;
        this.assistantText = assistantText;
        this.assistantAction = assistantAction;
        this.assistantHint = assistantHint;
        this.pointRail = pointRail;
        this.pointRailWindow = pointRailWindow;
        this.pointTooltip = pointTooltip;
        this.pointList = pointList;
        this.reviewPlayerSummary = reviewPlayerSummary;
        this.reviewPlayerFrame = reviewPlayerFrame;
        this.reviewPlayButton = reviewPlayButton;
        this.reviewJumpButton = reviewJumpButton;
        this.reviewLoopButton = reviewLoopButton;
        this.reviewTimeReadout = reviewTimeReadout;
        this.reviewLoopRange = reviewLoopRange;
        this.selectedPointSummary = selectedPointSummary;
        this.selectedPointFeedback = selectedPointFeedback;
        this.selectedPointMinuteInput = selectedPointMinuteInput;
        this.selectedPointSecondInput = selectedPointSecondInput;
        this.selectedPointMillisecondInput = selectedPointMillisecondInput;
        this.applyPointTimeButton = applyPointTimeButton;
        this.nudgeBackButton = nudgeBackButton;
        this.nudgeForwardButton = nudgeForwardButton;
        this.getProjectTitle = getProjectTitle;
        this.launchButtons = Array.from(launchButtons);
        this.onLaunchGame = onLaunchGame;
        this.mode = 'studio';
        this.stage = 'setup';
        this.points = [];
        this.selectedPointId = null;
        this.nowPlayingPointId = null;
        this.autosync = createAutosyncState();
        this.history = createHistoryState();
        this.errors = [];
        this.lastInputMode = 'mouse';
        this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
        this.motionMediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
        this.sessionId = window.crypto?.randomUUID?.() ?? `sync_${Date.now()}`;
        this.currentAssistantResponse = null;
        this.assistantClient = new AssistantClient({
            sessionId: this.sessionId,
            onRender: (response) => this.renderAssistant(response),
            onFallback: (text) => this.renderAssistantFallback(text),
            onResponseChange: (response) => {
                this.currentAssistantResponse = response;
            }
        });
        this.autosyncTimerId = null;
        this.estimateGapMs = 2200;
        this.mediaSource = null;
        this.reviewLoopEnabled = false;
        this.reviewPlaybackTimerId = null;
        this.reviewPlayerRequestId = 0;
        this.reviewPlayerMountId = `yt-sync-player-${window.crypto?.randomUUID?.() ?? Date.now()}`;
        this.reviewPlayerAdapter = new YouTubePlayerAdapter({
            frameElement: this.reviewPlayerFrame,
            mountId: this.reviewPlayerMountId,
            onReady: () => {
                this.renderReviewPlayer();
            },
            onStateChange: (event, YT) => {
                const state = YT?.PlayerState ?? {};
                if (event.data === state.PLAYING) {
                    this.startReviewPlaybackLoop();
                } else if (event.data === state.PAUSED || event.data === state.ENDED) {
                    this.stopReviewPlaybackLoop();
                }
                this.renderReviewPlayer();
            },
            onError: (error) => {
                console.error('ensureReviewPlayer failed', error);
                this.renderReviewPlayer();
            }
        });
        this.editorFeedback = '';
        this.editorFeedbackTone = 'muted';
        this.disposeEventBindings = null;
        this.pointWorkspaceRenderer = new PointWorkspaceRenderer({
            stageBadge: this.stageBadge,
            stageLabel: this.stageLabel,
            progressLabel: this.progressLabel,
            progressFill: this.progressFill,
            countPending: this.countPending,
            countSynced: this.countSynced,
            countReview: this.countReview,
            pointRail: this.pointRail,
            pointRailWindow: this.pointRailWindow,
            pointTooltip: this.pointTooltip,
            pointList: this.pointList,
            selectedPointSummary: this.selectedPointSummary,
            selectedPointMinuteInput: this.selectedPointMinuteInput,
            selectedPointSecondInput: this.selectedPointSecondInput,
            selectedPointMillisecondInput: this.selectedPointMillisecondInput,
            applyPointTimeButton: this.applyPointTimeButton,
            nudgeBackButton: this.nudgeBackButton,
            nudgeForwardButton: this.nudgeForwardButton,
            formatTime,
            escapeHtml,
            splitTimeParts,
            clamp
        });
    }

    get reviewPlayer() {
        return this.reviewPlayerAdapter.getPlayer();
    }

    get reviewPlayerReady() {
        return this.reviewPlayerAdapter.isReady();
    }

    init() {
        if (!this.root) return;

        this.bindEvents();
        this.setIdle();
        this.setMode(this.mode);
    }

    bindEvents() {
        this.clearAutosyncTimer();
        this.stopReviewPlaybackLoop();
        this.reviewPlayerRequestId += 1;
        this.destroy();
        this.disposeEventBindings = bindStudioEvents({
            documentRef: document,
            tabs: this.tabs,
            launchButtons: this.launchButtons,
            pointRailWindow: this.pointRailWindow,
            pointList: this.pointList,
            pointRail: this.pointRail,
            assistantAction: this.assistantAction,
            applyPointTimeButton: this.applyPointTimeButton,
            nudgeBackButton: this.nudgeBackButton,
            nudgeForwardButton: this.nudgeForwardButton,
            timeInputs: [
                this.selectedPointMinuteInput,
                this.selectedPointSecondInput,
                this.selectedPointMillisecondInput
            ],
            reviewPlayButton: this.reviewPlayButton,
            reviewJumpButton: this.reviewJumpButton,
            reviewLoopButton: this.reviewLoopButton,
            motionMediaQuery: this.motionMediaQuery,
            onSetMode: (mode) => this.setMode(mode),
            onLaunchGame: (gameId) => this.onLaunchGame(gameId),
            onSelectPoint: (pointId, options) => this.selectPoint(pointId, options),
            onJumpToSelectedPoint: () => this.jumpToSelectedPoint(),
            onRequestAssistantUpdate: () => this.requestAssistantUpdate(),
            onShowTooltip: (pointId, anchor) => this.showTooltip(pointId, anchor),
            onHideTooltip: () => this.hideTooltip(),
            onSetLastInputMode: (mode) => {
                this.lastInputMode = mode;
            },
            onMoveSelection: (direction) => this.moveSelection(direction),
            onNudgeSelectedPoint: (deltaMs) => this.nudgeSelectedPoint(deltaMs),
            onAssistantActionClick: async () => {
                if (!this.currentAssistantResponse?.uiAction) {
                    return;
                }

                const nextAction = this.currentAssistantResponse.nextAction;
                const confirmUi = nextAction?.confirmUI;

                if (nextAction?.requiresConfirmation) {
                    const prompt = confirmUi?.prompt || 'Apply this action?';
                    const confirmed = window.confirm(prompt);
                    if (!confirmed) {
                        return;
                    }
                }

                await this.executeAction(this.currentAssistantResponse.uiAction);
            },
            onApplyPointTime: () => {
                const validationError = getTimePartsError(
                    this.selectedPointMinuteInput?.value,
                    this.selectedPointSecondInput?.value,
                    this.selectedPointMillisecondInput?.value
                );
                if (validationError) {
                    this.setEditorFeedback(validationError, 'error');
                    return;
                }

                const timeMs = parseTimeParts(
                    this.selectedPointMinuteInput?.value,
                    this.selectedPointSecondInput?.value,
                    this.selectedPointMillisecondInput?.value
                );
                if (!Number.isFinite(timeMs)) {
                    this.setEditorFeedback('Enter a valid point time before applying it.', 'error');
                    return;
                }

                this.setSelectedPointTime(timeMs);
            },
            onClearEditorFeedback: () => this.clearEditorFeedback(),
            onToggleReviewPlayback: () => this.toggleReviewPlayback(),
            onReviewJump: () => this.jumpToSelectedPoint(),
            onToggleReviewLoop: () => {
                this.reviewLoopEnabled = !this.reviewLoopEnabled;
                this.renderReviewPlayer();
            },
            onPointerInputMode: (pointerType) => {
                this.lastInputMode = pointerType === 'touch'
                    ? 'touch'
                    : pointerType === 'pen'
                        ? 'mouse'
                        : 'mouse';
            },
            onReducedMotionChange: (matches) => {
                this.reducedMotion = matches;
                document.documentElement.dataset.motion = matches ? 'reduced' : 'full';
            }
        });
    }

    destroy() {
        this.clearAutosyncTimer();
        this.reviewPlayerRequestId += 1;
        this.disposeEventBindings?.();
        this.disposeEventBindings = null;

        this.stopReviewPlaybackLoop();
        this.destroyReviewPlayer();
    }

    setOnLaunchGame(onLaunchGame) {
        this.onLaunchGame = onLaunchGame;
    }

    setMode(mode) {
        this.mode = mode === 'arcade' ? 'arcade' : 'studio';

        this.tabs.forEach((tab) => {
            const isActive = tab.dataset.panelMode === this.mode;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        Object.entries(this.views).forEach(([viewMode, view]) => {
            if (!view) return;
            view.classList.toggle('hidden', viewMode !== this.mode);
        });
    }

    openPanel(panel) {
        const messages = {
            setup_help: 'Add a captioned video or paste lyric lines to create your first sync points.',
            sync_help: 'Select the next point on the rail, then nudge it or set the exact time in the editor.'
        };
        const message = messages[panel];

        if (this.assistantHint && message) {
            this.assistantHint.textContent = message;
            this.assistantHint.hidden = false;
        }

        const focusTarget = panel === 'setup_help'
            ? this.assistantAction
            : this.pointRail;
        focusTarget?.focus?.();
    }

    setStatus(badge, title, detail, tone = 'idle') {
        if (this.statusBadge) {
            this.statusBadge.textContent = badge;
            this.statusBadge.dataset.tone = tone;
        }

        if (this.statusTitle) {
            this.statusTitle.textContent = title;
        }

        if (this.statusDetail) {
            this.statusDetail.textContent = detail;
        }
    }

    applyWorkflowState(nextState) {
        if ('stage' in nextState) {
            this.stage = nextState.stage;
        }
        if ('points' in nextState) {
            this.points = nextState.points;
        }
        if ('selectedPointId' in nextState) {
            this.selectedPointId = nextState.selectedPointId;
        }
        if ('nowPlayingPointId' in nextState) {
            this.nowPlayingPointId = nextState.nowPlayingPointId;
        }
        if ('history' in nextState) {
            this.history = nextState.history;
        }
        if ('errors' in nextState) {
            this.errors = nextState.errors;
        }
        if ('autosync' in nextState) {
            this.autosync = nextState.autosync;
        }
        if ('currentAssistantResponse' in nextState) {
            this.currentAssistantResponse = nextState.currentAssistantResponse;
        }
        if (nextState.clearTooltip) {
            this.hideTooltip();
        }
        if (nextState.status) {
            this.setStatus(
                nextState.status.badge,
                nextState.status.title,
                nextState.status.detail,
                nextState.status.tone
            );
        }
        if (nextState.assistantFallback) {
            this.renderAssistantFallback(nextState.assistantFallback);
        }
        if (nextState.pointListPlaceholder) {
            this.renderPointListPlaceholder(nextState.pointListPlaceholder);
        }
    }

    setIdle() {
        this.clearAutosyncTimer();
        const nextState = getIdleStudioState();
        this.applyWorkflowState(nextState);
        this.assistantClient.clearResponse();
        this.renderStageMeta();
        this.renderPointRail();
        this.renderSelectedPointEditor();
        this.renderReviewPlayer();
    }

    setLoading() {
        this.clearAutosyncTimer();
        const nextState = getLoadingStudioState({
            stage: this.stage,
            points: this.points
        });
        this.applyWorkflowState(nextState);
        this.renderSelectedPointEditor();
        this.renderReviewPlayer();
    }

    setEmpty() {
        this.clearAutosyncTimer();
        const nextState = getEmptyStudioState();
        this.applyWorkflowState(nextState);
        this.renderStageMeta();
        this.renderPointRail();
        this.renderSelectedPointEditor();
        this.renderReviewPlayer();
    }

    setLyrics(lines) {
        this.clearAutosyncTimer();
        const nextState = getLyricsStudioState({
            lines,
            createPointId: toPointId
        });
        this.applyWorkflowState(nextState);
        if (nextState.isEmpty) {
            this.renderStageMeta();
            this.renderPointRail();
            this.renderSelectedPointEditor();
            this.renderReviewPlayer();
            return;
        }

        this.render();
        this.requestAssistantUpdate();
    }

    setActiveLine(index) {
        const pointId = this.points[index]?.id;
        if (!pointId) return;

        this.nowPlayingPointId = pointId;
        this.renderPointRail();
        this.renderPointList();
        this.renderReviewPlayer();
    }

    finishPlayback() {
        const nextState = getFinishedPlaybackState({
            points: this.points,
            stage: this.stage
        });
        if (nextState.shouldResetToIdle) {
            this.setIdle();
            return;
        }

        this.applyWorkflowState(nextState);
        this.render();
        this.requestAssistantUpdate();
    }

    setActiveGame(gameId) {
        this.launchButtons.forEach((button) => {
            const isActive = button.dataset.gameLaunch === gameId;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    async setMediaSource(source) {
        const nextSource = normalizeReviewMediaSource(source);
        const changed = JSON.stringify(this.mediaSource) !== JSON.stringify(nextSource);

        if (!changed) {
            this.renderReviewPlayer();
            return;
        }

        const requestId = this.reviewPlayerRequestId + 1;
        this.reviewPlayerRequestId = requestId;
        this.mediaSource = nextSource;
        this.reviewLoopEnabled = false;

        await this.ensureReviewPlayer(requestId);
        this.renderReviewPlayer();
    }

    async ensureReviewPlayer(requestId = this.reviewPlayerRequestId) {
        this.stopReviewPlaybackLoop();

        if (!this.reviewPlayerFrame) {
            return;
        }

        if (!this.mediaSource) {
            this.destroyReviewPlayer();
            return;
        }

        if (this.mediaSource.kind !== 'youtube') {
            return;
        }

        if (this.reviewPlayerAdapter.hasVideo(this.mediaSource.videoId)) {
            return;
        }

        await this.reviewPlayerAdapter.loadForVideo(this.mediaSource.videoId, {
            isCurrentRequest: () => requestId === this.reviewPlayerRequestId && Boolean(this.mediaSource)
        });
    }

    destroyReviewPlayer() {
        this.stopReviewPlaybackLoop();
        this.reviewPlayerAdapter.destroy();
    }

    setEstimateGapMs(value) {
        if (Number.isFinite(value) && value > 0) {
            this.estimateGapMs = value;
        }
    }

    buildSnapshot() {
        const playerSeconds = this.reviewPlayerReady && typeof this.reviewPlayer?.getCurrentTime === 'function'
            ? this.reviewPlayer.getCurrentTime()
            : null;
        const playerState = this.reviewPlayerReady && typeof this.reviewPlayer?.getPlayerState === 'function'
            ? this.reviewPlayer.getPlayerState()
            : null;
        const snapshot = buildPointSnapshot({
            stage: this.stage,
            sessionId: this.sessionId,
            getProjectTitle: this.getProjectTitle,
            selectedPointId: this.selectedPointId,
            points: this.points,
            pointWindowSize: POINT_WINDOW_SIZE,
            currentPlayheadMs: Number.isFinite(playerSeconds) ? Math.round(playerSeconds * 1000) : 0,
            isPlaying: playerState === window.YT?.PlayerState?.PLAYING,
            reviewLoopEnabled: this.reviewLoopEnabled,
            reducedMotion: this.reducedMotion,
            lastInputMode: this.lastInputMode,
            getLoopEndTime: (pointId) => this.getLoopEndTime(pointId)
        });

        return {
            ...snapshot,
            autosync: {
                status: this.autosync.status,
                coverage: this.autosync.coverage,
                confidence: this.autosync.confidence,
                issuesByPointId: { ...this.autosync.issuesByPointId }
            },
            ui: {
                reducedMotion: this.reducedMotion,
                inputMode: this.lastInputMode
            },
            history: {
                undoDepth: this.history.undoStack.length,
                redoDepth: this.history.redoStack.length
            },
            errors: [...this.errors]
        };
    }

    async requestAssistantUpdate(userText = '') {
        if (!this.points.length && this.stage !== 'setup') {
            return;
        }

        await this.assistantClient.requestUpdate(() => this.buildSnapshot(), userText);
    }

    async executeAction(action) {
        await this.assistantClient.executeAction(action, {
            isActionType: (type) => ACTION_TYPES.has(type),
            setMode: (mode) => this.setMode(mode),
            openPanel: (panel) => this.openPanel(panel),
            focusPointRail: () => this.pointRail?.focus(),
            selectPoint: (pointId) => this.selectPoint(pointId, { focus: true }),
            nudgePoint: (pointId, deltaMs) => this.nudgePoint(pointId, deltaMs),
            startAutosync: () => this.startAutosync(),
            applyFix: (payload) => this.applyFix(payload),
            exportProject: () => this.exportProject(),
            render: () => this.render(),
            requestUpdate: () => this.requestAssistantUpdate()
        });
    }

    startAutosync() {
        if (!this.points.length) {
            return;
        }

        this.clearAutosyncTimer();
        this.stage = 'autosync';
        this.autosync.status = 'running';
        this.setStatus(
            'Syncing',
            'Auto-sync is filling point timings.',
            'This keeps the flow lightweight: draft every line start first, then review only the risky points.',
            'loading'
        );
        this.render();
        this.renderAssistantFallback('Auto-sync is running…');

        this.autosyncTimerId = window.setTimeout(() => {
            const nextState = runAutosyncPass({
                points: this.points,
                estimateGapMs: this.estimateGapMs,
                selectedPointId: this.selectedPointId
            });
            this.points = nextState.points;
            this.selectedPointId = nextState.selectedPointId;
            this.autosync = nextState.autosync;
            this.stage = nextState.stage;
            this.setStatus(
                nextState.status.badge,
                nextState.status.title,
                nextState.status.detail,
                nextState.status.tone
            );
            this.render();
            this.requestAssistantUpdate();
        }, 420);
    }

    clearAutosyncTimer() {
        if (!this.autosyncTimerId) return;
        window.clearTimeout(this.autosyncTimerId);
        this.autosyncTimerId = null;
    }

    applyFix(payload) {
        const nextState = applyNeedsReviewFix({
            points: this.points,
            history: this.history,
            autosync: this.autosync,
            payload
        });
        if (!nextState) {
            return;
        }

        this.points = nextState.points;
        this.history = nextState.history;
        this.autosync = nextState.autosync;
        this.stage = nextState.stage;
        this.setStatus(
            nextState.status.badge,
            nextState.status.title,
            nextState.status.detail,
            nextState.status.tone
        );
    }

    selectPoint(pointId, { focus = false } = {}) {
        const point = this.points.find((entry) => entry.id === pointId);
        if (!point) return;

        this.selectedPointId = point.id;
        this.renderPointRail();
        this.renderPointList();
        this.renderSelectedPointEditor();
        this.renderReviewPlayer();
        this.scrollSelectedPointCardIntoView();

        if (focus) {
            const button = this.pointRailWindow?.querySelector(`[data-point-id="${point.id}"]`);
            button?.focus();
        }
    }

    moveSelection(direction) {
        if (!this.points.length) {
            return;
        }

        const currentIndex = Math.max(0, this.points.findIndex((point) => point.id === this.selectedPointId));
        const nextIndex = clamp(currentIndex + direction, 0, this.points.length - 1);
        this.selectPoint(this.points[nextIndex].id);
    }

    jumpToSelectedPoint() {
        const point = this.getSelectedPoint();
        if (!point) return;

        this.nowPlayingPointId = point.id;
        const targetTime = this.clampTimeMs(point.timeMs ?? point.draftTimeMs);
        if (this.reviewPlayerReady && Number.isFinite(targetTime) && typeof this.reviewPlayer?.seekTo === 'function') {
            this.reviewPlayer.seekTo(targetTime / 1000, true);
            this.renderReviewPlayer();
        }
        this.renderPointRail();
        this.renderPointList();
        this.renderSelectedPointEditor();
    }

    toggleReviewPlayback() {
        if (!this.reviewPlayerReady || !this.reviewPlayer) {
            return;
        }

        const YT = window.YT;
        const state = this.reviewPlayer.getPlayerState?.();
        if (state === YT?.PlayerState?.PLAYING) {
            this.reviewPlayer.pauseVideo();
            return;
        }

        const point = this.getSelectedPoint();
        const targetTime = this.clampTimeMs(point?.timeMs ?? point?.draftTimeMs);
        if (Number.isFinite(targetTime)) {
            this.reviewPlayer.seekTo(targetTime / 1000, true);
        }
        this.reviewPlayer.playVideo();
    }

    nudgeSelectedPoint(deltaMs) {
        const selected = this.getSelectedPoint();
        if (!selected) return;

        this.nudgePoint(selected.id, deltaMs);
        this.requestAssistantUpdate();
    }

    setSelectedPointTime(timeMs) {
        const selected = this.getSelectedPoint();
        if (!selected || !Number.isFinite(timeMs)) {
            return;
        }

        const safeTimeMs = this.clampTimeMs(timeMs);
        const mediaDurationMs = this.getMediaDurationMs();
        if (safeTimeMs !== timeMs && Number.isFinite(mediaDurationMs)) {
            this.setEditorFeedback(`That value exceeded the video length, so it was capped at ${formatTime(mediaDurationMs)}.`, 'warning');
        } else {
            this.setEditorFeedback(`Point time set to ${formatTime(safeTimeMs)}.`, 'success');
        }
        this.nudgePoint(selected.id, safeTimeMs - (selected.timeMs ?? selected.draftTimeMs ?? 0));
        this.jumpToSelectedPoint();
        this.requestAssistantUpdate();
    }

    nudgePoint(pointId, deltaMs) {
        const nextState = nudgePointTiming({
            points: this.points,
            pointId,
            deltaMs,
            history: this.history,
            autosync: this.autosync,
            stage: this.stage,
            clampTimeMs: (timeMs) => this.clampTimeMs(timeMs),
            getMediaDurationMs: () => this.getMediaDurationMs(),
            formatTime
        });
        if (!nextState) {
            return;
        }

        this.points = nextState.points;
        this.history = nextState.history;
        this.autosync = nextState.autosync;
        this.stage = nextState.stage;
        if (nextState.editorFeedback) {
            this.setEditorFeedback(nextState.editorFeedback.message, nextState.editorFeedback.tone);
        }
        if (nextState.status) {
            this.setStatus(
                nextState.status.badge,
                nextState.status.title,
                nextState.status.detail,
                nextState.status.tone
            );
        }

        this.render();
    }

    startReviewPlaybackLoop() {
        if (this.reviewPlaybackTimerId) {
            return;
        }

        this.reviewPlaybackTimerId = window.setInterval(() => {
            const selected = this.getSelectedPoint();
            const loopState = stepReviewPlaybackLoop({
                reviewPlayer: this.reviewPlayer,
                reviewLoopEnabled: this.reviewLoopEnabled,
                selectedPoint: selected,
                nowPlayingPointId: this.nowPlayingPointId,
                findPointForTime: (timeMs) => this.findPointForTime(timeMs),
                getLoopEndTime: (pointId) => this.getLoopEndTime(pointId)
            });
            if (!Number.isFinite(loopState.playheadMs)) {
                return;
            }

            if (loopState.nextNowPlayingPointId && loopState.nextNowPlayingPointId !== this.nowPlayingPointId) {
                this.nowPlayingPointId = loopState.nextNowPlayingPointId;
                this.renderPointRail();
                this.renderPointList();
            }

            if (Number.isFinite(loopState.shouldLoopToMs)) {
                this.reviewPlayer.seekTo(loopState.shouldLoopToMs / 1000, true);
                this.reviewPlayer.playVideo();
            }

            this.renderReviewPlayer(loopState.playheadMs);
        }, 150);
    }

    stopReviewPlaybackLoop() {
        if (!this.reviewPlaybackTimerId) {
            return;
        }

        window.clearInterval(this.reviewPlaybackTimerId);
        this.reviewPlaybackTimerId = null;
    }

    findPointForTime(timeMs) {
        return findPointForTime(this.points, timeMs);
    }

    getLoopEndTime(pointId) {
        return getLoopEndTime({
            points: this.points,
            pointId,
            clampTimeMs: (timeMs) => this.clampTimeMs(timeMs),
            getMediaDurationMs: () => this.getMediaDurationMs()
        });
    }

    getMediaDurationMs() {
        return getReviewPlayerDurationMs({
            reviewPlayerReady: this.reviewPlayerReady,
            reviewPlayer: this.reviewPlayer,
            mediaSource: this.mediaSource
        });
    }

    clampTimeMs(timeMs) {
        if (!Number.isFinite(timeMs)) {
            return null;
        }

        const mediaDurationMs = this.getMediaDurationMs();
        const maxTimeMs = Number.isFinite(mediaDurationMs) && mediaDurationMs >= 0
            ? mediaDurationMs
            : Number.POSITIVE_INFINITY;
        return clamp(Math.round(timeMs), 0, maxTimeMs);
    }

    setEditorFeedback(message = '', tone = 'muted') {
        this.editorFeedback = message;
        this.editorFeedbackTone = tone;

        if (!this.selectedPointFeedback) {
            return;
        }

        this.selectedPointFeedback.textContent = message;
        this.selectedPointFeedback.hidden = !message;
        this.selectedPointFeedback.dataset.tone = tone;
    }

    clearEditorFeedback() {
        this.setEditorFeedback('', 'muted');
    }

    undo() {
        const nextState = undoPointChange({
            points: this.points,
            history: this.history,
            autosync: this.autosync
        });
        if (!nextState.applied) {
            return false;
        }

        this.points = nextState.points;
        this.history = nextState.history;
        this.autosync = nextState.autosync;
        if (nextState.stage) {
            this.stage = nextState.stage;
        }
        this.render();
        this.requestAssistantUpdate();
        return true;
    }

    exportProject() {
        exportSyncProject({
            sessionId: this.sessionId,
            title: this.getProjectTitle(),
            points: this.points
        });

        this.setStatus(
            'Exported',
            'Timing JSON exported.',
            'You can continue editing and export again if you want a newer pass.',
            'done'
        );
    }

    render() {
        this.renderStageMeta();
        this.renderPointRail();
        this.renderPointList();
        this.renderSelectedPointEditor();
        this.renderReviewPlayer();
    }

    renderStageMeta() {
        this.pointWorkspaceRenderer.renderStageMeta({
            stage: this.stage,
            points: this.points
        });
    }

    renderAssistant(response) {
        renderAssistantResponse({
            assistantText: this.assistantText,
            assistantAction: this.assistantAction,
            assistantHint: this.assistantHint
        }, response);
    }

    renderAssistantFallback(text) {
        renderAssistantFallback({
            assistantText: this.assistantText,
            assistantAction: this.assistantAction,
            assistantHint: this.assistantHint
        }, text);
    }

    renderPointRail() {
        this.pointWorkspaceRenderer.renderPointRail({
            points: this.points,
            selectedPointId: this.selectedPointId,
            nowPlayingPointId: this.nowPlayingPointId,
            pointWindowSize: POINT_WINDOW_SIZE
        });
    }

    renderPointList() {
        this.pointWorkspaceRenderer.renderPointList({
            points: this.points,
            stage: this.stage,
            selectedPointId: this.selectedPointId,
            nowPlayingPointId: this.nowPlayingPointId
        });
    }

    scrollSelectedPointCardIntoView() {
        this.pointWorkspaceRenderer.scrollSelectedPointCardIntoView(this.selectedPointId);
    }

    renderPointListPlaceholder(lines) {
        this.pointWorkspaceRenderer.renderPointListPlaceholder(lines);
    }

    getSelectedPoint() {
        return this.points.find((point) => point.id === this.selectedPointId) ?? null;
    }

    renderSelectedPointEditor() {
        const selected = this.getSelectedPoint();
        this.pointWorkspaceRenderer.renderSelectedPointEditor({
            selectedPoint: selected,
            mediaDurationMs: this.getMediaDurationMs(),
            onDeselect: () => this.clearEditorFeedback()
        });
    }

    renderReviewPlayer(playheadMs = null) {
        const selected = this.getSelectedPoint();
        const selectedTime = selected?.timeMs ?? selected?.draftTimeMs;
        const currentPlayheadMs = getReviewPlayerPlayheadMs({
            explicitPlayheadMs: playheadMs,
            reviewPlayerReady: this.reviewPlayerReady,
            reviewPlayer: this.reviewPlayer,
            fallbackPlayheadMs: selectedTime ?? 0
        });
        const hasMediaSource = Boolean(this.mediaSource && this.reviewPlayerFrame);
        const isPlaying = this.reviewPlayerReady
            && this.reviewPlayer
            && this.reviewPlayer.getPlayerState?.() === window.YT?.PlayerState?.PLAYING;
        const loopEnd = this.getLoopEndTime(selected?.id);
        const viewModel = buildReviewPlayerViewModel({
            mediaSource: this.mediaSource,
            selectedPoint: selected,
            selectedTimeMs: selectedTime,
            currentPlayheadMs,
            reviewPlayerReady: this.reviewPlayerReady,
            isPlaying,
            reviewLoopEnabled: this.reviewLoopEnabled,
            loopEndMs: loopEnd,
            hasFrame: hasMediaSource,
            formatTime
        });

        renderReviewPlayerPanel({
            reviewPlayerSummary: this.reviewPlayerSummary,
            reviewPlayButton: this.reviewPlayButton,
            reviewJumpButton: this.reviewJumpButton,
            reviewLoopButton: this.reviewLoopButton,
            reviewTimeReadout: this.reviewTimeReadout,
            reviewLoopRange: this.reviewLoopRange,
            reviewPlayerFrame: this.reviewPlayerFrame
        }, viewModel);
    }

    showTooltip(pointId, anchor) {
        this.pointWorkspaceRenderer.showTooltip({
            points: this.points,
            pointId,
            anchor
        });
    }

    hideTooltip() {
        this.pointWorkspaceRenderer.hideTooltip();
    }
}
