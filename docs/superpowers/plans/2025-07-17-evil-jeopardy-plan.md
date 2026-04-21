# Evil Jeopardy² Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time web app that handles buzzing, scoring, and game flow for Evil Jeopardy² — a nested Jeopardy game where every main board question requires playing a full 5×5 sub-game first.

**Architecture:** Node.js + Express + Socket.IO server running on the host's laptop. Vanilla HTML/CSS/JS frontend served as static files. Three views: lobby (join + calibrate), player (buzz + scores), host dashboard (controls + scoreboard). WebSocket for real-time events. ngrok tunnel for remote player access.

**Tech Stack:** Node.js 20+, Express 4.x, Socket.IO 4.x, Vanilla JS, CSS (dark Jeopardy theme), ngrok

**Spec:** `docs/superpowers/specs/2025-07-17-evil-jeopardy-design.md`

---

## File Structure

```
evil-jeopardy/
├── server/
│   ├── index.js          # Express + Socket.IO server entry point
│   ├── gameState.js      # Game state object + mutation methods
│   ├── buzzQueue.js      # Latency-compensated buzz processing
│   └── latency.js        # Ping calibration logic
├── public/
│   ├── index.html        # Lobby / join page
│   ├── play.html         # Player view
│   ├── host.html         # Host dashboard
│   ├── css/
│   │   └── style.css     # Shared dark Jeopardy theme
│   └── js/
│       ├── socket-setup.js  # Shared Socket.IO connection + reconnection logic
│       ├── lobby.js      # Lobby client logic (name entry, calibration, waiting)
│       ├── player.js     # Player client logic (buzz, scores, standings, final jeopardy)
│       └── host.js       # Host client logic (controls, scoreboard, score editing)
├── tests/
│   ├── gameState.test.js # Game state unit tests
│   ├── buzzQueue.test.js # Buzz queue unit tests
│   └── latency.test.js   # Latency calibration unit tests
├── package.json
├── .nvmrc                # Node version pinning
└── start.sh              # One-command startup script (server + ngrok)
```

**Design decisions:**
- `socket-setup.js` is shared across all three views to avoid duplicating connection/reconnection logic
- Server modules are pure functions where possible (gameState, buzzQueue, latency) for easy unit testing
- No build step — files served as-is from `public/`
- Tests use Node's built-in test runner (`node --test`) to avoid adding test framework dependencies

---

## Task 1: Project Scaffolding

**Files:**
- Create: `server/index.js` (minimal stub)
- Create: `package.json`
- Create: `.nvmrc`
- Create: `public/index.html` (empty shell)

- [ ] **Step 1: Initialize npm project**

```bash
cd "C:\Users\Vketh\Desktop\Evil Jeopardy"
npm init -y
```

Then edit `package.json` to set:
```json
{
  "name": "evil-jeopardy",
  "version": "1.0.0",
  "description": "Evil Jeopardy² — real-time buzzer and scoring for nested Jeopardy",
  "main": "server/index.js",
  "scripts": {
    "start": "node server/index.js",
    "dev": "node --watch server/index.js",
    "test": "node --test tests/"
  },
  "keywords": [],
  "license": "MIT"
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install express socket.io
```

- [ ] **Step 3: Create `.nvmrc`**

```
20
```

- [ ] **Step 4: Create minimal server stub**

Create `server/index.js`:
```js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'public')));

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Evil Jeopardy² server running on http://localhost:${PORT}`);
  console.log(`Local network: http://${getLocalIP()}:${PORT}`);
});

function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}
```

- [ ] **Step 5: Create placeholder `public/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Evil Jeopardy²</title>
</head>
<body>
  <h1>Evil Jeopardy²</h1>
  <p>Server is running.</p>
</body>
</html>
```

- [ ] **Step 6: Verify server starts**

```bash
npm start
```

Expected: `Evil Jeopardy² server running on http://localhost:3000` and page loads in browser.

- [ ] **Step 7: Commit**

```bash
git add server/ public/ package.json package-lock.json .nvmrc
git commit -m "feat: project scaffolding — Express + Socket.IO server"
```

---

## Task 2: Game State Module

**Files:**
- Create: `server/gameState.js`
- Create: `tests/gameState.test.js`

This is the core data model. All game state lives here. Pure functions, no Socket.IO coupling.

- [ ] **Step 1: Write failing tests for game state**

Create `tests/gameState.test.js`:
```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  createGame,
  addPlayer,
  removePlayer,
  getPlayer,
  startGame,
  startNestedGame,
  endNestedGame,
  updateScore,
  getStandings,
  resetNestedScores,
  setPhase,
  getAnswerOrder,
  startFinalJeopardy,
  submitWager,
  submitFinalAnswer,
  revealFinalAnswer,
} = require('../server/gameState');

describe('createGame', () => {
  it('creates a game in LOBBY phase', () => {
    const game = createGame();
    assert.equal(game.phase, 'LOBBY');
    assert.deepEqual(game.players, {});
  });
});

describe('addPlayer / removePlayer', () => {
  it('adds a player with zero scores', () => {
    const game = createGame();
    addPlayer(game, 'socket1', 'Steve');
    const p = getPlayer(game, 'socket1');
    assert.equal(p.name, 'Steve');
    assert.equal(p.mainScore, 0);
    assert.equal(p.nestedScore, 0);
  });

  it('removes a player', () => {
    const game = createGame();
    addPlayer(game, 'socket1', 'Steve');
    removePlayer(game, 'socket1');
    assert.equal(getPlayer(game, 'socket1'), undefined);
  });

  it('preserves player on disconnect if game started', () => {
    const game = createGame();
    addPlayer(game, 'socket1', 'Steve');
    startGame(game);
    removePlayer(game, 'socket1');
    const p = getPlayer(game, 'socket1');
    assert.equal(p.name, 'Steve');
    assert.equal(p.connected, false);
  });
});

describe('scoring', () => {
  it('updates nested score', () => {
    const game = createGame();
    addPlayer(game, 's1', 'A');
    updateScore(game, 's1', 'nested', 300);
    assert.equal(getPlayer(game, 's1').nestedScore, 300);
  });

  it('updates main score', () => {
    const game = createGame();
    addPlayer(game, 's1', 'A');
    updateScore(game, 's1', 'main', -200);
    assert.equal(getPlayer(game, 's1').mainScore, -200);
  });

  it('resets nested scores', () => {
    const game = createGame();
    addPlayer(game, 's1', 'A');
    addPlayer(game, 's2', 'B');
    updateScore(game, 's1', 'nested', 500);
    updateScore(game, 's2', 'nested', 300);
    resetNestedScores(game);
    assert.equal(getPlayer(game, 's1').nestedScore, 0);
    assert.equal(getPlayer(game, 's2').nestedScore, 0);
  });
});

describe('nested game flow', () => {
  it('starts nested game and resets nested scores', () => {
    const game = createGame();
    addPlayer(game, 's1', 'A');
    addPlayer(game, 's2', 'B');
    startGame(game);
    updateScore(game, 's1', 'nested', 100);
    startNestedGame(game);
    assert.equal(game.phase, 'NESTED_GAME');
    assert.equal(getPlayer(game, 's1').nestedScore, 0);
  });

  it('ends nested game and calculates placement', () => {
    const game = createGame();
    addPlayer(game, 's1', 'A');
    addPlayer(game, 's2', 'B');
    addPlayer(game, 's3', 'C');
    startGame(game);
    startNestedGame(game);
    updateScore(game, 's2', 'nested', 500);
    updateScore(game, 's1', 'nested', 300);
    updateScore(game, 's3', 'nested', -100);
    const placement = endNestedGame(game);
    assert.equal(game.phase, 'MAIN_ANSWER');
    assert.equal(placement[0].name, 'B');
    assert.equal(placement[1].name, 'A');
    assert.equal(placement[2].name, 'C');
  });
});

describe('standings', () => {
  it('returns players sorted by score for given context', () => {
    const game = createGame();
    addPlayer(game, 's1', 'A');
    addPlayer(game, 's2', 'B');
    updateScore(game, 's1', 'main', 200);
    updateScore(game, 's2', 'main', 500);
    const standings = getStandings(game, 'main');
    assert.equal(standings[0].name, 'B');
    assert.equal(standings[1].name, 'A');
  });
});

describe('answer order', () => {
  it('returns buzz order during nested game', () => {
    const game = createGame();
    addPlayer(game, 's1', 'A');
    addPlayer(game, 's2', 'B');
    addPlayer(game, 's3', 'C');
    startGame(game);
    startNestedGame(game);
    game.buzzOrder = ['s2', 's1'];
    const order = getAnswerOrder(game);
    assert.equal(order[0], 's2');
    assert.equal(order[1], 's1');
    assert.equal(order[2], 's3');
  });
});

describe('final jeopardy', () => {
  it('accepts wagers and answers', () => {
    const game = createGame();
    addPlayer(game, 's1', 'A');
    addPlayer(game, 's2', 'B');
    startGame(game);
    startFinalJeopardy(game);
    assert.equal(game.phase, 'FINAL_JEOPARDY');
    submitWager(game, 's1', 200);
    submitFinalAnswer(game, 's1', 'What is gravity?');
    assert.equal(game.finalJeopardy.s1.wager, 200);
    assert.equal(game.finalJeopardy.s1.answer, 'What is gravity?');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: All tests fail — `gameState` module doesn't exist yet.

- [ ] **Step 3: Implement `server/gameState.js`**

Create `server/gameState.js`:
```js
function createGame() {
  return {
    phase: 'LOBBY',
    players: {},
    playerOrder: [],
    buzzOrder: [],
    currentAnswerIndex: 0,
    currentPointValue: 0,
    nestedPlacement: [],
    finalJeopardy: {},
  };
}

function addPlayer(game, socketId, name) {
  game.players[socketId] = {
    name,
    mainScore: 0,
    nestedScore: 0,
    connected: true,
    avgLatency: 0,
  };
  game.playerOrder.push(socketId);
}

function removePlayer(game, socketId) {
  if (game.phase === 'LOBBY') {
    delete game.players[socketId];
    game.playerOrder = game.playerOrder.filter((id) => id !== socketId);
  } else {
    if (game.players[socketId]) {
      game.players[socketId].connected = false;
    }
  }
}

function reconnectPlayer(game, oldSocketId, newSocketId) {
  const player = game.players[oldSocketId];
  if (!player) return false;
  player.connected = true;
  game.players[newSocketId] = player;
  delete game.players[oldSocketId];
  game.playerOrder = game.playerOrder.map((id) =>
    id === oldSocketId ? newSocketId : id
  );
  return true;
}

function getPlayer(game, socketId) {
  return game.players[socketId];
}

function getAllPlayers(game) {
  return Object.entries(game.players).map(([id, p]) => ({
    id,
    ...p,
  }));
}

function startGame(game) {
  game.phase = 'MAIN_BOARD';
}

function startNestedGame(game) {
  resetNestedScores(game);
  game.buzzOrder = [];
  game.currentAnswerIndex = 0;
  game.phase = 'NESTED_GAME';
}

function endNestedGame(game) {
  const placement = getStandings(game, 'nested');
  game.nestedPlacement = placement.map((p) => p.id);
  game.currentAnswerIndex = 0;
  game.phase = 'MAIN_ANSWER';
  return placement;
}

function updateScore(game, socketId, context, delta) {
  const player = game.players[socketId];
  if (!player) return;
  if (context === 'main') {
    player.mainScore += delta;
  } else if (context === 'nested') {
    player.nestedScore += delta;
  }
}

function setScore(game, socketId, context, amount) {
  const player = game.players[socketId];
  if (!player) return;
  if (context === 'main') {
    player.mainScore = amount;
  } else if (context === 'nested') {
    player.nestedScore = amount;
  }
}

function resetNestedScores(game) {
  for (const player of Object.values(game.players)) {
    player.nestedScore = 0;
  }
}

function getStandings(game, context) {
  const scoreKey = context === 'main' ? 'mainScore' : 'nestedScore';
  return Object.entries(game.players)
    .map(([id, p]) => ({ id, name: p.name, score: p[scoreKey] }))
    .sort((a, b) => b.score - a.score);
}

function getAnswerOrder(game) {
  if (game.phase === 'MAIN_ANSWER') {
    return game.nestedPlacement;
  }
  const buzzed = [...game.buzzOrder];
  const notBuzzed = game.playerOrder.filter((id) => !buzzed.includes(id));
  return [...buzzed, ...notBuzzed];
}

function setPhase(game, phase) {
  game.phase = phase;
}

function startFinalJeopardy(game) {
  game.phase = 'FINAL_JEOPARDY';
  game.finalJeopardy = {};
  for (const id of game.playerOrder) {
    game.finalJeopardy[id] = { wager: null, answer: null, correct: null };
  }
}

function submitWager(game, socketId, amount) {
  if (game.finalJeopardy[socketId]) {
    game.finalJeopardy[socketId].wager = Math.max(0, amount);
  }
}

function submitFinalAnswer(game, socketId, answer) {
  if (game.finalJeopardy[socketId]) {
    game.finalJeopardy[socketId].answer = answer;
  }
}

function revealFinalAnswer(game, socketId, correct) {
  const fj = game.finalJeopardy[socketId];
  if (!fj) return;
  fj.correct = correct;
  const delta = correct ? fj.wager : -fj.wager;
  updateScore(game, socketId, 'main', delta);
}

function getClientState(game, socketId) {
  return {
    phase: game.phase,
    players: getAllPlayers(game),
    currentPointValue: game.currentPointValue,
    nestedPlacement: game.nestedPlacement,
    buzzOrder: game.buzzOrder,
    currentAnswerIndex: game.currentAnswerIndex,
    finalJeopardy: game.finalJeopardy,
    you: socketId,
  };
}

module.exports = {
  createGame,
  addPlayer,
  removePlayer,
  reconnectPlayer,
  getPlayer,
  getAllPlayers,
  startGame,
  startNestedGame,
  endNestedGame,
  updateScore,
  setScore,
  resetNestedScores,
  getStandings,
  getAnswerOrder,
  setPhase,
  startFinalJeopardy,
  submitWager,
  submitFinalAnswer,
  revealFinalAnswer,
  getClientState,
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/gameState.js tests/gameState.test.js
git commit -m "feat: game state module with full test coverage"
```

---

## Task 3: Latency Calibration Module

**Files:**
- Create: `server/latency.js`
- Create: `tests/latency.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/latency.test.js`:
```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateAvgLatency, shouldRecalibrate } = require('../server/latency');

describe('calculateAvgLatency', () => {
  it('averages RTT samples', () => {
    const samples = [10, 20, 30, 40, 50];
    assert.equal(calculateAvgLatency(samples), 30);
  });

  it('drops highest and lowest when 5+ samples', () => {
    const samples = [10, 20, 30, 40, 100];
    // drops 10 and 100, avg of [20, 30, 40] = 30
    assert.equal(calculateAvgLatency(samples), 30);
  });

  it('returns 0 for empty samples', () => {
    assert.equal(calculateAvgLatency([]), 0);
  });
});

describe('shouldRecalibrate', () => {
  it('returns true after 5 minutes', () => {
    const lastCalibration = Date.now() - 6 * 60 * 1000;
    assert.equal(shouldRecalibrate(lastCalibration), true);
  });

  it('returns false before 5 minutes', () => {
    const lastCalibration = Date.now() - 2 * 60 * 1000;
    assert.equal(shouldRecalibrate(lastCalibration), false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

- [ ] **Step 3: Implement `server/latency.js`**

```js
const CALIBRATION_INTERVAL_MS = 5 * 60 * 1000;
const PING_COUNT = 10;

function calculateAvgLatency(samples) {
  if (samples.length === 0) return 0;
  if (samples.length >= 5) {
    const sorted = [...samples].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    return Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
  }
  return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
}

function shouldRecalibrate(lastCalibrationTime) {
  return Date.now() - lastCalibrationTime > CALIBRATION_INTERVAL_MS;
}

function createCalibrationSession() {
  return {
    samples: [],
    pingsSent: 0,
    startTime: null,
  };
}

function recordPingSent(session) {
  session.startTime = Date.now();
  session.pingsSent++;
}

function recordPong(session) {
  if (session.startTime) {
    session.samples.push(Date.now() - session.startTime);
    session.startTime = null;
  }
  return session.pingsSent >= PING_COUNT;
}

module.exports = {
  PING_COUNT,
  CALIBRATION_INTERVAL_MS,
  calculateAvgLatency,
  shouldRecalibrate,
  createCalibrationSession,
  recordPingSent,
  recordPong,
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add server/latency.js tests/latency.test.js
git commit -m "feat: latency calibration module with trimmed-mean RTT"
```

---

## Task 4: Buzz Queue Module

**Files:**
- Create: `server/buzzQueue.js`
- Create: `tests/buzzQueue.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/buzzQueue.test.js`:
```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createBuzzQueue, recordBuzz, getBuzzWinner, isOpen, open, lock, reset } = require('../server/buzzQueue');

describe('buzz queue', () => {
  it('starts closed', () => {
    const q = createBuzzQueue();
    assert.equal(isOpen(q), false);
  });

  it('can be opened and locked', () => {
    const q = createBuzzQueue();
    open(q, 300);
    assert.equal(isOpen(q), true);
    assert.equal(q.pointValue, 300);
    lock(q);
    assert.equal(isOpen(q), false);
  });

  it('ignores buzzes when closed', () => {
    const q = createBuzzQueue();
    const recorded = recordBuzz(q, 'player1', 100, 5);
    assert.equal(recorded, false);
  });

  it('records buzz with latency adjustment', () => {
    const q = createBuzzQueue();
    open(q, 200);
    const now = Date.now();
    recordBuzz(q, 'player1', now, 100);
    recordBuzz(q, 'player2', now + 10, 20);
    // player1 adjusted: now - 50 = now - 50
    // player2 adjusted: now + 10 - 10 = now
    // player2 pressed later but has lower latency... 
    // player1 adjusted time is earlier (now - 50 < now)
    const winner = getBuzzWinner(q);
    assert.equal(winner.socketId, 'player1');
  });

  it('handles tie within 10ms with tiebreak', () => {
    const q = createBuzzQueue();
    open(q, 100);
    const now = Date.now();
    recordBuzz(q, 'p1', now, 20);
    recordBuzz(q, 'p2', now + 5, 30);
    // p1 adjusted: now - 10
    // p2 adjusted: now + 5 - 15 = now - 10
    // Within 10ms — tie
    const winner = getBuzzWinner(q);
    assert.ok(['p1', 'p2'].includes(winner.socketId));
    assert.equal(winner.tie, true);
  });

  it('prevents duplicate buzzes from same player', () => {
    const q = createBuzzQueue();
    open(q, 200);
    const now = Date.now();
    recordBuzz(q, 'p1', now, 10);
    recordBuzz(q, 'p1', now + 100, 10);
    assert.equal(q.buzzes.length, 1);
  });

  it('resets for next question', () => {
    const q = createBuzzQueue();
    open(q, 200);
    recordBuzz(q, 'p1', Date.now(), 10);
    reset(q);
    assert.equal(q.buzzes.length, 0);
    assert.equal(isOpen(q), false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

- [ ] **Step 3: Implement `server/buzzQueue.js`**

```js
const TIE_THRESHOLD_MS = 10;

function createBuzzQueue() {
  return {
    buzzes: [],
    isOpen: false,
    pointValue: 0,
    openedAt: null,
  };
}

function open(queue, pointValue) {
  queue.buzzes = [];
  queue.isOpen = true;
  queue.pointValue = pointValue;
  queue.openedAt = Date.now();
}

function lock(queue) {
  queue.isOpen = false;
}

function isOpen(queue) {
  return queue.isOpen;
}

function recordBuzz(queue, socketId, serverReceiveTime, avgLatency) {
  if (!queue.isOpen) return false;
  if (queue.buzzes.some((b) => b.socketId === socketId)) return false;

  const adjustedTime = serverReceiveTime - avgLatency / 2;
  queue.buzzes.push({ socketId, serverReceiveTime, adjustedTime, avgLatency });
  queue.buzzes.sort((a, b) => a.adjustedTime - b.adjustedTime);
  return true;
}

function getBuzzWinner(queue) {
  if (queue.buzzes.length === 0) return null;

  const first = queue.buzzes[0];
  if (queue.buzzes.length === 1) {
    return { socketId: first.socketId, adjustedTime: first.adjustedTime, tie: false };
  }

  const second = queue.buzzes[1];
  const diff = Math.abs(first.adjustedTime - second.adjustedTime);

  if (diff <= TIE_THRESHOLD_MS) {
    const coinFlip = Math.random() < 0.5 ? 0 : 1;
    const winner = coinFlip === 0 ? first : second;
    return { socketId: winner.socketId, adjustedTime: winner.adjustedTime, tie: true };
  }

  return { socketId: first.socketId, adjustedTime: first.adjustedTime, tie: false };
}

function getBuzzOrder(queue) {
  return queue.buzzes.map((b) => b.socketId);
}

function reset(queue) {
  queue.buzzes = [];
  queue.isOpen = false;
  queue.pointValue = 0;
  queue.openedAt = null;
}

module.exports = {
  createBuzzQueue,
  open,
  lock,
  isOpen,
  recordBuzz,
  getBuzzWinner,
  getBuzzOrder,
  reset,
  TIE_THRESHOLD_MS,
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add server/buzzQueue.js tests/buzzQueue.test.js
git commit -m "feat: buzz queue with latency compensation and tie detection"
```

---

## Task 5: Shared CSS Theme

**Files:**
- Create: `public/css/style.css`

No tests needed — visual output only.

- [ ] **Step 1: Create dark Jeopardy theme**

Create `public/css/style.css` — a mobile-first dark theme with Jeopardy-blue aesthetic. Must include:
- CSS reset + box-sizing
- Dark blue background (`#060CE9` Jeopardy blue for accents, `#0a0a2e` for page background)
- White/gold text for readability on phones
- `.buzz-btn` — large circular red button (160px diameter), pulse animation on press, disabled state (grayed out)
- `.score-box` — compact score display with label, value, and rank
- `.standings` — list with rank coloring (1st=gold, 2nd=silver, 3rd=bronze)
- `.host-controls` — grid of action buttons
- `.scoreboard` — table with player rows
- `.status-bar` — game phase indicator
- `.buzz-result` — highlighted display of who buzzed first
- `.correct-btn`, `.wrong-btn` — green/red action buttons
- `.connection-dot` — green/yellow/red circle indicators
- `.final-jeopardy` — wager input + answer textarea styling
- `.lobby` — centered card layout for name entry
- Responsive: works well on phones (320px-428px width) and laptop screens
- Animations: `@keyframes buzz-pulse` for buzz button feedback

- [ ] **Step 2: Verify CSS loads**

Temporarily add `<link rel="stylesheet" href="/css/style.css">` to `public/index.html`, start server, verify styles load in browser (dark background visible).

- [ ] **Step 3: Commit**

```bash
git add public/css/style.css
git commit -m "feat: dark Jeopardy theme CSS (mobile-first)"
```

---

## Task 6: Shared Socket Setup Module

**Files:**
- Create: `public/js/socket-setup.js`

- [ ] **Step 1: Create shared socket connection module**

Create `public/js/socket-setup.js`:
```js
function createSocket() {
  const socket = io({
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
  });

  const statusEl = document.getElementById('connection-status');

  socket.on('connect', () => {
    if (statusEl) statusEl.className = 'connection-dot connected';
    console.log('Connected:', socket.id);
  });

  socket.on('disconnect', () => {
    if (statusEl) statusEl.className = 'connection-dot disconnected';
    console.log('Disconnected');
  });

  socket.on('reconnect_attempt', (attempt) => {
    if (statusEl) statusEl.className = 'connection-dot reconnecting';
    console.log('Reconnecting...', attempt);
  });

  return socket;
}
```

- [ ] **Step 2: Commit**

```bash
git add public/js/socket-setup.js
git commit -m "feat: shared Socket.IO connection module with auto-reconnect"
```

---

## Task 7: Lobby Page

**Files:**
- Modify: `public/index.html`
- Create: `public/js/lobby.js`

- [ ] **Step 1: Build lobby HTML**

Replace `public/index.html` with the full lobby page:
- Title: "Evil Jeopardy²"
- Name input field + "Join Game" button
- Connection status dot
- Waiting message (shown after joining, hidden before)
- Player list (who else is in the lobby)
- Includes Socket.IO client library, `socket-setup.js`, and `lobby.js`

- [ ] **Step 2: Build lobby client logic**

Create `public/js/lobby.js`:
- On "Join Game" click: emit `player:join` with name, hide input, show waiting state
- Listen for `lobby:players` — update player list
- Listen for `phase:change` — when phase becomes `MAIN_BOARD`, redirect to `/play`
- Handle latency calibration: listen for `latency:ping`, respond with `latency:pong`

- [ ] **Step 3: Wire up server-side lobby events**

Modify `server/index.js`:
- On `player:join`: call `addPlayer()`, broadcast updated player list, start latency calibration
- On `host:startGame`: call `startGame()`, broadcast `phase:change` to all
- Implement calibration loop: send `latency:ping`, wait for `latency:pong`, repeat 10x, store avg

- [ ] **Step 4: Manual test**

Start server, open `http://localhost:3000` in two browser tabs. Enter names in both. Verify:
- Both names appear in each tab's player list
- Connection status shows green

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/js/lobby.js server/index.js
git commit -m "feat: lobby page with player join, calibration, and player list"
```

---

## Task 8: Host Dashboard

**Files:**
- Create: `public/host.html`
- Create: `public/js/host.js`
- Modify: `server/index.js`

- [ ] **Step 1: Build host HTML**

Create `public/host.html`:
- Route: `/host.html` (served as static file)
- Game controls section: Start Game, Open/Lock Buzzing (with point value input), Start/End Nested, Next Player, Start Final Jeopardy
- Buzz result display: who buzzed, adjusted time, Correct/Wrong buttons
- Scoreboard table: all players with name, main score, nested score, connection status
- Score editing: click any score cell to edit inline
- Restore panel: expandable section with manual score entry fields
- Connection monitor: dots per player

- [ ] **Step 2: Build host client logic**

Create `public/js/host.js`:
- Emit host events: `host:openBuzz`, `host:lockBuzz`, `host:markAnswer`, `host:startNested`, `host:endNested`, `host:nextPlayer`, `host:editScore`, `host:startFinal`, `host:startGame`
- Listen for `game:state` — full state sync on connect
- Listen for `buzz:winner` — display who buzzed first with Correct/Wrong buttons
- Listen for `score:update` — refresh scoreboard
- Listen for `phase:change` — update UI controls based on current phase
- Listen for `answer:next` — highlight current answering player
- Score editing: click cell → input field → on blur emit `host:editScore`

- [ ] **Step 3: Wire up server-side host events**

Modify `server/index.js` to handle all `host:*` events:
- `host:openBuzz` → open buzz queue, broadcast `buzz:open`
- `host:lockBuzz` → lock buzz queue, broadcast `buzz:locked`
- `host:markAnswer` → update score (+ or - pointValue for correct/wrong), broadcast `score:update`, advance to next player
- `host:startNested` → call `startNestedGame()`, broadcast `phase:change`
- `host:endNested` → call `endNestedGame()`, broadcast `phase:change` with placement
- `host:nextPlayer` → increment answer index, broadcast `answer:next`
- `host:editScore` → call `setScore()`, broadcast `score:update`
- `host:startFinal` → call `startFinalJeopardy()`, broadcast `phase:change`
- `host:startGame` → call `startGame()`, broadcast `phase:change`
- `host:revealAnswer` → call `revealFinalAnswer()`, broadcast results

- [ ] **Step 4: Manual test**

Start server. Open `/host.html` in one tab, `/` in two other tabs as players. Join both players. Click "Start Game" on host. Verify:
- Host sees both players in scoreboard
- Phase shows MAIN_BOARD
- Player tabs redirect to `/play`

- [ ] **Step 5: Commit**

```bash
git add public/host.html public/js/host.js server/index.js
git commit -m "feat: host dashboard with game controls and live scoreboard"
```

---

## Task 9: Player View

**Files:**
- Create: `public/play.html`
- Create: `public/js/player.js`
- Modify: `server/index.js`

- [ ] **Step 1: Build player HTML**

Create `public/play.html`:
- Player name display at top
- Score boxes: main board score + rank, nested game score + rank
- Game status bar (current phase, point value)
- Big BUZZ button (centered, disabled by default)
- Answer turn indicator ("YOUR TURN TO ANSWER!" — hidden by default, shown when it's their turn)
- Standings list (collapsible)
- Final Jeopardy section (hidden by default): wager input, answer textarea, submit button

- [ ] **Step 2: Build player client logic**

Create `public/js/player.js`:
- On page load: emit `player:reconnect` with stored name (from sessionStorage)
- Buzz button click: if enabled, emit `buzz:press` with `Date.now()`, disable button, show "Buzzed!" feedback
- Listen for `buzz:open` → enable buzz button, show point value
- Listen for `buzz:locked` → disable buzz button
- Listen for `buzz:winner` → show who won the buzz
- Listen for `answer:next` → if it's this player, highlight "YOUR TURN"
- Listen for `score:update` → update score boxes and standings
- Listen for `phase:change` → update status bar, show/hide nested score box, show/hide Final Jeopardy UI
- Listen for `game:state` → full state restoration on reconnect
- Final Jeopardy: submit wager → emit `final:submitWager`, submit answer → emit `final:submitAnswer`

- [ ] **Step 3: Wire up server-side buzz handling**

Modify `server/index.js`:
- On `buzz:press`: call `recordBuzz()` with server timestamp and player's `avgLatency`. If first buzz, auto-lock and broadcast `buzz:winner`. Store buzz order in game state.
- On reconnect: detect player by name (sessionStorage sends name), call `reconnectPlayer()`, send `game:state`

- [ ] **Step 4: Manual test — full game flow**

Start server. Open host + 3 player tabs. Test complete flow:
1. Players join in lobby → host sees them
2. Host clicks "Start Game" → players redirect to `/play`
3. Host clicks "Start Nested" → phase changes
4. Host clicks "Open Buzzing ($300)" → player buzz buttons activate
5. Player clicks buzz → host sees winner → marks correct → score updates
6. Host clicks "Next Player" → next player's turn indicator shows
7. Repeat for a few questions
8. Host clicks "End Nested" → placement displayed, phase changes to MAIN_ANSWER
9. Players answer in placement order
10. Host clicks "Start Final Jeopardy" → players see wager/answer inputs

- [ ] **Step 5: Commit**

```bash
git add public/play.html public/js/player.js server/index.js
git commit -m "feat: player view with buzz button, scores, and Final Jeopardy"
```

---

## Task 10: Final Jeopardy Flow

**Files:**
- Modify: `server/index.js`
- Modify: `public/js/host.js`
- Modify: `public/js/player.js`

- [ ] **Step 1: Implement Final Jeopardy server logic**

In `server/index.js`:
- `host:startFinal` → transition to FINAL_JEOPARDY, broadcast `final:wager`
- `final:submitWager` → store wager, once all wagers received broadcast `final:answer`
- `final:submitAnswer` → store answer, once all answers received notify host
- `host:revealAnswer` → call `revealFinalAnswer()`, broadcast result for that player, update scores

- [ ] **Step 2: Implement Final Jeopardy host UI**

In `public/js/host.js`:
- Show "All wagers submitted" / "Waiting for N wagers" status
- Show "All answers submitted" / "Waiting for N answers" status
- Per-player reveal button: shows their answer, wager, and Correct/Wrong buttons
- Auto-calculate final scores after all reveals

- [ ] **Step 3: Implement Final Jeopardy player UI**

In `public/js/player.js`:
- On `final:wager`: show wager input (number field, min 0), submit button
- On `final:answer`: show answer textarea, submit button
- After submit: show "Waiting for host to reveal..."
- On reveal: show result (correct/wrong, score change)

- [ ] **Step 4: Manual test**

Test complete Final Jeopardy flow with host + 2 player tabs.

- [ ] **Step 5: Commit**

```bash
git add server/index.js public/js/host.js public/js/player.js
git commit -m "feat: Final Jeopardy with wager, answer, and reveal flow"
```

---

## Task 11: Startup Script + ngrok Integration

**Files:**
- Create: `start.sh` (or `start.bat` for Windows)
- Modify: `README.md`

- [ ] **Step 1: Create startup script**

Create `start.bat`:
```bat
@echo off
echo Starting Evil Jeopardy² server...
start /B node server/index.js
timeout /t 2 /nobreak > nul
echo.
echo Server running on http://localhost:3000
echo.
echo Starting ngrok tunnel...
echo (Make sure ngrok is installed: https://ngrok.com/download)
echo.
ngrok http 3000
```

- [ ] **Step 2: Update README**

Add to the Evil Jeopardy `README.md` in the root:
- How to install: `npm install`
- How to start: `npm start` (local only) or `start.bat` (with ngrok)
- How to play: URLs for host (`/host.html`), players (`/`), and remote player (ngrok URL)
- Game night checklist: Discord setup, slides ready, ngrok running, players joined

- [ ] **Step 3: Commit**

```bash
git add start.bat README.md
git commit -m "feat: startup script with ngrok + game night README"
```

---

## Task 12: Polish + Edge Cases

**Files:**
- Modify: various files

- [ ] **Step 1: Add sound feedback**

Add a subtle vibration on buzz (`navigator.vibrate(50)`) for mobile phones.
Add a CSS animation for the buzz button press (scale down → back).

- [ ] **Step 2: Handle edge cases**

- Buzz button shows "Waiting..." when buzzing is locked (not just disabled)
- If all players disconnect, host sees warning
- Score editing validation (must be a number)
- Prevent host from opening buzzing if already open
- Show "Game Over" screen with final standings when host ends the game

- [ ] **Step 3: Full end-to-end test**

Run through an entire simulated game with 3 browser tabs:
1. Lobby → join → start
2. Nested game (3-4 questions with buzzing)
3. End nested → answer main question in order
4. Do one more nested + main
5. Final Jeopardy → wagers → answers → reveal
6. Game Over screen

- [ ] **Step 4: Commit + push**

```bash
git add -A
git commit -m "feat: polish, edge cases, and vibration feedback"
git push
```

---

## Summary

| Task | What | Estimated Complexity |
|------|------|---------------------|
| 1 | Project scaffolding | Low |
| 2 | Game state module + tests | Medium |
| 3 | Latency calibration + tests | Low |
| 4 | Buzz queue + tests | Medium |
| 5 | CSS theme | Medium |
| 6 | Socket setup module | Low |
| 7 | Lobby page | Medium |
| 8 | Host dashboard | High |
| 9 | Player view | High |
| 10 | Final Jeopardy flow | Medium |
| 11 | Startup script + README | Low |
| 12 | Polish + edge cases | Medium |
