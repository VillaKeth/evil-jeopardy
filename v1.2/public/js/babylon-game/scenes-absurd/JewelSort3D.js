class JewelSort3D extends BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options) {
    super(engine, canvas, socketBridge, options);
    this.options.isAbsurd = true;
    this.timeLimit = 40;

    this.elapsed = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 2;
    this.beltSpeed = 1.6;
    this.speedLevel = 0;

    this.correctSorts = 0;
    this.wrongSorts = 0;
    this.missed = 0;
    this.gemsSorted = 0;

    this.gemColors = {
      red: new BABYLON.Color3(1, 0.35, 0.45),
      blue: new BABYLON.Color3(0.35, 0.7, 1),
      green: new BABYLON.Color3(0.35, 1, 0.65),
      yellow: new BABYLON.Color3(1, 0.92, 0.35)
    };

    this.belt = null;
    this.pickPlane = null;
    this.gems = [];
    this.carriedGem = null;
    this.vats = [];

    this.statusText = null;
    this.heldText = null;
  }

  getPhaseName() { return 'COOL'; }

  async create() {
    this.scene.clearColor = new BABYLON.Color4(0.05, 0.04, 0.1, 1);
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
    this.scene.fogDensity = 0.032;
    this.scene.fogColor = new BABYLON.Color3(0.09, 0.08, 0.18);

    CameraRigs.isometric(this.scene, this.canvas, {
      distance: 18,
      orthoSize: 7,
      target: new BABYLON.Vector3(0, 1.1, 0.4)
    });

    this._buildCave();
    this._buildConveyor();
    this._buildVats();
    this._buildHud();
    this._setupInput();
    this.hud.showMessage('Click a gem, then click the matching vat.', 2200);
  }

  _buildCave() {
    const floor = BABYLON.MeshBuilder.CreateGround('jewelFloor', {
      width: 12,
      height: 12
    }, this.scene);
    floor.material = this.materials.food(new BABYLON.Color3(0.12, 0.08, 0.18));

    const wall = BABYLON.MeshBuilder.CreateBox('jewelBackWall', {
      width: 12,
      height: 4,
      depth: 0.3
    }, this.scene);
    wall.position = new BABYLON.Vector3(0, 2, -4.6);
    wall.material = this.materials.food(new BABYLON.Color3(0.16, 0.1, 0.26));

    Object.values(this.gemColors).forEach((color, index) => {
      const crystal = BABYLON.MeshBuilder.CreateCylinder(`crystal_${index}`, {
        diameterTop: 0.08,
        diameterBottom: 0.42,
        height: 1.5 + (index * 0.2),
        tessellation: 6
      }, this.scene);
      crystal.position = new BABYLON.Vector3(-4 + (index * 2.4), 0.8 + (index * 0.1), -3.5 + ((index % 2) * 0.7));
      crystal.rotation.z = (index % 2 === 0 ? 1 : -1) * 0.15;
      const crystalMat = this.materials.food(color).clone(`crystalMat_${index}`);
      crystalMat.emissiveColor = color.scale(0.35);
      crystal.material = crystalMat;
    });

    const glow = new BABYLON.PointLight('jewelGlow', new BABYLON.Vector3(0, 3, -1), this.scene);
    glow.diffuse = new BABYLON.Color3(0.7, 0.45, 1);
    glow.intensity = 0.8;
  }

  _buildConveyor() {
    this.belt = BABYLON.MeshBuilder.CreateBox('gemBelt', {
      width: 10,
      height: 0.3,
      depth: 1.6
    }, this.scene);
    this.belt.position = new BABYLON.Vector3(0, 0.4, -0.8);
    this.belt.material = this.materials.metal();

    for (let i = 0; i < 10; i += 1) {
      const slat = BABYLON.MeshBuilder.CreateBox(`beltSlat_${i}`, {
        width: 0.2,
        height: 0.02,
        depth: 1.4
      }, this.scene);
      slat.position = new BABYLON.Vector3(-4.8 + (i * 1.05), 0.57, -0.8);
      slat.material = this.materials.food(new BABYLON.Color3(0.25, 0.27, 0.31));
      slat.metadata = { slat: true };
      this.gems.push({ mesh: slat, decorative: true, speed: 0.8 + (i * 0.02) });
    }

    const chute = BABYLON.MeshBuilder.CreateBox('rejectChute', {
      width: 0.6,
      height: 1.2,
      depth: 1.6
    }, this.scene);
    chute.position = new BABYLON.Vector3(5.2, 0.45, -0.8);
    chute.material = this.materials.food(new BABYLON.Color3(0.25, 0.08, 0.12));

    this.pickPlane = BABYLON.MeshBuilder.CreateGround('pickPlane', {
      width: 14,
      height: 14
    }, this.scene);
    this.pickPlane.position.y = 1.8;
    this.pickPlane.isVisible = false;
    this.pickPlane.isPickable = true;
  }

  _buildVats() {
    const entries = [
      ['red', -3.2],
      ['blue', -1.05],
      ['green', 1.05],
      ['yellow', 3.2]
    ];

    entries.forEach(([key, x]) => {
      const outer = BABYLON.MeshBuilder.CreateCylinder(`vat_${key}`, {
        diameterTop: 1.2,
        diameterBottom: 1,
        height: 1.2,
        tessellation: 24
      }, this.scene);
      outer.position = new BABYLON.Vector3(x, 0.62, 2.8);
      outer.isPickable = true;
      outer.metadata = { vatColor: key };
      outer.material = this.materials.metal();

      const fill = BABYLON.MeshBuilder.CreateCylinder(`vatFill_${key}`, {
        diameterTop: 0.82,
        diameterBottom: 0.76,
        height: 0.01,
        tessellation: 24
      }, this.scene);
      fill.position = new BABYLON.Vector3(x, 0.05, 2.8);
      const fillMat = this.materials.food(this.gemColors[key]).clone(`vatFillMat_${key}`);
      fillMat.emissiveColor = this.gemColors[key].scale(0.3);
      fill.material = fillMat;
      fill.isPickable = false;

      this.vats.push({ key, outer, fill, count: 0, material: fillMat });
    });
  }

  _buildHud() {
    const panel = new BABYLON.GUI.StackPanel('jewelHud');
    panel.width = '300px';
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    panel.left = '24px';
    this.hud.texture.addControl(panel);

    this.statusText = new BABYLON.GUI.TextBlock('jewelStatus', 'The conveyor whispers in gemstones.');
    this.statusText.height = '64px';
    this.statusText.color = '#efe7ff';
    this.statusText.fontSize = 18;
    this.statusText.textWrapping = true;
    this.statusText.outlineWidth = 2;
    this.statusText.outlineColor = '#000000';
    panel.addControl(this.statusText);

    this.heldText = new BABYLON.GUI.TextBlock('jewelHeld', 'Held gem: none');
    this.heldText.height = '28px';
    this.heldText.color = '#ffffff';
    this.heldText.fontSize = 17;
    this.heldText.outlineWidth = 2;
    this.heldText.outlineColor = '#000000';
    panel.addControl(this.heldText);
  }

  _setupInput() {
    this.scene.onPointerMove = () => {
      if (!this.carriedGem) {
        return;
      }
      const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => mesh === this.pickPlane);
      if (pick.hit) {
        this.carriedGem.mesh.position = new BABYLON.Vector3(pick.pickedPoint.x, 1.8, pick.pickedPoint.z);
      }
    };

    this.scene.onPointerDown = () => {
      const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
      if (!pick.hit || !pick.pickedMesh) {
        return;
      }

      const gem = this.gems.find((entry) => !entry.decorative && entry.mesh === pick.pickedMesh);
      if (gem && gem.state === 'belt' && !this.carriedGem) {
        gem.state = 'carried';
        this.carriedGem = gem;
        this.heldText.text = `Held gem: ${gem.key}`;
        this.statusText.text = `The ${gem.key} crystal hums in your hand.`;
        return;
      }

      const vat = this.vats.find((entry) => entry.outer === pick.pickedMesh);
      if (vat && this.carriedGem) {
        this._dropGem(vat);
      }
    };
  }

  _spawnGem() {
    const keys = Object.keys(this.gemColors);
    const key = keys[Math.floor(Math.random() * keys.length)];
    const gem = BABYLON.MeshBuilder.CreateIcoSphere(`gem_${performance.now()}`, {
      radius: 0.32,
      flat: false,
      subdivisions: 2
    }, this.scene);
    gem.position = new BABYLON.Vector3(-4.8, 0.95, -0.8 + ((Math.random() - 0.5) * 0.35));
    gem.isPickable = true;

    const material = this.materials.food(this.gemColors[key]).clone(`gemMat_${key}_${performance.now()}`);
    material.emissiveColor = this.gemColors[key].scale(0.55);
    gem.material = material;

    this.gems.push({ mesh: gem, key, material, state: 'belt', speed: this.beltSpeed + (Math.random() * 0.25) });
  }

  _dropGem(vat) {
    const gem = this.carriedGem;
    if (!gem) {
      return;
    }

    this.gemsSorted += 1;
    if (gem.key === vat.key) {
      this.correctSorts += 1;
      this.addScore(10);
      this.statusText.text = `Correct sort. ${vat.key} energy stabilizes.`;
      const sparkles = ParticlePresets.sparkles(this.scene, vat.outer.position.clone(), { rate: 30 });
      sparkles.start();
      setTimeout(() => {
        if (this._disposed) return;
        sparkles.stop();
        sparkles.dispose();
      }, 400);
    } else {
      this.wrongSorts += 1;
      this.addScore(-5);
      this.statusText.text = `Wrong vat. The cave rejects ${gem.key}.`;
    }

    vat.count += 1;
    const fillHeight = Math.max(0.01, Math.min(0.8, vat.count * 0.08));
    vat.fill.scaling.y = fillHeight / 0.01;
    vat.fill.position.y = 0.05 + (fillHeight / 2);

    gem.mesh.dispose();
    this.gems = this.gems.filter((entry) => entry !== gem);
    this.carriedGem = null;
    this.heldText.text = 'Held gem: none';
  }

  update(dt) {
    if (this.isComplete) {
      return;
    }

    this.elapsed += dt;
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this._spawnGem();
    }

    const targetLevel = Math.floor(this.elapsed / 10);
    if (targetLevel > this.speedLevel) {
      this.speedLevel = targetLevel;
      this.spawnInterval = Math.max(0.85, this.spawnInterval - 0.28);
      this.beltSpeed += 0.35;
      this.statusText.text = 'The conveyor quickens. The crystals want blood.';
    }

    this.gems = this.gems.filter((entry) => {
      if (entry.decorative) {
        entry.mesh.position.x += entry.speed * dt;
        if (entry.mesh.position.x > 5.2) {
          entry.mesh.position.x = -5.2;
        }
        return true;
      }

      if (entry.state === 'belt') {
        entry.mesh.position.x += entry.speed * dt;
        entry.mesh.rotation.y += dt * 2.4;
        entry.mesh.rotation.x += dt * 1.2;

        if (entry.mesh.position.x > 5.25) {
          this.missed += 1;
          this.addScore(-3);
          this.statusText.text = `${entry.key} fell into the reject chute.`;
          entry.mesh.dispose();
          return false;
        }
      }
      return true;
    });
  }

  onTimeUp() {
    if (this.carriedGem) {
      this.carriedGem.mesh.dispose();
      this.gems = this.gems.filter((entry) => entry !== this.carriedGem);
      this.carriedGem = null;
    }
    this.completePhase({
      correctSorts: this.correctSorts,
      wrongSorts: this.wrongSorts,
      missed: this.missed,
      gemsSorted: this.gemsSorted
    });
  }

  dispose() {
    this.scene.onPointerMove = null;
    this.scene.onPointerDown = null;
    this.gems.forEach((entry) => entry.mesh.dispose());
    super.dispose();
  }
}

window.JewelSort3D = JewelSort3D;
