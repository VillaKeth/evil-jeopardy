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
    this.cakeTin = null;
    this.cakeMaterial = null;
    this.cakeBaseColor = null;
    this.heatLight = null;
    this.glassGlow = null;
    this.ovenGlass = null;
    this.heatingCoils = null;
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
    // Granite-style counter with front edge detail
    const counter = BABYLON.MeshBuilder.CreateBox('bakeCounter', {
      width: 7, height: 0.35, depth: 3.2
    }, this.scene);
    counter.position = new BABYLON.Vector3(0, -0.2, 0.2);
    counter.material = this.materials.marble();

    // Dark wood cabinets below
    const cabinet = BABYLON.MeshBuilder.CreateBox('cabinet', {
      width: 7, height: 1.0, depth: 3.0
    }, this.scene);
    cabinet.position = new BABYLON.Vector3(0, -0.88, 0.3);
    cabinet.material = this.materials.darkWood();

    // Cabinet door lines
    for (let i = -2; i <= 2; i++) {
      const doorLine = BABYLON.MeshBuilder.CreateBox(`cabLine${i}`, {
        width: 0.02, height: 0.85, depth: 0.01
      }, this.scene);
      doorLine.position = new BABYLON.Vector3(i * 1.4, -0.88, -1.22);
      doorLine.material = this.materials.darkMetal();
    }

    // Backsplash tile wall
    const backsplash = BABYLON.MeshBuilder.CreateBox('backsplash', {
      width: 7, height: 2.2, depth: 0.1
    }, this.scene);
    backsplash.position = new BABYLON.Vector3(0, 1.1, 1.85);
    backsplash.material = this.materials.tile(new BABYLON.Color3(0.88, 0.86, 0.82));
  }

  _buildOven() {
    this.oven = new BABYLON.TransformNode('ovenRoot', this.scene);
    this.oven.position = new BABYLON.Vector3(0, 0, 0.45);
    const ss = this.materials.stainlessSteel();

    // Outer body
    const body = BABYLON.MeshBuilder.CreateBox('ovenBody', {
      width: 1.6, height: 1.3, depth: 1.0
    }, this.scene);
    body.position = new BABYLON.Vector3(0, 0.63, 0);
    body.material = ss;
    body.parent = this.oven;

    // Interior cavity (dark recessed look)
    const interior = BABYLON.MeshBuilder.CreateBox('ovenInterior', {
      width: 1.3, height: 1.0, depth: 0.85
    }, this.scene);
    interior.position = new BABYLON.Vector3(0, 0.55, 0.02);
    interior.material = this.materials.ovenInterior();
    interior.parent = this.oven;

    // Door frame (slightly protruding)
    const doorFrame = BABYLON.MeshBuilder.CreateBox('doorFrame', {
      width: 1.45, height: 1.1, depth: 0.08
    }, this.scene);
    doorFrame.position = new BABYLON.Vector3(0, 0.58, -0.5);
    doorFrame.material = this.materials.darkMetal();
    doorFrame.parent = this.oven;

    // Window frame (chrome)
    const wFrame = BABYLON.MeshBuilder.CreateBox('windowFrame', {
      width: 0.9, height: 0.6, depth: 0.04
    }, this.scene);
    wFrame.position = new BABYLON.Vector3(0, 0.62, -0.52);
    wFrame.material = ss;
    wFrame.parent = this.oven;

    // Window glass (tinted orange when hot)
    this.ovenGlass = BABYLON.MeshBuilder.CreateBox('ovenGlass', {
      width: 0.78, height: 0.48, depth: 0.02
    }, this.scene);
    this.ovenGlass.position = new BABYLON.Vector3(0, 0.62, -0.55);
    this.ovenGlass.material = this.materials.ovenGlass(0);
    this.ovenGlass.parent = this.oven;

    // Door handle (chrome bar)
    const handle = BABYLON.MeshBuilder.CreateCylinder('ovenHandle', {
      diameter: 0.04, height: 0.7, tessellation: 12
    }, this.scene);
    handle.rotation.z = Math.PI / 2;
    handle.position = new BABYLON.Vector3(0, 0.32, -0.58);
    handle.material = ss;
    handle.parent = this.oven;

    // Handle mounting brackets
    for (const x of [-0.3, 0.3]) {
      const bracket = BABYLON.MeshBuilder.CreateBox(`hBracket${x}`, {
        width: 0.04, height: 0.04, depth: 0.06
      }, this.scene);
      bracket.position = new BABYLON.Vector3(x, 0.32, -0.56);
      bracket.material = ss;
      bracket.parent = this.oven;
    }

    // Control panel at top
    const controlPanel = BABYLON.MeshBuilder.CreateBox('controlPanel', {
      width: 1.45, height: 0.16, depth: 0.12
    }, this.scene);
    controlPanel.position = new BABYLON.Vector3(0, 1.24, -0.46);
    controlPanel.material = this.materials.darkMetal();
    controlPanel.parent = this.oven;

    // Knobs (4 decorative cylinders)
    for (let i = 0; i < 4; i++) {
      const knob = BABYLON.MeshBuilder.CreateCylinder(`knob${i}`, {
        diameter: 0.07, height: 0.03, tessellation: 16
      }, this.scene);
      knob.position = new BABYLON.Vector3(-0.42 + i * 0.28, 1.24, -0.53);
      knob.rotation.x = Math.PI / 2;
      knob.material = ss;
      knob.parent = this.oven;
    }

    // Oven tray (inside, with grill lines)
    const tray = BABYLON.MeshBuilder.CreateBox('ovenTray', {
      width: 1.1, height: 0.03, depth: 0.75
    }, this.scene);
    tray.position = new BABYLON.Vector3(0, 0.24, 0);
    tray.material = this.materials.metal();
    tray.parent = this.oven;

    // Grill rack lines on tray
    for (let i = 0; i < 6; i++) {
      const rack = BABYLON.MeshBuilder.CreateCylinder(`grillRod${i}`, {
        diameter: 0.015, height: 0.75, tessellation: 6
      }, this.scene);
      rack.rotation.x = Math.PI / 2;
      rack.position = new BABYLON.Vector3(-0.4 + i * 0.16, 0.27, 0);
      rack.material = this.materials.darkMetal();
      rack.parent = this.oven;
    }

    // Heating coils (top and bottom — glowing elements!)
    this.heatingCoils = [];
    for (const yPos of [0.12, 1.05]) {
      const coil = BABYLON.MeshBuilder.CreateTorus(`coil_${yPos}`, {
        diameter: 0.7, thickness: 0.03, tessellation: 32
      }, this.scene);
      coil.position = new BABYLON.Vector3(0, yPos, 0.02);
      coil.material = this.materials.heatingCoil(0);
      coil.parent = this.oven;
      this.heatingCoils.push(coil);
    }

    // Interior glow light (inside oven)
    this.heatLight = new BABYLON.PointLight('ovenHeatLight',
      new BABYLON.Vector3(0, 0.62, 0.47), this.scene);
    this.heatLight.diffuse = new BABYLON.Color3(1, 0.55, 0.2);
    this.heatLight.intensity = 0.7;
    this.heatLight.range = 3.5;

    // Secondary ambient glow from behind glass
    this.glassGlow = new BABYLON.PointLight('glassGlow',
      new BABYLON.Vector3(0, 0.62, -0.1), this.scene);
    this.glassGlow.diffuse = new BABYLON.Color3(1, 0.4, 0.1);
    this.glassGlow.intensity = 0;
    this.glassGlow.range = 2;

    this.fireEmitter = new BABYLON.TransformNode('fireEmitter', this.scene);
    this.fireEmitter.position = new BABYLON.Vector3(0, 0.5, 0.45);
  }

  _buildCake() {
    // Multi-layer cake with higher tessellation for smoother look
    this.cake = BABYLON.MeshBuilder.CreateCylinder('cake', {
      diameter: 0.62, height: 0.28, tessellation: 32
    }, this.scene);
    this.cake.position = new BABYLON.Vector3(0, 0.28, 0.45);
    this.cake.scaling.y = this.cakeRise;

    this.cakeMaterial = this.materials.cakeSponge().clone('bakeCakeMaterial');
    this.cakeBaseColor = this.cakeMaterial.albedoColor.clone();
    this.cake.material = this.cakeMaterial;

    // Cake tin (dark metal ring around cake)
    this.cakeTin = BABYLON.MeshBuilder.CreateTorus('cakeTin', {
      diameter: 0.68, thickness: 0.04, tessellation: 32
    }, this.scene);
    this.cakeTin.position = new BABYLON.Vector3(0, 0.27, 0.45);
    this.cakeTin.material = this.materials.darkMetal();

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

    // Glass tint: warm glow from inside
    if (this.ovenGlass) {
      const glassMat = this.ovenGlass.material;
      glassMat.emissiveColor = new BABYLON.Color3(
        heatLevel * 0.5, heatLevel * 0.18, 0
      );
      glassMat.alpha = 0.2 + heatLevel * 0.15;
    }

    // Glass glow light behind door
    if (this.glassGlow) {
      this.glassGlow.intensity = heatLevel * 0.6;
    }

    // Heating coils glow based on temperature
    if (this.heatingCoils) {
      this.heatingCoils.forEach(coil => {
        const mat = coil.material;
        if (mat && mat.emissiveColor) {
          mat.emissiveColor.r = Math.min(1, 0.1 + heatLevel * 0.9);
          mat.emissiveColor.g = Math.min(1, 0.02 + heatLevel * 0.25);
          mat.emissiveColor.b = 0.01;
        }
      });
    }

    const steamRate = tooCold ? 0 : 6 + (heatLevel * 14);
    this.steamParticles.emitRate = steamRate;
    this.fireParticles.emitRate = tooHot ? 20 + (this.burnMeter * 45) : 0;

    // Gradual browning: golden → deep brown → charred
    const browning = BABYLON.Scalar.Clamp(this.timeInZone / this.timeLimit, 0, 1);
    const burnTint = this.burnMeter * 0.5;
    const goldenR = BABYLON.Scalar.Lerp(this.cakeBaseColor.r, 0.72, browning * 0.5);
    const goldenG = BABYLON.Scalar.Lerp(this.cakeBaseColor.g, 0.52, browning * 0.6);
    const goldenB = BABYLON.Scalar.Lerp(this.cakeBaseColor.b, 0.22, browning * 0.7);
    this.cakeMaterial.albedoColor = new BABYLON.Color3(
      Math.max(0.22, goldenR - burnTint * 0.7),
      Math.max(0.14, goldenG - burnTint * 0.55),
      Math.max(0.08, goldenB - burnTint * 0.45)
    );
    // Increase roughness as cake bakes (matte crust)
    this.cakeMaterial.roughness = 0.85 + browning * 0.1 + this.burnMeter * 0.05;
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