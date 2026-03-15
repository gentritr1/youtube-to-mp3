---
description: Steps for updating the Service Worker when adding features
---
# Service Worker Maintenance Workflow

This workflow ensures that the PWA correctly caches new files and that users receive the latest updates without manual cache clearing.

---

## 1. Identify New Static Assets
Check if your feature added any new:
- [ ] CSS files (`css/components/*.css`)
- [ ] JavaScript files (`js/*.js`)
- [ ] Icons or Images (`assets/*`)

## 2. Update `service-worker.js`
If you added new files or changed existing logic:

1.  **Add to STATIC_ASSETS**:
    Ensure the path to any new file is added to the `STATIC_ASSETS` array in `/service-worker.js`.

2.  **Bump CACHE_NAME**:
    Increment the version number (e.g., `yt-converter-v4` to `yt-converter-v5`).
    > [!IMPORTANT]
    > This is the only way to FORCE the browser to download the new code immediately.

## 3. Local Verification
1.  Open the site in Chrome.
2.  Open DevTools -> **Application** tab -> **Service Workers**.
3.  Ensure the "Status" shows the new version is activating.
4.  Check the **Cache Storage** to see if your new files are listed.

---

## Quick Reference: Checklist for Agents
// turbo
```bash
# Search for the current cache version
grep "const CACHE_NAME =" service-worker.js
```
