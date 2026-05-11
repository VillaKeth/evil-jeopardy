class GravityFlipScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GravityFlipScene' });

    this.socket = null;
    this.teamId = null;
    this.inventory = [];
    this.boosts = {};
    this.chaosEvents = [];
    this.activeChaosEvents = [];
    this.timeRemaining = 90;
    this.timeLimit = 90;

    this.timerEvent = null;
    this.flipEvent = null;
    this.completionEvent = null;
    this.isComplete = false;

    this.cakeCenterX = 360;
    this.cakeCenterY = 406;
    this.cakeRadiusX = 220;
    this.cakeRadiusY = 164;
    this.cakeTopY = 320;
    this.cakeBottomY = 542;

    this.selectedTool = 'frosting';
    this.selectedFrostingColor = 'white';
    this.selectedFondantColor = 'ivory';
    this.selectedTopping = 'berry';

    this.frostingColors = [];
    this.fondantColors = [];
    this.toppingOptions = [];

    this.placedDecorations = [];
    this.totalPlaced = 0;
    this.decorationId = 0;
    this.flipsOccurred = 0;
    this.gravityDirection = 1;
    this.nextFlipAt = 0;

    this.flipIntervalMin = 5000;
    this.flipIntervalMax = 8000;
    this.slideBoost = 1;
    this.fallThreshold = 0.34;
    this.pointerJitter = 0;

    this.persistentObjects = [];
    this.toolbarObjects = [];
    this.completionObjects = [];
    this.chaosBanners = [];
    this.toolButtons = [];
    this.paletteButtons = [];

    this.timerText = null;
    this.flipText = null;
    this.scoreText = null;
    this.statusText = null;
    this.selectionText = null;
    this.chaosText = null;
    this.cakeGraphics = null;

    this._pointerDownHandler = null;
  }

  init(data) {
    this.socket = data.socket;
    this.teamId = data.teamId;
    this.inventory = data.inventory || [];
    this.boosts = data.boosts || {};
    this.chaosEvents = data.chaosEvents || [];
    this.timeRemaining = 90;

    this.activeChaosEvents = [];
    this.timerEvent = null;
    this.flipEvent = null;
    this.completionEvent = null;
    this.isComplete = false;

    this.selectedTool = 'frosting';
    this.selectedFrostingColor = 'white';
    this.selectedFondantColor = 'ivory';
    this.selectedTopping = 'berry';

    this.placedDecorations = [];
    this.totalPlaced = 0;
    this.decorationId = 0;
    this.flipsOccurred = 0;
    this.gravityDirection = 1;
    this.nextFlipAt = 0;

    this.flipIntervalMin = 5000;
    this.flipIntervalMax = 8000;
    this.slideBoost = 1;
    this.fallThreshold = 0.34;
    this.pointerJitter = 0;

    this.persistentObjects = [];
    this.toolbarObjects = [];
    this.completionObjects = [];
    this.chaosBanners = [];
    this.toolButtons = [];
    this.paletteButtons = [];

    this.setupDecorationOptions();
  }

  create() {
    this.cameras.main.setBackgroundColor('#0f172a');

    this.createBackground();
    this.createCakeArea();
    this.createToolbar();
    this.createHud();
    this.applyChaosEvents();
    this.setupInputHandlers();
    this.scheduleNextFlip();
    this.refreshToolbar();
    this.refreshHud();

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true
    });

    if (this.boosts['recipe-hint'] || this.boosts.hint > 0) {
      this.showRecipeHint();
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  update() {
    if (this.isComplete) {
      return;
    }

    if (this.flipText && this.nextFlipAt) {
      const seconds = Math.max(0, Math.ceil((this.nextFlipAt - this.time.now) / 1000));
      const arrow = this.gravityDirection > 0 ? '↓' : '↑';
      this.flipText.setText(`Next Flip ${arrow}: ${seconds}s`);
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

  itemHas(targetKey) {
    return this.inventory.some((item) => {
      if (typeof item === 'string') {
        return item === targetKey;
      }

      if (!item) {
        return false;
      }

      return item.key === targetKey || item.item_key === targetKey;
    });
  }

  setupDecorationOptions() {
    const hasFoodColoring = this.itemHas('food-coloring');
    const hasFruits = this.itemHas('fruits');
    const hasChocolate = this.itemHas('chocolate');

    this.frostingColors = [
      { key: 'white', label: 'White', color: 0xf8fafc },
      { key: 'pink', label: 'Pink', color: 0xff9ec7 },
      { key: 'teal', label: 'Teal', color: 0x67e8f9 }
    ];

    if (hasFoodColoring) {
      this.frostingColors.push(
        { key: 'lavender', label: 'Lavender', color: 0xc4b5fd },
        { key: 'gold', label: 'Gold', color: 0xfacc15 }
      );
    }

    this.fondantColors = [
      { key: 'ivory', label: 'Ivory', color: 0xfff7e6 },
      { key: 'peach', label: 'Peach', color: 0xfdba74 },
      { key: 'rose', label: 'Rose', color: 0xfda4af }
    ];

    if (hasFoodColoring) {
      this.fondantColors.push(
        { key: 'sky', label: 'Sky', color: 0x93c5fd },
        { key: 'mint', label: 'Mint', color: 0x86efac }
      );
    }

    this.toppingOptions = [
      { key: 'berry', label: 'Berry', color: 0xef4444 },
      { key: 'sprinkle', label: 'Sprinkle', color: 0xf59e0b }
    ];

    if (hasFruits || !this.inventory.length) {
      this.toppingOptions.push({ key: 'citrus', label: 'Citrus', color: 0xfacc15 });
    }

    if (hasChocolate || !this.inventory.length) {
      this.toppingOptions.push({ key: 'chip', label: 'Chip', color: 0x4b2e1f });
    }

    this.selectedTopping = this.toppingOptions[0].key;
  }

  createBackground() {
    this.trackObject('persistentObjects', this.add.rectangle(512, 384, 1024, 768, 0x020617, 1));
    this.trackObject('persistentObjects', this.add.rectangle(512, 118, 1024, 164, 0x111827, 1));
    this.trackObject('persistentObjects', this.add.text(48, 42, 'GRAVITY FLIP DECORATING', {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#fbbf24',
      fontStyle: 'bold'
    }));
    this.trackObject('persistentObjects', this.add.text(48, 84, 'Place frosting, fondant, and toppings between gravity reversals.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#cbd5e1'
    }));

    for (let i = 0; i < 7; i += 1) {
      this.trackObject('persistentObjects', this.add.circle(80 + (i * 120), 706 - ((i % 2) * 18), 48 + ((i % 3) * 6), 0x1e293b, 0.7));
    }
  }

  createCakeArea() {
    this.trackObject('persistentObjects', this.add.rectangle(362, 404, 548, 430, 0x0b1120, 0.7).setStrokeStyle(2, 0x334155, 1));
    this.trackObject('persistentObjects', this.add.text(360, 170, 'Cake Stability Zones', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5));
    this.trackObject('persistentObjects', this.add.text(360, 206, 'Center = safest • edges = danger during flips', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#94a3b8'
    }).setOrigin(0.5));

    this.cakeGraphics = this.trackObject('persistentObjects', this.add.graphics());
    this.drawCakeBase();
  }

  drawCakeBase() {
    if (!this.cakeGraphics) {
      return;
    }

    this.cakeGraphics.clear();
    this.cakeGraphics.fillStyle(0x4b5563, 0.35);
    this.cakeGraphics.fillEllipse(this.cakeCenterX, this.cakeBottomY + 48, this.cakeRadiusX + 120, 54);

    this.cakeGraphics.fillStyle(0xf8e7d0, 1);
    this.cakeGraphics.fillRoundedRect(this.cakeCenterX - this.cakeRadiusX, this.cakeTopY, this.cakeRadiusX * 2, this.cakeBottomY - this.cakeTopY, 30);
    this.cakeGraphics.fillStyle(0xfdebd7, 1);
    this.cakeGraphics.fillEllipse(this.cakeCenterX, this.cakeTopY, this.cakeRadiusX * 2, 86);
    this.cakeGraphics.fillStyle(0xfff4ea, 0.9);
    this.cakeGraphics.fillEllipse(this.cakeCenterX, this.cakeCenterY - 8, this.cakeRadiusX * 1.28, this.cakeRadiusY * 1.1);
    this.cakeGraphics.lineStyle(4, 0xd6b38a, 1);
    this.cakeGraphics.strokeEllipse(this.cakeCenterX, this.cakeTopY, this.cakeRadiusX * 2, 86);
    this.cakeGraphics.lineStyle(2, 0xe7c9a6, 0.9);
    this.cakeGraphics.strokeRoundedRect(this.cakeCenterX - this.cakeRadiusX, this.cakeTopY, this.cakeRadiusX * 2, this.cakeBottomY - this.cakeTopY, 30);

    this.cakeGraphics.lineStyle(2, 0xffffff, 0.14);
    this.cakeGraphics.strokeEllipse(this.cakeCenterX, this.cakeCenterY, this.cakeRadiusX * 0.9, this.cakeRadiusY * 0.7);
  }

  createToolbar() {
    this.trackObject('toolbarObjects', this.add.rectangle(860, 406, 268, 526, 0x111827, 0.98).setStrokeStyle(2, 0x334155, 1));
    this.trackObject('toolbarObjects', this.add.text(860, 158, 'Decoration Cart', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    const toolDefs = [
      { key: 'frosting', label: 'Frosting', y: 214 },
      { key: 'fondant', label: 'Fondant', y: 268 },
      { key: 'topping', label: 'Toppings', y: 322 }
    ];

    toolDefs.forEach((tool) => {
      const button = this.createToolbarButton(860, tool.y, 204, 40, tool.label, () => {
        this.selectedTool = tool.key;
        this.refreshToolbar();
      });
      button.key = tool.key;
      button.group = 'tool';
      this.toolButtons.push(button);
    });

    this.trackObject('toolbarObjects', this.add.text(770, 380, 'FROSTING', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#93c5fd',
      fontStyle: 'bold'
    }));

    this.frostingColors.forEach((entry, index) => {
      const button = this.createSwatchButton(786 + ((index % 2) * 84), 420 + (Math.floor(index / 2) * 54), entry.label, entry.color, () => {
        this.selectedTool = 'frosting';
        this.selectedFrostingColor = entry.key;
        this.refreshToolbar();
      });
      button.key = entry.key;
      button.group = 'frosting';
      this.paletteButtons.push(button);
    });

    this.trackObject('toolbarObjects', this.add.text(770, 540, 'FONDANT', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#f9a8d4',
      fontStyle: 'bold'
    }));

    this.fondantColors.forEach((entry, index) => {
      const button = this.createSwatchButton(786 + ((index % 2) * 84), 580 + (Math.floor(index / 2) * 54), entry.label, entry.color, () => {
        this.selectedTool = 'fondant';
        this.selectedFondantColor = entry.key;
        this.refreshToolbar();
      });
      button.key = entry.key;
      button.group = 'fondant';
      this.paletteButtons.push(button);
    });

    this.trackObject('toolbarObjects', this.add.text(770, 686, 'TOPPINGS', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#fbbf24',
      fontStyle: 'bold'
    }));

    this.toppingOptions.forEach((entry, index) => {
      const button = this.createSwatchButton(786 + ((index % 2) * 84), 722 + (Math.floor(index / 2) * 54), entry.label, entry.color, () => {
        this.selectedTool = 'topping';
        this.selectedTopping = entry.key;
        this.refreshToolbar();
      });
      button.key = entry.key;
      button.group = 'topping';
      this.paletteButtons.push(button);
    });
  }

  createHud() {
    this.timerText = this.trackObject('persistentObjects', this.add.text(48, 124, 'Time: 90s', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }));
    this.flipText = this.trackObject('persistentObjects', this.add.text(48, 154, 'Next Flip ↓: 0s', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#93c5fd'
    }));
    this.scoreText = this.trackObject('persistentObjects', this.add.text(48, 186, 'Survived: 0/0 • Score 0', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#86efac'
    }));
    this.statusText = this.trackObject('persistentObjects', this.add.text(48, 706, 'Click the cake to place decorations before gravity flips.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#e2e8f0',
      wordWrap: { width: 620 }
    }));
    this.selectionText = this.trackObject('persistentObjects', this.add.text(746, 104, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#cbd5e1'
    }));
    this.chaosText = this.trackObject('persistentObjects', this.add.text(746, 128, '', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#fca5a5',
      wordWrap: { width: 246 }
    }));
  }

  createToolbarButton(x, y, width, height, label, onClick) {
    const rect = this.trackObject('toolbarObjects', this.add.rectangle(x, y, width, height, 0x1f2937, 1).setStrokeStyle(2, 0x475569, 1));
    const text = this.trackObject('toolbarObjects', this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#e5e7eb',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerdown', onClick);

    return { rect, text };
  }

  createSwatchButton(x, y, label, color, onClick) {
    const rect = this.trackObject('toolbarObjects', this.add.rectangle(x, y, 72, 38, color, 1).setStrokeStyle(2, 0xffffff, 0.15));
    const text = this.trackObject('toolbarObjects', this.add.text(x, y + 26, label, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#cbd5e1',
      align: 'center'
    }).setOrigin(0.5));

    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerdown', onClick);

    return { rect, text, color };
  }

  refreshToolbar() {
    this.toolButtons.forEach((button) => {
      const selected = button.key === this.selectedTool;
      button.rect.setFillStyle(selected ? 0x2563eb : 0x1f2937, 1);
      button.rect.setStrokeStyle(2, selected ? 0x93c5fd : 0x475569, 1);
      button.text.setColor(selected ? '#eff6ff' : '#e5e7eb');
    });

    this.paletteButtons.forEach((button) => {
      const selected = (button.group === 'frosting' && button.key === this.selectedFrostingColor)
        || (button.group === 'fondant' && button.key === this.selectedFondantColor)
        || (button.group === 'topping' && button.key === this.selectedTopping);
      button.rect.setStrokeStyle(3, selected ? 0xffffff : 0xffffff, selected ? 0.85 : 0.2);
      button.text.setColor(selected ? '#ffffff' : '#cbd5e1');
    });

    const frosting = this.frostingColors.find((entry) => entry.key === this.selectedFrostingColor);
    const fondant = this.fondantColors.find((entry) => entry.key === this.selectedFondantColor);
    const topping = this.toppingOptions.find((entry) => entry.key === this.selectedTopping);

    if (this.selectionText) {
      this.selectionText.setText([
        `Tool: ${this.selectedTool.toUpperCase()}`,
        `Frosting: ${frosting ? frosting.label : 'None'}`,
        `Fondant: ${fondant ? fondant.label : 'None'}`,
        `Topping: ${topping ? topping.label : 'None'}`
      ].join('   •   '));
    }
  }

  setupInputHandlers() {
    this._pointerDownHandler = (pointer) => {
      if (this.isComplete || pointer.x >= 728) {
        return;
      }

      if (!this.isPointOnCake(pointer.x, pointer.y)) {
        if (this.statusText) {
          this.statusText.setText('Only the cake surface counts. Aim for the stable center zone.');
        }
        return;
      }

      this.placeDecoration(pointer.x, pointer.y);
    };

    this.input.on('pointerdown', this._pointerDownHandler);
  }

  isPointOnCake(x, y) {
    const normalizedX = (x - this.cakeCenterX) / this.cakeRadiusX;
    const normalizedY = (y - this.cakeCenterY) / this.cakeRadiusY;
    return ((normalizedX * normalizedX) + (normalizedY * normalizedY)) <= 1;
  }

  placeDecoration(x, y) {
    const jitterX = this.pointerJitter > 0 ? Phaser.Math.Between(-this.pointerJitter, this.pointerJitter) : 0;
    const jitterY = this.pointerJitter > 0 ? Phaser.Math.Between(-this.pointerJitter, this.pointerJitter) : 0;
    const placeX = Phaser.Math.Clamp(x + jitterX, this.cakeCenterX - this.cakeRadiusX + 18, this.cakeCenterX + this.cakeRadiusX - 18);
    const placeY = Phaser.Math.Clamp(y + jitterY, this.cakeTopY - 16, this.cakeBottomY - 22);

    let displayObject = null;
    let label = '';

    if (this.selectedTool === 'frosting') {
      const frosting = this.frostingColors.find((entry) => entry.key === this.selectedFrostingColor) || this.frostingColors[0];
      displayObject = this.createFrostingDecoration(placeX, placeY, frosting.color);
      label = `${frosting.label} frosting`;
    } else if (this.selectedTool === 'fondant') {
      const fondant = this.fondantColors.find((entry) => entry.key === this.selectedFondantColor) || this.fondantColors[0];
      displayObject = this.createFondantDecoration(placeX, placeY, fondant.color);
      label = `${fondant.label} fondant`;
    } else {
      const topping = this.toppingOptions.find((entry) => entry.key === this.selectedTopping) || this.toppingOptions[0];
      displayObject = this.createToppingDecoration(placeX, placeY, topping);
      label = topping.label;
    }

    if (!displayObject) {
      return;
    }

    this.decorationId += 1;
    displayObject.setDepth(8 + (placeY / 1000));

    this.placedDecorations.push({
      id: this.decorationId,
      type: this.selectedTool,
      x: placeX,
      y: placeY,
      alive: true,
      survivedFlips: 0,
      displayObject
    });
    this.totalPlaced += 1;

    this.tweens.add({
      targets: displayObject,
      scaleX: { from: 0.75, to: 1 },
      scaleY: { from: 0.75, to: 1 },
      duration: 160,
      ease: 'Back.Out'
    });

    if (this.statusText) {
      this.statusText.setText(`${label} placed. Aim for the center before the next gravity reversal.`);
    }

    this.refreshHud();
  }

  createFrostingDecoration(x, y, color) {
    const swirl = this.add.container(x, y);
    const base = this.add.ellipse(0, 0, 34, 22, color, 0.95);
    const top = this.add.ellipse(0, -8, 20, 14, color, 1);
    const shine = this.add.ellipse(-5, -3, 8, 5, 0xffffff, 0.25);
    swirl.add([base, top, shine]);
    return swirl;
  }

  createFondantDecoration(x, y, color) {
    const patch = this.add.container(x, y);
    const sheet = this.add.rectangle(0, 0, 58, 34, color, 0.96).setStrokeStyle(2, 0xffffff, 0.22);
    const trim = this.add.rectangle(0, 0, 40, 18, 0xffffff, 0.08);
    patch.rotation = Phaser.Math.FloatBetween(-0.14, 0.14);
    patch.add([sheet, trim]);
    return patch;
  }

  createToppingDecoration(x, y, topping) {
    const container = this.add.container(x, y);

    if (topping.key === 'berry') {
      container.add([
        this.add.circle(0, 0, 11, topping.color, 1).setStrokeStyle(2, 0x7f1d1d, 0.8),
        this.add.circle(-4, -4, 3, 0xffffff, 0.28)
      ]);
      return container;
    }

    if (topping.key === 'citrus') {
      container.add([
        this.add.circle(0, 0, 12, topping.color, 1).setStrokeStyle(2, 0xf59e0b, 0.8),
        this.add.circle(0, 0, 4, 0xfffbeb, 1)
      ]);
      return container;
    }

    if (topping.key === 'chip') {
      container.add([
        this.add.rectangle(0, 0, 16, 12, topping.color, 1).setStrokeStyle(2, 0x2d160f, 0.7),
        this.add.rectangle(0, 0, 10, 4, 0xffffff, 0.1)
      ]);
      container.rotation = Phaser.Math.FloatBetween(-0.25, 0.25);
      return container;
    }

    container.add([
      this.add.rectangle(0, 0, 18, 6, topping.color, 1),
      this.add.rectangle(0, -6, 18, 6, 0x60a5fa, 1),
      this.add.rectangle(0, 6, 18, 6, 0xf472b6, 1)
    ]);
    container.rotation = Phaser.Math.FloatBetween(-0.3, 0.3);
    return container;
  }

  updateTimer() {
    if (this.isComplete) {
      return;
    }

    this.timeRemaining = Math.max(0, this.timeRemaining - 1);
    this.refreshHud();

    if (this.timeRemaining <= 0) {
      this.completeMinigame();
    }
  }

  scheduleNextFlip() {
    if (this.isComplete) {
      return;
    }

    if (this.flipEvent) {
      this.flipEvent.remove();
      this.flipEvent = null;
    }

    const delay = Phaser.Math.Between(this.flipIntervalMin, this.flipIntervalMax);
    this.nextFlipAt = this.time.now + delay;
    this.flipEvent = this.time.delayedCall(delay, () => this.performGravityFlip());
  }

  performGravityFlip() {
    if (this.isComplete) {
      return;
    }

    this.gravityDirection *= -1;
    this.flipsOccurred += 1;
    this.nextFlipAt = 0;

    this.cameras.main.flash(150, 255, 255, 255, true);
    this.tweens.killTweensOf(this.cameras.main);
    this.cameras.main.rotation = 0;
    this.tweens.add({
      targets: this.cameras.main,
      rotation: Math.PI,
      duration: 180,
      ease: 'Cubic.easeIn',
      yoyo: true,
      hold: 70,
      onComplete: () => {
        this.cameras.main.rotation = 0;
      }
    });

    const flipBanner = this.trackObject('chaosBanners', this.add.text(360, 118, this.gravityDirection > 0 ? 'GRAVITY FLIP ↓' : 'GRAVITY FLIP ↑', {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#fef3c7',
      fontStyle: 'bold',
      backgroundColor: 'rgba(15,23,42,0.7)',
      padding: { x: 14, y: 6 }
    }).setOrigin(0.5).setDepth(30));

    this.tweens.add({
      targets: flipBanner,
      alpha: 0,
      y: flipBanner.y - 26,
      duration: 900,
      onComplete: () => {
        if (flipBanner && flipBanner.destroy) {
          flipBanner.destroy();
        }
      }
    });

    this.placedDecorations.forEach((entry) => {
      if (!entry.alive || !entry.displayObject || !entry.displayObject.scene) {
        return;
      }

      const stability = this.calculateDecorationStability(entry);
      if (stability < this.fallThreshold) {
        this.removeDecoration(entry);
        return;
      }

      entry.survivedFlips += 1;

      const xBias = Phaser.Math.Clamp((entry.x - this.cakeCenterX) / this.cakeRadiusX, -1, 1);
      const slideY = (28 + ((1 - stability) * 96)) * this.gravityDirection * this.slideBoost;
      const slideX = xBias * (12 + ((1 - stability) * 30));
      const targetX = Phaser.Math.Clamp(entry.x + slideX, this.cakeCenterX - this.cakeRadiusX + 20, this.cakeCenterX + this.cakeRadiusX - 20);
      const targetY = Phaser.Math.Clamp(entry.y + slideY, this.cakeTopY - 4, this.cakeBottomY - 18);

      entry.x = targetX;
      entry.y = targetY;

      this.tweens.add({
        targets: entry.displayObject,
        x: targetX,
        y: targetY,
        rotation: entry.displayObject.rotation + (xBias * 0.12),
        duration: 320,
        ease: 'Sine.easeInOut'
      });
    });

    if (this.statusText) {
      this.statusText.setText('Gravity reversed! Decorations near the edges are slipping away.');
    }

    this.refreshHud();
    this.scheduleNextFlip();
  }

  calculateDecorationStability(entry) {
    const normalizedX = Math.abs((entry.x - this.cakeCenterX) / (this.cakeRadiusX * 0.92));
    const normalizedY = Math.abs((entry.y - this.cakeCenterY) / (this.cakeRadiusY * 0.95));
    const radial = Math.sqrt((normalizedX * normalizedX) + (normalizedY * normalizedY));
    const centerSafety = Phaser.Math.Clamp(1 - (radial / 1.2), 0, 1);

    const edgeDistance = this.gravityDirection > 0
      ? this.cakeBottomY - entry.y
      : entry.y - this.cakeTopY;
    const verticalSafety = Phaser.Math.Clamp(edgeDistance / (this.cakeRadiusY * 0.9), 0, 1);

    let stability = (centerSafety * 0.65) + (verticalSafety * 0.35);
    if (entry.type === 'fondant') {
      stability += 0.14;
    } else if (entry.type === 'frosting') {
      stability += 0.05;
    }

    return Phaser.Math.Clamp(stability, 0, 1);
  }

  removeDecoration(entry) {
    entry.alive = false;

    if (!entry.displayObject || !entry.displayObject.scene) {
      return;
    }

    const targetY = this.gravityDirection > 0 ? 760 : -40;
    const driftX = entry.displayObject.x + ((entry.displayObject.x > this.cakeCenterX ? 1 : -1) * Phaser.Math.Between(24, 54));

    this.tweens.add({
      targets: entry.displayObject,
      x: driftX,
      y: targetY,
      alpha: 0,
      rotation: entry.displayObject.rotation + Phaser.Math.FloatBetween(-0.6, 0.6),
      duration: 520,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (entry.displayObject && entry.displayObject.destroy) {
          entry.displayObject.destroy();
        }
      }
    });
  }

  refreshHud() {
    const survivors = this.placedDecorations.filter((entry) => entry.alive).length;
    const score = this.calculateFinalScore();

    if (this.timerText) {
      this.timerText.setText(`Time: ${this.timeRemaining}s`);
      this.timerText.setColor(this.timeRemaining <= 12 ? '#f87171' : (this.timeRemaining <= 25 ? '#fbbf24' : '#f8fafc'));
    }

    if (this.scoreText) {
      this.scoreText.setText(`Survived: ${survivors}/${this.totalPlaced} • Score ${score}`);
    }

    if (this.chaosText) {
      this.chaosText.setText(this.activeChaosEvents.length
        ? `Chaos: ${this.activeChaosEvents.map((event) => event.name || event.key || 'chaos').join(', ')}`
        : 'Chaos: none');
    }
  }

  applyChaosEvents() {
    this.activeChaosEvents = this.chaosEvents.filter((event) => {
      if (!event || !event.phase) {
        return false;
      }

      if (Array.isArray(event.phase)) {
        return event.phase.includes('decorate') || event.phase.includes('any');
      }

      return event.phase === 'decorate' || event.phase === 'any';
    });

    if (!this.activeChaosEvents.length) {
      return;
    }

    this.activeChaosEvents.forEach((event, index) => {
      const chaosKey = `${event.key || ''} ${event.name || ''}`.toLowerCase();
      if (/gravity|reverse|flip|storm|chaos/.test(chaosKey)) {
        this.flipIntervalMin = 4200;
        this.flipIntervalMax = 6500;
        this.slideBoost = 1.2;
      }

      if (/slip|jitter|quake|mess|catastrophe/.test(chaosKey)) {
        this.pointerJitter = 8;
        this.fallThreshold = 0.4;
      }

      const banner = this.trackObject('chaosBanners', this.add.text(360, 236 + (index * 30), `⚠ ${event.name || event.key || 'Chaos'} active`, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#fca5a5',
        fontStyle: 'bold',
        backgroundColor: 'rgba(15,23,42,0.55)',
        padding: { x: 10, y: 4 }
      }).setOrigin(0.5).setDepth(18));

      this.tweens.add({
        targets: banner,
        alpha: 0,
        y: banner.y - 10,
        duration: 700,
        delay: 2100 + (index * 220),
        onComplete: () => {
          if (banner && banner.destroy) {
            banner.destroy();
          }
        }
      });
    });
  }

  showRecipeHint() {
    const overlay = this.trackObject('persistentObjects', this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.74).setDepth(40));
    const text = this.trackObject('persistentObjects', this.add.text(512, 384, [
      '💡 GRAVITY TIP',
      '',
      'Place fondant and frosting near the center.',
      'Outer-edge toppings are the first to slide away when gravity reverses.'
    ].join('\n'), {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#fef08a',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setDepth(41));

    this.time.delayedCall(4200, () => {
      this.tweens.add({
        targets: [overlay, text],
        alpha: 0,
        duration: 450,
        onComplete: () => {
          overlay.destroy();
          text.destroy();
          this.persistentObjects = this.persistentObjects.filter((object) => object !== overlay && object !== text);
        }
      });
    });
  }

  calculateFinalScore() {
    if (this.totalPlaced <= 0) {
      return 0;
    }

    const survivors = this.placedDecorations.filter((entry) => entry.alive).length;
    return Math.round((survivors / this.totalPlaced) * 100);
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

    if (this.flipEvent) {
      this.flipEvent.remove();
      this.flipEvent = null;
    }

    const survivors = this.placedDecorations.filter((entry) => entry.alive).length;
    const score = this.calculateFinalScore();

    if (this.socket) {
      this.socket.emit('baking:phase-complete', {
        teamId: this.teamId,
        phase: 'decorate',
        score,
        details: {
          totalPlaced: this.totalPlaced,
          survivedDecorations: survivors,
          flipsOccurred: this.flipsOccurred,
          gravityDirection: this.gravityDirection,
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

    const survivors = this.placedDecorations.filter((entry) => entry.alive).length;
    const overlay = this.trackObject('completionObjects', this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.8).setDepth(50));
    const panel = this.trackObject('completionObjects', this.add.rectangle(512, 384, 630, 350, 0x111827, 0.98).setStrokeStyle(3, 0x475569, 1).setDepth(51));

    this.trackObject('completionObjects', this.add.text(512, 250, 'GRAVITY DECORATING COMPLETE!', {
      fontFamily: 'Arial',
      fontSize: '36px',
      color: '#fbbf24',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(52));

    this.trackObject('completionObjects', this.add.text(512, 312, `Score: ${score}/100`, {
      fontFamily: 'Arial',
      fontSize: '40px',
      color: '#86efac',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(52));

    this.trackObject('completionObjects', this.add.text(512, 372, `Survivors: ${survivors}/${this.totalPlaced}   •   Flips endured: ${this.flipsOccurred}`, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#e2e8f0',
      align: 'center'
    }).setOrigin(0.5).setDepth(52));

    this.trackObject('completionObjects', this.add.text(512, 432, 'Stable center placements win. Edge decorations paid the gravity tax.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#cbd5e1',
      align: 'center',
      wordWrap: { width: 520 }
    }).setOrigin(0.5).setDepth(52));

    this.trackObject('completionObjects', this.add.text(512, 502, 'Returning to phase select...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#93c5fd',
      fontStyle: 'italic'
    }).setOrigin(0.5).setDepth(52));

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

    if (this.flipEvent) {
      this.flipEvent.remove();
      this.flipEvent = null;
    }

    if (this.completionEvent) {
      this.completionEvent.remove();
      this.completionEvent = null;
    }

    this.time.removeAllEvents();
    this.tweens.killAll();

    if (this._pointerDownHandler) {
      this.input.off('pointerdown', this._pointerDownHandler);
      this._pointerDownHandler = null;
    }

    this.toolButtons.forEach((button) => {
      if (button && button.rect) {
        button.rect.removeAllListeners();
      }
    });
    this.paletteButtons.forEach((button) => {
      if (button && button.rect) {
        button.rect.removeAllListeners();
      }
    });

    this.placedDecorations.forEach((entry) => {
      if (entry.displayObject && entry.displayObject.destroy) {
        entry.displayObject.destroy();
      }
    });
    this.placedDecorations = [];

    this.clearTrackedObjects('completionObjects');
    this.clearTrackedObjects('chaosBanners');
    this.clearTrackedObjects('toolbarObjects');
    this.clearTrackedObjects('persistentObjects');

    this.toolButtons = [];
    this.paletteButtons = [];
    this.cakeGraphics = null;
    this.timerText = null;
    this.flipText = null;
    this.scoreText = null;
    this.statusText = null;
    this.selectionText = null;
    this.chaosText = null;
    this.cameras.main.rotation = 0;
  }
}

window.GravityFlipScene = GravityFlipScene;
