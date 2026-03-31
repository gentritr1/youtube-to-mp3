export class AssistantClient {
    constructor({
        endpoint = '/api/assistant',
        sessionId = '',
        onRender = () => {},
        onFallback = () => {},
        onResponseChange = () => {}
    } = {}) {
        this.endpoint = endpoint;
        this.sessionId = sessionId;
        this.onRender = onRender;
        this.onFallback = onFallback;
        this.onResponseChange = onResponseChange;
        this.currentResponse = null;
        this.pendingRequestId = 0;
    }

    setSessionId(sessionId) {
        this.sessionId = sessionId;
    }

    getCurrentResponse() {
        return this.currentResponse;
    }

    clearResponse() {
        this.pendingRequestId += 1;
        this.currentResponse = null;
        this.onResponseChange(this.currentResponse);
    }

    async requestUpdate(snapshotBuilder, userText = '') {
        const requestId = Date.now() + Math.random();
        this.pendingRequestId = requestId;

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    userText,
                    uiSnapshot: snapshotBuilder()
                })
            });

            if (!response.ok) {
                throw new Error('Assistant request failed');
            }

            const payload = await response.json();
            if (this.pendingRequestId !== requestId) {
                return null;
            }

            this.currentResponse = payload;
            this.onResponseChange(this.currentResponse);
            this.onRender(payload);
            return payload;
        } catch (error) {
            if (this.pendingRequestId !== requestId) {
                return null;
            }

            this.currentResponse = null;
            this.onResponseChange(this.currentResponse);
            this.onFallback('The assistant is unavailable right now. You can still select a point and nudge it manually.');
            return null;
        }
    }

    async executeAction(action, handlers = {}) {
        if (!action || !handlers.isActionType?.(action.type)) {
            return;
        }

        switch (action.type) {
        case 'OPEN_PANEL':
            handlers.setMode?.('studio');
            if (action.payload?.panel) {
                handlers.openPanel?.(action.payload.panel);
            } else {
                handlers.focusPointRail?.();
            }
            break;
        case 'SELECT_POINT':
            handlers.selectPoint?.(action.payload?.pointId || action.targetPointId);
            break;
        case 'NUDGE_POINT':
            handlers.nudgePoint?.(action.payload?.pointId || action.targetPointId, Number(action.payload?.deltaMs) || 0);
            break;
        case 'START_AUTOSYNC':
            handlers.startAutosync?.();
            return;
        case 'APPLY_FIX':
            handlers.applyFix?.(action.payload || {});
            break;
        case 'EXPORT':
            handlers.exportProject?.();
            break;
        default:
            return;
        }

        handlers.render?.();
        await handlers.requestUpdate?.();
    }
}

export const renderAssistantResponse = ({ assistantText, assistantAction, assistantHint }, response) => {
    if (assistantText) {
        assistantText.textContent = response.assistantText;
    }

    if (assistantAction) {
        const actionType = response.nextAction?.type;
        assistantAction.hidden = !actionType;
        assistantAction.disabled = !actionType;
        assistantAction.textContent = response.nextAction?.label || 'Continue';
    }

    if (assistantHint) {
        const hint = response.hints?.[0];
        assistantHint.textContent = hint?.text || '';
        assistantHint.hidden = !hint?.text;
    }
};

export const renderAssistantFallback = ({ assistantText, assistantAction, assistantHint }, text) => {
    if (assistantText) {
        assistantText.textContent = text;
    }
    if (assistantAction) {
        assistantAction.hidden = true;
        assistantAction.disabled = true;
    }
    if (assistantHint) {
        assistantHint.hidden = true;
        assistantHint.textContent = '';
    }
};
