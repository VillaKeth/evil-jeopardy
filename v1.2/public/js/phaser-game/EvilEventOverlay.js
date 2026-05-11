// Evil Jeopardy 1.2 - Evil Event Overlay Scene

class EvilEventOverlay extends Phaser.Scene {
  constructor() {
    super({ key: 'EvilEventOverlay' });

    this.socket = null;
    this.teamId = null;
    this.onScorePenalty = null;
    this.scoreRegistryKey = 'score';
    this.penaltyRegistryKey = 'chaosPenalty';

    this.eventQueue = [];
    this.isDisplayingEvent = false;
    this.isDormant = false;
    this.activeObjects = [];
    this.cleanupTimer = null;
    this.chaosListener = null;
  }

  init(data = {}) {
    this.socket = data.socket || this.registry.get('socket') || null;
    this.teamId = data.teamId || this.registry.get('teamId') || null;
    this.onScorePenalty = typeof data.onScorePenalty === 'function' ? data.onScorePenalty : null;
    this.scoreRegistryKey = data.scoreRegistryKey || 'score';
    this.penaltyRegistryKey = data.penaltyRegistryKey || 'chaosPenalty';

    this.eventQueue = [];
    this.isDisplayingEvent = false;
    this.isDormant = false;
    this.activeObjects = [];
    this.cleanupTimer = null;

    this.registry.set(this.penaltyRegistryKey, 0);
  }

  create() {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    if (this.input) {
      this.input.enabled = false;
    }

    this.registerSocketListener();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    this.isDormant = true;
    this.scene.sleep();
  }

  registerSocketListener() {
    if (!this.socket || this.chaosListener) {
      return;
    }

    this.chaosListener = (event) => {
      if (!event) {
        return;
      }

      if (event.teamId && this.teamId && event.teamId !== this.teamId) {
        return;
      }

      this.eventQueue.push(this.normalizeChaosEvent(event));

      if (!this.isDisplayingEvent) {
        this.startNextEvent();
      }
    };

    this.socket.on('baking:chaos-event', this.chaosListener);
  }

  normalizeChaosEvent(event) {
    const scorePenalty = typeof event.scorePenalty === 'number'
      ? Phaser.Math.Clamp(event.scorePenalty, 0, 1)
      : this.getSeverityPenalty(event.severity);
    const severity = this.getSeverity(event.severity, scorePenalty);

    return {
      ...event,
      id: event.id || event.key || `chaos-${Date.now()}`,
      name: event.name || '💀 CHAOS EVENT!',
      description: event.description || 'Something deeply unfair just happened.',
      severity,
      scorePenalty
    };
  }

  getSeverity(inputSeverity, scorePenalty) {
    if (inputSeverity === 'good' || inputSeverity === 'medium' || inputSeverity === 'bad') {
      return inputSeverity;
    }

    if (scorePenalty >= 0.25) {
      return 'bad';
    }

    if (scorePenalty >= 0.12) {
      return 'medium';
    }

    return 'good';
  }

  getSeverityPenalty(severity) {
    switch (severity) {
      case 'good':
        return 0.08;
      case 'bad':
        return 0.25;
      case 'medium':
      default:
        return 0.15;
    }
  }

  getSeverityHex(severity) {
    switch (severity) {
      case 'good':
        return '#4caf50';
      case 'bad':
        return '#f44336';
      case 'medium':
      default:
        return '#ff9800';
    }
  }

  getSeverityColor(severity) {
    return Number(this.getSeverityHex(severity).replace('#', '0x'));
  }

  startNextEvent() {
    if (this.isDisplayingEvent || !this.eventQueue.length) {
      return;
    }

    if (this.isDormant) {
      this.isDormant = false;
      this.scene.wake();
    }

    this.scene.bringToTop();
    this.isDisplayingEvent = true;
    this.triggerChaosEvent(this.eventQueue.shift());
  }

  triggerChaosEvent(event) {
    const severityColor = this.getSeverityColor(event.severity);
    const severityHex = this.getSeverityHex(event.severity);
    const overlayDepth = 20;
    const nameY = 300;

    this.clearActiveOverlay();
    const penaltyResult = this.applyScorePenalty(event);
    this.playChaosSound(event);
    this.cameras.main.shake(300, 0.02);

    const flash = this.add.rectangle(512, 384, 1024, 768, 0xffffff, 0).setDepth(overlayDepth + 1);
    const colorShift = this.add.rectangle(512, 384, 1024, 768, severityColor, 0).setDepth(overlayDepth + 2);
    const dimmer = this.add.rectangle(512, 384, 1024, 768, 0x04070d, 0).setDepth(overlayDepth + 3);
    const panelShadow = this.add.rectangle(512, 384, 644, 238, 0x000000, 0).setDepth(overlayDepth + 4);
    const panel = this.add.rectangle(512, 384, 620, 214, 0x101720, 0).setStrokeStyle(4, severityColor, 0.95).setDepth(overlayDepth + 5);

    const titleText = this.add.text(512, nameY - 70, event.name, {
      fontFamily: 'Arial',
      fontSize: '48px',
      fontStyle: 'bold',
      color: severityHex,
      align: 'center',
      stroke: '#13060a',
      strokeThickness: 7,
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: severityHex,
        blur: 20,
        fill: true
      },
      wordWrap: { width: 760, useAdvancedWrap: true }
    }).setOrigin(0.5).setAlpha(0).setScale(0.82).setDepth(overlayDepth + 6);

    const descriptionText = this.add.text(512, 390, event.description, {
      fontFamily: 'Arial',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#fff3bf',
      align: 'center',
      stroke: '#05070c',
      strokeThickness: 4,
      wordWrap: { width: 700, useAdvancedWrap: true }
    }).setOrigin(0.5).setAlpha(0).setDepth(overlayDepth + 6);

    const penaltyText = this.add.text(512, 455, this.getPenaltyLabel(event, penaltyResult), {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#f8fafc',
      align: 'center',
      stroke: '#05070c',
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setDepth(overlayDepth + 6);

    if (colorShift.setBlendMode) {
      colorShift.setBlendMode(Phaser.BlendModes.ADD);
    }

    this.activeObjects.push(flash, colorShift, dimmer, panelShadow, panel, titleText, descriptionText, penaltyText);
    this.createParticleBurst(512, 384, severityColor, overlayDepth + 7);

    this.tweens.add({
      targets: flash,
      alpha: 0.95,
      duration: 120,
      ease: 'Cubic.easeOut',
      yoyo: true
    });

    this.tweens.add({
      targets: colorShift,
      alpha: 0.2,
      duration: 180,
      ease: 'Quad.easeOut',
      yoyo: true,
      hold: 130
    });

    this.tweens.add({
      targets: [dimmer, panelShadow, panel],
      alpha: { from: 0, to: 1 },
      duration: 180,
      ease: 'Quad.easeOut',
      onUpdate: (tween, target) => {
        if (target === dimmer) {
          target.setAlpha(tween.progress * 0.58);
        } else if (target === panelShadow) {
          target.setAlpha(tween.progress * 0.4);
        } else if (target === panel) {
          target.setAlpha(tween.progress * 0.94);
        }
      }
    });

    this.tweens.add({
      targets: titleText,
      y: { from: nameY - 130, to: nameY },
      alpha: { from: 0, to: 1 },
      scale: { from: 0.82, to: 1 },
      duration: 520,
      ease: 'Bounce.easeOut'
    });

    this.tweens.add({
      targets: descriptionText,
      y: { from: 420, to: 390 },
      alpha: { from: 0, to: 1 },
      duration: 300,
      delay: 110,
      ease: 'Quad.easeOut'
    });

    this.tweens.add({
      targets: penaltyText,
      y: { from: 480, to: 455 },
      alpha: { from: 0, to: 1 },
      duration: 300,
      delay: 170,
      ease: 'Quad.easeOut'
    });

    this.cleanupTimer = this.time.delayedCall(2500, () => {
      this.fadeOutCurrentEvent();
    });
  }

  getPenaltyLabel(event, penaltyResult) {
    const percentPenalty = Math.round(event.scorePenalty * 100);

    if (typeof penaltyResult.scenePenalty === 'number') {
      return `Score penalty: -${percentPenalty}%   •   Total minigame chaos: -${Math.round(penaltyResult.scenePenalty * 100)}%`;
    }

    return `Score penalty queued: -${percentPenalty}%`;
  }

  createParticleBurst(centerX, centerY, color, depth) {
    const particleCount = Phaser.Math.Between(15, 20);

    for (let index = 0; index < particleCount; index += 1) {
      const particle = this.add.circle(centerX, centerY, Phaser.Math.Between(4, 8), color, 0.95).setDepth(depth);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(110, 280);
      const targetX = centerX + (Math.cos(angle) * distance);
      const targetY = centerY + (Math.sin(angle) * distance);

      this.activeObjects.push(particle);

      this.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        scale: { from: 1, to: 0.15 },
        duration: Phaser.Math.Between(450, 700),
        ease: 'Cubic.easeOut'
      });
    }
  }

  playChaosSound(event) {
    const audioKeys = ['chaos-hit', 'chaos-event', 'evil-sting'];
    const soundKey = audioKeys.find((key) => this.cache && this.cache.audio && this.cache.audio.exists(key));

    if (soundKey && this.sound) {
      this.sound.play(soundKey, { volume: 0.7 });
      return;
    }

    console.debug('[EvilEventOverlay] Chaos sound placeholder for event:', event.id || event.name);
  }

  applyScorePenalty(event) {
    const penalty = Phaser.Math.Clamp(event.scorePenalty || 0, 0, 1);
    const registryPenalty = Phaser.Math.Clamp((Number(this.registry.get(this.penaltyRegistryKey)) || 0) + penalty, 0, 1);
    const activeScene = this.getActiveMinigameScene();
    let scenePenalty = null;

    this.registry.set(this.penaltyRegistryKey, registryPenalty);
    this.registry.set('lastChaosEvent', event);

    if (activeScene && Array.isArray(activeScene.chaosEvents)) {
      activeScene.chaosEvents.push(event);
    }

    if (activeScene && typeof activeScene.chaosPenalty === 'number') {
      activeScene.chaosPenalty = Phaser.Math.Clamp(activeScene.chaosPenalty + penalty, 0, 1);
      scenePenalty = activeScene.chaosPenalty;
    }

    const currentScore = Number(this.registry.get(this.scoreRegistryKey));
    if (Number.isFinite(currentScore) && currentScore > 0) {
      const nextScore = Math.max(0, Math.round(currentScore * (1 - penalty)));
      this.registry.set(this.scoreRegistryKey, nextScore);
    }

    if (activeScene && activeScene.events && activeScene.events.emit) {
      activeScene.events.emit('chaos-event', event);
    }

    if (this.game && this.game.events) {
      this.game.events.emit('chaos-event', {
        event,
        penalty,
        sceneKey: activeScene && activeScene.sys && activeScene.sys.settings ? activeScene.sys.settings.key : null
      });
    }

    if (this.onScorePenalty) {
      this.onScorePenalty({
        event,
        penalty,
        scenePenalty,
        registryPenalty,
        sceneKey: activeScene && activeScene.sys && activeScene.sys.settings ? activeScene.sys.settings.key : null
      });
    }

    return { penalty, scenePenalty, registryPenalty };
  }

  getActiveMinigameScene() {
    const excludedKeys = new Set(['EvilEventOverlay', 'HUDScene', 'PhaseSelectScene']);
    const scenes = (this.game && this.game.scene && Array.isArray(this.game.scene.scenes))
      ? this.game.scene.scenes.slice().reverse()
      : [];

    return scenes.find((scene) => {
      return scene
        && scene !== this
        && scene.sys
        && scene.sys.isActive()
        && !excludedKeys.has(scene.sys.settings.key)
        && typeof scene.chaosPenalty === 'number';
    }) || null;
  }

  fadeOutCurrentEvent() {
    if (!this.activeObjects.length) {
      this.finishEventCycle();
      return;
    }

    const activeObjects = this.activeObjects.filter((gameObject) => gameObject && gameObject.scene);

    this.tweens.add({
      targets: activeObjects,
      alpha: 0,
      y: '-=10',
      duration: 250,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.clearActiveOverlay();
        this.finishEventCycle();
      }
    });
  }

  finishEventCycle() {
    this.isDisplayingEvent = false;

    if (this.eventQueue.length) {
      this.startNextEvent();
      return;
    }

    this.isDormant = true;
    this.scene.sleep();
  }

  clearActiveOverlay() {
    if (this.cleanupTimer) {
      this.cleanupTimer.remove(false);
      this.cleanupTimer = null;
    }

    this.activeObjects.forEach((gameObject) => {
      if (gameObject && gameObject.scene) {
        gameObject.destroy();
      }
    });

    this.activeObjects = [];
  }

  shutdown() {
    if (this.socket && this.chaosListener) {
      this.socket.off('baking:chaos-event', this.chaosListener);
    }

    this.chaosListener = null;
    this.eventQueue = [];
    this.isDisplayingEvent = false;
    this.isDormant = false;

    if (this.cleanupTimer) {
      this.cleanupTimer.remove(false);
      this.cleanupTimer = null;
    }

    this.time.removeAllEvents();
    this.tweens.killAll();
    this.clearActiveOverlay();
  }
}

window.EvilEventOverlay = EvilEventOverlay;
