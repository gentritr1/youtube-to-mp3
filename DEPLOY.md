# How to Deploy YT Converter

Because this application uses **FFmpeg** and **yt-dlp** (system-level tools), it cannot be hosted entirely on standard static hosting (like Netlify Free Tier) in a single piece. 

You need a Server or Docker container for the backend processing.

We recommend a **Hybrid Deployment**:
1. **Frontend** on **Netlify** (Fast, standard web hosting)
2. **Backend** on **Render** (Free tier available, supports Docker)

---

## Step 1: Deploy Backend to Render

1. Create a [GitHub repository](https://github.com/new) and push your code.
2. Sign up for [Render.com](https://render.com).
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repository.
5. Select **Docker** as the Runtime (it will automatically find the `Dockerfile` we created).
6. Pick the **Free** instance type.
7. Click **Create Web Service**.
8. Wait for the build to finish. Render will give you a URL like `https://yt-converter-123.onrender.com`.
   - **Copy this URL.**

---

## Step 2: Configure Netlify

1. Open `netlify.toml` in your project.
2. Find the `[redirects]` section.
3. Replace the placeholder URL with your **Render URL** from Step 1.
   
   ```toml
   # Example
   to = "https://yt-converter-123.onrender.com/api/:splat"
   ```
4. Commit and push this change to GitHub.

---

## Step 3: Deploy Frontend to Netlify

1. Sign up for [Netlify](https://netlify.com).
2. Click **Add new site** -> **Import from existing project**.
3. Connect Git Provider -> GitHub.
4. Select your repository.
5. In "Build settings":
   - **Build command**: (Leave empty)
   - **Publish directory**: `.` (Dot, meaning current directory)
6. Click **Deploy**.

**That's it!** 
- Your users visit the Netlify URL.
- When they click "Convert", Netlify proxies the request to your Render server.
- The Render server processes the video and returns the download.
