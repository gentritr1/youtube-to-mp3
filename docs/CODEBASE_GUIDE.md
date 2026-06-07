# Codebase Guide

This is the main technical reference for the project.

Use this document for:
- current architecture
- module ownership
- theme system rules
- how to add new features without increasing coupling
- near-term extension guidance

Use `docs/DESIGN_DECISION_HISTORY.md` for visual before/after records and product UI decisions that need screenshot context.

Use `docs/TESTING_STATUS.md` for transient build and environment notes only.

## Table of Contents

- [Product Summary](#product-summary)
- [Project Shape](#project-shape)
- [Architecture Style](#architecture-style)
- [Post-Review Lessons](#post-review-lessons)
- [Frontend Module Ownership](#frontend-module-ownership)
- [Styling Architecture](#styling-architecture)
- [Design System Usage](#design-system-usage)
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

## Architecture Style

The app is a pragmatic modular monolith.

The backend is organized as thin Express routes over service modules:
- routes validate HTTP input, choose status codes, and shape responses
- services own orchestration, subprocesses, persistence, caching, and cleanup
- adapters hide replaceable storage details behind facades such as `taskStore` and `batchStore`

The frontend is not a framework app and is not class-heavy. It uses ES modules with small controllers and pure helpers:
- feature controllers coordinate their own DOM and async state
- renderer modules turn state into DOM/canvas output
- engine modules own lifecycle-heavy behavior such as audio playback or timing math
- explicit callbacks connect features when one workflow hands off to another

There is some OOP where it pays for itself:
- `PreviewAudioEngine` owns mutable audio lifecycle, playback state, request cancellation, and crossfade cleanup
- studio/player adapters wrap imperative browser APIs behind narrow objects

Most other code is functional/module-oriented. Prefer plain exported functions and scoped module state unless the feature has a real lifecycle that benefits from an instance.

## Post-Review Lessons

This section captures the gaps found during the repo review that produced PR #20. Treat these as prevention rules for future backend, deployment, and runtime changes.

### Static asset boundary

Gap:
- the server used `express.static(config.ROOT_DIR)`, which made repo-root runtime files eligible for direct HTTP serving
- runtime files such as SQLite databases, generated downloads, and local cookie files lived below that root
- the download limiter and `/api/download` path were easy to bypass because static middleware could serve files first

Fix:
- serve only explicit frontend entry files and asset folders
- keep generated media behind `/api/download`
- add `.dockerignore` so local runtime files and accidental secrets are not copied into images

Lesson:
- never serve the repository root as a static web root
- every static directory must be intentionally public
- runtime data, local credentials, database files, generated downloads, source files, and dependency folders must stay outside static middleware

### External process safety

Gap:
- `yt-dlp`, `ffmpeg`, and `ffprobe` subprocesses lacked `error` listeners
- startup checks logged missing binaries but did not prevent later unhandled child-process errors
- a missing or unlaunchable binary could terminate Node instead of failing one task

Fix:
- add subprocess `error` handlers and single-settlement guards
- return conversion/info errors through task state or API responses

Lesson:
- every `spawn()` must handle `error` and `close`
- process startup checks are useful diagnostics, not a substitute for per-call failure handling
- background work should fail the task it owns, not the whole server

### Input validation consistency

Gap:
- preview used a strict YouTube video ID whitelist
- info, convert, and batch paths only checked presence/non-empty values
- unvalidated IDs were interpolated into YouTube URLs, which allowed query-string expansion such as playlist parameters

Fix:
- add shared `validateYouTubeVideoId()` and `buildYouTubeWatchUrl()` helpers
- use them across info, convert, batch, and preview flows
- add tests for canonical IDs and rejected query/path/malformed values

Lesson:
- when several routes accept the same domain value, validation belongs in one shared helper
- routes should reject malformed values before building URLs or starting expensive subprocess work
- service tests should cover the invalid values that caused the review finding

### Conversion lifecycle ownership

Gap:
- queue support initialized Redis but conversions still called `convertVideo()` directly
- batch and single conversions duplicated dispatch/error handling
- persisted `processing` tasks could survive restart and be returned by idempotency lookup even though no worker was running

Fix:
- add `conversionRunner` as the dispatch boundary for direct vs queued conversion
- register a queue processor when Redis is actually ready
- mark persisted `processing` tasks as interrupted during startup

Lesson:
- feature flags must be wired into the behavior they advertise
- direct and queued execution should share one dispatch seam
- persisted task state needs a startup recovery rule for in-flight work

### File ownership and downloads

Gap:
- output filenames were based only on sanitized title and format
- two videos with the same title could collide or overwrite each other
- download paths trusted persisted filenames without a containment check

Fix:
- include the task ID in generated output filenames
- verify the stored filename is a basename and resolves inside the downloads directory before `res.download()`

Lesson:
- user-facing names are not stable storage keys
- download routes must validate persisted file paths too, because future writers or corrupted state can bypass current creation assumptions

### Configuration and deployment drift

Gap:
- production CORS was permissive
- operational environment variables were scattered across code and deploy docs
- Docker copied the whole repo and upgraded `yt-dlp` at container startup

Fix:
- add `ALLOWED_ORIGINS` for production CORS
- add `.env.example` and README/deploy config notes
- move `yt-dlp` updates to image build time and ignore runtime/local files in Docker context

Lesson:
- every new env var needs a docs entry and, when useful, `.env.example`
- container runtime should not mutate tool versions through network upgrades
- deployment docs should explain security-sensitive configuration, not only happy-path startup

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
- discovery/preview orchestration
- preview API request lifecycle
- converting a previewed item through the callback injected by `app.js`
- DOM template creation for the discovery preview panel

Does not own:
- genre/carousel rendering (`popularBrowser.js`)
- preview audio lifecycle (`previewAudioEngine.js`)
- preview panel state rendering (`previewPanel.js`)
- waveform canvas drawing (`waveformRenderer.js`)
- waveform audio-signal extraction (`waveformSignal.js`)

### `js/popularBrowser.js`

Owns:
- loading popular genre data
- rendering genre tabs and carousel cards
- random-track selection for related surfaces

### `js/previewAudioEngine.js`

Owns:
- `Audio` element creation and disposal
- request cancellation and stale-preview guards
- play/pause/seek/progress behavior
- crossfade between previews
- visualizer synchronization

### `js/previewPanel.js`

Owns:
- preview metadata state
- loading and error state
- preview progress/playhead rendering
- preview-state event emission

### `js/waveformRenderer.js`

Owns:
- drawing the preview energy line onto canvas
- reading theme tokens for canvas colors
- rendering either signal-derived samples or a deterministic seeded fallback

### `js/waveformSignal.js`

Owns:
- fetching generated preview audio for visualization
- decoding audio with Web Audio
- turning RMS/peak energy into normalized waveform samples

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

## Design System Usage

- For UI, styling, layout, animation, interaction, theme, accessibility, or visual polish work, use the `impeccable` design skill as the primary design reference when it is available. If it is not installed, attempt `npx impeccable skills install .`; if that cannot run, document the blocker and use this guide as the local source of truth.
- Use non-color tokens from `css/base.css` for shared spacing, control heights, control gaps, radii, focus rings, hover lift, and motion timing/easing. Avoid one-off control sizes unless a component has a clear layout reason.
- Use semantic color tokens for surfaces, borders, buttons, and state feedback. Preserve theme-specific values in `css/themes/*.css` instead of hardcoding palette colors inside components.
- Interactive controls should rely on the shared `:focus-visible` baseline for buttons, links, form fields, and tabindex targets. Add component-specific focus styling only when the baseline is insufficient.
- Do not use `transition: all`; list the exact properties that should animate so state changes stay predictable.
- Respect `prefers-reduced-motion: reduce` by calming decorative animation and hover motion without hiding content or preventing layout/state changes from completing.
- Keep the converter task dominant in the first viewport: URL input, format choice, and Convert should read as the primary workflow before discovery, lyrics, theme, or game affordances.
- Decorative motion and secondary tools should not compete with conversion. Prefer static decoration or one subtle animation, and keep games, discovery, and studio links visibly secondary until the user chooses them.

### Button Text Contrast

Keep the playful gradients, glass fills, and tinted active states, but do not let a component guess its text color from the background. Every interactive state that changes the fill should also choose a semantic foreground token.

- Use `--button-primary-foreground` on full primary gradient controls such as Convert, Add to Batch, download, and game start/restart buttons.
- Use `--button-glass-foreground` and `--button-glass-muted-foreground` for glass, secondary, inactive, icon, and outline-style controls.
- Use `--button-selected-foreground` for selected or active tabs, pills, toggles, theme chips, genre chips, and tinted assistant/studio controls.
- Use `--button-danger-foreground`, `--button-success-foreground`, and `--button-error-foreground` for destructive, correct, and error/wrong answer states.
- Use `--button-disabled-foreground` when disabled controls still show readable text; opacity can support the state, but should not be the only contrast mechanism.
- Raw `white` is allowed for decorative highlights, sheens, and scrims. Do not use raw `white` for control text unless a named semantic foreground token is impossible and the state has been verified in all four themes.

### Hover And Focus Inside Clipped Containers

Horizontal scrollers, vertical scroll panels, rails, and cards with `overflow: hidden` can crop lifted hover states, shadows, scaled children, and focus rings. Before adding hover lift, scale, large shadows, or `outline-offset` inside a clipped container:

1. Add internal breathing room on the scroll container or rail with small padding.
2. Use an equal negative margin to preserve the base visual alignment when needed.
3. Add `scroll-padding-inline` or `scroll-padding-block` so keyboard and snap movement do not park items against the clipped edge.
4. Verify the first, active, and last items, not only middle items.
5. Keep intentional internal crops, such as thumbnails, progress bars, text ellipsis, and masked media, scoped to the child that actually needs clipping.

Existing examples:
- `css/components/features.css`: `.genre-tabs` and `.video-carousel`
- `css/components/batch.css`: `.batch-list` and `.batch-progress-list`
- `css/components/karaoke-panel.css`: `.point-rail-window`

## Theme System

### Current themes

- `space`
- `green`
- `frutiger-aero`
- `sunshine`

### Theme rules

1. Components should consume semantic variables, not hardcoded palette values.
2. Theme-specific visual differences should be expressed through `css/themes/*.css` first.
3. JavaScript should not assign presentation colors unless the value is genuinely data-driven.
4. Data-driven accents, such as popular-genre colors, should be passed as local custom properties only; component CSS must derive softened surfaces, borders, and labels from them rather than applying raw inline backgrounds.
5. New UI states should prefer semantic tokens over ad hoc selectors.

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
- `--button-glass-foreground`
- `--button-glass-muted-foreground`
- `--button-selected-foreground`
- `--button-danger-foreground`
- `--button-success-foreground`
- `--button-error-foreground`
- `--button-disabled-foreground`
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
- right-side conversion preview panel
- modular converter section
- karaoke/arcade sidecar

Hero decoration should stay static or very calm so it does not compete with conversion.

The right-side hero preview is a compact conversion teaser, not the full discovery audio preview. Keep it useful and enticing, but cap its desktop column so it does not inflate the hero height. On large screens, the hero should feel like conversion context rather than a billboard: keep the hero copy on the same standard card padding rhythm as the rest of the surface instead of adding a special left inset to balance the preview, and keep the converter input and Convert action reachable in the first viewport at both the historical comparison size (`1491x851`) and a standard large desktop size (`1536x900`). On mobile, remove secondary teaser details such as the MP3/MP4 badge and progress rail before letting the converter input drop below the first viewport. See [DESIGN_DECISION_HISTORY.md](./DESIGN_DECISION_HISTORY.md) for the before/after record.

The theme switcher remains available in the hero, but mobile uses compact swatch-style buttons with visually hidden labels. Preserve the accessible button text when changing this control.

The desktop sidecar is supportive context, not a second primary card. Keep the converter column visibly wider, prevent the sidecar card from stretching to create empty space, and keep Studio/Arcade/Batch content compact enough to sit beside the converter without matching every pixel of its height.

The Studio sidecar should feel like a compact timing tool, not a sparse promo card. Keep the status, mode context, timing meter, workflow rows, and Time Sync Studio action in one dense panel. Avoid broad three-column feature boxes or stacked empty cards that make the right side feel oversized.

### Converter Flow

The converter flow is split into:
- input and format selection
- preview state
- conversion progress state
- completion/download state
- batch flow when enabled

The converter's quick workflow guidance should read like product UI, not marketing decoration. Use a restrained inline step rail with text labels and small numeric markers. Avoid emoji pills, oversized badges, or right-aligned chip clusters that compete with the input.

Themed converter visuals should be driven by shared tokens and animation registries, not embedded inline in `app.js`.

When batch mode is enabled, the sidecar should switch to batch context instead of continuing to promote unrelated studio/arcade content. Keep the queue count, next action, and progress/result state visible without creating a separate visual system. Use compact workflow rows for batch guidance; avoid large pill rows that make the sidecar feel wide and empty.

Batch active states use dedicated text tokens because each theme places the active batch controls on different surface brightness. Use `--batch-active-foreground`, `--batch-kicker-foreground`, `--batch-muted-foreground`, `--batch-step-foreground`, and `--batch-action-foreground` instead of borrowing `--primary-foreground` or `--muted-foreground` directly for batch-specific filled/tinted controls. Verify Green and Frutiger Aero especially, because one is dark with saturated green fills and the other is light with pale blue fills.

Sunshine should read as warm amber, peach, and clay. Do not let cool blue, cyan, or green progress accents leak into the hero theme switcher, conversion teaser card, conversion teaser meter, primary button gradient, or batch assistant unless the component is explicitly previewing a non-Sunshine theme in a separate context. Primary, selected, and launch-style Sunshine buttons may use a restrained warm radiance effect, but the glow must remain theme-scoped, avoid layout shifts, and stop animating under `prefers-reduced-motion: reduce`.

Sunshine hover should be quieter than Sunshine primary/launch radiance. Keep ordinary hover states to warm border, surface, and small shadow changes. Active format buttons should use a static warm shadow instead of pulsing, so hovering format choices does not feel like a large decorative glow.

Theme switcher swatches preview their destination themes even when another theme is active. Theme-specific CSS may override the active theme's own preview token, such as Sunshine warming `--theme-preview-sunshine`, but it must not override `--theme-preview-space`, `--theme-preview-green`, or `--theme-preview-frutiger` just because Sunshine is active.

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

Preview implementation details:
- `features.js` calls `/api/preview` and coordinates request cancellation.
- `previewAudioEngine.js` owns playback state, crossfade, progress loop, and stale audio cleanup.
- `previewPanel.js` renders metadata, loading/error state, and playhead progress.
- `waveformRenderer.js` draws the energy line using theme tokens.
- `waveformSignal.js` decodes the generated preview MP3 and supplies real audio-energy samples; the renderer falls back to seeded bars if decoding is unavailable.
- `service-worker-assets.js` must include any new browser module imported by the preview flow.

Do not route preview playback through `app.js`. The only handoff from discovery to conversion should remain the explicit convert callback wired by `app.js`.

Horizontal discovery scrollers need internal padding large enough for hover lift, borders, shadows, and focus rings. Keep first and last popular video cards from clipping by balancing negative carousel margins with larger inline and bottom padding.

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

For backend work, decide the same boundary up front:
- routes validate HTTP input and shape responses
- shared validators live in `server/utils`
- orchestration lives in services such as `conversionRunner`
- storage changes go through store facades such as `taskStore`
- subprocess wrappers own command arguments, output parsing, and process failure handling

### 2. Use ES modules only

All new JavaScript must use `import`/`export`. Do not add new `window.*` globals.

The active frontend runtime now uses ES module imports and explicit callbacks for feature handoffs. Older standalone files may remain for compatibility or historical context, but new feature work must not copy legacy global patterns.

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

### 6. Update generated browser assets when adding modules

If a new browser module is imported from the app shell, run:

```bash
node scripts/sync-service-worker-assets.mjs
```

This keeps the service worker manifest aligned with reachable frontend assets and prevents stale PWA caches from missing new modules.

The generated service-worker version hashes asset contents, not just asset paths. Keep that behavior intact: a CSS-only or HTML-only UI change must produce a new `service-worker-assets.js` version so returning browsers do not keep stale static files. The app registers the worker with `updateViaCache: 'none'` for the same reason.

The service worker serves CSS and JS with a network-first strategy while online, then falls back to cache if the network fails. Do not move styles or scripts back to the cache-first static asset branch; that can make returning browser sessions keep old layouts after a UI-only change.

### 7. Keep files under 500 lines

If a module exceeds roughly 500 lines, look for stable boundaries to split before adding more work to it. The goal is not arbitrary splitting for its own sake; extract responsibilities that are already distinct, such as player adapter, export formatter, or assistant client.

### 8. Verify all themes and states

At minimum verify:
- `space`
- `green`
- `frutiger-aero`
- `sunshine`

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

**Structural decisions to preserve:**

- task persistence routes through `server/services/taskStore.ts` with SQLite default and memory fallback
- batch jobs now route through `server/services/batchStore.ts`; the current adapter is intentionally memory-backed/runtime-only, so durable batch history should be added as a new adapter instead of putting state back into `batchService.ts`
- frontend test infrastructure now has a jsdom harness for async UI flows, and the extracted `js/ui/pointTimingEngine.js`, `js/ui/reviewPlayerPanel.js`, `js/ui/studioWorkflowState.js`, and `js/ui/studioEventBindings.js` seams have direct unit coverage; use `docs/RUNTIME_VERIFICATION.md` for browser checks that unit tests cannot prove

**Maintenance (valuable but lower leverage):**

- `js/ui/timeSyncStudio.js` is now an orchestration shell at roughly 1,130 lines; treat it as acceptable until new responsibilities accumulate, then split again by stable boundary instead of adding back inline logic
- `js/features.js` is now a roughly 640-line controller shell for DOM creation, preview requests, signal-waveform coordination, and convert handoff; split it further only when one of those responsibilities grows materially
- `app.js` still owns some sidecar panel state and mini-game wiring in addition to the main conversion flow
- the visual token migration track is complete; keep new visual states on semantic tokens during review instead of introducing another visual island

### Phase 1. Freeze new globals and unify the module system direction

Status:
- completed

This is the single biggest barrier to additive features. Without it, every new feature inherits a module-system decision debt.

Rule in force:
- all new JavaScript uses `import`/`export` — no new `window.*` assignments
- remaining globals are legacy and should be migrated when their files are touched for other work

Completed migration targets:
- `js/features.js` now ships as an ES module with named exports
- `js/batch.js` now ships as an ES module with named exports
- the active Snake runtime comes from `js/game/*` through ES module imports

Remaining legacy target:
- `js/snake-game.js` is no longer the active runtime entry; either keep it dormant or delete it after confirming there is no external dependency

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
- `TASK_STORE` selects the adapter at startup, and both `memory` and `sqlite` modes have now been exercised through the real runtime import path outside Vitest; the remaining follow-through is operational documentation rather than adapter uncertainty

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

The harness now exists. The next gap is operational follow-through rather than setup: manual browser verification and runtime-like checks outside the unit suite.

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

**`js/ui/timeSyncStudio.js` (roughly 1,130 lines)**

Stable boundaries extracted:
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

**`js/features.js` (roughly 640 lines)**

Stable boundaries extracted:
- `js/previewAudioEngine.js` now owns crossfade, playback loop, request cancellation, and audio lifecycle
- `js/waveformRenderer.js` now owns waveform drawing
- `js/waveformSignal.js` now owns audio decoding and waveform sample extraction
- `js/popularBrowser.js` now owns genre loading, genre-tab rendering, carousel rendering, and random-track selection
- `js/previewPanel.js` now owns preview panel metadata, progress, loading state, and state-change emission

Remaining in the parent module:
- DOM creation
- preview request orchestration
- waveform fallback/signal handoff
- convert handoff

Also: remove synthetic event dispatches (`form.dispatchEvent(new Event('submit'))`) and replace with an explicit callback or imported function. Cross-module DOM mutations are the exact coupling the architecture warns against.

Definition of done:
- extracted sub-modules have clear single-purpose APIs
- the parent module imports from them rather than containing them inline
- follow-up splits are driven by stable boundaries, not arbitrary line counts

Current result:
- `js/ui/timeSyncStudio.js` is roughly 1,130 lines after extracting `youtubePlayerAdapter.js`, `assistantClient.js`, `syncExporter.js`, `pointWorkspaceRenderer.js`, `pointTimingEngine.js`, `reviewPlayerPanel.js`, `studioWorkflowState.js`, and `studioEventBindings.js`
- `js/features.js` is roughly 640 lines after extracting `previewAudioEngine.js`, `waveformRenderer.js`, `waveformSignal.js`, `popularBrowser.js`, and `previewPanel.js`
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

This track completed the high-value token pass for repeated visual assumptions. It improves visual consistency across themes but does not itself solve ownership, integration style, or extensibility.

Status:
- completed

Focus:
- semantic CSS surface tokens and canvas-driven runtime color fallbacks in `js/game/*`, `js/guess-track.js`, and `js/waveformRenderer.js`

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
- `css/components/form.css` now consumes semantic input inset-shadow tokens instead of owning repeated raw shadow literals
- `js/game/config.js`, `js/guess-track.js`, and `js/waveformRenderer.js` now derive live rendering palettes from computed CSS tokens
- runtime fallback literals are centralized in `js/ui/runtimeColorFallbacks.js` and are only for CSS-unavailable renderer defaults

Definition of done:
- themes own palette choices: done
- components read from semantic tokens for reusable surfaces, borders, shadows, and state treatments: done
- remaining visual exceptions live only where JavaScript/canvas rendering needs an explicit CSS-unavailable fallback: done
- new UI work must not introduce another visual island: ongoing review guardrail

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
- use the shared `js/ui/icons.js` SVG helper for product icons; do not add visible emoji glyphs to labels, badges, tabs, game headers, or genre data

### Recommended sequence

1. manually verify visual states across themes and mobile/desktop layouts before release
2. keep runtime fallback defaults centralized in `js/ui/runtimeColorFallbacks.js` when renderers change
3. keep migrating remaining legacy globals opportunistically when touched
4. if batch durability becomes a product requirement, add a persistent `batchStore` adapter instead of coupling it to `batchService`

## Practical Checklist

- define module ownership first
- use ES module `import`/`export` — no new `window.*` globals
- keep files under ~500 lines; split by stable boundaries if exceeded
- keep visual tokens in `css/base.css` or `css/themes/*.css`
- keep component styles in component CSS files
- avoid adding presentation logic to `app.js`
- avoid cross-module DOM mutations and synthetic event dispatches
- check reduced-motion behavior for decorative motion
- verify all visible states in all themes
- scan touched UI for visible emoji glyphs and replace them with shared SVG icons or plain text
- run the browser smoke pass in `docs/RUNTIME_VERIFICATION.md` for runtime-sensitive changes
- add a race-condition test for any new async UI flow
- run `npm run build`
- run `npm test`
- record transient environment blockers only in `docs/TESTING_STATUS.md`

## Near-Term Next Steps

Priority order now that the major structural phases are in place:

1. **Manually verify visual states** — check all supported themes, mobile/desktop layouts, reduced motion, and active/inactive panel states
2. **Run runtime smoke verification** — use `docs/RUNTIME_VERIFICATION.md` after frontend, preview, batch, service-worker, or studio changes
3. **Keep runtime fallbacks centralized** — the game, guess-track bursts, and waveform renderer read semantic tokens at runtime; fallback literals should stay in `js/ui/runtimeColorFallbacks.js`
4. **Keep module boundaries additive** — when `timeSyncStudio.js`, `features.js`, or `app.js` grow again, split by stable seam before reintroducing central orchestration or new globals

Recent note:
- runtime fallback literals for game/preview canvases are now centralized in `js/ui/runtimeColorFallbacks.js` instead of being duplicated across the renderers

Use the Architecture Adjustment Plan above as the default path for these changes.

If a future feature feels hard to place cleanly, the first question is module ownership and integration style — not token availability. Extend the shared controller or service layer first instead of shipping another exception.
