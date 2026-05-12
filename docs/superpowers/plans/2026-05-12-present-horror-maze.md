# PresentScene3D Horror Maze — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the orbit-camera cake presentation scene with a first-person horror maze: 14 rooms, QTE dodging, a chase scene, and demonic judges. Player carries cake through the maze, taking damage from failed dodge prompts.

**Architecture:** Modular decomposition — `PresentScene3D` orchestrates room transitions via `RoomBuilder` (geometry), `ScareSystem` (QTE/damage), `ChaseController` (room 12 state machine), and `JudgePresentation` (final reveal). All modules live under `shared/horror-maze/`. Sounds added directly to existing `SoundManager`.

**Tech Stack:** Babylon.js (UniversalCamera FPS, MeshBuilder, GUI, ParticleSystem, fog), Web Audio API (procedural sounds via SoundManager), vanilla JS keyboard/mouse events.

**Spec:** `docs/superpowers/specs/2026-05-12-present-horror-maze-design.md`

---

## File Structure

```
v1.2/public/js/babylon-game/
├── shared/
│   ├── sound-manager.js                    (MODIFY — add 16 horror sound methods)
│   └── horror-maze/
│       ├── rooms.js                        (CREATE — ~500 lines, 14 room geometry builders)
│       ├── scare-system.js                 (CREATE — ~250 lines, QTE prompts + damage)
│       ├── chase-controller.js             (CREATE — ~200 lines, room 12 state machine)
│       ├── judge-presentation.js           (CREATE — ~200 lines, room 14 reveal)
│       └── cake-health.js                  (CREATE — ~100 lines, HUD cake integrity display)
├── scenes/
│   └── PresentScene3D.js                   (REWRITE — ~350 lines, FPS orchestrator)
v1.2/public/
├── player.html                             (MODIFY — add 5 new script tags)
└── assets/jumpscares/                      (CREATE — 2-3 placeholder PNG files)
```

---

### Task 1: Add horror sounds to SoundManager

**Files:**
- Modify: `v1.2/public/js/babylon-game/shared/sound-manager.js`

Add 16 new procedural sound methods using the existing `_tone()` and `_noise()` primitives.

- [ ] **Step 1: Add ambient/atmosphere sounds**

Add these methods after the existing `shrinkSound()` method:

```javascript
// ─── HORROR SOUNDS ───

// Loopable horror drone — returns a handle { stop() } for continuous playback
horrorDroneLoop() {
  const ctx = this.ctx;
  const osc = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = 38;
  lfo.type = 'sine';
  lfo.frequency.value = 0.15; // slow wobble
  lfoGain.gain.value = 5; // ±5Hz modulation
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  g.gain.value = 0.06;
  osc.connect(g);
  g.connect(this.out);
  osc.start();
  lfo.start();
  return { stop: () => { try { osc.stop(); lfo.stop(); } catch(e) {} } };
}

// One-shot drone for non-looped use (e.g. room transitions)
horrorDrone() {
  const ctx = this.ctx;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(38, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(42, ctx.currentTime + 2);
  osc.frequency.linearRampToValueAtTime(35, ctx.currentTime + 4);
  g.gain.setValueAtTime(0.06, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 4.5);
  osc.connect(g);
  g.connect(this.out);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 4.5);
}

heartbeat(rate = 1.0) {
  const ctx = this.ctx;
  const interval = 0.6 / rate;
  for (let i = 0; i < 2; i++) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = i === 0 ? 55 : 45;
    const t = ctx.currentTime + i * (interval * 0.3);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g);
    g.connect(this.out);
    osc.start(t);
    osc.stop(t + 0.25);
  }
}

footstep() {
  this._noise(0.06, 0.04);
  this._tone(80 + Math.random() * 30, 0.08, 'sine', 0.06);
}

whisper() {
  const ctx = this.ctx;
  const bufferSize = ctx.sampleRate * 0.4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.3;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 400 + Math.random() * 400;
  bandpass.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.05, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  source.connect(bandpass);
  bandpass.connect(g);
  g.connect(this.out);
  source.start(ctx.currentTime);
  source.stop(ctx.currentTime + 0.4);
}

ambientDrip() {
  this._tone(900 + Math.random() * 300, 0.06, 'sine', 0.04);
}
```

- [ ] **Step 2: Add scare/action sounds**

```javascript
scareString() {
  const ctx = this.ctx;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(2200, ctx.currentTime + 0.15);
  g.gain.setValueAtTime(0.14, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.connect(g);
  g.connect(this.out);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.25);
}

jumpscareHit() {
  // Dissonant chord burst
  const ctx = this.ctx;
  [200, 283, 400, 566].forEach(freq => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(g);
    g.connect(this.out);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  });
}

knifeWhoosh() {
  const ctx = this.ctx;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
  g.gain.setValueAtTime(0.08, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
  osc.connect(g);
  g.connect(this.out);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

metalCreak() {
  const ctx = this.ctx;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.3);
  osc.frequency.linearRampToValueAtTime(90, ctx.currentTime + 0.6);
  g.gain.setValueAtTime(0.04, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
  osc.connect(g);
  g.connect(this.out);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.7);
}

steamHiss() {
  this._noise(0.3, 0.07);
}

doorSlam() {
  this._tone(50, 0.3, 'sine', 0.14);
  this._noise(0.15, 0.1);
}

cakeCrumble() {
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      this._noise(0.04, 0.03);
      this._tone(200 + Math.random() * 300, 0.03, 'sine', 0.02);
    }, i * 30);
  }
}
```

- [ ] **Step 3: Add chase/judge sounds**

```javascript
entityRoar() {
  const ctx = this.ctx;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const dist = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1;
    curve[i] = Math.tanh(x * 3);
  }
  dist.curve = curve;
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(70, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.3);
  osc.frequency.linearRampToValueAtTime(60, ctx.currentTime + 0.8);
  g.gain.setValueAtTime(0.12, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
  osc.connect(dist);
  dist.connect(g);
  g.connect(this.out);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.9);
}

// Loopable chase music — returns { stop() } handle. Auto-repeating kick + bass pattern.
chaseMusicLoop() {
  const ctx = this.ctx;
  let running = true;
  const playBar = () => {
    if (!running) return;
    for (let i = 0; i < 8; i++) {
      const t = ctx.currentTime + i * 0.2;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.08);
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(g);
      g.connect(this.out);
      osc.start(t);
      osc.stop(t + 0.12);
    }
    // Dissonant bass under the kicks
    const bass = ctx.createOscillator();
    const bg = ctx.createGain();
    bass.type = 'sawtooth';
    bass.frequency.value = 55;
    bg.gain.setValueAtTime(0.05, ctx.currentTime);
    bg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.6);
    bass.connect(bg);
    bg.connect(this.out);
    bass.start(ctx.currentTime);
    bass.stop(ctx.currentTime + 1.6);
    if (running) setTimeout(playBar, 1600);
  };
  playBar();
  return { stop: () => { running = false; } };
}

// One-shot chase music stinger (for non-looped use)
chaseMusic() {
  const ctx = this.ctx;
  for (let i = 0; i < 8; i++) {
    const t = ctx.currentTime + i * 0.2;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.08);
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g);
    g.connect(this.out);
    osc.start(t);
    osc.stop(t + 0.12);
  }
}

gavelSmash() {
  this._tone(40, 0.4, 'sine', 0.15);
  this._noise(0.12, 0.12);
  this._tone(60, 0.2, 'square', 0.06);
}

iceCreak() {
  this._noise(0.05, 0.03);
  this._tone(2000 + Math.random() * 1000, 0.08, 'sine', 0.04);
}
```

- [ ] **Step 4: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/sound-manager.js
git commit -m "feat: add 16 procedural horror sounds to SoundManager"
```

---

### Task 2: Create CakeHealthDisplay class

**Files:**
- Create: `v1.2/public/js/babylon-game/shared/horror-maze/cake-health.js`

This shows cake integrity as a stylized HUD panel in the bottom-right corner. The spec mentions a "3D mini-cake viewport" but we deliberately simplify to a GUI-based layered cake icon that tilts/shifts/cracks as damage increases — this avoids the complexity of a secondary camera/render-texture for marginal visual benefit, while still communicating cake state clearly.

- [ ] **Step 1: Create the horror-maze directory and cake-health.js**

```javascript
// Evil Jeopardy 1.2 — Cake Health HUD Display
// Shows a mini cake in bottom-right that deteriorates as player takes damage.

class CakeHealthDisplay {
  constructor(scene, hudTexture) {
    this.scene = scene;
    this.hudTexture = hudTexture;
    this.integrity = 100;
    this._meshes = [];

    this._buildHUD();
    this._buildMiniCake();
  }

  _buildHUD() {
    // Container panel bottom-right
    this.container = new BABYLON.GUI.Rectangle('cakeHealthContainer');
    this.container.width = '140px';
    this.container.height = '160px';
    this.container.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.container.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.container.left = '-20px';
    this.container.top = '-20px';
    this.container.background = 'rgba(0, 0, 0, 0.5)';
    this.container.cornerRadius = 12;
    this.container.thickness = 2;
    this.container.color = '#ff4444';
    this.hudTexture.addControl(this.container);

    // Integrity label
    this.label = new BABYLON.GUI.TextBlock('cakeLabel', '🎂 100%');
    this.label.color = '#ffffff';
    this.label.fontSize = 18;
    this.label.fontWeight = 'bold';
    this.label.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.label.paddingBottom = '8px';
    this.label.outlineWidth = 2;
    this.label.outlineColor = '#000000';
    this.container.addControl(this.label);

    // Health bar
    this.barBg = new BABYLON.GUI.Rectangle('cakeBarBg');
    this.barBg.width = '110px';
    this.barBg.height = '10px';
    this.barBg.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.barBg.top = '-35px';
    this.barBg.background = '#333333';
    this.barBg.cornerRadius = 5;
    this.barBg.thickness = 0;
    this.container.addControl(this.barBg);

    this.barFill = new BABYLON.GUI.Rectangle('cakeBarFill');
    this.barFill.width = '100%';
    this.barFill.height = '100%';
    this.barFill.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.barFill.background = '#44ff44';
    this.barFill.cornerRadius = 5;
    this.barFill.thickness = 0;
    this.barBg.addControl(this.barFill);
  }

  _buildMiniCake() {
    // Create a small 3D cake indicator using GUI shapes
    // We use stacked colored rectangles as a simplified cake icon
    this.cakeIcon = new BABYLON.GUI.StackPanel('cakeIcon');
    this.cakeIcon.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.cakeIcon.top = '12px';
    this.cakeIcon.width = '80px';
    this.cakeIcon.height = '80px';
    this.container.addControl(this.cakeIcon);

    // Three cake layers
    this.layers = [];
    const colors = ['#f5e6d3', '#e8c9a0', '#d4a574'];
    for (let i = 0; i < 3; i++) {
      const layer = new BABYLON.GUI.Rectangle(`cakeLayer${i}`);
      layer.width = `${70 - i * 10}px`;
      layer.height = '20px';
      layer.background = colors[i];
      layer.cornerRadius = 4;
      layer.thickness = 1;
      layer.color = '#8b6914';
      layer.paddingTop = '2px';
      this.cakeIcon.addControl(layer);
      this.layers.push(layer);
    }
  }

  takeDamage(amount) {
    this.integrity = Math.max(0, this.integrity - amount);
    this._updateVisuals();
    return this.integrity;
  }

  _updateVisuals() {
    const pct = this.integrity;
    this.label.text = `🎂 ${Math.round(pct)}%`;
    this.barFill.width = `${pct}%`;

    // Color the bar based on health
    if (pct > 60) {
      this.barFill.background = '#44ff44';
      this.container.color = '#44ff44';
    } else if (pct > 30) {
      this.barFill.background = '#ffaa00';
      this.container.color = '#ffaa00';
    } else {
      this.barFill.background = '#ff4444';
      this.container.color = '#ff4444';
    }

    // Cake layer damage visuals
    if (pct < 80 && this.layers[0]) {
      this.layers[0].rotation = 0.05;
    }
    if (pct < 50 && this.layers[1]) {
      this.layers[1].left = '5px';
      this.layers[1].rotation = -0.08;
    }
    if (pct < 25 && this.layers[2]) {
      this.layers[2].left = '-8px';
      this.layers[2].rotation = 0.12;
      this.layers[2].background = '#aa7744';
    }
  }

  getIntegrity() {
    return this.integrity;
  }

  dispose() {
    this.hudTexture.removeControl(this.container);
    this.container.dispose();
  }
}

window.CakeHealthDisplay = CakeHealthDisplay;
```

- [ ] **Step 2: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/horror-maze/cake-health.js
git commit -m "feat: add CakeHealthDisplay HUD class for horror maze"
```

---

### Task 3: Create ScareSystem class (QTE + damage)

**Files:**
- Create: `v1.2/public/js/babylon-game/shared/horror-maze/scare-system.js`

The QTE system: shows a key prompt, counts down, handles success/fail, applies damage.

- [ ] **Step 1: Create scare-system.js with QTE prompt logic**

```javascript
// Evil Jeopardy 1.2 — Scare System (QTE prompts + damage)
// Handles scare event triggering, QTE key prompts, timing, and damage application.

class ScareSystem {
  constructor(scene, hudTexture, cakeHealth, sounds) {
    this.scene = scene;
    this.hudTexture = hudTexture;
    this.cakeHealth = cakeHealth;
    this.sounds = sounds;
    this._disposed = false;

    this.activeQTE = null;
    this._qteTimer = null;
    this._onKeyHandler = null;
    this._cooldown = false;

    // QTE keys (never movement keys)
    this.keyPools = {
      easy: ['Q', 'E', 'F'],
      medium: ['Q', 'E', 'F', 'R'],
      hard: ['Q', 'E', 'F', 'R', 'Z', 'X']
    };

    // Damage tiers
    this.DAMAGE = { light: 3, medium: 7, heavy: 12, chase: 15 };

    this._buildQTEOverlay();
    this._bindKeys();
  }

  _buildQTEOverlay() {
    // Central key prompt
    this.qteContainer = new BABYLON.GUI.Rectangle('qteContainer');
    this.qteContainer.width = '120px';
    this.qteContainer.height = '120px';
    this.qteContainer.cornerRadius = 60;
    this.qteContainer.background = 'rgba(0, 0, 0, 0.8)';
    this.qteContainer.thickness = 4;
    this.qteContainer.color = '#ffcc00';
    this.qteContainer.isVisible = false;
    this.hudTexture.addControl(this.qteContainer);

    this.qteKeyText = new BABYLON.GUI.TextBlock('qteKey', '');
    this.qteKeyText.color = '#ffffff';
    this.qteKeyText.fontSize = 52;
    this.qteKeyText.fontWeight = 'bold';
    this.qteContainer.addControl(this.qteKeyText);

    // Timer ring (simplified as a shrinking bar below the circle)
    this.qteTimerBar = new BABYLON.GUI.Rectangle('qteTimerBar');
    this.qteTimerBar.width = '120px';
    this.qteTimerBar.height = '8px';
    this.qteTimerBar.top = '70px';
    this.qteTimerBar.background = '#ffcc00';
    this.qteTimerBar.cornerRadius = 4;
    this.qteTimerBar.thickness = 0;
    this.qteTimerBar.isVisible = false;
    this.hudTexture.addControl(this.qteTimerBar);

    // Red vignette flash overlay
    this.damageFlash = new BABYLON.GUI.Rectangle('damageFlash');
    this.damageFlash.width = '100%';
    this.damageFlash.height = '100%';
    this.damageFlash.background = 'rgba(255, 0, 0, 0)';
    this.damageFlash.thickness = 0;
    this.damageFlash.isVisible = false;
    this.damageFlash.isHitTestVisible = false;
    this.hudTexture.addControl(this.damageFlash);
  }

  _bindKeys() {
    this._onKeyHandler = (e) => {
      if (this._disposed || !this.activeQTE) return;
      const pressed = e.key.toUpperCase();
      if (pressed === this.activeQTE.key) {
        this._resolveQTE(true);
      }
    };
    window.addEventListener('keydown', this._onKeyHandler);
  }

  /**
   * Trigger a QTE scare event.
   * @param {string} tier - 'light', 'medium', 'heavy'
   * @param {number} roomIndex - 0-13, used for difficulty scaling
   * @param {function} onResult - callback(success: boolean)
   */
  triggerQTE(tier, roomIndex, onResult) {
    if (this._disposed || this.activeQTE || this._cooldown) return;

    // Determine difficulty
    let pool, window;
    if (roomIndex <= 3) { pool = this.keyPools.easy; window = 2000; }
    else if (roomIndex <= 7) { pool = this.keyPools.medium; window = 1500; }
    else { pool = this.keyPools.hard; window = 1200; }

    const key = pool[Math.floor(Math.random() * pool.length)];
    this.activeQTE = { key, tier, onResult, startTime: performance.now(), window };

    // Show prompt
    this.qteKeyText.text = key;
    this.qteContainer.isVisible = true;
    this.qteTimerBar.isVisible = true;
    this.qteTimerBar.width = '120px';

    // Animate timer bar shrinking
    const startWidth = 120;
    const startTime = performance.now();
    this._qteTimer = setInterval(() => {
      if (this._disposed) { clearInterval(this._qteTimer); return; }
      const elapsed = performance.now() - startTime;
      const remaining = 1 - (elapsed / window);
      this.qteTimerBar.width = `${Math.max(0, remaining * startWidth)}px`;
      if (remaining <= 0.3) {
        this.qteContainer.color = '#ff4444';
      }
    }, 30);

    // Timeout = fail
    setTimeout(() => {
      if (this.activeQTE && this.activeQTE.key === key) {
        this._resolveQTE(false);
      }
    }, window);
  }

  _resolveQTE(success) {
    if (!this.activeQTE) return;
    const { tier, onResult } = this.activeQTE;

    clearInterval(this._qteTimer);
    this.qteContainer.isVisible = false;
    this.qteTimerBar.isVisible = false;
    this.qteContainer.color = '#ffcc00';

    if (success) {
      this._showSuccess();
      if (this.sounds) this.sounds.knifeWhoosh();
    } else {
      const damage = this.DAMAGE[tier] || 7;
      this.cakeHealth.takeDamage(damage);
      this._showDamageFlash();
      if (this.sounds) this.sounds.cakeCrumble();
    }

    this.activeQTE = null;
    this._cooldown = true;
    setTimeout(() => { this._cooldown = false; }, 800);

    if (onResult) onResult(success);
  }

  _showSuccess() {
    const msg = new BABYLON.GUI.TextBlock('qteSuccess', '✓ DODGED!');
    msg.color = '#44ff44';
    msg.fontSize = 36;
    msg.fontWeight = 'bold';
    msg.outlineWidth = 3;
    msg.outlineColor = '#000000';
    this.hudTexture.addControl(msg);
    setTimeout(() => {
      this.hudTexture.removeControl(msg);
      msg.dispose();
    }, 600);
  }

  _showDamageFlash() {
    this.damageFlash.isVisible = true;
    this.damageFlash.background = 'rgba(255, 0, 0, 0.4)';
    let alpha = 0.4;
    const fade = setInterval(() => {
      alpha -= 0.04;
      if (alpha <= 0) {
        clearInterval(fade);
        this.damageFlash.isVisible = false;
      } else {
        this.damageFlash.background = `rgba(255, 0, 0, ${alpha})`;
      }
    }, 30);
  }

  /**
   * Trigger ambient scare (no QTE, just effects).
   */
  triggerAmbient(soundName) {
    if (this.sounds && this.sounds[soundName]) {
      this.sounds[soundName]();
    }
  }

  /**
   * Apply flat damage without QTE (e.g., chase caught, timeout).
   */
  applyDirectDamage(amount) {
    this.cakeHealth.takeDamage(amount);
    this._showDamageFlash();
    if (this.sounds) this.sounds.cakeCrumble();
  }

  isQTEActive() {
    return this.activeQTE !== null;
  }

  dispose() {
    this._disposed = true;
    clearInterval(this._qteTimer);
    if (this._onKeyHandler) {
      window.removeEventListener('keydown', this._onKeyHandler);
    }
    this.hudTexture.removeControl(this.qteContainer);
    this.hudTexture.removeControl(this.qteTimerBar);
    this.hudTexture.removeControl(this.damageFlash);
    this.qteContainer.dispose();
    this.qteTimerBar.dispose();
    this.damageFlash.dispose();
  }
}

window.ScareSystem = ScareSystem;
```

- [ ] **Step 2: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/horror-maze/scare-system.js
git commit -m "feat: add ScareSystem class with QTE prompts and damage"
```

---

### Task 4: Create RoomBuilder — infrastructure + rooms 1-5

**Files:**
- Create: `v1.2/public/js/babylon-game/shared/horror-maze/rooms.js`

Each room is a function that builds geometry, places scares, and returns a room object with metadata.

- [ ] **Step 1: Create rooms.js with the RoomBuilder class skeleton and room 1-2**

```javascript
// Evil Jeopardy 1.2 — Horror Maze Room Builder
// Builds 3D geometry for each of the 14 horror maze rooms.

class RoomBuilder {
  constructor(scene, materials) {
    this.scene = scene;
    this.materials = materials;
    this._roomMeshes = [];
  }

  /**
   * Build a room by index (0-13).
   * @returns {{ root, scares, doorPosition, entryPosition, sideRoom }}
   */
  buildRoom(index) {
    const builders = [
      this._room1_darkPantry,
      this._room2_freezer,
      this._room3_boilingRoom,
      this._room4_knifeCorridor,
      this._room5_meatLocker,
      this._room6_theSink,
      this._room7_dishPit,
      this._room8_theOven,
      this._room9_spiceGauntlet,
      this._room10_walkIn,
      this._room11_dumbwaiter,
      this._room12_chase,
      this._room13_judgeCorridor,
      this._room14_judgeChamber
    ];
    const builder = builders[index];
    if (!builder) return null;
    return builder.call(this);
  }

  _createRoomShell(name, width, height, depth, color) {
    const root = new BABYLON.TransformNode(`room_${name}`, this.scene);

    const floorMat = this.materials.food(color.scale(0.3));
    const wallMat = this.materials.food(color.scale(0.5));
    const ceilMat = this.materials.food(color.scale(0.2));

    // Floor
    const floor = BABYLON.MeshBuilder.CreateBox(`${name}_floor`, {
      width, height: 0.2, depth
    }, this.scene);
    floor.position.y = -0.1;
    floor.material = floorMat;
    floor.parent = root;

    // Ceiling
    const ceil = BABYLON.MeshBuilder.CreateBox(`${name}_ceil`, {
      width, height: 0.15, depth
    }, this.scene);
    ceil.position.y = height;
    ceil.material = ceilMat;
    ceil.parent = root;

    // Walls (left, right)
    const wallL = BABYLON.MeshBuilder.CreateBox(`${name}_wallL`, {
      width: 0.2, height, depth
    }, this.scene);
    wallL.position = new BABYLON.Vector3(-width / 2, height / 2, 0);
    wallL.material = wallMat;
    wallL.parent = root;

    const wallR = BABYLON.MeshBuilder.CreateBox(`${name}_wallR`, {
      width: 0.2, height, depth
    }, this.scene);
    wallR.position = new BABYLON.Vector3(width / 2, height / 2, 0);
    wallR.material = wallMat;
    wallR.parent = root;

    // Back wall with doorway opening (1.5m wide, 2.5m tall gap in center)
    const doorW = 1.5;
    const doorH = Math.min(2.5, height - 0.3);
    // Left portion of back wall
    const bwLeft = BABYLON.MeshBuilder.CreateBox(`${name}_bwL`, {
      width: (width - doorW) / 2, height, depth: 0.2
    }, this.scene);
    bwLeft.position = new BABYLON.Vector3(-(width + doorW) / 4, height / 2, depth / 2);
    bwLeft.material = wallMat;
    bwLeft.parent = root;
    // Right portion of back wall
    const bwRight = BABYLON.MeshBuilder.CreateBox(`${name}_bwR`, {
      width: (width - doorW) / 2, height, depth: 0.2
    }, this.scene);
    bwRight.position = new BABYLON.Vector3((width + doorW) / 4, height / 2, depth / 2);
    bwRight.material = wallMat;
    bwRight.parent = root;
    // Lintel above doorway
    const lintel = BABYLON.MeshBuilder.CreateBox(`${name}_lintel`, {
      width: doorW, height: height - doorH, depth: 0.2
    }, this.scene);
    lintel.position = new BABYLON.Vector3(0, doorH + (height - doorH) / 2, depth / 2);
    lintel.material = wallMat;
    lintel.parent = root;

    // Entry and exit positions for transitions
    const entryPosition = new BABYLON.Vector3(0, 0, -depth / 2 + 0.5);
    const exitPosition = new BABYLON.Vector3(0, 0, depth / 2 - 0.3);

    return { root, floor, wallL, wallR, ceil, entryPosition, exitPosition };
  }

  _addJudgeEyes(root, count, bounds) {
    const eyes = [];
    for (let i = 0; i < count; i++) {
      const eyePair = new BABYLON.TransformNode(`eyes_${i}`, this.scene);
      eyePair.parent = root;

      const x = (Math.random() - 0.5) * bounds.x;
      const y = 1.5 + Math.random() * 1.5;
      const z = (Math.random() - 0.5) * bounds.z;
      eyePair.position = new BABYLON.Vector3(x, y, z);

      for (let side = -1; side <= 1; side += 2) {
        const eye = BABYLON.MeshBuilder.CreateSphere(`eye_${i}_${side}`, {
          diameter: 0.12, segments: 8
        }, this.scene);
        eye.position.x = side * 0.09;
        eye.parent = eyePair;

        const eyeMat = new BABYLON.StandardMaterial(`eyeMat_${i}_${side}`, this.scene);
        eyeMat.emissiveColor = new BABYLON.Color3(0.9, 0.6, 0.1);
        eyeMat.disableLighting = true;
        eye.material = eyeMat;
      }
      eyes.push(eyePair);
    }
    return eyes;
  }

  // ─── ROOM 1: Dark Pantry ───
  _room1_darkPantry() {
    const shell = this._createRoomShell('pantry', 5, 3.5, 8,
      new BABYLON.Color3(0.4, 0.35, 0.3));
    const { root } = shell;

    // Shelves along walls
    for (let z = -3; z <= 3; z += 1.5) {
      for (let side = -1; side <= 1; side += 2) {
        const shelf = BABYLON.MeshBuilder.CreateBox(`shelf_${z}_${side}`, {
          width: 0.8, height: 0.06, depth: 0.4
        }, this.scene);
        shelf.position = new BABYLON.Vector3(side * 2.1, 1.2 + Math.random() * 0.8, z);
        shelf.material = this.materials.wood();
        shelf.parent = root;

        // Cans on shelves
        const canCount = 2 + Math.floor(Math.random() * 3);
        for (let c = 0; c < canCount; c++) {
          const can = BABYLON.MeshBuilder.CreateCylinder(`can_${z}_${side}_${c}`, {
            diameter: 0.12, height: 0.2, tessellation: 12
          }, this.scene);
          can.position = new BABYLON.Vector3(
            side * 2.1 + (Math.random() - 0.5) * 0.5,
            shelf.position.y + 0.13,
            z + (Math.random() - 0.5) * 0.3
          );
          can.material = this.materials.metal();
          can.parent = root;
        }
      }
    }

    const eyes = this._addJudgeEyes(root, 2, { x: 4, z: 7 });

    return {
      root,
      roomLength: 8,
      entryPosition: shell.entryPosition,
      exitPosition: shell.exitPosition,
      scares: [{ type: 'light', trigger: 'enter', delay: 2000, sound: 'metalCreak' }],
      hasSideRoom: false,
      eyes
    };
  }

  // ─── ROOM 2: The Freezer ───
  _room2_freezer() {
    const { root } = this._createRoomShell('freezer', 5, 3.2, 8,
      new BABYLON.Color3(0.5, 0.6, 0.8));

    // Ice patches on floor
    for (let i = 0; i < 6; i++) {
      const ice = BABYLON.MeshBuilder.CreateDisc(`ice_${i}`, {
        radius: 0.3 + Math.random() * 0.4, tessellation: 8
      }, this.scene);
      ice.rotation.x = Math.PI / 2;
      ice.position = new BABYLON.Vector3(
        (Math.random() - 0.5) * 4, 0.01,
        (Math.random() - 0.5) * 7
      );
      const iceMat = new BABYLON.StandardMaterial(`iceMat_${i}`, this.scene);
      iceMat.diffuseColor = new BABYLON.Color3(0.7, 0.85, 0.95);
      iceMat.alpha = 0.6;
      ice.material = iceMat;
      ice.parent = root;
    }

    // Frozen hands on walls
    for (let i = 0; i < 3; i++) {
      const hand = BABYLON.MeshBuilder.CreateBox(`frozenHand_${i}`, {
        width: 0.15, height: 0.3, depth: 0.08
      }, this.scene);
      hand.position = new BABYLON.Vector3(
        (i % 2 === 0 ? -1 : 1) * 2.3,
        1.0 + Math.random() * 1.0,
        -2 + i * 2.5
      );
      hand.material = this.materials.food(new BABYLON.Color3(0.6, 0.7, 0.85));
      hand.parent = root;
    }

    const eyes = this._addJudgeEyes(root, 2, { x: 4, z: 7 });

    return {
      root,
      roomLength: 8,
      scares: [{ type: 'medium', trigger: 'middle', delay: 1500, sound: 'iceCreak' }],
      hasSideRoom: false,
      eyes
    };
  }

  // ─── ROOM 3: Boiling Room ───
  _room3_boilingRoom() {
    const { root } = this._createRoomShell('boiling', 6, 3.5, 9,
      new BABYLON.Color3(0.6, 0.4, 0.2));

    // Giant pots
    for (let i = 0; i < 3; i++) {
      const pot = BABYLON.MeshBuilder.CreateCylinder(`pot_${i}`, {
        diameter: 1.2, height: 0.9, tessellation: 20
      }, this.scene);
      pot.position = new BABYLON.Vector3(-1.5 + i * 1.5, 0.45, 1 + i * 1.8);
      pot.material = this.materials.metal();
      pot.parent = root;

      // "Steam" particle hint (static mesh placeholder)
      const steam = BABYLON.MeshBuilder.CreateSphere(`steam_${i}`, {
        diameter: 0.6, segments: 8
      }, this.scene);
      steam.position = new BABYLON.Vector3(pot.position.x, 1.2, pot.position.z);
      const steamMat = new BABYLON.StandardMaterial(`steamMat_${i}`, this.scene);
      steamMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
      steamMat.alpha = 0.3;
      steam.material = steamMat;
      steam.parent = root;
    }

    const eyes = this._addJudgeEyes(root, 3, { x: 5, z: 8 });

    return {
      root,
      roomLength: 9,
      scares: [
        { type: 'medium', trigger: 'position', z: 3, sound: 'steamHiss' },
        { type: 'medium', trigger: 'position', z: 6, sound: 'steamHiss' }
      ],
      hasSideRoom: true,
      eyes
    };
  }

  // ─── ROOM 4: Knife Corridor ───
  _room4_knifeCorridor() {
    const { root } = this._createRoomShell('knife', 3.5, 3, 10,
      new BABYLON.Color3(0.35, 0.3, 0.3));

    // Knives in walls
    for (let z = -4; z <= 4; z += 1.2) {
      for (let side = -1; side <= 1; side += 2) {
        const knife = BABYLON.MeshBuilder.CreateBox(`knife_${z}_${side}`, {
          width: 0.04, height: 0.5, depth: 0.02
        }, this.scene);
        knife.position = new BABYLON.Vector3(side * 1.5, 1.2 + Math.random() * 0.8, z);
        knife.rotation.z = side * 0.3;
        knife.material = this.materials.metal();
        knife.parent = root;
      }
    }

    const eyes = this._addJudgeEyes(root, 3, { x: 3, z: 9 });

    return {
      root,
      roomLength: 10,
      scares: [
        { type: 'medium', trigger: 'position', z: 2, sound: 'knifeWhoosh' },
        { type: 'medium', trigger: 'position', z: 6, sound: 'knifeWhoosh' }
      ],
      hasSideRoom: false,
      eyes
    };
  }

  // ─── ROOM 5: Meat Locker ───
  _room5_meatLocker() {
    const { root } = this._createRoomShell('meat', 5, 3.5, 8,
      new BABYLON.Color3(0.5, 0.2, 0.2));

    // Hanging shapes (hooks + meat-like forms)
    for (let i = 0; i < 5; i++) {
      const hookRoot = new BABYLON.TransformNode(`hook_${i}`, this.scene);
      hookRoot.parent = root;
      hookRoot.position = new BABYLON.Vector3(
        (Math.random() - 0.5) * 3.5,
        3.2,
        -3 + i * 1.6
      );

      // Hook
      const hook = BABYLON.MeshBuilder.CreateTorus(`hookMesh_${i}`, {
        diameter: 0.2, thickness: 0.03, tessellation: 12
      }, this.scene);
      hook.parent = hookRoot;
      hook.material = this.materials.metal();

      // Hanging shape
      const meat = BABYLON.MeshBuilder.CreateCylinder(`meat_${i}`, {
        diameterTop: 0.2, diameterBottom: 0.35, height: 0.8, tessellation: 8
      }, this.scene);
      meat.position.y = -0.5;
      meat.material = this.materials.food(new BABYLON.Color3(0.5, 0.15, 0.15));
      meat.parent = hookRoot;
    }

    const eyes = this._addJudgeEyes(root, 4, { x: 4, z: 7 });

    return {
      root,
      roomLength: 8,
      scares: [{ type: 'heavy', trigger: 'middle', delay: 2000, sound: 'scareString' }],
      hasSideRoom: false,
      eyes
    };
  }
```

- [ ] **Step 2: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/horror-maze/rooms.js
git commit -m "feat: add RoomBuilder with rooms 1-5 (pantry, freezer, boiling, knife, meat)"
```

---

### Task 5: RoomBuilder — rooms 6-11

**Files:**
- Modify: `v1.2/public/js/babylon-game/shared/horror-maze/rooms.js`

- [ ] **Step 1: Add rooms 6-8 (sink, dish pit, oven)**

```javascript
  // ─── ROOM 6: The Sink ───
  _room6_theSink() {
    const { root } = this._createRoomShell('sink', 5, 3, 8,
      new BABYLON.Color3(0.3, 0.4, 0.45));

    // Flooded floor effect (transparent blue plane)
    const water = BABYLON.MeshBuilder.CreateGround('water', { width: 5, height: 8 }, this.scene);
    const waterMat = new BABYLON.StandardMaterial('waterMat', this.scene);
    waterMat.diffuseColor = new BABYLON.Color3(0.2, 0.35, 0.5);
    waterMat.alpha = 0.4;
    water.material = waterMat;
    water.position.y = 0.05;
    water.parent = root;

    // Drain grates
    for (let i = 0; i < 3; i++) {
      const drain = BABYLON.MeshBuilder.CreateCylinder(`drain_${i}`, {
        diameter: 0.4, height: 0.05, tessellation: 16
      }, this.scene);
      drain.position = new BABYLON.Vector3((i - 1) * 1.5, 0.02, -1 + i * 2.5);
      drain.material = this.materials.metal();
      drain.parent = root;
    }

    const eyes = this._addJudgeEyes(root, 3, { x: 4, z: 7 });
    return {
      root, roomLength: 8,
      scares: [{ type: 'medium', trigger: 'position', z: 4, sound: 'ambientDrip' }],
      hasSideRoom: true, eyes
    };
  }

  // ─── ROOM 7: Dish Pit ───
  _room7_dishPit() {
    const { root } = this._createRoomShell('dishes', 6, 3.5, 9,
      new BABYLON.Color3(0.4, 0.4, 0.4));

    // Towers of dishes
    for (let t = 0; t < 4; t++) {
      const towerX = -2 + t * 1.5;
      const towerZ = -2 + t * 2;
      for (let d = 0; d < 5 + Math.floor(Math.random() * 4); d++) {
        const plate = BABYLON.MeshBuilder.CreateCylinder(`plate_${t}_${d}`, {
          diameter: 0.5, height: 0.04, tessellation: 16
        }, this.scene);
        plate.position = new BABYLON.Vector3(towerX, 0.02 + d * 0.05, towerZ);
        plate.material = this.materials.food(new BABYLON.Color3(0.9, 0.9, 0.85));
        plate.parent = root;
      }
    }

    const eyes = this._addJudgeEyes(root, 3, { x: 5, z: 8 });
    return {
      root, roomLength: 9,
      scares: [
        { type: 'medium', trigger: 'position', z: 2, sound: 'metalCreak' },
        { type: 'medium', trigger: 'position', z: 4.5, sound: 'knifeWhoosh' },
        { type: 'medium', trigger: 'position', z: 7, sound: 'metalCreak' }
      ],
      hasSideRoom: false, eyes
    };
  }

  // ─── ROOM 8: The Oven ───
  _room8_theOven() {
    const { root } = this._createRoomShell('oven', 6, 4, 9,
      new BABYLON.Color3(0.5, 0.3, 0.15));

    // Giant industrial oven
    const oven = BABYLON.MeshBuilder.CreateBox('giantOven', {
      width: 3, height: 2.5, depth: 2
    }, this.scene);
    oven.position = new BABYLON.Vector3(0, 1.25, 3);
    oven.material = this.materials.metal();
    oven.parent = root;

    // Oven door
    const door = BABYLON.MeshBuilder.CreateBox('ovenDoor', {
      width: 1.5, height: 1.2, depth: 0.08
    }, this.scene);
    door.position = new BABYLON.Vector3(0, 1.0, 1.98);
    const doorMat = new BABYLON.StandardMaterial('ovenDoorMat', this.scene);
    doorMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    doorMat.emissiveColor = new BABYLON.Color3(0.3, 0.1, 0);
    door.material = doorMat;
    door.parent = root;

    // Fire glow spheres
    for (let i = 0; i < 3; i++) {
      const glow = BABYLON.MeshBuilder.CreateSphere(`fireGlow_${i}`, {
        diameter: 0.3, segments: 8
      }, this.scene);
      glow.position = new BABYLON.Vector3(-0.5 + i * 0.5, 0.5, 3);
      const glowMat = new BABYLON.StandardMaterial(`glowMat_${i}`, this.scene);
      glowMat.emissiveColor = new BABYLON.Color3(1, 0.4, 0);
      glowMat.alpha = 0.5;
      glow.material = glowMat;
      glow.parent = root;
    }

    const eyes = this._addJudgeEyes(root, 4, { x: 5, z: 8 });
    return {
      root, roomLength: 9,
      scares: [
        { type: 'heavy', trigger: 'position', z: 3, sound: 'steamHiss' },
        { type: 'heavy', trigger: 'position', z: 6, sound: 'scareString' }
      ],
      hasSideRoom: false, eyes
    };
  }
```

- [ ] **Step 2: Add rooms 9-11 (spice gauntlet, walk-in, dumbwaiter)**

```javascript
  // ─── ROOM 9: Spice Gauntlet ───
  _room9_spiceGauntlet() {
    const { root } = this._createRoomShell('spice', 4, 3, 10,
      new BABYLON.Color3(0.5, 0.4, 0.25));

    // Tall shelves on both sides (will "close in" via scare animation)
    for (let side = -1; side <= 1; side += 2) {
      for (let z = -4; z <= 4; z += 2) {
        const shelf = BABYLON.MeshBuilder.CreateBox(`spiceShelf_${side}_${z}`, {
          width: 0.6, height: 2.5, depth: 0.4
        }, this.scene);
        shelf.position = new BABYLON.Vector3(side * 1.6, 1.25, z);
        shelf.material = this.materials.wood();
        shelf.parent = root;
      }
    }

    const eyes = this._addJudgeEyes(root, 4, { x: 3, z: 9 });
    return {
      root, roomLength: 10,
      scares: [{ type: 'heavy', trigger: 'middle', delay: 1500, sound: 'metalCreak' }],
      hasSideRoom: true, eyes
    };
  }

  // ─── ROOM 10: The Walk-In ───
  _room10_walkIn() {
    const { root } = this._createRoomShell('walkin', 4, 3, 7,
      new BABYLON.Color3(0.15, 0.15, 0.18));

    // Very dark room — minimal geometry, maximum atmosphere
    // Heavy door frame at entrance
    const doorFrame = BABYLON.MeshBuilder.CreateBox('walkInFrame', {
      width: 2.5, height: 3, depth: 0.3
    }, this.scene);
    doorFrame.position = new BABYLON.Vector3(0, 1.5, -3.3);
    doorFrame.material = this.materials.metal();
    doorFrame.parent = root;

    const eyes = this._addJudgeEyes(root, 5, { x: 3.5, z: 6 });
    return {
      root, roomLength: 7,
      scares: [
        { type: 'heavy', trigger: 'enter', delay: 1000, sound: 'doorSlam' },
        { type: 'jumpscare', trigger: 'middle', delay: 3000, sound: 'jumpscareHit' }
      ],
      hasSideRoom: false, eyes
    };
  }

  // ─── ROOM 11: The Dumbwaiter ───
  _room11_dumbwaiter() {
    const { root } = this._createRoomShell('dumbwaiter', 3, 4, 6,
      new BABYLON.Color3(0.25, 0.25, 0.28));

    // Vertical shaft feeling — narrow and tall
    // Cable meshes
    for (let i = 0; i < 3; i++) {
      const cable = BABYLON.MeshBuilder.CreateCylinder(`cable_${i}`, {
        diameter: 0.03, height: 4, tessellation: 6
      }, this.scene);
      cable.position = new BABYLON.Vector3(-0.8 + i * 0.8, 2, 1);
      cable.material = this.materials.metal();
      cable.parent = root;
    }

    // Dumbwaiter box
    const box = BABYLON.MeshBuilder.CreateBox('dumbwaiterBox', {
      width: 1.2, height: 1.2, depth: 1.2
    }, this.scene);
    box.position = new BABYLON.Vector3(0, 2.5, 1);
    box.material = this.materials.metal();
    box.parent = root;

    const eyes = this._addJudgeEyes(root, 5, { x: 2.5, z: 5 });
    return {
      root, roomLength: 6,
      scares: [{ type: 'heavy', trigger: 'position', z: 2, sound: 'metalCreak' }],
      hasSideRoom: false, eyes
    };
  }
```

- [ ] **Step 3: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/horror-maze/rooms.js
git commit -m "feat: add rooms 6-11 (sink, dishes, oven, spice, walk-in, dumbwaiter)"
```

---

### Task 6: RoomBuilder — rooms 12-14 + side rooms + export

**Files:**
- Modify: `v1.2/public/js/babylon-game/shared/horror-maze/rooms.js`

- [ ] **Step 1: Add rooms 12-14 (chase corridor, judge corridor, judge chamber)**

```javascript
  // ─── ROOM 12: The Chase ───
  _room12_chase() {
    const { root } = this._createRoomShell('chase', 4, 3.5, 30,
      new BABYLON.Color3(0.2, 0.18, 0.22));

    // Long corridor with obstacles
    const obstacles = [];
    for (let z = 0; z < 25; z += 3.5) {
      const type = Math.random() > 0.5 ? 'shelf' : 'pipe';
      const side = Math.random() > 0.5 ? 1 : -1;

      if (type === 'shelf') {
        const shelf = BABYLON.MeshBuilder.CreateBox(`chaseObs_${z}`, {
          width: 1.8, height: 1.5, depth: 0.4
        }, this.scene);
        shelf.position = new BABYLON.Vector3(side * 0.8, 0.75, z);
        shelf.material = this.materials.wood();
        shelf.parent = root;
        obstacles.push({ mesh: shelf, z, dodgeDir: side > 0 ? 'left' : 'right' });
      } else {
        const pipe = BABYLON.MeshBuilder.CreateCylinder(`chasePipe_${z}`, {
          diameter: 0.15, height: 4, tessellation: 8
        }, this.scene);
        pipe.rotation.z = Math.PI / 2;
        pipe.position = new BABYLON.Vector3(0, 1.5, z);
        pipe.material = this.materials.metal();
        pipe.parent = root;
        obstacles.push({ mesh: pipe, z, dodgeDir: 'duck' });
      }
    }

    const eyes = this._addJudgeEyes(root, 6, { x: 3.5, z: 28 });
    return {
      root, roomLength: 30, isChase: true,
      scares: [], // Chase handles its own QTEs via ChaseController
      obstacles,
      hasSideRoom: false, eyes
    };
  }

  // ─── ROOM 13: Judge's Corridor ───
  _room13_judgeCorridor() {
    const { root } = this._createRoomShell('judgeCorridor', 4, 4, 10,
      new BABYLON.Color3(0.3, 0.1, 0.2));

    // Pulsing wall effect done via emissive materials
    const wallGlow = new BABYLON.StandardMaterial('judgeWallGlow', this.scene);
    wallGlow.emissiveColor = new BABYLON.Color3(0.3, 0.05, 0.1);
    wallGlow.diffuseColor = new BABYLON.Color3(0.15, 0.05, 0.1);

    // Add glowing panels along walls
    for (let z = -4; z <= 4; z += 1.5) {
      for (let side = -1; side <= 1; side += 2) {
        const panel = BABYLON.MeshBuilder.CreateBox(`judgePanel_${z}_${side}`, {
          width: 0.05, height: 1.5, depth: 1
        }, this.scene);
        panel.position = new BABYLON.Vector3(side * 1.9, 2, z);
        panel.material = wallGlow;
        panel.parent = root;
      }
    }

    // Many judge eyes
    const eyes = this._addJudgeEyes(root, 9, { x: 3.5, z: 9 });
    return {
      root, roomLength: 10,
      scares: [], // Pure atmosphere — no QTEs
      hasSideRoom: false, eyes
    };
  }

  // ─── ROOM 14: Judge's Chamber ───
  _room14_judgeChamber() {
    const { root } = this._createRoomShell('judgeChamber', 8, 5, 10,
      new BABYLON.Color3(0.25, 0.08, 0.12));

    // Three thrones
    const thronePositions = [
      new BABYLON.Vector3(-2.5, 0, 3),
      new BABYLON.Vector3(0, 0, 4),
      new BABYLON.Vector3(2.5, 0, 3)
    ];
    thronePositions.forEach((pos, i) => {
      const throne = BABYLON.MeshBuilder.CreateBox(`throne_${i}`, {
        width: 1.5, height: 3, depth: 1
      }, this.scene);
      throne.position = pos.add(new BABYLON.Vector3(0, 1.5, 0));
      const throneMat = new BABYLON.StandardMaterial(`throneMat_${i}`, this.scene);
      throneMat.diffuseColor = new BABYLON.Color3(0.15, 0.05, 0.08);
      throneMat.emissiveColor = new BABYLON.Color3(0.1, 0.02, 0.05);
      throne.material = throneMat;
      throne.parent = root;
    });

    // Cake pedestal
    const pedestal = BABYLON.MeshBuilder.CreateCylinder('pedestal', {
      diameter: 1, height: 1.2, tessellation: 20
    }, this.scene);
    pedestal.position = new BABYLON.Vector3(0, 0.6, 0);
    pedestal.material = this.materials.marble();
    pedestal.parent = root;

    // Candle placeholders
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const candle = BABYLON.MeshBuilder.CreateCylinder(`candle_${i}`, {
        diameter: 0.06, height: 0.4, tessellation: 8
      }, this.scene);
      candle.position = new BABYLON.Vector3(
        Math.cos(angle) * 3.5, 0.2, Math.sin(angle) * 3.5 + 2
      );
      candle.material = this.materials.food(new BABYLON.Color3(0.9, 0.85, 0.7));
      candle.parent = root;
    }

    const eyes = this._addJudgeEyes(root, 10, { x: 7, z: 9 });
    return {
      root, roomLength: 10, isJudgeChamber: true,
      scares: [],
      thronePositions,
      pedestal,
      hasSideRoom: false, eyes
    };
  }
```

- [ ] **Step 2: Add side room builder and dispose method, close class**

```javascript
  buildSideRoom(parentRoom, index) {
    const root = new BABYLON.TransformNode(`sideRoom_${index}`, this.scene);

    const { floor } = this._createRoomShell(`side_${index}`, 3, 3, 4,
      new BABYLON.Color3(0.2, 0.2, 0.25));
    floor.parent = root;

    // Random creepy item
    const item = BABYLON.MeshBuilder.CreateBox(`sideItem_${index}`, {
      width: 0.5, height: 0.8, depth: 0.5
    }, this.scene);
    item.position = new BABYLON.Vector3(0, 0.4, 1);
    item.material = this.materials.food(new BABYLON.Color3(0.5, 0.2, 0.3));
    item.parent = root;

    const eyes = this._addJudgeEyes(root, 3, { x: 2.5, z: 3.5 });
    return {
      root, roomLength: 4,
      scares: [{ type: 'light', trigger: 'enter', delay: 1500, sound: 'whisper' }],
      eyes
    };
  }

  disposeRoom(roomData) {
    if (roomData && roomData.root) {
      roomData.root.dispose(false, true);
    }
  }
}

window.RoomBuilder = RoomBuilder;
```

- [ ] **Step 3: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/horror-maze/rooms.js
git commit -m "feat: add rooms 12-14 (chase, judge corridor, chamber) + side rooms"
```

---

### Task 7: Create ChaseController

**Files:**
- Create: `v1.2/public/js/babylon-game/shared/horror-maze/chase-controller.js`

State machine for the Room 12 chase sequence.

- [ ] **Step 1: Create chase-controller.js**

```javascript
// Evil Jeopardy 1.2 — Chase Controller (Room 12 state machine)
// Manages the auto-sprint chase sequence with QTE obstacles.

class ChaseController {
  constructor(scene, camera, hudTexture, scareSystem, sounds) {
    this.scene = scene;
    this.camera = camera;
    this.hudTexture = hudTexture;
    this.scareSystem = scareSystem;
    this.sounds = sounds;
    this._disposed = false;

    this.state = 'IDLE'; // IDLE, START, RUNNING, CAUGHT, ESCAPE
    this.failCount = 0;
    this.qteCount = 0;
    this.maxQTEs = 7;
    this.caught = false;
    this.elapsed = 0;
    this.speed = 8; // units per second
    this.steerX = 0;
    this.corridorLength = 30;
    this.playerZ = 0;

    this._qteInterval = null;
    this._steerHandler = null;
    this._entityDistance = 5; // distance behind player (visual only)

    this._buildChaseHUD();
  }

  _buildChaseHUD() {
    this.runLabel = new BABYLON.GUI.TextBlock('runLabel', '');
    this.runLabel.color = '#ff4444';
    this.runLabel.fontSize = 56;
    this.runLabel.fontWeight = 'bold';
    this.runLabel.outlineWidth = 4;
    this.runLabel.outlineColor = '#000000';
    this.runLabel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.runLabel.top = '100px';
    this.runLabel.isVisible = false;
    this.hudTexture.addControl(this.runLabel);
  }

  start(onComplete) {
    this.onComplete = onComplete;
    this.state = 'START';
    this.elapsed = 0;
    this.playerZ = 0;

    // Cinematic reveal (2s)
    this.runLabel.text = '⚠️ SOMETHING IS BEHIND YOU';
    this.runLabel.isVisible = true;
    if (this.sounds) this.sounds.entityRoar();

    setTimeout(() => {
      if (this._disposed) return;
      this.runLabel.text = '🏃 RUN!!!';
      if (this.sounds) this.sounds.chaseMusic();
      this.state = 'RUNNING';
      this._bindSteering();
      this._startQTESequence();

      setTimeout(() => {
        this.runLabel.isVisible = false;
      }, 1500);
    }, 2000);
  }

  _bindSteering() {
    this._steerHandler = (e) => {
      if (this._disposed || this.state !== 'RUNNING') return;
      if (e.key === 'a' || e.key === 'A') this.steerX = -1;
      else if (e.key === 'd' || e.key === 'D') this.steerX = 1;
    };
    const steerRelease = (e) => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D') {
        this.steerX = 0;
      }
    };
    window.addEventListener('keydown', this._steerHandler);
    window.addEventListener('keyup', steerRelease);
    this._steerRelease = steerRelease;
  }

  _startQTESequence() {
    // Resume from current progress — do NOT reset qteIndex
    this._qteInterval = setInterval(() => {
      if (this._disposed || this.state !== 'RUNNING') {
        clearInterval(this._qteInterval);
        return;
      }
      if (this.qteCount >= this.maxQTEs) {
        clearInterval(this._qteInterval);
        this._escape();
        return;
      }

      this.scareSystem.triggerQTE('medium', 12, (success) => {
        if (!success) {
          this.failCount++;
          this._entityDistance -= 1;
          // Stumble effect
          this.speed = 4;
          setTimeout(() => { this.speed = 8; }, 500);

          if (this.failCount >= 3 && !this.caught) {
            this._catch();
          }
        } else {
          this._entityDistance = Math.min(5, this._entityDistance + 0.5);
        }
      });
      this.qteCount++;
    }, 3500);
  }

  _catch() {
    this.caught = true;
    this.state = 'CAUGHT';
    clearInterval(this._qteInterval);

    // Big jumpscare
    this.runLabel.text = '💀 CAUGHT!';
    this.runLabel.isVisible = true;
    if (this.sounds) this.sounds.jumpscareHit();
    this.scareSystem.applyDirectDamage(15);

    // Resume after 1.5s
    setTimeout(() => {
      if (this._disposed) return;
      this.runLabel.isVisible = false;
      this.state = 'RUNNING';
      this._entityDistance = 3;
      // Resume QTEs for remaining
      this._startQTESequence();
    }, 1500);
  }

  _escape() {
    this.state = 'ESCAPE';
    clearInterval(this._qteInterval);

    this.runLabel.text = '🚪 SAFE!';
    this.runLabel.isVisible = true;
    if (this.sounds) this.sounds.doorSlam();

    setTimeout(() => {
      if (this._disposed) return;
      this.runLabel.isVisible = false;
      if (this.onComplete) this.onComplete();
    }, 2000);
  }

  update(dt) {
    if (this._disposed) return;
    if (this.state !== 'RUNNING') return;

    this.elapsed += dt;
    this.playerZ += this.speed * dt;

    // Steer
    if (this.camera) {
      this.camera.position.x += this.steerX * 3 * dt;
      this.camera.position.x = BABYLON.Scalar.Clamp(this.camera.position.x, -1.5, 1.5);
      this.camera.position.z = this.playerZ;
    }

    // Camera shake during chase
    if (this.camera) {
      this.camera.position.y += (Math.random() - 0.5) * 0.02;
    }

    // Auto-escape if past corridor
    if (this.playerZ >= this.corridorLength) {
      this._escape();
    }
  }

  dispose() {
    this._disposed = true;
    clearInterval(this._qteInterval);
    if (this._steerHandler) window.removeEventListener('keydown', this._steerHandler);
    if (this._steerRelease) window.removeEventListener('keyup', this._steerRelease);
    this.hudTexture.removeControl(this.runLabel);
    this.runLabel.dispose();
  }
}

window.ChaseController = ChaseController;
```

- [ ] **Step 2: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/horror-maze/chase-controller.js
git commit -m "feat: add ChaseController with state machine and QTE sequence"
```

---

### Task 8: Create JudgePresentation

**Files:**
- Create: `v1.2/public/js/babylon-game/shared/horror-maze/judge-presentation.js`

Handles the final room reveal, verdict text, and score calculation.

- [ ] **Step 1: Create judge-presentation.js**

```javascript
// Evil Jeopardy 1.2 — Judge Presentation (Room 14 finale)
// Handles judge reveal, cake examination, verdict text, and final scoring.

class JudgePresentation {
  constructor(scene, hudTexture, cakeHealth, sounds) {
    this.scene = scene;
    this.hudTexture = hudTexture;
    this.cakeHealth = cakeHealth;
    this.sounds = sounds;
    this._disposed = false;
    this.state = 'IDLE'; // IDLE, ENTRY, REVEAL, EXAMINE, VERDICT, DONE
    this.bonusRooms = 0;
  }

  setBonusRooms(count) {
    this.bonusRooms = count;
  }

  start(roomData, onComplete) {
    this.onComplete = onComplete;
    this.roomData = roomData;
    this.state = 'ENTRY';

    // Step 1: Door slam
    if (this.sounds) this.sounds.doorSlam();
    this._showText('The doors seal behind you...', 2000);

    setTimeout(() => {
      if (this._disposed) return;
      this._reveal();
    }, 2500);
  }

  _reveal() {
    this.state = 'REVEAL';
    this._showText('', 0); // clear

    // Candles ignite one by one (just show message)
    if (this.sounds) {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          if (!this._disposed && this.sounds) this.sounds.ambientDrip();
        }, i * 400);
      }
    }

    this._showText('🕯️ Candles ignite...', 2000);

    setTimeout(() => {
      if (this._disposed) return;
      this._showText('👹 THE JUDGES REVEAL THEMSELVES', 2500);
      if (this.sounds) this.sounds.entityRoar();

      setTimeout(() => {
        if (this._disposed) return;
        this._examine();
      }, 3000);
    }, 2500);
  }

  _examine() {
    this.state = 'EXAMINE';
    this._showText('The judges examine your cake...', 2500);

    if (this.sounds) this.sounds.heartbeat(0.8);

    setTimeout(() => {
      if (this._disposed) return;
      this._verdict();
    }, 3000);
  }

  _verdict() {
    this.state = 'VERDICT';
    const integrity = this.cakeHealth.getIntegrity();
    const baseScore = Math.floor(integrity * 85 / 100);
    const bonus = this.bonusRooms * 5;
    const finalScore = Math.min(100, baseScore + bonus);

    let verdictLines;
    if (finalScore >= 80) {
      verdictLines = [
        'BELPHEGOR: "...the mortal has skills."',
        'MOLOCH: "*grudging nod*"',
        'ASMODEUS: "ACCEPTABLE. YOU MAY LIVE."'
      ];
      if (this.sounds) this.sounds.gavelSmash();
    } else if (finalScore >= 50) {
      verdictLines = [
        'BELPHEGOR: "It\'s... edible. Barely."',
        'MOLOCH: "*SMASHES GAVEL* MEDIOCRE!"',
        'ASMODEUS: "I\'ve seen worse. In the ninth circle."'
      ];
      if (this.sounds) this.sounds.gavelSmash();
    } else {
      verdictLines = [
        'BELPHEGOR: "*maniacal laughter*"',
        'MOLOCH: "THIS IS AN ABOMINATION!"',
        'ASMODEUS: "Even Hell has standards."'
      ];
      if (this.sounds) this.sounds.jumpscareHit();
    }

    // Show verdict lines sequentially
    let delay = 0;
    verdictLines.forEach((line, i) => {
      setTimeout(() => {
        if (this._disposed) return;
        this._showText(line, 2500);
      }, delay);
      delay += 2800;
    });

    // Final score reveal
    setTimeout(() => {
      if (this._disposed) return;
      this._showText(`📊 FINAL SCORE: ${finalScore}`, 3000);
      if (this.sounds) {
        if (finalScore >= 70) this.sounds.phaseComplete();
        else this.sounds.miss();
      }

      this.state = 'DONE';
      setTimeout(() => {
        if (this._disposed) return;
        if (this.onComplete) this.onComplete(finalScore, {
          integrity,
          bonusRooms: this.bonusRooms,
          verdict: finalScore >= 80 ? 'high' : finalScore >= 50 ? 'medium' : 'low'
        });
      }, 3500);
    }, delay + 500);
  }

  _showText(text, duration) {
    if (this._currentMsg) {
      this.hudTexture.removeControl(this._currentMsg);
      this._currentMsg.dispose();
      this._currentMsg = null;
    }
    if (!text) return;

    this._currentMsg = new BABYLON.GUI.TextBlock('judgeMsg', text);
    this._currentMsg.color = '#ffddaa';
    this._currentMsg.fontSize = 28;
    this._currentMsg.fontWeight = 'bold';
    this._currentMsg.outlineWidth = 3;
    this._currentMsg.outlineColor = '#000000';
    this._currentMsg.textWrapping = true;
    this._currentMsg.width = '600px';
    this.hudTexture.addControl(this._currentMsg);

    if (duration > 0) {
      setTimeout(() => {
        if (this._currentMsg && !this._disposed) {
          this.hudTexture.removeControl(this._currentMsg);
          this._currentMsg.dispose();
          this._currentMsg = null;
        }
      }, duration);
    }
  }

  dispose() {
    this._disposed = true;
    if (this._currentMsg) {
      this.hudTexture.removeControl(this._currentMsg);
      this._currentMsg.dispose();
    }
  }
}

window.JudgePresentation = JudgePresentation;
```

- [ ] **Step 2: Commit**

```bash
git add v1.2/public/js/babylon-game/shared/horror-maze/judge-presentation.js
git commit -m "feat: add JudgePresentation class with verdict and scoring"
```

---

### Task 9: Rewrite PresentScene3D — FPS maze orchestrator

**Files:**
- Rewrite: `v1.2/public/js/babylon-game/scenes/PresentScene3D.js`

The main scene that ties everything together: FPS camera, room transitions, scare triggering, fog, and lifecycle.

- [ ] **Step 1: Rewrite PresentScene3D.js with the full orchestrator**

```javascript
// Evil Jeopardy 1.2 — PresentScene3D (Horror Maze)
// First-person horror maze: 14 rooms, QTE dodging, chase scene, demonic judges.

class PresentScene3D extends BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options) {
    super(engine, canvas, socketBridge, options);
    this.timeLimit = 240; // 4 minutes

    this.camera = null;
    this.currentRoomIndex = -1;
    this.currentRoomData = null;
    this.roomBuilder = null;
    this.scareSystem = null;
    this.chaseController = null;
    this.judgePresentation = null;
    this.cakeHealth = null;

    this.playerZ = 0;
    this.playerSpeed = 3.5;
    this.roomOffset = 0; // cumulative Z offset
    this.headBobPhase = 0;
    this.isMoving = false;
    this.moveInput = { w: false, a: false, s: false, d: false };
    this.bonusRoomsCleared = 0;
    this.inSideRoom = false;
    this.sideRoomDamageTaken = false;

    this._droneInterval = null;
    this._heartbeatInterval = null;
    this._dripInterval = null;
    this._previousRoomData = null;
    this._footstepCooldown = false;
    this._activeSideRoom = null;
    this._visitedSideRooms = new Set();
    this._droneHandle = null;
    this._chaseMusicHandle = null;
  }

  getPhaseName() { return 'PRESENT'; }

  async create() {
    // Suppress default kitchen ambient
    if (this.sounds) this.sounds.stopAmbient();

    // FPS Camera
    this.camera = new BABYLON.UniversalCamera('fpsCam',
      new BABYLON.Vector3(0, 1.7, 0), this.scene);
    this.camera.minZ = 0.1;
    this.camera.attachControl(this.canvas, true);
    this.camera.speed = 0;
    this.camera.angularSensibility = 3000;
    // Lock vertical look range
    this.camera.rotation.x = 0;
    this.scene.activeCamera = this.camera;

    // Fog
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.04;
    this.scene.fogColor = new BABYLON.Color3(0.02, 0.02, 0.04);
    this.scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.04, 1);

    // Dim lighting
    const ambient = new BABYLON.HemisphericLight('horrorAmbient',
      new BABYLON.Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.15;
    ambient.diffuse = new BABYLON.Color3(0.4, 0.3, 0.35);

    // Point light follows player
    this.playerLight = new BABYLON.PointLight('playerLight',
      new BABYLON.Vector3(0, 2, 0), this.scene);
    this.playerLight.intensity = 0.6;
    this.playerLight.range = 6;
    this.playerLight.diffuse = new BABYLON.Color3(0.9, 0.7, 0.5);

    // Initialize systems
    this.roomBuilder = new RoomBuilder(this.scene, this.materials);
    this.cakeHealth = new CakeHealthDisplay(this.scene, this.hud.texture);
    this.scareSystem = new ScareSystem(this.scene, this.hud.texture, this.cakeHealth, this.sounds);

    // Bind movement keys
    this._bindMovement();

    // Start ambient horror audio
    this._startHorrorAmbient();

    // Load first room
    this._enterRoom(0);

    this.hud.showMessage('🏚️ Carry the cake through... alive.', 3000);
  }

  _bindMovement() {
    this._moveDown = (e) => {
      if (this._disposed) return;
      const k = e.key.toLowerCase();
      if (this.moveInput.hasOwnProperty(k)) this.moveInput[k] = true;
    };
    this._moveUp = (e) => {
      if (this._disposed) return;
      const k = e.key.toLowerCase();
      if (this.moveInput.hasOwnProperty(k)) this.moveInput[k] = false;
    };
    this._interactHandler = (e) => {
      if (this._disposed) return;
      if (e.key.toLowerCase() === 'e') this._tryInteract();
    };
    window.addEventListener('keydown', this._moveDown);
    window.addEventListener('keyup', this._moveUp);
    window.addEventListener('keydown', this._interactHandler);
  }

  _startHorrorAmbient() {
    // Start loopable drone (returns handle with stop())
    if (this.sounds && this.sounds.horrorDroneLoop) {
      this._droneHandle = this.sounds.horrorDroneLoop();
    }

    // Random drips
    this._dripInterval = setInterval(() => {
      if (!this._disposed && this.sounds && Math.random() > 0.5) {
        this.sounds.ambientDrip();
      }
    }, 3000);
  }

  _enterRoom(index) {
    // Dispose previous room (keep one behind for transition)
    if (this._previousRoomData) {
      this.roomBuilder.disposeRoom(this._previousRoomData);
      this._previousRoomData = null;
    }

    if (this.currentRoomData) {
      this._previousRoomData = this.currentRoomData;
    }

    this.currentRoomIndex = index;

    if (index >= 14) {
      // All rooms done — shouldn't happen; judge handles completion
      return;
    }

    const roomData = this.roomBuilder.buildRoom(index);
    if (!roomData) return;

    // Position room at cumulative offset
    roomData.root.position.z = this.roomOffset;
    this.currentRoomData = roomData;

    // Increase fog density as we progress
    this.scene.fogDensity = 0.03 + (index * 0.003);

    // Schedule scares based on room config
    this._scheduleRoomScares(roomData, index);

    // Handle special rooms
    if (roomData.isChase) {
      this._startChase(roomData);
    } else if (roomData.isJudgeChamber) {
      this._startJudgePresentation(roomData);
    }
  }

  _scheduleRoomScares(roomData, roomIndex) {
    if (!roomData.scares || roomData.scares.length === 0) return;

    roomData.scares.forEach(scare => {
      if (scare.trigger === 'enter') {
        setTimeout(() => {
          if (this._disposed || this.currentRoomIndex !== roomIndex) return;
          this._triggerScare(scare, roomIndex);
        }, scare.delay || 1000);
      }
      // Position-based scares are checked in update()
    });
  }

  _triggerScare(scare, roomIndex) {
    if (scare.type === 'jumpscare') {
      this._showJumpscare();
      return;
    }
    if (scare.sound && this.sounds && this.sounds[scare.sound]) {
      this.sounds[scare.sound]();
    }
    if (scare.type !== 'ambient') {
      this.scareSystem.triggerQTE(scare.type, roomIndex, (success) => {
        if (!success && this.inSideRoom) {
          this.sideRoomDamageTaken = true;
        }
      });
    }
  }

  _showJumpscare() {
    if (this.sounds) this.sounds.jumpscareHit();

    // Full-screen red flash
    const flash = new BABYLON.GUI.Rectangle('jumpscare');
    flash.width = '100%';
    flash.height = '100%';
    flash.background = 'rgba(180, 0, 0, 0.7)';
    flash.thickness = 0;
    flash.isHitTestVisible = false;
    this.hud.texture.addControl(flash);

    // Try to show a jumpscare PNG (if assets exist), otherwise fall back to emoji
    const jumpscareImages = [
      '/assets/jumpscares/face1.png',
      '/assets/jumpscares/face2.png',
      '/assets/jumpscares/face3.png'
    ];
    const imgSrc = jumpscareImages[Math.floor(Math.random() * jumpscareImages.length)];
    const img = new BABYLON.GUI.Image('scareImg', imgSrc);
    img.width = '512px';
    img.height = '512px';
    img.stretch = BABYLON.GUI.Image.STRETCH_UNIFORM;
    img.isHitTestVisible = false;
    this.hud.texture.addControl(img);
    // If image fails to load, show emoji fallback
    img.onImageLoadedObservable.addOnce(() => {});
    img.domImage.onerror = () => {
      this.hud.texture.removeControl(img);
      img.dispose();
      const text = new BABYLON.GUI.TextBlock('scareFallback', '👹');
      text.fontSize = 200;
      text.isHitTestVisible = false;
      this.hud.texture.addControl(text);
      setTimeout(() => {
        this.hud.texture.removeControl(text);
        text.dispose();
      }, 300);
    };

    setTimeout(() => {
      this.hud.texture.removeControl(flash);
      this.hud.texture.removeControl(img);
      flash.dispose();
      img.dispose();
    }, 300);
  }

  _startChase(roomData) {
    // Disable normal movement during chase
    this._chaseActive = true;
    // Stop ambient drone, start chase music loop
    if (this._droneHandle) { this._droneHandle.stop(); this._droneHandle = null; }
    if (this.sounds && this.sounds.chaseMusicLoop) {
      this._chaseMusicHandle = this.sounds.chaseMusicLoop();
    }
    this.chaseController = new ChaseController(
      this.scene, this.camera, this.hud.texture, this.scareSystem, this.sounds
    );
    this.chaseController.start(() => {
      this._chaseActive = false;
      // Stop chase music, resume ambient
      if (this._chaseMusicHandle) { this._chaseMusicHandle.stop(); this._chaseMusicHandle = null; }
      if (this.sounds && this.sounds.horrorDroneLoop) {
        this._droneHandle = this.sounds.horrorDroneLoop();
      }
      this.chaseController.dispose();
      this.chaseController = null;
      // Move to next room
      this.roomOffset += roomData.roomLength + 2;
      this._enterRoom(this.currentRoomIndex + 1);
    });
  }

  _startJudgePresentation(roomData) {
    this._judgeActive = true;
    this.judgePresentation = new JudgePresentation(
      this.scene, this.hud.texture, this.cakeHealth, this.sounds
    );
    this.judgePresentation.setBonusRooms(this.bonusRoomsCleared);
    this.judgePresentation.start(roomData, (finalScore, details) => {
      this._judgeActive = false;
      this.setScore(finalScore);
      this.completePhase(details);
    });
  }

  _tryInteract() {
    // Check if near a side room door (within 2m of side-room trigger point)
    if (this.currentRoomData && this.currentRoomData.hasSideRoom && !this.inSideRoom) {
      const localZ = this.camera.position.z - this.roomOffset;
      const midZ = this.currentRoomData.roomLength * 0.5;
      if (Math.abs(localZ - midZ) > 2.5) {
        this.hud.showMessage('🚪 Get closer to the side door (E)', 1000);
        return;
      }
      // Already visited this side room?
      if (this._visitedSideRooms && this._visitedSideRooms.has(this.currentRoomIndex)) {
        this.hud.showMessage('Already explored this room', 1000);
        return;
      }

      this.inSideRoom = true;
      this.sideRoomDamageTaken = false;
      if (this.sounds) this.sounds.doorSlam();

      // Spawn actual side room geometry to the right of the main corridor
      this._activeSideRoom = this.roomBuilder.buildSideRoom(this.currentRoomData, this.currentRoomIndex);
      if (this._activeSideRoom) {
        this._activeSideRoom.root.position = new BABYLON.Vector3(
          4, 0, this.roomOffset + midZ
        );
        // Schedule side room scare
        if (this._activeSideRoom.scares) {
          this._activeSideRoom.scares.forEach(scare => {
            setTimeout(() => {
              if (!this._disposed && this.inSideRoom) {
                this._triggerScare(scare, this.currentRoomIndex);
              }
            }, scare.delay || 1500);
          });
        }
      }

      this.hud.showMessage('🚪 Entered side room... press E to exit', 2000);
    } else if (this.inSideRoom) {
      // Exit side room
      this.inSideRoom = false;
      if (this.sounds) this.sounds.doorSlam();

      // Track visit
      if (!this._visitedSideRooms) this._visitedSideRooms = new Set();
      this._visitedSideRooms.add(this.currentRoomIndex);

      // Dispose side room geometry
      if (this._activeSideRoom) {
        this.roomBuilder.disposeRoom(this._activeSideRoom);
        this._activeSideRoom = null;
      }

      if (!this.sideRoomDamageTaken) {
        this.bonusRoomsCleared++;
        this.hud.showMessage('✨ +5 Bonus! Side room cleared!', 1500);
      } else {
        this.hud.showMessage('Side room cleared (took damage — no bonus)', 1500);
      }
    }
  }

  update(dt) {
    if (this.isComplete || this._judgeActive) return;

    // Chase has its own update
    if (this._chaseActive && this.chaseController) {
      this.chaseController.update(dt);
      return;
    }

    // Player movement
    let moveZ = 0, moveX = 0;
    if (this.moveInput.w) moveZ = 1;
    if (this.moveInput.s) moveZ = -0.3;
    if (this.moveInput.a) moveX = -1;
    if (this.moveInput.d) moveX = 1;

    this.isMoving = (moveZ !== 0 || moveX !== 0);

    if (this.isMoving) {
      const forward = this.camera.getForwardRay().direction;
      forward.y = 0;
      forward.normalize();
      const right = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), forward).normalize();

      this.camera.position.addInPlace(forward.scale(moveZ * this.playerSpeed * dt));
      this.camera.position.addInPlace(right.scale(moveX * this.playerSpeed * dt));

      // Clamp X to corridor width
      this.camera.position.x = BABYLON.Scalar.Clamp(this.camera.position.x, -2, 2);

      // Head bob
      this.headBobPhase += dt * 8;
      this.camera.position.y = 1.7 + Math.sin(this.headBobPhase) * 0.04;

      // Footstep sounds
      if (!this._footstepCooldown && this.sounds) {
        this._footstepCooldown = true;
        this.sounds.footstep();
        setTimeout(() => { this._footstepCooldown = false; }, 400);
      }
    } else {
      this.camera.position.y = 1.7;
    }

    // Player light follows camera
    if (this.playerLight) {
      this.playerLight.position.copyFrom(this.camera.position);
    }

    // Check position-based scares
    if (this.currentRoomData && this.currentRoomData.scares) {
      const localZ = this.camera.position.z - this.roomOffset;
      this.currentRoomData.scares.forEach(scare => {
        if (scare.trigger === 'position' && !scare._triggered) {
          if (localZ >= scare.z) {
            scare._triggered = true;
            this._triggerScare(scare, this.currentRoomIndex);
          }
        } else if (scare.trigger === 'middle' && !scare._triggered) {
          if (localZ >= this.currentRoomData.roomLength * 0.5) {
            scare._triggered = true;
            setTimeout(() => {
              if (!this._disposed) this._triggerScare(scare, this.currentRoomIndex);
            }, scare.delay || 0);
          }
        }
      });
    }

    // Check room transition
    if (this.currentRoomData) {
      const localZ = this.camera.position.z - this.roomOffset;
      if (localZ >= this.currentRoomData.roomLength - 1) {
        this.roomOffset += this.currentRoomData.roomLength + 2;
        this._enterRoom(this.currentRoomIndex + 1);
      }
    }

    // Eye tracking (subtle)
    if (this.currentRoomData && this.currentRoomData.eyes) {
      this.currentRoomData.eyes.forEach(eyePair => {
        if (eyePair && !eyePair.isDisposed()) {
          eyePair.lookAt(this.camera.position, 0, 0, 0);
        }
      });
    }

    // Heartbeat ramps up in later rooms
    if (this.currentRoomIndex >= 9 && !this._heartbeatInterval) {
      this._heartbeatInterval = setInterval(() => {
        if (!this._disposed && this.sounds) {
          const rate = 1 + (this.currentRoomIndex - 9) * 0.3;
          this.sounds.heartbeat(rate);
        }
      }, 800);
    }
  }

  onTimeUp() {
    // Spec: lights-out + abbreviated chase (~10s) before judges
    if (this.sounds) this.sounds.entityRoar();
    this.scareSystem.applyDirectDamage(20);

    // Phase 1: Lights out (2s blackout)
    this.scene.fogDensity = 0.2; // near-total darkness
    if (this.playerLight) this.playerLight.intensity = 0.05;
    this.hud.showMessage('⏰ TIME UP! THE LIGHTS GO OUT!', 2000);

    setTimeout(() => {
      if (this._disposed) return;

      // Phase 2: Abbreviated chase (~10s) — auto-sprint toward judges
      this.hud.showMessage('🏃 SOMETHING IS COMING! RUN!', 1500);
      this._chaseActive = true;
      this._timeoutChaseElapsed = 0;
      const timeoutChaseDuration = 10; // seconds

      // Start chase music
      if (this.sounds) this.sounds.chaseMusic();

      // Auto-sprint toward judge room
      const chaseUpdate = () => {
        if (this._disposed || !this._chaseActive) return;
        this._timeoutChaseElapsed += 0.016;
        this.camera.position.z += 6 * 0.016; // auto-run speed

        // Camera shake
        this.camera.position.y = 1.7 + (Math.random() - 0.5) * 0.04;
        this.camera.position.x += (Math.random() - 0.5) * 0.02;

        // 2-3 QTE prompts during the abbreviated chase
        if (this._timeoutChaseElapsed > 3 && !this._tcQTE1) {
          this._tcQTE1 = true;
          this.scareSystem.triggerQTE('heavy', 11, () => {});
        }
        if (this._timeoutChaseElapsed > 6 && !this._tcQTE2) {
          this._tcQTE2 = true;
          this.scareSystem.triggerQTE('heavy', 11, () => {});
        }

        if (this._timeoutChaseElapsed >= timeoutChaseDuration) {
          this._chaseActive = false;
          // Transition to judges
          this.roomOffset = 0;
          this._enterRoom(13); // Judge chamber
          return;
        }
        requestAnimationFrame(chaseUpdate);
      };
      requestAnimationFrame(chaseUpdate);
    }, 2500);
  }

  dispose() {
    if (this._droneHandle) { this._droneHandle.stop(); this._droneHandle = null; }
    if (this._chaseMusicHandle) { this._chaseMusicHandle.stop(); this._chaseMusicHandle = null; }
    clearInterval(this._droneInterval);
    clearInterval(this._heartbeatInterval);
    clearInterval(this._dripInterval);
    if (this._moveDown) window.removeEventListener('keydown', this._moveDown);
    if (this._moveUp) window.removeEventListener('keyup', this._moveUp);
    if (this._interactHandler) window.removeEventListener('keydown', this._interactHandler);
    if (this.scareSystem) this.scareSystem.dispose();
    if (this.chaseController) this.chaseController.dispose();
    if (this.judgePresentation) this.judgePresentation.dispose();
    if (this.cakeHealth) this.cakeHealth.dispose();
    super.dispose();
  }
}

window.PresentScene3D = PresentScene3D;
```

- [ ] **Step 2: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes/PresentScene3D.js
git commit -m "feat: rewrite PresentScene3D as FPS horror maze orchestrator"
```

---

### Task 10: Wire script tags + create assets directory

**Files:**
- Modify: `v1.2/public/player.html`
- Create: `v1.2/public/assets/jumpscares/` (directory + placeholder)

- [ ] **Step 1: Add 5 new script tags to player.html**

After the `hand-controller.js` script tag (line 873), before `socket-bridge.js` (line 874), add:

```html
  <script src="/js/babylon-game/shared/horror-maze/cake-health.js"></script>
  <script src="/js/babylon-game/shared/horror-maze/scare-system.js"></script>
  <script src="/js/babylon-game/shared/horror-maze/rooms.js"></script>
  <script src="/js/babylon-game/shared/horror-maze/chase-controller.js"></script>
  <script src="/js/babylon-game/shared/horror-maze/judge-presentation.js"></script>
```

- [ ] **Step 2: Create jumpscares placeholder**

Create `v1.2/public/assets/jumpscares/README.md` with:
```
# Jumpscare Assets

Place comedy-horror face PNG files here. They display full-screen for 0.3s during certain scare events.

Required files:
- face1.png — Exaggerated demon face (comedy horror)
- face2.png — Creepy smile/eyes
- face3.png — Monster mouth

Specs: 512x512px, transparent background (PNG-24), exaggerated/silly horror faces.
The code falls back to an emoji (👹) if images are missing, so these are optional but recommended.
```

- [ ] **Step 3: Commit**

```bash
git add v1.2/public/player.html v1.2/public/assets/jumpscares/README.md
git commit -m "feat: wire horror maze script tags and create assets directory"
```

---

### Task 11: Browser test — full integration

**Files:** None (testing only)

- [ ] **Step 1: Start dev server, open player.html in browser**
- [ ] **Step 2: Join team, advance to PRESENT phase**
- [ ] **Step 3: Verify FPS camera loads with WASD movement**
- [ ] **Step 4: Verify Room 1 (pantry) renders with shelves and judge eyes**
- [ ] **Step 5: Verify walking forward transitions between rooms**
- [ ] **Step 6: Verify QTE prompts appear and respond to key presses**
- [ ] **Step 7: Verify cake health display updates on damage**
- [ ] **Step 8: Verify horror drone and footstep sounds play**
- [ ] **Step 9: Verify E key interaction (side rooms)**
- [ ] **Step 10: Check console for errors, fix any issues**

---

### Task 12: Browser test — chase + judges

**Files:** None (testing only)

- [ ] **Step 1: Progress to Room 12, verify chase sequence starts**
- [ ] **Step 2: Verify auto-sprint with A/D steering works**
- [ ] **Step 3: Verify QTEs during chase, fail handling**
- [ ] **Step 4: Verify chase escape transitions to Room 13**
- [ ] **Step 5: Verify Room 13 atmosphere (many eyes, pulsing walls)**
- [ ] **Step 6: Verify Room 14 judge presentation plays through**
- [ ] **Step 7: Verify verdict text and final score calculation**
- [ ] **Step 8: Verify phase completes and score reports correctly**
- [ ] **Step 9: Fix any issues found, commit fixes**

---

### Task 13: Polish — visual effects and audio tuning

**Files:**
- Modify: `v1.2/public/js/babylon-game/scenes/PresentScene3D.js`
- Modify: `v1.2/public/js/babylon-game/shared/horror-maze/rooms.js`

- [ ] **Step 1: Add light flickering effect to appropriate rooms**

In PresentScene3D's `update()`, add periodic light intensity variation:
```javascript
// Flicker in rooms 1, 4, 7, 10
if ([0, 3, 6, 9].includes(this.currentRoomIndex)) {
  if (Math.random() > 0.97) {
    this.playerLight.intensity = 0.1 + Math.random() * 0.5;
    setTimeout(() => { if (this.playerLight) this.playerLight.intensity = 0.6; }, 100);
  }
}
```

- [ ] **Step 2: Add room-specific particle effects**

Add dust particles to the scene that get denser as player progresses:
```javascript
_addDustParticles() {
  const dust = new BABYLON.ParticleSystem('dust', 50, this.scene);
  dust.emitter = this.camera;
  dust.minSize = 0.01;
  dust.maxSize = 0.03;
  dust.minLifeTime = 2;
  dust.maxLifeTime = 5;
  dust.emitRate = 10;
  dust.direction1 = new BABYLON.Vector3(-1, -0.5, -1);
  dust.direction2 = new BABYLON.Vector3(1, 0.5, 1);
  dust.color1 = new BABYLON.Color4(0.5, 0.5, 0.5, 0.3);
  dust.color2 = new BABYLON.Color4(0.3, 0.3, 0.3, 0.1);
  dust.createPointEmitter(new BABYLON.Vector3(-2, -1, -2), new BABYLON.Vector3(2, 1, 2));
  dust.start();
  this._dustParticles = dust;
}
```

- [ ] **Step 3: Add whisper sounds to rooms 10-13**

In `_enterRoom()`, for rooms 10+:
```javascript
if (index >= 9 && this.sounds) {
  this._whisperInterval = setInterval(() => {
    if (!this._disposed && this.sounds && Math.random() > 0.6) {
      this.sounds.whisper();
    }
  }, 4000);
}
```

- [ ] **Step 4: Commit**

```bash
git add v1.2/public/js/babylon-game/scenes/PresentScene3D.js v1.2/public/js/babylon-game/shared/horror-maze/rooms.js
git commit -m "feat: add visual polish (flickering, dust particles, whispers)"
```

---

### Task 14: Final integration test + cleanup

**Files:** None (testing only, except bug fixes)

- [ ] **Step 1: Full playthrough from Room 1 to judges, verify timing (under 4 min)**
- [ ] **Step 2: Verify timeout behavior (let timer expire mid-maze)**
- [ ] **Step 3: Verify scoring — perfect run should reach 100**
- [ ] **Step 4: Verify all side rooms grant +5 bonus correctly**
- [ ] **Step 5: Check memory — verify room disposal works (no leaked meshes)**
- [ ] **Step 6: Fix any remaining bugs**
- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "fix: final bug fixes for horror maze integration"
```
