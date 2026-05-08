# Evil Jeopardy 1.2 — Full Show Production System

## Overview

Evil Jeopardy 1.2 is a hybrid game show combining team trivia, a digital shop, and a collaborative cake-baking activity. Three teams compete: one team includes a virtual player located remotely (Tennessee) who participates via web browser while the rest play in person (Florida).

The show runs through a single web application that serves three views:
- **Host Dashboard** — Full control of the show (trivia, shop, baking timer, scoring)
- **Big Screen** — Projected display for the room (trivia slides, scoreboard, shop, timer)
- **Virtual Player Client** — Remote player's full experience (trivia view, buzz button, shop, Phaser.js cake-baking game)

## Show Flow

```
LOBBY → TRIVIA → SHOP → BAKING (1 hour) → JUDGING → RESULTS
```

### Phase 1: Lobby
- 3 teams join the session. Virtual player connects via tunnel URL (localtunnel/ngrok).
- Teams set names. Host verifies all connections.

### Phase 2: Trivia
Two question formats, both supporting full multimedia (images, GIFs, audio, video):

1. **Knowledge Emporium Slides** — Multimedia questions presented one at a time. Host advances through them. Includes tangential bonus questions that can award ingredients directly instead of money.
2. **6×6 Jeopardy Board** — 6 categories × 6 values. Teams pick from the board.

**Evil Rule — Forced Answers:** Every team MUST provide an answer to every question. If no one buzzes in correctly, all teams are forced to answer. Wrong answers lose points. Only a correct buzz-in saves the other teams from having to answer. This mechanic is designed to drain money and make negative totals common.

**Buzzer System:**
- In-person teams use physical buzzers (handled outside the app).
- Virtual player has two options (both available, host decides on game day):
  1. **Virtual Buzz Button** — Clicking it plays a distinctive sound through the host's computer speakers, audible in the room.
  2. **Voice Communication** — Virtual player tells their in-person teammate to buzz.

**Scoring:** Each team has a running dollar total. Correct = +money, wrong = -money (configurable). Host marks answers correct/incorrect on the dashboard.

### Phase 3: Shop
After trivia, teams spend their earnings (likely low or negative) on supplies for the baking phase.

**Shop Categories (data-driven, easily configurable via JSON):**

| Category | Examples | Price Logic |
|---|---|---|
| Cake Selection | Statue of Liberty, banana cake, etc. | Harder = cheaper, easier = expensive |
| Ingredients | Flour, eggs, sugar, butter, chocolate, vanilla, fruits, fondant, food coloring, toppings | Better quality = more expensive |
| Tools | Electronic mixer, manual whisk, measuring cups, cake pans, piping tips, oven thermometer | Better tools = more expensive |
| Boosts | Extra time (+5 min), recipe hint card, re-roll a bad luck event | Premium prices |

**How it works:**
- Host opens the shop on the big screen for all teams to see.
- Teams tell the host what they want. Host processes purchases on the dashboard.
- Physical items are distributed in person. Digital inventory updates automatically for the virtual player.
- All shop data (categories, items, prices) is defined in `shop.json` — add, remove, or reprice items without code changes.

**Strategic design:** Teams with negative money can only afford the hardest cakes and worst ingredients. Better trivia → more money → easier cake + better tools + better ingredients.

### Phase 4: Baking (1 Hour)
A shared countdown timer starts. In-person teams bake physical cakes. The virtual player plays Phaser.js minigames.

The virtual player's ingredients and cake goal are synced with their in-person teammate's purchases from the shop.

#### Virtual Cake Game — Phaser.js

**6 Baking Phases, each a minigame:**

| Phase | Normal Minigame | Evil Variant Examples |
|---|---|---|
| 1. PREP | Drag ingredients into bowl in correct order, timing bar for measurements | Ingredients labeled in foreign language; zero-gravity assembly |
| 2. MIX | Circular motion tracing to mix batter, speed + accuracy scored | Cow combat (Battle Cattle style); rhythm game mixing to music |
| 3. BAKE | Temperature control gauge, keep in green zone | Racing game where speed = oven temperature |
| 4. COOL | Patience/timing game, remove at the right moment | Jewel pattern sorting (Jerma985 style) |
| 5. DECORATE | Free-form drag-and-drop frosting, fondant, toppings with precision scoring | Gravity-flip decorating; paint-by-numbers with shuffling colors |
| 6. PRESENT | Final arrangement, positioning, garnish, cleanup | Side-scrolling obstacle course carrying the cake to judges |

**Minigame Bank System:**
- Each phase has a pool of minigames (both normal and absurd).
- Each minigame is a self-contained Phaser scene — easy to add new ones to the bank.
- Some minigames are total one-offs with no relation to baking (just absurd random games).
- The system selects which minigame to play based on the evil luck factor.
- **At least 1 absurd minigame is GUARANTEED per session**, regardless of trivia performance.

#### Evil Luck System

The "evil luck" simulates the chaos of real-life baking. Even perfect play can result in failure.

| Trivia Performance | Normal Game Chance | Absurd Game Chance | Chaos Event Probability |
|---|---|---|---|
| Good (high earnings) | 90% | 10% + 1 guaranteed | 10-15% per phase |
| Medium | 60% | 40% | 20-30% per phase |
| Bad (negative earnings) | 40% | 60% | 30-50% per phase |

**Chaos events** (can trigger mid-minigame or between phases):
- Ingredient spills, wrong measurements applied
- Oven temperature spikes, power outage
- Batter lumps, mixer breaks
- Frosting melts, fondant tears, decorations slide off
- Cake cracks, collapses, catches fire
- Trip and drop cake, plate cracks

**Even with perfect play and the best ingredients, there is always a 10-15% base chance of catastrophic failure.** Because baking is chaos.

**Quality calculation per phase:**
```
Phase Score = Player Skill (minigame performance)
            × Ingredient Quality Modifier
            × Tool Bonus Modifier
            × Evil Luck Roll
```

### Phase 5: Judging

**Three scoring dimensions (0-100 each):**

| Dimension | What It Measures | Virtual Cake Calculation |
|---|---|---|
| Taste | Would this taste good? | Ingredient quality × mixing score × baking precision × luck |
| Accuracy | Does it match the reference cake? | Decoration placement × shape matching × color accuracy vs reference |
| Creativity | Extra flair and originality | Bonus from extra decorations, unique touches, presentation |

**Virtual cake "taste"** is computed from minigame results — did they measure correctly, mix properly, bake at the right temp? Good performance + good ingredients = high taste score.

**Physical cake scoring:** Host manually scores each physical cake (0-100 per dimension) on the dashboard.

**Final team score:**
```
Virtual Cake Score = avg(Taste, Accuracy, Creativity)
Physical Cake Score = avg(Taste, Accuracy, Creativity)  [host-scored]
Team Final Score = avg(Virtual Cake Score, Physical Cake Score)
```

### Phase 6: Results
Final scores revealed dramatically. Winner declared.

## Cake Visualization System

The virtual cake is visualized using a hybrid AI generation + programmatic post-processing pipeline.

### Pipeline

1. **AI Image Generation** — Build a text prompt from: cake type + ingredients + performance scores + evil luck events. Send to HuggingFace FLUX.1-schnell or SDXL API (free, no API key required).
2. **Programmatic Post-Processing** — Using Sharp/Canvas2D to push the image further based on scores:
   - Good: Subtle amateur imperfections, slightly uneven
   - Bad: Distortions, color bleeding, melting effects, glitch artifacts
   - Terrible: Chimera compositing — slice multiple failed cake images and stitch them into Frankenstein cakes
   - Catastrophic: Human features (eyes, teeth), unnatural objects (bleach bottles, toilet plungers, things that should NEVER be near food)
3. **Gallery Generation** — Generate 3-5 variants so the host can pick the funniest/most horrifying one for the reveal.
4. **Pre-made Fallbacks** — A library of pre-made cake images at each quality tier in case AI generation is slow or unavailable during the live show.

### Cake Horror Tier List

| Score Range | Visual Quality |
|---|---|
| 80-100 | Decent amateur cake, slightly lopsided, passable |
| 60-79 | Lumpy, colors off, decorations sliding, messy |
| 40-59 | Misshapen, burnt patches, unnatural colors |
| 20-39 | Eyes emerging from frosting, teeth in fondant, the cake stares back |
| 0-19 | Bleach bottle garnish, toilet plunger sticking out, biohazard cake, eldritch horror |

## Technical Architecture

### Stack
- **Backend:** Node.js + Express
- **Real-time:** Socket.io
- **Database:** SQLite (better-sqlite3)
- **Game Engine:** Phaser.js 3 (all minigames)
- **Cake Images:** HuggingFace FLUX/SDXL API + Sharp post-processing
- **Tunneling:** localtunnel / ngrok (remote access)
- **Image Processing:** Sharp

### Data-Driven Configuration Files
All content is defined in JSON config files, editable without code changes:

- `data/questions.json` — Trivia questions, categories, media references, point values
- `data/shop.json` — Shop categories, items, prices (easily add/remove)
- `data/cakes.json` — Cake options, difficulty ratings, reference images, prices
- `data/minigames.json` — Minigame pool per phase, normal vs absurd classification
- `data/evil-luck.json` — Chaos events, probability tables, tier thresholds

### Views

```
┌─────────────────────────────────────────────────────────────┐
│                    NODE.JS SERVER                            │
│           Express + Socket.io + SQLite                       │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Trivia   │  │   Shop   │  │  Baking  │  │  Judging │    │
│  │  Engine   │  │  System  │  │  Engine  │  │  System  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       └──────────────┴──────────────┴──────────────┘         │
│                         Socket.io                            │
└──────────────┬─────────────────┬──────────────┬──────────────┘
               │                 │              │
    ┌──────────▼──────┐ ┌───────▼────────┐ ┌───▼──────────────┐
    │  HOST DASHBOARD  │ │  BIG SCREEN    │ │ VIRTUAL PLAYER   │
    │                  │ │  (Projected)   │ │ (Remote)         │
    │ • Control panel  │ │                │ │                  │
    │ • Score manager  │ │ • Trivia slides│ │ • Trivia view    │
    │ • Shop admin     │ │ • Scoreboard   │ │ • Buzz button    │
    │ • Timer control  │ │ • Shop display │ │ • Shop interface │
    │ • Judging input  │ │ • Cake progress│ │ • PHASER.JS GAME │
    │ • Question nav   │ │ • Timer        │ │ • Cake minigames │
    └─────────────────┘ └────────────────┘ │ • Evil luck      │
                                            │ • AI cake reveal │
                                            └──────────────────┘
```

### Project Structure (New, Separate from Evil Jeopardy 1.0)

```
evil-jeopardy-1.2/
├── server/
│   ├── index.js              # Express + Socket.io server
│   ├── trivia.js             # Trivia engine (questions, scoring, forced answers)
│   ├── shop.js               # Shop system (inventory, purchases)
│   ├── baking.js             # Baking engine (timer, phase management)
│   ├── judging.js            # Scoring system
│   ├── evil-luck.js          # Chaos/luck system
│   ├── cake-generator.js     # AI image generation + post-processing
│   └── db.js                 # SQLite database
├── public/
│   ├── host.html             # Host dashboard
│   ├── screen.html           # Big screen / projector view
│   ├── player.html           # Virtual player client
│   ├── css/
│   ├── js/
│   │   ├── host.js
│   │   ├── screen.js
│   │   ├── player.js
│   │   └── phaser-game/
│   │       ├── boot.js       # Phaser boot scene
│   │       ├── prep.js       # Prep minigame(s)
│   │       ├── mix.js        # Mix minigame(s)
│   │       ├── bake.js       # Bake minigame(s)
│   │       ├── cool.js       # Cool minigame(s)
│   │       ├── decorate.js   # Decorate minigame(s)
│   │       ├── present.js    # Present minigame(s)
│   │       ├── absurd/       # Absurd minigame bank
│   │       │   ├── cow-combat.js
│   │       │   ├── racing-oven.js
│   │       │   ├── jewel-sort.js
│   │       │   ├── gravity-flip.js
│   │       │   └── obstacle-course.js
│   │       └── evil-events.js # Chaos event overlays
│   └── assets/
│       ├── media/            # Question media (images, GIFs, audio)
│       ├── minigame-assets/  # Sprites, sounds for minigames
│       ├── cake-fallbacks/   # Pre-made cake images per tier
│       └── sounds/           # Buzzer, effects, music
├── data/
│   ├── questions.json
│   ├── shop.json
│   ├── cakes.json
│   ├── minigames.json
│   └── evil-luck.json
├── package.json
└── README.md
```

## Key Design Decisions

1. **Separate project** from Evil Jeopardy 1.0 — different show format, cleaner to build fresh.
2. **Data-driven everything** — all content (questions, shop items, cakes, minigames, luck events) in JSON config files. No code changes needed to modify content.
3. **Phaser.js for all minigames** — full game engine for polished, absurd minigame experiences.
4. **Hybrid cake visualization** — AI generation + programmatic post-processing + pre-made fallbacks for reliability.
5. **Evil luck is always present** — 10-15% base catastrophic failure chance even with perfect play, simulating the chaos of real baking.
6. **Guaranteed absurdity** — At least 1 absurd minigame per session regardless of performance.
7. **Physical buzzer compatibility** — App doesn't manage physical buzzers; host handles them manually. Virtual player gets a digital buzz button as an alternative.
