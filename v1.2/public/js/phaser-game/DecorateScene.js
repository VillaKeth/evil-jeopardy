// Evil Jeopardy 1.2 - Decorate Scene (Free-Form Decorating)

class DecorateScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DecorateScene' });

    this.socket = null;
    this.teamId = null;
    this.inventory = [];
    this.boosts = {};
    this.chaosEvents = [];
    this.cakeGoal = {};

    this.timeLimit = 120;
    this.timeRemaining = 120;
    this.timerEvent = null;
    this.completionEvent = null;
    this.isComplete = false;

    this.hasPipingTips = false;
    this.hasFondant = false;
    this.hasFoodColoring = false;
    this.hasFruits = false;
    this.hasChocolate = false;

    this.selectedTool = 'frosting';
    this.selectedPattern = 'straight';
    this.selectedFrostingColor = 'white';
    this.selectedFondantColor = 'ivory';
    this.selectedFondantShape = 'rectangle';
    this.selectedTopping = null;

    this.frostingColors = [];
    this.fondantColors = [];
    this.frostingPatterns = [];
    this.toppingOptions = [];
    this.availableDecorationTypes = [];
    this.colorLookup = {};

    this.referenceSpec = null;
    this.usedDecorationTypes = new Set();
    this.usedColors = new Set();
    this.decoratedBands = new Set();

    this.chaosPenalty = 0;
    this.meltActive = false;
    this.gravityActive = false;
    this.catastropheActive = false;
    this.pointerJitter = 0;
    this.decorationDrop = 0;

    this.cakeCenterX = 430;
    this.cakeTopCenterY = 386;
    this.cakeWidth = 430;
    this.cakeTopHeight = 180;
    this.cakeBodyHeight = 156;
    this.cakeBodyY = 386;

    this.coverageCells = [];
    this.totalCakeCells = 0;
    this.filledCakeCells = 0;

    this.isDrawingFrosting = false;
    this.isDraggingFondant = false;
    this.lastPointerPoint = null;
    this.fondantStartPoint = null;

    this.persistentObjects = [];
    this.toolbarObjects = [];
    this.dynamicToolbarObjects = [];
    this.completionObjects = [];
    this.chaosBanners = [];

    this.toolButtons = [];

    this.timerText = null;
    this.instructionText = null;
    this.coverageText = null;
    this.varietyText = null;
    this.similarityText = null;
    this.scorePreviewText = null;
    this.selectionText = null;
    this.referenceTitleText = null;
    this.referenceHintText = null;
    this.chaosText = null;

    this.cakeBaseGraphics = null;
    this.decorationGraphics = null;
    this.previewGraphics = null;
    this.referenceGraphics = null;
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
    this.cakeGoal = data.cakeGoal || this.registry.get('cakeGoal') || {};

    this.timeRemaining = this.timeLimit;
    this.timerEvent = null;
    this.completionEvent = null;
    this.isComplete = false;

    this.hasPipingTips = this.itemHas('piping-tips');
    this.hasFondant = this.itemHas('fondant');
    this.hasFoodColoring = this.itemHas('food-coloring');
    this.hasFruits = this.itemHas('fruits');
    this.hasChocolate = this.itemHas('chocolate');

    this.selectedTool = 'frosting';
    this.selectedPattern = 'straight';
    this.selectedFrostingColor = 'white';
    this.selectedFondantColor = this.hasFoodColoring ? 'rose' : 'ivory';
    this.selectedFondantShape = 'rectangle';
    this.selectedTopping = null;

    this.referenceSpec = null;
    this.usedDecorationTypes = new Set();
    this.usedColors = new Set();
    this.decoratedBands = new Set();

    this.chaosPenalty = 0;
    this.meltActive = false;
    this.gravityActive = false;
    this.catastropheActive = false;
    this.pointerJitter = 0;
    this.decorationDrop = 0;

    this.coverageCells = [];
    this.totalCakeCells = 0;
    this.filledCakeCells = 0;

    this.isDrawingFrosting = false;
    this.isDraggingFondant = false;
    this.lastPointerPoint = null;
    this.fondantStartPoint = null;

    this.persistentObjects = [];
    this.toolbarObjects = [];
    this.dynamicToolbarObjects = [];
    this.completionObjects = [];
    this.chaosBanners = [];
    this.toolButtons = [];

    this.setupDecorationOptions();
    this.referenceSpec = this.buildReferenceSpec();
    this.initializeCoverageGrid();
  }

  create() {
    this.cameras.main.setBackgroundColor('#0f172a');

    this.createBackground();
    this.createHeader();
    this.createCakeArea();
    this.createReferencePanel();
    this.createToolbar();
    this.createStatsPanel();

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
    this.setupInputHandlers();
    this.refreshToolbar();
    this.refreshTelemetry();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
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
    this.frostingColors = [
      { key: 'white', label: 'White', value: 0xf8fafc },
      { key: 'brown', label: 'Cocoa', value: 0x6b3f2c }
    ];

    if (this.hasFoodColoring) {
      this.frostingColors.push(
        { key: 'pink', label: 'Pink', value: 0xff8fb1 },
        { key: 'teal', label: 'Teal', value: 0x5eead4 },
        { key: 'lavender', label: 'Lavender', value: 0xc4b5fd }
      );
    }

    this.fondantColors = [
      { key: 'ivory', label: 'Ivory', value: 0xfff7e6 },
      { key: 'peach', label: 'Peach', value: 0xfec89a }
    ];

    if (this.hasFoodColoring) {
      this.fondantColors.push(
        { key: 'rose', label: 'Rose', value: 0xffa8c7 },
        { key: 'sky', label: 'Sky', value: 0x93c5fd },
        { key: 'mint', label: 'Mint', value: 0x86efac }
      );
    }

    this.frostingPatterns = this.hasPipingTips
      ? [
        { key: 'straight', label: 'Straight' },
        { key: 'zigzag', label: 'Zigzag' },
        { key: 'dots', label: 'Dots' },
        { key: 'rosette', label: 'Rosette' },
        { key: 'border', label: 'Border' }
      ]
      : [{ key: 'straight', label: 'Straight' }];

    this.toppingOptions = [];

    if (this.hasFruits) {
      this.toppingOptions.push(
        { key: 'fruit-slice', label: 'Fruit Slice', colorKey: 'fruit-red', color: 0xff6b6b },
        { key: 'berry', label: 'Berry', colorKey: 'berry-blue', color: 0x60a5fa }
      );
    }

    if (this.hasChocolate) {
      this.toppingOptions.push(
        { key: 'chip', label: 'Chip', colorKey: 'choco-dark', color: 0x3f2a20 },
        { key: 'shard', label: 'Shard', colorKey: 'choco-milk', color: 0x7c4a2d }
      );
    }

    if (this.toppingOptions.length) {
      this.selectedTopping = this.toppingOptions[0].key;
    }

    this.colorLookup = {};
    [...this.frostingColors, ...this.fondantColors].forEach((entry) => {
      this.colorLookup[entry.key] = entry.value;
    });

    this.toppingOptions.forEach((entry) => {
      this.colorLookup[entry.colorKey] = entry.color;
    });

    this.availableDecorationTypes = this.frostingPatterns.map((pattern) => `frosting-${pattern.key}`);

    if (this.hasFondant) {
      this.availableDecorationTypes.push('fondant-rectangle', 'fondant-circle');
    }

    this.toppingOptions.forEach((option) => {
      this.availableDecorationTypes.push(`topping-${option.key}`);
    });
  }

  buildReferenceSpec() {
    const cakeType = this.detectCakeType();
    const availableColorKeys = new Set([
      ...this.frostingColors.map((color) => color.key),
      ...this.fondantColors.map((color) => color.key)
    ]);

    const buildPalette = (preferredKeys) => {
      const filtered = preferredKeys.filter((key) => availableColorKeys.has(key));
      return filtered.length ? filtered : [this.frostingColors[0].key, this.frostingColors[Math.min(1, this.frostingColors.length - 1)].key];
    };

    let spec = {
      label: 'Classic Showcase',
      subtitle: 'Soft swoops and a neat topper',
      layerCount: 2,
      targetCoverage: 0.68,
      targetBands: ['top', 'middle'],
      paletteKeys: buildPalette(['white', 'brown', 'pink']),
      requiredTypes: ['frosting-straight']
    };

    if (cakeType === 'cake-chocolate-layer') {
      spec = {
        label: 'Chocolate Layer Deluxe',
        subtitle: 'Rich frosting with dramatic accents',
        layerCount: 3,
        targetCoverage: 0.76,
        targetBands: ['top', 'middle', 'bottom'],
        paletteKeys: buildPalette(['brown', 'white', 'pink']),
        requiredTypes: [this.hasPipingTips ? 'frosting-border' : 'frosting-straight']
      };
    } else if (cakeType === 'cake-banana') {
      spec = {
        label: 'Banana Dream',
        subtitle: 'Light trim and cheerful toppers',
        layerCount: 2,
        targetCoverage: 0.62,
        targetBands: ['top', 'middle'],
        paletteKeys: buildPalette(['white', 'peach', 'brown']),
        requiredTypes: ['frosting-straight']
      };
    } else if (cakeType === 'cake-wedding') {
      spec = {
        label: 'Wedding Tower',
        subtitle: 'Smooth fondant and elegant piping',
        layerCount: 3,
        targetCoverage: 0.83,
        targetBands: ['top', 'middle', 'bottom'],
        paletteKeys: buildPalette(['white', 'rose', 'sky']),
        requiredTypes: [this.hasPipingTips ? 'frosting-border' : 'frosting-straight']
      };
    } else if (cakeType === 'cake-statue-liberty') {
      spec = {
        label: 'Liberty Showpiece',
        subtitle: 'Tall, bold, and slightly cursed',
        layerCount: 3,
        targetCoverage: 0.8,
        targetBands: ['top', 'middle', 'bottom'],
        paletteKeys: buildPalette(['mint', 'white', 'brown']),
        requiredTypes: [this.hasPipingTips ? 'frosting-rosette' : 'frosting-straight']
      };
    }

    if (this.hasFondant) {
      spec.requiredTypes.push(spec.label === 'Wedding Tower' ? 'fondant-rectangle' : 'fondant-circle');
    }

    if (this.hasFruits) {
      spec.requiredTypes.push('topping-fruit-slice');
    } else if (this.hasChocolate) {
      spec.requiredTypes.push('topping-chip');
    }

    spec.requiredTypes = [...new Set(spec.requiredTypes.filter((type) => this.availableDecorationTypes.includes(type)))];
    spec.paletteKeys = [...new Set(spec.paletteKeys)];

    return spec;
  }

  detectCakeType() {
    const cakeItem = this.inventory.find((item) => {
      if (typeof item === 'string') {
        return item.startsWith('cake-');
      }

      if (!item) {
        return false;
      }

      const key = item.key || item.item_key;
      return typeof key === 'string' && key.startsWith('cake-');
    });

    if (cakeItem) {
      return typeof cakeItem === 'string' ? cakeItem : (cakeItem.key || cakeItem.item_key);
    }

    const goalText = JSON.stringify(this.cakeGoal || {}).toLowerCase();
    if (goalText.includes('wedding')) {
      return 'cake-wedding';
    }
    if (goalText.includes('banana')) {
      return 'cake-banana';
    }
    if (goalText.includes('statue')) {
      return 'cake-statue-liberty';
    }
    if (goalText.includes('chocolate')) {
      return 'cake-chocolate-layer';
    }

    return 'cake-classic';
  }

  initializeCoverageGrid() {
    const cols = 34;
    const rows = 22;
    const left = this.cakeCenterX - (this.cakeWidth / 2);
    const top = this.cakeTopCenterY - (this.cakeTopHeight / 2) - 12;
    const width = this.cakeWidth;
    const height = this.cakeBodyHeight + (this.cakeTopHeight / 2) + 24;

    this.coverageCells = [];
    this.totalCakeCells = 0;
    this.filledCakeCells = 0;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = left + ((col + 0.5) / cols) * width;
        const y = top + ((row + 0.5) / rows) * height;

        if (this.isWithinCake(x, y)) {
          this.coverageCells.push({ x, y, filled: false });
          this.totalCakeCells += 1;
        }
      }
    }
  }

  trackObject(listName, object) {
    if (!this[listName]) {
      this[listName] = [];
    }

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
    bg.fillGradientStyle(0x111827, 0x111827, 0x312e81, 0x1f2937, 1);
    bg.fillRect(0, 0, 1024, 768);

    const deco = this.trackObject('persistentObjects', this.add.graphics());
    deco.lineStyle(2, 0xffffff, 0.05);
    deco.strokeRoundedRect(24, 24, 976, 720, 24);
    deco.lineBetween(734, 110, 734, 688);
    deco.lineBetween(60, 112, 700, 112);
    deco.lineBetween(60, 688, 964, 688);
    deco.strokeCircle(430, 402, 244);
    deco.strokeCircle(430, 402, 268);
  }

  createHeader() {
    this.trackObject('persistentObjects', this.add.text(512, 24, '🎂 DECORATE PHASE', {
      fontFamily: 'Arial',
      fontSize: '36px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0));

    this.timerText = this.trackObject('persistentObjects', this.add.text(944, 30, `Time: ${this.timeRemaining}s`, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(1, 0));

    this.instructionText = this.trackObject('persistentObjects', this.add.text(380, 78, 'Drag to pipe frosting, click to place toppings, drag shapes for fondant.', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#cbd5e1',
      align: 'center'
    }).setOrigin(0.5, 0));
  }

  createCakeArea() {
    this.trackObject('persistentObjects', this.add.text(this.cakeCenterX, 150, 'Decorate the blank cake to match the reference style', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.cakeBaseGraphics = this.trackObject('persistentObjects', this.add.graphics());
    this.decorationGraphics = this.trackObject('persistentObjects', this.add.graphics());
    this.previewGraphics = this.trackObject('persistentObjects', this.add.graphics());

    this.cakeBaseGraphics.setDepth(1);
    this.decorationGraphics.setDepth(3);
    this.previewGraphics.setDepth(4);

    this.redrawCakeBase();
  }

  redrawCakeBase() {
    if (!this.cakeBaseGraphics) {
      return;
    }

    const graphics = this.cakeBaseGraphics;
    const left = this.cakeCenterX - (this.cakeWidth / 2);
    const right = this.cakeCenterX + (this.cakeWidth / 2);
    const bodyBottom = this.cakeBodyY + this.cakeBodyHeight;

    graphics.clear();

    graphics.fillStyle(0x000000, 0.2);
    graphics.fillEllipse(this.cakeCenterX, bodyBottom + 62, this.cakeWidth + 90, 46);

    graphics.fillStyle(0x334155, 1);
    graphics.fillRoundedRect(left - 34, bodyBottom + 28, this.cakeWidth + 68, 18, 8);
    graphics.fillStyle(0x475569, 1);
    graphics.fillRoundedRect(left - 16, bodyBottom + 10, this.cakeWidth + 32, 22, 10);

    graphics.fillStyle(0xf0e7d8, 1);
    graphics.fillRect(left, this.cakeBodyY, this.cakeWidth, this.cakeBodyHeight);

    graphics.fillStyle(0xe8dcc7, 1);
    for (let stripe = 0; stripe < 5; stripe += 1) {
      graphics.fillRect(left + (stripe * 28), this.cakeBodyY, 12, this.cakeBodyHeight);
    }

    graphics.fillStyle(0xfff5ea, 1);
    graphics.fillEllipse(this.cakeCenterX, this.cakeTopCenterY, this.cakeWidth, this.cakeTopHeight);
    graphics.lineStyle(4, 0xd6c3a8, 0.9);
    graphics.strokeEllipse(this.cakeCenterX, this.cakeTopCenterY, this.cakeWidth, this.cakeTopHeight);
    graphics.lineStyle(3, 0xc2aa84, 0.85);
    graphics.strokeRect(left, this.cakeBodyY, this.cakeWidth, this.cakeBodyHeight);

    graphics.fillStyle(0xffffff, 0.22);
    graphics.fillEllipse(this.cakeCenterX - 22, this.cakeTopCenterY - 18, this.cakeWidth * 0.64, this.cakeTopHeight * 0.34);

    this.trackObject('persistentObjects', this.add.text(this.cakeCenterX, bodyBottom + 88, 'Decorating zone', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#94a3b8'
    }).setOrigin(0.5));
  }

  createReferencePanel() {
    const panel = this.trackObject('persistentObjects', this.add.rectangle(160, 230, 220, 250, 0x111827, 0.96));
    panel.setStrokeStyle(2, 0x475569, 1);

    this.referenceTitleText = this.trackObject('persistentObjects', this.add.text(160, 126, 'REFERENCE CAKE', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.trackObject('persistentObjects', this.add.text(160, 154, this.referenceSpec.label, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#fbbf24',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 190 }
    }).setOrigin(0.5));

    this.referenceGraphics = this.trackObject('persistentObjects', this.add.graphics());
    this.referenceGraphics.setDepth(2);
    this.drawReferenceCake();

    this.referenceHintText = this.trackObject('persistentObjects', this.add.text(160, 318, [
      `${Math.round(this.referenceSpec.targetCoverage * 100)}% target coverage`,
      `${this.referenceSpec.requiredTypes.length || 1} signature style${this.referenceSpec.requiredTypes.length === 1 ? '' : 's'}`
    ].join('\n'), {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#cbd5e1',
      align: 'center'
    }).setOrigin(0.5));

    this.drawReferencePalette(74, 352);
  }

  drawReferenceCake() {
    if (!this.referenceGraphics) {
      return;
    }

    const graphics = this.referenceGraphics;
    const palette = this.referenceSpec.paletteKeys.map((key) => this.getColorValue(key));
    const primary = palette[0] || 0xf8fafc;
    const secondary = palette[1] || 0xff8fb1;
    const accent = palette[2] || secondary;
    const baseX = 160;
    const baseY = 272;
    const tiers = this.referenceSpec.layerCount;
    const widths = tiers === 3 ? [128, 98, 70] : [136, 96];

    graphics.clear();

    graphics.fillStyle(0x334155, 1);
    graphics.fillRoundedRect(98, 286, 124, 12, 6);

    widths.forEach((width, index) => {
      const tierY = baseY - ((widths.length - index - 1) * 34);
      const height = 34;
      const fillColor = index % 2 === 0 ? primary : secondary;

      graphics.fillStyle(fillColor, 1);
      graphics.fillRect(baseX - (width / 2), tierY - 8, width, height);
      graphics.fillEllipse(baseX, tierY - 8, width, 26);
      graphics.lineStyle(2, 0xffffff, 0.3);
      graphics.strokeEllipse(baseX, tierY - 8, width, 26);

      if (this.referenceSpec.requiredTypes.includes('frosting-border')) {
        this.drawMiniBorder(graphics, baseX - (width / 2) + 8, tierY + 22, width - 16, accent);
      }

      if (this.referenceSpec.requiredTypes.includes('frosting-rosette')) {
        this.drawMiniRosette(graphics, baseX, tierY - 16, accent);
      }

      if (this.referenceSpec.requiredTypes.includes('fondant-rectangle')) {
        graphics.fillStyle(accent, 0.95);
        graphics.fillRect(baseX - 22, tierY + 2, 44, 8);
      }
    });

    if (this.referenceSpec.requiredTypes.includes('fondant-circle')) {
      graphics.fillStyle(accent, 0.95);
      graphics.fillCircle(baseX, baseY - 70, 10);
    }

    if (this.referenceSpec.requiredTypes.includes('topping-fruit-slice')) {
      graphics.fillStyle(0xff6b6b, 1);
      graphics.fillTriangle(baseX - 16, baseY - 86, baseX - 2, baseY - 100, baseX + 6, baseY - 80);
      graphics.fillStyle(0x22c55e, 1);
      graphics.fillTriangle(baseX + 2, baseY - 100, baseX + 10, baseY - 104, baseX + 8, baseY - 92);
    }

    if (this.referenceSpec.requiredTypes.includes('topping-chip')) {
      graphics.fillStyle(0x3f2a20, 1);
      graphics.fillCircle(baseX + 18, baseY - 84, 5);
    }
  }

  drawReferencePalette(startX, y) {
    const palette = this.referenceSpec.paletteKeys;

    palette.forEach((key, index) => {
      const circle = this.trackObject('persistentObjects', this.add.circle(startX + (index * 38), y, 12, this.getColorValue(key), 1));
      circle.setStrokeStyle(2, 0xffffff, 0.6);
    });

    this.trackObject('persistentObjects', this.add.text(160, 380, this.referenceSpec.subtitle, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#94a3b8',
      align: 'center',
      wordWrap: { width: 186 }
    }).setOrigin(0.5));
  }

  drawMiniBorder(graphics, startX, y, width, color) {
    for (let x = startX; x <= startX + width; x += 12) {
      graphics.fillStyle(color, 0.95);
      graphics.fillCircle(x, y, 4);
    }
  }

  drawMiniRosette(graphics, x, y, color) {
    graphics.fillStyle(color, 0.95);
    graphics.fillCircle(x, y, 6);
    graphics.fillCircle(x - 5, y + 4, 4);
    graphics.fillCircle(x + 5, y + 4, 4);
  }

  createToolbar() {
    const panel = this.trackObject('toolbarObjects', this.add.rectangle(848, 400, 220, 560, 0x111827, 0.97));
    panel.setStrokeStyle(2, 0x475569, 1);

    this.trackObject('toolbarObjects', this.add.text(848, 136, 'TOOLBAR', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.trackObject('toolbarObjects', this.add.text(848, 168, 'Use ingredients you purchased', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#94a3b8',
      align: 'center'
    }).setOrigin(0.5));

    this.createToolButton('frosting', 'Frosting', 848, 220);

    if (this.toppingOptions.length) {
      this.createToolButton('topping', 'Toppings', 848, 272);
    }

    if (this.hasFondant) {
      this.createToolButton('fondant', 'Fondant', 848, 324);
    }

    this.trackObject('toolbarObjects', this.add.rectangle(848, 492, 180, 250, 0x0f172a, 0.9).setStrokeStyle(1, 0x334155, 1));
  }

  createToolButton(key, label, x, y) {
    const rect = this.trackObject('toolbarObjects', this.add.rectangle(x, y, 150, 36, 0x1e293b, 1));
    rect.setStrokeStyle(2, 0x475569, 1);
    rect.setInteractive({ useHandCursor: true });

    const text = this.trackObject('toolbarObjects', this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#e2e8f0',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    rect.on('pointerdown', () => {
      this.selectedTool = key;
      this.refreshToolbar();
      this.refreshTelemetry();
    });

    this.toolButtons.push({ key, rect, text });
  }

  refreshToolbar() {
    this.toolButtons.forEach((button) => {
      const isActive = button.key === this.selectedTool;
      button.rect.setFillStyle(isActive ? 0x2563eb : 0x1e293b, 1);
      button.rect.setStrokeStyle(2, isActive ? 0x93c5fd : 0x475569, 1);
      button.text.setColor(isActive ? '#f8fafc' : '#e2e8f0');
    });

    this.clearTrackedObjects('dynamicToolbarObjects');

    this.trackObject('dynamicToolbarObjects', this.add.text(848, 374, this.selectedTool === 'frosting'
      ? 'Colors & Patterns'
      : (this.selectedTool === 'fondant' ? 'Shape & Color' : 'Pick a Topping'), {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    if (this.selectedTool === 'frosting') {
      this.renderColorSwatches(this.frostingColors, this.selectedFrostingColor, 790, 418, (key) => {
        this.selectedFrostingColor = key;
        this.refreshToolbar();
      });
      this.renderOptionPills(this.frostingPatterns, this.selectedPattern, 848, 474, 2, (key) => {
        this.selectedPattern = key;
        this.refreshToolbar();
      });

      if (this.hasPipingTips) {
        this.trackObject('dynamicToolbarObjects', this.add.text(848, 598, 'Piping tips bonus: deluxe patterns unlocked', {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: '#fde68a',
          align: 'center',
          wordWrap: { width: 164 }
        }).setOrigin(0.5));
      }
    } else if (this.selectedTool === 'fondant' && this.hasFondant) {
      const shapeOptions = [
        { key: 'rectangle', label: 'Ribbon' },
        { key: 'circle', label: 'Medallion' }
      ];

      this.renderOptionPills(shapeOptions, this.selectedFondantShape, 848, 420, 2, (key) => {
        this.selectedFondantShape = key;
        this.refreshToolbar();
      });
      this.renderColorSwatches(this.fondantColors, this.selectedFondantColor, 790, 492, (key) => {
        this.selectedFondantColor = key;
        this.refreshToolbar();
      });

      this.trackObject('dynamicToolbarObjects', this.add.text(848, 600, this.hasFoodColoring
        ? 'Food coloring bonus: extra fondant colors available'
        : 'Click and drag to stretch the fondant piece', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#cbd5e1',
        align: 'center',
        wordWrap: { width: 164 }
      }).setOrigin(0.5));
    } else if (this.selectedTool === 'topping') {
      this.renderOptionPills(this.toppingOptions, this.selectedTopping, 848, 438, 1, (key) => {
        this.selectedTopping = key;
        this.refreshToolbar();
      }, 150, 34);

      this.trackObject('dynamicToolbarObjects', this.add.text(848, 560, 'Click anywhere on the cake to place the selected topping.', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#cbd5e1',
        align: 'center',
        wordWrap: { width: 164 }
      }).setOrigin(0.5));
    }
  }

  renderColorSwatches(colors, activeKey, startX, startY, onSelect) {
    colors.forEach((color, index) => {
      const x = startX + ((index % 3) * 58);
      const y = startY + (Math.floor(index / 3) * 54);
      const swatch = this.trackObject('dynamicToolbarObjects', this.add.circle(x, y, 17, color.value, 1));
      swatch.setStrokeStyle(3, color.key === activeKey ? 0xf8fafc : 0x475569, 1);
      swatch.setInteractive({ useHandCursor: true });
      swatch.on('pointerdown', () => onSelect(color.key));

      this.trackObject('dynamicToolbarObjects', this.add.text(x, y + 28, color.label, {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#cbd5e1',
        align: 'center'
      }).setOrigin(0.5));
    });
  }

  renderOptionPills(options, activeKey, centerX, startY, columns, onSelect, width = 74, height = 30) {
    options.forEach((option, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = columns === 1
        ? centerX
        : centerX - (((columns - 1) * (width + 10)) / 2) + (column * (width + 10));
      const y = startY + (row * (height + 12));
      const isActive = option.key === activeKey;

      const rect = this.trackObject('dynamicToolbarObjects', this.add.rectangle(x, y, width, height, isActive ? 0x2563eb : 0x1e293b, 1));
      rect.setStrokeStyle(2, isActive ? 0x93c5fd : 0x475569, 1);
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerdown', () => onSelect(option.key));

      this.trackObject('dynamicToolbarObjects', this.add.text(x, y, option.label, {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: isActive ? '#f8fafc' : '#e2e8f0',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: width - 10 }
      }).setOrigin(0.5));
    });
  }

  createStatsPanel() {
    const panel = this.trackObject('persistentObjects', this.add.rectangle(374, 632, 642, 108, 0x111827, 0.92));
    panel.setStrokeStyle(2, 0x334155, 1);

    this.coverageText = this.trackObject('persistentObjects', this.add.text(92, 596, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }));

    this.varietyText = this.trackObject('persistentObjects', this.add.text(92, 624, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }));

    this.similarityText = this.trackObject('persistentObjects', this.add.text(344, 596, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#fde68a',
      fontStyle: 'bold'
    }));

    this.scorePreviewText = this.trackObject('persistentObjects', this.add.text(344, 624, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#86efac',
      fontStyle: 'bold'
    }));

    this.selectionText = this.trackObject('persistentObjects', this.add.text(92, 652, '', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#cbd5e1',
      wordWrap: { width: 410 }
    }));

    this.chaosText = this.trackObject('persistentObjects', this.add.text(642, 602, 'Chaos: none', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#94a3b8',
      align: 'right',
      wordWrap: { width: 150 }
    }).setOrigin(1, 0));
  }

  setupInputHandlers() {
    this._pointerDownHandler = (pointer) => {
      if (this.isComplete || this.isPointerOnToolbar(pointer)) {
        return;
      }

      const point = this.getDecoratingPoint(pointer);
      if (!point) {
        return;
      }

      if (this.selectedTool === 'frosting') {
        this.beginFrosting(point);
      } else if (this.selectedTool === 'topping' && this.selectedTopping) {
        this.placeTopping(point);
      } else if (this.selectedTool === 'fondant' && this.hasFondant) {
        this.beginFondant(point);
      }
    };

    this._pointerMoveHandler = (pointer) => {
      if (this.isComplete || this.isPointerOnToolbar(pointer)) {
        return;
      }

      const point = this.getDecoratingPoint(pointer, true);
      if (!point) {
        return;
      }

      if (this.isDrawingFrosting) {
        this.drawFrostingSegment(point);
      } else if (this.isDraggingFondant) {
        this.updateFondantPreview(point);
      }
    };

    this._pointerUpHandler = (pointer) => {
      if (this.isDrawingFrosting) {
        this.isDrawingFrosting = false;
        this.lastPointerPoint = null;
      }

      if (this.isDraggingFondant) {
        const point = this.getDecoratingPoint(pointer, true) || this.fondantStartPoint;
        this.finishFondant(point);
      }
    };

    this.input.on('pointerdown', this._pointerDownHandler);
    this.input.on('pointermove', this._pointerMoveHandler);
    this.input.on('pointerup', this._pointerUpHandler);
    this.input.on('pointerupoutside', this._pointerUpHandler);
  }

  isPointerOnToolbar(pointer) {
    return pointer.x >= 734;
  }

  getDecoratingPoint(pointer, allowProjection = false) {
    const jitter = this.pointerJitter > 0
      ? {
        x: Phaser.Math.Between(-this.pointerJitter, this.pointerJitter),
        y: Phaser.Math.Between(-this.pointerJitter, this.pointerJitter)
      }
      : { x: 0, y: 0 };

    const rawPoint = {
      x: pointer.x + jitter.x,
      y: pointer.y + jitter.y + this.decorationDrop
    };

    if (this.isWithinCake(rawPoint.x, rawPoint.y)) {
      return rawPoint;
    }

    if (!allowProjection) {
      return null;
    }

    const projected = {
      x: Phaser.Math.Clamp(rawPoint.x, this.cakeCenterX - (this.cakeWidth / 2), this.cakeCenterX + (this.cakeWidth / 2)),
      y: Phaser.Math.Clamp(rawPoint.y, this.cakeTopCenterY - (this.cakeTopHeight / 2), this.cakeBodyY + this.cakeBodyHeight)
    };

    return this.isWithinCake(projected.x, projected.y) ? projected : null;
  }

  isWithinCake(x, y) {
    const inBody = x >= this.cakeCenterX - (this.cakeWidth / 2)
      && x <= this.cakeCenterX + (this.cakeWidth / 2)
      && y >= this.cakeBodyY
      && y <= this.cakeBodyY + this.cakeBodyHeight;

    const radiusX = this.cakeWidth / 2;
    const radiusY = this.cakeTopHeight / 2;
    const dx = (x - this.cakeCenterX) / radiusX;
    const dy = (y - this.cakeTopCenterY) / radiusY;
    const inTop = (dx * dx) + (dy * dy) <= 1;

    return inBody || inTop;
  }

  getCakeBandForY(y) {
    if (y <= this.cakeTopCenterY - 8) {
      return 'top';
    }
    if (y <= this.cakeBodyY + 66) {
      return 'middle';
    }
    return 'bottom';
  }

  markBand(y) {
    this.decoratedBands.add(this.getCakeBandForY(y));
  }

  beginFrosting(point) {
    this.isDrawingFrosting = true;
    this.lastPointerPoint = point;
    this.registerDecorationUse(`frosting-${this.selectedPattern}`, this.selectedFrostingColor);
    this.drawFrostingMark(point, point);
    this.refreshTelemetry();
  }

  drawFrostingSegment(point) {
    if (!this.lastPointerPoint) {
      this.lastPointerPoint = point;
      return;
    }

    this.drawFrostingMark(this.lastPointerPoint, point);
    this.lastPointerPoint = point;
    this.refreshTelemetry();
  }

  drawFrostingMark(start, end) {
    switch (this.selectedPattern) {
      case 'zigzag':
        this.drawZigzagFrosting(start, end);
        break;
      case 'dots':
        this.drawDotFrosting(start, end, false);
        break;
      case 'rosette':
        this.drawRosetteFrosting(start, end);
        break;
      case 'border':
        this.drawDotFrosting(start, end, true);
        break;
      case 'straight':
      default:
        this.drawStraightFrosting(start, end);
        break;
    }
  }

  getBrushWidth() {
    let width = this.selectedPattern === 'straight' ? 10 : 9;
    if (this.selectedPattern === 'rosette' || this.selectedPattern === 'border') {
      width = 11;
    }
    if (this.meltActive) {
      width += 4;
    }
    return width;
  }

  getBrushAlpha() {
    return this.meltActive ? 0.7 : 0.92;
  }

  drawStraightFrosting(start, end) {
    const color = this.getColorValue(this.selectedFrostingColor);
    const width = this.getBrushWidth();

    this.decorationGraphics.lineStyle(width, color, this.getBrushAlpha());
    this.decorationGraphics.beginPath();
    this.decorationGraphics.moveTo(start.x, start.y);
    this.decorationGraphics.lineTo(end.x, end.y);
    this.decorationGraphics.strokePath();

    this.markCoverageSegment(start.x, start.y, end.x, end.y, width * 0.75);
  }

  drawZigzagFrosting(start, end) {
    const color = this.getColorValue(this.selectedFrostingColor);
    const width = this.getBrushWidth();
    const distance = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
    const steps = Math.max(2, Math.ceil(distance / 16));
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.max(distance, 1);
    const perpX = -dy / length;
    const perpY = dx / length;

    this.decorationGraphics.lineStyle(width - 1, color, this.getBrushAlpha());
    this.decorationGraphics.beginPath();
    this.decorationGraphics.moveTo(start.x, start.y);

    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const offset = (step % 2 === 0 ? 1 : -1) * 8;
      const px = start.x + (dx * t) + (perpX * offset);
      const py = start.y + (dy * t) + (perpY * offset);
      this.decorationGraphics.lineTo(px, py);
      this.markCoverageCircle(px, py, width);
    }

    this.decorationGraphics.strokePath();
    this.markCoverageSegment(start.x, start.y, end.x, end.y, width * 0.6);
  }

  drawDotFrosting(start, end, scalloped) {
    const color = this.getColorValue(this.selectedFrostingColor);
    const distance = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
    const steps = Math.max(1, Math.ceil(distance / 12));

    for (let step = 0; step <= steps; step += 1) {
      const t = step / Math.max(steps, 1);
      const x = Phaser.Math.Linear(start.x, end.x, t);
      const y = Phaser.Math.Linear(start.y, end.y, t);
      const radius = scalloped ? (step % 2 === 0 ? 6 : 4) : 4;

      this.decorationGraphics.fillStyle(color, this.getBrushAlpha());
      this.decorationGraphics.fillCircle(x, y, radius + (this.meltActive ? 1 : 0));
      this.markCoverageCircle(x, y, radius + 5);
    }
  }

  drawRosetteFrosting(start, end) {
    const distance = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
    const steps = Math.max(1, Math.ceil(distance / 18));

    for (let step = 0; step <= steps; step += 1) {
      const t = step / Math.max(steps, 1);
      const x = Phaser.Math.Linear(start.x, end.x, t);
      const y = Phaser.Math.Linear(start.y, end.y, t);
      this.drawRosetteAt(x, y, this.getColorValue(this.selectedFrostingColor));
      this.markCoverageCircle(x, y, 12);
    }
  }

  drawRosetteAt(x, y, color) {
    this.decorationGraphics.fillStyle(color, this.getBrushAlpha());
    this.decorationGraphics.fillCircle(x, y, 5 + (this.meltActive ? 1 : 0));
    this.decorationGraphics.fillCircle(x - 5, y + 4, 4);
    this.decorationGraphics.fillCircle(x + 5, y + 4, 4);
    this.decorationGraphics.fillCircle(x, y + 8, 3);
  }

  beginFondant(point) {
    this.isDraggingFondant = true;
    this.fondantStartPoint = point;
    this.previewGraphics.clear();
  }

  updateFondantPreview(point) {
    if (!this.fondantStartPoint) {
      return;
    }

    const color = this.getColorValue(this.selectedFondantColor);
    this.previewGraphics.clear();
    this.previewGraphics.lineStyle(2, 0xffffff, 0.8);
    this.previewGraphics.fillStyle(color, 0.32);

    if (this.selectedFondantShape === 'circle') {
      const radiusX = Math.max(12, Math.abs(point.x - this.fondantStartPoint.x) / 2);
      const radiusY = Math.max(12, Math.abs(point.y - this.fondantStartPoint.y) / 2);
      const centerX = (point.x + this.fondantStartPoint.x) / 2;
      const centerY = (point.y + this.fondantStartPoint.y) / 2;
      this.previewGraphics.fillEllipse(centerX, centerY, radiusX * 2, radiusY * 2);
      this.previewGraphics.strokeEllipse(centerX, centerY, radiusX * 2, radiusY * 2);
    } else {
      const x = Math.min(point.x, this.fondantStartPoint.x);
      const y = Math.min(point.y, this.fondantStartPoint.y);
      const width = Math.max(20, Math.abs(point.x - this.fondantStartPoint.x));
      const height = Math.max(16, Math.abs(point.y - this.fondantStartPoint.y));
      this.previewGraphics.fillRoundedRect(x, y, width, height, 8);
      this.previewGraphics.strokeRoundedRect(x, y, width, height, 8);
    }
  }

  finishFondant(point) {
    if (!this.fondantStartPoint) {
      this.isDraggingFondant = false;
      this.previewGraphics.clear();
      return;
    }

    const color = this.getColorValue(this.selectedFondantColor);
    const start = this.fondantStartPoint;
    const end = point || start;

    this.previewGraphics.clear();
    this.decorationGraphics.fillStyle(color, 0.92);
    this.decorationGraphics.lineStyle(2, 0xffffff, 0.2);

    if (this.selectedFondantShape === 'circle') {
      const centerX = (start.x + end.x) / 2;
      const centerY = (start.y + end.y) / 2;
      const radiusX = Math.max(14, Math.abs(end.x - start.x) / 2);
      const radiusY = Math.max(14, Math.abs(end.y - start.y) / 2);
      this.decorationGraphics.fillEllipse(centerX, centerY, radiusX * 2, radiusY * 2);
      this.decorationGraphics.strokeEllipse(centerX, centerY, radiusX * 2, radiusY * 2);
      this.markCoverageEllipse(centerX, centerY, radiusX, radiusY);
      this.markBand(centerY);
      this.registerDecorationUse('fondant-circle', this.selectedFondantColor);
    } else {
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const width = Math.max(26, Math.abs(end.x - start.x));
      const height = Math.max(18, Math.abs(end.y - start.y));
      this.decorationGraphics.fillRoundedRect(x, y, width, height, 8);
      this.decorationGraphics.strokeRoundedRect(x, y, width, height, 8);
      this.markCoverageRect(x, y, width, height);
      this.markBand(y + (height / 2));
      this.registerDecorationUse('fondant-rectangle', this.selectedFondantColor);
    }

    this.isDraggingFondant = false;
    this.fondantStartPoint = null;
    this.refreshTelemetry();
  }

  placeTopping(point) {
    const option = this.toppingOptions.find((entry) => entry.key === this.selectedTopping);
    if (!option) {
      return;
    }

    const x = point.x;
    const y = point.y;

    switch (option.key) {
      case 'fruit-slice':
        this.drawFruitSlice(x, y);
        this.markCoverageCircle(x, y, 18);
        break;
      case 'berry':
        this.drawBerry(x, y);
        this.markCoverageCircle(x, y, 16);
        break;
      case 'chip':
        this.drawChocolateChip(x, y);
        this.markCoverageCircle(x, y, 12);
        break;
      case 'shard':
        this.drawChocolateShard(x, y);
        this.markCoverageCircle(x, y, 15);
        break;
      default:
        return;
    }

    this.markBand(y);
    this.registerDecorationUse(`topping-${option.key}`, option.colorKey);
    this.refreshTelemetry();
  }

  drawFruitSlice(x, y) {
    this.decorationGraphics.fillStyle(0xff6b6b, 1);
    this.decorationGraphics.fillTriangle(x - 14, y + 10, x, y - 12, x + 16, y + 8);
    this.decorationGraphics.fillStyle(0xffffff, 0.85);
    this.decorationGraphics.fillTriangle(x - 9, y + 6, x - 1, y - 6, x + 9, y + 5);
    this.decorationGraphics.fillStyle(0x22c55e, 1);
    this.decorationGraphics.fillTriangle(x - 2, y - 12, x + 5, y - 18, x + 4, y - 8);
  }

  drawBerry(x, y) {
    this.decorationGraphics.fillStyle(0x60a5fa, 1);
    this.decorationGraphics.fillCircle(x, y, 8);
    this.decorationGraphics.fillCircle(x - 6, y + 4, 5);
    this.decorationGraphics.fillCircle(x + 6, y + 4, 5);
    this.decorationGraphics.fillStyle(0x22c55e, 1);
    this.decorationGraphics.fillTriangle(x - 2, y - 8, x + 2, y - 8, x, y - 14);
  }

  drawChocolateChip(x, y) {
    this.decorationGraphics.fillStyle(0x3f2a20, 1);
    this.decorationGraphics.fillCircle(x, y, 6);
    this.decorationGraphics.fillStyle(0x8b5e3c, 0.5);
    this.decorationGraphics.fillCircle(x - 2, y - 2, 2);
  }

  drawChocolateShard(x, y) {
    this.decorationGraphics.fillStyle(0x7c4a2d, 1);
    this.decorationGraphics.fillTriangle(x - 12, y + 8, x, y - 10, x + 10, y + 6);
    this.decorationGraphics.fillStyle(0x4a2d1f, 0.45);
    this.decorationGraphics.fillTriangle(x - 4, y + 4, x + 1, y - 6, x + 4, y + 2);
  }

  registerDecorationUse(typeKey, colorKey) {
    this.usedDecorationTypes.add(typeKey);
    if (colorKey) {
      this.usedColors.add(colorKey);
    }
  }

  markCoverageSegment(x1, y1, x2, y2, radius) {
    const distance = Phaser.Math.Distance.Between(x1, y1, x2, y2);
    const steps = Math.max(1, Math.ceil(distance / Math.max(radius * 0.6, 6)));

    for (let step = 0; step <= steps; step += 1) {
      const t = step / Math.max(steps, 1);
      const x = Phaser.Math.Linear(x1, x2, t);
      const y = Phaser.Math.Linear(y1, y2, t);
      this.markCoverageCircle(x, y, radius);
    }
  }

  markCoverageCircle(cx, cy, radius) {
    this.coverageCells.forEach((cell) => {
      if (cell.filled) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(cx, cy, cell.x, cell.y);
      if (distance <= radius) {
        cell.filled = true;
        this.filledCakeCells += 1;
      }
    });

    this.markBand(cy);
  }

  markCoverageRect(x, y, width, height) {
    this.coverageCells.forEach((cell) => {
      if (!cell.filled && cell.x >= x && cell.x <= x + width && cell.y >= y && cell.y <= y + height) {
        cell.filled = true;
        this.filledCakeCells += 1;
      }
    });
  }

  markCoverageEllipse(cx, cy, radiusX, radiusY) {
    this.coverageCells.forEach((cell) => {
      if (cell.filled) {
        return;
      }

      const dx = (cell.x - cx) / Math.max(radiusX, 1);
      const dy = (cell.y - cy) / Math.max(radiusY, 1);
      if ((dx * dx) + (dy * dy) <= 1) {
        cell.filled = true;
        this.filledCakeCells += 1;
      }
    });
  }

  getColorValue(key) {
    return this.colorLookup[key] || 0xf8fafc;
  }

  calculateCoverageRatio() {
    if (!this.totalCakeCells) {
      return 0;
    }

    return Phaser.Math.Clamp(this.filledCakeCells / this.totalCakeCells, 0, 1);
  }

  calculateVarietyRatio() {
    if (!this.availableDecorationTypes.length) {
      return 1;
    }

    return Phaser.Math.Clamp(this.usedDecorationTypes.size / this.availableDecorationTypes.length, 0, 1);
  }

  calculateSimilarityRatio() {
    const coverageRatio = this.calculateCoverageRatio();
    const targetCoverageMatch = 1 - Math.min(1, Math.abs(coverageRatio - this.referenceSpec.targetCoverage) / Math.max(this.referenceSpec.targetCoverage, 0.18));

    const paletteMatches = this.referenceSpec.paletteKeys.filter((key) => this.usedColors.has(key)).length;
    const paletteRatio = this.referenceSpec.paletteKeys.length
      ? paletteMatches / this.referenceSpec.paletteKeys.length
      : 1;

    const matchedBands = this.referenceSpec.targetBands.filter((band) => this.decoratedBands.has(band)).length;
    const bandRatio = this.referenceSpec.targetBands.length
      ? matchedBands / this.referenceSpec.targetBands.length
      : 1;

    const requiredTypeMatches = this.referenceSpec.requiredTypes.filter((type) => this.usedDecorationTypes.has(type)).length;
    const requiredTypeRatio = this.referenceSpec.requiredTypes.length
      ? requiredTypeMatches / this.referenceSpec.requiredTypes.length
      : 1;

    return Phaser.Math.Clamp(
      (paletteRatio * 0.3)
      + (bandRatio * 0.25)
      + (requiredTypeRatio * 0.2)
      + (targetCoverageMatch * 0.25),
      0,
      1
    );
  }

  calculateFinalScore() {
    const similarityRatio = this.calculateSimilarityRatio();
    const coverageRatio = this.calculateCoverageRatio();
    const varietyRatio = this.calculateVarietyRatio();

    let finalScore = (similarityRatio * 50) + (coverageRatio * 25) + (varietyRatio * 25);
    finalScore *= (1 - this.chaosPenalty);

    return Math.round(Phaser.Math.Clamp(finalScore, 0, 100));
  }

  refreshTelemetry() {
    const coverageRatio = this.calculateCoverageRatio();
    const varietyRatio = this.calculateVarietyRatio();
    const similarityRatio = this.calculateSimilarityRatio();
    const liveScore = this.calculateFinalScore();

    if (this.coverageText) {
      this.coverageText.setText(`Coverage: ${Math.round(coverageRatio * 100)}%`);
    }

    if (this.varietyText) {
      this.varietyText.setText(`Variety: ${Math.round(varietyRatio * 100)}% (${this.usedDecorationTypes.size}/${this.availableDecorationTypes.length || 1})`);
    }

    if (this.similarityText) {
      this.similarityText.setText(`Reference match: ${Math.round(similarityRatio * 100)}%`);
    }

    if (this.scorePreviewText) {
      this.scorePreviewText.setText(`Live score preview: ${liveScore}/100`);
    }

    if (this.selectionText) {
      const toolLabel = this.selectedTool === 'frosting'
        ? `${this.capitalize(this.selectedPattern)} ${this.selectedFrostingColor}`
        : (this.selectedTool === 'fondant'
          ? `${this.capitalize(this.selectedFondantShape)} ${this.selectedFondantColor}`
          : this.capitalize((this.selectedTopping || 'none').replace('-', ' ')));
      this.selectionText.setText(`Current tool: ${this.capitalize(this.selectedTool)} • ${toolLabel}`);
    }

    if (this.chaosText) {
      const chaosLabel = this.chaosPenalty > 0
        ? `Chaos: -${Math.round(this.chaosPenalty * 100)}%${this.gravityActive ? ' • gravity' : ''}${this.meltActive ? ' • melt' : ''}`
        : 'Chaos: none';
      this.chaosText.setText(chaosLabel);
    }
  }

  capitalize(value) {
    return value
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  updateTimer() {
    this.timeRemaining -= 1;

    if (this.timerText) {
      this.timerText.setText(`Time: ${this.timeRemaining}s`);

      if (this.timeRemaining <= 15) {
        this.timerText.setColor('#ff7b72');
      } else if (this.timeRemaining <= 45) {
        this.timerText.setColor('#fbbf24');
      }
    }

    if (this.timeRemaining <= 0) {
      this.completeMinigame();
    }
  }

  applyChaosEvents() {
    const decorateEvents = this.chaosEvents.filter((event) => {
      if (!event || !event.phase) {
        return false;
      }

      if (Array.isArray(event.phase)) {
        return event.phase.includes('decorate') || event.phase.includes('any');
      }

      return event.phase === 'decorate' || event.phase === 'any';
    });

    this.chaosPenalty = Phaser.Math.Clamp(decorateEvents.reduce((sum, event) => sum + (event.scorePenalty || 0), 0), 0, 1);

    if (!decorateEvents.length) {
      return;
    }

    if (decorateEvents.some((event) => event.key === 'frosting-melt')) {
      this.meltActive = true;
    }

    if (decorateEvents.some((event) => event.key === 'gravity')) {
      this.gravityActive = true;
      this.decorationDrop = 10;
    }

    if (decorateEvents.some((event) => event.key === 'catastrophe')) {
      this.catastropheActive = true;
      this.meltActive = true;
      this.gravityActive = true;
      this.pointerJitter = 6;
      this.decorationDrop = 14;
    }

    const overlayAlpha = this.catastropheActive ? 0.16 : (this.gravityActive || this.meltActive ? 0.08 : 0);
    if (overlayAlpha > 0) {
      this.chaosOverlay = this.trackObject('persistentObjects', this.add.rectangle(430, 402, 632, 560, 0x190b13, overlayAlpha));
      this.chaosOverlay.setDepth(2);
    }

    decorateEvents.forEach((event, index) => {
      const banner = this.trackObject('chaosBanners', this.add.text(430, 112 + (index * 34), `⚠ ${event.name} (-${Math.round((event.scorePenalty || 0) * 100)}%)`, {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#ff7b72',
        fontStyle: 'bold',
        backgroundColor: 'rgba(15,23,42,0.55)',
        padding: { x: 12, y: 4 }
      }).setOrigin(0.5).setDepth(6));

      this.tweens.add({
        targets: banner,
        alpha: 0,
        y: banner.y - 8,
        duration: 700,
        delay: 2200 + (index * 260),
        onComplete: () => {
          banner.destroy();
          this.chaosBanners = this.chaosBanners.filter((item) => item !== banner);
        }
      });
    });

    this.refreshTelemetry();
  }

  showRecipeHint() {
    const overlay = this.trackObject('persistentObjects', this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.78).setDepth(10));
    const text = this.trackObject('persistentObjects', this.add.text(512, 384, [
      '💡 RECIPE HINT 💡',
      '',
      'Match the reference palette and decorate more than one vertical band.',
      'Coverage matters, but signature techniques matter too.',
      this.hasPipingTips ? 'Piping tips bonus: extra frosting patterns can boost your variety score.' : 'Without piping tips, a clean straight frosting pass is still reliable.'
    ].join('\n'), {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#fbbf24',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setDepth(10));

    this.time.delayedCall(5000, () => {
      this.tweens.add({
        targets: [overlay, text],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          overlay.destroy();
          text.destroy();
          this.persistentObjects = this.persistentObjects.filter((item) => item !== overlay && item !== text);
        }
      });
    });
  }

  completeMinigame() {
    if (this.isComplete) {
      return;
    }

    this.isComplete = true;
    this.isDrawingFrosting = false;
    this.isDraggingFondant = false;
    this.lastPointerPoint = null;
    this.fondantStartPoint = null;

    if (this.previewGraphics) {
      this.previewGraphics.clear();
    }

    if (this.timerEvent) {
      this.timerEvent.remove();
      this.timerEvent = null;
    }

    const similarityPercent = Math.round(this.calculateSimilarityRatio() * 100);
    const coveragePercent = Math.round(this.calculateCoverageRatio() * 100);
    const varietyPercent = Math.round(this.calculateVarietyRatio() * 100);
    const finalScore = this.calculateFinalScore();

    if (this.socket) {
      this.socket.emit('baking:phase-complete', {
        teamId: this.teamId,
        phase: 'decorate',
        score: finalScore,
        details: {
          referenceCake: this.referenceSpec.label,
          similarityPercent,
          coveragePercent,
          varietyPercent,
          chaosPenalty: this.chaosPenalty,
          usedDecorationTypes: Array.from(this.usedDecorationTypes),
          usedColors: Array.from(this.usedColors),
          decoratedBands: Array.from(this.decoratedBands),
          timeRemaining: this.timeRemaining
        }
      });
    }

    this.showCompletionScreen(finalScore);
  }

  showCompletionScreen(score) {
    const similarityPercent = Math.round(this.calculateSimilarityRatio() * 100);
    const coveragePercent = Math.round(this.calculateCoverageRatio() * 100);
    const varietyPercent = Math.round(this.calculateVarietyRatio() * 100);

    this.clearTrackedObjects('completionObjects');

    const overlay = this.trackObject('completionObjects', this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.8).setDepth(12));
    const panel = this.trackObject('completionObjects', this.add.rectangle(512, 384, 620, 382, 0x111827, 0.97).setStrokeStyle(3, 0x334155, 1).setDepth(12));

    this.trackObject('completionObjects', this.add.text(512, 236, 'DECORATE COMPLETE!', {
      fontFamily: 'Arial',
      fontSize: '42px',
      color: '#fbbf24',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(13));

    this.trackObject('completionObjects', this.add.text(512, 296, `Score: ${score}/100`, {
      fontFamily: 'Arial',
      fontSize: '38px',
      color: '#86efac',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(13));

    this.trackObject('completionObjects', this.add.text(512, 356, `Reference match: ${similarityPercent}%   •   Coverage: ${coveragePercent}%`, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#f8fafc',
      align: 'center'
    }).setOrigin(0.5).setDepth(13));

    this.trackObject('completionObjects', this.add.text(512, 402, `Variety: ${varietyPercent}%   •   Styles used: ${this.usedDecorationTypes.size}`, {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#cbd5e1',
      align: 'center'
    }).setOrigin(0.5).setDepth(13));

    this.trackObject('completionObjects', this.add.text(512, 446, `Chaos penalty: -${Math.round(this.chaosPenalty * 100)}%   •   Reference: ${this.referenceSpec.label}`, {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#94a3b8',
      align: 'center',
      wordWrap: { width: 540 }
    }).setOrigin(0.5).setDepth(13));

    this.trackObject('completionObjects', this.add.text(512, 506, 'Returning to phase select...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#93c5fd',
      fontStyle: 'italic'
    }).setOrigin(0.5).setDepth(13));

    this.time.delayedCall(2500, () => {
      if (!this.isComplete) {
        return;
      }

      this.cameras.main.fade(500, 0, 0, 0);
    });

    this.completionEvent = this.time.delayedCall(3000, () => {
      this.scene.start('PhaseSelectScene', {
        socket: this.socket,
        teamId: this.teamId,
        inventory: this.inventory,
        boosts: this.boosts,
        chaosEvents: this.chaosEvents,
        cakeGoal: this.cakeGoal
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

    this.toolButtons.forEach((button) => {
      if (button && button.rect) {
        button.rect.removeAllListeners();
      }
    });
    this.toolButtons = [];

    this.clearTrackedObjects('dynamicToolbarObjects');
    this.clearTrackedObjects('toolbarObjects');
    this.clearTrackedObjects('completionObjects');
    this.clearTrackedObjects('chaosBanners');
    this.clearTrackedObjects('persistentObjects');

    this.cakeBaseGraphics = null;
    this.decorationGraphics = null;
    this.previewGraphics = null;
    this.referenceGraphics = null;
    this.chaosOverlay = null;

    this.timerText = null;
    this.instructionText = null;
    this.coverageText = null;
    this.varietyText = null;
    this.similarityText = null;
    this.scorePreviewText = null;
    this.selectionText = null;
    this.referenceTitleText = null;
    this.referenceHintText = null;
    this.chaosText = null;

    this.isDrawingFrosting = false;
    this.isDraggingFondant = false;
    this.lastPointerPoint = null;
    this.fondantStartPoint = null;
    this.coverageCells = [];
    this.totalCakeCells = 0;
    this.filledCakeCells = 0;
    this.usedDecorationTypes.clear();
    this.usedColors.clear();
    this.decoratedBands.clear();
  }
}

window.DecorateScene = DecorateScene;
