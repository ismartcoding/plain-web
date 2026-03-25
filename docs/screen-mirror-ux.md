# Screen Mirror UX Design

## Overview

Redesigned the Screen Mirror page for a friendlier first-use experience. Instead of auto-starting mirroring on page load, users see a clean welcome screen with a prominent call-to-action button.

## Design Goals

- **No auto-start**: Don't initiate screen mirroring immediately on page load.
- **Clear call-to-action**: Large, centered circular button so users start mirroring intentionally.
- **Simple messaging**: Brief text explaining what the feature does.
- **Clean layout**: Minimalist design that feels approachable for non-technical users.
- **Auto-reconnect**: If mirroring is already active on the server (e.g., user navigated away and came back), reconnect automatically without showing the idle screen.

## User Flow

```
User navigates to Screen Mirror
        │
  Query server for mirror state
     │                  │
 Not running       Already running
     │                  │
 Show idle screen   Auto-reconnect
 (big start button)  via WebRTC
     │
 User taps button
     │
 Start mirror service
     │
 30s permission countdown
 (tap phone prompt)
     │
 Permission granted → mirroring
 Timeout → failure → retry
     │
 User stops → back to idle screen
```

## UI States

### 1. Idle (Welcome Screen)
- Centered layout with vertical stack
- Large circular primary-colored button (120px) with cast icon
- Title: "Screen Mirror"
- Subtitle: "Tap to mirror your phone screen"
- Button hover: scale up + deeper shadow

### 2. Loading
- Centered circular progress spinner (unchanged)

### 3. Permission Countdown
- Phone tap SVG illustration (160px, primary color)
- Title: "Waiting for Permission"
- Hint: "Tap 'Start now' on your phone to allow screen capture."
- Large countdown number (2rem, primary color, e.g. "28s")
- Clean vertical stack layout

### 4. Failed
- Phone warning SVG illustration (160px, muted color)
- Title: "Permission Not Granted"
- Hint: "The screen capture permission was not granted in time."
- "Try Again" filled button

### 5. Mirroring
- Full-height video with optional control overlay (unchanged)
- Header shows playback controls, quality menu, recording, etc.

## State Management

New `idle` ref in `screen-mirror-service.ts`:
- Starts as `true`
- Set to `true` when server reports mirror not running, or after user stops mirroring
- Set to `false` when user clicks start or when server reports mirror is already running

## Files Changed

- `src/hooks/screen-mirror-service.ts` — Added `idle` state; removed auto-start on initial query
- `src/hooks/use-screen-mirror-view.ts` — Pass `idle` state through
- `src/views/ScreenMirrorView.vue` — Pass `idle` prop to child components
- `src/components/screen-mirror/ScreenMirrorContent.vue` — Added idle screen UI with start button
- `src/components/screen-mirror/ScreenMirrorHeaderActions.vue` — Hide actions during idle state
