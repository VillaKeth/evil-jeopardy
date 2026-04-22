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
| `--accent-dim` | `rgba(255,228,0,0.37)` | Inactive borders, subtle accents |
| `--accent-25` | `rgba(255,228,0,0.25)` | Scoreboard borders, used-cell borders |
| `--accent-15` | `rgba(255,228,0,0.15)` | Score card borders, subtle highlights |
| `--text-primary` | `#ffffff` | Player names, body text |
| `--text-secondary` | `rgba(255,255,255,0.7)` | Labels, secondary info |
| `--correct` | `#4CAF50` | Correct answers, positive indicators |
| `--wrong` | `#f44336` | Wrong answers, timer warning |
| `--scoreboard-bg` | `rgba(0,0,0,0.25)` | Scoreboard strip background |
| `--card-bg` | `rgba(0,0,0,0.35)` | Score cards, info panels |

## Typography

| Element | Font | Weight | Size | Extras |
|---------|------|--------|------|--------|
| Title (EVIL JEOPARDY²) | `'Arial Black', 'Trebuchet MS', 'Segoe UI Black', sans-serif` | 900 | 28px | `letter-spacing: 2px; text-shadow: 2px 2px 0px rgba(0,0,0,0.7)` |
| Category headers | Same family | 900 | 13px | `letter-spacing: 1px; text-shadow: 1px 1px 0px rgba(0,0,0,0.6)` |
| Dollar values | Same family | 900 | 22px | `text-shadow: 2px 2px 0px rgba(0,0,0,0.6)` |
| Score display | Same family | 900 | 44px (player), 28px (scoreboard) | `text-shadow: 2px 2px 0px rgba(0,0,0,0.6)` |
| Labels (YOUR SCORE, etc.) | Same family | 800 | 11px | `letter-spacing: 2px` |
| Player names | `'Segoe UI', 'Helvetica Neue', Arial, sans-serif` | 700 | 15px | — |
| Body text / UI labels | `'Segoe UI', 'Helvetica Neue', Arial, sans-serif` | 700 | 14px | — |
| Buzz button | Heading family | 900 | 22px | `letter-spacing: 1px` |
| Timer | Heading family | 900 | 22px | `text-shadow: 2px 2px 0px rgba(0,0,0,0.6)` |

**Font note:** Define as CSS custom properties `--font-heading` and `--font-body`. Arial Black is the target look; Trebuchet MS Bold and Segoe UI Black provide acceptable cross-platform fallbacks. Sans-serif final fallback is always available.

## Components

### Header Bar
- Background: gradient from `#0d2266` to `#0a1744`
- Bottom border: 3px solid `#FFE400`
- Title left-aligned, round indicator right-aligned

### Game Board (Host)
- 4-column grid with 4px gaps
- Category cells: `--bg-secondary` background, 2px solid `--accent` border
- Value cells: `--bg-secondary` background, 1px solid `--accent-dim` border
- Used cells: `#374785` background, `--accent-25` border, strikethrough text
- Hover on available cells: brighten border to full `--accent`

### Score Card (Player + Host Scoreboard)
- Used in: `play.html` score display (`.score-card`), `host.html` scoreboard entries (`.score-entry`)
- Background: `--card-bg` with 12px border-radius
- 1px solid `--accent-15` border
- Score value in large `--accent` color
- Player view: rank indicator below (🥇🥈🥉 + ordinal)
- Host scoreboard: flex row of score entries, each with name + score

### Buzz Button (Player)
- Circle: 115px × 115px, `--accent` background, `--bg-primary` text
- Box shadow: `0 0 22px rgba(255,228,0,0.45), 0 0 50px rgba(255,228,0,0.15), inset 0 -3px 6px rgba(0,0,0,0.25)`
- When active: gentle glow pulse animation (1.5s ease-in-out infinite alternate)
- When pressed: scale(0.95) + reduced shadow for tactile feel
- When locked: `background: #555; color: rgba(255,255,255,0.5); opacity: 0.7`, remove glow, show "LOCKED" text

### Buzz Button State Classes
- `.buzz-active` — glow pulse, clickable
- `.buzz-pressed` — scale(0.95) on :active
- `.buzz-locked` — gray, non-interactive
- `.buzzed` — brief green flash after player's own buzz registers

### Scoreboard Bar (Host)
- Background: `--scoreboard-bg`
- Top border: 2px solid `--accent-25`
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

| Sound | Socket.IO Trigger | View | Duration | Description |
|-------|-------------------|------|----------|-------------|
| Buzz ding | `buzz-update` (new buzz received) | Host | 200ms | Short high-pitched ping (800Hz → 1200Hz sine) |
| Correct chime | `game-state` where score increased after answer phase | Both | 400ms | Rising two-tone (C5 → E5 sine) |
| Wrong buzzer | `game-state` where score decreased after answer phase | Both | 500ms | Low harsh buzz (150Hz sawtooth, quick decay) |
| Tick-tock | `timer-update` (remaining > 3) | Both | 100ms | Click sound (short noise burst) |
| Timer warning | `timer-update` (remaining ≤ 3) | Both | 150ms | Louder, higher-pitched tick |
| FJ Think music | `game-state` where phase === `FINAL_JEOPARDY` | Host | 30s | Simple repeating melody using sine oscillators |
| Victory fanfare | `game-state` where phase === `GAME_OVER` | Host | 1.5s | Rising arpeggio (C-E-G-C chord) |

### Sound Module API (`public/js/sounds.js`)

Loaded via `<script>` tag (not ES modules — matches existing codebase pattern). Exposes `window.Sounds` object.

```javascript
window.Sounds = {
  buzzDing(),      // called in host.html on buzz-update
  correctChime(),  // called on score increase detection
  wrongBuzzer(),   // called on score decrease detection
  tick(),          // called on timer-update (remaining > 3)
  tickWarning(),   // called on timer-update (remaining <= 3)
  startFJMusic(),  // called when phase transitions to FINAL_JEOPARDY
  stopFJMusic(),   // called when phase transitions away from FINAL_JEOPARDY
  victoryFanfare() // called when phase transitions to GAME_OVER
};
```

## Buzz Timer

### Server Side
- When host clicks "Open Buzzer" (emits `host-start-nested-question`), server starts 10-second countdown via `setInterval`
- Server emits `timer-update` to all sockets every second: `{ remaining: N }`
- At 0: server calls `lockQueue()`, emits `timer-update { remaining: 0 }`, broadcasts game state with buzzer locked
- Timer cleared if host manually scores before timer expires (on `host-mark-correct` / `host-mark-wrong`)
- Timer configurable via `BUZZ_TIMER_SECONDS` constant (default 10)
- Store interval ID so it can be cleared on manual lock/score

### Client Side (Player)
- HTML: Add `<div class="buzz-timer" id="buzzTimer">⏱ <span id="countdown"></span>s</div>` below buzz button
- On `timer-update`: update `#countdown` text with `remaining` value
- Normal (remaining > 3): `--accent` color
- Warning (remaining ≤ 3): `--wrong` color, add `.timer-warning` class (CSS pulse: scale 1.0 → 1.1, 0.5s)
- At 0: buzz button gets `.buzz-locked` class, timer shows `⏱ 0s`

### Client Side (Host)
- HTML: Add `<div class="buzz-timer" id="buzzTimer">⏱ <span id="countdown"></span>s</div>` in buzzer controls section
- Same `timer-update` handler and color transitions as player view

## Animations

### Score Changes
- Track previous score in JS; on `game-state` update, compare old vs new
- If changed: JS animates displayed value from old → new over 400ms (requestAnimationFrame counter)
- Correct (score increased): add `.score-flash-correct` class (green border glow, auto-remove after 600ms)
- Wrong (score decreased): add `.score-flash-wrong` class (red border glow, auto-remove after 600ms)
  ```css
  @keyframes scoreFlash { 0% { box-shadow: 0 0 0 0; } 50% { box-shadow: 0 0 15px var(--glow-color); } 100% { box-shadow: 0 0 0 0; } }
  .score-flash-correct { --glow-color: var(--correct); animation: scoreFlash 600ms ease-out; }
  .score-flash-wrong { --glow-color: var(--wrong); animation: scoreFlash 600ms ease-out; }
  ```

### Phase Transitions
- Wrap each phase's content in a `.phase-content` container
- On phase change: add `.phase-exit` (opacity 1→0, 300ms), then swap content, then add `.phase-enter` (opacity 0→1, 300ms)
  ```css
  .phase-content { transition: opacity 300ms ease; }
  .phase-exit { opacity: 0; }
  .phase-enter { opacity: 0; animation: fadeIn 300ms ease forwards; }
  @keyframes fadeIn { to { opacity: 1; } }
  ```

### Buzz Button
- Active state: `.buzz-active` class with glow pulse
  ```css
  @keyframes buzzGlow {
    from { box-shadow: 0 0 22px rgba(255,228,0,0.45), 0 0 50px rgba(255,228,0,0.15); }
    to { box-shadow: 0 0 35px rgba(255,228,0,0.65), 0 0 60px rgba(255,228,0,0.25); }
  }
  .buzz-active { animation: buzzGlow 1.5s ease-in-out infinite alternate; }
  ```
- Press: `.buzz-active:active { transform: scale(0.95); transition: transform 100ms; }`
- Lock: `.buzz-locked { background: #555; transition: background 300ms, box-shadow 300ms; }`

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

### Player View (480px – 768px, Tablet)
- Same layout as mobile but with slightly more padding
- Buzz button stays 115px (primary interaction target)

### Host View
- Primarily designed for desktop/laptop
- Board grid stays 4 columns but cells shrink proportionally
- Scoreboard wraps if needed on narrow screens
- At < 768px: stack controls vertically, board cells use smaller font (18px values)

### Lobby
- Join form centered, generous touch targets (min 44px height)
- Player list: full width cards
- Works identically across all breakpoints

## File Changes (in implementation order)

| Order | File | Action | Description |
|-------|------|--------|-------------|
| 1 | `public/css/style.css` | Rewrite | Replace current dark theme with Jeopardy theme using CSS custom properties |
| 2 | `public/js/sounds.js` | Create | Web Audio API sound effects module (no dependencies) |
| 3 | `server/index.js` | Modify | Add buzz timer countdown logic (setInterval, timer-update event, clear on score) |
| 4 | `public/index.html` | Modify | Update markup for Jeopardy lobby theme |
| 5 | `public/play.html` | Modify | Add timer display, connect sounds, add animation classes |
| 6 | `public/host.html` | Modify | Add timer display, connect sounds, add animation classes |

**Note:** `timer.js` is NOT needed as a separate module — timer display logic is simple enough to inline in each HTML file's existing Socket.IO handler.

## Non-Goals

- No Google Fonts or external font loading — system fonts only
- No audio file downloads — all sounds synthesized in-browser
- No changes to game logic, scoring, or Socket.IO protocol (except adding `timer-update` event — additive only, backward compatible; clients simply ignore it if not handled)
- No changes to server architecture
