class RacingOvenScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RacingOvenScene' });

    this.socket = null;
    this.teamId = null;
    this.inventory = [];
    this.boosts = {};
    this.chaosEvents = [];

    this.timeRemaining = 45;
    this.timerEvent = null;
    this.completionEvent = null;
    this.isComplete = false;

    this.sceneObjects = [];
    this.effectObjects = [];
    this.hintObjects = [];
    this.completionObjects = [];
    this.chaosBanners = [];

    this.track = {
      centerX: 388,
      centerY: 384,
      outerRadiusX: 320,
      outerRadiusY: 252,
      innerRadiusX: 188,
      innerRadiusY: 118,
      laneRadiusX: 254,
      laneRadiusY: 185
    };

    this.player = null;
    this.puddles = null;
    this.fires = null;
    this.cursors = null;

    this.playerHeading = 0;
    this.playerSpeed = 0;
    this.maxForwardSpeed = 360;
    this.maxReverseSpeed = -120;
    this.acceleration = 220;
    this.brakePower = 280;
    this.coastDrag = 120;
    this.turnSpeed = 2.2;
    this.offRoadDrag = 280;
    this.steeringPenalty = 1;

    this.speedColdThreshold = 0.5;
    this.speedHotThreshold = 0.7;
    this.minTemperature = 240;
    this.maxTemperature = 460;
    this.currentTemperature = this.minTemperature;

    this.totalFrames = 0;
    this.optimalFrames = 0;
    this.lapsCompleted = 0;
    this.lapProgress = 0;
    this.previousProgress = null;

    this.fireBoostUntil = 0;
    this.coolSpotUntil = 0;
    this.offRoadWarningUntil = 0;
    this.lastStatusMessage = 'Find the sweet spot!';
    this.bakeChaosEvents = [];

    this.timerText = null;
    this.lapText = null;
    this.scoreText = null;
    this.statusText = null;
    this.progressText = null;
    this.gaugeGraphics = null;
    this.progressGraphics = null;
    this.speedValueText = null;
    this.temperatureValueText = null;
  }

  init(data) {
    this.socket = data.socket || this.registry.get('socket') || null;
    this.teamId = data.teamId || 'unknown-team';
    this.inventory = data.inventory || this.registry.get('inventory') || [];
    this.boosts = data.boosts || {};
    this.chaosEvents = data.chaosEvents || [];

    this.timeRemaining = 45;
    this.timerEvent = null;
    this.completionEvent = null;
    this.isComplete = false;

    this.sceneObjects = [];
    this.effectObjects = [];
    this.hintObjects = [];
    this.completionObjects = [];
    this.chaosBanners = [];

    this.player = null;
    this.puddles = null;
    this.fires = null;
    this.cursors = null;

    this.playerHeading = 0;
    this.playerSpeed = 0;
    this.maxForwardSpeed = 360;
    this.maxReverseSpeed = -120;
    this.acceleration = 220;
    this.brakePower = 280;
    this.coastDrag = 120;
    this.turnSpeed = 2.2;
    this.offRoadDrag = 280;
    this.steeringPenalty = 1;

    this.speedColdThreshold = 0.5;
    this.speedHotThreshold = 0.7;
    this.currentTemperature = this.minTemperature;

    this.totalFrames = 0;
    this.optimalFrames = 0;
    this.lapsCompleted = 0;
    this.lapProgress = 0;
    this.previousProgress = null;

    this.fireBoostUntil = 0;
    this.coolSpotUntil = 0;
    this.offRoadWarningUntil = 0;
    this.lastStatusMessage = 'Find the sweet spot!';
    this.bakeChaosEvents = [];
    this.speedValueText = null;
    this.temperatureValueText = null;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0c1321');
    this.physics.world.setBounds(0, 0, 1024, 768);

    this.createTextures();
    this.createTrack();
    this.createHud();
    this.createPlayer();
    this.createObstacles();

    this.cursors = this.input.keyboard.createCursorKeys();

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true
    });

    this.applyChaosEvents();

    if (this.boosts['recipe-hint'] || this.boosts.hint > 0) {
      this.showRecipeHint();
    }

    this.refreshHud();
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
      if (object && object.scene) {
        object.destroy();
      }
    });

    this[listName] = [];
  }

  createTextures() {
    if (!this.textures.exists('racingoven-car')) {
      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      graphics.fillStyle(0xef4444, 1);
      graphics.fillRoundedRect(14, 6, 36, 60, 12);
      graphics.fillStyle(0xf59e0b, 1);
      graphics.fillRoundedRect(20, 16, 24, 14, 6);
      graphics.fillStyle(0xfef3c7, 1);
      graphics.fillTriangle(32, 2, 18, 20, 46, 20);
      graphics.fillStyle(0x111827, 1);
      graphics.fillRect(18, 14, 10, 18);
      graphics.fillRect(36, 14, 10, 18);
      graphics.fillRect(18, 40, 10, 18);
      graphics.fillRect(36, 40, 10, 18);
      graphics.lineStyle(4, 0x7f1d1d, 1);
      graphics.strokeRoundedRect(14, 6, 36, 60, 12);
      graphics.generateTexture('racingoven-car', 64, 72);
      graphics.destroy();
    }

    if (!this.textures.exists('racingoven-puddle')) {
      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      graphics.fillStyle(0x38bdf8, 0.9);
      graphics.fillEllipse(36, 28, 58, 36);
      graphics.fillEllipse(20, 36, 24, 18);
      graphics.fillEllipse(50, 42, 28, 18);
      graphics.lineStyle(3, 0x0f4c81, 0.9);
      graphics.strokeEllipse(36, 28, 58, 36);
      graphics.generateTexture('racingoven-puddle', 72, 64);
      graphics.destroy();
    }

    if (!this.textures.exists('racingoven-fire')) {
      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      graphics.fillStyle(0xf97316, 1);
      graphics.fillTriangle(32, 2, 12, 44, 52, 44);
      graphics.fillStyle(0xfb7185, 0.95);
      graphics.fillTriangle(32, 12, 18, 46, 46, 46);
      graphics.fillStyle(0xfde047, 0.95);
      graphics.fillTriangle(32, 18, 24, 48, 40, 48);
      graphics.lineStyle(3, 0x9a3412, 1);
      graphics.strokeTriangle(32, 2, 12, 44, 52, 44);
      graphics.generateTexture('racingoven-fire', 64, 56);
      graphics.destroy();
    }
  }

  createTrack() {
    const background = this.trackObject('sceneObjects', this.add.graphics());
    background.fillGradientStyle(0x0a1020, 0x0a1020, 0x17233d, 0x111827, 1);
    background.fillRect(0, 0, 1024, 768);

    const panel = this.trackObject('sceneObjects', this.add.rectangle(868, 384, 276, 676, 0x111827, 0.95));
    panel.setStrokeStyle(4, 0x334155);

    const trackGraphics = this.trackObject('sceneObjects', this.add.graphics());
    trackGraphics.fillStyle(0x14532d, 1);
    trackGraphics.fillRect(0, 0, 760, 768);
    trackGraphics.fillStyle(0x374151, 1);
    trackGraphics.fillEllipse(this.track.centerX, this.track.centerY, this.track.outerRadiusX * 2, this.track.outerRadiusY * 2);
    trackGraphics.fillStyle(0x0f766e, 1);
    trackGraphics.fillEllipse(this.track.centerX, this.track.centerY, this.track.innerRadiusX * 2, this.track.innerRadiusY * 2);

    trackGraphics.lineStyle(10, 0xe5e7eb, 0.9);
    trackGraphics.strokeEllipse(this.track.centerX, this.track.centerY, this.track.outerRadiusX * 2, this.track.outerRadiusY * 2);
    trackGraphics.lineStyle(6, 0xcbd5e1, 0.75);
    trackGraphics.strokeEllipse(this.track.centerX, this.track.centerY, this.track.innerRadiusX * 2, this.track.innerRadiusY * 2);

    for (let angle = 0; angle < Math.PI * 2; angle += 0.22) {
      const x = this.track.centerX + Math.cos(angle) * this.track.laneRadiusX;
      const y = this.track.centerY + Math.sin(angle) * this.track.laneRadiusY;
      const tangentAngle = angle + Math.PI / 2;
      trackGraphics.lineStyle(4, 0xf8fafc, 0.45);
      trackGraphics.beginPath();
      trackGraphics.moveTo(x - (Math.cos(tangentAngle) * 10), y - (Math.sin(tangentAngle) * 10));
      trackGraphics.lineTo(x + (Math.cos(tangentAngle) * 10), y + (Math.sin(tangentAngle) * 10));
      trackGraphics.strokePath();
    }

    const startLineX = this.track.centerX;
    const startLineTop = this.track.centerY - this.track.outerRadiusY;
    const startLineBottom = this.track.centerY - this.track.innerRadiusY + 8;
    for (let i = 0; i < 6; i += 1) {
      const color = i % 2 === 0 ? 0xffffff : 0x1f2937;
      this.trackObject('sceneObjects', this.add.rectangle(startLineX - 36 + (i * 14), startLineTop + ((startLineBottom - startLineTop) / 2), 14, startLineBottom - startLineTop, color, 1));
    }

    const island = this.trackObject('sceneObjects', this.add.graphics());
    island.fillStyle(0x7c2d12, 1);
    island.fillRoundedRect(this.track.centerX - 86, this.track.centerY - 54, 172, 108, 30);
    island.fillStyle(0xfbbf24, 1);
    island.fillCircle(this.track.centerX, this.track.centerY - 4, 34);
    island.fillStyle(0xffffff, 0.92);
    island.fillCircle(this.track.centerX - 12, this.track.centerY - 14, 10);
    island.fillCircle(this.track.centerX + 12, this.track.centerY - 10, 8);
    island.fillStyle(0x92400e, 1);
    island.fillRect(this.track.centerX - 48, this.track.centerY + 28, 96, 10);

    this.trackObject('sceneObjects', this.add.text(868, 78, 'RACING OVEN', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.trackObject('sceneObjects', this.add.text(868, 116, 'Drive fast enough to bake the cake\nwithout scorching it.', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#cbd5e1',
      align: 'center'
    }).setOrigin(0.5));
  }

  createHud() {
    this.timerText = this.trackObject('sceneObjects', this.add.text(780, 156, 'Time: 45s', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }));

    this.lapText = this.trackObject('sceneObjects', this.add.text(780, 192, 'Laps: 0', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#93c5fd'
    }));

    this.progressText = this.trackObject('sceneObjects', this.add.text(780, 226, 'Bake Progress: 0%', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#fde68a'
    }));

    this.scoreText = this.trackObject('sceneObjects', this.add.text(780, 260, 'Optimal Zone Score: 0', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#86efac'
    }));

    this.statusText = this.trackObject('sceneObjects', this.add.text(780, 306, 'Status: Find the sweet spot!', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#f8fafc',
      wordWrap: { width: 176 }
    }));

    this.trackObject('sceneObjects', this.add.text(868, 356, 'Speedometer', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.trackObject('sceneObjects', this.add.text(868, 572, 'Oven Temp', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.gaugeGraphics = this.trackObject('effectObjects', this.add.graphics());
    this.progressGraphics = this.trackObject('effectObjects', this.add.graphics());
  }

  createPlayer() {
    const startPoint = this.getTrackPoint(-Math.PI / 2);
    this.playerHeading = 0;
    this.playerSpeed = 96;

    this.player = this.physics.add.image(startPoint.x, startPoint.y, 'racingoven-car');
    this.player.setDepth(8);
    this.player.setCollideWorldBounds(true);
    this.player.setDrag(0, 0);
    this.player.setMaxVelocity(this.maxForwardSpeed + 80, this.maxForwardSpeed + 80);
    this.player.body.setSize(34, 56);
    this.player.setRotation(this.playerHeading + Math.PI / 2);
  }

  createObstacles() {
    this.puddles = this.physics.add.staticGroup();
    this.fires = this.physics.add.staticGroup();

    const puddleAngles = [-0.18, 1.08, 2.26, 3.58, 4.72];
    const fireAngles = [0.72, 1.88, 3.02, 4.22, 5.3];

    puddleAngles.forEach((angle, index) => {
      const point = this.getTrackPoint(angle, index % 2 === 0 ? -10 : 10);
      const puddle = this.puddles.create(point.x, point.y, 'racingoven-puddle');
      puddle.setDepth(4);
      puddle.refreshBody();
      puddle.cooldownUntil = 0;
    });

    fireAngles.forEach((angle, index) => {
      const point = this.getTrackPoint(angle, index % 2 === 0 ? 12 : -12);
      const fire = this.fires.create(point.x, point.y, 'racingoven-fire');
      fire.setDepth(4);
      fire.refreshBody();
      fire.cooldownUntil = 0;
    });

    this.physics.add.overlap(this.player, this.puddles, this.handlePuddleHit, null, this);
    this.physics.add.overlap(this.player, this.fires, this.handleFireHit, null, this);
  }

  getTrackPoint(angle, laneOffset = 0) {
    const radiusX = this.track.laneRadiusX + laneOffset;
    const radiusY = this.track.laneRadiusY + laneOffset;

    return {
      x: this.track.centerX + (Math.cos(angle) * radiusX),
      y: this.track.centerY + (Math.sin(angle) * radiusY)
    };
  }

  getTrackAngleForPosition(x, y) {
    return Math.atan2((y - this.track.centerY) / this.track.laneRadiusY, (x - this.track.centerX) / this.track.laneRadiusX);
  }

  getNormalizedProgress(angle) {
    return Phaser.Math.Wrap(angle + Math.PI, 0, Math.PI * 2) / (Math.PI * 2);
  }

  isOnTrack(x, y) {
    const dx = x - this.track.centerX;
    const dy = y - this.track.centerY;
    const outerMetric = ((dx * dx) / (this.track.outerRadiusX * this.track.outerRadiusX)) + ((dy * dy) / (this.track.outerRadiusY * this.track.outerRadiusY));
    const innerMetric = ((dx * dx) / (this.track.innerRadiusX * this.track.innerRadiusX)) + ((dy * dy) / (this.track.innerRadiusY * this.track.innerRadiusY));

    return outerMetric <= 1 && innerMetric >= 1;
  }

  getProjectedTrackPoint(x, y) {
    const angle = this.getTrackAngleForPosition(x, y);
    return this.getTrackPoint(angle);
  }

  getSpeedRatio() {
    return Phaser.Math.Clamp(Math.abs(this.playerSpeed) / this.maxForwardSpeed, 0, 1);
  }

  isInOptimalZone() {
    const speedRatio = this.getSpeedRatio();
    return speedRatio >= this.speedColdThreshold && speedRatio <= this.speedHotThreshold;
  }

  calculateScore() {
    if (this.totalFrames <= 0) {
      return 0;
    }

    return Math.round((this.optimalFrames / this.totalFrames) * 100);
  }

  update(time, delta) {
    if (this.isComplete || !this.player) {
      return;
    }

    this.updateDriving(time, delta);
    this.updateLapTracking();
    this.updateScoring();
    this.refreshHud();
  }

  updateDriving(time, delta) {
    const dt = delta / 1000;
    const upDown = this.cursors.up.isDown;
    const downDown = this.cursors.down.isDown;
    const leftDown = this.cursors.left.isDown;
    const rightDown = this.cursors.right.isDown;

    if (upDown) {
      this.playerSpeed += this.acceleration * dt;
    }

    if (downDown) {
      this.playerSpeed -= this.brakePower * dt;
    }

    if (!upDown && !downDown) {
      if (this.playerSpeed > 0) {
        this.playerSpeed = Math.max(0, this.playerSpeed - (this.coastDrag * dt));
      } else if (this.playerSpeed < 0) {
        this.playerSpeed = Math.min(0, this.playerSpeed + (this.coastDrag * dt));
      }
    }

    const steeringStrength = this.turnSpeed * this.steeringPenalty * dt * Phaser.Math.Linear(0.35, 1, this.getSpeedRatio());
    const steeringDirection = this.playerSpeed >= 0 ? 1 : -1;

    if (leftDown && Math.abs(this.playerSpeed) > 8) {
      this.playerHeading -= steeringStrength * steeringDirection;
    }

    if (rightDown && Math.abs(this.playerSpeed) > 8) {
      this.playerHeading += steeringStrength * steeringDirection;
    }

    if (time < this.fireBoostUntil) {
      this.playerSpeed += 40 * dt;
    }

    const onTrack = this.isOnTrack(this.player.x, this.player.y);
    if (!onTrack) {
      const dragAmount = this.offRoadDrag * dt;
      if (this.playerSpeed > 0) {
        this.playerSpeed = Math.max(0, this.playerSpeed - dragAmount);
      } else if (this.playerSpeed < 0) {
        this.playerSpeed = Math.min(0, this.playerSpeed + dragAmount);
      }
      this.offRoadWarningUntil = time + 250;
    }

    this.playerSpeed = Phaser.Math.Clamp(this.playerSpeed, this.maxReverseSpeed, this.maxForwardSpeed + 70);

    this.player.setVelocity(
      Math.cos(this.playerHeading) * this.playerSpeed,
      Math.sin(this.playerHeading) * this.playerSpeed
    );
    this.player.setRotation(this.playerHeading + Math.PI / 2);

    if (!onTrack) {
      const projected = this.getProjectedTrackPoint(this.player.x, this.player.y);
      this.player.setPosition(
        Phaser.Math.Linear(this.player.x, projected.x, 0.025 + (dt * 0.8)),
        Phaser.Math.Linear(this.player.y, projected.y, 0.025 + (dt * 0.8))
      );
    }

    this.currentTemperature = Math.round(Phaser.Math.Linear(this.minTemperature, this.maxTemperature, this.getSpeedRatio()));
  }

  updateLapTracking() {
    const angle = this.getTrackAngleForPosition(this.player.x, this.player.y);
    const progress = this.getNormalizedProgress(angle);

    if (this.previousProgress === null) {
      this.previousProgress = progress;
      return;
    }

    let delta = progress - this.previousProgress;
    if (delta > 0.5) {
      delta -= 1;
    } else if (delta < -0.5) {
      delta += 1;
    }

    if (this.isOnTrack(this.player.x, this.player.y) && Math.abs(this.playerSpeed) > 90 && Math.abs(delta) < 0.2) {
      this.lapProgress += delta;

      if (this.lapProgress >= 1) {
        this.lapsCompleted += 1;
        this.lapProgress -= 1;
        this.showFloatingText(this.player.x, this.player.y - 46, `Lap ${this.lapsCompleted}!`, '#fde68a');
      } else if (this.lapProgress <= -1) {
        this.lapsCompleted += 1;
        this.lapProgress += 1;
        this.showFloatingText(this.player.x, this.player.y - 46, `Lap ${this.lapsCompleted}!`, '#fde68a');
      }
    }

    this.previousProgress = progress;
  }

  updateScoring() {
    this.totalFrames += 1;
    if (this.isInOptimalZone()) {
      this.optimalFrames += 1;
    }
  }

  updateTimer() {
    this.timeRemaining -= 1;

    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.completeMinigame();
    }
  }

  handlePuddleHit(player, puddle) {
    const now = this.time.now;
    if (!puddle || now < (puddle.cooldownUntil || 0)) {
      return;
    }

    puddle.cooldownUntil = now + 1250;
    this.playerSpeed *= 0.58;
    this.coolSpotUntil = now + 1200;
    this.showFloatingText(puddle.x, puddle.y - 28, 'COLD SPOT!', '#38bdf8');

    this.tweens.add({
      targets: puddle,
      alpha: 0.4,
      yoyo: true,
      duration: 200
    });
  }

  handleFireHit(player, fire) {
    const now = this.time.now;
    if (!fire || now < (fire.cooldownUntil || 0)) {
      return;
    }

    fire.cooldownUntil = now + 1250;
    this.playerSpeed = Math.min(this.maxForwardSpeed + 70, this.playerSpeed + 95);
    this.fireBoostUntil = now + 1400;
    this.showFloatingText(fire.x, fire.y - 30, 'HEAT SPIKE!', '#fb923c');

    this.tweens.add({
      targets: fire,
      alpha: 0.45,
      yoyo: true,
      duration: 180
    });
  }

  applyChaosEvents() {
    this.bakeChaosEvents = this.chaosEvents.filter((event) => {
      if (!event || !event.phase) {
        return false;
      }

      if (Array.isArray(event.phase)) {
        return event.phase.includes('bake') || event.phase.includes('any');
      }

      return event.phase === 'bake' || event.phase === 'any';
    });

    if (!this.bakeChaosEvents.length) {
      return;
    }

    this.bakeChaosEvents.forEach((event, index) => {
      const chaosKey = String(event.key || event.name || '').toLowerCase();

      if (chaosKey.includes('slippery') || chaosKey.includes('drift')) {
        this.steeringPenalty = 1.2;
      }

      if (chaosKey.includes('tight') || chaosKey.includes('narrow')) {
        this.speedColdThreshold = 0.54;
        this.speedHotThreshold = 0.67;
      }

      if (chaosKey.includes('turbo') || chaosKey.includes('overheat')) {
        this.maxForwardSpeed += 30;
        this.acceleration += 20;
      }

      if (chaosKey.includes('cold') || chaosKey.includes('slow')) {
        this.maxForwardSpeed = Math.max(300, this.maxForwardSpeed - 20);
      }

      const banner = this.trackObject('chaosBanners', this.add.text(400, 72 + (index * 28), `⚠ ${event.name || event.key || 'Chaos'} active`, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#fca5a5',
        fontStyle: 'bold',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 10, y: 4 }
      }).setOrigin(0.5).setDepth(12));

      this.tweens.add({
        targets: banner,
        alpha: 0,
        y: banner.y - 10,
        duration: 700,
        delay: 2200 + (index * 250),
        onComplete: () => {
          if (banner && banner.scene) {
            banner.destroy();
          }
        }
      });
    });
  }

  refreshHud() {
    const score = this.calculateScore();
    const onTrack = this.player ? this.isOnTrack(this.player.x, this.player.y) : true;
    const speedRatio = this.getSpeedRatio();
    const bakeProgress = Phaser.Math.Clamp((this.lapsCompleted + Math.max(0, this.lapProgress)) / 4, 0, 1);

    if (this.timerText) {
      this.timerText.setText(`Time: ${this.timeRemaining}s`);
      this.timerText.setColor(this.timeRemaining <= 10 ? '#f87171' : (this.timeRemaining <= 20 ? '#fbbf24' : '#f8fafc'));
    }

    if (this.lapText) {
      this.lapText.setText(`Laps: ${this.lapsCompleted}`);
    }

    if (this.progressText) {
      this.progressText.setText(`Bake Progress: ${Math.round(bakeProgress * 100)}%`);
    }

    if (this.scoreText) {
      this.scoreText.setText(`Optimal Zone Score: ${score}`);
    }

    if (this.statusText) {
      let status = 'Hold the sweet spot!';
      let color = '#f8fafc';

      if (!onTrack || this.time.now < this.offRoadWarningUntil) {
        status = 'Off the track! Cake heat is unstable.';
        color = '#fca5a5';
      } else if (this.time.now < this.coolSpotUntil || speedRatio < this.speedColdThreshold) {
        status = 'Too cold! Push the speed higher.';
        color = '#7dd3fc';
      } else if (this.time.now < this.fireBoostUntil || speedRatio > this.speedHotThreshold) {
        status = 'Too hot! Ease off before it burns.';
        color = '#fb923c';
      } else if (this.isInOptimalZone()) {
        status = 'Perfect bake zone! Keep cruising.';
        color = '#86efac';
      }

      this.lastStatusMessage = status;
      this.statusText.setText(`Status: ${status}`);
      this.statusText.setColor(color);
    }

    this.drawGauges(speedRatio, bakeProgress);
  }

  drawGauges(speedRatio, bakeProgress) {
    if (!this.gaugeGraphics || !this.progressGraphics) {
      return;
    }

    this.gaugeGraphics.clear();

    const gaugeX = 868;
    const gaugeY = 454;
    const gaugeRadius = 94;
    const startAngle = Phaser.Math.DegToRad(150);
    const endAngle = Phaser.Math.DegToRad(390);
    const totalSweep = endAngle - startAngle;
    const coldEnd = startAngle + (totalSweep * this.speedColdThreshold);
    const hotStart = startAngle + (totalSweep * this.speedHotThreshold);

    this.gaugeGraphics.lineStyle(16, 0x38bdf8, 0.9);
    this.gaugeGraphics.beginPath();
    this.gaugeGraphics.arc(gaugeX, gaugeY, gaugeRadius, startAngle, coldEnd, false);
    this.gaugeGraphics.strokePath();

    this.gaugeGraphics.lineStyle(16, 0x22c55e, 0.95);
    this.gaugeGraphics.beginPath();
    this.gaugeGraphics.arc(gaugeX, gaugeY, gaugeRadius, coldEnd, hotStart, false);
    this.gaugeGraphics.strokePath();

    this.gaugeGraphics.lineStyle(16, 0xef4444, 0.95);
    this.gaugeGraphics.beginPath();
    this.gaugeGraphics.arc(gaugeX, gaugeY, gaugeRadius, hotStart, endAngle, false);
    this.gaugeGraphics.strokePath();

    this.gaugeGraphics.fillStyle(0xf8fafc, 1);
    const needleAngle = startAngle + (totalSweep * speedRatio);
    this.gaugeGraphics.fillCircle(gaugeX, gaugeY, 8);
    this.gaugeGraphics.lineStyle(6, 0xf8fafc, 1);
    this.gaugeGraphics.beginPath();
    this.gaugeGraphics.moveTo(gaugeX, gaugeY);
    this.gaugeGraphics.lineTo(gaugeX + (Math.cos(needleAngle) * 76), gaugeY + (Math.sin(needleAngle) * 76));
    this.gaugeGraphics.strokePath();

    this.gaugeGraphics.lineStyle(2, 0x64748b, 1);
    this.gaugeGraphics.strokeCircle(gaugeX, gaugeY, gaugeRadius + 14);

    this.gaugeGraphics.fillStyle(0xe5e7eb, 1);
    this.gaugeGraphics.fillCircle(gaugeX, gaugeY, 10);

    this.gaugeGraphics.fillStyle(0x0f172a, 0.95);
    this.gaugeGraphics.fillRoundedRect(800, 548, 136, 44, 10);
    this.gaugeGraphics.lineStyle(2, 0x334155, 1);
    this.gaugeGraphics.strokeRoundedRect(800, 548, 136, 44, 10);

    const thermometerHeight = 110;
    const thermometerTop = 620;
    const thermometerBottom = thermometerTop + thermometerHeight;
    const coldLineY = thermometerBottom - (thermometerHeight * this.speedColdThreshold);
    const hotLineY = thermometerBottom - (thermometerHeight * this.speedHotThreshold);

    this.gaugeGraphics.fillStyle(0x0f172a, 1);
    this.gaugeGraphics.fillRoundedRect(920, thermometerTop, 28, thermometerHeight, 12);
    this.gaugeGraphics.fillCircle(934, 742, 20);

    this.gaugeGraphics.fillStyle(0xef4444, 0.9);
    this.gaugeGraphics.fillRect(924, thermometerTop, 20, hotLineY - thermometerTop);
    this.gaugeGraphics.fillStyle(0x22c55e, 0.9);
    this.gaugeGraphics.fillRect(924, hotLineY, 20, coldLineY - hotLineY);
    this.gaugeGraphics.fillStyle(0x38bdf8, 0.8);
    this.gaugeGraphics.fillRect(924, coldLineY, 20, thermometerBottom - coldLineY);

    const mercuryHeight = thermometerHeight * speedRatio;
    this.gaugeGraphics.fillStyle(0xf97316, 1);
    this.gaugeGraphics.fillRect(926, thermometerBottom - mercuryHeight, 16, mercuryHeight);
    this.gaugeGraphics.fillCircle(934, 742, 14);
    this.gaugeGraphics.lineStyle(3, 0xe2e8f0, 1);
    this.gaugeGraphics.strokeRoundedRect(920, 620, 28, thermometerHeight, 12);
    this.gaugeGraphics.strokeCircle(934, 742, 20);

    this.progressGraphics.clear();
    this.progressGraphics.fillStyle(0x0f172a, 0.95);
    this.progressGraphics.fillRoundedRect(780, 664, 176, 18, 8);
    this.progressGraphics.lineStyle(2, 0x475569, 1);
    this.progressGraphics.strokeRoundedRect(780, 664, 176, 18, 8);
    this.progressGraphics.fillStyle(0xfbbf24, 1);
    this.progressGraphics.fillRoundedRect(782, 666, 172 * bakeProgress, 14, 7);

    this.progressGraphics.fillStyle(0xf8fafc, 1);
    this.progressGraphics.fillCircle(934, 742, 1);

    this.progressGraphics.lineStyle(2, 0x64748b, 1);
    this.progressGraphics.beginPath();
    this.progressGraphics.moveTo(924, coldLineY);
    this.progressGraphics.lineTo(950, coldLineY);
    this.progressGraphics.strokePath();

    this.progressGraphics.beginPath();
    this.progressGraphics.moveTo(924, hotLineY);
    this.progressGraphics.lineTo(950, hotLineY);
    this.progressGraphics.strokePath();

    if (!this.speedValueText || !this.speedValueText.scene) {
      this.speedValueText = this.trackObject('effectObjects', this.add.text(868, 570, '', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#f8fafc',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(10));
    }

    if (!this.temperatureValueText || !this.temperatureValueText.scene) {
      this.temperatureValueText = this.trackObject('effectObjects', this.add.text(874, 716, '', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#f8fafc',
        fontStyle: 'bold'
      }).setOrigin(1, 0.5).setDepth(10));
    }

    this.speedValueText.setText(`${Math.round(speedRatio * 100)}% speed`);
    this.temperatureValueText.setText(`${this.currentTemperature}°`);
  }

  showFloatingText(x, y, message, color) {
    const text = this.trackObject('effectObjects', this.add.text(x, y, message, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color,
      fontStyle: 'bold',
      stroke: '#0f172a',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(14));

    this.tweens.add({
      targets: text,
      y: y - 28,
      alpha: 0,
      duration: 700,
      onComplete: () => {
        if (text && text.scene) {
          text.destroy();
        }
      }
    });
  }

  showRecipeHint() {
    const overlay = this.trackObject('hintObjects', this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.78).setDepth(18));
    const text = this.trackObject('hintObjects', this.add.text(512, 384, [
      '💡 RACING OVEN TIP 💡',
      '',
      'UP accelerates, DOWN brakes, LEFT/RIGHT steer.',
      'Blue puddles chill the oven. Fire patches spike the heat.',
      `Stay between ${Math.round(this.speedColdThreshold * 100)}% and ${Math.round(this.speedHotThreshold * 100)}% speed for the best bake.`
    ].join('\n'), {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#fde68a',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setDepth(19));

    this.time.delayedCall(3200, () => {
      this.tweens.add({
        targets: [overlay, text],
        alpha: 0,
        duration: 450,
        onComplete: () => this.clearTrackedObjects('hintObjects')
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

    if (this.player && this.player.body) {
      this.player.setVelocity(0, 0);
    }

    const finalScore = Phaser.Math.Clamp(this.calculateScore(), 0, 100);
    const optimalPercent = this.totalFrames > 0 ? Math.round((this.optimalFrames / this.totalFrames) * 100) : 0;

    if (this.socket) {
      this.socket.emit('baking:phase-complete', {
        teamId: this.teamId,
        phase: 'bake',
        score: finalScore,
        details: {
          optimalPercent,
          lapsCompleted: this.lapsCompleted,
          finalTemperature: this.currentTemperature,
          speedRange: {
            min: Math.round(this.speedColdThreshold * 100),
            max: Math.round(this.speedHotThreshold * 100)
          },
          chaosEvents: this.bakeChaosEvents.map((event) => event.key || event.name || 'chaos'),
          timeRemaining: this.timeRemaining
        }
      });
    }

    this.showCompletionScreen(finalScore);
  }

  showCompletionScreen(score) {
    this.completionObjects = [];

    const optimalPercent = this.totalFrames > 0 ? Math.round((this.optimalFrames / this.totalFrames) * 100) : 0;
    const overlay = this.trackObject('completionObjects', this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.8).setDepth(20));
    const panel = this.trackObject('completionObjects', this.add.rectangle(512, 384, 620, 340, 0x111827, 0.96).setStrokeStyle(3, 0x475569).setDepth(21));

    overlay.setDepth(20);
    panel.setDepth(21);

    this.trackObject('completionObjects', this.add.text(512, 260, 'BAKE LAP COMPLETE!', {
      fontFamily: 'Arial',
      fontSize: '42px',
      color: '#fef3c7',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(22));

    this.trackObject('completionObjects', this.add.text(512, 320, `Score: ${score}/100`, {
      fontFamily: 'Arial',
      fontSize: '38px',
      color: '#86efac',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(22));

    this.trackObject('completionObjects', this.add.text(512, 378, `Time in optimal zone: ${optimalPercent}%`, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#f8fafc'
    }).setOrigin(0.5).setDepth(22));

    this.trackObject('completionObjects', this.add.text(512, 420, `Laps completed: ${this.lapsCompleted}   •   Final temp: ${this.currentTemperature}°`, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#cbd5e1',
      align: 'center'
    }).setOrigin(0.5).setDepth(22));

    this.trackObject('completionObjects', this.add.text(512, 476, 'Returning to phase select...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#93c5fd',
      fontStyle: 'italic'
    }).setOrigin(0.5).setDepth(22));

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

    if (this.completionEvent) {
      this.completionEvent.remove();
      this.completionEvent = null;
    }

    this.time.removeAllEvents();
    this.tweens.killAll();

    if (this.puddles) {
      this.puddles.clear(true, true);
      this.puddles.destroy(true);
      this.puddles = null;
    }

    if (this.fires) {
      this.fires.clear(true, true);
      this.fires.destroy(true);
      this.fires = null;
    }

    if (this.player && this.player.scene) {
      this.player.destroy();
    }
    this.player = null;

    this.clearTrackedObjects('effectObjects');
    this.clearTrackedObjects('hintObjects');
    this.clearTrackedObjects('completionObjects');
    this.clearTrackedObjects('chaosBanners');
    this.clearTrackedObjects('sceneObjects');

    this.cursors = null;
    this.timerText = null;
    this.lapText = null;
    this.scoreText = null;
    this.statusText = null;
    this.progressText = null;
    this.gaugeGraphics = null;
    this.progressGraphics = null;
    this.speedValueText = null;
    this.temperatureValueText = null;
  }
}

window.RacingOvenScene = RacingOvenScene;
