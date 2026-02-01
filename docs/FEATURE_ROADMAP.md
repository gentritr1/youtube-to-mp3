# Feature Roadmap: Popular Videos & Audio Preview

**Branch:** `feature/popular-videos-audio-preview`  
**Priority:** Low  
**Status:** Planning  
**Created:** 2026-02-01

---

## Overview

This branch contains two enhancement features designed to improve user experience and music discovery. Both features are marked as **low priority** to allow for iterative refinement before integration.

---

## Feature 1: Popular Videos (Curated Music Suggestions by Genre)

### Description
Add a curated music suggestions section that displays popular videos organized by genre, helping users discover trending music.

### Requirements
- [ ] Create genre categories (Pop, Hip-Hop, Rock, Electronic, Jazz, Classical, etc.)
- [ ] Implement YouTube API integration for fetching trending music videos by genre
- [ ] Design responsive UI cards for displaying video suggestions
- [ ] Add caching layer to reduce API calls
- [ ] Implement click-to-convert functionality for suggested videos

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
- [ ] Implement server-side audio extraction for preview generation
- [ ] Create audio player component with waveform visualization
- [ ] Add play/pause/seek controls
- [ ] Handle preview caching and cleanup
- [ ] Implement loading states and error handling

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

### Phase 1: Foundation
- [ ] Set up API routes for genre-based video fetching
- [ ] Create preview generation endpoint
- [ ] Design shared UI components

### Phase 2: Popular Videos
- [ ] Implement genre selection UI
- [ ] Build video card components
- [ ] Add carousel navigation
- [ ] Integrate with conversion flow

### Phase 3: Audio Preview
- [ ] Build audio player component
- [ ] Implement waveform visualization
- [ ] Add preview generation logic
- [ ] Handle caching and cleanup

### Phase 4: Polish
- [ ] Performance optimization
- [ ] Accessibility improvements
- [ ] Mobile responsiveness
- [ ] User testing and feedback

---

## Notes

> **Low Priority Rationale:**  
> These features enhance UX but are not core to the application's primary function (YouTube to MP3 conversion). They should be refined based on user feedback and resource availability.

---

## Related Files
- `src/routes/` - API endpoints (to be created)
- `public/js/` - Frontend components (to be created)
- `css/` - Styling (to be extended)
