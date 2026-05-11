# Babylon.js Minigame Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all Phaser.js baking minigames with Babylon.js 3D games featuring Havok physics, PBR materials, and CoolMathGames-quality visuals.

**Architecture:** A `BabylonGameEngine` class replaces `window.initGame()`. It creates a Babylon.js `Engine` + `<canvas>` inside the existing `#phaser-container` div, manages scene lifecycle via `SceneManager`, overlays a 2D HUD via Babylon GUI, and bridges socket events through `SocketBridge`. Each minigame is a self-contained scene class extending `BaseMinigameScene`.

**Tech Stack:** Babylon.js 7.x (CDN), HavokPhysics WASM, Babylon GUI, Socket.io (existing), Express (existing server — no changes)

**Spec:** `docs/superpowers/specs/2025-07-25-babylon-minigame-overhaul-design.md`

---

## File Map

All new files live under `v1.2/public/js/babylon-game/`. Existing files modified are noted with `(modify)`.

### Core Engine (4 files)
| File | Responsibility |
|------|----------------|
| `engine.js` | `BabylonGameEngine` class — creates canvas, Babylon Engine, inits HavokPhysics, owns SceneManager + HUD + SocketBridge |
| `scene-manager.js` | `SceneManager` + `BaseMinigameScene` — scene lifecycle, transitions, scene registry, shared state |
| `socket-bridge.js` | `SocketBridge` — wraps socket.io for Babylon scenes, emits `baking:phase-complete`, listens for server events |
| `hud.js` | `HUD` — Babylon GUI `AdvancedDynamicTexture` overlay with timer, score, phase name, chaos bar |

### Shared Utilities (5 files)
| File | Responsibility |
|------|----------------|
| `shared/lighting.js` | `KitchenLighting` — standard 3-point light rig, creepy variant for absurd scenes |
| `shared/materials.js` | `MaterialLibrary` — PBR materials: wood, metal, food, glass, frosting |
| `shared/particles.js` | `ParticlePresets` — steam, flour dust, sparkles, confetti, fire, splatter |
| `shared/physics-helpers.js` | `PhysicsHelpers` — Havok init, pour simulation, ragdoll, gravity flip |
| `shared/camera-rigs.js` | `CameraRigs` — top-down, orbit, dramatic reveal, isometric presets |

### Normal Scenes (6 files)
| File | Scene Class | Phase |
|------|-------------|-------|
| `scenes/PrepScene3D.js` | `PrepScene3D` | prep |
| `scenes/MixScene3D.js` | `MixScene3D` | mix |
| `scenes/BakeScene3D.js` | `BakeScene3D` | bake |
| `scenes/CoolScene3D.js` | `CoolScene3D` | cool |
| `scenes/DecorateScene3D.js` | `DecorateScene3D` | decorate |
| `scenes/PresentScene3D.js` | `PresentScene3D` | present |

### Absurd Scenes (5 files)
| File | Scene Class | Replaces Phase |
|------|-------------|----------------|
| `scenes-absurd/CowCombat3D.js` | `CowCombat3D` | mix |
| `scenes-absurd/RacingOven3D.js` | `RacingOven3D` | bake |
| `scenes-absurd/JewelSort3D.js` | `JewelSort3D` | cool |
| `scenes-absurd/GravityFlip3D.js` | `GravityFlip3D` | decorate |
| `scenes-absurd/ObstacleCourse3D.js` | `ObstacleCourse3D` | present |

### Result Scene (1 file)
| File | Scene Class | Purpose |
|------|-------------|---------|
| `scenes/ResultScene3D.js` | `ResultScene3D` | Cake reveal animation (replaces Phaser `ResultScene`) |

### Modified Existing Files
| File | Change |
|------|--------|
| `v1.2/public/player.html` (modify) | Replace Phaser CDN + scene script tags with Babylon.js CDN + babylon-game script tags |
| `v1.2/public/js/player.js` (modify) | `startBakingSession()` creates `BabylonGameEngine` instead of calling `window.initGame()`. `launchCakeRevealScene()` uses `ResultScene3D` instead of Phaser `ResultScene`. |

### Assets (sourced during implementation)
| Directory | Contents |
|-----------|----------|
| `assets/models/` | `.glb` files — cake, oven, whisk, bowl, cooling rack, cow, cart |
| `assets/textures/` | PBR textures — wood, metal, marble, food surfaces |

---

## Milestones

| # | Milestone | Tasks | What's Playable After |
|---|-----------|-------|-----------------------|
| 0 | Infrastructure | 1–8 | Engine boots, empty scene renders with HUD, sockets work |
| 1 | Player.js Integration | 9 | Full flow from host "Start Baking" through to Babylon canvas loading |
| 2 | Core 3 Scenes | 10–12 | Prep, Mix, Bake minigames playable with scoring |
| 3 | Remaining Scenes | 13–15 | Cool, Decorate, Present minigames playable |
| 4 | Absurd Scenes | 16–20 | All 5 chaos variants playable |
| 5 | Result + Cleanup | 21–23 | Cake reveal in Babylon, Phaser fully removed |

---

## Task 1: Directory Structure + Player.html CDN Swap

**Files:**
- Create: `v1.2/public/js/babylon-game/` (directory tree)
- Create: `v1.2/public/js/babylon-game/assets/models/.gitkeep`
- Create: `v1.2/public/js/babylon-game/assets/textures/.gitkeep`
- Modify: `v1.2/public/player.html:860-885`

- [ ] **Step 1: Create the directory structure**

```powershell
New-Item -ItemType Directory -Force -Path v1.2/public/js/babylon-game/shared, v1.2/public/js/babylon-game/scenes, v1.2/public/js/babylon-game/scenes-absurd, v1.2/public/js/babylon-game/assets/models, v1.2/public/js/babylon-game/assets/textures
New-Item -ItemType File -Force -Path v1.2/public/js/babylon-game/assets/models/.gitkeep, v1.2/public/js/babylon-game/assets/textures/.gitkeep
```

- [ ] **Step 2: Replace Phaser CDN + scripts with Babylon.js in player.html**

In `v1.2/public/player.html`, replace lines 860-885 (the Phaser script block) with:

```html
  <!-- Babylon.js 3D Engine -->
  <script src="https://cdn.babylonjs.com/babylon.js"></script>
  <script src="https://cdn.babylonjs.com/gui/babylon.gui.min.js"></script>
  <script src="https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js"></script>
  <script src="https://cdn.babylonjs.com/havok/HavokPhysics_umd.js"></script>

  <!-- Babylon Game Engine (core) -->
  <script src="/js/babylon-game/shared/lighting.js"></script>
  <script src="/js/babylon-game/shared/materials.js"></script>
  <script src="/js/babylon-game/shared/particles.js"></script>
  <script src="/js/babylon-game/shared/physics-helpers.js"></script>
  <script src="/js/babylon-game/shared/camera-rigs.js"></script>
  <script src="/js/babylon-game/socket-bridge.js"></script>
  <script src="/js/babylon-game/hud.js"></script>
  <script src="/js/babylon-game/scene-manager.js"></script>
  <script src="/js/babylon-game/engine.js"></script>

  <!-- Babylon Scenes (normal) -->
  <script src="/js/babylon-game/scenes/PrepScene3D.js"></script>
  <script src="/js/babylon-game/scenes/MixScene3D.js"></script>
  <script src="/js/babylon-game/scenes/BakeScene3D.js"></script>
  <script src="/js/babylon-game/scenes/CoolScene3D.js"></script>
  <script src="/js/babylon-game/scenes/DecorateScene3D.js"></script>
  <script src="/js/babylon-game/scenes/PresentScene3D.js"></script>
  <script src="/js/babylon-game/scenes/ResultScene3D.js"></script>

  <!-- Babylon Scenes (absurd/chaos) -->
  <script src="/js/babylon-game/scenes-absurd/CowCombat3D.js"></script>
  <script src="/js/babylon-game/scenes-absurd/RacingOven3D.js"></script>
  <script src="/js/babylon-game/scenes-absurd/JewelSort3D.js"></script>
  <script src="/js/babylon-game/scenes-absurd/GravityFlip3D.js"></script>
  <script src="/js/babylon-game/scenes-absurd/ObstacleCourse3D.js"></script>
```

Keep the HTML comment `<!-- Phaser Game Container -->` and the `#phaser-container` div unchanged — Babylon reuses it.

- [ ] **Step 3: Verify player.html loads without errors**

Open `http://localhost:3001/player.html` in browser. The 404s for not-yet-created JS files are expected. Verify the Babylon.js CDN scripts load (check Network tab — `babylon.js`, `babylon.gui.min.js`, `babylonjs.loaders.min.js`, `HavokPhysics_umd.js` should all return 200).

- [ ] **Step 4: Commit**

```bash
git add v1.2/public/js/babylon-game/ v1.2/public/player.html
git commit -m "feat: scaffold babylon-game directory and swap CDN scripts in player.html"
```

---

## Task 2: Socket Bridge (`socket-bridge.js`)

**Files:**
- Create: `v1.2/public/js/babylon-game/socket-bridge.js`

The socket bridge wraps the existing Socket.io connection so Babylon scenes don't couple directly to socket event names. It maps Babylon scene method calls to the existing server protocol.

- [ ] **Step 1: Create socket-bridge.js**

```javascript
// Evil Jeopardy 1.2 — Babylon.js Socket Bridge
// Bridges Babylon minigame scenes ↔ Socket.io server events

class SocketBridge {
  constructor(socket) {
    this.socket = socket;
    this._listeners = new Map();
  }

  // === Outgoing (scene → server) ===

  emitPhaseComplete(phase, score, details = {}) {
    if (!this.socket) return;
    this.socket.emit('baking:phase-complete', {
      teamId: this.teamId,
      phase,
      score: Math.round(score),
      details
    });
  }

  // === Incoming (server → scene) ===

  onPhaseCompleted(callback) {
    return this._on('baking:phase-completed', callback);
  }

  onChaosEvent(callback) {
    return this._on('baking:chaos-event', callback);
  }

  onTimeUp(callback) {
    return this._on('baking:time-up', callback);
  }

  onTimerTick(callback) {
    return this._on('baking:timer-tick', callback);
  }

  onBakingStarted(callback) {
    return this._on('baking:started', callback);
  }

  // === Lifecycle ===

  setTeamId(teamId) {
    this.teamId = teamId;
  }

  _on(event, callback) {
    if (!this.socket) return () => {};
    this.socket.on(event, callback);
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
    return () => this.socket.off(event, callback);
  }

  dispose() {
    for (const [event, callbacks] of this._listeners) {
      for (const cb of callbacks) {
        this.socket.off(event, cb);
      }
    }
    this._listeners.clear();
  }
}

window.SocketBridge = SocketBridge;
```

- [ ] **Step 2: Verify file is syntactically valid**

Open browser console on player page, confirm `window.SocketBridge` is a function (no syntax errors in load).

- [ ] **Step 3: Commit**

```bash
git add v1.2/public/js/babylon-game/socket-bridge.js
git commit -m "feat: add SocketBridge for Babylon scene ↔ server communication"
```

---

## Task 3: Shared Lighting (`shared/lighting.js`)

**Files:**
- Create: `v1.2/public/js/babylon-game/shared/lighting.js`

- [ ] **Step 1: Create lighting.js**

```javascript
// Evil Jeopardy 1.2 — Kitchen Lighting Rigs

class KitchenLighting {
  static setupNormal(scene) {
    // Warm overhead key light
    const key = new BABYLON.DirectionalLight(
      'keyLight',
      new BABYLON.Vector3(-1, -2, 1),
      scene
    );
    key.intensity = 0.9;
    key.diffuse = new BABYLON.Color3(1, 0.95, 0.85);

    // Soft fill from opposite side
    const fill = new BABYLON.HemisphericLight(
      'fillLight',
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    fill.intensity = 0.4;
    fill.diffuse = new BABYLON.Color3(0.9, 0.9, 1.0);
    fill.groundColor = new BABYLON.Color3(0.3, 0.25, 0.2);

    // Subtle rim/back light for depth
    const rim = new BABYLON.PointLight(
      'rimLight',
      new BABYLON.Vector3(3, 4, -3),
      scene
    );
    rim.intensity = 0.3;
    rim.diffuse = new BABYLON.Color3(1, 0.9, 0.7);

    return { key, fill, rim };
  }

  static setupCreepy(scene) {
    // Sickly green overhead
    const key = new BABYLON.DirectionalLight(
      'keyLight',
      new BABYLON.Vector3(-0.5, -3, 0.5),
      scene
    );
    key.intensity = 0.6;
    key.diffuse = new BABYLON.Color3(0.4, 0.9, 0.3);

    // Dim purple ambient
    const fill = new BABYLON.HemisphericLight(
      'fillLight',
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    fill.intensity = 0.2;
    fill.diffuse = new BABYLON.Color3(0.5, 0.3, 0.7);
    fill.groundColor = new BABYLON.Color3(0.1, 0.05, 0.15);

    // Flickering point light
    const flicker = new BABYLON.PointLight(
      'flickerLight',
      new BABYLON.Vector3(0, 3, 0),
      scene
    );
    flicker.intensity = 0.5;
    flicker.diffuse = new BABYLON.Color3(0.8, 1.0, 0.6);

    // Flicker animation
    scene.registerBeforeRender(() => {
      flicker.intensity = 0.3 + Math.random() * 0.4;
    });

    return { key, fill, flicker };
  }
}

window.KitchenLighting = KitchenLighting;
```

- [ ] **Step 2: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/lighting.js
git commit -m "feat: add KitchenLighting with normal and creepy rigs"
```

---

## Task 4: Shared Materials (`shared/materials.js`)

**Files:**
- Create: `v1.2/public/js/babylon-game/shared/materials.js`

- [ ] **Step 1: Create materials.js**

```javascript
// Evil Jeopardy 1.2 — Reusable PBR Materials

class MaterialLibrary {
  constructor(scene) {
    this.scene = scene;
    this._cache = {};
  }

  _getOrCreate(name, builder) {
    if (this._cache[name]) return this._cache[name];
    const mat = builder();
    this._cache[name] = mat;
    return mat;
  }

  wood() {
    return this._getOrCreate('wood', () => {
      const mat = new BABYLON.PBRMaterial('wood', this.scene);
      mat.albedoColor = new BABYLON.Color3(0.55, 0.35, 0.18);
      mat.metallic = 0;
      mat.roughness = 0.85;
      return mat;
    });
  }

  metal() {
    return this._getOrCreate('metal', () => {
      const mat = new BABYLON.PBRMaterial('metal', this.scene);
      mat.albedoColor = new BABYLON.Color3(0.8, 0.8, 0.82);
      mat.metallic = 0.9;
      mat.roughness = 0.3;
      return mat;
    });
  }

  glass() {
    return this._getOrCreate('glass', () => {
      const mat = new BABYLON.PBRMaterial('glass', this.scene);
      mat.albedoColor = new BABYLON.Color3(0.9, 0.95, 1.0);
      mat.metallic = 0;
      mat.roughness = 0.05;
      mat.alpha = 0.3;
      return mat;
    });
  }

  food(color) {
    const key = `food_${color.r}_${color.g}_${color.b}`;
    return this._getOrCreate(key, () => {
      const mat = new BABYLON.PBRMaterial(key, this.scene);
      mat.albedoColor = color;
      mat.metallic = 0;
      mat.roughness = 0.7;
      mat.subSurface.isTranslucencyEnabled = true;
      mat.subSurface.translucencyIntensity = 0.3;
      return mat;
    });
  }

  frosting(color) {
    const key = `frosting_${color.r}_${color.g}_${color.b}`;
    return this._getOrCreate(key, () => {
      const mat = new BABYLON.PBRMaterial(key, this.scene);
      mat.albedoColor = color;
      mat.metallic = 0.1;
      mat.roughness = 0.4;
      return mat;
    });
  }

  marble() {
    return this._getOrCreate('marble', () => {
      const mat = new BABYLON.PBRMaterial('marble', this.scene);
      mat.albedoColor = new BABYLON.Color3(0.92, 0.90, 0.88);
      mat.metallic = 0.05;
      mat.roughness = 0.25;
      return mat;
    });
  }

  cakeSponge() {
    return this._getOrCreate('cakeSponge', () => {
      const mat = new BABYLON.PBRMaterial('cakeSponge', this.scene);
      mat.albedoColor = new BABYLON.Color3(0.9, 0.75, 0.45);
      mat.metallic = 0;
      mat.roughness = 0.95;
      return mat;
    });
  }

  dispose() {
    for (const mat of Object.values(this._cache)) {
      mat.dispose();
    }
    this._cache = {};
  }
}

window.MaterialLibrary = MaterialLibrary;
```

- [ ] **Step 2: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/materials.js
git commit -m "feat: add MaterialLibrary with PBR materials for kitchen objects"
```

---

## Task 5: Shared Particles (`shared/particles.js`)

**Files:**
- Create: `v1.2/public/js/babylon-game/shared/particles.js`

- [ ] **Step 1: Create particles.js**

```javascript
// Evil Jeopardy 1.2 — Particle System Presets

class ParticlePresets {
  static steam(scene, emitter, options = {}) {
    const ps = new BABYLON.ParticleSystem('steam', 50, scene);
    ps.createPointEmitter(
      new BABYLON.Vector3(-0.1, 1, -0.1),
      new BABYLON.Vector3(0.1, 1.5, 0.1)
    );
    ps.emitter = emitter;
    ps.minLifeTime = 0.8;
    ps.maxLifeTime = 2.0;
    ps.minSize = 0.05;
    ps.maxSize = 0.2;
    ps.emitRate = options.rate || 15;
    ps.color1 = new BABYLON.Color4(1, 1, 1, 0.4);
    ps.color2 = new BABYLON.Color4(0.9, 0.9, 0.95, 0.1);
    ps.colorDead = new BABYLON.Color4(1, 1, 1, 0);
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new BABYLON.Vector3(0, 0.5, 0);
    return ps;
  }

  static flourDust(scene, emitter, options = {}) {
    const ps = new BABYLON.ParticleSystem('flour', 100, scene);
    ps.createPointEmitter(
      new BABYLON.Vector3(-0.3, 0, -0.3),
      new BABYLON.Vector3(0.3, 0.5, 0.3)
    );
    ps.emitter = emitter;
    ps.minLifeTime = 0.5;
    ps.maxLifeTime = 1.5;
    ps.minSize = 0.02;
    ps.maxSize = 0.08;
    ps.emitRate = options.rate || 40;
    ps.color1 = new BABYLON.Color4(1, 0.98, 0.9, 0.6);
    ps.color2 = new BABYLON.Color4(0.95, 0.92, 0.85, 0.2);
    ps.colorDead = new BABYLON.Color4(1, 1, 1, 0);
    ps.gravity = new BABYLON.Vector3(0, -0.3, 0);
    return ps;
  }

  static sparkles(scene, emitter, options = {}) {
    const ps = new BABYLON.ParticleSystem('sparkles', 60, scene);
    ps.createPointEmitter(
      new BABYLON.Vector3(-0.5, 0.5, -0.5),
      new BABYLON.Vector3(0.5, 2, 0.5)
    );
    ps.emitter = emitter;
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 1.0;
    ps.minSize = 0.02;
    ps.maxSize = 0.06;
    ps.emitRate = options.rate || 20;
    ps.color1 = new BABYLON.Color4(1, 0.9, 0.3, 1);
    ps.color2 = new BABYLON.Color4(1, 0.7, 0.1, 0.5);
    ps.colorDead = new BABYLON.Color4(1, 1, 0.5, 0);
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    return ps;
  }

  static confetti(scene, emitter, options = {}) {
    const ps = new BABYLON.ParticleSystem('confetti', 200, scene);
    ps.createPointEmitter(
      new BABYLON.Vector3(-2, 3, -2),
      new BABYLON.Vector3(2, 5, 2)
    );
    ps.emitter = emitter;
    ps.minLifeTime = 2;
    ps.maxLifeTime = 4;
    ps.minSize = 0.03;
    ps.maxSize = 0.08;
    ps.emitRate = options.rate || 80;
    ps.color1 = new BABYLON.Color4(1, 0.2, 0.3, 1);
    ps.color2 = new BABYLON.Color4(0.2, 0.5, 1, 1);
    ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);
    ps.gravity = new BABYLON.Vector3(0, -2, 0);
    ps.minAngularSpeed = -Math.PI;
    ps.maxAngularSpeed = Math.PI;
    return ps;
  }

  static splatter(scene, position, color, options = {}) {
    const ps = new BABYLON.ParticleSystem('splatter', 30, scene);
    ps.createSphereEmitter(0.1);
    ps.emitter = position;
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.8;
    ps.minSize = 0.02;
    ps.maxSize = 0.06;
    ps.manualEmitCount = options.count || 30;
    ps.emitRate = 0;
    ps.color1 = new BABYLON.Color4(color.r, color.g, color.b, 0.8);
    ps.color2 = new BABYLON.Color4(color.r * 0.8, color.g * 0.8, color.b * 0.8, 0.4);
    ps.colorDead = new BABYLON.Color4(color.r, color.g, color.b, 0);
    ps.gravity = new BABYLON.Vector3(0, -3, 0);
    ps.minEmitPower = 1;
    ps.maxEmitPower = 3;
    return ps;
  }

  static fire(scene, emitter, options = {}) {
    const ps = new BABYLON.ParticleSystem('fire', 80, scene);
    ps.createConeEmitter(0.1, Math.PI / 8);
    ps.emitter = emitter;
    ps.minLifeTime = 0.2;
    ps.maxLifeTime = 0.6;
    ps.minSize = 0.05;
    ps.maxSize = 0.15;
    ps.emitRate = options.rate || 40;
    ps.color1 = new BABYLON.Color4(1, 0.6, 0.1, 1);
    ps.color2 = new BABYLON.Color4(1, 0.2, 0, 0.5);
    ps.colorDead = new BABYLON.Color4(0.2, 0.2, 0.2, 0);
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new BABYLON.Vector3(0, 2, 0);
    return ps;
  }
}

window.ParticlePresets = ParticlePresets;
```

- [ ] **Step 2: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/particles.js
git commit -m "feat: add ParticlePresets (steam, flour, sparkles, confetti, splatter, fire)"
```

---

## Task 6: Shared Physics Helpers (`shared/physics-helpers.js`)

**Files:**
- Create: `v1.2/public/js/babylon-game/shared/physics-helpers.js`

- [ ] **Step 1: Create physics-helpers.js**

```javascript
// Evil Jeopardy 1.2 — Havok Physics Helpers

class PhysicsHelpers {
  static async initHavok(scene) {
    const havok = await HavokPhysics();
    const plugin = new BABYLON.HavokPlugin(true, havok);
    scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), plugin);
    return plugin;
  }

  static addStaticBody(mesh, scene) {
    const aggregate = new BABYLON.PhysicsAggregate(
      mesh,
      BABYLON.PhysicsShapeType.MESH,
      { mass: 0, restitution: 0.2 },
      scene
    );
    return aggregate;
  }

  static addDynamicBody(mesh, scene, options = {}) {
    const aggregate = new BABYLON.PhysicsAggregate(
      mesh,
      options.shapeType || BABYLON.PhysicsShapeType.BOX,
      {
        mass: options.mass || 1,
        restitution: options.restitution || 0.3,
        friction: options.friction || 0.5
      },
      scene
    );
    return aggregate;
  }

  static applyImpulse(aggregate, direction, magnitude) {
    const impulse = direction.normalize().scale(magnitude);
    aggregate.body.applyImpulse(
      impulse,
      aggregate.body.getObjectCenterWorld()
    );
  }

  static setGravity(scene, direction) {
    const plugin = scene.getPhysicsEngine()?.getPhysicsPlugin();
    if (plugin) {
      scene.getPhysicsEngine().setGravity(direction);
    }
  }

  static flipGravity(scene) {
    const engine = scene.getPhysicsEngine();
    if (!engine) return;
    const current = engine.gravity;
    engine.setGravity(current.scale(-1));
  }
}

window.PhysicsHelpers = PhysicsHelpers;
```

- [ ] **Step 2: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/physics-helpers.js
git commit -m "feat: add PhysicsHelpers for Havok physics integration"
```

---

## Task 7: Shared Camera Rigs (`shared/camera-rigs.js`)

**Files:**
- Create: `v1.2/public/js/babylon-game/shared/camera-rigs.js`

- [ ] **Step 1: Create camera-rigs.js**

```javascript
// Evil Jeopardy 1.2 — Camera Rig Presets

class CameraRigs {
  static topDown(scene, canvas, options = {}) {
    const camera = new BABYLON.ArcRotateCamera(
      'topDownCam',
      -Math.PI / 2,
      Math.PI / 4,
      options.distance || 8,
      options.target || BABYLON.Vector3.Zero(),
      scene
    );
    camera.lowerBetaLimit = Math.PI / 6;
    camera.upperBetaLimit = Math.PI / 3;
    camera.lowerRadiusLimit = options.minZoom || 5;
    camera.upperRadiusLimit = options.maxZoom || 12;
    camera.attachControl(canvas, true);
    camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
    return camera;
  }

  static orbit(scene, canvas, options = {}) {
    const camera = new BABYLON.ArcRotateCamera(
      'orbitCam',
      options.alpha || 0,
      options.beta || Math.PI / 3,
      options.distance || 10,
      options.target || BABYLON.Vector3.Zero(),
      scene
    );
    camera.attachControl(canvas, true);
    return camera;
  }

  static fixed(scene, position, target) {
    const camera = new BABYLON.FreeCamera(
      'fixedCam',
      position || new BABYLON.Vector3(0, 5, -8),
      scene
    );
    camera.setTarget(target || BABYLON.Vector3.Zero());
    return camera;
  }

  static isometric(scene, canvas, options = {}) {
    const camera = new BABYLON.ArcRotateCamera(
      'isoCam',
      Math.PI / 4,
      Math.PI / 3,
      options.distance || 15,
      options.target || BABYLON.Vector3.Zero(),
      scene
    );
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    const aspect = scene.getEngine().getAspectRatio(camera);
    const size = options.orthoSize || 6;
    camera.orthoLeft = -size * aspect;
    camera.orthoRight = size * aspect;
    camera.orthoTop = size;
    camera.orthoBottom = -size;
    camera.inputs.clear();
    return camera;
  }

  static dramaticReveal(scene, target, options = {}) {
    const camera = new BABYLON.ArcRotateCamera(
      'revealCam',
      0,
      Math.PI / 3,
      options.startDistance || 15,
      target || BABYLON.Vector3.Zero(),
      scene
    );

    const anim = new BABYLON.Animation(
      'revealOrbit',
      'alpha',
      30,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    );
    anim.setKeys([
      { frame: 0, value: 0 },
      { frame: 150, value: Math.PI * 2 }
    ]);
    camera.animations = [anim];

    return {
      camera,
      play: () => scene.beginAnimation(camera, 0, 150, true)
    };
  }
}

window.CameraRigs = CameraRigs;
```

- [ ] **Step 2: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/camera-rigs.js
git commit -m "feat: add CameraRigs with topDown, orbit, isometric, dramaticReveal presets"
```

---

## Task 8: HUD Overlay (`hud.js`)

**Files:**
- Create: `v1.2/public/js/babylon-game/hud.js`

- [ ] **Step 1: Create hud.js**

```javascript
// Evil Jeopardy 1.2 — Babylon.js GUI HUD Overlay

class HUD {
  constructor(scene) {
    this.scene = scene;
    this.texture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('hud', true, scene);

    this._buildTimer();
    this._buildScore();
    this._buildPhaseLabel();
    this._buildChaosBar();
  }

  _buildTimer() {
    this.timerText = new BABYLON.GUI.TextBlock('timer', '1:00');
    this.timerText.color = '#ffffff';
    this.timerText.fontSize = 36;
    this.timerText.fontFamily = 'monospace';
    this.timerText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.timerText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.timerText.paddingTop = '20px';
    this.timerText.paddingRight = '30px';
    this.timerText.outlineWidth = 2;
    this.timerText.outlineColor = '#000000';
    this.texture.addControl(this.timerText);
  }

  _buildScore() {
    this.scoreText = new BABYLON.GUI.TextBlock('score', 'Score: 0');
    this.scoreText.color = '#ffd700';
    this.scoreText.fontSize = 28;
    this.scoreText.fontFamily = 'monospace';
    this.scoreText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.scoreText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.scoreText.paddingTop = '20px';
    this.scoreText.paddingLeft = '30px';
    this.scoreText.outlineWidth = 2;
    this.scoreText.outlineColor = '#000000';
    this.texture.addControl(this.scoreText);
  }

  _buildPhaseLabel() {
    this.phaseText = new BABYLON.GUI.TextBlock('phase', 'PREP');
    this.phaseText.color = '#ffffff';
    this.phaseText.fontSize = 22;
    this.phaseText.fontFamily = 'Arial';
    this.phaseText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.phaseText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.phaseText.paddingTop = '20px';
    this.phaseText.outlineWidth = 2;
    this.phaseText.outlineColor = '#000000';
    this.texture.addControl(this.phaseText);
  }

  _buildChaosBar() {
    this.chaosContainer = new BABYLON.GUI.Rectangle('chaosContainer');
    this.chaosContainer.width = '200px';
    this.chaosContainer.height = '14px';
    this.chaosContainer.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.chaosContainer.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.chaosContainer.top = '55px';
    this.chaosContainer.background = '#333333';
    this.chaosContainer.cornerRadius = 7;
    this.chaosContainer.thickness = 1;
    this.chaosContainer.color = '#555555';
    this.chaosContainer.isVisible = false;
    this.texture.addControl(this.chaosContainer);

    this.chaosBar = new BABYLON.GUI.Rectangle('chaosBar');
    this.chaosBar.width = '0%';
    this.chaosBar.height = '100%';
    this.chaosBar.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.chaosBar.background = '#ff4444';
    this.chaosBar.cornerRadius = 7;
    this.chaosBar.thickness = 0;
    this.chaosContainer.addControl(this.chaosBar);
  }

  updateTimer(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    this.timerText.text = `${min}:${sec.toString().padStart(2, '0')}`;
    if (seconds <= 10) {
      this.timerText.color = '#ff4444';
    } else {
      this.timerText.color = '#ffffff';
    }
  }

  updateScore(score) {
    this.scoreText.text = `Score: ${Math.round(score)}`;
  }

  setPhase(phaseName) {
    this.phaseText.text = phaseName.toUpperCase();
  }

  setChaos(level, visible = true) {
    this.chaosContainer.isVisible = visible;
    const pct = Math.min(100, Math.max(0, level));
    this.chaosBar.width = `${pct}%`;
    if (pct > 75) {
      this.chaosBar.background = '#ff0000';
    } else if (pct > 40) {
      this.chaosBar.background = '#ff8800';
    } else {
      this.chaosBar.background = '#ffcc00';
    }
  }

  showMessage(text, duration = 2000) {
    const msg = new BABYLON.GUI.TextBlock('msg', text);
    msg.color = '#ffffff';
    msg.fontSize = 40;
    msg.fontFamily = 'Arial';
    msg.outlineWidth = 3;
    msg.outlineColor = '#000000';
    this.texture.addControl(msg);
    setTimeout(() => {
      this.texture.removeControl(msg);
      msg.dispose();
    }, duration);
  }

  dispose() {
    this.texture.dispose();
  }
}

window.HUD = HUD;
```

- [ ] **Step 2: Commit**

```bash
git add v1.2/public/js/babylon-game/hud.js
git commit -m "feat: add HUD overlay with timer, score, phase label, chaos bar"
```

---

## Task 9: Scene Manager + Base Scene (`scene-manager.js`)

**Files:**
- Create: `v1.2/public/js/babylon-game/scene-manager.js`

This is the most critical infrastructure file. It defines `BaseMinigameScene` (parent for all 11+ scenes) and `SceneManager` (handles lifecycle/transitions).

- [ ] **Step 1: Create scene-manager.js**

```javascript
// Evil Jeopardy 1.2 — Scene Manager + Base Scene

class BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options = {}) {
    this.babylonEngine = engine;
    this.canvas = canvas;
    this.socketBridge = socketBridge;
    this.options = options;
    this.inventory = options.inventory || [];
    this.teamId = options.teamId;
    this.score = 0;
    this.timeLimit = 60;
    this.timeRemaining = this.timeLimit;
    this.isComplete = false;
    this.scene = null;
    this.hud = null;
    this.materials = null;
    this._timerInterval = null;
    this._disposed = false;
  }

  async init() {
    this.scene = new BABYLON.Scene(this.babylonEngine);
    this.scene.clearColor = new BABYLON.Color4(0.05, 0.07, 0.09, 1);

    this.materials = new MaterialLibrary(this.scene);

    if (this.options.isAbsurd) {
      KitchenLighting.setupCreepy(this.scene);
    } else {
      KitchenLighting.setupNormal(this.scene);
    }

    this.hud = new HUD(this.scene);
    this.hud.setPhase(this.getPhaseName());

    if (this.options.chaosLevel) {
      this.hud.setChaos(this.options.chaosLevel, true);
    }

    await this.create();
    this._startTimer();
    this._registerUpdateLoop();
    this._subscribeToChaosEvents();
  }

  // Override in subclasses
  getPhaseName() { return 'UNKNOWN'; }
  async create() {}
  update(deltaTime) {}
  onTimeUp() { this.completePhase(); }
  onChaosEvent(event) {
    // Override in subclasses to handle chaos events (e.g., power flicker, gravity shift)
    // Default: show HUD message
    this.hud.showMessage(`⚡ ${event.name || 'Chaos!'}`, 1500);
  }

  _subscribeToChaosEvents() {
    this._chaosUnsub = this.socketBridge.onChaosEvent((event) => {
      if (!this._disposed && !this.isComplete) {
        this.onChaosEvent(event);
      }
    });
  }

  _startTimer() {
    this.timeRemaining = this.timeLimit;
    this.hud.updateTimer(this.timeRemaining);
    const startTime = performance.now();

    this._timerInterval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      this.timeRemaining = Math.max(0, this.timeLimit - elapsed);
      this.hud.updateTimer(this.timeRemaining);

      if (this.timeRemaining <= 0) {
        clearInterval(this._timerInterval);
        this.onTimeUp();
      }
    }, 100);
  }

  _registerUpdateLoop() {
    this.scene.registerBeforeRender(() => {
      if (this._disposed) return;
      const dt = this.babylonEngine.getDeltaTime() / 1000;
      this.update(dt);
    });
  }

  addScore(points) {
    this.score = Math.min(100, Math.max(0, this.score + points));
    this.hud.updateScore(this.score);
  }

  setScore(value) {
    this.score = Math.min(100, Math.max(0, value));
    this.hud.updateScore(this.score);
  }

  hasBoost(boostName) {
    return this.inventory.some(item => {
      const key = typeof item === 'string' ? item : item.item_key;
      return key === boostName;
    });
  }

  completePhase(details = {}) {
    if (this.isComplete) return;
    this.isComplete = true;
    clearInterval(this._timerInterval);

    this.socketBridge.emitPhaseComplete(
      this.getPhaseName().toLowerCase(),
      Math.round(this.score),
      details
    );
  }

  dispose() {
    this._disposed = true;
    clearInterval(this._timerInterval);
    if (this._chaosUnsub) this._chaosUnsub();
    if (this.hud) this.hud.dispose();
    if (this.materials) this.materials.dispose();
    if (this.scene) this.scene.dispose();
  }
}

class SceneManager {
  constructor(engine, canvas, socketBridge) {
    this.engine = engine;
    this.canvas = canvas;
    this.socketBridge = socketBridge;
    this.currentScene = null;
    this._registry = {};
  }

  register(sceneKey, SceneClass) {
    this._registry[sceneKey] = SceneClass;
  }

  async startScene(sceneKey, options = {}) {
    // Stop any existing render loop before transitioning
    this.engine.stopRenderLoop();

    if (this.currentScene) {
      this.currentScene.dispose();
      this.currentScene = null;
    }

    const SceneClass = this._registry[sceneKey];
    if (!SceneClass) {
      console.error(`Scene "${sceneKey}" not registered`);
      return null;
    }

    const scene = new SceneClass(this.engine, this.canvas, this.socketBridge, options);
    this.currentScene = scene;
    await scene.init();

    this.engine.runRenderLoop(() => {
      if (scene.scene && !scene._disposed) {
        scene.scene.render();
      }
    });

    return scene;
  }

  getActiveScene() {
    return this.currentScene;
  }

  dispose() {
    this.engine.stopRenderLoop();
    if (this.currentScene) {
      this.currentScene.dispose();
      this.currentScene = null;
    }
  }
}

// Scene key → class name mapping (matches minigames.json sceneKey values)
const SCENE_KEY_MAP = {
  'PrepScene':          'PrepScene3D',
  'MixScene':           'MixScene3D',
  'BakeScene':          'BakeScene3D',
  'CoolScene':          'CoolScene3D',
  'DecorateScene':      'DecorateScene3D',
  'PresentScene':       'PresentScene3D',
  'ResultScene':        'ResultScene3D',
  'CowCombatScene':     'CowCombat3D',
  'RacingOvenScene':    'RacingOven3D',
  'JewelSortScene':     'JewelSort3D',
  'GravityFlipScene':   'GravityFlip3D',
  'ObstacleCourseScene':'ObstacleCourse3D'
};

window.BaseMinigameScene = BaseMinigameScene;
window.SceneManager = SceneManager;
window.SCENE_KEY_MAP = SCENE_KEY_MAP;
```

- [ ] **Step 2: Commit**

```bash
git add v1.2/public/js/babylon-game/scene-manager.js
git commit -m "feat: add SceneManager and BaseMinigameScene with timer, scoring, socket bridge"
```

---

## Task 10: Engine (`engine.js`)

**Files:**
- Create: `v1.2/public/js/babylon-game/engine.js`

- [ ] **Step 1: Create engine.js**

```javascript
// Evil Jeopardy 1.2 — Babylon Game Engine

class BabylonGameEngine {
  constructor(containerId, socket, options = {}) {
    this.containerId = containerId;
    this.socket = socket;
    this.options = options;
    this.canvas = null;
    this.engine = null;
    this.sceneManager = null;
    this.socketBridge = null;
    this._initialized = false;
  }

  async init() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Container #${this.containerId} not found`);
      return;
    }

    container.innerHTML = '';
    container.style.display = 'block';

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'babylon-canvas';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.outline = 'none';
    container.appendChild(this.canvas);

    this.engine = new BABYLON.Engine(this.canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      antialias: true
    });

    this.socketBridge = new SocketBridge(this.socket);
    this.socketBridge.setTeamId(this.options.teamId);

    this.sceneManager = new SceneManager(this.engine, this.canvas, this.socketBridge);
    this._registerScenes();

    window.addEventListener('resize', this._onResize);
    this._initialized = true;
  }

  _onResize = () => {
    if (this.engine) this.engine.resize();
  };

  _registerScenes() {
    const sceneClasses = {
      PrepScene3D:       window.PrepScene3D,
      MixScene3D:        window.MixScene3D,
      BakeScene3D:       window.BakeScene3D,
      CoolScene3D:       window.CoolScene3D,
      DecorateScene3D:   window.DecorateScene3D,
      PresentScene3D:    window.PresentScene3D,
      ResultScene3D:     window.ResultScene3D,
      CowCombat3D:       window.CowCombat3D,
      RacingOven3D:      window.RacingOven3D,
      JewelSort3D:       window.JewelSort3D,
      GravityFlip3D:     window.GravityFlip3D,
      ObstacleCourse3D:  window.ObstacleCourse3D
    };

    for (const [key, SceneClass] of Object.entries(sceneClasses)) {
      if (SceneClass) {
        this.sceneManager.register(key, SceneClass);
      }
    }
  }

  async startScene(phaserSceneKey, options = {}) {
    const babylonKey = SCENE_KEY_MAP[phaserSceneKey] || phaserSceneKey;
    return this.sceneManager.startScene(babylonKey, options);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);

    if (this.sceneManager) {
      this.sceneManager.dispose();
      this.sceneManager = null;
    }

    if (this.socketBridge) {
      this.socketBridge.dispose();
      this.socketBridge = null;
    }

    if (this.engine) {
      this.engine.dispose();
      this.engine = null;
    }

    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
      this.canvas = null;
    }

    const container = document.getElementById(this.containerId);
    if (container) {
      container.style.display = 'none';
    }

    this._initialized = false;
  }
}

window.BabylonGameEngine = BabylonGameEngine;
```

- [ ] **Step 2: Verify engine boots**

After all infrastructure files are created, test that a BabylonGameEngine can be instantiated. Open browser console on the player page and run:

```javascript
const engine = new BabylonGameEngine('phaser-container', io());
await engine.init();
console.log('Engine initialized:', engine._initialized);
engine.destroy();
```

Expected: logs `Engine initialized: true`, a brief black canvas appears then disappears.

- [ ] **Step 3: Commit**

```bash
git add v1.2/public/js/babylon-game/engine.js
git commit -m "feat: add BabylonGameEngine — creates canvas, registers scenes, manages lifecycle"
```

---

## Task 11: Modify `player.js` — Replace Phaser with Babylon

**Files:**
- Modify: `v1.2/public/js/player.js:880-926` (`startBakingSession`)
- Modify: `v1.2/public/js/player.js:1008-1033` (`launchCakeRevealScene`)
- Modify: `v1.2/public/js/player.js:932-940` (`destroyBakingSession`)

This is the integration point — player.js currently calls `window.initGame()` (Phaser). Replace with `BabylonGameEngine`.

- [ ] **Step 1: Add a module-level variable for the Babylon engine**

At the top of player.js (near other state variables like `bakingSession`), add:

```javascript
let babylonEngine = null;
```

- [ ] **Step 2: Rewrite `startBakingSession()`**

Replace the existing `startBakingSession()` function (lines ~880-926) with:

```javascript
async function startBakingSession() {
  if (!window.BabylonGameEngine || !bakingSession.minigames.length) {
    return;
  }

  const activeTeamId = bakingSession.teamId || myTeam?.id || null;
  if (activeTeamId && (!myTeam || (myTeam.id && activeTeamId !== myTeam.id))) {
    return;
  }

  const inventory = getMyShopInventory();

  // Destroy previous engine if exists
  if (babylonEngine) {
    babylonEngine.destroy();
    babylonEngine = null;
  }

  babylonEngine = new BabylonGameEngine('phaser-container', socket, {
    teamId: activeTeamId
  });
  await babylonEngine.init();

  const startSelection = getBakingStartSelection();
  if (babylonEngine && startSelection) {
    const sceneKey = startSelection.sceneKey || 'PrepScene';
    await babylonEngine.startScene(sceneKey, {
      inventory,
      boosts: buildBakingBoosts(inventory),
      teamId: activeTeamId,
      chaosEvents: bakingSession.chaosEvents,
      chaosLevel: bakingSession.chaosLevel,
      isAbsurd: Boolean(startSelection.isAbsurd),
      selectionIndex: bakingSession.currentPhaseIndex,
      minigames: bakingSession.minigames
    });
  }
}
```

- [ ] **Step 3: Rewrite `destroyBakingSession()`**

```javascript
function destroyBakingSession() {
  if (babylonEngine) {
    babylonEngine.destroy();
    babylonEngine = null;
  }

  const container = document.getElementById('phaser-container');
  if (container) {
    container.style.display = 'none';
  }
}
```

- [ ] **Step 4: Rewrite `launchCakeRevealScene()`**

```javascript
async function launchCakeRevealScene(payload) {
  const container = document.getElementById('phaser-container');
  if (!container || !window.BabylonGameEngine || !window.ResultScene3D) {
    return false;
  }

  renderPlayerResultsPlaceholder();
  movePhaserContainerToResults();

  if (babylonEngine) {
    babylonEngine.destroy();
    babylonEngine = null;
  }

  babylonEngine = new BabylonGameEngine('phaser-container', socket, {
    teamId: payload.teamId || bakingSession.teamId
  });
  await babylonEngine.init();
  await babylonEngine.startScene('ResultScene', {
    cakeImagePath: payload.cakeImagePath,
    scores: payload.scores,
    chaosEvents: payload.chaosEvents
  });

  return true;
}
```

- [ ] **Step 5: Remove old `initGame` guard check**

The `startBakingSession` function previously checked `typeof window.initGame !== 'function'`. The new version checks `!window.BabylonGameEngine`. Make sure no other references to `window.initGame` remain in player.js that would prevent baking from starting. Search for any remaining `initGame` references and remove them.

- [ ] **Step 6: Verify the integration compiles**

Load `http://localhost:3001/player.html` — no JS errors in console related to player.js. The old Phaser scripts no longer load (404 is expected and fine since they were removed from the HTML).

- [ ] **Step 7: Commit**

```bash
git add v1.2/public/js/player.js
git commit -m "feat: integrate BabylonGameEngine into player.js, replacing Phaser initGame"
```

---

## Task 12: PrepScene3D (First Full Scene)

**Files:**
- Create: `v1.2/public/js/babylon-game/scenes/PrepScene3D.js`

**Spec reference:** Section "1. PREP — Pour & Measure (3D)" in the design spec.

This is the first real minigame. It establishes the pattern all other scenes follow. Build it completely — all subsequent scenes follow this structure.

- [ ] **Step 1: Create PrepScene3D.js**

```javascript
// Evil Jeopardy 1.2 — PrepScene3D (Ingredient Measurement Minigame)
// Tilt 3D ingredient containers to pour into measuring cups, then dump into mixing bowl.

class PrepScene3D extends BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options) {
    super(engine, canvas, socketBridge, options);
    this.timeLimit = 75;

    this.requiredIngredients = ['flour', 'sugar', 'eggs', 'butter', 'milk'];
    this.currentIngredientIndex = 0;
    this.ingredientScores = [];
    this.isPouring = false;
    this.pourLevel = 0;
    this.targetLevel = 0;
    this.pourSpeed = 0;

    // 3D objects
    this.counter = null;
    this.bowl = null;
    this.measuringCup = null;
    this.currentContainer = null;
    this.fillMesh = null;
    this.pourParticles = null;

    // UI
    this.fillGauge = null;
    this.targetZone = null;
    this.instructionText = null;
  }

  getPhaseName() { return 'PREP'; }

  async create() {
    const camera = CameraRigs.topDown(this.scene, this.canvas, {
      distance: 7,
      target: new BABYLON.Vector3(0, 0.5, 0)
    });
    camera.inputs.clear();

    await this._buildKitchenCounter();
    this._buildMixingBowl();
    this._buildMeasuringCup();
    this._buildFillGauge();
    this._loadIngredient(0);
    this._setupPointerEvents();
  }

  async _buildKitchenCounter() {
    this.counter = BABYLON.MeshBuilder.CreateBox('counter', {
      width: 6, height: 0.3, depth: 4
    }, this.scene);
    this.counter.position.y = -0.15;
    this.counter.material = this.materials.wood();
  }

  _buildMixingBowl() {
    // Half-sphere bowl
    this.bowl = BABYLON.MeshBuilder.CreateSphere('bowl', {
      diameter: 1.5,
      slice: 0.5
    }, this.scene);
    this.bowl.position = new BABYLON.Vector3(1.5, 0.4, 0);
    this.bowl.material = this.materials.metal();
  }

  _buildMeasuringCup() {
    this.measuringCup = BABYLON.MeshBuilder.CreateCylinder('cup', {
      diameterTop: 0.5,
      diameterBottom: 0.4,
      height: 0.7,
      tessellation: 24
    }, this.scene);
    this.measuringCup.position = new BABYLON.Vector3(0, 0.5, 0);
    this.measuringCup.material = this.materials.glass();

    // Fill level indicator inside the cup
    this.fillMesh = BABYLON.MeshBuilder.CreateCylinder('fill', {
      diameterTop: 0.38,
      diameterBottom: 0.3,
      height: 0.01,
      tessellation: 24
    }, this.scene);
    this.fillMesh.position = new BABYLON.Vector3(0, 0.2, 0);
    this.fillMesh.material = this.materials.food(
      new BABYLON.Color3(0.95, 0.92, 0.8)
    );
  }

  _buildFillGauge() {
    // 2D gauge using Babylon GUI on the HUD texture
    this.fillGauge = new BABYLON.GUI.Rectangle('fillGauge');
    this.fillGauge.width = '30px';
    this.fillGauge.height = '200px';
    this.fillGauge.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.fillGauge.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    this.fillGauge.left = '-80px';
    this.fillGauge.background = '#222222';
    this.fillGauge.thickness = 2;
    this.fillGauge.color = '#555555';
    this.fillGauge.cornerRadius = 4;
    this.hud.texture.addControl(this.fillGauge);

    // Target zone (green band)
    this.targetZone = new BABYLON.GUI.Rectangle('targetZone');
    this.targetZone.width = '100%';
    this.targetZone.height = '30px';
    this.targetZone.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.targetZone.top = '-70px';
    this.targetZone.background = 'rgba(0, 200, 0, 0.4)';
    this.targetZone.thickness = 0;
    this.fillGauge.addControl(this.targetZone);

    // Fill level bar
    this.fillBar = new BABYLON.GUI.Rectangle('fillBar');
    this.fillBar.width = '100%';
    this.fillBar.height = '0%';
    this.fillBar.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.fillBar.background = '#4488ff';
    this.fillBar.thickness = 0;
    this.fillGauge.addControl(this.fillBar);

    // Instruction text
    this.instructionText = new BABYLON.GUI.TextBlock('instruction', '');
    this.instructionText.color = '#ffffff';
    this.instructionText.fontSize = 20;
    this.instructionText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.instructionText.paddingBottom = '60px';
    this.instructionText.outlineWidth = 2;
    this.instructionText.outlineColor = '#000000';
    this.hud.texture.addControl(this.instructionText);
  }

  _loadIngredient(index) {
    if (this.currentContainer) {
      this.currentContainer.dispose();
    }
    if (this.pourParticles) {
      this.pourParticles.stop();
      this.pourParticles.dispose();
    }

    this.pourLevel = 0;
    this.targetLevel = 0.6 + Math.random() * 0.2; // 60-80% fill
    this.isPouring = false;

    const ingredient = this.requiredIngredients[index];
    const colors = {
      flour:  new BABYLON.Color3(0.95, 0.92, 0.82),
      sugar:  new BABYLON.Color3(1, 1, 0.95),
      eggs:   new BABYLON.Color3(1, 0.85, 0.3),
      butter: new BABYLON.Color3(1, 0.9, 0.5),
      milk:   new BABYLON.Color3(0.95, 0.95, 0.98)
    };
    const color = colors[ingredient] || new BABYLON.Color3(0.8, 0.8, 0.8);

    // Container (box shape for bags/boxes)
    this.currentContainer = BABYLON.MeshBuilder.CreateBox('container', {
      width: 0.6, height: 0.8, depth: 0.4
    }, this.scene);
    this.currentContainer.position = new BABYLON.Vector3(-1.5, 0.6, 0);
    this.currentContainer.material = this.materials.food(color);

    this.fillMesh.material = this.materials.food(color);

    // Pour particle system
    this.pourParticles = ParticlePresets.flourDust(
      this.scene,
      this.currentContainer,
      { rate: 0 }
    );
    this.pourParticles.color1 = new BABYLON.Color4(color.r, color.g, color.b, 0.8);
    this.pourParticles.color2 = new BABYLON.Color4(color.r, color.g, color.b, 0.4);
    this.pourParticles.start();

    this.instructionText.text = `Pour ${ingredient} — click & hold to pour, release to stop`;
    this._updateFillGauge();
  }

  _setupPointerEvents() {
    this.scene.onPointerDown = () => {
      if (this.isComplete) return;
      this.isPouring = true;
      this.pourParticles.emitRate = 40;
    };

    this.scene.onPointerUp = () => {
      this.isPouring = false;
      this.pourParticles.emitRate = 0;

      if (this.pourLevel > 0) {
        this._scoreIngredient();
      }
    };
  }

  update(dt) {
    if (this.isComplete) return;

    if (this.isPouring) {
      this.pourLevel = Math.min(1.0, this.pourLevel + dt * 0.5);
      this._updateFillVisuals();
      this._updateFillGauge();
    }
  }

  _updateFillVisuals() {
    const height = Math.max(0.01, this.pourLevel * 0.6);
    this.fillMesh.scaling.y = height / 0.01;
    this.fillMesh.position.y = 0.2 + (height / 2);
  }

  _updateFillGauge() {
    const pct = Math.round(this.pourLevel * 100);
    this.fillBar.height = `${pct}%`;

    const diff = Math.abs(this.pourLevel - this.targetLevel);
    if (diff < 0.05) {
      this.fillBar.background = '#44ff44';
    } else if (diff < 0.15) {
      this.fillBar.background = '#ffaa00';
    } else {
      this.fillBar.background = '#4488ff';
    }
  }

  _scoreIngredient() {
    const diff = Math.abs(this.pourLevel - this.targetLevel);
    let ingredientScore;
    if (diff < 0.05) {
      ingredientScore = 20;
    } else if (diff < 0.10) {
      ingredientScore = 15;
    } else if (diff < 0.20) {
      ingredientScore = 10;
    } else if (diff < 0.35) {
      ingredientScore = 5;
    } else {
      ingredientScore = 2;
    }

    this.ingredientScores.push(ingredientScore);
    this.addScore(ingredientScore);

    this.hud.showMessage(
      ingredientScore >= 15 ? 'Perfect!' : ingredientScore >= 10 ? 'Good!' : 'Off target...',
      1200
    );

    // Move bowl ingredient mesh (visual feedback — splat in bowl)
    const splat = ParticlePresets.splatter(
      this.scene,
      this.bowl.position.clone(),
      this.fillMesh.material.albedoColor
    );
    splat.start();
    setTimeout(() => { splat.stop(); splat.dispose(); }, 800);

    this.currentIngredientIndex++;
    if (this.currentIngredientIndex < this.requiredIngredients.length) {
      this._loadIngredient(this.currentIngredientIndex);
    } else {
      this.instructionText.text = 'All ingredients measured!';
      this.completePhase({
        ingredientScores: this.ingredientScores,
        ingredientCount: this.requiredIngredients.length
      });
    }
  }

  onTimeUp() {
    // Score any remaining ingredients as 0
    while (this.ingredientScores.length < this.requiredIngredients.length) {
      this.ingredientScores.push(0);
    }
    this.completePhase({
      ingredientScores: this.ingredientScores,
      ingredientCount: this.requiredIngredients.length,
      timedOut: true
    });
  }
}

window.PrepScene3D = PrepScene3D;
```

- [ ] **Step 2: End-to-end test**

1. Start server (`node server/index.js`)
2. Open host page → create game → create teams → start trivia → complete → shop → start baking
3. Open player page → join team → wait for baking phase
4. When "Start Baking" is clicked on host, verify:
   - Babylon canvas appears in player page
   - Kitchen counter, measuring cup, bowl visible
   - Click and hold pours ingredient (particles + fill gauge)
   - Release scores the ingredient
   - After 5 ingredients, phase completes and score is sent to server

- [ ] **Step 3: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes/PrepScene3D.js
git commit -m "feat: add PrepScene3D — 3D ingredient pouring minigame with fill gauge and scoring"
```

---

## Task 13: MixScene3D

**Files:**
- Create: `v1.2/public/js/babylon-game/scenes/MixScene3D.js`

**Spec reference:** Section "2. MIX — Circular Stirring (3D)"

- [ ] **Step 1: Create MixScene3D.js**

Core gameplay: Player draws circles with mouse in a 3D mixing bowl. Track angular velocity. 3 rounds with increasing target speeds. Electric mixer boost widens tolerance.

Key implementation points:
- Extend `BaseMinigameScene`, set `timeLimit = 50`
- `getPhaseName()` returns `'MIX'`
- Bowl mesh (half-sphere from above at 45° angle) using `CameraRigs.topDown`
- Whisk mesh follows cursor via raycasting onto a horizontal plane at bowl level
- Track last N pointer positions, compute angular velocity (radians/second) around bowl center
- Speed meter: Babylon GUI ring showing current vs target speed
- Batter visual: disc mesh inside bowl with vertex displacement based on whisk position
- 3 rounds (`targetSpeeds = [1.5, 2.5, 3.5]` rad/s), 15 seconds each
- Score per round 0-33, based on % time spent within ±0.5 rad/s of target
- Splatter particles when speed > target + 1.0
- `hasBoost('electric-mixer')` → wider tolerance (±1.0 instead of ±0.5)
- On complete: `completePhase({ roundScores: [...], mixQuality })

```javascript
class MixScene3D extends BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options) {
    super(engine, canvas, socketBridge, options);
    this.timeLimit = 50;
    this.currentRound = 0;
    this.rounds = [
      { targetSpeed: 1.5, duration: 15 },
      { targetSpeed: 2.5, duration: 15 },
      { targetSpeed: 3.5, duration: 15 }
    ];
    this.roundScores = [];
    this.roundStartTime = 0;
    this.timeInZone = 0;
    this.pointerHistory = [];
    this.angularVelocity = 0;
    this.whisk = null;
    this.bowl = null;
    this.batter = null;
    this.speedMeter = null;
  }

  getPhaseName() { return 'MIX'; }

  async create() {
    CameraRigs.topDown(this.scene, this.canvas, {
      distance: 5,
      target: new BABYLON.Vector3(0, 0, 0)
    }).inputs.clear();

    this._buildBowl();
    this._buildWhisk();
    this._buildBatter();
    this._buildSpeedMeter();
    this._setupPointerTracking();
    this._startRound(0);
  }

  _buildBowl() {
    this.bowl = BABYLON.MeshBuilder.CreateSphere('bowl', {
      diameter: 3, slice: 0.5
    }, this.scene);
    this.bowl.position.y = 0;
    this.bowl.material = this.materials.metal();
  }

  _buildWhisk() {
    this.whisk = BABYLON.MeshBuilder.CreateCylinder('whisk', {
      diameterTop: 0.05, diameterBottom: 0.1, height: 1.2
    }, this.scene);
    this.whisk.position = new BABYLON.Vector3(0, 0.6, 0);
    this.whisk.material = this.materials.metal();
  }

  _buildBatter() {
    this.batter = BABYLON.MeshBuilder.CreateDisc('batter', {
      radius: 1.2, tessellation: 32
    }, this.scene);
    this.batter.rotation.x = Math.PI / 2;
    this.batter.position.y = 0.1;
    this.batter.material = this.materials.food(
      new BABYLON.Color3(0.85, 0.75, 0.5)
    );
  }

  _buildSpeedMeter() {
    this.speedMeter = new BABYLON.GUI.Ellipse('speedMeter');
    this.speedMeter.width = '120px';
    this.speedMeter.height = '120px';
    this.speedMeter.thickness = 6;
    this.speedMeter.color = '#44ff44';
    this.speedMeter.background = 'rgba(0,0,0,0.3)';
    this.speedMeter.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.speedMeter.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    this.speedMeter.left = '-60px';
    this.hud.texture.addControl(this.speedMeter);

    this.speedText = new BABYLON.GUI.TextBlock('speedTxt', '0.0');
    this.speedText.color = '#ffffff';
    this.speedText.fontSize = 20;
    this.speedMeter.addControl(this.speedText);
  }

  _setupPointerTracking() {
    this.scene.onPointerMove = (evt) => {
      const pick = this.scene.pick(evt.offsetX, evt.offsetY);
      if (pick.hit) {
        this.whisk.position.x = pick.pickedPoint.x * 0.8;
        this.whisk.position.z = pick.pickedPoint.z * 0.8;
      }

      this.pointerHistory.push({
        x: evt.offsetX,
        y: evt.offsetY,
        t: performance.now()
      });
      if (this.pointerHistory.length > 30) {
        this.pointerHistory.shift();
      }
    };
  }

  _startRound(index) {
    this.currentRound = index;
    this.roundStartTime = performance.now();
    this.timeInZone = 0;
    this.pointerHistory = [];
    const round = this.rounds[index];
    this.hud.showMessage(`Round ${index + 1}: Speed ${round.targetSpeed.toFixed(1)}`, 1500);
  }

  update(dt) {
    if (this.isComplete || this.currentRound >= this.rounds.length) return;

    this._computeAngularVelocity();
    this._updateSpeedMeter();

    const round = this.rounds[this.currentRound];
    const tolerance = this.hasBoost('electric-mixer') ? 1.0 : 0.5;
    const diff = Math.abs(this.angularVelocity - round.targetSpeed);

    if (diff <= tolerance) {
      this.timeInZone += dt;
    }

    if (this.angularVelocity > round.targetSpeed + 1.0) {
      const splat = ParticlePresets.splatter(
        this.scene,
        this.bowl.position.clone().add(new BABYLON.Vector3(
          (Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2
        )),
        new BABYLON.Color3(0.85, 0.75, 0.5)
      );
      splat.start();
      setTimeout(() => { splat.stop(); splat.dispose(); }, 500);
    }

    const elapsed = (performance.now() - this.roundStartTime) / 1000;
    if (elapsed >= round.duration) {
      const roundScore = Math.round((this.timeInZone / round.duration) * 33);
      this.roundScores.push(roundScore);
      this.addScore(roundScore);

      if (this.currentRound + 1 < this.rounds.length) {
        this._startRound(this.currentRound + 1);
      } else {
        this.completePhase({
          roundScores: this.roundScores,
          mixQuality: this.score >= 80 ? 'smooth' : this.score >= 50 ? 'decent' : 'lumpy'
        });
      }
    }
  }

  _computeAngularVelocity() {
    if (this.pointerHistory.length < 5) {
      this.angularVelocity = 0;
      return;
    }
    const recent = this.pointerHistory.slice(-10);
    let totalAngle = 0;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    for (let i = 1; i < recent.length; i++) {
      const a1 = Math.atan2(recent[i-1].y - cy, recent[i-1].x - cx);
      const a2 = Math.atan2(recent[i].y - cy, recent[i].x - cx);
      let da = a2 - a1;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      totalAngle += Math.abs(da);
    }

    const timeDelta = (recent[recent.length-1].t - recent[0].t) / 1000;
    this.angularVelocity = timeDelta > 0 ? totalAngle / timeDelta : 0;
  }

  _updateSpeedMeter() {
    if (!this.speedText) return;
    this.speedText.text = this.angularVelocity.toFixed(1);
    const round = this.rounds[this.currentRound];
    if (!round) return;
    const tolerance = this.hasBoost('electric-mixer') ? 1.0 : 0.5;
    const diff = Math.abs(this.angularVelocity - round.targetSpeed);
    if (diff <= tolerance) {
      this.speedMeter.color = '#44ff44';
    } else if (diff <= tolerance * 2) {
      this.speedMeter.color = '#ffaa00';
    } else {
      this.speedMeter.color = '#ff4444';
    }
  }
}

window.MixScene3D = MixScene3D;
```

- [ ] **Step 2: Test MixScene3D in browser**

Navigate to baking phase, verify mix scene loads when mix phase is selected. Check circular mouse tracking, speed meter, round progression.

- [ ] **Step 3: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes/MixScene3D.js
git commit -m "feat: add MixScene3D — circular stirring minigame with speed tracking and rounds"
```

---

## Task 14: BakeScene3D

**Files:**
- Create: `v1.2/public/js/babylon-game/scenes/BakeScene3D.js`

**Spec reference:** Section "3. BAKE — Oven Temperature Control (3D)"

- [ ] **Step 1: Create BakeScene3D.js**

Core gameplay: Keep oven temperature in shifting target zones. Temperature has inertia. Cake visually rises/burns. Thermometer boost widens tolerance.

Key implementation:
- Extend `BaseMinigameScene`, `timeLimit = 45`
- `getPhaseName()` returns `'BAKE'`
- `CameraRigs.fixed` positioned to see oven front-on
- Oven: procedural box with door, glass window (transparent material), interior glow (point light)
- Cake inside: cylinder mesh with scaling.y driven by bake quality
- Temperature system: `currentTemp`, `targetTemp`, `tempVelocity`, thermal damping
- +/- buttons (Babylon GUI) adjust `tempVelocity`
- Target zone shifts every 10 seconds
- Score = % time in zone × 100
- Cake morphs: flat (scaling.y=0.3) → risen (1.0) → overflowed (1.5 + splat particles)
- Heat distortion: post-process effect on oven window area
- `hasBoost('oven-thermometer')` → show exact target zone boundaries, 1.1x score multiplier

```javascript
class BakeScene3D extends BaseMinigameScene {
  // ... (follows same pattern as PrepScene3D and MixScene3D)
  // Full implementation: oven model, temperature dial, cake mesh morphing,
  // thermal inertia simulation, target zone tracking, scoring
}
window.BakeScene3D = BakeScene3D;
```

Implement following the same structure as PrepScene3D: constructor with state, `getPhaseName()`, `create()` builds scene, `update(dt)` runs simulation, scoring via `addScore`/`completePhase`. Full code to be written during implementation — use the spec section "3. BAKE" for exact mechanics.

- [ ] **Step 2: Test BakeScene3D**
- [ ] **Step 3: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes/BakeScene3D.js
git commit -m "feat: add BakeScene3D — oven temperature control with thermal inertia"
```

---

## Task 15: CoolScene3D

**Files:**
- Create: `v1.2/public/js/babylon-game/scenes/CoolScene3D.js`

**Spec reference:** Section "4. COOL — Patience & Fan Control (3D)"

- [ ] **Step 1: Create CoolScene3D.js**

Core mechanics: Fan the cake to cool it — too fast cracks it, too slow causes condensation. Sweet spot is steady medium fanning. Temperature heat map shader on cake surface. Score based on cooling speed without cracks.

Key implementation:
- `timeLimit = 40`, `getPhaseName()` returns `'COOL'`
- Cake on wire cooling rack (thin cylinders in grid pattern)
- Fan follows cursor position, click/hold to blow
- Steam particles rising from cake, deflected by fan direction
- Temperature simulation: cake starts hot, fan reduces temp, rate depends on fan intensity
- Crack system: if fan intensity > threshold for > 2 seconds, crack appears (mesh deformation)
- Condensation: if fan intensity < threshold for > 5 seconds, droplets appear
- Score = cooling_efficiency × (1 - crack_penalty)

- [ ] **Step 2: Test CoolScene3D**
- [ ] **Step 3: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes/CoolScene3D.js
git commit -m "feat: add CoolScene3D — fan cooling minigame with crack/condensation mechanics"
```

---

## Task 16: DecorateScene3D

**Files:**
- Create: `v1.2/public/js/babylon-game/scenes/DecorateScene3D.js`

**Spec reference:** Section "5. DECORATE — Creative Showpiece (3D)"

- [ ] **Step 1: Create DecorateScene3D.js**

Most complex normal scene. Features:
- `timeLimit = 60`, `getPhaseName()` returns `'DECORATE'`
- Rotatable 3D cake on turntable (`CameraRigs.orbit` with turntable drag)
- Frosting tool: click + drag on cake surface → line renderer extrudes 3D frosting mesh along path
- Color palette: Babylon GUI color picker buttons
- Topping shelf: draggable 3D meshes (fruit, sprinkles) → snap to cake surface via raycasting
- Fondant: click + drag to cover cake sections
- Reference image panel showing target cake
- Scoring: accuracy (0-40), creativity (0-30), neatness (0-30)
- `hasBoost('food-coloring')` → more color options
- `hasBoost('fondant')` → smoother coverage

- [ ] **Step 2: Test DecorateScene3D**
- [ ] **Step 3: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes/DecorateScene3D.js
git commit -m "feat: add DecorateScene3D — cake decorating with frosting, toppings, fondant"
```

---

## Task 17: PresentScene3D

**Files:**
- Create: `v1.2/public/js/babylon-game/scenes/PresentScene3D.js`

**Spec reference:** Section "6. PRESENT — Cake Arrangement & Reveal (3D)"

- [ ] **Step 1: Create PresentScene3D.js**

Key features:
- `timeLimit = 45`, `getPhaseName()` returns `'PRESENT'`
- Finished cake on presentation table
- 3 plating options (cake stand, board, plate) — click to select
- Garnish tray: draggable items (mint, berries, chocolate shavings)
- Lighting selector: warm / cool / dramatic spotlight
- Confirm button → dramatic camera orbit reveal
- Score: plating (0-30) + garnish placement (0-40) + lighting (0-30) = max 100
- Does NOT aggregate previous scores — sends only presentation score

- [ ] **Step 2: Test PresentScene3D**
- [ ] **Step 3: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes/PresentScene3D.js
git commit -m "feat: add PresentScene3D — cake presentation with plating, garnish, lighting"
```

---

## Task 18: Phase Transition System

**Files:**
- Modify: `v1.2/public/js/babylon-game/engine.js`
- Modify: `v1.2/public/js/babylon-game/scene-manager.js`

The Phaser system uses `PhaseSelectScene` as a transition screen between minigames. Babylon needs equivalent functionality — a brief "Phase N: NAME" countdown screen between scenes.

**Ownership rule:** The `BabylonGameEngine` owns ALL phase advancement logic for Babylon scenes. The existing `player.js` phase-transition system (which shows/hides HTML sections) is NOT involved once Babylon takes over rendering. The `baking:phase-completed` listener lives in `BabylonGameEngine` (not SocketBridge, not player.js).

- [ ] **Step 1: Add phase transition to SceneManager**

Add a `transitionToScene(sceneKey, options)` method to `SceneManager` that:
1. Stops render loop and disposes current scene
2. Creates a temporary Babylon scene with GUI text showing phase name + 3-2-1 countdown
3. After 3-second countdown, calls `this.startScene(sceneKey, options)`

```javascript
// Add to SceneManager class
async transitionToScene(sceneKey, options = {}) {
  this.engine.stopRenderLoop();
  if (this.currentScene) {
    this.currentScene.dispose();
    this.currentScene = null;
  }

  // Temporary countdown scene
  const countdownScene = new BABYLON.Scene(this.engine);
  countdownScene.clearColor = new BABYLON.Color4(0.05, 0.07, 0.09, 1);
  const cam = new BABYLON.FreeCamera('cam', BABYLON.Vector3.Zero(), countdownScene);
  const gui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('countdown', true, countdownScene);

  const phaseLabel = new BABYLON.GUI.TextBlock('phase', options.phaseName || sceneKey);
  phaseLabel.color = '#ffffff';
  phaseLabel.fontSize = 48;
  phaseLabel.top = '-60px';
  gui.addControl(phaseLabel);

  const countText = new BABYLON.GUI.TextBlock('count', '3');
  countText.color = '#ffd700';
  countText.fontSize = 72;
  countText.top = '40px';
  gui.addControl(countText);

  this.engine.runRenderLoop(() => countdownScene.render());

  for (let i = 3; i >= 1; i--) {
    countText.text = String(i);
    await new Promise(r => setTimeout(r, 1000));
  }

  this.engine.stopRenderLoop();
  gui.dispose();
  countdownScene.dispose();

  return this.startScene(sceneKey, options);
}
```

- [ ] **Step 2: Wire `baking:phase-completed` inside BabylonGameEngine**

Add a `_setupPhaseAdvancement()` method in `BabylonGameEngine.init()` that subscribes to `baking:phase-completed` via the SocketBridge. When received, it increments `currentPhaseIndex`, looks up the next minigame from `this.options.minigames`, maps its `sceneKey` through `SCENE_KEY_MAP`, and calls `this.sceneManager.transitionToScene(...)`.

```javascript
// In BabylonGameEngine class
_setupPhaseAdvancement() {
  this.socketBridge.onPhaseCompleted((data) => {
    this._currentPhaseIndex++;
    const minigames = this.options.minigames || [];
    const next = minigames[this._currentPhaseIndex];
    if (!next) return; // All phases done

    const sceneKey = SCENE_KEY_MAP[next.sceneKey] || next.sceneKey;
    this.sceneManager.transitionToScene(sceneKey, {
      ...this.options,
      isAbsurd: Boolean(next.isAbsurd),
      phaseName: next.phaseName || next.phase?.toUpperCase()
    });
  });
}
```

- [ ] **Step 3: Test full multi-phase flow**

Start baking → Prep completes → transition screen → Mix loads → Mix completes → transition → Bake loads. Verify scores accumulate on server.

- [ ] **Step 4: Commit**

```bash
git add v1.2/public/js/babylon-game/scene-manager.js v1.2/public/js/babylon-game/engine.js
git commit -m "feat: add phase transition system with countdown between minigames"
```

---

## Task 19: CowCombat3D (Absurd — Mix)

**Files:**
- Create: `v1.2/public/js/babylon-game/scenes-absurd/CowCombat3D.js`

**Spec reference:** "CowCombat3D" in Absurd Minigame Designs section

- [ ] **Step 1: Create CowCombat3D.js**

Absurd mix replacement. Rhythm-clicking cow udders while cow fights back.

Key features:
- `isAbsurd: true` in options → creepy lighting
- `CameraRigs.isometric` for farm scene
- 3D cow (procedural box-based body + legs, or loaded .glb model)
- Milk bucket with physics (fills up)
- Rhythm targets: circular hitboxes on udder area, pulse in patterns
- Cow AI: kick (pushes player cursor away), spin, charge
- Dodge mechanic: if cow charges, click dodge area to avoid stun
- Ragdoll on cow stun (temporary physics on cow body segments)
- Score based on successful milks - penalty for stuns

- [ ] **Step 2: Test CowCombat3D**
- [ ] **Step 3: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes-absurd/CowCombat3D.js
git commit -m "feat: add CowCombat3D — absurd rhythm milking minigame"
```

---

## Task 20: RacingOven3D (Absurd — Bake)

**Files:**
- Create: `v1.2/public/js/babylon-game/scenes-absurd/RacingOven3D.js`

**Spec reference:** "RacingOven3D" in Absurd Minigame Designs section

- [ ] **Step 1: Create RacingOven3D.js**

Absurd bake replacement. Oven on rails through obstacle course.

Key features:
- Isometric camera, dark industrial kitchen aesthetic
- Oven-cart: box mesh on moving platform
- Track: procedural ground plane scrolling toward camera
- Obstacles: potholes (gaps), swinging pendulums (animated cylinders), ramps
- Left/right steering via arrow keys or mouse
- Jump button (space) for gaps
- Temperature boosts: collectible orbs that maintain oven heat
- Cake inside bounces with physics (visible through glass)
- Score: distance × temperature_maintenance - crash_penalty

- [ ] **Step 2: Test RacingOven3D**
- [ ] **Step 3: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes-absurd/RacingOven3D.js
git commit -m "feat: add RacingOven3D — absurd oven racing obstacle course"
```

---

## Task 21: JewelSort3D (Absurd — Cool)

**Files:**
- Create: `v1.2/public/js/babylon-game/scenes-absurd/JewelSort3D.js`

**Spec reference:** "JewelSort3D" in Absurd Minigame Designs section

- [ ] **Step 1: Create JewelSort3D.js**

Crystallized ingredient gems on conveyor belt. Sort by color into vats.

Key features:
- Isometric camera, crystal cave aesthetic
- Conveyor belt: animated plane moving right-to-left
- Gems: icosphere meshes with emissive materials (different colors)
- Sorting vats: 4 colored containers at bottom
- Click gem → click vat to sort (or drag)
- Speed increases over time
- Wrong sort = -5 points, correct = +10
- Vat overflow if too many of one color (physics: gems tumble out)
- Reject chute for gems player can't sort in time

- [ ] **Step 2: Test JewelSort3D**
- [ ] **Step 3: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes-absurd/JewelSort3D.js
git commit -m "feat: add JewelSort3D — absurd gem sorting on conveyor belt"
```

---

## Task 22: GravityFlip3D (Absurd — Decorate)

**Files:**
- Create: `v1.2/public/js/babylon-game/scenes-absurd/GravityFlip3D.js`

**Spec reference:** "GravityFlip3D" in Absurd Minigame Designs section

- [ ] **Step 1: Create GravityFlip3D.js**

Room rotates, gravity shifts. Keep cake on cooling rack.

Key features:
- Isometric camera, M.C. Escher aesthetic
- Room: box with walls/floor/ceiling, all have physics bodies
- Cake on wire rack: must stay on rack
- Gravity flips every 3-5 seconds (PhysicsHelpers.setGravity with random direction)
- All furniture (tables, chairs, pots) are physics bodies that tumble
- Click to anchor cake at right moment (temporarily fixes position)
- Dodge flying objects — if object hits cake, damage penalty
- Score: survival time × (1 - damage_taken)

- [ ] **Step 2: Test GravityFlip3D**
- [ ] **Step 3: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes-absurd/GravityFlip3D.js
git commit -m "feat: add GravityFlip3D — absurd gravity-shifting cake survival"
```

---

## Task 23: ObstacleCourse3D (Absurd — Present)

**Files:**
- Create: `v1.2/public/js/babylon-game/scenes-absurd/ObstacleCourse3D.js`

**Spec reference:** "ObstacleCourse3D" in Absurd Minigame Designs section

- [ ] **Step 1: Create ObstacleCourse3D.js**

Navigate cake through kitchen hazard gauntlet.

Key features:
- Isometric camera, industrial kitchen nightmare
- Player character carrying cake: capsule mesh with cake on top
- WASD/arrows to move
- Obstacles: swinging rolling pins (animated), falling pots (timed drops), slippery butter (reduced friction zones), collapsing shelves
- Each hit damages cake (reduce score)
- Reach presentation table for completion bonus
- Cake can visually break apart if hit too hard (mesh fragments with physics)

- [ ] **Step 2: Test ObstacleCourse3D**
- [ ] **Step 3: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes-absurd/ObstacleCourse3D.js
git commit -m "feat: add ObstacleCourse3D — absurd cake delivery gauntlet"
```

---

## Task 24: ResultScene3D (Cake Reveal)

**Files:**
- Create: `v1.2/public/js/babylon-game/scenes/ResultScene3D.js`

**Spec reference:** "What Stays vs Changes" — ResultScene rewrite

- [ ] **Step 1: Create ResultScene3D.js**

Replaces Phaser `ResultScene`. Dramatic 3D cake reveal with score animation.

**IMPORTANT:** This scene does NOT extend `BaseMinigameScene` — it extends nothing (standalone class). It creates its own Babylon scene, camera, and GUI without timer/scoring/phase-complete logic. It's a display-only scene.

```javascript
class ResultScene3D {
  constructor(engine, canvas, socketBridge, options) {
    this.babylonEngine = engine;
    this.canvas = canvas;
    this.options = options;
    this.scene = null;
    this._disposed = false;
  }

  async init() {
    this.scene = new BABYLON.Scene(this.babylonEngine);
    this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
    await this.create();
  }

  async create() {
    // Spotlight on cake
    // 3D cake model (cylinder with frosting)
    // CameraRigs.dramaticReveal orbiting
    // Score GUI text blocks with staggered fade-in
    // Confetti on high total
  }

  getPhaseName() { return 'RESULT'; }
  update() {}
  dispose() {
    this._disposed = true;
    if (this.scene) this.scene.dispose();
  }
}
window.ResultScene3D = ResultScene3D;
```

Key features:
- Standalone class (NOT BaseMinigameScene) — no timer, no scoring, no `completePhase()`
- `getPhaseName()` returns `'RESULT'` (for compatibility with SceneManager which calls it)
- Black background with spotlight
- 3D cake model (placeholder cylinder with frosting material) center stage
- `CameraRigs.dramaticReveal` orbiting around cake
- Score categories animate in one by one (GUI text blocks with fade-in animations):
  - Taste: X/100
  - Accuracy: X/100
  - Creativity: X/100
  - Total: X/300
- Confetti particles on high scores (total > 200)
- Accepts `options.scores` and `options.cakeImagePath` from launch payload

- [ ] **Step 2: Update SceneManager to handle non-BaseMinigameScene classes**

`SceneManager.startScene()` currently assumes the scene has `init()` and `scene` property — which `ResultScene3D` provides. Verify it works without `_startTimer` or `_registerUpdateLoop` being called (those are in `BaseMinigameScene.init()`, not `SceneManager`).

- [ ] **Step 3: Test by triggering `results:cake-reveal` from server**
- [ ] **Step 4: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes/ResultScene3D.js
git commit -m "feat: add ResultScene3D — 3D cake reveal with score animations"
```

---

## Task 25: Full End-to-End Test + Cleanup

**Files:**
- Modify: `v1.2/public/player.html` (remove any leftover Phaser references)
- Verify: All 11 minigames + ResultScene work in complete game flow

- [ ] **Step 1: Remove old Phaser files from loading**

Verify `player.html` has zero Phaser script tags. The old `phaser-game/` directory stays in the repo for reference but nothing loads from it.

- [ ] **Step 2: Full game flow test**

1. Start server
2. Host: Create game → create 2 teams → start trivia → answer questions → complete trivia
3. Player: Join → claim team → answer questions
4. Host: Open shop → teams buy items
5. Host: Start baking → click "Start Baking"
6. Player: Verify all 6 phases play sequentially (Prep → Mix → Bake → Cool → Decorate → Present)
7. Verify transition screens between phases
8. Verify scores sent to server after each phase
9. Host: Trigger cake reveal
10. Player: Verify ResultScene3D shows with orbiting camera and score animations

- [ ] **Step 3: Test absurd variants**

Create a game with high chaos level (modify server config or trigger chaos events). Verify absurd scenes load when selected instead of normal scenes.

- [ ] **Step 4: Performance check**

Open browser Performance tab. Each scene should maintain 60 FPS. Total loaded assets < 5MB. Scene transitions < 500ms.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Babylon.js minigame overhaul — all 11 games + result scene"
```

---

## Notes

### Code Completeness by Task
- **Tasks 1–13** (infrastructure + first 2 scenes): Complete code provided — implementer can copy directly.
- **Tasks 14–24** (remaining scenes): Design-driven outlines with key mechanics, scoring formulas, and structural guidance. Implementer writes full code following the pattern established by PrepScene3D (Task 12) and MixScene3D (Task 13). Refer to the spec document for detailed gameplay mechanics.

### Asset Sourcing
Free 3D models needed (source from Sketchfab/Poly Pizza under CC license):
- Cake (basic tiered cake) — or build procedurally
- Oven — procedural box is sufficient
- Whisk — simple cylinder
- Mixing bowl — half-sphere
- Cow (for CowCombat3D) — or build from box primitives
- Cooling rack — procedural grid of thin cylinders
- Presentation table — procedural

Most objects can be built procedurally with Babylon's `MeshBuilder`. Only source external .glb models if procedural versions look too primitive.

### Testing Strategy
No unit test framework is set up for the browser-side code. Testing approach:
1. Visual verification in browser for each scene
2. Console logging for score calculations
3. Socket event verification (check server receives correct `baking:phase-complete` payloads)
4. Full game flow E2E test (Task 25)

### Error Handling
Each scene's `create()` method should be wrapped in try/catch. If a scene fails to load, show an error message in the HUD and emit a phase-complete with score 0 so the game can continue.
