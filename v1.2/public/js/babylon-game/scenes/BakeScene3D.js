// Evil Jeopardy 1.2 — BakeScene3D (Oven Temperature Control Minigame)

class BakeScene3D extends BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options) {
    super(engine, canvas, socketBridge, options);
    this.timeLimit = 45;

    this.currentTemp = 150;
    this.targetTemp = 180;
    this.zoneHalfRange = 14;
    this.tempVelocity = 0;
    this.controlDirection = 0;
    this.targetShiftElapsed = 0;
    this.timeInZone = 0;
    this.elapsed = 0;
    this.tempAccumulator = 0;
    this.cakeRise = 0.35;
    this.burnMeter = 0;
    this.splatterCooldown = 0;
    this.bakeMultiplier = this.hasBoost('oven-thermometer') ? 1.1 : 1.0;

    this.oven = null;
    this.cake = null;
    this.cakeMaterial = null;
    this.cakeBaseColor = null;
    this.heatLight = null;
    this.fireParticles = null;
    this.steamParticles = null;
    this.fireEmitter = null;

    this.tempText = null;
    this.targetText = null;
    this.zoneText = null;
    this.zoneHintText = null;
    this.gaugeZone = null;
    this.gaugeMarker = null;
    this.plusButton = null;
    this.minusButton = null;
  }

  getPhaseName() { return 'BAKE'; }

  async create() {
    const camera = CameraRigs.fixed(
      this.scene,
      new BABYLON.Vector3(0, 1.35, -6.6),
      new BABYLON.Vector3(0, 0.8, 0.4)
    );
    this.scene.activeCamera = camera;

    this._buildCounter();
    this._buildOven();
    this._buildCake();
    this._buildControls();
    this._shiftTarget(true);
    this._updateTemperatureDisplay();
    this.hud.showMessage('Hold +/- to keep the oven inside the target zone.', 2200);
  }

  _buildCounter() {
    const counter = BABYLON.MeshBuilder.CreateBox('bakeCounter', {
      width: 7,
      height: 0.35,
      depth: 3.2
    }, this.scene);
    counter.position = new BABYLON.Vector3(0, -0.2, 0.2);
    counter.material = this.materials.wood();
  }

  _buildOven() {
    this.oven = BABYLON.MeshBuilder.CreateBox('ovenBody', {
      width: 1.5,
      height: 1.2,
      depth: 1
    }, this.scene);
    this.oven.position = new BABYLON.Vector3(0, 0.6, 0.45);
    this.oven.material = this.materials.metal();

    const door = BABYLON.MeshBuilder.CreateBox('ovenDoor', {
      width: 1.3,
      height: 0.95,
      depth: 0.06
    }, this.scene);
    door.position = new BABYLON.Vector3(0, 0.62, -0.04);
    door.material = this.materials.metal();

    const windowFrame = BABYLON.MeshBuilder.CreateBox('windowFrame', {
      width: 0.82,
      height: 0.52,
      depth: 0.04
    }, this.scene);
    windowFrame.position = new BABYLON.Vector3(0, 0.64, -0.01);
    windowFrame.material = this.materials.metal();

    const windowGlass = BABYLON.MeshBuilder.CreateBox('windowGlass', {
      width: 0.68,
      height: 0.38,
      depth: 0.02
    }, this.scene);
    windowGlass.position = new BABYLON.Vector3(0, 0.64, -0.05);
    windowGlass.material = this.materials.glass();

    const tray = BABYLON.MeshBuilder.CreateBox('ovenTray', {
      width: 0.9,
      height: 0.03,
      depth: 0.65
    }, this.scene);
    tray.position = new BABYLON.Vector3(0, 0.24, 0.38);
    tray.material = this.materials.metal();

    const knobPanel = BABYLON.MeshBuilder.CreateBox('knobPanel', {
      width: 1.2,
      height: 0.12,
      depth: 0.1
    }, this.scene);
    knobPanel.position = new BABYLON.Vector3(0, 1.17, -0.02);
    knobPanel.material = this.materials.metal();

    this.fireEmitter = new BABYLON.TransformNode('fireEmitter', this.scene);
    this.fireEmitter.position = new BABYLON.Vector3(0, 0.5, 0.38);

    this.heatLight = new BABYLON.PointLight('ovenHeatLight', new BABYLON.Vector3(0, 0.62, 0.42), this.scene);
    this.heatLight.diffuse = new BABYLON.Color3(1, 0.55, 0.2);
    this.heatLight.intensity = 0.7;
    this.heatLight.range = 4;
  }

  _buildCake() {
    this.cake = BABYLON.MeshBuilder.CreateCylinder('cake', {
      diameter: 0.62,
      height: 0.28,
      tessellation: 24
    }, this.scene);
    this.cake.position = new BABYLON.Vector3(0, 0.28, 0.38);
    this.cake.scaling.y = this.cakeRise;

    this.cakeMaterial = this.materials.cakeSponge().clone('bakeCakeMaterial');
    this.cakeBaseColor = this.cakeMaterial.albedoColor.clone();
    this.cake.material = this.cakeMaterial;

    this.steamParticles = ParticlePresets.steam(this.scene, this.cake, { rate: 10 });
    this.steamParticles.direction1 = new BABYLON.Vector3(-0.05, 0.6, -0.05);
    this.steamParticles.direction2 = new BABYLON.Vector3(0.05, 1.0, 0.05);
    this.steamParticles.start();

    this.fireParticles = ParticlePresets.fire(this.scene, this.fireEmitter, { rate: 0 });
    this.fireParticles.direction1 = new BABYLON.Vector3(-0.08, 0.4, -0.08);
    this.fireParticles.direction2 = new BABYLON.Vector3(0.08, 1.2, 0.08);
    this.fireParticles.start();
  }

  _buildControls() {
    const panel = new BABYLON.GUI.StackPanel('bakeControlPanel');
    panel.width = '220px';
    panel.isVertical = true;
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    panel.left = '30px';
    this.hud.texture.addControl(panel);

    const title = new BABYLON.GUI.TextBlock('bakeTitle', 'Oven Controls');
    title.height = '34px';
    title.color = '#ffffff';
    title.fontSize = 24;
    title.outlineWidth = 2;
    title.outlineColor = '#000000';
    panel.addControl(title);

    const buttonRow = new BABYLON.GUI.StackPanel('buttonRow');
    buttonRow.isVertical = false;
    buttonRow.height = '60px';
    panel.addControl(buttonRow);

    this.minusButton = this._makeTempButton('minusTemp', '−', -1);
    this.plusButton = this._makeTempButton('plusTemp', '+', 1);
    buttonRow.addControl(this.minusButton);
    buttonRow.addControl(this.plusButton);

    this.tempText = new BABYLON.GUI.TextBlock('currentTempText', '150°');
    this.tempText.height = '34px';
    this.tempText.color = '#ffd27a';
    this.tempText.fontSize = 28;
    this.tempText.outlineWidth = 2;
    this.tempText.outlineColor = '#000000';
    panel.addControl(this.tempText);

    this.targetText = new BABYLON.GUI.TextBlock('targetTempText', 'Target 180°');
    this.targetText.height = '28px';
    this.targetText.color = '#ffffff';
    this.targetText.fontSize = 20;
    this.targetText.outlineWidth = 2;
    this.targetText.outlineColor = '#000000';
    panel.addControl(this.targetText);

    this.zoneText = new BABYLON.GUI.TextBlock('zoneText', 'Zone hidden');
    this.zoneText.height = '24px';
    this.zoneText.color = '#9edcff';
    this.zoneText.fontSize = 16;
    this.zoneText.textWrapping = true;
    panel.addControl(this.zoneText);

    this.zoneHintText = new BABYLON.GUI.TextBlock('zoneHintText', 'Target zone will shift every 10s');
    this.zoneHintText.height = '24px';
    this.zoneHintText.color = '#cfcfcf';
    this.zoneHintText.fontSize = 14;
    this.zoneHintText.textWrapping = true;
    panel.addControl(this.zoneHintText);

    const gaugeFrame = new BABYLON.GUI.Rectangle('bakeGauge');
    gaugeFrame.width = '34px';
    gaugeFrame.height = '220px';
    gaugeFrame.cornerRadius = 10;
    gaugeFrame.color = '#666666';
    gaugeFrame.thickness = 2;
    gaugeFrame.background = '#1f1f1f';
    gaugeFrame.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    gaugeFrame.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    gaugeFrame.left = '-70px';
    this.hud.texture.addControl(gaugeFrame);

    this.gaugeZone = new BABYLON.GUI.Rectangle('bakeGaugeZone');
    this.gaugeZone.width = '100%';
    this.gaugeZone.thickness = 0;
    this.gaugeZone.background = 'rgba(60, 220, 90, 0.55)';
    this.gaugeZone.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    gaugeFrame.addControl(this.gaugeZone);

    this.gaugeMarker = new BABYLON.GUI.Rectangle('bakeGaugeMarker');
    this.gaugeMarker.width = '130%';
    this.gaugeMarker.height = '6px';
    this.gaugeMarker.cornerRadius = 3;
    this.gaugeMarker.color = '#ffffff';
    this.gaugeMarker.thickness = 1;
    this.gaugeMarker.background = '#ff8844';
    this.gaugeMarker.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    gaugeFrame.addControl(this.gaugeMarker);
  }

  _makeTempButton(name, label, direction) {
    const button = BABYLON.GUI.Button.CreateSimpleButton(name, label);
    button.width = '90px';
    button.height = '46px';
    button.color = '#ffffff';
    button.fontSize = 28;
    button.cornerRadius = 10;
    button.thickness = 2;
    button.paddingRight = '8px';
    button.background = direction > 0 ? '#d84f2f' : '#2f72d8';

    const press = () => {
      this.controlDirection = direction;
      if (this.sounds) this.sounds.tempAdjust();
    };
    const release = () => {
      if (this.controlDirection === direction) {
        this.controlDirection = 0;
      }
    };

    button.onPointerDownObservable.add(press);
    button.onPointerUpObservable.add(release);
    button.onPointerOutObservable.add(release);
    return button;
  }

  _shiftTarget(initial = false) {
    this.targetShiftElapsed = 0;
    this.targetTemp = 160 + Math.random() * 60;
    this.hud.showMessage(initial ? 'Target zone set.' : 'Target zone shifted!', 1100);
    this._updateTemperatureDisplay();
  }

  _getBounds() {
    return {
      lower: this.targetTemp - this.zoneHalfRange,
      upper: this.targetTemp + this.zoneHalfRange
    };
  }

  _updateTemperatureDisplay() {
    if (!this.tempText || !this.gaugeZone || !this.gaugeMarker) return;

    const bounds = this._getBounds();
    this.tempText.text = `${Math.round(this.currentTemp)}°`;
    this.targetText.text = `Target ${Math.round(this.targetTemp)}°`;
    this.zoneText.text = this.hasBoost('oven-thermometer')
      ? `Exact zone: ${Math.round(bounds.lower)}° - ${Math.round(bounds.upper)}° (x1.1 score)`
      : 'Target zone active — keep the marker in the green band';

    const minTemp = 120;
    const maxTemp = 250;
    const totalRange = maxTemp - minTemp;
    const zoneHeight = Math.max(8, ((bounds.upper - bounds.lower) / totalRange) * 220);
    const zoneBottom = ((bounds.lower - minTemp) / totalRange) * 220;
    const markerBottom = BABYLON.Scalar.Clamp(((this.currentTemp - minTemp) / totalRange) * 220, 0, 220);

    this.gaugeZone.height = `${zoneHeight}px`;
    this.gaugeZone.top = `${-(220 - zoneBottom - zoneHeight)}px`;
    this.gaugeMarker.top = `${-(220 - markerBottom)}px`;
  }

  update(dt) {
    if (this.isComplete) return;

    this.elapsed += dt;
    this.tempAccumulator += this.currentTemp * dt;
    this.targetShiftElapsed += dt;
    this.splatterCooldown = Math.max(0, this.splatterCooldown - dt);

    if (this.targetShiftElapsed >= 10) {
      this._shiftTarget();
    }

    if (this.controlDirection !== 0) {
      this.tempVelocity += this.controlDirection * 90 * dt;
    }

    this.tempVelocity *= Math.pow(0.95, dt * 60);
    this.currentTemp = BABYLON.Scalar.Clamp(this.currentTemp + (this.tempVelocity * dt * 45), 110, 270);

    const bounds = this._getBounds();
    const tooCold = this.currentTemp < bounds.lower;
    const tooHot = this.currentTemp > bounds.upper;
    const inZone = !tooCold && !tooHot;

    if (inZone) {
      this.timeInZone += dt;
      this.cakeRise = BABYLON.Scalar.Lerp(this.cakeRise, 1.0, dt * 1.8);
      this.burnMeter = Math.max(0, this.burnMeter - dt * 0.5);
      // Periodic sizzle when baking in zone
      if (!this._sizzleCooldown) {
        this._sizzleCooldown = true;
        if (this.sounds) this.sounds.sizzle();
        setTimeout(() => { this._sizzleCooldown = false; }, 2000);
      }
    } else if (tooHot) {
      this.cakeRise = BABYLON.Scalar.Lerp(this.cakeRise, 1.5, dt * 1.4);
      this.burnMeter = Math.min(1, this.burnMeter + dt * 0.45);
      if (this.splatterCooldown <= 0 && this.cakeRise > 1.18) {
        this._spawnOverflowSplatter();
        this.splatterCooldown = 0.7;
      }
    } else {
      this.cakeRise = BABYLON.Scalar.Lerp(this.cakeRise, 0.3, dt * 1.2);
      this.burnMeter = Math.max(0, this.burnMeter - dt * 0.25);
    }

    this._updateCakeVisuals(tooCold, tooHot);
    this.setScore((this.timeInZone / this.timeLimit) * 100 * this.bakeMultiplier);
    this._updateTemperatureDisplay();
  }

  _updateCakeVisuals(tooCold, tooHot) {
    this.cake.scaling.y = this.cakeRise;
    this.cake.position.y = 0.24 + (0.14 * this.cakeRise);

    const heatLevel = BABYLON.Scalar.Clamp((this.currentTemp - 130) / 120, 0, 1);
    this.heatLight.intensity = 0.55 + (heatLevel * 1.1);

    const steamRate = tooCold ? 0 : 6 + (heatLevel * 14);
    this.steamParticles.emitRate = steamRate;
    this.fireParticles.emitRate = tooHot ? 20 + (this.burnMeter * 45) : 0;

    const burnTint = this.burnMeter * 0.5;
    this.cakeMaterial.albedoColor = new BABYLON.Color3(
      Math.max(0.28, this.cakeBaseColor.r - burnTint * 0.7),
      Math.max(0.20, this.cakeBaseColor.g - burnTint * 0.55),
      Math.max(0.12, this.cakeBaseColor.b - burnTint * 0.45)
    );
  }

  _spawnOverflowSplatter() {
    const splatter = ParticlePresets.splatter(
      this.scene,
      this.cake.position.clone().add(new BABYLON.Vector3(0, 0.05, 0)),
      new BABYLON.Color3(0.9, 0.74, 0.42),
      { count: 18 }
    );
    splatter.start();
    setTimeout(() => {
      splatter.stop();
      splatter.dispose();
    }, 450);
  }

  _finalizeBake(timedOut = false) {
    const avgTemp = this.elapsed > 0 ? this.tempAccumulator / this.elapsed : this.currentTemp;
    const bakeQuality = this.burnMeter > 0.35 || this.cakeRise > 1.15
      ? 'burnt'
      : this.cakeRise >= 0.82
        ? 'risen'
        : 'flat';

    this.setScore((this.timeInZone / this.timeLimit) * 100 * this.bakeMultiplier);
    this.completePhase({
      avgTemp: Math.round(avgTemp * 10) / 10,
      timeInZone: Math.round(this.timeInZone * 10) / 10,
      bakeQuality,
      timedOut
    });
  }

  onTimeUp() {
    this._finalizeBake(true);
  }

  onChaosEvent(event) {
    super.onChaosEvent(event);
    const kind = (event && (event.kind || event.type || event.name || '')).toString().toLowerCase();
    if (kind.includes('power')) {
      this.currentTemp = Math.max(110, this.currentTemp - 18);
      this.tempVelocity -= 8;
    } else if (kind.includes('hot')) {
      this.currentTemp = Math.min(270, this.currentTemp + 12);
      this.tempVelocity += 6;
    }
  }
}

window.BakeScene3D = BakeScene3D;