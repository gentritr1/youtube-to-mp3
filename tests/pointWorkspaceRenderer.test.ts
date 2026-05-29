// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { PointWorkspaceRenderer } from '../js/ui/pointWorkspaceRenderer.js';

describe('PointWorkspaceRenderer', () => {
    it('keeps stage counts numeric when a point has an unknown status', () => {
        const stageBadge = document.createElement('div');
        const stageLabel = document.createElement('div');
        const progressLabel = document.createElement('div');
        const progressFill = document.createElement('div');
        const countPending = document.createElement('div');
        const countSynced = document.createElement('div');
        const countReview = document.createElement('div');
        const renderer = new PointWorkspaceRenderer({
            stageBadge,
            stageLabel,
            progressLabel,
            progressFill,
            countPending,
            countSynced,
            countReview
        });

        renderer.renderStageMeta({
            stage: 'lyrics',
            points: [
                { status: 'pending' },
                { status: 'synced' },
                { status: 'unknown_status' }
            ] as any
        });

        expect(countPending.textContent).toBe('1');
        expect(countSynced.textContent).toBe('1');
        expect(countReview.textContent).toBe('0');
        expect(progressLabel.textContent).toBe('1/3 points confirmed');
        expect(progressFill.style.transform).toBe('scaleX(0.3333333333333333)');
    });
});
