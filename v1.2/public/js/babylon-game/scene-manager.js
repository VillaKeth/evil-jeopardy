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
    this.sounds = window.gameSounds || null;
    this._timerWarnPlayed = false;
    this._timerCritPlayed = false;
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

    if (this.sounds) {
      this.sounds.transition();
      this.sounds.startKitchenAmbient();
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
    if (this.sounds) this.sounds.chaosEvent();
    this.hud.showMessage(`⚡ ${event.name || 'Chaos!'}`, 1500);

    switch (event.key) {
      case 'butter-hands':
        if (this.handController) {
          this.handController.gripModifier = 0.5;
          setTimeout(() => { if (this.handController) this.handController.gripModifier = 1.0; }, 8000);
        }
        break;
      case 'earthquake':
        this._earthquakeShake = 5.0;
        if (this.sounds && this.sounds.earthquakeRumble) this.sounds.earthquakeRumble();
        break;
      case 'inverted':
        this._invertedControls = true;
        setTimeout(() => { this._invertedControls = false; }, 8000);
        break;
      case 'swarm':
        this._spawnBeeParticles(6000);
        if (this.sounds && this.sounds.beeBuzz) this.sounds.beeBuzz();
        break;
      case 'shrink':
        if (this._cakeMesh) {
          this._cakeMesh.scaling.scaleInPlace(0.5);
          setTimeout(() => { if (this._cakeMesh) this._cakeMesh.scaling.scaleInPlace(2.0); }, 10000);
        }
        if (this.sounds && this.sounds.shrinkSound) this.sounds.shrinkSound();
        break;
    }
  }

  _spawnBeeParticles(duration) {
    const emitter = new BABYLON.TransformNode('beeEmitter', this.scene);
    emitter.position = new BABYLON.Vector3(0, 2, 0);
    const particles = new BABYLON.ParticleSystem('bees', 60, this.scene);
    particles.emitter = emitter;
    particles.minSize = 0.04;
    particles.maxSize = 0.08;
    particles.minLifeTime = 0.3;
    particles.maxLifeTime = 0.8;
    particles.emitRate = 40;
    particles.direction1 = new BABYLON.Vector3(-2, 0.5, -2);
    particles.direction2 = new BABYLON.Vector3(2, 1, 2);
    particles.color1 = new BABYLON.Color4(1, 0.85, 0.1, 1);
    particles.color2 = new BABYLON.Color4(0.2, 0.2, 0.05, 1);
    particles.createPointEmitter(new BABYLON.Vector3(-1.5, -0.5, -1.5), new BABYLON.Vector3(1.5, 0.5, 1.5));
    particles.start();
    setTimeout(() => {
      if (this._disposed) return;
      particles.stop();
      setTimeout(() => { particles.dispose(); emitter.dispose(); }, 1000);
    }, duration);
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

      // Timer warning sounds
      if (this.sounds && !this._timerWarnPlayed && this.timeRemaining <= 10 && this.timeRemaining > 5) {
        this._timerWarnPlayed = true;
        this.sounds.timerWarning();
      }
      if (this.sounds && this.timeRemaining <= 5 && this.timeRemaining > 0) {
        if (!this._timerCritPlayed || Math.floor(this.timeRemaining) !== this._lastCritSecond) {
          this._timerCritPlayed = true;
          this._lastCritSecond = Math.floor(this.timeRemaining);
          this.sounds.timerCritical();
        }
      }

      if (this.timeRemaining <= 0) {
        clearInterval(this._timerInterval);
        if (this.sounds) this.sounds.timeUp();
        this.onTimeUp();
      }
    }, 100);
  }

  _registerUpdateLoop() {
    this.scene.registerBeforeRender(() => {
      if (this._disposed) return;
      const dt = this.babylonEngine.getDeltaTime() / 1000;
      this._updateBaseEffects(dt);
      this.update(dt);
    });
  }

  _updateBaseEffects(dt) {
    if (this._earthquakeShake && this._earthquakeShake > 0) {
      this._earthquakeShake -= dt;
      const cam = this.scene.activeCamera;
      if (cam) {
        const intensity = Math.min(1, this._earthquakeShake) * 0.06;
        cam.position.x += (Math.random() - 0.5) * intensity;
        cam.position.y += (Math.random() - 0.5) * intensity * 0.5;
      }
      if (this._earthquakeShake <= 0) this._earthquakeShake = 0;
    }
  }

  addScore(points) {
    this.score = Math.min(100, Math.max(0, this.score + points));
    this.hud.updateScore(this.score);
    if (this.sounds && points > 0) this.sounds.scoreUp();
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
    if (this.sounds) this.sounds.phaseComplete();

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
    if (this.sounds) this.sounds.stopAmbient();
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
    this._locked = false;
  }

  lockTransitions() {
    this._locked = true;
  }

  register(sceneKey, SceneClass) {
    this._registry[sceneKey] = SceneClass;
  }

  async startScene(sceneKey, options = {}) {
    if (this._locked) return null;
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

  async transitionToScene(sceneKey, options = {}) {
    if (this._locked) return null;
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
      if (this._locked) {
        gui.dispose();
        countdownScene.dispose();
        return null;
      }
    }

    this.engine.stopRenderLoop();
    gui.dispose();
    countdownScene.dispose();

    return this.startScene(sceneKey, options);
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