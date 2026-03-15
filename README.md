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

- Node.js
- `yt-dlp`
- `ffmpeg`

```bash
brew install yt-dlp ffmpeg
```

## Local Setup

```bash
npm install
npm start
```

App URL:
- [http://localhost:3000](http://localhost:3000)

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

Docker helpers:

```bash
npm run docker:build
npm run docker:test
npm run docker:up
npm run preflight
```

## Notes

- The main architecture baseline now lives in `docs/CODEBASE_GUIDE.md`.
- Do not use old planning docs as the source of truth for current structure.
- Keep transient verification notes out of the architecture guide and in `docs/TESTING_STATUS.md`.

## License

MIT
