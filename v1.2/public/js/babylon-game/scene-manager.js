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