class GravityFlip3D extends BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options) {
    super(engine, canvas, socketBridge, options);
    this.options.isAbsurd = true;
    this.timeLimit = 45;

    this.elapsed = 0;
    this.gravityVector = new BABYLON.Vector3(0, -3.2, 0);
    this.nextFlipAt = 4.5;
    this.warningIssued = false;
    this.warningFlash = 0;
    this.flipsSucceeded = 0;
    this.pendingFlipResolveAt = 0;
    this.anchorUses = 0;
    this.damage = 0;
    this.scoreTick = 0;

    this.roomRoot = null;
    this.targetRoomRotation = new BABYLON.Vector3(0, 0, 0);
    this.rackCenter = new BABYLON.Vector3(0, 1.65, 0);
    this.rackRadius = 0.9;
    this.cakeMesh = null;
    this.cakeVelocity = new BABYLON.Vector3(0, 0, 0);
    this.furniture = [];

    this.anchorActiveUntil = 0;
    this.anchorCooldownUntil = 0;
    this.offRackCooldownUntil = 0;
    this.hitCooldownUntil = 0;

    this.statusText = null;
    this.anchorText = null;
    this.anchorBar = null;
    this.warningText = null;
  }

  getPhaseName() { return 'DECORATE'; }

  async create() {
    this.scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.08, 1);
    CameraRigs.isometric(this.scene, this.canvas, {
      distance: 20,
      orthoSize: 7,
      target: new BABYLON.Vector3(0, 1.6, 0)
    });

    this._buildRoom();
    this._buildHud();
    this._setupInput();
    this.hud.showMessage('Click the cake to anchor it before gravity flips.', 2300);
  }

  _buildRoom() {
    this.roomRoot = new BABYLON.TransformNode('gravityRoom', this.scene);

    // Dark industrial walls with slight color variation
    const wallMat = this.materials.tile(new BABYLON.Color3(0.18, 0.20, 0.25));
    const floorMat = this.materials.darkWood();

    const floor = BABYLON.MeshBuilder.CreateBox('gfFloor', { width: 8, height: 0.2, depth: 8 }, this.scene);
    floor.position = new BABYLON.Vector3(0, 0, 0);
    floor.material = floorMat;
    floor.parent = this.roomRoot;

    // Checkerboard floor accent tiles
    for (let x = -3; x <= 3; x += 2) {
      for (let z = -3; z <= 3; z += 2) {
        const tile = BABYLON.MeshBuilder.CreateBox(`flTile_${x}_${z}`, {
          width: 1.8, height: 0.01, depth: 1.8
        }, this.scene);
        tile.position = new BABYLON.Vector3(x, 0.11, z);
        tile.material = this.materials.tile(new BABYLON.Color3(0.25, 0.22, 0.18));
        tile.parent = this.roomRoot;
      }
    }

    const ceiling = BABYLON.MeshBuilder.CreateBox('gfCeiling', { width: 8, height: 0.2, depth: 8 }, this.scene);
    ceiling.position = new BABYLON.Vector3(0, 3.3, 0);
    ceiling.material = wallMat;
    ceiling.parent = this.roomRoot;

    [
      { name: 'north', size: { width: 8, height: 3.2, depth: 0.2 }, pos: new BABYLON.Vector3(0, 1.65, -4) },
      { name: 'south', size: { width: 8, height: 3.2, depth: 0.2 }, pos: new BABYLON.Vector3(0, 1.65, 4) },
      { name: 'west', size: { width: 0.2, height: 3.2, depth: 8 }, pos: new BABYLON.Vector3(-4, 1.65, 0) },
      { name: 'east', size: { width: 0.2, height: 3.2, depth: 8 }, pos: new BABYLON.Vector3(4, 1.65, 0) }
    ].forEach((entry) => {
      const wall = BABYLON.MeshBuilder.CreateBox(`gf_${entry.name}`, entry.size, this.scene);
      wall.position = entry.pos;
      wall.material = wallMat;
      wall.parent = this.roomRoot;
    });

    const rack = BABYLON.MeshBuilder.CreateCylinder('gfRack', {
      diameter: 2,
      height: 0.08,
      tessellation: 24
    }, this.scene);
    rack.position = new BABYLON.Vector3(0, 1.2, 0);
    rack.material = this.materials.metal();
    rack.parent = this.roomRoot;

    for (let i = 0; i < 6; i += 1) {
      const wire = BABYLON.MeshBuilder.CreateCylinder(`gfWire_${i}`, {
        diameter: 0.04,
        height: 1.8,
        tessellation: 8
      }, this.scene);
      wire.rotation.z = Math.PI / 2;
      wire.position = new BABYLON.Vector3(0, 1.24, -0.7 + (i * 0.28));
      wire.material = this.materials.metal();
      wire.parent = this.roomRoot;
    }

    this.cakeMesh = BABYLON.MeshBuilder.CreateCylinder('gfCake', {
      diameter: 0.82,
      height: 0.42,
      tessellation: 20
    }, this.scene);
    this.cakeMesh.position = this.rackCenter.clone();
    this.cakeMesh.material = this.materials.cakeSponge();
    this.cakeMesh.isPickable = true;
    this.cakeMesh.parent = this.roomRoot;

    this._makeFurniture('table', BABYLON.MeshBuilder.CreateBox('gfTable', { width: 1.2, height: 0.5, depth: 0.9 }, this.scene), new BABYLON.Vector3(-2.3, 0.8, -2.1), 0.7);
    this._makeFurniture('chair', BABYLON.MeshBuilder.CreateBox('gfChair', { width: 0.6, height: 0.9, depth: 0.6 }, this.scene), new BABYLON.Vector3(2.4, 1.4, -1.8), 0.5);
    this._makeFurniture('pot', BABYLON.MeshBuilder.CreateCylinder('gfPot', { diameter: 0.55, height: 0.6, tessellation: 16 }, this.scene), new BABYLON.Vector3(-2.6, 2.1, 1.8), 0.35);
    this._makeFurniture('stool', BABYLON.MeshBuilder.CreateCylinder('gfStool', { diameter: 0.6, height: 0.6, tessellation: 12 }, this.scene), new BABYLON.Vector3(2.1, 0.7, 2.2), 0.4);

    const horrorLight = new BABYLON.PointLight('gfLight', new BABYLON.Vector3(0, 2.8, 0), this.scene);
    horrorLight.diffuse = new BABYLON.Color3(0.8, 1, 0.65);
    horrorLight.intensity = 0.75;
  }

  _makeFurniture(kind, mesh, position, radius) {
    mesh.position = position;
    mesh.material = kind === 'pot' ? this.materials.metal() : this.materials.food(new BABYLON.Color3(0.36, 0.26, 0.2));
    mesh.parent = this.roomRoot;
    this.furniture.push({ kind, mesh, radius, velocity: new BABYLON.Vector3((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2) });
  }

  _buildHud() {
    const panel = new BABYLON.GUI.StackPanel('gfPanel');
    panel.width = '300px';
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    panel.left = '24px';
    this.hud.texture.addControl(panel);

    this.statusText = new BABYLON.GUI.TextBlock('gfStatus', 'Room stable for now.');
    this.statusText.height = '64px';
    this.statusText.color = '#f0ebff';
    this.statusText.fontSize = 18;
    this.statusText.textWrapping = true;
    this.statusText.outlineWidth = 2;
    this.statusText.outlineColor = '#000000';
    panel.addControl(this.statusText);

    this.anchorText = new BABYLON.GUI.TextBlock('gfAnchorText', 'Anchor ready');
    this.anchorText.height = '24px';
    this.anchorText.color = '#ffffff';
    this.anchorText.fontSize = 16;
    this.anchorText.outlineWidth = 2;
    this.anchorText.outlineColor = '#000000';
    panel.addControl(this.anchorText);

    const anchorFrame = new BABYLON.GUI.Rectangle('gfAnchorFrame');
    anchorFrame.width = '220px';
    anchorFrame.height = '22px';
    anchorFrame.cornerRadius = 10;
    anchorFrame.color = '#666666';
    anchorFrame.thickness = 2;
    anchorFrame.background = '#222222';
    panel.addControl(anchorFrame);

    this.anchorBar = new BABYLON.GUI.Rectangle('gfAnchorBar');
    this.anchorBar.width = '100%';
    this.anchorBar.height = '100%';
    this.anchorBar.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.anchorBar.thickness = 0;
    this.anchorBar.cornerRadius = 10;
    this.anchorBar.background = '#4aa3ff';
    anchorFrame.addControl(this.anchorBar);

    this.warningText = new BABYLON.GUI.TextBlock('gfWarning', '');
    this.warningText.color = '#ff6666';
    this.warningText.fontSize = 48;
    this.warningText.outlineWidth = 3;
    this.warningText.outlineColor = '#000000';
    this.warningText.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.warningText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.warningText.paddingTop = '80px';
    this.hud.texture.addControl(this.warningText);
  }

  _setupInput() {
    this.scene.onPointerDown = () => {
      const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh === this.cakeMesh);
      if (!pick.hit || this.elapsed < this.anchorCooldownUntil) {
        return;
      }
      this.anchorActiveUntil = this.elapsed + 1.5;
      this.anchorCooldownUntil = this.elapsed + 3;
      this.anchorUses += 1;
      this.cakeVelocity.set(0, 0, 0);
      this.cakeMesh.position.copyFrom(this.rackCenter);
      this.statusText.text = 'Cake anchored. Ignore the impossible room.';
    };
  }

  _performFlip() {
    const directions = [
      new BABYLON.Vector3(0, -3.2, 0),
      new BABYLON.Vector3(0, 3.2, 0),
      new BABYLON.Vector3(3.2, 0, 0),
      new BABYLON.Vector3(-3.2, 0, 0),
      new BABYLON.Vector3(2.2, -2.2, 0),
      new BABYLON.Vector3(-2.2, -2.2, 0),
      new BABYLON.Vector3(0, -2.2, 2.2)
    ];

    const choice = directions[Math.floor(Math.random() * directions.length)];
    this.gravityVector = choice;
    this.pendingFlipResolveAt = this.elapsed + 1.2;
    this.nextFlipAt = this.elapsed + 4 + (Math.random() * 2);
    this.warningIssued = false;
    this.warningText.text = '';
    this.statusText.text = 'GRAVITY FLIP! Hold the cake together.';
    if (this.sounds) this.sounds.gravityFlip();

    if (choice.y > 0.5) {
      this.targetRoomRotation = new BABYLON.Vector3(Math.PI, 0, 0);
    } else if (choice.x > 0.5) {
      this.targetRoomRotation = new BABYLON.Vector3(0, 0, -Math.PI / 2);
    } else if (choice.x < -0.5) {
      this.targetRoomRotation = new BABYLON.Vector3(0, 0, Math.PI / 2);
    } else if (choice.z > 0.5) {
      this.targetRoomRotation = new BABYLON.Vector3(Math.PI / 6, 0, 0);
    } else {
      this.targetRoomRotation = new BABYLON.Vector3(0, 0, 0);
    }
  }

  update(dt) {
    if (this.isComplete) {
      return;
    }

    this.elapsed += dt;
    this.scoreTick += dt;
    while (this.scoreTick >= 1) {
      this.scoreTick -= 1;
      if (BABYLON.Vector3.Distance(this.cakeMesh.position, this.rackCenter) <= this.rackRadius + 0.2) {
        this.addScore(2);
      }
    }

    if (!this.warningIssued && this.elapsed >= this.nextFlipAt - 1) {
      this.warningIssued = true;
      this.warningFlash = 1;
      this.warningText.text = 'WARNING';
    }
    if (this.elapsed >= this.nextFlipAt) {
      this._performFlip();
    }

    this.warningFlash = Math.max(0, this.warningFlash - dt);
    if (this.warningFlash > 0) {
      this.warningText.alpha = 0.45 + (Math.sin(this.elapsed * 18) * 0.35 + 0.35);
    } else {
      this.warningText.alpha = 1;
    }

    this.roomRoot.rotation.x = BABYLON.Scalar.Lerp(this.roomRoot.rotation.x, this.targetRoomRotation.x, dt * 2.4);
    this.roomRoot.rotation.z = BABYLON.Scalar.Lerp(this.roomRoot.rotation.z, this.targetRoomRotation.z, dt * 2.4);

    if (this.elapsed < this.anchorActiveUntil) {
      this.cakeMesh.position.copyFrom(this.rackCenter);
      this.cakeVelocity.set(0, 0, 0);
    } else {
      this.cakeVelocity.addInPlace(this.gravityVector.scale(dt));
      this.cakeVelocity.scaleInPlace(Math.pow(0.992, dt * 60));
      this.cakeMesh.position.addInPlace(this.cakeVelocity.scale(dt));
    }

    this._constrainBody(this.cakeMesh, this.cakeVelocity, 0.42);

    if (this.pendingFlipResolveAt && this.elapsed >= this.pendingFlipResolveAt) {
      if (BABYLON.Vector3.Distance(this.cakeMesh.position, this.rackCenter) <= this.rackRadius + 0.45) {
        this.flipsSucceeded += 1;
      }
      this.pendingFlipResolveAt = 0;
    }

    this.furniture.forEach((item) => {
      item.velocity.addInPlace(this.gravityVector.scale(dt * 0.7));
      item.velocity.scaleInPlace(Math.pow(0.994, dt * 60));
      item.mesh.position.addInPlace(item.velocity.scale(dt));
      item.mesh.rotation.x += dt * 0.8;
      item.mesh.rotation.z += dt * 0.6;
      this._constrainBody(item.mesh, item.velocity, item.radius);

      if (this.elapsed >= this.hitCooldownUntil && BABYLON.Vector3.Distance(item.mesh.position, this.cakeMesh.position) < item.radius + 0.48) {
        this.hitCooldownUntil = this.elapsed + 0.7;
        this.damage = Math.min(100, this.damage + 10);
        this.addScore(-10);
        this.statusText.text = `${item.kind} smashed the cake.`;
        this.cakeVelocity.addInPlace(item.velocity.scale(0.9));
        if (this.sounds) this.sounds.obstacleHit();
      }
    });

    if (this.elapsed >= this.offRackCooldownUntil && BABYLON.Vector3.Distance(this.cakeMesh.position, this.rackCenter) > this.rackRadius + 0.65 && this.elapsed >= this.anchorActiveUntil) {
      this.offRackCooldownUntil = this.elapsed + 1.2;
      this.damage = Math.min(100, this.damage + 15);
      this.pendingFlipResolveAt = 0;
      this.addScore(-15);
      this.statusText.text = 'Cake slipped off the rack and warped reality.';
      this.cakeMesh.position.copyFrom(this.rackCenter);
      this.cakeVelocity.set(0, 0, 0);
    }

    const cooldownRemaining = Math.max(0, this.anchorCooldownUntil - this.elapsed);
    const readyPct = this.anchorCooldownUntil <= this.elapsed ? 1 : 1 - (cooldownRemaining / 3);
    this.anchorBar.width = `${Math.round(readyPct * 100)}%`;
    this.anchorText.text = this.elapsed < this.anchorActiveUntil
      ? 'Anchor active'
      : this.anchorCooldownUntil > this.elapsed
        ? `Anchor cooldown: ${cooldownRemaining.toFixed(1)}s`
        : 'Anchor ready';
  }

  _constrainBody(mesh, velocity, radius) {
    const minX = -3.6 + radius;
    const maxX = 3.6 - radius;
    const minY = 0.2 + radius;
    const maxY = 3.1 - radius;
    const minZ = -3.6 + radius;
    const maxZ = 3.6 - radius;

    if (mesh.position.x < minX || mesh.position.x > maxX) {
      mesh.position.x = BABYLON.Scalar.Clamp(mesh.position.x, minX, maxX);
      velocity.x *= -0.7;
    }
    if (mesh.position.y < minY || mesh.position.y > maxY) {
      mesh.position.y = BABYLON.Scalar.Clamp(mesh.position.y, minY, maxY);
      velocity.y *= -0.7;
    }
    if (mesh.position.z < minZ || mesh.position.z > maxZ) {
      mesh.position.z = BABYLON.Scalar.Clamp(mesh.position.z, minZ, maxZ);
      velocity.z *= -0.7;
    }
  }

  onTimeUp() {
    if (this.pendingFlipResolveAt && BABYLON.Vector3.Distance(this.cakeMesh.position, this.rackCenter) <= this.rackRadius + 0.45) {
      this.flipsSucceeded += 1;
      this.pendingFlipResolveAt = 0;
    }
    this.completePhase({
      flipsSucceeded: this.flipsSucceeded,
      anchorUses: this.anchorUses,
      damage: this.damage
    });
  }

  dispose() {
    this.scene.onPointerDown = null;

    this.furniture.forEach(item => {
      if (item.mesh && !item.mesh.isDisposed()) item.mesh.dispose();
    });
    this.furniture = [];

    if (this.cakeMesh && !this.cakeMesh.isDisposed()) this.cakeMesh.dispose();

    if (this.statusText) this.statusText.dispose();
    if (this.anchorText) this.anchorText.dispose();
    if (this.anchorBar) this.anchorBar.dispose();
    if (this.warningText) this.warningText.dispose();

    this.roomRoot = null;
    this.cakeMesh = null;
    this.statusText = null;
    this.anchorText = null;
    this.anchorBar = null;
    this.warningText = null;

    super.dispose();
  }
}

window.GravityFlip3D = GravityFlip3D;
