// Evil Jeopardy 1.2 - Mix Scene (Circular Mixing Minigame)

class MixScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MixScene' });

    this.socket = null;
    this.teamId = null;
    this.inventory = [];
    this.boosts = {};
    this.chaosEvents = [];

    this.timeLimit = 50;
    this.timeRemaining = 50;
    this.timerEvent = null;
    this.roundTransitionEvent = null;
    this.completionEvent = null;
    this.isComplete = false;

    this.centerX = 512;
    this.centerY = 420;
    this.rounds = [];
    this.currentRoundIndex = 0;
    this.currentRound = null;
    this.chaosPenalty = 0;
    this.hasElectricMixer = false;
    this.speedToleranceBonus = 0;
    this.guideDimmed = false;

    this.isTracing = false;
    this.lastAngle = null;
    this.lastSampleTime = null;
    this.currentSpeed = 0;
    this.currentMixQuality = 0;
    this.speedState = 'WAITING';
    this.trailPoints = [];

    this.timerText = null;
    this.roundText = null;
    this.progressText = null;
    this.instructionText = null;
    this.speedText = null;
    this.speedStateText = null;
    this.toolText = null;
    this.guideGraphics = null;
    this.trailGraphics = null;
    this.speedMeterGraphics = null;
    this.batterFill = null;
    this.pointerIndicator = null;
    this.roundDots = [];
    this.chaosOverlay = null;

    this._pointerDownHandler = null;
    this._pointerMoveHandler = null;
    this._pointerUpHandler = null;
  }

  init(data) {
    this.socket = data.socket || this.registry.get('socket') || null;
    this.teamId = data.teamId || 'unknown-team';
    this.inventory = data.inventory || this.registry.get('inventory') || [];
    this.boosts = data.boosts || {};
    this.chaosEvents = data.chaosEvents || [];

    this.timeRemaining = this.timeLimit;
    this.isComplete = false;
    this.currentRoundIndex = 0;
    this.chaosPenalty = 0;
    this.guideDimmed = false;
    this.isTracing = false;
    this.lastAngle = null;
    this.lastSampleTime = null;
    this.currentSpeed = 0;
    this.currentMixQuality = 0;
    this.speedState = 'WAITING';
    this.trailPoints = [];

    this.hasElectricMixer = this.inventory.some((item) => {
      if (typeof item === 'string') {
        return item === 'mixer-electric';
      }

      return item && item.key === 'mixer-electric';
    });

    this.speedToleranceBonus = this.hasElectricMixer ? 0.35 : 0;

    this.rounds = [
      {
        label: 'Round 1 · Wide Sweep',
        radius: 180,
        idealSpeed: 2.2,
        speedTolerance: 0.75,
        accuracyTolerance: 34,
        targetProgress: 100,
        accent: 0x79c0ff,
        progress: 0,
        accuracyTotal: 0,
        speedTotal: 0,
        sampleCount: 0,
        completed: false
      },
      {
        label: 'Round 2 · Tight Blend',
        radius: 140,
        idealSpeed: 2.9,
        speedTolerance: 0.65,
        accuracyTolerance: 28,
        targetProgress: 100,
        accent: 0x56d364,
        progress: 0,
        accuracyTotal: 0,
        speedTotal: 0,
        sampleCount: 0,
        completed: false
      },
      {
        label: 'Round 3 · Final Whip',
        radius: 105,
        idealSpeed: 3.6,
        speedTolerance: 0.55,
        accuracyTolerance: 24,
        targetProgress: 100,
        accent: 0xffa657,
        progress: 0,
        accuracyTotal: 0,
        speedTotal: 0,
        sampleCount: 0,
        completed: false
      }
    ];
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');

    this.createBackground();
    this.createHeader();
    this.createBowlArea();
    this.createRoundPanel();
    this.createSpeedPanel();
    this.createInstructionPanel();

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
    this.startRound(0);
    this.setupInputHandlers();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  createBackground() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x101728, 0x101728, 0x221b3f, 0x1c2545, 1);
    bg.fillRect(0, 0, 1024, 768);

    const deco = this.add.graphics();
    deco.lineStyle(2, 0xffffff, 0.05);
    deco.strokeCircle(this.centerX, this.centerY, 235);
    deco.strokeCircle(this.centerX, this.centerY, 265);
    deco.lineBetween(180, 140, 844, 140);
    deco.lineBetween(180, 690, 844, 690);
  }

  createHeader() {
    this.add.text(512, 28, '🥣 MIX PHASE', {
      fontFamily: 'Arial',
      fontSize: '36px',
      color: '#f0f6fc',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    this.timerText = this.add.text(940, 30, `Time: ${this.timeRemaining}s`, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#f0f6fc',
      fontStyle: 'bold'
    }).setOrigin(1, 0);

    this.roundText = this.add.text(70, 32, '', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#79c0ff',
      fontStyle: 'bold'
    });

    this.progressText = this.add.text(70, 66, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#c9d1d9'
    });
  }

  createBowlArea() {
    const bowlShadow = this.add.ellipse(this.centerX, this.centerY + 110, 360, 80, 0x000000, 0.25);
    bowlShadow.setDepth(0);

    const bowlOuter = this.add.ellipse(this.centerX, this.centerY + 30, 340, 220, 0x2d333b, 1);
    bowlOuter.setStrokeStyle(6, 0x8b949e, 0.9);

    const bowlInner = this.add.ellipse(this.centerX, this.centerY + 10, 270, 150, 0x161b22, 1);
    bowlInner.setStrokeStyle(3, 0x58a6ff, 0.35);

    this.batterFill = this.add.ellipse(this.centerX, this.centerY + 12, 250, 130, 0xe9c46a, 0.95);
    this.batterFill.setStrokeStyle(2, 0xf4d58d, 0.4);

    this.add.text(this.centerX, this.centerY - 110, 'Trace the circle to smooth the batter', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#f0f6fc',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.guideGraphics = this.add.graphics();
    this.trailGraphics = this.add.graphics();
    this.pointerIndicator = this.add.circle(this.centerX, this.centerY, 8, 0xffffff, 0.9).setVisible(false);
  }

  createRoundPanel() {
    const panel = this.add.rectangle(165, 610, 230, 150, 0x0d1117, 0.85);
    panel.setStrokeStyle(2, 0x30363d);

    this.add.text(165, 555, 'ROUND STATUS', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#79c0ff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.roundDots = this.rounds.map((round, index) => {
      return this.add.circle(115 + (index * 50), 610, 16, 0x30363d, 1).setStrokeStyle(3, round.accent, 0.4);
    });

    this.toolText = this.add.text(165, 650, '', {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#c9d1d9',
      align: 'center'
    }).setOrigin(0.5);
  }

  createSpeedPanel() {
    const panel = this.add.rectangle(845, 610, 260, 170, 0x0d1117, 0.85);
    panel.setStrokeStyle(2, 0x30363d);

    this.add.text(845, 542, 'MIX SPEED', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#79c0ff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.speedMeterGraphics = this.add.graphics();

    this.add.text(735, 566, 'slow', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#ff7b72'
    }).setOrigin(0, 1);

    this.add.text(845, 566, 'sweet spot', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#56d364'
    }).setOrigin(0.5, 1);

    this.add.text(955, 566, 'fast', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#ffb86b'
    }).setOrigin(1, 1);

    this.speedText = this.add.text(845, 635, 'Angular speed: 0.00', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#c9d1d9'
    }).setOrigin(0.5);

    this.speedStateText = this.add.text(845, 665, 'WAITING', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#8b949e',
      fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  createInstructionPanel() {
    const panel = this.add.rectangle(512, 730, 700, 44, 0x0d1117, 0.8);
    panel.setStrokeStyle(2, 0x30363d);

    this.instructionText = this.add.text(512, 730, 'Hold click or touch and trace the guide path.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#c9d1d9',
      align: 'center'
    }).setOrigin(0.5);
  }

  setupInputHandlers() {
    this._pointerDownHandler = (pointer) => this.handlePointerDown(pointer);
    this._pointerMoveHandler = (pointer) => this.handlePointerMove(pointer);
    this._pointerUpHandler = () => this.handlePointerUp();

    this.input.on('pointerdown', this._pointerDownHandler);
    this.input.on('pointermove', this._pointerMoveHandler);
    this.input.on('pointerup', this._pointerUpHandler);
    this.input.on('pointerupoutside', this._pointerUpHandler);
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
    this.isTracing = false;
    this.lastAngle = null;
    this.lastSampleTime = null;
    this.currentSpeed = 0;
    this.currentMixQuality = 0;
    this.speedState = 'WAITING';
    this.trailPoints = [];

    this.roundText.setText(this.currentRound.label);
    this.progressText.setText(`Progress: ${Math.round(this.currentRound.progress)}% / ${this.currentRound.targetProgress}%`);
    this.toolText.setText(this.hasElectricMixer ? 'Tool bonus: Electric mixer widens the sweet spot.' : 'Tool: Manual whisk — stay close to the ideal speed.');
    this.instructionText.setText('Hold and trace the guide circle. Too slow = lumpy, too fast = splatter.');

    this.updateRoundDots();
    this.drawGuidePath();
    this.drawTrail();
    this.updateSpeedMeter();
    this.updateBatterVisual(0.5);
  }

  handlePointerDown(pointer) {
    if (this.isComplete || !this.currentRound) {
      return;
    }

    this.isTracing = true;
    this.lastAngle = Phaser.Math.Angle.Between(this.centerX, this.centerY, pointer.x, pointer.y);
    this.lastSampleTime = this.time.now;
    this.pointerIndicator.setPosition(pointer.x, pointer.y).setVisible(true);
  }

  handlePointerMove(pointer) {
    if (!this.currentRound || this.isComplete) {
      return;
    }

    this.pointerIndicator.setPosition(pointer.x, pointer.y).setVisible(pointer.isDown || this.isTracing);

    if (!this.isTracing || !pointer.isDown) {
      return;
    }

    this.evaluateTrace(pointer);
  }

  handlePointerUp() {
    this.isTracing = false;
    this.lastAngle = null;
    this.lastSampleTime = null;
    this.currentSpeed = 0;
    this.speedState = 'PAUSED';
    this.pointerIndicator.setVisible(false);
    this.updateSpeedMeter();
  }

  evaluateTrace(pointer) {
    const now = this.time.now;

    if (this.lastSampleTime === null || this.lastAngle === null) {
      this.lastSampleTime = now;
      this.lastAngle = Phaser.Math.Angle.Between(this.centerX, this.centerY, pointer.x, pointer.y);
      return;
    }

    const deltaMs = now - this.lastSampleTime;
    if (deltaMs < 16) {
      return;
    }

    const dx = pointer.x - this.centerX;
    const dy = pointer.y - this.centerY;
    const radius = Math.sqrt((dx * dx) + (dy * dy));
    const angle = Math.atan2(dy, dx);
    const deltaAngle = Phaser.Math.Angle.Wrap(angle - this.lastAngle);

    if (Math.abs(deltaAngle) > 1.4) {
      this.lastAngle = angle;
      this.lastSampleTime = now;
      return;
    }

    const deltaSeconds = deltaMs / 1000;
    const distanceError = Math.abs(radius - this.currentRound.radius);
    const accuracyQuality = Phaser.Math.Clamp(1 - (distanceError / this.currentRound.accuracyTolerance), 0, 1);
    const angularSpeed = Math.abs(deltaAngle) / Math.max(deltaSeconds, 0.001);
    const speedTolerance = this.currentRound.speedTolerance + this.speedToleranceBonus;
    const speedQuality = Phaser.Math.Clamp(1 - (Math.abs(angularSpeed - this.currentRound.idealSpeed) / speedTolerance), 0, 1);
    const mixQuality = (accuracyQuality + speedQuality) / 2;

    this.currentRound.accuracyTotal += accuracyQuality;
    this.currentRound.speedTotal += speedQuality;
    this.currentRound.sampleCount += 1;
    this.currentRound.progress = Math.min(
      this.currentRound.targetProgress,
      this.currentRound.progress + (mixQuality * deltaSeconds * 20)
    );

    this.currentSpeed = angularSpeed;
    this.currentMixQuality = mixQuality;
    this.speedState = this.getSpeedState(angularSpeed, this.currentRound.idealSpeed, speedTolerance);

    this.trailPoints.push({
      x: pointer.x,
      y: pointer.y,
      quality: mixQuality,
      life: 1
    });

    if (this.trailPoints.length > 42) {
      this.trailPoints.shift();
    }

    this.trailPoints.forEach((point, index) => {
      point.life = (index + 1) / this.trailPoints.length;
    });

    this.progressText.setText(`Progress: ${Math.round(this.currentRound.progress)}% / ${this.currentRound.targetProgress}%`);
    this.instructionText.setText(this.getInstructionForState(this.speedState));

    this.drawTrail();
    this.updateSpeedMeter();
    this.updateBatterVisual(mixQuality);

    this.lastAngle = angle;
    this.lastSampleTime = now;

    if (this.currentRound.progress >= this.currentRound.targetProgress) {
      this.completeRound();
    }
  }

  getSpeedState(speed, idealSpeed, tolerance) {
    const sweetSpot = tolerance * 0.55;

    if (speed < idealSpeed - sweetSpot) {
      return 'TOO SLOW';
    }

    if (speed > idealSpeed + sweetSpot) {
      return 'TOO FAST';
    }

    return 'SMOOTH';
  }

  getInstructionForState(state) {
    if (state === 'TOO SLOW') {
      return 'Lumpy mix! Speed up and stay on the guide ring.';
    }

    if (state === 'TOO FAST') {
      return 'Splatter risk! Slow down and keep your circle controlled.';
    }

    if (state === 'SMOOTH') {
      return 'Smooth batter! Keep tracing at this pace.';
    }

    return 'Hold and trace the guide circle. Too slow = lumpy, too fast = splatter.';
  }

  updateRoundDots() {
    this.roundDots.forEach((dot, index) => {
      const round = this.rounds[index];

      if (round.completed) {
        dot.setFillStyle(round.accent, 1);
        dot.setStrokeStyle(3, 0xffffff, 0.8);
      } else if (index === this.currentRoundIndex) {
        dot.setFillStyle(round.accent, 0.35);
        dot.setStrokeStyle(3, round.accent, 1);
      } else {
        dot.setFillStyle(0x30363d, 1);
        dot.setStrokeStyle(3, round.accent, 0.4);
      }
    });
  }

  drawGuidePath() {
    if (!this.guideGraphics || !this.currentRound) {
      return;
    }

    this.guideGraphics.clear();

    const alpha = this.guideDimmed ? 0.45 : 0.85;
    this.guideGraphics.lineStyle(10, this.currentRound.accent, alpha);
    this.guideGraphics.strokeCircle(this.centerX, this.centerY, this.currentRound.radius);

    this.guideGraphics.lineStyle(2, 0xffffff, 0.1);
    this.guideGraphics.strokeCircle(this.centerX, this.centerY, this.currentRound.radius + this.currentRound.accuracyTolerance);
    this.guideGraphics.strokeCircle(this.centerX, this.centerY, Math.max(20, this.currentRound.radius - this.currentRound.accuracyTolerance));

    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const markerX = this.centerX + Math.cos(angle) * this.currentRound.radius;
      const markerY = this.centerY + Math.sin(angle) * this.currentRound.radius;
      this.guideGraphics.fillStyle(0xffffff, 0.2);
      this.guideGraphics.fillCircle(markerX, markerY, 5);
    }
  }

  drawTrail() {
    if (!this.trailGraphics) {
      return;
    }

    this.trailGraphics.clear();

    if (this.trailPoints.length < 2) {
      return;
    }

    for (let i = 1; i < this.trailPoints.length; i++) {
      const previous = this.trailPoints[i - 1];
      const current = this.trailPoints[i];
      const color = current.quality >= 0.7 ? 0x56d364 : current.quality >= 0.4 ? 0xffc857 : 0xff7b72;
      const alpha = current.life * 0.8;

      this.trailGraphics.lineStyle(5, color, alpha);
      this.trailGraphics.lineBetween(previous.x, previous.y, current.x, current.y);
    }
  }

  updateSpeedMeter() {
    if (!this.speedMeterGraphics || !this.currentRound) {
      return;
    }

    const meterX = 735;
    const meterY = 580;
    const meterWidth = 220;
    const meterHeight = 22;
    const maxSpeed = 5.5;
    const speedTolerance = this.currentRound.speedTolerance + this.speedToleranceBonus;
    const safeMin = Math.max(0, this.currentRound.idealSpeed - speedTolerance);
    const safeMax = Math.min(maxSpeed, this.currentRound.idealSpeed + speedTolerance);
    const goodStart = meterX + ((safeMin / maxSpeed) * meterWidth);
    const goodEnd = meterX + ((safeMax / maxSpeed) * meterWidth);
    const markerX = meterX + ((Phaser.Math.Clamp(this.currentSpeed, 0, maxSpeed) / maxSpeed) * meterWidth);

    this.speedMeterGraphics.clear();
    this.speedMeterGraphics.fillStyle(0x161b22, 1);
    this.speedMeterGraphics.fillRoundedRect(meterX, meterY, meterWidth, meterHeight, 8);

    this.speedMeterGraphics.fillStyle(0xff7b72, 0.85);
    this.speedMeterGraphics.fillRoundedRect(meterX, meterY, Math.max(0, goodStart - meterX), meterHeight, 8);

    this.speedMeterGraphics.fillStyle(0x56d364, 0.9);
    this.speedMeterGraphics.fillRect(goodStart, meterY, Math.max(0, goodEnd - goodStart), meterHeight);

    this.speedMeterGraphics.fillStyle(0xffa657, 0.9);
    this.speedMeterGraphics.fillRoundedRect(goodEnd, meterY, Math.max(0, (meterX + meterWidth) - goodEnd), meterHeight, 8);

    this.speedMeterGraphics.lineStyle(3, 0xffffff, 0.95);
    this.speedMeterGraphics.lineBetween(markerX, meterY - 6, markerX, meterY + meterHeight + 6);

    this.speedText.setText(`Angular speed: ${this.currentSpeed.toFixed(2)} rad/s`);
    this.speedStateText.setText(this.speedState);

    if (this.speedState === 'SMOOTH') {
      this.speedStateText.setColor('#56d364');
    } else if (this.speedState === 'TOO SLOW') {
      this.speedStateText.setColor('#ff7b72');
    } else if (this.speedState === 'TOO FAST') {
      this.speedStateText.setColor('#ffa657');
    } else {
      this.speedStateText.setColor('#8b949e');
    }
  }

  updateBatterVisual(quality) {
    if (!this.batterFill) {
      return;
    }

    let fillColor = 0xd18f67;
    let strokeColor = 0xff7b72;
    let alpha = 0.85;

    if (quality >= 0.7) {
      fillColor = 0xf4d58d;
      strokeColor = 0x56d364;
      alpha = 0.98;
    } else if (quality >= 0.4) {
      fillColor = 0xe9c46a;
      strokeColor = 0xffc857;
      alpha = 0.92;
    }

    this.batterFill.setFillStyle(fillColor, alpha);
    this.batterFill.setStrokeStyle(3, strokeColor, 0.45);
    this.batterFill.setScale(1 + (quality * 0.03), 1 - (quality * 0.015));
  }

  completeRound() {
    if (!this.currentRound || this.currentRound.completed || this.isComplete) {
      return;
    }

    this.currentRound.completed = true;
    this.isTracing = false;
    this.lastAngle = null;
    this.lastSampleTime = null;
    this.currentSpeed = 0;
    this.speedState = 'ROUND CLEAR';
    this.updateRoundDots();
    this.updateSpeedMeter();

    const flash = this.add.text(512, 160, `${this.currentRound.label} COMPLETE!`, {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#f0f6fc',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      y: 130,
      duration: 700,
      onComplete: () => flash.destroy()
    });

    this.roundTransitionEvent = this.time.delayedCall(900, () => {
      if (this.currentRoundIndex >= this.rounds.length - 1) {
        this.completeMinigame();
      } else {
        this.startRound(this.currentRoundIndex + 1);
      }
    });
  }

  updateTimer() {
    if (this.isComplete) {
      return;
    }

    this.timeRemaining -= 1;
    this.timerText.setText(`Time: ${this.timeRemaining}s`);

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
    const mixEvents = this.chaosEvents.filter((event) => {
      if (!event || !event.phase) {
        return false;
      }

      if (Array.isArray(event.phase)) {
        return event.phase.includes('mix') || event.phase.includes('any');
      }

      return event.phase === 'mix' || event.phase === 'any';
    });

    this.chaosPenalty = Phaser.Math.Clamp(mixEvents.reduce((sum, event) => {
      return sum + (event.scorePenalty || 0);
    }, 0), 0, 1);

    if (!mixEvents.length) {
      return;
    }

    if (mixEvents.some((event) => event.key === 'power-out')) {
      this.guideDimmed = true;
      this.chaosOverlay = this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.16);
      this.chaosOverlay.setDepth(1);
    }

    mixEvents.forEach((event, index) => {
      const banner = this.add.text(512, 112 + (index * 32), `⚠ ${event.name} (-${Math.round((event.scorePenalty || 0) * 100)}%)`, {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#ff7b72',
        fontStyle: 'bold',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 10, y: 4 }
      }).setOrigin(0.5);

      banner.setDepth(3);

      this.tweens.add({
        targets: banner,
        alpha: 0,
        y: banner.y - 12,
        duration: 700,
        delay: 2200 + (index * 250),
        onComplete: () => banner.destroy()
      });
    });
  }

  showRecipeHint() {
    const overlay = this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.78);
    const hintText = this.add.text(512, 384, [
      '💡 RECIPE HINT 💡',
      '',
      'Trace the guide ring instead of cutting across the bowl.',
      'Aim for the green speed zone to keep the batter smooth.',
      this.hasElectricMixer ? 'Electric mixer bonus active: your sweet spot is wider.' : 'Manual whisk: precise pacing matters more.'
    ].join('\n'), {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#ffa657',
      align: 'center',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    overlay.setDepth(5);
    hintText.setDepth(5);

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

  completeMinigame() {
    if (this.isComplete) {
      return;
    }

    this.isComplete = true;

    if (this.timerEvent) {
      this.timerEvent.remove();
      this.timerEvent = null;
    }

    if (this.roundTransitionEvent) {
      this.roundTransitionEvent.remove();
      this.roundTransitionEvent = null;
    }

    this.isTracing = false;
    this.pointerIndicator.setVisible(false);
    this.currentSpeed = 0;
    this.speedState = 'COMPLETE';
    this.updateSpeedMeter();

    const finalScore = this.calculateFinalScore();
    const roundBreakdown = this.rounds.map((round) => {
      const accuracyAverage = round.sampleCount > 0 ? round.accuracyTotal / round.sampleCount : 0;
      const speedAverage = round.sampleCount > 0 ? round.speedTotal / round.sampleCount : 0;

      return {
        round: round.label,
        accuracy: Math.round(accuracyAverage * 100),
        speed: Math.round(speedAverage * 100),
        progress: Math.round(round.progress),
        completed: round.completed
      };
    });

    if (this.socket) {
      this.socket.emit('baking:phase-complete', {
        teamId: this.teamId,
        phase: 'mix',
        score: finalScore,
        details: {
          rounds: roundBreakdown,
          chaosPenalty: this.chaosPenalty,
          usedElectricMixer: this.hasElectricMixer,
          timeRemaining: this.timeRemaining
        }
      });
    }

    this.showCompletionScreen(finalScore);
  }

  calculateFinalScore() {
    const scoreTotals = this.rounds.reduce((totals, round) => {
      const completionWeight = Phaser.Math.Clamp(round.progress / round.targetProgress, 0, 1);
      const accuracyAverage = round.sampleCount > 0 ? round.accuracyTotal / round.sampleCount : 0;
      const speedAverage = round.sampleCount > 0 ? round.speedTotal / round.sampleCount : 0;

      totals.accuracy += accuracyAverage * completionWeight;
      totals.speed += speedAverage * completionWeight;
      return totals;
    }, { accuracy: 0, speed: 0 });

    const accuracyScore = (scoreTotals.accuracy / this.rounds.length) * 50;
    const speedScore = (scoreTotals.speed / this.rounds.length) * 50;

    let finalScore = accuracyScore + speedScore;
    finalScore *= (1 - this.chaosPenalty);

    return Math.round(Phaser.Math.Clamp(finalScore, 0, 100));
  }

  showCompletionScreen(score) {
    const accuracyPercent = Math.round((this.rounds.reduce((sum, round) => {
      return sum + (round.sampleCount > 0 ? (round.accuracyTotal / round.sampleCount) : 0);
    }, 0) / this.rounds.length) * 100);

    const speedPercent = Math.round((this.rounds.reduce((sum, round) => {
      return sum + (round.sampleCount > 0 ? (round.speedTotal / round.sampleCount) : 0);
    }, 0) / this.rounds.length) * 100);

    // Track completion screen objects for cleanup
    this.completionObjects = [];

    const overlay = this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.76);
    overlay.setDepth(10);
    this.completionObjects.push(overlay);

    const panel = this.add.rectangle(512, 384, 580, 360, 0x161b22, 0.96);
    panel.setStrokeStyle(3, 0x30363d);
    panel.setDepth(10);
    this.completionObjects.push(panel);

    this.completionObjects.push(this.add.text(512, 248, 'MIX COMPLETE!', {
      fontFamily: 'Arial',
      fontSize: '42px',
      color: '#ffa657',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11));

    this.completionObjects.push(this.add.text(512, 308, `Score: ${score}/100`, {
      fontFamily: 'Arial',
      fontSize: '38px',
      color: '#56d364',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(11));

    this.completionObjects.push(this.add.text(512, 370, `Path accuracy: ${accuracyPercent}%   •   Speed consistency: ${speedPercent}%`, {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#c9d1d9',
      align: 'center'
    }).setOrigin(0.5).setDepth(11));

    this.completionObjects.push(this.add.text(512, 410, `Chaos penalty: -${Math.round(this.chaosPenalty * 100)}%   •   Tool: ${this.hasElectricMixer ? 'Electric Mixer' : 'Manual Whisk'}`, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#8b949e',
      align: 'center'
    }).setOrigin(0.5).setDepth(11));

    this.completionObjects.push(this.add.text(512, 468, 'Returning to phase select...', {
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

    if (this._pointerDownHandler) {
      this.input.off('pointerdown', this._pointerDownHandler);
    }
    if (this._pointerMoveHandler) {
      this.input.off('pointermove', this._pointerMoveHandler);
    }
    if (this._pointerUpHandler) {
      this.input.off('pointerup', this._pointerUpHandler);
      this.input.off('pointerupoutside', this._pointerUpHandler);
    }

    // Destroy graphics objects
    const graphicsRefs = ['guideGraphics', 'trailGraphics', 'speedMeterGraphics', 'pointerIndicator', 'chaosOverlay', 'batterFill'];
    for (const ref of graphicsRefs) {
      if (this[ref]) {
        this[ref].destroy();
        this[ref] = null;
      }
    }

    // Destroy text objects
    const textRefs = ['timerText', 'roundText', 'progressText', 'instructionText', 'speedText', 'speedStateText', 'toolText'];
    for (const ref of textRefs) {
      if (this[ref]) {
        this[ref].destroy();
        this[ref] = null;
      }
    }

    // Destroy round dots
    if (this.roundDots) {
      this.roundDots.forEach(dot => { if (dot) dot.destroy(); });
      this.roundDots = [];
    }

    // Destroy completion screen objects
    if (this.completionObjects) {
      this.completionObjects.forEach(obj => { if (obj) obj.destroy(); });
      this.completionObjects = [];
    }

    this.currentRound = null;
    this.isTracing = false;
    this.lastAngle = null;
    this.lastSampleTime = null;
    this.trailPoints = [];
  }
}

window.MixScene = MixScene;
