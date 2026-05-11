// Evil Jeopardy 1.2 — MixScene3D (Circular Stirring Minigame)
// Draw circles with mouse in a 3D mixing bowl. Track angular velocity across 3 rounds.

class MixScene3D extends BaseMinigameScene {
  constructor(engine, canvas, socketBridge, options) {
    super(engine, canvas, socketBridge, options);
    this.timeLimit = 50;
    this.currentRound = 0;
    this.rounds = [
      { targetSpeed: 1.5, duration: 15 },
      { targetSpeed: 2.5, duration: 15 },
      { targetSpeed: 3.5, duration: 15 }
    ];
    this.roundScores = [];
    this.roundStartTime = 0;
    this.timeInZone = 0;
    this.pointerHistory = [];
    this.angularVelocity = 0;
    this.whisk = null;
    this.bowl = null;
    this.batter = null;
    this.speedMeter = null;
  }

  getPhaseName() { return 'MIX'; }

  async create() {
    CameraRigs.topDown(this.scene, this.canvas, {
      distance: 5,
      target: new BABYLON.Vector3(0, 0, 0)
    }).inputs.clear();

    this._buildBowl();
    this._buildWhisk();
    this._buildBatter();
    this._buildSpeedMeter();
    this._setupPointerTracking();
    this._startRound(0);
  }

  _buildBowl() {
    this.bowl = BABYLON.MeshBuilder.CreateSphere('bowl', {
      diameter: 3, slice: 0.5
    }, this.scene);
    this.bowl.position.y = 0;
    this.bowl.material = this.materials.metal();
  }

  _buildWhisk() {
    this.whisk = BABYLON.MeshBuilder.CreateCylinder('whisk', {
      diameterTop: 0.05, diameterBottom: 0.1, height: 1.2
    }, this.scene);
    this.whisk.position = new BABYLON.Vector3(0, 0.6, 0);
    this.whisk.material = this.materials.metal();
  }

  _buildBatter() {
    this.batter = BABYLON.MeshBuilder.CreateDisc('batter', {
      radius: 1.2, tessellation: 32
    }, this.scene);
    this.batter.rotation.x = Math.PI / 2;
    this.batter.position.y = 0.1;
    this.batter.material = this.materials.food(
      new BABYLON.Color3(0.85, 0.75, 0.5)
    );
  }

  _buildSpeedMeter() {
    this.speedMeter = new BABYLON.GUI.Ellipse('speedMeter');
    this.speedMeter.width = '120px';
    this.speedMeter.height = '120px';
    this.speedMeter.thickness = 6;
    this.speedMeter.color = '#44ff44';
    this.speedMeter.background = 'rgba(0,0,0,0.3)';
    this.speedMeter.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.speedMeter.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    this.speedMeter.left = '-60px';
    this.hud.texture.addControl(this.speedMeter);

    this.speedText = new BABYLON.GUI.TextBlock('speedTxt', '0.0');
    this.speedText.color = '#ffffff';
    this.speedText.fontSize = 20;
    this.speedMeter.addControl(this.speedText);
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
    this.hud.showMessage(`Round ${index + 1}: Speed ${round.targetSpeed.toFixed(1)}`, 1500);
  }

  update(dt) {
    if (this.isComplete || this.currentRound >= this.rounds.length) return;

    this._computeAngularVelocity();
    this._updateSpeedMeter();

    const round = this.rounds[this.currentRound];
    const tolerance = this.hasBoost('electric-mixer') ? 1.0 : 0.5;
    const diff = Math.abs(this.angularVelocity - round.targetSpeed);

    if (diff <= tolerance) {
      this.timeInZone += dt;
    }

    if (this.angularVelocity > round.targetSpeed + 1.0) {
      const splat = ParticlePresets.splatter(
        this.scene,
        this.bowl.position.clone().add(new BABYLON.Vector3(
          (Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2
        )),
        new BABYLON.Color3(0.85, 0.75, 0.5)
      );
      splat.start();
      setTimeout(() => { splat.stop(); splat.dispose(); }, 500);
    }

    const elapsed = (performance.now() - this.roundStartTime) / 1000;
    if (elapsed >= round.duration) {
      const roundScore = Math.round((this.timeInZone / round.duration) * 33);
      this.roundScores.push(roundScore);
      this.addScore(roundScore);

      if (this.currentRound + 1 < this.rounds.length) {
        this._startRound(this.currentRound + 1);
      } else {
        this.completePhase({
          roundScores: this.roundScores,
          mixQuality: this.score >= 80 ? 'smooth' : this.score >= 50 ? 'decent' : 'lumpy'
        });
      }
    }
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
      const a1 = Math.atan2(recent[i-1].y - cy, recent[i-1].x - cx);
      const a2 = Math.atan2(recent[i].y - cy, recent[i].x - cx);
      let da = a2 - a1;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      totalAngle += Math.abs(da);
    }

    const timeDelta = (recent[recent.length-1].t - recent[0].t) / 1000;
    this.angularVelocity = timeDelta > 0 ? totalAngle / timeDelta : 0;
  }

  _updateSpeedMeter() {
    if (!this.speedText) return;
    this.speedText.text = this.angularVelocity.toFixed(1);
    const round = this.rounds[this.currentRound];
    if (!round) return;
    const tolerance = this.hasBoost('electric-mixer') ? 1.0 : 0.5;
    const diff = Math.abs(this.angularVelocity - round.targetSpeed);
    if (diff <= tolerance) {
      this.speedMeter.color = '#44ff44';
    } else if (diff <= tolerance * 2) {
      this.speedMeter.color = '#ffaa00';
    } else {
      this.speedMeter.color = '#ff4444';
    }
  }
}

window.MixScene3D = MixScene3D;