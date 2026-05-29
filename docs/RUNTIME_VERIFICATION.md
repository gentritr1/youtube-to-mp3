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
- Batch mode: enable batch mode, add two URLs, preview one queued item, remove one item, convert the batch, and verify aggregate progress/results.
- Discovery preview: switch genres, play a popular preview, start another preview while the first is loading, close the panel, and verify stale audio does not resume.
- Lyrics/studio: load a captioned video, verify lyric timing events update the studio, run autosync, nudge a point, undo, and export JSON.
- Review player: replace the selected YouTube media source while the previous player is loading and verify only the latest player remains active.
- Mini-games: launch Snake and Guess the Track from the arcade sidecar and verify theme colors update after switching themes.
- Service worker: on localhost, verify the service worker only registers for allowed local origins and does not interfere with fresh asset loads.

## Theme And Layout Pass

- Themes: verify `space`, `green`, `frutiger-aero`, and `sunshine`.
- Viewports: verify one mobile width, one tablet width, and desktop.
- Motion: verify normal motion and `prefers-reduced-motion: reduce`.
- States: verify idle, loading, success, error, empty, active, inactive, popup, and panel states.

## Release Gate

- No new `window.*` integration globals.
- No synthetic events across feature boundaries.
- New async UI behavior has a request-id, abort, or equivalent stale-response guard.
- Routes validate/respond; services own orchestration.
- If a feature needs durable server state, it goes behind a store facade before route integration.
