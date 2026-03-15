# Frontend Theme Architecture and Feature Workflow

**Branch:** `codex/theme-header-architecture-plan`  
**Purpose:** document the current frontend architecture after the theme/header/karaoke rework and define the workflow for adding the next set of features without reintroducing coupling.

## What Changed

The landing experience is no longer driven by one large visual layer in `app.js`.

The main structural changes are:
- theme selection moved into a dedicated controller and registry
- hero/header visuals moved into dedicated layout and component styles
- conversion animations moved into a reusable animation registry/controller
- lyrics rendering split into timing/data logic and a visible karaoke panel
- game and discovery surfaces moved toward shared theme tokens instead of one-off colors
- batch queue, progress, and download states now use the same theme-aware surface system as the rest of the app

## Current Frontend Architecture

### Composition model

The app now follows this split:
- `app.js`
  - bootstraps the app
  - coordinates conversion flow
  - delegates theming, karaoke rendering, and animation behavior to dedicated modules
- `js/ui/themeRegistry.js`
  - defines available themes and theme metadata
- `js/ui/themeController.js`
  - applies the active theme to `document.documentElement`
  - persists the selection
  - keeps the browser theme color in sync
- `js/ui/animationRegistry.js`
  - central catalog of animation variants
- `js/ui/animationController.js`
  - mounts and clears conversion animations
- `js/ui/karaokePanel.js`
  - owns karaoke/arcade toggle state
  - renders lyric lines into the visible panel
- `js/lyrics.js`
  - parses subtitle payloads and exposes lyric timing data
- `js/features.js`
  - owns discovery cards and preview-player behavior
- `js/batch.js`
  - owns queue, progress, and batch download flow

### CSS model

The styling now follows a clearer hierarchy:
- `css/base.css`
  - semantic design tokens
  - shared glass, button, success/error, and lyric overlay tokens
- `css/themes/*.css`
  - theme-specific token overrides
- `css/layout/*.css`
  - page and hero layout only
- `css/components/*.css`
  - component-scoped styling

Important component files:
- `css/components/header.css`
- `css/components/theme-switcher.css`
- `css/components/karaoke-panel.css`
- `css/components/conversion-animations.css`
- `css/components/form.css`
- `css/components/results.css`
- `css/components/batch.css`
- `css/components/features.css`
- `css/components/game.css`
- `css/components/guess-track.css`
- `css/components/nerd-stats.css`

## Theme System Rules

These rules should be treated as the default standard for new work:

1. New UI should consume semantic tokens, not hardcoded colors.
2. Theme packs should override tokens in `css/themes/*.css`, not patch individual components unless the theme genuinely needs a special treatment.
3. Feature modules should not set colors inline from JavaScript unless the color is data-driven content.
4. Shared surface patterns should use the semantic token layer first:
   - `--surface-glass`
   - `--surface-glass-strong`
   - `--surface-glass-soft`
   - `--surface-border`
   - `--button-primary`
   - `--button-secondary`
   - `--success-surface`
   - `--error-surface`
5. New theme-specific visuals should be additive. Avoid changing unrelated selectors in an existing component just to support one theme.

## Feature Workflow

When adding a new frontend feature, use this order.

### 1. Decide the ownership boundary first

Before writing UI, decide:
- is this app orchestration
- a reusable UI controller
- a feature module
- a layout concern
- a component style concern
- a theme token concern

If the answer is unclear, stop and split the responsibility before adding code.

### 2. Add tokens before component overrides

If the new feature introduces a new surface type or state:
- add or reuse semantic tokens in `css/base.css`
- override those tokens in theme files only when necessary
- then consume those tokens inside the component CSS

Do not start with theme-specific selectors if the need is actually shared across themes.

### 3. Keep DOM rendering close to feature ownership

Good pattern:
- the module that owns the feature also owns its rendering and state transitions

Avoid:
- putting feature DOM updates in `app.js`
- reaching across unrelated modules to toggle classes in another feature's subtree

### 4. Prefer registries for variants

Use registries for:
- animation variants
- theme metadata
- future card/panel presets if we add more

This keeps feature growth additive instead of embedding special cases into app flow logic.

### 5. Verify in all themes before merging

Any visible feature should be checked in:
- `space`
- `green`
- `frutiger-aero`

Minimum checks:
- readable text contrast
- active/inactive states
- progress and success/error states
- popups/panels
- hover/focus states

## Recommended Checklist For New Features

- decide module ownership before implementation
- avoid adding visual logic to `app.js` unless it is true app orchestration
- use semantic tokens first
- verify desktop and mobile layout
- verify all three themes
- verify success, loading, empty, and error states
- run `npm run build`
- run `npm test`
- document any environment-specific test blockers in the PR or handoff note

## Next-Step Guidance

The next feature work should build on this architecture, not bypass it.

Priority guidance:
- add new surfaces through semantic tokens
- keep future hero/game/discovery expansions modular
- treat karaoke, arcade, discovery preview, and converter flow as sibling modules
- do not let batch, hero, or game styling drift into private color systems again

If a future feature cannot fit this structure cleanly, that is a signal to extend the shared token or controller layer before shipping the feature.
