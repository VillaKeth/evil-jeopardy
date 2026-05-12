// Evil Jeopardy 1.2 — CoolScene3D (Cake Cooling Minigame)

class CoolScene3D extends BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options) {
    super(engine, canvas, socketBridge, options);
    this.timeLimit = 40;

    this.currentTemp = 100;
    this.targetTemp = 25;
    this.elapsed = 0;
    this.isBlowing = false;
    this.fanIntensity = 0;
    this.highFanTime = 0;
    this.lowFanTime = 0;
    this.crackCount = 0;
    this.condensationCount = 0;
    this.reachedTarget = false;

    this.rack = null;
    this.cake = null;
    this.cakeMaterial = null;
    this.cakeBaseColor = null;
    this.fan = null;
    this.fanGuide = null;
    this.steamParticles = null;
    this.cracks = [];
    this.droplets = [];

    this.gaugeFill = null;
    this.gaugeText = null;
    this.intensityText = null;
  }

  getPhaseName() { return 'COOL'; }

  async create() {
    const camera = CameraRigs.topDown(this.scene, this.canvas, {
      distance: 6,
      target: new BABYLON.Vector3(0, 0.5, 0)
    });
    camera.inputs.clear();

    this._buildCounter();
    this._buildCoolingRack();
    this._buildCake();
    this._buildFan();
    this._buildGauge();
    this._setupPointerEvents();
    this._updateGauge();
    this.hud.showMessage('Hold click near the cake to fan it evenly.', 2200);
  }

  _buildCounter() {
    const counter = BABYLON.MeshBuilder.CreateBox('coolCounter', {
      width: 7,
      height: 0.3,
      depth: 7
    }, this.scene);
    counter.position.y = -0.18;
    counter.material = this.materials.wood();
  }

  _buildCoolingRack() {
    this.rack = new BABYLON.TransformNode('coolRack', this.scene);

    const rodMaterial = this.materials.metal();
    const start = -1.4;
    const spacing = 0.4;

    for (let i = 0; i < 8; i++) {
      const x = start + (i * spacing);
      const vertical = BABYLON.MeshBuilder.CreateCylinder(`rackVertical${i}`, {
        diameter: 0.05,
        height: 3.2,
        tessellation: 8
      }, this.scene);
      vertical.rotation.z = Math.PI / 2;
      vertical.position = new BABYLON.Vector3(x, 0.18, 0);
      vertical.material = rodMaterial;
      vertical.parent = this.rack;

      const z = start + (i * spacing);
      const horizontal = BABYLON.MeshBuilder.CreateCylinder(`rackHorizontal${i}`, {
        diameter: 0.05,
        height: 3.2,
        tessellation: 8
      }, this.scene);
      horizontal.rotation.x = Math.PI / 2;
      horizontal.position = new BABYLON.Vector3(0, 0.18, z);
      horizontal.material = rodMaterial;
      horizontal.parent = this.rack;
    }

    const legPositions = [
      new BABYLON.Vector3(-1.45, 0.06, -1.45),
      new BABYLON.Vector3(1.45, 0.06, -1.45),
      new BABYLON.Vector3(-1.45, 0.06, 1.45),
      new BABYLON.Vector3(1.45, 0.06, 1.45)
    ];

    legPositions.forEach((position, index) => {
      const leg = BABYLON.MeshBuilder.CreateCylinder(`rackLeg${index}`, {
        diameter: 0.07,
        height: 0.32,
        tessellation: 10
      }, this.scene);
      leg.position = position;
      leg.material = rodMaterial;
      leg.parent = this.rack;
    });
  }

  _buildCake() {
    this.cake = BABYLON.MeshBuilder.CreateCylinder('coolCake', {
      diameter: 1.8,
      height: 0.72,
      tessellation: 32
    }, this.scene);
    this.cake.position = new BABYLON.Vector3(0, 0.56, 0);

    this.cakeMaterial = this.materials.cakeSponge().clone('coolCakeMaterial');
    this.cakeBaseColor = this.cakeMaterial.albedoColor.clone();
    this.cake.material = this.cakeMaterial;
    this.cake.isPickable = true;

    this.steamParticles = ParticlePresets.steam(this.scene, this.cake, { rate: 24 });
    this.steamParticles.direction1 = new BABYLON.Vector3(-0.03, 0.7, -0.03);
    this.steamParticles.direction2 = new BABYLON.Vector3(0.03, 1.2, 0.03);
    this.steamParticles.start();
  }

  _buildFan() {
    this.fanGuide = BABYLON.MeshBuilder.CreateGround('fanGuide', {
      width: 8,
      height: 8
    }, this.scene);
    this.fanGuide.position.y = 1.6;
    this.fanGuide.isVisible = false;
    this.fanGuide.isPickable = true;

    this.fan = new BABYLON.TransformNode('fanRoot', this.scene);
    this.fan.position = new BABYLON.Vector3(0, 1.62, 2.2);

    const disc = BABYLON.MeshBuilder.CreateDisc('fanDisc', {
      radius: 0.45,
      tessellation: 32
    }, this.scene);
    disc.rotation.x = Math.PI / 2;
    disc.position = BABYLON.Vector3.Zero();
    disc.material = this.materials.frosting(new BABYLON.Color3(0.65, 0.88, 1.0));
    disc.parent = this.fan;

    const handle = BABYLON.MeshBuilder.CreateBox('fanHandle', {
      width: 0.12,
      height: 0.45,
      depth: 0.08
    }, this.scene);
    handle.position = new BABYLON.Vector3(0, -0.28, 0);
    handle.material = this.materials.wood();
    handle.parent = this.fan;
  }

  _buildGauge() {
    const panel = new BABYLON.GUI.StackPanel('coolHudPanel');
    panel.width = '240px';
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    panel.left = '28px';
    this.hud.texture.addControl(panel);

    const title = new BABYLON.GUI.TextBlock('coolTitle', 'Cooling Gauge');
    title.height = '34px';
    title.color = '#ffffff';
    title.fontSize = 24;
    title.outlineWidth = 2;
    title.outlineColor = '#000000';
    panel.addControl(title);

    this.gaugeText = new BABYLON.GUI.TextBlock('coolTempText', '100°');
    this.gaugeText.height = '30px';
    this.gaugeText.color = '#ffb26b';
    this.gaugeText.fontSize = 26;
    this.gaugeText.outlineWidth = 2;
    this.gaugeText.outlineColor = '#000000';
    panel.addControl(this.gaugeText);

    this.intensityText = new BABYLON.GUI.TextBlock('coolIntensityText', 'Fan intensity: 0%');
    this.intensityText.height = '24px';
    this.intensityText.color = '#d6ecff';
    this.intensityText.fontSize = 16;
    panel.addControl(this.intensityText);

    const gaugeFrame = new BABYLON.GUI.Rectangle('coolGaugeFrame');
    gaugeFrame.width = '220px';
    gaugeFrame.height = '28px';
    gaugeFrame.cornerRadius = 12;
    gaugeFrame.color = '#666666';
    gaugeFrame.thickness = 2;
    gaugeFrame.background = '#1e1e1e';
    panel.addControl(gaugeFrame);

    this.gaugeFill = new BABYLON.GUI.Rectangle('coolGaugeFill');
    this.gaugeFill.width = '100%';
    this.gaugeFill.height = '100%';
    this.gaugeFill.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.gaugeFill.cornerRadius = 12;
    this.gaugeFill.thickness = 0;
    gaugeFrame.addControl(this.gaugeFill);

    const note = new BABYLON.GUI.TextBlock('coolNote', 'Too strong for 2s = cracks. Too weak for 5s = condensation.');
    note.height = '42px';
    note.color = '#ffffff';
    note.fontSize = 14;
    note.textWrapping = true;
    panel.addControl(note);
  }

  _setupPointerEvents() {
    this.scene.onPointerMove = (evt) => {
      const pick = this.scene.pick(evt.offsetX, evt.offsetY, mesh => mesh === this.fanGuide);
      if (!pick.hit) return;
      this.fan.position.x = pick.pickedPoint.x;
      this.fan.position.z = pick.pickedPoint.z;
    };

    this.scene.onPointerDown = () => {
      if (!this.isComplete) {
        this.isBlowing = true;
      }
    };

    this.scene.onPointerUp = () => {
      this.isBlowing = false;
    };
  }

  update(dt) {
    if (this.isComplete) return;

    this.elapsed += dt;

    const cakePos = this.cake.getAbsolutePosition();
    const fanPos = this.fan.getAbsolutePosition();
    const distance = BABYLON.Vector3.Distance(cakePos, fanPos);
    const targetIntensity = this.isBlowing ? BABYLON.Scalar.Clamp(1 - ((distance - 0.5) / 2.2), 0, 1) : 0;
    this.fanIntensity = BABYLON.Scalar.Lerp(this.fanIntensity, targetIntensity, dt * 6);

    const passiveCooling = 0.35;
    const activeCooling = this.fanIntensity * 12;
    this.currentTemp = Math.max(18, this.currentTemp - ((passiveCooling + activeCooling) * dt));

    if (this.fanIntensity > 0.8) {
      this.highFanTime += dt;
      if (this.highFanTime >= 2) {
        this._spawnCrack();
        this.highFanTime = 0.35;
      }
    } else {
      this.highFanTime = 0;
    }

    if (this.fanIntensity < 0.2) {
      this.lowFanTime += dt;
      if (this.lowFanTime >= 5) {
        this._spawnDroplets();
        this.lowFanTime = 1.5;
      }
    } else {
      this.lowFanTime = 0;
    }

    this._updateSteamDirection(distance);
    this._updateCakeSurface();
    this._updateGauge();
    this._updateScore();

    if (!this.reachedTarget && this.currentTemp <= this.targetTemp + 1.5) {
      this.reachedTarget = true;
      this.hud.showMessage('Cake cooled! Hold steady...', 1200);
      this._finalizeCooling(false);
    }
  }

  _updateSteamDirection(distance) {
    const cakePos = this.cake.getAbsolutePosition();
    const fanPos = this.fan.getAbsolutePosition();
    const deflect = cakePos.subtract(fanPos);
    if (distance < 2.7 && this.fanIntensity > 0.1) {
      deflect.normalize();
      this.steamParticles.direction1 = new BABYLON.Vector3(deflect.x * 0.5, 0.6, deflect.z * 0.5);
      this.steamParticles.direction2 = new BABYLON.Vector3(deflect.x * 1.1, 1.2, deflect.z * 1.1);
    } else {
      this.steamParticles.direction1 = new BABYLON.Vector3(-0.03, 0.7, -0.03);
      this.steamParticles.direction2 = new BABYLON.Vector3(0.03, 1.2, 0.03);
    }

    const steamLevel = BABYLON.Scalar.Clamp((this.currentTemp - 25) / 75, 0, 1);
    this.steamParticles.emitRate = steamLevel * 30;
  }

  _updateCakeSurface() {
    const color = this._getTempColor();
    this.cakeMaterial.albedoColor = color;
    this.cake.scaling.y = 1 - (this.crackCount * 0.02);
  }

  _getTempColor() {
    const cool = new BABYLON.Color3(0.54, 0.78, 0.96);
    const target = new BABYLON.Color3(0.63, 0.88, 0.55);
    const warm = new BABYLON.Color3(1.0, 0.78, 0.34);
    const hot = new BABYLON.Color3(0.98, 0.42, 0.34);
    const normalized = BABYLON.Scalar.Clamp((this.currentTemp - 25) / 75, 0, 1);

    if (normalized > 0.66) {
      return BABYLON.Color3.Lerp(warm, hot, (normalized - 0.66) / 0.34);
    }
    if (normalized > 0.33) {
      return BABYLON.Color3.Lerp(target, warm, (normalized - 0.33) / 0.33);
    }
    return BABYLON.Color3.Lerp(cool, target, normalized / 0.33);
  }

  _spawnCrack() {
    const crack = BABYLON.MeshBuilder.CreateBox(`cakeCrack${this.crackCount}`, {
      width: 0.68,
      height: 0.03,
      depth: 0.06
    }, this.scene);
    crack.position = new BABYLON.Vector3(
      (Math.random() - 0.5) * 0.45,
      0.93,
      (Math.random() - 0.5) * 0.45
    );
    crack.rotation.y = Math.random() * Math.PI;
    crack.material = this.materials.food(new BABYLON.Color3(0.38, 0.19, 0.15));
    this.cracks.push(crack);
    this.crackCount += 1;
    this.hud.showMessage('Too much fan! Crack formed.', 900);
    if (this.sounds) this.sounds.miss();
  }

  _spawnDroplets() {
    this.condensationCount += 1;
    for (let i = 0; i < 6; i++) {
      const droplet = BABYLON.MeshBuilder.CreateSphere(`droplet${this.condensationCount}_${i}`, {
        diameter: 0.08,
        segments: 8
      }, this.scene);
      droplet.position = new BABYLON.Vector3(
        (Math.random() - 0.5) * 1.1,
        0.92 + Math.random() * 0.08,
        (Math.random() - 0.5) * 1.1
      );
      droplet.material = this.materials.glass();
      this.droplets.push(droplet);
    }
    this.hud.showMessage('Condensation forming — keep the air moving.', 1100);
  }

  _updateGauge() {
    if (!this.gaugeFill) return;
    const progress = BABYLON.Scalar.Clamp(1 - ((this.currentTemp - 25) / 75), 0, 1);
    const color = this._getTempColor();
    this.gaugeFill.width = `${Math.round(progress * 100)}%`;
    this.gaugeFill.background = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
    this.gaugeText.text = `${Math.round(this.currentTemp)}° / 25°`;
    this.intensityText.text = `Fan intensity: ${Math.round(this.fanIntensity * 100)}%`;
  }

  _updateScore() {
    const tempCloseness = BABYLON.Scalar.Clamp(1 - (Math.abs(this.currentTemp - this.targetTemp) / 75), 0, 1);
    const speedBonus = BABYLON.Scalar.Clamp(1 - (this.elapsed / this.timeLimit) * 0.35, 0.65, 1);
    const efficiency = tempCloseness * speedBonus;
    const crackPenalty = Math.min(0.8, this.crackCount * 0.1);
    this.setScore(efficiency * (1 - crackPenalty) * 100);
  }

  _finalizeCooling(timedOut) {
    this._updateScore();
    this.completePhase({
      finalTemp: Math.round(this.currentTemp * 10) / 10,
      crackCount: this.crackCount,
      coolingTime: Math.round(this.elapsed * 10) / 10,
      timedOut
    });
  }

  onTimeUp() {
    this._finalizeCooling(true);
  }

  dispose() {
    this.scene.onPointerMove = null;
    this.scene.onPointerDown = null;
    this.scene.onPointerUp = null;

    if (this.steamParticles) { this.steamParticles.stop(); this.steamParticles.dispose(); }

    this.cracks.forEach(m => { if (m && !m.isDisposed()) m.dispose(); });
    this.cracks = [];
    this.droplets.forEach(m => { if (m && !m.isDisposed()) m.dispose(); });
    this.droplets = [];

    if (this.gaugeFill) this.gaugeFill.dispose();
    if (this.gaugeText) this.gaugeText.dispose();
    if (this.intensityText) this.intensityText.dispose();

    this.rack = null;
    this.cake = null;
    this.cakeMaterial = null;
    this.cakeBaseColor = null;
    this.fan = null;
    this.fanGuide = null;
    this.steamParticles = null;
    this.gaugeFill = null;
    this.gaugeText = null;
    this.intensityText = null;

    super.dispose();
  }
}

window.CoolScene3D = CoolScene3D;