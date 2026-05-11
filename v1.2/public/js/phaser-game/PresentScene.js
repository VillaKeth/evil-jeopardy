// Evil Jeopardy 1.2 - Present Scene (Final Plating)

class PresentScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PresentScene' });

    this.socket = null;
    this.teamId = null;
    this.inventory = [];
    this.boosts = {};
    this.chaosEvents = [];
    this.cakeGoal = {};

    this.timeLimit = 60;
    this.timeRemaining = 60;
    this.timerEvent = null;
    this.completionEvent = null;
    this.isComplete = false;

    this.plateCenter = { x: 512, y: 400 };
    this.plateRadiusX = 220;
    this.plateRadiusY = 122;
    this.cakeTopCenterY = -24;
    this.cakeTopRadiusX = 122;
    this.cakeTopRadiusY = 58;

    this.chaosPenalty = 0;
    this.extraMessSpots = 0;
    this.availableGarnishes = [];
    this.backgroundOptions = [];
    this.selectedBackgroundKey = null;
    this.toolMode = 'arrange';
    this.cleanedMessCount = 0;
    this.totalMessSpots = 0;
    this.latestScoreBreakdown = null;

    this.persistentObjects = [];
    this.paletteItems = [];
    this.placedGarnishes = [];
    this.messSpots = [];
    this.backgroundCards = [];
    this.uiButtons = [];
    this.chaosBanners = [];
    this.hintObjects = [];
    this.completionObjects = [];

    this.cakeContainer = null;
    this.presentationBackdrop = null;
    this.presentationDecor = null;
    this.timerText = null;
    this.statusText = null;
    this.feedbackText = null;
    this.rotationText = null;
    this.settingText = null;
    this.modeText = null;
    this.backgroundText = null;
    this.arrangeButton = null;
    this.cleanButton = null;
    this.presentButton = null;
    this.darknessOverlay = null;

    this._dragStartHandler = null;
    this._dragHandler = null;
    this._dragEndHandler = null;
    this.rotateKeys = null;
  }

  init(data) {
    this.socket = data.socket || this.registry.get('socket') || null;
    this.teamId = data.teamId || 'unknown-team';
    this.inventory = data.inventory || this.registry.get('inventory') || [];
    this.boosts = data.boosts || {};
    this.chaosEvents = data.chaosEvents || [];
    this.cakeGoal = data.cakeGoal || this.registry.get('cakeGoal') || {};
    this.timeRemaining = 60;
    this.isComplete = false;
    this.chaosPenalty = 0;
    this.extraMessSpots = 0;
    this.selectedBackgroundKey = null;
    this.toolMode = 'arrange';
    this.cleanedMessCount = 0;
    this.totalMessSpots = 0;
    this.latestScoreBreakdown = null;

    this.persistentObjects = [];
    this.paletteItems = [];
    this.placedGarnishes = [];
    this.messSpots = [];
    this.backgroundCards = [];
    this.uiButtons = [];
    this.chaosBanners = [];
    this.hintObjects = [];
    this.completionObjects = [];
  }

  create() {
    this.cameras.main.setBackgroundColor('#0f172a');

    this.cakeTheme = this.detectCakeTheme();
    this.availableGarnishes = this.buildAvailableGarnishes();
    this.backgroundOptions = this.buildBackgroundOptions();

    this.createBackdropLayer();
    this.createHeader();
    this.createWorkSurface();
    this.createControlPanel();
    this.createBackgroundSelector();
    this.createGarnishBar();
    this.createPresentButton();
    this.applyChaosEvents();
    this.createMessSpots();
    this.setupInputHandlers();
    this.updateStatusText();

    if (this.boosts['recipe-hint'] || this.boosts.hint > 0) {
      this.showRecipeHint();
    }

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true
    });

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

  detectCakeTheme() {
    const parts = [];

    if (typeof this.cakeGoal === 'string') {
      parts.push(this.cakeGoal);
    } else if (this.cakeGoal && typeof this.cakeGoal === 'object') {
      Object.values(this.cakeGoal).forEach((value) => {
        if (typeof value === 'string') {
          parts.push(value);
        }
      });
    }

    this.inventory.forEach((item) => {
      if (typeof item === 'string') {
        parts.push(item);
        return;
      }

      if (item && typeof item === 'object') {
        ['item_key', 'key', 'name', 'type', 'flavor', 'category'].forEach((field) => {
          if (typeof item[field] === 'string') {
            parts.push(item[field]);
          }
        });
      }
    });

    const text = parts.join(' ').toLowerCase();

    if (text.includes('chocolate') || text.includes('cocoa')) {
      return {
        label: 'Chocolate Cake',
        baseColor: 0x6b3f2a,
        middleColor: 0x8a5b3d,
        frostingColor: 0xdcb38b,
        accentColor: 0x4c2f23
      };
    }

    if (text.includes('strawberry') || text.includes('berry')) {
      return {
        label: 'Berry Cake',
        baseColor: 0xe58aa5,
        middleColor: 0xf3adc1,
        frostingColor: 0xffd9e6,
        accentColor: 0xb24c74
      };
    }

    if (text.includes('banana') || text.includes('lemon') || text.includes('citrus')) {
      return {
        label: 'Sunny Cake',
        baseColor: 0xf2c14e,
        middleColor: 0xf6d97b,
        frostingColor: 0xfff1bf,
        accentColor: 0xd29d1c
      };
    }

    return {
      label: 'Vanilla Cake',
      baseColor: 0xd6b98d,
      middleColor: 0xe8cfaa,
      frostingColor: 0xf7edd9,
      accentColor: 0xc89c5d
    };
  }

  normalizeInventoryText(item) {
    if (typeof item === 'string') {
      return item.toLowerCase();
    }

    if (!item || typeof item !== 'object') {
      return '';
    }

    return ['item_key', 'key', 'name', 'type', 'flavor', 'category']
      .map((field) => (typeof item[field] === 'string' ? item[field] : ''))
      .join(' ')
      .toLowerCase();
  }

  buildAvailableGarnishes() {
    const inventoryText = this.inventory.map((item) => this.normalizeInventoryText(item)).join(' ');
    const hasFruit = /fruit|fruits|berry|strawberry|banana|citrus|lemon|orange/.test(inventoryText);
    const hasChocolate = /chocolate|cocoa|fondant/.test(inventoryText);
    const hasSprinkles = /sprinkle|food-coloring|sugar|vanilla/.test(inventoryText);

    const garnishes = [];

    if (hasSprinkles) {
      garnishes.push({ key: 'sprinkles', label: 'Sprinkles', accent: 0xff7eb6 });
    }

    if (hasFruit) {
      garnishes.push({ key: 'fruit-slices', label: 'Fruit', accent: 0xf97316 });
    }

    if (hasChocolate) {
      garnishes.push({ key: 'chocolate-shavings', label: 'Chocolate', accent: 0x7c4a2d });
    }

    if (!garnishes.length) {
      garnishes.push(
        { key: 'sprinkles', label: 'Sprinkles', accent: 0xff7eb6 },
        { key: 'fruit-slices', label: 'Fruit', accent: 0xf97316 }
      );
    } else if (garnishes.length === 1) {
      const fallback = garnishes[0].key === 'sprinkles'
        ? { key: 'fruit-slices', label: 'Fruit', accent: 0xf97316 }
        : { key: 'sprinkles', label: 'Sprinkles', accent: 0xff7eb6 };
      garnishes.push(fallback);
    }

    return garnishes;
  }

  buildBackgroundOptions() {
    return [
      { key: 'table', label: 'Table', color: 0x8b5a3c, accent: 0xc08457 },
      { key: 'stand', label: 'Stand', color: 0x7c3aed, accent: 0xc4b5fd },
      { key: 'display-case', label: 'Display', color: 0x2563eb, accent: 0xbfdbfe },
      { key: 'garden', label: 'Garden', color: 0x2f855a, accent: 0xbbf7d0 }
    ];
  }

  createBackdropLayer() {
    const bg = this.trackObject('persistentObjects', this.add.graphics());
    bg.fillGradientStyle(0x0f172a, 0x111827, 0x1e1b4b, 0x111827, 1);
    bg.fillRect(0, 0, 1024, 768);

    const frame = this.trackObject('persistentObjects', this.add.graphics());
    frame.lineStyle(2, 0xffffff, 0.06);
    frame.strokeRoundedRect(220, 118, 584, 420, 26);
    frame.strokeRoundedRect(36, 118, 166, 380, 22);
    frame.strokeRoundedRect(822, 118, 166, 292, 22);
    frame.strokeRoundedRect(230, 554, 560, 160, 26);

    this.presentationBackdrop = this.trackObject('persistentObjects', this.add.graphics());
    this.presentationDecor = this.trackObject('persistentObjects', this.add.graphics());
    this.renderSelectedBackground();
  }

  createHeader() {
    this.trackObject('persistentObjects', this.add.text(512, 24, '🎂 PRESENT PHASE', {
      fontFamily: 'Arial',
      fontSize: '38px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0));

    this.timerText = this.trackObject('persistentObjects', this.add.text(950, 30, `Time: ${this.timeRemaining}s`, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#f8fafc',
      fontStyle: 'bold'
    }).setOrigin(1, 0));

    this.trackObject('persistentObjects', this.add.text(74, 28, this.cakeTheme.label, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#f9c74f',
      fontStyle: 'bold'
    }));

    this.trackObject('persistentObjects', this.add.text(74, 58, 'Center it, garnish it, clean the plate.', {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#cbd5e1'
    }));
  }

  createWorkSurface() {
    const stageShadow = this.trackObject('persistentObjects', this.add.ellipse(512, 472, 424, 84, 0x000000, 0.24));
    stageShadow.setDepth(1);

    const stagePanel = this.trackObject('persistentObjects', this.add.rectangle(512, 332, 548, 336, 0x0f172a, 0.2));
    stagePanel.setStrokeStyle(2, 0xffffff, 0.06);
    stagePanel.setDepth(1);

    const plateShadow = this.trackObject('persistentObjects', this.add.ellipse(this.plateCenter.x, this.plateCenter.y + 142, 360, 64, 0x000000, 0.22));
    plateShadow.setDepth(2);

    const plateOuter = this.trackObject('persistentObjects', this.add.ellipse(this.plateCenter.x, this.plateCenter.y + 78, 420, 150, 0xe2e8f0, 0.95));
    plateOuter.setStrokeStyle(5, 0x94a3b8, 0.75);
    plateOuter.setDepth(3);

    const plateInner = this.trackObject('persistentObjects', this.add.ellipse(this.plateCenter.x, this.plateCenter.y + 68, 330, 104, 0xf8fafc, 1));
    plateInner.setStrokeStyle(3, 0xcbd5e1, 0.65);
    plateInner.setDepth(3);

    this.trackObject('persistentObjects', this.add.text(512, 148, 'Drag the cake, rotate it, and finish the presentation.', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#e2e8f0',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(4));

    this.feedbackText = this.trackObject('persistentObjects', this.add.text(512, 184, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#56d364',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setDepth(4));

    this.cakeContainer = this.trackObject('persistentObjects', this.add.container(this.plateCenter.x, this.plateCenter.y - 6));
    this.cakeContainer.setDepth(5);
    this.createCakeVisuals();
    this.cakeContainer.setSize(300, 240);
    this.cakeContainer.setInteractive(new Phaser.Geom.Rectangle(-150, -120, 300, 240), Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(this.cakeContainer);
  }

  createCakeVisuals() {
    const shadow = this.add.ellipse(0, 58, 210, 36, 0x000000, 0.2);
    const bottom = this.add.ellipse(0, 34, 250, 92, this.cakeTheme.baseColor, 1);
    bottom.setStrokeStyle(3, this.cakeTheme.accentColor, 0.45);

    const middle = this.add.ellipse(0, 2, 238, 90, this.cakeTheme.middleColor, 1);
    middle.setStrokeStyle(2, this.cakeTheme.accentColor, 0.3);

    const top = this.add.ellipse(0, this.cakeTopCenterY, 252, 108, this.cakeTheme.frostingColor, 1);
    top.setStrokeStyle(3, this.cakeTheme.accentColor, 0.35);

    const frostingSwirl = this.add.graphics();
    frostingSwirl.lineStyle(5, 0xffffff, 0.35);
    frostingSwirl.beginPath();
    frostingSwirl.moveTo(-72, this.cakeTopCenterY + 6);
    frostingSwirl.bezierCurveTo(-24, this.cakeTopCenterY - 24, 32, this.cakeTopCenterY - 24, 72, this.cakeTopCenterY + 8);
    frostingSwirl.strokePath();

    const highlight = this.add.ellipse(-48, this.cakeTopCenterY - 12, 72, 24, 0xffffff, 0.18);
    const centerCherry = this.add.circle(0, this.cakeTopCenterY - 30, 10, this.cakeTheme.accentColor, 0.9);

    this.cakeContainer.add([shadow, bottom, middle, top, frostingSwirl, highlight, centerCherry]);
  }

  createControlPanel() {
    this.trackObject('persistentObjects', this.add.text(119, 138, 'TOOLS', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#93c5fd',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.arrangeButton = this.createButton(119, 206, 144, 42, 'Arrange', () => {
      this.setToolMode('arrange');
    }, 'uiButtons');

    this.cleanButton = this.createButton(119, 258, 144, 42, 'Clean Up', () => {
      this.setToolMode('clean');
    }, 'uiButtons');

    this.createButton(83, 326, 70, 42, '⟲', () => {
      this.rotateCake(-0.14);
    }, 'uiButtons');

    this.createButton(155, 326, 70, 42, '⟳', () => {
      this.rotateCake(0.14);
    }, 'uiButtons');

    this.rotationText = this.trackObject('persistentObjects', this.add.text(119, 372, 'Rotation: 0°', {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#e2e8f0',
      align: 'center'
    }).setOrigin(0.5));

    this.modeText = this.trackObject('persistentObjects', this.add.text(119, 414, '', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#cbd5e1',
      align: 'center',
      wordWrap: { width: 142 }
    }).setOrigin(0.5));

    this.statusText = this.trackObject('persistentObjects', this.add.text(119, 462, '', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#cbd5e1',
      align: 'center',
      wordWrap: { width: 142 }
    }).setOrigin(0.5));

    this.updateToolButtons();
  }

  createBackgroundSelector() {
    this.trackObject('persistentObjects', this.add.text(905, 138, 'SETTING', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#93c5fd',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    const positions = [
      { x: 870, y: 220 },
      { x: 940, y: 220 },
      { x: 870, y: 300 },
      { x: 940, y: 300 }
    ];

    this.backgroundOptions.forEach((option, index) => {
      const position = positions[index];
      const card = this.add.container(position.x, position.y);
      const bg = this.add.rectangle(0, 0, 60, 56, option.color, 0.25).setStrokeStyle(2, option.accent, 0.55);
      const strip = this.add.rectangle(0, -18, 40, 6, option.accent, 0.9);
      const text = this.add.text(0, 10, option.label, {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#e2e8f0',
        align: 'center',
        wordWrap: { width: 52 }
      }).setOrigin(0.5);

      card.add([bg, strip, text]);
      card.bg = bg;
      card.optionKey = option.key;
      card.setSize(60, 56);
      card.setDepth(5);
      card.setInteractive(new Phaser.Geom.Rectangle(-30, -28, 60, 56), Phaser.Geom.Rectangle.Contains);
      card.on('pointerdown', () => {
        this.selectBackground(option.key);
      });

      this.trackObject('backgroundCards', card);
    });

    this.backgroundText = this.trackObject('persistentObjects', this.add.text(905, 364, 'No setting selected', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#cbd5e1',
      align: 'center',
      wordWrap: { width: 142 }
    }).setOrigin(0.5));

    this.updateBackgroundCards();
  }

  createGarnishBar() {
    const panel = this.trackObject('persistentObjects', this.add.rectangle(512, 634, 528, 116, 0x0f172a, 0.78));
    panel.setStrokeStyle(2, 0x334155);

    this.trackObject('persistentObjects', this.add.text(512, 580, 'GARNISH BAR', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#f9c74f',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    this.settingText = this.trackObject('persistentObjects', this.add.text(512, 608, 'Drag from the bar onto the cake. Q / E also rotate.', {
      fontFamily: 'Arial',
      fontSize: '17px',
      color: '#cbd5e1'
    }).setOrigin(0.5));

    const spacing = 132;
    const startX = 512 - (((this.availableGarnishes.length - 1) * spacing) / 2);

    this.availableGarnishes.forEach((garnish, index) => {
      const item = this.createPaletteItem(garnish, startX + (index * spacing), 658);
      this.trackObject('paletteItems', item);
    });
  }

  createPaletteItem(garnish, x, y) {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 110, 68, 0x1e293b, 0.95).setStrokeStyle(2, garnish.accent, 0.7);
    const preview = this.add.graphics();
    this.drawGarnishGraphic(preview, garnish.key, 1);
    preview.setPosition(0, -10);

    const label = this.add.text(0, 20, garnish.label, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#f8fafc'
    }).setOrigin(0.5);

    container.add([bg, preview, label]);
    container.bg = bg;
    container.garnishType = garnish.key;
    container.originX = x;
    container.originY = y;
    container.isPalette = true;
    container.setDepth(5);
    container.setSize(110, 68);
    container.setInteractive(new Phaser.Geom.Rectangle(-55, -34, 110, 68), Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(container);

    return container;
  }

  drawGarnishGraphic(graphics, garnishType, scale = 1) {
    graphics.clear();

    if (garnishType === 'sprinkles') {
      const colors = [0xff5fa2, 0xf9c74f, 0x60a5fa, 0x4ade80, 0xf97316];
      colors.forEach((color, index) => {
        const x = (-18 + (index * 9)) * scale;
        const y = ((index % 2 === 0 ? -4 : 4) + (index === 2 ? -6 : 0)) * scale;
        graphics.lineStyle(3 * scale, color, 1);
        graphics.beginPath();
        graphics.moveTo(x - (4 * scale), y - (2 * scale));
        graphics.lineTo(x + (4 * scale), y + (2 * scale));
        graphics.strokePath();
      });
      return;
    }

    if (garnishType === 'fruit-slices') {
      graphics.fillStyle(0xf97316, 1);
      graphics.fillCircle(-10 * scale, -3 * scale, 8 * scale);
      graphics.fillStyle(0xfef3c7, 1);
      graphics.fillCircle(-10 * scale, -3 * scale, 4 * scale);

      graphics.fillStyle(0xec4899, 1);
      graphics.fillCircle(10 * scale, 0, 7 * scale);
      graphics.fillStyle(0xfbcfe8, 1);
      graphics.fillCircle(10 * scale, 0, 3 * scale);
      return;
    }

    graphics.lineStyle(3 * scale, 0x4c2f23, 1);
    [-10, 0, 10].forEach((offset) => {
      graphics.beginPath();
      graphics.moveTo((offset - 6) * scale, -8 * scale);
      graphics.lineTo((offset + 5) * scale, 8 * scale);
      graphics.strokePath();
    });
  }

  createPresentButton() {
    this.presentButton = this.createButton(905, 452, 134, 52, 'PRESENT!', () => {
      this.completeMinigame();
    }, 'uiButtons');

    this.presentButton.bg.setFillStyle(0x16a34a, 0.95);
    this.presentButton.bg.setStrokeStyle(2, 0x86efac, 0.95);
    this.presentButton.label.setColor('#f8fafc');

    this.trackObject('persistentObjects', this.add.text(905, 500, 'Submit early if the cake looks ready.', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#cbd5e1',
      align: 'center',
      wordWrap: { width: 142 }
    }).setOrigin(0.5));
  }

  createButton(x, y, width, height, labelText, onClick, listName) {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, width, height, 0x1e293b, 0.92).setStrokeStyle(2, 0x64748b, 0.85);
    const label = this.add.text(0, 0, labelText, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#e2e8f0',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    container.add([bg, label]);
    container.bg = bg;
    container.label = label;
    container.setSize(width, height);
    container.setDepth(5);
    container.setInteractive(new Phaser.Geom.Rectangle(-(width / 2), -(height / 2), width, height), Phaser.Geom.Rectangle.Contains);
    container.on('pointerdown', onClick);

    return this.trackObject(listName, container);
  }

  updateToolButtons() {
    const setActiveStyle = (button, active, fillColor, strokeColor) => {
      if (!button || !button.bg) {
        return;
      }

      button.bg.setFillStyle(active ? fillColor : 0x1e293b, active ? 0.95 : 0.92);
      button.bg.setStrokeStyle(2, active ? strokeColor : 0x64748b, active ? 0.95 : 0.85);
      button.label.setColor(active ? '#0f172a' : '#e2e8f0');
    };

    setActiveStyle(this.arrangeButton, this.toolMode === 'arrange', 0xf9c74f, 0xfde68a);
    setActiveStyle(this.cleanButton, this.toolMode === 'clean', 0x93c5fd, 0xdbeafe);
  }

  setToolMode(mode) {
    this.toolMode = mode;
    this.updateToolButtons();
    this.updateStatusText();

    if (mode === 'clean') {
      this.flashFeedback('Clean the plate by clicking each mess spot.', '#93c5fd');
      return;
    }

    this.flashFeedback('Arrange the cake and drag garnish onto the frosting.', '#56d364');
  }

  selectBackground(backgroundKey) {
    this.selectedBackgroundKey = backgroundKey;
    this.renderSelectedBackground();
    this.updateBackgroundCards();
    this.updateStatusText();
    this.flashFeedback('Presentation setting updated.', '#f9c74f');
  }

  updateBackgroundCards() {
    this.backgroundCards.forEach((card) => {
      const isSelected = card.optionKey === this.selectedBackgroundKey;
      card.bg.setFillStyle(isSelected ? 0xf8fafc : 0x1e293b, isSelected ? 0.95 : 0.25);
      card.bg.setStrokeStyle(2, isSelected ? 0xf9c74f : 0x64748b, isSelected ? 1 : 0.6);
    });

    if (this.backgroundText) {
      const selected = this.backgroundOptions.find((option) => option.key === this.selectedBackgroundKey);
      this.backgroundText.setText(selected ? `Selected: ${selected.label}` : 'No setting selected');
      this.backgroundText.setColor(selected ? '#f8fafc' : '#cbd5e1');
    }
  }

  renderSelectedBackground() {
    if (!this.presentationBackdrop || !this.presentationDecor) {
      return;
    }

    const backdropX = 252;
    const backdropY = 136;
    const backdropWidth = 520;
    const backdropHeight = 240;

    this.presentationBackdrop.clear();
    this.presentationDecor.clear();

    if (!this.selectedBackgroundKey) {
      this.presentationBackdrop.fillGradientStyle(0x1e293b, 0x1e293b, 0x334155, 0x111827, 1);
      this.presentationBackdrop.fillRoundedRect(backdropX, backdropY, backdropWidth, backdropHeight, 22);
      this.presentationBackdrop.lineStyle(2, 0xffffff, 0.08);
      this.presentationBackdrop.strokeRoundedRect(backdropX, backdropY, backdropWidth, backdropHeight, 22);
      return;
    }

    if (this.selectedBackgroundKey === 'table') {
      this.presentationBackdrop.fillGradientStyle(0xf8fafc, 0xf8fafc, 0xe2e8f0, 0xcbd5e1, 1);
      this.presentationBackdrop.fillRoundedRect(backdropX, backdropY, backdropWidth, backdropHeight, 22);
      this.presentationDecor.fillStyle(0x8b5a3c, 1);
      this.presentationDecor.fillRect(backdropX, backdropY + 152, backdropWidth, 88);
      this.presentationDecor.lineStyle(3, 0xc08457, 0.7);
      this.presentationDecor.lineBetween(backdropX, backdropY + 182, backdropX + backdropWidth, backdropY + 182);
      return;
    }

    if (this.selectedBackgroundKey === 'stand') {
      this.presentationBackdrop.fillGradientStyle(0xf5f3ff, 0xf5f3ff, 0xddd6fe, 0xc4b5fd, 1);
      this.presentationBackdrop.fillRoundedRect(backdropX, backdropY, backdropWidth, backdropHeight, 22);
      this.presentationDecor.fillStyle(0xe9d5ff, 0.9);
      this.presentationDecor.fillCircle(512, backdropY + 114, 108);
      this.presentationDecor.lineStyle(5, 0x7c3aed, 0.35);
      this.presentationDecor.strokeCircle(512, backdropY + 114, 124);
      return;
    }

    if (this.selectedBackgroundKey === 'display-case') {
      this.presentationBackdrop.fillGradientStyle(0xe0f2fe, 0xe0f2fe, 0xbfdbfe, 0x7dd3fc, 1);
      this.presentationBackdrop.fillRoundedRect(backdropX, backdropY, backdropWidth, backdropHeight, 22);
      this.presentationDecor.lineStyle(3, 0x2563eb, 0.35);
      this.presentationDecor.strokeRoundedRect(backdropX + 34, backdropY + 28, backdropWidth - 68, backdropHeight - 78, 18);
      this.presentationDecor.lineBetween(backdropX + 48, backdropY + 68, backdropX + backdropWidth - 48, backdropY + 68);
      this.presentationDecor.lineBetween(backdropX + 48, backdropY + 108, backdropX + backdropWidth - 48, backdropY + 108);
      this.presentationDecor.fillStyle(0x94a3b8, 1);
      this.presentationDecor.fillRect(backdropX + 62, backdropY + 176, backdropWidth - 124, 12);
      return;
    }

    this.presentationBackdrop.fillGradientStyle(0xf0fdf4, 0xf0fdf4, 0xdcfce7, 0xbbf7d0, 1);
    this.presentationBackdrop.fillRoundedRect(backdropX, backdropY, backdropWidth, backdropHeight, 22);
    this.presentationDecor.fillStyle(0x65a30d, 1);
    this.presentationDecor.fillRect(backdropX, backdropY + 182, backdropWidth, 58);
    [320, 420, 610, 700].forEach((x) => {
      this.presentationDecor.fillStyle(0x166534, 0.9);
      this.presentationDecor.fillTriangle(x, backdropY + 194, x - 18, backdropY + 222, x + 18, backdropY + 222);
    });
  }

  createMessSpots() {
    const messCount = Phaser.Math.Between(3, 5) + this.extraMessSpots;
    this.totalMessSpots = messCount;

    for (let index = 0; index < messCount; index += 1) {
      const angle = Phaser.Math.FloatBetween(-2.7, 2.7);
      const distance = Phaser.Math.Between(120, 188);
      const x = this.plateCenter.x + (Math.cos(angle) * distance);
      const y = this.plateCenter.y + 70 + (Math.sin(angle) * distance * 0.42);
      const width = Phaser.Math.Between(28, 42);
      const height = Phaser.Math.Between(16, 28);
      const spot = this.add.ellipse(x, y, width, height, 0x7c4a2d, 0.68);
      spot.setAngle(Phaser.Math.Between(-55, 55));
      spot.setStrokeStyle(2, 0xf59e0b, 0.45);
      spot.setDepth(4);
      spot.cleaned = false;
      spot.setInteractive({ useHandCursor: true });
      spot.on('pointerdown', () => {
        this.cleanMessSpot(spot);
      });
      this.trackObject('messSpots', spot);
    }
  }

  cleanMessSpot(spot) {
    if (this.isComplete || !spot || spot.cleaned) {
      return;
    }

    if (this.toolMode !== 'clean') {
      this.flashFeedback('Switch to Clean Up before wiping the plate.', '#f97316');
      return;
    }

    spot.cleaned = true;
    spot.disableInteractive();
    this.cleanedMessCount += 1;
    this.updateStatusText();
    this.flashFeedback('Mess cleared.', '#56d364');

    this.tweens.add({
      targets: spot,
      alpha: 0,
      scaleX: 0.1,
      scaleY: 0.1,
      duration: 180,
      onComplete: () => {
        if (spot && spot.destroy) {
          spot.destroy();
        }
      }
    });
  }

  setupInputHandlers() {
    this.rotateKeys = this.input.keyboard.addKeys({
      rotateLeft: Phaser.Input.Keyboard.KeyCodes.Q,
      rotateRight: Phaser.Input.Keyboard.KeyCodes.E,
      altLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
      altRight: Phaser.Input.Keyboard.KeyCodes.RIGHT
    });

    this._dragStartHandler = (pointer, gameObject) => {
      if (this.isComplete || !gameObject) {
        return;
      }

      if (gameObject === this.cakeContainer) {
        gameObject.setScale(1.03);
        this.setToolMode('arrange');
        return;
      }

      if (gameObject.isPalette) {
        gameObject.setDepth(9);
        gameObject.setAlpha(0.9);
        this.setToolMode('arrange');
        return;
      }

      if (gameObject.isPlacedGarnish) {
        gameObject.setDepth(8);
        gameObject.setScale(1.12);
        this.setToolMode('arrange');
      }
    };

    this._dragHandler = (pointer, gameObject, dragX, dragY) => {
      if (this.isComplete || !gameObject) {
        return;
      }

      if (gameObject === this.cakeContainer) {
        gameObject.x = Phaser.Math.Clamp(dragX, this.plateCenter.x - 88, this.plateCenter.x + 88);
        gameObject.y = Phaser.Math.Clamp(dragY, this.plateCenter.y - 72, this.plateCenter.y + 44);
        this.syncPlacedGarnishes();
        this.updateStatusText();
        return;
      }

      gameObject.x = Phaser.Math.Clamp(dragX, 230, 790);
      gameObject.y = Phaser.Math.Clamp(dragY, 150, 702);
    };

    this._dragEndHandler = (pointer, gameObject) => {
      if (!gameObject) {
        return;
      }

      if (gameObject === this.cakeContainer) {
        gameObject.setScale(1);
        this.syncPlacedGarnishes();
        this.updateStatusText();
        return;
      }

      if (gameObject.isPalette) {
        const shouldPlace = this.isWithinPlate(pointer.x, pointer.y) || this.isPointNearCake(pointer.x, pointer.y);

        gameObject.setPosition(gameObject.originX, gameObject.originY);
        gameObject.setDepth(5);
        gameObject.setAlpha(1);

        if (shouldPlace) {
          this.createPlacedGarnish(gameObject.garnishType, pointer.x, pointer.y);
          this.updateStatusText();
          this.flashFeedback('Garnish placed.', '#56d364');
        } else {
          this.flashFeedback('Drop the garnish onto the cake or plate area.', '#f97316');
        }

        return;
      }

      if (gameObject.isPlacedGarnish) {
        gameObject.setScale(1);
        const snapped = this.snapWorldPointToCake(gameObject.x, gameObject.y);
        gameObject.localX = snapped.x;
        gameObject.localY = snapped.y;
        this.syncSingleGarnishPosition(gameObject);
        this.updateStatusText();
      }
    };

    this.input.on('dragstart', this._dragStartHandler);
    this.input.on('drag', this._dragHandler);
    this.input.on('dragend', this._dragEndHandler);
  }

  createPlacedGarnish(garnishType, worldX, worldY) {
    const localPoint = this.snapWorldPointToCake(worldX, worldY);
    const garnish = this.add.container(0, 0);
    const graphic = this.add.graphics();
    this.drawGarnishGraphic(graphic, garnishType, 0.82);
    garnish.add(graphic);
    garnish.isPlacedGarnish = true;
    garnish.garnishType = garnishType;
    garnish.localX = localPoint.x;
    garnish.localY = localPoint.y;
    garnish.setDepth(6);
    garnish.setSize(36, 36);
    garnish.setInteractive(new Phaser.Geom.Rectangle(-18, -18, 36, 36), Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(garnish);
    this.trackObject('placedGarnishes', garnish);
    this.syncSingleGarnishPosition(garnish);
    return garnish;
  }

  worldToCakeLocal(worldX, worldY) {
    const dx = worldX - this.cakeContainer.x;
    const dy = worldY - this.cakeContainer.y;
    const cos = Math.cos(-this.cakeContainer.rotation);
    const sin = Math.sin(-this.cakeContainer.rotation);

    return {
      x: (dx * cos) - (dy * sin),
      y: (dx * sin) + (dy * cos)
    };
  }

  cakeLocalToWorld(localX, localY) {
    const cos = Math.cos(this.cakeContainer.rotation);
    const sin = Math.sin(this.cakeContainer.rotation);

    return {
      x: this.cakeContainer.x + ((localX * cos) - (localY * sin)),
      y: this.cakeContainer.y + ((localX * sin) + (localY * cos))
    };
  }

  snapWorldPointToCake(worldX, worldY) {
    const local = this.worldToCakeLocal(worldX, worldY);
    const dx = local.x;
    const dy = local.y - this.cakeTopCenterY;
    const ratio = Math.sqrt(((dx * dx) / (this.cakeTopRadiusX * this.cakeTopRadiusX)) + ((dy * dy) / (this.cakeTopRadiusY * this.cakeTopRadiusY))) || 0;

    if (ratio <= 1) {
      return local;
    }

    return {
      x: dx / ratio,
      y: this.cakeTopCenterY + (dy / ratio)
    };
  }

  syncSingleGarnishPosition(garnish) {
    if (!garnish || !garnish.scene) {
      return;
    }

    const world = this.cakeLocalToWorld(garnish.localX, garnish.localY);
    garnish.setPosition(world.x, world.y);
    garnish.setRotation(this.cakeContainer.rotation);
  }

  syncPlacedGarnishes() {
    this.placedGarnishes.forEach((garnish) => {
      this.syncSingleGarnishPosition(garnish);
    });
  }

  isWithinPlate(x, y) {
    const dx = (x - this.plateCenter.x) / this.plateRadiusX;
    const dy = (y - (this.plateCenter.y + 70)) / this.plateRadiusY;
    return ((dx * dx) + (dy * dy)) <= 1.15;
  }

  isPointNearCake(x, y) {
    const local = this.worldToCakeLocal(x, y);
    const dx = local.x / (this.cakeTopRadiusX + 32);
    const dy = (local.y - this.cakeTopCenterY) / (this.cakeTopRadiusY + 20);
    return ((dx * dx) + (dy * dy)) <= 1;
  }

  rotateCake(amount) {
    if (this.isComplete || !this.cakeContainer) {
      return;
    }

    this.cakeContainer.rotation = Phaser.Math.Angle.Wrap(this.cakeContainer.rotation + amount);
    this.syncPlacedGarnishes();
    this.updateStatusText();
  }

  updateStatusText() {
    if (this.rotationText) {
      const rotationDegrees = Math.round(Phaser.Math.RadToDeg(this.cakeContainer ? this.cakeContainer.rotation : 0));
      this.rotationText.setText(`Rotation: ${rotationDegrees}°`);
    }

    if (this.modeText) {
      this.modeText.setText(this.toolMode === 'clean'
        ? 'Mode: Clean up drips and smudges.'
        : 'Mode: Arrange cake and garnish.');
    }

    if (this.statusText) {
      this.statusText.setText([
        `Clean: ${this.cleanedMessCount}/${this.totalMessSpots}`,
        `Garnish: ${this.getActivePlacedGarnishes().length}`,
        `Setting: ${this.selectedBackgroundKey ? '✓' : '—'}`
      ].join('\n'));
    }

    if (this.settingText) {
      this.settingText.setText(this.selectedBackgroundKey
        ? 'Drag garnish to the cake, then click PRESENT when ready.'
        : 'Pick a setting, then finish the plate and present.');
    }
  }

  flashFeedback(message, color = '#56d364') {
    if (!this.feedbackText) {
      return;
    }

    this.feedbackText.setAlpha(1);
    this.feedbackText.setText(message);
    this.feedbackText.setColor(color);

    this.tweens.killTweensOf(this.feedbackText);
    this.tweens.add({
      targets: this.feedbackText,
      alpha: 0.25,
      duration: 1400,
      ease: 'Sine.easeOut'
    });
  }

  showRecipeHint() {
    const overlay = this.trackObject('hintObjects', this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.74).setDepth(12));
    const hintText = this.trackObject('hintObjects', this.add.text(512, 384, [
      '💡 PRESENT HINT 💡',
      '',
      'Center the cake before decorating.',
      'Use the Clean Up tool to remove every mess spot.',
      'A chosen background plus balanced garnish spacing raises the score.'
    ].join('\n'), {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#fde68a',
      align: 'center',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(13));

    this.time.delayedCall(3600, () => {
      this.tweens.add({
        targets: [overlay, hintText],
        alpha: 0,
        duration: 350,
        onComplete: () => {
          this.clearTrackedObjects('hintObjects');
        }
      });
    });
  }

  updateTimer() {
    if (this.isComplete) {
      return;
    }

    this.timeRemaining -= 1;

    if (this.timerText) {
      this.timerText.setText(`Time: ${this.timeRemaining}s`);

      if (this.timeRemaining <= 10) {
        this.timerText.setColor('#f87171');
      } else if (this.timeRemaining <= 25) {
        this.timerText.setColor('#fbbf24');
      }
    }

    if (this.timeRemaining <= 0) {
      this.completeMinigame();
    }
  }

  applyChaosEvents() {
    const presentEvents = this.chaosEvents.filter((event) => {
      if (!event || !event.phase) {
        return false;
      }

      if (Array.isArray(event.phase)) {
        return event.phase.includes('present') || event.phase.includes('any');
      }

      return event.phase === 'present' || event.phase === 'any';
    });

    this.chaosPenalty = Phaser.Math.Clamp(presentEvents.reduce((sum, event) => {
      return sum + (event.scorePenalty || 0);
    }, 0), 0, 1);

    this.extraMessSpots = Math.min(2, presentEvents.filter((event) => {
      const name = `${event.key || ''} ${event.name || ''}`.toLowerCase();
      return /mess|spill|smudge|drip|sticky/.test(name);
    }).length);

    if (!presentEvents.length) {
      return;
    }

    if (presentEvents.some((event) => {
      const name = `${event.key || ''} ${event.name || ''}`.toLowerCase();
      return /power|dark|outage|blackout/.test(name);
    })) {
      this.darknessOverlay = this.trackObject('persistentObjects', this.add.rectangle(512, 384, 1024, 768, 0x020617, 0.12));
      this.darknessOverlay.setDepth(2);
    }

    presentEvents.forEach((event, index) => {
      const banner = this.trackObject('chaosBanners', this.add.text(512, 108 + (index * 32), `⚠ ${event.name} (-${Math.round((event.scorePenalty || 0) * 100)}%)`, {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#fca5a5',
        fontStyle: 'bold',
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        padding: { x: 10, y: 4 }
      }).setOrigin(0.5).setDepth(7));

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

  getActivePlacedGarnishes() {
    return this.placedGarnishes.filter((garnish) => garnish && garnish.scene);
  }

  calculateGarnishMetrics() {
    const garnishes = this.getActivePlacedGarnishes();
    const garnishCount = garnishes.length;
    const uniqueTypes = new Set(garnishes.map((garnish) => garnish.garnishType)).size;
    const varietyBase = Math.min(this.availableGarnishes.length, 3) || 1;
    const varietyScore = Phaser.Math.Clamp((uniqueTypes / varietyBase) * 100, 0, 100);
    const coverageScore = Phaser.Math.Clamp((garnishCount / 5) * 100, 0, 100);

    let spacingScore = garnishCount === 1 ? 40 : 0;
    let balanceScore = 0;

    if (garnishCount >= 2) {
      const nearestDistances = garnishes.map((garnish, index) => {
        let nearest = Number.POSITIVE_INFINITY;

        garnishes.forEach((other, otherIndex) => {
          if (index === otherIndex) {
            return;
          }

          const distance = Phaser.Math.Distance.Between(garnish.localX, garnish.localY, other.localX, other.localY);
          nearest = Math.min(nearest, distance);
        });

        return nearest === Number.POSITIVE_INFINITY ? 0 : nearest;
      });

      const averageNearestDistance = nearestDistances.reduce((sum, value) => sum + value, 0) / nearestDistances.length;
      spacingScore = Phaser.Math.Clamp((averageNearestDistance / 55) * 100, 0, 100);
    }

    const occupiedQuadrants = new Set();
    garnishes.forEach((garnish) => {
      const xSide = garnish.localX >= 0 ? 'R' : 'L';
      const ySide = garnish.localY >= this.cakeTopCenterY ? 'B' : 'T';
      occupiedQuadrants.add(`${xSide}${ySide}`);
    });
    balanceScore = Phaser.Math.Clamp((occupiedQuadrants.size / 4) * 100, 0, 100);

    const garnishScore = Math.round((varietyScore * 0.5) + (spacingScore * 0.3) + (coverageScore * 0.2));

    return {
      garnishCount,
      uniqueTypes,
      varietyScore: Math.round(varietyScore),
      spacingScore: Math.round(spacingScore),
      coverageScore: Math.round(coverageScore),
      balanceScore: Math.round(balanceScore),
      garnishScore: Phaser.Math.Clamp(garnishScore, 0, 100)
    };
  }

  calculatePresentationMetrics(garnishMetrics) {
    const cakeDistance = Phaser.Math.Distance.Between(this.cakeContainer.x, this.cakeContainer.y, this.plateCenter.x, this.plateCenter.y - 6);
    const centeringScore = Math.round(Phaser.Math.Clamp(100 - ((cakeDistance / 110) * 100), 0, 100));
    const backgroundScore = this.selectedBackgroundKey ? 100 : 0;
    const arrangementScore = Math.round((garnishMetrics.balanceScore * 0.55) + (garnishMetrics.coverageScore * 0.45));
    const presentationScore = Math.round((backgroundScore * 0.55) + (centeringScore * 0.3) + (arrangementScore * 0.15));

    return {
      centeringScore,
      backgroundScore,
      arrangementScore,
      presentationScore: Phaser.Math.Clamp(presentationScore, 0, 100)
    };
  }

  calculateFinalScore() {
    const cleanlinessScore = this.totalMessSpots > 0
      ? Math.round((this.cleanedMessCount / this.totalMessSpots) * 100)
      : 100;
    const garnishMetrics = this.calculateGarnishMetrics();
    const presentationMetrics = this.calculatePresentationMetrics(garnishMetrics);

    const weightedScore = (cleanlinessScore * 0.3)
      + (garnishMetrics.garnishScore * 0.3)
      + (presentationMetrics.presentationScore * 0.4);

    const finalScore = Math.round(Phaser.Math.Clamp(weightedScore * (1 - this.chaosPenalty), 0, 100));

    return {
      finalScore,
      cleanlinessScore,
      garnishMetrics,
      presentationMetrics,
      chaosPenalty: this.chaosPenalty
    };
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

    const scoreBreakdown = this.calculateFinalScore();
    this.latestScoreBreakdown = scoreBreakdown;

    if (this.socket) {
      this.socket.emit('baking:phase-complete', {
        teamId: this.teamId,
        phase: 'present',
        score: scoreBreakdown.finalScore,
        details: {
          cleanlinessScore: scoreBreakdown.cleanlinessScore,
          garnishScore: scoreBreakdown.garnishMetrics.garnishScore,
          presentationScore: scoreBreakdown.presentationMetrics.presentationScore,
          cleanedMessCount: this.cleanedMessCount,
          totalMessSpots: this.totalMessSpots,
          garnishCount: scoreBreakdown.garnishMetrics.garnishCount,
          uniqueGarnishes: scoreBreakdown.garnishMetrics.uniqueTypes,
          selectedBackground: this.selectedBackgroundKey,
          centeringScore: scoreBreakdown.presentationMetrics.centeringScore,
          chaosPenalty: scoreBreakdown.chaosPenalty,
          timeRemaining: this.timeRemaining
        }
      });
    }

    this.showCompletionScreen(scoreBreakdown.finalScore);
  }

  showCompletionScreen(score) {
    this.clearTrackedObjects('completionObjects');

    const breakdown = this.latestScoreBreakdown || this.calculateFinalScore();
    const overlay = this.trackObject('completionObjects', this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.78).setDepth(12));
    const panel = this.trackObject('completionObjects', this.add.rectangle(512, 384, 620, 372, 0x111827, 0.98).setStrokeStyle(3, 0x334155).setDepth(12));

    this.trackObject('completionObjects', this.add.text(512, 248, 'PRESENTATION COMPLETE!', {
      fontFamily: 'Arial',
      fontSize: '40px',
      color: '#f9c74f',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(13));

    this.trackObject('completionObjects', this.add.text(512, 304, `Score: ${score}/100`, {
      fontFamily: 'Arial',
      fontSize: '38px',
      color: '#56d364',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(13));

    this.trackObject('completionObjects', this.add.text(512, 364, [
      `Cleanliness: ${breakdown.cleanlinessScore}%`,
      `Garnish: ${breakdown.garnishMetrics.garnishScore}%`,
      `Presentation: ${breakdown.presentationMetrics.presentationScore}%`
    ].join('   •   '), {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#e2e8f0',
      align: 'center'
    }).setOrigin(0.5).setDepth(13));

    this.trackObject('completionObjects', this.add.text(512, 414, [
      `Cleaned ${this.cleanedMessCount}/${this.totalMessSpots}`,
      `Garnishes ${breakdown.garnishMetrics.garnishCount}`,
      `Setting ${this.selectedBackgroundKey || 'none'}`
    ].join('   •   '), {
      fontFamily: 'Arial',
      fontSize: '19px',
      color: '#cbd5e1',
      align: 'center'
    }).setOrigin(0.5).setDepth(13));

    this.trackObject('completionObjects', this.add.text(512, 458, `Centering: ${breakdown.presentationMetrics.centeringScore}%   •   Chaos penalty: -${Math.round(breakdown.chaosPenalty * 100)}%`, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#94a3b8',
      align: 'center'
    }).setOrigin(0.5).setDepth(13));

    this.trackObject('completionObjects', this.add.text(512, 522, 'Returning to phase select...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#93c5fd',
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

  update() {
    if (this.isComplete || !this.rotateKeys) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.rotateKeys.rotateLeft) || Phaser.Input.Keyboard.JustDown(this.rotateKeys.altLeft)) {
      this.rotateCake(-0.05);
    }

    if (Phaser.Input.Keyboard.JustDown(this.rotateKeys.rotateRight) || Phaser.Input.Keyboard.JustDown(this.rotateKeys.altRight)) {
      this.rotateCake(0.05);
    }
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

    if (this._dragStartHandler) {
      this.input.off('dragstart', this._dragStartHandler);
      this._dragStartHandler = null;
    }

    if (this._dragHandler) {
      this.input.off('drag', this._dragHandler);
      this._dragHandler = null;
    }

    if (this._dragEndHandler) {
      this.input.off('dragend', this._dragEndHandler);
      this._dragEndHandler = null;
    }

    [this.cakeContainer, ...this.paletteItems, ...this.placedGarnishes, ...this.backgroundCards, ...this.uiButtons, ...this.messSpots].forEach((object) => {
      if (object && object.removeAllListeners) {
        object.removeAllListeners();
      }
    });

    this.clearTrackedObjects('completionObjects');
    this.clearTrackedObjects('hintObjects');
    this.clearTrackedObjects('chaosBanners');
    this.clearTrackedObjects('messSpots');
    this.clearTrackedObjects('placedGarnishes');
    this.clearTrackedObjects('backgroundCards');
    this.clearTrackedObjects('paletteItems');
    this.clearTrackedObjects('uiButtons');
    this.clearTrackedObjects('persistentObjects');

    this.presentationBackdrop = null;
    this.presentationDecor = null;
    this.cakeContainer = null;
    this.timerText = null;
    this.statusText = null;
    this.feedbackText = null;
    this.rotationText = null;
    this.settingText = null;
    this.modeText = null;
    this.backgroundText = null;
    this.arrangeButton = null;
    this.cleanButton = null;
    this.presentButton = null;
    this.darknessOverlay = null;
    this.rotateKeys = null;
    this.latestScoreBreakdown = null;
  }
}

window.PresentScene = PresentScene;
