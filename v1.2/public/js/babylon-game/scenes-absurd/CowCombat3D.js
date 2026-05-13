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
    this.instructionText = null;
    this.dodgeButton = null;
    this.dodgeButtonText = null;
    this._instructionStateKey = '';
    this._instructionFadeAt = null;
    this._instructionMinAlpha = 1;
    this._instructionOverride = null;
    this._nextMooAt = 8 + (Math.random() * 4);
  }

  getPhaseName() { return 'MIX'; }

  async create() {
    this.scene.clearColor = new BABYLON.Color4(0.035, 0.06, 0.035, 1);
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
    this.scene.fogDensity = 0.015;
    this.scene.fogColor = new BABYLON.Color3(0.07, 0.12, 0.07);

    CameraRigs.isometric(this.scene, this.canvas, {
      distance: 18,
      orthoSize: 5.5,
      target: new BABYLON.Vector3(0, 1.5, 0)
    });

    this._buildFarm();
    this._buildCow();
    this._buildBucket();
    this._buildHud();
    this._setupInput();
    this._advanceBeat(true);
    this._syncInstructionState();
  }

  _buildFarm() {
    const ground = BABYLON.MeshBuilder.CreateGround('cowGround', {
      width: 12,
      height: 10
    }, this.scene);
    ground.material = this.materials.food(new BABYLON.Color3(0.16, 0.24, 0.14));

    this.farmGlow = new BABYLON.PointLight('cowGlow', new BABYLON.Vector3(0, 4.4, 0), this.scene);
    this.farmGlow.diffuse = new BABYLON.Color3(0.45, 0.85, 0.48);
    this.farmGlow.intensity = 0.45;
    this.farmGlow.range = 14;
  }

  _buildCow() {
    this.cowRoot = new BABYLON.TransformNode('cowRoot', this.scene);
    this.cowRoot.position.copyFrom(this.baseCowPosition);
    this.cowRoot.scaling.setAll(1.3);

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
    this.instructionText = new BABYLON.GUI.TextBlock('cowInstruction', 'Click the glowing udder!');
    this.instructionText.width = '100%';
    this.instructionText.height = '74px';
    this.instructionText.color = '#ffffff';
    this.instructionText.fontSize = 18;
    this.instructionText.fontWeight = 'bold';
    this.instructionText.textWrapping = true;
    this.instructionText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.instructionText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    this.instructionText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.instructionText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.instructionText.paddingBottom = '22px';
    this.instructionText.outlineWidth = 4;
    this.instructionText.outlineColor = '#000000';
    this.instructionText.shadowBlur = 8;
    this.instructionText.shadowColor = '#000000';
    this.hud.texture.addControl(this.instructionText);

    this.dodgeButton = BABYLON.GUI.Button.CreateSimpleButton('cowDodge', 'DODGE');
    this.dodgeButton.width = '160px';
    this.dodgeButton.height = '50px';
    this.dodgeButton.cornerRadius = 12;
    this.dodgeButton.thickness = 2;
    this.dodgeButton.color = '#ffffff';
    this.dodgeButton.background = '#c65a2e';
    this.dodgeButton.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.dodgeButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.dodgeButton.paddingBottom = '86px';
    this.dodgeButton.isVisible = false;
    this.dodgeButton.onPointerClickObservable.add(() => this._tryDodge());
    this.hud.texture.addControl(this.dodgeButton);

    this.dodgeButtonText = this.dodgeButton.children[0] || null;
    if (this.dodgeButtonText) {
      this.dodgeButtonText.fontSize = 22;
      this.dodgeButtonText.fontWeight = 'bold';
    }
  }

  _setupInput() {
    this.scene.onPointerDown = () => {
      if (this.isComplete || this.elapsed < this.stunnedUntil) {
        return;
      }

      if (this.stampedeActive) {
        this._tryDodge();
        return;
      }

      const pick = this.scene.pick(
        this.scene.pointerX,
        this.scene.pointerY,
        (mesh) => Boolean(mesh && mesh.metadata && typeof mesh.metadata.udderIndex === 'number')
      );
      if (!pick.hit || !pick.pickedMesh) {
        return;
      }

      const udderIndex = pick.pickedMesh.metadata.udderIndex;
      if (this.currentAttack === 'kick') {
        this._stunPlayer('The cow kicked you away from the udder!');
        return;
      }

      if (this.uddersInvalid || this.currentAttack === 'spin') {
        this._applyPenalty();
        return;
      }

      if (udderIndex === this.activeUdderIndex && !this.activeUdderHit) {
        this.activeUdderHit = true;
        this.milkCount += 1;
        this.addScore(5);
        this.bucketFill = Math.min(1, this.bucketFill + 0.06);
        this._spawnMilkBurst(this.udders[udderIndex].mesh.getAbsolutePosition(), this.bucketFillMesh.position.clone());
        this._showNormalInstruction(true);
        if (this.sounds) {
          if (this.sounds.beatHit) this.sounds.beatHit();
          if (this.sounds.milkSquirt) this.sounds.milkSquirt();
        }
      } else {
        if (this.sounds && this.sounds.beatMiss) this.sounds.beatMiss();
        this._applyPenalty();
      }
    };
  }

  _advanceBeat(force = false) {
    if (!force && !this.activeUdderHit && !this.uddersInvalid) {
      this._applyPenalty();
    }

    this.beatIndex = (this.beatIndex + 1) % this.beatSequence.length;
    this.activeUdderIndex = this.beatSequence[this.beatIndex];
    this.activeUdderHit = false;
    this.beatElapsed = 0;
    if (this.sounds && this.sounds.hoofStomp) this.sounds.hoofStomp();
  }

  _applyPenalty() {
    if (this.clickPenaltyCooldown > 0) {
      return;
    }
    this.clickPenaltyCooldown = 0.25;
    this.addScore(-2);
    if (!this.currentAttack && !this.stampedeActive) {
      this._showNormalInstruction(true);
    }
  }

  _stunPlayer(message, penalty = -2) {
    this.stunnedUntil = this.elapsed + 2;
    this.stunCount += 1;
    this.addScore(penalty);
    this._setTemporaryInstruction({
      key: 'stunned',
      text: 'Stunned!',
      color: '#ff4d4d',
      fontSize: 28,
      outlineWidth: 5,
      outlineColor: '#2b0000',
      fadeAfter: 0.5,
      minAlpha: 0.7
    }, 0.9);
    if (message) {
      this.hud.showMessage(message, 900);
    }
    if (this.sounds && this.sounds.stunned) this.sounds.stunned();
  }

  _applyInstruction(config, force = false) {
    if (!this.instructionText) {
      return;
    }

    if (!force && this._instructionStateKey === config.key) {
      return;
    }

    this._instructionStateKey = config.key;
    this.instructionText.text = config.text;
    this.instructionText.color = config.color || '#ffffff';
    this.instructionText.fontSize = config.fontSize || 18;
    this.instructionText.outlineWidth = config.outlineWidth ?? 4;
    this.instructionText.outlineColor = config.outlineColor || '#000000';
    this.instructionText.alpha = 1;
    this._instructionFadeAt = typeof config.fadeAfter === 'number' ? this.elapsed + config.fadeAfter : null;
    this._instructionMinAlpha = config.minAlpha ?? 1;
  }

  _showNormalInstruction(force = false) {
    this._applyInstruction({
      key: 'normal',
      text: 'Click the glowing udder!',
      color: '#ffffff',
      fontSize: 18,
      outlineWidth: 4,
      outlineColor: '#000000',
      fadeAfter: 3,
      minAlpha: 0.5
    }, force);
  }

  _setTemporaryInstruction(config, duration = 0.9) {
    this._instructionOverride = {
      until: this.elapsed + duration,
      config
    };
    this._applyInstruction(config, true);
  }

  _syncInstructionState() {
    if (this._instructionOverride) {
      if (this.elapsed < this._instructionOverride.until) {
        return;
      }
      this._instructionOverride = null;
      this._instructionStateKey = '';
    }

    if (this.stampedeActive) {
      this._applyInstruction({
        key: 'stampede',
        text: 'DODGE!',
        color: '#ff9c2a',
        fontSize: 32,
        outlineWidth: 6,
        outlineColor: '#3a1800'
      });
      return;
    }

    if (this.currentAttack === 'charge') {
      this._applyInstruction({
        key: 'attack-charge',
        text: 'DODGE THE CHARGE!',
        color: '#ff4d4d',
        fontSize: 32,
        outlineWidth: 6,
        outlineColor: '#2b0000'
      });
      return;
    }

    if (this.currentAttack === 'kick') {
      this._applyInstruction({
        key: 'attack-kick',
        text: '🦵 HANDS OFF!',
        color: '#ff4d4d',
        fontSize: 32,
        outlineWidth: 6,
        outlineColor: '#2b0000'
      });
      return;
    }

    if (this.currentAttack === 'spin') {
      this._applyInstruction({
        key: 'attack-spin',
        text: '🌀 WAIT...',
        color: '#ff4d4d',
        fontSize: 32,
        outlineWidth: 6,
        outlineColor: '#2b0000'
      });
      return;
    }

    this._showNormalInstruction();
  }

  _updateInstructionAlpha() {
    if (!this.instructionText) {
      return;
    }

    if (this._instructionFadeAt === null || this.elapsed <= this._instructionFadeAt) {
      this.instructionText.alpha = 1;
      return;
    }

    const t = BABYLON.Scalar.Clamp((this.elapsed - this._instructionFadeAt) / 0.8, 0, 1);
    this.instructionText.alpha = 1 - ((1 - this._instructionMinAlpha) * t);
  }

  _showDodgeButton(text = 'DODGE', background = '#c65a2e', width = 160, height = 50) {
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
    this.dodgeButton.width = '160px';
    this.dodgeButton.height = '50px';
    this.dodgeButton.background = '#c65a2e';
    if (this.dodgeButtonText) {
      this.dodgeButtonText.text = 'DODGE';
      this.dodgeButtonText.fontSize = 22;
    }
  }

  _startAttack(type) {
    this.currentAttack = type;
    this.attackElapsed = 0;
    this.attackDodged = false;
    this.attackDuration = type === 'kick' ? 1.2 : type === 'charge' ? 1.4 : 1.1;
    this.uddersInvalid = type === 'spin';
    this.attackLeg = type === 'kick' ? this.legs[2 + Math.floor(Math.random() * 2)] : null;
    this._instructionOverride = null;
    this._instructionStateKey = '';

    if (this.sounds && this.sounds.angryMoo) this.sounds.angryMoo();

    if (type === 'charge') {
      this._showDodgeButton('DODGE', '#c0392b', 180, 54);
    } else {
      this._hideDodgeButton();
    }

    this._syncInstructionState();
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
    this._hideDodgeButton();
    this.cowRoot.position.copyFrom(this.baseCowPosition);
    this.cowRoot.rotation.y = 0;
    this.legs.forEach((leg) => {
      leg.rotation.x = 0;
      leg.rotation.z = 0;
    });
    this.nextAttackAt = this.elapsed + 8 + (Math.random() * 2);
    this._instructionStateKey = '';
    this._syncInstructionState();
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
      if (this.sounds && this.sounds.dodge) this.sounds.dodge();
      return;
    }

    if (this.currentAttack !== 'charge' || this.attackDodged) {
      return;
    }

    this.attackDodged = true;
    this.dodgeCount += 1;
    this._hideDodgeButton();
    if (this.sounds && this.sounds.dodge) this.sounds.dodge();
  }

  _startStampede() {
    this.stampedeActive = true;
    this.stampedeTriggered = true;
    this.stampedeCows = [];
    this._instructionOverride = null;
    this._instructionStateKey = '';
    this._hideDodgeButton();
    this._syncInstructionState();
    this.hud.showMessage('🐄🐄🐄 STAMPEDE!', 2000);
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
    this.stampedeCows.forEach((cow) => {
      if (cow.root) cow.root.dispose(false, true);
    });
    this.stampedeCows = [];
    this.nextAttackAt = Math.max(this.nextAttackAt, this.elapsed + 5);
    this._instructionStateKey = '';
    this._syncInstructionState();
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

    if (!this.currentAttack) {
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
      const pulse = 1 + (Math.sin(this.elapsed * 10) * 0.05);
      this.dodgeButton.scaleX = pulse;
      this.dodgeButton.scaleY = pulse;
    }

    this._syncInstructionState();
    this._updateInstructionAlpha();
    this._updateUdders();
    this._updateBucket();
    this._updateMilkBursts(dt);
  }

  _updateUdders() {
    const uddersDisabled = Boolean(this.currentAttack) || this.stampedeActive;
    this.udders.forEach((udder, index) => {
      const isActive = !uddersDisabled && !this.uddersInvalid && index === this.activeUdderIndex;
      udder.mesh.scaling.setAll(isActive ? 1.3 : 0.7);
      udder.material.emissiveColor = uddersDisabled
        ? new BABYLON.Color3(0, 0, 0)
        : isActive
          ? new BABYLON.Color3(0.8, 1.0, 0.8)
          : new BABYLON.Color3(0.02, 0.01, 0.02);
    });
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
    if (this.instructionText) this.instructionText.dispose();
    if (this.dodgeButton) this.dodgeButton.dispose();
    super.dispose();
  }
}

window.CowCombat3D = CowCombat3D;
