class JewelSortScene extends Phaser.Scene {
  constructor() {
    super({ key: 'JewelSortScene' });

    this.socket = null;
    this.teamId = null;
    this.inventory = [];
    this.boosts = {};
    this.chaosEvents = [];
    this.activeChaosEvents = [];

    this.timeRemaining = 45;
    this.totalCorrectPlacements = 0;
    this.totalSlots = 0;
    this.currentRoundIndex = 0;
    this.currentRound = null;
    this.rounds = [];
    this.isComplete = false;
    this.transitionActive = false;
    this.chaosIntensity = 0;

    this.timerEvent = null;
    this.spawnEvent = null;
    this.roundTransitionEvent = null;
    this.completionEvent = null;

    this.persistentObjects = [];
    this.slotObjects = [];
    this.effectObjects = [];
    this.hintObjects = [];
    this.transitionObjects = [];
    this.completionObjects = [];
    this.chaosBanners = [];

    this.currentSlots = [];
    this.activeJewels = [];
    this.spawnQueue = [];
    this.traySpots = [];

    this.boardArea = { x: 152, y: 134, width: 600, height: 392 };
    this.trayArea = { x: 152, y: 556, width: 600, height: 142 };
    this.thermometerArea = { x: 842, y: 178, width: 88, height: 380 };

    this.timerText = null;
    this.roundText = null;
    this.scoreText = null;
    this.patternText = null;
    this.statusText = null;
    this.coolingText = null;
    this.meterGraphics = null;
    this.legendTitle = null;
    this.legendObjects = [];

    this.colorDefs = {
      ruby: { label: 'Ruby', fill: 0xf87171, edge: 0x7f1d1d, glow: 0xfecaca },
      sapphire: { label: 'Sapphire', fill: 0x60a5fa, edge: 0x1d4ed8, glow: 0xbfdbfe },
      emerald: { label: 'Emerald', fill: 0x4ade80, edge: 0x166534, glow: 0xbbf7d0 },
      amethyst: { label: 'Amethyst', fill: 0xc084fc, edge: 0x6b21a8, glow: 0xe9d5ff },
      amber: { label: 'Amber', fill: 0xfbbf24, edge: 0x92400e, glow: 0xfef3c7 }
    };
  }

  init(data = {}) {
    this.socket = data.socket || null;
    this.teamId = data.teamId || null;
    this.inventory = data.inventory || [];
    this.boosts = data.boosts || {};
    this.chaosEvents = data.chaosEvents || [];
    this.timeRemaining = 45;

    this.activeChaosEvents = [];
    this.totalCorrectPlacements = 0;
    this.currentRoundIndex = 0;
    this.currentRound = null;
    this.rounds = this.buildRounds();
    this.totalSlots = this.rounds.reduce((sum, round) => sum + round.totalSlots, 0);
    this.isComplete = false;
    this.transitionActive = false;
    this.chaosIntensity = 0;

    this.timerEvent = null;
    this.spawnEvent = null;
    this.roundTransitionEvent = null;
    this.completionEvent = null;

    this.persistentObjects = [];
    this.slotObjects = [];
    this.effectObjects = [];
    this.hintObjects = [];
    this.transitionObjects = [];
    this.completionObjects = [];
    this.chaosBanners = [];

    this.currentSlots = [];
    this.activeJewels = [];
    this.spawnQueue = [];
    this.traySpots = [];
    this.legendObjects = [];
  }

  create() {
    this.cameras.main.setBackgroundColor('#08111b');
    this.createTextures();
    this.createBackground();
    this.createHud();
    this.createTraySpots();
    this.createInputHandlers();
    this.applyChaosEvents();
    this.startRound(0);

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true
    });

    if (this.boosts['recipe-hint'] || this.boosts.hint > 0) {
      this.showRecipeHint();
    }

    this.updateTimerText();
    this.updateScoreText();
    this.updateCoolingMeter();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  update(time, delta) {
    if (this.isComplete || this.transitionActive) {
      return;
    }

    const deltaSeconds = delta / 1000;
    const minX = this.boardArea.x + 36;
    const maxX = this.boardArea.x + this.boardArea.width - 36;
    const trayTop = this.trayArea.y + 26;

    this.activeJewels.forEach((jewel) => {
      if (!jewel || !jewel.scene || jewel.getData('placed') || jewel.getData('dragging')) {
        return;
      }

      if (jewel.getData('state') === 'falling') {
        let nextX = jewel.x + (jewel.getData('drift') * deltaSeconds);
        let nextY = jewel.y + (jewel.getData('fallSpeed') * deltaSeconds);

        if (nextX <= minX || nextX >= maxX) {
          jewel.setData('drift', jewel.getData('drift') * -1);
          nextX = Phaser.Math.Clamp(nextX, minX, maxX);
        }

        jewel.x = nextX;
        jewel.y = nextY;
        jewel.rotation += jewel.getData('spin') * deltaSeconds;

        if (jewel.y >= trayTop) {
          this.settleJewelInTray(jewel);
        }
      } else if (jewel.getData('state') === 'waiting') {
        jewel.rotation = Phaser.Math.Linear(jewel.rotation, 0, 0.12);
      }
    });
  }

  buildRounds() {
    return [
      {
        label: 'ROUND 1',
        subtitle: 'Two-color checker cool-down',
        rows: 3,
        cols: 3,
        cellSize: 92,
        colors: ['ruby', 'sapphire'],
        spawnDelay: 520,
        fallSpeed: 300,
        patternResolver: (row, col, palette) => palette[(row + col) % palette.length],
        correctPlaced: 0
      },
      {
        label: 'ROUND 2',
        subtitle: 'Three-color crossflow lattice',
        rows: 4,
        cols: 4,
        cellSize: 78,
        colors: ['ruby', 'sapphire', 'emerald'],
        spawnDelay: 470,
        fallSpeed: 345,
        patternResolver: (row, col, palette) => palette[((row * 2) + col) % palette.length],
        correctPlaced: 0
      },
      {
        label: 'ROUND 3',
        subtitle: 'Four-color panic spiral',
        rows: 4,
        cols: 5,
        cellSize: 70,
        colors: ['ruby', 'sapphire', 'emerald', 'amethyst'],
        spawnDelay: 430,
        fallSpeed: 390,
        patternResolver: (row, col, palette) => palette[((row * 3) + (col * 2)) % palette.length],
        correctPlaced: 0
      }
    ].map((round) => ({
      ...round,
      totalSlots: round.rows * round.cols,
      slotColors: []
    }));
  }

  createTextures() {
    Object.entries(this.colorDefs).forEach(([key, color]) => {
      const textureKey = `jewel-sort-${key}`;
      if (this.textures.exists(textureKey)) {
        return;
      }

      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      graphics.fillStyle(color.glow, 0.35);
      graphics.fillCircle(32, 32, 24);
      graphics.fillStyle(color.fill, 1);
      graphics.fillPoints([
        new Phaser.Geom.Point(32, 4),
        new Phaser.Geom.Point(54, 18),
        new Phaser.Geom.Point(46, 46),
        new Phaser.Geom.Point(32, 60),
        new Phaser.Geom.Point(18, 46),
        new Phaser.Geom.Point(10, 18)
      ], true);
      graphics.fillStyle(0xffffff, 0.55);
      graphics.fillTriangle(32, 8, 20, 20, 44, 20);
      graphics.lineStyle(4, color.edge, 1);
      graphics.strokePoints([
        new Phaser.Geom.Point(32, 4),
        new Phaser.Geom.Point(54, 18),
        new Phaser.Geom.Point(46, 46),
        new Phaser.Geom.Point(32, 60),
        new Phaser.Geom.Point(18, 46),
        new Phaser.Geom.Point(10, 18)
      ], true);
      graphics.generateTexture(textureKey, 64, 64);
      graphics.destroy();
    });
  }

  createBackground() {
    const backdrop = this.trackObject('persistentObjects', this.add.graphics());
    backdrop.fillGradientStyle(0x06111a, 0x0b1623, 0x11263b, 0x07111b, 1);
    backdrop.fillRect(0, 0, 1024, 768);

    for (let index = 0; index < 20; index += 1) {
      const spark = this.trackObject('persistentObjects', this.add.circle(
        Phaser.Math.Between(24, 1000),
        Phaser.Math.Between(80, 720),
        Phaser.Math.Between(2, 5),
        0x7dd3fc,
        0.1
      ));
      this.tweens.add({
        targets: spark,
        alpha: { from: 0.06, to: 0.24 },
        y: spark.y - Phaser.Math.Between(12, 44),
        duration: Phaser.Math.Between(1800, 3600),
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 1200)
      });
    }

    const boardPanel = this.trackObject('persistentObjects', this.add.rectangle(
      this.boardArea.x + (this.boardArea.width / 2),
      this.boardArea.y + (this.boardArea.height / 2),
      this.boardArea.width,
      this.boardArea.height,
      0x0f1c2d,
      0.95
    ));
    boardPanel.setStrokeStyle(4, 0x334155, 1);

    const trayPanel = this.trackObject('persistentObjects', this.add.rectangle(
      this.trayArea.x + (this.trayArea.width / 2),
      this.trayArea.y + (this.trayArea.height / 2),
      this.trayArea.width,
      this.trayArea.height,
      0x111827,
      0.94
    ));
    trayPanel.setStrokeStyle(3, 0x475569, 1);

    const meterPanel = this.trackObject('persistentObjects', this.add.rectangle(886, 372, 214, 470, 0x111827, 0.95));
    meterPanel.setStrokeStyle(3, 0x334155, 1);

    this.trackObject('persistentObjects', this.add.text(450, 28, '💎 JEWEL SORT · ABSURD COOLING RACK', {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0));

    this.trackObject('persistentObjects', this.add.text(450, 74, 'Drag each falling jewel into the slot with the matching color before the rack cools unevenly.', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#cbd5e1',
      align: 'center',
      wordWrap: { width: 640 }
    }).setOrigin(0.5, 0));

    this.trackObject('persistentObjects', this.add.text(450, 536, 'EMERGENCY COOLING BIN', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#93c5fd',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0));
  }

  createHud() {
    this.roundText = this.trackObject('persistentObjects', this.add.text(178, 112, 'ROUND 1', {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }));

    this.patternText = this.trackObject('persistentObjects', this.add.text(178, 144, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#cbd5e1'
    }));

    this.scoreText = this.trackObject('persistentObjects', this.add.text(178, 188, '', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#86efac',
      fontStyle: 'bold'
    }));

    this.timerText = this.trackObject('persistentObjects', this.add.text(950, 60, '45s', {
      fontFamily: 'Arial',
      fontSize: '38px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(1, 0));

    this.statusText = this.trackObject('persistentObjects', this.add.text(452, 719, 'Catch the falling jewels and match their colors to the cooling rack slots.', {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#f8fafc',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 850 }
    }).setOrigin(0.5));

    this.trackObject('persistentObjects', this.add.text(886, 126, 'COOLING METER', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0));

    this.coolingText = this.trackObject('persistentObjects', this.add.text(886, 580, '', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#7dd3fc',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5, 0));

    this.legendTitle = this.trackObject('persistentObjects', this.add.text(886, 636, 'CURRENT PALETTE', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#cbd5e1',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0));

    this.meterGraphics = this.trackObject('persistentObjects', this.add.graphics());
  }

  createTraySpots() {
    this.traySpots = [];
    const columns = 10;
    const rows = 2;
    const startX = this.trayArea.x + 42;
    const startY = this.trayArea.y + 54;
    const stepX = 57;
    const stepY = 48;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const x = startX + (col * stepX);
        const y = startY + (row * stepY);
        this.traySpots.push({ x, y, jewel: null });
        this.trackObject('persistentObjects', this.add.circle(x, y, 19, 0x1e293b, 0.65).setStrokeStyle(2, 0x334155, 0.9));
      }
    }
  }

  createInputHandlers() {
    this.input.on('dragstart', this.handleDragStart, this);
    this.input.on('drag', this.handleDrag, this);
    this.input.on('dragend', this.handleDragEnd, this);
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

  startRound(index) {
    this.clearRoundState();
    this.transitionActive = false;
    this.currentRoundIndex = index;
    this.currentRound = this.rounds[index];

    if (!this.currentRound) {
      this.completeMinigame();
      return;
    }

    this.currentRound.correctPlaced = this.currentRound.correctPlaced || 0;
    this.currentRound.slotColors = this.buildPattern(this.currentRound);

    this.roundText.setText(`${this.currentRound.label} · ${this.currentRound.rows}×${this.currentRound.cols}`);
    this.patternText.setText(`${this.currentRound.subtitle} · Match ${this.currentRound.colors.length} jewel colors.`);
    this.statusText.setText(`Stabilize ${this.currentRound.totalSlots} slots before the rack goes lopsided.`);

    this.createRoundBoard(this.currentRound);
    this.createLegend(this.currentRound.colors);
    this.spawnQueue = Phaser.Utils.Array.Shuffle([...this.currentRound.slotColors]);

    this.spawnNextJewel();
    this.spawnEvent = this.time.addEvent({
      delay: this.getSpawnDelay(this.currentRound),
      callback: this.spawnNextJewel,
      callbackScope: this,
      loop: true
    });

    this.updateScoreText();
    this.updateCoolingMeter();
  }

  clearRoundState() {
    if (this.spawnEvent) {
      this.spawnEvent.remove();
      this.spawnEvent = null;
    }

    this.releaseAllTraySpots();
    this.destroyActiveJewels();
    this.clearTrackedObjects('slotObjects');
    this.clearTrackedObjects('effectObjects');
    this.clearTrackedObjects('transitionObjects');
    this.currentSlots = [];
    this.spawnQueue = [];
  }

  releaseAllTraySpots() {
    this.traySpots.forEach((spot) => {
      spot.jewel = null;
    });
  }

  destroyActiveJewels() {
    this.activeJewels.forEach((jewel) => {
      if (jewel && jewel.scene) {
        jewel.destroy();
      }
    });
    this.activeJewels = [];
  }

  buildPattern(round) {
    const pattern = [];
    for (let row = 0; row < round.rows; row += 1) {
      for (let col = 0; col < round.cols; col += 1) {
        pattern.push(round.patternResolver(row, col, round.colors));
      }
    }
    return pattern;
  }

  createRoundBoard(round) {
    const boardCenterX = this.boardArea.x + (this.boardArea.width / 2);
    const boardCenterY = this.boardArea.y + (this.boardArea.height / 2) + 20;
    const totalWidth = round.cols * round.cellSize;
    const totalHeight = round.rows * round.cellSize;
    const startX = boardCenterX - (totalWidth / 2) + (round.cellSize / 2);
    const startY = boardCenterY - (totalHeight / 2) + (round.cellSize / 2);

    const backing = this.trackObject('slotObjects', this.add.rectangle(boardCenterX, boardCenterY, totalWidth + 46, totalHeight + 46, 0x0b1220, 0.88));
    backing.setStrokeStyle(3, 0x1d4ed8, 0.6);

    this.currentSlots = [];

    for (let row = 0; row < round.rows; row += 1) {
      for (let col = 0; col < round.cols; col += 1) {
        const colorKey = round.patternResolver(row, col, round.colors);
        const colorDef = this.colorDefs[colorKey];
        const x = startX + (col * round.cellSize);
        const y = startY + (row * round.cellSize);
        const slotSize = round.cellSize - 12;

        const outer = this.trackObject('slotObjects', this.add.rectangle(x, y, slotSize, slotSize, colorDef.fill, 0.12));
        outer.setStrokeStyle(4, colorDef.edge, 0.95);

        const inner = this.trackObject('slotObjects', this.add.rectangle(x, y, slotSize - 14, slotSize - 14, 0xf8fafc, 0.05));
        inner.setStrokeStyle(2, colorDef.glow, 0.18);

        const icon = this.trackObject('slotObjects', this.add.image(x, y, `jewel-sort-${colorKey}`).setScale(0.42).setAlpha(0.3));

        this.currentSlots.push({
          row,
          col,
          x,
          y,
          size: slotSize,
          colorKey,
          filled: false,
          outer,
          inner,
          icon,
          jewel: null
        });
      }
    }
  }

  createLegend(colors) {
    this.legendObjects.forEach((object) => {
      if (object && object.scene) {
        object.destroy();
      }
    });
    this.legendObjects = [];

    const startY = 670;
    colors.forEach((colorKey, index) => {
      const colorDef = this.colorDefs[colorKey];
      const y = startY + (index * 24);
      this.legendObjects.push(this.add.circle(826, y + 9, 8, colorDef.fill, 1).setStrokeStyle(2, colorDef.edge, 1));
      this.legendObjects.push(this.add.text(842, y, colorDef.label, {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: '#e2e8f0'
      }));
    });
  }

  getSpawnDelay(round) {
    const chaosModifier = 1 - (this.chaosIntensity * 0.18);
    return Math.max(280, Math.round(round.spawnDelay * chaosModifier));
  }

  getFallSpeed(round) {
    return round.fallSpeed + (this.chaosIntensity * 120);
  }

  spawnNextJewel() {
    if (this.isComplete || this.transitionActive || !this.currentRound) {
      return;
    }

    if (!this.spawnQueue.length) {
      if (this.spawnEvent) {
        this.spawnEvent.remove();
        this.spawnEvent = null;
      }
      return;
    }

    const colorKey = this.spawnQueue.shift();
    const textureKey = `jewel-sort-${colorKey}`;
    const spawnX = Phaser.Math.Between(this.boardArea.x + 50, this.boardArea.x + this.boardArea.width - 50);
    const drift = Phaser.Math.Between(-80, 80) * (1 + (this.chaosIntensity * 0.8));
    const jewel = this.add.image(spawnX, -54, textureKey);

    jewel.setDepth(8);
    jewel.setScale(0.9);
    jewel.setInteractive({ cursor: 'grab', draggable: true });
    this.input.setDraggable(jewel);

    jewel.setData('colorKey', colorKey);
    jewel.setData('dragging', false);
    jewel.setData('placed', false);
    jewel.setData('state', 'falling');
    jewel.setData('drift', drift);
    jewel.setData('fallSpeed', this.getFallSpeed(this.currentRound) + Phaser.Math.Between(-24, 24));
    jewel.setData('spin', Phaser.Math.FloatBetween(-0.8, 0.8));
    jewel.setData('traySpotIndex', null);
    jewel.setData('returnX', spawnX);
    jewel.setData('returnY', this.trayArea.y + 28);

    this.activeJewels.push(jewel);
  }

  handleDragStart(pointer, jewel) {
    if (this.isComplete || this.transitionActive || !jewel || jewel.getData('placed')) {
      return;
    }

    jewel.setData('dragging', true);
    jewel.setData('state', 'dragging');
    jewel.setDepth(18);
    jewel.setScale(1.02);
    this.input.setDefaultCursor('grabbing');
    this.refreshSlotHighlights(jewel.getData('colorKey'));
  }

  handleDrag(pointer, jewel, dragX, dragY) {
    if (this.isComplete || this.transitionActive || !jewel || jewel.getData('placed')) {
      return;
    }

    jewel.x = Phaser.Math.Clamp(dragX, 64, 960);
    jewel.y = Phaser.Math.Clamp(dragY, 86, 690);
    jewel.rotation = 0;

    const hoveredSlot = this.findNearestSlot(jewel.x, jewel.y, jewel.displayWidth * 0.85);
    this.refreshSlotHighlights(jewel.getData('colorKey'), hoveredSlot);
  }

  handleDragEnd(pointer, jewel) {
    if (!jewel || jewel.getData('placed')) {
      return;
    }

    jewel.setData('dragging', false);
    this.input.setDefaultCursor('default');

    const dropSlot = this.findNearestSlot(jewel.x, jewel.y, jewel.displayWidth * 0.85);
    this.refreshSlotHighlights();

    if (dropSlot && !dropSlot.filled && dropSlot.colorKey === jewel.getData('colorKey')) {
      this.placeJewelInSlot(jewel, dropSlot);
      return;
    }

    this.rejectJewelPlacement(jewel, dropSlot);
  }

  findNearestSlot(x, y, maxDistance) {
    let nearest = null;
    let nearestDistance = maxDistance;

    this.currentSlots.forEach((slot) => {
      if (!slot || slot.filled) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(x, y, slot.x, slot.y);
      if (distance <= nearestDistance) {
        nearest = slot;
        nearestDistance = distance;
      }
    });

    return nearest;
  }

  refreshSlotHighlights(activeColor = null, hoveredSlot = null) {
    this.currentSlots.forEach((slot) => {
      const colorDef = this.colorDefs[slot.colorKey];

      if (slot.filled) {
        slot.outer.setFillStyle(colorDef.fill, 0.2);
        slot.outer.setStrokeStyle(4, colorDef.edge, 1);
        slot.inner.setStrokeStyle(2, colorDef.glow, 0.28);
        slot.icon.setAlpha(0.2);
        return;
      }

      let fillAlpha = 0.12;
      let strokeWidth = 4;
      let strokeColor = colorDef.edge;
      let strokeAlpha = 0.95;
      let iconAlpha = 0.3;

      if (activeColor) {
        if (slot.colorKey === activeColor) {
          fillAlpha = 0.22;
          strokeWidth = 5;
          strokeColor = colorDef.glow;
          iconAlpha = 0.42;
        } else {
          fillAlpha = 0.07;
          strokeAlpha = 0.35;
          iconAlpha = 0.18;
        }
      }

      if (hoveredSlot === slot) {
        if (slot.colorKey === activeColor) {
          fillAlpha = 0.3;
          strokeWidth = 6;
          strokeColor = 0xfef08a;
          iconAlpha = 0.5;
        } else {
          fillAlpha = 0.18;
          strokeWidth = 6;
          strokeColor = 0xf87171;
          iconAlpha = 0.28;
        }
      }

      slot.outer.setFillStyle(colorDef.fill, fillAlpha);
      slot.outer.setStrokeStyle(strokeWidth, strokeColor, strokeAlpha);
      slot.inner.setStrokeStyle(2, colorDef.glow, iconAlpha * 0.6);
      slot.icon.setAlpha(iconAlpha);
    });
  }

  rejectJewelPlacement(jewel, dropSlot) {
    if (dropSlot) {
      const flashColor = dropSlot.colorKey === jewel.getData('colorKey') ? 0xfef08a : 0xf87171;
      dropSlot.outer.setStrokeStyle(6, flashColor, 1);
      this.time.delayedCall(120, () => this.refreshSlotHighlights());
    }

    this.settleJewelInTray(jewel, true);
    this.showFloatingText(jewel.x, jewel.y - 22, dropSlot ? 'WRONG SLOT' : 'COOLER BIN!', '#fca5a5', 16);
  }

  settleJewelInTray(jewel, animate = true) {
    if (!jewel || !jewel.scene || jewel.getData('placed')) {
      return;
    }

    const spot = this.reserveTraySpot(jewel);
    if (!spot) {
      return;
    }

    jewel.setData('state', 'waiting');
    jewel.setData('dragging', false);
    jewel.setData('returnX', spot.x);
    jewel.setData('returnY', spot.y);
    jewel.setData('spin', 0);

    if (animate) {
      this.tweens.add({
        targets: jewel,
        x: spot.x,
        y: spot.y,
        scale: 0.82,
        rotation: 0,
        duration: 240,
        ease: 'Back.easeOut'
      });
    } else {
      jewel.setPosition(spot.x, spot.y);
      jewel.setScale(0.82);
      jewel.setRotation(0);
    }
  }

  reserveTraySpot(jewel) {
    const existingIndex = jewel.getData('traySpotIndex');
    if (existingIndex !== null && this.traySpots[existingIndex]) {
      this.traySpots[existingIndex].jewel = jewel;
      return this.traySpots[existingIndex];
    }

    const openIndex = this.traySpots.findIndex((spot) => !spot.jewel || spot.jewel === jewel);
    if (openIndex === -1) {
      return null;
    }

    this.traySpots[openIndex].jewel = jewel;
    jewel.setData('traySpotIndex', openIndex);
    return this.traySpots[openIndex];
  }

  releaseTraySpot(jewel) {
    if (!jewel) {
      return;
    }

    const traySpotIndex = jewel.getData('traySpotIndex');
    if (traySpotIndex !== null && this.traySpots[traySpotIndex]) {
      this.traySpots[traySpotIndex].jewel = null;
    }

    jewel.setData('traySpotIndex', null);
  }

  placeJewelInSlot(jewel, slot) {
    if (this.isComplete || !jewel || !slot || slot.filled) {
      return;
    }

    slot.filled = true;
    slot.jewel = jewel;
    this.releaseTraySpot(jewel);

    jewel.disableInteractive();
    jewel.setData('placed', true);
    jewel.setData('state', 'placed');
    jewel.setData('dragging', false);

    this.tweens.add({
      targets: jewel,
      x: slot.x,
      y: slot.y,
      scale: Math.min(0.86, (slot.size - 10) / 72),
      rotation: 0,
      duration: 180,
      ease: 'Sine.easeOut'
    });

    const colorDef = this.colorDefs[slot.colorKey];
    slot.outer.setFillStyle(colorDef.fill, 0.26);
    slot.outer.setStrokeStyle(5, colorDef.glow, 1);
    slot.inner.setStrokeStyle(2, colorDef.glow, 0.4);
    slot.icon.setAlpha(0.12);

    this.totalCorrectPlacements += 1;
    this.currentRound.correctPlaced += 1;

    this.showPlacementBurst(slot.x, slot.y, colorDef.fill);
    this.showFloatingText(slot.x, slot.y - 34, 'STABLE!', '#bbf7d0', 18);
    this.statusText.setText(`${this.currentRound.label}: ${this.currentRound.correctPlaced}/${this.currentRound.totalSlots} slots stabilized.`);
    this.updateScoreText();
    this.updateCoolingMeter();

    if (this.currentRound.correctPlaced >= this.currentRound.totalSlots) {
      this.handleRoundComplete();
    }
  }

  showPlacementBurst(x, y, color) {
    for (let index = 0; index < 6; index += 1) {
      const spark = this.trackObject('effectObjects', this.add.circle(x, y, Phaser.Math.Between(3, 5), color, 0.9));
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(18, 40);
      this.tweens.add({
        targets: spark,
        x: x + (Math.cos(angle) * distance),
        y: y + (Math.sin(angle) * distance),
        alpha: 0,
        scale: 0.2,
        duration: 360,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.removeTrackedObject('effectObjects', spark);
          if (spark && spark.scene) {
            spark.destroy();
          }
        }
      });
    }
  }

  showFloatingText(x, y, text, color, size = 18) {
    const label = this.trackObject('effectObjects', this.add.text(x, y, text, {
      fontFamily: 'Arial',
      fontSize: `${size}px`,
      color,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(20));

    this.tweens.add({
      targets: label,
      y: y - 22,
      alpha: 0,
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.removeTrackedObject('effectObjects', label);
        if (label && label.scene) {
          label.destroy();
        }
      }
    });
  }

  handleRoundComplete() {
    if (this.isComplete || !this.currentRound) {
      return;
    }

    if (this.spawnEvent) {
      this.spawnEvent.remove();
      this.spawnEvent = null;
    }

    this.transitionActive = true;
    const roundsFinished = this.currentRoundIndex + 1;

    const overlay = this.trackObject('transitionObjects', this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.55));
    overlay.setDepth(22);

    const panel = this.trackObject('transitionObjects', this.add.rectangle(512, 384, 540, 250, 0x111827, 0.94));
    panel.setStrokeStyle(3, 0x60a5fa, 0.9);
    panel.setDepth(23);

    this.trackObject('transitionObjects', this.add.text(512, 324, `${this.currentRound.label} STABILIZED!`, {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#7dd3fc',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(24));

    this.trackObject('transitionObjects', this.add.text(512, 374, `Cooling progress: ${this.totalCorrectPlacements}/${this.totalSlots} slots locked in`, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#f8fafc',
      align: 'center'
    }).setOrigin(0.5).setDepth(24));

    this.trackObject('transitionObjects', this.add.text(512, 424, roundsFinished >= this.rounds.length
      ? 'All rounds complete. Proper cooling imminent...'
      : 'Rack pattern intensifying for the next round...', {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#cbd5e1',
      align: 'center'
    }).setOrigin(0.5).setDepth(24));

    this.roundTransitionEvent = this.time.delayedCall(2000, () => {
      this.roundTransitionEvent = null;
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

    this.timeRemaining = Math.max(0, this.timeRemaining - 1);
    this.updateTimerText();

    if (this.timeRemaining === 10) {
      this.statusText.setText('Final 10 seconds! The jewels are cooking the cooling rack alive.');
    }

    if (this.timeRemaining <= 0) {
      this.completeMinigame();
    }
  }

  updateTimerText() {
    if (!this.timerText) {
      return;
    }

    this.timerText.setText(`${this.timeRemaining}s`);
    if (this.timeRemaining <= 10) {
      this.timerText.setColor('#f87171');
    } else if (this.timeRemaining <= 20) {
      this.timerText.setColor('#fbbf24');
    } else {
      this.timerText.setColor('#f8fafc');
    }
  }

  updateScoreText() {
    if (!this.scoreText) {
      return;
    }

    const score = Math.round((this.totalCorrectPlacements / this.totalSlots) * 100);
    this.scoreText.setText(`Correct slots: ${this.totalCorrectPlacements}/${this.totalSlots} · Score ${score}`);
  }

  updateCoolingMeter() {
    if (!this.meterGraphics) {
      return;
    }

    const progress = Phaser.Math.Clamp(this.totalCorrectPlacements / this.totalSlots, 0, 1);
    const x = this.thermometerArea.x;
    const y = this.thermometerArea.y;
    const width = this.thermometerArea.width;
    const height = this.thermometerArea.height;
    const fillHeight = (height - 30) * progress;
    const fillY = y + height - 18 - fillHeight;
    const fillColor = progress < 0.34 ? 0xf87171 : (progress < 0.68 ? 0xfbbf24 : 0x4ade80);

    this.meterGraphics.clear();
    this.meterGraphics.fillStyle(0x0b1220, 0.98);
    this.meterGraphics.fillRoundedRect(x, y, width, height, 34);
    this.meterGraphics.lineStyle(4, 0x64748b, 1);
    this.meterGraphics.strokeRoundedRect(x, y, width, height, 34);
    this.meterGraphics.fillStyle(0x1e293b, 0.9);
    this.meterGraphics.fillRoundedRect(x + 22, y + 18, width - 44, height - 36, 20);
    this.meterGraphics.fillStyle(fillColor, 0.95);
    this.meterGraphics.fillRoundedRect(x + 28, fillY, width - 56, fillHeight, 16);
    this.meterGraphics.fillStyle(fillColor, 1);
    this.meterGraphics.fillCircle(x + (width / 2), y + height + 26, 34);
    this.meterGraphics.lineStyle(6, 0x64748b, 1);
    this.meterGraphics.strokeCircle(x + (width / 2), y + height + 26, 34);

    const score = Math.round(progress * 100);
    this.coolingText.setText([`${score}%`, `${this.totalCorrectPlacements}/${this.totalSlots} slots`].join('\n'));
  }

  applyChaosEvents() {
    this.activeChaosEvents = this.chaosEvents.filter((event) => {
      if (!event || !event.phase) {
        return false;
      }

      if (Array.isArray(event.phase)) {
        return event.phase.includes('cool') || event.phase.includes('any');
      }

      return event.phase === 'cool' || event.phase === 'any' || event.phase.includes('cool') || event.phase.includes('any');
    });

    if (!this.activeChaosEvents.length) {
      return;
    }

    this.chaosIntensity = Phaser.Math.Clamp(this.activeChaosEvents.reduce((sum, event) => {
      return sum + (typeof event.scorePenalty === 'number' ? event.scorePenalty : 0.08);
    }, 0), 0, 0.45);

    const overlay = this.trackObject('persistentObjects', this.add.rectangle(452, 343, 600, 392, 0x2f0f1d, 0.08 + (this.chaosIntensity * 0.12)));
    overlay.setDepth(1);

    this.activeChaosEvents.forEach((event, index) => {
      const banner = this.trackObject('chaosBanners', this.add.text(452, 212 + (index * 34), `⚠ ${event.name || 'Chaos'} · COOLING RACK INSTABILITY`, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#fecaca',
        fontStyle: 'bold',
        backgroundColor: 'rgba(15, 23, 42, 0.58)',
        padding: { x: 12, y: 4 }
      }).setOrigin(0.5).setDepth(10));

      this.tweens.add({
        targets: banner,
        alpha: 0,
        y: banner.y - 14,
        duration: 700,
        delay: 2200 + (index * 260),
        onComplete: () => {
          this.removeTrackedObject('chaosBanners', banner);
          if (banner && banner.scene) {
            banner.destroy();
          }
        }
      });
    });

    this.statusText.setText('Chaos event active! Jewels fall faster and drift harder.');
  }

  showRecipeHint() {
    const overlay = this.trackObject('hintObjects', this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.72));
    overlay.setDepth(30);

    const text = this.trackObject('hintObjects', this.add.text(512, 384, [
      '💡 RECIPE HINT 💡',
      '',
      'Grab matching jewels early, then use the cooling bin as your parking lot.',
      'Slots only accept the exact color shown by the border.',
      'Later rounds add colors, so memorize the pattern before panic starts.'
    ].join('\n'), {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: '#f8fafc',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 760 }
    }).setOrigin(0.5).setDepth(31));

    this.time.delayedCall(4500, () => {
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
    this.transitionActive = false;

    if (this.timerEvent) {
      this.timerEvent.remove();
      this.timerEvent = null;
    }

    if (this.spawnEvent) {
      this.spawnEvent.remove();
      this.spawnEvent = null;
    }

    if (this.roundTransitionEvent) {
      this.roundTransitionEvent.remove();
      this.roundTransitionEvent = null;
    }

    this.activeJewels.forEach((jewel) => {
      if (jewel && jewel.scene && jewel.input) {
        jewel.disableInteractive();
      }
    });

    const finalScore = Math.round((this.totalCorrectPlacements / this.totalSlots) * 100);

    if (this.socket) {
      this.socket.emit('baking:phase-complete', {
        teamId: this.teamId,
        phase: 'cool',
        score: finalScore,
        details: {
          correctPlacements: this.totalCorrectPlacements,
          totalSlots: this.totalSlots,
          timeRemaining: this.timeRemaining,
          chaosEvents: this.activeChaosEvents.map((event) => event.key || event.name || 'chaos'),
          rounds: this.rounds.map((round) => ({
            label: round.label,
            rows: round.rows,
            cols: round.cols,
            correctPlacements: round.correctPlaced,
            totalSlots: round.totalSlots,
            colors: [...round.colors]
          }))
        }
      });
    }

    this.showCompletionScreen(finalScore);
  }

  showCompletionScreen(score) {
    this.clearTrackedObjects('completionObjects');

    const perfectCooling = this.totalCorrectPlacements === this.totalSlots;
    const title = perfectCooling ? 'PROPER COOLING ACHIEVED!' : 'UNEVEN COOLING DETECTED!';
    const subtitle = perfectCooling
      ? 'Every slot stabilized. The cake cools with absurd precision.'
      : 'Some heat pockets survived. The rack cools unevenly, but the score still counts.';

    const overlay = this.trackObject('completionObjects', this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.78));
    overlay.setDepth(40);

    const panel = this.trackObject('completionObjects', this.add.rectangle(512, 384, 650, 360, 0x111827, 0.96));
    panel.setStrokeStyle(3, perfectCooling ? 0x4ade80 : 0xf87171, 1);
    panel.setDepth(41);

    this.trackObject('completionObjects', this.add.text(512, 248, title, {
      fontFamily: 'Arial',
      fontSize: '38px',
      color: perfectCooling ? '#86efac' : '#fca5a5',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setDepth(42));

    this.trackObject('completionObjects', this.add.text(512, 312, `Score: ${score}/100`, {
      fontFamily: 'Arial',
      fontSize: '40px',
      color: '#7dd3fc',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(42));

    this.trackObject('completionObjects', this.add.text(512, 368, `Correct slots: ${this.totalCorrectPlacements}/${this.totalSlots}`, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#e2e8f0'
    }).setOrigin(0.5).setDepth(42));

    this.trackObject('completionObjects', this.add.text(512, 426, subtitle, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#cbd5e1',
      align: 'center',
      wordWrap: { width: 560 }
    }).setOrigin(0.5).setDepth(42));

    this.trackObject('completionObjects', this.add.text(512, 496, 'Returning to phase select...', {
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

    if (this.spawnEvent) {
      this.spawnEvent.remove();
      this.spawnEvent = null;
    }

    if (this.roundTransitionEvent) {
      this.roundTransitionEvent.remove();
      this.roundTransitionEvent = null;
    }

    if (this.completionEvent) {
      this.completionEvent.remove();
      this.completionEvent = null;
    }

    this.input.off('dragstart', this.handleDragStart, this);
    this.input.off('drag', this.handleDrag, this);
    this.input.off('dragend', this.handleDragEnd, this);
    this.input.setDefaultCursor('default');

    this.time.removeAllEvents();
    this.tweens.killAll();

    this.releaseAllTraySpots();
    this.destroyActiveJewels();
    this.clearTrackedObjects('slotObjects');
    this.clearTrackedObjects('effectObjects');
    this.clearTrackedObjects('hintObjects');
    this.clearTrackedObjects('transitionObjects');
    this.clearTrackedObjects('completionObjects');
    this.clearTrackedObjects('chaosBanners');
    this.clearTrackedObjects('persistentObjects');

    this.currentSlots = [];
    this.spawnQueue = [];
    this.legendObjects.forEach((object) => {
      if (object && object.scene) {
        object.destroy();
      }
    });
    this.legendObjects = [];

    this.timerText = null;
    this.roundText = null;
    this.scoreText = null;
    this.patternText = null;
    this.statusText = null;
    this.coolingText = null;
    this.meterGraphics = null;
    this.legendTitle = null;
    this.currentRound = null;
  }
}

window.JewelSortScene = JewelSortScene;
