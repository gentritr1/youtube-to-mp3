# Feature Roadmap: Popular Videos & Audio Preview

**Branch:** `feature/popular-videos-audio-preview`  
**Priority:** Low  
**Status:** ✅ Implemented  
**Created:** 2026-02-01  
**Last Updated:** 2026-02-01

---

## Overview

This branch contains two enhancement features designed to improve user experience and music discovery. Both features are marked as **low priority** to allow for iterative refinement before integration.

---

## Feature 1: Popular Videos (Curated Music Suggestions by Genre)

### Description
Add a curated music suggestions section that displays popular videos organized by genre, helping users discover trending music.

### Requirements
- [x] Create genre categories (Pop, Hip-Hop, Rock, Electronic, Jazz, Classical, etc.)
- [x] Implement YouTube API integration for fetching trending music videos by genre
- [x] Design responsive UI cards for displaying video suggestions
- [x] Add caching layer to reduce API calls
- [x] Implement click-to-convert functionality for suggested videos

### Technical Considerations
- YouTube Data API v3 for fetching video data
- Rate limiting to stay within API quotas
- Local caching with configurable TTL
- Lazy loading for performance

### UI/UX Notes
- Horizontal scrollable carousel per genre
- Thumbnail previews with video title and artist
- Hover effects with quick-action buttons

---

## Feature 2: Audio Preview (30-Second Clip Before Downloading)

### Description
Allow users to play a 30-second preview of the audio before committing to a full download.

### Requirements
- [x] Implement server-side audio extraction for preview generation
- [x] Create audio player component with waveform visualization
- [x] Add play/pause/seek controls with Promise-based playback handling
- [x] Handle preview caching and cleanup
- [x] Implement loading states and error handling
- [x] Add Audio 'error' event listener for graceful failure recovery
- [x] Guard against NaN/invalid audio duration in seek and progress functions
- [x] Reset existing preview before starting new one (prevents audio overlap)

### Technical Considerations
- Use FFmpeg to extract 30-second clips (configurable start time)
- Temporary file storage with automatic cleanup
- Web Audio API for playback
- Consider streaming vs. full clip download

### UI/UX Notes
- Inline audio player below URL input
- Waveform visualization using canvas
- Progress indicator with time display
- Skip to different parts of preview

---

## Implementation Phases

### Phase 1: Foundation ✅
- [x] Set up API routes for genre-based video fetching
- [x] Create preview generation endpoint
- [x] Design shared UI components

### Phase 2: Popular Videos (In Progress)
- [x] Implement genre selection UI
- [x] Build video card components
- [x] Add carousel navigation
- [x] Integrate with conversion flow

### Phase 3: Audio Preview (In Progress)
- [x] Build audio player component
- [x] Implement waveform visualization (placeholder)
- [x] Add preview generation logic
- [x] Handle caching and cleanup

### Phase 4: Robustness (Completed ✅)
- [x] Handle Audio.play() Promise to avoid unhandled rejections
- [x] Add 'error' event listener for audio load/play failures
- [x] Guard against NaN/zero duration in seek and progress updates
- [x] Reset preview state before starting new request (prevents overlap)
- [x] Clamp percentage values to valid ranges for CSS

### Phase 5: Polish (Pending)
- [ ] Performance optimization
- [ ] Accessibility improvements
- [ ] Mobile responsiveness refinement
- [ ] User testing and feedback
- [ ] Replace placeholder waveform with real Web Audio API visualization
- [ ] Add YouTube Data API integration for dynamic popular videos

---

## Notes

> **Low Priority Rationale:**  
> These features enhance UX but are not core to the application's primary function (YouTube to MP3 conversion). They should be refined based on user feedback and resource availability.

---

## Related Files
- `server/routes/` - API endpoints (popular.ts, preview.ts)
- `js/` - Frontend components (features.js)
- `css/` - Styling (components/features.css)
