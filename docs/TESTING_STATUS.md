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
- `npm test`: passed (27 files / 329 tests)
- targeted `node --check` runs: passed

## Current Notes

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
