# Testing Status and Troubleshooting

This document is intentionally transient.

Use it for current verification output, environment-specific blockers, and rebuild instructions. Keep long-term architecture guidance in `docs/CODEBASE_GUIDE.md`.

## Current Verification Commands

```bash
npm run build
npm test
node --check app.js
node --check js/features.js
node --check js/batch.js
node --check js/ui/themeController.js
```

## Current Status

- `npm run build`: passed
- `npm test`: passed (30 files / 340 tests)
- targeted `node --check` runs: passed

## Current Notes

- Design branch `codex/design-system-upgrade`: `npx impeccable skills install .` was requested but could not run in the Codex shell because `npm` and `npx` are not on `PATH`. No local `impeccable` skill files were found, so the design pass followed the repo's existing token/theme architecture plus the agent review checklist.
- Design branch verification completed in this shell: `git diff --check`, `node scripts/sync-service-worker-assets.mjs`, and a CSS scan confirming no `transition: all` remains. `npm run build` and `npm test` still need to be rerun in an environment with `npm` available.
- `tests/jobQueue.test.ts` may log Redis connection errors when Redis is unavailable or sandboxed. The suite expects graceful fallback behavior and still passes.
- Use `docs/RUNTIME_VERIFICATION.md` for browser smoke coverage that unit tests cannot prove.

## Dependency Rebuild Fallback

If `better-sqlite3` fails with `ERR_DLOPEN_FAILED` after a Node version change, try this first:

```bash
npm rebuild better-sqlite3
```

If the rebuild does not resolve the mismatch:

```bash
rm -rf node_modules package-lock.json
npm install
```

Use the rebuild path first.
