import { AssistantClient, renderAssistantFallback, renderAssistantResponse } from './assistantClient.js';
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
        this.autosync = {
            status: 'not_run',
            coverage: 0,
            confidence: 'low',
            issuesByPointId: {}
        };
        this.history = {
            undoStack: [],
            redoStack: []
        };
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
        this._tabHandlers = [];
        this._launchHandlers = [];
        this._boundPointClick = null;
        this._boundPointHover = null;
        this._boundPointLeave = null;
        this._boundPointListClick = null;
        this._boundKeydown = null;
        this._boundAssistantClick = null;
        this._boundReducedMotion = null;
        this._boundDocumentPointer = null;
        this._boundApplyPointTime = null;
        this._boundNudgeBack = null;
        this._boundNudgeForward = null;
        this._boundTimeInputKeydown = null;
        this._boundReviewPlayToggle = null;
        this._boundReviewJump = null;
        this._boundReviewLoop = null;
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
        this.destroy();

        this.tabs.forEach((tab) => {
            const handler = () => {
                this.setMode(tab.dataset.panelMode || 'studio');
            };

            tab.addEventListener('click', handler);
            this._tabHandlers.push({ element: tab, handler });
        });

        this.launchButtons.forEach((button) => {
            const handler = () => {
                const gameId = button.dataset.gameLaunch;
                if (!gameId) return;

                this.setMode('arcade');
                this.onLaunchGame(gameId);
            };

            button.addEventListener('click', handler);
            this._launchHandlers.push({ element: button, handler });
        });

        if (this.pointRailWindow) {
            this._boundPointClick = (event) => {
                const button = event.target.closest('button.point-hit');
                if (!button) return;

                this.lastInputMode = 'mouse';
                this.selectPoint(button.dataset.pointId, { focus: true });
                this.jumpToSelectedPoint();
                this.requestAssistantUpdate();
            };
            this.pointRailWindow.addEventListener('click', this._boundPointClick);

            this._boundPointHover = (event) => {
                const button = event.target.closest('button.point-hit');
                if (!button) return;

                this.showTooltip(button.dataset.pointId, button);
            };
            this.pointRailWindow.addEventListener('pointerover', this._boundPointHover);

            this._boundPointLeave = (event) => {
                const relatedTarget = event.relatedTarget;
                if (relatedTarget && this.pointRailWindow.contains(relatedTarget)) {
                    return;
                }

                this.hideTooltip();
            };
            this.pointRailWindow.addEventListener('pointerout', this._boundPointLeave);
        }

        if (this.pointList) {
            this._boundPointListClick = (event) => {
                const card = event.target.closest('[data-point-card]');
                if (!card) return;

                this.selectPoint(card.dataset.pointCard, { focus: false });
                this.jumpToSelectedPoint();
                this.requestAssistantUpdate();
            };
            this.pointList.addEventListener('click', this._boundPointListClick);
        }

        if (this.pointRail) {
            this._boundKeydown = (event) => {
                this.lastInputMode = 'keyboard';

                if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    this.moveSelection(-1);
                    this.requestAssistantUpdate();
                    return;
                }

                if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    this.moveSelection(1);
                    this.requestAssistantUpdate();
                    return;
                }

                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.jumpToSelectedPoint();
                    return;
                }

                if (event.key === '[') {
                    event.preventDefault();
                    this.nudgeSelectedPoint(event.shiftKey ? -200 : -50);
                    return;
                }

                if (event.key === ']') {
                    event.preventDefault();
                    this.nudgeSelectedPoint(event.shiftKey ? 200 : 50);
                    return;
                }
            };
            this.pointRail.addEventListener('keydown', this._boundKeydown);
        }

        if (this.assistantAction) {
            this._boundAssistantClick = async () => {
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
            };
            this.assistantAction.addEventListener('click', this._boundAssistantClick);
        }

        if (this.applyPointTimeButton) {
            this._boundApplyPointTime = () => {
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
            };
            this.applyPointTimeButton.addEventListener('click', this._boundApplyPointTime);
        }

        if (this.nudgeBackButton) {
            this._boundNudgeBack = () => this.nudgeSelectedPoint(-100);
            this.nudgeBackButton.addEventListener('click', this._boundNudgeBack);
        }

        if (this.nudgeForwardButton) {
            this._boundNudgeForward = () => this.nudgeSelectedPoint(100);
            this.nudgeForwardButton.addEventListener('click', this._boundNudgeForward);
        }

        if (this.selectedPointMinuteInput || this.selectedPointSecondInput || this.selectedPointMillisecondInput) {
            this._boundTimeInputKeydown = (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this._boundApplyPointTime?.();
                    return;
                }

                this.clearEditorFeedback();
            };
            [this.selectedPointMinuteInput, this.selectedPointSecondInput, this.selectedPointMillisecondInput]
                .filter(Boolean)
                .forEach((input) => input.addEventListener('keydown', this._boundTimeInputKeydown));
        }

        if (this.reviewPlayButton) {
            this._boundReviewPlayToggle = () => this.toggleReviewPlayback();
            this.reviewPlayButton.addEventListener('click', this._boundReviewPlayToggle);
        }

        if (this.reviewJumpButton) {
            this._boundReviewJump = () => this.jumpToSelectedPoint();
            this.reviewJumpButton.addEventListener('click', this._boundReviewJump);
        }

        if (this.reviewLoopButton) {
            this._boundReviewLoop = () => {
                this.reviewLoopEnabled = !this.reviewLoopEnabled;
                this.renderReviewPlayer();
            };
            this.reviewLoopButton.addEventListener('click', this._boundReviewLoop);
        }

        this._boundDocumentPointer = (event) => {
            const pointerType = event?.pointerType;
            this.lastInputMode = pointerType === 'touch'
                ? 'touch'
                : pointerType === 'pen'
                    ? 'mouse'
                    : 'mouse';
        };
        document.addEventListener('pointerdown', this._boundDocumentPointer, { passive: true });

        if (this.motionMediaQuery) {
            this._boundReducedMotion = (event) => {
                this.reducedMotion = event.matches;
                document.documentElement.dataset.motion = event.matches ? 'reduced' : 'full';
            };

            if (typeof this.motionMediaQuery.addEventListener === 'function') {
                this.motionMediaQuery.addEventListener('change', this._boundReducedMotion);
            } else if (typeof this.motionMediaQuery.addListener === 'function') {
                this.motionMediaQuery.addListener(this._boundReducedMotion);
            }
        }
    }

    destroy() {
        this._tabHandlers.forEach(({ element, handler }) => element.removeEventListener('click', handler));
        this._launchHandlers.forEach(({ element, handler }) => element.removeEventListener('click', handler));
        this._tabHandlers = [];
        this._launchHandlers = [];

        if (this.pointRailWindow && this._boundPointClick) {
            this.pointRailWindow.removeEventListener('click', this._boundPointClick);
        }
        if (this.pointRailWindow && this._boundPointHover) {
            this.pointRailWindow.removeEventListener('pointerover', this._boundPointHover);
        }
        if (this.pointRailWindow && this._boundPointLeave) {
            this.pointRailWindow.removeEventListener('pointerout', this._boundPointLeave);
        }
        if (this.pointList && this._boundPointListClick) {
            this.pointList.removeEventListener('click', this._boundPointListClick);
        }
        if (this.pointRail && this._boundKeydown) {
            this.pointRail.removeEventListener('keydown', this._boundKeydown);
        }
        if (this.assistantAction && this._boundAssistantClick) {
            this.assistantAction.removeEventListener('click', this._boundAssistantClick);
        }
        if (this.applyPointTimeButton && this._boundApplyPointTime) {
            this.applyPointTimeButton.removeEventListener('click', this._boundApplyPointTime);
        }
        if (this.nudgeBackButton && this._boundNudgeBack) {
            this.nudgeBackButton.removeEventListener('click', this._boundNudgeBack);
        }
        if (this.nudgeForwardButton && this._boundNudgeForward) {
            this.nudgeForwardButton.removeEventListener('click', this._boundNudgeForward);
        }
        if (this._boundTimeInputKeydown) {
            [this.selectedPointMinuteInput, this.selectedPointSecondInput, this.selectedPointMillisecondInput]
                .filter(Boolean)
                .forEach((input) => input.removeEventListener('keydown', this._boundTimeInputKeydown));
        }
        if (this.reviewPlayButton && this._boundReviewPlayToggle) {
            this.reviewPlayButton.removeEventListener('click', this._boundReviewPlayToggle);
        }
        if (this.reviewJumpButton && this._boundReviewJump) {
            this.reviewJumpButton.removeEventListener('click', this._boundReviewJump);
        }
        if (this.reviewLoopButton && this._boundReviewLoop) {
            this.reviewLoopButton.removeEventListener('click', this._boundReviewLoop);
        }
        if (this._boundDocumentPointer) {
            document.removeEventListener('pointerdown', this._boundDocumentPointer);
        }
        if (this.motionMediaQuery && this._boundReducedMotion) {
            if (typeof this.motionMediaQuery.removeEventListener === 'function') {
                this.motionMediaQuery.removeEventListener('change', this._boundReducedMotion);
            } else if (typeof this.motionMediaQuery.removeListener === 'function') {
                this.motionMediaQuery.removeListener(this._boundReducedMotion);
            }
        }

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

    setIdle() {
        this.clearAutosyncTimer();
        this.stage = 'setup';
        this.points = [];
        this.selectedPointId = null;
        this.nowPlayingPointId = null;
        this.history.undoStack = [];
        this.history.redoStack = [];
        this.errors = [];
        this.autosync = {
            status: 'not_run',
            coverage: 0,
            confidence: 'low',
            issuesByPointId: {}
        };
        this.currentAssistantResponse = null;
        this.assistantClient.clearResponse();
        this.hideTooltip();

        this.setStatus(
            'Setup',
            'Paste a video to build sync points.',
            'If subtitles are available, this panel turns them into line-start points you can review one by one.',
            'idle'
        );
        this.renderStageMeta();
        this.renderAssistantFallback('Add a video to create your first point rail.');
        this.renderPointRail();
        this.renderPointListPlaceholder([
            'The studio will create one point per lyric line start.',
            'Auto-sync fills draft timestamps before you review flagged points.',
            'You can also paste your own lyrics if the video does not include captions.'
        ]);
        this.renderSelectedPointEditor();
        this.renderReviewPlayer();
    }

    setLoading() {
        this.clearAutosyncTimer();
        this.stage = this.points.length > 0 ? this.stage : 'setup';
        if (!this.points.length) {
            this.selectedPointId = null;
            this.nowPlayingPointId = null;
            this.hideTooltip();
        }
        this.setStatus(
            'Loading',
            'Looking for subtitle lines.',
            'When lyric data arrives, the point rail will appear here with one point per line start.',
            'loading'
        );
        this.renderAssistantFallback('Loading lyric lines and point data…');

        if (!this.points.length) {
            this.renderPointListPlaceholder([
                'Checking the video for subtitle cues.',
                'If timing is missing, the studio will mark those points for review.'
            ]);
        }
        this.renderSelectedPointEditor();
        this.renderReviewPlayer();
    }

    setEmpty() {
        this.clearAutosyncTimer();
        this.stage = 'setup';
        this.points = [];
        this.selectedPointId = null;
        this.nowPlayingPointId = null;
        this.hideTooltip();
        this.autosync = {
            status: 'failed',
            coverage: 0,
            confidence: 'low',
            issuesByPointId: {}
        };

        this.setStatus(
            'No lyrics',
            'No subtitle track was found for this video.',
            'Paste your own lyric lines to create approximate points, or try another video with captions.',
            'muted'
        );
        this.renderStageMeta();
        this.renderAssistantFallback('No points were created because the video does not include usable subtitle lines.');
        this.renderPointRail();
        this.renderPointListPlaceholder([
            'Try a video that includes captions if you want to use the sync studio.',
            'Pasted lyrics will still work even when subtitle timing is unavailable.'
        ]);
        this.renderSelectedPointEditor();
        this.renderReviewPlayer();
    }

    setLyrics(lines) {
        this.clearAutosyncTimer();
        this.stage = 'lyrics';
        this.points = this.buildPoints(lines);
        this.selectedPointId = this.points[0]?.id ?? null;
        this.nowPlayingPointId = null;
        this.history.undoStack = [];
        this.history.redoStack = [];
        this.autosync = {
            status: 'not_run',
            coverage: 0,
            confidence: 'low',
            issuesByPointId: {}
        };
        this.errors = [];

        if (!this.points.length) {
            this.setEmpty();
            return;
        }

        this.setStatus(
            'Lyrics ready',
            'Points are ready for Auto-sync.',
            'Each point maps to a lyric line start. Run Auto-sync next, then fix only the flagged points.',
            'ready'
        );
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
        if (!this.points.length) {
            this.setIdle();
            return;
        }

        const hasReviewPoints = this.points.some((point) => point.status === 'needs_review');
        if (!hasReviewPoints && this.stage !== 'lyrics' && this.stage !== 'autosync') {
            this.stage = 'export';
        }

        this.setStatus(
            'Ready',
            'The point pass is ready.',
            'Use the assistant CTA to keep moving one point at a time, or export the timing JSON when you are done.',
            'done'
        );
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
        const nextSource = source?.kind === 'youtube' && source.videoId
            ? {
                kind: 'youtube',
                videoId: source.videoId,
                title: source.title || 'UNSPECIFIED',
                durationMs: Number.isFinite(source.durationMs) ? source.durationMs : null
            }
            : null;
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

    buildPoints(lines) {
        return (Array.isArray(lines) ? lines : []).map((line, index) => ({
            id: toPointId(index),
            index,
            textPreview: line.text || `Line ${index + 1}`,
            draftTimeMs: Number.isFinite(line.time) ? line.time : null,
            timeMs: null,
            status: 'pending',
            issues: [],
            sourceTimed: line.hasTiming !== false && Number.isFinite(line.time),
            isApproximate: Boolean(line.isApproximate)
        }));
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
        const selectedIndex = Math.max(0, this.points.findIndex((point) => point.id === this.selectedPointId));
        const totalPoints = this.points.length;
        const startIndex = clamp(selectedIndex - Math.floor(POINT_WINDOW_SIZE / 2), 0, Math.max(0, totalPoints - POINT_WINDOW_SIZE));
        const pointsWindow = this.points.slice(startIndex, startIndex + POINT_WINDOW_SIZE);
        const counts = this.points.reduce((acc, point) => {
            acc[point.status] += 1;
            return acc;
        }, { pending: 0, synced: 0, needs_review: 0 });

        const playerSeconds = this.reviewPlayerReady && typeof this.reviewPlayer?.getCurrentTime === 'function'
            ? this.reviewPlayer.getCurrentTime()
            : null;
        const playerState = this.reviewPlayerReady && typeof this.reviewPlayer?.getPlayerState === 'function'
            ? this.reviewPlayer.getPlayerState()
            : null;
        const selectedPoint = this.getSelectedPoint();
        const loopStart = selectedPoint?.timeMs ?? selectedPoint?.draftTimeMs ?? 0;
        const loopEnd = this.getLoopEndTime(selectedPoint?.id);

        return {
            schemaVersion: '1.0',
            stage: this.stage,
            project: {
                projectId: this.sessionId,
                title: this.getProjectTitle()
            },
            pointFlow: {
                totalPoints,
                currentPointId: this.selectedPointId,
                nextIncompletePointId: this.points.find((point) => point.status !== 'synced')?.id ?? null,
                windowPointIds: pointsWindow.map((point) => point.id),
                counts: {
                    pending: counts.pending,
                    synced: counts.synced,
                    needsReview: counts.needs_review
                },
                confirmMode: 'implicit_undo'
            },
            pointsWindow: pointsWindow.map((point) => ({
                id: point.id,
                index: point.index,
                textPreview: point.textPreview,
                timeMs: Number.isFinite(point.timeMs) ? point.timeMs : point.draftTimeMs ?? 0,
                status: point.status,
                issues: [...point.issues]
            })),
            playback: {
                playheadMs: Number.isFinite(playerSeconds) ? Math.round(playerSeconds * 1000) : 0,
                isPlaying: playerState === window.YT?.PlayerState?.PLAYING,
                loop: {
                    on: this.reviewLoopEnabled,
                    startMs: Number.isFinite(loopStart) ? loopStart : 0,
                    endMs: Number.isFinite(loopEnd) ? loopEnd : (Number.isFinite(loopStart) ? loopStart : 0)
                }
            },
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
            let timedPoints = 0;
            let previousTime = 0;
            const issuesByPointId = {};

            this.points = this.points.map((point, index) => {
                const fallbackTime = index === 0 ? 0 : previousTime + this.estimateGapMs;
                const nextTime = Number.isFinite(point.draftTimeMs) ? point.draftTimeMs : fallbackTime;
                const issues = [];

                if (point.sourceTimed) {
                    timedPoints += 1;
                } else {
                    issues.push('timing_estimated');
                }

                const gap = index === 0 ? 0 : nextTime - previousTime;
                if (index > 0 && gap < 500) {
                    issues.push('early_start');
                }
                if (index > 0 && gap > 7000) {
                    issues.push('late_start');
                }

                previousTime = nextTime;

                if (issues.length > 0) {
                    issuesByPointId[point.id] = issues;
                }

                return {
                    ...point,
                    timeMs: nextTime,
                    issues,
                    status: issues.length > 0 ? 'needs_review' : 'synced'
                };
            });

            const reviewPoint = this.points.find((point) => point.status === 'needs_review') ?? this.points[0] ?? null;
            this.selectedPointId = reviewPoint?.id ?? this.selectedPointId;
            this.autosync = {
                status: 'done',
                coverage: this.points.length ? timedPoints / this.points.length : 0,
                confidence: timedPoints / Math.max(this.points.length, 1) > 0.85 ? 'high' : timedPoints / Math.max(this.points.length, 1) > 0.5 ? 'medium' : 'low',
                issuesByPointId
            };
            this.stage = reviewPoint?.status === 'needs_review' ? 'review' : 'export';

            this.setStatus(
                reviewPoint?.status === 'needs_review' ? 'Review' : 'Ready',
                reviewPoint?.status === 'needs_review' ? 'Review the flagged points.' : 'Auto-sync is complete.',
                reviewPoint?.status === 'needs_review'
                    ? 'Only the points that need attention stay in the critical path now.'
                    : 'No obvious timing issues were flagged. You can export the timing JSON now.',
                reviewPoint?.status === 'needs_review' ? 'ready' : 'done'
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
        if (payload.scope !== 'needs_review') {
            return;
        }

        const changedPoints = [];
        this.points = this.points.map((point) => {
            if (point.status !== 'needs_review') {
                return point;
            }

            changedPoints.push({
                id: point.id,
                prevTimeMs: point.timeMs,
                prevStatus: point.status,
                prevIssues: [...point.issues]
            });

            return {
                ...point,
                status: 'synced',
                issues: []
            };
        });

        if (changedPoints.length === 0) {
            return;
        }

        this.history.undoStack.push({ type: 'APPLY_FIX', changes: changedPoints });
        this.history.redoStack = [];
        this.autosync.issuesByPointId = {};
        this.stage = 'export';
        this.setStatus(
            'Ready',
            'Flagged points were cleaned up.',
            'You can still undo this batch fix if you want to inspect points one by one.',
            'done'
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
        const pointIndex = this.points.findIndex((entry) => entry.id === pointId);
        if (pointIndex === -1) {
            return;
        }

        const point = this.points[pointIndex];
        const previous = {
            id: point.id,
            prevTimeMs: point.timeMs,
            prevStatus: point.status,
            prevIssues: [...point.issues]
        };

        const requestedTime = (point.timeMs ?? point.draftTimeMs ?? 0) + deltaMs;
        const nextTime = this.clampTimeMs(requestedTime);
        this.history.undoStack.push({ type: 'NUDGE_POINT', ...previous });
        this.history.redoStack = [];

        this.points[pointIndex] = {
            ...point,
            timeMs: nextTime,
            status: 'synced',
            issues: []
        };

        delete this.autosync.issuesByPointId[pointId];
        if (nextTime !== requestedTime) {
            const mediaDurationMs = this.getMediaDurationMs();
            if (requestedTime < 0) {
                this.setEditorFeedback('Reached the start of the track at 0:00.000.', 'warning');
            } else if (Number.isFinite(mediaDurationMs)) {
                this.setEditorFeedback(`Reached the end of the video at ${formatTime(mediaDurationMs)}.`, 'warning');
            }
        }
        if (!this.points.some((entry) => entry.status === 'needs_review') && this.stage !== 'lyrics' && this.stage !== 'autosync') {
            this.stage = 'export';
            this.setStatus(
                'Ready',
                'All flagged points are now confirmed.',
                'Export the timing JSON when you want a clean handoff.',
                'done'
            );
        } else {
            this.stage = 'review';
        }

        this.render();
    }

    startReviewPlaybackLoop() {
        if (this.reviewPlaybackTimerId) {
            return;
        }

        this.reviewPlaybackTimerId = window.setInterval(() => {
            const seconds = typeof this.reviewPlayer?.getCurrentTime === 'function'
                ? this.reviewPlayer.getCurrentTime()
                : null;
            const playheadMs = Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
            if (!Number.isFinite(playheadMs)) {
                return;
            }

            const pointForPlayhead = this.findPointForTime(playheadMs);
            if (pointForPlayhead && pointForPlayhead.id !== this.nowPlayingPointId) {
                this.nowPlayingPointId = pointForPlayhead.id;
                this.renderPointRail();
                this.renderPointList();
            }

            if (this.reviewLoopEnabled) {
                const selected = this.getSelectedPoint();
                const loopStart = selected?.timeMs ?? selected?.draftTimeMs;
                const loopEnd = this.getLoopEndTime(selected?.id);
                if (selected && Number.isFinite(loopStart) && Number.isFinite(loopEnd) && playheadMs >= loopEnd) {
                    this.reviewPlayer.seekTo(loopStart / 1000, true);
                    this.reviewPlayer.playVideo();
                }
            }

            this.renderReviewPlayer(playheadMs);
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
        if (!Number.isFinite(timeMs) || !this.points.length) {
            return null;
        }

        for (let index = this.points.length - 1; index >= 0; index -= 1) {
            const pointTime = this.points[index].timeMs ?? this.points[index].draftTimeMs;
            if (Number.isFinite(pointTime) && timeMs >= pointTime) {
                return this.points[index];
            }
        }

        return this.points[0];
    }

    getLoopEndTime(pointId) {
        const pointIndex = this.points.findIndex((point) => point.id === pointId);
        if (pointIndex === -1) {
            return null;
        }

        const nextTimedPoint = this.points.slice(pointIndex + 1)
            .find((point) => Number.isFinite(point.timeMs ?? point.draftTimeMs));
        return nextTimedPoint
            ? this.clampTimeMs(nextTimedPoint.timeMs ?? nextTimedPoint.draftTimeMs)
            : this.getMediaDurationMs();
    }

    getMediaDurationMs() {
        const playerDurationMs = this.reviewPlayerReady && typeof this.reviewPlayer?.getDuration === 'function'
            ? Math.round((this.reviewPlayer.getDuration() ?? 0) * 1000)
            : null;
        if (Number.isFinite(playerDurationMs) && playerDurationMs > 0) {
            return playerDurationMs;
        }

        return Number.isFinite(this.mediaSource?.durationMs) ? this.mediaSource.durationMs : null;
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
        const operation = this.history.undoStack.pop();
        if (!operation) return false;

        if (operation.type === 'NUDGE_POINT') {
            const pointIndex = this.points.findIndex((entry) => entry.id === operation.id);
            if (pointIndex === -1) {
                return false;
            }

            const current = this.points[pointIndex];
            this.history.redoStack.push({
                type: 'NUDGE_POINT',
                id: current.id,
                prevTimeMs: current.timeMs,
                prevStatus: current.status,
                prevIssues: [...current.issues]
            });
            this.points[pointIndex] = {
                ...current,
                timeMs: operation.prevTimeMs,
                status: operation.prevStatus,
                issues: [...operation.prevIssues]
            };
            if (operation.prevIssues.length > 0) {
                this.autosync.issuesByPointId[operation.id] = [...operation.prevIssues];
                this.stage = 'review';
            }
        }

        if (operation.type === 'APPLY_FIX') {
            operation.changes.forEach((change) => {
                const pointIndex = this.points.findIndex((entry) => entry.id === change.id);
                if (pointIndex === -1) return;

                this.points[pointIndex] = {
                    ...this.points[pointIndex],
                    timeMs: change.prevTimeMs,
                    status: change.prevStatus,
                    issues: [...change.prevIssues]
                };

                if (change.prevIssues.length > 0) {
                    this.autosync.issuesByPointId[change.id] = [...change.prevIssues];
                }
            });

            this.history.redoStack.push(operation);
            this.stage = 'review';
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
        const currentPlayheadMs = Number.isFinite(playheadMs)
            ? playheadMs
            : (this.reviewPlayerReady && typeof this.reviewPlayer?.getCurrentTime === 'function'
                ? Math.round(this.reviewPlayer.getCurrentTime() * 1000)
                : selectedTime ?? 0);
        const hasMediaSource = Boolean(this.mediaSource && this.reviewPlayerFrame);
        const isPlaying = this.reviewPlayerReady
            && this.reviewPlayer
            && this.reviewPlayer.getPlayerState?.() === window.YT?.PlayerState?.PLAYING;

        if (this.reviewPlayerSummary) {
            if (!this.mediaSource) {
                this.reviewPlayerSummary.textContent = 'Load a captioned YouTube video to review timing against playback.';
            } else if (!selected) {
                this.reviewPlayerSummary.textContent = 'Select a point to jump the review player to that line start.';
            } else if (!Number.isFinite(selectedTime)) {
                this.reviewPlayerSummary.textContent = `Point ${selected.index + 1} is still unassigned. Set a time first, then jump straight into review playback.`;
            } else {
                this.reviewPlayerSummary.textContent = `Review Point ${selected.index + 1} against the player. Clicking a point chip or card seeks directly to ${formatTime(selectedTime)}.`;
            }
        }

        if (this.reviewPlayButton) {
            this.reviewPlayButton.disabled = !this.reviewPlayerReady || !selected;
            this.reviewPlayButton.textContent = isPlaying ? 'Pause' : 'Play';
        }
        if (this.reviewJumpButton) {
            this.reviewJumpButton.disabled = !this.reviewPlayerReady || !selected || !Number.isFinite(selectedTime);
        }
        if (this.reviewLoopButton) {
            this.reviewLoopButton.disabled = !this.reviewPlayerReady || !selected || !Number.isFinite(selectedTime);
            this.reviewLoopButton.setAttribute('aria-pressed', this.reviewLoopEnabled ? 'true' : 'false');
            this.reviewLoopButton.classList.toggle('is-active', this.reviewLoopEnabled);
        }
        if (this.reviewTimeReadout) {
            this.reviewTimeReadout.textContent = formatTime(currentPlayheadMs) || '0:00.000';
        }
        if (this.reviewLoopRange) {
            const loopEnd = this.getLoopEndTime(selected?.id);
            this.reviewLoopRange.textContent = Number.isFinite(selectedTime) && Number.isFinite(loopEnd)
                ? `Loop range: ${formatTime(selectedTime)} -> ${formatTime(loopEnd)}`
                : 'Loop range appears when the selected point has timing.';
        }
        if (this.reviewPlayerFrame) {
            this.reviewPlayerFrame.hidden = !hasMediaSource;
            this.reviewPlayerFrame.classList.toggle('is-ready', hasMediaSource && this.reviewPlayerReady);
        }
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
