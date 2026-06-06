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
- targeted `node --check` runs: passed for `app.js`, `js/features.js`, and `js/batch.js`
- `./node_modules/.bin/vitest run`: blocked before collection by Rollup native optional dependency loading, `ERR_DLOPEN_FAILED` for `@rollup/rollup-darwin-arm64`
- `npm`: unavailable on this shell PATH, so `npm test`, `npm run build`, `npm audit`, and lockfile-safe package changes were not run here

## Current Notes

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
