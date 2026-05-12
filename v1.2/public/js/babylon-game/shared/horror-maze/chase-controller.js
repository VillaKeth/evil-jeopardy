// Evil Jeopardy 1.2 — Chase Controller (Room 12 state machine)
// Manages the auto-sprint chase sequence with QTE obstacles.

class ChaseController {
  constructor(scene, camera, hudTexture, scareSystem, sounds) {
    this.scene = scene;
    this.camera = camera;
    this.hudTexture = hudTexture;
    this.scareSystem = scareSystem;
    this.sounds = sounds;
    this._disposed = false;

    this.state = 'IDLE'; // IDLE, START, RUNNING, CAUGHT, ESCAPE
    this.failCount = 0;
    this.qteCount = 0;
    this.maxQTEs = 7;
    this.caught = false;
    this.elapsed = 0;
    this.speed = 8;
    this.steerX = 0;
    this.corridorLength = 30;
    this.playerZ = 0;

    this._qteInterval = null;
    this._steerHandler = null;
    this._entityDistance = 5;

    this._buildChaseHUD();
  }

  _buildChaseHUD() {
    this.runLabel = new BABYLON.GUI.TextBlock('runLabel', '');
    this.runLabel.color = '#ff4444';
    this.runLabel.fontSize = 56;
    this.runLabel.fontWeight = 'bold';
    this.runLabel.outlineWidth = 4;
    this.runLabel.outlineColor = '#000000';
    this.runLabel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.runLabel.top = '100px';
    this.runLabel.isVisible = false;
    this.hudTexture.addControl(this.runLabel);
  }

  start(onComplete) {
    this.onComplete = onComplete;
    this.state = 'START';
    this.elapsed = 0;
    this.playerZ = 0;

    this.runLabel.text = '⚠️ SOMETHING IS BEHIND YOU';
    this.runLabel.isVisible = true;
    if (this.sounds) this.sounds.entityRoar();

    setTimeout(() => {
      if (this._disposed) return;
      this.runLabel.text = '🏃 RUN!!!';
      if (this.sounds) this.sounds.chaseMusic();
      this.state = 'RUNNING';
      this._bindSteering();
      this._startQTESequence();

      setTimeout(() => {
        this.runLabel.isVisible = false;
      }, 1500);
    }, 2000);
  }

  _bindSteering() {
    this._steerHandler = (e) => {
      if (this._disposed || this.state !== 'RUNNING') return;
      if (e.key === 'a' || e.key === 'A') this.steerX = -1;
      else if (e.key === 'd' || e.key === 'D') this.steerX = 1;
    };
    const steerRelease = (e) => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'd' || e.key === 'D') {
        this.steerX = 0;
      }
    };
    window.addEventListener('keydown', this._steerHandler);
    window.addEventListener('keyup', steerRelease);
    this._steerRelease = steerRelease;
  }

  _startQTESequence() {
    this._qteInterval = setInterval(() => {
      if (this._disposed || this.state !== 'RUNNING') {
        clearInterval(this._qteInterval);
        return;
      }
      if (this.qteCount >= this.maxQTEs) {
        clearInterval(this._qteInterval);
        this._escape();
        return;
      }

      this.scareSystem.triggerQTE('medium', 12, (success) => {
        if (!success) {
          this.failCount++;
          this._entityDistance -= 1;
          this.speed = 4;
          setTimeout(() => { this.speed = 8; }, 500);

          if (this.failCount >= 3 && !this.caught) {
            this._catch();
          }
        } else {
          this._entityDistance = Math.min(5, this._entityDistance + 0.5);
        }
      });
      this.qteCount++;
    }, 3500);
  }

  _catch() {
    this.caught = true;
    this.state = 'CAUGHT';
    clearInterval(this._qteInterval);

    this.runLabel.text = '💀 CAUGHT!';
    this.runLabel.isVisible = true;
    if (this.sounds) this.sounds.jumpscareHit();
    this.scareSystem.applyDirectDamage(15);

    setTimeout(() => {
      if (this._disposed) return;
      this.runLabel.isVisible = false;
      this.state = 'RUNNING';
      this._entityDistance = 3;
      this._startQTESequence();
    }, 1500);
  }

  _escape() {
    this.state = 'ESCAPE';
    clearInterval(this._qteInterval);

    this.runLabel.text = '🚪 SAFE!';
    this.runLabel.isVisible = true;
    if (this.sounds) this.sounds.doorSlam();

    setTimeout(() => {
      if (this._disposed) return;
      this.runLabel.isVisible = false;
      if (this.onComplete) this.onComplete();
    }, 2000);
  }

  update(dt) {
    if (this._disposed) return;
    if (this.state !== 'RUNNING') return;

    this.elapsed += dt;
    this.playerZ += this.speed * dt;

    if (this.camera) {
      this.camera.position.x += this.steerX * 3 * dt;
      this.camera.position.x = BABYLON.Scalar.Clamp(this.camera.position.x, -1.5, 1.5);
      this.camera.position.z = this.playerZ;
    }

    if (this.camera) {
      this.camera.position.y += (Math.random() - 0.5) * 0.02;
    }

    if (this.playerZ >= this.corridorLength) {
      this._escape();
    }
  }

  dispose() {
    this._disposed = true;
    clearInterval(this._qteInterval);
    if (this._steerHandler) window.removeEventListener('keydown', this._steerHandler);
    if (this._steerRelease) window.removeEventListener('keyup', this._steerRelease);
    this.hudTexture.removeControl(this.runLabel);
    this.runLabel.dispose();
  }
}

window.ChaseController = ChaseController;
