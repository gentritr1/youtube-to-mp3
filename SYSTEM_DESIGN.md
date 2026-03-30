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
| Backend | Node.js + Express (TypeScript) |
| Persistence | SQLite (better-sqlite3) |
| Queue (optional) | Bull + Redis |
| Rate Limiting | express-rate-limit |
| Video Processing | yt-dlp + ffmpeg |
| Deployment | Docker, Render, Netlify |

### Deployment Considerations
- **Dockerfile Updates**: Whenever a new feature is added, especially one involving new system dependencies or build steps, ONLY the Dockerfile must be updated to reflect these changes.
- **Dependencies**: Ensure all new npm packages or system libraries (e.g., via `apt-get` or `apk`) are included in the container build.

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
│  │    ytdlp.ts      │ sqliteTaskManager  │     jobQueue.ts         │    │
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
│   ├── features.js            # Popular videos & audio preview module
│   └── game/                  # Snake game components
│
├── 📁 server/                 # Backend (Express)
│   ├── index.ts               # Server entry point + graceful shutdown
│   ├── config.ts              # Centralized config (rate limits, queue, etc.)
│   ├── middleware/
│   │   ├── errorHandler.ts    # Error middleware
│   │   └── rateLimiter.ts     # ✨ Rate limiting (per-route)
│   ├── routes/
│   │   ├── index.ts           # Route aggregator + rate limit bindings
│   │   ├── info.ts            # GET /api/info (30/min)
│   │   ├── convert.ts         # POST /api/convert (10/hour)
│   │   ├── progress.ts        # GET /api/progress/:taskId
│   │   ├── download.ts        # GET /api/download/:taskId/:filename
│   │   ├── batchConvert.ts    # ✨ POST /api/batch-convert (batch downloads)
│   │   ├── batchProgress.ts   # ✨ GET /api/batch-progress/:batchId
│   ├── services/
│   │   ├── ytdlp.ts           # yt-dlp wrapper (core logic)
│   │   ├── taskStore.ts       # Canonical task persistence facade
│   │   ├── sqliteTaskManager.ts  # SQLite persistence primitives
│   │   ├── sqliteTaskAdapter.ts  # SQLite task-store adapter
│   │   ├── memoryTaskAdapter.ts  # In-memory contingency adapter
│   │   ├── jobQueue.ts        # ✨ Bull + Redis queue
│   │   └── batchService.ts    # ✨ Batch download orchestration
│   └── utils/
│       ├── formatDuration.ts  # Time formatting
│       ├── parseProgress.ts   # Parse yt-dlp output
│       └── sanitize.ts        # Filename sanitization
│
├── 📁 tests/                  # ✨ Test suite
│   ├── config.test.ts         # Config tests (19 tests)
│   ├── rateLimiter.test.ts    # Rate limiter tests (6 tests)
│   ├── jobQueue.test.ts       # Job queue tests (10 tests)
│   ├── sqliteTaskManager.test.ts  # SQLite tests
│   ├── taskStore.test.ts      # Task-store facade tests
│   └── batchService.test.ts   # ✨ Batch service tests (18 tests)
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
| **Popular Videos** | `features.js`, `features.css` | Curated music suggestions by genre |
| **Audio Preview** | `features.js`, `features.css` | 30-second audio preview with waveform |
| **Batch Downloads** | `batch.js`, `batch.css` | Multi-video queue with animated UI |

### Backend Components

| Component | File | Responsibility |
| :--- | :--- | :--- |
| **Express Server** | `server/index.ts` | HTTP server, middleware, graceful shutdown |
| **Config** | `server/config.ts` | Centralized settings (rate limits, queue, paths) |
| **Rate Limiter** | `server/middleware/rateLimiter.ts` | Per-route rate limiting |
| **Info Route** | `server/routes/info.ts` | Fetch video metadata via yt-dlp |
| **Convert Route** | `server/routes/convert.ts` | Start async conversion task |
| **Progress Route** | `server/routes/progress.ts` | Poll task status |
| **Download Route** | `server/routes/download.ts` | Serve converted file |
| **Batch Convert Route** | `server/routes/batchConvert.ts` | Create batch with multiple videos |
| **Batch Progress Route** | `server/routes/batchProgress.ts` | Poll batch status |
| **yt-dlp Service** | `server/services/ytdlp.ts` | Wrapper with retry logic |
| **SQLite Task Manager** | `server/services/sqliteTaskManager.ts` | Persistent task storage |
| **Job Queue** | `server/services/jobQueue.ts` | Optional Redis-backed queue |
| **Batch Service** | `server/services/batchService.ts` | Batch download orchestration |

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
| `config.test.ts` | 19 | All config settings |
| `rateLimiter.test.ts` | 6 | Middleware exports, behavior |
| `jobQueue.test.ts` | 10 | Queue API, disabled state, Redis fallback |
| `sqliteTaskManager.test.ts` | 10+ | CRUD, idempotency, cleanup |

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
- [x] Backend Type Safety (TypeScript)

### Medium Priority

| Area | Issue | Recommendation |
| :--- | :--- | :--- |
| **Error Tracking** | Console.log only | Add Sentry or LogRocket |
| **API Docs** | No documentation | Add OpenAPI/Swagger spec |

### Implemented ✅

| Feature | Description |
| :--- | :--- |
| **Popular Videos** | Curated music suggestions by genre with carousel UI |
| **Audio Preview** | 30s audio preview with waveform, robust error handling, and graceful state management |
| **Batch Downloads** | Convert up to 10 videos at once with aggregated progress tracking |

### Low Priority / Nice-to-Have

| Feature | Description |
| :--- | :--- |
| **PWA Support** | ✅ Added service worker for offline capability and manifest for installation |
| **Dark/Light Toggle** | User preference for theme |
| **Guess the Track Challenge** | A 5-second trivia mini-game that plays a random snippet from popular feed to win multipliers or unlock secrets |
| **Pomodoro Focus Room** | A distraction-free mode that streams long Lo-Fi links with a minimalist timer and hides conversion UI |
| **Beat-matched Crossfade** | Seamless DJ-style track transitions when switching previews |
| **Automated Lyrics** | Extract subtitle files or fetch lyrics during conversion to show karaoke-style scrolling over the background |

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
| Batch downloads | ✅ |

The modular design makes it easy to maintain and extend. Ready for production deployment! 🏆

---

*Updated: 2026-02-06*
