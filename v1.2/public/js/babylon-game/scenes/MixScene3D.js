// Evil Jeopardy 1.2 — MixScene3D (Circular Stirring Minigame)
// Draw circles with mouse in a 3D mixing bowl. Track angular velocity across 3 rounds.
// Kitchen counter environment, batter color changes, splashes, speed zone ring.

class MixScene3D extends BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options) {
    super(engine, canvas, socketBridge, options);
    this.timeLimit = 50;
    this.currentRound = 0;
    this.rounds = [
      { targetSpeed: 1.5, duration: 15, label: 'Slow Fold', color: new BABYLON.Color3(0.85, 0.75, 0.5) },
      { targetSpeed: 2.5, duration: 15, label: 'Steady Beat', color: new BABYLON.Color3(0.82, 0.70, 0.45) },
      { targetSpeed: 3.5, duration: 15, label: 'Power Whip', color: new BABYLON.Color3(0.95, 0.88, 0.7) }
    ];
    this.roundScores = [];
    this.roundStartTime = 0;
    this.timeInZone = 0;
    this.totalTimeInZone = 0;
    this.pointerHistory = [];
    this.angularVelocity = 0;
    this.smoothedVelocity = 0;
    this.whisk = null;
    this.whiskHandle = null;
    this.bowl = null;
    this.batter = null;
    this.batterMaterial = null;
    this.speedMeter = null;
    this.speedText = null;
    this.roundLabel = null;
    this.targetZoneRing = null;
    this.zoneIndicator = null;
    this.roundProgressBar = null;
    this.roundProgressFill = null;
    this.counterMesh = null;
    this.mixerBase = null;
    this.flourParticles = null;
    this.splashParticles = null;
    this.swirlAngle = 0;
    this._mixSoundCooldown = false;
    this._splatCooldown = false;
  }

  getPhaseName() { return 'MIX'; }

  async create() {
    CameraRigs.topDown(this.scene, this.canvas, {
      distance: 6,
      target: new BABYLON.Vector3(0, 0.4, 0)
    }).inputs.clear();

    this._buildCounter();
    this._buildBowl();
    this._buildWhisk();
    this._buildBatter();
    this._buildSpeedMeter();
    this._buildRoundProgress();
    this._buildZoneIndicator();
    this._buildFlourParticles();
    this._setupPointerTracking();
    this._startRound(0);

    this.hud.showMessage('Stir in circles! Match the target speed.', 2400);
  }

  _buildCounter() {
    this.counterMesh = BABYLON.MeshBuilder.CreateBox('mixCounter', {
      width: 8, height: 0.35, depth: 6
    }, this.scene);
    this.counterMesh.position.y = -0.8;
    this.counterMesh.material = this.materials.wood();

    const backsplash = BABYLON.MeshBuilder.CreateBox('mixBacksplash', {
      width: 8, height: 2.5, depth: 0.2
    }, this.scene);
    backsplash.position = new BABYLON.Vector3(0, 0.5, 3.1);
    backsplash.material = this.materials.food(new BABYLON.Color3(0.88, 0.88, 0.85));

    if (!this.hasBoost('electric-mixer')) {
      const rack = BABYLON.MeshBuilder.CreateBox('utensilRack', {
        width: 0.12, height: 1.2, depth: 0.12
      }, this.scene);
      rack.position = new BABYLON.Vector3(2.8, 0.1, 2.6);
      rack.material = this.materials.metal();
    }

    if (this.hasBoost('electric-mixer')) {
      this._buildStandMixer();
    }
  }

  _buildStandMixer() {
    this.mixerBase = new BABYLON.TransformNode('mixerBase', this.scene);
    this.mixerBase.position = new BABYLON.Vector3(-2.5, -0.6, 1.8);

    const base = BABYLON.MeshBuilder.CreateCylinder('mixerBody', {
      diameterTop: 0.6, diameterBottom: 0.9, height: 0.7, tessellation: 16
    }, this.scene);
    base.material = this.materials.food(new BABYLON.Color3(0.85, 0.2, 0.25));
    base.parent = this.mixerBase;

    const arm = BABYLON.MeshBuilder.CreateBox('mixerArm', {
      width: 0.18, height: 0.15, depth: 1.1
    }, this.scene);
    arm.position = new BABYLON.Vector3(0, 0.45, -0.35);
    arm.material = this.materials.food(new BABYLON.Color3(0.85, 0.2, 0.25));
    arm.parent = this.mixerBase;

    const head = BABYLON.MeshBuilder.CreateCylinder('mixerHead', {
      diameter: 0.35, height: 0.4, tessellation: 12
    }, this.scene);
    head.position = new BABYLON.Vector3(0, 0.3, -0.85);
    head.material = this.materials.metal();
    head.parent = this.mixerBase;
  }

  _buildBowl() {
    this.bowl = BABYLON.MeshBuilder.CreateSphere('mixBowl', {
      diameter: 3.2, slice: 0.5
    }, this.scene);
    this.bowl.position.y = -0.15;

    const bowlMat = this.materials.metal();
    bowlMat.metallic = 0.85;
    bowlMat.roughness = 0.2;
    this.bowl.material = bowlMat;

    const rim = BABYLON.MeshBuilder.CreateTorus('bowlRim', {
      diameter: 3.2, thickness: 0.12, tessellation: 40
    }, this.scene);
    rim.position.y = -0.15;
    rim.material = bowlMat;
  }

  _buildWhisk() {
    const whiskRoot = new BABYLON.TransformNode('whiskRoot', this.scene);
    whiskRoot.position = new BABYLON.Vector3(0, 0.6, 0);
    this.whisk = whiskRoot;

    this.whiskHandle = BABYLON.MeshBuilder.CreateCylinder('whiskHandle', {
      diameterTop: 0.06, diameterBottom: 0.1, height: 1.4
    }, this.scene);
    this.whiskHandle.material = this.materials.metal();
    this.whiskHandle.parent = whiskRoot;

    const grip = BABYLON.MeshBuilder.CreateCylinder('whiskGrip', {
      diameter: 0.14, height: 0.35, tessellation: 10
    }, this.scene);
    grip.position.y = 0.52;
    grip.material = this.materials.food(new BABYLON.Color3(0.25, 0.25, 0.28));
    grip.parent = whiskRoot;

    for (let i = 0; i < 6; i++) {
      const wire = BABYLON.MeshBuilder.CreateCylinder(`whiskWire${i}`, {
        diameter: 0.02, height: 0.5, tessellation: 6
      }, this.scene);
      const angle = (i / 6) * Math.PI * 2;
      wire.position = new BABYLON.Vector3(
        Math.cos(angle) * 0.08, -0.45, Math.sin(angle) * 0.08
      );
      wire.rotation.x = 0.15;
      wire.rotation.z = Math.cos(angle) * 0.2;
      wire.material = this.materials.metal();
      wire.parent = whiskRoot;
    }
  }

  _buildBatter() {
    this.batter = BABYLON.MeshBuilder.CreateDisc('mixBatter', {
      radius: 1.3, tessellation: 40
    }, this.scene);
    this.batter.rotation.x = Math.PI / 2;
    this.batter.position.y = 0.05;
    this.batterMaterial = this.materials.food(
      new BABYLON.Color3(0.85, 0.75, 0.5)
    );
    this.batter.material = this.batterMaterial;
  }

  _buildSpeedMeter() {
    const panel = new BABYLON.GUI.StackPanel('mixHudPanel');
    panel.width = '160px';
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    panel.left = '-24px';
    this.hud.texture.addControl(panel);

    this.roundLabel = new BABYLON.GUI.TextBlock('roundLabel', '');
    this.roundLabel.height = '32px';
    this.roundLabel.color = '#ffffff';
    this.roundLabel.fontSize = 20;
    this.roundLabel.fontWeight = 'bold';
    this.roundLabel.outlineWidth = 2;
    this.roundLabel.outlineColor = '#000000';
    panel.addControl(this.roundLabel);

    this.speedMeter = new BABYLON.GUI.Ellipse('speedMeter');
    this.speedMeter.width = '130px';
    this.speedMeter.height = '130px';
    this.speedMeter.thickness = 8;
    this.speedMeter.color = '#44ff44';
    this.speedMeter.background = 'rgba(0,0,0,0.4)';
    panel.addControl(this.speedMeter);

    this.speedText = new BABYLON.GUI.TextBlock('speedTxt', '0.0');
    this.speedText.color = '#ffffff';
    this.speedText.fontSize = 24;
    this.speedText.fontWeight = 'bold';
    this.speedMeter.addControl(this.speedText);

    const targetLabel = new BABYLON.GUI.TextBlock('targetHint', 'speed');
    targetLabel.color = '#aaaaaa';
    targetLabel.fontSize = 12;
    targetLabel.top = '18px';
    this.speedMeter.addControl(targetLabel);

    this.zoneIndicator = new BABYLON.GUI.TextBlock('zoneInd', '');
    this.zoneIndicator.height = '30px';
    this.zoneIndicator.color = '#44ff44';
    this.zoneIndicator.fontSize = 16;
    this.zoneIndicator.fontWeight = 'bold';
    this.zoneIndicator.outlineWidth = 2;
    this.zoneIndicator.outlineColor = '#000000';
    panel.addControl(this.zoneIndicator);
  }

  _buildRoundProgress() {
    const frame = new BABYLON.GUI.Rectangle('mixProgressFrame');
    frame.width = '300px';
    frame.height = '16px';
    frame.cornerRadius = 8;
    frame.color = '#555555';
    frame.thickness = 2;
    frame.background = '#1a1a1a';
    frame.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    frame.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    frame.paddingBottom = '48px';
    this.hud.texture.addControl(frame);
    this.roundProgressBar = frame;

    this.roundProgressFill = new BABYLON.GUI.Rectangle('mixProgressFill');
    this.roundProgressFill.width = '0%';
    this.roundProgressFill.height = '100%';
    this.roundProgressFill.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.roundProgressFill.cornerRadius = 8;
    this.roundProgressFill.thickness = 0;
    this.roundProgressFill.background = '#44ff44';
    frame.addControl(this.roundProgressFill);
  }

  _buildZoneIndicator() {
    this.targetZoneRing = BABYLON.MeshBuilder.CreateTorus('targetZone', {
      diameter: 2.4, thickness: 0.06, tessellation: 48
    }, this.scene);
    this.targetZoneRing.position.y = 0.12;
    this.targetZoneRing.material = this.materials.frosting(new BABYLON.Color3(0.3, 1.0, 0.3));
    this.targetZoneRing.material.alpha = 0.4;
  }

  _buildFlourParticles() {
    this.flourParticles = ParticlePresets.flourDust(this.scene, this.bowl, { rate: 0 });
    this.flourParticles.start();
  }

  _setupPointerTracking() {
    this.scene.onPointerMove = (evt) => {
      const pick = this.scene.pick(evt.offsetX, evt.offsetY);
      if (pick.hit) {
        this.whisk.position.x = pick.pickedPoint.x * 0.8;
        this.whisk.position.z = pick.pickedPoint.z * 0.8;
      }

      this.pointerHistory.push({
        x: evt.offsetX,
        y: evt.offsetY,
        t: performance.now()
      });
      if (this.pointerHistory.length > 30) {
        this.pointerHistory.shift();
      }
    };
  }

  _startRound(index) {
    this.currentRound = index;
    this.roundStartTime = performance.now();
    this.timeInZone = 0;
    this.pointerHistory = [];
    const round = this.rounds[index];
    if (this.roundLabel) this.roundLabel.text = `R${index + 1}: ${round.label}`;
    this.hud.showMessage(`Round ${index + 1}: ${round.label} — Target ${round.targetSpeed.toFixed(1)}`, 1800);
    if (this.sounds) this.sounds.transition();
  }

  update(dt) {
    if (this.isComplete || this.currentRound >= this.rounds.length) return;

    this._computeAngularVelocity();
    this.smoothedVelocity = BABYLON.Scalar.Lerp(this.smoothedVelocity, this.angularVelocity, dt * 8);
    this._updateSpeedMeter();
    this._animateWhisk(dt);
    this._animateBatter(dt);
    this._updateRoundProgress();

    const round = this.rounds[this.currentRound];
    const tolerance = this.hasBoost('electric-mixer') ? 1.0 : 0.5;
    const diff = Math.abs(this.smoothedVelocity - round.targetSpeed);

    if (diff <= tolerance) {
      this.timeInZone += dt;
      this.totalTimeInZone += dt;
      if (this.zoneIndicator) this.zoneIndicator.text = '✓ IN ZONE';
      if (this.zoneIndicator) this.zoneIndicator.color = '#44ff44';
    } else if (diff <= tolerance * 2) {
      if (this.zoneIndicator) {
        this.zoneIndicator.text = this.smoothedVelocity < round.targetSpeed ? '↑ FASTER' : '↓ SLOWER';
        this.zoneIndicator.color = '#ffaa00';
      }
    } else {
      if (this.zoneIndicator) {
        this.zoneIndicator.text = this.smoothedVelocity < round.targetSpeed ? '↑↑ TOO SLOW' : '↓↓ TOO FAST!';
        this.zoneIndicator.color = '#ff4444';
      }
    }

    if (this.flourParticles) {
      this.flourParticles.emitRate = this.smoothedVelocity > 1.0 ? Math.min(this.smoothedVelocity * 12, 50) : 0;
    }

    if (this.smoothedVelocity > 0.5 && !this._mixSoundCooldown) {
      this._mixSoundCooldown = true;
      if (this.sounds) {
        this.hasBoost('electric-mixer') ? this.sounds.mixer() : this.sounds.whisk();
      }
      setTimeout(() => { this._mixSoundCooldown = false; }, 300);
    }

    if (this.smoothedVelocity > round.targetSpeed + 1.0 && !this._splatCooldown) {
      this._splatCooldown = true;
      const splat = ParticlePresets.splatter(
        this.scene,
        this.bowl.position.clone().add(new BABYLON.Vector3(
          (Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2
        )),
        round.color || new BABYLON.Color3(0.85, 0.75, 0.5)
      );
      splat.start();
      setTimeout(() => { splat.stop(); splat.dispose(); }, 500);
      if (this.sounds) this.sounds.miss();
      setTimeout(() => { this._splatCooldown = false; }, 400);
    }

    const elapsed = (performance.now() - this.roundStartTime) / 1000;
    if (elapsed >= round.duration) {
      const roundScore = Math.round((this.timeInZone / round.duration) * 33);
      this.roundScores.push(roundScore);
      this.addScore(roundScore);

      if (this.currentRound + 1 < this.rounds.length) {
        this._transitionBatterColor(this.currentRound + 1);
        this._startRound(this.currentRound + 1);
      } else {
        this.completePhase({
          roundScores: this.roundScores,
          mixQuality: this.score >= 80 ? 'smooth' : this.score >= 50 ? 'decent' : 'lumpy'
        });
      }
    }
  }

  _animateWhisk(dt) {
    if (!this.whisk) return;
    this.swirlAngle += this.smoothedVelocity * dt * 2;
    this.whisk.rotation.y = this.swirlAngle;

    const tiltAmount = Math.min(this.smoothedVelocity * 0.06, 0.25);
    this.whisk.rotation.x = Math.sin(this.swirlAngle * 1.5) * tiltAmount;
    this.whisk.rotation.z = Math.cos(this.swirlAngle * 1.5) * tiltAmount;
  }

  _animateBatter(dt) {
    if (!this.batter) return;
    this.batter.rotation.y += this.smoothedVelocity * dt * 0.3;
    const ripple = 1 + Math.sin(this.swirlAngle * 3) * this.smoothedVelocity * 0.008;
    this.batter.scaling.x = ripple;
    this.batter.scaling.z = ripple;
  }

  _transitionBatterColor(roundIndex) {
    if (!this.batterMaterial || roundIndex >= this.rounds.length) return;
    const targetColor = this.rounds[roundIndex].color;
    this.batterMaterial.albedoColor = targetColor;
  }

  _computeAngularVelocity() {
    if (this.pointerHistory.length < 5) {
      this.angularVelocity = 0;
      return;
    }
    const recent = this.pointerHistory.slice(-10);
    let totalAngle = 0;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    for (let i = 1; i < recent.length; i++) {
      const a1 = Math.atan2(recent[i - 1].y - cy, recent[i - 1].x - cx);
      const a2 = Math.atan2(recent[i].y - cy, recent[i].x - cx);
      let da = a2 - a1;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      totalAngle += Math.abs(da);
    }

    const timeDelta = (recent[recent.length - 1].t - recent[0].t) / 1000;
    this.angularVelocity = timeDelta > 0 ? totalAngle / timeDelta : 0;
  }

  _updateSpeedMeter() {
    if (!this.speedText) return;
    this.speedText.text = this.smoothedVelocity.toFixed(1);
    const round = this.rounds[this.currentRound];
    if (!round) return;
    const tolerance = this.hasBoost('electric-mixer') ? 1.0 : 0.5;
    const diff = Math.abs(this.smoothedVelocity - round.targetSpeed);
    if (diff <= tolerance) {
      this.speedMeter.color = '#44ff44';
    } else if (diff <= tolerance * 2) {
      this.speedMeter.color = '#ffaa00';
    } else {
      this.speedMeter.color = '#ff4444';
    }

    if (this.targetZoneRing) {
      const pulse = 0.3 + (diff <= tolerance ? 0.3 : 0.1) * (0.5 + Math.sin(performance.now() * 0.004) * 0.5);
      this.targetZoneRing.material.alpha = pulse;
    }
  }

  _updateRoundProgress() {
    if (!this.roundProgressFill) return;
    const round = this.rounds[this.currentRound];
    if (!round) return;
    const elapsed = (performance.now() - this.roundStartTime) / 1000;
    const pct = Math.min(elapsed / round.duration, 1);
    this.roundProgressFill.width = `${Math.round(pct * 100)}%`;

    const tolerance = this.hasBoost('electric-mixer') ? 1.0 : 0.5;
    const diff = Math.abs(this.smoothedVelocity - round.targetSpeed);
    this.roundProgressFill.background = diff <= tolerance ? '#44ff44' : diff <= tolerance * 2 ? '#ffaa00' : '#ff4444';
  }

  onTimeUp() {
    if (this.currentRound < this.rounds.length) {
      const round = this.rounds[this.currentRound];
      const elapsed = (performance.now() - this.roundStartTime) / 1000;
      const roundScore = Math.round((this.timeInZone / Math.max(elapsed, 1)) * 33);
      this.roundScores.push(roundScore);
      this.addScore(roundScore);
    }
    this.completePhase({
      roundScores: this.roundScores,
      mixQuality: this.score >= 80 ? 'smooth' : this.score >= 50 ? 'decent' : 'lumpy'
    });
  }

  dispose() {
    this.scene.onPointerMove = null;

    if (this.flourParticles) { this.flourParticles.stop(); this.flourParticles.dispose(); }

    if (this.speedMeter) this.speedMeter.dispose();
    if (this.speedText) this.speedText.dispose();
    if (this.roundLabel) this.roundLabel.dispose();
    if (this.zoneIndicator) this.zoneIndicator.dispose();
    if (this.roundProgressBar) this.roundProgressBar.dispose();

    this.whisk = null;
    this.whiskHandle = null;
    this.bowl = null;
    this.batter = null;
    this.batterMaterial = null;
    this.speedMeter = null;
    this.speedText = null;
    this.roundLabel = null;
    this.zoneIndicator = null;
    this.targetZoneRing = null;
    this.roundProgressBar = null;
    this.roundProgressFill = null;
    this.counterMesh = null;
    this.mixerBase = null;
    this.flourParticles = null;

    super.dispose();
  }
}

window.MixScene3D = MixScene3D;