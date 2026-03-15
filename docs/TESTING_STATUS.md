# Testing Status and Troubleshooting

This document is intentionally transient.

Use it for current verification output, environment-specific blockers, and rebuild instructions. Keep long-term architecture guidance in `docs/FRONTEND_THEME_ARCHITECTURE.md`.

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
- `npm test` inside sandbox: lyrics route tests fail because Supertest cannot bind a port in the sandbox
- `npm test` outside sandbox: lyrics tests pass
- remaining failing suite: `tests/sqliteTaskManager.test.ts`
- targeted `node --check` runs: passed

## Known Blocker

`better-sqlite3` is currently built for the wrong Node ABI.

Observed error:
- `ERR_DLOPEN_FAILED`
- installed module uses `NODE_MODULE_VERSION 115`
- current Node requires `NODE_MODULE_VERSION 131`

## Recommended Fix

Try this first:

```bash
npm rebuild better-sqlite3
```

If the rebuild does not resolve the mismatch:

```bash
rm -rf node_modules package-lock.json
npm install
```

Use the rebuild path first.
