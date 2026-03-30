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
- make async flows request-scoped
- no new `window.*` globals — use ES module `import`/`export`
- prefer decisions over documentation when the ambiguity is structural

### Current pressure points

**Structural (extensibility blockers):**

- `js/ui/timeSyncStudio.js` is still 1,685 lines and carries player loading, sync workflow, review state, assistant requests, and export in a single class; the first stable seams are extracted, but the main file remains a future bottleneck
- `js/features.js` is down to 762 lines after extracting `previewAudioEngine.js` and `waveformRenderer.js`, but it still owns DOM creation, genre fetching, card rendering, and convert handoff in one module
- task persistence now routes through `server/services/taskStore.ts` with SQLite default and memory fallback, but the fallback path still needs clearer operational documentation and explicit runtime verification outside tests
- frontend test infrastructure now has a jsdom harness for async UI flows, but coverage still leans heavily toward lyrics timing; preview audio and studio request races remain under-tested

**Maintenance (valuable but lower leverage):**

- `app.js` still owns some sidecar panel state and mini-game wiring in addition to the main conversion flow
- older component CSS files still contain direct visual assumptions instead of consuming the semantic token layer

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

The harness now exists. The next gap is depth rather than setup: more race-condition coverage around assistant requests, preview playback transitions, and studio state replacement.

Before writing race tests, decide and wire up:
- test runner: vitest (already in package.json) with jsdom or happy-dom environment
- fetch mocking: `vi.stubGlobal` or `msw`
- timer control: `vi.useFakeTimers` for deterministic race tests
- audio/media stubs: lightweight mocks for `Audio`, `requestAnimationFrame`

Priority test targets:
- stale subtitle responses in `js/lyrics.js` (request-scoped `requestId` guard)
- late subtitle completion in `js/time-sync-page.js`
- assistant request races in `js/ui/timeSyncStudio.js`
- review player request replacement in `js/ui/timeSyncStudio.js`
- `finishPlayback()` when conversion completes before subtitles settle
- fallback timing behavior and malformed subtitle input

Definition of done:
- at least one test file runs against a DOM environment with fake timers
- request-scoped behavior is covered directly, not only by happy-path tests
- the harness is documented so future async UI features ship with race tests

### Phase 4. Decompose oversized feature modules

Status:
- in progress

Two files carry enough distinct responsibilities that they should be split before absorbing more work.

**`js/ui/timeSyncStudio.js` (1,685 lines)**

Stable seams to extract:
- YouTube IFrame player adapter (loading, lifecycle, state polling)
- assistant client (request/response, stale-guard, prompt formatting)
- VTT/export formatter (serialization, download trigger)
- leaving the wizard state machine and sync engine in the main file

The argument is not for arbitrary splitting; it is for extracting clear seams before more work lands there.

**`js/features.js` (762 lines)**

Stable seams extracted:
- `js/previewAudioEngine.js` now owns crossfade, playback loop, request cancellation, and audio lifecycle
- `js/waveformRenderer.js` now owns waveform drawing

Remaining in the parent module:
- genre data loading
- DOM creation
- card rendering and preview metadata wiring
- convert handoff

Also: remove synthetic event dispatches (`form.dispatchEvent(new Event('submit'))`) and replace with an explicit callback or imported function. Cross-module DOM mutations are the exact coupling the architecture warns against.

Definition of done:
- extracted sub-modules have clear single-purpose APIs
- the parent module imports from them rather than containing them inline
- follow-up splits are driven by stable seams, not arbitrary line counts

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
- `css/components/karaoke-panel.css` (40 hardcoded color values)
- `css/components/conversion-animations.css` (23 hardcoded)
- `css/components/guess-track.css` (22 hardcoded)
- `css/components/game.css` (17 hardcoded)
- canvas-driven color fallbacks in `js/features.js`, `js/game/*`, and `js/guess-track.js`

Actions:
- convert repeated surfaces, borders, glow states, and status treatments into semantic tokens in `css/base.css`
- keep palette decisions in `css/themes/*.css`
- treat new hardcoded presentation values in JavaScript as exceptions that need a documented data-driven reason

Definition of done:
- themes own palette choices
- components mostly read from semantic tokens
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

1. freeze new `window.*` globals immediately (zero-cost rule)
2. choose one task persistence path and schedule legacy removal
3. stand up the frontend async test harness
4. decompose `timeSyncStudio.js` and `features.js` by stable seams
5. extract preview service from preview route
6. continue token migration in parallel throughout

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

Priority order, with structural extensibility first and visual cleanup in parallel:

1. **Freeze new globals** — enforce ES module `import`/`export` for all new work; migrate existing `window.*` globals opportunistically
2. **Choose one task persistence path** — declare SQLite canonical, put one facade in front of it, schedule removal of the legacy in-memory path
3. **Stand up a frontend async test harness** — wire vitest with a DOM environment and fake timers so race-condition tests are writable
4. **Decompose oversized modules** — split `timeSyncStudio.js` and `features.js` along stable seams before adding more features to them
5. **Extract preview service** — move process orchestration out of `server/routes/preview.ts` into a dedicated service
6. **Continue token migration** — reduce hardcoded visual assumptions in karaoke-panel, guess-track, conversion-animations, and game CSS (parallel track)

Use the Architecture Adjustment Plan above as the default path for these changes.

If a future feature feels hard to place cleanly, the first question is module ownership and integration style — not token availability. Extend the shared controller or service layer first instead of shipping another exception.
