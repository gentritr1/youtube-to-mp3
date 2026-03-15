# Theme, Header, Animation, and Karaoke Re-Architecture Plan

**Branch:** `codex/theme-header-architecture-plan`  
**Status:** Implemented foundation; use with `docs/FRONTEND_THEME_ARCHITECTURE.md` for the current baseline  
**Created:** 2026-02-02

## Objective

Refactor the landing experience so visual upgrades do not increase coupling.

This plan focuses on:
- a configurable theme system with room for additional theme packs
- a more modern, denser, and more expressive header
- animation architecture that is reusable instead of embedded in unrelated flows
- a lyrics experience that lives in a visible card or panel, not behind the app shell
- module boundaries that keep layout, theming, animation, and feature logic separate

## Current Problems

### 1. Visual behavior is too centralized
- `app.js` currently coordinates conversion flow, progress UI, lyrics triggers, and several DOM concerns.
- Animation selection is embedded directly in conversion logic.
- Theme concerns are mostly implicit CSS choices instead of an explicit system.

### 2. The header is visually weaker than the discovery section
- The header uses a narrow centered block and leaves horizontal space unused.
- Its styling and motion language do not match the richer `Popular Music` section.
- The hero area does not expose configurable affordances like theme switching.

### 3. Lyrics are displayed in the wrong surface
- Lyrics render into `#lyrics-background` as a fixed, negative-z-index layer.
- Users can miss the lyrics entirely because they sit behind main content.
- The current karaoke behavior cannot be composed with the game or other cards.

### 4. Styling is modular by file, but not yet modular by system
- CSS is split into files, but tokens, theme variants, motion recipes, and component responsibilities are not strongly separated.
- Adding new themes today would likely require touching many unrelated selectors.

## Architecture Goals

### Design goals
- Make the top section feel as intentional and lively as the discovery shelf.
- Use more of the available width without letting the page feel crowded.
- Keep themes expressive: `space`, `green`, `frutiger-aero`, and future additions.
- Make lyrics a first-class interactive experience.

### Engineering goals
- Move from page-wide implicit styling to explicit design tokens and theme packs.
- Keep modules single-purpose and composed through small public APIs.
- Avoid feature logic reaching into unrelated DOM trees.
- Make new themes and UI variants mostly additive instead of invasive.

## Proposed Target Structure

### HTML zones
- `hero-shell`: full top section wrapper with responsive two-column or stacked layout
- `hero-header`: brand, title, subtitle, trust/status copy, theme controls
- `hero-converter`: converter card and preview/progress/download surfaces
- `hero-sidecar`: optional lyrics/game/activity panel beside or below converter
- `discovery-shell`: popular music and related discovery modules

### JavaScript modules
- `js/ui/themeRegistry.js`
  - owns available theme definitions
  - exports theme metadata and token maps
- `js/ui/themeController.js`
  - applies active theme to `document.documentElement`
  - persists preference
  - updates meta theme color if needed
- `js/ui/headerController.js`
  - manages theme button, hero status pill, and header-specific interactions
- `js/ui/animationRegistry.js`
  - central catalog of reusable animation descriptors
  - separates animation metadata from conversion flow
- `js/ui/animationController.js`
  - starts/stops named animations against a given mount point
  - respects reduced motion in one place
- `js/ui/karaokePanel.js`
  - renders visible lyric lines into a dedicated card/panel
  - handles toggle, active line state, compact/full modes
- `js/ui/layoutController.js`
  - handles responsive state or section mode toggles only if JS is actually needed
- `js/appShell.js`
  - composes shared UI controllers
- `app.js`
  - reduced to conversion orchestration and module bootstrapping

### CSS structure
- `css/tokens.css`
  - global semantic tokens only
- `css/themes/*.css`
  - theme packs setting semantic variables
- `css/layout/hero.css`
  - top-level hero grid and responsive spacing
- `css/components/header.css`
  - header/hero visuals only
- `css/components/theme-switcher.css`
  - theme selector styles only
- `css/components/karaoke-panel.css`
  - visible lyrics card and karaoke treatments
- `css/motion/animations.css`
  - reusable keyframes and named motion recipes

## Theme System Plan

### Theme model
Each theme should define semantic tokens, not component-specific overrides.

Example categories:
- background layers
- surface colors
- border colors
- text colors
- accent colors
- glow/highlight colors
- motion intensity
- artwork/noise/background treatment

### Initial theme packs
- `space`
  - deep blues, stellar glow, subtle parallax/radar motion
- `green`
  - emerald/lime gradients, organic glow, denser contrast
- `frutiger-aero`
  - airy cyan/green highlights, gloss, translucent surfaces, brighter atmospheric gradients

### Theme switcher behavior
- one visible control in the header/hero area
- compact by default, expandable if we add previews/swatches
- persisted in `localStorage`
- safe fallback to default theme if unknown value is stored

### Theme system rules
- components consume semantic variables only
- no hardcoded theme colors inside feature modules unless data-driven
- feature modules may request a semantic accent, but not assign raw palette values

## Header and Layout Plan

### Header redesign
- replace the narrow logo-only composition with a fuller hero header
- use a stronger visual hierarchy similar to the discovery shelf
- introduce supporting UI:
  - theme button
  - small live/status chip
  - optional quick explanation of MP3/MP4 flow

### Space usage changes
- widen the top layout beyond the current `480px` card constraint
- treat the hero as a composition, not just a centered stack
- allow converter and side content to share a row on desktop
- tighten vertical gaps so the page feels connected rather than sparse

### Relationship to Popular Music section
- reuse the best parts of the discovery section:
  - stronger glass surfaces
  - richer highlight gradients
  - more deliberate header chips and accent pills
  - staggered reveal motion
- do not duplicate markup patterns blindly; keep a shared token/motion language instead

## Karaoke and Lyrics Plan

### Replace background-only lyrics
- deprecate `#lyrics-background` as the primary rendering surface
- render lyrics inside a visible `karaoke panel` associated with the hero or snake card

### Recommended UI
- add a toggle within the snake/game card or a dedicated sidecar card:
  - `Game`
  - `Karaoke`
- when `Karaoke` is active:
  - show current line prominently
  - keep past/upcoming lines in a readable stack
  - use theme-driven glow and progress emphasis

### Behavior
- if subtitles exist, hydrate the karaoke panel
- if subtitles do not exist, keep the panel available with an empty/help state
- keep timing and rendering independent from conversion progress layout

### Engineering split
- `LyricsController` should become parsing/data logic
- `KaraokePanel` should own DOM rendering and presentation state
- parsing and rendering should communicate through simple lyric events or method calls

## Animation System Plan

### Problems to solve
- conversion animations are currently embedded inline in `app.js`
- motion choices are not theme-aware
- there is no clean boundary for future hero/header motion

### Proposed approach
- move animation definitions into a registry
- use named animation slots:
  - `heroAmbient`
  - `conversionProgress`
  - `karaokePulse`
  - `cardEntrance`
  - `themeTransition`
- allow themes to influence animation intensity or variant selection
- keep reduced-motion handling centralized

## Implementation Phases

### Phase 1: Architecture foundation
- extract theme registry and theme controller
- extract animation registry/controller from `app.js`
- split header and karaoke concerns into dedicated UI modules
- add semantic token layer and at least one theme pack to prove the pattern

### Phase 2: Hero/header rebuild
- create new hero layout CSS and markup
- move theme switcher into the header
- align header motion and visual treatment with the discovery shelf
- reduce unused whitespace and improve desktop width usage

### Phase 3: Karaoke panel integration
- add visible karaoke card or snake-card toggle
- convert lyrics rendering from background-only to panel-first
- keep optional ambient background lyrics only if they remain decorative and nonessential

### Phase 4: Theme expansion
- add `space`, `green`, and `frutiger-aero`
- verify all major surfaces inherit correctly from semantic tokens
- ensure new themes do not require component rewrites

### Phase 5: Hardening
- test responsive behavior across mobile and desktop
- test reduced motion and no-subtitles cases
- verify state persistence and fallback behavior
- remove dead styling and legacy hooks after migration

## Acceptance Criteria

- switching themes requires no edits inside conversion logic
- adding a new theme is primarily a new theme definition plus optional assets
- header and hero use more horizontal space on desktop without breaking mobile
- lyrics are visible and usable in a dedicated panel or snake-card mode
- animation definitions no longer live inline inside `app.js`
- `app.js` becomes thinner and stops owning unrelated UI systems

## File-Level Migration Notes

### Existing files likely to change
- `index.html`
- `app.js`
- `js/lyrics.js`
- `css/layout/main.css`
- `css/components/lyrics.css`
- `css/components/features.css`

### Expected new files
- `docs/THEME_HEADER_REARCHITECTURE_PLAN.md`
- `js/ui/themeRegistry.js`
- `js/ui/themeController.js`
- `js/ui/headerController.js`
- `js/ui/animationRegistry.js`
- `js/ui/animationController.js`
- `js/ui/karaokePanel.js`
- `css/tokens.css`
- `css/layout/hero.css`
- `css/components/header.css`
- `css/components/theme-switcher.css`
- `css/components/karaoke-panel.css`
- `css/themes/space.css`
- `css/themes/green.css`
- `css/themes/frutiger-aero.css`

## Risks and Constraints

- The current page is server-rendered static HTML, so componentization must stay lightweight.
- Excessive visual density could hurt clarity if layout changes are not balanced carefully.
- Frutiger Aero can become gimmicky fast; keep it token-based and intentional.
- Karaoke timing is still approximate unless tied to real playback/progress timing.

## Recommended Execution Order

1. Build the theme/token system first.
2. Extract animation and lyrics rendering out of `app.js`.
3. Rebuild the hero/header layout once the theme and motion primitives exist.
4. Integrate karaoke into the visible card surface.
5. Add remaining theme packs and clean up legacy styling.
