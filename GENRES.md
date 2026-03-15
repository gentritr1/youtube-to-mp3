# Genre Catalog Guide

The Popular Music and Guess the Track features now load genres from JSON files in [server/data/genres](/Users/gentlegen/Desktop/youtube-to-mp3/server/data/genres).

## How to add a new genre

1. Create a new file in `server/data/genres`, for example `funk.json`.
2. Follow the same structure as [_template.genre.json](/Users/gentlegen/Desktop/youtube-to-mp3/server/data/genres/_template.genre.json).
3. Save the file.

If `WATCH_GENRES=true` is enabled, or you are running in development mode, the server reloads the catalog automatically. Otherwise restart the server.

## File rules

- The genre `id` comes from the filename.
  - `funk.json` becomes `funk`
- Files starting with `_` are ignored.
- Invalid files are skipped and logged, instead of crashing the app.
- `order` controls tab position in the UI.
- `enabled: false` hides a genre without deleting the file.
- `thumbnail` is optional.
  - If omitted, it is derived from `videoId`

## Required shape

```json
{
  "name": "Genre Name",
  "icon": "🎵",
  "color": "#22c55e",
  "description": "Short description shown in the UI.",
  "order": 100,
  "enabled": true,
  "videos": [
    {
      "videoId": "dQw4w9WgXcQ",
      "title": "Track Title",
      "artist": "Artist Name",
      "duration": "3:33",
      "tag": "Optional label"
    }
  ]
}
```

## Video fields

- `videoId`: required
- `title`: required
- `artist`: required
- `duration`: required
- `tag`: optional
- `thumbnail`: optional
- `isLive`: optional boolean

## Notes

- The UI is fully data-driven. If a new file validates, it appears automatically as a new genre tab.
- Guess the Track also reads from this same catalog, so adding tracks here affects both areas.
- The default tab is `global` if `global.json` exists. Otherwise the first loaded genre is used.
