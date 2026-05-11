// Evil Jeopardy 1.2 — PresentScene3D (Cake Presentation Minigame)

class PresentScene3D extends BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options) {
    super(engine, canvas, socketBridge, options);
    this.timeLimit = 45;

    this.camera = null;
    this.presentationRoot = null;
    this.activePlating = null;
    this.activePlatingTopY = 0.2;
    this.cake = null;
    this.platingChoice = null;
    this.selectedGarnishType = null;
    this.garnishCount = 0;
    this.lightingChoice = null;
    this.isRevealing = false;

    this.previewPlatings = [];
    this.garnishSamples = [];
    this.placedGarnishes = [];
    this.revealCamera = null;
    this.revealHandle = null;
    this.confetti = null;
    this.presentationSpot = null;
    this.selectionText = null;
    this.revealTimeout = null;
  }

  getPhaseName() { return 'PRESENT'; }

  async create() {
    this.camera = CameraRigs.orbit(this.scene, this.canvas, {
      alpha: -Math.PI / 2,
      beta: Math.PI / 3,
      distance: 8,
      target: new BABYLON.Vector3(0, 1.1, 0)
    });
    if (this.camera.inputs.attached.pointers) {
      this.camera.inputs.attached.pointers.buttons = [1, 2];
    }
    this.camera.lowerRadiusLimit = 5;
    this.camera.upperRadiusLimit = 10;

    this._buildTable();
    this._buildPresentationCake();
    this._buildPlatingOptions();
    this._buildGarnishTray();
    this._buildLightingPanel();
    this._setupPointerEvents();
    this._selectPlating('plate');
    this._applyLighting('warm');
    this._updateSelectionText();
    this._updateScore();
    this.hud.showMessage('Pick a base, place garnishes, then confirm the reveal.', 2400);
  }

  _buildTable() {
    const table = BABYLON.MeshBuilder.CreateBox('presentationTable', {
      width: 8.5,
      height: 0.4,
      depth: 5.8
    }, this.scene);
    table.position = new BABYLON.Vector3(0, -0.2, 0);
    table.material = this.materials.marble();
    table.isPickable = true;
  }

  _buildPresentationCake() {
    this.presentationRoot = new BABYLON.TransformNode('presentationRoot', this.scene);

    this.cake = BABYLON.MeshBuilder.CreateCylinder('presentationCake', {
      diameter: 1.8,
      height: 1,
      tessellation: 40
    }, this.scene);
    this.cake.material = this.materials.cakeSponge();
    this.cake.parent = this.presentationRoot;
    this.cake.position = new BABYLON.Vector3(0, 0.75, 0);

    const frostingTop = BABYLON.MeshBuilder.CreateCylinder('presentationFrostingTop', {
      diameter: 1.86,
      height: 0.12,
      tessellation: 40
    }, this.scene);
    frostingTop.material = this.materials.frosting(new BABYLON.Color3(0.98, 0.96, 0.94));
    frostingTop.parent = this.presentationRoot;
    frostingTop.position = new BABYLON.Vector3(0, 1.3, 0);
  }

  _buildPlatingOptions() {
    const options = ['stand', 'board', 'plate'];
    options.forEach((type, index) => {
      const preview = this._createPlatingMesh(`preview_${type}`, type, true);
      preview.position = new BABYLON.Vector3(-3.1, 0, -1.5 + (index * 1.4));
      preview.metadata = { platingType: type, sample: true };
      this.previewPlatings.push(preview);
    });
  }

  _buildGarnishTray() {
    const tray = BABYLON.MeshBuilder.CreateBox('garnishTray', {
      width: 1.2,
      height: 0.12,
      depth: 4.2
    }, this.scene);
    tray.position = new BABYLON.Vector3(3.15, 0.12, 0);
    tray.material = this.materials.wood();

    const types = ['mint', 'berries', 'shavings', 'flowers'];
    types.forEach((type, index) => {
      const garnish = this._createGarnishMesh(`sample_${type}`, type, true);
      garnish.position = new BABYLON.Vector3(3.15, 0.32, -1.4 + (index * 0.95));
      garnish.metadata = { garnishType: type, sample: true };
      this.garnishSamples.push(garnish);
    });
  }

  _buildLightingPanel() {
    const panel = new BABYLON.GUI.StackPanel('presentPanel');
    panel.width = '260px';
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    panel.left = '28px';
    panel.top = '84px';
    this.hud.texture.addControl(panel);

    const title = new BABYLON.GUI.TextBlock('presentTitle', 'Presentation');
    title.height = '34px';
    title.color = '#ffffff';
    title.fontSize = 24;
    title.outlineWidth = 2;
    title.outlineColor = '#000000';
    panel.addControl(title);

    this.selectionText = new BABYLON.GUI.TextBlock('presentSelection', 'Plating: none');
    this.selectionText.height = '66px';
    this.selectionText.color = '#ffffff';
    this.selectionText.fontSize = 15;
    this.selectionText.textWrapping = true;
    panel.addControl(this.selectionText);

    ['Warm', 'Cool', 'Dramatic'].forEach(label => {
      const button = BABYLON.GUI.Button.CreateSimpleButton(`light_${label}`, label);
      button.width = '180px';
      button.height = '36px';
      button.color = '#ffffff';
      button.cornerRadius = 10;
      button.thickness = 2;
      button.background = label === 'Warm' ? '#b75d34' : label === 'Cool' ? '#3a6fb7' : '#51435e';
      button.paddingTop = '6px';
      button.onPointerClickObservable.add(() => {
        this._applyLighting(label.toLowerCase());
        this._updateSelectionText();
        this._updateScore();
      });
      panel.addControl(button);
    });

    const confirm = BABYLON.GUI.Button.CreateSimpleButton('confirmPresentation', 'Confirm Reveal');
    confirm.width = '180px';
    confirm.height = '40px';
    confirm.color = '#ffffff';
    confirm.cornerRadius = 12;
    confirm.thickness = 2;
    confirm.background = '#2b9c54';
    confirm.paddingTop = '10px';
    confirm.onPointerClickObservable.add(() => this._startReveal());
    panel.addControl(confirm);
  }

  _setupPointerEvents() {
    this.scene.onPointerDown = (evt) => {
      if (this.isComplete || this.isRevealing) return;
      const pick = this.scene.pick(evt.offsetX, evt.offsetY);
      if (!pick.hit || !pick.pickedMesh) return;

      const metadata = pick.pickedMesh.metadata || {};
      if (metadata.sample && metadata.platingType) {
        this._selectPlating(metadata.platingType);
        return;
      }

      if (metadata.sample && metadata.garnishType) {
        this.selectedGarnishType = metadata.garnishType;
        this._updateSelectionText();
        this.hud.showMessage(`Selected ${this.selectedGarnishType}. Click the table to place it.`, 1000);
        return;
      }

      if (this.selectedGarnishType) {
        this._placeGarnish(pick.pickedPoint);
      }
    };
  }

  _createPlatingMesh(name, type, isPreview) {
    const root = new BABYLON.TransformNode(name, this.scene);
    const material = type === 'board' ? this.materials.wood() : this.materials.metal();

    if (type === 'stand') {
      const stem = BABYLON.MeshBuilder.CreateCylinder(`${name}_stem`, {
        diameter: 0.36,
        height: isPreview ? 0.85 : 0.95,
        tessellation: 24
      }, this.scene);
      stem.position.y = (isPreview ? 0.42 : 0.48);
      stem.material = material;
      stem.parent = root;
      stem.metadata = { platingType: type, sample: isPreview };

      const top = BABYLON.MeshBuilder.CreateCylinder(`${name}_top`, {
        diameter: 2.2,
        height: 0.12,
        tessellation: 40
      }, this.scene);
      top.position.y = isPreview ? 0.9 : 1.02;
      top.material = material;
      top.parent = root;
      top.metadata = { platingType: type, sample: isPreview };

      root.metadata = { platingType: type, sample: isPreview, topY: top.position.y + 0.06 };
    } else if (type === 'board') {
      const board = BABYLON.MeshBuilder.CreateBox(`${name}_board`, {
        width: 2.3,
        height: 0.14,
        depth: 2.3
      }, this.scene);
      board.position.y = 0.16;
      board.material = material;
      board.parent = root;
      board.metadata = { platingType: type, sample: isPreview };
      root.metadata = { platingType: type, sample: isPreview, topY: 0.23 };
    } else {
      const plate = BABYLON.MeshBuilder.CreateCylinder(`${name}_plate`, {
        diameter: 2.4,
        height: 0.1,
        tessellation: 40
      }, this.scene);
      plate.position.y = 0.14;
      plate.material = material;
      plate.parent = root;
      plate.metadata = { platingType: type, sample: isPreview };
      root.metadata = { platingType: type, sample: isPreview, topY: 0.19 };
    }

    return root;
  }

  _createGarnishMesh(name, type, isSample) {
    let mesh;
    switch (type) {
      case 'mint':
        mesh = BABYLON.MeshBuilder.CreateSphere(name, { diameter: isSample ? 0.24 : 0.16, segments: 12 }, this.scene);
        mesh.material = this.materials.food(new BABYLON.Color3(0.3, 0.8, 0.36));
        break;
      case 'berries':
        mesh = BABYLON.MeshBuilder.CreateSphere(name, { diameter: isSample ? 0.26 : 0.18, segments: 12 }, this.scene);
        mesh.material = this.materials.food(new BABYLON.Color3(0.82, 0.2, 0.25));
        break;
      case 'shavings':
        mesh = BABYLON.MeshBuilder.CreateBox(name, {
          width: isSample ? 0.38 : 0.22,
          height: isSample ? 0.08 : 0.04,
          depth: isSample ? 0.12 : 0.06
        }, this.scene);
        mesh.material = this.materials.food(new BABYLON.Color3(0.34, 0.21, 0.14));
        break;
      default:
        mesh = BABYLON.MeshBuilder.CreateSphere(name, { diameter: isSample ? 0.25 : 0.18, segments: 12 }, this.scene);
        mesh.material = this.materials.food(new BABYLON.Color3(0.72, 0.48, 0.94));
        break;
    }

    mesh.isPickable = !!isSample;
    return mesh;
  }

  _selectPlating(type) {
    this.platingChoice = type;

    if (this.activePlating) {
      this.activePlating.dispose();
      this.activePlating = null;
    }

    this.activePlating = this._createPlatingMesh(`active_${type}`, type, false);
    this.activePlating.position = new BABYLON.Vector3(0, 0, 0);
    this.activePlatingTopY = this.activePlating.metadata.topY || 0.2;

    this.cake.position.y = this.activePlatingTopY + 0.5;
    this.presentationRoot.rotation.y = 0;
    this._updateSelectionText();
    this._updateScore();
  }

  _placeGarnish(point) {
    const garnish = this._createGarnishMesh(`placed_${this.selectedGarnishType}_${this.garnishCount}`, this.selectedGarnishType, false);
    const target = new BABYLON.Vector3(
      BABYLON.Scalar.Clamp(point.x, -1.6, 1.6),
      this.activePlatingTopY + 0.08,
      BABYLON.Scalar.Clamp(point.z, -1.6, 1.6)
    );
    garnish.parent = this.presentationRoot;
    garnish.setAbsolutePosition(target);
    garnish.rotation.y = Math.random() * Math.PI;
    this.placedGarnishes.push(garnish);
    this.garnishCount += 1;
    this._updateSelectionText();
    this._updateScore();
  }

  _applyLighting(choice) {
    this.lightingChoice = choice;

    const key = this.scene.getLightByName('keyLight');
    const fill = this.scene.getLightByName('fillLight');
    const rim = this.scene.getLightByName('rimLight');

    if (!this.presentationSpot) {
      this.presentationSpot = new BABYLON.SpotLight(
        'presentationSpot',
        new BABYLON.Vector3(0, 5, 0),
        new BABYLON.Vector3(0, -1, 0),
        Math.PI / 3,
        12,
        this.scene
      );
      this.presentationSpot.intensity = 0;
      this.presentationSpot.diffuse = new BABYLON.Color3(1, 1, 1);
    }

    if (choice === 'warm') {
      if (key) {
        key.intensity = 0.95;
        key.diffuse = new BABYLON.Color3(1.0, 0.82, 0.62);
      }
      if (fill) {
        fill.intensity = 0.35;
        fill.diffuse = new BABYLON.Color3(0.96, 0.9, 0.82);
      }
      if (rim) rim.intensity = 0.22;
      this.presentationSpot.intensity = 0;
      this.scene.clearColor = new BABYLON.Color4(0.08, 0.08, 0.1, 1);
    } else if (choice === 'cool') {
      if (key) {
        key.intensity = 0.95;
        key.diffuse = new BABYLON.Color3(0.78, 0.88, 1.0);
      }
      if (fill) {
        fill.intensity = 0.18;
        fill.diffuse = new BABYLON.Color3(0.84, 0.92, 1.0);
      }
      if (rim) rim.intensity = 0.1;
      this.presentationSpot.intensity = 0;
      this.scene.clearColor = new BABYLON.Color4(0.05, 0.08, 0.12, 1);
    } else {
      if (key) {
        key.intensity = 0.15;
        key.diffuse = new BABYLON.Color3(0.8, 0.8, 0.8);
      }
      if (fill) fill.intensity = 0.04;
      if (rim) rim.intensity = 0.04;
      this.presentationSpot.intensity = 1.35;
      this.presentationSpot.diffuse = new BABYLON.Color3(1.0, 0.96, 0.9);
      this.scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.03, 1);
    }
  }

  _updateSelectionText() {
    if (!this.selectionText) return;
    this.selectionText.text = [
      `Plating: ${this.platingChoice || 'none'}`,
      `Garnish: ${this.selectedGarnishType || 'none selected'} (${this.garnishCount} placed)`,
      `Lighting: ${this.lightingChoice || 'none'}`
    ].join('\n');
  }

  _updateScore() {
    const platingScore = !this.platingChoice ? 0 : this.platingChoice === 'stand' ? 30 : 20;
    const garnishScore = Math.min(4, this.garnishCount) * 10;
    const lightingScore = this.lightingChoice ? 30 : 0;
    this.setScore(platingScore + garnishScore + lightingScore);
  }

  _startReveal() {
    if (this.isRevealing) return;
    this.isRevealing = true;
    this._updateScore();

    const reveal = CameraRigs.dramaticReveal(this.scene, new BABYLON.Vector3(0, this.cake.position.y, 0), {
      startDistance: 8
    });
    this.revealCamera = reveal.camera;
    this.revealCamera.lowerRadiusLimit = 6;
    this.revealCamera.upperRadiusLimit = 9;
    this.scene.activeCamera = this.revealCamera;
    reveal.play();

    this.confetti = ParticlePresets.confetti(this.scene, new BABYLON.Vector3(0, 2.8, 0), { rate: 120 });
    this.confetti.start();

    this.revealTimeout = setTimeout(() => {
      this._clearRevealEffects();
      this.completePhase({
        platingChoice: this.platingChoice,
        garnishCount: this.garnishCount,
        lightingChoice: this.lightingChoice
      });
    }, 3000);
  }

  update(dt) {
    if (this.isComplete) return;

    this.presentationRoot.rotation.y += dt * 0.18;
    this.previewPlatings.forEach(preview => {
      if (!preview || preview.isDisposed()) return;
      const selected = preview.metadata && preview.metadata.platingType === this.platingChoice;
      const scale = selected ? 1.08 : 1;
      preview.scaling = BABYLON.Vector3.Lerp(preview.scaling, new BABYLON.Vector3(scale, scale, scale), dt * 6);
    });
    this.garnishSamples.forEach(sample => {
      if (!sample || sample.isDisposed()) return;
      const selected = sample.metadata && sample.metadata.garnishType === this.selectedGarnishType;
      const scale = selected ? 1.12 : 1;
      sample.scaling = BABYLON.Vector3.Lerp(sample.scaling, new BABYLON.Vector3(scale, scale, scale), dt * 6);
    });
  }

  _clearRevealEffects() {
    if (this.revealTimeout) {
      clearTimeout(this.revealTimeout);
      this.revealTimeout = null;
    }
    if (this.confetti) {
      this.confetti.stop();
      this.confetti.dispose();
      this.confetti = null;
    }
  }

  onTimeUp() {
    this._clearRevealEffects();
    this._updateScore();
    this.completePhase({
      platingChoice: this.platingChoice,
      garnishCount: this.garnishCount,
      lightingChoice: this.lightingChoice,
      timedOut: true
    });
  }

  dispose() {
    this._clearRevealEffects();
    super.dispose();
  }
}

window.PresentScene3D = PresentScene3D;