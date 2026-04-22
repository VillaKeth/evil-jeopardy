# Evil Jeopardy² — Feature Expansion Design Spec

**Date:** 2025-07-17
**Status:** Approved

## Overview

Add 7 features to Evil Jeopardy² in dependency order: SQLite persistence, sound mute toggle, enhanced score animations, player avatars, spectator mode with chat, AI-powered question bank, and full game replay.

## Architecture Changes

### New Dependencies
- `better-sqlite3` — synchronous SQLite for Node.js
- `multer` — multipart file upload for avatars
- `sharp` — image resizing for avatar thumbnails (128×128)

### New Files
| File | Purpose |
|------|---------|
| `server/db.js` | Database initialization, schema, query helpers |
| `server/questions.js` | Question bank logic: Ollama generation, JSON import, selection |
| `server/avatars.js` | Avatar upload/serve endpoints |
| `public/spectate.html` | Spectator view with live game + chat |
| `public/replay.html` | Game replay viewer with timeline scrubber |
| `public/history.html` | Game history list |
| `public/js/animations.js` | Enhanced animation helpers (confetti, popups) |
| `data/` | Runtime data directory (SQLite DB, avatars) |

### Database Schema (`data/evil-jeopardy.db`)

```sql
CREATE TABLE games (
  game_id TEXT PRIMARY KEY,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  player_count INTEGER NOT NULL
);

CREATE TABLE game_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(game_id),
  event_type TEXT NOT NULL,
  event_data TEXT NOT NULL, -- JSON
  timestamp INTEGER NOT NULL
);

CREATE TABLE question_packs (
  pack_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL, -- 'ollama' | 'import'
  created_at INTEGER NOT NULL
);

CREATE TABLE questions (
  question_id INTEGER PRIMARY KEY AUTOINCREMENT,
  pack_id TEXT NOT NULL REFERENCES question_packs(pack_id),
  category TEXT NOT NULL,
  value INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  answer TEXT NOT NULL,
  used_count INTEGER DEFAULT 0
);

CREATE TABLE player_profiles (
  name TEXT PRIMARY KEY,
  avatar_path TEXT,
  games_played INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0
);
```

### Event Types for Replay

Each game event is logged with `event_type` and `event_data` (JSON):

| Event Type | Data |
|------------|------|
| `game-start` | `{ players: [{name, id}] }` |
| `question-select` | `{ category, value, nestedCategory?, nestedValue? }` |
| `buzz` | `{ playerId, playerName, adjustedTime }` |
| `mark-correct` | `{ playerId, playerName, points }` |
| `mark-wrong` | `{ playerId, playerName, points }` |
| `phase-change` | `{ from, to }` |
| `nested-placement` | `{ playerId, playerName, position }` |
| `wager-submit` | `{ playerId, playerName, amount }` |
| `answer-submit` | `{ playerId, playerName }` |
| `final-score` | `{ playerId, playerName, correct, wager, newScore }` |
| `game-over` | `{ standings: [{name, score, rank}] }` |

---

## Feature 1: SQLite Foundation

### Implementation
- `server/db.js` exports `initDB()`, `logEvent(gameId, type, data)`, `getGameEvents(gameId)`, `listGames()`
- `initDB()` called on server startup, creates tables if not exist
- `data/` directory created automatically if missing
- Add `data/` to `.gitignore`

### Event Logging Integration
- Generate `gameId` (UUID) when game starts, store in `gameState`
- Call `logEvent()` at each significant server action (start, buzz, score, phase change)
- Minimal overhead: `better-sqlite3` is synchronous and fast for writes

---

## Feature 2: Sound Mute Toggle

### Implementation
- Add `Sounds.muted` property (boolean) to `public/js/sounds.js`
- Each sound method checks `if (Sounds.muted) return;` at the top
- Add `Sounds.toggleMute()` method that flips the flag and saves to `localStorage('ej-muted')`
- On load, read `localStorage('ej-muted')` to restore state

### UI
- Add mute button to `.status-bar` in both `play.html` and `host.html`
- Button text: 🔊 (unmuted) / 🔇 (muted)
- Style: small, unobtrusive, right-aligned in status bar

### No server changes required.

---

## Feature 3: Score Animations & Visual Effects

### Point Popup
- When score changes, create a floating `<div class="point-popup">` with "+$200" or "-$200"
- CSS animation: rise 40px upward, fade out over 1.2s
- Green for positive, red for negative
- Remove element after animation completes

### Rank Change Animation
- Track previous rank in player view
- When rank changes, add `rank-change` class to rank display
- CSS: brief gold highlight pulse for rank up, subtle red for rank down

### Phase Transitions
- Use existing `.phase-content` class structure
- Add `phase-exit` (fade out 200ms) before hiding, `phase-enter` (fade in 300ms) after showing
- Use `requestAnimationFrame` for smooth sequencing

### Buzz Winner Celebration
- On "You buzzed first!" — trigger CSS particle burst
- 12 small colored circles fly outward from buzz button using `@keyframes`
- Particles removed after 800ms animation

### Final Jeopardy Reveal
- When game-over standings display, reveal each player one at a time
- 1-second delay between each reveal
- Each reveal: slide in from left with score counter animation (counts up/down to final value)

### New file: `public/js/animations.js`
- IIFE pattern like sounds.js, exposing `window.Animations`
- Methods: `pointPopup(element, amount)`, `rankChange(element, direction)`, `confettiBurst(element)`, `revealStandings(container, standings)`

### No server changes required.

---

## Feature 4: Player Avatars

### Server
- `server/avatars.js` — Express router with:
  - `POST /api/avatar` — accepts multipart `image` field, player `name` field
  - Validates: max 2MB, image/* MIME type
  - Resizes to 128×128 using `sharp`
  - Saves to `data/avatars/{name}.webp` (convert all to webp for consistency)
  - Updates `player_profiles.avatar_path`
- Static serve: `app.use('/avatars', express.static('data/avatars'))`

### Client — Lobby (`index.html`)
- Add file input below name field: "Upload avatar (optional)"
- After joining, upload avatar via `fetch('/api/avatar', { method: 'POST', body: formData })`
- Show avatar preview next to player name in lobby list

### Client — Player (`play.html`)
- Display avatar in score card (32×32, circular, next to score)

### Client — Host (`host.html`)
- Display avatars in standings table (24×24, circular)

### Client — Spectator (`spectate.html`)
- Display avatars next to chat messages

### Default Avatar
- If no avatar uploaded, generate initials on colored background
- Color derived from player name hash (consistent per player)
- Rendered via CSS (no image generation needed)

---

## Feature 5: Spectator Mode

### New Page: `/spectate.html`
- Split layout: game view (left 70%) + chat panel (right 30%)
- Mobile: chat panel below game view (full width)

### Game View (Read-Only)
- Shows current phase, standings, buzz results, timer
- Same visual style as host view but without controls
- Receives `game-state`, `buzz-update`, `timer-update`, `buzz-open` events

### Chat Panel
- Message input at bottom with send button
- Messages display with player avatar/name, timestamp
- Emoji reactions: row of quick-react buttons (👏 😂 🔥 😱 💀)
- Reactions display inline as counts next to messages

### Server Changes
- New Socket.IO room: `spectators`
- On connect to spectate.html: `socket.join('spectators')`
- Track spectator count, emit to host: `spectator-count` event
- Chat events:
  - `spectator-chat` (client→server): `{ name, message }`
  - `chat-message` (server→spectators): `{ name, message, avatar, timestamp }`
  - `chat-reaction` (client→server): `{ messageId, emoji }`
  - `reaction-update` (server→spectators): `{ messageId, emoji, count }`
- Spectators pick a display name on entry (not a game player name)
- Rate limit: max 1 message per 2 seconds per spectator
- Chat messages are in-memory only (not persisted to SQLite, not included in game replay)

### Host Dashboard Addition
- Show "👀 X spectators" in the status bar

---

## Feature 6: Question Bank

### Ollama Integration (`server/questions.js`)
- `generateQuestionPack(topic, categoryCount, questionsPerCategory)` — calls Ollama API
- Endpoint: `POST http://localhost:11434/api/generate`
- Model: configurable via env var `OLLAMA_MODEL` (default: `llama3.2`)
- Prompt template generates JSON with categories, questions ($100-$500 difficulty), and answers
- Parse response, validate structure, insert into `questions` and `question_packs` tables
- Graceful fallback: if Ollama not available, show error message, host uses manual mode

### JSON Import
- `POST /api/import-questions` — accepts JSON file upload
- Validates structure matches expected format
- Inserts into database as a new question pack

### Question Pack Format (JSON Import)
```json
{
  "name": "Movie Trivia Pack",
  "categories": [
    {
      "name": "90s Films",
      "questions": [
        { "value": 100, "question": "This 1994 film about a slow-witted man became a cultural phenomenon", "answer": "What is Forrest Gump?" },
        { "value": 200, "question": "...", "answer": "..." }
      ]
    }
  ]
}
```

### Host UI Changes
- **Pre-game setup panel** (in LOBBY phase): "Question Bank" section
  - List available packs with question counts
  - "Generate with AI" button → topic input + generate
  - "Import Pack" button → file upload
  - "Select Pack" → marks a pack as active for the game
- **During game** (NESTED_GAME phase): 
  - If a pack is active, show dropdown of unused questions for the selected category/value
  - Question text displays on host screen and spectator view (not player screens)
  - Host reads question aloud
  - Fallback: if no pack active or questions exhausted, host types manually (current behavior)

### No changes to game flow — question bank is an optional enhancement.

---

## Feature 7: Game Replay

### History Page (`/history.html`)
- Lists all completed games from `games` table
- Shows: date, player names, winner, final scores
- Click any game → opens `/replay.html?gameId=X`
- Styled with same Jeopardy theme

### Replay Viewer (`/replay.html`)
- Fetches events via `GET /api/games/:gameId/events`
- Reconstructs game state event-by-event using a client-side state machine
- UI: host-style view (board, standings, buzz results) but read-only

### Playback Controls
- ▶️ Play / ⏸ Pause
- ⏩ Speed: 1x, 2x, 4x
- Timeline scrubber: horizontal bar showing event density
- Current event indicator on timeline
- Event counter: "Event 15 of 47"

### Playback Engine (`public/js/replay-engine.js`)
- Loads all events, sorts by timestamp
- Maintains replay state (current event index, playing flag, speed)
- `tick()` method: processes next event, updates display, schedules next tick
- Event handlers mirror the live game's Socket.IO handlers but feed from recorded data
- Same CSS animations as live play (buzz glow, score flash, etc.)

### Server API
- `GET /api/games` — list all games (id, start_time, end_time, player_count, winner)
- `GET /api/games/:gameId/events` — all events for a game, ordered by timestamp

---

## Build Order

1. **SQLite Foundation** — database setup, event logging, API endpoints
2. **Sound Mute Toggle** — Sounds module enhancement + UI button
3. **Score Animations** — CSS animations + animations.js helper
4. **Player Avatars** — upload, storage, display
5. **Spectator Mode** — spectate.html + chat
6. **Question Bank** — Ollama + import + host UI
7. **Game Replay** — history + replay viewer

Dependencies: Replay depends on SQLite (event logging). Question bank depends on SQLite (question storage). Avatars depend on SQLite (player profiles). Everything else is independent.

## Testing Strategy

- Unit tests for `db.js`, `questions.js` (mock Ollama responses)
- Unit tests for replay engine (feed events, verify state reconstruction)
- Integration test: full game flow with event logging, then replay verification
- Visual testing via browser for animations and new pages
