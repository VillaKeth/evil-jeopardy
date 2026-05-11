# Evil Jeopardy 1.2 — Babylon.js Minigame Overhaul

**Date**: 2025-07-25  
**Status**: Draft  
**Scope**: Replace Phaser.js minigames with Babylon.js 3D games

---

## Problem

The current Phaser.js baking minigames are text-based with primitive shapes — they look like placeholder prototypes, not actual games. The virtual player's experience needs to feel like a real CoolMathGames/Papa's-franchise-quality game with 3D graphics, physics, and visual polish.

## Approach

Replace the Phaser.js rendering layer with **Babylon.js** — a WebGL/WebGPU 3D engine with built-in Havok physics. Keep the existing server-side game logic, socket event system, and scoring intact. Only the client-side rendering and interaction layer changes.

**Visual style**: Mixed 2D gameplay mechanics + 3D-rendered visuals for normal games. Isometric surreal/creepy art style for absurd (chaos) games.

**Assets**: Hybrid strategy — procedural geometry (CSG) for simple shapes (bowls, pans, measuring cups) + free .glb 3D models from Sketchfab/Poly Pizza for key objects (cakes, ovens, whisks, decorated items).

---

## Architecture

### Integration Point

```
player.html (existing)
  └─ BAKING phase triggers
       └─ babylon-game-engine.js (new)
            ├─ Creates Babylon.js Engine + canvas
            ├─ Loads HavokPhysics
            ├─ Scene Manager (routes to minigame scenes)
            │    ├─ PrepScene3D
            │    ├─ MixScene3D
            │    ├─ BakeScene3D
            │    ├─ CoolScene3D
            │    ├─ DecorateScene3D
            │    ├─ PresentScene3D
            │    ├─ CowCombat3D (absurd)
            │    ├─ RacingOven3D (absurd)
            │    ├─ JewelSort3D (absurd)
            │    ├─ GravityFlip3D (absurd)
            │    └─ ObstacleCourse3D (absurd)
            ├─ HUD overlay (2D GUI layer)
            └─ Socket.io bridge (score sync)
```

### File Structure

```
v1.2/public/js/babylon-game/
  ├─ engine.js              # Babylon engine init, HavokPhysics loader, canvas management
  ├─ scene-manager.js       # Scene lifecycle, transitions, shared state
  ├─ hud.js                 # 2D overlay: timer, score, phase indicator, chaos bar
  ├─ socket-bridge.js       # Bridges Babylon scenes ↔ Socket.io events
  ├─ shared/
  │    ├─ lighting.js        # Standard kitchen lighting rig
  │    ├─ materials.js       # Reusable PBR materials (metal, wood, food textures)
  │    ├─ particles.js       # Particle presets (steam, flour dust, sparkles, confetti)
  │    ├─ physics-helpers.js # Havok helpers (liquid sim, ragdoll, gravity flip)
  │    └─ camera-rigs.js     # Camera presets (top-down, orbit, dramatic reveal)
  ├─ scenes/
  │    ├─ PrepScene3D.js
  │    ├─ MixScene3D.js
  │    ├─ BakeScene3D.js
  │    ├─ CoolScene3D.js
  │    ├─ DecorateScene3D.js
  │    └─ PresentScene3D.js
  ├─ scenes-absurd/
  │    ├─ CowCombat3D.js
  │    ├─ RacingOven3D.js
  │    ├─ JewelSort3D.js
  │    ├─ GravityFlip3D.js
  │    └─ ObstacleCourse3D.js
  └─ assets/
       ├─ models/            # .glb files (cake, oven, whisk, etc.)
       └─ textures/           # PBR textures (wood, metal, marble, food surfaces)
```

### Replacing Phaser

The existing `initGame()` function in `phaser-game/main.js` creates a Phaser.Game instance. The new system replaces this:

- `window.initGame()` → creates a `BabylonGameEngine` instead of `Phaser.Game`
- The engine creates a `<canvas>` inside `#phaser-container` (reusing the same DOM container)
- Scene transitions use the same event flow: `baking:started` → scene loads → `baking:phase-score` emitted
- HUD overlay uses Babylon.js GUI (AdvancedDynamicTexture) for timer, score, and phase indicators
- Old Phaser scene files remain in the codebase but are no longer loaded (can be deleted later)

### Socket Bridge

The socket bridge mirrors the existing Phaser socket integration:

```javascript
// Sends score when a minigame phase completes (matches existing server handler)
// Server event: 'baking:phase-complete' → expects { teamId, phase, score, details }
socketBridge.emitPhaseComplete(phaseName, score, details);

// Listens for server events
socketBridge.on('baking:phase-completed', (data) => { /* server confirms phase done, advance to next */ });
socketBridge.on('baking:chaos-event', (event) => { /* trigger chaos in active scene */ });
socketBridge.on('baking:time-up', () => { /* end current scene, show results */ });
socketBridge.on('baking:timer-tick', (data) => { /* update HUD timer */ });
```

---

## Normal Minigame Designs (6 games)

### 1. PREP — Pour & Measure (3D)

**Concept**: Tilt 3D ingredient containers to pour into measuring cups, then dump into mixing bowl.

**3D Elements**:
- Kitchen counter surface (procedural plane with wood PBR texture)
- Ingredient containers: flour bag, sugar box, egg carton, butter stick, milk jug (mix of procedural + models)
- Measuring cup (procedural cylinder with fill-level indicator)
- Large mixing bowl (procedural half-sphere with metallic material)

**Gameplay**:
- Click/drag an ingredient to pick it up
- Tilt by dragging down to pour — particle stream of ingredient flows out
- Fill measuring cup to the green zone on a fill gauge
- Release to stop pouring — overshoot = penalty
- Pour measured amount into mixing bowl
- Repeat for each required ingredient (5 total)
- Score based on precision of each measurement

**Physics**:
- Particle-based pour stream (Havok particle emitter)
- Ingredients accumulate in measuring cup (fill level tracks particle count)
- Pour speed affected by tilt angle
- Splatter particles on overfill

**Scoring**: Each ingredient scored 0-20. Total max 100. Precision within 5% of target = perfect score.

**Time limit**: 75 seconds.

### 2. MIX — Circular Stirring (3D)

**Concept**: Stir batter in a 3D mixing bowl by drawing circles with mouse/finger. Match target speed.

**3D Elements**:
- Large mixing bowl viewed from above at ~45° angle
- Whisk/spoon mesh that follows cursor position (positioned in bowl)
- Batter substance that visually changes from lumpy to smooth
- Speed indicator ring around bowl

**Gameplay**:
- Draw circular motions around the bowl with mouse
- System tracks angular velocity (rotations per second)
- Speed meter shows current vs target speed
- Too fast: batter splatters out (particle effect) — penalty
- Too slow: lumps remain — lower score
- 3 rounds with increasing target speeds
- Electric mixer boost: auto-assists with speed, wider tolerance

**Physics**:
- Batter fluid simulation (simplified — vertex displacement on a disc mesh)
- Splatter particles when speed exceeds threshold
- Whisk mesh follows cursor with slight physics lag (spring constraint)

**Scoring**: Each round scored 0-33. Quality based on time spent in target speed zone. Total max ~100.

**Time limit**: 50 seconds.

### 3. BAKE — Oven Temperature Control (3D)

**Concept**: Keep oven temperature in the target zone while cake bakes. Temperature has inertia.

**3D Elements**:
- 3D oven model (procedural box with door, glass window, interior glow)
- Cake mesh inside oven visible through glass (deforms as it rises)
- Temperature dial (rotatable 3D knob)
- Heat wave distortion shader on oven window
- Rising heat particles

**Gameplay**:
- Adjust temperature with +/- buttons or dial drag
- Temperature changes aren't instant (thermal inertia simulation)
- Target zone shifts periodically
- Cake visually rises when in correct temp zone, sinks/burns outside
- Chaos events: power flickers (temp drops suddenly), hot spots
- Oven thermometer boost: shows exact target zone (wider tolerance)

**Physics**:
- Thermal simulation: temperature velocity + damping
- Cake mesh morph targets: flat → risen → overflowed
- Heat distortion post-processing effect
- Particle emitter for heat waves / steam

**Scoring**: Score = percentage of time spent in target zone × 100. Thermometer bonus: 1.1x.

**Time limit**: 45 seconds.

### 4. COOL — Patience & Fan Control (3D)

**Concept**: Cool the cake without cracking it. Fan it at the right intensity.

**3D Elements**:
- Cake on 3D wire cooling rack
- Handheld fan (follows cursor)
- Steam/heat particles rising from cake
- Temperature color gradient on cake surface (hot=red → cool=blue)
- Condensation droplets

**Gameplay**:
- Click/hold fan button to blow air at cake
- Fan direction follows cursor position
- Aggressive fanning: cake cracks (mesh deformation + particle crack lines)
- Too slow: takes forever, condensation forms (catch droplets minigame)
- Sweet spot: steady medium fanning
- Temperature gauge shows cooling progress

**Physics**:
- Steam particles deflected by fan direction
- Cake surface temperature simulation (heat map shader)
- Crack propagation on overcooling (procedural mesh deformation)

**Scoring**: Score based on cooling speed without cracks. Max 100.

**Time limit**: 40 seconds.

### 5. DECORATE — Creative Showpiece (3D)

**Concept**: Decorate the 3D cake with frosting, toppings, and fondant. Most creative/interactive game.

**3D Elements**:
- Rotatable 3D cake on turntable
- Piping bag tool (follows cursor, extrudes frosting mesh along path)
- Topping objects (fruit, sprinkles, chocolate pieces — draggable 3D meshes)
- Fondant sheets (draped cloth simulation)
- Color palette for frosting
- Reference image panel showing target cake

**Gameplay**:
- Rotate cake by dragging on turntable
- Select frosting tool → draw on cake surface (line renderer creates 3D frosting mesh)
- Select color from palette
- Drag toppings from shelf to cake (snap to surface)
- Apply fondant (click and drag to cover sections)
- Food coloring boost: unlocks more colors
- Fondant boost: smooth, professional-looking coverage

**Physics**:
- Frosting line has slight droop (gravity on the extruded mesh)
- Toppings placed on cake surface using raycasting (stick where they land)
- Fondant uses simplified cloth simulation

**Scoring**: Compared against reference image. Scored on:
- Accuracy (color/shape match to reference): 0-40
- Creativity (variety of toppings, coverage): 0-30
- Neatness (clean lines, even coverage): 0-30

**Time limit**: 60 seconds.

### 6. PRESENT — Cake Arrangement & Reveal (3D)

**Concept**: Arrange the finished cake on a presentation table — choose plating, garnishes, and camera angle. Then dramatic reveal with scoring.

**Replaces**: The existing `PresentScene` (scored game). The existing `ResultScene` and `results:cake-reveal` flow remain separate — they handle the final results phase UI, not this in-game minigame.

**3D Elements**:
- Finished 3D cake on presentation table
- Plating options (cake stand, board, plate — selectable)
- Garnish tray (mint, berries, chocolate shavings — draggable)
- Lighting controls (warm/cool/dramatic spotlight — selectable)
- Camera orbit for final reveal
- Reference cake for side-by-side comparison

**Gameplay**:
- Choose presentation plating from 3 options
- Drag garnishes around the cake
- Select lighting style
- Confirm → dramatic camera orbit reveal
- Score categories animate in one by one (Taste, Creativity, Accuracy)
- Score synced to server via `baking:phase-complete` event

**Physics**:
- Garnishes have slight physics (roll/settle on plate)
- Confetti particles on high scores (Havok rigid bodies)
- Camera shake on big score reveals

**Scoring**: Based on arrangement quality (plating choice, garnish placement, lighting selection). Each choice scored individually. Does NOT aggregate previous phase scores — that aggregation is handled server-side by `getPhaseScores()`. This scene only scores its own gameplay. Max 100.

**Time limit**: 45 seconds.

---

## Absurd Minigame Designs (5 games)

These replace normal games when chaos level is high. Art style shifts to isometric perspective with surreal/creepy lighting — uncanny valley kitchen aesthetic.

**Phase-to-absurd mapping** (from `data/minigames.json` — this file already exists in the repo and is the source of truth for which scenes map to which phases):
- Prep is excluded from absurd variants (`absurdExcluded: true`) — always uses normal `prep-measure`
- Mix → `mix-cow-combat` (CowCombat3D)
- Bake → `bake-racing` (RacingOven3D)
- Cool → `cool-jewel-sort` (JewelSort3D)
- Decorate → `decorate-gravity-flip` (GravityFlip3D)
- Present → `present-obstacle-course` (ObstacleCourse3D)

Note: This means there are **5 absurd games** (not 4). The ObstacleCourse3D for Present was missing from the original design and must be built.

### CowCombat3D (replaces Mix — `mix-cow-combat`)

**Concept**: Milk a cow by clicking udders in rhythm. The cow fights back.

**3D Elements**: Isometric farm scene, 3D cow model, milk bucket, fence
**Gameplay**: Rhythm clicking on udder hitboxes. Cow kicks, spins, charges. Dodge while milking.
**Physics**: Cow ragdoll on stun. Milk physics in bucket. Fence destruction.
**Style**: Eerie green lighting, fog, distorted farm music.

### RacingOven3D (replaces Bake — `bake-racing`)

**Concept**: Your cake is in an oven on rails. Navigate the oven-cart through an obstacle course.

**3D Elements**: Isometric race track, oven-cart, obstacles (potholes, swinging pendulums, ramps)
**Gameplay**: Left/right steering. Jump over gaps. Collect temperature boosts. Don't crash.
**Physics**: Cart physics (acceleration, collision). Cake inside oven bounces around.
**Style**: Dark industrial kitchen, neon signs, underground racing aesthetic.

### JewelSort3D (replaces Cool — `cool-jewel-sort`)

**Concept**: Ingredients are crystallized gems on a conveyor belt. Sort by color into vats.

**3D Elements**: Isometric conveyor belt, crystallized ingredient gems, sorting vats, reject chute
**Gameplay**: Click gems to sort into matching color vats. Speed increases. Wrong sort = penalty.
**Physics**: Gems bounce and collide on conveyor. Vat overflow if too many of one color.
**Style**: Crystal cave aesthetic, eerie refracted light, mineral-like ingredients.

### GravityFlip3D (replaces Decorate — `decorate-gravity-flip`)

**Concept**: Room rotates, gravity shifts. Keep the cake on the cooling rack.

**3D Elements**: Isometric room that physically rotates. Cake on wire rack. Furniture flies around.
**Gameplay**: Gravity direction changes every few seconds. Click to anchor cake at right moment. Dodge flying objects.
**Physics**: Full Havok gravity simulation. All objects in room are physics bodies. Everything tumbles.
**Style**: M.C. Escher meets haunted kitchen. Impossible angles, disorienting perspective.

### ObstacleCourse3D (replaces Present — `present-obstacle-course`)

**Concept**: Navigate your finished cake through a gauntlet of kitchen hazards to the presentation table.

**3D Elements**: Isometric obstacle course: swinging rolling pins, falling pots, slippery butter patches, collapsing shelves
**Gameplay**: Carry cake through course. WASD/arrows to move. Avoid hazards — each hit damages the cake's presentation score. Reach the table intact for bonus.
**Physics**: Cake takes damage on collision. Obstacles have Havok rigid body physics. Cake can break apart if hit too hard.
**Style**: Industrial kitchen nightmare. Conveyor belts, steam vents, flickering fluorescent lights.

---

## Technical Decisions

### Babylon.js Version & Loading

- Use Babylon.js 7.x (latest stable) via CDN
- Load HavokPhysics WASM module alongside
- Total additional JS: ~2MB (engine) + ~500KB (Havok WASM)
- First load takes ~2-3 seconds; cached afterwards

### Script Loading (player.html)

```html
<!-- Babylon.js core -->
<script src="https://cdn.babylonjs.com/babylon.js"></script>
<script src="https://cdn.babylonjs.com/gui/babylon.gui.min.js"></script>
<script src="https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js"></script>
<script src="https://cdn.babylonjs.com/havok/HavokPhysics_umd.js"></script>

<!-- Game engine -->
<script src="/js/babylon-game/engine.js"></script>
<script src="/js/babylon-game/scene-manager.js"></script>
<script src="/js/babylon-game/hud.js"></script>
<script src="/js/babylon-game/socket-bridge.js"></script>
<script src="/js/babylon-game/shared/lighting.js"></script>
<script src="/js/babylon-game/shared/materials.js"></script>
<script src="/js/babylon-game/shared/particles.js"></script>
<script src="/js/babylon-game/shared/physics-helpers.js"></script>
<script src="/js/babylon-game/shared/camera-rigs.js"></script>

<!-- Scenes -->
<script src="/js/babylon-game/scenes/PrepScene3D.js"></script>
<!-- ... other scenes loaded as needed -->
```

### Canvas Management

The Babylon engine renders into a `<canvas>` element inside the existing `#phaser-container` div. This div is shown/hidden by the existing phase transition system in `player.js`.

```javascript
// engine.js
class BabylonGameEngine {
  constructor(containerId, socket) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'babylon-canvas';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    document.getElementById(containerId).appendChild(this.canvas);
    
    this.engine = new BABYLON.Engine(this.canvas, true);
    this.sceneManager = new SceneManager(this.engine, socket);
  }
}
```

### Scene Base Class

All scenes extend a common base that handles shared setup:

```javascript
class BaseMinigameScene {
  constructor(engine, socket, options) {
    this.scene = new BABYLON.Scene(engine);
    this.socket = socket;
    this.inventory = options.inventory || [];
    this.teamId = options.teamId;
    this.score = 0;
    this.timeLimit = 60;
    this.timeRemaining = this.timeLimit;
  }
  
  // Shared methods
  setupLighting() { /* standard kitchen light rig */ }
  setupPhysics() { /* init HavokPhysics */ }
  createHUD() { /* timer, score, phase name */ }
  emitScore(phaseName, score, details) { /* socket bridge */ }
  
  // Override in subclasses
  create() {}
  update(deltaTime) {}
  dispose() {}
}
```

### Performance Targets

- 60 FPS on mid-range hardware
- < 3 second initial load (CDN cached)
- < 500ms scene transition
- Total asset budget: < 5MB (models + textures)

---

## Build Order

1. **Phase 1**: Core engine + PREP + MIX + BAKE (3 games)
2. **Phase 2**: DECORATE + COOL + PRESENT (3 games)
3. **Phase 3**: All 5 absurd games (CowCombat, RacingOven, JewelSort, GravityFlip, ObstacleCourse)
4. **Phase 4**: Polish, optimization, visual effects

---

## What Stays vs Changes

### Stays (no changes)
- Server-side game logic (`server/index.js`)
- Socket.io event protocol (client emits `baking:phase-complete` with `{ teamId, phase, score, details }`, server responds with `baking:phase-completed`)
- Baking timer system
- Server-side scoring storage (`completePhase()`, `getPhaseScores()`)
- Phase state machine
- Shop/inventory system
- Host and screen pages
- player.js phase transition system
- `ResultScene` / `results:cake-reveal` flow: **Rewrite in Babylon.js**. The existing Phaser-based `ResultScene` is replaced by a Babylon.js equivalent so Phaser can be fully removed. The new Babylon result scene reuses the 3D cake model from the game session for the reveal animation.

**Scoring note**:Each minigame scene internally calculates a score (0-100) based on the game mechanics described in this spec. These scores are sent to the server via the existing `baking:phase-complete` socket event. The server stores them via `completePhase()` — this storage/aggregation logic is unchanged. What changes is HOW the client-side score is computed (new game mechanics → new scoring formulas within each scene), but the server interface remains the same.

### Changes
- `player.html`: Replace Phaser script tags with Babylon.js script tags
- `player.js`: `startBakingSession()` creates BabylonGameEngine instead of calling `initGame()`
- `player.js`: Cake reveal handler creates Babylon result scene instead of Phaser `ResultScene`
- Old Phaser scenes: Deprecated, kept for reference but not loaded
- New `babylon-game/` directory: All new code

### Removed (after Babylon is stable)
- `phaser-game/` directory (all Phaser scene files)
- Phaser CDN script tags from player.html
- `window.initGame()` and `window.ResultScene` globals
