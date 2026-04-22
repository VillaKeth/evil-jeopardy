# Evil Jeopardy² — UI Polish Design Spec

**Date:** 2025-07-17
**Status:** Approved

## Overview

Add classic Jeopardy visual theming, sound effects, animations, a buzz timer, and mobile improvements to the existing Evil Jeopardy² game app. All changes are frontend-only except the buzz timer (requires server-side countdown).

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#0a1744` | Page backgrounds, main panels |
| `--bg-secondary` | `#0d2266` | Board cells, input backgrounds, cards |
| `--bg-gradient` | `linear-gradient(135deg, #0a1744, #0d1f5e, #0a1744)` | Full-page background |
| `--accent` | `#FFE400` | Headings, dollar values, borders, buttons |
| `--accent-dim` | `#FFE40060` | Inactive borders, subtle accents |
| `--text-primary` | `#ffffff` | Player names, body text |
| `--text-secondary` | `rgba(255,255,255,0.7)` | Labels, secondary info |
| `--correct` | `#4CAF50` | Correct answers, positive indicators |
| `--wrong` | `#f44336` | Wrong answers, timer warning |
| `--scoreboard-bg` | `rgba(0,0,0,0.25)` | Scoreboard strip background |
| `--card-bg` | `rgba(0,0,0,0.35)` | Score cards, info panels |

## Typography

| Element | Font | Weight | Size | Extras |
|---------|------|--------|------|--------|
| Title (EVIL JEOPARDY²) | `'Arial Black', 'Trebuchet MS', sans-serif` | 900 | 28px | `letter-spacing: 2px; text-shadow: 2px 2px 0px rgba(0,0,0,0.7)` |
| Category headers | Same family | 900 | 13px | `letter-spacing: 1px; text-shadow: 1px 1px 0px rgba(0,0,0,0.6)` |
| Dollar values | Same family | 900 | 22px | `text-shadow: 2px 2px 0px rgba(0,0,0,0.6)` |
| Score display | `'Arial Black', sans-serif` | 900 | 44px (player), 28px (scoreboard) | `text-shadow: 2px 2px 0px rgba(0,0,0,0.6)` |
| Labels (YOUR SCORE, etc.) | `'Arial Black', sans-serif` | 800 | 11px | `letter-spacing: 2px` |
| Player names | `'Segoe UI', sans-serif` | 700 | 15px | — |
| Body text / UI labels | `'Segoe UI', sans-serif` | 700 | 14px | — |
| Buzz button | `'Arial Black', sans-serif` | 900 | 22px | `letter-spacing: 1px` |
| Timer | `'Arial Black', sans-serif` | 900 | 22px | `text-shadow: 2px 2px 0px rgba(0,0,0,0.6)` |

## Components

### Header Bar
- Background: gradient from `#0d2266` to `#0a1744`
- Bottom border: 3px solid `#FFE400`
- Title left-aligned, round indicator right-aligned

### Game Board (Host)
- 4-column grid with 4px gaps
- Category cells: `--bg-secondary` background, 2px solid `--accent` border
- Value cells: `--bg-secondary` background, 1px solid `--accent-dim` border
- Used cells: `#374785` background, `--accent` at 25% opacity, strikethrough text
- Hover on available cells: brighten border to full `--accent`

### Score Card (Player)
- Background: `--card-bg` with 12px border-radius
- 1px solid `--accent` at 15% opacity border
- Score value in large `--accent` color
- Rank indicator below (🥇🥈🥉 + ordinal)

### Buzz Button (Player)
- Circle: 115px × 115px, `--accent` background, `--bg-primary` text
- Box shadow: `0 0 22px rgba(255,228,0,0.45), 0 0 50px rgba(255,228,0,0.15), inset 0 -3px 6px rgba(0,0,0,0.25)`
- When active: gentle glow pulse animation (1.5s ease-in-out infinite alternate)
- When pressed: scale(0.95) + reduced shadow for tactile feel
- When locked: gray out, remove glow, show "LOCKED" text

### Scoreboard Bar (Host)
- Background: `--scoreboard-bg`
- Top border: 2px solid `--accent` at 25% opacity
- Player names in white, scores in `--accent`
- Flex layout, evenly spaced

### Form Inputs
- Background: `--bg-secondary`
- Border: 2px solid `--accent`
- Text color: white (answers) or `--accent` (wagers)
- Border-radius: 6-8px
- Focused: glow shadow matching `--accent`

### Buttons (JOIN, SUBMIT, etc.)
- Background: `--accent`, text: `--bg-primary`
- Font: Arial Black, weight 900
- Border-radius: 8px
- Box shadow: `0 4px 12px rgba(255,228,0,0.3)`
- Hover: brighten slightly, lift shadow

## Sound Effects

All synthesized via Web Audio API — no external audio files.

| Sound | Trigger | Duration | Description |
|-------|---------|----------|-------------|
| Buzz ding | Player buzzes in | 200ms | Short high-pitched ping (800Hz → 1200Hz sine) |
| Correct chime | Host marks correct | 400ms | Rising two-tone (C5 → E5 sine) |
| Wrong buzzer | Host marks wrong | 500ms | Low harsh buzz (150Hz sawtooth, quick decay) |
| Tick-tock | Each timer second | 100ms | Click sound (short noise burst) |
| Timer warning | Last 3 seconds | 150ms | Louder, higher-pitched tick |
| FJ Think music | Final Jeopardy phase | 30s | Simple repeating melody using sine oscillators |
| Victory fanfare | Game over (winner) | 1.5s | Rising arpeggio (C-E-G-C chord) |

### Sound Module API (`public/js/sounds.js`)
```javascript
export const sounds = {
  buzzDing(),
  correctChime(),
  wrongBuzzer(),
  tick(),
  tickWarning(),
  startFJMusic(),
  stopFJMusic(),
  victoryFanfare()
};
```

## Buzz Timer

### Server Side
- When host opens buzzer (`host-open-buzzer` event), server starts 10-second countdown
- Server emits `timer-update` every second with `{ remaining: N }`
- At 0, server auto-calls `lockQueue()` and broadcasts locked state
- Timer configurable via `BUZZ_TIMER_SECONDS` constant (default 10)

### Client Side (Player)
- Display countdown below buzz button: `⏱ Ns`
- Normal: `--accent` color
- Last 3 seconds: `--wrong` color, CSS pulse animation (scale 1.0 → 1.1)
- At 0: buzz button locks, timer shows `⏱ 0s` in `--wrong`

### Client Side (Host)
- Display countdown in buzzer controls area
- Same color transitions as player view

## Animations

### Score Changes
- On score update: animate from old value to new with CSS counter or JS interval
- Correct: brief green flash on score card (`--correct` border glow, 600ms)
- Wrong: brief red flash (`--wrong` border glow, 600ms)

### Phase Transitions
- Fade out current phase content (opacity 1 → 0, 300ms)
- Fade in new phase content (opacity 0 → 1, 300ms)
- Use CSS `transition` on a wrapper element toggled by class

### Buzz Button
- Active state: glow pulse keyframe animation
  ```css
  @keyframes buzzGlow {
    from { box-shadow: 0 0 22px rgba(255,228,0,0.45); }
    to { box-shadow: 0 0 35px rgba(255,228,0,0.65); }
  }
  ```
- Press: `transform: scale(0.95)` transition (100ms)
- Lock: fade to gray (300ms transition)

### Standings
- When rankings change, rows animate to new positions using CSS `transform: translateY()` with 500ms ease transition
- Brief highlight on the row that moved

## Mobile Responsiveness

### Player View (< 480px)
- Single column layout, everything centered
- Buzz button: full prominence, centered, 115px circle
- Score card: full width, large score text
- Question info: compact but readable
- FJ inputs: full width with generous padding

### Host View
- Primarily designed for desktop/laptop
- Board grid stays 4 columns but cells shrink proportionally
- Scoreboard wraps if needed on narrow screens
- At < 768px: stack controls vertically

### Lobby
- Join form centered, generous touch targets (min 44px height)
- Player list: full width cards

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `public/css/style.css` | Rewrite | Replace current dark theme with Jeopardy theme using CSS custom properties |
| `public/js/sounds.js` | Create | Web Audio API sound effects module |
| `public/js/timer.js` | Create | Client-side timer display logic |
| `public/play.html` | Modify | Add timer display, connect sounds, update markup for new classes |
| `public/host.html` | Modify | Add timer display, connect sounds, update markup for new classes |
| `public/index.html` | Modify | Update markup for Jeopardy lobby theme |
| `server/index.js` | Modify | Add buzz timer countdown logic (setInterval, timer-update event) |

## Non-Goals

- No Google Fonts or external font loading — system fonts only
- No audio file downloads — all sounds synthesized in-browser
- No changes to game logic, scoring, or Socket.IO protocol (except adding `timer-update` event)
- No changes to server architecture
