class CowCombat3D extends BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options) {
    super(engine, canvas, socketBridge, options);
    this.options.isAbsurd = true;
    this.timeLimit = 50;

    this.elapsed = 0;
    this.beatInterval = 0.8;
    this.beatElapsed = 0;
    this.beatSequence = [0, 1, 2, 3];
    this.beatIndex = -1;
    this.activeUdderIndex = -1;
    this.activeUdderHit = true;
    this.clickPenaltyCooldown = 0;

    this.milkCount = 0;
    this.stunCount = 0;
    this.dodgeCount = 0;
    this.bucketFill = 0;

    this.cowRoot = null;
    this.body = null;
    this.udders = [];
    this.legs = [];
    this.bucketFillMesh = null;
    this.farmGlow = null;

    this.currentAttack = null;
    this.attackElapsed = 0;
    this.attackDuration = 0;
    this.nextAttackAt = 8 + (Math.random() * 2);
    this.attackLeg = null;
    this.baseCowPosition = new BABYLON.Vector3(0, 0, 0);
    this.chargeOffset = new BABYLON.Vector3(1.2, 0, 1.2);
    this.attackDodged = false;
    this.uddersInvalid = false;
    this.stunnedUntil = 0;

    this.stampedeTriggered = false;
    this.stampedeActive = false;
    this.stampedeCows = [];
    this.stampedeTimeouts = [];

    this.milkBursts = [];
    this.statusText = null;
    this.beatText = null;
    this.dodgeButton = null;
    this.dodgeButtonText = null;
    this.attackWarningText = null;
    this.udderLabels = [];
    this.promptArrowRoot = null;
    this.promptArrowAnchor = null;
    this.promptArrowLabel = null;
    this.promptArrowBob = 0;
    this._nextMooAt = 8 + (Math.random() * 4);
  }

  getPhaseName() { return 'MIX'; }

  async create() {
    this.scene.clearColor = new BABYLON.Color4(0.04, 0.08, 0.04, 1);
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
    this.scene.fogDensity = 0.03;
    this.scene.fogColor = new BABYLON.Color3(0.08, 0.16, 0.09);

    CameraRigs.isometric(this.scene, this.canvas, {
      distance: 18,
      orthoSize: 7,
      target: new BABYLON.Vector3(0, 1.1, 0.3)
    });

    this._buildFarm();
    this._buildCow();
    this._buildBucket();
    this._buildHud();
    this._buildPromptArrow();
    this._buildUdderLabels();
    this._setupInput();
    this._advanceBeat(true);
    this.hud.showMessage('Milk the glowing udder. Beware the angry cow.', 2200);
    this.hud.showMessage('Click the GLOWING udder when prompted!\nAvoid attacks — DODGE charges!\nFill the bucket with milk!', 3000);
  }

  _buildFarm() {
    const ground = BABYLON.MeshBuilder.CreateGround('cowGround', {
      width: 12,
      height: 10
    }, this.scene);
    ground.material = this.materials.food(new BABYLON.Color3(0.22, 0.34, 0.18));

    const mud = BABYLON.MeshBuilder.CreateGround('cowMud', {
      width: 5.2,
      height: 3.8
    }, this.scene);
    mud.position = new BABYLON.Vector3(0.6, 0.01, 0.4);
    mud.material = this.materials.food(new BABYLON.Color3(0.28, 0.2, 0.12));

    const fenceMat = this.materials.wood();
    for (let x = -5.5; x <= 5.5; x += 1.1) {
      this._makeFencePost(x, -4.3, fenceMat);
      this._makeFencePost(x, 4.3, fenceMat);
    }
    for (let z = -3.4; z <= 3.4; z += 1.1) {
      this._makeFencePost(-5.5, z, fenceMat);
      this._makeFencePost(5.5, z, fenceMat);
    }

    ['-4.3', '-3.7', '3.7', '4.3'].forEach((zValue) => {
      const rail = BABYLON.MeshBuilder.CreateBox(`cowRail_${zValue}`, {
        width: 11.2,
        height: 0.08,
        depth: 0.12
      }, this.scene);
      rail.position = new BABYLON.Vector3(0, 0.72 + (Number(zValue) > 0 ? 0.24 : 0), Number(zValue));
      rail.material = fenceMat;
    });

    ['-5.5', '-4.9', '4.9', '5.5'].forEach((xValue) => {
      const rail = BABYLON.MeshBuilder.CreateBox(`cowSideRail_${xValue}`, {
        width: 0.12,
        height: 0.08,
        depth: 7.8
      }, this.scene);
      rail.position = new BABYLON.Vector3(Number(xValue), 0.72 + (Math.abs(Number(xValue)) < 5 ? 0 : 0.24), 0);
      rail.material = fenceMat;
    });

    this.farmGlow = new BABYLON.PointLight('cowGlow', new BABYLON.Vector3(-3.5, 3, -2.2), this.scene);
    this.farmGlow.diffuse = new BABYLON.Color3(0.5, 1, 0.55);
    this.farmGlow.intensity = 0.7;
  }

  _makeFencePost(x, z, material) {
    const post = BABYLON.MeshBuilder.CreateBox(`post_${x}_${z}`, {
      width: 0.12,
      height: 0.9,
      depth: 0.12
    }, this.scene);
    post.position = new BABYLON.Vector3(x, 0.45, z);
    post.material = material;
  }

  _buildCow() {
    this.cowRoot = new BABYLON.TransformNode('cowRoot', this.scene);
    this.cowRoot.position.copyFrom(this.baseCowPosition);

    this.body = BABYLON.MeshBuilder.CreateBox('cowBody', {
      width: 1.5,
      height: 1,
      depth: 0.8
    }, this.scene);
    this.body.position = new BABYLON.Vector3(0, 1.15, 0);
    this.body.material = this.materials.food(new BABYLON.Color3(0.92, 0.92, 0.88));
    this.body.parent = this.cowRoot;

    const head = BABYLON.MeshBuilder.CreateBox('cowHead', {
      width: 0.58,
      height: 0.55,
      depth: 0.5
    }, this.scene);
    head.position = new BABYLON.Vector3(0.96, 1.27, 0);
    head.material = this.materials.food(new BABYLON.Color3(0.9, 0.9, 0.85));
    head.parent = this.cowRoot;

    const hornMat = this.materials.food(new BABYLON.Color3(0.95, 0.84, 0.65));
    [-0.16, 0.16].forEach((z, index) => {
      const horn = BABYLON.MeshBuilder.CreateCylinder(`cowHorn${index}`, {
        diameterTop: 0.02,
        diameterBottom: 0.08,
        height: 0.24,
        tessellation: 10
      }, this.scene);
      horn.rotation.z = Math.PI / 2;
      horn.position = new BABYLON.Vector3(1.18, 1.55, z);
      horn.material = hornMat;
      horn.parent = this.cowRoot;
    });

    const legPositions = [
      new BABYLON.Vector3(-0.45, 0.45, -0.25),
      new BABYLON.Vector3(-0.45, 0.45, 0.25),
      new BABYLON.Vector3(0.45, 0.45, -0.25),
      new BABYLON.Vector3(0.45, 0.45, 0.25)
    ];
    legPositions.forEach((position, index) => {
      const leg = BABYLON.MeshBuilder.CreateCylinder(`cowLeg${index}`, {
        diameter: 0.16,
        height: 0.9,
        tessellation: 10
      }, this.scene);
      leg.position = position;
      leg.material = this.materials.food(new BABYLON.Color3(0.18, 0.14, 0.12));
      leg.parent = this.cowRoot;
      this.legs.push(leg);
    });

    const udderBase = BABYLON.MeshBuilder.CreateSphere('udderBase', {
      diameter: 0.44,
      segments: 16
    }, this.scene);
    udderBase.position = new BABYLON.Vector3(0.1, 0.72, 0);
    udderBase.scaling.y = 0.7;
    udderBase.material = this.materials.food(new BABYLON.Color3(1, 0.74, 0.82));
    udderBase.parent = this.cowRoot;

    [
      new BABYLON.Vector3(-0.12, 0.4, -0.1),
      new BABYLON.Vector3(-0.12, 0.4, 0.1),
      new BABYLON.Vector3(0.12, 0.4, -0.1),
      new BABYLON.Vector3(0.12, 0.4, 0.1)
    ].forEach((offset, index) => {
      const udder = BABYLON.MeshBuilder.CreateSphere(`udder_${index}`, {
        diameter: 0.12,
        segments: 12
      }, this.scene);
      udder.position = offset;
      udder.isPickable = true;
      udder.metadata = { udderIndex: index };
      udder.parent = this.cowRoot;

      const material = this.materials.food(new BABYLON.Color3(1, 0.72, 0.82)).clone(`udderMat_${index}`);
      material.emissiveColor = new BABYLON.Color3(0.02, 0.01, 0.02);
      udder.material = material;

      this.udders.push({ mesh: udder, material });
    });
  }

  _buildPromptArrow() {
    this.promptArrowRoot = new BABYLON.TransformNode('udderPromptArrow', this.scene);
    this.promptArrowRoot.parent = this.cowRoot;
    this.promptArrowRoot.position = new BABYLON.Vector3(0.1, 1.25, 0);

    const arrowMaterial = this.materials.food(new BABYLON.Color3(0.3, 1, 0.45)).clone('udderPromptMat');
    arrowMaterial.emissiveColor = new BABYLON.Color3(0.24, 0.8, 0.3);
    arrowMaterial.alpha = 0.95;

    const shaft = BABYLON.MeshBuilder.CreateCylinder('udderPromptShaft', {
      diameter: 0.09,
      height: 0.45,
      tessellation: 16
    }, this.scene);
    shaft.position = new BABYLON.Vector3(0, 0.24, 0);
    shaft.material = arrowMaterial;
    shaft.parent = this.promptArrowRoot;

    this.promptArrowAnchor = BABYLON.MeshBuilder.CreateCylinder('udderPromptCone', {
      diameterTop: 0,
      diameterBottom: 0.24,
      height: 0.34,
      tessellation: 16
    }, this.scene);
    this.promptArrowAnchor.position = new BABYLON.Vector3(0, -0.08, 0);
    this.promptArrowAnchor.rotation.x = Math.PI;
    this.promptArrowAnchor.material = arrowMaterial;
    this.promptArrowAnchor.parent = this.promptArrowRoot;

    this.promptArrowLabel = new BABYLON.GUI.TextBlock('udderPromptLabel', '🤚 SQUEEZE!');
    this.promptArrowLabel.color = '#8dff96';
    this.promptArrowLabel.fontSize = 28;
    this.promptArrowLabel.fontWeight = 'bold';
    this.promptArrowLabel.outlineWidth = 5;
    this.promptArrowLabel.outlineColor = '#0b2d0f';
    this.promptArrowLabel.shadowBlur = 12;
    this.promptArrowLabel.shadowColor = '#65ff7d';
    this.promptArrowLabel.linkOffsetY = -120;
    this.hud.texture.addControl(this.promptArrowLabel);
    this.promptArrowLabel.linkWithMesh(this.promptArrowAnchor);
  }

  _buildBucket() {
    const bucketOuter = BABYLON.MeshBuilder.CreateCylinder('bucketOuter', {
      diameterTop: 0.9,
      diameterBottom: 0.72,
      height: 1,
      tessellation: 24
    }, this.scene);
    bucketOuter.position = new BABYLON.Vector3(2.55, 0.52, 0.65);
    bucketOuter.material = this.materials.metal();

    this.bucketFillMesh = BABYLON.MeshBuilder.CreateCylinder('bucketMilk', {
      diameterTop: 0.64,
      diameterBottom: 0.56,
      height: 0.01,
      tessellation: 24
    }, this.scene);
    this.bucketFillMesh.position = new BABYLON.Vector3(2.55, 0.08, 0.65);
    this.bucketFillMesh.material = this.materials.food(new BABYLON.Color3(0.96, 0.98, 1));
  }

  _buildHud() {
    const panel = new BABYLON.GUI.StackPanel('cowInfo');
    panel.width = '320px';
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    panel.left = '24px';
    this.hud.texture.addControl(panel);

    this.statusText = new BABYLON.GUI.TextBlock('cowStatus', 'Awaiting the rhythm…');
    this.statusText.height = '78px';
    this.statusText.color = '#ddffdd';
    this.statusText.fontSize = 18;
    this.statusText.textWrapping = true;
    this.statusText.outlineWidth = 2;
    this.statusText.outlineColor = '#000000';
    panel.addControl(this.statusText);

    this.beatText = new BABYLON.GUI.TextBlock('cowBeat', 'Press udder #--!');
    this.beatText.height = '38px';
    this.beatText.color = '#ffffff';
    this.beatText.fontSize = 22;
    this.beatText.fontWeight = 'bold';
    this.beatText.outlineWidth = 3;
    this.beatText.outlineColor = '#000000';
    panel.addControl(this.beatText);

    this.attackWarningText = new BABYLON.GUI.TextBlock('cowAttackWarning', '');
    this.attackWarningText.width = '100%';
    this.attackWarningText.height = '160px';
    this.attackWarningText.color = '#ff4444';
    this.attackWarningText.fontSize = 42;
    this.attackWarningText.fontWeight = 'bold';
    this.attackWarningText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.attackWarningText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    this.attackWarningText.outlineWidth = 5;
    this.attackWarningText.outlineColor = '#000000';
    this.attackWarningText.shadowBlur = 12;
    this.attackWarningText.shadowColor = '#000000';
    this.attackWarningText.isVisible = false;
    this.hud.texture.addControl(this.attackWarningText);

    this.dodgeButton = BABYLON.GUI.Button.CreateSimpleButton('cowDodge', 'DODGE!');
    this.dodgeButton.width = '180px';
    this.dodgeButton.height = '54px';
    this.dodgeButton.cornerRadius = 14;
    this.dodgeButton.thickness = 2;
    this.dodgeButton.color = '#ffffff';
    this.dodgeButton.background = '#c0392b';
    this.dodgeButton.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.dodgeButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.dodgeButton.paddingBottom = '28px';
    this.dodgeButton.isVisible = false;
    this.dodgeButton.onPointerClickObservable.add(() => this._tryDodge());
    this.hud.texture.addControl(this.dodgeButton);
    this.dodgeButtonText = this.dodgeButton.children[0] || null;
    if (this.dodgeButtonText) {
      this.dodgeButtonText.fontSize = 24;
      this.dodgeButtonText.fontWeight = 'bold';
    }
  }

  _buildUdderLabels() {
    this.udderLabels = this.udders.map((udder, index) => {
      const label = new BABYLON.GUI.TextBlock(`udderLabel_${index}`, String(index + 1));
      label.color = '#ffffff';
      label.fontSize = 24;
      label.fontWeight = 'bold';
      label.outlineWidth = 4;
      label.outlineColor = '#000000';
      label.linkOffsetY = -26;
      this.hud.texture.addControl(label);
      label.linkWithMesh(udder.mesh);
      return label;
    });
  }

  _setupInput() {
    this.scene.onPointerDown = () => {
      if (this.isComplete || this.elapsed < this.stunnedUntil || this.stampedeActive) {
        return;
      }

      const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => Boolean(mesh && mesh.metadata && typeof mesh.metadata.udderIndex === 'number'));
      if (!pick.hit || !pick.pickedMesh) {
        return;
      }

      const udderIndex = pick.pickedMesh.metadata.udderIndex;
      if (this.currentAttack === 'kick') {
        this._stunPlayer('The cow kicked you away from the udder!');
        return;
      }

      if (this.uddersInvalid || this.currentAttack === 'spin') {
        this._applyPenalty('The udder rhythm is scrambled!');
        return;
      }

      if (udderIndex === this.activeUdderIndex && !this.activeUdderHit) {
        this.activeUdderHit = true;
        this.milkCount += 1;
        this.addScore(5);
        this.bucketFill = Math.min(1, this.bucketFill + 0.06);
        this._spawnMilkBurst(this.udders[udderIndex].mesh.getAbsolutePosition(), this.bucketFillMesh.position.clone());
        this.statusText.text = 'Perfect squeeze. Keep milking!';
        if (this.sounds) {
          if (this.sounds.beatHit) this.sounds.beatHit();
          if (this.sounds.milkSquirt) this.sounds.milkSquirt();
        }
      } else {
        if (this.sounds && this.sounds.beatMiss) this.sounds.beatMiss();
        this._applyPenalty('Wrong udder. The cow glares at you.');
      }
    };
  }

  _advanceBeat(force = false) {
    if (!force && !this.activeUdderHit && !this.uddersInvalid) {
      this._applyPenalty('Missed the milking rhythm.');
    }

    this.beatIndex = (this.beatIndex + 1) % this.beatSequence.length;
    this.activeUdderIndex = this.beatSequence[this.beatIndex];
    this.activeUdderHit = false;
    this.beatElapsed = 0;
    this.beatText.text = `Press udder #${this.activeUdderIndex + 1}!`;
    if (this.sounds && this.sounds.hoofStomp) this.sounds.hoofStomp();
  }

  _applyPenalty(message) {
    if (this.clickPenaltyCooldown > 0) {
      return;
    }
    this.clickPenaltyCooldown = 0.25;
    this.addScore(-2);
    this.statusText.text = message;
  }

  _stunPlayer(message, penalty = -2) {
    this.stunnedUntil = this.elapsed + 2;
    this.stunCount += 1;
    this.statusText.text = message;
    this.addScore(penalty);
    if (this.sounds && this.sounds.stunned) this.sounds.stunned();
  }

  _setAttackWarning(text, color) {
    this.attackWarningText.text = text || '';
    this.attackWarningText.color = color || '#ff4444';
    this.attackWarningText.isVisible = Boolean(text);
  }

  _showDodgeButton(text = 'DODGE!', background = '#c0392b', width = 180, height = 54) {
    this.dodgeButton.width = `${width}px`;
    this.dodgeButton.height = `${height}px`;
    this.dodgeButton.background = background;
    this.dodgeButton.scaleX = 1;
    this.dodgeButton.scaleY = 1;
    this.dodgeButton.isVisible = true;
    if (this.dodgeButtonText) {
      this.dodgeButtonText.text = text;
      this.dodgeButtonText.fontSize = Math.round(height * 0.42);
    }
  }

  _hideDodgeButton() {
    this.dodgeButton.isVisible = false;
    this.dodgeButton.scaleX = 1;
    this.dodgeButton.scaleY = 1;
    this.dodgeButton.width = '180px';
    this.dodgeButton.height = '54px';
    this.dodgeButton.background = '#c0392b';
    if (this.dodgeButtonText) {
      this.dodgeButtonText.text = 'DODGE!';
      this.dodgeButtonText.fontSize = 24;
    }
  }

  _startAttack(type) {
    this.currentAttack = type;
    this.attackElapsed = 0;
    this.attackDodged = false;
    this.attackDuration = type === 'kick' ? 1.2 : type === 'charge' ? 1.4 : 1.1;
    this.uddersInvalid = type === 'spin';
    this.attackLeg = type === 'kick' ? this.legs[2 + Math.floor(Math.random() * 2)] : null;

    if (this.sounds && this.sounds.angryMoo) this.sounds.angryMoo();

    if (type === 'kick') {
      this.statusText.text = 'KICK! Keep your hands away.';
      this._setAttackWarning('🦵 KICK! HANDS OFF!', '#ff4444');
    } else if (type === 'charge') {
      this.statusText.text = 'CHARGE! Hit DODGE!';
      this._showDodgeButton('DODGE NOW!', '#d63031', 260, 78);
      this._setAttackWarning('🐂 CHARGE! DODGE NOW!', '#ff4444');
    } else {
      this.statusText.text = 'SPIN! The udders are all wrong.';
      this._setAttackWarning('🌀 SPIN! WAIT IT OUT!', '#ffff44');
    }
  }

  _finishAttack() {
    if (this.currentAttack === 'charge' && !this.attackDodged) {
      this._stunPlayer('The cow charged straight through you!');
    }

    this.currentAttack = null;
    this.attackElapsed = 0;
    this.attackDuration = 0;
    this.attackDodged = false;
    this.uddersInvalid = false;
    this._setAttackWarning('', null);
    this._hideDodgeButton();
    this.cowRoot.position.copyFrom(this.baseCowPosition);
    this.cowRoot.rotation.y = 0;
    this.legs.forEach((leg) => {
      leg.rotation.x = 0;
      leg.rotation.z = 0;
    });
    this.nextAttackAt = this.elapsed + 8 + (Math.random() * 2);
  }

  _tryDodge() {
    if (this.stampedeActive) {
      const target = this.stampedeCows
        .filter((cow) => !cow.resolved && !cow.dodged && (cow.chargeDuration - cow.chargeElapsed) <= 0.8)
        .sort((a, b) => (a.chargeDuration - a.chargeElapsed) - (b.chargeDuration - b.chargeElapsed))[0];
      if (!target) {
        return;
      }
      target.dodged = true;
      this.dodgeCount += 1;
      this.addScore(5);
      this.statusText.text = 'You sidestepped the mini cow!';
      if (this.sounds && this.sounds.dodge) this.sounds.dodge();
      return;
    }

    if (this.currentAttack !== 'charge' || this.attackDodged) {
      return;
    }
    this.attackDodged = true;
    this.dodgeCount += 1;
    this.statusText.text = 'You dodged the horned projectile oven-cow.';
    this._hideDodgeButton();
    if (this.sounds && this.sounds.dodge) this.sounds.dodge();
  }

  _startStampede() {
    this.stampedeActive = true;
    this.stampedeTriggered = true;
    this.stampedeCows = [];
    this._hideDodgeButton();
    this.hud.showMessage('🐄🐄🐄 STAMPEDE!', 2000);
    this.statusText.text = 'Stampede incoming! Dodge the mini cows.';
    if (this.sounds) {
      if (this.sounds.stampede) this.sounds.stampede();
      if (this.sounds.moo) this.sounds.moo();
    }

    const directions = [
      { x: -6, z: 0, angle: Math.PI / 2 },
      { x: 6, z: 0, angle: -Math.PI / 2 },
      { x: 0, z: -6, angle: 0 }
    ];

    directions.forEach((dir, i) => {
      const timeoutId = setTimeout(() => {
        if (this._disposed) return;
        this._spawnMiniCow(dir, i);
      }, i * 800);
      this.stampedeTimeouts.push(timeoutId);
    });
  }

  _spawnMiniCow(dir, index) {
    const root = new BABYLON.TransformNode(`miniCowRoot_${index}`, this.scene);
    root.position = new BABYLON.Vector3(dir.x, 0, dir.z);
    root.rotation.y = dir.angle;
    root.scaling.setAll(0.5);

    const body = BABYLON.MeshBuilder.CreateBox(`miniCowBody_${index}`, {
      width: 1.5,
      height: 1,
      depth: 0.8
    }, this.scene);
    body.position = new BABYLON.Vector3(0, 1.05, 0);
    body.material = this.materials.food(new BABYLON.Color3(0.88, 0.88, 0.84));
    body.parent = root;

    [
      new BABYLON.Vector3(-0.45, 0.45, -0.25),
      new BABYLON.Vector3(-0.45, 0.45, 0.25),
      new BABYLON.Vector3(0.45, 0.45, -0.25),
      new BABYLON.Vector3(0.45, 0.45, 0.25)
    ].forEach((position, legIndex) => {
      const leg = BABYLON.MeshBuilder.CreateCylinder(`miniCowLeg_${index}_${legIndex}`, {
        diameter: 0.18,
        height: 0.9,
        tessellation: 10
      }, this.scene);
      leg.position = position;
      leg.material = this.materials.food(new BABYLON.Color3(0.2, 0.15, 0.12));
      leg.parent = root;
    });

    this.stampedeCows.push({
      root,
      chargeElapsed: 0,
      chargeDuration: 2.0,
      dodged: false,
      resolved: false,
      warningShown: false,
      startPosition: new BABYLON.Vector3(dir.x, 0, dir.z),
      dodgeOffset: new BABYLON.Vector3(dir.z * 0.35, 0, -dir.x * 0.35),
      exitPosition: new BABYLON.Vector3(-dir.x * 1.5, 0, -dir.z * 1.5)
    });
  }

  _finishStampede() {
    this.stampedeActive = false;
    this._hideDodgeButton();
    this.statusText.text = 'Stampede over. Back to milking.';
    this.stampedeCows.forEach((cow) => {
      if (cow.root) cow.root.dispose(false, true);
    });
    this.stampedeCows = [];
    this.nextAttackAt = Math.max(this.nextAttackAt, this.elapsed + 5);
  }

  _spawnMilkBurst(start, end) {
    const droplet = BABYLON.MeshBuilder.CreateSphere(`milkDrop_${performance.now()}`, {
      diameter: 0.12,
      segments: 8
    }, this.scene);
    droplet.material = this.materials.food(new BABYLON.Color3(0.96, 0.98, 1));
    droplet.position.copyFrom(start);

    this.milkBursts.push({
      mesh: droplet,
      start: start.clone(),
      end: end.clone(),
      duration: 0.45,
      elapsed: 0
    });
  }

  _scheduleNextMoo() {
    this._nextMooAt = this.elapsed + 8 + (Math.random() * 4);
  }

  _updateStampede(dt) {
    let shouldShowDodge = false;
    this.stampedeCows.forEach((cow) => {
      if (cow.resolved) {
        return;
      }

      cow.chargeElapsed += dt;
      const remaining = cow.chargeDuration - cow.chargeElapsed;

      if (!cow.dodged) {
        if (!cow.warningShown && remaining <= 0.8) {
          cow.warningShown = true;
        }
        if (remaining <= 0.8) {
          shouldShowDodge = true;
        }

        const t = BABYLON.Scalar.Clamp(cow.chargeElapsed / cow.chargeDuration, 0, 1);
        cow.root.position = BABYLON.Vector3.Lerp(cow.startPosition, BABYLON.Vector3.Zero(), t);

        if (cow.chargeElapsed >= cow.chargeDuration) {
          cow.resolved = true;
          this._stunPlayer('Mini cow trampled you!', -10);
        }
        return;
      }

      const dodgeT = BABYLON.Scalar.Clamp(cow.chargeElapsed / (cow.chargeDuration + 0.65), 0, 1);
      const basePosition = BABYLON.Vector3.Lerp(cow.startPosition, cow.exitPosition, dodgeT);
      cow.root.position = basePosition.add(cow.dodgeOffset.scale(Math.sin(dodgeT * Math.PI)));
      if (cow.chargeElapsed >= cow.chargeDuration + 0.65) {
        cow.resolved = true;
      }
    });

    if (shouldShowDodge) {
      this._showDodgeButton('DODGE!', '#d35400', 220, 68);
    } else if (!this.currentAttack) {
      this._hideDodgeButton();
    }

    if (this.stampedeCows.length >= 3 && this.stampedeCows.every((cow) => cow.resolved)) {
      this._finishStampede();
    }
  }

  update(dt) {
    if (this.isComplete) {
      return;
    }

    this.elapsed += dt;
    this.clickPenaltyCooldown = Math.max(0, this.clickPenaltyCooldown - dt);
    this.promptArrowBob += dt * 4;

    if (this.sounds && this.sounds.moo && this.elapsed >= this._nextMooAt) {
      this.sounds.moo();
      this._scheduleNextMoo();
    }

    if (!this.stampedeTriggered && this.elapsed >= 30 && this.currentAttack === null) {
      this._startStampede();
    }

    if (!this.stampedeActive) {
      this.beatElapsed += dt;
    }

    if (this.currentAttack) {
      this.attackElapsed += dt;
      const attackProgress = BABYLON.Scalar.Clamp(this.attackElapsed / this.attackDuration, 0, 1);

      if (this.currentAttack === 'kick' && this.attackLeg) {
        this.attackLeg.rotation.z = -Math.sin(attackProgress * Math.PI) * 0.9;
      } else if (this.currentAttack === 'charge') {
        const curve = this.attackDodged ? attackProgress * 0.35 : Math.sin(attackProgress * Math.PI);
        this.cowRoot.position = BABYLON.Vector3.Lerp(this.baseCowPosition, this.baseCowPosition.add(this.chargeOffset), curve);
      } else if (this.currentAttack === 'spin') {
        this.cowRoot.rotation.y = attackProgress * Math.PI * 2;
      }

      if (this.attackElapsed >= this.attackDuration) {
        this._finishAttack();
      }
    } else if (this.stampedeActive) {
      this._updateStampede(dt);
    } else if (this.elapsed >= this.nextAttackAt) {
      const attacks = ['kick', 'charge', 'spin'];
      this._startAttack(attacks[Math.floor(Math.random() * attacks.length)]);
    }

    if (!this.stampedeActive && this.beatElapsed >= this.beatInterval) {
      this._advanceBeat();
    }

    if (this.dodgeButton.isVisible && (this.currentAttack === 'charge' || this.stampedeActive)) {
      const pulse = 1 + (Math.sin(this.elapsed * 10) * 0.08);
      this.dodgeButton.scaleX = pulse;
      this.dodgeButton.scaleY = pulse;
    }

    this._updateUdders();
    this._updateBucket();
    this._updateMilkBursts(dt);
  }

  _updateUdders() {
    const promptVisible = !this.currentAttack && !this.stampedeActive && this.elapsed >= this.stunnedUntil && !this.uddersInvalid && this.activeUdderIndex >= 0;
    this.udders.forEach((udder, index) => {
      const isActive = index === this.activeUdderIndex && !this.uddersInvalid && !this.stampedeActive;
      const pulse = isActive ? 1.08 + (Math.sin(this.beatElapsed * 10) * 0.2) : 0.94;
      udder.mesh.scaling.setAll(pulse);
      udder.material.emissiveColor = isActive
        ? new BABYLON.Color3(0.6, 0.95, 0.65)
        : this.elapsed < this.stunnedUntil
          ? new BABYLON.Color3(0.18, 0.04, 0.04)
          : new BABYLON.Color3(0.01, 0.005, 0.01);
      if (this.udderLabels[index]) {
        this.udderLabels[index].color = isActive ? '#b8ffbf' : '#ffffff';
      }
    });

    if (this.promptArrowRoot && this.promptArrowAnchor) {
      if (promptVisible) {
        const activeUdder = this.udders[this.activeUdderIndex];
        this.promptArrowRoot.setEnabled(true);
        this.promptArrowLabel.isVisible = true;
        this.promptArrowRoot.position.copyFrom(activeUdder.mesh.position);
        this.promptArrowRoot.position.y += 0.88 + (Math.sin(this.promptArrowBob) * 0.08);
      } else {
        this.promptArrowRoot.setEnabled(false);
        this.promptArrowLabel.isVisible = false;
      }
    }
  }

  _updateBucket() {
    const fillHeight = Math.max(0.01, this.bucketFill * 0.72);
    this.bucketFillMesh.scaling.y = fillHeight / 0.01;
    this.bucketFillMesh.position.y = 0.08 + (fillHeight / 2);
  }

  _updateMilkBursts(dt) {
    this.milkBursts = this.milkBursts.filter((burst) => {
      burst.elapsed += dt;
      const t = BABYLON.Scalar.Clamp(burst.elapsed / burst.duration, 0, 1);
      const arc = Math.sin(t * Math.PI) * 0.5;
      burst.mesh.position = BABYLON.Vector3.Lerp(burst.start, burst.end, t);
      burst.mesh.position.y += arc;

      if (t >= 1) {
        const splatter = ParticlePresets.splatter(this.scene, burst.end, new BABYLON.Color3(0.95, 0.98, 1), { count: 16 });
        splatter.start();
        setTimeout(() => {
          if (this._disposed) return;
          splatter.stop();
          splatter.dispose();
        }, 350);
        burst.mesh.dispose();
        return false;
      }

      return true;
    });
  }

  onTimeUp() {
    this.completePhase({
      milkCount: this.milkCount,
      stunCount: this.stunCount,
      dodgeCount: this.dodgeCount
    });
  }

  dispose() {
    this.scene.onPointerDown = null;
    this.stampedeTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.milkBursts.forEach((burst) => burst.mesh.dispose());
    this.stampedeCows.forEach((cow) => {
      if (cow.root) cow.root.dispose(false, true);
    });
    this.udderLabels.forEach((label) => label.dispose());
    if (this.promptArrowLabel) this.promptArrowLabel.dispose();
    if (this.attackWarningText) this.attackWarningText.dispose();
    super.dispose();
  }
}

window.CowCombat3D = CowCombat3D;
