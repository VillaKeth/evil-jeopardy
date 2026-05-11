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