# Evil Jeopardy 1.2

## Project Overview

Evil Jeopardy 1.2 is a hybrid game show that combines team trivia, a digital shop, and collaborative cake baking into one chaotic party experience. Three teams compete while one virtual player represents a team in a parallel digital baking challenge powered by Phaser 3 minigames. The format is half trivia competition and half teamwork activity, blending live hosting with a second-screen experience.

The project is built with Node.js, Express, Socket.io, Phaser 3, and SQLite. It supports a host control panel, a big-screen presentation view, and a dedicated remote player view for the virtual contestant.

## Architecture

- **Server:** Express + Socket.io server running on port `3001` by default
- **Client views:**
  - **Host** (`host.html`) for show controls, scoring, and pacing
  - **Screen** (`screen.html`) for the audience/projector display
  - **Player** (`player.html`) for the virtual contestant's remote experience
- **Phase state machine:** `LOBBY → TRIVIA → SHOP → BAKING → JUDGING → RESULTS`
- **Persistence:** SQLite-backed game state and scoring
- **Configuration:** Data-driven JSON files for questions, shop items, minigames, and evil luck events

## Setup Instructions

```bash
cd v1.2
npm install
node server/index.js
```

Then open the three app views:

- **Host:** `http://localhost:3001/host.html`
- **Screen:** `http://localhost:3001/screen.html`
- **Player:** `http://localhost:3001/player.html`

Use the host view on the game runner's device, project the screen view to the room, and share the player view with the virtual contestant.

## Remote Player Setup

To let a remote player join from another device or network, expose the local server with a tunnel:

```bash
npx localtunnel --port 3001
```

You can also use ngrok if you prefer. After the tunnel starts:

1. Copy the public tunnel URL.
2. Share the URL with `/player.html` appended to it.
3. Have the virtual player open that link on their phone, tablet, or computer.

The player view is lightweight and works well on mobile devices.

## Show-Day Checklist

1. Start the server.
2. Create a tunnel for the remote player.
3. Share the tunnel URL with the virtual player.
4. Open `host.html` on the host's device.
5. Open `screen.html` on the projector or TV.
6. Test connections and confirm all three views show the lobby.
7. Create teams in the host dashboard.
8. Have the virtual player join their team.
9. Start trivia when everyone is ready.
10. Run the show flow: **Trivia → Shop → Baking → Judging → Results**.

## Customization

The game is driven by JSON config files in `data/`:

- **Questions:** Edit `data/questions.json` for the 13 slide questions and Jeopardy board data.
- **Shop items:** Edit `data/shop.json` for the four shop categories: cakes, ingredients, tools, and boosts.
- **Minigames:** Edit `data/minigames.json` for the normal and absurd minigame pools for each baking phase.
- **Evil luck:** Edit `data/evil-luck.json` for chaos tiers and random event definitions.

## Game Flow

### Trivia
Teams answer trivia questions to earn money. Evil Jeopardy rules apply, including Jeopardy-style value swings and bonus ingredient awards.

### Shop
The host spends each team's earned money in the digital shop. Purchases affect the later baking performance and available advantages.

### Baking
The virtual player completes six Phaser minigames representing the baking process. Evil luck can inject absurd minigames and chaotic penalties based on team performance.

### Judging
The host scores the physical cakes, and the virtual cake scores are combined with the physical judging results for the virtual team.

### Results
The game ends with a dramatic reveal of the final rankings and winning team.

## Minigames

### Normal
- Prep
- Mix
- Bake
- Cool
- Decorate
- Present

### Absurd
- Cow Combat *(mix)*
- Racing Oven *(bake)*
- Jewel Sort *(cool)*
- Gravity Flip *(decorate)*
- Obstacle Course *(present)*

## Troubleshooting

- **Port 3001 already in use:** Change the port in `server/index.js`, then use the updated port in your local URLs and tunnel.
- **Virtual player can't connect:** Make sure the tunnel is running and check local firewall or network restrictions.
- **AI cake generation fails:** The app falls back to bundled cake images automatically if `HF_API_TOKEN` is missing or generation fails.
- **Database issues:** Delete `data/game.db` to reset the saved SQLite game state.

## Tech Stack

- **Backend:** Node.js, Express 5, Socket.io 4, better-sqlite3
- **Frontend:** Vanilla JavaScript, Phaser 3, Socket.io client
- **AI:** HuggingFace FLUX.1-schnell for optional cake image generation, with local fallback images
- **Image processing:** Sharp
