class ObstacleCourseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ObstacleCourseScene' });

    this.socket = null;
    this.teamId = null;
    this.inventory = [];
    this.boosts = {};
    this.chaosEvents = [];
    this.activeChaosEvents = [];
    this.timeRemaining = 45;
    this.timeLimit = 45;

    this.timerEvent = null;
    this.completionEvent = null;
    this.isComplete = false;

    this.totalDistance = 7600;
    this.currentDistance = 0;
    this.scrollSpeed = 220;
    this.damageMultiplier = 1;
    this.jumpVelocity = -720;
    this.gravity = 1800;

    this.groundY = 584;
    this.playerBaseX = 224;
    this.playerY = 584;
    this.verticalVelocity = 0;
    this.isDucking = false;
    this.stability = 100;
    this.hitRecoverUntil = 0;
    this.failedBySplat = false;
    this.finishedCourse = false;

    this.obstacles = [];
    this.obstacleObjects = [];
    this.persistentObjects = [];
    this.effectObjects = [];
    this.completionObjects = [];
    this.chaosBanners = [];

    this.player = null;
    this.courseGraphics = null;
    this.hudGraphics = null;
    this.timerText = null;
    this.distanceText = null;
    this.stabilityText = null;
    this.statusText = null;
    this.tipText = null;
    this.chaosText = null;

    this.cursors = null;
    this.jumpKeys = null;
  }

  init(data) {
    this.socket = data.socket;
    this.teamId = data.teamId;
    this.inventory = data.inventory || [];
    this.boosts = data.boosts || {};
    this.chaosEvents = data.chaosEvents || [];
    this.timeRemaining = 45;

    this.activeChaosEvents = [];
    this.timerEvent = null;
    this.completionEvent = null;
    this.isComplete = false;

    this.totalDistance = 7600;
    this.currentDistance = 0;
    this.scrollSpeed = 220;
    this.damageMultiplier = 1;
    this.jumpVelocity = -720;
    this.gravity = 1800;

    this.playerY = this.groundY;
    this.verticalVelocity = 0;
    this.isDucking = false;
    this.stability = 100;
    this.hitRecoverUntil = 0;
    this.failedBySplat = false;
    this.finishedCourse = false;

    this.obstacles = [];
    this.obstacleObjects = [];
    this.persistentObjects = [];
    this.effectObjects = [];
    this.completionObjects = [];
    this.chaosBanners = [];

    this.player = null;
    this.courseGraphics = null;
    this.hudGraphics = null;
    this.timerText = null;
    this.distanceText = null;
    this.stabilityText = null;
    this.statusText = null;
    this.tipText = null;
    this.chaosText = null;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b1220');

    this.createBackground();
    this.createCourse();
    this.createPlayer();
    this.buildObstacleCourse();
    this.createHud();
    this.applyChaosEvents();
    this.setupInput();
    this.refreshHud();

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  update(time, delta) {
    if (this.isComplete) {
      return;
    }

    const deltaSeconds = delta / 1000;

    this.handleInput();
    this.updatePlayerPhysics(deltaSeconds);
    this.currentDistance = Math.min(this.totalDistance, this.currentDistance + (this.scrollSpeed * deltaSeconds));
    this.updateObstacles(time);
    this.checkObstacleInteractions();
    this.drawCourse();
    this.updatePlayerVisuals(time);
    this.refreshHud();

    if (this.currentDistance >= this.totalDistance) {
      this.finishedCourse = true;
      this.completeMinigame();
    }
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
    this.trackObject('persistentObjects', this.add.rectangle(512, 384, 1024, 768, 0x0b1220, 1));
    this.trackObject('persistentObjects', this.add.rectangle(512, 160, 1024, 260, 0x132238, 1));
    this.trackObject('persistentObjects', this.add.rectangle(512, 508, 1024, 320, 0x111827, 1));
    this.trackObject('persistentObjects', this.add.text(42, 34, 'OBSTACLE COURSE PRESENTATION', {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#fbbf24',
      fontStyle: 'bold'
    }));
    this.trackObject('persistentObjects', this.add.text(42, 78, 'UP/SPACE = jump • DOWN = duck • keep the cake stable to the finish.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#cbd5e1'
    }));

    for (let i = 0; i < 8; i += 1) {
      this.trackObject('persistentObjects', this.add.circle(90 + (i * 120), 164 + ((i % 2) * 28), 26 + ((i % 3) * 10), 0x1e293b, 0.65));
    }
  }

  createCourse() {
    this.courseGraphics = this.trackObject('persistentObjects', this.add.graphics());
  }

  createPlayer() {
    const container = this.add.container(this.playerBaseX, this.playerY - 6);
    const legLeft = this.add.rectangle(-14, 30, 12, 42, 0x60a5fa, 1);
    const legRight = this.add.rectangle(14, 30, 12, 42, 0x60a5fa, 1);
    const body = this.add.rectangle(0, -10, 42, 64, 0x2563eb, 1).setStrokeStyle(2, 0x0f172a, 0.7);
    const head = this.add.circle(0, -58, 18, 0xf4c2a1, 1).setStrokeStyle(2, 0x7c2d12, 0.3);
    const arm = this.add.rectangle(24, -8, 12, 44, 0x93c5fd, 1);
    const cakeContainer = this.add.container(18, -78);
    const plate = this.add.ellipse(0, 24, 84, 20, 0x94a3b8, 1);
    const cakeBase = this.add.ellipse(0, 8, 60, 28, 0xf5d0a9, 1).setStrokeStyle(2, 0xd6b38a, 0.8);
    const cakeLayer = this.add.rectangle(0, 6, 54, 30, 0xf8e7d0, 1).setStrokeStyle(2, 0xe5c9a6, 0.8);
    const cakeTop = this.add.ellipse(0, -8, 54, 20, 0xfff4ea, 1);
    const cherry = this.add.circle(0, -20, 5, 0xef4444, 1);
    cakeContainer.add([plate, cakeLayer, cakeBase, cakeTop, cherry]);
    container.add([legLeft, legRight, body, head, arm, cakeContainer]);
    container.setDepth(10);

    this.player = {
      container,
      legLeft,
      legRight,
      body,
      head,
      arm,
      cakeContainer,
      cakeTop,
      cakeLayer,
      plate
    };
  }

  buildObstacleCourse() {
    const pattern = ['gap', 'barrier', 'flying', 'barrier', 'gap', 'flying', 'barrier', 'gap', 'flying', 'barrier', 'gap'];
    let x = 940;

    pattern.forEach((type, index) => {
      let obstacle;
      if (type === 'gap') {
        obstacle = {
          type,
          worldX: x,
          width: 180 + ((index % 3) * 24),
          hit: false,
          passed: false,
          damage: 24
        };
        x += obstacle.width + 340;
      } else if (type === 'barrier') {
        obstacle = {
          type,
          worldX: x,
          width: 136,
          height: 24,
          y: this.groundY - 94,
          hit: false,
          passed: false,
          damage: 18
        };
        x += 470;
      } else {
        obstacle = {
          type,
          worldX: x,
          width: 78,
          height: 34,
          baseY: this.groundY - 54,
          hit: false,
          passed: false,
          bobOffset: index * 120,
          damage: 20
        };
        x += 420;
      }

      obstacle.container = this.createObstacleVisual(obstacle);
      this.obstacles.push(obstacle);
    });
  }

  createObstacleVisual(obstacle) {
    const container = this.add.container(-400, -400);
    container.setDepth(8);

    if (obstacle.type === 'gap') {
      const leftMarker = this.add.rectangle(-(obstacle.width / 2), 0, 18, 86, 0xf97316, 1).setStrokeStyle(2, 0x7c2d12, 0.5);
      const rightMarker = this.add.rectangle(obstacle.width / 2, 0, 18, 86, 0xf97316, 1).setStrokeStyle(2, 0x7c2d12, 0.5);
      const warning = this.add.text(0, -58, 'GAP', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#fff7ed',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      container.add([leftMarker, rightMarker, warning]);
    } else if (obstacle.type === 'barrier') {
      const bar = this.add.rectangle(0, 0, obstacle.width, obstacle.height, 0xf59e0b, 1).setStrokeStyle(3, 0x7c2d12, 0.6);
      const supportLeft = this.add.rectangle(-(obstacle.width / 2) + 10, 44, 10, 90, 0x9a3412, 1);
      const supportRight = this.add.rectangle((obstacle.width / 2) - 10, 44, 10, 90, 0x9a3412, 1);
      container.add([supportLeft, supportRight, bar]);
    } else {
      const body = this.add.ellipse(0, 0, obstacle.width, obstacle.height, 0xfb7185, 1).setStrokeStyle(2, 0x831843, 0.7);
      const wing = this.add.polygon(0, 0, [-18, 0, 0, -18, 18, 0, 0, 18], 0xfef3c7, 0.45);
      container.add([wing, body]);
    }

    this.obstacleObjects.push(container);
    return container;
  }

  createHud() {
    this.hudGraphics = this.trackObject('persistentObjects', this.add.graphics());
    this.timerText = this.trackObject('persistentObjects', this.add.text(42, 124, 'Time: 45s', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }));
    this.distanceText = this.trackObject('persistentObjects', this.add.text(42, 156, 'Distance: 0%', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#93c5fd'
    }));
    this.stabilityText = this.trackObject('persistentObjects', this.add.text(42, 188, 'Cake Stability: 100', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#86efac'
    }));
    this.statusText = this.trackObject('persistentObjects', this.add.text(42, 704, 'Run clean, jump gaps, duck barriers, and keep the cake upright.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#e2e8f0',
      wordWrap: { width: 660 }
    }));
    this.tipText = this.trackObject('persistentObjects', this.add.text(732, 124, 'Finish bonus = stability + time remaining.', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#cbd5e1',
      wordWrap: { width: 250 }
    }));
    this.chaosText = this.trackObject('persistentObjects', this.add.text(732, 176, 'Chaos: none', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#fca5a5',
      wordWrap: { width: 250 }
    }));
  }

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.jumpKeys = this.input.keyboard.addKeys({
      jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
      altJump: Phaser.Input.Keyboard.KeyCodes.W
    });
  }

  handleInput() {
    if (!this.cursors || !this.jumpKeys) {
      return;
    }

    const wantsJump = Phaser.Input.Keyboard.JustDown(this.cursors.up)
      || Phaser.Input.Keyboard.JustDown(this.jumpKeys.jump)
      || Phaser.Input.Keyboard.JustDown(this.jumpKeys.altJump);

    if (wantsJump && this.playerY >= this.groundY - 0.5) {
      this.verticalVelocity = this.jumpVelocity;
      this.isDucking = false;
      if (this.statusText) {
        this.statusText.setText('Jump! Clear the gap before the cake tips over.');
      }
    }

    this.isDucking = this.playerY >= this.groundY - 0.5 && this.cursors.down.isDown;
  }

  updatePlayerPhysics(deltaSeconds) {
    this.verticalVelocity += this.gravity * deltaSeconds;
    this.playerY += this.verticalVelocity * deltaSeconds;

    if (this.playerY >= this.groundY) {
      this.playerY = this.groundY;
      this.verticalVelocity = 0;
    }
  }

  updateObstacles(time) {
    this.obstacles.forEach((obstacle) => {
      const screenX = this.playerBaseX + (obstacle.worldX - this.currentDistance);
      obstacle.screenX = screenX;

      if (obstacle.type === 'gap') {
        obstacle.container.x = screenX;
        obstacle.container.y = this.groundY + 4;
        obstacle.container.setVisible(screenX > -220 && screenX < 1240);
        return;
      }

      if (obstacle.type === 'barrier') {
        obstacle.container.x = screenX;
        obstacle.container.y = obstacle.y;
        obstacle.container.setVisible(screenX > -160 && screenX < 1180);
        return;
      }

      obstacle.currentY = obstacle.baseY + Math.sin((time + obstacle.bobOffset) / 180) * 12;
      obstacle.container.x = screenX;
      obstacle.container.y = obstacle.currentY;
      obstacle.container.rotation += 0.05;
      obstacle.container.setVisible(screenX > -120 && screenX < 1140);
    });
  }

  drawCourse() {
    if (!this.courseGraphics) {
      return;
    }

    this.courseGraphics.clear();
    this.courseGraphics.fillStyle(0x1f2937, 1);
    this.courseGraphics.fillRect(0, this.groundY, 1024, 184);
    this.courseGraphics.fillStyle(0x334155, 0.85);
    this.courseGraphics.fillRect(0, this.groundY - 14, 1024, 18);

    this.obstacles.forEach((obstacle) => {
      if (obstacle.type !== 'gap') {
        return;
      }

      const gapStart = this.playerBaseX + (obstacle.worldX - this.currentDistance) - (obstacle.width / 2);
      const gapEnd = gapStart + obstacle.width;
      if (gapEnd < 0 || gapStart > 1024) {
        return;
      }

      this.courseGraphics.fillStyle(0x020617, 1);
      this.courseGraphics.fillRect(gapStart, this.groundY - 14, obstacle.width, 200);
      this.courseGraphics.lineStyle(3, 0xf97316, 0.8);
      this.courseGraphics.strokeLineShape(new Phaser.Geom.Line(gapStart, this.groundY - 14, gapStart, 768));
      this.courseGraphics.strokeLineShape(new Phaser.Geom.Line(gapEnd, this.groundY - 14, gapEnd, 768));
    });
  }

  getPlayerBounds() {
    const width = 40;
    const height = this.isDucking ? 72 : 118;
    return {
      left: this.playerBaseX - (width / 2),
      right: this.playerBaseX + (width / 2),
      top: this.playerY - height,
      bottom: this.playerY,
      height
    };
  }

  checkObstacleInteractions() {
    const playerBounds = this.getPlayerBounds();
    const worldFront = this.currentDistance + 12;

    this.obstacles.forEach((obstacle) => {
      if (obstacle.passed) {
        return;
      }

      if (obstacle.type === 'gap') {
        const gapStart = obstacle.worldX - (obstacle.width / 2);
        const gapEnd = obstacle.worldX + (obstacle.width / 2);

        if (!obstacle.hit && worldFront >= gapStart && worldFront <= gapEnd && playerBounds.bottom >= this.groundY - 2) {
          obstacle.hit = true;
          this.registerHit(obstacle.damage, 'Missed the jump and clipped a gap.');
        }

        if (worldFront > gapEnd + 40) {
          obstacle.passed = true;
        }
        return;
      }

      const screenLeft = obstacle.screenX - (obstacle.width / 2);
      const screenRight = obstacle.screenX + (obstacle.width / 2);
      const overlapsX = playerBounds.right > screenLeft && playerBounds.left < screenRight;
      if (!overlapsX) {
        if (screenRight < playerBounds.left - 120) {
          obstacle.passed = true;
        }
        return;
      }

      if (obstacle.type === 'barrier') {
        const barrierTop = obstacle.y - (obstacle.height / 2);
        const barrierBottom = obstacle.y + (obstacle.height / 2);
        const overlapsY = playerBounds.top < barrierBottom && playerBounds.bottom > barrierTop;
        if (!obstacle.hit && overlapsY) {
          obstacle.hit = true;
          this.registerHit(obstacle.damage, 'Failed to duck under a barrier.');
        }
        return;
      }

      const flyTop = obstacle.currentY - (obstacle.height / 2);
      const flyBottom = obstacle.currentY + (obstacle.height / 2);
      const overlapsY = playerBounds.top < flyBottom && playerBounds.bottom > flyTop;
      if (!obstacle.hit && overlapsY) {
        obstacle.hit = true;
        this.registerHit(obstacle.damage, 'A flying hazard smacked the cake.');
      }
    });
  }

  registerHit(baseDamage, message) {
    if (this.time.now < this.hitRecoverUntil || this.isComplete) {
      return;
    }

    this.hitRecoverUntil = this.time.now + 650;
    const damage = Math.round(baseDamage * this.damageMultiplier);
    this.stability = Math.max(0, this.stability - damage);
    this.verticalVelocity = Math.min(this.verticalVelocity, -260);

    this.cameras.main.shake(180, 0.008);
    if (this.statusText) {
      this.statusText.setText(`${message} (-${damage} stability)`);
    }

    const burst = this.trackObject('effectObjects', this.add.text(this.playerBaseX + 68, this.playerY - 148, `-${damage}`, {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: '#fca5a5',
      fontStyle: 'bold'
    }).setDepth(30));

    this.tweens.add({
      targets: burst,
      y: burst.y - 36,
      alpha: 0,
      duration: 520,
      onComplete: () => {
        if (burst && burst.destroy) {
          burst.destroy();
        }
      }
    });

    if (this.stability <= 0) {
      this.triggerSplat();
    }
  }

  triggerSplat() {
    if (this.failedBySplat || this.isComplete) {
      return;
    }

    this.failedBySplat = true;
    this.scrollSpeed = 0;
    if (this.statusText) {
      this.statusText.setText('Cake stability hit zero. Total splatter disaster.');
    }

    const splat = this.trackObject('effectObjects', this.add.graphics().setDepth(32));
    splat.fillStyle(0xfda4af, 0.95);
    splat.fillEllipse(this.playerBaseX + 36, this.groundY + 10, 120, 38);
    splat.fillEllipse(this.playerBaseX - 4, this.groundY + 22, 78, 24);
    splat.fillStyle(0xffffff, 0.5);
    splat.fillEllipse(this.playerBaseX + 18, this.groundY + 6, 28, 10);

    if (this.player && this.player.cakeContainer) {
      this.tweens.add({
        targets: this.player.cakeContainer,
        y: this.player.cakeContainer.y + 70,
        rotation: 1.2,
        alpha: 0,
        duration: 450,
        ease: 'Quad.easeIn'
      });
    }

    this.time.delayedCall(900, () => this.completeMinigame());
  }

  updatePlayerVisuals(time) {
    if (!this.player) {
      return;
    }

    const runPhase = (this.currentDistance / 85);
    const stride = Math.sin(runPhase) * 8;
    const wobbleIntensity = Phaser.Math.Clamp((100 - this.stability) / 100, 0, 1);
    const cakeWobble = Math.sin((time / 130) + runPhase) * (0.05 + (wobbleIntensity * 0.22));

    this.player.container.x = this.playerBaseX;
    this.player.container.y = this.playerY - 6;
    this.player.container.rotation = this.time.now < this.hitRecoverUntil ? Math.sin(time / 40) * 0.05 : 0;

    this.player.legLeft.y = 30 + stride;
    this.player.legRight.y = 30 - stride;
    this.player.body.scaleY = this.isDucking ? 0.72 : 1;
    this.player.head.y = this.isDucking ? -38 : -58;
    this.player.arm.y = this.isDucking ? 2 : -8;
    this.player.cakeContainer.rotation = cakeWobble;
    this.player.cakeContainer.y = (this.isDucking ? -66 : -78) + (Math.abs(stride) * 0.15);
    this.player.cakeTop.fillColor = this.stability <= 35 ? 0xfca5a5 : 0xfff4ea;
    this.player.plate.fillColor = this.stability <= 20 ? 0xef4444 : 0x94a3b8;
  }

  updateTimer() {
    if (this.isComplete) {
      return;
    }

    this.timeRemaining = Math.max(0, this.timeRemaining - 1);
    this.refreshHud();

    if (this.timeRemaining <= 0 && !this.finishedCourse && !this.failedBySplat) {
      this.completeMinigame();
    }
  }

  refreshHud() {
    const distancePercent = Math.round((this.currentDistance / this.totalDistance) * 100);

    if (this.timerText) {
      this.timerText.setText(`Time: ${this.timeRemaining}s`);
      this.timerText.setColor(this.timeRemaining <= 10 ? '#f87171' : (this.timeRemaining <= 20 ? '#fbbf24' : '#f8fafc'));
    }

    if (this.distanceText) {
      this.distanceText.setText(`Distance: ${distancePercent}%`);
    }

    if (this.stabilityText) {
      this.stabilityText.setText(`Cake Stability: ${this.stability}`);
      this.stabilityText.setColor(this.stability <= 25 ? '#f87171' : (this.stability <= 55 ? '#fbbf24' : '#86efac'));
    }

    if (this.chaosText) {
      this.chaosText.setText(this.activeChaosEvents.length
        ? `Chaos: ${this.activeChaosEvents.map((event) => event.name || event.key || 'chaos').join(', ')}`
        : 'Chaos: none');
    }

    if (this.hudGraphics) {
      this.hudGraphics.clear();
      this.hudGraphics.fillStyle(0x111827, 0.95);
      this.hudGraphics.fillRoundedRect(34, 224, 272, 88, 16);
      this.hudGraphics.fillStyle(0x1f2937, 1);
      this.hudGraphics.fillRoundedRect(52, 248, 236, 18, 9);
      this.hudGraphics.fillStyle(this.stability <= 25 ? 0xef4444 : (this.stability <= 55 ? 0xf59e0b : 0x22c55e), 1);
      this.hudGraphics.fillRoundedRect(52, 248, 236 * (this.stability / 100), 18, 9);
      this.hudGraphics.fillStyle(0x1f2937, 1);
      this.hudGraphics.fillRoundedRect(52, 284, 236, 14, 7);
      this.hudGraphics.fillStyle(0x38bdf8, 1);
      this.hudGraphics.fillRoundedRect(52, 284, 236 * (this.currentDistance / this.totalDistance), 14, 7);
    }
  }

  applyChaosEvents() {
    this.activeChaosEvents = this.chaosEvents.filter((event) => {
      if (!event || !event.phase) {
        return false;
      }

      if (Array.isArray(event.phase)) {
        return event.phase.includes('present') || event.phase.includes('any');
      }

      return event.phase === 'present' || event.phase === 'any';
    });

    if (!this.activeChaosEvents.length) {
      return;
    }

    this.activeChaosEvents.forEach((event, index) => {
      const chaosKey = `${event.key || ''} ${event.name || ''}`.toLowerCase();
      if (/wind|turbo|rush|speed/.test(chaosKey)) {
        this.scrollSpeed += 18;
      }

      if (/quake|fragile|storm|hazard|catastrophe/.test(chaosKey)) {
        this.damageMultiplier += 0.18;
      }

      if (/heavy|gravity/.test(chaosKey)) {
        this.jumpVelocity = -670;
      }

      if (/dark|power|blackout/.test(chaosKey)) {
        this.trackObject('persistentObjects', this.add.rectangle(512, 384, 1024, 768, 0x020617, 0.12).setDepth(2));
      }

      const banner = this.trackObject('chaosBanners', this.add.text(512, 116 + (index * 30), `⚠ ${event.name || event.key || 'Chaos'} active`, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#fca5a5',
        fontStyle: 'bold',
        backgroundColor: 'rgba(15,23,42,0.55)',
        padding: { x: 10, y: 4 }
      }).setOrigin(0.5).setDepth(24));

      this.tweens.add({
        targets: banner,
        alpha: 0,
        y: banner.y - 8,
        duration: 700,
        delay: 2200 + (index * 200),
        onComplete: () => {
          if (banner && banner.destroy) {
            banner.destroy();
          }
        }
      });
    });
  }

  calculateScore() {
    const distanceRatio = Phaser.Math.Clamp(this.currentDistance / this.totalDistance, 0, 1);

    if (this.finishedCourse) {
      const timeBonus = Phaser.Math.Clamp((this.timeRemaining / this.timeLimit) * 100, 0, 100);
      return Math.round((this.stability * 0.7) + (timeBonus * 0.3));
    }

    return Math.round(distanceRatio * 50);
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

    const distanceRatio = Phaser.Math.Clamp(this.currentDistance / this.totalDistance, 0, 1);
    const score = Phaser.Math.Clamp(this.calculateScore(), 0, 100);

    if (this.socket) {
      this.socket.emit('baking:phase-complete', {
        teamId: this.teamId,
        phase: 'present',
        score,
        details: {
          finishedCourse: this.finishedCourse,
          failedBySplat: this.failedBySplat,
          distancePercent: Math.round(distanceRatio * 100),
          stabilityRemaining: this.stability,
          timeRemaining: this.timeRemaining,
          chaosEvents: this.activeChaosEvents.map((event) => event.key || event.name || 'chaos')
        }
      });
    }

    this.showCompletionScreen(score);
  }

  showCompletionScreen(score) {
    this.clearTrackedObjects('completionObjects');
    this.completionObjects = [];

    const distancePercent = Math.round((this.currentDistance / this.totalDistance) * 100);
    const title = this.finishedCourse
      ? 'CAKE PRESENTED THROUGH THE GAUNTLET!'
      : (this.failedBySplat ? 'CAKE SPLATTERED MID-COURSE!' : 'TIME RAN OUT ON THE COURSE!');
    const subtitle = this.finishedCourse
      ? 'You held the plate together and reached the finish line.'
      : `Distance reached: ${distancePercent}% of the course.`;

    const overlay = this.trackObject('completionObjects', this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.8).setDepth(40));
    const panel = this.trackObject('completionObjects', this.add.rectangle(512, 384, 648, 360, 0x111827, 0.98).setStrokeStyle(3, this.finishedCourse ? 0x4ade80 : 0xf87171, 1).setDepth(41));

    this.trackObject('completionObjects', this.add.text(512, 246, title, {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: this.finishedCourse ? '#86efac' : '#fca5a5',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 560 }
    }).setOrigin(0.5).setDepth(42));

    this.trackObject('completionObjects', this.add.text(512, 318, `Score: ${score}/100`, {
      fontFamily: 'Arial',
      fontSize: '40px',
      color: '#7dd3fc',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(42));

    this.trackObject('completionObjects', this.add.text(512, 380, `Cake Stability: ${this.stability}   •   Distance: ${distancePercent}%`, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#e2e8f0'
    }).setOrigin(0.5).setDepth(42));

    this.trackObject('completionObjects', this.add.text(512, 436, subtitle, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#cbd5e1',
      align: 'center',
      wordWrap: { width: 540 }
    }).setOrigin(0.5).setDepth(42));

    this.trackObject('completionObjects', this.add.text(512, 510, 'Returning to phase select...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#93c5fd',
      fontStyle: 'italic'
    }).setOrigin(0.5).setDepth(42));

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

    if (this.player && this.player.container) {
      this.player.container.destroy();
    }
    this.player = null;

    this.obstacleObjects.forEach((object) => {
      if (object && object.destroy) {
        object.destroy();
      }
    });
    this.obstacleObjects = [];
    this.obstacles = [];

    this.clearTrackedObjects('effectObjects');
    this.clearTrackedObjects('completionObjects');
    this.clearTrackedObjects('chaosBanners');
    this.clearTrackedObjects('persistentObjects');

    this.courseGraphics = null;
    this.hudGraphics = null;
    this.timerText = null;
    this.distanceText = null;
    this.stabilityText = null;
    this.statusText = null;
    this.tipText = null;
    this.chaosText = null;
    this.cursors = null;
    this.jumpKeys = null;
  }
}

window.ObstacleCourseScene = ObstacleCourseScene;
