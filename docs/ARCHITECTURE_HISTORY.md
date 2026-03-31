# Architecture History

This document records the state of the codebase before each major architecture change, the problems being solved, and the solutions chosen. Read it when you want to understand **why** something is the way it is, not just what the current rules are.

For current rules, see [CODEBASE_GUIDE.md](./CODEBASE_GUIDE.md).

---

## Snapshot: Pre-Architecture Cleanup (March 2026)

### State of the codebase

The project was fully functional with a rich feature set: converter, batch mode, popular music discovery, audio preview with crossfade, karaoke lyrics, a Sync Studio wizard, mini-games, and PWA support. The codebase had grown organically through feature additions.

### Frontend module system

The frontend used **two module systems simultaneously**:

| Module | System | Integration |
|---|---|---|
| `app.js` | ES module (`type="module"`) | `import/export` |
| `js/ui/themeController.js` | ES module | `import/export` |
| `js/ui/animationController.js` | ES module | `import/export` |
| `js/ui/karaokePanel.js` | ES module | `import/export` |
| `js/ui/timeSyncStudio.js` | ES module | `import/export` |
| `js/lyrics.js` | ES module | `import/export` |
| `js/features.js` | Global script | `window.FeaturesModule` via IIFE |
| `js/batch.js` | Global script | `window.batchDownloads` |
| `js/snake-game.js` | Global script | `window.SnakeGame` |
| `js/guess-track.js` | Global script | Implicit global class |
| `js/hero-runner.js` | Global script | `window.__heroRunner` |
| `js/visualizer.js` | Global script | Implicit `AudioVisualizer` global |

Global scripts were loaded via `<script defer>` tags in `index.html` (lines 562–567). ES modules were imported through `app.js`. Communication between the two systems went through `window.*` property checks.

This meant every new feature had to pick a module system, and cross-system interaction required `window.*` lookups.

### Cross-module coupling patterns

Several modules reached across boundaries in ways that made refactoring difficult:

- **Synthetic event dispatch**: `js/features.js` triggered conversions by dispatching `new Event('submit')` on `document.getElementById('converter-form')` (lines 1052, 1066). This coupled the discovery feature to the converter's DOM structure.

- **Global object checks**: `app.js` used `window.batchDownloads && window.batchDownloads.isEnabled()` to coordinate with batch mode. `js/batch.js` referenced `window.FeaturesModule` to access preview data.

- **Implicit globals**: `js/features.js` checked `typeof AudioVisualizer !== 'undefined'` to conditionally use the visualizer, creating an invisible dependency.

### Oversized single-owner files

Two feature modules had grown beyond maintainable size:

| File | LOC | Responsibilities |
|---|:---:|---|
| `js/ui/timeSyncStudio.js` | 1,825 | YouTube player lifecycle, 4-step wizard state machine, point-by-point sync engine, review player, assistant integration, VTT export |
| `js/features.js` | 1,130 | DOM template generation, genre data fetching, audio preview lifecycle, crossfade engine, waveform canvas rendering, convert handoff |

Both files had multiple stable seams (player adapter, assistant client, export formatter, audio engine, waveform renderer, point-workspace rendering) that were good candidates for extraction.

### Backend task persistence

The backend had **two separate task persistence implementations** loaded simultaneously:

| File | Store | Used by |
|---|---|---|
| `server/services/taskManager.ts` (125 LOC) | In-memory `Map` + JSON file | All routes (`convert.ts`, `download.ts`, `progress.ts`) and services (`ytdlp.ts`, `batchService.ts`) |
| `server/services/sqliteTaskManager.ts` (217 LOC) | SQLite with WAL mode | Server index for cleanup and shutdown |

Both were imported at server startup via `server/index.ts`:
```ts
import { loadTasks } from './services/taskManager.js';          // line 11
import { cleanupOldTasks, closeDatabase } from './services/sqliteTaskManager.js';  // line 12
```

All write paths went through the legacy in-memory manager. The SQLite manager ran cleanup independently. There was no declared canonical path.

### Route/service boundary

`server/routes/preview.ts` (343 lines) was the largest route file and owned responsibilities that belonged in a service:
- `yt-dlp` + `ffmpeg` process spawning and pipe orchestration
- In-memory preview cache with TTL
- File streaming with HTTP range request support
- Cleanup of expired previews

### CSS token adoption

Component CSS files had progressing but incomplete token adoption:

| File | Hardcoded colors | Token references | Ratio |
|---|:---:|:---:|:---:|
| `karaoke-panel.css` | 40 | 97 | 71% tokens |
| `conversion-animations.css` | 23 | 59 | 72% tokens |
| `guess-track.css` | 22 | 56 | 72% tokens |
| `game.css` | 17 | 94 | 85% tokens |
| `features.css` | 14 | 157 | 92% tokens |
| `header.css` | 10 | 88 | 90% tokens |

The semantic token layer in `css/base.css` and the theme system in `css/themes/*.css` were well-established. The remaining hardcoded values were mostly `rgba()` glow effects, gradient stops, and canvas color fallbacks.

### Frontend test coverage

- vitest was installed (`^1.0.0` in `package.json`) and used for server-side tests
- No `vitest.config.ts` existed — vitest ran with defaults
- `tests/lyricsController.test.ts` (33 lines) — pure-function subtitle parsing tests
- `tests/serviceWorker.test.ts` — service worker validation tests
- No DOM/browser environment for testing async UI flows, request races, or stale-response guards
- Testing lyric timing races or studio assistant state required fake timers, DOM, and fetch mocking — none of which were wired up

### Solutions and patterns worth preserving

These patterns worked well and should be carried forward:

1. **Request-scoped race guards**: `js/lyrics.js` uses a `requestId` pattern to ignore stale async responses. `js/ui/timeSyncStudio.js` uses `pendingAssistantRequestId` and `reviewPlayerRequestId` for the same purpose. Keep this pattern for any new async UI flow.

2. **Theme registry**: `js/ui/themeController.js` uses a registry of theme objects with `applyTheme()` callbacks. New themes are additive — register and go.

3. **Animation controller**: `js/ui/animationController.js` manages animation lifecycle with `reduced-motion` support. New animations register through the same interface.

4. **Karaoke panel encapsulation**: `js/ui/karaokePanel.js` is a well-scoped controller that owns its own rendering and state transitions. It's the model for new UI controllers.

5. **Semantic token layer**: `css/base.css` defines structural tokens (`--surface-glass`, `--glass-highlight`, `--surface-glass-soft`). `css/themes/*.css` override palette values. Components consume tokens. This separation was hard-won and prevents visual islands.

6. **Service worker sync**: `scripts/sync-service-worker-assets.mjs` auto-generates the asset list. The `npm run service-worker:sync` script runs before build and test. Any file changes must go through this pipeline.

7. **Rate limiter per route**: `server/middleware/rateLimiter.ts` exports separate limiters for different route groups (conversion, info, download, assistant). Resolved a previous issue where all API calls shared a single counter causing false 429s on lyrics and previews.

8. **Point-based assistant protocol**: The studio assistant uses a structured snapshot → server-side prompt → structured response → UI action cycle. The `buildSnapshot()` method creates a versioned schema (`schemaVersion: '1.0'`) that includes point state, playback position, autosync results, and UI context. Keep this protocol for any new assistant-powered features.

---

## Change Log

### Architecture Cleanup — Phase 1: ES Module Unification (completed)

**Problem**: Two module systems (ES modules + window globals) running side by side, forcing every new feature to pick an integration style.

**Solution**: Convert all global scripts to ES modules. Use dependency injection via `app.js` for cross-module communication instead of direct imports between modules that will later be split. Remove all `window.*` global assignments.

**Key design choice**: `batch.js → features.js` dependency uses an injected callback from `app.js` (`setPreviewCallback`) instead of a direct import, because `features.js` will be split in Phase 4. Interface-first design prevents re-breaking the same file.

### Architecture Cleanup — Phase 2: Task Persistence Consolidation (completed)

**Problem**: Two task persistence implementations loaded simultaneously with no canonical path. Routes import legacy in-memory manager; server index imports SQLite for cleanup.

**Solution**: New `taskStore.ts` facade with object-based API. SQLite is canonical (`TASK_STORE=sqlite`). Narrow in-memory fallback available for broken environments (`TASK_STORE=memory`). Legacy `taskManager.ts` and `tasks.json` deleted.

**Key design choice**: Object-based `createTask({ taskId, videoId, format, ... })` instead of positional args. `findExistingTask` returns `Task | null` instead of `string | null`. Callers adapt minimally; the facade absorbs the difference.

### Architecture Cleanup — Phase 3: Frontend Test Harness (completed)

**Problem**: No DOM/browser test environment for async UI flows. Can't write race-condition or stale-state tests.

**Solution**: vitest config with Node as default environment. Frontend tests opt into jsdom per-file via `// @vitest-environment jsdom`. Audio stub for jsdom's missing `HTMLAudioElement`.

**Key design choice**: Per-file environment opt-in instead of global jsdom. Server tests stay in Node without DOM overhead.

### Architecture Cleanup — Phase 4: Module Decomposition (completed)

**Problem**: `timeSyncStudio.js` and `features.js` had accumulated multiple stable responsibilities that should evolve independently.

**Solution so far**: Extracted YouTubePlayerAdapter, AssistantClient, SyncExporter, PointWorkspaceRenderer, PointTimingEngine, ReviewPlayerPanel, StudioWorkflowState, and StudioEventBindings from studio; extracted PreviewAudioEngine, WaveformRenderer, PopularBrowser, and PreviewPanel from features. Public APIs established in Phase 1 stayed unchanged.

**Current state**: `features.js` is down to 590 LOC and `timeSyncStudio.js` is down to 1,127 LOC. The studio now keeps orchestration while `pointTimingEngine.js` owns autosync and mutation state, `reviewPlayerPanel.js` owns review-player panel state and loop-tick rendering decisions, `studioWorkflowState.js` owns the setup/loading/empty/lyrics/export workflow presets, and `studioEventBindings.js` owns DOM listener binding and cleanup. On the discovery side, `popularBrowser.js` now owns genre loading and carousel rendering, `previewPanel.js` owns preview panel UI state, and `features.js` stays focused on preview requests and convert handoff. The remaining parent modules are accepted orchestration shells rather than unfinished decompositions.

**Key design choice**: Phase 1 changed boundaries; Phase 4 changed guts. Callers don't see Phase 4 changes, and future splits should only happen when a new stable responsibility appears.

### Architecture Cleanup — Phase 5: Preview Service Extraction (completed)

**Problem**: `server/routes/preview.ts` owns process spawning, caching, streaming, and cleanup — responsibilities that belong in a service.

**Solution**: New `previewService.ts` with `generatePreview()`, `getPreviewPath()`, `cleanupPreviews()`. Route file reduced to HTTP concerns only.

### Architecture Cleanup — Parallel Track: CSS Token Migration (in progress)

**Problem**: Semantic theming existed, but repeated overlay, outline, scrim, and shadow values were still embedded directly inside component CSS, especially in discovery and studio surfaces.

**Solution so far**: Added shared overlay, outline, scrim, and surface-shadow tokens to `css/base.css`. `conversion-animations.css` moved off its remaining direct color literals earlier in the cleanup, and `features.css` plus `time-sync-page.css` now consume the shared tokens for their repeated glass-surface treatments.

**Key design choice**: Centralize repeated visual assumptions as semantic tokens, but keep component-specific gradients and one-off art direction local until a second real reuse appears. This keeps the token layer useful instead of bloated.
