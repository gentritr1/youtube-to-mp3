---
description: Steps for implementing a new feature
---
# Feature Development Workflow (TDD + Docker)

This workflow ensures every feature is tested locally AND in Docker before deployment.

---

## 1. Create Feature Branch

```bash
git checkout -b feature/<feature-name>
```

---

## 2. Write Tests First (TDD)

- Create or update test files in `tests/` directory.
- Tests should cover the new functionality.
- Run tests to confirm they FAIL (red phase):

// turbo
```bash
npm test
```

---

## 3. Implement the Feature

- Write the minimum code to make tests pass.
- Run tests to confirm they PASS (green phase):

// turbo
```bash
npm test
```

---

## 4. Update Service Worker (PWA)

If your feature added new files or changed UI logic, you MUST update the Service Worker.
Check the dedicated workflow for details: [service_worker_maintenance.md](./service_worker_maintenance.md)

1. Add any new `.js` or `.css` files to `STATIC_ASSETS` in `service-worker.js`.
2. **Bump the `CACHE_NAME` version string** (e.g. `v3` -> `v4`).

---

## 5. Verify TypeScript Build

// turbo
```bash
npm run build
```

- Fix any type errors before proceeding.

---

## 6. Update Dockerfile (If Needed)

Check if your feature requires:
- [ ] New system dependencies (add to `apk add` in Dockerfile)
- [ ] New npm packages with native bindings (may need `build-base`)
- [ ] New environment variables
- [ ] Changes to the start command

---

## 7. Docker Build Test (CRITICAL)

Build and run the Docker container locally to verify it works in production-like environment:

```bash
npm run docker:build
```

If the build succeeds, test the running container:

```bash
npm run docker:test
```

Or use docker compose for a more complete test:

```bash
npm run docker:up
```

**Verify:**
- [ ] Container builds without errors
- [ ] Container starts and responds at http://localhost:3000
- [ ] Health check passes: `curl http://localhost:3000/health`
- [ ] Your new feature works as expected

---

## 8. Preflight Check (All-in-One)

Run the full preflight check before committing:

```bash
npm run preflight
```

This runs: `npm test` → `npm run build` → `npm run docker:build`

---

## 9. Commit & Push

```bash
git add .
git commit -m "feat: <description of feature>"
git push -u origin feature/<feature-name>
```

---

## 10. Create Pull Request

```bash
gh pr create --title "feat: <Feature Title>" --body "## Summary\n<description>"
```

---

## Quick Reference: npm Scripts

| Script | Purpose |
|--------|---------|
| `npm test` | Run unit tests |
| `npm run build` | Compile TypeScript |
| `npm run docker:build` | Build Docker image locally |
| `npm run docker:test` | Build and run Docker container |
| `npm run docker:up` | Start with docker compose |
| `npm run docker:down` | Stop docker compose |
| `npm run preflight` | Full pre-commit check (test + build + docker) |
| `/sw` | Reminder: Check Service Worker versioning |
