# Codebase Guide

This is the main technical reference for the project.

Use this document for:
- current architecture
- module ownership
- theme system rules
- how to add new features without increasing coupling
- near-term extension guidance

Use `docs/TESTING_STATUS.md` for transient build and environment notes only.

## Table of Contents

- [Product Summary](#product-summary)
- [Project Shape](#project-shape)
- [Frontend Module Ownership](#frontend-module-ownership)
- [Styling Architecture](#styling-architecture)
- [Theme System](#theme-system)
- [Current UI System](#current-ui-system)
- [Workflow For New Features](#workflow-for-new-features)
- [Architecture Adjustment Plan](#architecture-adjustment-plan)
- [Practical Checklist](#practical-checklist)
- [Near-Term Next Steps](#near-term-next-steps)

## Product Summary

YT Converter is a Node.js and vanilla JavaScript app for:
- YouTube to MP3 / MP4 conversion
- batch conversion
- popular music discovery and preview
- karaoke-style lyric rendering
- lightweight mini-games during conversion
- installable PWA support

## Project Shape

### Backend

Primary backend areas:
- `server/index.ts`
  - Express bootstrap
- `server/routes/`
  - API route entry points
- `server/services/`
  - conversion, batching, persistence, and queue orchestration
- `server/utils/`
  - parsing and formatting helpers
- `server/middleware/`
  - shared middleware and error handling

Key routes:
- `/api/info`
- `/api/convert`
- `/api/progress/:taskId`
- `/api/download/:taskId/:filename`
- `/api/batch-convert`
- `/api/batch-progress/:batchId`
- `/api/lyrics`
- `/api/popular`

### Frontend

Primary frontend entry points:
- `index.html`
  - page structure
- `app.js`
  - app bootstrap and conversion orchestration
- `js/features.js`
  - discovery shelf and audio preview
- `js/batch.js`
  - batch queue, progress, and results
- `js/lyrics.js`
  - subtitle loading, parsing, and karaoke timing
- `js/ui/`
  - UI controllers and registries

## Frontend Module Ownership

Keep these boundaries stable.

### `app.js`

Owns:
- app bootstrapping
- form submission flow
- conversion lifecycle
- shared result/progress/download orchestration
- wiring between controllers

Should not own:
- theme definitions
- inline animation definitions
- karaoke DOM rendering
- component-specific visual rules

### `js/ui/themeRegistry.js`

Owns:
- available themes
- theme metadata
- stable default theme object

### `js/ui/themeController.js`

Owns:
- applying `data-theme`
- persisting theme choice
- updating browser theme color

### `js/ui/animationRegistry.js`

Owns:
- named animation variants
- animation descriptors

### `js/ui/animationController.js`

Owns:
- mounting and clearing animation variants

### `js/ui/karaokePanel.js`

Owns:
- karaoke vs arcade panel mode
- lyric card rendering
- panel status messaging
- launch button wiring and cleanup

### `js/lyrics.js`

Owns:
- subtitle fetching
- subtitle parsing
- karaoke timing
- request-scoped lyric events
- finishing playback even when subtitles resolve after conversion completion

### `js/features.js`

Owns:
- discovery shelf
- genre tabs
- preview player
- preview waveform/progress UI

### `js/batch.js`

Owns:
- batch mode toggle
- queue rendering
- batch conversion progress
- batch results and download list

## Styling Architecture

### File hierarchy

- `css/base.css`
  - semantic tokens and shared base rules
- `css/themes/*.css`
  - theme overrides only
- `css/layout/*.css`
  - layout structure
- `css/components/*.css`
  - component-scoped styles
- `css/animations.css`
  - shared animation utilities

### Important current component files

- `css/components/header.css`
- `css/components/theme-switcher.css`
- `css/components/form.css`
- `css/components/results.css`
- `css/components/conversion-animations.css`
- `css/components/batch.css`
- `css/components/features.css`
- `css/components/karaoke-panel.css`
- `css/components/game.css`
- `css/components/guess-track.css`
- `css/components/nerd-stats.css`
- `css/components/lyrics.css`

## Theme System

### Current themes

- `space`
- `green`
- `frutiger-aero`

### Theme rules

1. Components should consume semantic variables, not hardcoded palette values.
2. Theme-specific visual differences should be expressed through `css/themes/*.css` first.
3. JavaScript should not assign presentation colors unless the value is genuinely data-driven.
4. New UI states should prefer semantic tokens over ad hoc selectors.

### Common semantic tokens

Examples already in use:
- `--surface-glass`
- `--surface-glass-strong`
- `--surface-glass-soft`
- `--surface-border`
- `--button-primary`
- `--button-primary-foreground`
- `--button-secondary`
- `--button-secondary-foreground`
- `--success-surface`
- `--success-border`
- `--error-surface`
- `--error-border`
- `--lyrics-overlay`
- `--hero-headlight`

If a new component needs a new reusable surface or state, add a semantic token instead of hardcoding one more special-case color.

## Current UI System

### Hero/Header

The hero is now a first-class layout area rather than a narrow centered card.

It includes:
- theme switcher
- branded hero copy
- right-side visual runway/art panel
- modular converter section
- karaoke/arcade sidecar

Hero motion is decorative only and now includes reduced-motion fallbacks.

### Converter Flow

The converter flow is split into:
- input and format selection
- preview state
- conversion progress state
- completion/download state
- batch flow when enabled

Themed converter visuals should be driven by shared tokens and animation registries, not embedded inline in `app.js`.

### Karaoke Flow

Karaoke is now visible in-panel instead of only rendering behind the page.

Important behavior:
- subtitle loads are request-scoped
- stale subtitle responses are ignored
- if conversion finishes before lyric playback starts, the controller can still emit a finished state

### Discovery / Preview Flow

Discovery and preview are intentionally separate from the main conversion orchestrator.

The shelf owns:
- genre selection
- preview player
- preview progress and playback controls
- one-click convert handoff

### Mini-Games and Stats

Snake, Guess the Track, and nerd stats are now aligned to the theme token system and should remain sibling feature surfaces, not one-off visual islands.

## Workflow For New Features

Use this order when adding or changing frontend behavior.

### 1. Decide ownership first

Before coding, decide whether the work belongs to:
- `app.js`
- a `js/ui/*` controller
- a feature module such as `js/features.js` or `js/batch.js`
- a layout file
- a component CSS file
- the semantic token layer

If ownership is unclear, split the feature first.

### 2. Use ES modules only

All new JavaScript must use `import`/`export`. Do not add new `window.*` globals.

Remaining legacy-style integration points are concentrated in older feature files such as `js/batch.js`, `js/snake-game.js`, and `js/hero-runner.js`. They work today but compound drift — every new feature that follows them inherits the same coupling. Migrate them to ES modules opportunistically when touching those files.

### 3. Add tokens before exceptions

If the feature introduces:
- a new surface
- a new button treatment
- a new success/error/loading state
- a new theme-specific accent

Add the semantic token first, then consume it in the component.

### 4. Keep rendering local to the feature

Good:
- the module that owns the feature also owns its DOM state transitions

Avoid:
- adding more cross-component UI mutations to `app.js`
- reaching across unrelated DOM trees from another feature module
- dispatching synthetic events on elements owned by another module (e.g. `form.dispatchEvent(new Event('submit'))` from a discovery module)

### 5. Prefer additive registries

Use registries for things that can grow:
- themes
- animation variants
- future card presets or visual modes

### 6. Keep files under 500 lines

If a module exceeds roughly 500 lines, look for stable seams to split before adding more work to it. The goal is not arbitrary splitting for its own sake — it is extracting responsibilities that are already distinct (e.g. player adapter, export formatter, assistant client).

### 7. Verify all themes and states

At minimum verify:
- `space`
- `green`
- `frutiger-aero`

And verify:
- idle
- loading
- success
- error
- empty
- active/inactive
- popup/panel states
- mobile and desktop layout

## Architecture Adjustment Plan

Use this plan when the goal is to keep the architecture simple, additive, and maintainable as the app grows.

### Core principles

- keep ownership local
- keep routes thin and controllers focused
- add tokens or adapters before adding exceptions
- extract pure state logic before DOM renderers when a controller starts carrying both
- make async flows request-scoped
- no new `window.*` globals — use ES module `import`/`export`
- prefer decisions over documentation when the ambiguity is structural

### Current pressure points

**Structural (extensibility blockers):**

- task persistence now routes through `server/services/taskStore.ts` with SQLite default and memory fallback, but the fallback path still needs clearer operational documentation and explicit runtime verification outside tests
- frontend test infrastructure now has a jsdom harness for async UI flows, and the extracted `js/ui/pointTimingEngine.js`, `js/ui/reviewPlayerPanel.js`, `js/ui/studioWorkflowState.js`, and `js/ui/studioEventBindings.js` seams have direct unit coverage; the remaining gap is mostly manual UI verification plus a few non-critical time-sync-page edges

**Maintenance (valuable but lower leverage):**

- `js/ui/timeSyncStudio.js` is now an orchestration shell at 1,127 lines; treat it as acceptable until new responsibilities accumulate, then split again by stable seam instead of adding back inline logic
- `js/features.js` is now a 590-line controller shell for DOM creation, preview requests, and convert handoff; split it further only when one of those responsibilities grows materially
- `app.js` still owns some sidecar panel state and mini-game wiring in addition to the main conversion flow
- older component CSS files still contain direct visual assumptions instead of consuming the semantic token layer, even after tokenizing discovery/studio surface overlays and shadows

### Phase 1. Freeze new globals and unify the module system direction

Status:
- completed

This is the single biggest barrier to additive features. Without it, every new feature inherits a module-system decision debt.

Rule in force:
- all new JavaScript uses `import`/`export` — no new `window.*` assignments
- remaining globals are legacy and should be migrated when their files are touched for other work

Completed migration targets:
- `js/features.js` now ships as an ES module with named exports

Remaining migration targets:
- `js/batch.js` → ES module, replace legacy-style integration points with named exports only
- `js/snake-game.js` → ES module, replace `window.SnakeGame` with default export
- `js/hero-runner.js` → ES module, replace `window.__heroRunner` with module-scoped reference

The practical test is: can a new feature import what it needs without checking `window`?

Definition of done:
- no new `window.*` globals appear in any PR
- at least the next feature added uses only ES module integration
- migration of existing globals progresses when files are touched

### Phase 2. Resolve backend task persistence

Status:
- completed

The current state is not a documentation gap; it is code duplication with divergent responsibilities.

Current situation:
- `server/services/taskStore.ts`: canonical entry point for routes and services
- `server/services/sqliteTaskAdapter.ts`: default product path backed by `sqliteTaskManager.ts`
- `server/services/memoryTaskAdapter.ts`: contingency path for environments that cannot use SQLite
- `TASK_STORE` selects the adapter at startup, but the fallback path still needs explicit runtime verification and tighter operational documentation

Decision applied:
- SQLite is the canonical task store
- all route and service code imports the facade only
- the in-memory path is a narrow contingency, not a peer architecture

Definition of done:
- one task persistence path is canonical
- routes and services import from that path only
- contingency behavior is tested and documented clearly enough that it does not become a second de facto architecture

### Phase 3. Stand up a frontend async test harness

Status:
- completed

The harness now exists. The next gap is depth rather than setup: targeted follow-through on any remaining time-sync-page edges and manual browser verification.

Recent coverage added:
- `tests/lyricsRace.test.ts` covers stale subtitle loads and finish-after-load behavior
- `tests/previewAudioEngine.test.ts` covers preview request replacement, stale outgoing audio events, and stop-before-resolve behavior
- `tests/timeSyncStudioRequestRace.test.ts` covers review-player request replacement and clear-while-loading behavior
- `tests/assistantClient.test.ts` covers stale assistant success/failure handling when newer studio requests replace older ones

Before writing race tests, decide and wire up:
- test runner: vitest (already in package.json) with jsdom or happy-dom environment
- fetch mocking: `vi.stubGlobal` or `msw`
- timer control: `vi.useFakeTimers` for deterministic race tests
- audio/media stubs: lightweight mocks for `Audio`, `requestAnimationFrame`

Priority test targets:
- stale subtitle responses in `js/lyrics.js` (request-scoped `requestId` guard)
- late subtitle completion in `js/time-sync-page.js`
- `finishPlayback()` when conversion completes before subtitles settle
- fallback timing behavior and malformed subtitle input

Definition of done:
- at least one test file runs against a DOM environment with fake timers
- request-scoped behavior is covered directly, not only by happy-path tests
- the harness is documented so future async UI features ship with race tests

### Phase 4. Decompose oversized feature modules

Status:
- completed

This phase has reached its intended stopping point. Both parent files are now orchestration shells with stable helper modules behind them.

**`js/ui/timeSyncStudio.js` (1,127 lines)**

Stable seams extracted:
- `js/ui/youtubePlayerAdapter.js` owns IFrame loading, lifecycle, and playback loop glue
- `js/ui/assistantClient.js` owns assistant request/response flow
- `js/ui/syncExporter.js` owns export serialization and download trigger
- `js/ui/pointWorkspaceRenderer.js` owns point rail, point list, tooltip, editor, and stage meta rendering
- `js/ui/pointTimingEngine.js` owns autosync pass logic, point mutation, undo state, loop math, and assistant snapshot shaping
- `js/ui/reviewPlayerPanel.js` owns review-player panel state, loop-tick decisions, and DOM control rendering
- `js/ui/studioWorkflowState.js` owns setup/loading/empty/lyrics/export workflow presets and status copy
- `js/ui/studioEventBindings.js` owns DOM listener binding/cleanup and interaction event sequencing

Remaining in the parent module:
- adapter coordination around review-player loading and lifecycle
- editor feedback and top-level status messaging
- final orchestration across extracted studio helpers

This is the accepted resting state for now. If the studio grows again, split the next stable seam before adding more inline state or rendering logic.

**`js/features.js` (590 lines)**

Stable seams extracted:
- `js/previewAudioEngine.js` now owns crossfade, playback loop, request cancellation, and audio lifecycle
- `js/waveformRenderer.js` now owns waveform drawing
- `js/popularBrowser.js` now owns genre loading, genre-tab rendering, carousel rendering, and random-track selection
- `js/previewPanel.js` now owns preview panel metadata, progress, loading state, and state-change emission

Remaining in the parent module:
- DOM creation
- preview request orchestration
- convert handoff

Also: remove synthetic event dispatches (`form.dispatchEvent(new Event('submit'))`) and replace with an explicit callback or imported function. Cross-module DOM mutations are the exact coupling the architecture warns against.

Definition of done:
- extracted sub-modules have clear single-purpose APIs
- the parent module imports from them rather than containing them inline
- follow-up splits are driven by stable seams, not arbitrary line counts

Current result:
- `js/ui/timeSyncStudio.js` is 1,127 lines after extracting `youtubePlayerAdapter.js`, `assistantClient.js`, `syncExporter.js`, `pointWorkspaceRenderer.js`, `pointTimingEngine.js`, `reviewPlayerPanel.js`, `studioWorkflowState.js`, and `studioEventBindings.js`
- `js/features.js` is 590 lines after extracting `previewAudioEngine.js`, `waveformRenderer.js`, `popularBrowser.js`, and `previewPanel.js`
- further decomposition is optional until those parent shells start growing again

### Phase 5. Extract preview service from route

Status:
- completed

This split is now in place:

- `server/services/previewService.ts`: process spawning, caching, cleanup, file lifecycle
- `server/routes/preview.ts`: request validation, response mapping, streaming

This follows the same boundary used by convert/batch: routes validate and respond, services orchestrate.

Definition of done:
- route file handles only HTTP concerns
- service is independently testable without Express
- cache and cleanup logic live in the service

### Parallel track: Reduce hardcoded visual assumptions

This is real maintenance work that should continue in parallel with the structural phases above. It improves visual consistency across themes but does not itself solve ownership, integration style, or extensibility.

Focus:
- canvas-driven color fallbacks in `js/features.js`, `js/game/*`, and `js/guess-track.js`

Actions:
- convert repeated surfaces, borders, glow states, and status treatments into semantic tokens in `css/base.css`
- keep palette decisions in `css/themes/*.css`
- treat new hardcoded presentation values in JavaScript as exceptions that need a documented data-driven reason

Progress so far:
- `css/components/conversion-animations.css` moved off its remaining direct color literals
- `css/components/features.css` and `css/components/time-sync-page.css` now consume shared overlay, outline, scrim, and shadow tokens from `css/base.css` for repeated discovery/studio surface treatments
- `css/components/karaoke-panel.css` now consumes the same shared overlay, outline, warning, and surface-shadow tokens, eliminating its remaining direct color/shadow literals
- `css/components/guess-track.css` now drives its success/error/hot-state surfaces, Frutiger glass overrides, and option-state chrome through token-backed custom properties instead of raw component literals
- `css/components/game.css` now uses semantic state borders, canvas shadows, restart-button glow treatment, and Frutiger glass overrides without raw component literals
- `css/components/header.css`, `css/components/theme-switcher.css`, and the remaining `css/components/features.css` waveform shading now use semantic or header/preview-scoped variables instead of raw component literals

Definition of done:
- themes own palette choices
- components mostly read from semantic tokens
- remaining visual exceptions live only where JavaScript/canvas rendering still needs an explicit fallback
- new UI work does not introduce another visual island

### Guardrails for new work

Before implementation:
- decide module ownership first
- use ES module `import`/`export` — no `window.*` globals
- add semantic tokens before component-specific visual exceptions
- add a controller before adding another branch to `app.js`
- add a service before letting a route own more orchestration
- add at least one race or stale-state test for any new async UI flow
- if the target file exceeds ~500 lines, split it first

During review:
- reject changes that add new `window.*` globals
- reject changes that centralize unrelated behavior just because the existing entry point is convenient
- reject synthetic event dispatches across module boundaries
- prefer narrow APIs between modules over shared mutable state
- document the intended boundary whenever introducing a new server-side subsystem

### Recommended sequence

1. verify SQLite and memory fallback behavior outside the unit suite
2. decide whether `js/time-sync-page.js` still needs explicit late-completion coverage beyond the current lyric and studio request tests
3. manually verify visual states across themes and mobile/desktop layouts
4. finish the remaining JS/canvas fallback cleanup after the new runtime token-sync pass
5. keep migrating remaining legacy globals opportunistically when touched

## Practical Checklist

- define module ownership first
- use ES module `import`/`export` — no new `window.*` globals
- keep files under ~500 lines; split by stable seams if exceeded
- keep visual tokens in `css/base.css` or `css/themes/*.css`
- keep component styles in component CSS files
- avoid adding presentation logic to `app.js`
- avoid cross-module DOM mutations and synthetic event dispatches
- check reduced-motion behavior for decorative motion
- verify all visible states in all themes
- add a race-condition test for any new async UI flow
- run `npm run build`
- run `npm test`
- record transient environment blockers only in `docs/TESTING_STATUS.md`

## Near-Term Next Steps

Priority order now that the major structural phases are in place:

1. **Verify persistence behavior in runtime-like environments** — confirm `TASK_STORE=sqlite` and `TASK_STORE=memory` behavior outside isolated unit tests
2. **Expand race-condition coverage only if needed** — keep the new preview, review-player, and assistant request tests in place, then add more only where `js/time-sync-page.js` or future UI flows show a real stale-state risk
3. **Manually verify visual states** — check all supported themes, mobile/desktop layouts, reduced motion, and active/inactive panel states
4. **Finish runtime visual token cleanup** — the game, guess-track bursts, and waveform renderer now read semantic tokens at runtime; finish only the fallback scaffolding that still proves worth centralizing
5. **Keep module boundaries additive** — when `timeSyncStudio.js`, `features.js`, or `app.js` grow again, split by stable seam before reintroducing central orchestration or new globals

Use the Architecture Adjustment Plan above as the default path for these changes.

If a future feature feels hard to place cleanly, the first question is module ownership and integration style — not token availability. Extend the shared controller or service layer first instead of shipping another exception.
