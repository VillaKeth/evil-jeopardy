// Evil Jeopardy 1.2 - Bake Scene (Temperature Control Minigame)

class BakeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BakeScene' });

    this.socket = null;
    this.teamId = null;
    this.inventory = [];
    this.boosts = {};
    this.chaosEvents = [];

    this.timeLimit = 45;
    this.timeRemaining = 45;
    this.timerEvent = null;
    this.completionEvent = null;
    this.powerFlickerEvent = null;
    this.isComplete = false;

    this.displayMinTemp = 150;
    this.displayMaxTemp = 450;
    this.roomTemperature = 70;
    this.targetTemperature = 350;
    this.baseTargetHalfWidth = 25;
    this.targetHalfWidth = 25;
    this.targetMin = 325;
    this.targetMax = 375;
    this.currentTemperature = 310;
    this.temperatureVelocity = 0;
    this.heatLevel = 65;
    this.heatStep = 5;
    this.timeInZoneMs = 0;
    this.totalTrackedMs = 0;
    this.chaosPenalty = 0;
    this.powerOutageActive = false;

    this.hasThermometer = false;
    this.thermometerBonus = 1.1;

    this.sceneObjects = [];
    this.completionObjects = [];

    this.cursors = null;
    this.thermometerGraphics = null;
    this.heatDialGraphics = null;
    this.heatWaveGraphics = null;
    this.ovenGlow = null;
    this.timerText = null;
    this.bakeClockText = null;
    this.temperatureText = null;
    this.zoneText = null;
    this.scoreText = null;
    this.feedbackText = null;
    this.heatText = null;
    this.toolText = null;
    this.instructionText = null;
    this.plusButton = null;
    this.minusButton = null;
    this.chaosOverlay = null;
  }

  init(data) {
    this.socket = data.socket || this.registry.get('socket') || null;
    this.teamId = data.teamId || 'unknown-team';
    this.inventory = data.inventory || this.registry.get('inventory') || [];
    this.boosts = data.boosts || {};
    this.chaosEvents = data.chaosEvents || [];

    this.timeRemaining = this.timeLimit;
    this.isComplete = false;
    this.currentTemperature = 310;
    this.temperatureVelocity = 0;
    this.heatLevel = 65;
    this.timeInZoneMs = 0;
    this.totalTrackedMs = 0;
    this.chaosPenalty = 0;
    this.powerOutageActive = false;
    this.sceneObjects = [];
    this.completionObjects = [];

    const thermometerItem = this.inventory.find((item) => {
      if (typeof item === 'string') {
        return item === 'thermometer';
      }

      return item && item.key === 'thermometer';
    }) || null;

    this.hasThermometer = Boolean(thermometerItem);
    this.thermometerBonus = thermometerItem && typeof thermometerItem.bonus === 'number'
      ? thermometerItem.bonus
      : 1.1;

    this.targetHalfWidth = this.baseTargetHalfWidth + (
      this.hasThermometer ? Math.round(this.baseTargetHalfWidth * this.thermometerBonus) : 0
    );
    this.targetMin = this.targetTemperature - this.targetHalfWidth;
    this.targetMax = this.targetTemperature + this.targetHalfWidth;
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');

    this.createBackground();
    this.createHeader();
    this.createThermometerPanel();
    this.createOvenArea();
    this.createControlPanel();
    this.createStatusPanel();

    this.cursors = this.input.keyboard.createCursorKeys();

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true
    });

    if (this.boosts['recipe-hint'] || this.boosts.hint > 0) {
      this.showRecipeHint();
    }

    this.applyChaosEvents();
    this.refreshTelemetry();
    this.refreshHeatDial();
    this.redrawThermometer();
    this.refreshOvenVisuals(0);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  trackObject(gameObject) {
    if (gameObject) {
      this.sceneObjects.push(gameObject);
    }

    return gameObject;
  }

  createBackground() {
    const bg = this.trackObject(this.add.graphics());
    bg.fillGradientStyle(0x141b2d, 0x141b2d, 0x261938, 0x2d1f49, 1);
    bg.fillRect(0, 0, 1024, 768);

    const deco = this.trackObject(this.add.graphics());
    deco.lineStyle(2, 0xffffff, 0.06);
    deco.strokeRoundedRect(24, 24, 976, 720, 20);
    deco.lineBetween(294, 110, 294, 660);
    deco.lineBetween(720, 110, 720, 660);
    deco.lineBetween(60, 110, 964, 110);
    deco.lineBetween(60, 660, 964, 660);
  }

  createHeader() {
    this.trackObject(this.add.text(512, 28, '🔥 BAKE PHASE', {
      fontFamily: 'Arial',
      fontSize: '36px',
      color: '#f0f6fc',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0));

    this.timerText = this.trackObject(this.add.text(944, 30, `Time: ${this.timeRemaining}s`, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#f0f6fc',
      fontStyle: 'bold'
    }).setOrigin(1, 0));

    this.bakeClockText = this.trackObject(this.add.text(80, 34, `Bake clock: ${this.getBakeClockRemaining()}s`, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#ffa657',
      fontStyle: 'bold'
    }));

    this.instructionText = this.trackObject(this.add.text(512, 76, 'Use ↑/↓ or the +/- controls to keep the oven in the green zone.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#c9d1d9',
      align: 'center'
    }).setOrigin(0.5, 0));
  }

  createThermometerPanel() {
    this.trackObject(this.add.rectangle(170, 382, 210, 500, 0x0f1726, 0.68).setStrokeStyle(2, 0x334155, 0.95));
    this.trackObject(this.add.text(170, 132, 'THERMOMETER', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#79c0ff',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.thermometerGraphics = this.trackObject(this.add.graphics());

    [150, 225, 300, 375, 450].forEach((temp) => {
      const y = this.getTemperatureY(temp);
      this.trackObject(this.add.text(212, y, `${temp}°`, {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#8b949e'
      }).setOrigin(0, 0.5));
    });

    this.temperatureText = this.trackObject(this.add.text(170, 602, '', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#f0f6fc',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.zoneText = this.trackObject(this.add.text(170, 634, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#56d364',
      align: 'center'
    }).setOrigin(0.5));
  }

  createOvenArea() {
    this.trackObject(this.add.rectangle(512, 390, 360, 360, 0x2d333b, 1).setStrokeStyle(5, 0x8b949e, 0.9));
    this.trackObject(this.add.rectangle(512, 300, 230, 44, 0x0f1726, 0.9).setStrokeStyle(2, 0x475569, 0.9));
    this.trackObject(this.add.text(512, 300, 'OVEN STATUS', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#f0f6fc',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.trackObject(this.add.rectangle(512, 438, 250, 180, 0x111827, 1).setStrokeStyle(4, 0x6b7280, 0.95));
    this.ovenGlow = this.trackObject(this.add.rectangle(512, 438, 190, 124, 0x56d364, 0.35));
    this.trackObject(this.add.rectangle(512, 438, 190, 124, 0xffffff, 0.02).setStrokeStyle(2, 0xffffff, 0.15));

    this.heatWaveGraphics = this.trackObject(this.add.graphics());

    this.feedbackText = this.trackObject(this.add.text(512, 558, 'PERFECT!', {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#56d364',
      fontStyle: 'bold',
      stroke: '#0f1726',
      strokeThickness: 4
    }).setOrigin(0.5));

    this.scoreText = this.trackObject(this.add.text(512, 602, 'Time in zone: 0%', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#f0f6fc',
      fontStyle: 'bold'
    }).setOrigin(0.5));
  }

  createControlPanel() {
    this.trackObject(this.add.rectangle(858, 382, 248, 500, 0x0f1726, 0.68).setStrokeStyle(2, 0x334155, 0.95));
    this.trackObject(this.add.text(858, 132, 'HEAT DIAL', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffa657',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.heatDialGraphics = this.trackObject(this.add.graphics());

    this.heatText = this.trackObject(this.add.text(858, 324, '', {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#f0f6fc',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.minusButton = this.trackObject(this.add.rectangle(798, 420, 76, 76, 0xda3633, 0.9).setStrokeStyle(3, 0xff7b72, 0.95));
    const minusLabel = this.trackObject(this.add.text(798, 420, '-', {
      fontFamily: 'Arial',
      fontSize: '54px',
      color: '#f0f6fc',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.plusButton = this.trackObject(this.add.rectangle(918, 420, 76, 76, 0x238636, 0.9).setStrokeStyle(3, 0x56d364, 0.95));
    const plusLabel = this.trackObject(this.add.text(918, 420, '+', {
      fontFamily: 'Arial',
      fontSize: '48px',
      color: '#f0f6fc',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    [this.minusButton, minusLabel].forEach((item) => {
      item.setInteractive({ useHandCursor: true });
      item.on('pointerdown', () => this.adjustHeat(-this.heatStep));
    });

    [this.plusButton, plusLabel].forEach((item) => {
      item.setInteractive({ useHandCursor: true });
      item.on('pointerdown', () => this.adjustHeat(this.heatStep));
    });

    this.trackObject(this.add.text(858, 506, 'Click or tap the buttons\nfor quick heat changes.', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#c9d1d9',
      align: 'center'
    }).setOrigin(0.5));

    this.toolText = this.trackObject(this.add.text(858, 598, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#79c0ff',
      align: 'center',
      wordWrap: { width: 200 }
    }).setOrigin(0.5));
  }

  createStatusPanel() {
    this.trackObject(this.add.text(512, 642, 'Stabilize the oven for the full bake and avoid temperature swings.', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#8b949e',
      align: 'center'
    }).setOrigin(0.5));
  }

  getTemperatureY(temp) {
    const top = 176;
    const bottom = 548;
    const progress = Phaser.Math.Clamp((temp - this.displayMinTemp) / (this.displayMaxTemp - this.displayMinTemp), 0, 1);
    return bottom - ((bottom - top) * progress);
  }

  getTemperatureColor() {
    if (this.currentTemperature >= this.targetMin && this.currentTemperature <= this.targetMax) {
      return 0x56d364;
    }

    if (this.currentTemperature > this.targetMax) {
      return 0xff6b6b;
    }

    return 0x58a6ff;
  }

  redrawThermometer() {
    if (!this.thermometerGraphics) {
      return;
    }

    const x = 170;
    const top = 176;
    const bottom = 548;
    const tubeWidth = 46;
    const bulbRadius = 28;
    const fillColor = this.getTemperatureColor();
    const displayTemp = Phaser.Math.Clamp(this.currentTemperature, this.displayMinTemp, this.displayMaxTemp);
    const fillTop = this.getTemperatureY(displayTemp);
    const zoneTop = this.getTemperatureY(this.targetMax);
    const zoneBottom = this.getTemperatureY(this.targetMin);

    this.thermometerGraphics.clear();
    this.thermometerGraphics.fillStyle(0x101728, 0.96);
    this.thermometerGraphics.fillRoundedRect(x - (tubeWidth / 2), top, tubeWidth, bottom - top, 18);
    this.thermometerGraphics.fillCircle(x, bottom + 32, bulbRadius + 4);

    this.thermometerGraphics.fillStyle(0x56d364, 0.32);
    this.thermometerGraphics.fillRoundedRect(x - 15, zoneTop, 30, zoneBottom - zoneTop, 10);

    this.thermometerGraphics.fillStyle(fillColor, 0.92);
    this.thermometerGraphics.fillRoundedRect(x - 12, fillTop, 24, bottom - fillTop, 10);
    this.thermometerGraphics.fillCircle(x, bottom + 32, bulbRadius);

    this.thermometerGraphics.lineStyle(4, 0xe5e7eb, 0.9);
    this.thermometerGraphics.strokeRoundedRect(x - (tubeWidth / 2), top, tubeWidth, bottom - top, 18);
    this.thermometerGraphics.strokeCircle(x, bottom + 32, bulbRadius + 2);

    this.temperatureText.setText(`Current: ${Math.round(this.currentTemperature)}°F`);
    this.temperatureText.setColor(`#${fillColor.toString(16).padStart(6, '0')}`);
    this.zoneText.setText(`Target zone: ${Math.round(this.targetMin)}°F - ${Math.round(this.targetMax)}°F`);
  }

  refreshHeatDial() {
    if (!this.heatDialGraphics) {
      return;
    }

    const x = 858;
    const y = 220;
    const width = 166;
    const height = 28;
    const fillWidth = width * (this.heatLevel / 100);
    const fillColor = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x58a6ff),
      Phaser.Display.Color.ValueToColor(0xffa657),
      100,
      this.heatLevel
    );
    const dialColor = Phaser.Display.Color.GetColor(fillColor.r, fillColor.g, fillColor.b);

    this.heatDialGraphics.clear();
    this.heatDialGraphics.fillStyle(0x111827, 1);
    this.heatDialGraphics.fillRoundedRect(x - (width / 2), y - (height / 2), width, height, 14);
    this.heatDialGraphics.fillStyle(dialColor, 1);
    this.heatDialGraphics.fillRoundedRect(x - (width / 2), y - (height / 2), fillWidth, height, 14);
    this.heatDialGraphics.lineStyle(3, 0xe5e7eb, 0.85);
    this.heatDialGraphics.strokeRoundedRect(x - (width / 2), y - (height / 2), width, height, 14);

    this.heatText.setText(`Heat: ${this.heatLevel}%`);
    this.toolText.setText(
      this.hasThermometer
        ? `Thermometer bonus active:\nGreen zone widened to ${Math.round(this.targetMin)}°-${Math.round(this.targetMax)}°.`
        : 'No oven thermometer:\nTarget window stays narrow.'
    );
  }

  adjustHeat(amount) {
    if (this.isComplete) {
      return;
    }

    this.heatLevel = Phaser.Math.Clamp(this.heatLevel + amount, 0, 100);
    this.refreshHeatDial();
  }

  getBakeClockRemaining() {
    return Math.max(0, Math.ceil((this.timeRemaining / this.timeLimit) * 30));
  }

  updateTimer() {
    if (this.isComplete) {
      return;
    }

    this.timeRemaining -= 1;
    this.timerText.setText(`Time: ${this.timeRemaining}s`);
    if (this.bakeClockText) {
      this.bakeClockText.setText(`Bake clock: ${this.getBakeClockRemaining()}s`);
    }

    if (this.timeRemaining <= 10) {
      this.timerText.setColor('#ff7b72');
    } else if (this.timeRemaining <= 30) {
      this.timerText.setColor('#ffa657');
    }

    if (this.timeRemaining <= 0) {
      this.completeMinigame();
    }
  }

  applyChaosEvents() {
    const bakeEvents = this.chaosEvents.filter((event) => {
      if (!event || !event.phase) {
        return false;
      }

      if (Array.isArray(event.phase)) {
        return event.phase.includes('bake') || event.phase.includes('any');
      }

      return event.phase === 'bake' || event.phase === 'any';
    });

    this.chaosPenalty = Phaser.Math.Clamp(bakeEvents.reduce((sum, event) => {
      return sum + (event.scorePenalty || 0);
    }, 0), 0, 1);

    if (!bakeEvents.length) {
      return;
    }

    if (bakeEvents.some((event) => event.key === 'power-out')) {
      this.powerOutageActive = true;
      this.chaosOverlay = this.trackObject(this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.1));
      this.chaosOverlay.setDepth(2);
      this.powerFlickerEvent = this.time.addEvent({
        delay: 220,
        loop: true,
        callback: () => {
          if (this.chaosOverlay && this.chaosOverlay.scene) {
            this.chaosOverlay.setAlpha(0.06 + (Math.random() * 0.16));
          }
        }
      });
    }

    bakeEvents.forEach((event, index) => {
      const banner = this.add.text(512, 110 + (index * 32), `⚠ ${event.name} (-${Math.round((event.scorePenalty || 0) * 100)}%)`, {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#ff7b72',
        fontStyle: 'bold',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 10, y: 4 }
      }).setOrigin(0.5).setDepth(4);

      this.sceneObjects.push(banner);

      this.tweens.add({
        targets: banner,
        alpha: 0,
        y: banner.y - 10,
        duration: 700,
        delay: 2200 + (index * 250),
        onComplete: () => banner.destroy()
      });
    });
  }

  showRecipeHint() {
    const overlay = this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.8).setDepth(10);
    const hintText = this.add.text(512, 384, [
      '💡 RECIPE HINT 💡',
      '',
      'Aim for the green target band and avoid chasing the edges.',
      'Tap the heat up or down in small steps to counter the drift.',
      this.hasThermometer ? 'Oven thermometer bonus: your safe zone is wider.' : 'No thermometer bonus: precise adjustments matter more.'
    ].join('\n'), {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#ffa657',
      align: 'center',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(10);

    this.sceneObjects.push(overlay, hintText);

    this.time.delayedCall(5000, () => {
      this.tweens.add({
        targets: [overlay, hintText],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          overlay.destroy();
          hintText.destroy();
        }
      });
    });
  }

  updateTemperature(time, delta) {
    const deltaSeconds = delta / 1000;
    const normalizedHeat = this.heatLevel / 100;
    const equilibriumTemp = this.roomTemperature + (normalizedHeat * 420);
    const thermalAcceleration = ((equilibriumTemp - this.currentTemperature) * 5.5) - (this.temperatureVelocity * 2.8);
    const ambientNoise = (Math.sin(time / 850) * 4) + Phaser.Math.FloatBetween(-1.5, 1.5);
    const outageNoise = this.powerOutageActive
      ? (Math.sin(time / 140) * 11) + Phaser.Math.FloatBetween(-5, 5)
      : 0;

    this.temperatureVelocity += thermalAcceleration * deltaSeconds;
    this.currentTemperature += this.temperatureVelocity * deltaSeconds;
    this.currentTemperature += (ambientNoise + outageNoise) * deltaSeconds;
    this.currentTemperature = Phaser.Math.Clamp(this.currentTemperature, this.roomTemperature, 500);
  }

  refreshTelemetry() {
    const inZone = this.currentTemperature >= this.targetMin && this.currentTemperature <= this.targetMax;
    const percentInZone = this.totalTrackedMs > 0
      ? Math.round((this.timeInZoneMs / this.totalTrackedMs) * 100)
      : 0;

    if (inZone) {
      this.feedbackText.setText('PERFECT!');
      this.feedbackText.setColor('#56d364');
    } else if (this.currentTemperature > this.targetMax) {
      this.feedbackText.setText('TOO HOT!');
      this.feedbackText.setColor('#ff7b72');
    } else {
      this.feedbackText.setText('TOO COLD!');
      this.feedbackText.setColor('#58a6ff');
    }

    this.scoreText.setText(`Time in zone: ${percentInZone}%`);
    this.redrawThermometer();
  }

  refreshOvenVisuals(time) {
    if (!this.ovenGlow || !this.heatWaveGraphics) {
      return;
    }

    const tempRatio = Phaser.Math.Clamp(
      (this.currentTemperature - this.displayMinTemp) / (this.displayMaxTemp - this.displayMinTemp),
      0,
      1
    );
    const glowColor = this.getTemperatureColor();
    const flicker = this.powerOutageActive ? (Math.sin(time / 90) * 0.05) : 0;

    this.ovenGlow.setFillStyle(glowColor, 1);
    this.ovenGlow.setAlpha(0.18 + (tempRatio * 0.45) + flicker);

    this.heatWaveGraphics.clear();
    this.heatWaveGraphics.lineStyle(4, glowColor, 0.45 + (tempRatio * 0.3));

    for (let i = 0; i < 3; i += 1) {
      const waveTop = 330 - (i * 28);
      const offset = Math.sin((time / 220) + i) * 12;
      this.heatWaveGraphics.beginPath();
      this.heatWaveGraphics.moveTo(452, waveTop);
      this.heatWaveGraphics.bezierCurveTo(470 + offset, waveTop - 12, 498 - offset, waveTop + 12, 512, waveTop - 4);
      this.heatWaveGraphics.bezierCurveTo(526 + offset, waveTop - 18, 554 - offset, waveTop + 10, 572, waveTop - 6);
      this.heatWaveGraphics.strokePath();
    }
  }

  calculateFinalScore() {
    const rawPercent = this.totalTrackedMs > 0 ? (this.timeInZoneMs / this.totalTrackedMs) * 100 : 0;
    const adjustedScore = rawPercent * (1 - this.chaosPenalty);
    return Math.round(Phaser.Math.Clamp(adjustedScore, 0, 100));
  }

  completeMinigame() {
    if (this.isComplete) {
      return;
    }

    this.isComplete = true;

    if (this.timerEvent) {
      this.timerEvent.remove();
      this.timerEvent = null;
    }

    if (this.powerFlickerEvent) {
      this.powerFlickerEvent.remove();
      this.powerFlickerEvent = null;
    }

    const rawPercent = this.totalTrackedMs > 0 ? Math.round((this.timeInZoneMs / this.totalTrackedMs) * 100) : 0;
    const finalScore = this.calculateFinalScore();

    if (this.socket) {
      this.socket.emit('baking:phase-complete', {
        teamId: this.teamId,
        phase: 'bake',
        score: finalScore,
        details: {
          rawPercent,
          chaosPenalty: this.chaosPenalty,
          usedThermometer: this.hasThermometer,
          targetRange: {
            min: Math.round(this.targetMin),
            max: Math.round(this.targetMax)
          },
          heatLevel: this.heatLevel,
          timeRemaining: this.timeRemaining
        }
      });
    }

    this.showCompletionScreen(finalScore, rawPercent);
  }

  showCompletionScreen(score, rawPercent) {
    this.completionObjects = [];

    const overlay = this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.78).setDepth(12);
    const panel = this.add.rectangle(512, 384, 620, 360, 0x161b22, 0.96).setStrokeStyle(3, 0x30363d).setDepth(12);

    this.completionObjects.push(overlay, panel);
    this.completionObjects.push(this.add.text(512, 248, 'BAKE COMPLETE!', {
      fontFamily: 'Arial',
      fontSize: '42px',
      color: '#ffa657',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(13));

    this.completionObjects.push(this.add.text(512, 308, `Score: ${score}/100`, {
      fontFamily: 'Arial',
      fontSize: '38px',
      color: '#56d364',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(13));

    this.completionObjects.push(this.add.text(512, 368, `Time in target zone: ${rawPercent}%`, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#f0f6fc'
    }).setOrigin(0.5).setDepth(13));

    this.completionObjects.push(this.add.text(512, 410, `Chaos penalty: -${Math.round(this.chaosPenalty * 100)}%   •   Tool: ${this.hasThermometer ? 'Oven Thermometer' : 'None'}`, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#8b949e',
      align: 'center'
    }).setOrigin(0.5).setDepth(13));

    this.completionObjects.push(this.add.text(512, 468, `Final temp: ${Math.round(this.currentTemperature)}°F   •   Target: ${Math.round(this.targetMin)}°-${Math.round(this.targetMax)}°F`, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#c9d1d9',
      align: 'center'
    }).setOrigin(0.5).setDepth(13));

    this.completionObjects.push(this.add.text(512, 524, 'Returning to phase select...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#79c0ff',
      fontStyle: 'italic'
    }).setOrigin(0.5).setDepth(13));

    this.cameras.main.fade(500, 0, 0, 0);

    this.completionEvent = this.time.delayedCall(3000, () => {
      this.scene.start('PhaseSelectScene', {
        socket: this.socket,
        teamId: this.teamId,
        inventory: this.inventory,
        boosts: this.boosts,
        chaosEvents: this.chaosEvents
      });
    });
  }

  update(time, delta) {
    if (this.isComplete) {
      return;
    }

    if (this.cursors && Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this.adjustHeat(this.heatStep);
    }

    if (this.cursors && Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      this.adjustHeat(-this.heatStep);
    }

    this.updateTemperature(time, delta);
    this.totalTrackedMs += delta;

    if (this.currentTemperature >= this.targetMin && this.currentTemperature <= this.targetMax) {
      this.timeInZoneMs += delta;
    }

    this.refreshTelemetry();
    this.refreshOvenVisuals(time);
  }

  shutdown() {
    if (this.timerEvent) {
      this.timerEvent.remove();
      this.timerEvent = null;
    }

    if (this.completionEvent) {
      this.completionEvent.remove();
      this.completionEvent = null;
    }

    if (this.powerFlickerEvent) {
      this.powerFlickerEvent.remove();
      this.powerFlickerEvent = null;
    }

    this.time.removeAllEvents();
    this.tweens.killAll();

    const interactiveObjects = [this.plusButton, this.minusButton];
    interactiveObjects.forEach((item) => {
      if (item && item.removeAllListeners) {
        item.removeAllListeners();
      }
    });

    this.sceneObjects.forEach((object) => {
      if (object && object.scene) {
        object.destroy();
      }
    });
    this.sceneObjects = [];

    if (this.completionObjects) {
      this.completionObjects.forEach((object) => {
        if (object && object.scene) {
          object.destroy();
        }
      });
      this.completionObjects = [];
    }

    this.thermometerGraphics = null;
    this.heatDialGraphics = null;
    this.heatWaveGraphics = null;
    this.ovenGlow = null;
    this.timerText = null;
    this.bakeClockText = null;
    this.temperatureText = null;
    this.zoneText = null;
    this.scoreText = null;
    this.feedbackText = null;
    this.heatText = null;
    this.toolText = null;
    this.instructionText = null;
    this.plusButton = null;
    this.minusButton = null;
    this.chaosOverlay = null;
    this.cursors = null;
  }
}

window.BakeScene = BakeScene;
