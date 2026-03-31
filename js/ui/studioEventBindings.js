const addBinding = (bindings, element, type, handler, options) => {
    if (!element || typeof element.addEventListener !== 'function') {
        return;
    }

    element.addEventListener(type, handler, options);
    bindings.push(() => element.removeEventListener(type, handler, options));
};

const getClosestFromTarget = (target, selector) => {
    if (typeof Element === 'undefined' || !(target instanceof Element)) {
        return null;
    }

    return target.closest(selector);
};

export const bindStudioEvents = ({
    documentRef = document,
    tabs = [],
    launchButtons = [],
    pointRailWindow = null,
    pointList = null,
    pointRail = null,
    assistantAction = null,
    applyPointTimeButton = null,
    nudgeBackButton = null,
    nudgeForwardButton = null,
    timeInputs = [],
    reviewPlayButton = null,
    reviewJumpButton = null,
    reviewLoopButton = null,
    motionMediaQuery = null,
    onSetMode = () => {},
    onLaunchGame = () => {},
    onSelectPoint = () => {},
    onJumpToSelectedPoint = () => {},
    onRequestAssistantUpdate = () => {},
    onShowTooltip = () => {},
    onHideTooltip = () => {},
    onSetLastInputMode = () => {},
    onMoveSelection = () => {},
    onNudgeSelectedPoint = () => {},
    onAssistantActionClick = () => {},
    onApplyPointTime = () => {},
    onClearEditorFeedback = () => {},
    onToggleReviewPlayback = () => {},
    onReviewJump = () => {},
    onToggleReviewLoop = () => {},
    onPointerInputMode = () => {},
    onReducedMotionChange = () => {}
} = {}) => {
    const bindings = [];

    tabs.forEach((tab) => {
        addBinding(bindings, tab, 'click', () => {
            onSetMode(tab.dataset.panelMode || 'studio');
        });
    });

    launchButtons.forEach((button) => {
        addBinding(bindings, button, 'click', () => {
            const gameId = button.dataset.gameLaunch;
            if (!gameId) {
                return;
            }

            onSetMode('arcade');
            onLaunchGame(gameId);
        });
    });

    addBinding(bindings, pointRailWindow, 'click', (event) => {
        const button = getClosestFromTarget(event.target, 'button.point-hit');
        if (!button) {
            return;
        }

        onSetLastInputMode('mouse');
        onSelectPoint(button.dataset.pointId, { focus: true });
        onJumpToSelectedPoint();
        onRequestAssistantUpdate();
    });

    addBinding(bindings, pointRailWindow, 'pointerover', (event) => {
        const button = getClosestFromTarget(event.target, 'button.point-hit');
        if (!button) {
            return;
        }

        onShowTooltip(button.dataset.pointId, button);
    });

    addBinding(bindings, pointRailWindow, 'pointerout', (event) => {
        const relatedTarget = event.relatedTarget;
        if (
            relatedTarget
            && pointRailWindow
            && relatedTarget !== pointRailWindow
            && pointRailWindow.contains?.(relatedTarget)
        ) {
            return;
        }

        onHideTooltip();
    });

    addBinding(bindings, pointList, 'click', (event) => {
        const card = getClosestFromTarget(event.target, '[data-point-card]');
        if (!card) {
            return;
        }

        onSelectPoint(card.dataset.pointCard, { focus: false });
        onJumpToSelectedPoint();
        onRequestAssistantUpdate();
    });

    addBinding(bindings, pointRail, 'keydown', (event) => {
        onSetLastInputMode('keyboard');

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            onMoveSelection(-1);
            onRequestAssistantUpdate();
            return;
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            onMoveSelection(1);
            onRequestAssistantUpdate();
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            onJumpToSelectedPoint();
            return;
        }

        if (event.key === '[') {
            event.preventDefault();
            onNudgeSelectedPoint(event.shiftKey ? -200 : -50);
            return;
        }

        if (event.key === ']') {
            event.preventDefault();
            onNudgeSelectedPoint(event.shiftKey ? 200 : 50);
        }
    });

    addBinding(bindings, assistantAction, 'click', () => {
        Promise.resolve(onAssistantActionClick()).catch((error) => {
            console.error('[TimeSyncStudio] Assistant action failed:', error);
        });
    });

    addBinding(bindings, applyPointTimeButton, 'click', () => {
        onApplyPointTime();
    });

    addBinding(bindings, nudgeBackButton, 'click', () => {
        onNudgeSelectedPoint(-100);
    });

    addBinding(bindings, nudgeForwardButton, 'click', () => {
        onNudgeSelectedPoint(100);
    });

    timeInputs.filter(Boolean).forEach((input) => {
        addBinding(bindings, input, 'keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                onApplyPointTime();
                return;
            }

            onClearEditorFeedback();
        });
    });

    addBinding(bindings, reviewPlayButton, 'click', () => {
        onToggleReviewPlayback();
    });

    addBinding(bindings, reviewJumpButton, 'click', () => {
        onReviewJump();
    });

    addBinding(bindings, reviewLoopButton, 'click', () => {
        onToggleReviewLoop();
    });

    if (documentRef?.addEventListener) {
        addBinding(bindings, documentRef, 'pointerdown', (event) => {
            onPointerInputMode(event?.pointerType);
        }, { passive: true });
    }

    if (motionMediaQuery) {
        const handler = (event) => {
            onReducedMotionChange(event.matches);
        };

        if (typeof motionMediaQuery.addEventListener === 'function') {
            motionMediaQuery.addEventListener('change', handler);
            bindings.push(() => motionMediaQuery.removeEventListener('change', handler));
        } else if (typeof motionMediaQuery.addListener === 'function') {
            motionMediaQuery.addListener(handler);
            bindings.push(() => motionMediaQuery.removeListener(handler));
        }
    }

    return () => {
        bindings.splice(0).reverse().forEach((dispose) => dispose());
    };
};
