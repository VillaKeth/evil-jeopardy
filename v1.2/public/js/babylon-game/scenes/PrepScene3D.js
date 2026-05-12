// Evil Jeopardy 1.2 — PrepScene3D (Ingredient Measurement Minigame)
// Surgeon-sim hand controls grab ingredient containers, tilt to pour, release to score.

class PrepScene3D extends BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options) {
    super(engine, canvas, socketBridge, options);
    this.timeLimit = 75;

    this.requiredIngredients = ['flour', 'sugar', 'eggs', 'butter', 'milk'];
    this.currentIngredientIndex = 0;
    this.ingredientScores = [];
    this.pourLevel = 0;
    this.targetLevel = 0;
    this.handController = null;
    this._pourCooldown = false;
    this._scored = false;

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
    this.fillBar = null;
    this.instructionText = null;
    this.controlsHint = null;
    this._controlsHintFadeTimeout = null;
    this._controlsHintFadeInterval = null;
    this._beforeRender = null;
  }

  getPhaseName() { return 'PREP'; }

  async create() {
    const camera = new BABYLON.FreeCamera(
      'surgeonCam',
      new BABYLON.Vector3(0, 3.5, -2.5),
      this.scene
    );
    camera.setTarget(new BABYLON.Vector3(0, 0.5, 0.5));
    camera.inputs.clear();

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

  _buildControlsHint() {
    this.controlsHint = new BABYLON.GUI.TextBlock(
      'controlsHint',
      'A-thumb  S-index  D-mid  F-ring  G-pinky\nSPACE = switch hand  |  Mouse = move & tilt'
    );
    this.controlsHint.color = '#ffffff';
    this.controlsHint.fontSize = 16;
    this.controlsHint.textWrapping = true;
    this.controlsHint.width = '400px';
    this.controlsHint.height = '60px';
    this.controlsHint.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.controlsHint.paddingBottom = '20px';
    this.controlsHint.outlineWidth = 2;
    this.controlsHint.outlineColor = '#000000';
    this.controlsHint.alpha = 0.9;
    this.hud.texture.addControl(this.controlsHint);

    this._controlsHintFadeTimeout = setTimeout(() => {
      this._controlsHintFadeInterval = setInterval(() => {
        if (!this.controlsHint || this._disposed) {
          clearInterval(this._controlsHintFadeInterval);
          this._controlsHintFadeInterval = null;
          return;
        }

        this.controlsHint.alpha -= 0.02;
        if (this.controlsHint.alpha <= 0) {
          clearInterval(this._controlsHintFadeInterval);
          this._controlsHintFadeInterval = null;
          this.hud.texture.removeControl(this.controlsHint);
          this.controlsHint.dispose();
          this.controlsHint = null;
        }
      }, 50);
    }, 6000);
  }

  _loadIngredient(index) {
    this._scored = false;
    if (this.handController && this.handController.isHolding()) {
      this.handController.drop(false);
    }
    if (this.currentContainer) {
      this.currentContainer.dispose();
    }
    if (this.pourParticles) {
      this.pourParticles.stop();
      this.pourParticles.dispose();
    }

    this.pourLevel = 0;
    this.targetLevel = 0.6 + Math.random() * 0.2;

    const ingredient = this.requiredIngredients[index];
    const colors = {
      flour: new BABYLON.Color3(0.95, 0.92, 0.82),
      sugar: new BABYLON.Color3(1, 1, 0.95),
      eggs: new BABYLON.Color3(1, 0.85, 0.3),
      butter: new BABYLON.Color3(1, 0.9, 0.5),
      milk: new BABYLON.Color3(0.95, 0.95, 0.98)
    };
    const color = colors[ingredient] || new BABYLON.Color3(0.8, 0.8, 0.8);

    this.currentContainer = BABYLON.MeshBuilder.CreateBox('container', {
      width: 0.6, height: 0.8, depth: 0.4
    }, this.scene);
    this.currentContainer.position = new BABYLON.Vector3(-1.5, 0.6, 0);
    this.currentContainer.material = this.materials.food(color);

    this.fillMesh.material = this.materials.food(color);

    this.pourParticles = ParticlePresets.flourDust(
      this.scene,
      this.currentContainer,
      { rate: 0 }
    );
    this.pourParticles.color1 = new BABYLON.Color4(color.r, color.g, color.b, 0.8);
    this.pourParticles.color2 = new BABYLON.Color4(color.r, color.g, color.b, 0.4);
    this.pourParticles.start();

    this._updateFillVisuals();
    this.instructionText.text = `Grab ${ingredient} — curl 3+ fingers to grip, tilt to pour`;
    this._updateFillGauge();
  }

  _setupPointerEvents() {
    this.scene.onPointerMove = (evt) => {
      if (this.isComplete || !this.handController) return;

      const pick = this.scene.pick(evt.offsetX, evt.offsetY);
      if (pick.hit) {
        this.handController.setPosition(
          pick.pickedPoint.x,
          pick.pickedPoint.y + 0.5,
          pick.pickedPoint.z
        );
      }

      if (this.handController.isHolding()) {
        const normY = 1 - (evt.offsetY / this.canvas.height);
        const tilt = normY * 1.8 - 0.3;
        this.handController.setTilt(tilt);
      }
    };

    this._beforeRender = () => {
      if (!this.handController || this.isComplete) return;

      if (this.handController.canGrip() && !this.handController.isHolding() && this.currentContainer) {
        this.handController.tryGrab(this.currentContainer);
      }
    };

    this.scene.registerBeforeRender(this._beforeRender);
  }

  update(dt) {
    if (this.isComplete) return;
    if (this.handController) this.handController.update(dt);

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
      if (this.pourLevel > 0 && !this._scored) {
        this._scored = true;
        this._scoreIngredient();
      }
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

    if (this.sounds) {
      this.sounds.splat();
      if (ingredientScore >= 15) this.sounds.perfect();
      else if (ingredientScore >= 10) this.sounds.good();
      else this.sounds.miss();
    }

    this.hud.showMessage(
      ingredientScore >= 15 ? 'Perfect!' : ingredientScore >= 10 ? 'Good!' : 'Off target...',
      1200
    );

    const splat = ParticlePresets.splatter(
      this.scene,
      this.bowl.position.clone(),
      this.fillMesh.material.albedoColor || this.fillMesh.material.diffuseColor
    );
    splat.start();
    setTimeout(() => {
      if (this._disposed) return;
      splat.stop(); splat.dispose();
    }, 800);

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
    while (this.ingredientScores.length < this.requiredIngredients.length) {
      this.ingredientScores.push(0);
    }
    this.completePhase({
      ingredientScores: this.ingredientScores,
      ingredientCount: this.requiredIngredients.length,
      timedOut: true
    });
  }

  dispose() {
    if (this._controlsHintFadeTimeout) {
      clearTimeout(this._controlsHintFadeTimeout);
      this._controlsHintFadeTimeout = null;
    }
    if (this._controlsHintFadeInterval) {
      clearInterval(this._controlsHintFadeInterval);
      this._controlsHintFadeInterval = null;
    }
    if (this.hud && this.hud.texture && this.controlsHint) {
      this.hud.texture.removeControl(this.controlsHint);
      this.controlsHint.dispose();
      this.controlsHint = null;
    }
    if (this.scene) {
      this.scene.onPointerMove = null;
      if (this._beforeRender) {
        this.scene.unregisterBeforeRender(this._beforeRender);
        this._beforeRender = null;
      }
    }
    if (this.handController) {
      this.handController.dispose();
      this.handController = null;
    }
    super.dispose();
  }
}

window.PrepScene3D = PrepScene3D;
