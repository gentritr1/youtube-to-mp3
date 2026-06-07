# Runtime Verification Checklist

Use this checklist after architecture or UI changes. Unit tests cover the pure logic and async race guards; this file covers browser/runtime behavior that needs a real page.

## Commands

```bash
npm test
npm run build
npm start
```

Open `http://localhost:3000` after `npm start`.

## Browser Smoke Pass

- Converter: paste a valid YouTube URL, fetch metadata, start an MP3 conversion, verify progress, completion animation, nerd stats fallback, and download link.
- Conversion errors: submit an invalid URL and verify the user-facing error clears without leaving loading state stuck.
- Batch mode: enable batch mode, verify the right-side batch context appears, add two URLs, preview one queued item, remove one item, convert the batch, and verify aggregate progress/results keep the context count and copy current.
- Discovery preview: switch genres, play a popular preview, start another preview while the first is loading, close the panel, and verify stale audio does not resume.
- Lyrics/studio: load a captioned video, verify lyric timing events update the studio, run autosync, nudge a point, undo, and export JSON.
- Review player: replace the selected YouTube media source while the previous player is loading and verify only the latest player remains active.
- Mini-games: launch Snake and Guess the Track from the arcade sidecar and verify theme colors update after switching themes.
- Service worker: on localhost, verify the service worker only registers for allowed local origins, registers with `updateViaCache: 'none'`, serves CSS/JS network-first while online, and does not keep stale CSS/HTML after a UI-only asset change.

## Theme And Layout Pass

- Themes: verify `space`, `green`, `frutiger-aero`, and `sunshine`.
- Hero/converter first viewport: verify the hero preview remains compact, the hero preview and headline have balanced edge breathing room on desktop, the URL input is visible without scrolling on desktop, narrow desktop/tablet, and mobile, and the Convert action remains visible at the historical `1491x851` comparison size plus a large `1536x900` desktop viewport.
- Mobile theme switcher: verify the swatch controls stay one row, remain keyboard focusable, and keep accessible names despite visually hidden labels.
- Theme swatches: verify each theme chip keeps its own destination swatch colors while another theme is active; selecting Sunshine must not make Space, Green, or Frutiger Aero swatches turn into Sunshine colors.
- Sunshine theme: verify active converter buttons, batch actions, popular genre tabs, track tags, hero theme swatches, and conversion teaser card/meter accents use warm amber/peach/clay accents rather than cool blue/cyan, green progress fills, or harsh red fills. Verify primary, selected, preview, and game-launch buttons have a controlled warm radiance in normal motion and become static under `prefers-reduced-motion: reduce`.
- Viewports: verify one mobile width, one tablet width, and desktop.
- Motion: verify normal motion and `prefers-reduced-motion: reduce`.
- States: verify idle, loading, success, error, empty, active, inactive, popup, and panel states.

## Design System Visual QA

- Keyboard focus: tab through converter input, paste, format, convert, theme options, download links, batch controls, discovery preview controls, sidecar tabs, and floating game controls; verify the focus ring is visible in all four themes.
- Reduced motion: enable `prefers-reduced-motion: reduce` and verify decorative animation, shimmer, hover lift, lyric/card motion, and game-control motion are calmed while loading, progress, panel switches, and content reveal states still complete.
- Hero reduced motion: verify the hero conversion teaser renders as static, useful conversion context with no looping decorative scene motion.
- Responsive pass: check mobile, tablet, and desktop for stable converter control heights, button text fit, sidecar proportions, sidecar tab wrapping, batch context wrapping, batch action rows, and download buttons.
- Converter states: verify idle, pasted URL, active format, loading, progress, success/download, disabled, and error states.
- Conversion success: verify the download button is visible immediately, or within roughly 500ms, after a successful conversion and is not blocked by a staged decorative reveal.
- Format toggle semantics: inspect MP3/MP4 buttons and verify the selected button exposes `aria-pressed="true"` while the other exposes `aria-pressed="false"`.
- Batch controls: verify batch mode toggle, active toggle text contrast, right-side context copy/step/jump text contrast, add/remove item controls, preview item button, convert/clear actions, per-item download buttons, and new-batch action.
- Button contrast: verify active, inactive, hover, destructive, disabled, and selected text/icon contrast on converter controls, theme chips, genre tabs, video action buttons, preview close/actions, studio/assistant controls, arcade launch buttons, mini-game switch/minimize buttons, and Guess Track answer states in all four themes.
- Clipped hover/focus audit: hover and keyboard-focus the first, active, and last genre chips; first and last popular video cards; batch queue/progress rows and row actions; and the first/last point-rail timing chips. Verify lifted borders, shadows, and focus rings are not clipped by their scroll containers or rails.
- Discovery preview controls: verify play/pause, close, preview loading/error, progress/waveform, and one-click convert controls.
- Waveform scrubbing: tab to the preview waveform slider, verify a visible focus ring, then use ArrowLeft/ArrowRight, ArrowUp/ArrowDown, Home, End, PageUp, and PageDown to scrub while `aria-valuenow` and the visible playhead update.
- Sidecar tabs: verify karaoke/arcade tab focus, active state, hover state, and reduced-motion behavior.
- Floating game controls: verify Snake and Guess the Track launch/floating controls remain visible, focusable, and themed.

## Release Gate

- No new `window.*` integration globals.
- No synthetic events across feature boundaries.
- New async UI behavior has a request-id, abort, or equivalent stale-response guard.
- Routes validate/respond; services own orchestration.
- If a feature needs durable server state, it goes behind a store facade before route integration.
- Static serving exposes only intentional public assets; repo-root files, databases, downloads, cookies, source files, and dependencies are not reachable over HTTP.
- Every `spawn()` path has both `error` and `close` handling and fails only the owned request/task.
- Shared domain values such as YouTube video IDs use shared validation helpers across every route and service entry point.
- Direct and queued conversion paths go through the same dispatch boundary.
- Persisted in-flight task state has a startup recovery rule.
- Download paths are basename/containment checked before `res.download()`.
- Production CORS origins are explicit through configuration.
- Docker context excludes runtime files and secrets, and container startup does not upgrade tool versions from the network.
