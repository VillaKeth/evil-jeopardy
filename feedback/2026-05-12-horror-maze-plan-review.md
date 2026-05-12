# Horror Maze Implementation Plan — Code Review

**Reviewed:** `docs/superpowers/plans/2026-05-12-present-horror-maze.md`  
**Against:** `docs/superpowers/specs/2026-05-12-present-horror-maze-design.md` + existing codebase  
**Date:** 2026-05-12  
**Verdict:** 9 significant issues found (2 Critical, 4 High, 3 Medium)

---

## CRITICAL

### 1. Script-tag insertion point breaks dependency order — new modules won't have access to `HUD`, `MaterialLibrary`, or `BaseMinigameScene`

**Location:** Task 10, Step 1 (line ~2224)  
**Problem:** The plan inserts 5 new `<script>` tags after `hand-controller.js` (line 873) and before `socket-bridge.js` (line 874). However, `CakeHealthDisplay` depends on `BABYLON.GUI` (loaded) — fine — but `RoomBuilder` calls `this.materials.wood()`, `this.materials.marble()`, `this.materials.metal()`, and `this.materials.food()`, which come from `MaterialLibrary` (loaded at line 868 via `materials.js`). That's fine, but the *real* issue is that `PresentScene3D.js` (loaded at line 885) instantiates all these classes and passes `this.hud.texture` and `this.materials` to them. Those are only available after `hud.js` (line 875) and `scene-manager.js` (line 876) have loaded. Since the plan puts the new scripts at line 873–874, the new modules themselves load fine — but if any of them reference `HUD` or `BaseMinigameScene` at parse time (they don't currently, they use `window.*` globals), this would break. **The actual critical issue**: the plan says to insert *before* `socket-bridge.js`, but `ScareSystem` and `ChaseController` bind `window.addEventListener('keydown')` and interact with `this.hud.texture` — these are runtime, not parse-time, so the *load order* is technically okay. However, the plan explicitly states "After the `hand-controller.js` script tag (line 873), before `socket-bridge.js` (line 874)" which is correct for shared utilities but **the plan should state this clearly as "after all shared/ scripts, before socket-bridge.js"** to avoid a zero-context engineer misinterpreting and placing them elsewhere. 

**Revised severity: HIGH** (functional but fragile — one wrong placement breaks everything silently)  
**Fix:** Change Task 10 instructions to: "Add the 5 scripts **after line 873 (`hand-controller.js`) and before line 874 (`socket-bridge.js`)**. These must load after `materials.js`, `hud.js` is not required at parse time but must precede `PresentScene3D.js`." Better yet, place them between `scene-manager.js` (line 876) and `engine.js` (line 877) — after HUD and SceneManager are defined, before any scene file. This matches the existing pattern where shared utilities precede scene files.

---

### 2. `horrorDrone()` is a one-shot (4.5s decay) but plan loops it via `setInterval(4500ms)` — gap/overlap timing creates audible pops

**Location:** Task 1 Step 1 (`horrorDrone()`) + Task 9 Step 1 (`_startHorrorAmbient`)  
**Problem:** The spec says `horrorDrone()` should be a "continuous loop." The implementation creates a single oscillator that decays to 0.001 over 4.5s, then `_startHorrorAmbient()` calls it every 4500ms via `setInterval`. Because `exponentialRampToValueAtTime` reaches near-zero *at* 4.5s, and the new oscillator starts at 0.06 gain at exactly 4.5s later, there's no crossfade — you get a hard restart pop every cycle. Additionally, Web Audio `exponentialRampToValueAtTime` to 0.001 doesn't reach exactly zero, so old oscillators accumulate connected (but inaudible) nodes that never get disconnected/GC'd over a 4-minute session (~53 leaked oscillator+gain pairs).

**Fix:**  
- Return `{ osc, gain }` from `horrorDrone()` so the caller can stop it, or  
- Use a looping `AudioBufferSourceNode` with a pre-rendered drone buffer, or  
- At minimum, add crossfade: start the new drone 0.3s before the old one ends, and call `osc.disconnect()` in an `onended` handler to prevent node leaks:
```javascript
osc.onended = () => { osc.disconnect(); g.disconnect(); };
```

---

## HIGH

### 3. `_suppressAmbient` mechanism from spec is not used — `stopAmbient()` called after `super.create()` but `BaseMinigameScene.init()` calls `startKitchenAmbient()` *before* `create()`

**Location:** Task 9, `create()` method (line ~1851-1853)  
**Problem:** The spec says: "set `this._suppressAmbient = true` before `super.create()` or stop it after." Looking at `BaseMinigameScene.init()` (line 44-48 of scene-manager.js):
```javascript
if (this.sounds) {
  this.sounds.transition();
  this.sounds.startKitchenAmbient();  // ← This fires BEFORE create()
}
await this.create();
```
The plan's `create()` calls `this.sounds.stopAmbient()` which does work — but there's a brief audible blip where kitchen ambient starts, then immediately stops. More importantly, `stopAmbient()` kills **all** ambient sources, which is correct here but the plan doesn't set any flag to prevent `BaseMinigameScene` from re-triggering ambient on chaos events or other code paths.

**Fix:** Set `this._suppressAmbient = true` in the constructor (before `init()` runs), and add a check in `BaseMinigameScene.init()`. Since you can't modify `BaseMinigameScene`, the cleaner approach is: in the constructor, do `this.sounds = null` temporarily, then restore it in `create()` after stopping ambient. Or simpler: call `this.sounds.stopAmbient()` at the top of `create()` (as the plan does) and accept the brief blip — but **document this tradeoff** for the implementer.

---

### 4. QTE `window` variable shadows the global `window` object — `let pool, window;` is a parsing error

**Location:** Task 3, `triggerQTE()` method (line ~531)  
**Problem:** The code declares `let pool, window;` which shadows the global `window` object. In strict mode this may cause issues, and in any mode, subsequent references to `window` within that function scope (e.g., the `setTimeout` on line 559) would reference the local `undefined` variable, not `globalThis.window`. The `setTimeout` call at line 559 uses `setTimeout` (which is `window.setTimeout`), and since `window` is now a local `undefined`, this may not directly break `setTimeout` (it's also a global), but the variable name is confusing and dangerous.

**Fix:** Rename to `let pool, timeWindow;` and use `timeWindow` throughout.

---

### 5. Chase QTE resume after catch doesn't track remaining QTEs — `_startQTESequence()` restarts from 0

**Location:** Task 7, `_catch()` method (line ~1545)  
**Problem:** When the player is caught, `_catch()` calls `_startQTESequence()` again, which resets `let qteIndex = 0` and can fire up to `maxQTEs (7)` more QTEs. The spec says "remaining QTEs still play" after catch, but the implementation could fire up to 14 total QTEs (7 before catch + 7 after). Combined with the fact that `this.qteCount` is set inside the interval but never checked for total cap, the chase can run far longer than intended.

**Fix:** Track total QTEs dispatched as an instance property. In `_startQTESequence()`, initialize `qteIndex` from `this.qteCount` instead of 0, or pass the remaining count as a parameter.

---

### 6. Side rooms are never actually built or positioned — only a flag check + interact toggle exists

**Location:** Task 9 `_tryInteract()` + Task 6 `buildSideRoom()`  
**Problem:** `RoomBuilder.buildSideRoom()` exists (Task 6, Step 2) but is **never called** anywhere in `PresentScene3D`. The `_tryInteract()` method (line 2060) simply toggles `this.inSideRoom` boolean and shows a message — no side room geometry is created, no camera teleport occurs, and no scares from the side room's `scares` array are triggered. The spec requires side rooms as branching corridors with their own scare content and +5 bonus for damage-free exploration.

**Fix:** In `_tryInteract()`, when entering a side room: call `this.roomBuilder.buildSideRoom(...)`, position it adjacent to the current room, teleport/offset the player, schedule the side room's scares. On exit, dispose the side room geometry. This is a significant missing feature (~30-50 lines of logic).

---

## MEDIUM

### 7. Jumpscare images from spec are replaced with emoji text — asset loading pipeline never implemented

**Location:** Task 9 `_showJumpscare()` (line ~2007-2029)  
**Problem:** The spec explicitly requires "2-3 horror face PNGs loaded as textures, displayed full-screen on a GUI Image control for 0.3 seconds." The plan creates a placeholder asset directory (Task 10, Step 2) but `_showJumpscare()` uses a `👹` emoji TextBlock instead of a `BABYLON.GUI.Image` with a loaded PNG texture. The spec lists this as a key visual effect for rooms 5, 10, and the chase catch. The plan's Task 10 creates the directory + README but no code ever references it.

**Fix:** Either (a) add a `_preloadJumpscares()` step in `create()` that loads 2-3 PNGs into `BABYLON.GUI.Image` controls and shows a random one in `_showJumpscare()`, or (b) explicitly call this out-of-scope in the plan and note the emoji as a placeholder with a follow-up task for asset integration.

---

### 8. `chaseMusic()` is a one-shot 1.6s pattern, not a loop — chase runs ~25+ seconds

**Location:** Task 1 Step 3 `chaseMusic()` (line ~232-249)  
**Problem:** `chaseMusic()` schedules 8 kick sounds over 1.6 seconds and then stops. The chase sequence runs for ~25 seconds (7 QTEs × 3.5s). The spec says "Intense chase music" (continuous). The plan calls `this.sounds.chaseMusic()` once in `ChaseController.start()` and never re-triggers it.

**Fix:** Either loop `chaseMusic()` via `setInterval(1600)` during the chase (and clear on escape/catch), or redesign the method to create a longer looping pattern. Add an `onended` cleanup similar to `horrorDrone()`.

---

### 9. Spec QTE keys include `W/A/S/D/E/F` for rooms 1-4, but plan uses `Q/E/F` — spec was later corrected but plan's `_triggerScare` doesn't pass the right room index for chase QTEs

**Location:** Task 3 `triggerQTE()` key pools vs. spec "Difficulty Scaling" table  
**Problem:** Minor inconsistency — the spec's "QTE Trigger Flow" section (line 99) says keys are "random from W/A/S/D/E/F" but the spec's "Difficulty Scaling" table (line 108-113) and the note on line 116 correct this to Q/E/F/R/Z/X. The plan correctly uses Q/E/F/R/Z/X. However, in `ChaseController._startQTESequence()`, the call is `this.scareSystem.triggerQTE('medium', 12, ...)` — room index 12 maps to the `hard` pool (roomIndex > 7) with a 1200ms window. The spec says chase QTEs should have a 1000ms window (line 113). Room index 12 doesn't hit any special case for the 1000ms timing.

**Fix:** Add a chase-specific branch in `triggerQTE()`: `if (roomIndex >= 12) { window = 1000; }` or `if (roomIndex === 12) { pool = this.keyPools.hard; window = 1000; }`.

---

## Summary

| # | Severity | Issue | Task |
|---|----------|-------|------|
| 1 | HIGH | Script tag insertion should be after scene-manager.js, before engine.js | 10 |
| 2 | CRITICAL | horrorDrone() one-shot loop creates pops + leaks audio nodes | 1, 9 |
| 3 | HIGH | Kitchen ambient plays briefly before create() stops it | 9 |
| 4 | HIGH | `let window` shadows global — rename to `timeWindow` | 3 |
| 5 | HIGH | Chase QTE restart after catch can double total QTEs | 7 |
| 6 | HIGH | Side room geometry never built/positioned despite buildSideRoom() existing | 6, 9 |
| 7 | MEDIUM | Jumpscare PNGs never loaded — emoji placeholder only | 9, 10 |
| 8 | MEDIUM | chaseMusic() is 1.6s one-shot, chase runs 25s+ | 1, 7 |
| 9 | MEDIUM | Chase QTE window is 1200ms not spec's 1000ms | 3, 7 |
