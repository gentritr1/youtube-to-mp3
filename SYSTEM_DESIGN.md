# YT Converter - System Design Document

## 📋 Table of Contents
1. [Overview](#-overview)
2. [Architecture Diagram](#%EF%B8%8F-architecture-diagram)
3. [Project Structure](#-project-structure)
4. [Component Breakdown](#-component-breakdown)
5. [Data Flow](#-data-flow)
6. [Security & Rate Limiting](#-security--rate-limiting)
7. [Persistence & Scalability](#-persistence--scalability)
8. [Testing](#-testing)
9. [Future Improvements](#-future-improvements)

---

## 🎯 Overview

**YT Converter** is a full-stack web application that converts YouTube videos to MP3/MP4 format. It features:
- A modern, animated frontend with skeleton loaders and orchestrated animations
- A Node.js/Express backend that wraps `yt-dlp` for video processing
- **SQLite-based task persistence** that survives server restarts
- **Rate limiting** to prevent abuse
- **Optional Redis job queue** for horizontal scaling
- Task-based async processing with progress polling
- A built-in Snake game to entertain users during conversion

### Tech Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | Vanilla HTML/CSS/JS (ES6+) |
| Backend | Node.js + Express |
| Persistence | SQLite (better-sqlite3) |
| Queue (optional) | Bull + Redis |
| Rate Limiting | express-rate-limit |
| Video Processing | yt-dlp + ffmpeg |
| Deployment | Docker, Render, Netlify |

---

## 🏗️ Architecture Diagram

```text
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
│  │                      MIDDLEWARE LAYER                            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │    │
│  │  │ Rate Limiter │  │    CORS      │  │ Error Handler│           │    │
│  │  │ (per-route)  │  │              │  │              │           │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │    │
│  └─────────────────────────┬───────────────────────────────────────┘    │
│                            │                                             │
│  ┌─────────────────────────┴───────────────────────────────────────┐    │
│  │                         ROUTES (/api/*)                          │    │
│  ├────────────┬────────────┬────────────┬────────────┬─────────────┤    │
│  │   /info    │  /convert  │ /progress  │ /download  │  /health    │    │
│  │ 30/min     │  10/hour   │  (no limit)│  20/10min  │  (stats)    │    │
│  └─────┬──────┴─────┬──────┴─────┬──────┴─────┬──────┴─────────────┘    │
│        │            │            │            │                          │
│  ┌─────┴────────────┴────────────┴────────────┴────────────────────┐    │
│  │                           SERVICES                               │    │
│  ├──────────────────┬────────────────────┬─────────────────────────┤    │
│  │    ytdlp.js      │ sqliteTaskManager  │     jobQueue.js         │    │
│  │  • getVideoInfo  │ • SQLite CRUD      │  • Bull + Redis         │    │
│  │  • convertVideo  │ • WAL mode         │  • Fallback to direct   │    │
│  │  • Retry logic   │ • Prepared stmts   │  • Graceful shutdown    │    │
│  └──────────────────┴────────────────────┴─────────────────────────┘    │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                         DATA LAYER                                │   │
│  ├──────────────────────────────┬───────────────────────────────────┤   │
│  │        tasks.db              │         downloads/                 │   │
│  │   (SQLite + WAL mode)        │    (temp file storage)            │   │
│  └──────────────────────────────┴───────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL DEPENDENCIES                            │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │    yt-dlp    │  │    ffmpeg    │  │   YouTube    │  │ Redis (opt)  │ │
│  │  (downloader)│  │  (converter) │  │   (source)   │  │  (job queue) │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```text
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
│   ├── index.js               # Server entry point + graceful shutdown
│   ├── config.js              # Centralized config (rate limits, queue, etc.)
│   ├── middleware/
│   │   ├── errorHandler.js    # Error middleware
│   │   └── rateLimiter.js     # ✨ Rate limiting (per-route)
│   ├── routes/
│   │   ├── index.js           # Route aggregator + rate limit bindings
│   │   ├── info.js            # GET /api/info (30/min)
│   │   ├── convert.js         # POST /api/convert (10/hour)
│   │   ├── progress.js        # GET /api/progress/:taskId
│   │   └── download.js        # GET /api/download/:taskId/:filename
│   ├── services/
│   │   ├── ytdlp.js           # yt-dlp wrapper (core logic)
│   │   ├── taskManager.js     # Legacy in-memory tasks
│   │   ├── sqliteTaskManager.js  # ✨ SQLite persistence
│   │   └── jobQueue.js        # ✨ Bull + Redis queue
│   └── utils/
│       ├── formatDuration.js  # Time formatting
│       ├── parseProgress.js   # Parse yt-dlp output
│       └── sanitize.js        # Filename sanitization
│
├── 📁 tests/                  # ✨ Test suite
│   ├── config.test.js         # Config tests (19 tests)
│   ├── rateLimiter.test.js    # Rate limiter tests (6 tests)
│   ├── jobQueue.test.js       # Job queue tests (10 tests)
│   └── sqliteTaskManager.test.js  # SQLite tests
│
├── 📁 downloads/              # Temp file storage (gitignored)
├── 📄 tasks.db                # SQLite database (gitignored)
├── 📄 Dockerfile              # Container build
├── 📄 package.json            # Dependencies
├── 📄 SYSTEM_DESIGN.md        # This document
└── 📄 README.md               # User documentation
```

---

## 🔧 Component Breakdown

### Frontend Components

| Component | File | Responsibility |
| :--- | :--- | :--- |
| **URL Input** | `index.html`, `app.js` | Accepts YouTube URL, validates with regex |
| **Format Toggle** | `index.html`, `app.js` | MP3/MP4 selection with animated icons |
| **Preview** | `app.js`, `results.css` | Shows video thumbnail, title, duration |
| **Skeleton Loader** | `results.css` | Shimmer placeholders during loading |
| **Progress Bar** | `app.js`, `results.css` | Real-time conversion progress |
| **Download Section** | `app.js`, `results.css` | Orchestrated success animation |
| **Snake Game** | `snake-game.js` | Entertainment during wait |

### Backend Components

| Component | File | Responsibility |
| :--- | :--- | :--- |
| **Express Server** | `server/index.js` | HTTP server, middleware, graceful shutdown |
| **Config** | `server/config.js` | Centralized settings (rate limits, queue, paths) |
| **Rate Limiter** | `middleware/rateLimiter.js` | Per-route rate limiting |
| **Info Route** | `routes/info.js` | Fetch video metadata via yt-dlp |
| **Convert Route** | `routes/convert.js` | Start async conversion task |
| **Progress Route** | `routes/progress.js` | Poll task status |
| **Download Route** | `routes/download.js` | Serve converted file |
| **yt-dlp Service** | `services/ytdlp.js` | Wrapper with retry logic |
| **SQLite Task Manager** | `services/sqliteTaskManager.js` | Persistent task storage |
| **Job Queue** | `services/jobQueue.js` | Optional Redis-backed queue |

---

## 🔒 Security & Rate Limiting

### Rate Limits by Endpoint

| Endpoint | Limit | Window | Purpose |
| :--- | :--- | :--- | :--- |
| All API routes | 100 requests | 15 minutes | General abuse prevention |
| `/api/info` | 30 requests | 1 minute | Prevent metadata scraping |
| `/api/convert` | **10 conversions** | **1 hour** | Prevent resource abuse |
| `/api/download` | 20 downloads | 10 minutes | Prevent DoS |
| `/health` | No limit | - | Monitoring endpoint |

### Implementation Details
- Uses `express-rate-limit` package
- Trust proxy enabled for Render/reverse proxy environments
- Rate limit headers included in responses (`RateLimit-*`)
- Custom error messages with retry time

### Health Check Endpoint

```text
GET /health
```

Returns:

```json
{
  "status": "healthy",
  "timestamp": "2026-01-29T17:00:00Z",
  "uptime": 3600,
  "queue": { "enabled": false, "message": "Redis not connected" },
  "memory": { "used": "45MB", "total": "80MB" }
}
```

---

## 💾 Persistence & Scalability

### SQLite Task Persistence

Tasks are now stored in an SQLite database (`tasks.db`) that survives server restarts.

**Features:**
- WAL mode for better concurrency
- Prepared statements for performance
- Indexed on `video_id`, `format`, `state`
- Automatic cleanup of old tasks (1 hour TTL)

**Schema:**

```sql
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    format TEXT NOT NULL,
    state TEXT DEFAULT 'processing',
    progress INTEGER DEFAULT 0,
    filename TEXT,
    download_url TEXT,
    error TEXT,
    created_at INTEGER,
    updated_at INTEGER
);
```

### Job Queue (Optional)

When Redis is available and `USE_QUEUE=true`:
- Jobs processed via Bull queue
- Configurable concurrency (default: 2 parallel jobs)
- Retry logic with exponential backoff
- Job progress tracking

**Fallback:** When Redis is unavailable, falls back to direct processing (current behavior).

---

## 🧪 Testing

### Test Suite

Run tests with:

```bash
npm run test:node
```

| Test File | Tests | Coverage |
| :--- | :--- | :--- |
| `config.test.js` | 19 | All config settings |
| `rateLimiter.test.js` | 6 | Middleware exports, behavior |
| `jobQueue.test.js` | 10 | Queue API, disabled state, Redis fallback |
| `sqliteTaskManager.test.js` | 10+ | CRUD, idempotency, cleanup |

### Total: 45+ tests

---

## 🔄 Data Flow

### Conversion Flow (Happy Path)

```text
1. USER → Paste YouTube URL
         ↓
2. FRONTEND → Validate URL (regex)
         ↓
3. FRONTEND → POST /api/convert { videoId, format, title }
         ↓
      ┌─────────────────────────────────────────┐
      │         RATE LIMIT CHECK (10/hour)       │
      └─────────────────────────────────────────┘
         ↓
4. BACKEND → Check for existing task in SQLite (idempotency)
         ↓
5. BACKEND → Create task in SQLite { state: 'processing', progress: 0 }
         ↓
6. BACKEND → Spawn yt-dlp process (or queue job if Redis available)
         ↓
7. FRONTEND → Poll GET /api/progress/:taskId (every 1s)
         ↓
8. BACKEND → Parse yt-dlp stdout → Update task progress in SQLite
         ↓
9. BACKEND → On complete: state: 'completed', downloadUrl
         ↓
10. FRONTEND → Show orchestrated success animation
         ↓
11. USER → Click Download → GET /api/download/:taskId/:filename
         ↓
12. BACKEND → res.download() → File sent to browser
```

---

## 🚀 Future Improvements

### Now Implemented ✅

- [x] SQLite task persistence
- [x] Rate limiting
- [x] Job queue infrastructure (Bull)
- [x] Health check endpoint
- [x] Graceful shutdown
- [x] Test suite

### Medium Priority

| Area | Issue | Recommendation |
| :--- | :--- | :--- |
| **Error Tracking** | Console.log only | Add Sentry or LogRocket |
| **Type Safety** | Plain JavaScript | Consider TypeScript migration |
| **API Docs** | No documentation | Add OpenAPI/Swagger spec |

### Low Priority / Nice-to-Have

| Feature | Description |
| :--- | :--- |
| **Popular Videos** | Add curated music suggestions by genre |
| **Audio Preview** | Play a 30s clip before downloading |
| **Batch Downloads** | Convert multiple videos at once |
| **PWA Support** | Add service worker for offline capability |
| **Dark/Light Toggle** | User preference for theme |

---

## 📊 Metrics to Track

| Metric | Why |
| :--- | :--- |
| Conversion success rate | Detect yt-dlp blocks |
| Average conversion time | Performance baseline |
| Rate limit hits | Abuse detection |
| Queue depth (if Redis) | Capacity planning |
| Error types | Identify common failures |

---

## 🎯 Summary

**YT Converter** is a production-ready application with:

| Feature | Status |
| :--- | :--- |
| Clean architecture | ✅ |
| SQLite persistence | ✅ |
| Rate limiting | ✅ |
| Job queue (optional) | ✅ |
| Health monitoring | ✅ |
| Test coverage | ✅ |
| Graceful shutdown | ✅ |

The modular design makes it easy to maintain and extend. Ready for production deployment! 🏆

---

*Updated: 2026-01-29*
