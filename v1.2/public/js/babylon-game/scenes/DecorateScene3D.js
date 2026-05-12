// Evil Jeopardy 1.2 — DecorateScene3D (Cake Decorating Minigame)

class DecorateScene3D extends BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options) {
    super(engine, canvas, socketBridge, options);
    this.timeLimit = 60;

    this.selectedTool = 'frosting';
    this.selectedColorKey = 'white';
    this.availableColors = this._getAvailableColors();
    this.selectedToppingType = null;
    this.isPainting = false;
    this.lastFrostPoint = null;
    this.frostingPaths = 0;
    this.itemsPlaced = 0;
    this.overlaps = 0;
    this.colorsUsed = new Set();
    this.fondantApplied = false;

    this.camera = null;
    this.cakeRoot = null;
    this.turntable = null;
    this.cake = null;
    this.fondantLayer = null;
    this.toolStatusText = null;
    this.sampleMeshes = [];
    this.decorationPoints = [];
  }

  getPhaseName() { return 'DECORATE'; }

  async create() {
    this.camera = CameraRigs.orbit(this.scene, this.canvas, {
      alpha: -Math.PI / 2,
      beta: Math.PI / 3,
      distance: 6.5,
      target: new BABYLON.Vector3(0, 1.1, 0)
    });
    if (this.camera.inputs.attached.pointers) {
      this.camera.inputs.attached.pointers.buttons = [1, 2];
    }
    this.camera.lowerRadiusLimit = 4.5;
    this.camera.upperRadiusLimit = 8;

    this._buildTable();
    this._buildCake();
    this._buildToolPanel();
    this._buildColorPicker();
    this._buildToppingShelf();
    this._setupPointerEvents();
    this._updateToolStatus();
    this._updateScore();
    this.hud.showMessage('Left click paints and places. Right drag orbits the cake.', 2400);
  }

  _getAvailableColors() {
    const baseColors = {
      white: new BABYLON.Color3(0.97, 0.97, 0.97),
      pink: new BABYLON.Color3(1.0, 0.72, 0.82),
      chocolate: new BABYLON.Color3(0.45, 0.28, 0.18),
      blue: new BABYLON.Color3(0.48, 0.72, 1.0)
    };

    if (this.hasBoost('food-coloring')) {
      baseColors.mint = new BABYLON.Color3(0.68, 0.94, 0.78);
      baseColors.lavender = new BABYLON.Color3(0.78, 0.68, 0.95);
      baseColors.lemon = new BABYLON.Color3(1.0, 0.92, 0.45);
      baseColors.coral = new BABYLON.Color3(1.0, 0.58, 0.46);
    }

    return baseColors;
  }

  _buildTable() {
    const table = BABYLON.MeshBuilder.CreateBox('decorateTable', {
      width: 7,
      height: 0.35,
      depth: 5.5
    }, this.scene);
    table.position = new BABYLON.Vector3(0, -0.2, 0);
    table.material = this.materials.wood();
  }

  _buildCake() {
    this.cakeRoot = new BABYLON.TransformNode('decorateCakeRoot', this.scene);

    this.turntable = BABYLON.MeshBuilder.CreateCylinder('decorateTurntable', {
      diameter: 2.5,
      height: 0.18,
      tessellation: 40
    }, this.scene);
    this.turntable.position = new BABYLON.Vector3(0, 0.1, 0);
    this.turntable.material = this.materials.metal();
    this.turntable.parent = this.cakeRoot;

    this.cake = BABYLON.MeshBuilder.CreateCylinder('decorateCake', {
      diameter: 2,
      height: 1.2,
      tessellation: 40
    }, this.scene);
    this.cake.position = new BABYLON.Vector3(0, 0.78, 0);
    this.cake.material = this.materials.cakeSponge();
    this.cake.parent = this.cakeRoot;
    this.cake.isPickable = true;

    this.fondantLayer = BABYLON.MeshBuilder.CreateCylinder('fondantLayer', {
      diameter: 2.08,
      height: 1.26,
      tessellation: 40
    }, this.scene);
    this.fondantLayer.position = new BABYLON.Vector3(0, 0.78, 0);
    this.fondantLayer.parent = this.cakeRoot;
    this.fondantLayer.isVisible = false;
    this.fondantLayer.material = this.materials.frosting(this.availableColors[this.selectedColorKey]);
  }

  _buildToolPanel() {
    const panel = new BABYLON.GUI.StackPanel('decorateToolPanel');
    panel.width = '220px';
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    panel.left = '24px';
    this.hud.texture.addControl(panel);

    const title = new BABYLON.GUI.TextBlock('decorateTitle', 'Decorate');
    title.height = '34px';
    title.color = '#ffffff';
    title.fontSize = 26;
    title.outlineWidth = 2;
    title.outlineColor = '#000000';
    panel.addControl(title);

    panel.addControl(this._makeToolButton('toolFrosting', 'Frosting', () => {
      this.selectedTool = 'frosting';
      this.selectedToppingType = null;
      this._updateToolStatus();
    }));

    panel.addControl(this._makeToolButton('toolToppings', 'Toppings', () => {
      this.selectedTool = 'toppings';
      this._updateToolStatus();
    }));

    panel.addControl(this._makeToolButton('toolFondant', 'Fondant', () => {
      this.selectedTool = 'fondant';
      this._toggleFondant();
      this._updateToolStatus();
    }));

    this.toolStatusText = new BABYLON.GUI.TextBlock('toolStatus', 'Tool: Frosting');
    this.toolStatusText.height = '72px';
    this.toolStatusText.color = '#ffffff';
    this.toolStatusText.fontSize = 15;
    this.toolStatusText.textWrapping = true;
    panel.addControl(this.toolStatusText);
  }

  _buildColorPicker() {
    const panel = new BABYLON.GUI.StackPanel('decorateColorPanel');
    panel.width = '340px';
    panel.isVertical = false;
    panel.height = '58px';
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.paddingBottom = '24px';
    this.hud.texture.addControl(panel);

    Object.entries(this.availableColors).forEach(([key, color]) => {
      const button = BABYLON.GUI.Button.CreateSimpleButton(`color_${key}`, '');
      button.width = '34px';
      button.height = '34px';
      button.cornerRadius = 17;
      button.thickness = 2;
      button.color = key === this.selectedColorKey ? '#ffffff' : '#222222';
      button.background = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
      button.paddingLeft = '6px';
      button.paddingRight = '6px';
      button.onPointerClickObservable.add(() => {
        this.selectedColorKey = key;
        if (this.fondantLayer.isVisible) {
          this.fondantLayer.material = this.materials.frosting(this.availableColors[this.selectedColorKey]);
        }
        panel.children.forEach(child => {
          child.color = child.name === `color_${key}` ? '#ffffff' : '#222222';
        });
        this._updateToolStatus();
      });
      panel.addControl(button);
    });
  }

  _buildToppingShelf() {
    const shelf = BABYLON.MeshBuilder.CreateBox('decorateShelf', {
      width: 5.2,
      height: 0.14,
      depth: 0.55
    }, this.scene);
    shelf.position = new BABYLON.Vector3(0, 0.1, -2.35);
    shelf.material = this.materials.wood();

    const types = ['strawberry', 'blueberry', 'sprinkles', 'chocolate'];
    const start = -1.8;
    types.forEach((type, index) => {
      const sample = this._createToppingMesh(`sample_${type}`, type, true);
      sample.position = new BABYLON.Vector3(start + (index * 1.2), 0.34, -2.35);
      sample.metadata = { sample: true, toppingType: type };
      sample.isPickable = true;
      this.sampleMeshes.push(sample);
    });
  }

  _makeToolButton(name, label, onClick) {
    const button = BABYLON.GUI.Button.CreateSimpleButton(name, label);
    button.width = '180px';
    button.height = '40px';
    button.color = '#ffffff';
    button.background = '#3a3a52';
    button.cornerRadius = 10;
    button.thickness = 2;
    button.paddingTop = '6px';
    button.onPointerClickObservable.add(onClick);
    return button;
  }

  _setupPointerEvents() {
    this.scene.onPointerDown = (evt) => {
      const pick = this.scene.pick(evt.offsetX, evt.offsetY);
      if (!pick.hit) return;

      if (pick.pickedMesh && pick.pickedMesh.metadata && pick.pickedMesh.metadata.sample) {
        this.selectedTool = 'toppings';
        this.selectedToppingType = pick.pickedMesh.metadata.toppingType;
        this._updateToolStatus();
        this.hud.showMessage(`Holding ${this.selectedToppingType}.`, 900);
        return;
      }

      if (pick.pickedMesh !== this.cake && pick.pickedMesh !== this.fondantLayer) {
        return;
      }

      if (this.selectedTool === 'frosting') {
        this.isPainting = true;
        this.frostingPaths += 1;
        this._placeFrostingDot(pick);
      } else if (this.selectedTool === 'toppings' && this.selectedToppingType) {
        this._placeTopping(pick, this.selectedToppingType);
      } else if (this.selectedTool === 'fondant') {
        this._toggleFondant();
        this._updateToolStatus();
      }
    };

    this.scene.onPointerMove = (evt) => {
      if (!this.isPainting) return;
      const pick = this.scene.pick(evt.offsetX, evt.offsetY, mesh => mesh === this.cake || mesh === this.fondantLayer);
      if (pick.hit) {
        this._placeFrostingDot(pick);
      }
    };

    this.scene.onPointerUp = () => {
      this.isPainting = false;
      this.lastFrostPoint = null;
    };
  }

  _getPickNormal(pick) {
    if (pick.getNormal) {
      const normal = pick.getNormal(true);
      if (normal) return normal.normalize();
    }
    return pick.pickedPoint.subtract(this.cake.getAbsolutePosition()).normalize();
  }

  _placeFrostingDot(pick) {
    const point = pick.pickedPoint.clone();
    if (this.lastFrostPoint && BABYLON.Vector3.Distance(this.lastFrostPoint, point) < 0.12) {
      return;
    }

    const normal = this._getPickNormal(pick);
    const dot = BABYLON.MeshBuilder.CreateSphere(`frostDot${this.itemsPlaced}`, {
      diameter: 0.12,
      segments: 8
    }, this.scene);
    dot.material = this.materials.frosting(this.availableColors[this.selectedColorKey]);
    dot.parent = this.cakeRoot;
    dot.setAbsolutePosition(point.add(normal.scale(0.06)));

    this._registerDecorationPoint(point, 0.06);
    this.lastFrostPoint = point;
    this.itemsPlaced += 1;
    this.colorsUsed.add(this.selectedColorKey);
    this._updateScore();
    if (this.sounds) this.sounds.frosting();
  }

  _placeTopping(pick, type) {
    const topping = this._createToppingMesh(`placed_${type}_${this.itemsPlaced}`, type, false);
    const point = pick.pickedPoint.clone();
    const normal = this._getPickNormal(pick);
    topping.parent = this.cakeRoot;
    topping.setAbsolutePosition(point.add(normal.scale(0.1)));
    topping.rotation = new BABYLON.Vector3(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);

    this._registerDecorationPoint(point, 0.14);
    this.itemsPlaced += 1;
    this.colorsUsed.add(this.selectedColorKey);
    this._updateScore();
    if (this.sounds) this.sounds.placeItem();
  }

  _registerDecorationPoint(point, threshold) {
    if (this.decorationPoints.some(existing => BABYLON.Vector3.Distance(existing.point, point) < threshold)) {
      this.overlaps += 1;
    }
    this.decorationPoints.push({ point: point.clone(), threshold });
  }

  _createToppingMesh(name, type, isSample) {
    let mesh;
    switch (type) {
      case 'strawberry':
        mesh = BABYLON.MeshBuilder.CreateSphere(name, { diameter: isSample ? 0.24 : 0.18, segments: 12 }, this.scene);
        mesh.material = this.materials.food(new BABYLON.Color3(0.95, 0.2, 0.25));
        break;
      case 'blueberry':
        mesh = BABYLON.MeshBuilder.CreateSphere(name, { diameter: isSample ? 0.22 : 0.14, segments: 12 }, this.scene);
        mesh.material = this.materials.food(new BABYLON.Color3(0.22, 0.36, 0.88));
        break;
      case 'sprinkles':
        mesh = BABYLON.MeshBuilder.CreateCylinder(name, {
          diameter: isSample ? 0.08 : 0.05,
          height: isSample ? 0.32 : 0.18,
          tessellation: 8
        }, this.scene);
        mesh.rotation.z = Math.PI / 3;
        mesh.material = this.materials.frosting(this.availableColors[this.selectedColorKey]);
        break;
      default:
        mesh = BABYLON.MeshBuilder.CreateBox(name, {
          width: isSample ? 0.26 : 0.14,
          height: isSample ? 0.16 : 0.08,
          depth: isSample ? 0.18 : 0.1
        }, this.scene);
        mesh.material = this.materials.food(new BABYLON.Color3(0.37, 0.22, 0.15));
        break;
    }

    mesh.isPickable = !!isSample;
    return mesh;
  }

  _toggleFondant() {
    this.fondantLayer.isVisible = !this.fondantLayer.isVisible;
    this.fondantLayer.material = this.materials.frosting(this.availableColors[this.selectedColorKey]);
    if (this.fondantLayer.isVisible && !this.fondantApplied) {
      this.itemsPlaced += 1;
      this.fondantApplied = true;
      this.colorsUsed.add(this.selectedColorKey);
    }
    this._updateScore();
  }

  _updateToolStatus() {
    if (!this.toolStatusText) return;
    const toppingLabel = this.selectedToppingType ? `\nHolding: ${this.selectedToppingType}` : '';
    const fondantLabel = this.fondantLayer && this.fondantLayer.isVisible ? '\nFondant layer: on' : '';
    this.toolStatusText.text = `Tool: ${this.selectedTool}\nColor: ${this.selectedColorKey}${toppingLabel}${fondantLabel}`;
  }

  _updateScore() {
    const accuracy = Math.min(this.itemsPlaced / 10, 1) * 40;
    const creativity = Math.min(this.colorsUsed.size / 3, 1) * 30;
    let neatness = Math.max(0, 30 - (this.overlaps * 5));
    if (this.hasBoost('fondant') && this.fondantLayer.isVisible) {
      neatness = Math.min(30, neatness + 8);
    }
    this.setScore(accuracy + creativity + neatness);
  }

  _finalizeDecorating(timedOut) {
    this._updateScore();
    const decorateQuality = this.score >= 80
      ? 'masterpiece'
      : this.score >= 50
        ? 'party-ready'
        : 'messy';

    this.completePhase({
      itemsPlaced: this.itemsPlaced,
      colorsUsed: Array.from(this.colorsUsed),
      frostingPaths: this.frostingPaths,
      decorateQuality,
      timedOut
    });
  }

  update(dt) {
    if (this.isComplete) return;

    this.sampleMeshes.forEach(sample => {
      if (!sample || sample.isDisposed()) return;
      const isHeld = this.selectedToppingType && sample.metadata && sample.metadata.toppingType === this.selectedToppingType;
      const targetScale = isHeld ? 1.15 : 1;
      sample.scaling = BABYLON.Vector3.Lerp(sample.scaling, new BABYLON.Vector3(targetScale, targetScale, targetScale), dt * 8);
      if (sample.metadata && sample.metadata.toppingType === 'sprinkles') {
        sample.rotation.y += dt * 2;
      }
    });

    if (this.fondantLayer && this.fondantLayer.isVisible) {
      this.fondantLayer.material = this.materials.frosting(this.availableColors[this.selectedColorKey]);
    }
  }

  onTimeUp() {
    this._finalizeDecorating(true);
  }

  dispose() {
    this.scene.onPointerDown = null;
    this.scene.onPointerMove = null;
    this.scene.onPointerUp = null;

    this.sampleMeshes.forEach(m => { if (m && !m.isDisposed()) m.dispose(); });
    this.sampleMeshes = [];
    this.decorationPoints = [];

    if (this.toolStatusText) this.toolStatusText.dispose();

    this.cakeRoot = null;
    this.turntable = null;
    this.cake = null;
    this.fondantLayer = null;
    this.toolStatusText = null;
    this.camera = null;

    super.dispose();
  }
}

window.DecorateScene3D = DecorateScene3D;