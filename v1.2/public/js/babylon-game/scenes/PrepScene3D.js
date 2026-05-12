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
    this._gripReadyLastFrame = false;
    this._gripPulseTime = 0;

    // 3D objects
    this.counter = null;
    this.bowl = null;
    this.measuringCup = null;
    this.currentContainer = null;
    this.fillMesh = null;
    this.pourParticles = null;
    this.pendantLight = null;
    this.ambientLight = null;
    this.recipeCardTexture = null;
    this.recipeCardMaterial = null;

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
    this._buildKitchenEnvironment();
    this._buildMixingBowl();
    this._buildMeasuringCup();
    this._buildFillGauge();
    this._buildRecipeStand();
    this._buildControlsHint();

    this.handController = new HandController3D(this.scene, this.materials);
    this.handController.bindInput();

    this._loadIngredient(0);
    this._setupPointerEvents();
  }

  _markDecoration(mesh) {
    if (!mesh) return mesh;
    mesh.isPickable = false;
    return mesh;
  }

  async _buildKitchenCounter() {
    this.counter = BABYLON.MeshBuilder.CreateBox('counter', {
      width: 6, height: 0.3, depth: 4
    }, this.scene);
    this.counter.position.y = -0.15;
    this.counter.material = this.materials.wood();

    const counterFace = this._markDecoration(BABYLON.MeshBuilder.CreateBox('counterFace', {
      width: 6.1, height: 0.08, depth: 4.1
    }, this.scene));
    counterFace.position = new BABYLON.Vector3(0, 0.04, 0);
    counterFace.material = this.materials.food(new BABYLON.Color3(0.36, 0.33, 0.31));

    const counterLip = this._markDecoration(BABYLON.MeshBuilder.CreateBox('counterLip', {
      width: 6.1, height: 0.06, depth: 0.12
    }, this.scene));
    counterLip.position = new BABYLON.Vector3(0, 0.03, -1.94);
    counterLip.material = this.materials.food(new BABYLON.Color3(0.28, 0.26, 0.24));

    [-2.25, -0.75, 0.75, 2.25].forEach((x, index) => {
      const panel = this._markDecoration(BABYLON.MeshBuilder.CreateBox(`counterPanel_${index}`, {
        width: 1.35, height: 0.012, depth: 3.7
      }, this.scene));
      panel.position = new BABYLON.Vector3(x, 0.05, 0.03);
      panel.material = this.materials.food(
        index % 2 === 0
          ? new BABYLON.Color3(0.42, 0.39, 0.37)
          : new BABYLON.Color3(0.33, 0.31, 0.29)
      );
    });
  }

  _buildKitchenEnvironment() {
    const wallMaterial = this.materials.food(new BABYLON.Color3(0.9, 0.9, 0.92));
    const trimMaterial = this.materials.food(new BABYLON.Color3(0.78, 0.8, 0.82));
    const floorMaterial = this.materials.food(new BABYLON.Color3(0.18, 0.18, 0.21));
    const windowFrameMaterial = this.materials.food(new BABYLON.Color3(0.82, 0.82, 0.84));

    const floor = this._markDecoration(BABYLON.MeshBuilder.CreateBox('prepFloor', {
      width: 8.5, height: 0.2, depth: 6.5
    }, this.scene));
    floor.position = new BABYLON.Vector3(0, -0.5, 0.4);
    floor.material = floorMaterial;

    [-2.8, -1.4, 0, 1.4, 2.8].forEach((x, index) => {
      const floorStrip = this._markDecoration(BABYLON.MeshBuilder.CreateBox(`floorStrip_${index}`, {
        width: 1.25, height: 0.015, depth: 6.2
      }, this.scene));
      floorStrip.position = new BABYLON.Vector3(x, -0.39, 0.4);
      floorStrip.material = this.materials.food(
        index % 2 === 0
          ? new BABYLON.Color3(0.22, 0.22, 0.25)
          : new BABYLON.Color3(0.15, 0.15, 0.17)
      );
    });

    const backWall = this._markDecoration(BABYLON.MeshBuilder.CreateBox('prepBackWall', {
      width: 7.6, height: 3.8, depth: 0.18
    }, this.scene));
    backWall.position = new BABYLON.Vector3(0, 1.55, 2.15);
    backWall.material = wallMaterial;

    [-2.2, -1.1, 0, 1.1, 2.2].forEach((x, index) => {
      const grout = this._markDecoration(BABYLON.MeshBuilder.CreateBox(`tileVertical_${index}`, {
        width: 0.05, height: 2.45, depth: 0.03
      }, this.scene));
      grout.position = new BABYLON.Vector3(x, 0.9, 2.05);
      grout.material = trimMaterial;
    });

    [0.2, 0.65, 1.1, 1.55].forEach((y, index) => {
      const grout = this._markDecoration(BABYLON.MeshBuilder.CreateBox(`tileHorizontal_${index}`, {
        width: 6.8, height: 0.04, depth: 0.03
      }, this.scene));
      grout.position = new BABYLON.Vector3(0, y, 2.05);
      grout.material = trimMaterial;
    });

    const leftWall = this._markDecoration(BABYLON.MeshBuilder.CreateBox('prepLeftWall', {
      width: 0.18, height: 2.8, depth: 2.4
    }, this.scene));
    leftWall.position = new BABYLON.Vector3(-3.1, 1.1, 0.95);
    leftWall.material = wallMaterial;

    const rightWall = this._markDecoration(BABYLON.MeshBuilder.CreateBox('prepRightWall', {
      width: 0.18, height: 2.8, depth: 2.4
    }, this.scene));
    rightWall.position = new BABYLON.Vector3(3.1, 1.1, 0.95);
    rightWall.material = wallMaterial;

    const windowFrame = this._markDecoration(BABYLON.MeshBuilder.CreateBox('prepWindowFrame', {
      width: 1.9, height: 1.15, depth: 0.08
    }, this.scene));
    windowFrame.position = new BABYLON.Vector3(0.35, 1.45, 2.03);
    windowFrame.material = windowFrameMaterial;

    const windowGlass = this._markDecoration(BABYLON.MeshBuilder.CreateBox('prepWindowGlass', {
      width: 1.65, height: 0.9, depth: 0.03
    }, this.scene));
    windowGlass.position = new BABYLON.Vector3(0.35, 1.45, 1.98);
    windowGlass.material = this.materials.glass();

    const windowCrossVertical = this._markDecoration(BABYLON.MeshBuilder.CreateBox('windowCrossVertical', {
      width: 0.06, height: 0.88, depth: 0.04
    }, this.scene));
    windowCrossVertical.position = new BABYLON.Vector3(0.35, 1.45, 1.99);
    windowCrossVertical.material = windowFrameMaterial;

    const windowCrossHorizontal = this._markDecoration(BABYLON.MeshBuilder.CreateBox('windowCrossHorizontal', {
      width: 1.58, height: 0.06, depth: 0.04
    }, this.scene));
    windowCrossHorizontal.position = new BABYLON.Vector3(0.35, 1.45, 1.99);
    windowCrossHorizontal.material = windowFrameMaterial;

    [-1.95, 1.95].forEach((x, index) => {
      const cabinet = this._markDecoration(BABYLON.MeshBuilder.CreateBox(`cabinet_${index}`, {
        width: 1.35, height: 0.95, depth: 0.5
      }, this.scene));
      cabinet.position = new BABYLON.Vector3(x, 1.52, 1.82);
      cabinet.material = this.materials.wood();

      const handle = this._markDecoration(BABYLON.MeshBuilder.CreateBox(`cabinetHandle_${index}`, {
        width: 0.12, height: 0.12, depth: 0.05
      }, this.scene));
      handle.position = new BABYLON.Vector3(x + (index === 0 ? 0.45 : -0.45), 1.5, 1.53);
      handle.material = this.materials.metal();
    });

    const pendantShade = this._markDecoration(BABYLON.MeshBuilder.CreateCylinder('pendantShade', {
      diameterTop: 0.35,
      diameterBottom: 0.78,
      height: 0.45,
      tessellation: 24
    }, this.scene));
    pendantShade.position = new BABYLON.Vector3(0, 2.35, 0.2);
    pendantShade.material = this.materials.metal();

    const pendantStem = this._markDecoration(BABYLON.MeshBuilder.CreateCylinder('pendantStem', {
      diameter: 0.04,
      height: 0.9,
      tessellation: 12
    }, this.scene));
    pendantStem.position = new BABYLON.Vector3(0, 2.8, 0.2);
    pendantStem.material = this.materials.metal();

    this.pendantLight = new BABYLON.PointLight(
      'pendantLight',
      new BABYLON.Vector3(0, 2.1, 0.15),
      this.scene
    );
    this.pendantLight.diffuse = new BABYLON.Color3(1, 0.88, 0.62);
    this.pendantLight.specular = new BABYLON.Color3(1, 0.8, 0.45);
    this.pendantLight.intensity = 0.75;
    this.pendantLight.range = 6;

    this.ambientLight = new BABYLON.HemisphericLight(
      'prepAmbientLight',
      new BABYLON.Vector3(0, 1, -0.2),
      this.scene
    );
    this.ambientLight.diffuse = new BABYLON.Color3(0.95, 0.92, 0.88);
    this.ambientLight.groundColor = new BABYLON.Color3(0.18, 0.14, 0.1);
    this.ambientLight.intensity = 0.12;

    this._buildRange();
    this._buildCounterDecor();
  }

  _buildRange() {
    const ovenBody = this._markDecoration(BABYLON.MeshBuilder.CreateBox('prepRangeBody', {
      width: 1.3, height: 0.78, depth: 1.0
    }, this.scene));
    ovenBody.position = new BABYLON.Vector3(-2.15, 0.38, 0.65);
    ovenBody.material = this.materials.metal();

    const cooktop = this._markDecoration(BABYLON.MeshBuilder.CreateBox('prepCooktop', {
      width: 1.16, height: 0.06, depth: 0.88
    }, this.scene));
    cooktop.position = new BABYLON.Vector3(-2.15, 0.78, 0.65);
    cooktop.material = this.materials.food(new BABYLON.Color3(0.12, 0.12, 0.14));

    [
      [-2.42, 0.43],
      [-1.88, 0.43],
      [-2.42, 0.86],
      [-1.88, 0.86]
    ].forEach(([x, z], index) => {
      const burner = this._markDecoration(BABYLON.MeshBuilder.CreateCylinder(`burner_${index}`, {
        diameter: 0.22,
        height: 0.03,
        tessellation: 20
      }, this.scene));
      burner.position = new BABYLON.Vector3(x, 0.82, z);
      burner.material = this.materials.food(new BABYLON.Color3(0.06, 0.06, 0.08));
    });

    const controlPanel = this._markDecoration(BABYLON.MeshBuilder.CreateBox('prepRangePanel', {
      width: 1.16, height: 0.14, depth: 0.08
    }, this.scene));
    controlPanel.position = new BABYLON.Vector3(-2.15, 0.98, 0.18);
    controlPanel.material = this.materials.metal();

    [-2.48, -2.26, -2.04, -1.82].forEach((x, index) => {
      const knob = this._markDecoration(BABYLON.MeshBuilder.CreateCylinder(`prepRangeKnob_${index}`, {
        diameter: 0.09,
        height: 0.06,
        tessellation: 18
      }, this.scene));
      knob.rotation.x = Math.PI / 2;
      knob.position = new BABYLON.Vector3(x, 0.98, 0.13);
      knob.material = this.materials.metal();
    });

    const ovenDoor = this._markDecoration(BABYLON.MeshBuilder.CreateBox('prepRangeDoor', {
      width: 1.05, height: 0.44, depth: 0.05
    }, this.scene));
    ovenDoor.position = new BABYLON.Vector3(-2.15, 0.33, 0.15);
    ovenDoor.material = this.materials.food(new BABYLON.Color3(0.16, 0.16, 0.18));

    const ovenWindow = this._markDecoration(BABYLON.MeshBuilder.CreateBox('prepRangeWindow', {
      width: 0.72, height: 0.24, depth: 0.02
    }, this.scene));
    ovenWindow.position = new BABYLON.Vector3(-2.15, 0.33, 0.11);
    ovenWindow.material = this.materials.glass();

    const ovenHandle = this._markDecoration(BABYLON.MeshBuilder.CreateCylinder('prepRangeHandle', {
      diameter: 0.05,
      height: 0.72,
      tessellation: 12
    }, this.scene));
    ovenHandle.rotation.z = Math.PI / 2;
    ovenHandle.position = new BABYLON.Vector3(-2.15, 0.53, 0.08);
    ovenHandle.material = this.materials.metal();
  }

  _buildCounterDecor() {
    const cuttingBoard = this._markDecoration(BABYLON.MeshBuilder.CreateBox('cuttingBoard', {
      width: 1.15, height: 0.06, depth: 0.62
    }, this.scene));
    cuttingBoard.position = new BABYLON.Vector3(1.05, 0.06, -0.92);
    cuttingBoard.material = this.materials.wood();

    const boardHandle = this._markDecoration(BABYLON.MeshBuilder.CreateCylinder('cuttingBoardHandle', {
      diameter: 0.1,
      height: 0.03,
      tessellation: 18
    }, this.scene));
    boardHandle.rotation.x = Math.PI / 2;
    boardHandle.position = new BABYLON.Vector3(1.52, 0.06, -0.92);
    boardHandle.material = this.materials.metal();

    const rollingPinBody = this._markDecoration(BABYLON.MeshBuilder.CreateCylinder('rollingPinBody', {
      diameter: 0.18,
      height: 0.65,
      tessellation: 20
    }, this.scene));
    rollingPinBody.rotation.z = Math.PI / 2;
    rollingPinBody.position = new BABYLON.Vector3(-0.55, 0.1, -1.05);
    rollingPinBody.material = this.materials.wood();

    const leftHandle = this._markDecoration(BABYLON.MeshBuilder.CreateCylinder('rollingPinLeftHandle', {
      diameter: 0.08,
      height: 0.18,
      tessellation: 16
    }, this.scene));
    leftHandle.rotation.z = Math.PI / 2;
    leftHandle.position = new BABYLON.Vector3(-0.98, 0.1, -1.05);
    leftHandle.material = this.materials.metal();

    const rightHandle = this._markDecoration(BABYLON.MeshBuilder.CreateCylinder('rollingPinRightHandle', {
      diameter: 0.08,
      height: 0.18,
      tessellation: 16
    }, this.scene));
    rightHandle.rotation.z = Math.PI / 2;
    rightHandle.position = new BABYLON.Vector3(-0.12, 0.1, -1.05);
    rightHandle.material = this.materials.metal();
  }

  _buildRecipeStand() {
    const standBase = this._markDecoration(BABYLON.MeshBuilder.CreateBox('recipeStandBase', {
      width: 0.45, height: 0.05, depth: 0.26
    }, this.scene));
    standBase.position = new BABYLON.Vector3(2.25, 0.06, -0.3);
    standBase.material = this.materials.wood();

    const support = this._markDecoration(BABYLON.MeshBuilder.CreateBox('recipeStandSupport', {
      width: 0.32, height: 0.42, depth: 0.05
    }, this.scene));
    support.position = new BABYLON.Vector3(2.25, 0.28, -0.36);
    support.rotation.x = 0.25;
    support.material = this.materials.wood();

    const brace = this._markDecoration(BABYLON.MeshBuilder.CreateBox('recipeStandBrace', {
      width: 0.04, height: 0.26, depth: 0.04
    }, this.scene));
    brace.position = new BABYLON.Vector3(2.25, 0.16, -0.13);
    brace.rotation.x = -0.55;
    brace.material = this.materials.metal();

    const recipeCard = this._markDecoration(BABYLON.MeshBuilder.CreatePlane('recipeCard', {
      width: 0.52,
      height: 0.36,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, this.scene));
    recipeCard.position = new BABYLON.Vector3(2.25, 0.3, -0.2);
    recipeCard.rotation.x = 0.22;

    this.recipeCardTexture = new BABYLON.DynamicTexture(
      'recipeCardTexture',
      { width: 512, height: 384 },
      this.scene,
      true
    );
    this.recipeCardMaterial = this.materials.glass().clone('recipeCardMaterial');
    this.recipeCardMaterial.backFaceCulling = false;
    this.recipeCardMaterial.alpha = 0.97;
    this.recipeCardMaterial.metallic = 0;
    this.recipeCardMaterial.roughness = 0.88;
    this.recipeCardMaterial.albedoTexture = this.recipeCardTexture;
    recipeCard.material = this.recipeCardMaterial;
  }

  _updateRecipeCard(ingredient, color) {
    if (!this.recipeCardTexture) return;

    const ctx = this.recipeCardTexture.getContext();
    const size = this.recipeCardTexture.getSize();
    const accent = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;

    ctx.fillStyle = '#f7f3e9';
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, size.width, 64);
    ctx.fillStyle = '#4b3a26';
    ctx.fillRect(0, size.height - 24, size.width, 24);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TARGET INGREDIENT', size.width / 2, 42);

    ctx.fillStyle = '#3b2d1f';
    ctx.font = 'bold 58px Arial';
    ctx.fillText(ingredient.toUpperCase(), size.width / 2, 175);

    ctx.fillStyle = '#5d4b36';
    ctx.font = '28px Arial';
    ctx.fillText('Aim for the green zone', size.width / 2, 240);
    ctx.fillText(`Goal: ${Math.round(this.targetLevel * 100)}% full`, size.width / 2, 288);

    this.recipeCardTexture.update();
  }

  _buildMixingBowl() {
    this.bowl = BABYLON.MeshBuilder.CreateSphere('bowl', {
      diameter: 1.5,
      slice: 0.5
    }, this.scene);
    this.bowl.position = new BABYLON.Vector3(1.5, 0.4, 0);
    this.bowl.material = this.materials.metal();

    const bowlRim = this._markDecoration(BABYLON.MeshBuilder.CreateTorus('bowlRim', {
      diameter: 1.52,
      thickness: 0.05,
      tessellation: 28
    }, this.scene));
    bowlRim.position = new BABYLON.Vector3(1.5, 0.78, 0);
    bowlRim.rotation.x = Math.PI / 2;
    bowlRim.material = this.materials.metal();
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

    const cupHandle = this._markDecoration(BABYLON.MeshBuilder.CreateTorus('cupHandle', {
      diameter: 0.34,
      thickness: 0.04,
      tessellation: 20
    }, this.scene));
    cupHandle.position = new BABYLON.Vector3(-0.34, 0.53, 0);
    cupHandle.rotation.y = Math.PI / 2;
    cupHandle.material = this.materials.metal();

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

    this.targetZone = new BABYLON.GUI.Rectangle('targetZone');
    this.targetZone.width = '100%';
    this.targetZone.height = '30px';
    this.targetZone.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.targetZone.top = '-70px';
    this.targetZone.background = 'rgba(0, 200, 0, 0.4)';
    this.targetZone.thickness = 0;
    this.fillGauge.addControl(this.targetZone);

    this.fillBar = new BABYLON.GUI.Rectangle('fillBar');
    this.fillBar.width = '100%';
    this.fillBar.height = '0%';
    this.fillBar.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.fillBar.background = '#4488ff';
    this.fillBar.thickness = 0;
    this.fillGauge.addControl(this.fillBar);

    this.instructionText = new BABYLON.GUI.TextBlock('instruction', '');
    this.instructionText.color = '#ffffff';
    this.instructionText.fontSize = 20;
    this.instructionText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.instructionText.paddingBottom = '60px';
    this.instructionText.outlineWidth = 2;
    this.instructionText.outlineColor = '#000000';
    this.hud.texture.addControl(this.instructionText);
  }

  _pulseGripGauge() {
    this._gripPulseTime = 0.35;
  }

  _resetGripGaugePulse() {
    this._gripPulseTime = 0;
    if (!this.fillGauge) return;
    this.fillGauge.scaleX = 1;
    this.fillGauge.scaleY = 1;
    this.fillGauge.color = '#555555';
    this.fillGauge.background = '#222222';
    this.fillGauge.thickness = 2;
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
    const containerConfigs = {
      flour: {
        mesh: 'box',
        options: { width: 0.5, height: 0.95, depth: 0.34 },
        position: new BABYLON.Vector3(-1.5, 0.58, -0.12),
        material: 'food'
      },
      sugar: {
        mesh: 'cylinder',
        options: { diameterTop: 0.42, diameterBottom: 0.42, height: 0.82, tessellation: 24 },
        position: new BABYLON.Vector3(-1.5, 0.52, -0.12),
        material: 'glass'
      },
      eggs: {
        mesh: 'box',
        options: { width: 0.74, height: 0.24, depth: 0.46 },
        position: new BABYLON.Vector3(-1.5, 0.25, -0.12),
        material: 'food'
      },
      butter: {
        mesh: 'box',
        options: { width: 0.42, height: 0.18, depth: 0.22 },
        position: new BABYLON.Vector3(-1.5, 0.22, -0.12),
        material: 'food'
      },
      milk: {
        mesh: 'cylinder',
        options: { diameterTop: 0.24, diameterBottom: 0.38, height: 0.96, tessellation: 24 },
        position: new BABYLON.Vector3(-1.5, 0.59, -0.12),
        material: 'food'
      }
    };
    const config = containerConfigs[ingredient] || containerConfigs.flour;
    const createMesh = config.mesh === 'cylinder'
      ? BABYLON.MeshBuilder.CreateCylinder
      : BABYLON.MeshBuilder.CreateBox;

    this.currentContainer = createMesh('container', config.options, this.scene);
    this.currentContainer.position = config.position.clone();
    this.currentContainer.material = config.material === 'glass'
      ? this.materials.glass()
      : this.materials.food(color);

    this._styleIngredientContainer(ingredient, color);

    this.fillMesh.material = this.materials.food(color);

    this.pourParticles = ParticlePresets.flourDust(
      this.scene,
      this.currentContainer,
      { rate: 0 }
    );
    this.pourParticles.color1 = new BABYLON.Color4(color.r, color.g, color.b, 0.8);
    this.pourParticles.color2 = new BABYLON.Color4(color.r, color.g, color.b, 0.4);
    this.pourParticles.start();

    this._gripReadyLastFrame = false;
    this._resetGripGaugePulse();
    this._updateFillVisuals();
    this._updateRecipeCard(ingredient, color);
    this.instructionText.text = `Grab ${ingredient} — curl 3+ fingers to grip, tilt to pour`;
    this._updateFillGauge();
  }

  _styleIngredientContainer(ingredient, color) {
    const detailColor = this.materials.food(new BABYLON.Color3(
      Math.max(0, color.r - 0.08),
      Math.max(0, color.g - 0.08),
      Math.max(0, color.b - 0.08)
    ));

    switch (ingredient) {
      case 'flour': {
        const fold = this._markDecoration(BABYLON.MeshBuilder.CreateBox('flourFold', {
          width: 0.42, height: 0.14, depth: 0.2
        }, this.scene));
        fold.parent = this.currentContainer;
        fold.position.y = 0.34;
        fold.material = this.materials.food(new BABYLON.Color3(0.88, 0.83, 0.72));

        const label = this._markDecoration(BABYLON.MeshBuilder.CreateBox('flourLabel', {
          width: 0.28, height: 0.22, depth: 0.02
        }, this.scene));
        label.parent = this.currentContainer;
        label.position = new BABYLON.Vector3(0, 0.02, -0.18);
        label.material = this.materials.food(new BABYLON.Color3(0.96, 0.95, 0.9));
        break;
      }
      case 'sugar': {
        const sugarFill = this._markDecoration(BABYLON.MeshBuilder.CreateCylinder('sugarFill', {
          diameter: 0.3, height: 0.38, tessellation: 20
        }, this.scene));
        sugarFill.parent = this.currentContainer;
        sugarFill.position.y = -0.15;
        sugarFill.material = this.materials.food(color);

        const lid = this._markDecoration(BABYLON.MeshBuilder.CreateCylinder('sugarLid', {
          diameter: 0.46, height: 0.1, tessellation: 20
        }, this.scene));
        lid.parent = this.currentContainer;
        lid.position.y = 0.4;
        lid.material = this.materials.metal();
        break;
      }
      case 'eggs': {
        const lid = this._markDecoration(BABYLON.MeshBuilder.CreateBox('eggCartonLid', {
          width: 0.74, height: 0.12, depth: 0.46
        }, this.scene));
        lid.parent = this.currentContainer;
        lid.position.y = 0.08;
        lid.material = detailColor;

        [-0.22, 0, 0.22].forEach((x, index) => {
          const bump = this._markDecoration(BABYLON.MeshBuilder.CreateSphere(`eggBump_${index}`, {
            diameter: 0.12,
            segments: 10
          }, this.scene));
          bump.parent = this.currentContainer;
          bump.position = new BABYLON.Vector3(x, 0.12, 0);
          bump.scaling.y = 0.65;
          bump.material = this.materials.food(new BABYLON.Color3(0.96, 0.9, 0.74));
        });
        break;
      }
      case 'butter': {
        const wrapper = this._markDecoration(BABYLON.MeshBuilder.CreateBox('butterWrapper', {
          width: 0.46, height: 0.1, depth: 0.24
        }, this.scene));
        wrapper.parent = this.currentContainer;
        wrapper.position.y = 0.03;
        wrapper.material = this.materials.food(new BABYLON.Color3(0.95, 0.9, 0.72));

        const wrapperBand = this._markDecoration(BABYLON.MeshBuilder.CreateBox('butterWrapperBand', {
          width: 0.08, height: 0.12, depth: 0.25
        }, this.scene));
        wrapperBand.parent = this.currentContainer;
        wrapperBand.position.y = 0.03;
        wrapperBand.material = detailColor;
        break;
      }
      case 'milk': {
        const neck = this._markDecoration(BABYLON.MeshBuilder.CreateCylinder('milkNeck', {
          diameter: 0.14, height: 0.18, tessellation: 20
        }, this.scene));
        neck.parent = this.currentContainer;
        neck.position.y = 0.49;
        neck.material = this.materials.food(color);

        const cap = this._markDecoration(BABYLON.MeshBuilder.CreateCylinder('milkCap', {
          diameter: 0.16, height: 0.08, tessellation: 20
        }, this.scene));
        cap.parent = this.currentContainer;
        cap.position.y = 0.62;
        cap.material = this.materials.food(new BABYLON.Color3(0.42, 0.62, 0.9));
        break;
      }
    }
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

      const canGrip = this.handController.canGrip();
      if (canGrip && !this.handController.isHolding() && this.currentContainer) {
        if (!this._gripReadyLastFrame) {
          this._pulseGripGauge();
        }
        this.handController.tryGrab(this.currentContainer);
      }

      this._gripReadyLastFrame = canGrip && !this.handController.isHolding();
    };

    this.scene.registerBeforeRender(this._beforeRender);
  }

  update(dt) {
    if (this.isComplete) return;
    if (this.handController) this.handController.update(dt);
    this._updateGripGaugePulse(dt);

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

  _updateGripGaugePulse(dt) {
    if (!this.fillGauge || this._gripPulseTime <= 0) return;

    this._gripPulseTime = Math.max(0, this._gripPulseTime - dt);
    if (this._gripPulseTime === 0) {
      this._resetGripGaugePulse();
      return;
    }

    const progress = 1 - (this._gripPulseTime / 0.35);
    const wave = Math.sin(progress * Math.PI);
    this.fillGauge.scaleX = 1 + (wave * 0.12);
    this.fillGauge.scaleY = 1 + (wave * 0.05);
    this.fillGauge.color = '#6cff8a';
    this.fillGauge.background = '#1f2f1f';
    this.fillGauge.thickness = 2 + Math.round(wave * 3);
  }

  _updateFillVisuals() {
    const height = Math.max(0.01, this.pourLevel * 0.6);
    this.fillMesh.scaling.y = height / 0.01;
    this.fillMesh.position.y = 0.2 + (height / 2);
  }

  _updateFillGauge() {
    const pct = Math.round(this.pourLevel * 100);
    this.fillBar.height = `${pct}%`;

    const zoneOffset = Math.round(Math.max(0, Math.min(170, (this.targetLevel * 200) - 15)));
    this.targetZone.top = `-${zoneOffset}px`;

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
      splat.stop();
      splat.dispose();
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
    if (this.recipeCardMaterial) {
      this.recipeCardMaterial.dispose();
      this.recipeCardMaterial = null;
    }
    if (this.recipeCardTexture) {
      this.recipeCardTexture.dispose();
      this.recipeCardTexture = null;
    }
    if (this.pendantLight) {
      this.pendantLight.dispose();
      this.pendantLight = null;
    }
    if (this.ambientLight) {
      this.ambientLight.dispose();
      this.ambientLight = null;
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
