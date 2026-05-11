class ObstacleCourse3D extends BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options) {
    super(engine, canvas, socketBridge, options);
    this.options.isAbsurd = true;
    this.timeLimit = 50;

    this.integrity = 100;
    this.hazardsHit = 0;
    this.reachedEnd = false;
    this.courseLength = 32;

    this.playerRoot = null;
    this.playerSpeed = 3;
    this.slideTimer = 0;
    this.slideVelocity = 0;
    this.hitCooldownUntil = 0;
    this.fragments = [];

    this.hazards = [];
    this.ventParticles = [];
    this.keys = {};
    this.camera = null;

    this.statusText = null;
    this.integrityText = null;

    this._onKeyDown = null;
    this._onKeyUp = null;
  }

  getPhaseName() { return 'PRESENT'; }

  async create() {
    this.scene.clearColor = new BABYLON.Color4(0.03, 0.03, 0.05, 1);
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
    this.scene.fogDensity = 0.024;
    this.scene.fogColor = new BABYLON.Color3(0.07, 0.08, 0.12);

    this.camera = CameraRigs.isometric(this.scene, this.canvas, {
      distance: 20,
      orthoSize: 7,
      target: new BABYLON.Vector3(0, 1.2, 3)
    });

    this._buildCourse();
    this._buildPlayer();
    this._buildHud();
    this._setupInput();
    this.hud.showMessage('Move with WASD / arrows. Survive the kitchen corridor.', 2400);
  }

  _buildCourse() {
    const ground = BABYLON.MeshBuilder.CreateGround('ocGround', {
      width: 8,
      height: this.courseLength + 8
    }, this.scene);
    ground.position.z = (this.courseLength / 2) + 2;
    ground.material = this.materials.food(new BABYLON.Color3(0.16, 0.16, 0.18));

    for (let i = 0; i < 18; i += 1) {
      const tile = BABYLON.MeshBuilder.CreateBox(`ocTile_${i}`, {
        width: 7.6,
        height: 0.01,
        depth: 1.3
      }, this.scene);
      tile.position = new BABYLON.Vector3(0, 0.01, -1 + (i * 2));
      tile.material = this.materials.food(new BABYLON.Color3(i % 2 === 0 ? 0.19 : 0.13, 0.19, 0.22));
    }

    const leftWall = BABYLON.MeshBuilder.CreateBox('ocLeftWall', {
      width: 0.3,
      height: 2.5,
      depth: this.courseLength + 8
    }, this.scene);
    leftWall.position = new BABYLON.Vector3(-4.1, 1.25, (this.courseLength / 2) + 2);
    leftWall.material = this.materials.metal();

    const rightWall = BABYLON.MeshBuilder.CreateBox('ocRightWall', {
      width: 0.3,
      height: 2.5,
      depth: this.courseLength + 8
    }, this.scene);
    rightWall.position = new BABYLON.Vector3(4.1, 1.25, (this.courseLength / 2) + 2);
    rightWall.material = this.materials.metal();

    this._addSwingPin(0, 6, 0);
    this._addSwingPin(1.4, 13, 1.1);
    this._addSwingPin(-1.2, 21, 2.3);
    this._addSwingPin(0.6, 28, 3.4);

    this._addFallingPot(-1.4, 8);
    this._addFallingPot(1.3, 17.5);
    this._addFallingPot(0, 26.5);

    this._addButterPatch(-1.8, 10, 1.8);
    this._addButterPatch(1.5, 19, -2);
    this._addButterPatch(0.2, 27.5, 2.2);

    this._addSteamVent(-1.6, 12);
    this._addSteamVent(1.7, 24.5);
  }

  _buildPlayer() {
    this.playerRoot = new BABYLON.TransformNode('ocPlayer', this.scene);
    this.playerRoot.position = new BABYLON.Vector3(0, 0.8, 0);

    const body = BABYLON.MeshBuilder.CreateCylinder('ocBody', {
      diameter: 0.6,
      height: 1.1,
      tessellation: 14
    }, this.scene);
    body.position = new BABYLON.Vector3(0, 0.55, 0);
    body.material = this.materials.food(new BABYLON.Color3(0.3, 0.7, 0.95));
    body.parent = this.playerRoot;

    const head = BABYLON.MeshBuilder.CreateSphere('ocHead', {
      diameter: 0.42,
      segments: 12
    }, this.scene);
    head.position = new BABYLON.Vector3(0, 1.18, 0);
    head.material = this.materials.food(new BABYLON.Color3(0.95, 0.82, 0.72));
    head.parent = this.playerRoot;

    const cake = BABYLON.MeshBuilder.CreateCylinder('ocCake', {
      diameter: 0.58,
      height: 0.22,
      tessellation: 18
    }, this.scene);
    cake.position = new BABYLON.Vector3(0, 1.55, 0);
    cake.material = this.materials.cakeSponge();
    cake.parent = this.playerRoot;

    const frosting = BABYLON.MeshBuilder.CreateCylinder('ocFrosting', {
      diameter: 0.62,
      height: 0.08,
      tessellation: 18
    }, this.scene);
    frosting.position = new BABYLON.Vector3(0, 1.7, 0);
    frosting.material = this.materials.frosting(new BABYLON.Color3(0.98, 0.96, 0.96));
    frosting.parent = this.playerRoot;
  }

  _buildHud() {
    const panel = new BABYLON.GUI.StackPanel('ocHud');
    panel.width = '320px';
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    panel.left = '24px';
    this.hud.texture.addControl(panel);

    this.statusText = new BABYLON.GUI.TextBlock('ocStatus', 'Kitchen nightmare engaged.');
    this.statusText.height = '64px';
    this.statusText.color = '#fff0d6';
    this.statusText.fontSize = 18;
    this.statusText.textWrapping = true;
    this.statusText.outlineWidth = 2;
    this.statusText.outlineColor = '#000000';
    panel.addControl(this.statusText);

    this.integrityText = new BABYLON.GUI.TextBlock('ocIntegrity', 'Integrity: 100');
    this.integrityText.height = '28px';
    this.integrityText.color = '#ffffff';
    this.integrityText.fontSize = 18;
    this.integrityText.outlineWidth = 2;
    this.integrityText.outlineColor = '#000000';
    panel.addControl(this.integrityText);
  }

  _setupInput() {
    this._onKeyDown = (event) => {
      this.keys[event.key.toLowerCase()] = true;
    };
    this._onKeyUp = (event) => {
      this.keys[event.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _addSwingPin(x, z, seed) {
    const pivot = new BABYLON.TransformNode(`ocPinPivot_${z}`, this.scene);
    pivot.position = new BABYLON.Vector3(x, 2.2, z);
    const pin = BABYLON.MeshBuilder.CreateCylinder(`ocPin_${z}`, {
      diameter: 0.22,
      height: 3.1,
      tessellation: 12
    }, this.scene);
    pin.rotation.z = Math.PI / 2;
    pin.material = this.materials.wood();
    pin.parent = pivot;
    this.hazards.push({ type: 'swing', pivot, pin, x, z, seed, hit: false });
  }

  _addFallingPot(x, z) {
    const pot = BABYLON.MeshBuilder.CreateCylinder(`ocPot_${z}`, {
      diameter: 0.74,
      height: 0.7,
      tessellation: 18
    }, this.scene);
    pot.position = new BABYLON.Vector3(x, 4.2, z);
    pot.material = this.materials.metal();
    this.hazards.push({ type: 'pot', mesh: pot, baseX: x, z, falling: false, velocity: 0, resetAt: 0, hit: false });
  }

  _addButterPatch(x, z, slide) {
    const patch = BABYLON.MeshBuilder.CreateGround(`ocButter_${z}`, {
      width: 1.6,
      height: 1.4
    }, this.scene);
    patch.position = new BABYLON.Vector3(x, 0.02, z);
    patch.material = this.materials.food(new BABYLON.Color3(1, 0.88, 0.35));
    this.hazards.push({ type: 'butter', mesh: patch, x, z, slide, triggeredUntil: 0 });
  }

  _addSteamVent(x, z) {
    const vent = BABYLON.MeshBuilder.CreateCylinder(`ocVent_${z}`, {
      diameter: 0.55,
      height: 0.18,
      tessellation: 16
    }, this.scene);
    vent.position = new BABYLON.Vector3(x, 0.08, z);
    vent.material = this.materials.metal();
    const steam = ParticlePresets.steam(this.scene, vent, { rate: 10 });
    steam.start();
    this.ventParticles.push(steam);
    this.hazards.push({ type: 'vent', mesh: vent, x, z, active: true });
  }

  update(dt) {
    if (this.isComplete) {
      this._updateFragments(dt);
      return;
    }

    this.elapsed += dt;
    this._updateMovement(dt);
    this._updateHazards(dt);
    this._updateCamera();

    const distanceBonus = this._distanceBonus();
    this.setScore(this.integrity + distanceBonus);
    this.integrityText.text = `Integrity: ${Math.max(0, Math.round(this.integrity))}`;

    if (this.playerRoot.position.z > 30 && !this.reachedEnd) {
      this.reachedEnd = true;
      this.statusText.text = 'Corridor cleared. Present the cake corpse.';
      this.completePhase({
        integrity: Math.max(0, Math.round(this.integrity)),
        reachedEnd: true,
        hazardsHit: this.hazardsHit
      });
    }
  }

  _updateMovement(dt) {
    const move = new BABYLON.Vector3(0, 0, 0);
    if (this.keys['w'] || this.keys['arrowup']) move.z += 1;
    if (this.keys['s'] || this.keys['arrowdown']) move.z -= 1;
    if (this.keys['a'] || this.keys['arrowleft']) move.x -= 1;
    if (this.keys['d'] || this.keys['arrowright']) move.x += 1;

    if (move.lengthSquared() > 0) {
      move.normalize().scaleInPlace(this.playerSpeed * dt);
      this.playerRoot.position.addInPlace(move);
    }

    if (this.slideTimer > 0) {
      this.slideTimer = Math.max(0, this.slideTimer - dt);
      this.playerRoot.position.x += this.slideVelocity * dt;
    }

    this.playerRoot.position.x = BABYLON.Scalar.Clamp(this.playerRoot.position.x, -3.2, 3.2);
    this.playerRoot.position.z = BABYLON.Scalar.Clamp(this.playerRoot.position.z, 0, this.courseLength);
  }

  _updateHazards(dt) {
    const now = this.elapsed;
    this.hazards.forEach((hazard) => {
      if (hazard.type === 'swing') {
        hazard.pivot.rotation.y = Math.sin((this.elapsed * 2.6) + hazard.seed) * 1.1;
        const swingTipX = hazard.x + (Math.sin(hazard.pivot.rotation.y) * 1.7);
        if (Math.abs(this.playerRoot.position.z - hazard.z) < 0.9 && Math.abs(this.playerRoot.position.x - swingTipX) < 0.75) {
          this._damagePlayer('Rolling pin cracked the cake.', 15);
        }
      } else if (hazard.type === 'pot') {
        if (!hazard.falling && !hazard.resetAt && Math.abs(this.playerRoot.position.z - hazard.z) < 4) {
          hazard.falling = true;
          hazard.velocity = 0;
          hazard.hit = false;
        }
        if (hazard.falling) {
          hazard.velocity += 9 * dt;
          hazard.mesh.position.y -= hazard.velocity * dt;
          if (!hazard.hit && Math.abs(this.playerRoot.position.z - hazard.z) < 0.8 && Math.abs(this.playerRoot.position.x - hazard.baseX) < 0.8 && hazard.mesh.position.y < 1.8) {
            hazard.hit = true;
            this._damagePlayer('Falling pot flattened the frosting.', 15);
          }
          if (hazard.mesh.position.y <= 0.55) {
            hazard.falling = false;
            hazard.resetAt = now + 2.5;
          }
        } else if (hazard.resetAt && now >= hazard.resetAt) {
          hazard.mesh.position.y = 4.2;
          hazard.resetAt = 0;
        }
      } else if (hazard.type === 'butter') {
        if (Math.abs(this.playerRoot.position.z - hazard.z) < 0.7 && Math.abs(this.playerRoot.position.x - hazard.x) < 0.8) {
          this.slideTimer = 0.6;
          this.slideVelocity = hazard.slide;
          this.statusText.text = 'Butter patch! Sliding sideways.';
        }
      } else if (hazard.type === 'vent') {
        const pulse = 0.5 + (Math.sin((this.elapsed * 4) + hazard.z) * 0.5);
        hazard.mesh.scaling.y = 1 + (pulse * 0.25);
        if (Math.abs(this.playerRoot.position.z - hazard.z) < 0.9 && Math.abs(this.playerRoot.position.x - hazard.x) < 0.75) {
          this.playerRoot.position.z = Math.max(0, this.playerRoot.position.z - (dt * (2.2 + pulse)));
          this.statusText.text = 'Steam vent blasts you backward.';
        }
      }
    });
  }

  _damagePlayer(message, amount) {
    if (this.elapsed < this.hitCooldownUntil || this.isComplete) {
      return;
    }
    this.hitCooldownUntil = this.elapsed + 0.75;
    this.integrity = Math.max(0, this.integrity - amount);
    this.hazardsHit += 1;
    this.statusText.text = message;

    if (this.integrity <= 0) {
      this._breakCake();
      this.completePhase({
        integrity: 0,
        reachedEnd: false,
        hazardsHit: this.hazardsHit
      });
    }
  }

  _breakCake() {
    for (let i = 0; i < 8; i += 1) {
      const fragment = BABYLON.MeshBuilder.CreateBox(`ocFrag_${i}`, {
        width: 0.14,
        height: 0.14,
        depth: 0.14
      }, this.scene);
      fragment.position = this.playerRoot.position.add(new BABYLON.Vector3((Math.random() - 0.5) * 0.4, 1.5 + (Math.random() * 0.4), (Math.random() - 0.5) * 0.4));
      fragment.material = this.materials.cakeSponge();
      this.fragments.push({
        mesh: fragment,
        velocity: new BABYLON.Vector3((Math.random() - 0.5) * 2.2, 2 + (Math.random() * 1.5), (Math.random() - 0.5) * 2.2)
      });
    }
  }

  _updateFragments(dt) {
    this.fragments.forEach((fragment) => {
      fragment.velocity.y -= 6 * dt;
      fragment.mesh.position.addInPlace(fragment.velocity.scale(dt));
      fragment.mesh.rotation.x += dt * 3;
      fragment.mesh.rotation.z += dt * 2;
    });
  }

  _updateCamera() {
    if (this.camera) {
      this.camera.target = new BABYLON.Vector3(this.playerRoot.position.x, 1.2, this.playerRoot.position.z + 3);
    }
  }

  _distanceBonus() {
    return Math.min(20, Math.round((Math.max(0, this.playerRoot.position.z) / 30) * 20));
  }

  onTimeUp() {
    this.completePhase({
      integrity: Math.max(0, Math.round(this.integrity)),
      reachedEnd: this.reachedEnd,
      hazardsHit: this.hazardsHit
    });
  }

  dispose() {
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
    }
    if (this._onKeyUp) {
      window.removeEventListener('keyup', this._onKeyUp);
    }
    this.ventParticles.forEach((steam) => {
      steam.stop();
      steam.dispose();
    });
    super.dispose();
  }
}

window.ObstacleCourse3D = ObstacleCourse3D;
