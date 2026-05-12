// Evil Jeopardy 1.2 — Cake Health HUD Display
// Shows a mini cake in bottom-right that deteriorates as player takes damage.

class CakeHealthDisplay {
  constructor(scene, hudTexture) {
    this.scene = scene;
    this.hudTexture = hudTexture;
    this.integrity = 100;
    this._meshes = [];

    this._buildHUD();
    this._buildMiniCake();
  }

  _buildHUD() {
    // Container panel bottom-right
    this.container = new BABYLON.GUI.Rectangle('cakeHealthContainer');
    this.container.width = '140px';
    this.container.height = '160px';
    this.container.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.container.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.container.left = '-20px';
    this.container.top = '-20px';
    this.container.background = 'rgba(0, 0, 0, 0.5)';
    this.container.cornerRadius = 12;
    this.container.thickness = 2;
    this.container.color = '#ff4444';
    this.hudTexture.addControl(this.container);

    // Integrity label
    this.label = new BABYLON.GUI.TextBlock('cakeLabel', '🎂 100%');
    this.label.color = '#ffffff';
    this.label.fontSize = 18;
    this.label.fontWeight = 'bold';
    this.label.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.label.paddingBottom = '8px';
    this.label.outlineWidth = 2;
    this.label.outlineColor = '#000000';
    this.container.addControl(this.label);

    // Health bar
    this.barBg = new BABYLON.GUI.Rectangle('cakeBarBg');
    this.barBg.width = '110px';
    this.barBg.height = '10px';
    this.barBg.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.barBg.top = '-35px';
    this.barBg.background = '#333333';
    this.barBg.cornerRadius = 5;
    this.barBg.thickness = 0;
    this.container.addControl(this.barBg);

    this.barFill = new BABYLON.GUI.Rectangle('cakeBarFill');
    this.barFill.width = '100%';
    this.barFill.height = '100%';
    this.barFill.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.barFill.background = '#44ff44';
    this.barFill.cornerRadius = 5;
    this.barFill.thickness = 0;
    this.barBg.addControl(this.barFill);
  }

  _buildMiniCake() {
    this.cakeIcon = new BABYLON.GUI.StackPanel('cakeIcon');
    this.cakeIcon.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.cakeIcon.top = '12px';
    this.cakeIcon.width = '80px';
    this.cakeIcon.height = '80px';
    this.container.addControl(this.cakeIcon);

    // Three cake layers
    this.layers = [];
    const colors = ['#f5e6d3', '#e8c9a0', '#d4a574'];
    for (let i = 0; i < 3; i++) {
      const layer = new BABYLON.GUI.Rectangle(`cakeLayer${i}`);
      layer.width = `${70 - i * 10}px`;
      layer.height = '20px';
      layer.background = colors[i];
      layer.cornerRadius = 4;
      layer.thickness = 1;
      layer.color = '#8b6914';
      layer.paddingTop = '2px';
      this.cakeIcon.addControl(layer);
      this.layers.push(layer);
    }
  }

  takeDamage(amount) {
    if (this._disposed) return this.integrity;
    this.integrity = Math.max(0, this.integrity - Math.max(0, amount));
    this._updateVisuals();
    return this.integrity;
  }

  _updateVisuals() {
    const pct = this.integrity;
    this.label.text = `🎂 ${Math.round(pct)}%`;
    this.barFill.width = `${pct}%`;

    // Color the bar based on health
    if (pct > 60) {
      this.barFill.background = '#44ff44';
      this.container.color = '#44ff44';
    } else if (pct > 30) {
      this.barFill.background = '#ffaa00';
      this.container.color = '#ffaa00';
    } else {
      this.barFill.background = '#ff4444';
      this.container.color = '#ff4444';
    }

    // Cake layer damage visuals
    if (pct < 80 && this.layers[0]) {
      this.layers[0].rotation = 0.05;
    }
    if (pct < 50 && this.layers[1]) {
      this.layers[1].left = '5px';
      this.layers[1].rotation = -0.08;
    }
    if (pct < 25 && this.layers[2]) {
      this.layers[2].left = '-8px';
      this.layers[2].rotation = 0.12;
      this.layers[2].background = '#aa7744';
    }
  }

  getIntegrity() {
    return this.integrity;
  }

  dispose() {
    this._disposed = true;
    this.hudTexture.removeControl(this.container);
    this.container.dispose();
  }
}

window.CakeHealthDisplay = CakeHealthDisplay;
