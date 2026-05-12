# Surgeon Simulator Hands + CowCombat Overhaul

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PrepScene3D's click-to-pour mechanic with Surgeon Simulator-style articulated 3D hands (A/S/D/F/G = individual fingers, Space = switch hands, mouse = position/tilt), then overhaul CowCombat3D with clearer prompts and a cow stampede mechanic.

**Architecture:** `HandController3D` is a reusable class in `shared/hand-controller.js` that manages two articulated hand meshes, keyboard input for finger curl, and grip detection. `PrepScene3D` is rewritten to use it instead of click-to-pour. CowCombat3D gets a visual clarity pass and stampede feature. All changes are client-side only (no server changes).

**Tech Stack:** Babylon.js (meshes, TransformNode hierarchies, GUI), Web Audio API (via existing SoundManager), vanilla JS keyboard/mouse events.

---

### Task 1: Create HandController3D class — mesh building

**Files:**
- Create: `v1.2/public/js/babylon-game/shared/hand-controller.js`

This task builds the 3D hand meshes only (no input yet).

- [ ] **Step 1: Create the hand-controller.js file with the HandController3D class skeleton**

The class manages two hands. Each hand is a TransformNode hierarchy:
- `handRoot` (TransformNode) — positioned by mouse
- `palm` (Box mesh) — the flat palm
- `fingers[5]` — each finger is a chain of 2 segments (proximal + distal), each a Box mesh parented to the previous

```javascript
class HandController3D {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this.hands = { left: null, right: null };
    this.activeHand = 'right';
    this.fingerStates = {
      left:  [0, 0, 0, 0, 0],  // 0=extended, 1=curled
      right: [0, 0, 0, 0, 0]
    };
    this.fingerTargets = {
      left:  [0, 0, 0, 0, 0],
      right: [0, 0, 0, 0, 0]
    };
    this.heldObject = null;
    this.gripStrength = 0;
    this._keyMap = { a: 0, s: 1, d: 2, f: 3, g: 4 };
    this._keysDown = new Set();
    this._onKeyDown = null;
    this._onKeyUp = null;
    this._disposed = false;

    this._buildHands();
  }
  // ... methods added in subsequent steps
}
```

- [ ] **Step 2: Implement `_buildHands()` — constructs both hand meshes**

Each hand has:
- Palm: Box (0.35 x 0.08 x 0.3)
- 5 fingers, each with 2 segments:
  - Proximal: Box (0.06 x 0.06 x 0.14), pivoted at palm edge
  - Distal: Box (0.05 x 0.05 x 0.10), pivoted at end of proximal
- Thumb is offset to the side and rotated differently
- Left hand is mirrored (scale.x = -1 on root)
- Skin-colored material (peach tone)

Finger layout on palm (X offsets from center):
- Thumb: -0.18 (left hand) / +0.18 (right hand), Z offset forward
- Index: -0.10 / +0.10
- Middle: -0.03 / +0.03
- Ring: +0.05 / -0.05
- Pinky: +0.12 / -0.12

Each finger segment has a `_restRotation` and `_curledRotation` for animation targets.

- [ ] **Step 3: Implement `_buildSingleHand(side)` helper**

Returns a hand object: `{ root, palm, fingers: [{ proximal, distal, pivot }] }`.

```javascript
_buildSingleHand(side) {
  const isLeft = side === 'left';
  const root = new BABYLON.TransformNode(`${side}HandRoot`, this.scene);
  root.position = new BABYLON.Vector3(isLeft ? -0.6 : 0.6, 1.2, 0);

  const skinMat = this.materials.food(new BABYLON.Color3(0.96, 0.80, 0.69));

  const palm = BABYLON.MeshBuilder.CreateBox(`${side}Palm`, {
    width: 0.35, height: 0.08, depth: 0.3
  }, this.scene);
  palm.material = skinMat;
  palm.parent = root;

  const fingerOffsets = [
    { x: isLeft ? -0.18 : 0.18, z: 0.08, isThumb: true },
    { x: isLeft ? -0.10 : 0.10, z: 0.16, isThumb: false },
    { x: isLeft ? -0.03 : 0.03, z: 0.17, isThumb: false },
    { x: isLeft ?  0.05 : -0.05, z: 0.16, isThumb: false },
    { x: isLeft ?  0.12 : -0.12, z: 0.14, isThumb: false }
  ];

  const fingers = fingerOffsets.map((offset, i) => {
    return this._buildFinger(side, i, offset, palm, skinMat);
  });

  if (!isLeft) root.setEnabled(true);
  else root.setEnabled(false); // inactive hand starts hidden

  return { root, palm, fingers };
}
```

- [ ] **Step 4: Implement `_buildFinger()` — creates a two-segment articulated finger**

Each finger has a pivot TransformNode at the base (attached to palm), a proximal segment, and a distal segment. The pivot is what rotates when curling.

```javascript
_buildFinger(side, index, offset, palm, material) {
  const name = `${side}_finger_${index}`;
  const isThumb = offset.isThumb;

  // Pivot at palm edge
  const pivot = new BABYLON.TransformNode(`${name}_pivot`, this.scene);
  pivot.position = new BABYLON.Vector3(offset.x, 0, offset.z);
  pivot.parent = palm;
  if (isThumb) {
    pivot.rotation.y = (side === 'left' ? -1 : 1) * Math.PI / 4;
  }

  // Proximal segment
  const proxLen = isThumb ? 0.10 : 0.14;
  const proximal = BABYLON.MeshBuilder.CreateBox(`${name}_prox`, {
    width: 0.06, height: 0.06, depth: proxLen
  }, this.scene);
  proximal.material = material;
  proximal.position = new BABYLON.Vector3(0, 0, proxLen / 2);
  proximal.parent = pivot;

  // Distal pivot (at end of proximal)
  const distalPivot = new BABYLON.TransformNode(`${name}_dpiv`, this.scene);
  distalPivot.position = new BABYLON.Vector3(0, 0, proxLen / 2);
  distalPivot.parent = proximal;

  // Distal segment
  const distLen = isThumb ? 0.08 : 0.10;
  const distal = BABYLON.MeshBuilder.CreateBox(`${name}_dist`, {
    width: 0.05, height: 0.05, depth: distLen
  }, this.scene);
  distal.material = material;
  distal.position = new BABYLON.Vector3(0, 0, distLen / 2);
  distal.parent = distalPivot;

  return {
    pivot,
    proximal,
    distalPivot,
    distal,
    curlAngle: 0,       // current curl (0=flat, ~1.4=fully curled)
    targetCurl: 0,       // target curl
    maxCurl: isThumb ? 1.0 : 1.4
  };
}
```

- [ ] **Step 5: Add `window.HandController3D = HandController3D;` and verify it loads**

Add the script tag to `player.html` after `sound-manager.js` and before `socket-bridge.js`. Start server, load page, verify `typeof HandController3D !== 'undefined'` in console.

- [ ] **Step 6: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/hand-controller.js v1.2/public/player.html
git commit -m "feat: add HandController3D mesh construction (no input yet)"
```

---

### Task 2: HandController3D — input handling and finger animation

**Files:**
- Modify: `v1.2/public/js/babylon-game/shared/hand-controller.js`

- [ ] **Step 1: Add keyboard input binding**

```javascript
bindInput() {
  this._onKeyDown = (e) => {
    if (this._disposed) return;
    const key = e.key.toLowerCase();
    if (key === ' ') {
      this.switchHand();
      e.preventDefault();
      return;
    }
    if (this._keyMap.hasOwnProperty(key)) {
      this._keysDown.add(key);
      this.fingerTargets[this.activeHand][this._keyMap[key]] = 1;
    }
  };
  this._onKeyUp = (e) => {
    if (this._disposed) return;
    const key = e.key.toLowerCase();
    if (this._keyMap.hasOwnProperty(key)) {
      this._keysDown.delete(key);
      this.fingerTargets[this.activeHand][this._keyMap[key]] = 0;
    }
  };
  window.addEventListener('keydown', this._onKeyDown);
  window.addEventListener('keyup', this._onKeyUp);
}
```

- [ ] **Step 2: Add `switchHand()` method**

Toggles active hand, shows/hides hand meshes, plays sound, resets finger targets for the deactivated hand.

```javascript
switchHand() {
  // Release all fingers on old hand
  this.fingerTargets[this.activeHand] = [0, 0, 0, 0, 0];
  this._keysDown.clear();

  // Toggle
  const oldHand = this.activeHand;
  this.activeHand = this.activeHand === 'right' ? 'left' : 'right';

  // Show/hide
  this.hands[oldHand].root.setEnabled(false);
  this.hands[this.activeHand].root.setEnabled(true);

  if (window.gameSounds) window.gameSounds.click();
}
```

- [ ] **Step 3: Add `update(dt)` method — animate finger curling**

Lerps each finger's curl angle toward its target. Updates pivot rotations.

```javascript
update(dt) {
  if (this._disposed) return;

  ['left', 'right'].forEach(side => {
    const hand = this.hands[side];
    if (!hand) return;
    hand.fingers.forEach((finger, i) => {
      const target = this.fingerTargets[side][i] * finger.maxCurl;
      finger.curlAngle = BABYLON.Scalar.Lerp(finger.curlAngle, target, dt * 12);
      finger.pivot.rotation.x = -finger.curlAngle;
      finger.distalPivot.rotation.x = -finger.curlAngle * 0.7;
    });
    this.fingerStates[side] = hand.fingers.map(f =>
      f.curlAngle > f.maxCurl * 0.6 ? 1 : 0
    );
  });

  this._updateGrip();
}
```

- [ ] **Step 4: Add `setPosition(x, y, z)` — moves active hand root**

```javascript
setPosition(x, y, z) {
  const hand = this.hands[this.activeHand];
  if (hand) {
    hand.root.position.x = x;
    hand.root.position.y = y;
    hand.root.position.z = z;
  }
}

setTilt(angle) {
  const hand = this.hands[this.activeHand];
  if (hand) {
    hand.root.rotation.x = angle;
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/hand-controller.js
git commit -m "feat: add keyboard input and finger animation to HandController3D"
```

---

### Task 3: HandController3D — grip detection and object holding

**Files:**
- Modify: `v1.2/public/js/babylon-game/shared/hand-controller.js`

- [ ] **Step 1: Add `_updateGrip()` — detect when fingers form a grip**

Grip = 3+ fingers curled on the active hand. When gripping near an object, attach it.

```javascript
_updateGrip() {
  const curled = this.fingerStates[this.activeHand].filter(v => v === 1).length;
  this.gripStrength = curled / 5;

  if (this.heldObject && curled < 2) {
    this._dropObject();
  }
}

canGrip() {
  return this.fingerStates[this.activeHand].filter(v => v === 1).length >= 3;
}
```

- [ ] **Step 2: Add `tryGrab(mesh)` and `_dropObject()` methods**

```javascript
tryGrab(mesh) {
  if (!this.canGrip() || this.heldObject) return false;

  const hand = this.hands[this.activeHand];
  const dist = BABYLON.Vector3.Distance(
    hand.root.getAbsolutePosition(),
    mesh.getAbsolutePosition()
  );
  if (dist > 1.0) return false;

  this.heldObject = mesh;
  mesh.setParent(hand.root);
  mesh.position = new BABYLON.Vector3(0, -0.08, 0.15);
  if (window.gameSounds) window.gameSounds.click();
  return true;
}

_dropObject() {
  if (!this.heldObject) return;
  const worldPos = this.heldObject.getAbsolutePosition().clone();
  this.heldObject.setParent(null);
  this.heldObject.position = worldPos;
  if (window.gameSounds) window.gameSounds.miss();
  this.heldObject = null;
}

isHolding() {
  return this.heldObject !== null;
}
```

- [ ] **Step 3: Add `getTiltAngle()` — returns how much the hand is tilted (for pouring)**

```javascript
getTiltAngle() {
  const hand = this.hands[this.activeHand];
  if (!hand) return 0;
  return hand.root.rotation.x;
}
```

- [ ] **Step 4: Add `dispose()` method**

```javascript
dispose() {
  this._disposed = true;
  if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
  if (this._onKeyUp) window.removeEventListener('keyup', this._onKeyUp);
  ['left', 'right'].forEach(side => {
    if (this.hands[side]) {
      this.hands[side].root.dispose(false, true);
    }
  });
  this.heldObject = null;
}
```

- [ ] **Step 5: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/hand-controller.js
git commit -m "feat: add grip detection and object holding to HandController3D"
```

---

### Task 4: Rewrite PrepScene3D to use HandController3D

**Files:**
- Modify: `v1.2/public/js/babylon-game/scenes/PrepScene3D.js`

This is a full rewrite of the scene's interaction model. The measuring/scoring system stays, but input changes from click-to-pour to Surgeon Sim hands.

- [ ] **Step 1: Update constructor — add hand controller references**

Remove `isPouring`, `pourSpeed` fields. Add `handController`, `grabbableContainers`, `isGrabbing`, `tiltAngle`.

- [ ] **Step 2: Rewrite `create()` — add HandController3D, change camera to first-person-ish**

```javascript
async create() {
  // Low-angle camera looking down at counter (surgeon's POV)
  const camera = new BABYLON.FreeCamera('surgeonCam',
    new BABYLON.Vector3(0, 3.5, -2.5), this.scene);
  camera.setTarget(new BABYLON.Vector3(0, 0.5, 0.5));
  camera.inputs.clear(); // no user camera control

  await this._buildKitchenCounter();
  this._buildMixingBowl();
  this._buildMeasuringCup();
  this._buildFillGauge();
  this._buildControlsHint();

  this.handController = new HandController3D(this.scene, this.materials);
  this.handController.bindInput();

  this._loadIngredient(0);
  this._setupPointerEvents();
}
```

- [ ] **Step 3: Rewrite `_setupPointerEvents()` — mouse moves hand, grip proximity**

```javascript
_setupPointerEvents() {
  this.scene.onPointerMove = (evt) => {
    if (this.isComplete || !this.handController) return;

    // Map mouse to counter surface
    const pick = this.scene.pick(evt.offsetX, evt.offsetY);
    if (pick.hit) {
      this.handController.setPosition(
        pick.pickedPoint.x,
        pick.pickedPoint.y + 0.5,
        pick.pickedPoint.z
      );
    }

    // If holding an object, mouse Y controls tilt for pouring
    if (this.handController.isHolding()) {
      const normY = 1 - (evt.offsetY / this.canvas.height);
      const tilt = normY * 1.8 - 0.3; // -0.3 to 1.5 radians
      this.handController.setTilt(tilt);
    }
  };

  // Auto-grab: when hand is near container and grip is active
  this.scene.registerBeforeRender(() => {
    if (!this.handController || this.isComplete) return;

    if (this.handController.canGrip() && !this.handController.isHolding() && this.currentContainer) {
      this.handController.tryGrab(this.currentContainer);
    }
  });
}
```

- [ ] **Step 4: Rewrite `update(dt)` — hand animation + tilt-based pouring**

```javascript
update(dt) {
  if (this.isComplete) return;
  if (this.handController) this.handController.update(dt);

  // Pouring happens when holding container and tilted enough
  if (this.handController && this.handController.isHolding()) {
    const tilt = this.handController.getTiltAngle();
    if (tilt > 0.3) {
      const pourRate = (tilt - 0.3) * 0.6;
      this.pourLevel = Math.min(1.0, this.pourLevel + dt * pourRate);
      this._updateFillVisuals();
      this._updateFillGauge();
      if (this.pourParticles) this.pourParticles.emitRate = 40;
      if (this.sounds && !this._pourCooldown) {
        this._pourCooldown = true;
        this.sounds.pour();
        setTimeout(() => { this._pourCooldown = false; }, 300);
      }
    } else {
      if (this.pourParticles) this.pourParticles.emitRate = 0;
    }
  } else {
    if (this.pourParticles) this.pourParticles.emitRate = 0;
    // If was pouring and dropped, score the ingredient
    if (this.pourLevel > 0 && !this._scored) {
      this._scored = true;
      this._scoreIngredient();
    }
  }
}
```

- [ ] **Step 5: Add `_buildControlsHint()` — HUD overlay showing key bindings**

Display a semi-transparent panel showing: A=Thumb, S=Index, D=Middle, F=Ring, G=Pinky, Space=Switch Hand, Mouse=Move & Tilt. Fades out after 5 seconds.

```javascript
_buildControlsHint() {
  const hint = new BABYLON.GUI.TextBlock('controlsHint',
    'A-thumb  S-index  D-mid  F-ring  G-pinky\nSPACE = switch hand  |  Mouse = move & tilt');
  hint.color = '#ffffff';
  hint.fontSize = 16;
  hint.textWrapping = true;
  hint.width = '400px';
  hint.height = '60px';
  hint.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
  hint.paddingBottom = '20px';
  hint.outlineWidth = 2;
  hint.outlineColor = '#000000';
  hint.alpha = 0.9;
  this.hud.texture.addControl(hint);

  // Fade out after 6 seconds
  setTimeout(() => {
    const fade = setInterval(() => {
      hint.alpha -= 0.02;
      if (hint.alpha <= 0) {
        clearInterval(fade);
        this.hud.texture.removeControl(hint);
        hint.dispose();
      }
    }, 50);
  }, 6000);
}
```

- [ ] **Step 6: Update `_loadIngredient()` — reset hand state and scoring flag**

Add `this._scored = false;` at the start. When moving to next ingredient, force-drop any held object.

```javascript
_loadIngredient(index) {
  // Drop anything held
  if (this.handController && this.handController.isHolding()) {
    this.handController._dropObject();
  }
  this._scored = false;

  // ... rest of existing _loadIngredient code stays the same
  // but update instruction text:
  this.instructionText.text = `Grab ${ingredient} — curl 3+ fingers to grip, tilt to pour`;
}
```

- [ ] **Step 7: Update `_scoreIngredient()` — score on drop instead of pointerUp**

Mostly the same logic. Key change: called when object is dropped (fingers released) instead of on pointer up. After scoring, load next ingredient.

Remove the old `this.scene.onPointerDown` / `this.scene.onPointerUp` handlers. Pouring is now driven by `update()`.

- [ ] **Step 8: Update `dispose()` — clean up hand controller**

```javascript
// In PrepScene3D:
dispose() {
  if (this.handController) this.handController.dispose();
  // ... existing dispose logic
  super.dispose();
}
```

- [ ] **Step 9: Add hand-controller.js sounds**

Add new sounds to SoundManager:
- `grab()` — short firm click (already have `click()`, can reuse)
- `drop()` — thud sound
- `fingerCurl()` — very subtle bone crack (optional, for comedy)

- [ ] **Step 10: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes/PrepScene3D.js v1.2/public/js/babylon-game/shared/hand-controller.js v1.2/public/js/babylon-game/shared/sound-manager.js
git commit -m "feat: rewrite PrepScene3D with Surgeon Simulator hand controls"
```

---

### Task 5: Browser test PrepScene3D hands

**Files:** None (testing only)

- [ ] **Step 1: Start dev server, open player.html in Chrome DevTools browser**
- [ ] **Step 2: Join a team, start baking, verify PrepScene3D loads with 3D hands visible**
- [ ] **Step 3: Verify keyboard A/S/D/F/G curls fingers individually**
- [ ] **Step 4: Verify Space switches between left/right hand**
- [ ] **Step 5: Verify mouse moves hand position over counter**
- [ ] **Step 6: Verify gripping an ingredient container (3+ fingers curled near it)**
- [ ] **Step 7: Verify tilting pours ingredient (mouse Y while holding)**
- [ ] **Step 8: Verify releasing fingers drops container and scores the ingredient**
- [ ] **Step 9: Verify all 5 ingredients can be measured and phase completes**
- [ ] **Step 10: Fix any bugs found during testing, commit fixes**

---

### Task 6: CowCombat3D — visual clarity overhaul

**Files:**
- Modify: `v1.2/public/js/babylon-game/scenes-absurd/CowCombat3D.js`

Make the game much easier to understand with clear visual prompts.

- [ ] **Step 1: Add large animated arrow indicator pointing at active udder**

Create a 3D arrow mesh (or GUI arrow) that floats above the active udder, pulsing and bobbing. Color matches udder glow. Text says "SQUEEZE!" above it.

```javascript
_buildPromptArrow() {
  // Arrow body (elongated cone pointing down)
  this.promptArrow = BABYLON.MeshBuilder.CreateCylinder('arrow', {
    diameterTop: 0, diameterBottom: 0.3, height: 0.5, tessellation: 12
  }, this.scene);
  this.promptArrow.material = this.materials.food(
    new BABYLON.Color3(0.2, 1.0, 0.3)
  );
  this.promptArrow.material.emissiveColor = new BABYLON.Color3(0.1, 0.5, 0.15);
  this.promptArrow.parent = this.cowRoot;
  this.promptArrow.rotation.x = Math.PI; // point down

  // "SQUEEZE!" text above arrow
  this.squeezeLabel = new BABYLON.GUI.TextBlock('squeezeLabel', '🤚 SQUEEZE!');
  this.squeezeLabel.color = '#44ff44';
  this.squeezeLabel.fontSize = 28;
  this.squeezeLabel.fontWeight = 'bold';
  this.squeezeLabel.outlineWidth = 3;
  this.squeezeLabel.outlineColor = '#000000';
  this.squeezeLabel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
  this.hud.texture.addControl(this.squeezeLabel);
}
```

- [ ] **Step 2: Update `_updateUdders()` — position arrow over active udder, make glow much brighter**

The arrow follows the active udder position. Inactive udders are dimmed. Active udder has a large bright green glow ring around it.

- [ ] **Step 3: Add number labels (1-4) on each udder**

Place GUI text blocks or 3D text meshes with numbers 1-4 on each udder so the player can identify them. The beat text changes from "Beat: 2" to "Press udder #2!".

- [ ] **Step 4: Add attack warning overlays**

When an attack starts, show a large full-screen warning:
- KICK: "🦵 KICK! HANDS OFF!" in red, screen border flashes red
- CHARGE: "🐂 CHARGE! DODGE NOW!" with giant DODGE button
- SPIN: "🌀 SPIN! WAIT IT OUT!" in yellow

Replace the small status text with these big overlays.

- [ ] **Step 5: Add initial tutorial overlay**

On first load, show a 3-second overlay explaining:
"Click the GLOWING udder when prompted!\nAvoid attacks — DODGE charges!\nFill the bucket with milk!"

- [ ] **Step 6: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes-absurd/CowCombat3D.js
git commit -m "feat: CowCombat3D visual clarity overhaul with arrows, labels, warnings"
```

---

### Task 7: CowCombat3D — cow stampede mechanic

**Files:**
- Modify: `v1.2/public/js/babylon-game/scenes-absurd/CowCombat3D.js`
- Modify: `v1.2/public/js/babylon-game/shared/sound-manager.js`

After 30 seconds, cow calls friends. 3 mini cows charge from different sides. Player must dodge-button each one or take damage.

**Stampede Lifecycle Rules:**
- **Trigger:** When elapsed time ≥ 30s AND `currentAttack === null` (never during an active attack)
- **State flag:** `this.stampedeActive = true` — pauses normal rhythm/attack cycle while stampede runs
- **Sequence:** 3 mini cows spawn 0.8s apart. Each charges for 2s. Player must press dodge button (same as existing dodge) before it arrives
- **Per-cow resolution:** If dodged: mini cow flies past, +5 score, `dodge()` sound. If not dodged: `_stunPlayer()` (same as existing stun, 1.5s freeze), -10 score
- **After all 3 resolved:** `this.stampedeActive = false`, normal rhythm resumes. One-time event (never re-triggers)
- **Dodge window:** Player gets a "DODGE!" button flash 0.8s before each cow arrives. Uses existing `dodgeButton` and `_tryDodge()` — the dodge just targets the incoming mini cow instead of the main cow

- [ ] **Step 1: Add `_triggerStampede()` method**

```javascript
_triggerStampede() {
  if (this.stampedeTriggered) return;
  this.stampedeTriggered = true;
  this.statusText.text = 'MOO MOO MOO! THE HERD APPROACHES!';
  if (this.sounds) this.sounds.moo();

  // Show big warning
  this.hud.showMessage('🐄🐄🐄 STAMPEDE!', 2000);

  // Spawn 3 mini cows from different directions
  this.stampedeCows = [];
  const directions = [
    { x: -6, z: 0, angle: Math.PI / 2 },
    { x: 6, z: 0, angle: -Math.PI / 2 },
    { x: 0, z: -6, angle: 0 }
  ];

  directions.forEach((dir, i) => {
    setTimeout(() => {
      if (this._disposed) return;
      this._spawnMiniCow(dir, i);
    }, i * 800);
  });
}
```

- [ ] **Step 2: Add `_spawnMiniCow()` — creates a smaller cow that charges**

Each mini cow is a scaled-down version (0.5x) of the main cow. It moves toward the player position over 2 seconds. If not dodged (dodge button), it stuns the player.

- [ ] **Step 3: Update `update(dt)` — check stampede trigger at 30s, animate mini cows**

Add stampede trigger check and mini cow movement/collision logic.

- [ ] **Step 4: Add stampede sounds to SoundManager**

```javascript
// In sound-manager.js:
stampede() {
  // Rumbling hooves sound
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      this._tone(40 + Math.random() * 30, 0.15, 'sawtooth', 0.08);
      this._noise(0.1, 0.06);
    }, i * 150);
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes-absurd/CowCombat3D.js v1.2/public/js/babylon-game/shared/sound-manager.js
git commit -m "feat: add cow stampede mechanic to CowCombat3D"
```

---

### Task 8: CowCombat3D — enhanced sounds

**Files:**
- Modify: `v1.2/public/js/babylon-game/shared/sound-manager.js`
- Modify: `v1.2/public/js/babylon-game/scenes-absurd/CowCombat3D.js`

- [ ] **Step 1: Add richer cow sounds to SoundManager**

```javascript
// Hoof stomp
hoofStomp() {
  this._tone(60, 0.12, 'sine', 0.12);
  this._noise(0.08, 0.08);
}

// Milk squirt (comedy wet sound)
milkSquirt() {
  this._noise(0.08, 0.08);
  this._tone(400 + Math.random() * 200, 0.06, 'sine', 0.06);
}

// Angry moo (deeper, more aggressive)
angryMoo() {
  const ctx = this.ctx;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(60, ctx.currentTime + 0.2);
  osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.4);
  osc.frequency.linearRampToValueAtTime(70, ctx.currentTime + 0.7);
  g.gain.setValueAtTime(0.12, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
  osc.connect(g);
  g.connect(this.out);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.8);
}
```

- [ ] **Step 2: Wire sounds into CowCombat3D events**

- On successful milk: `milkSquirt()`
- On beat advance: `hoofStomp()` (subtle rhythm indicator)
- On attack start: `angryMoo()` instead of generic `cowAttack()`
- On stampede: `stampede()` + multiple `moo()` calls
- Ambient: occasional random `moo()` every 8-12 seconds

- [ ] **Step 3: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/sound-manager.js v1.2/public/js/babylon-game/scenes-absurd/CowCombat3D.js
git commit -m "feat: add rich cow sounds (moo, milk squirt, hoof stomp, angry moo)"
```

---

### Task 9: Browser test CowCombat3D improvements

**Files:** None (testing only)

- [ ] **Step 1: Start baking, advance to MIX phase, verify CowCombat3D loads**
- [ ] **Step 2: Verify green arrow indicator points at active udder**
- [ ] **Step 3: Verify udder numbers (1-4) are visible**
- [ ] **Step 4: Verify attack warnings are large and clear**
- [ ] **Step 5: Verify stampede triggers around 30 seconds**
- [ ] **Step 6: Verify all new sounds play (moo, squirt, stomp, stampede)**
- [ ] **Step 7: Play through to completion, verify scoring still works**
- [ ] **Step 8: Fix any bugs found, commit fixes**

---

### Task 10: More chaos events — data, runtime behavior, and polish

**Files:**
- Modify: `v1.2/data/evil-luck.json`
- Modify: `v1.2/public/js/babylon-game/shared/sound-manager.js`
- Modify: `v1.2/public/js/babylon-game/scene-manager.js` (wire chaos keys to gameplay effects)
- Modify: `v1.2/public/js/babylon-game/shared/hand-controller.js` (butter-hands grip modifier)

- [ ] **Step 1: Add new chaos events to evil-luck.json**

```json
{ "key": "butter-hands", "name": "Butter Fingers!", "description": "Everything is slippery! Grip strength halved.", "scorePenalty": 0.15, "phase": ["prep", "mix"] },
{ "key": "earthquake", "name": "Kitchen Earthquake!", "description": "The whole counter is shaking!", "scorePenalty": 0.20, "phase": ["any"] },
{ "key": "swarm", "name": "Bee Swarm!", "description": "Bees invaded the kitchen!", "scorePenalty": 0.15, "phase": ["decorate", "cool"] },
{ "key": "inverted", "name": "Inverted Controls!", "description": "Left is right, up is down!", "scorePenalty": 0.25, "phase": ["prep", "mix", "bake"] },
{ "key": "shrink", "name": "Honey I Shrunk The Cake!", "description": "The cake shrunk to half size!", "scorePenalty": 0.30, "phase": ["decorate", "present"] }
```

- [ ] **Step 2: Wire chaos events to runtime gameplay effects in `onChaosEvent()`**

In `BaseMinigameScene.onChaosEvent()` (scene-manager.js), add a switch on `event.key` that applies actual effects:

```javascript
// In onChaosEvent(event):
switch (event.key) {
  case 'butter-hands':
    // Halve grip — HandController3D checks this modifier
    if (this.handController) this.handController.gripModifier = 0.5;
    setTimeout(() => { if (this.handController) this.handController.gripModifier = 1.0; }, 8000);
    break;
  case 'earthquake':
    // Shake camera for 5 seconds
    this._earthquakeShake = 5.0; // countdown in update()
    break;
  case 'inverted':
    // Invert pointer input for 8 seconds
    this._invertedControls = true;
    setTimeout(() => { this._invertedControls = false; }, 8000);
    break;
  case 'swarm':
    // Visual distraction — spawn buzzing particles for 6 seconds
    this._spawnBeeParticles(6000);
    break;
  case 'shrink':
    // Scale cake mesh to 0.5 for 10 seconds
    if (this._cakeMesh) { this._cakeMesh.scaling.scaleInPlace(0.5); }
    setTimeout(() => { if (this._cakeMesh) this._cakeMesh.scaling.scaleInPlace(2.0); }, 10000);
    break;
}
```

In `HandController3D.canGrip()`, change threshold check: `>= 3 / this.gripModifier` (so with butter-hands, you need all 5 fingers).

In `update(dt)` of BaseMinigameScene, apply earthquake camera shake: if `this._earthquakeShake > 0`, add random offsets to camera position each frame and decrement timer.

For inverted controls: in PrepScene3D's `_setupPointerEvents()`, check `this._invertedControls` and flip X/Y offsets when mapping mouse to hand position.

- [ ] **Step 3: Add chaos reaction sounds**

Add earthquake rumble, bee buzz, shrink sound to SoundManager.

```javascript
earthquakeRumble() {
  this._tone(30, 0.8, 'sawtooth', 0.10);
  this._noise(0.6, 0.08);
}

beeBuzz() {
  this._tone(220, 0.4, 'sawtooth', 0.04);
  this._tone(330, 0.3, 'sawtooth', 0.03);
}

shrinkSound() {
  // Descending pitch
  const ctx = this.ctx; const osc = ctx.createOscillator(); const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);
  g.gain.setValueAtTime(0.08, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
  osc.connect(g); g.connect(this.out);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
}
```

- [ ] **Step 4: Commit**

```bash
git add v1.2/data/evil-luck.json v1.2/public/js/babylon-game/shared/sound-manager.js
git commit -m "feat: add 5 new chaos events and chaos sounds"
```

---

### Task 11: Final integration test

- [ ] **Step 1: Full playthrough — join team, start baking, play all phases**
- [ ] **Step 2: Verify PrepScene3D Surgeon Sim hands work end-to-end**
- [ ] **Step 3: Verify CowCombat3D clarity improvements and stampede**
- [ ] **Step 4: Verify sounds play throughout all phases**
- [ ] **Step 5: Verify chaos events display and apply penalties**
- [ ] **Step 6: Fix any remaining issues, final commit**
