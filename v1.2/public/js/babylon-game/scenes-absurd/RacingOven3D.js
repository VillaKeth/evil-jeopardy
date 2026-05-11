class RacingOven3D extends BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options) {
    super(engine, canvas, socketBridge, options);
    this.options.isAbsurd = true;
    this.timeLimit = 45;

    this.elapsed = 0;
    this.distance = 0;
    this.crashes = 0;
    this.orbsCollected = 0;
    this.scoreTick = 0;

    this.lanes = [-1.5, 0, 1.5];
    this.currentLane = 1;
    this.targetLane = 1;
    this.playerZ = -2.4;
    this.playerY = 0.48;
    this.jumpTime = 0;
    this.jumpDuration = 0.6;
    this.invulnerableUntil = 0;

    this.scrollSpeed = 7.5;
    this.spawnTimer = 0;
    this.spawnInterval = 1.5;
    this.obstacles = [];
    this.trackSegments = [];

    this.ovenRoot = null;
    this.cakeMesh = null;
    this.screenFlash = null;
    this.statusText = null;
    this.distanceText = null;
    this.jumpButton = null;

    this._onKeyDown = null;
  }

  getPhaseName() { return 'BAKE'; }

  async create() {
    this.scene.clearColor = new BABYLON.Color4(0.04, 0.04, 0.05, 1);
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
    this.scene.fogDensity = 0.028;
    this.scene.fogColor = new BABYLON.Color3(0.08, 0.08, 0.11);

    CameraRigs.isometric(this.scene, this.canvas, {
      distance: 21,
      orthoSize: 7,
      target: new BABYLON.Vector3(0, 0.7, 1.2)
    });

    this._buildTrack();
    this._buildOven();
    this._buildHud();
    this._setupInput();
    this.hud.showMessage('Arrow keys / A D steer. Space or JUMP clears hazards.', 2200);
  }

  _buildTrack() {
    const floor = BABYLON.MeshBuilder.CreateGround('raceFloor', {
      width: 8,
      height: 28
    }, this.scene);
    floor.material = this.materials.food(new BABYLON.Color3(0.15, 0.16, 0.18));

    for (let i = 0; i < 3; i += 1) {
      const laneMarker = BABYLON.MeshBuilder.CreateBox(`laneMarker_${i}`, {
        width: 0.08,
        height: 0.01,
        depth: 28
      }, this.scene);
      laneMarker.position = new BABYLON.Vector3(this.lanes[i] - 0.75, 0.01, 0);
      laneMarker.material = this.materials.food(new BABYLON.Color3(0.45, 0.45, 0.48));
    }

    for (let i = 0; i < 12; i += 1) {
      const stripe = BABYLON.MeshBuilder.CreateBox(`trackStripe_${i}`, {
        width: 0.16,
        height: 0.02,
        depth: 1.2
      }, this.scene);
      stripe.position = new BABYLON.Vector3(0, 0.015, -10 + (i * 2.1));
      stripe.material = this.materials.food(new BABYLON.Color3(0.92, 0.92, 0.94));
      this.trackSegments.push(stripe);
    }

    const leftWall = BABYLON.MeshBuilder.CreateBox('raceLeftWall', {
      width: 0.2,
      height: 1.4,
      depth: 28
    }, this.scene);
    leftWall.position = new BABYLON.Vector3(-3.2, 0.7, 0);
    leftWall.material = this.materials.metal();

    const rightWall = BABYLON.MeshBuilder.CreateBox('raceRightWall', {
      width: 0.2,
      height: 1.4,
      depth: 28
    }, this.scene);
    rightWall.position = new BABYLON.Vector3(3.2, 0.7, 0);
    rightWall.material = this.materials.metal();
  }

  _buildOven() {
    this.ovenRoot = new BABYLON.TransformNode('ovenRoot', this.scene);
    this.ovenRoot.position = new BABYLON.Vector3(this.lanes[this.currentLane], this.playerY, this.playerZ);

    const body = BABYLON.MeshBuilder.CreateBox('ovenCartBody', {
      width: 1,
      height: 0.8,
      depth: 0.8
    }, this.scene);
    body.material = this.materials.metal();
    body.parent = this.ovenRoot;

    const glass = BABYLON.MeshBuilder.CreateBox('ovenGlass', {
      width: 0.68,
      height: 0.42,
      depth: 0.05
    }, this.scene);
    glass.position = new BABYLON.Vector3(0, 0.02, -0.42);
    glass.material = this.materials.glass();
    glass.parent = this.ovenRoot;

    this.cakeMesh = BABYLON.MeshBuilder.CreateCylinder('racingCake', {
      diameter: 0.42,
      height: 0.2,
      tessellation: 20
    }, this.scene);
    this.cakeMesh.position = new BABYLON.Vector3(0, -0.08, 0);
    this.cakeMesh.material = this.materials.cakeSponge();
    this.cakeMesh.parent = this.ovenRoot;

    [-0.38, 0.38].forEach((x) => {
      [-0.28, 0.28].forEach((z) => {
        const wheel = BABYLON.MeshBuilder.CreateCylinder(`wheel_${x}_${z}`, {
          diameter: 0.18,
          height: 0.08,
          tessellation: 16
        }, this.scene);
        wheel.rotation.z = Math.PI / 2;
        wheel.position = new BABYLON.Vector3(x, -0.36, z);
        wheel.material = this.materials.food(new BABYLON.Color3(0.08, 0.08, 0.1));
        wheel.parent = this.ovenRoot;
      });
    });
  }

  _buildHud() {
    const panel = new BABYLON.GUI.StackPanel('racingPanel');
    panel.width = '280px';
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    panel.left = '24px';
    this.hud.texture.addControl(panel);

    this.statusText = new BABYLON.GUI.TextBlock('racingStatus', 'Industrial nightmare: stay hot and alive.');
    this.statusText.height = '64px';
    this.statusText.color = '#ffdfbf';
    this.statusText.fontSize = 18;
    this.statusText.textWrapping = true;
    this.statusText.outlineWidth = 2;
    this.statusText.outlineColor = '#000000';
    panel.addControl(this.statusText);

    this.distanceText = new BABYLON.GUI.TextBlock('racingDistance', 'Distance: 0 m');
    this.distanceText.height = '28px';
    this.distanceText.color = '#ffffff';
    this.distanceText.fontSize = 18;
    this.distanceText.outlineWidth = 2;
    this.distanceText.outlineColor = '#000000';
    panel.addControl(this.distanceText);

    this.jumpButton = BABYLON.GUI.Button.CreateSimpleButton('raceJump', 'JUMP');
    this.jumpButton.width = '180px';
    this.jumpButton.height = '50px';
    this.jumpButton.cornerRadius = 14;
    this.jumpButton.thickness = 2;
    this.jumpButton.color = '#ffffff';
    this.jumpButton.background = '#2c82c9';
    this.jumpButton.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.jumpButton.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.jumpButton.paddingBottom = '28px';
    this.jumpButton.paddingRight = '28px';
    this.jumpButton.onPointerClickObservable.add(() => this._jump());
    this.hud.texture.addControl(this.jumpButton);

    this.screenFlash = new BABYLON.GUI.Rectangle('raceFlash');
    this.screenFlash.width = 1;
    this.screenFlash.height = 1;
    this.screenFlash.thickness = 0;
    this.screenFlash.background = 'rgba(255,80,80,0)';
    this.hud.texture.addControl(this.screenFlash);
  }

  _setupInput() {
    this._onKeyDown = (event) => {
      if (this.isComplete) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') {
        this._moveLane(-1);
      } else if (key === 'arrowright' || key === 'd') {
        this._moveLane(1);
      } else if (key === ' ' || key === 'spacebar' || key === 'arrowup') {
        this._jump();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);

    this.scene.onPointerDown = (evt) => {
      const width = this.canvas.clientWidth || this.canvas.width || 1;
      if (evt.offsetX < width * 0.33) {
        this._moveLane(-1);
      } else if (evt.offsetX > width * 0.67) {
        this._moveLane(1);
      }
    };
  }

  _moveLane(direction) {
    this.targetLane = BABYLON.Scalar.Clamp(this.targetLane + direction, 0, this.lanes.length - 1);
  }

  _jump() {
    if (this.jumpTime > 0) {
      return;
    }
    this.jumpTime = this.jumpDuration;
    this.statusText.text = 'The oven-cart hops the track.';
  }

  _spawnObstacle() {
    const laneIndex = Math.floor(Math.random() * this.lanes.length);
    const roll = Math.random();
    const spawnZ = 12;

    if (roll < 0.22) {
      this._spawnOrb(laneIndex, spawnZ);
      return;
    }

    const type = roll < 0.5 ? 'pothole' : roll < 0.78 ? 'barrier' : 'pendulum';
    const root = new BABYLON.TransformNode(`raceObstacle_${performance.now()}`, this.scene);
    root.position = new BABYLON.Vector3(this.lanes[laneIndex], 0, spawnZ);

    if (type === 'pothole') {
      const hole = BABYLON.MeshBuilder.CreateBox(`${root.name}_hole`, {
        width: 1.1,
        height: 0.04,
        depth: 1.1
      }, this.scene);
      hole.position.y = -0.03;
      hole.material = this.materials.food(new BABYLON.Color3(0.05, 0.05, 0.06));
      hole.parent = root;
    } else if (type === 'barrier') {
      const barrier = BABYLON.MeshBuilder.CreateBox(`${root.name}_barrier`, {
        width: 0.9,
        height: 1.2,
        depth: 0.35
      }, this.scene);
      barrier.position.y = 0.62;
      barrier.material = this.materials.food(new BABYLON.Color3(0.42, 0.08, 0.08));
      barrier.parent = root;
    } else {
      const pivot = new BABYLON.TransformNode(`${root.name}_pivot`, this.scene);
      pivot.position = new BABYLON.Vector3(0, 1.5, 0);
      pivot.parent = root;

      const bar = BABYLON.MeshBuilder.CreateCylinder(`${root.name}_bar`, {
        diameter: 0.18,
        height: 1.3,
        tessellation: 12
      }, this.scene);
      bar.position = new BABYLON.Vector3(0, -0.74, 0);
      bar.material = this.materials.metal();
      bar.parent = pivot;
      root.metadata = { pivot, swingSeed: Math.random() * Math.PI * 2 };
    }

    this.obstacles.push({ type, laneIndex, root, z: spawnZ, hit: false, collected: false });
  }

  _spawnOrb(laneIndex, spawnZ) {
    const orb = BABYLON.MeshBuilder.CreateSphere(`tempOrb_${performance.now()}`, {
      diameter: 0.36,
      segments: 12
    }, this.scene);
    orb.position = new BABYLON.Vector3(this.lanes[laneIndex], 0.8, spawnZ);
    const orbMaterial = this.materials.food(new BABYLON.Color3(0.35, 0.85, 1)).clone(`orbMat_${performance.now()}`);
    orbMaterial.emissiveColor = new BABYLON.Color3(0.18, 0.58, 0.95);
    orb.material = orbMaterial;
    this.obstacles.push({ type: 'orb', laneIndex, root: orb, z: spawnZ, hit: false, collected: false });
  }

  _isJumpingHighEnough() {
    return this.jumpTime > this.jumpDuration * 0.25;
  }

  _crash(message) {
    if (this.elapsed < this.invulnerableUntil) {
      return;
    }
    this.invulnerableUntil = this.elapsed + 0.7;
    this.crashes += 1;
    this.addScore(-10);
    this.statusText.text = message;
    this.screenFlash.background = 'rgba(255,80,80,0.35)';
  }

  update(dt) {
    if (this.isComplete) {
      return;
    }

    this.elapsed += dt;
    this.distance += dt * 12;
    this.scoreTick += dt;
    if (this.scoreTick >= 1) {
      this.scoreTick -= 1;
      this.addScore(1);
    }

    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this._spawnObstacle();
    }

    this.ovenRoot.position.x = BABYLON.Scalar.Lerp(this.ovenRoot.position.x, this.lanes[this.targetLane], dt * 10);

    if (this.jumpTime > 0) {
      this.jumpTime = Math.max(0, this.jumpTime - dt);
      const progress = 1 - (this.jumpTime / this.jumpDuration);
      this.ovenRoot.position.y = this.playerY + (Math.sin(progress * Math.PI) * 0.95);
    } else {
      this.ovenRoot.position.y = BABYLON.Scalar.Lerp(this.ovenRoot.position.y, this.playerY, dt * 12);
    }

    this.trackSegments.forEach((segment) => {
      segment.position.z -= this.scrollSpeed * dt;
      if (segment.position.z < -12) {
        segment.position.z += 24;
      }
    });

    this.obstacles = this.obstacles.filter((obstacle) => {
      obstacle.z -= this.scrollSpeed * dt;
      obstacle.root.position.z = obstacle.z;

      if (obstacle.type === 'pendulum' && obstacle.root.metadata && obstacle.root.metadata.pivot) {
        obstacle.root.metadata.pivot.rotation.z = Math.sin((this.elapsed * 5) + obstacle.root.metadata.swingSeed) * 0.85;
      }

      if (obstacle.type === 'orb') {
        obstacle.root.position.y = 0.9 + (Math.sin((this.elapsed * 4) + obstacle.z) * 0.15);
      }

      const inZone = obstacle.z <= this.playerZ + 0.45 && obstacle.z >= this.playerZ - 0.55;
      const laneMatch = Math.abs(obstacle.root.position.x - this.ovenRoot.position.x) < 0.65;
      if (inZone && laneMatch && !obstacle.hit) {
        if (obstacle.type === 'orb') {
          obstacle.hit = true;
          obstacle.collected = true;
          this.orbsCollected += 1;
          this.addScore(5);
          this.statusText.text = 'Temperature orb collected.';
          const sparkles = ParticlePresets.sparkles(this.scene, obstacle.root.position.clone(), { rate: 25 });
          sparkles.start();
          setTimeout(() => {
            if (this._disposed) return;
            sparkles.stop();
            sparkles.dispose();
          }, 350);
        } else if (obstacle.type === 'pothole' && !this._isJumpingHighEnough()) {
          obstacle.hit = true;
          this._crash('Pothole impact! Oven rattled loose.');
        } else if (obstacle.type === 'barrier' && !this._isJumpingHighEnough()) {
          obstacle.hit = true;
          this._crash('Barrier smash! Industrial sparks everywhere.');
        } else if (obstacle.type === 'pendulum' && !this._isJumpingHighEnough()) {
          obstacle.hit = true;
          this._crash('Pendulum clipped the oven door.');
        }
      }

      const expired = obstacle.z < -5 || obstacle.collected;
      if (expired) {
        obstacle.root.dispose(false, true);
        return false;
      }
      return true;
    });

    if (this.elapsed >= this.invulnerableUntil) {
      this.screenFlash.background = 'rgba(255,80,80,0)';
    }

    this.distanceText.text = `Distance: ${Math.round(this.distance)} m`;
  }

  onTimeUp() {
    this.completePhase({
      distance: Math.round(this.distance),
      crashes: this.crashes,
      orbsCollected: this.orbsCollected
    });
  }

  dispose() {
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
    }
    this.scene.onPointerDown = null;
    this.obstacles.forEach((obstacle) => obstacle.root.dispose(false, true));
    super.dispose();
  }
}

window.RacingOven3D = RacingOven3D;
