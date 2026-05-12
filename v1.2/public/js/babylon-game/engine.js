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
    this._currentPhaseIndex = 0;
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
    this._setupPhaseAdvancement();
    this._initialized = true;
  }

  _onResize = () => {
    if (this.engine) this.engine.resize();
  };

  _setupPhaseAdvancement() {
    this.socketBridge.onPhaseCompleted((data) => {
      if (this._bakingComplete) return;
      // Only advance for our team's phase completions
      if (data.teamId && this.options.teamId && data.teamId !== this.options.teamId) return;
      this._currentPhaseIndex++;
      const minigames = this.options.minigames || [];
      const next = minigames[this._currentPhaseIndex];
      if (!next) {
        this._showBakingComplete(data);
        return;
      }

      const sceneKey = SCENE_KEY_MAP[next.sceneKey] || next.sceneKey;
      this.sceneManager.transitionToScene(sceneKey, {
        ...this.options,
        isAbsurd: Boolean(next.isAbsurd),
        phaseName: next.phaseName || next.phase?.toUpperCase()
      });
    });
  }

  _showBakingComplete(data) {
    this._bakingComplete = true;

    // Lock scene manager to prevent any pending async transitions
    // from overriding the completion screen
    if (this.sceneManager) {
      this.sceneManager.lockTransitions();
      if (this.sceneManager.currentScene) {
        this.sceneManager.currentScene.dispose();
        this.sceneManager.currentScene = null;
      }
    }

    this.engine.stopRenderLoop();

    // Create a simple completion scene
    const scene = new BABYLON.Scene(this.engine);
    scene.clearColor = new BABYLON.Color4(0.05, 0.08, 0.12, 1);

    const camera = new BABYLON.FreeCamera('completeCam', new BABYLON.Vector3(0, 0, -5), scene);
    camera.setTarget(BABYLON.Vector3.Zero());

    // GUI overlay
    const adt = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('completeUI', true, scene);

    const title = new BABYLON.GUI.TextBlock('completeTitle', '🎂 Baking Complete!');
    title.color = '#ffd700';
    title.fontSize = 48;
    title.fontWeight = 'bold';
    title.outlineWidth = 3;
    title.outlineColor = '#000000';
    title.top = '-60px';
    adt.addControl(title);

    const totalScore = data.scoreboard?.[0]?.totalScore || 0;
    const sub = new BABYLON.GUI.TextBlock('completeSub',
      `Total Score: ${totalScore}\nWaiting for the host to reveal results...`);
    sub.color = '#ffffff';
    sub.fontSize = 22;
    sub.top = '20px';
    sub.textWrapping = true;
    sub.lineSpacing = '8px';
    adt.addControl(sub);

    this.engine.runRenderLoop(() => scene.render());
    this._completionScene = scene;
  }

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
    // Merge scene options into engine options so phase advancement has minigames/boosts
    Object.assign(this.options, options);
    const babylonKey = SCENE_KEY_MAP[phaserSceneKey] || phaserSceneKey;
    return this.sceneManager.startScene(babylonKey, options);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);

    if (this._completionScene) {
      this._completionScene.dispose();
      this._completionScene = null;
    }

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