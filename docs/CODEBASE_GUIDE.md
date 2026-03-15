# Codebase Guide

This is the main technical reference for the project.

Use this document for:
- current architecture
- module ownership
- theme system rules
- how to add new features without increasing coupling
- near-term extension guidance

Use `docs/TESTING_STATUS.md` for transient build and environment notes only.

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

### 2. Add tokens before exceptions

If the feature introduces:
- a new surface
- a new button treatment
- a new success/error/loading state
- a new theme-specific accent

Add the semantic token first, then consume it in the component.

### 3. Keep rendering local to the feature

Good:
- the module that owns the feature also owns its DOM state transitions

Avoid:
- adding more cross-component UI mutations to `app.js`
- reaching across unrelated DOM trees from another feature module

### 4. Prefer additive registries

Use registries for things that can grow:
- themes
- animation variants
- future card presets or visual modes

### 5. Verify all themes and states

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

## Practical Checklist

- define module ownership first
- keep visual tokens in `css/base.css` or `css/themes/*.css`
- keep component styles in component CSS files
- avoid adding presentation logic to `app.js`
- check reduced-motion behavior for decorative motion
- verify all visible states in all themes
- run `npm run build`
- run `npm test`
- record transient environment blockers only in `docs/TESTING_STATUS.md`

## Near-Term Next Steps

Best next areas for improvement:
- keep reducing hardcoded visual assumptions in older components
- strengthen documentation around backend service boundaries if server-side work grows
- add more explicit test coverage around lyric timing and request races
- keep new features additive to the token/controller architecture instead of adding more central orchestration logic

If a future feature feels hard to place cleanly, extend the shared token or controller layer first instead of shipping another exception.
