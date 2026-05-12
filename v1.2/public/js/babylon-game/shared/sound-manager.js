// Evil Jeopardy 1.2 — Procedural Sound Manager (Web Audio API)
// Generates all game sounds procedurally — no external files needed.

class SoundManager {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._muted = false;
    this._volume = 0.5;
    this._ambientSources = [];
  }

  _ensureContext() {
    if (this._ctx && this._ctx.state !== 'closed') {
      if (this._ctx.state === 'suspended') {
        this._ctx.resume().catch(() => {});
      }
      return this._ctx;
    }
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._volume;
    this._masterGain.connect(this._ctx.destination);
    return this._ctx;
  }

  get ctx() { return this._ensureContext(); }
  get out() { return this._masterGain; }

  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this._masterGain) this._masterGain.gain.value = this._muted ? 0 : this._volume;
  }

  mute() {
    this._muted = true;
    if (this._masterGain) this._masterGain.gain.value = 0;
  }

  unmute() {
    this._muted = false;
    if (this._masterGain) this._masterGain.gain.value = this._volume;
  }

  // ─── CORE SOUND PRIMITIVES ───

  _tone(freq, duration, type = 'sine', gainVal = 0.3) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gainVal, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(this.out);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  _noise(duration, gainVal = 0.15) {
    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;

    source.connect(filter);
    filter.connect(g);
    g.connect(this.out);
    source.start(ctx.currentTime);
    return source;
  }

  // ─── GAME EVENT SOUNDS ───

  // Pouring liquid / powder into container
  pour() {
    this._noise(0.3, 0.08);
    this._tone(120, 0.2, 'sine', 0.05);
  }

  // Ingredient splats into bowl
  splat() {
    this._noise(0.15, 0.12);
    this._tone(85, 0.2, 'sine', 0.08);
    this._tone(60, 0.15, 'triangle', 0.06);
  }

  // Perfect accuracy hit
  perfect() {
    this._tone(523, 0.08, 'sine', 0.2);
    setTimeout(() => this._tone(659, 0.08, 'sine', 0.2), 80);
    setTimeout(() => this._tone(784, 0.15, 'sine', 0.25), 160);
  }

  // Good accuracy
  good() {
    this._tone(440, 0.1, 'sine', 0.2);
    setTimeout(() => this._tone(554, 0.12, 'sine', 0.2), 100);
  }

  // Miss / bad accuracy
  miss() {
    this._tone(200, 0.2, 'sawtooth', 0.1);
    this._tone(150, 0.25, 'sawtooth', 0.08);
  }

  // Score gained (generic positive feedback)
  scoreUp() {
    this._tone(660, 0.06, 'sine', 0.15);
    setTimeout(() => this._tone(880, 0.1, 'sine', 0.15), 60);
  }

  // Phase complete success jingle
  phaseComplete() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this._tone(freq, 0.15, 'sine', 0.2), i * 100);
    });
  }

  // Timer warning (last 10 seconds)
  timerWarning() {
    this._tone(800, 0.08, 'square', 0.1);
  }

  // Timer critical (last 5 seconds)
  timerCritical() {
    this._tone(900, 0.06, 'square', 0.15);
    setTimeout(() => this._tone(900, 0.06, 'square', 0.15), 120);
  }

  // Time's up
  timeUp() {
    this._tone(400, 0.3, 'sawtooth', 0.15);
    setTimeout(() => this._tone(300, 0.4, 'sawtooth', 0.12), 200);
  }

  // ─── MIXING SOUNDS ───

  // Whisk / stir action
  whisk() {
    this._noise(0.12, 0.06);
    this._tone(300 + Math.random() * 100, 0.08, 'sine', 0.04);
  }

  // Electric mixer running
  mixer() {
    this._tone(180, 0.3, 'sawtooth', 0.06);
    this._tone(360, 0.3, 'sawtooth', 0.03);
    this._noise(0.3, 0.04);
  }

  // ─── BAKING SOUNDS ───

  // Oven door open/close
  ovenDoor() {
    this._tone(150, 0.15, 'sine', 0.1);
    this._noise(0.1, 0.05);
  }

  // Oven sizzle / ambient
  sizzle() {
    this._noise(0.5, 0.04);
  }

  // Temperature adjust
  tempAdjust() {
    this._tone(440, 0.05, 'sine', 0.1);
    setTimeout(() => this._tone(550, 0.05, 'sine', 0.1), 60);
  }

  // ─── DECORATING SOUNDS ───

  // Place decoration
  placeItem() {
    this._tone(600, 0.06, 'sine', 0.12);
    this._noise(0.05, 0.04);
  }

  // Squeeze frosting
  frosting() {
    this._noise(0.2, 0.06);
    this._tone(200, 0.15, 'sine', 0.03);
  }

  // ─── ABSURD SCENE SOUNDS ───

  // Cow moo (CowCombat)
  moo() {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);
    osc.frequency.linearRampToValueAtTime(130, ctx.currentTime + 0.5);
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(g);
    g.connect(this.out);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  }

  // Rhythm beat hit (CowCombat udder squeeze)
  beatHit() {
    this._tone(300, 0.06, 'sine', 0.15);
    this._noise(0.04, 0.06);
  }

  // Rhythm beat miss
  beatMiss() {
    this._tone(150, 0.15, 'square', 0.08);
  }

  // Dodge success
  dodge() {
    this._tone(500, 0.05, 'sine', 0.12);
    setTimeout(() => this._tone(700, 0.08, 'sine', 0.12), 50);
  }

  // Cow attack / charge
  cowAttack() {
    this._tone(80, 0.4, 'sawtooth', 0.12);
    this._noise(0.3, 0.08);
  }

  hoofStomp() {
    this._ensureContext();
    this._tone(60, 0.12, 'sine', 0.12);
    this._noise(0.08, 0.08);
  }

  milkSquirt() {
    this._ensureContext();
    this._noise(0.08, 0.08);
    this._tone(400 + Math.random() * 200, 0.06, 'sine', 0.06);
  }

  angryMoo() {
    this._ensureContext();
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

  stampede() {
    this._ensureContext();
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this._tone(40 + Math.random() * 30, 0.15, 'sawtooth', 0.08);
        this._noise(0.1, 0.06);
      }, i * 150);
    }
  }

  // Stunned
  stunned() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this._tone(300 + i * 80, 0.1, 'sine', 0.08), i * 80);
    }
  }

  // Gravity flip (GravityFlip3D)
  gravityFlip() {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(g);
    g.connect(this.out);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  }

  // Jewel collect (JewelSort3D)
  jewelCollect() {
    this._tone(800 + Math.random() * 400, 0.08, 'sine', 0.12);
  }

  // Jewel wrong bin
  jewelWrong() {
    this._tone(200, 0.12, 'square', 0.08);
    this._tone(160, 0.15, 'square', 0.06);
  }

  // Racing engine rev
  engineRev() {
    this._tone(60, 0.2, 'sawtooth', 0.06);
    this._tone(120, 0.2, 'sawtooth', 0.04);
    this._noise(0.15, 0.03);
  }

  // Obstacle hit
  obstacleHit() {
    this._noise(0.15, 0.12);
    this._tone(100, 0.2, 'square', 0.1);
  }

  // ─── CHAOS EVENT SOUNDS ───

  chaosEvent() {
    this._tone(200, 0.1, 'sawtooth', 0.15);
    setTimeout(() => this._tone(250, 0.1, 'sawtooth', 0.15), 120);
    setTimeout(() => this._tone(180, 0.15, 'sawtooth', 0.12), 240);
    setTimeout(() => this._noise(0.2, 0.06), 300);
  }

  earthquakeRumble() {
    this._ensureContext();
    this._tone(30, 0.8, 'sawtooth', 0.10);
    this._noise(0.6, 0.08);
  }

  beeBuzz() {
    this._ensureContext();
    this._tone(220, 0.4, 'sawtooth', 0.04);
    this._tone(330, 0.3, 'sawtooth', 0.03);
  }

  shrinkSound() {
    this._ensureContext();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(g);
    g.connect(this.out);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  }

  // ─── UI SOUNDS ───

  click() {
    this._tone(800, 0.03, 'sine', 0.08);
  }

  hover() {
    this._tone(600, 0.02, 'sine', 0.04);
  }

  transition() {
    this._tone(400, 0.1, 'sine', 0.1);
    setTimeout(() => this._tone(600, 0.1, 'sine', 0.1), 80);
    setTimeout(() => this._tone(500, 0.15, 'sine', 0.08), 160);
  }

  // ─── AMBIENT ───

  startKitchenAmbient() {
    this.stopAmbient();
    const ctx = this.ctx;

    // Low hum
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 55;
    g.gain.value = 0.02;
    osc.connect(g);
    g.connect(this.out);
    osc.start();
    this._ambientSources.push({ osc, gain: g });

    // Subtle noise (fridge/ventilation)
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.008;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    noiseSource.connect(lp);
    lp.connect(noiseGain);
    noiseGain.connect(this.out);
    noiseSource.start();
    this._ambientSources.push({ osc: noiseSource, gain: noiseGain });
  }

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
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 5;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    g.gain.value = 0.06;
    osc.connect(g);
    g.connect(this.out);
    osc.start();
    lfo.start();
    return { stop: () => { try { osc.stop(); lfo.stop(); } catch(e) {} } };
  }

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

  stopAmbient() {
    this._ambientSources.forEach(s => {
      try { s.osc.stop(); } catch (_) {}
      try { s.gain.disconnect(); } catch (_) {}
    });
    this._ambientSources = [];
  }

  dispose() {
    this.stopAmbient();
    if (this._ctx && this._ctx.state !== 'closed') {
      this._ctx.close().catch(() => {});
    }
    this._ctx = null;
    this._masterGain = null;
  }
}

// Global singleton
window.SoundManager = SoundManager;
window.gameSounds = new SoundManager();
