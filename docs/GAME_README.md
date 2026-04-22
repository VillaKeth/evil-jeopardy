# Evil Jeopardy² — Game Guide

## Quick Start

1. Run `npm install` then `start.bat` (Windows) or `./start.sh` (Mac/Linux)
2. Server starts on `http://localhost:3000`
3. Open **Host Dashboard**: `http://localhost:3000/host.html`
4. Players join on their phones: `http://<your-ip>:3000`

## Pages

| URL | Purpose |
|-----|---------|
| `/` | Player lobby — join, set name, upload avatar |
| `/host.html` | Host dashboard — game control, question bank |
| `/spectate.html` | Spectator view — watch live + chat |
| `/history.html` | Game history — browse past games |
| `/replay.html?gameId=X` | Game replay — playback a completed game |

## For Remote Players (ngrok)

1. Install ngrok: `npm install -g ngrok`
2. In a separate terminal: `ngrok http 3000`
3. Share the ngrok URL with remote players

## How to Play

### Game Structure
Evil Jeopardy² is Jeopardy inside Jeopardy:
- The **Main Board** has 5×5 questions
- Each main question triggers a **Nested Game** (another full 5×5 Jeopardy)
- In the nested game, players buzz in to answer questions
- Nested game placement determines who answers the main question first
- **Everyone MUST answer** every main question — wrong answers lose points!

### Game Flow
1. **Lobby** — Players join on their phones, host waits for everyone
2. **Main Board** — Host selects a question (category + value)
3. **Nested Game** — Host asks nested questions, players buzz in
4. **Answer Phase** — Players answer the main question in placement order
5. **Final Jeopardy** — Players wager and answer simultaneously
6. **Game Over** — Final standings displayed

### Scoring
- Correct answer: +value (e.g., +$300)
- Wrong answer: -value (e.g., -$300)
- Final Jeopardy: correct = +wager, wrong = -wager
- Scores can go negative!

### Buzzing
- Tap the big red BUZZ button on your phone
- Buzzes are latency-compensated (fair for remote players)
- Ties within 10ms are broken randomly

### Roles
- **Host**: Controls game flow from `host.html` (laptop/TV)
- **Players**: Join and buzz from their phones via lobby page

## Features

### Player Avatars
- Upload a custom avatar from the lobby page before joining
- Images are resized to 128×128 WebP thumbnails
- If no avatar is uploaded, initials with a color-coded background are shown

### Sound Mute Toggle
- Click the 🔇 mute button (top-right corner on player/host pages)
- Preference is saved in localStorage and persists across sessions

### Score Animations
- Points fly from the board to the scoreboard on correct/wrong answers
- Confetti bursts on big plays
- Final Jeopardy reveals answers one at a time with dramatic effect

### Spectator Mode
- Open `/spectate.html` to watch a live game without being a player
- Enter a display name to join the spectator chat
- See the board, scores, and game state update in real time
- Chat with other spectators during the game

### Question Bank
- Found on the Host Dashboard under the "Question Bank" panel
- **AI Generation**: Enter a topic and generate a full question pack using Ollama (requires Ollama running locally at `http://localhost:11434`)
- **JSON Import**: Upload a JSON file with categories and questions
- Question packs are stored in SQLite and can be reused across games

### Game History & Replay
- All games are automatically recorded with event logging (SQLite)
- Browse past games at `/history.html`
- Click any game to open the replay viewer (`/replay.html?gameId=X`)
- Replay controls: play/pause, step forward/back, speed (1×–8×), timeline scrubber

## Controls (Host)

### Lobby
- Wait for players to join
- Click "Start Game" (need 2+ players)

### Main Board
- Enter category name and select value
- Click "Select Question" to start a nested game

### Nested Game
- Enter nested category + value
- Click "Open Buzzer" to let players buzz
- Mark correct/wrong for the buzz winner
- Click "End Nested Game" when ready to move to answers

### Answer Phase
- Each player answers the main question in order
- Mark correct/wrong for each player
- Click "Next Player" to advance
- Click "End Answer Phase" to return to main board

### Final Jeopardy
- Players submit wagers then answers on their phones
- Host sees when all wagers/answers are in
- Click "Reveal Answers" to score
- Check correct answers and submit

## Technical Details

- **Server**: Node.js + Express + Socket.IO
- **Database**: SQLite via better-sqlite3 (WAL mode, stored in `data/`)
- **Port**: 3000 (configurable via PORT env var)
- **Network**: Binds to 0.0.0.0 (all interfaces)
- **Dependencies**: express, socket.io, better-sqlite3, multer, sharp
- **Tests**: `npm test` (62 tests covering core game, db, questions, replay)
- **Dev mode**: `npm run dev` (auto-restart on file changes)
