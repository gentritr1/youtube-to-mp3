/**
 * Batch Downloads Module
 * 
 * Provides UI for converting multiple YouTube videos at once.
 * Features smooth animations and progress tracking.
 */

// Configuration
let apiBaseUrl = '';
const getApiUrl = () => apiBaseUrl;

let _previewCallback = null;

/**
 * Inject preview callback. Called by app.js during init.
 * Keeps preview integration explicit without importing the discovery controller.
 */
export function setPreviewCallback(fn) {
    _previewCallback = fn;
}

export function setApiBaseUrl(baseUrl = '') {
    apiBaseUrl = String(baseUrl ?? '');
}

// Batch state
const batchState = {
    enabled: false,
    items: [], // { videoId, format, title, url, thumbnail, artist, duration, isLive }
    maxItems: 10,
    currentBatchId: null,
    isProcessing: false,
    isClearing: false,
    initialized: false
};

// Constants
const MAX_POLL_RETRIES = 5;

// DOM Elements (created dynamically)
let batchElements = null;

/**
 * Initialize batch downloads feature
 */
function initBatchDownloads() {
    if (batchState.initialized) {
        return;
    }

    createBatchUI();
    if (!batchElements) {
        return;
    }

    attachBatchEventListeners();
    document.addEventListener('preview-state-change', handlePreviewStateChange);
    batchState.initialized = true;
    console.log('[Batch] Initialized with max items:', batchState.maxItems);
}

/**
 * Create the batch UI elements
 */
function createBatchUI() {
    // Find the converter form
    const converterCard = document.querySelector('.converter-card');
    const form = document.getElementById('converter-form');

    if (!converterCard || !form) {
        console.error('[Batch] Required elements not found');
        return;
    }

    // Create batch mode toggle (after format toggle)
    const formatToggle = form.querySelector('.format-toggle');
    const batchToggle = document.createElement('div');
    batchToggle.className = 'batch-toggle';
    batchToggle.innerHTML = `
        <button type="button" id="batch-mode-btn" class="batch-mode-btn" aria-pressed="false">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Batch Mode</span>
            <span class="batch-count hidden">0</span>
        </button>
    `;

    // Safely insert toggle
    if (formatToggle) {
        formatToggle.after(batchToggle);
    } else {
        // Fallback: append to form before submit button
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            form.insertBefore(batchToggle, submitBtn);
        } else {
            form.appendChild(batchToggle);
        }
    }

    // Create batch list container (after form, before preview)
    const batchContainer = document.createElement('div');
    batchContainer.id = 'batch-container';
    batchContainer.className = 'batch-container hidden';
    batchContainer.innerHTML = `
        <div class="batch-header">
            <h3 class="batch-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
                Batch Queue
            </h3>
            <span class="batch-item-count">0 / ${batchState.maxItems} videos</span>
        </div>
        <ul id="batch-list" class="batch-list"></ul>
        <div class="batch-actions">
            <button type="button" id="clear-batch-btn" class="batch-action-btn clear-btn" disabled>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Clear All
            </button>
            <button type="button" id="convert-batch-btn" class="batch-action-btn convert-batch-btn" disabled>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Convert All
            </button>
        </div>
    `;
    form.after(batchContainer);

    // Create batch progress section
    const batchProgress = document.createElement('div');
    batchProgress.id = 'batch-progress-section';
    batchProgress.className = 'batch-progress-section hidden';
    batchProgress.innerHTML = `
        <div class="batch-progress-header">
            <h3>Converting...</h3>
            <span id="batch-overall-progress" class="batch-overall">0%</span>
        </div>
        <div class="batch-progress-bar">
            <div id="batch-progress-fill" class="batch-progress-fill"></div>
        </div>
        <ul id="batch-progress-list" class="batch-progress-list"></ul>
    `;
    batchContainer.after(batchProgress);

    // Create batch results section
    const batchResults = document.createElement('div');
    batchResults.id = 'batch-results-section';
    batchResults.className = 'batch-results-section hidden';
    batchResults.innerHTML = `
        <div class="batch-results-header">
            <div class="batch-success-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                    stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            </div>
            <h3>All Downloads Ready!</h3>
        </div>
        <ul id="batch-downloads-list" class="batch-downloads-list"></ul>
        <button type="button" id="new-batch-btn" class="batch-action-btn new-batch-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Batch
        </button>
    `;
    batchProgress.after(batchResults);

    const sidecar = document.getElementById('karaoke-card');
    const sidecarHeader = sidecar?.querySelector('.karaoke-panel-header');
    if (sidecar && sidecarHeader) {
        const sidecarEyebrow = sidecar.querySelector('.karaoke-eyebrow');
        const sidecarTitle = sidecar.querySelector('.karaoke-panel-title');
        if (sidecarEyebrow && !sidecarEyebrow.dataset.defaultText) {
            sidecarEyebrow.dataset.defaultText = sidecarEyebrow.textContent || '';
        }
        if (sidecarTitle && !sidecarTitle.dataset.defaultText) {
            sidecarTitle.dataset.defaultText = sidecarTitle.textContent || '';
        }

        const batchContext = document.createElement('div');
        batchContext.id = 'batch-context-card';
        batchContext.className = 'batch-context-card hidden';
        batchContext.setAttribute('aria-live', 'polite');
        batchContext.innerHTML = `
            <div class="batch-context-copy">
                <span class="batch-context-kicker">Batch queue</span>
                <strong class="batch-context-title">Collect links, then convert once.</strong>
                <span id="batch-context-detail" class="batch-context-detail">Paste a video link and add it to this batch.</span>
            </div>
            <div class="batch-context-meter" aria-hidden="true">
                <span id="batch-context-count" class="batch-context-count">0</span>
                <span class="batch-context-total">/${batchState.maxItems}</span>
            </div>
            <ul class="batch-context-steps" aria-label="Batch workflow">
                <li><span>1</span><strong>Paste links</strong></li>
                <li><span>2</span><strong>Add to queue</strong></li>
                <li><span>3</span><strong>Convert together</strong></li>
            </ul>
            <button type="button" id="batch-context-jump" class="batch-context-jump">Review queue</button>
        `;
        sidecarHeader.after(batchContext);
    }

    // Store references
    batchElements = {
        toggle: document.getElementById('batch-mode-btn'),
        count: document.querySelector('.batch-count'),
        container: document.getElementById('batch-container'),
        list: document.getElementById('batch-list'),
        itemCount: document.querySelector('.batch-item-count'),
        clearBtn: document.getElementById('clear-batch-btn'),
        convertBtn: document.getElementById('convert-batch-btn'),
        progressSection: document.getElementById('batch-progress-section'),
        progressFill: document.getElementById('batch-progress-fill'),
        overallProgress: document.getElementById('batch-overall-progress'),
        progressList: document.getElementById('batch-progress-list'),
        resultsSection: document.getElementById('batch-results-section'),
        downloadsList: document.getElementById('batch-downloads-list'),
        newBatchBtn: document.getElementById('new-batch-btn'),
        sidecarHost: sidecar?.parentElement || null,
        sidecar,
        sidecarEyebrow: sidecar?.querySelector('.karaoke-eyebrow') || null,
        sidecarTitle: sidecar?.querySelector('.karaoke-panel-title') || null,
        contextCard: document.getElementById('batch-context-card'),
        contextDetail: document.getElementById('batch-context-detail'),
        contextCount: document.getElementById('batch-context-count'),
        contextJump: document.getElementById('batch-context-jump')
    };
}

/**
 * Attach event listeners for batch functionality
 */
function attachBatchEventListeners() {
    if (!batchElements) return;

    // Toggle batch mode
    batchElements.toggle.addEventListener('click', toggleBatchMode);

    // Clear all items
    batchElements.clearBtn.addEventListener('click', clearBatch);

    // Convert all items
    batchElements.convertBtn.addEventListener('click', startBatchConversion);

    // New batch button
    batchElements.newBatchBtn.addEventListener('click', resetBatch);

    batchElements.contextJump?.addEventListener('click', () => {
        const showingResults = batchElements.resultsSection && !batchElements.resultsSection.classList.contains('hidden');
        const showingProgress = batchElements.progressSection && !batchElements.progressSection.classList.contains('hidden');
        const scrollTarget = showingResults
            ? batchElements.resultsSection
            : showingProgress
                ? batchElements.progressSection
                : batchElements.container;
        const focusTarget = showingResults
            ? batchElements.newBatchBtn
            : batchState.items.length > 0 && !showingProgress
                ? batchElements.convertBtn
                : document.getElementById('url-input');
        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
        scrollTarget?.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'center'
        });
        focusTarget?.focus({ preventScroll: true });
    });
}

function handleBatchResultRemove(itemId) {
    const resultItem = batchElements?.downloadsList?.querySelector(`.batch-download-item[data-id="${itemId}"]`);
    if (!resultItem) return;

    resultItem.classList.add('removing');
    resultItem.addEventListener('animationend', () => {
        const itemIndex = batchState.items.findIndex((item) => String(item.id) === String(itemId));
        if (itemIndex !== -1) {
            batchState.items.splice(itemIndex, 1);
        }

        resultItem.remove();

        if (!batchElements.downloadsList.querySelector('.batch-download-item')) {
            resetBatch();
            return;
        }

        updateBatchResultsHeader();
        updateBatchUI();
    }, { once: true });
}

function updateBatchResultsHeader() {
    if (!batchElements?.downloadsList || !batchElements?.resultsSection) return;

    const heading = batchElements.resultsSection.querySelector('.batch-results-header h3');
    if (!heading) return;

    const totalItems = batchElements.downloadsList.querySelectorAll('.batch-download-item').length;
    const failedItems = batchElements.downloadsList.querySelectorAll('.batch-download-item.failed').length;

    if (failedItems > 0 && failedItems === totalItems) {
        heading.textContent = 'Batch Finished';
        return;
    }

    if (failedItems > 0) {
        heading.textContent = 'Downloads Ready';
        return;
    }

    heading.textContent = totalItems === 1 ? 'Download Ready!' : 'All Downloads Ready!';
}

/**
 * Toggle batch mode on/off
 */
function toggleBatchMode() {
    batchState.enabled = !batchState.enabled;

    batchElements.toggle.classList.toggle('active', batchState.enabled);
    batchElements.toggle.setAttribute('aria-pressed', batchState.enabled);
    batchElements.container.classList.toggle('hidden', !batchState.enabled);

    // Show/hide count badge
    batchElements.count.classList.toggle('hidden', !batchState.enabled || batchState.items.length === 0);
    updateBatchContext();

    // Update button text in main form
    const convertBtn = document.getElementById('convert-btn');
    if (convertBtn) {
        const btnText = convertBtn.querySelector('.btn-text');
        btnText.textContent = batchState.enabled ? 'Add to Batch' : 'Convert';
    }

    console.log('[Batch] Mode:', batchState.enabled ? 'ON' : 'OFF');
}

/**
 * Add a video to the batch
 */
function addToBatch(videoId, format, title, url, metadata = {}) {
    // Block adds if clearing OR processing
    if (batchState.isClearing || batchState.isProcessing) {
        return false;
    }

    if (batchState.items.length >= batchState.maxItems) {
        showBatchError(`Maximum ${batchState.maxItems} videos allowed`);
        return false;
    }

    // Check for duplicates
    if (batchState.items.some(item => item.videoId === videoId)) {
        showBatchError('Video already in batch');
        return false;
    }

    const item = {
        videoId,
        format,
        title,
        url,
        id: Date.now(),
        thumbnail: metadata.thumbnail || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        artist: metadata.artist || metadata.author || '',
        duration: metadata.duration || '',
        isLive: Boolean(metadata.isLive)
    };
    batchState.items.push(item);

    // Add to UI with animation
    const li = createBatchItemElement(item);
    batchElements.list.appendChild(li);

    // Trigger animation
    requestAnimationFrame(() => {
        li.classList.add('visible');
    });

    updateBatchUI();
    console.log('[Batch] Added:', title);
    return true;
}

/**
 * Create a batch item DOM element
 */
function createBatchItemElement(item) {
    const li = document.createElement('li');
    li.className = 'batch-item';
    li.dataset.id = item.id;
    li.innerHTML = `
        <div class="batch-item-info">
            <img src="${escapeHtml(item.thumbnail)}"
                 alt="Thumbnail" class="batch-item-thumb">
            <div class="batch-item-details">
                <span class="batch-item-title">${escapeHtml(item.title)}</span>
                <span class="batch-item-meta">
                    <span class="batch-item-format">${item.format.toUpperCase()}</span>
                    ${item.artist ? `<span class="batch-item-artist">${escapeHtml(item.artist)}</span>` : ''}
                </span>
            </div>
        </div>
        <div class="batch-item-actions">
            <button type="button" class="batch-item-preview" data-id="${item.id}"
                    aria-label="Preview track" ${item.isLive ? 'disabled' : ''}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>Preview</span>
            </button>
            <button type="button" class="batch-item-remove" data-id="${item.id}"
                    aria-label="Remove from batch">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
    `;

    li.querySelector('.batch-item-preview')?.addEventListener('click', () => {
        previewBatchItem(item.id);
    });

    // Add remove listener
    li.querySelector('.batch-item-remove').addEventListener('click', () => {
        removeFromBatch(item.id);
    });

    return li;
}

function previewBatchItem(itemId) {
    const item = batchState.items.find((candidate) => candidate.id === itemId);
    if (!item || item.isLive || !_previewCallback) return;

    _previewCallback({
        videoId: item.videoId,
        title: item.title,
        thumbnail: item.thumbnail,
        artist: item.artist || 'Queued track',
        duration: item.duration,
        isLive: item.isLive,
        previewSource: 'batch'
    });
}

function handlePreviewStateChange(event) {
    if (!batchElements?.list) return;

    const { videoId, source, isPlaying, isLoading, hasError } = event.detail || {};
    const batchItems = batchElements.list.querySelectorAll('.batch-item');

    batchItems.forEach((node) => {
        const item = batchState.items.find((candidate) => String(candidate.id) === node.dataset.id);
        const isActive = source === 'batch' && item?.videoId === videoId;
        node.classList.toggle('is-previewing', Boolean(isActive));
        node.classList.toggle('is-preview-error', Boolean(isActive && hasError));

        const previewButton = node.querySelector('.batch-item-preview');
        if (previewButton) {
            previewButton.classList.toggle('is-active', Boolean(isActive));
            previewButton.classList.toggle('has-error', Boolean(isActive && hasError));
            const label = previewButton.querySelector('span');
            if (label) {
                label.textContent = isActive
                    ? (hasError ? 'Unavailable' : (isLoading ? 'Loading...' : (isPlaying ? 'Playing' : 'Selected')))
                    : 'Preview';
            }
        }
    });
}

/**
 * Remove a video from the batch
 */
function removeFromBatch(itemId) {
    // Check if item exists before starting animation
    const exists = batchState.items.some(item => item.id === itemId);
    if (!exists) return;

    const li = batchElements.list.querySelector(`[data-id="${itemId}"]`);
    if (li) {
        li.classList.add('removing');
        li.addEventListener('animationend', () => {
            // Fresh lookup after animation to avoid stale index race condition
            const freshIndex = batchState.items.findIndex(item => item.id === itemId);
            if (freshIndex !== -1) {
                batchState.items.splice(freshIndex, 1);
            }
            li.remove();
            updateBatchUI();
        }, { once: true });
    }
}

/**
 * Clear all items from batch
 */
/**
 * Clear all items from batch
 */
function clearBatch() {
    if (batchState.items.length === 0) return;

    batchState.isClearing = true;
    const items = batchElements.list.querySelectorAll('.batch-item');

    items.forEach((li, index) => {
        setTimeout(() => {
            li.classList.add('removing');
        }, index * 50);
    });

    setTimeout(() => {
        batchElements.list.innerHTML = '';
        batchState.items = [];
        batchState.isClearing = false;
        updateBatchUI();
    }, items.length * 50 + 300);
}

function getBatchContextDetail(count) {
    if (batchState.isProcessing) {
        return 'Conversion is running. Keep this page open while progress updates.';
    }

    if (batchElements?.resultsSection && !batchElements.resultsSection.classList.contains('hidden')) {
        return count === 1 ? 'One download is ready in the results list.' : `${count} downloads are ready in the results list.`;
    }

    if (count === 0) {
        return 'Paste a video link and add it to this batch.';
    }

    if (count >= batchState.maxItems) {
        return 'The queue is full. Convert it or remove a video to add another.';
    }

    return `${count} queued. Add up to ${batchState.maxItems - count} more or convert the batch.`;
}

function updateBatchContext() {
    if (!batchElements?.contextCard) return;

    const count = batchState.items.length;
    batchElements.sidecarHost?.classList.toggle('is-batch-mode', batchState.enabled);
    batchElements.sidecar?.classList.toggle('is-batch-mode', batchState.enabled);
    batchElements.contextCard.classList.toggle('hidden', !batchState.enabled);
    batchElements.contextCard.classList.toggle('is-processing', batchState.isProcessing);
    batchElements.contextCard.classList.toggle(
        'has-results',
        Boolean(batchElements.resultsSection && !batchElements.resultsSection.classList.contains('hidden'))
    );

    if (batchElements.sidecarEyebrow) {
        batchElements.sidecarEyebrow.textContent = batchState.enabled
            ? 'Batch assistant'
            : batchElements.sidecarEyebrow.dataset.defaultText || 'Timing tools';
    }

    if (batchElements.sidecarTitle) {
        batchElements.sidecarTitle.textContent = batchState.enabled
            ? 'Queue videos before converting.'
            : batchElements.sidecarTitle.dataset.defaultText || 'Need detailed lyric timing?';
    }

    if (batchElements.contextCount) {
        batchElements.contextCount.textContent = String(count);
    }

    if (batchElements.contextDetail) {
        batchElements.contextDetail.textContent = getBatchContextDetail(count);
    }

    if (batchElements.contextJump) {
        batchElements.contextJump.textContent = count > 0 ? 'Review queue' : 'Add a video';
    }
}

/**
 * Update batch UI state
 */
function updateBatchUI() {
    const count = batchState.items.length;

    // Update count displays
    batchElements.count.textContent = count;
    batchElements.count.classList.toggle('hidden', count === 0);
    batchElements.itemCount.textContent = `${count} / ${batchState.maxItems} videos`;

    // Update button states
    batchElements.clearBtn.disabled = count === 0;
    batchElements.convertBtn.disabled = count === 0;

    // Pulse animation on count change
    if (count > 0) {
        batchElements.count.classList.add('pulse');
        setTimeout(() => batchElements.count.classList.remove('pulse'), 300);
    }

    updateBatchContext();
}

/**
 * Start batch conversion
 */
async function startBatchConversion() {
    if (batchState.items.length === 0 || batchState.isProcessing) return;

    batchState.isProcessing = true;

    // Hide batch list, show progress
    batchElements.container.classList.add('hidden');
    batchElements.progressSection.classList.remove('hidden');
    updateBatchContext();

    // Prepare items for API
    const items = batchState.items.map(item => ({
        videoId: item.videoId,
        format: item.format,
        title: item.title
    }));

    // Create progress items UI
    batchElements.progressList.innerHTML = items.map((item, index) => `
        <li class="batch-progress-item" data-index="${index}">
            <div class="progress-item-info">
                <span class="progress-item-title">${escapeHtml(item.title)}</span>
                <span class="progress-item-status">Queued</span>
            </div>
            <div class="progress-item-bar">
                <div class="progress-item-fill" style="width: 0%"></div>
            </div>
        </li>
    `).join('');

    try {
        // Construct URL safely
        const baseUrl = getApiUrl().replace(/\/$/, '');

        // Call batch convert API
        const response = await fetch(`${baseUrl}/api/batch-convert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });

        if (!response.ok) {
            throw new Error('Failed to start batch conversion');
        }

        const { batchId } = await response.json();
        batchState.currentBatchId = batchId;

        // Start polling for progress
        pollBatchProgress(batchId);

    } catch (error) {
        console.error('[Batch] Error:', error);
        showBatchError(error.message);
        resetBatchProgress();
    }
}

/**
 * Poll batch progress from server
 * @param {string} batchId - The batch ID to poll
 * @param {number} retryCount - Current retry count for error handling
 */
async function pollBatchProgress(batchId, retryCount = 0) {
    // Stop if batch ID has changed (new batch started or cleared)
    if (batchId !== batchState.currentBatchId) {
        console.log('[Batch] Polling aborted: Batch ID mismatch');
        return;
    }

    try {
        const baseUrl = getApiUrl().replace(/\/$/, '');
        const response = await fetch(`${baseUrl}/api/batch-progress/${batchId}`);

        // Check for mismatch again after async fetch
        if (batchId !== batchState.currentBatchId) return;

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const progress = await response.json();

        // Update overall progress
        batchElements.progressFill.style.width = `${progress.overallProgress}%`;
        batchElements.overallProgress.textContent = `${progress.overallProgress}%`;

        // Update individual items
        progress.items.forEach((item, index) => {
            const li = batchElements.progressList.querySelector(`[data-index="${index}"]`);
            if (li) {
                const status = li.querySelector('.progress-item-status');
                const fill = li.querySelector('.progress-item-fill');

                fill.style.width = `${item.progress}%`;

                if (item.state === 'completed') {
                    status.textContent = 'Complete';
                    status.className = 'progress-item-status completed';
                    li.classList.add('completed');
                } else if (item.state === 'error') {
                    status.textContent = 'Failed';
                    status.className = 'progress-item-status error';
                    li.classList.add('error');
                } else {
                    status.textContent = `${item.progress}%`;
                }
            }
        });

        // Check if done
        if (progress.state === 'completed' || progress.state === 'partial') {
            if (batchId === batchState.currentBatchId) {
                showBatchResults(progress);
            }
        } else {
            // Continue polling (reset retry count on success)
            setTimeout(() => pollBatchProgress(batchId, 0), 1000);
        }

    } catch (error) {
        // Check for mismatch before retry
        if (batchId !== batchState.currentBatchId) return;

        console.error('[Batch] Poll error:', error);

        if (retryCount < MAX_POLL_RETRIES) {
            // Retry with exponential backoff
            const delay = Math.min(2000 * Math.pow(1.5, retryCount), 10000);
            console.log(`[Batch] Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_POLL_RETRIES})`);
            setTimeout(() => pollBatchProgress(batchId, retryCount + 1), delay);
        } else {
            // Max retries reached - stop polling and show error
            console.error(`[Batch] Max retries (${MAX_POLL_RETRIES}) reached, stopping poll`);
            showBatchError('Connection lost. Please check your network and try again.');
            resetBatchProgress();
        }
    }
}

/**
 * Show batch results with download links
 */
function showBatchResults(progress) {
    batchState.isProcessing = false;

    // Hide progress, show results with animation
    batchElements.progressSection.classList.add('hidden');
    batchElements.resultsSection.classList.remove('hidden');
    updateBatchContext();

    // Build download list
    batchElements.downloadsList.innerHTML = progress.items.map((item, index) => {
        const originalItem = batchState.items[index];

        if (item.state === 'completed' && item.downloadUrl) {
            // Validate and sanitize URL
            let safeUrl = '#';
            try {
                // Ensure existing relative URLs are treated correctly if needed, 
                // but mostly we want to verify the protocol
                const urlObj = new URL(item.downloadUrl, window.location.origin);
                if (['http:', 'https:'].includes(urlObj.protocol)) {
                    safeUrl = urlObj.href;
                }
            } catch (e) {
                console.warn('[Batch] Invalid download URL:', item.downloadUrl);
            }

            return `
                <li class="batch-download-item completed" data-id="${originalItem?.id ?? index}">
                    <div class="download-item-info">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-icon">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span>${escapeHtml(item.title || originalItem?.title || 'Video')}</span>
                    </div>
                    <div class="download-item-actions">
                        <a href="${safeUrl}" class="download-item-btn" download rel="noopener noreferrer">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Download
                        </a>
                        <button type="button" class="download-item-remove" data-id="${originalItem?.id ?? index}" aria-label="Remove completed download">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </li>
            `;
        } else {
            return `
                <li class="batch-download-item failed" data-id="${originalItem?.id ?? index}">
                    <div class="download-item-info">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="error-icon">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                        <span>${escapeHtml(item.title || originalItem?.title || 'Video')}</span>
                    </div>
                    <div class="download-item-actions">
                        <span class="download-item-error">${escapeHtml(item.error || 'Failed')}</span>
                        <button type="button" class="download-item-remove" data-id="${originalItem?.id ?? index}" aria-label="Remove failed download">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </li>
            `;
        }
    }).join('');

    batchElements.downloadsList.querySelectorAll('.download-item-remove').forEach((button) => {
        button.addEventListener('click', () => {
            handleBatchResultRemove(button.dataset.id);
        });
    });

    updateBatchResultsHeader();

    // Animate items in
    const items = batchElements.downloadsList.querySelectorAll('.batch-download-item');
    items.forEach((item, index) => {
        setTimeout(() => {
            item.classList.add('visible');
        }, index * 100);
    });
}

/**
 * Reset batch for new conversions
 */
function resetBatch() {
    batchState.items = [];
    batchState.currentBatchId = null; // This invalidates in-flight polls
    batchState.isProcessing = false;
    batchState.isClearing = false;

    batchElements.list.innerHTML = '';
    batchElements.progressList.innerHTML = '';
    batchElements.downloadsList.innerHTML = '';
    batchElements.progressFill.style.width = '0%';
    batchElements.overallProgress.textContent = '0%';

    batchElements.resultsSection.classList.add('hidden');
    batchElements.progressSection.classList.add('hidden');
    batchElements.container.classList.remove('hidden');

    updateBatchUI();
}

/**
 * Reset batch progress section on error
 */
function resetBatchProgress() {
    batchState.isProcessing = false;
    batchState.currentBatchId = null; // Stop polling
    batchElements.progressSection.classList.add('hidden');
    batchElements.container.classList.remove('hidden');
    updateBatchContext();
}

/**
 * Show batch-specific error
 */
function showBatchError(message) {
    // Use existing error section from main app
    const errorSection = document.getElementById('error-section');
    const errorMessage = document.getElementById('error-message');

    if (errorSection && errorMessage) {
        errorMessage.textContent = message;
        errorSection.classList.remove('hidden');

        setTimeout(() => {
            errorSection.classList.add('hidden');
        }, 5000);
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Check if batch mode is enabled (for use by main app)
 */
function isBatchModeEnabled() {
    return batchState.enabled;
}

// Export functions for use by main app
export const batchDownloads = {
    init: initBatchDownloads,
    isEnabled: isBatchModeEnabled,
    add: addToBatch,
    getState: () => batchState
};
