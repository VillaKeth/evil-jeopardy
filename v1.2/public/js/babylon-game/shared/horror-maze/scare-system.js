// Evil Jeopardy 1.2 — Scare System (QTE prompts + damage)
// Handles scare event triggering, QTE key prompts, timing, and damage application.

class ScareSystem {
  constructor(scene, hudTexture, cakeHealth, sounds) {
    this.scene = scene;
    this.hudTexture = hudTexture;
    this.cakeHealth = cakeHealth;
    this.sounds = sounds;
    this._disposed = false;

    this.activeQTE = null;
    this._qteTimer = null;
    this._onKeyHandler = null;
    this._cooldown = false;
    this._fadeIntervals = [];
    this._qteTimeout = null;

    // QTE keys(never movement keys)
    this.keyPools = {
      easy: ['Q', 'E', 'F'],
      medium: ['Q', 'E', 'F', 'R'],
      hard: ['Q', 'E', 'F', 'R', 'Z', 'X']
    };

    // Damage tiers
    this.DAMAGE = { light: 3, medium: 7, heavy: 12, chase: 15 };

    this._buildQTEOverlay();
    this._bindKeys();
  }

  _buildQTEOverlay() {
    // Off-center key prompt — smaller, harder to spot
    this.qteContainer = new BABYLON.GUI.Rectangle('qteContainer');
    this.qteContainer.width = '70px';
    this.qteContainer.height = '70px';
    this.qteContainer.cornerRadius = 35;
    this.qteContainer.background = 'rgba(0, 0, 0, 0.7)';
    this.qteContainer.thickness = 3;
    this.qteContainer.color = '#ff4444';
    this.qteContainer.isVisible = false;
    this.qteContainer.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.qteContainer.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    this.hudTexture.addControl(this.qteContainer);

    this.qteKeyText = new BABYLON.GUI.TextBlock('qteKey', '');
    this.qteKeyText.color = '#ffffff';
    this.qteKeyText.fontSize = 36;
    this.qteKeyText.fontWeight = 'bold';
    this.qteContainer.addControl(this.qteKeyText);

    // Timer ring (shrinking bar below prompt)
    this.qteTimerBar = new BABYLON.GUI.Rectangle('qteTimerBar');
    this.qteTimerBar.width = '70px';
    this.qteTimerBar.height = '6px';
    this.qteTimerBar.top = '50px';
    this.qteTimerBar.background = '#ff4444';
    this.qteTimerBar.cornerRadius = 3;
    this.qteTimerBar.thickness = 0;
    this.qteTimerBar.isVisible = false;
    this.hudTexture.addControl(this.qteTimerBar);

    // Red vignette flash overlay
    this.damageFlash = new BABYLON.GUI.Rectangle('damageFlash');
    this.damageFlash.width = '100%';
    this.damageFlash.height = '100%';
    this.damageFlash.background = 'rgba(255, 0, 0, 0)';
    this.damageFlash.thickness = 0;
    this.damageFlash.isVisible = false;
    this.damageFlash.isHitTestVisible = false;
    this.hudTexture.addControl(this.damageFlash);
  }

  _bindKeys() {
    this._onKeyHandler = (e) => {
      if (this._disposed || !this.activeQTE) return;
      const pressed = e.key.toUpperCase();
      if (pressed === this.activeQTE.key) {
        this._resolveQTE(true);
      }
    };
    window.addEventListener('keydown', this._onKeyHandler);
  }

  /**
   * Trigger a QTE scare event.
   * @param {string} tier - 'light', 'medium', 'heavy'
   * @param {number} roomIndex - 0-13, used for difficulty scaling
   * @param {function} onResult - callback(success: boolean)
   */
  triggerQTE(tier, roomIndex, onResult) {
    if (this._disposed || this.activeQTE || this._cooldown) return;

    // Determine difficulty — tighter windows, harder to react
    let pool, window;
    if (roomIndex <= 3) { pool = this.keyPools.easy; window = 1200; }
    else if (roomIndex <= 7) { pool = this.keyPools.medium; window = 900; }
    else { pool = this.keyPools.hard; window = 700; }

    const key = pool[Math.floor(Math.random() * pool.length)];
    this.activeQTE = { key, tier, onResult, startTime: performance.now(), window };

    // Randomize position so it's not always centered — forces awareness
    const offsetX = (Math.random() - 0.5) * 300; // ±150px horizontal
    const offsetY = (Math.random() - 0.5) * 200; // ±100px vertical
    this.qteContainer.left = `${offsetX}px`;
    this.qteContainer.top = `${offsetY}px`;
    this.qteTimerBar.left = `${offsetX}px`;
    this.qteTimerBar.top = `${offsetY + 50}px`;

    // Show prompt
    this.qteKeyText.text = key;
    this.qteContainer.isVisible = true;
    this.qteTimerBar.isVisible = true;
    this.qteTimerBar.width = '70px';

    // Animate timer bar shrinking
    const startWidth = 70;
    const startTime = performance.now();
    this._qteTimer = setInterval(() => {
      if (this._disposed) { clearInterval(this._qteTimer); return; }
      const elapsed = performance.now() - startTime;
      const remaining = 1 - (elapsed / window);
      this.qteTimerBar.width = `${Math.max(0, remaining * startWidth)}px`;
      if (remaining <= 0.3) {
        this.qteContainer.color = '#ff4444';
      }
    }, 30);

    // Timeout = fail
    this._qteTimeout = setTimeout(() => {
      if (this.activeQTE && this.activeQTE.key === key) {
        this._resolveQTE(false);
      }
    }, window);
  }

  _resolveQTE(success) {
    if (!this.activeQTE) return;
    const { tier, onResult } = this.activeQTE;

    clearInterval(this._qteTimer);
    clearTimeout(this._qteTimeout);
    this.qteContainer.isVisible = false;
    this.qteTimerBar.isVisible = false;
    this.qteContainer.color = '#ffcc00';

    if (success) {
      this._showSuccess();
      if (this.sounds) this.sounds.knifeWhoosh();
    } else {
      const damage = this.DAMAGE[tier] || 7;
      this.cakeHealth.takeDamage(damage);
      this._showDamageFlash();
      if (this.sounds) this.sounds.cakeCrumble();
    }

    this.activeQTE = null;
    this._cooldown = true;
    setTimeout(() => { this._cooldown = false; }, 800);

    if (onResult) onResult(success);
  }

  _showSuccess() {
    const msg = new BABYLON.GUI.TextBlock('qteSuccess', '✓ DODGED!');
    msg.color = '#44ff44';
    msg.fontSize = 36;
    msg.fontWeight = 'bold';
    msg.outlineWidth = 3;
    msg.outlineColor = '#000000';
    this.hudTexture.addControl(msg);
    setTimeout(() => {
      this.hudTexture.removeControl(msg);
      msg.dispose();
    }, 600);
  }

  _showDamageFlash() {
    this.damageFlash.isVisible = true;
    this.damageFlash.background = 'rgba(255, 0, 0, 0.4)';
    let alpha = 0.4;
    const fade = setInterval(() => {
      alpha -= 0.04;
      if (alpha <= 0) {
        clearInterval(fade);
        this._fadeIntervals = this._fadeIntervals.filter(id => id !== fade);
        this.damageFlash.isVisible = false;
      } else {
        this.damageFlash.background = `rgba(255, 0, 0, ${alpha})`;
      }
    }, 30);
    this._fadeIntervals.push(fade);
  }

  /**
   * Trigger ambient scare (no QTE, just effects).
   */
  triggerAmbient(soundName) {
    if (this.sounds && this.sounds[soundName]) {
      this.sounds[soundName]();
    }
  }

  /**
   * Apply flat damage without QTE (e.g., chase caught, timeout).
   */
  applyDirectDamage(amount) {
    this.cakeHealth.takeDamage(amount);
    this._showDamageFlash();
    if (this.sounds) this.sounds.cakeCrumble();
  }

  isQTEActive() {
    return this.activeQTE !== null;
  }

  dispose() {
    this._disposed = true;
    clearInterval(this._qteTimer);
    clearTimeout(this._qteTimeout);
    this._fadeIntervals.forEach(id => clearInterval(id));
    if (this._onKeyHandler) {
      window.removeEventListener('keydown', this._onKeyHandler);
    }
    this.hudTexture.removeControl(this.qteContainer);
    this.hudTexture.removeControl(this.qteTimerBar);
    this.hudTexture.removeControl(this.damageFlash);
    this.qteContainer.dispose();
    this.qteTimerBar.dispose();
    this.damageFlash.dispose();
  }
}

window.ScareSystem = ScareSystem;
