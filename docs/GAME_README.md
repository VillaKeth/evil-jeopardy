# Evil Jeopardy² — Game Guide

## Quick Start

1. Run `start.bat` (Windows) or `./start.sh` (Mac/Linux)
2. Server starts on `http://localhost:3000`
3. Open **Host Dashboard**: `http://localhost:3000/host.html`
4. Players join on their phones: `http://<your-ip>:3000`

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
- **Port**: 3000 (configurable via PORT env var)
- **Network**: Binds to 0.0.0.0 (all interfaces)
- **Dependencies**: express, socket.io (installed automatically)
