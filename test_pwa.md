# How to Test PWA Locally

1. Open http://localhost:3000 in Google Chrome
2. Open Chrome DevTools (`Cmd + Option + J`)

### Verify Service Worker
- Go to the **Application** tab in DevTools
- On the left sidebar, click **Service Workers** (under Application)
- You should see `service-worker.js` as "Activated and is running"

### Verify Manifest & Installability
- On the left sidebar, click **Manifest** (under Application)
- You should see "YT Converter" with its properties exactly as defined in `manifest.json`.
- There should be no warnings or errors on this page.

### Install the App Locally
- In the Chrome address bar (omnibox) on the right side, you should see an **Install icon** (it looks like a monitor with a downward arrow).
- Click it, and select **Install**. The app should open in a standalone window!

### Test Offline Mode
- Go back to the **Application** tab in DevTools.
- Click **Service Workers** in the left sidebar.
- Check the **Offline** checkbox.
- Now reload the page (`Cmd + R`). The page should load successfully with all its CSS/JS completely offline! Let it try to convert a video to ensure API calls correctly fail while offline.
