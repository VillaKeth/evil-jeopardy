# Evil Jeopardy 1.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete hybrid game show production system — trivia, shop, and virtual cake-baking game — that serves a Host Dashboard, Big Screen projection, and a remote Virtual Player client in a single web app.

**Architecture:** Node.js + Express backend with Socket.io for real-time sync across three views. SQLite for game state persistence. Phaser.js 3 for the virtual player's cake-baking minigames. HuggingFace AI API + Sharp for cake image generation. All game content (questions, shop items, minigames, evil luck events) is data-driven via JSON config files.

**Tech Stack:** Node.js, Express 5, Socket.io 4, better-sqlite3, Phaser.js 3, Sharp, HuggingFace Inference API

**Spec:** `docs/superpowers/specs/2026-05-08-evil-jeopardy-1.2-design.md`

---

## File Structure

All new code lives in `v1.2/` subdirectory to keep it separate from the existing Evil Jeopardy 1.0 codebase.

```
v1.2/
├── package.json
├── server/
│   ├── index.js              # Express + Socket.io entry point, phase state machine
│   ├── db.js                 # SQLite schema + helpers
│   ├── trivia.js             # Question loading, scoring, forced-answer logic
│   ├── shop.js               # Shop inventory, purchases, default kits
│   ├── baking.js             # Baking timer, phase management, score aggregation
│   ├── evil-luck.js          # Chaos probability engine, minigame selection
│   ├── cake-generator.js     # AI image prompt builder, HuggingFace API, Sharp post-processing
│   └── judging.js            # Physical + virtual scoring, final team scores
├── public/
│   ├── host.html             # Host dashboard (all show controls)
│   ├── screen.html           # Big screen / projector view
│   ├── player.html           # Virtual player client (trivia + shop + Phaser game)
│   ├── css/
│   │   └── style.css         # Shared styles
│   ├── js/
│   │   ├── host.js           # Host dashboard Socket.io client
│   │   ├── screen.js         # Big screen Socket.io client
│   │   ├── player.js         # Virtual player Socket.io client + Phaser bootstrap
│   │   └── phaser-game/
│   │       ├── config.js     # Phaser game config + scene registry
│   │       ├── HUDScene.js   # Persistent HUD overlay (timer, score, ingredients)
│   │       ├── PhaseSelectScene.js  # Phase transition screen
│   │       ├── PrepScene.js         # Phase 1: ingredient measurement
│   │       ├── MixScene.js          # Phase 2: mixing batter
│   │       ├── BakeScene.js         # Phase 3: oven temperature control
│   │       ├── CoolScene.js         # Phase 4: cooling patience game
│   │       ├── DecorateScene.js     # Phase 5: free-form decorating
│   │       ├── PresentScene.js      # Phase 6: final plating
│   │       ├── ResultScene.js       # Cake reveal + score display
│   │       ├── absurd/
│   │       │   ├── CowCombatScene.js
│   │       │   ├── RacingOvenScene.js
│   │       │   ├── JewelSortScene.js
│   │       │   ├── GravityFlipScene.js
│   │       │   └── ObstacleCourseScene.js
│   │       └── EvilEventOverlay.js  # Chaos event visual effects
│   └── assets/
│       ├── media/            # Question media files (uploaded by host)
│       ├── sounds/
│       │   ├── buzz.mp3
│       │   ├── correct.mp3
│       │   ├── wrong.mp3
│       │   ├── chaos.mp3
│       │   └── reveal.mp3
│       ├── minigame/         # Sprites, textures for Phaser scenes
│       └── cake-fallbacks/   # Pre-made cake images by tier (0-19, 20-39, etc.)
├── data/
│   ├── questions.json        # All trivia content
│   ├── shop.json             # Shop catalog (items + cakes + tools + boosts)
│   ├── minigames.json        # Minigame pool per phase
│   └── evil-luck.json        # Chaos events and probability tables
└── tests/
    ├── trivia.test.js
    ├── shop.test.js
    ├── evil-luck.test.js
    ├── baking.test.js
    ├── cake-generator.test.js
    └── judging.test.js
```

---

## Milestone 1: Project Scaffolding & Core Server

### Task 1: Initialize Project

**Files:**
- Create: `v1.2/package.json`
- Create: `v1.2/.gitignore`

- [ ] **Step 1: Create v1.2 directory and package.json**

```json
{
  "name": "evil-jeopardy-1.2",
  "version": "1.0.0",
  "description": "Evil Jeopardy 1.2 — Hybrid game show with virtual cake baking",
  "main": "server/index.js",
  "type": "commonjs",
  "scripts": {
    "start": "node server/index.js",
    "dev": "node --watch server/index.js",
    "test": "node --test tests/",
    "tunnel": "npx lt --port 3001"
  },
  "dependencies": {
    "better-sqlite3": "^12.9.0",
    "express": "^5.2.1",
    "phaser": "^3.87.0",
    "sharp": "^0.34.5",
    "socket.io": "^4.8.3"
  },
  "devDependencies": {
    "localtunnel": "^2.0.2"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
data/*.db
data/*.db-shm
data/*.db-wal
public/assets/media/*
!public/assets/media/.gitkeep
```

- [ ] **Step 3: Install dependencies**

Run: `cd v1.2 && npm install`
Expected: clean install, node_modules created

- [ ] **Step 4: Create directory structure**

Create all subdirectories: `server/`, `public/css/`, `public/js/phaser-game/absurd/`, `public/assets/media/`, `public/assets/sounds/`, `public/assets/minigame/`, `public/assets/cake-fallbacks/`, `data/`, `tests/`

Add `.gitkeep` to empty asset directories.

- [ ] **Step 5: Commit**

```bash
git add v1.2/
git commit -m "feat(1.2): initialize Evil Jeopardy 1.2 project scaffold"
```

---

### Task 2: Express + Socket.io Server & Phase State Machine

**Files:**
- Create: `v1.2/server/index.js`
- Create: `v1.2/server/db.js`

- [ ] **Step 1: Write server test**

Create `v1.2/tests/server.test.js`:

```js
const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('Server', () => {
  it('should export createApp function', () => {
    const { createApp } = require('../server/index.js');
    assert.ok(typeof createApp === 'function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v1.2 && node --test tests/server.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write db.js — SQLite schema**

Create `v1.2/server/db.js` with tables:
- `teams` (id, name, money INTEGER DEFAULT 0, is_virtual_team BOOLEAN, created_at)
- `purchases` (id, team_id, item_key TEXT, category TEXT, price INTEGER, approved_by_host BOOLEAN DEFAULT 1, created_at)
- `game_state` (key TEXT PRIMARY KEY, value TEXT) — stores current phase, timer state, etc.
- `scores` (id, team_id, dimension TEXT, value INTEGER, source TEXT — 'virtual' or 'physical', created_at)
- `events` (id, type TEXT, data TEXT, created_at) — event log

Export: `initDb(dbPath)` → returns db instance with helper methods.

- [ ] **Step 4: Write index.js — Express + Socket.io + phase state machine**

Create `v1.2/server/index.js`:
- Express app serving `public/` directory
- Socket.io with namespaces or rooms: `host`, `screen`, `player`
- Phase state machine: `LOBBY → TRIVIA → SHOP → BAKING → JUDGING → RESULTS`
- Socket events: `join-team`, `set-phase`, `get-state`
- `createApp(options)` export for testing + `if (require.main === module)` block for direct run
- Listen on port 3001 (different from v1.0's 3000)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd v1.2 && node --test tests/server.test.js`
Expected: PASS

- [ ] **Step 6: Manual smoke test**

Run: `cd v1.2 && node server/index.js`
Visit http://localhost:3001 — should serve a blank page (no HTML yet)
Ctrl+C to stop.

- [ ] **Step 7: Commit**

```bash
git add v1.2/server/ v1.2/tests/
git commit -m "feat(1.2): add Express + Socket.io server with phase state machine"
```

---

### Task 3: Lobby System & HTML Shells

**Files:**
- Create: `v1.2/public/host.html`
- Create: `v1.2/public/screen.html`
- Create: `v1.2/public/player.html`
- Create: `v1.2/public/css/style.css`
- Create: `v1.2/public/js/host.js`
- Create: `v1.2/public/js/screen.js`
- Create: `v1.2/public/js/player.js`

- [ ] **Step 1: Create shared CSS**

Create `v1.2/public/css/style.css` with dark theme base styles (background: #0d1117, text: #c9d1d9, accent colors for each phase). Include responsive layout utilities and common component styles (cards, buttons, scoreboard).

- [ ] **Step 2: Create host.html shell**

Minimal HTML with Socket.io client, phase indicator, team list, and a "phase control" panel. Each show phase will add its own section. For now, just LOBBY view: see connected teams, start game button.

- [ ] **Step 3: Create screen.html shell**

Big screen view — large text, scoreboard, phase indicator. LOBBY view shows team names waiting to start. Designed for projection (large fonts, high contrast).

- [ ] **Step 4: Create player.html shell**

Virtual player view — connection status, team assignment, phase indicator. LOBBY view shows "Waiting for host to start..." with their team name.

- [ ] **Step 5: Create host.js, screen.js, player.js client scripts**

Each connects to Socket.io, handles `phase-changed` event to show/hide phase-specific sections, sends `join-team` with role identification.

- [ ] **Step 6: Add lobby Socket.io handlers to server**

Handle `join-team` (name, role: host/screen/player), broadcast `team-joined` and `teams-updated` to all clients. Handle `start-game` from host → transition to TRIVIA phase.

- [ ] **Step 7: Manual integration test**

Run server. Open host.html in one tab, screen.html in another, player.html in a third. Verify teams appear on all screens. Click "Start Game" on host → all views transition to TRIVIA phase placeholder.

- [ ] **Step 8: Commit**

```bash
git add v1.2/public/
git commit -m "feat(1.2): add lobby system with host, screen, and player views"
```

---

## Milestone 2: Trivia Engine

### Task 4: Question Data Model & Loader

**Files:**
- Create: `v1.2/data/questions.json`
- Create: `v1.2/server/trivia.js`
- Create: `v1.2/tests/trivia.test.js`

- [ ] **Step 1: Write trivia test**

Test that `loadQuestions(path)` reads questions.json and returns structured data. Test that questions have required fields: `id`, `text`, `type` (slide/jeopardy), `value`, `media` (optional), `answer`, `category` (for jeopardy).

- [ ] **Step 2: Run test — should fail**

- [ ] **Step 3: Create sample questions.json**

```json
{
  "slides": [
    {
      "id": "s1",
      "text": "What year did the first iPhone release?",
      "answer": "2007",
      "value": 500,
      "media": null,
      "awardType": "money"
    },
    {
      "id": "s2",
      "text": "Name this animal",
      "answer": "Axolotl",
      "value": 300,
      "media": { "type": "image", "src": "assets/media/axolotl.gif" },
      "awardType": "money"
    },
    {
      "id": "s-bonus1",
      "text": "Bonus: What's the main ingredient in meringue?",
      "answer": "Egg whites",
      "value": 0,
      "media": null,
      "awardType": "ingredient",
      "awardItem": "eggs-premium"
    }
  ],
  "jeopardy": {
    "categories": [
      {
        "name": "Science",
        "questions": [
          { "id": "j1", "text": "This planet has the most moons", "answer": "Saturn", "value": 100, "media": null },
          { "id": "j2", "text": "The chemical symbol for gold", "answer": "Au", "value": 200, "media": null },
          { "id": "j3", "text": "This force keeps planets in orbit", "answer": "Gravity", "value": 300, "media": null },
          { "id": "j4", "text": "Number of bones in the human body", "answer": "206", "value": 400, "media": null },
          { "id": "j5", "text": "The speed of light in km/s (approx)", "answer": "300,000", "value": 500, "media": null },
          { "id": "j6", "text": "This element has atomic number 1", "answer": "Hydrogen", "value": 600, "media": null }
        ]
      }
    ]
  }
}
```

Include 6 categories × 6 questions each for the full 6×6 board, plus 10+ slide questions.

- [ ] **Step 4: Write trivia.js**

Export: `loadQuestions(path)`, `getSlideQuestion(index)`, `getJeopardyQuestion(category, value)`, `markAnswered(questionId)`, `getBoard()` (returns 6×6 grid with answered status).

- [ ] **Step 5: Run tests — should pass**

- [ ] **Step 6: Commit**

```bash
git add v1.2/server/trivia.js v1.2/tests/trivia.test.js v1.2/data/questions.json
git commit -m "feat(1.2): add trivia question loader and data model"
```

---

### Task 5: Trivia Scoring & Forced Answer Evil Rule

**Files:**
- Modify: `v1.2/server/trivia.js`
- Modify: `v1.2/tests/trivia.test.js`

- [ ] **Step 1: Write scoring tests**

Test cases:
- `scoreAnswer(teamId, correct, value)` → adds/subtracts money
- `awardIngredient(db, teamId, itemKey)` → adds ingredient directly to team inventory (for bonus questions with `awardType: "ingredient"`)
- Forced answer rule: when host triggers `force-all-answer`, each team that hasn't buzzed must submit an answer
- `getTeamScores()` returns all team balances

- [ ] **Step 2: Run tests — should fail**

- [ ] **Step 3: Implement scoring in trivia.js**

Add functions:
- `scoreAnswer(db, teamId, questionId, correct)` — correct: +value, wrong: -value, updates teams.money. If question has `awardType: "ingredient"`, also calls `awardIngredient`.
- `awardIngredient(db, teamId, itemKey)` — inserts into purchases table with price=0 (free award from bonus question). Used for questions with `awardType: "ingredient"` and `awardItem`.
- `forceAllAnswer(db, questionId, buzzedTeamId)` — returns list of teams that must answer (excluding the team that buzzed correctly, if any)
- `getScoreboard(db)` — returns [{teamId, name, money}] sorted

- [ ] **Step 4: Run tests — should pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(1.2): add trivia scoring with forced-answer evil rule"
```

---

### Task 6: Trivia UI — Host Controls

**Files:**
- Modify: `v1.2/public/host.html`
- Modify: `v1.2/public/js/host.js`
- Modify: `v1.2/server/index.js` (add trivia socket handlers)

- [ ] **Step 1: Add trivia section to host.html**

Two modes the host can switch between:
1. **Slide Mode**: Shows current slide question with media, "Next Question" button, and per-team answer buttons (correct ✓ / wrong ✗)
2. **Jeopardy Mode**: 6×6 board grid, click cell to reveal question, then same answer buttons

Common elements: live scoreboard, "Force All Answer" button, team answer status indicators.

- [ ] **Step 2: Add trivia socket handlers to server index.js**

Events: `trivia:next-slide`, `trivia:select-jeopardy(category, value)`, `trivia:buzz(teamId)`, `trivia:score-answer(teamId, correct)`, `trivia:force-answer`, `trivia:switch-mode(slide|jeopardy)`.

Broadcast to all clients: `trivia:question-shown(question)`, `trivia:scores-updated(scoreboard)`, `trivia:buzz-received(teamId)`, `trivia:answer-result(teamId, correct)`, `trivia:force-answer-required(teamIds)`.

- [ ] **Step 3: Implement host.js trivia controls**

Wire up buttons to socket events. Show question media inline (images, GIFs render directly, audio plays on reveal). Update scoreboard in real-time.

- [ ] **Step 4: Manual test**

Run server, open host.html, advance through slides, score answers, verify scoreboard updates.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(1.2): add host trivia controls with slide and jeopardy modes"
```

---

### Task 7: Trivia UI — Big Screen & Virtual Player Views

**Files:**
- Modify: `v1.2/public/screen.html`, `v1.2/public/js/screen.js`
- Modify: `v1.2/public/player.html`, `v1.2/public/js/player.js`

- [ ] **Step 1: Big screen trivia view**

Shows: current question (large text + media), live scoreboard, category header for jeopardy. No controls — display only. Jeopardy board shows full grid with answered cells grayed out.

- [ ] **Step 2: Virtual player trivia view**

Shows: current question (same as big screen), live scoreboard, prominent **BUZZ** button. When player clicks BUZZ → `trivia:buzz` event → server plays buzz sound on host computer. Also shows "Waiting for answer..." or "Your team must answer" for forced-answer rounds.

- [ ] **Step 3: Add buzz sound playback to host**

When `trivia:buzz-received` fires on host client AND the buzzing team is the virtual player's team, play `assets/sounds/buzz.mp3` through the host's speakers.

- [ ] **Step 4: Manual integration test**

Open all three views. Host shows question → big screen and player see it. Player clicks buzz → host hears sound. Host scores → all scoreboards update.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(1.2): add big screen and virtual player trivia views with buzz button"
```

---

## Milestone 3: Shop System

### Task 8: Shop Data Model

**Files:**
- Create: `v1.2/data/shop.json`
- Create: `v1.2/server/shop.js`
- Create: `v1.2/tests/shop.test.js`

- [ ] **Step 1: Write shop tests**

Test: `loadShop(path)` returns categories with items. Test: `getDefaultKit()` returns baseline items. Test: `canAfford(teamMoney, itemPrice)` returns boolean. Test: `purchaseItem(db, teamId, itemKey)` deducts money and records purchase.

- [ ] **Step 2: Run tests — should fail**

- [ ] **Step 3: Create shop.json**

```json
{
  "categories": [
    {
      "key": "cakes",
      "name": "Cake Selection",
      "description": "Choose your cake — harder cakes are cheaper!",
      "items": [
        { "key": "cake-banana", "name": "Banana Cake", "price": 10000, "difficulty": 1, "description": "Simple and sweet", "referenceImage": "assets/cake-fallbacks/banana-ref.png" },
        { "key": "cake-chocolate-layer", "name": "3-Layer Chocolate Cake", "price": 5000, "difficulty": 3, "description": "Rich and layered" },
        { "key": "cake-wedding", "name": "Wedding Cake", "price": 2000, "difficulty": 5, "description": "Tiered elegance" },
        { "key": "cake-statue-liberty", "name": "Statue of Liberty Cake", "price": 0, "difficulty": 10, "description": "Hyperrealistic sculpture cake. Good luck." }
      ]
    },
    {
      "key": "ingredients",
      "name": "Ingredients",
      "items": [
        { "key": "flour-basic", "name": "Basic Flour", "price": 200, "quality": 1 },
        { "key": "flour-premium", "name": "Premium Flour", "price": 800, "quality": 3 },
        { "key": "eggs-basic", "name": "Eggs (Basic)", "price": 150, "quality": 1 },
        { "key": "eggs-premium", "name": "Farm Fresh Eggs", "price": 600, "quality": 3 },
        { "key": "butter-basic", "name": "Margarine", "price": 100, "quality": 1 },
        { "key": "butter-premium", "name": "European Butter", "price": 500, "quality": 3 },
        { "key": "sugar", "name": "Sugar", "price": 100, "quality": 2 },
        { "key": "chocolate", "name": "Belgian Chocolate", "price": 700, "quality": 3 },
        { "key": "vanilla", "name": "Vanilla Extract", "price": 300, "quality": 2 },
        { "key": "fondant", "name": "Fondant Roll", "price": 1500, "quality": 3 },
        { "key": "food-coloring", "name": "Food Coloring Set", "price": 400, "quality": 2 },
        { "key": "fruits", "name": "Fresh Fruit Assortment", "price": 600, "quality": 2 }
      ]
    },
    {
      "key": "tools",
      "name": "Tools",
      "items": [
        { "key": "mixer-manual", "name": "Manual Whisk", "price": 200, "bonus": 1.0 },
        { "key": "mixer-electric", "name": "Electric Mixer", "price": 2000, "bonus": 1.5 },
        { "key": "pans-basic", "name": "Basic Cake Pan", "price": 300, "bonus": 1.0 },
        { "key": "pans-set", "name": "Professional Pan Set", "price": 1200, "bonus": 1.3 },
        { "key": "piping-tips", "name": "Piping Tips Set", "price": 800, "bonus": 1.2 },
        { "key": "thermometer", "name": "Oven Thermometer", "price": 500, "bonus": 1.1 }
      ]
    },
    {
      "key": "boosts",
      "name": "Boosts",
      "items": [
        { "key": "extra-time", "name": "Extra Time (+5 min)", "price": 3000, "effect": "extra-time", "value": 300 },
        { "key": "recipe-hint", "name": "Recipe Hint Card", "price": 1500, "effect": "hint", "value": 1 },
        { "key": "reroll", "name": "Re-roll Bad Luck", "price": 2500, "effect": "reroll", "value": 1 }
      ]
    }
  ],
  "defaultKit": ["flour-basic", "eggs-basic", "butter-basic", "sugar", "mixer-manual", "pans-basic"]
}
```

- [ ] **Step 4: Write shop.js**

Export: `loadShop(path)`, `getDefaultKit(shopData)`, `getTeamInventory(db, teamId)`, `purchaseItem(db, teamId, itemKey, shopData)`, `forceApprove(db, purchaseId)`, `getTeamPurchases(db, teamId)`.

`purchaseItem` should: check if affordable → if yes, deduct balance, add to inventory, return `{success: true, newBalance}`. If not affordable, insert a row into a `pending_purchases` table (id, team_id, item_key, amount, status='pending', created_at) and return `{success: false, purchaseId: row.id, warning: "Cannot afford — host override required"}`.

`forceApprove(db, purchaseId)` should: look up the pending purchase by id, deduct the balance (allowing negative), add item to inventory, set status='approved', return `{success: true, newBalance}`.

- [ ] **Step 5: Run tests — should pass**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(1.2): add shop data model with default kits and purchase logic"
```

---

### Task 9: Shop UI — Host Dashboard & Big Screen

**Files:**
- Modify: `v1.2/public/host.html`, `v1.2/public/js/host.js`
- Modify: `v1.2/public/screen.html`, `v1.2/public/js/screen.js`
- Modify: `v1.2/server/index.js` (add shop socket handlers)

- [ ] **Step 1: Add shop socket handlers to server**

Events: `shop:open`, `shop:purchase(teamId, itemKey)`, `shop:force-approve(purchaseId)`, `shop:close`.
Broadcast: `shop:catalog(shopData)`, `shop:purchase-result(teamId, result)`, `shop:team-inventory-updated(teamId, inventory)`, `shop:warning(teamId, message)`.

- [ ] **Step 2: Host shop dashboard**

Shows: team selector dropdown, shop catalog organized by category, per-team purchase history, team balance. "Buy for Team" button processes purchase. Warning modal when team can't afford → "Override & Approve" button. "Close Shop" button transitions to BAKING phase.

- [ ] **Step 3: Big screen shop view**

Shows: full shop catalog with prices, each team's current balance, items being purchased in real-time (animations for purchases).

- [ ] **Step 4: Manual test**

Open host + screen. Host buys items for teams. Verify balances update, warnings appear for negative balance, override works.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(1.2): add shop UI for host dashboard and big screen"
```

---

### Task 10: Shop UI — Virtual Player View

**Files:**
- Modify: `v1.2/public/player.html`, `v1.2/public/js/player.js`

- [ ] **Step 1: Virtual player shop view (read-only)**

Shows: shop catalog (same layout as big screen), their team's current balance, items purchased for their team (updated in real-time). Read-only — no purchase buttons. Shows "Your team bought: [items list]" as the host processes purchases.

- [ ] **Step 2: Manual integration test**

Host buys items → virtual player sees updates in real-time.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(1.2): add read-only shop view for virtual player"
```

---

## Milestone 4: Virtual Cake Baking Game

### Task 11: Phaser.js Integration & Game Bootstrap

**Files:**
- Create: `v1.2/public/js/phaser-game/config.js`
- Create: `v1.2/public/js/phaser-game/HUDScene.js`
- Create: `v1.2/public/js/phaser-game/PhaseSelectScene.js`
- Modify: `v1.2/public/player.html`

- [ ] **Step 1: Add Phaser.js to player.html**

Add Phaser 3 CDN script tag. Create a `<div id="phaser-container">` that's hidden during LOBBY/TRIVIA/SHOP phases and shown during BAKING.

- [ ] **Step 2: Create config.js — Phaser game configuration**

```js
const gameConfig = {
  type: Phaser.AUTO,
  parent: 'phaser-container',
  width: 1024,
  height: 768,
  backgroundColor: '#0d1117',
  scene: [], // scenes registered dynamically based on minigame selection
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  }
};
```

Export function `initGame(socket, inventory, cakeGoal, evilLuckConfig)` that creates the Phaser game instance and registers scenes.

- [ ] **Step 3: Create HUDScene.js — persistent overlay**

Always-on scene showing: countdown timer (synced with server), current phase name, ingredient inventory sidebar, current score per phase, evil luck indicator (skull icon that glows when chaos is imminent).

- [ ] **Step 4: Create PhaseSelectScene.js — transition screen**

Shown between minigames. Displays: phase name + description, which minigame was selected (normal or EVIL), dramatic countdown "3... 2... 1... BAKE!", then launches the minigame scene.

- [ ] **Step 5: Manual test**

Transition to BAKING phase → Phaser container appears → HUD shows timer and inventory → PhaseSelectScene shows first phase intro.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(1.2): integrate Phaser.js with HUD and phase transition scenes"
```

---

### Task 12: Evil Luck Engine

**Files:**
- Create: `v1.2/server/evil-luck.js`
- Create: `v1.2/data/evil-luck.json`
- Create: `v1.2/data/minigames.json`
- Create: `v1.2/tests/evil-luck.test.js`

- [ ] **Step 1: Write evil luck tests**

Test: `calculateChaosLevel(teamMoney, maxPossibleMoney)` returns chaos tier (good/medium/bad).
Test: `selectMinigame(phase, chaosLevel, guaranteedAbsurdRemaining)` returns minigame key.
Test: at least 1 absurd game is guaranteed across 6 phases (only from phases where `absurdExcluded` is not true).
Test: `rollChaosEvent(chaosLevel)` returns null or an event object.
Test: even at chaos level "good", there's a 10-15% chance of events.

- [ ] **Step 2: Run tests — should fail**

- [ ] **Step 3: Create evil-luck.json**

```json
{
  "chaosTiers": {
    "good": { "minMoneyPercent": 50, "absurdChance": 0.10, "eventChance": 0.12 },
    "medium": { "minMoneyPercent": 0, "absurdChance": 0.40, "eventChance": 0.25 },
    "bad": { "minMoneyPercent": -999999, "absurdChance": 0.60, "eventChance": 0.40 }
  },
  "events": [
    { "key": "spill", "name": "Ingredient Spill!", "description": "You knocked over the flour!", "scorePenalty": 0.15, "phase": ["prep", "mix"] },
    { "key": "oven-spike", "name": "Oven Malfunction!", "description": "Temperature spiked to 500°F!", "scorePenalty": 0.20, "phase": ["bake"] },
    { "key": "mixer-break", "name": "Mixer Broke!", "description": "The mixer just exploded!", "scorePenalty": 0.25, "phase": ["mix"] },
    { "key": "frosting-melt", "name": "Frosting Melted!", "description": "Your frosting is a puddle.", "scorePenalty": 0.20, "phase": ["decorate"] },
    { "key": "cake-crack", "name": "Cake Cracked!", "description": "A massive crack down the middle.", "scorePenalty": 0.30, "phase": ["cool"] },
    { "key": "gravity", "name": "Gravity Betrayal!", "description": "Everything is sliding off the cake.", "scorePenalty": 0.15, "phase": ["decorate", "present"] },
    { "key": "trip", "name": "TRIP!", "description": "You tripped carrying the cake!", "scorePenalty": 0.40, "phase": ["present"] },
    { "key": "power-out", "name": "Power Outage!", "description": "The lights went out for 10 seconds.", "scorePenalty": 0.10, "phase": ["bake", "mix"] },
    { "key": "catastrophe", "name": "CATASTROPHIC FAILURE", "description": "Everything went wrong at once.", "scorePenalty": 0.80, "phase": ["any"] }
  ]
}
```

- [ ] **Step 4: Create minigames.json**

```json
{
  "phases": {
    "prep": {
      "normal": ["prep-measure"],
      "absurd": ["prep-measure"],
      "absurdExcluded": true
    },
    "mix": {
      "normal": ["mix-circular"],
      "absurd": ["mix-cow-combat"]
    },
    "bake": {
      "normal": ["bake-temperature"],
      "absurd": ["bake-racing"]
    },
    "cool": {
      "normal": ["cool-patience"],
      "absurd": ["cool-jewel-sort"]
    },
    "decorate": {
      "normal": ["decorate-freeform"],
      "absurd": ["decorate-gravity-flip"]
    },
    "present": {
      "normal": ["present-arrange"],
      "absurd": ["present-obstacle-course"]
    }
  }
}
```

- [ ] **Step 5: Write evil-luck.js**

Export: `calculateChaosLevel(teamMoney, maxPossibleMoney)`, `selectMinigamesForSession(chaosLevel, minigamesConfig)` (returns array of 6 minigame keys with ≥1 guaranteed absurd), `rollChaosEvent(chaosLevel, currentPhase, eventsConfig)`.

The guaranteed absurd logic: randomly pick one phase that WILL be absurd from phases where `absurdExcluded` is not true (i.e., skip `prep` since it has no distinct absurd variant). Then roll the rest normally.

- [ ] **Step 6: Run tests — should pass**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(1.2): add evil luck engine with chaos tiers and minigame selection"
```

---

### Task 13: Baking Engine — Server-Side Timer & Phase Management

**Files:**
- Create: `v1.2/server/baking.js`
- Create: `v1.2/tests/baking.test.js`
- Modify: `v1.2/server/index.js` (add baking socket handlers)

- [ ] **Step 1: Write baking tests**

Test: `startBaking(db, durationSec)` creates a timer. Test: `getTimeRemaining(db)` returns seconds left. Test: `completePhase(db, teamId, phase, score)` records phase score. Test: `getTeamExtraTime(db, teamId)` returns extra seconds from boosts. Test: `calculateFinalScores(db, teamId)` aggregates phase scores into taste/accuracy/creativity.

- [ ] **Step 2: Run tests — should fail**

- [ ] **Step 3: Write baking.js**

Export: `startBaking(db, durationMs)`, `getTimeRemaining(db)`, `completePhase(db, teamId, phaseKey, score, details)`, `getPhaseScores(db, teamId)`, `calculateVirtualCakeScores(db, teamId, inventory)`.

Score aggregation logic:
- **Taste** = avg(prep_score, mix_score, bake_score) × avg_ingredient_quality
- **Accuracy** = avg(decorate_score, present_score) × (1 / cake_difficulty × 10) — harder cakes have lower accuracy ceiling
- **Creativity** = decorate_score × 0.6 + present_score × 0.4 + bonus_decorations

- [ ] **Step 4: Run tests — should pass**

- [ ] **Step 5: Add baking socket handlers to server**

Events from host: `baking:start`, `baking:pause`, `baking:resume`.
Server broadcasts: `baking:timer-tick(remainingMs)` every second, `baking:time-up`, `baking:extra-time(teamId, seconds)`.
Events from player: `baking:phase-complete(phase, score, details)`.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(1.2): add baking engine with timer, phase tracking, and score aggregation"
```

---

### Task 14: Normal Minigame — PrepScene (Ingredient Measurement)

**Files:**
- Create: `v1.2/public/js/phaser-game/PrepScene.js`

- [ ] **Step 1: Build PrepScene**

Phaser scene where player must:
1. See a list of required ingredients on the left
2. Drag each ingredient from a shelf to the mixing bowl in the correct order
3. For each ingredient, a precision meter appears — player clicks/holds at the right moment to measure the correct amount (like a power bar)
4. Score based on: correct order (25%), measurement precision (75%)

Key game mechanics:
- Ingredients available = what the team purchased (from inventory data)
- Missing ingredients → substitution penalty (lower score)
- Precision meter: a moving indicator bar; closer to center = better measurement
- Duration: 60-90 seconds per minigame

- [ ] **Step 2: Implement boost behaviors**

Wire the shop boosts to actual gameplay effects:
- **`recipe-hint`**: At the start of each minigame, if team has a hint, show a 5-second overlay with a tip (e.g., "Keep the indicator in the center for best results"). Consumed on use. Track in game state.
- **`reroll`**: When a chaos event fires, if team has a reroll, show a "Re-roll?" button. Clicking it cancels the chaos event and consumes the reroll. Track remaining rerolls in game state.
- **`extra-time`**: Server adds extra seconds to the team's timer when baking starts. Already handled in baking.js `getTeamExtraTime()`.

- [ ] **Step 3: Wire to PhaseSelectScene**

PhaseSelectScene launches PrepScene when phase=1. On scene completion, emit `baking:phase-complete` with score.

- [ ] **Step 3: Manual playtest**

Play through the prep minigame. Verify scoring works, ingredients render, meter is responsive.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(1.2): add prep minigame (ingredient measurement)"
```

---

### Task 15: Normal Minigame — MixScene (Circular Mixing)

**Files:**
- Create: `v1.2/public/js/phaser-game/MixScene.js`

- [ ] **Step 1: Build MixScene**

Player traces circular patterns with mouse/touch to mix the batter:
1. A circular guide path appears
2. Player must follow the path with their cursor (like tracing a circle)
3. Speed indicator: too slow = lumpy, too fast = splatter, just right = smooth
4. Multiple rounds with different circle sizes and speeds
5. Tool bonus: electric mixer makes the acceptable speed range wider

Score: path accuracy (50%) + speed consistency (50%)
Duration: 45-60 seconds

- [ ] **Step 2: Wire to phase flow and test**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(1.2): add mix minigame (circular batter mixing)"
```

---

### Task 16: Normal Minigame — BakeScene (Temperature Control)

**Files:**
- Create: `v1.2/public/js/phaser-game/BakeScene.js`

- [ ] **Step 1: Build BakeScene**

Oven temperature management:
1. Temperature gauge on screen (thermometer visualization)
2. Player adjusts heat with up/down controls or a slider
3. Target temperature shown as a green zone
4. Temperature drifts naturally — player must keep it stable
5. Timer counts down the "bake time" (30 seconds game time)
6. Oven thermometer tool bonus: green zone is wider

Score: time-in-zone percentage
Duration: 45 seconds

- [ ] **Step 2: Wire and test**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(1.2): add bake minigame (oven temperature control)"
```

---

### Task 17: Normal Minigame — CoolScene (Patience Timing)

**Files:**
- Create: `v1.2/public/js/phaser-game/CoolScene.js`

- [ ] **Step 1: Build CoolScene**

A patience/timing game:
1. Cake cooling indicator — temperature drops from hot (red) to cool (blue)
2. A "sweet spot" zone that appears briefly when the cake is at perfect temp
3. Player must click "Remove" exactly when the indicator is in the sweet spot
4. Too early: cake crumbles (hot). Too late: cake dries out (overcooled)
5. Multiple rounds with decreasing window size

Score: distance from sweet spot center (closer = higher)
Duration: 30 seconds

- [ ] **Step 2: Wire and test**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(1.2): add cool minigame (patience timing)"
```

---

### Task 18: Normal Minigame — DecorateScene (Free-Form Decorating)

**Files:**
- Create: `v1.2/public/js/phaser-game/DecorateScene.js`

- [ ] **Step 1: Build DecorateScene**

Free-form cake decorating with reference image comparison:
1. Reference cake image shown in corner (the cake they bought from shop)
2. Blank cake base in center
3. Toolbar on the right: frosting colors, fondant, piping, toppings (based on purchased ingredients)
4. Player draws/drags to decorate: click to place toppings, drag to pipe frosting lines, click+drag for fondant shapes
5. Piping tips tool bonus: more frosting pattern options

Score: comparison to reference image shape/colors (50%) + coverage (25%) + variety of decorations used (25%)
Duration: 120 seconds (this is the longest minigame — most creative freedom)

- [ ] **Step 2: Wire and test**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(1.2): add decorate minigame (free-form cake decorating)"
```

---

### Task 19: Normal Minigame — PresentScene (Final Plating)

**Files:**
- Create: `v1.2/public/js/phaser-game/PresentScene.js`

- [ ] **Step 1: Build PresentScene**

Final presentation:
1. Cake on a plate — player can rotate and position it
2. Garnish bar: drag finishing touches (sprinkles, fruit slices, chocolate shavings)
3. "Clean up" tool: wipe smudges and drips (click on mess spots to clean them)
4. Background selection: choose a presentation setting (table, stand, display case)
5. Final "Present!" button to submit

Score: cleanliness (30%) + garnish placement (30%) + presentation setting match (40%)
Duration: 60 seconds

- [ ] **Step 2: Wire and test**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(1.2): add present minigame (final cake plating)"
```

---

### Task 20: Absurd Minigame — CowCombatScene

**Files:**
- Create: `v1.2/public/js/phaser-game/absurd/CowCombatScene.js`

- [ ] **Step 1: Build CowCombatScene (replaces MIX phase)**

Battle Cattle-style combat where fighting = mixing:
1. Player controls a cow in a top-down arena
2. Enemy cows charge at you — dodge and counterattack
3. Each hit "churns" the batter (mixing progress bar fills)
4. Explosions, screen shake, absurd particle effects
5. Health bar — if you "die," the batter is poorly mixed (low score)
6. Fill the mixing bar to 100% for perfect score

Score: mixing progress reached (0-100)
Duration: 60 seconds

- [ ] **Step 2: Test and commit**

```bash
git commit -m "feat(1.2): add cow combat absurd minigame"
```

---

### Task 21: Absurd Minigame — RacingOvenScene

**Files:**
- Create: `v1.2/public/js/phaser-game/absurd/RacingOvenScene.js`

- [ ] **Step 1: Build RacingOvenScene (replaces BAKE phase)**

Racing game where speed = oven temperature:
1. Top-down racing track
2. Player drives a car — current speed maps to oven temperature
3. Speed too high = oven too hot = cake burns. Speed too low = too cold = raw
4. Optimal speed zone shown on speedometer
5. Navigate obstacles (puddles = cold spots, fire = heat spikes)
6. Lap counter = bake time progress

Score: time spent in optimal speed zone
Duration: 45 seconds

- [ ] **Step 2: Test and commit**

```bash
git commit -m "feat(1.2): add racing oven absurd minigame"
```

---

### Task 22: Absurd Minigame — JewelSortScene

**Files:**
- Create: `v1.2/public/js/phaser-game/absurd/JewelSortScene.js`

- [ ] **Step 1: Build JewelSortScene (replaces COOL phase)**

Jerma985-style jewel sorting:
1. Container with slots in a specific pattern (alternating colors)
2. Jewels of various colors fall from the top
3. Player must grab and place each jewel in the correct slot
4. Pattern gets more complex each round
5. Completion = proper cooling achieved. Incomplete = uneven cooling

Score: slots correctly filled / total slots
Duration: 45 seconds

- [ ] **Step 2: Test and commit**

```bash
git commit -m "feat(1.2): add jewel sort absurd minigame"
```

---

### Task 23: Absurd Minigame — GravityFlipScene & ObstacleCourseScene

**Files:**
- Create: `v1.2/public/js/phaser-game/absurd/GravityFlipScene.js`
- Create: `v1.2/public/js/phaser-game/absurd/ObstacleCourseScene.js`

- [ ] **Step 1: Build GravityFlipScene (replaces DECORATE phase)**

Decorate a cake while gravity keeps reversing:
1. Same decorating mechanics as DecorateScene
2. Every 5-8 seconds, gravity flips (decorations slide up/down)
3. Player must time their placements between flips
4. Placed items can slide off if not in a stable position when gravity flips

Score: decorations that survived all flips / total placed
Duration: 90 seconds

- [ ] **Step 2: Build ObstacleCourseScene (replaces PRESENT phase)**

Side-scrolling obstacle course:
1. Player carries cake through a gauntlet of obstacles
2. Jump over gaps, duck under barriers, dodge flying objects
3. Cake has a stability meter — bumps reduce stability
4. If stability hits 0, cake falls and splatters
5. Reach the end to present the cake

Score: cake stability at finish + time bonus
Duration: 45 seconds

- [ ] **Step 3: Test both and commit**

```bash
git commit -m "feat(1.2): add gravity flip and obstacle course absurd minigames"
```

---

### Task 24: Evil Event Overlay System

**Files:**
- Create: `v1.2/public/js/phaser-game/EvilEventOverlay.js`

- [ ] **Step 1: Build EvilEventOverlay**

A Phaser scene that runs alongside minigames and can trigger chaos events:
1. Listens for `chaos-event` from server during minigame play
2. When triggered: dramatic screen flash, sound effect, event name + description text overlay
3. Applies score penalty to current minigame
4. Visual effects: screen shake, color shift, particle explosions
5. Event clears after 2-3 seconds, gameplay resumes

- [ ] **Step 2: Wire to evil-luck server events**

Server rolls chaos events between phases (and sometimes mid-phase on a timer). Sends `baking:chaos-event(event)` to the player client.

- [ ] **Step 3: Test chaos events during minigame play**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(1.2): add evil event overlay with chaos effects"
```

---

### Task 25: Full Baking Game Flow Integration

**Files:**
- Modify: `v1.2/public/js/phaser-game/config.js`
- Modify: `v1.2/public/js/player.js`
- Modify: `v1.2/server/index.js`

- [ ] **Step 1: Wire complete baking flow**

When BAKING phase starts:
1. Server runs evil luck engine → selects 6 minigames (≥1 absurd) → sends to player
2. Player client initializes Phaser with selected scenes
3. PhaseSelectScene shows intro for each phase → launches minigame
4. On minigame completion → score sent to server → next phase begins
5. After all 6 phases → server calculates final virtual cake scores
6. Timer sync: HUD updates every second from server tick

- [ ] **Step 2: Host dashboard baking view**

Show: timer, virtual player's current phase, live phase scores, chaos events log. "Pause/Resume" timer controls. Boost indicators (extra time, re-rolls remaining).

- [ ] **Step 3: Big screen baking view**

Show: countdown timer (large), virtual player's current phase name, progress indicator (phases 1-6), chaos event notifications (dramatic text).

- [ ] **Step 4: End-to-end baking playtest**

Play through all 6 phases. Verify scores transmit to server. Timer works. Chaos events fire. At least one absurd game appears.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(1.2): integrate complete baking game flow across all views"
```

---

## Milestone 5: Cake Visualization

### Task 26: AI Cake Image Generation

**Files:**
- Create: `v1.2/server/cake-generator.js`
- Create: `v1.2/tests/cake-generator.test.js`

- [ ] **Step 1: Write cake generator tests**

Test: `buildPrompt(cakeType, scores, ingredients, events)` returns appropriate text prompt.
Test: prompt for score 90+ includes "decent amateur cake."
Test: prompt for score 0-19 includes horror keywords.
Test: `generateCakeImage(prompt)` calls HuggingFace API and returns image buffer.
Test: `postProcessImage(buffer, scoreTotal)` applies distortions based on score tier.

- [ ] **Step 2: Run tests — should fail**

- [ ] **Step 3: Write cake-generator.js**

`buildPrompt(cakeType, scores, ingredients, chaosEvents)`:
- Score 80-100: "Amateur homemade {cakeType} cake, slightly uneven frosting, {ingredients list}, realistic kitchen photo"
- Score 60-79: "Messy homemade {cakeType}, lumpy frosting, lopsided, some decorations falling"
- Score 40-59: "Ugly {cakeType} attempt, burnt, misshapen, unnatural colors, melted frosting"
- Score 20-39: "Horrifying {cakeType} cake, eyes emerging from frosting, teeth in fondant, disturbing"
- Score 0-19: "Eldritch horror cake abomination, biohazard, {random_horror_items}, nightmare fuel, bleach bottle, toilet plunger"

`generateCakeImage(prompt)`:
- POST to `https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell`
- Payload: `{ inputs: prompt }`
- Returns image buffer
- Timeout: 120 seconds
- On failure: return null (fallback to pre-made images)

`postProcessImage(imageBuffer, scoreTier)`:
- Use Sharp to apply tier-based effects:
  - Good (80+): slight blur edges, subtle color warmth
  - Medium (40-79): increase saturation, add noise, slight rotation
  - Bad (20-39): heavy distortion, color inversion on patches, composite horror overlay images
  - Catastrophic (0-19): extreme warping, slice and recombine (chimera), composite unnatural objects, add eyes/teeth overlays

`generateGallery(cakeType, scores, ingredients, events, count=4)`:
- Generate `count` variants with slight prompt variations
- Post-process each differently
- Return array of image buffers

- [ ] **Step 4: Run tests — should pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(1.2): add AI cake image generation with horror post-processing"
```

---

### Task 27: Cake Reveal & Gallery UI

**Files:**
- Create: `v1.2/public/js/phaser-game/ResultScene.js`
- Modify: `v1.2/server/index.js`
- Modify: `v1.2/public/js/host.js`
- Modify: `v1.2/public/js/screen.js`

- [ ] **Step 1: Server-side gallery generation endpoint**

When baking ends, server:
1. Calculates final virtual cake scores
2. Calls `generateGallery()` → saves images to `public/assets/cake-results/`
3. Sends `baking:cake-gallery(imagePaths, scores)` to host

- [ ] **Step 2: Host gallery picker**

Host sees gallery of 4 generated cake images + fallback pre-made options. Click to select the one to use for the reveal. "Reveal Cake" button sends selection to all clients.

- [ ] **Step 3: ResultScene in Phaser**

Dramatic reveal sequence:
1. Screen goes dark
2. "Your cake is ready..." text with suspenseful music
3. Curtain/reveal animation unveils the AI-generated cake image
4. Score breakdown appears: Taste / Accuracy / Creativity
5. Chaos events summary: "Your cake survived: 2 chaos events. It did NOT survive: 1 catastrophic failure."

- [ ] **Step 4: Big screen reveal**

Same dramatic reveal on the projected display for the room to see.

- [ ] **Step 5: Test full reveal flow**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(1.2): add cake reveal with AI gallery and dramatic animation"
```

---

### Task 28: Pre-Made Fallback Images

**Files:**
- Create: `v1.2/public/assets/cake-fallbacks/` (multiple images)
- Modify: `v1.2/server/cake-generator.js`

- [ ] **Step 1: Source or create fallback images**

Need 3-5 images per score tier:
- `tier-80-100-*.png` — decent amateur cakes
- `tier-60-79-*.png` — mediocre cakes
- `tier-40-59-*.png` — ugly cakes
- `tier-20-39-*.png` — horrifying cakes
- `tier-0-19-*.png` — nightmare cakes

Use free stock images, CC0 images, or generate a batch ahead of time using the AI API.

- [ ] **Step 2: Add fallback logic to cake-generator.js**

If AI generation fails (API down, timeout, error), select a random pre-made image from the appropriate tier folder. Apply light post-processing for variety.

- [ ] **Step 3: Test fallback path**

Mock API failure → verify fallback images are served.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(1.2): add pre-made fallback cake images with tier selection"
```

---

## Milestone 6: Judging & Results

### Task 29: Host Judging Interface

**Files:**
- Create: `v1.2/server/judging.js`
- Create: `v1.2/tests/judging.test.js`
- Modify: `v1.2/public/js/host.js`

- [ ] **Step 1: Write judging tests**

Test: `scorePhysicalCake(db, teamId, taste, accuracy, creativity)` records scores.
Test: `getTeamFinalScore(db, teamId, isVirtualTeam)` computes correctly.
Test: non-virtual teams → avg of 3 dimensions. Virtual team → avg of virtual + physical.
Test: `getResults(db)` returns sorted final standings.

- [ ] **Step 2: Run tests — should fail**

- [ ] **Step 3: Write judging.js**

Export: `scorePhysicalCake(db, teamId, taste, accuracy, creativity)`, `getTeamFinalScore(db, teamId, hasVirtualPlayer)`, `getResults(db)`.

- [ ] **Step 4: Run tests — should pass**

- [ ] **Step 5: Host judging UI**

Per-team scoring panel with three sliders (0-100): Taste, Accuracy, Creativity. Shows the team's physical cake photo (host can upload a photo). Submit button. Shows virtual cake score alongside for the virtual team. Live preview of final team score as sliders move.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(1.2): add host judging interface with physical cake scoring"
```

---

### Task 30: Results Reveal

**Files:**
- Modify: `v1.2/public/js/screen.js`
- Modify: `v1.2/public/js/player.js`
- Modify: `v1.2/server/index.js`

- [ ] **Step 1: Results socket events**

Host clicks "Reveal Results" → server sends `results:reveal(standings)` to all clients.

- [ ] **Step 2: Big screen results view**

Dramatic reveal: teams shown in reverse order (3rd → 2nd → 1st) with scores, cake images, and breakdown. Confetti animation for the winner. Show physical vs virtual scores for the virtual team.

- [ ] **Step 3: Virtual player results view**

Same content adapted for their screen. Highlights their contribution via the virtual cake.

- [ ] **Step 4: Test full flow**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(1.2): add dramatic results reveal on all screens"
```

---

## Milestone 7: Integration, Polish & Testing

### Task 31: End-to-End Show Flow Test

**Files:**
- No new files — integration testing

- [ ] **Step 1: Full show walkthrough**

Run the entire show flow: Lobby → Trivia (answer questions, score, force answers) → Shop (buy items) → Baking (play all minigames) → Judging (score physical cakes) → Results.

Verify every transition works. Check all three views stay in sync.

- [ ] **Step 2: Remote connectivity test**

Use `npx lt --port 3001` to create tunnel. Open player.html from a different device/network. Verify all real-time features work with latency.

- [ ] **Step 3: Fix any integration issues found**

- [ ] **Step 4: Commit fixes**

```bash
git commit -m "fix(1.2): integration fixes from end-to-end testing"
```

---

### Task 32: Polish & UX

- [ ] **Step 1: Add sound effects**

Source free sound effects for: buzz, correct answer, wrong answer, chaos event, timer warning (last 5 min), reveal fanfare. Place in `assets/sounds/`.

- [ ] **Step 2: Add transitions between phases**

Smooth CSS/Phaser transitions between show phases (fade, slide, etc.) on all three views.

- [ ] **Step 3: Mobile responsiveness**

Ensure player.html works well on different screen sizes (virtual player might use various devices).

- [ ] **Step 4: Error handling**

Handle disconnections gracefully: auto-reconnect Socket.io, state recovery on reconnect, "Connection lost" overlay.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(1.2): add polish — sounds, transitions, responsiveness, error handling"
```

---

### Task 33: Documentation

**Files:**
- Create: `v1.2/README.md`

- [ ] **Step 1: Write README**

Include: project overview, setup instructions, how to run, how to configure questions/shop/minigames via JSON files, show-day checklist (start server, create tunnel, share URL, test connections), troubleshooting.

- [ ] **Step 2: Commit**

```bash
git commit -m "docs(1.2): add comprehensive README with setup and show-day guide"
```

---

## Summary

| Milestone | Tasks | Description |
|---|---|---|
| 1. Scaffolding | 1-3 | Project setup, server, lobby |
| 2. Trivia | 4-7 | Questions, scoring, evil rule, all views |
| 3. Shop | 8-10 | Shop model, host dashboard, player view |
| 4. Baking Game | 11-25 | Phaser.js, 6 normal + 5 absurd minigames, evil luck, game flow |
| 5. Cake Viz | 26-28 | AI generation, post-processing, gallery, fallbacks |
| 6. Judging | 29-30 | Scoring interface, results reveal |
| 7. Polish | 31-33 | Integration testing, UX, docs |

**Total: 33 tasks across 7 milestones.**
