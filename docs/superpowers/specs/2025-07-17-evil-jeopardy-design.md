# Evil Jeopardy² — Design Spec

**Date:** 2025-07-17
**Status:** Approved
**Target:** May 3rd game night

---

## 1. Problem Statement

Evil Jeopardy² is a nested Jeopardy game with custom rules. The host presents questions via Google Slides on a TV/projector. Three players compete — two in-person and one remote (different state). The app needs to handle real-time buzzing with fairness guarantees for the remote player, dual-context scoring (main board + nested game), and the unique "everyone must answer" mechanic.

No existing Jeopardy app supports nested games or forced-answer mechanics.

## 2. Game Rules

### Players
- Flexible player count — supports any number of players (minimum 2)
- Host does not play; host controls the game from the dashboard
- Players can be in-person (WiFi) or remote (ngrok tunnel)

### Evil Jeopardy² Structure
- **Main board:** 5 categories × 5 values ($100–$500)
- **Nested games:** Each main board question triggers a full 5×5 sub-Jeopardy game
- **Placement:** The nested game's final standings determine the order in which players answer the main board question

### Scoring
- **Scale:** $100–$500 per row
- **Forced answer:** Every player MUST answer every question. Correct = +points, wrong = −points (the "evil" mechanic)
- **Nested games** have independent scores that reset each time
- **Main board** scores accumulate across the entire game

### Turn Order
- For each question (nested or main): host opens buzzing → first valid buzz answers first → remaining players answer in order (2nd buzz, 3rd buzz)
- Players who never buzz (AFK, frozen phone) answer last, in order of connection
- For main board questions specifically: answer order is determined by nested game placement (1st place answers first)

### Final Jeopardy
- Standard simultaneous format: all players wager and submit answers on their phones, host reveals
- Players can wager any amount (no cap at current score) — they can go negative
- Minimum wager is $0

## 3. Architecture

### Overview
```
┌─────────────────────────────────────────────┐
│            Your Laptop (Host)               │
│  ┌──────────────┐  ┌────────────────────┐   │
│  │ Google Slides │  │   Node.js Server   │   │
│  │  (TV output)  │  │  Express+Socket.IO │   │
│  └──────────────┘  │                    │   │
│                     │  Game State (RAM)  │   │
│  ┌──────────────┐  │  Buzz Queue        │   │
│  │    Discord    │  │  Score Engine      │   │
│  │ (screen share │  │  Latency Comp.    │   │
│  │   + voice)    │  └────────┬───────────┘   │
│  └──────────────┘           │               │
└─────────────────────────────┼───────────────┘
                              │
              ┌───────────────┼──────────────┐
              │               │              │
     ┌────────▼──┐   ┌───────▼───┐  ┌───────▼────┐
     │ Player A  │   │ Player B  │  │  Player C  │
     │ (in-person)│   │(in-person)│  │  (remote)  │
     │ WiFi: LAN │   │ WiFi: LAN │  │  ngrok URL │
     │  ~5ms     │   │  ~5ms     │  │  ~80-120ms │
     └───────────┘   └───────────┘  └────────────┘
```

### Networking
- **Server:** Node.js process on host laptop, port 3000
- **In-person players:** Connect via local WiFi IP (e.g., `192.168.1.x:3000`)
- **Remote player:** Connects via ngrok tunnel (e.g., `xxxx.ngrok-free.app`)
- **Voice/video:** Discord (separate from the app)
- **Transport:** WebSocket via Socket.IO (real-time buzz events, score updates, game state sync)

### State Management
- All game state lives in server memory (no database)
- State object tracks: players, main scores, nested scores, current game phase, buzz queue, nested placement
- On crash/restart: host uses "Restore Scores" panel to manually re-enter scores

## 4. App Views

### 4.1 Lobby / Join Page (`/`)
- Player enters their name
- Server runs latency calibration (5-10 ping round trips)
- Player waits for host to start the game
- Shows connection status indicator

### 4.2 Player View (`/play`)
- **Buzz button:** Large, centered, red. Disabled until host opens buzzing. Visual feedback on press (pulse animation, color change).
- **Score display:** Two score boxes side-by-side:
  - Main board score + rank
  - Nested game score + rank (hidden when not in a nested game)
- **Game status:** Current phase indicator (nested game, main question, final jeopardy)
- **Standings:** Collapsible list showing all players' scores in current context
- **Answer turn indicator:** When it's this player's turn to answer, the screen highlights prominently
- **Final Jeopardy mode:** Wager input + answer text input + submit button

### 4.3 Host Dashboard (`/host`)
- **Game controls:**
  - "Open Buzzing" / "Lock Buzzing" toggle
  - "Start Nested Game" / "End Nested Game"
  - "Next Player" (cycle through forced-answer order)
  - "Start Final Jeopardy"
- **Buzz display:** Shows who buzzed first (with latency-adjusted timestamp), plus the full buzz queue order
- **Answer marking:** "Correct" / "Wrong" buttons with the current point value shown
- **Scoreboard:** Table showing all players with main score, nested score, connection status
- **Score editor:** Click any score to manually adjust
- **Restore panel:** For crash recovery — text inputs to set each player's scores
- **Connection monitor:** Green/yellow/red indicators per player

## 5. Buzz Fairness System

### Latency Compensation
1. On WebSocket connection, server sends 5-10 ping frames
2. Client immediately responds to each ping
3. Server calculates average RTT per player, stores as `player.avgLatency`
4. Re-calibrates every 5 minutes during the game

### Buzz Processing
1. Host clicks "Open Buzzing" → server broadcasts `buzz:open` to all clients
2. Player presses buzz button → client sends `buzz:press` with client timestamp
3. Server receives buzz at `serverReceiveTime`
4. Server calculates adjusted time: `adjustedTime = serverReceiveTime - (player.avgLatency / 2)`
5. First adjusted time wins
6. If two adjusted times are within 10ms: random tiebreak (coin flip result broadcast to all)
7. Server broadcasts `buzz:winner` with player name

### "Everyone Must Answer" Flow
1. Buzz winner answers first → host marks correct/wrong
2. Server broadcasts `answer:next` with next player's name
3. That player's phone highlights "YOUR TURN"
4. Host marks their answer → server broadcasts to next player
5. Repeat until all players have answered
6. Server broadcasts score updates to all clients

## 6. Game State Machine

```
LOBBY
  → All players connected, host clicks "Start Game"

MAIN_BOARD
  → Host selects a question on slides
  → Host clicks "Start Nested Game" in app

NESTED_GAME
  → Host opens buzzing per question
  → Everyone answers (forced-answer flow)
  → Repeat for all nested questions
  → Host clicks "End Nested Game"
  → App calculates nested placement (sorted by nested score)

MAIN_ANSWER
  → App shows answer order based on nested placement
  → Host cycles through players (1st→2nd→3rd)
  → Each player forced to answer, host marks correct/wrong
  → Main board scores update
  → Return to MAIN_BOARD

FINAL_JEOPARDY
  → Host clicks "Start Final Jeopardy"
  → All players see wager input → submit wager
  → All players see answer input → submit answer
  → Host reveals answers one by one
  → Final scores calculated

GAME_OVER
  → Final standings displayed on all screens
```

## 7. Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Runtime | Node.js 20+ | Lightweight, async-native, good for WebSockets |
| HTTP Server | Express 4.x | Simple routing, serves static files |
| Real-time | Socket.IO 4.x | WebSocket with fallback, reconnection, rooms |
| Frontend | Vanilla HTML/CSS/JS | No build step, minimal resource usage, mobile-first |
| Styling | CSS (dark theme) | Jeopardy-blue aesthetic, high contrast for phone screens |
| Tunnel | ngrok (free) | One-command public URL for remote player |
| State | In-memory JS object | No persistence needed for a game session |

## 8. Project Structure

```
evil-jeopardy/
├── server/
│   ├── index.js          # Express + Socket.IO server entry
│   ├── gameState.js      # Game state management
│   ├── buzzQueue.js      # Latency-compensated buzz system
│   └── latency.js        # Ping calibration logic
├── public/
│   ├── index.html         # Lobby / join page
│   ├── play.html          # Player view
│   ├── host.html          # Host dashboard
│   ├── css/
│   │   └── style.css      # Shared styles (dark Jeopardy theme)
│   └── js/
│       ├── lobby.js       # Lobby client logic
│       ├── player.js      # Player client logic
│       └── host.js        # Host client logic
├── package.json
└── README.md
```

## 9. Socket.IO Events

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `game:state` | Full state object | Sync entire game state (on connect/reconnect) |
| `buzz:open` | `{ pointValue }` | Buzzing is now open |
| `buzz:locked` | `{}` | Buzzing is locked |
| `buzz:winner` | `{ player, adjustedTime }` | Who buzzed first |
| `answer:next` | `{ player }` | Next player's turn to answer |
| `score:update` | `{ players }` | Updated scores for all players |
| `phase:change` | `{ phase, metadata }` | Game phase transition |
| `final:wager` | `{}` | Request wager from players |
| `final:answer` | `{}` | Request answer from players |
| `final:reveal` | `{ results }` | Final Jeopardy results |

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `player:join` | `{ name }` | Player joins with name |
| `buzz:press` | `{ clientTimestamp }` | Player buzzes in |
| `final:submitWager` | `{ amount }` | Player submits FJ wager |
| `final:submitAnswer` | `{ answer }` | Player submits FJ answer |

### Host → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `host:openBuzz` | `{ pointValue }` | Open buzzing for current question |
| `host:lockBuzz` | `{}` | Lock buzzing |
| `host:markAnswer` | `{ player, correct, context }` | Mark player's answer |
| `host:startNested` | `{}` | Begin nested game |
| `host:endNested` | `{}` | End nested game, calculate placement |
| `host:nextPlayer` | `{}` | Move to next player in answer order |
| `host:editScore` | `{ player, context, amount }` | Manual score adjustment |
| `host:startFinal` | `{}` | Begin Final Jeopardy |
| `host:revealAnswer` | `{ player }` | Reveal a player's FJ answer |
| `host:startGame` | `{}` | Transition from lobby to game |

## 10. Error Handling

| Scenario | Handling |
|----------|----------|
| Player disconnect | Socket.IO auto-reconnect. Server preserves state. Player gets full state on reconnect. |
| Buzz tie (≤10ms) | Random tiebreak, result broadcast to all |
| ngrok drops | Remote player temporarily offline. Game can continue for in-person. Reconnects get full state. |
| Server crash | Host uses "Restore Scores" panel. Manual entry ~30s. |
| Wrong score | Host clicks score in dashboard → edit inline |
| Early buzz | Ignored until host clicks "Open Buzzing" |
| Browser refresh | Player reconnects, gets full state via `game:state` event |

## 11. Future Enhancements (Post-MVP)

- Embed Google Slides in web app (Slides API iframe) for fully equal board viewing
- Sound effects (buzz sound, correct/wrong jingles)
- Animated score transitions
- Game history/replay
- Spectator view
- Robotic telepresence integration (the Sheldon segway idea)
