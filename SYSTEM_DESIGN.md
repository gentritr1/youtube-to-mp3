# YT Converter - System Design Document

## 📋 Table of Contents
1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Project Structure](#project-structure)
4. [Component Breakdown](#component-breakdown)
5. [Data Flow](#data-flow)
6. [Current Strengths](#current-strengths)
7. [Improvement Recommendations](#improvement-recommendations)

---

## 🎯 Overview

**YT Converter** is a full-stack web application that converts YouTube videos to MP3/MP4 format. It features:
- A modern, animated frontend with skeleton loaders and orchestrated animations
- A Node.js/Express backend that wraps `yt-dlp` for video processing
- Task-based async processing with progress polling
- A built-in Snake game to entertain users during conversion

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | Vanilla HTML/CSS/JS (ES6+) |
| Backend | Node.js + Express |
| Video Processing | yt-dlp + ffmpeg |
| Deployment | Docker, Render, Netlify |

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  index.html  │  │   app.js     │  │    CSS       │  │  Snake Game  │ │
│  │  (Structure) │  │  (Logic)     │  │  (Styling)   │  │  (Easter Egg)│ │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  └──────────────┘ │
│         │                 │                                              │
│         └────────┬────────┘                                              │
│                  │ REST API Calls                                        │
└──────────────────┼──────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          SERVER (Node.js + Express)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         server/index.js                          │    │
│  │                    (Entry Point + Middleware)                    │    │
│  └─────────────────────────┬───────────────────────────────────────┘    │
│                            │                                             │
│  ┌─────────────────────────┴───────────────────────────────────────┐    │
│  │                         ROUTES (/api/*)                          │    │
│  ├────────────┬────────────┬────────────┬────────────┬─────────────┤    │
│  │   /info    │  /convert  │ /progress  │ /download  │   index     │    │
│  │  (GET)     │   (POST)   │   (GET)    │   (GET)    │  (router)   │    │
│  └─────┬──────┴─────┬──────┴─────┬──────┴─────┬──────┴─────────────┘    │
│        │            │            │            │                          │
│  ┌─────┴────────────┴────────────┴────────────┴────────────────────┐    │
│  │                           SERVICES                               │    │
│  ├──────────────────────────────┬──────────────────────────────────┤    │
│  │         ytdlp.js             │         taskManager.js           │    │
│  │  • getVideoInfo()            │  • createTask() / getTask()      │    │
│  │  • convertVideo()            │  • updateTask() / findExisting() │    │
│  │  • Retry logic               │  • Persistence (tasks.json)      │    │
│  └──────────────┬───────────────┴──────────────────────────────────┘    │
│                 │                                                        │
│  ┌──────────────┴───────────────────────────────────────────────────┐   │
│  │                           UTILITIES                               │   │
│  ├────────────────┬─────────────────────┬───────────────────────────┤   │
│  │ formatDuration │    parseProgress    │      sanitize.js          │   │
│  │  (time helper) │  (yt-dlp output)    │  (filename safety)        │   │
│  └────────────────┴─────────────────────┴───────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL DEPENDENCIES                            │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │    yt-dlp    │  │    ffmpeg    │  │   YouTube    │                   │
│  │  (downloader)│  │  (converter) │  │   (source)   │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
youtube-to-mp3/
├── 📄 index.html              # Main HTML (single page)
├── 📄 app.js                  # Frontend logic (12KB)
├── 📄 style.css               # Legacy styles (minimal)
├── 📄 game.css                # Snake game styles
│
├── 📁 css/                    # Modular CSS architecture
│   ├── base.css               # CSS variables, resets
│   ├── animations.css         # Keyframes, transitions
│   ├── components/
│   │   ├── form.css           # Input, buttons
│   │   └── results.css        # Preview, download, skeleton
│   ├── layout/
│   │   └── main.css           # Container, grid
│   └── utils/
│       └── helpers.css        # Utility classes
│
├── 📁 js/                     # Frontend modules
│   ├── snake-game.js          # Full snake game (38KB!)
│   └── game/                  # Snake game components
│
├── 📁 server/                 # Backend (Express)
│   ├── index.js               # Server entry point
│   ├── config.js              # Centralized config
│   ├── middleware/
│   │   └── errorHandler.js    # Error middleware
│   ├── routes/
│   │   ├── index.js           # Route aggregator
│   │   ├── info.js            # GET /api/info
│   │   ├── convert.js         # POST /api/convert
│   │   ├── progress.js        # GET /api/progress/:taskId
│   │   └── download.js        # GET /api/download/:taskId/:filename
│   ├── services/
│   │   ├── ytdlp.js           # yt-dlp wrapper (core logic)
│   │   └── taskManager.js     # Task CRUD + persistence
│   └── utils/
│       ├── formatDuration.js  # Time formatting
│       ├── parseProgress.js   # Parse yt-dlp output
│       └── sanitize.js        # Filename sanitization
│
├── 📁 downloads/              # Temp file storage (gitignored)
├── 📄 tasks.json              # Task persistence
├── 📄 Dockerfile              # Container build
├── 📄 package.json            # Dependencies
└── 📄 README.md               # Documentation
```

---

## 🔧 Component Breakdown

### Frontend Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **URL Input** | `index.html`, `app.js` | Accepts YouTube URL, validates with regex |
| **Format Toggle** | `index.html`, `app.js` | MP3/MP4 selection with animated icons |
| **Preview** | `app.js`, `results.css` | Shows video thumbnail, title, duration |
| **Skeleton Loader** | `results.css` | Shimmer placeholders during loading |
| **Progress Bar** | `app.js`, `results.css` | Real-time conversion progress |
| **Download Section** | `app.js`, `results.css` | Orchestrated success animation |
| **Snake Game** | `snake-game.js` | Entertainment during wait |

### Backend Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **Express Server** | `server/index.js` | HTTP server, static files, cleanup scheduler |
| **Config** | `server/config.js` | Centralized environment settings |
| **Info Route** | `routes/info.js` | Fetch video metadata via yt-dlp |
| **Convert Route** | `routes/convert.js` | Start async conversion task |
| **Progress Route** | `routes/progress.js` | Poll task status |
| **Download Route** | `routes/download.js` | Serve converted file |
| **yt-dlp Service** | `services/ytdlp.js` | Wrapper with retry logic |
| **Task Manager** | `services/taskManager.js` | In-memory + JSON persistence |

---

## 🔄 Data Flow

### Conversion Flow (Happy Path)

```
1. USER → Paste YouTube URL
         ↓
2. FRONTEND → Validate URL (regex)
         ↓
3. FRONTEND → POST /api/convert { videoId, format, title }
         ↓
4. BACKEND → Check for existing task (idempotency)
         ↓
5. BACKEND → Create task { state: 'processing', progress: 0 }
         ↓
6. BACKEND → Spawn yt-dlp process (async)
         ↓
7. FRONTEND → Poll GET /api/progress/:taskId (every 1s)
         ↓
8. BACKEND → Parse yt-dlp stdout → Update task progress
         ↓
9. BACKEND → On complete: state: 'completed', downloadUrl
         ↓
10. FRONTEND → Show orchestrated success animation
         ↓
11. USER → Click Download → GET /api/download/:taskId/:filename
         ↓
12. BACKEND → res.download() → File sent to browser
```

### State Transitions

```
           ┌─────────────────┐
           │   processing    │
           └────────┬────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│  completed   │        │    error     │
└──────────────┘        └──────────────┘
```

---

## ✅ Current Strengths

### 1. **Clean Separation of Concerns**
- Routes only handle HTTP, services contain business logic
- CSS is modular (base, components, layout, utils)
- Config is centralized

### 2. **Idempotency**
- Duplicate requests for same video/format reuse existing tasks
- Prevents wasted resources

### 3. **Resilience**
- Retry logic for yt-dlp (cookies fallback)
- oEmbed fallback if backend unreachable
- Graceful error handling

### 4. **User Experience**
- Skeleton loaders prevent layout shift
- Orchestrated animations feel premium
- Snake game reduces perceived wait time

### 5. **Deployability**
- Docker support
- Environment-based config
- Render/Netlify ready

---

## 🚀 Improvement Recommendations

### High Priority

| Area | Issue | Recommendation |
|------|-------|----------------|
| **Memory** | Tasks stored in-memory, lost on restart | Use Redis or SQLite for task persistence |
| **Scalability** | Single-threaded Node.js | Add worker threads or use a job queue (Bull/BullMQ) |
| **Security** | No rate limiting | Add `express-rate-limit` (e.g., 10 conversions/hour/IP) |
| **File Cleanup** | Files persist for 1 hour | Add on-download cleanup or shorter TTL |

### Medium Priority

| Area | Issue | Recommendation |
|------|-------|----------------|
| **Error Tracking** | Console.log only | Add Sentry or LogRocket |
| **Tests** | Tests folder exists but sparse | Add Jest/Mocha tests for services |
| **Type Safety** | Plain JavaScript | Consider TypeScript migration |
| **API Docs** | No documentation | Add OpenAPI/Swagger spec |

### Low Priority / Nice-to-Have

| Feature | Description |
|---------|-------------|
| **Popular Videos** | Add curated music suggestions by genre |
| **Audio Preview** | Play a 30s clip before downloading |
| **Batch Downloads** | Convert multiple videos at once |
| **PWA Support** | Add service worker for offline capability |
| **Dark/Light Toggle** | User preference for theme |

### Architecture Improvements

```
Current:                         Recommended:
┌─────────┐                     ┌─────────┐
│ Express │                     │ Express │
│ + Tasks │                     │   API   │
└────┬────┘                     └────┬────┘
     │                               │
     │                          ┌────┴────┐
     ▼                          ▼         ▼
┌─────────┐               ┌─────────┐ ┌───────┐
│ yt-dlp  │               │  Redis  │ │ Queue │
│ inline  │               │  Cache  │ │ (Bull)│
└─────────┘               └─────────┘ └───┬───┘
                                          │
                                     ┌────┴────┐
                                     │ Worker  │
                                     │ Process │
                                     └────┬────┘
                                          │
                                     ┌────┴────┐
                                     │ yt-dlp  │
                                     └─────────┘
```

---

## 📊 Metrics to Track

| Metric | Why |
|--------|-----|
| Conversion success rate | Detect yt-dlp blocks |
| Average conversion time | Performance baseline |
| Concurrent conversions | Capacity planning |
| Error types | Identify common failures |
| Popular video IDs | Caching opportunities |

---

## 🎯 Summary

**YT Converter** is a well-structured, production-ready application with clean code architecture and thoughtful UX. The main areas for improvement are around **scalability** (job queues), **observability** (error tracking), and **security** (rate limiting).

The modular CSS and separated backend concerns make it easy to maintain and extend. Great foundation! 🏆

---

*Generated: 2026-01-29*
