class CowCombatScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CowCombatScene' });

    this.socket = null;
    this.teamId = null;
    this.inventory = [];
    this.boosts = {};
    this.chaosEvents = [];
    this.timeLimit = 60;
    this.timeRemaining = 60;
    this.timerEvent = null;
    this.completionEvent = null;
    this.isComplete = false;

    this.sceneObjects = [];
    this.effectObjects = [];
    this.hintObjects = [];
    this.completionObjects = [];
    this.chaosBanners = [];

    this.arena = { x: 96, y: 132, width: 832, height: 560 };
    this.player = null;
    this.enemies = null;
    this.attacks = null;
    this.cursors = null;
    this.keys = null;
    this.facing = null;

    this.playerSpeed = 280;
    this.attackSpeed = 560;
    this.attackCooldown = 420;
    this.attackReadyAt = 0;
    this.damageCooldown = 900;
    this.invulnerableUntil = 0;
    this.playerHealth = 100;
    this.enemyDamage = 20;
    this.mixingProgress = 0;
    this.successfulHits = 0;
    this.enemyCount = 2;
    this.enemySpeedMultiplier = 1;
    this.chaosIntensity = 0;
    this.playerKnockedOut = false;

    this.timerText = null;
    this.statusText = null;
    this.healthLabel = null;
    this.mixLabel = null;
    this.healthValueText = null;
    this.mixValueText = null;
    this.barsGraphics = null;
    this.chaosOverlay = null;
  }

  init(data) {
    this.socket = data.socket || this.registry.get('socket') || null;
    this.teamId = data.teamId || 'unknown-team';
    this.inventory = data.inventory || this.registry.get('inventory') || [];
    this.boosts = data.boosts || {};
    this.chaosEvents = data.chaosEvents || [];
    this.timeRemaining = 60;
    this.timerEvent = null;
    this.completionEvent = null;
    this.isComplete = false;

    this.sceneObjects = [];
    this.effectObjects = [];
    this.hintObjects = [];
    this.completionObjects = [];
    this.chaosBanners = [];

    this.player = null;
    this.enemies = null;
    this.attacks = null;
    this.cursors = null;
    this.keys = null;
    this.facing = new Phaser.Math.Vector2(0, -1);

    this.attackReadyAt = 0;
    this.invulnerableUntil = 0;
    this.playerHealth = 100;
    this.mixingProgress = 0;
    this.successfulHits = 0;
    this.enemyCount = 2;
    this.enemySpeedMultiplier = 1;
    this.chaosIntensity = 0;
    this.playerKnockedOut = false;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b1320');
    this.createTextures();
    this.createArena();
    this.createHud();
    this.createPlayer();
    this.createEnemies();

    this.attacks = this.physics.add.group({ allowGravity: false, immovable: true });
    this.physics.add.overlap(this.player, this.enemies, this.handlePlayerHit, null, this);
    this.physics.add.overlap(this.attacks, this.enemies, this.handleEnemyHit, null, this);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE');

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

  removeTrackedObject(listName, object) {
    if (!Array.isArray(this[listName])) {
      return;
    }

    this[listName] = this[listName].filter((entry) => entry !== object);
  }

  createTextures() {
    this.createCowTexture('cowcombat-player', 0x86efac, 0x14532d, 0xf8fafc);
    this.createCowTexture('cowcombat-enemy', 0xfca5a5, 0x7f1d1d, 0xfef3c7);

    if (!this.textures.exists('cowcombat-charge')) {
      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      graphics.fillStyle(0xfacc15, 1);
      graphics.fillRoundedRect(14, 4, 20, 42, 8);
      graphics.fillTriangle(24, 0, 4, 28, 44, 28);
      graphics.lineStyle(3, 0x78350f, 1);
      graphics.strokeRoundedRect(14, 4, 20, 42, 8);
      graphics.strokeTriangle(24, 0, 4, 28, 44, 28);
      graphics.generateTexture('cowcombat-charge', 48, 48);
      graphics.destroy();
    }
  }

  createCowTexture(key, bodyColor, spotColor, hornColor) {
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(bodyColor, 1);
    graphics.fillCircle(32, 34, 18);
    graphics.fillRoundedRect(14, 18, 36, 30, 10);
    graphics.fillCircle(20, 20, 10);
    graphics.fillCircle(44, 20, 10);

    graphics.fillStyle(hornColor, 1);
    graphics.fillTriangle(18, 6, 10, 18, 24, 18);
    graphics.fillTriangle(46, 6, 40, 18, 54, 18);

    graphics.fillStyle(spotColor, 0.9);
    graphics.fillCircle(26, 28, 5);
    graphics.fillCircle(39, 38, 6);
    graphics.fillCircle(33, 18, 4);

    graphics.fillStyle(0x111827, 1);
    graphics.fillCircle(24, 22, 2);
    graphics.fillCircle(40, 22, 2);
    graphics.fillCircle(28, 33, 2);
    graphics.fillCircle(36, 33, 2);

    graphics.lineStyle(3, 0x1f2937, 1);
    graphics.strokeRoundedRect(14, 18, 36, 30, 10);
    graphics.generateTexture(key, 64, 64);
    graphics.destroy();
  }

  createArena() {
    const background = this.trackObject('sceneObjects', this.add.graphics());
    background.fillGradientStyle(0x09111d, 0x09111d, 0x1b263b, 0x111827, 1);
    background.fillRect(0, 0, 1024, 768);

    const arena = this.trackObject('sceneObjects', this.add.graphics());
    arena.fillStyle(0x14532d, 1);
    arena.fillRoundedRect(this.arena.x, this.arena.y, this.arena.width, this.arena.height, 26);
    arena.fillStyle(0x166534, 0.35);
    for (let x = this.arena.x + 40; x < this.arena.x + this.arena.width; x += 80) {
      arena.fillRect(x, this.arena.y + 20, 12, this.arena.height - 40);
    }
    arena.lineStyle(12, 0x8b5e34, 1);
    arena.strokeRoundedRect(this.arena.x, this.arena.y, this.arena.width, this.arena.height, 26);
    arena.lineStyle(4, 0xd4a373, 1);
    arena.strokeRoundedRect(this.arena.x + 12, this.arena.y + 12, this.arena.width - 24, this.arena.height - 24, 18);

    for (let x = this.arena.x + 18; x <= this.arena.x + this.arena.width - 18; x += 72) {
      this.trackObject('sceneObjects', this.add.rectangle(x, this.arena.y + 2, 10, 28, 0x6b4423).setOrigin(0.5, 0));
      this.trackObject('sceneObjects', this.add.rectangle(x, this.arena.y + this.arena.height - 2, 10, 28, 0x6b4423).setOrigin(0.5, 1));
    }

    for (let y = this.arena.y + 18; y <= this.arena.y + this.arena.height - 18; y += 72) {
      this.trackObject('sceneObjects', this.add.rectangle(this.arena.x + 2, y, 28, 10, 0x6b4423).setOrigin(0, 0.5));
      this.trackObject('sceneObjects', this.add.rectangle(this.arena.x + this.arena.width - 2, y, 28, 10, 0x6b4423).setOrigin(1, 0.5));
    }

    this.trackObject('sceneObjects', this.add.text(512, 22, '🐄 COW COMBAT · CHURN OR BURN', {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0));

    this.trackObject('sceneObjects', this.add.text(512, 98, 'Dodge enemy cows, slam SPACE to charge, and churn the batter to 100%.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#d1d5db',
      align: 'center'
    }).setOrigin(0.5, 0));

    this.physics.world.setBounds(this.arena.x + 22, this.arena.y + 22, this.arena.width - 44, this.arena.height - 44);
  }

  createHud() {
    this.trackObject('sceneObjects', this.add.text(110, 60, 'HEALTH', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }));

    this.trackObject('sceneObjects', this.add.text(342, 60, 'MIXING', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }));

    this.healthValueText = this.trackObject('sceneObjects', this.add.text(270, 58, '100 HP', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#fecaca',
      fontStyle: 'bold'
    }).setOrigin(1, 0));

    this.mixValueText = this.trackObject('sceneObjects', this.add.text(690, 58, '0%', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#fde68a',
      fontStyle: 'bold'
    }).setOrigin(1, 0));

    this.timerText = this.trackObject('sceneObjects', this.add.text(944, 56, '60s', {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(1, 0));

    this.statusText = this.trackObject('sceneObjects', this.add.text(512, 718, 'Use WASD or arrow keys to move. Press SPACE to charge.', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#f8fafc',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5, 0.5));

    this.barsGraphics = this.trackObject('sceneObjects', this.add.graphics());
  }

  createPlayer() {
    this.player = this.physics.add.sprite(512, 420, 'cowcombat-player');
    this.player.setDepth(5);
    this.player.setCollideWorldBounds(true);
    this.player.setDrag(900, 900);
    this.player.setMaxVelocity(320, 320);
    this.player.body.setCircle(18, 14, 14);
  }

  createEnemies() {
    this.enemies = this.physics.add.group();

    for (let index = 0; index < this.enemyCount; index += 1) {
      this.spawnEnemy();
    }
  }

  spawnEnemy(existingEnemy = null) {
    const point = this.getSpawnPoint();
    const enemy = existingEnemy || this.enemies.create(point.x, point.y, 'cowcombat-enemy');

    enemy.enableBody(true, point.x, point.y, true, true);
    enemy.setDepth(5);
    enemy.setCollideWorldBounds(true);
    enemy.setBounce(1, 1);
    enemy.setDrag(500, 500);
    enemy.body.setCircle(18, 14, 14);
    enemy.baseSpeed = Phaser.Math.Between(120, 155) * this.enemySpeedMultiplier;
    enemy.nextChargeAt = this.time.now + Phaser.Math.Between(650, 1500);
    enemy.chargeUntil = 0;
    enemy.respawning = false;
    enemy.clearTint();
    return enemy;
  }

  getSpawnPoint() {
    const margin = 58;
    const edges = [
      {
        x: Phaser.Math.Between(this.arena.x + margin, this.arena.x + this.arena.width - margin),
        y: this.arena.y + margin
      },
      {
        x: Phaser.Math.Between(this.arena.x + margin, this.arena.x + this.arena.width - margin),
        y: this.arena.y + this.arena.height - margin
      },
      {
        x: this.arena.x + margin,
        y: Phaser.Math.Between(this.arena.y + margin, this.arena.y + this.arena.height - margin)
      },
      {
        x: this.arena.x + this.arena.width - margin,
        y: Phaser.Math.Between(this.arena.y + margin, this.arena.y + this.arena.height - margin)
      }
    ];

    let point = Phaser.Utils.Array.GetRandom(edges);

    if (this.player) {
      let attempts = 0;
      while (Phaser.Math.Distance.Between(point.x, point.y, this.player.x, this.player.y) < 200 && attempts < 10) {
        point = Phaser.Utils.Array.GetRandom(edges);
        attempts += 1;
      }
    }

    return point;
  }

  update(time) {
    if (this.isComplete) {
      return;
    }

    this.updatePlayerMovement();
    this.updateEnemies(time);

    if (!this.playerKnockedOut && Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.performAttack(time);
    }
  }

  updatePlayerMovement() {
    if (!this.player || this.playerKnockedOut) {
      return;
    }

    let moveX = 0;
    let moveY = 0;

    if (this.cursors.left.isDown || this.keys.A.isDown) {
      moveX -= 1;
    }
    if (this.cursors.right.isDown || this.keys.D.isDown) {
      moveX += 1;
    }
    if (this.cursors.up.isDown || this.keys.W.isDown) {
      moveY -= 1;
    }
    if (this.cursors.down.isDown || this.keys.S.isDown) {
      moveY += 1;
    }

    const direction = new Phaser.Math.Vector2(moveX, moveY);
    if (direction.lengthSq() > 0) {
      direction.normalize();
      this.facing = direction.clone();
      this.player.setVelocity(direction.x * this.playerSpeed, direction.y * this.playerSpeed);
      this.player.setRotation(direction.angle() + Math.PI / 2);
    } else {
      this.player.setVelocity(0, 0);
    }
  }

  updateEnemies(time) {
    if (!this.player || this.playerKnockedOut) {
      this.enemies.children.iterate((enemy) => {
        if (enemy && enemy.body) {
          enemy.setVelocity(0, 0);
        }
      });
      return;
    }

    this.enemies.children.iterate((enemy) => {
      if (!enemy || !enemy.active || enemy.respawning) {
        return;
      }

      const direction = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y);
      if (direction.lengthSq() === 0) {
        enemy.setVelocity(0, 0);
        return;
      }

      direction.normalize();
      let speed = enemy.baseSpeed;

      if (time >= enemy.nextChargeAt) {
        enemy.chargeUntil = time + 420;
        enemy.nextChargeAt = time + Phaser.Math.Between(1100, 2000);
        this.showBattleText(enemy.x, enemy.y - 36, 'MOO-RUSH!', '#fecaca', 18);
      }

      if (time < enemy.chargeUntil) {
        speed *= 1.85;
        enemy.setTint(0xffb4b4);
      } else {
        enemy.clearTint();
      }

      enemy.setVelocity(direction.x * speed, direction.y * speed);
      enemy.setRotation(direction.angle() + Math.PI / 2);
    });
  }

  performAttack(time) {
    if (!this.player || time < this.attackReadyAt) {
      return;
    }

    this.attackReadyAt = time + this.attackCooldown;
    const direction = this.facing && this.facing.lengthSq() > 0 ? this.facing.clone().normalize() : new Phaser.Math.Vector2(0, -1);
    const attack = this.attacks.create(
      this.player.x + (direction.x * 48),
      this.player.y + (direction.y * 48),
      'cowcombat-charge'
    );

    attack.setDepth(4);
    attack.setScale(1.05);
    attack.setRotation(direction.angle() + Math.PI / 2);
    attack.body.setSize(24, 34);
    attack.setVelocity(direction.x * this.attackSpeed, direction.y * this.attackSpeed);
    attack.expireEvent = this.time.delayedCall(170, () => {
      if (attack && attack.active) {
        attack.destroy();
      }
    });

    this.showBattleText(this.player.x, this.player.y - 48, 'CHARGE!', '#fde68a', 18);
  }

  handleEnemyHit(attack, enemy) {
    if (!attack || !attack.active || !enemy || !enemy.active || enemy.respawning || this.isComplete) {
      return;
    }

    if (attack.expireEvent) {
      attack.expireEvent.remove();
      attack.expireEvent = null;
    }
    attack.destroy();

    enemy.respawning = true;
    enemy.disableBody(true, true);

    this.successfulHits += 1;
    this.mixingProgress = Phaser.Math.Clamp(this.successfulHits * 10, 0, 100);
    this.refreshHud();
    this.cameras.main.shake(100, 0.01);
    this.addImpactBurst(enemy.x, enemy.y, [0xfacc15, 0xfef3c7, 0xfb7185]);
    this.showBattleText(
      enemy.x,
      enemy.y - 54,
      this.successfulHits >= 7 ? 'CHURNING POWER!' : 'MEGA HIT!',
      this.successfulHits >= 7 ? '#f9a8d4' : '#fde68a',
      28
    );

    if (this.mixingProgress >= 100) {
      this.completeMinigame();
      return;
    }

    this.time.delayedCall(650, () => {
      if (!this.isComplete && enemy && enemy.scene) {
        this.spawnEnemy(enemy);
      }
    });
  }

  handlePlayerHit(player, enemy) {
    if (
      !player ||
      !enemy ||
      !enemy.active ||
      enemy.respawning ||
      this.isComplete ||
      this.playerKnockedOut ||
      this.time.now < this.invulnerableUntil
    ) {
      return;
    }

    this.invulnerableUntil = this.time.now + this.damageCooldown;
    this.playerHealth = Phaser.Math.Clamp(this.playerHealth - this.enemyDamage, 0, 100);
    this.refreshHud();
    this.cameras.main.shake(100, 0.01);
    this.addImpactBurst(player.x, player.y, [0xff7b72, 0xffffff, 0xfca5a5]);
    this.showBattleText(player.x, player.y - 58, '-20 HP!', '#fecaca', 24);
    this.statusText.setText(this.playerHealth > 0 ? 'You got rammed! Dodge wide, then counter-charge.' : 'Mixer down! The batter is stuck half-churned.');

    player.setTint(0xffb4b4);
    this.time.delayedCall(150, () => {
      if (player && player.scene) {
        player.clearTint();
      }
    });

    const knockback = new Phaser.Math.Vector2(player.x - enemy.x, player.y - enemy.y).normalize().scale(280);
    if (Number.isFinite(knockback.x) && Number.isFinite(knockback.y)) {
      player.setVelocity(knockback.x, knockback.y);
    }

    if (this.playerHealth <= 0) {
      this.playerKnockedOut = true;
      this.completeMinigame();
    }
  }

  addImpactBurst(x, y, palette) {
    for (let index = 0; index < 10; index += 1) {
      const particle = this.trackObject('effectObjects', this.add.circle(x, y, Phaser.Math.Between(3, 7), Phaser.Utils.Array.GetRandom(palette), 0.95));
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(30, 86);
      const duration = Phaser.Math.Between(220, 420);

      this.tweens.add({
        targets: particle,
        x: x + (Math.cos(angle) * distance),
        y: y + (Math.sin(angle) * distance),
        alpha: 0,
        scale: 0.2,
        duration,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.removeTrackedObject('effectObjects', particle);
          if (particle && particle.scene) {
            particle.destroy();
          }
        }
      });
    }
  }

  showBattleText(x, y, text, color, size = 24) {
    const battleText = this.trackObject('effectObjects', this.add.text(x, y, text, {
      fontFamily: 'Arial',
      fontSize: `${size}px`,
      color,
      fontStyle: 'bold',
      stroke: '#111827',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(9));

    this.tweens.add({
      targets: battleText,
      y: y - 30,
      alpha: 0,
      duration: 650,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.removeTrackedObject('effectObjects', battleText);
        if (battleText && battleText.scene) {
          battleText.destroy();
        }
      }
    });
  }

  refreshHud() {
    if (!this.barsGraphics) {
      return;
    }

    const healthRatio = Phaser.Math.Clamp(this.playerHealth / 100, 0, 1);
    const mixRatio = Phaser.Math.Clamp(this.mixingProgress / 100, 0, 1);

    this.barsGraphics.clear();
    this.barsGraphics.fillStyle(0x0f172a, 0.92);
    this.barsGraphics.fillRoundedRect(100, 86, 180, 20, 10);
    this.barsGraphics.fillRoundedRect(342, 86, 350, 20, 10);

    this.barsGraphics.fillStyle(healthRatio > 0.4 ? 0x22c55e : (healthRatio > 0.2 ? 0xf59e0b : 0xef4444), 1);
    this.barsGraphics.fillRoundedRect(104, 90, Math.max(0, 172 * healthRatio), 12, 6);

    this.barsGraphics.fillStyle(mixRatio >= 1 ? 0xf59e0b : 0xfacc15, 1);
    this.barsGraphics.fillRoundedRect(346, 90, Math.max(0, 342 * mixRatio), 12, 6);

    this.barsGraphics.lineStyle(2, 0x475569, 1);
    this.barsGraphics.strokeRoundedRect(100, 86, 180, 20, 10);
    this.barsGraphics.strokeRoundedRect(342, 86, 350, 20, 10);

    if (this.healthValueText) {
      this.healthValueText.setText(`${this.playerHealth} HP`);
    }
    if (this.mixValueText) {
      this.mixValueText.setText(`${this.mixingProgress}%`);
    }
    if (this.timerText) {
      this.timerText.setText(`${this.timeRemaining}s`);
      this.timerText.setColor(this.timeRemaining <= 10 ? '#f87171' : (this.timeRemaining <= 20 ? '#fbbf24' : '#f8fafc'));
    }
  }

  updateTimer() {
    if (this.isComplete) {
      return;
    }

    this.timeRemaining = Math.max(0, this.timeRemaining - 1);
    this.refreshHud();

    if (this.timeRemaining === 30) {
      this.statusText.setText('Halfway there! Keep smashing cows to churn faster.');
    } else if (this.timeRemaining === 10) {
      this.statusText.setText('Final 10 seconds! This batter needs violence.');
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

    if (!mixEvents.length) {
      return;
    }

    this.chaosIntensity = Phaser.Math.Clamp(mixEvents.reduce((sum, event) => {
      return sum + (typeof event.scorePenalty === 'number' ? event.scorePenalty : 0.08);
    }, 0), 0, 0.45);

    this.enemyCount = 3;
    this.enemySpeedMultiplier = 1 + (this.chaosIntensity * 1.2);
    this.enemies.children.iterate((enemy) => {
      if (enemy) {
        enemy.baseSpeed *= this.enemySpeedMultiplier;
      }
    });

    if (this.enemies.countActive(true) < this.enemyCount) {
      while (this.enemies.countActive(true) < this.enemyCount) {
        this.spawnEnemy();
      }
    }

    if (mixEvents.some((event) => event.key === 'power-out')) {
      this.chaosOverlay = this.trackObject('sceneObjects', this.add.rectangle(512, 412, this.arena.width - 28, this.arena.height - 28, 0x000000, 0.16));
      this.chaosOverlay.setDepth(2);
    }

    mixEvents.forEach((event, index) => {
      const banner = this.trackObject('chaosBanners', this.add.text(512, 130 + (index * 32), `⚠ ${event.name || 'Chaos'} · MIXER MAYHEM`, {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#fecaca',
        fontStyle: 'bold',
        backgroundColor: 'rgba(15,23,42,0.6)',
        padding: { x: 12, y: 4 }
      }).setOrigin(0.5).setDepth(7));

      this.tweens.add({
        targets: banner,
        alpha: 0,
        y: banner.y - 12,
        duration: 700,
        delay: 2000 + (index * 250),
        onComplete: () => {
          this.removeTrackedObject('chaosBanners', banner);
          if (banner && banner.scene) {
            banner.destroy();
          }
        }
      });
    });

    this.statusText.setText('Chaos event active! Extra cattle entered the mixing pit.');
  }

  showRecipeHint() {
    const overlay = this.trackObject('hintObjects', this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.78).setDepth(12));
    const text = this.trackObject('hintObjects', this.add.text(512, 384, [
      '💡 RECIPE HINT 💡',
      '',
      'Bait the enemy charge, sidestep, then SPACE in your facing direction.',
      'Every clean hit churns 10% of the batter.',
      'Ten hits = perfectly mixed cake destiny.'
    ].join('\n'), {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#fde68a',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setDepth(13));

    this.time.delayedCall(4500, () => {
      this.tweens.add({
        targets: [overlay, text],
        alpha: 0,
        duration: 400,
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

    this.playerKnockedOut = this.playerHealth <= 0;

    if (this.player && this.player.body) {
      this.player.setVelocity(0, 0);
    }

    if (this.enemies) {
      this.enemies.children.iterate((enemy) => {
        if (enemy && enemy.body) {
          enemy.setVelocity(0, 0);
        }
      });
    }

    const finalScore = Phaser.Math.Clamp(Math.round(this.mixingProgress), 0, 100);

    if (this.socket) {
      this.socket.emit('baking:phase-complete', {
        teamId: this.teamId,
        phase: 'mix',
        score: finalScore,
        details: {
          hitsLanded: this.successfulHits,
          healthRemaining: this.playerHealth,
          knockedOut: this.playerKnockedOut,
          chaosEvents: this.chaosEvents
            .filter((event) => event && (event.phase === 'mix' || event.phase === 'any' || (Array.isArray(event.phase) && (event.phase.includes('mix') || event.phase.includes('any')))))
            .map((event) => event.key || event.name || 'chaos'),
          timeRemaining: this.timeRemaining
        }
      });
    }

    this.showCompletionScreen(finalScore);
  }

  showCompletionScreen(score) {
    this.clearTrackedObjects('completionObjects');

    const title = score >= 100
      ? 'PERFECT CHURN!'
      : (this.playerKnockedOut ? 'COW-NCUSSION!' : 'MIX TIME OVER!');
    const subtitle = this.playerKnockedOut
      ? 'You got trampled, but the batter keeps whatever mixing progress you earned.'
      : 'Absurd dairy combat complete. Returning to phase select...';

    const overlay = this.trackObject('completionObjects', this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.76).setDepth(15));
    const panel = this.trackObject('completionObjects', this.add.rectangle(512, 384, 620, 360, 0x111827, 0.96).setStrokeStyle(3, 0x475569).setDepth(16));
    overlay.setDepth(15);
    panel.setDepth(16);

    this.trackObject('completionObjects', this.add.text(512, 252, title, {
      fontFamily: 'Arial',
      fontSize: '44px',
      color: '#fde68a',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(17));

    this.trackObject('completionObjects', this.add.text(512, 314, `Score: ${score}/100`, {
      fontFamily: 'Arial',
      fontSize: '40px',
      color: '#86efac',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(17));

    this.trackObject('completionObjects', this.add.text(512, 374, `Hits landed: ${this.successfulHits}   •   Health left: ${this.playerHealth}`, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#e5e7eb',
      align: 'center'
    }).setOrigin(0.5).setDepth(17));

    this.trackObject('completionObjects', this.add.text(512, 422, subtitle, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#cbd5e1',
      align: 'center',
      wordWrap: { width: 520 }
    }).setOrigin(0.5).setDepth(17));

    this.trackObject('completionObjects', this.add.text(512, 492, 'Returning to phase select...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#93c5fd',
      fontStyle: 'italic'
    }).setOrigin(0.5).setDepth(17));

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

    if (this.attacks) {
      this.attacks.clear(true, true);
      this.attacks.destroy(true);
      this.attacks = null;
    }

    if (this.enemies) {
      this.enemies.clear(true, true);
      this.enemies.destroy(true);
      this.enemies = null;
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
    this.keys = null;
    this.barsGraphics = null;
    this.timerText = null;
    this.statusText = null;
    this.healthValueText = null;
    this.mixValueText = null;
    this.chaosOverlay = null;
  }
}

window.CowCombatScene = CowCombatScene;
