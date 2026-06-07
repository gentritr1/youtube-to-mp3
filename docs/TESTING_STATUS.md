# Testing Status and Troubleshooting

This document is intentionally transient.

Use it for current verification output, environment-specific blockers, and rebuild instructions. Keep long-term architecture guidance in `docs/CODEBASE_GUIDE.md`.

## Current Verification Commands

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run
node --check app.js
node --check js/features.js
node --check js/batch.js
node --check js/ui/themeController.js
```

## Current Status

- Converter step rail and hero padding correction on 2026-06-08:
  - Browser verification used the in-app browser against `http://127.0.0.1:3000` with a temporary `1491x851` viewport. Verified Sunshine active state, no horizontal overflow, `17px` between the hero edge and headline start, `17px` between the teaser end and hero edge, and the converter workflow rail below the converter copy with a `12px` gap.
  - Replaced emoji workflow pills with numbered text markers for `Paste link`, `Pick format`, and `Download file`; numbers are visual-only with `aria-hidden="true"`.
  - `npx vitest run tests/documentation.test.ts tests/serviceWorker.test.ts`: passed, 81 tests.
  - `npm run build`: passed.
  - `git diff --check`: passed.
  - `rg "transition:\s*all" css js`: no matches.
  - `node scripts/sync-service-worker-assets.mjs`: passed; service-worker asset hash is `9d164c95ad`.
- Sunshine hero preview alignment follow-up on 2026-06-07:
  - Browser verification used the in-app browser against `http://127.0.0.1:3000` with a temporary `1491x851` viewport. Verified Sunshine active state, no horizontal overflow, `72px` between the hero edge and headline start, `72px` between the teaser end and hero edge, and the teaser centered in its column.
  - Verified computed Sunshine teaser colors: warm cream/amber card, orange meter, and destination-specific theme swatches where Space stays blue, Green stays green, Frutiger Aero stays cyan/green, and Sunshine stays amber/peach.
  - Added after-state screenshot at `docs/decision-history/screenshots/2026-06-07-sunshine-hero-after.jpg`.
  - `npx vitest run tests/documentation.test.ts tests/serviceWorker.test.ts`: passed, 81 tests.
  - `npm run build`: passed.
  - `git diff --check`: passed.
  - `rg "transition:\s*all" css js`: no matches.
  - `node scripts/sync-service-worker-assets.mjs`: passed; service-worker asset hash is `2b3b9bc4ef`.
- Sunshine theme swatch fix on 2026-06-07:
  - Browser verification used the in-app browser against `http://127.0.0.1:3000` after selecting Sunshine. Verified `4` distinct theme swatch backgrounds: Space stays blue, Green stays green, Frutiger Aero stays cyan/green, and Sunshine stays amber/peach. No horizontal overflow.
  - `npm run build`: passed.
  - `npx vitest run tests/documentation.test.ts tests/serviceWorker.test.ts`: passed, 81 tests.
  - `git diff --check`: passed.
  - `rg "transition:\s*all" css js`: no matches.
  - `node scripts/sync-service-worker-assets.mjs`: passed; service-worker asset hash is `a88de3ec6e`.
- Critique closure on 2026-06-07:
  - Rechecked `.impeccable/critique/2026-06-07T12-49-27Z__index-html.md` against the current page.
  - `npm test`: passed, 30 test files and 347 tests.
  - `npm run build`: passed.
  - `npx vitest run tests/documentation.test.ts tests/serviceWorker.test.ts`: passed, 81 tests.
  - `git diff --check`: passed.
  - `rg "transition:\s*all" css js`: no matches.
  - `node scripts/sync-service-worker-assets.mjs`: passed; service-worker asset hash is `ce1d72b958`.
  - `node .agents/skills/impeccable/scripts/detect.mjs --json index.html`: only `single-font` remains. This is documented as a false positive because the product register permits one UI family and the app uses Manrope plus JetBrains Mono for metadata/stat surfaces.
  - Browser verification used the in-app browser against `http://127.0.0.1:3000` at `999x898`: URL input `top 521`, format toggle `top 620`, Convert `top 771`, no horizontal overflow, Popular Music starts below the task flow at `top 1253`, the Frutiger chip reads `Frutiger Aero GLASS`, stat placeholders are `N/A`, and the thumbnail has a real `src`.
  - Added closure documentation at `.impeccable/critique/2026-06-07T14-18-12Z__index-html-closure.md` and in `docs/DESIGN_DECISION_HISTORY.md`.
- Sunshine button radiance on 2026-06-07:
  - `npm test`: passed, 30 test files and 347 tests.
  - `npm run build`: passed.
  - `npx vitest run tests/documentation.test.ts tests/serviceWorker.test.ts`: passed, 81 tests.
  - `git diff --check`: passed.
  - `rg "transition:\s*all" css js`: no matches.
  - `node scripts/sync-service-worker-assets.mjs`: passed; service-worker asset hash is `ce1d72b958`.
  - Browser verification used the in-app browser against `http://127.0.0.1:3000`. The exposed verification viewport was `999x898`: confirmed Sunshine radiance appears on active/primary/launch buttons, does not appear in `space`, `green`, or `frutiger-aero`, and does not introduce horizontal overflow. The glow is implemented with `box-shadow`, so it does not change button geometry; the `prefers-reduced-motion: reduce` CSS rule keeps the warm glow static.
- Sidecar proportion and Sunshine cleanup on 2026-06-07:
  - Browser verification used the in-app browser against `http://127.0.0.1:3000`. Verified idle Studio sidecar at `1536x900` across `space`, `green`, `frutiger-aero`, and `sunshine`: converter column is wider, sidecar is compact, no horizontal overflow, and the Studio card no longer stretches into empty space.
  - Verified Sunshine theme swatches and hero accents are warm amber/peach/clay instead of cool blue/cyan in the top theme controls.
  - Verified Sunshine batch mode at `1536x900`: the batch assistant uses compact vertical workflow rows and does not stretch to the converter height. Verified mobile `390x844` still has no horizontal overflow and keeps the converter input visible before the sidecar.
- Large-screen hero/converter pass on 2026-06-07:
  - `npm test`: passed, 30 test files and 347 tests.
  - `npm run build`: passed.
  - `npx vitest run tests/serviceWorker.test.ts tests/documentation.test.ts`: passed, 81 tests.
  - `git diff --check`: passed.
  - `rg "transition:\s*all" css js`: no matches.
  - `node --check service-worker.js`: passed.
  - Browser verification used the in-app browser against `http://127.0.0.1:3000`. Verified the historical `1491x851` comparison size in `space`: no horizontal overflow, the hero is shorter, the URL input is visible, and the Convert action is fully visible. Verified the large `1536x900` layout across `space`, `green`, `frutiger-aero`, and `sunshine`. Also checked `2048x1280` large desktop and mobile `390x844`; mobile keeps the URL input visible without overflow while preserving the compact conversion teaser.
  - Added decision-history screenshots at `docs/decision-history/screenshots/2026-06-07-large-before.png` and `docs/decision-history/screenshots/2026-06-07-large-after.jpg`.
- Live hero preview pass on 2026-06-07:
  - `npm test`: passed, 30 test files and 346 tests.
  - `npm run build`: passed.
  - `npx vitest run tests/documentation.test.ts`: passed after documentation updates.
  - `git diff --check`: passed.
  - `rg "transition:\s*all" css js`: no matches.
  - `node --check scripts/sync-service-worker-assets.mjs`: passed.
  - Browser verification used the in-app browser against `http://127.0.0.1:3000` after refreshing the service-worker cache. Verified desktop `1280x900`, narrow desktop/tablet `999x898`, and mobile `390x844` across `space`, `green`, `frutiger-aero`, and `sunshine`: no hero/form overflow, the hero teaser stays compact, mobile theme swatches stay one row, and the URL input is visible in the first viewport.
  - Captured verification screenshots at `/private/tmp/yt-converter-desktop-hero.png` and `/private/tmp/yt-converter-mobile-hero.png`.
- `./node_modules/.bin/tsc --noEmit`: passed
- targeted `node --check` runs: passed for `app.js`, `js/features.js`, `js/batch.js`, `js/popularBrowser.js`, and `js/previewPanel.js`
- UI clarity checks on `codex/ui-clarity-pass`: `rg "transition:\\s*all" css js` found no matches; `git diff --check` passed
- `node scripts/sync-service-worker-assets.mjs`: passed
- Batch sidecar/sunshine pass: `node --check js/batch.js`, `node --check js/popularBrowser.js`, `node --check js/features.js`, `node --check js/previewPanel.js`, `./node_modules/.bin/tsc --noEmit`, `rg "transition:\\s*all" css js`, `git diff --check`, and `node scripts/sync-service-worker-assets.mjs` passed. Browser smoke used `PORT=4174 TASK_STORE=memory ./node_modules/.bin/tsx server/index.ts` with real `/api/popular` data; verified Sunshine Popular Music active genre styling, desktop batch sidecar context, mobile `390x844` batch context wrapping, and batch context visibility across `space`, `green`, `frutiger-aero`, and `sunshine`. The earlier Rollup optional dependency blocker from that pass is superseded by the successful 2026-06-07 `npm test` run above.
- Popular scroller hover pass: `git diff --check` passed and `rg "transition:\\s*all" css js` returned no matches. Browser smoke used `PORT=4174 TASK_STORE=memory ./node_modules/.bin/tsx server/index.ts` with real `/api/popular` data; verified Sunshine and Space theme genre-chip hover spacing and Space video-card hover spacing so lifted borders/shadows are not clipped by the horizontal scroll containers.
- Broader clipped-hover pass: static scan reviewed overflow/scroll containers with lifted hover or focus states. Added spacing for batch queue/progress scroll rows and Time Sync Studio point-rail timing chips. Browser smoke used `PORT=4174 TASK_STORE=memory ./node_modules/.bin/tsx server/index.ts`; verified top theme controls, a real batch queue row/action, and pasted-lyrics point-rail edge chip hover without cropped borders, shadows, or focus rings.
- Batch contrast pass: `git diff --check` passed and `rg "transition:\\s*all" css js` returned no matches. Browser smoke used `PORT=4174 TASK_STORE=memory ./node_modules/.bin/tsx server/index.ts`; verified active Batch Mode toggle text, right-side batch context copy, step labels, meter, and jump button contrast across `space`, `green`, `frutiger-aero`, and `sunshine`.
- Button contrast pass: `git diff --check`, `rg "transition:\\s*all" css js`, and `./node_modules/.bin/tsc --noEmit` passed. Browser smoke used `PORT=4174 TASK_STORE=memory ./node_modules/.bin/tsx server/index.ts`; verified converter controls, theme chips, active/inactive format buttons, Batch Mode, Add to Batch, disabled queue actions, batch assistant buttons, Studio/Arcade sidecar tabs, arcade launch buttons, discovery genre chips, and video action buttons across `space`, `green`, `frutiger-aero`, and `sunshine`. Guess Track launch/start controls were visually checked; answer-state controls are covered by CSS token review because the local preview returned `Track unavailable` before answer options rendered.
- Local browser smoke for the UI clarity pass: passed on a temporary static server at `http://127.0.0.1:4173` after sandbox approval. Verified desktop first viewport hierarchy, the simplified hero conversion preview with the old car/runway scene absent, mobile layout at `390x844`, theme button `aria-pressed` updates across all four themes, and MP3/MP4 `aria-pressed` updates. API-backed suggestions were unavailable under static serving, so full backend conversion/discovery smoke still belongs to `npm start` coverage.

## Current Notes

- Historical UI clarity branch `codex/ui-clarity-pass`: `impeccable` was not installed in that active skill list, and `npm`/`npx` were unavailable in that shell. That note is superseded for the current workspace by the available project-level `impeccable` skill and successful 2026-06-07 npm verification above.
- Historical design branch `codex/design-system-upgrade`: `npx impeccable skills install .` could not run in that shell because `npm` and `npx` were not on `PATH`. Current verification above confirms `npm test` and `npm run build` now pass in this workspace.
- `tests/jobQueue.test.ts` may log Redis connection errors when Redis is unavailable or sandboxed. The suite expects graceful fallback behavior and still passes.
- Use `docs/RUNTIME_VERIFICATION.md` for browser smoke coverage that unit tests cannot prove.

## Dependency Rebuild Fallback

If a native optional dependency fails with `ERR_DLOPEN_FAILED` after a Node version change or machine migration, rebuild the affected package first. For `better-sqlite3`, try:

```bash
npm rebuild better-sqlite3
```

For Rollup optional native package issues, a clean install is usually required because the package is platform-specific:

```bash
rm -rf node_modules
npm install
```

Use package-lock regeneration only when intentionally updating dependencies.
