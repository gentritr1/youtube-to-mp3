// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { bindStudioEvents } from '../js/ui/studioEventBindings.js';

describe('studioEventBindings', () => {
    it('binds point rail and list interactions, then cleans them up', async () => {
        document.body.innerHTML = `
            <div>
                <div id="rail-window">
                    <button class="point-hit" data-point-id="P1">Point</button>
                </div>
                <div id="point-list">
                    <article data-point-card="P2">Card</article>
                </div>
                <button id="assistant"></button>
            </div>
        `;

        const onSelectPoint = vi.fn();
        const onJumpToSelectedPoint = vi.fn();
        const onRequestAssistantUpdate = vi.fn();
        const onShowTooltip = vi.fn();
        const onHideTooltip = vi.fn();
        const onAssistantActionClick = vi.fn(async () => {});

        const dispose = bindStudioEvents({
            pointRailWindow: document.getElementById('rail-window'),
            pointList: document.getElementById('point-list'),
            assistantAction: document.getElementById('assistant'),
            onSelectPoint,
            onJumpToSelectedPoint,
            onRequestAssistantUpdate,
            onShowTooltip,
            onHideTooltip,
            onAssistantActionClick
        });

        document.querySelector<HTMLButtonElement>('.point-hit')?.click();
        expect(onSelectPoint).toHaveBeenNthCalledWith(1, 'P1', { focus: true });
        expect(onJumpToSelectedPoint).toHaveBeenCalledTimes(1);
        expect(onRequestAssistantUpdate).toHaveBeenCalledTimes(1);

        document.querySelector<HTMLElement>('[data-point-card="P2"]')?.click();
        expect(onSelectPoint).toHaveBeenNthCalledWith(2, 'P2', { focus: false });

        document.querySelector<HTMLButtonElement>('.point-hit')?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
        expect(onShowTooltip).toHaveBeenCalledWith('P1', expect.any(HTMLButtonElement));

        document.getElementById('rail-window')?.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
        expect(onHideTooltip).toHaveBeenCalledTimes(1);

        document.getElementById('assistant')?.click();
        await Promise.resolve();
        expect(onAssistantActionClick).toHaveBeenCalledTimes(1);

        dispose();
        document.querySelector<HTMLButtonElement>('.point-hit')?.click();
        expect(onSelectPoint).toHaveBeenCalledTimes(2);
    });

    it('handles keyboard, time input, review loop, pointer, and reduced-motion bindings', () => {
        const pointRail = document.createElement('div');
        const minuteInput = document.createElement('input');
        const reviewLoopButton = document.createElement('button');
        const mediaQuery = {
            addEventListener: vi.fn((_type, handler) => {
                mediaQuery._handler = handler;
            }),
            removeEventListener: vi.fn(),
            _handler: null as null | ((event: { matches: boolean }) => void)
        };

        const onMoveSelection = vi.fn();
        const onRequestAssistantUpdate = vi.fn();
        const onJumpToSelectedPoint = vi.fn();
        const onNudgeSelectedPoint = vi.fn();
        const onApplyPointTime = vi.fn();
        const onClearEditorFeedback = vi.fn();
        const onToggleReviewLoop = vi.fn();
        const onPointerInputMode = vi.fn();
        const onReducedMotionChange = vi.fn();
        const preventDefault = vi.fn();

        const dispose = bindStudioEvents({
            documentRef: document,
            pointRail,
            timeInputs: [minuteInput],
            reviewLoopButton,
            motionMediaQuery: mediaQuery as any,
            onSetLastInputMode: () => {},
            onMoveSelection,
            onRequestAssistantUpdate,
            onJumpToSelectedPoint,
            onNudgeSelectedPoint,
            onApplyPointTime,
            onClearEditorFeedback,
            onToggleReviewLoop,
            onPointerInputMode,
            onReducedMotionChange
        });

        pointRail.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        pointRail.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        pointRail.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        pointRail.dispatchEvent(new KeyboardEvent('keydown', { key: '[', shiftKey: true, bubbles: true }));
        pointRail.dispatchEvent(new KeyboardEvent('keydown', { key: ']', bubbles: true }));
        expect(onMoveSelection).toHaveBeenNthCalledWith(1, -1);
        expect(onMoveSelection).toHaveBeenNthCalledWith(2, 1);
        expect(onRequestAssistantUpdate).toHaveBeenCalledTimes(2);
        expect(onJumpToSelectedPoint).toHaveBeenCalledTimes(1);
        expect(onNudgeSelectedPoint).toHaveBeenNthCalledWith(1, -200);
        expect(onNudgeSelectedPoint).toHaveBeenNthCalledWith(2, 50);

        minuteInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        minuteInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(onClearEditorFeedback).toHaveBeenCalledTimes(1);
        expect(onApplyPointTime).toHaveBeenCalledTimes(1);

        reviewLoopButton.click();
        expect(onToggleReviewLoop).toHaveBeenCalledTimes(1);

        document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
        expect(onPointerInputMode).toHaveBeenCalledWith('touch');

        mediaQuery._handler?.({ matches: true });
        expect(onReducedMotionChange).toHaveBeenCalledWith(true);

        dispose();
        pointRail.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        expect(onMoveSelection).toHaveBeenCalledTimes(2);
    });
});
