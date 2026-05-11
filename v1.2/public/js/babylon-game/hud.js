// Evil Jeopardy 1.2 — Babylon.js GUI HUD Overlay

class HUD {
  constructor(scene) {
    this.scene = scene;
    this.texture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('hud', true, scene);

    this._buildTimer();
    this._buildScore();
    this._buildPhaseLabel();
    this._buildChaosBar();
  }

  _buildTimer() {
    this.timerText = new BABYLON.GUI.TextBlock('timer', '1:00');
    this.timerText.color = '#ffffff';
    this.timerText.fontSize = 36;
    this.timerText.fontFamily = 'monospace';
    this.timerText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.timerText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.timerText.paddingTop = '20px';
    this.timerText.paddingRight = '30px';
    this.timerText.outlineWidth = 2;
    this.timerText.outlineColor = '#000000';
    this.texture.addControl(this.timerText);
  }

  _buildScore() {
    this.scoreText = new BABYLON.GUI.TextBlock('score', 'Score: 0');
    this.scoreText.color = '#ffd700';
    this.scoreText.fontSize = 28;
    this.scoreText.fontFamily = 'monospace';
    this.scoreText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.scoreText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.scoreText.paddingTop = '20px';
    this.scoreText.paddingLeft = '30px';
    this.scoreText.outlineWidth = 2;
    this.scoreText.outlineColor = '#000000';
    this.texture.addControl(this.scoreText);
  }

  _buildPhaseLabel() {
    this.phaseText = new BABYLON.GUI.TextBlock('phase', 'PREP');
    this.phaseText.color = '#ffffff';
    this.phaseText.fontSize = 22;
    this.phaseText.fontFamily = 'Arial';
    this.phaseText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.phaseText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.phaseText.paddingTop = '20px';
    this.phaseText.outlineWidth = 2;
    this.phaseText.outlineColor = '#000000';
    this.texture.addControl(this.phaseText);
  }

  _buildChaosBar() {
    this.chaosContainer = new BABYLON.GUI.Rectangle('chaosContainer');
    this.chaosContainer.width = '200px';
    this.chaosContainer.height = '14px';
    this.chaosContainer.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.chaosContainer.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.chaosContainer.top = '55px';
    this.chaosContainer.background = '#333333';
    this.chaosContainer.cornerRadius = 7;
    this.chaosContainer.thickness = 1;
    this.chaosContainer.color = '#555555';
    this.chaosContainer.isVisible = false;
    this.texture.addControl(this.chaosContainer);

    this.chaosBar = new BABYLON.GUI.Rectangle('chaosBar');
    this.chaosBar.width = '0%';
    this.chaosBar.height = '100%';
    this.chaosBar.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.chaosBar.background = '#ff4444';
    this.chaosBar.cornerRadius = 7;
    this.chaosBar.thickness = 0;
    this.chaosContainer.addControl(this.chaosBar);
  }

  updateTimer(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    this.timerText.text = `${min}:${sec.toString().padStart(2, '0')}`;
    if (seconds <= 10) {
      this.timerText.color = '#ff4444';
    } else {
      this.timerText.color = '#ffffff';
    }
  }

  updateScore(score) {
    this.scoreText.text = `Score: ${Math.round(score)}`;
  }

  setPhase(phaseName) {
    this.phaseText.text = phaseName.toUpperCase();
  }

  setChaos(level, visible = true) {
    this.chaosContainer.isVisible = visible;
    const pct = Math.min(100, Math.max(0, level));
    this.chaosBar.width = `${pct}%`;
    if (pct > 75) {
      this.chaosBar.background = '#ff0000';
    } else if (pct > 40) {
      this.chaosBar.background = '#ff8800';
    } else {
      this.chaosBar.background = '#ffcc00';
    }
  }

  showMessage(text, duration = 2000) {
    const msg = new BABYLON.GUI.TextBlock('msg', text);
    msg.color = '#ffffff';
    msg.fontSize = 40;
    msg.fontFamily = 'Arial';
    msg.outlineWidth = 3;
    msg.outlineColor = '#000000';
    this.texture.addControl(msg);
    setTimeout(() => {
      this.texture.removeControl(msg);
      msg.dispose();
    }, duration);
  }

  dispose() {
    this.texture.dispose();
  }
}

window.HUD = HUD;
