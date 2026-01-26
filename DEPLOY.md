# How to Deploy YT Converter

## Deployment Architecture

- **Frontend**: Netlify (Hosting static HTML/JS/CSS)
- **Backend**: Render (Hosting Docker container for FFmpeg/yt-dlp)

---

## Part 1: Deploy Backend to Render

1. Create a [GitHub repository](https://github.com/new) and push your code.
2. Sign up for [Render.com](https://render.com).
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repository.
5. **Runtime**: Select **Docker**.
6. **Instance Type**: Select **Free**.
7. Click **Create Web Service**.
8. **Copy the URL** Render gives you (e.g., `https://yt-converter-123.onrender.com`).

---

## Part 2: Configure Netlify (Frontend)

1. Open `netlify.toml` in your project.
2. Update the `to = "..."` line with your **Render URL**.
   ```toml
   to = "https://yt-converter-123.onrender.com/api/:splat"
   ```
3. Commit and push: `git push`
4. Deploy to Netlify (Import from Git -> Select Repo -> Deploy).

---

## ⚠️ Troubleshooting: "Sign in to confirm you’re not a bot"

If you see this error, YouTube is blocking the generic Server IP. You MUST provide your "Cookies" to prove you are a human.

### How to fix it (The Cookie Method):

1.  **Get your Cookies**:
    *   Install the plugin **"Get cookies.txt LOCALLY"** for Chrome or Firefox.
    *   Log into YouTube in your browser.
    *   Click the extension icon to download `cookies.txt`.
    *   Open the file and **Copy ALL the text**.

2.  **Add to Render**:
    *   Go to your Render Dashboard -> Select your Service.
    *   Click **Environment** tab.
    *   Click **Add Environment Variable**.
    *   **Key**: `YT_COOKIES`
    *   **Value**: (Paste the entire text from cookies.txt)
    *   Click **Save Changes**.

Render will restart your server. The error should now be gone!
