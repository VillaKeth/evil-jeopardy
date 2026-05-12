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

    this.milkBursts = [];
    this.statusText = null;
    this.beatText = null;
    this.dodgeButton = null;
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
    this._setupInput();
    this._advanceBeat(true);
    this.hud.showMessage('Milk the glowing udder. Beware the angry cow.', 2200);
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
      material.emissiveColor = new BABYLON.Color3(0.04, 0.01, 0.02);
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
    const panel = new BABYLON.GUI.StackPanel('cowInfo');
    panel.width = '280px';
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    panel.left = '24px';
    this.hud.texture.addControl(panel);

    this.statusText = new BABYLON.GUI.TextBlock('cowStatus', 'Awaiting the rhythm…');
    this.statusText.height = '64px';
    this.statusText.color = '#ddffdd';
    this.statusText.fontSize = 18;
    this.statusText.textWrapping = true;
    this.statusText.outlineWidth = 2;
    this.statusText.outlineColor = '#000000';
    panel.addControl(this.statusText);

    this.beatText = new BABYLON.GUI.TextBlock('cowBeat', 'Beat: --');
    this.beatText.height = '30px';
    this.beatText.color = '#ffffff';
    this.beatText.fontSize = 18;
    this.beatText.outlineWidth = 2;
    this.beatText.outlineColor = '#000000';
    panel.addControl(this.beatText);

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
  }

  _setupInput() {
    this.scene.onPointerDown = () => {
      if (this.isComplete || this.elapsed < this.stunnedUntil) {
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
        this.statusText.text = 'Perfect squeeze. Milk it again!';
        if (this.sounds) this.sounds.beatHit();
      } else {
        if (this.sounds) this.sounds.beatMiss();
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
    this.beatText.text = `Beat: ${this.activeUdderIndex + 1}`;
  }

  _applyPenalty(message) {
    if (this.clickPenaltyCooldown > 0) {
      return;
    }
    this.clickPenaltyCooldown = 0.25;
    this.addScore(-2);
    this.statusText.text = message;
  }

  _stunPlayer(message) {
    this.stunnedUntil = this.elapsed + 2;
    this.stunCount += 1;
    this.statusText.text = message;
    this.addScore(-2);
    if (this.sounds) this.sounds.stunned();
  }

  _startAttack(type) {
    this.currentAttack = type;
    this.attackElapsed = 0;
    this.attackDodged = false;
    this.attackDuration = type === 'kick' ? 1.2 : type === 'charge' ? 1.4 : 1.1;
    this.uddersInvalid = type === 'spin';
    this.attackLeg = type === 'kick' ? this.legs[2 + Math.floor(Math.random() * 2)] : null;

    if (this.sounds) this.sounds.cowAttack();

    if (type === 'kick') {
      this.statusText.text = 'KICK! Keep your hands away.';
    } else if (type === 'charge') {
      this.statusText.text = 'CHARGE! Hit DODGE!';
      this.dodgeButton.isVisible = true;
    } else {
      this.statusText.text = 'SPIN! The udders are all wrong.';
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
    this.dodgeButton.isVisible = false;
    this.cowRoot.position.copyFrom(this.baseCowPosition);
    this.cowRoot.rotation.y = 0;
    this.legs.forEach((leg) => {
      leg.rotation.x = 0;
      leg.rotation.z = 0;
    });
    this.nextAttackAt = this.elapsed + 8 + (Math.random() * 2);
  }

  _tryDodge() {
    if (this.currentAttack !== 'charge' || this.attackDodged) {
      return;
    }
    this.attackDodged = true;
    this.dodgeCount += 1;
    this.statusText.text = 'You dodged the horned projectile oven-cow.';
    this.dodgeButton.isVisible = false;
    if (this.sounds) this.sounds.dodge();
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

  update(dt) {
    if (this.isComplete) {
      return;
    }

    this.elapsed += dt;
    this.clickPenaltyCooldown = Math.max(0, this.clickPenaltyCooldown - dt);
    this.beatElapsed += dt;

    if (!this.currentAttack && this.elapsed >= this.nextAttackAt) {
      const attacks = ['kick', 'charge', 'spin'];
      this._startAttack(attacks[Math.floor(Math.random() * attacks.length)]);
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
    }

    if (this.beatElapsed >= this.beatInterval) {
      this._advanceBeat();
    }

    this._updateUdders();
    this._updateBucket();
    this._updateMilkBursts(dt);
  }

  _updateUdders() {
    this.udders.forEach((udder, index) => {
      const isActive = index === this.activeUdderIndex && !this.uddersInvalid;
      const pulse = isActive ? 1 + (Math.sin(this.beatElapsed * 10) * 0.18) : 1;
      udder.mesh.scaling.setAll(pulse);
      udder.material.emissiveColor = isActive
        ? new BABYLON.Color3(0.6, 0.95, 0.65)
        : this.elapsed < this.stunnedUntil
          ? new BABYLON.Color3(0.4, 0.12, 0.12)
          : new BABYLON.Color3(0.04, 0.01, 0.02);
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
    this.milkBursts.forEach((burst) => burst.mesh.dispose());
    super.dispose();
  }
}

window.CowCombat3D = CowCombat3D;
