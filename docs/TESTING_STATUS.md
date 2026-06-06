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

- `./node_modules/.bin/tsc --noEmit`: passed
- targeted `node --check` runs: passed for `app.js`, `js/features.js`, `js/batch.js`, `js/popularBrowser.js`, and `js/previewPanel.js`
- UI clarity checks on `codex/ui-clarity-pass`: `rg "transition:\\s*all" css js` found no matches; `git diff --check` passed
- `node scripts/sync-service-worker-assets.mjs`: passed
- `./node_modules/.bin/vitest run`: blocked before collection by Rollup native optional dependency loading, `ERR_DLOPEN_FAILED` for `@rollup/rollup-darwin-arm64`
- `npm`: unavailable on this shell PATH, so `npm test`, `npm run build`, `npm audit`, and lockfile-safe package changes were not run here
- Batch sidecar/sunshine pass: `node --check js/batch.js`, `node --check js/popularBrowser.js`, `node --check js/features.js`, `node --check js/previewPanel.js`, `./node_modules/.bin/tsc --noEmit`, `rg "transition:\\s*all" css js`, `git diff --check`, and `node scripts/sync-service-worker-assets.mjs` passed. Browser smoke used `PORT=4174 TASK_STORE=memory ./node_modules/.bin/tsx server/index.ts` with real `/api/popular` data; verified Sunshine Popular Music active genre styling, desktop batch sidecar context, mobile `390x844` batch context wrapping, and batch context visibility across `space`, `green`, `frutiger-aero`, and `sunshine`. Targeted Vitest remains blocked by the Rollup native optional dependency code-signature error before collection.
- Popular scroller hover pass: `git diff --check` passed and `rg "transition:\\s*all" css js` returned no matches. Browser smoke used `PORT=4174 TASK_STORE=memory ./node_modules/.bin/tsx server/index.ts` with real `/api/popular` data; verified Sunshine and Space theme genre-chip hover spacing and Space video-card hover spacing so lifted borders/shadows are not clipped by the horizontal scroll containers.
- Local browser smoke for the UI clarity pass: passed on a temporary static server at `http://127.0.0.1:4173` after sandbox approval. Verified desktop first viewport hierarchy, the simplified hero conversion preview with the old car/runway scene absent, mobile layout at `390x844`, theme button `aria-pressed` updates across all four themes, and MP3/MP4 `aria-pressed` updates. API-backed suggestions were unavailable under static serving, so full backend conversion/discovery smoke still belongs to `npm start` coverage.

## Current Notes

- UI clarity branch `codex/ui-clarity-pass`: `impeccable` is not installed in the active skill list. The requested project command `npx impeccable skills install .` was attempted by the main agent and failed with `zsh:1: command not found: npx`; this shell also reports `npm --version` as `zsh:1: command not found: npm`. This pass used `docs/CODEBASE_GUIDE.md` as the local design-system contract.
- Design branch `codex/design-system-upgrade`: `npx impeccable skills install .` was requested but could not run in the Codex shell because `npm` and `npx` are not on `PATH`. No local `impeccable` skill files were found, so the design pass followed the repo's existing token/theme architecture plus the agent review checklist.
- Design branch verification completed in this shell: `git diff --check`, `node scripts/sync-service-worker-assets.mjs`, and a CSS scan confirming no `transition: all` remains. `npm run build` and `npm test` still need to be rerun in an environment with `npm` available.
- The current Vitest blocker is environment/dependency loading, not a collected test failure.
- Restore the local package toolchain before treating the suite as validated.
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
