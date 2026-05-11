// Evil Jeopardy 1.2 - Cool Scene (Patience Timing)

class CoolScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CoolScene' });

    this.socket = null;
    this.teamId = null;
    this.inventory = [];
    this.boosts = {};
    this.chaosEvents = [];

    this.timeLimit = 30;
    this.timeRemaining = 30;
    this.timerEvent = null;
    this.roundTransitionEvent = null;
    this.completionEvent = null;
    this.isComplete = false;

    this.rounds = [];
    this.currentRoundIndex = 0;
    this.currentRound = null;
    this.roundActive = false;
    this.temperature = 400;
    this.coolingRate = 0;
    this.chaosPenalty = 0;

    this.barX = 170;
    this.barY = 310;
    this.barWidth = 500;
    this.barHeight = 34;
    this.minTemp = 40;
    this.maxTemp = 400;

    this.timerText = null;
    this.roundText = null;
    this.scoreText = null;
    this.temperatureText = null;
    this.instructionText = null;
    this.feedbackText = null;
    this.feedbackDetailText = null;
    this.removeButton = null;
    this.removeButtonText = null;
    this.tempBarGraphics = null;
    this.indicatorGraphics = null;
    this.sweetSpotGraphics = null;
    this.cakeGraphics = null;
    this.roundDots = [];
    this.chaosOverlay = null;

    this.persistentObjects = [];
    this.hintObjects = [];
    this.feedbackObjects = [];
    this.completionObjects = [];
    this.chaosBanners = [];
  }

  init(data) {
    this.socket = data.socket || this.registry.get('socket') || null;
    this.teamId = data.teamId || 'unknown-team';
    this.inventory = data.inventory || [];
    this.boosts = data.boosts || {};
    this.chaosEvents = data.chaosEvents || [];

    this.timeRemaining = this.timeLimit;
    this.timerEvent = null;
    this.roundTransitionEvent = null;
    this.completionEvent = null;
    this.isComplete = false;
    this.currentRoundIndex = 0;
    this.currentRound = null;
    this.roundActive = false;
    this.temperature = this.maxTemp;
    this.coolingRate = 0;
    this.chaosPenalty = 0;
    this.roundDots = [];
    this.persistentObjects = [];
    this.hintObjects = [];
    this.feedbackObjects = [];
    this.completionObjects = [];
    this.chaosBanners = [];

    this.rounds = [
      this.createRoundConfig('Round 1 · First Layer', 76, 6, 30, 5600, 0x79c0ff),
      this.createRoundConfig('Round 2 · Second Layer', 75, 5, 28, 5000, 0x56d364),
      this.createRoundConfig('Round 3 · Final Stack', 74, 4, 26, 4500, 0xffc857),
      this.createRoundConfig('Round 4 · Showstopper', 73, 3, 24, 3900, 0xff7b72)
    ];
  }

  createRoundConfig(label, sweetSpotCenter, sweetSpotHalfWidth, revealRange, duration, accent) {
    return {
      label,
      sweetSpotCenter,
      sweetSpotHalfWidth,
      revealRange,
      duration,
      accent,
      startTemp: this.maxTemp,
      endTemp: this.minTemp,
      result: null,
      score: 0
    };
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');

    this.createBackground();
    this.createHeader();
    this.createTemperaturePanel();
    this.createCakePanel();
    this.createControlPanel();
    this.createRoundPanel();

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true
    });

    if (this.boosts.hint > 0 || this.boosts['recipe-hint']) {
      this.showRecipeHint();
    }

    this.applyChaosEvents();
    this.startRound(0);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  trackObject(listName, object) {
    if (object) {
      this[listName].push(object);
    }
    return object;
  }

  clearTrackedObjects(listName) {
    if (!Array.isArray(this[listName])) {
      return;
    }

    this[listName].forEach((object) => {
      if (object && object.destroy) {
        object.destroy();
      }
    });

    this[listName] = [];
  }

  createBackground() {
    const bg = this.trackObject('persistentObjects', this.add.graphics());
    bg.fillGradientStyle(0x0f172a, 0x0f172a, 0x1e1b4b, 0x111827, 1);
    bg.fillRect(0, 0, 1024, 768);

    const deco = this.trackObject('persistentObjects', this.add.graphics());
    deco.lineStyle(2, 0xffffff, 0.05);
    deco.strokeRoundedRect(48, 118, 640, 292, 24);
    deco.strokeRoundedRect(716, 118, 260, 430, 24);
    deco.strokeRoundedRect(48, 438, 640, 270, 24);
    deco.lineBetween(90, 160, 646, 160);
    deco.lineBetween(90, 650, 646, 650);
  }

  createHeader() {
    this.trackObject('persistentObjects', this.add.text(512, 24, '❄️ COOL PHASE', {
      fontFamily: 'Arial',
      fontSize: '36px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0));

    this.timerText = this.trackObject('persistentObjects', this.add.text(950, 30, `Time: ${this.timeRemaining}s`, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(1, 0));

    this.roundText = this.trackObject('persistentObjects', this.add.text(72, 30, '', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#79c0ff',
      fontStyle: 'bold'
    }));

    this.scoreText = this.trackObject('persistentObjects', this.add.text(72, 64, 'Average score: 0', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#cbd5e1'
    }));
  }

  createTemperaturePanel() {
    this.trackObject('persistentObjects', this.add.text(92, 126, 'COOLING INDICATOR', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#79c0ff',
      fontStyle: 'bold'
    }));

    this.trackObject('persistentObjects', this.add.text(92, 170, 'Wait for the green sweet spot flash, then hit REMOVE.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#cbd5e1'
    }));

    this.trackObject('persistentObjects', this.add.text(this.barX, this.barY - 28, '400°F · HOT', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ff7b72',
      fontStyle: 'bold'
    }));

    this.trackObject('persistentObjects', this.add.text(this.barX + this.barWidth, this.barY - 28, '40°F · COLD', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#79c0ff',
      fontStyle: 'bold'
    }).setOrigin(1, 0));

    this.tempBarGraphics = this.trackObject('persistentObjects', this.add.graphics());
    this.sweetSpotGraphics = this.trackObject('persistentObjects', this.add.graphics());
    this.indicatorGraphics = this.trackObject('persistentObjects', this.add.graphics());

    this.temperatureText = this.trackObject('persistentObjects', this.add.text(420, 390, 'Temp: 400°F', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.instructionText = this.trackObject('persistentObjects', this.add.text(420, 430, 'The cake is screaming hot. Stay patient.', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#cbd5e1',
      align: 'center',
      wordWrap: { width: 560 }
    }).setOrigin(0.5));

    this.feedbackText = this.trackObject('persistentObjects', this.add.text(420, 484, '', {
      fontFamily: 'Arial',
      fontSize: '36px',
      color: '#56d364',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.feedbackDetailText = this.trackObject('persistentObjects', this.add.text(420, 526, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#cbd5e1',
      align: 'center'
    }).setOrigin(0.5));
  }

  createCakePanel() {
    this.trackObject('persistentObjects', this.add.text(846, 126, 'CAKE STATUS', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#79c0ff',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0));

    this.cakeGraphics = this.trackObject('persistentObjects', this.add.graphics());
    this.renderCakeState('hot');
  }

  createControlPanel() {
    this.removeButton = this.trackObject('persistentObjects', this.add.rectangle(846, 590, 210, 82, 0xdc2626, 0.95));
    this.removeButton.setStrokeStyle(4, 0xfca5a5, 0.9);
    this.removeButton.setInteractive({ useHandCursor: true });

    this.removeButtonText = this.trackObject('persistentObjects', this.add.text(846, 590, 'REMOVE', {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#fff7ed',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.removeButton.on('pointerover', () => {
      if (!this.roundActive || this.isComplete) {
        return;
      }
      this.removeButton.setScale(1.04);
      this.removeButtonText.setScale(1.04);
    });

    this.removeButton.on('pointerout', () => {
      this.removeButton.setScale(1);
      this.removeButtonText.setScale(1);
    });

    this.removeButton.on('pointerdown', () => this.handleRemoveClick(false));
  }

  createRoundPanel() {
    this.trackObject('persistentObjects', this.add.text(92, 452, 'ROUND PROGRESS', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#79c0ff',
      fontStyle: 'bold'
    }));

    this.roundDots = this.rounds.map((round, index) => {
      return this.trackObject('persistentObjects', this.add.circle(124 + (index * 58), 500, 17, 0x334155, 1)
        .setStrokeStyle(4, round.accent, 0.45));
    });

    this.trackObject('persistentObjects', this.add.text(92, 550, 'Scoring: ±2° = 100, ±5° = 85, ±10° = 60, ±20° = 30, miss = 10', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#cbd5e1',
      wordWrap: { width: 560 }
    }));

    this.trackObject('persistentObjects', this.add.text(92, 600, 'Each round cools faster or tighter. Don’t panic-click.', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#94a3b8',
      wordWrap: { width: 560 }
    }));
  }

  startRound(index) {
    if (this.isComplete) {
      return;
    }

    if (index >= this.rounds.length) {
      this.completeMinigame();
      return;
    }

    this.currentRoundIndex = index;
    this.currentRound = this.rounds[index];
    this.temperature = this.currentRound.startTemp;
    this.coolingRate = (this.currentRound.startTemp - this.currentRound.endTemp) / (this.currentRound.duration / 1000);
    this.roundActive = true;

    this.clearFeedback();
    this.updateRoundDots();
    this.updateScoreText();
    this.updateButtonState(true);
    this.roundText.setText(this.currentRound.label);
    this.instructionText.setText('The sweet spot will flash near perfect temperature. Wait, then commit.');

    this.updateTemperatureVisuals();
    this.renderCakeState('hot');
  }

  updateTimer() {
    this.timeRemaining--;
    this.timerText.setText(`Time: ${this.timeRemaining}s`);

    if (this.timeRemaining <= 10) {
      this.timerText.setColor('#ff7b72');
    } else if (this.timeRemaining <= 20) {
      this.timerText.setColor('#ffa657');
    }

    if (this.timeRemaining <= 0) {
      this.completeMinigame();
    }
  }

  update(time, delta) {
    if (!this.roundActive || !this.currentRound || this.isComplete) {
      return;
    }

    const deltaSeconds = delta / 1000;
    this.temperature = Math.max(this.currentRound.endTemp, this.temperature - (this.coolingRate * deltaSeconds));
    this.updateTemperatureVisuals();

    if (this.temperature <= this.currentRound.endTemp + 0.05) {
      this.handleRemoveClick(true);
    }
  }

  updateTemperatureVisuals() {
    if (!this.currentRound) {
      return;
    }

    this.drawTemperatureBar();
    this.drawSweetSpot();
    this.drawIndicator();

    const roundedTemp = Math.round(this.temperature);
    const cakeState = this.getCakeState(this.temperature);
    this.temperatureText.setText(`Temp: ${roundedTemp}°F`);

    if (cakeState === 'perfect') {
      this.temperatureText.setColor('#56d364');
      this.instructionText.setText('Sweet spot! Click REMOVE before the cake slips past perfect.');
    } else if (cakeState === 'hot') {
      this.temperatureText.setColor('#ff7b72');
      this.instructionText.setText('Still too hot — wait for the green flash near the end.');
    } else {
      this.temperatureText.setColor('#79c0ff');
      this.instructionText.setText('It is dropping fast. If you wait longer, it dries out.');
    }

    this.renderCakeState(cakeState);
  }

  drawTemperatureBar() {
    if (!this.tempBarGraphics) {
      return;
    }

    this.tempBarGraphics.clear();
    this.tempBarGraphics.fillStyle(0x0b1220, 0.95);
    this.tempBarGraphics.fillRoundedRect(this.barX - 8, this.barY - 8, this.barWidth + 16, this.barHeight + 16, 18);

    const segments = 120;
    const colors = [0xff4d4d, 0xff8a3d, 0xffd166, 0x56d364, 0x67e8f9, 0x2563eb];

    for (let i = 0; i < segments; i++) {
      const t = i / Math.max(1, segments - 1);
      const color = this.sampleGradient(colors, t);
      const x = this.barX + ((i / segments) * this.barWidth);
      const width = Math.ceil(this.barWidth / segments) + 1;
      this.tempBarGraphics.fillStyle(color, 0.96);
      this.tempBarGraphics.fillRect(x, this.barY, width, this.barHeight);
    }

    this.tempBarGraphics.lineStyle(3, 0xe2e8f0, 0.35);
    this.tempBarGraphics.strokeRoundedRect(this.barX, this.barY, this.barWidth, this.barHeight, 12);
  }

  drawSweetSpot() {
    if (!this.sweetSpotGraphics || !this.currentRound) {
      return;
    }

    this.sweetSpotGraphics.clear();

    const distanceFromCenter = Math.abs(this.temperature - this.currentRound.sweetSpotCenter);
    const isVisible = distanceFromCenter <= this.currentRound.revealRange || !!this.currentRound.result;

    if (!isVisible) {
      return;
    }

    const hotEdge = this.currentRound.sweetSpotCenter + this.currentRound.sweetSpotHalfWidth;
    const coolEdge = this.currentRound.sweetSpotCenter - this.currentRound.sweetSpotHalfWidth;
    const zoneStart = this.temperatureToX(hotEdge);
    const zoneEnd = this.temperatureToX(coolEdge);
    const zoneWidth = Math.max(6, zoneEnd - zoneStart);

    this.sweetSpotGraphics.fillStyle(0x56d364, 0.32);
    this.sweetSpotGraphics.fillRoundedRect(zoneStart, this.barY - 12, zoneWidth, this.barHeight + 24, 12);
    this.sweetSpotGraphics.lineStyle(4, 0x86efac, 0.95);
    this.sweetSpotGraphics.strokeRoundedRect(zoneStart, this.barY - 12, zoneWidth, this.barHeight + 24, 12);

    for (let i = 0; i < 3; i++) {
      this.sweetSpotGraphics.lineStyle(2, 0xdcfce7, 0.3 - (i * 0.08));
      this.sweetSpotGraphics.strokeRoundedRect(zoneStart - (i * 4), this.barY - 16 - (i * 4), zoneWidth + (i * 8), this.barHeight + 32 + (i * 8), 14);
    }
  }

  drawIndicator() {
    if (!this.indicatorGraphics) {
      return;
    }

    const x = this.temperatureToX(this.temperature);
    const color = this.sampleGradient([0xff4d4d, 0xff8a3d, 0xffd166, 0x56d364, 0x67e8f9, 0x2563eb], this.temperatureToProgress(this.temperature));

    this.indicatorGraphics.clear();
    this.indicatorGraphics.lineStyle(4, 0xffffff, 0.95);
    this.indicatorGraphics.lineBetween(x, this.barY - 20, x, this.barY + this.barHeight + 20);
    this.indicatorGraphics.fillStyle(color, 1);
    this.indicatorGraphics.fillCircle(x, this.barY + (this.barHeight / 2), 10);
    this.indicatorGraphics.lineStyle(3, 0xffffff, 0.45);
    this.indicatorGraphics.strokeCircle(x, this.barY + (this.barHeight / 2), 16);
  }

  handleRemoveClick(autoTriggered) {
    if (!this.roundActive || !this.currentRound || this.isComplete) {
      return;
    }

    const result = this.evaluateTemperature(this.temperature, this.currentRound, autoTriggered);
    this.currentRound.result = result;
    this.currentRound.score = result.score;
    this.roundActive = false;

    this.updateButtonState(false);
    this.updateRoundDots();
    this.updateScoreText();
    this.showRoundFeedback(result);
    this.renderCakeState(result.cakeState);

    if (this.roundTransitionEvent) {
      this.roundTransitionEvent.remove();
      this.roundTransitionEvent = null;
    }

    this.roundTransitionEvent = this.time.delayedCall(950, () => {
      this.roundTransitionEvent = null;
      if (this.currentRoundIndex >= this.rounds.length - 1 || this.timeRemaining <= 0) {
        this.completeMinigame();
      } else {
        this.startRound(this.currentRoundIndex + 1);
      }
    });
  }

  evaluateTemperature(temperature, round, autoTriggered) {
    const distance = Math.abs(temperature - round.sweetSpotCenter);
    let score = 10;

    if (distance <= 2) {
      score = 100;
    } else if (distance <= 5) {
      score = 85;
    } else if (distance <= 10) {
      score = 60;
    } else if (distance <= 20) {
      score = 30;
    }

    const upperEdge = round.sweetSpotCenter + round.sweetSpotHalfWidth;
    const lowerEdge = round.sweetSpotCenter - round.sweetSpotHalfWidth;

    let headline = 'PERFECT!';
    let detail = `+${score} points · ${Math.round(temperature)}°F`;
    let color = '#56d364';
    let cakeState = 'perfect';

    if (temperature > upperEdge) {
      headline = 'TOO HOT!';
      detail = `${Math.round(distance)}° above center · ${Math.round(temperature)}°F`;
      color = '#ff7b72';
      cakeState = 'hot';
    } else if (temperature < lowerEdge) {
      headline = 'TOO COLD!';
      detail = `${Math.round(distance)}° below center · ${Math.round(temperature)}°F`;
      color = '#79c0ff';
      cakeState = 'cold';
    }

    if (autoTriggered && headline !== 'PERFECT!') {
      detail += ' · auto-resolved';
    }

    return {
      round: round.label,
      clickedTemperature: Math.round(temperature),
      sweetSpotCenter: round.sweetSpotCenter,
      sweetSpotRange: [
        round.sweetSpotCenter - round.sweetSpotHalfWidth,
        round.sweetSpotCenter + round.sweetSpotHalfWidth
      ],
      distance: Math.round(distance),
      score,
      headline,
      detail,
      color,
      cakeState,
      autoTriggered
    };
  }

  getCakeState(temperature) {
    if (!this.currentRound) {
      return 'hot';
    }

    const upperEdge = this.currentRound.sweetSpotCenter + this.currentRound.sweetSpotHalfWidth;
    const lowerEdge = this.currentRound.sweetSpotCenter - this.currentRound.sweetSpotHalfWidth;

    if (temperature > upperEdge) {
      return 'hot';
    }

    if (temperature < lowerEdge) {
      return 'cold';
    }

    return 'perfect';
  }

  showRoundFeedback(result) {
    this.clearFeedback();

    this.feedbackText.setText(result.headline);
    this.feedbackText.setColor(result.color);
    this.feedbackDetailText.setText(`${result.detail} · target ${result.sweetSpotCenter}°F`);

    const pulse = this.trackObject('feedbackObjects', this.add.circle(846, 370, 124, Phaser.Display.Color.HexStringToColor(result.color).color, 0.12));
    pulse.setStrokeStyle(4, Phaser.Display.Color.HexStringToColor(result.color).color, 0.4);

    this.tweens.add({
      targets: [this.feedbackText, this.feedbackDetailText],
      scale: { from: 0.88, to: 1 },
      duration: 180,
      ease: 'Back.easeOut'
    });

    this.tweens.add({
      targets: pulse,
      alpha: 0,
      scale: 1.35,
      duration: 700,
      onComplete: () => {
        pulse.destroy();
        this.feedbackObjects = this.feedbackObjects.filter((object) => object !== pulse);
      }
    });
  }

  clearFeedback() {
    this.feedbackText.setText('');
    this.feedbackDetailText.setText('');
    this.clearTrackedObjects('feedbackObjects');
  }

  renderCakeState(state) {
    if (!this.cakeGraphics) {
      return;
    }

    this.cakeGraphics.clear();

    const centerX = 846;
    const plateY = 430;
    let cakeColor = 0xe9b872;
    let frostingColor = 0xfef3c7;
    let accentColor = 0xff7b72;

    if (state === 'perfect') {
      cakeColor = 0xf3d19c;
      frostingColor = 0xfffbeb;
      accentColor = 0x56d364;
    } else if (state === 'cold') {
      cakeColor = 0xc4a484;
      frostingColor = 0xdbeafe;
      accentColor = 0x79c0ff;
    }

    this.cakeGraphics.fillStyle(0x111827, 0.28);
    this.cakeGraphics.fillEllipse(centerX, plateY + 88, 190, 34);

    this.cakeGraphics.fillStyle(0xe2e8f0, 1);
    this.cakeGraphics.fillRoundedRect(centerX - 92, plateY + 36, 184, 18, 8);
    this.cakeGraphics.lineStyle(3, 0x94a3b8, 0.95);
    this.cakeGraphics.strokeRoundedRect(centerX - 92, plateY + 36, 184, 18, 8);

    this.cakeGraphics.fillStyle(cakeColor, 1);
    this.cakeGraphics.fillRoundedRect(centerX - 74, plateY - 6, 148, 62, 18);
    this.cakeGraphics.fillStyle(frostingColor, 1);
    this.cakeGraphics.fillRoundedRect(centerX - 80, plateY - 30, 160, 32, 16);
    this.cakeGraphics.lineStyle(4, accentColor, 0.95);
    this.cakeGraphics.strokeRoundedRect(centerX - 74, plateY - 6, 148, 62, 18);
    this.cakeGraphics.strokeRoundedRect(centerX - 80, plateY - 30, 160, 32, 16);

    if (state === 'hot') {
      this.cakeGraphics.lineStyle(4, 0xffedd5, 0.7);
      this.cakeGraphics.lineBetween(centerX - 40, plateY - 72, centerX - 28, plateY - 104);
      this.cakeGraphics.lineBetween(centerX, plateY - 78, centerX + 12, plateY - 114);
      this.cakeGraphics.lineBetween(centerX + 38, plateY - 72, centerX + 50, plateY - 102);
      this.cakeGraphics.lineStyle(3, 0x7f1d1d, 0.6);
      this.cakeGraphics.lineBetween(centerX - 44, plateY + 8, centerX - 18, plateY + 26);
      this.cakeGraphics.lineBetween(centerX + 16, plateY + 10, centerX + 40, plateY + 30);
    } else if (state === 'perfect') {
      this.cakeGraphics.fillStyle(0x86efac, 0.95);
      this.cakeGraphics.fillCircle(centerX - 62, plateY - 52, 5);
      this.cakeGraphics.fillCircle(centerX + 66, plateY - 44, 5);
      this.cakeGraphics.fillCircle(centerX + 12, plateY - 88, 6);
      this.cakeGraphics.lineStyle(3, 0x86efac, 0.85);
      this.cakeGraphics.strokeCircle(centerX, plateY + 6, 92);
    } else {
      this.cakeGraphics.lineStyle(4, 0x93c5fd, 0.7);
      this.cakeGraphics.lineBetween(centerX - 40, plateY - 6, centerX - 12, plateY + 12);
      this.cakeGraphics.lineBetween(centerX - 6, plateY + 6, centerX + 12, plateY + 26);
      this.cakeGraphics.lineBetween(centerX + 26, plateY - 2, centerX + 52, plateY + 18);
      this.cakeGraphics.lineStyle(3, 0x475569, 0.6);
      this.cakeGraphics.lineBetween(centerX - 44, plateY - 26, centerX - 18, plateY - 8);
      this.cakeGraphics.lineBetween(centerX + 20, plateY - 24, centerX + 48, plateY - 4);
    }
  }

  updateButtonState(enabled) {
    if (!this.removeButton || !this.removeButtonText) {
      return;
    }

    if (enabled) {
      this.removeButton.setFillStyle(0xdc2626, 0.95);
      this.removeButton.setStrokeStyle(4, 0xfca5a5, 0.9);
      this.removeButtonText.setColor('#fff7ed');
      this.removeButtonText.setAlpha(1);
    } else {
      this.removeButton.setFillStyle(0x475569, 0.95);
      this.removeButton.setStrokeStyle(4, 0x94a3b8, 0.7);
      this.removeButtonText.setColor('#e2e8f0');
      this.removeButtonText.setAlpha(0.8);
      this.removeButton.setScale(1);
      this.removeButtonText.setScale(1);
    }
  }

  updateRoundDots() {
    this.roundDots.forEach((dot, index) => {
      const round = this.rounds[index];

      if (round.result) {
        const fillColor = round.result.headline === 'PERFECT!'
          ? 0x56d364
          : (round.result.headline === 'TOO HOT!' ? 0xff7b72 : 0x79c0ff);
        dot.setFillStyle(fillColor, 1);
        dot.setStrokeStyle(4, 0xf8fafc, 0.9);
      } else if (index === this.currentRoundIndex && this.roundActive) {
        dot.setFillStyle(round.accent, 0.4);
        dot.setStrokeStyle(4, round.accent, 1);
      } else {
        dot.setFillStyle(0x334155, 1);
        dot.setStrokeStyle(4, round.accent, 0.45);
      }
    });
  }

  updateScoreText() {
    const scoredRounds = this.rounds.filter((round) => round.result);
    const average = scoredRounds.length
      ? Math.round(scoredRounds.reduce((sum, round) => sum + round.result.score, 0) / scoredRounds.length)
      : 0;

    this.scoreText.setText(`Average score: ${average}`);
  }

  calculateFinalScore() {
    const totalScore = this.rounds.reduce((sum, round) => sum + (round.result ? round.result.score : 10), 0);
    const averageScore = totalScore / this.rounds.length;
    const finalScore = averageScore * (1 - this.chaosPenalty);
    return Math.round(Phaser.Math.Clamp(finalScore, 0, 100));
  }

  applyChaosEvents() {
    const coolEvents = this.chaosEvents.filter((event) => {
      if (!event || !event.phase) {
        return false;
      }

      if (Array.isArray(event.phase)) {
        return event.phase.includes('cool') || event.phase.includes('any');
      }

      return event.phase.includes('cool') || event.phase.includes('any');
    });

    this.chaosPenalty = Phaser.Math.Clamp(coolEvents.reduce((sum, event) => {
      return sum + (event.scorePenalty || 0);
    }, 0), 0, 1);

    if (!coolEvents.length) {
      return;
    }

    this.chaosOverlay = this.trackObject('persistentObjects', this.add.rectangle(512, 384, 1024, 768, 0x220f1e, 0.08));
    this.chaosOverlay.setDepth(1);

    coolEvents.forEach((event, index) => {
      const banner = this.trackObject('chaosBanners', this.add.text(512, 104 + (index * 34), `⚠ ${event.name} (-${Math.round((event.scorePenalty || 0) * 100)}%)`, {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#ff7b72',
        fontStyle: 'bold',
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        padding: { x: 12, y: 4 }
      }).setOrigin(0.5));

      banner.setDepth(4);

      this.tweens.add({
        targets: banner,
        alpha: 0,
        y: banner.y - 10,
        duration: 700,
        delay: 2200 + (index * 250),
        onComplete: () => {
          banner.destroy();
          this.chaosBanners = this.chaosBanners.filter((object) => object !== banner);
        }
      });
    });
  }

  showRecipeHint() {
    const overlay = this.trackObject('hintObjects', this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.78));
    const hintText = this.trackObject('hintObjects', this.add.text(512, 384, [
      '💡 RECIPE HINT 💡',
      '',
      'Wait for the green flash instead of chasing the falling temperature.',
      'A centered click scores best — patience beats panic.',
      'Later rounds shrink the sweet spot, so commit once and trust the timing.'
    ].join('\n'), {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#ffa657',
      align: 'center',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    overlay.setDepth(8);
    hintText.setDepth(8);

    this.time.delayedCall(5000, () => {
      this.tweens.add({
        targets: [overlay, hintText],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.clearTrackedObjects('hintObjects');
        }
      });
    });
  }

  completeMinigame() {
    if (this.isComplete) {
      return;
    }

    if (this.roundActive && this.currentRound && !this.currentRound.result) {
      const result = this.evaluateTemperature(this.temperature, this.currentRound, true);
      this.currentRound.result = result;
      this.currentRound.score = result.score;
      this.roundActive = false;
      this.updateRoundDots();
      this.updateScoreText();
      this.showRoundFeedback(result);
    }

    this.rounds.forEach((round) => {
      if (!round.result) {
        round.result = {
          round: round.label,
          clickedTemperature: null,
          sweetSpotCenter: round.sweetSpotCenter,
          sweetSpotRange: [
            round.sweetSpotCenter - round.sweetSpotHalfWidth,
            round.sweetSpotCenter + round.sweetSpotHalfWidth
          ],
          distance: null,
          score: 10,
          headline: 'MISSED',
          detail: 'Round expired before the cake could be pulled.',
          color: '#94a3b8',
          cakeState: 'cold',
          autoTriggered: true
        };
        round.score = 10;
      }
    });

    this.isComplete = true;

    if (this.timerEvent) {
      this.timerEvent.remove();
      this.timerEvent = null;
    }

    if (this.roundTransitionEvent) {
      this.roundTransitionEvent.remove();
      this.roundTransitionEvent = null;
    }

    this.updateButtonState(false);

    const finalScore = this.calculateFinalScore();
    const roundBreakdown = this.rounds.map((round) => ({
      round: round.label,
      score: round.result ? round.result.score : 10,
      clickedTemperature: round.result ? round.result.clickedTemperature : null,
      sweetSpotCenter: round.sweetSpotCenter,
      sweetSpotRange: [
        round.sweetSpotCenter - round.sweetSpotHalfWidth,
        round.sweetSpotCenter + round.sweetSpotHalfWidth
      ],
      distance: round.result ? round.result.distance : null,
      result: round.result ? round.result.headline : 'MISSED'
    }));

    if (this.socket) {
      this.socket.emit('baking:phase-complete', {
        teamId: this.teamId,
        phase: 'cool',
        score: finalScore,
        details: {
          rounds: roundBreakdown,
          chaosPenalty: this.chaosPenalty,
          timeRemaining: this.timeRemaining
        }
      });
    }

    this.showCompletionScreen(finalScore);
  }

  showCompletionScreen(score) {
    this.clearTrackedObjects('completionObjects');

    const perfectRounds = this.rounds.filter((round) => round.result && round.result.headline === 'PERFECT!').length;
    const averageDistance = this.rounds.reduce((sum, round) => {
      return sum + (round.result && round.result.distance !== null ? round.result.distance : 20);
    }, 0) / this.rounds.length;

    const overlay = this.trackObject('completionObjects', this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.76));
    overlay.setDepth(10);

    const panel = this.trackObject('completionObjects', this.add.rectangle(512, 384, 600, 360, 0x161b22, 0.96));
    panel.setStrokeStyle(3, 0x334155);
    panel.setDepth(10);

    this.trackObject('completionObjects', this.add.text(512, 248, 'COOL COMPLETE!', {
      fontFamily: 'Arial',
      fontSize: '42px',
      color: '#79c0ff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11));

    this.trackObject('completionObjects', this.add.text(512, 306, `Score: ${score}/100`, {
      fontFamily: 'Arial',
      fontSize: '38px',
      color: '#56d364',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11));

    this.trackObject('completionObjects', this.add.text(512, 366, `Perfect pulls: ${perfectRounds}/${this.rounds.length}   •   Avg distance: ${Math.round(averageDistance)}°`, {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#cbd5e1',
      align: 'center'
    }).setOrigin(0.5).setDepth(11));

    this.trackObject('completionObjects', this.add.text(512, 406, `Chaos penalty: -${Math.round(this.chaosPenalty * 100)}%`, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#94a3b8'
    }).setOrigin(0.5).setDepth(11));

    this.trackObject('completionObjects', this.add.text(512, 468, 'Returning to phase select...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#79c0ff',
      fontStyle: 'italic'
    }).setOrigin(0.5).setDepth(11));

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

  temperatureToProgress(temperature) {
    return Phaser.Math.Clamp((this.maxTemp - temperature) / (this.maxTemp - this.minTemp), 0, 1);
  }

  temperatureToX(temperature) {
    return this.barX + (this.temperatureToProgress(temperature) * this.barWidth);
  }

  sampleGradient(colors, t) {
    if (colors.length === 1) {
      return colors[0];
    }

    const scaled = Phaser.Math.Clamp(t, 0, 1) * (colors.length - 1);
    const index = Math.floor(scaled);
    const nextIndex = Math.min(colors.length - 1, index + 1);
    const mix = scaled - index;

    return this.interpolateColor(colors[index], colors[nextIndex], mix);
  }

  interpolateColor(colorA, colorB, mix) {
    const r1 = (colorA >> 16) & 0xff;
    const g1 = (colorA >> 8) & 0xff;
    const b1 = colorA & 0xff;
    const r2 = (colorB >> 16) & 0xff;
    const g2 = (colorB >> 8) & 0xff;
    const b2 = colorB & 0xff;

    const r = Math.round(r1 + ((r2 - r1) * mix));
    const g = Math.round(g1 + ((g2 - g1) * mix));
    const b = Math.round(b1 + ((b2 - b1) * mix));

    return (r << 16) | (g << 8) | b;
  }

  shutdown() {
    if (this.timerEvent) {
      this.timerEvent.remove();
      this.timerEvent = null;
    }

    if (this.roundTransitionEvent) {
      this.roundTransitionEvent.remove();
      this.roundTransitionEvent = null;
    }

    if (this.completionEvent) {
      this.completionEvent.remove();
      this.completionEvent = null;
    }

    this.time.removeAllEvents();
    this.tweens.killAll();

    if (this.removeButton) {
      this.removeButton.removeAllListeners();
    }

    this.clearTrackedObjects('feedbackObjects');
    this.clearTrackedObjects('hintObjects');
    this.clearTrackedObjects('completionObjects');
    this.clearTrackedObjects('chaosBanners');
    this.clearTrackedObjects('persistentObjects');

    this.timerText = null;
    this.roundText = null;
    this.scoreText = null;
    this.temperatureText = null;
    this.instructionText = null;
    this.feedbackText = null;
    this.feedbackDetailText = null;
    this.removeButton = null;
    this.removeButtonText = null;
    this.tempBarGraphics = null;
    this.indicatorGraphics = null;
    this.sweetSpotGraphics = null;
    this.cakeGraphics = null;
    this.roundDots = [];
    this.chaosOverlay = null;
    this.currentRound = null;
    this.roundActive = false;
  }
}

window.CoolScene = CoolScene;
