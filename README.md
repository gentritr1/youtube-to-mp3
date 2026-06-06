# YT Converter | YouTube to MP3/MP4

A Node.js and vanilla JavaScript YouTube converter with themable UI, batch downloads, discovery previews, karaoke-style lyrics, mini-games, and PWA support.

## What It Does

- convert YouTube videos to MP3 or MP4
- queue up to 10 batch conversions
- preview curated music suggestions before converting
- keep lyrics visible in a karaoke panel when subtitles exist
- let users switch themes across the full UI surface
- provide lightweight mini-games while conversions run

## Prerequisites

- Node.js 22
- `yt-dlp`
- `ffmpeg`

```bash
brew install yt-dlp ffmpeg
```

## Installation

```bash
npm install
npm start
```

App URL:
- [http://localhost:3000](http://localhost:3000)

## Configuration

Use `.env.example` as the reference for shell variables or deployment settings.

Key environment variables:

- `PORT`: server port, defaults to `3000`
- `TASK_STORE`: `sqlite` or `memory`, defaults to `sqlite`
- `USE_QUEUE`: set `true` to enable Redis queue initialization
- `REDIS_URL`: Redis connection string for queue mode
- `WATCH_GENRES`: reload genre files during development
- `ALLOWED_ORIGINS`: comma-separated browser origins allowed in production CORS
- `YT_COOKIES`: optional Netscape-format YouTube cookies for restricted videos

Runtime data is intentionally not served as static content. Generated downloads are only available through `/api/download`.

## Testing

```bash
npm test
npm run test:watch
npm run build
```

Use `docs/TESTING_STATUS.md` for transient environment blockers and verification notes.

## Docker

Optional Docker workflow: use these commands for containerized development and CI-style runs; otherwise run the app locally with `npm start`.

```bash
npm run docker:build
npm run docker:test
npm run docker:up
npm run preflight
```

## Architecture

The app uses:

- Node.js + Express on the backend
- vanilla JavaScript feature modules on the frontend
- themed CSS tokens and component styles
- yt-dlp + ffmpeg for media processing
- SQLite-backed task persistence

## Canonical Docs

Use these docs in this order:

- [docs/CODEBASE_GUIDE.md](docs/CODEBASE_GUIDE.md)
  - main technical guide
  - architecture, ownership boundaries, theming rules, and feature workflow
- [docs/TESTING_STATUS.md](docs/TESTING_STATUS.md)
  - current build/test status
  - transient environment blockers
  - troubleshooting notes

## Project Layout

```text
server/           Express routes, services, middleware, and utilities
js/               Frontend feature modules
js/ui/            Theme, animation, and karaoke controllers
css/base.css      Semantic design tokens
css/themes/       Theme overrides
css/layout/       Layout structure
css/components/   Component-scoped styles
tests/            Vitest suites
```

## Main Commands

```bash
npm start
npm test
npm run test:watch
npm run build
```

## Notes

- The main architecture baseline now lives in `docs/CODEBASE_GUIDE.md`.
- Do not use old planning docs as the source of truth for current structure.
- Keep transient verification notes out of the architecture guide and in `docs/TESTING_STATUS.md`.

## License

MIT
