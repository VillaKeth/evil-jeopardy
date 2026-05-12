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