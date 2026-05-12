# PresentScene3D Horror Maze Overhaul — Design Spec

**Date:** 2026-05-12  
**Status:** Approved  
**Phase:** PRESENT (final phase of baking minigame)

## Overview

Replace the current orbit-camera cake presentation scene with a first-person horror maze. The player carries their completed cake through 14 rooms of escalating horror, dodging scares via QTE prompts. Damage to the cake reduces the final score. The maze ends with a demonic judge presentation.

**Inspirations:** Doors (Roblox), Papa's games, comedy horror, haunted house attractions.

**Tone:** Jump-scare heavy comedy horror — genuinely startling but ultimately silly and fun. Fits Evil Jeopardy's absurdist vibe.

---

## Architecture

### Scene Structure

```
PresentScene3D (complete rewrite)
├── HorrorMazeController (manages room transitions, player state)
├── RoomBuilder (constructs 3D geometry for each room type)
├── ScareSystem (triggers, timing, QTE prompts, damage)
├── ChaseController (Room 12 sprint sequence)
├── JudgePresentation (final room reveal + scoring)
├── CakeHealthDisplay (bottom-right HUD, visual damage)
└── SoundManager (add horror methods directly to existing class)
```

### Player Controls

| Input | Action |
|-------|--------|
| W/A/S/D | Walk (FPS movement) — during normal rooms |
| Mouse | Look (FPS camera rotation) |
| E | Interact (open doors, examine) |
| QTE keys (Q/E/F/R/Z/X) | Dodge scares (prompted key, 1-2s window) |

**Chase scene controls (Room 12 only):**
- Auto-sprint is active (player moves forward automatically)
- A/D = steer left/right to avoid obstacles
- QTE prompts use Q/E/F/R/Z/X (NOT A/D, since those are steering)

### Lifecycle & Timing

- **Time limit:** 240 seconds (4 minutes). Timer starts when player enters Room 1.
- **Timeout behavior:** If timer expires mid-maze, lights go out, entity teleports behind player, instant chase to judges (abbreviated — 10s sprint, then judge room). Cake takes -20 flat damage for timeout.
- **Audio management:** On `create()`, suppress BaseMinigameScene's default ambient. Start `horrorDrone()` loop instead. Each room transition cross-fades room-specific audio layers. On `dispose()`, stop all horror audio loops.
- **Phase completion:** Call `this.setScore(finalScore)` then `this.completePhase({ integrity, bonusRooms, verdict })` when judge verdict finishes.

### Camera

- `BABYLON.UniversalCamera` with standard FPS controls
- Mouse sensitivity: moderate, with Y-axis limits (no full backflip)
- Head bob during walking for immersion
- Violent shake on scare hit
- Chase camera: slight zoom + motion blur effect

---

## Room Sequence (14 Segments)

The maze is **linear with optional side rooms**. The player always knows which direction is forward (lit doorframes, subtle arrows). Side rooms branch off 2-3 times for optional exploration.

| # | Room Name | Theme | Scare Types | QTEs |
|---|-----------|-------|-------------|------|
| 1 | Dark Pantry | Ingredient shelves, cramped | Cans fall, skittering sounds, shadow movement | 0-1 light |
| 2 | The Freezer | Ice, frost, blue lighting | Frozen hands on walls, cold breath particles, ice cracks | 1 medium |
| 3 | Boiling Room | Giant pots, steam, orange glow | Steam jets cross path, pot lids burst | 2 medium |
| 4 | Knife Corridor | Narrow, knives in walls | Knives pull from walls toward player | 2 medium |
| 5 | Meat Locker | Hanging shapes, dim red light | Hooks swing, shapes twitch, jumpscare face | 1 heavy |
| 6 | The Sink | Flooded floor, dripping | Hands reach from drains, water rises briefly | 1 medium |
| 7 | Dish Pit | Towering dish stacks, chaos | Plates and bowls fly at player | 3 medium |
| 8 | The Oven | Industrial oven, heat distortion | Fire bursts from vents, oven door swings open | 2 heavy |
| 9 | Spice Gauntlet | Shelves closing in, dusty | Pepper clouds blur screen, shelves slam together | 1 heavy |
| 10 | The Walk-In | Pitch black, claustrophobic | Door slams, whispers from all sides, brief darkness | 1 heavy + jumpscare image |
| 11 | The Dumbwaiter | Descending, tight space | Things lurk below, cables snap, rattling | 1 heavy |
| 12 | **THE CHASE** | Long corridor, entity behind | Sprint sequence with dodge QTEs | 5-7 rapid QTEs |
| 13 | Judge's Corridor | Eyes everywhere, pulsing walls | Ambient only — tension building | 0 (pure atmosphere) |
| 14 | Judge's Chamber | Red/purple, thrones, calm | None — presentation sequence | 0 |

### Side Rooms (Optional)

3 optional side doors appear along the main corridor (between rooms 3-4, 6-7, and 9-10). Each contains:
- Additional scare content (for fun)
- +5 bonus points if explored without taking damage
- Extra lore/atmosphere (judge eyes react when you enter)

---

## QTE System

### Trigger Flow

```
Scare Event Starts
  → Key prompt appears on screen (random from W/A/S/D/E/F)
  → Timer bar counts down (1.0-2.0s depending on difficulty)
  → Player presses correct key?
    YES → Dodge animation, "whoosh" sound, no damage
    NO/TIMEOUT → Scare hits, screen flash, cake damage, impact sound
```

### Difficulty Scaling

| Rooms | Window | Keys Used |
|-------|--------|-----------|
| 1-4 | 2.0s | Q, E, F |
| 5-8 | 1.5s | Q, E, F, R |
| 9-11 | 1.2s | Q, E, F, R, Z, X |
| 12 (Chase) | 1.0s | Q, E, F, R, Z, X |

> Note: QTE keys are deliberately separate from movement keys (WASD) to avoid conflicts.

### Visual Prompt

- Large key letter appears center-screen with glowing border
- Circular countdown timer around the letter
- Success: letter turns green, shatters outward
- Fail: letter turns red, screen flashes red vignette

---

## Scare Damage System

### Damage Tiers

| Tier | Damage | Trigger |
|------|--------|---------|
| Ambient | 0 pts | Automatic atmosphere (no QTE) |
| Light | -3 pts | Failed easy QTE or unavoidable minor scare |
| Medium | -7 pts | Failed standard QTE |
| Heavy | -12 pts | Failed hard QTE |
| Chase (caught) | -15 pts | 3 failed QTEs during chase |

### Cake Health Display

- Bottom-right corner: 3D mini-cake model rendered to a viewport
- As integrity drops, visual damage appears:
  - 100-80%: Pristine cake
  - 80-60%: Frosting cracks, slight tilt
  - 60-40%: Layers separating, frosting melting off
  - 40-20%: Major structural damage, pieces missing
  - <20%: Barely holding together, comically destroyed

---

## Chase Scene (Room 12)

### Sequence

1. Player enters room 12 — long, dark corridor stretches ahead
2. **ROAR** from behind — camera briefly snaps back to show a shadowy entity
3. "RUN!" flashes on screen — auto-sprint begins (player steers L/R)
4. Corridor has obstacles: fallen shelves, steam pipes, hanging chains
5. QTE prompts every 3-4 seconds to dodge obstacles
6. Entity is visible behind player (growing closer on fails)
7. After ~25 seconds or 7 QTEs, player bursts through door — entity can't follow

### Chase Mechanics

- **Movement:** Auto-sprint forward. Player steers with A/D only.
- **QTE obstacles:** Prompted via Q/E/F/R/Z/X keys (not movement keys)
- **Fail penalty:** Player stumbles (0.5s slow), entity visibly gains ground
- **Camera:** Slightly zoomed in, shaking, narrow FOV for claustrophobia
- **Sound:** Intense chase music, heavy footsteps behind, entity growling closer

### Chase State Machine

```
CHASE_START → show entity reveal (2s cinematic) → CHASE_RUNNING

CHASE_RUNNING:
  - Auto-sprint active, player steers A/D
  - QTE prompt every 3-4s (7 total)
  - On QTE success: obstacle dodged, entity stays at distance
  - On QTE fail: failCount++, stumble animation, entity closer
  - If failCount >= 3: → CHASE_CAUGHT
  - After 7th QTE resolved: → CHASE_ESCAPE

CHASE_CAUGHT:
  - Jumpscare plays (full-screen image + entityRoar sound)
  - Cake takes -15 damage
  - 1.5s freeze, then → CHASE_ESCAPE (only one catch per run)

CHASE_ESCAPE:
  - Player bursts through door, door slams behind
  - Entity roars in frustration (fading sound)
  - Brief 2s calm, then transition to Room 13
```

The catch can only happen ONCE. After being caught, remaining QTEs still play but further fails only cause stumbles (no additional catch).

---

## Demonic Judges (Throughout + Final Room)

### Judge Eyes (Ambient — All Rooms)

- Floating pairs of glowing eyes embedded in walls
- Yellow-orange glow with slight pulsing
- Occasionally blink (one eye at a time for creepiness)
- Subtly track player movement (rotation follows player position)
- Density increases as player progresses (1-2 pairs in room 1, 8-10 in room 13)
- Built as emissive sphere meshes with a pupil decal

### Judge's Chamber (Room 14)

1. **Entry:** Heavy doors slam behind player, eerie silence
2. **Reveal:** Candles ignite one by one, revealing three massive thrones
3. **Judges appear:** Shadowy figures materialize on thrones — grotesque demonic faces (2D image planes or procedural mesh faces)
4. **Cake placement:** Cake auto-moves to central glowing pedestal
5. **Examination:** Camera slowly orbits cake, judges lean in
6. **Verdict:** Comedy text appears above each judge:

**High score (80+):**
> BELPHEGOR: "...the mortal has skills."  
> MOLOCH: "*grudging nod*"  
> ASMODEUS: "ACCEPTABLE. YOU MAY LIVE."

**Medium (50-79):**
> BELPHEGOR: "It's... edible. Barely."  
> MOLOCH: "*SMASHES GAVEL* MEDIOCRE!"  
> ASMODEUS: "I've seen worse. In the ninth circle."

**Low (<50):**
> BELPHEGOR: "*maniacal laughter*"  
> MOLOCH: "THIS IS AN ABOMINATION!"  
> ASMODEUS: "Even Hell has standards."

7. **Score reveal:** Final number with dramatic fanfare (or sad trombone)

---

## Scoring

### Formula

```
Final Present Score = min(100, floor(Cake Integrity % × 85 / 100) + Side Room Bonus)

Where:
- Cake Integrity: starts at 100%, reduced by scare damage
- Base max: 85 points (from integrity alone)
- Side Room Bonus: +5 per side room explored without taking damage IN THAT ROOM (max +15)
- Hard cap: 100 (score pipeline clamps 0-100)
```

**Side room bonus rule:** The +5 bonus is awarded if the player enters a side room AND exits it without taking any damage while inside that specific room. Damage taken in the main corridor before or after does not affect the bonus.

### Examples

| Scenario | Integrity | Bonus | Final Score |
|----------|-----------|-------|-------------|
| Perfect run, no hits, all 3 sides | 100% | +15 | 100 (capped) |
| Good run, 2 medium hits, 1 side | 86% | +5 | 78 |
| Average, several hits, no sides | 65% | 0 | 55 |
| Rough, many hits + caught | 35% | 0 | 30 |
| Disaster | 10% | 0 | 9 |

---

## Visual Effects

### Per-Room Atmosphere

- **Lighting:** Each room has distinct color temperature and intensity. Rooms get darker as you progress.
- **Fog:** Increasing density, limits visibility to 3-5 meters in later rooms
- **Particles:** Dust motes (all rooms), steam (boiling/oven), frost (freezer), sparks (knife corridor)

### Scare Effects

| Effect | When |
|--------|------|
| Screen flash (red vignette) | On damage taken |
| Camera shake | On hit, during chase |
| Chromatic aberration | During chase |
| Jumpscare image (full-screen PNG, 0.3s) | Room 5, 10, chase catch |
| Lights flicker/strobe | Rooms 1, 4, 7, 10 |
| Breathing walls (scale pulse) | Rooms 9, 13 |
| Heartbeat vignette pulse | Rooms 10-13 |

### Jumpscare Images

2-3 horror face PNGs loaded as textures, displayed full-screen on a GUI Image control for 0.3 seconds with a loud sting sound. Comedy-horror style (exaggerated, grotesque but silly — not genuinely disturbing).

---

## Sound Design (Procedural via SoundManager)

All sounds are procedurally generated using the Web Audio API. New methods are added directly to the existing `SoundManager` class in `sound-manager.js` (no subclass).

### New Sounds to Add

| Method | Description | Implementation |
|--------|-------------|----------------|
| `horrorDrone()` | Low ambient rumble, continuous | Sawtooth 30-50Hz + filtered noise, loop |
| `heartbeat()` | Rhythmic thump, speeds up | Two sine tones (60Hz + 40Hz), envelope shaped |
| `footstep()` | Echoing step sound | Noise burst + low sine, short decay, reverb |
| `scareString()` | Sharp violin sting | High sawtooth sweep (800→2000Hz), 0.2s, harsh |
| `metalCreak()` | Creaking metal | Modulated sawtooth, slow frequency sweep |
| `whisper()` | Breathy noise | Filtered white noise, band-pass 200-800Hz |
| `steamHiss()` | Steam jet | High-pass noise burst, 0.3s |
| `chaseMusic()` | Fast pulsing beat | Sequenced kicks + hi-hats, looping |
| `gavelSmash()` | Heavy impact | Low sine burst + noise, heavy compression |
| `cakeCrumble()` | Wet crumbling | Noise + multiple short sine pops |
| `doorSlam()` | Heavy door impact | Low sine (50Hz) + noise burst, long tail |
| `knifeWhoosh()` | Dodged object | Sine sweep 400→100Hz, 0.15s |
| `entityRoar()` | Chase entity growl | Distorted sawtooth 60-120Hz, 0.8s |
| `jumpscareHit()` | Jumpscare audio sting | Loud chord (dissonant), 0.3s |
| `ambientDrip()` | Water drip | Short sine ping (1000Hz), tiny reverb |
| `iceCreak()` | Ice cracking | Noise + high sine chirp |

---

## Technical Considerations

### File Structure

```
v1.2/public/js/babylon-game/scenes/PresentScene3D.js  (complete rewrite, ~800-1200 lines)
v1.2/public/js/babylon-game/shared/sound-manager.js   (add ~16 new sound methods)
v1.2/public/assets/jumpscares/                         (2-3 PNG files)
```

### Performance

- **Room loading:** Only render current room + adjacent corridor. Dispose previous room meshes when 2 rooms behind.
- **Particles:** Cap at 200 active particles per system, max 2 systems active.
- **Fog:** Use Babylon.js scene.fogMode = FOGMODE_EXP2
- **Jumpscares:** Pre-load PNG textures on scene init, display via GUI Image.

### Integration Points

- `SceneManager` already handles phase transitions — PresentScene3D's `create()` is called when PRESENT phase starts
- Prior phase data available via `this.phaseData` (passed from SceneManager on transition) — contains `cakeScore`, `ingredients`, etc.
- Score is reported via `this.setScore(score)` (0-100 clamped) then `this.completePhase(details)` to end the phase
- HUD system (`this.hud`) available for overlays and text
- Default ambient audio from BaseMinigameScene must be suppressed in `create()` (set `this._suppressAmbient = true` before `super.create()` or stop it after)

### Babylon.js Specifics

- FPS camera: `BABYLON.UniversalCamera` with `.attachControl(canvas, true)`
- Head bob: Sinusoidal Y offset in `update()` based on movement
- Room geometry: `MeshBuilder.CreateBox` for walls/floor/ceiling, positioned manually
- Fog: `scene.fogMode = BABYLON.Scene.FOGMODE_EXP2; scene.fogDensity = 0.05;`
- Judge eyes: Emissive spheres with custom shader or high emissive intensity
- Door transitions: brief fade-to-black (0.3s), load next room geometry, fade in

---

## Out of Scope

- Multiplayer synchronization of horror events (single-player experience)
- Procedural room generation (fixed sequence)
- Audio file loading (all sounds remain procedural)
- VR/AR support
- Save/checkpoint system within the maze
