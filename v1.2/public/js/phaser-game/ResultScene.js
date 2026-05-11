class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
    this.cakeImagePath = '';
    this.scores = {};
    this.chaosEventsSummary = [];
    this.revealTimers = [];
    this.dynamicImageKey = null;
  }

  init(data = {}) {
    this.cakeImagePath = data.cakeImagePath || '';
    this.scores = data.scores || {};
    this.chaosEventsSummary = Array.isArray(data.chaosEvents) ? data.chaosEvents : [];
    this.revealTimers = [];
    this.dynamicImageKey = this.cakeImagePath ? `result-cake-${Date.now()}` : null;
  }

  preload() {
    if (this.cakeImagePath && this.dynamicImageKey) {
      this.load.image(this.dynamicImageKey, this.cakeImagePath);
    }
  }

  create() {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.cameras.main.setBackgroundColor('#000000');

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    const spotlight = this.add.ellipse(centerX, centerY + 40, 520, 620, 0xffd38c, 0.08);
    spotlight.setBlendMode(Phaser.BlendModes.SCREEN);

    const title = this.add.text(centerX, 110, 'Your cake is ready...', {
      fontFamily: 'Arial',
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#fff1cf',
      align: 'center'
    }).setOrigin(0.5).setAlpha(0);

    const titleGlow = this.add.text(centerX, 110, 'Your cake is ready...', {
      fontFamily: 'Arial',
      fontSize: '44px',
      fontStyle: 'bold',
      color: '#fff1cf',
      align: 'center'
    }).setOrigin(0.5).setAlpha(0.18);
    titleGlow.setTint(0xffa657);
    titleGlow.setBlendMode(Phaser.BlendModes.ADD);

    const cakeContainer = this.add.container(centerX, centerY + 10);
    const cakeFrame = this.add.rectangle(0, 0, 420, 420, 0x161b22, 0.92).setStrokeStyle(3, 0xffa657, 0.75);
    const cakeGlow = this.add.rectangle(0, 0, 430, 430, 0xffa657, 0.06);

    let cakeVisual;
    if (this.dynamicImageKey && this.textures.exists(this.dynamicImageKey)) {
      cakeVisual = this.add.image(0, 0, this.dynamicImageKey);
      cakeVisual.setDisplaySize(360, 360);
    } else {
      cakeVisual = this.add.text(0, 0, '🍰', {
        fontFamily: 'Arial',
        fontSize: '160px'
      }).setOrigin(0.5);
    }

    cakeContainer.add([cakeGlow, cakeFrame, cakeVisual]);
    cakeContainer.setAlpha(0);
    cakeContainer.setScale(0.86);

    const leftCurtain = this.add.rectangle(centerX - 210, centerY + 10, 420, 520, 0x5c1024, 0.98).setOrigin(1, 0.5);
    const rightCurtain = this.add.rectangle(centerX + 210, centerY + 10, 420, 520, 0x5c1024, 0.98).setOrigin(0, 0.5);
    leftCurtain.setStrokeStyle(2, 0x2d0812, 0.9);
    rightCurtain.setStrokeStyle(2, 0x2d0812, 0.9);

    const scores = [
      ['Taste', this.scores.taste],
      ['Accuracy', this.scores.accuracy],
      ['Creativity', this.scores.creativity],
      ['Total', this.scores.total]
    ];
    const detailsContainer = this.add.container(centerX, 660);
    scores.forEach(([label, value], index) => {
      const cardX = -330 + (index * 220);
      const card = this.add.rectangle(cardX, 0, 190, 96, 0x11161d, 0.92).setStrokeStyle(1, 0x79c0ff, 0.35);
      const labelText = this.add.text(cardX, -18, label, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#8b949e'
      }).setOrigin(0.5);
      const valueText = this.add.text(cardX, 18, this.formatScore(value), {
        fontFamily: 'Arial',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#ffd38c'
      }).setOrigin(0.5);
      detailsContainer.add([card, labelText, valueText]);
    });

    const chaosCopy = this.chaosEventsSummary.length
      ? this.chaosEventsSummary.slice(-3).map((event) => `• ${event.description || event.title || 'Kitchen chaos struck.'}`).join('\n')
      : '• No chaos twists survived the final edit.';
    const chaosText = this.add.text(centerX, 560, chaosCopy, {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#c9d1d9',
      align: 'center',
      wordWrap: { width: 860 }
    }).setOrigin(0.5).setAlpha(0);
    detailsContainer.setAlpha(0);

    this.tweens.add({
      targets: [title, titleGlow],
      alpha: { from: 0, to: 1 },
      y: '-=12',
      duration: 500,
      ease: 'Sine.easeOut'
    });

    this.revealTimers.push(this.time.delayedCall(2000, () => {
      this.tweens.add({ targets: leftCurtain, x: '-=420', duration: 1200, ease: 'Cubic.easeInOut' });
      this.tweens.add({ targets: rightCurtain, x: '+=420', duration: 1200, ease: 'Cubic.easeInOut' });
      this.tweens.add({ targets: cakeContainer, alpha: 1, scale: 1, duration: 900, ease: 'Back.easeOut' });
      this.tweens.add({ targets: [detailsContainer, chaosText], alpha: 1, y: '-=8', duration: 700, delay: 500, ease: 'Sine.easeOut' });
    }));
  }

  formatScore(value) {
    const numeric = Math.round((Number(value) || 0) * 100) / 100;
    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  }

  shutdown() {
    this.revealTimers.forEach((timer) => timer?.remove?.());
    this.revealTimers = [];
    if (this.dynamicImageKey && this.textures.exists(this.dynamicImageKey)) {
      this.textures.remove(this.dynamicImageKey);
    }
  }
}

window.ResultScene = ResultScene;
