# Evil Jeopardy² Feature Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 features to Evil Jeopardy²: SQLite persistence, sound mute, score animations, player avatars, spectator mode, AI question bank, and game replay.

**Architecture:** Build features in dependency order. SQLite is the foundation (needed by replay, question bank, and avatars). Client-only features (mute, animations) come next since they're quick wins. Server-heavy features (avatars, spectator, question bank, replay) follow.

**Tech Stack:** Node.js, Express, Socket.IO, better-sqlite3, multer, sharp, Ollama API, vanilla JS/CSS

**Spec:** `docs/superpowers/specs/2025-07-17-feature-expansion-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `server/db.js` | SQLite init, schema, event logging, game/event queries |
| `server/avatars.js` | Express router: avatar upload, validation, resize |
| `server/questions.js` | Ollama generation, JSON import, pack/question CRUD |
| `public/js/animations.js` | IIFE module: point popups, confetti, rank change, FJ reveal |
| `public/spectate.html` | Spectator page: read-only game view + chat panel |
| `public/replay.html` | Replay viewer: timeline, playback controls, event rendering |
| `public/history.html` | Game history list with links to replays |
| `public/js/replay-engine.js` | Client-side replay state machine + playback engine |
| `tests/db.test.js` | Unit tests for database module |
| `tests/questions.test.js` | Unit tests for question bank (mock Ollama) |
| `tests/replay-engine.test.js` | Unit tests for replay engine |

### Modified Files
| File | Changes |
|------|---------|
| `server/index.js` | Import db.js, add event logging calls, spectator room, question bank endpoints, game history API |
| `public/js/sounds.js` | Add `muted` flag, `toggleMute()`, localStorage persistence |
| `public/css/style.css` | Add animation keyframes, spectator/replay styles, avatar styles |
| `public/play.html` | Add mute button, avatar display, animations integration |
| `public/host.html` | Add mute button, avatar display, spectator count, question bank UI |
| `public/index.html` | Add avatar upload input in lobby |
| `package.json` | Add better-sqlite3, multer, sharp dependencies |
| `.gitignore` | Add `data/` directory |

---

### Task 1: SQLite Foundation

**Files:**
- Create: `server/db.js`
- Create: `tests/db.test.js`
- Modify: `server/index.js`
- Modify: `package.json`
- Modify: `.gitignore`

**Context:** The server currently uses only in-memory state (`gameState` object in `server/index.js`). We need SQLite for event logging (replay), question storage (question bank), and player profiles (avatars). `better-sqlite3` is synchronous — no async/await needed.

- [ ] **Step 1: Install better-sqlite3**

```bash
cd "C:\Users\Vketh\Desktop\Evil Jeopardy" && npm install better-sqlite3
```

- [ ] **Step 2: Add `data/` to `.gitignore`**

Append to `.gitignore`:
```
data/
```

- [ ] **Step 3: Write failing tests for db.js**

Create `tests/db.test.js`:

```js
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Use temp directory for test databases
const TEST_DB_DIR = path.join(__dirname, '..', 'data-test');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test.db');

describe('db module', () => {
  let db;

  beforeEach(() => {
    // Clean up test db before each test
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (!fs.existsSync(TEST_DB_DIR)) fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    // Re-require to get fresh module
    delete require.cache[require.resolve('../server/db')];
    db = require('../server/db');
    db.initDB(TEST_DB_PATH);
  });

  afterEach(() => {
    db.closeDB();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('initDB creates all required tables', () => {
    const tables = db.getDB().prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all().map(r => r.name);
    assert.ok(tables.includes('games'));
    assert.ok(tables.includes('game_events'));
    assert.ok(tables.includes('question_packs'));
    assert.ok(tables.includes('questions'));
    assert.ok(tables.includes('player_profiles'));
  });

  it('createGame inserts a game record', () => {
    const gameId = db.createGame('test-game-1', 3);
    const game = db.getDB().prepare('SELECT * FROM games WHERE game_id = ?').get(gameId);
    assert.ok(game);
    assert.strictEqual(game.player_count, 3);
    assert.ok(game.start_time > 0);
  });

  it('endGame sets end_time', () => {
    db.createGame('test-game-2', 2);
    db.endGame('test-game-2');
    const game = db.getDB().prepare('SELECT * FROM games WHERE game_id = ?').get('test-game-2');
    assert.ok(game.end_time > 0);
  });

  it('logEvent inserts an event', () => {
    db.createGame('g1', 2);
    db.logEvent('g1', 'game-start', { players: ['Kevin', 'Sarah'] });
    const events = db.getGameEvents('g1');
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].event_type, 'game-start');
    assert.deepStrictEqual(JSON.parse(events[0].event_data), { players: ['Kevin', 'Sarah'] });
  });

  it('getGameEvents returns events in order', () => {
    db.createGame('g2', 2);
    db.logEvent('g2', 'event-a', { order: 1 });
    db.logEvent('g2', 'event-b', { order: 2 });
    db.logEvent('g2', 'event-c', { order: 3 });
    const events = db.getGameEvents('g2');
    assert.strictEqual(events.length, 3);
    assert.strictEqual(events[0].event_type, 'event-a');
    assert.strictEqual(events[2].event_type, 'event-c');
  });

  it('listGames returns all games', () => {
    db.createGame('g3', 3);
    db.createGame('g4', 2);
    const games = db.listGames();
    assert.strictEqual(games.length, 2);
  });

  it('upsertPlayerProfile creates and updates profiles', () => {
    db.upsertPlayerProfile('Kevin', null);
    db.upsertPlayerProfile('Kevin', '/avatars/kevin.webp');
    const profile = db.getDB().prepare('SELECT * FROM player_profiles WHERE name = ?').get('Kevin');
    assert.strictEqual(profile.avatar_path, '/avatars/kevin.webp');
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
node --test tests/db.test.js
```
Expected: FAIL — `Cannot find module '../server/db'`

- [ ] **Step 5: Implement db.js**

Create `server/db.js`:

```js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

function initDB(dbPath) {
  const resolvedPath = dbPath || path.join(__dirname, '..', 'data', 'evil-jeopardy.db');
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      game_id TEXT PRIMARY KEY,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      player_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL REFERENCES games(game_id),
      event_type TEXT NOT NULL,
      event_data TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS question_packs (
      pack_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      question_id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_id TEXT NOT NULL REFERENCES question_packs(pack_id),
      category TEXT NOT NULL,
      value INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      answer TEXT NOT NULL,
      used_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS player_profiles (
      name TEXT PRIMARY KEY,
      avatar_path TEXT,
      games_played INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 0
    );
  `);

  return db;
}

function getDB() {
  if (!db) throw new Error('Database not initialized — call initDB() first');
  return db;
}

function closeDB() {
  if (db) { db.close(); db = null; }
}

function createGame(gameId, playerCount) {
  getDB().prepare(
    'INSERT INTO games (game_id, start_time, player_count) VALUES (?, ?, ?)'
  ).run(gameId, Date.now(), playerCount);
  return gameId;
}

function endGame(gameId) {
  getDB().prepare('UPDATE games SET end_time = ? WHERE game_id = ?').run(Date.now(), gameId);
}

function logEvent(gameId, eventType, eventData) {
  getDB().prepare(
    'INSERT INTO game_events (game_id, event_type, event_data, timestamp) VALUES (?, ?, ?, ?)'
  ).run(gameId, eventType, JSON.stringify(eventData), Date.now());
}

function getGameEvents(gameId) {
  return getDB().prepare(
    'SELECT * FROM game_events WHERE game_id = ? ORDER BY event_id ASC'
  ).all(gameId);
}

function listGames() {
  return getDB().prepare(
    'SELECT * FROM games ORDER BY start_time DESC'
  ).all();
}

function upsertPlayerProfile(name, avatarPath) {
  getDB().prepare(`
    INSERT INTO player_profiles (name, avatar_path) VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET avatar_path = COALESCE(excluded.avatar_path, avatar_path)
  `).run(name, avatarPath);
}

module.exports = {
  initDB, getDB, closeDB,
  createGame, endGame, logEvent, getGameEvents, listGames,
  upsertPlayerProfile
};
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
node --test tests/db.test.js
```
Expected: All 7 tests PASS

- [ ] **Step 7: Integrate event logging into server/index.js**

At the top of `server/index.js`, add after the buzzQueue import:
```js
const { initDB, createGame, endGame, logEvent } = require('./db');
```

After the `const PORT = ...` line, add:
```js
// Initialize database
initDB();
```

Add `let currentGameId = null;` after the buzzQueue variables.

Then add `logEvent()` calls at each significant action point:

- In `host-start-game`: after `gameState = startGame(gameState)`:
  ```js
  const crypto = require('crypto');
  currentGameId = crypto.randomUUID();
  createGame(currentGameId, Object.keys(gameState.players).length);
  logEvent(currentGameId, 'game-start', {
    players: Object.entries(gameState.players).map(([id, p]) => ({ name: p.name, id }))
  });
  ```
  (Move `crypto` require to top of file)

- In `host-select-question`: after `gameState = selectMainQuestion(...)`:
  ```js
  if (currentGameId) logEvent(currentGameId, 'question-select', { category, value });
  ```

- In `host-start-nested-question`: after `io.emit('buzz-open', ...)`:
  ```js
  if (currentGameId) logEvent(currentGameId, 'question-select', {
    category, value, nested: true
  });
  ```

- In `buzz` handler: after `recordBuzz(...)`:
  ```js
  if (currentGameId) logEvent(currentGameId, 'buzz', {
    playerId: socket.id, playerName: player.name,
    adjustedTime: Math.round(buzzQueue.buzzes[buzzQueue.buzzes.length-1].adjustedTime - buzzQueue.openedAt)
  });
  ```

- In `host-mark-correct`: after `updateScore(...)`:
  ```js
  if (currentGameId) logEvent(currentGameId, 'mark-correct', {
    playerId: socketId, playerName: gameState.players[socketId]?.name, points: value
  });
  ```

- In `host-mark-wrong`: after `updateScore(...)`:
  ```js
  if (currentGameId) logEvent(currentGameId, 'mark-wrong', {
    playerId: socketId, playerName: gameState.players[socketId]?.name, points: value
  });
  ```

- In `host-mark-correct` (nested placement): after `recordNestedPlacement(...)`:
  ```js
  if (currentGameId) logEvent(currentGameId, 'nested-placement', {
    playerId: socketId, playerName: gameState.players[socketId]?.name,
    position: gameState.nestedGame.placements.length
  });
  ```

- In `host-start-game`: also log phase change:
  ```js
  if (currentGameId) logEvent(currentGameId, 'phase-change', { from: 'LOBBY', to: 'MAIN_BOARD' });
  ```

- In `host-start-final`: after `startFinalJeopardy(...)`:
  ```js
  if (currentGameId) logEvent(currentGameId, 'phase-change', { from: 'MAIN_BOARD', to: 'FINAL_JEOPARDY' });
  ```

- In `submit-wager` handler: after `submitWager(...)`:
  ```js
  if (currentGameId) logEvent(currentGameId, 'wager-submit', {
    playerId: socket.id, playerName: gameState.players[socket.id]?.name, amount
  });
  ```

- In `submit-answer` handler: after `submitAnswer(...)`:
  ```js
  if (currentGameId) logEvent(currentGameId, 'answer-submit', {
    playerId: socket.id, playerName: gameState.players[socket.id]?.name
  });
  ```

- In `host-score-final`: after `scoreFinalJeopardy(...)`, log per-player final scores THEN game-over:
  ```js
  if (currentGameId) {
    // Log individual final scores
    Object.entries(results).forEach(([playerId, { correct }]) => {
      const wager = gameState.finalJeopardy.wagers[playerId] || 0;
      const player = gameState.players[playerId];
      logEvent(currentGameId, 'final-score', {
        playerId, playerName: player?.name, correct, wager,
        newScore: player?.score
      });
    });
    logEvent(currentGameId, 'game-over', { standings: getStandings(gameState) });
    endGame(currentGameId);
    currentGameId = null;
  }
  ```

- In `host-reset`: after `gameState = createGameState()`:
  ```js
  if (currentGameId) { endGame(currentGameId); currentGameId = null; }
  ```

Also add REST API endpoints before `server.listen()`:
```js
const { listGames: listAllGames, getGameEvents: getAllGameEvents } = require('./db');

app.get('/api/games', (req, res) => {
  res.json(listAllGames());
});

app.get('/api/games/:gameId/events', (req, res) => {
  res.json(getAllGameEvents(req.params.gameId));
});
```

- [ ] **Step 8: Run all tests to verify nothing broke**

```bash
node --test tests/*.test.js
```
Expected: All tests PASS (existing 44 + 7 new = 51)

- [ ] **Step 9: Clean up test artifacts and commit**

```bash
rm -rf data-test/
git add -A
git commit -m "feat: add SQLite foundation with event logging and game history API"
```

---

### Task 2: Sound Mute Toggle

**Files:**
- Modify: `public/js/sounds.js`
- Modify: `public/play.html` (status bar)
- Modify: `public/host.html` (status bar)

**Context:** `public/js/sounds.js` is an IIFE exposing `window.Sounds` with 8 methods (buzzDing, correctChime, wrongBuzzer, tick, tickWarning, startFJMusic, stopFJMusic, victoryFanfare). Each method creates Web Audio oscillators. The status bar in play.html (line 10-14) has connection dot, player name, and phase display. host.html (line 10-14) has connection dot, "HOST DASHBOARD", and phase.

- [ ] **Step 1: Add muted property and toggleMute to sounds.js**

In `public/js/sounds.js`, inside the IIFE, before `window.Sounds = {`:
```js
let muted = localStorage.getItem('ej-muted') === 'true';
```

Add to the `window.Sounds` object:
```js
get muted() { return muted; },

toggleMute() {
  muted = !muted;
  localStorage.setItem('ej-muted', muted);
  return muted;
},
```

Add at the top of every sound method (buzzDing, correctChime, wrongBuzzer, tick, tickWarning, startFJMusic, victoryFanfare):
```js
if (muted) return;
```

- [ ] **Step 2: Add mute button to play.html status bar**

In `public/play.html`, in the `.status-bar` div (line 10), add after the phase display span:
```html
<button id="mute-btn" class="mute-btn" onclick="Sounds.toggleMute(); this.textContent = Sounds.muted ? '🔇' : '🔊'">🔊</button>
```

Add after the sounds.js script loads (line 92):
```html
<script>
  // Restore mute button state on load
  document.addEventListener('DOMContentLoaded', () => {
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn && Sounds.muted) muteBtn.textContent = '🔇';
  });
</script>
```

- [ ] **Step 3: Add mute button to host.html status bar**

Same pattern: add `<button id="mute-btn">` to host.html status bar and restore script.

- [ ] **Step 4: Add mute button CSS to style.css**

```css
.mute-btn {
  background: none;
  border: 1px solid var(--accent-25);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 1rem;
  cursor: pointer;
  padding: 2px 6px;
  margin-left: auto;
}
.mute-btn:hover {
  background: var(--accent-15);
}
```

- [ ] **Step 5: Test manually in browser, then commit**

Start server, open play.html, click mute button, verify sounds stop. Reload page — verify mute state persists.

```bash
git add -A
git commit -m "feat: add sound mute toggle with localStorage persistence"
```

---

### Task 3: Score Animations & Visual Effects

**Files:**
- Create: `public/js/animations.js`
- Modify: `public/css/style.css`
- Modify: `public/play.html`
- Modify: `public/host.html`

**Context:** Play.html already has score flash animations (`score-flash-correct`, `score-flash-wrong` CSS classes added/removed in the game-state handler around line 164-177). The score card is in `#score-section .score-box`. Rank display is in `#my-rank`. Host.html has standings table in `#standings-table`. Game over section is `#gameover-section` in play.html (line 87-90) and host.html.

- [ ] **Step 1: Create animations.js module**

Create `public/js/animations.js`:

```js
(function() {
  window.Animations = {
    pointPopup(parentEl, amount) {
      const popup = document.createElement('div');
      popup.className = 'point-popup ' + (amount >= 0 ? 'point-popup-positive' : 'point-popup-negative');
      popup.textContent = (amount >= 0 ? '+' : '') + '$' + Math.abs(amount);
      parentEl.style.position = 'relative';
      parentEl.appendChild(popup);
      popup.addEventListener('animationend', () => popup.remove());
    },

    rankChange(el, direction) {
      const cls = direction === 'up' ? 'rank-up' : 'rank-down';
      el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 600);
    },

    confettiBurst(originEl) {
      const rect = originEl.getBoundingClientRect();
      const colors = ['#FFE400', '#4CAF50', '#2196F3', '#FF5722', '#9C27B0', '#FF9800'];
      for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'confetti-particle';
        particle.style.backgroundColor = colors[i % colors.length];
        const angle = (i / 12) * 360;
        particle.style.setProperty('--angle', angle + 'deg');
        particle.style.left = (rect.left + rect.width / 2) + 'px';
        particle.style.top = (rect.top + rect.height / 2) + 'px';
        document.body.appendChild(particle);
        particle.addEventListener('animationend', () => particle.remove());
      }
    },

    revealStandings(container, standings) {
      container.innerHTML = '';
      standings.forEach((player, i) => {
        const div = document.createElement('div');
        div.className = 'reveal-item';
        div.style.animationDelay = (i * 1) + 's';
        const medals = ['🥇', '🥈', '🥉'];
        div.innerHTML = `<span class="reveal-medal">${medals[i] || ''}</span> `
          + `<span class="reveal-name">${player.name}</span> — `
          + `<span class="reveal-score">$${player.score}</span>`;
        container.appendChild(div);
      });
    }
  };
})();
```

- [ ] **Step 2: Add animation CSS to style.css**

Append to `public/css/style.css`:

```css
/* Point Popup */
.point-popup {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-heading);
  font-weight: 900;
  font-size: 1.5rem;
  pointer-events: none;
  animation: pointRise 1.2s ease-out forwards;
  z-index: 100;
}
.point-popup-positive { color: var(--correct); }
.point-popup-negative { color: var(--wrong); }
@keyframes pointRise {
  0% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-40px); }
}

/* Rank Change */
.rank-up { animation: rankUpPulse 0.6s ease-out; }
.rank-down { animation: rankDownPulse 0.6s ease-out; }
@keyframes rankUpPulse {
  0%, 100% { text-shadow: none; }
  50% { text-shadow: 0 0 12px var(--accent); color: var(--accent); }
}
@keyframes rankDownPulse {
  0%, 100% { text-shadow: none; }
  50% { text-shadow: 0 0 12px var(--wrong); color: var(--wrong); }
}

/* Confetti Particles */
.confetti-particle {
  position: fixed;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  pointer-events: none;
  z-index: 200;
  animation: confettiFly 0.8s ease-out forwards;
}
@keyframes confettiFly {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% {
    transform: translate(
      calc(cos(var(--angle)) * 80px),
      calc(sin(var(--angle)) * 80px)
    ) scale(0);
    opacity: 0;
  }
}

/* FJ Reveal */
.reveal-item {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  padding: 12px 0;
  opacity: 0;
  transform: translateX(-30px);
  animation: revealSlide 0.6s ease-out forwards;
}
.reveal-medal { font-size: 2rem; }
.reveal-name { color: var(--accent); }
.reveal-score { color: var(--text-primary); }
@keyframes revealSlide {
  0% { opacity: 0; transform: translateX(-30px); }
  100% { opacity: 1; transform: translateX(0); }
}

/* Phase Transitions */
.phase-exit { animation: phaseOut 0.2s ease-in forwards; }
.phase-enter { animation: phaseIn 0.3s ease-out forwards; }
@keyframes phaseOut { 0% { opacity: 1; } 100% { opacity: 0; } }
@keyframes phaseIn { 0% { opacity: 0; } 100% { opacity: 1; } }
```

- [ ] **Step 3: Integrate into play.html**

Add `<script src="/js/animations.js"></script>` before sounds.js in play.html.

In the game-state handler score change block (around line 164), after the `scoreCard.classList.add('score-flash-correct')` block, add:
```js
Animations.pointPopup(scoreCard, newScore - previousScore);
```

Track previous rank and call `Animations.rankChange()` when rank changes.

In the buzz-update handler, after "You buzzed first!" text:
```js
Animations.confettiBurst(document.getElementById('buzz-btn'));
```

In the game-over section handler, replace direct standings render with:
```js
Animations.revealStandings(document.getElementById('final-standings'), standings);
```

- [ ] **Step 4: Integrate into host.html**

Add `<script src="/js/animations.js"></script>` before sounds.js in host.html.

Use `Animations.revealStandings()` in the game-over handler.

- [ ] **Step 5: Test visually in browser, then commit**

Start server, play through game, verify:
- Point popups appear on score changes
- Confetti fires on "You buzzed first!"
- Game over reveals standings one by one

```bash
git add -A
git commit -m "feat: add score animations, confetti, and FJ reveal effects"
```

---

### Task 4: Player Avatars

**Files:**
- Create: `server/avatars.js`
- Modify: `server/index.js`
- Modify: `public/index.html`
- Modify: `public/play.html`
- Modify: `public/host.html`
- Modify: `public/css/style.css`

**Context:** Lobby join form is in `public/index.html` lines 19-22 (`.lobby-form` div with name input and join button). Player list in lobby is `#players` ul (line 29). Server handles join at `server/index.js` line 112. Player score card in play.html is `#score-section .score-box` (line 25-31). Standings table in host.html is `#standings-table` (line 50-53).

- [ ] **Step 1: Install multer and sharp**

```bash
npm install multer sharp
```

- [ ] **Step 2: Create server/avatars.js**

```js
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { upsertPlayerProfile } = require('./db');

const router = express.Router();
const AVATAR_DIR = path.join(__dirname, '..', 'data', 'avatars');

// Ensure avatar directory exists
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

const upload = multer({
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

router.post('/api/avatar', upload.single('image'), async (req, res) => {
  try {
    const name = req.body.name;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const safeName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `${safeName}.webp`;
    const filepath = path.join(AVATAR_DIR, filename);

    await sharp(req.file.buffer)
      .resize(128, 128, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(filepath);

    const avatarUrl = `/avatars/${filename}`;
    upsertPlayerProfile(name.trim(), avatarUrl);

    res.json({ avatar: avatarUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 3: Mount avatar routes in server/index.js**

After `app.use(express.static(...))` add:
```js
const avatarRouter = require('./avatars');
app.use(avatarRouter);
app.use('/avatars', express.static(path.join(__dirname, '..', 'data', 'avatars')));
```

Also broadcast avatar URLs with player data. In `broadcastPlayerList()`, add `avatar` field:
```js
function broadcastPlayerList() {
  const players = Object.entries(gameState.players).map(([id, p]) => ({
    id, name: p.name, score: p.score, connected: p.connected,
    avatar: p.avatar || null,
  }));
  io.emit('player-list', players);
}
```

In the `join` handler, after `addPlayer()`, fetch avatar from db:
```js
const { getDB } = require('./db');
// After addPlayer:
const profile = getDB().prepare('SELECT avatar_path FROM player_profiles WHERE name = ?').get(trimmedName);
if (profile?.avatar_path) {
  gameState.players[socket.id].avatar = profile.avatar_path;
}
```

- [ ] **Step 4: Add avatar upload to lobby (index.html)**

In the `.lobby-form` div, after the name input:
```html
<div style="margin-top:8px;">
  <label for="avatar-input" style="font-size:0.8rem;opacity:0.7;cursor:pointer;">
    📷 Upload avatar (optional)
  </label>
  <input type="file" id="avatar-input" accept="image/*" style="display:none;">
</div>
```

In the `joined` handler script, after `displayName.textContent = name;`:
```js
// Upload avatar if selected
const avatarFile = document.getElementById('avatar-input').files[0];
if (avatarFile) {
  const formData = new FormData();
  formData.append('image', avatarFile);
  formData.append('name', name);
  fetch('/api/avatar', { method: 'POST', body: formData })
    .then(r => r.json())
    .then(data => sessionStorage.setItem('playerAvatar', data.avatar))
    .catch(console.error);
}
```

In the `player-list` handler, show avatars next to names:
```js
players.forEach(p => {
  const li = document.createElement('li');
  if (p.avatar) {
    const img = document.createElement('img');
    img.src = p.avatar;
    img.className = 'avatar-small';
    li.appendChild(img);
  }
  li.appendChild(document.createTextNode(p.name + (p.connected ? '' : ' (disconnected)')));
  playersList.appendChild(li);
});
```

- [ ] **Step 5: Add avatar display to play.html and host.html**

In play.html score card, add avatar image element. In host.html standings table, add avatar column.

- [ ] **Step 6: Add avatar CSS**

```css
.avatar-small {
  width: 24px; height: 24px;
  border-radius: 50%;
  object-fit: cover;
  vertical-align: middle;
  margin-right: 6px;
}
.avatar-medium {
  width: 32px; height: 32px;
  border-radius: 50%;
  object-fit: cover;
  vertical-align: middle;
  margin-right: 8px;
}
.avatar-default {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: bold;
  font-size: 0.7rem;
  color: #fff;
}
```

- [ ] **Step 7: Add default avatar helper function**

In `public/index.html` and any page that renders player avatars, add this helper function in a `<script>` tag (or add to a shared utility):

```js
function createAvatarElement(player, sizeClass) {
  if (player.avatar) {
    const img = document.createElement('img');
    img.src = player.avatar;
    img.className = sizeClass; // 'avatar-small' or 'avatar-medium'
    img.alt = player.name;
    return img;
  }
  // Default: initials on colored background
  const div = document.createElement('div');
  const size = sizeClass === 'avatar-medium' ? '32px' : '24px';
  div.className = 'avatar-default ' + sizeClass;
  div.style.width = size;
  div.style.height = size;
  div.style.fontSize = sizeClass === 'avatar-medium' ? '0.8rem' : '0.65rem';
  // Color from name hash (deterministic)
  let hash = 0;
  for (let i = 0; i < player.name.length; i++) {
    hash = player.name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  div.style.backgroundColor = `hsl(${hue}, 60%, 45%)`;
  // Initials (first letter, or first two for multi-word names)
  const parts = player.name.trim().split(/\s+/);
  const initials = parts.length > 1
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : player.name.substring(0, 2).toUpperCase();
  div.textContent = initials;
  return div;
}
```

Use `createAvatarElement(player, 'avatar-small')` everywhere avatars are rendered (lobby list, host standings, play.html score card, spectator chat). This ensures a consistent fallback when no avatar is uploaded.

- [ ] **Step 8: Test avatar upload flow, then commit**

```bash
git add -A
git commit -m "feat: add player avatar upload with image resize"
```

---

### Task 5: Spectator Mode

**Files:**
- Create: `public/spectate.html`
- Modify: `server/index.js`
- Modify: `public/host.html`
- Modify: `public/css/style.css`

**Context:** The server broadcasts game state to all connected sockets — players get sanitized state, non-player sockets get full state (see `broadcastGameState()` at `server/index.js` line 74-88). Socket.IO rooms will separate spectators. The host status bar is at `public/host.html` line 10-14.

- [ ] **Step 1: Create spectate.html**

Create `public/spectate.html` with:
- Split layout: `.spectator-game` (left) + `.spectator-chat` (right)
- Game view: status bar, current phase display, standings, buzz results, timer
- Chat panel: message list, emoji reaction bar (👏 😂 🔥 😱 💀), input + send button
- Name entry modal on load (spectator display name)
- Socket.IO connection, receives all game events (game-state, buzz-update, timer-update, buzz-open)
- Chat message sending: `socket.emit('spectator-chat', { name, message })`
- Chat message receiving: `socket.on('chat-message', ...)` renders in chat list

- [ ] **Step 2: Add spectator room handling to server/index.js**

After the connection handler's initial state send, add:
```js
let spectatorCount = 0;

// Inside io.on('connection', ...):
socket.on('spectator-join', ({ name }) => {
  socket.join('spectators');
  socket.data.spectatorName = name;
  spectatorCount++;
  io.emit('spectator-count', { count: spectatorCount });
  // Send current game state to spectator
  socket.emit('game-state', gameState);
});

socket.on('spectator-chat', ({ message }) => {
  if (!socket.data.spectatorName) return;
  // Rate limit: track last message time
  const now = Date.now();
  if (socket.data.lastChatTime && now - socket.data.lastChatTime < 2000) return;
  socket.data.lastChatTime = now;

  io.to('spectators').emit('chat-message', {
    id: crypto.randomUUID(),
    name: socket.data.spectatorName,
    message: message.substring(0, 200), // Limit length
    timestamp: now
  });
});

socket.on('chat-reaction', ({ messageId, emoji }) => {
  // Track reactions in memory
  if (!chatReactions[messageId]) chatReactions[messageId] = {};
  if (!chatReactions[messageId][emoji]) chatReactions[messageId][emoji] = 0;
  chatReactions[messageId][emoji]++;
  io.to('spectators').emit('reaction-update', {
    messageId, emoji, count: chatReactions[messageId][emoji]
  });
});
```

Add `const chatReactions = {};` to the top-level variables.

Update `broadcastGameState()` to also send to spectators room:
```js
// After the existing broadcasts, add:
io.to('spectators').emit('game-state', gameState);
```

Update disconnect handler to decrement spectator count.

- [ ] **Step 3: Add spectator count to host.html**

In host.html status bar, add:
```html
<span id="spectator-count" style="margin-left:auto;opacity:0.7;"></span>
```

In host.html script:
```js
socket.on('spectator-count', ({ count }) => {
  document.getElementById('spectator-count').textContent = count > 0 ? `👀 ${count} spectator${count > 1 ? 's' : ''}` : '';
});
```

- [ ] **Step 4: Add spectator CSS styles**

```css
.spectator-layout {
  display: flex;
  min-height: calc(100dvh - 40px);
}
.spectator-game { flex: 7; padding: 1rem; overflow-y: auto; }
.spectator-chat { flex: 3; border-left: 1px solid var(--accent-25); display: flex; flex-direction: column; }
.chat-messages { flex: 1; overflow-y: auto; padding: 8px; }
.chat-message { padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem; }
.chat-name { color: var(--accent); font-weight: bold; }
.chat-input-bar { display: flex; padding: 8px; gap: 4px; border-top: 1px solid var(--accent-25); }
.chat-input { flex: 1; background: var(--card-bg); border: 1px solid var(--accent-25); color: var(--text-primary); padding: 6px 8px; border-radius: 4px; }
.chat-send-btn { background: var(--accent); color: var(--bg-primary); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; }
.reaction-bar { display: flex; gap: 4px; padding: 4px 8px; }
.reaction-btn { background: none; border: 1px solid var(--accent-25); border-radius: 12px; padding: 2px 8px; cursor: pointer; font-size: 0.8rem; }
@media (max-width: 768px) {
  .spectator-layout { flex-direction: column; }
  .spectator-chat { border-left: none; border-top: 1px solid var(--accent-25); max-height: 40vh; }
}
```

- [ ] **Step 5: Test spectator mode, then commit**

Open `/spectate.html` in a separate browser tab. Verify:
- Spectator sees live game state updates
- Chat messages send and display
- Host sees spectator count
- Rate limiting works

```bash
git add -A
git commit -m "feat: add spectator mode with live game view and chat"
```

---

### Task 6: Question Bank

**Files:**
- Create: `server/questions.js`
- Create: `tests/questions.test.js`
- Modify: `server/index.js`
- Modify: `public/host.html`

**Context:** The host currently types category names manually. During NESTED_GAME phase, `host-start-nested-question` event expects `{ category, value }`. The host.html nested game section has category input (`#nested-category`) and value select (`#nested-value`) at lines 65-78. Ollama API runs at `http://localhost:11434/api/generate` — it may not be running, so graceful fallback is required.

- [ ] **Step 1: Write failing tests for questions.js**

Create `tests/questions.test.js`:

```js
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const TEST_DB_DIR = path.join(__dirname, '..', 'data-test');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test-questions.db');

describe('questions module', () => {
  let db, questions;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (!fs.existsSync(TEST_DB_DIR)) fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    delete require.cache[require.resolve('../server/db')];
    delete require.cache[require.resolve('../server/questions')];
    db = require('../server/db');
    db.initDB(TEST_DB_PATH);
    questions = require('../server/questions');
  });

  afterEach(() => {
    db.closeDB();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('importPack inserts questions from JSON', () => {
    const pack = {
      name: 'Test Pack',
      categories: [
        { name: 'Science', questions: [
          { value: 100, question: 'Q1?', answer: 'A1' },
          { value: 200, question: 'Q2?', answer: 'A2' }
        ]}
      ]
    };
    const packId = questions.importPack(pack);
    assert.ok(packId);
    const qs = questions.getPackQuestions(packId);
    assert.strictEqual(qs.length, 2);
    assert.strictEqual(qs[0].category, 'Science');
  });

  it('importPack rejects invalid format', () => {
    assert.throws(() => questions.importPack({ bad: 'data' }));
  });

  it('listPacks returns all packs', () => {
    questions.importPack({
      name: 'Pack 1',
      categories: [{ name: 'Cat1', questions: [{ value: 100, question: 'Q', answer: 'A' }] }]
    });
    const packs = questions.listPacks();
    assert.strictEqual(packs.length, 1);
    assert.strictEqual(packs[0].name, 'Pack 1');
  });

  it('getUnusedQuestion returns unused question for category/value', () => {
    const packId = questions.importPack({
      name: 'P',
      categories: [{ name: 'History', questions: [
        { value: 100, question: 'H1?', answer: 'HA1' },
        { value: 200, question: 'H2?', answer: 'HA2' }
      ]}]
    });
    const q = questions.getUnusedQuestion(packId, 'History', 100);
    assert.ok(q);
    assert.strictEqual(q.question_text, 'H1?');
  });

  it('markQuestionUsed increments used_count', () => {
    const packId = questions.importPack({
      name: 'P2',
      categories: [{ name: 'Geo', questions: [{ value: 100, question: 'G1?', answer: 'GA1' }] }]
    });
    const q = questions.getUnusedQuestion(packId, 'Geo', 100);
    questions.markQuestionUsed(q.question_id);
    const q2 = questions.getUnusedQuestion(packId, 'Geo', 100);
    assert.strictEqual(q2, undefined); // No more unused
  });

  it('parseOllamaResponse extracts valid question pack', () => {
    const mockResponse = JSON.stringify({
      name: 'AI Generated',
      categories: [
        { name: 'Space', questions: [
          { value: 100, question: 'Nearest star?', answer: 'What is Proxima Centauri?' }
        ]}
      ]
    });
    const pack = questions.parseOllamaResponse(mockResponse);
    assert.strictEqual(pack.name, 'AI Generated');
    assert.strictEqual(pack.categories[0].questions.length, 1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test tests/questions.test.js
```
Expected: FAIL — `Cannot find module '../server/questions'`

- [ ] **Step 3: Implement server/questions.js**

```js
const crypto = require('crypto');
const { getDB } = require('./db');

function importPack(packData) {
  if (!packData?.name || !Array.isArray(packData?.categories)) {
    throw new Error('Invalid pack format: requires name and categories array');
  }

  const packId = crypto.randomUUID();
  const db = getDB();

  db.prepare(
    'INSERT INTO question_packs (pack_id, name, source, created_at) VALUES (?, ?, ?, ?)'
  ).run(packId, packData.name, 'import', Date.now());

  const insertQ = db.prepare(
    'INSERT INTO questions (pack_id, category, value, question_text, answer) VALUES (?, ?, ?, ?, ?)'
  );

  const insertMany = db.transaction((categories) => {
    for (const cat of categories) {
      if (!cat.name || !Array.isArray(cat.questions)) continue;
      for (const q of cat.questions) {
        insertQ.run(packId, cat.name, q.value, q.question, q.answer);
      }
    }
  });

  insertMany(packData.categories);
  return packId;
}

function listPacks() {
  return getDB().prepare(`
    SELECT qp.*, COUNT(q.question_id) as question_count
    FROM question_packs qp
    LEFT JOIN questions q ON qp.pack_id = q.pack_id
    GROUP BY qp.pack_id
    ORDER BY qp.created_at DESC
  `).all();
}

function getPackQuestions(packId) {
  return getDB().prepare(
    'SELECT * FROM questions WHERE pack_id = ? ORDER BY category, value'
  ).all(packId);
}

function getUnusedQuestion(packId, category, value) {
  return getDB().prepare(
    'SELECT * FROM questions WHERE pack_id = ? AND category = ? AND value = ? AND used_count = 0 LIMIT 1'
  ).get(packId, category, value);
}

function markQuestionUsed(questionId) {
  getDB().prepare(
    'UPDATE questions SET used_count = used_count + 1 WHERE question_id = ?'
  ).run(questionId);
}

function getPackCategories(packId) {
  return getDB().prepare(
    'SELECT DISTINCT category FROM questions WHERE pack_id = ?'
  ).all(packId).map(r => r.category);
}

function parseOllamaResponse(responseText) {
  // Try to find JSON in response (may be wrapped in markdown code blocks)
  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```json?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1];

  // Try parsing directly
  const parsed = JSON.parse(jsonStr.trim());
  if (!parsed.name || !Array.isArray(parsed.categories)) {
    throw new Error('Invalid response format');
  }
  return parsed;
}

async function generateWithOllama(topic, categoryCount = 5, questionsPerCategory = 5) {
  const model = process.env.OLLAMA_MODEL || 'llama3.2';
  const prompt = `Generate a trivia question pack about "${topic}" in valid JSON format.
Create exactly ${categoryCount} categories, each with exactly ${questionsPerCategory} questions.
Questions should range from $100 (easy) to $500 (hard) in increments of $100.
Format answers in Jeopardy "What is..." style.

Respond with ONLY valid JSON in this exact format:
{
  "name": "${topic} Pack",
  "categories": [
    {
      "name": "Category Name",
      "questions": [
        { "value": 100, "question": "Easy question text", "answer": "What is the answer?" },
        { "value": 200, "question": "...", "answer": "..." },
        { "value": 300, "question": "...", "answer": "..." },
        { "value": 400, "question": "...", "answer": "..." },
        { "value": 500, "question": "...", "answer": "..." }
      ]
    }
  ]
}`;

  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false })
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return parseOllamaResponse(data.response);
}

module.exports = {
  importPack, listPacks, getPackQuestions,
  getUnusedQuestion, markQuestionUsed, getPackCategories,
  parseOllamaResponse, generateWithOllama
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test tests/questions.test.js
```
Expected: All 6 tests PASS

- [ ] **Step 5: Add question bank API endpoints to server/index.js**

```js
const { importPack, listPacks, getPackQuestions, getUnusedQuestion, markQuestionUsed, generateWithOllama } = require('./questions');

app.use(express.json());

app.get('/api/question-packs', (req, res) => {
  res.json(listPacks());
});

app.get('/api/question-packs/:packId/questions', (req, res) => {
  res.json(getPackQuestions(req.params.packId));
});

app.post('/api/import-questions', (req, res) => {
  try {
    const packId = importPack(req.body);
    res.json({ packId, message: 'Pack imported successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/generate-questions', async (req, res) => {
  try {
    const { topic, categories, questionsPerCategory } = req.body;
    const pack = await generateWithOllama(topic, categories, questionsPerCategory);
    const packId = importPack(pack);
    res.json({ packId, pack: { ...pack, packId } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/question-packs/:packId/question', (req, res) => {
  const { category, value } = req.query;
  const q = getUnusedQuestion(req.params.packId, category, parseInt(value));
  if (q) {
    markQuestionUsed(q.question_id);
    res.json(q);
  } else {
    res.status(404).json({ error: 'No unused questions available' });
  }
});
```

- [ ] **Step 6: Add Question Bank UI to host.html**

Add a "Question Bank" panel to the lobby section of host.html:
- List available packs dropdown
- "Generate with AI" button with topic input
- "Import JSON Pack" button with file upload
- "Select Pack" button to activate a pack for the game
- During NESTED_GAME, if pack is active, show question text on host screen when auto-loading from pack

Also modify the nested game section: if a pack is active, add a "Load Question from Pack" button that fetches from `/api/question-packs/:packId/question?category=X&value=Y` and displays the question text in a read-only area for the host to read aloud.

- [ ] **Step 7: Run all tests, then commit**

```bash
node --test tests/*.test.js
```
Expected: All tests PASS

```bash
git add -A
git commit -m "feat: add question bank with Ollama generation and JSON import"
```

---

### Task 7: Game Replay

**Files:**
- Create: `public/js/replay-engine.js`
- Create: `public/replay.html`
- Create: `public/history.html`
- Create: `tests/replay-engine.test.js`

**Context:** Event logging is already in place from Task 1. The API endpoints `GET /api/games` and `GET /api/games/:gameId/events` are already wired. Events follow the schema in the spec (game-start, buzz, mark-correct, mark-wrong, phase-change, question-select, game-over, etc.). The replay engine needs to reconstruct game state from events and render it using the same visual patterns as the live game.

- [ ] **Step 1: Write failing tests for replay-engine.js**

Create `tests/replay-engine.test.js`:

```js
const { describe, it } = require('node:test');
const assert = require('node:assert');

// Simulate browser globals for the IIFE module
global.window = {};
require('../public/js/replay-engine');
const ReplayEngine = global.window.ReplayEngine;

describe('ReplayEngine', () => {
  it('initializes with events', () => {
    const engine = ReplayEngine.create([
      { event_type: 'game-start', event_data: '{"players":[{"name":"Kevin"}]}', timestamp: 1000 },
      { event_type: 'game-over', event_data: '{"standings":[]}', timestamp: 2000 }
    ]);
    assert.strictEqual(engine.totalEvents, 2);
    assert.strictEqual(engine.currentIndex, -1);
  });

  it('stepForward advances to next event', () => {
    const engine = ReplayEngine.create([
      { event_type: 'game-start', event_data: '{"players":[{"name":"Kevin","id":"k1"}]}', timestamp: 1000 },
      { event_type: 'phase-change', event_data: '{"from":"LOBBY","to":"MAIN_BOARD"}', timestamp: 2000 }
    ]);
    const event = engine.stepForward();
    assert.strictEqual(event.event_type, 'game-start');
    assert.strictEqual(engine.currentIndex, 0);
  });

  it('stepForward returns null at end', () => {
    const engine = ReplayEngine.create([
      { event_type: 'game-start', event_data: '{"players":[]}', timestamp: 1000 }
    ]);
    engine.stepForward(); // event 0
    const result = engine.stepForward(); // past end
    assert.strictEqual(result, null);
  });

  it('getProgress returns correct percentage', () => {
    const engine = ReplayEngine.create([
      { event_type: 'a', event_data: '{}', timestamp: 1 },
      { event_type: 'b', event_data: '{}', timestamp: 2 },
      { event_type: 'c', event_data: '{}', timestamp: 3 },
      { event_type: 'd', event_data: '{}', timestamp: 4 }
    ]);
    engine.stepForward(); // 0
    engine.stepForward(); // 1
    assert.strictEqual(engine.getProgress(), 50);
  });

  it('seekTo jumps to specific event index', () => {
    const engine = ReplayEngine.create([
      { event_type: 'a', event_data: '{}', timestamp: 1 },
      { event_type: 'b', event_data: '{}', timestamp: 2 },
      { event_type: 'c', event_data: '{}', timestamp: 3 }
    ]);
    engine.seekTo(2);
    assert.strictEqual(engine.currentIndex, 2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test tests/replay-engine.test.js
```
Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement replay-engine.js**

Create `public/js/replay-engine.js`:

```js
(function() {
  window.ReplayEngine = {
    create(events) {
      const parsedEvents = events.map(e => ({
        ...e,
        data: typeof e.event_data === 'string' ? JSON.parse(e.event_data) : e.event_data
      }));

      return {
        events: parsedEvents,
        currentIndex: -1,
        totalEvents: parsedEvents.length,
        playing: false,
        speed: 1,
        _timer: null,

        stepForward() {
          if (this.currentIndex >= this.totalEvents - 1) return null;
          this.currentIndex++;
          return this.events[this.currentIndex];
        },

        stepBack() {
          if (this.currentIndex <= 0) return null;
          this.currentIndex--;
          return this.events[this.currentIndex];
        },

        seekTo(index) {
          this.currentIndex = Math.max(-1, Math.min(index, this.totalEvents - 1));
          return this.events[this.currentIndex] || null;
        },

        getProgress() {
          if (this.totalEvents <= 1) return this.currentIndex >= 0 ? 100 : 0;
          return Math.round(((this.currentIndex + 1) / this.totalEvents) * 100);
        },

        getCurrentEvent() {
          return this.currentIndex >= 0 ? this.events[this.currentIndex] : null;
        },

        play(onEvent) {
          if (this.playing) return;
          this.playing = true;
          const tick = () => {
            if (!this.playing) return;
            const event = this.stepForward();
            if (!event) { this.playing = false; return; }
            if (onEvent) onEvent(event, this.currentIndex, this.totalEvents);
            // Calculate delay to next event
            const next = this.events[this.currentIndex + 1];
            const delay = next
              ? Math.max(100, (next.timestamp - event.timestamp) / this.speed)
              : 0;
            if (next) this._timer = setTimeout(tick, Math.min(delay, 3000));
            else this.playing = false;
          };
          tick();
        },

        pause() {
          this.playing = false;
          if (this._timer) { clearTimeout(this._timer); this._timer = null; }
        },

        setSpeed(speed) {
          this.speed = speed;
        }
      };
    }
  };
})();
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test tests/replay-engine.test.js
```
Expected: All 5 tests PASS

- [ ] **Step 5: Create history.html**

Create `public/history.html` — a page that fetches `/api/games`, displays a styled table of completed games (date, players, winner, score), with each row linking to `/replay.html?gameId=X`. Uses the Jeopardy theme CSS.

- [ ] **Step 6: Create replay.html**

Create `public/replay.html`:
- Fetches events from `/api/games/:gameId/events` on load
- Creates a `ReplayEngine` instance
- Renders a host-style view (read-only): phase display, standings, current question, buzz results
- Playback controls bar at bottom: ⏮ Back | ⏸ Play/Pause | ⏭ Forward | Speed (1x/2x/4x) | Timeline scrubber
- Event counter: "Event 15 of 47"
- Timeline scrubber: click to seek
- Event-type-specific rendering (buzz events show names, score events show point changes, etc.)
- Uses animations.js for visual effects during playback

- [ ] **Step 7: Run all tests, then commit**

```bash
node --test tests/*.test.js
```
Expected: All tests PASS

```bash
git add -A
git commit -m "feat: add game replay with history page and playback engine"
```

---

### Task 8: Integration Test & Final Polish

**Files:**
- All files from Tasks 1-7

- [ ] **Step 1: Run full test suite**

```bash
node --test tests/*.test.js
```
Expected: All tests PASS

- [ ] **Step 2: Start server and do full E2E test**

Start server, join 3 players, play through:
- Verify mute button works on play.html and host.html
- Verify avatar upload in lobby
- Open spectate.html — verify live game view + chat works
- Verify point popups, confetti on buzz winner
- Use question bank to generate/import questions
- Complete game, check game-over reveal animation
- Check `/history.html` shows the game
- Click to replay — verify playback works

- [ ] **Step 3: Fix any issues found during testing**

- [ ] **Step 4: Final commit and push**

```bash
git add -A
git commit -m "feat: complete feature expansion - all 7 features integrated"
git push origin master
```
