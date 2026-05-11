// Evil Jeopardy 1.2 - Phase Select Scene (Transition Screen)

class PhaseSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PhaseSelectScene' });
    this.phaseData = null;
    this.countdownValue = 3;
  }

  /**
   * Initialize scene with phase data
   * @param {Object} data - Phase configuration
   * @param {string} data.phaseName - Name of the phase (e.g., "PREP", "MIX", "BAKE")
   * @param {string} data.description - Phase description
   * @param {string} data.minigame - Which minigame scene to launch
   * @param {boolean} data.isEvil - Whether this is an EVIL variant
   */
  init(data) {
    this.phaseData = this.resolvePhaseData(data);
    this.countdownValue = 3;
    console.log('PhaseSelectScene initialized with data:', this.phaseData);
  }

  resolvePhaseData(data = {}) {
    if (data.phaseName && data.minigame) {
      if (typeof data.selectionIndex === 'number') {
        this.registry.set('currentPhaseIndex', data.selectionIndex);
      }
      return {
        description: 'Get ready...',
        isEvil: false,
        ...data
      };
    }

    const selections = this.registry.get('minigameSelections') || [];
    const currentIndex = Number(this.registry.get('currentPhaseIndex')) || 0;
    const nextIndex = data.advanceIndex === false ? currentIndex : currentIndex + (selections.length ? 1 : 0);
    const nextSelection = selections[nextIndex] || null;

    if (!nextSelection) {
      this.registry.set('currentPhaseIndex', selections.length);
      return {
        phaseName: 'COMPLETE',
        description: 'All baking phases are complete. Stand by for judging.',
        minigame: null,
        isEvil: false,
        isComplete: true,
        selectionIndex: selections.length,
        ...data
      };
    }

    this.registry.set('currentPhaseIndex', nextIndex);
    return {
      phaseName: nextSelection.phaseName || nextSelection.phase?.toUpperCase() || 'UNKNOWN',
      description: nextSelection.description || 'Get ready!',
      minigame: nextSelection.sceneKey,
      isEvil: Boolean(nextSelection.isAbsurd),
      selectionIndex: nextIndex,
      phaseKey: nextSelection.phase || null,
      ...data,
      ...nextSelection
    };
  }

  create() {
    // Background
    this.cameras.main.setBackgroundColor('#0d1117');
    
    // Create animated background elements
    this.createBackgroundParticles();
    
    // Phase name title
    this.createPhaseTitle();
    
    // Description
    this.createDescription();

    if (this.phaseData.isComplete) {
      this.showCompletionState();
      return;
    }
    
    // Minigame indicator
    this.createMinigameIndicator();
    
    // Dramatic countdown
    this.startCountdown();
  }

  showCompletionState() {
    const centerX = 512;
    const message = this.add.text(centerX, 460, 'Waiting for the host to move into judging...', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#79c0ff',
      fontStyle: 'italic',
      align: 'center'
    });
    message.setOrigin(0.5);
  }

  createBackgroundParticles() {
    // Add subtle animated particles in the background
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
      const x = Phaser.Math.Between(0, 1024);
      const y = Phaser.Math.Between(0, 768);
      const size = Phaser.Math.Between(2, 6);
      
      const particle = this.add.circle(x, y, size, 0x30363d, 0.3);
      
      // Animate particles floating
      this.tweens.add({
        targets: particle,
        y: y - Phaser.Math.Between(50, 150),
        alpha: 0,
        duration: Phaser.Math.Between(2000, 4000),
        ease: 'Sine.easeOut',
        repeat: -1,
        delay: Phaser.Math.Between(0, 2000)
      });
    }
  }

  createPhaseTitle() {
    const centerX = 512;
    const titleY = 200;
    
    // Phase name with dramatic styling
    const phaseName = this.add.text(
      centerX, titleY, 
      this.phaseData.phaseName, 
      {
        fontFamily: 'Arial',
        fontSize: '72px',
        color: '#ffa657',
        fontStyle: 'bold',
        stroke: '#0d1117',
        strokeThickness: 4
      }
    );
    phaseName.setOrigin(0.5);
    
    // Scale in animation
    phaseName.setScale(0);
    this.tweens.add({
      targets: phaseName,
      scale: 1,
      duration: 500,
      ease: 'Back.easeOut'
    });
    
    // Glow effect
    phaseName.setShadow(0, 0, '#ffa657', 20, true, true);
  }

  createDescription() {
    const centerX = 512;
    const descY = 320;
    
    // Description text
    const description = this.add.text(
      centerX, descY,
      this.phaseData.description,
      {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#c9d1d9',
        align: 'center',
        wordWrap: { width: 800 }
      }
    );
    description.setOrigin(0.5);
    
    // Fade in
    description.setAlpha(0);
    this.tweens.add({
      targets: description,
      alpha: 1,
      duration: 500,
      delay: 300
    });
  }

  createMinigameIndicator() {
    const centerX = 512;
    const indicatorY = 420;
    
    // Show which minigame variant is active
    const minigameText = this.phaseData.isEvil ? 'EVIL MODE' : 'NORMAL MODE';
    const minigameColor = this.phaseData.isEvil ? '#ff7b72' : '#79c0ff';
    
    const indicator = this.add.text(
      centerX, indicatorY,
      minigameText,
      {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: minigameColor,
        fontStyle: 'bold'
      }
    );
    indicator.setOrigin(0.5);
    
    // Fade in
    indicator.setAlpha(0);
    this.tweens.add({
      targets: indicator,
      alpha: 1,
      duration: 500,
      delay: 600
    });
    
    // Pulse for EVIL mode
    if (this.phaseData.isEvil) {
      this.tweens.add({
        targets: indicator,
        scale: 1.1,
        duration: 400,
        yoyo: true,
        repeat: -1,
        delay: 1000
      });
      
      // Add dramatic red glow
      indicator.setShadow(0, 0, '#ff7b72', 30, true, true);
    }
  }

  startCountdown() {
    const centerX = 512;
    const countdownY = 550;
    
    // Create countdown text
    const countdownText = this.add.text(
      centerX, countdownY,
      '',
      {
        fontFamily: 'Arial',
        fontSize: '96px',
        color: '#56d364',
        fontStyle: 'bold',
        stroke: '#0d1117',
        strokeThickness: 6
      }
    );
    countdownText.setOrigin(0.5);
    
    // Countdown sequence: 3... 2... 1... BAKE!
    const countdownSequence = [
      { text: '3', color: '#ffa657' },
      { text: '2', color: '#f78166' },
      { text: '1', color: '#ff7b72' },
      { text: 'BAKE!', color: '#56d364' }
    ];
    
    let currentIndex = 0;
    
    const showNext = () => {
      if (currentIndex >= countdownSequence.length) {
        // Countdown complete - launch minigame
        this.launchMinigame();
        return;
      }
      
      const current = countdownSequence[currentIndex];
      countdownText.setText(current.text);
      countdownText.setColor(current.color);
      
      // Animate in
      countdownText.setScale(0);
      countdownText.setAlpha(1);
      
      this.tweens.add({
        targets: countdownText,
        scale: 1.2,
        duration: 300,
        ease: 'Back.easeOut',
        onComplete: () => {
          // Fade out after showing
          this.tweens.add({
            targets: countdownText,
            alpha: 0,
            scale: 0.8,
            duration: 400,
            delay: currentIndex === countdownSequence.length - 1 ? 500 : 300,
            onComplete: () => {
              currentIndex++;
              
              // Show next after delay
              this.time.delayedCall(200, showNext);
            }
          });
        }
      });
    };
    
    // Start countdown after initial delay
    this.time.delayedCall(1000, showNext);
  }

  launchMinigame() {
    console.log('Launching minigame:', this.phaseData.minigame);

    this.registry.set('currentPhase', this.phaseData.phaseKey || this.phaseData.phaseName);
    this.registry.set('currentPhaseIndex', this.phaseData.selectionIndex || 0);

    const inventory = this.phaseData.inventory || this.registry.get('inventory') || [];
    const chaosEvents = this.phaseData.chaosEvents || this.registry.get('chaosEvents') || [];
    const boosts = this.phaseData.boosts || this.registry.get('boosts') || {};
    const cakeGoal = this.phaseData.cakeGoal || this.registry.get('cakeGoal') || {};
    const teamId = this.phaseData.teamId || this.registry.get('teamId') || 'unknown-team';

    if (this.phaseData.minigame && this.scene.get(this.phaseData.minigame)) {
      this.scene.start(this.phaseData.minigame, {
        phaseName: this.phaseData.phaseName,
        phaseKey: this.phaseData.phaseKey,
        isEvil: this.phaseData.isEvil,
        inventory,
        boosts,
        chaosEvents,
        cakeGoal,
        teamId
      });
    } else {
      console.warn('No minigame scene specified or scene not found:', this.phaseData.minigame);
      this.scene.stop();
      this.showPlaceholder();
    }
  }

  showPlaceholder() {
    // If no minigame is available, show a placeholder
    const centerX = 512;
    const centerY = 384;
    
    const placeholder = this.add.text(
      centerX, centerY,
      `Minigame "${this.phaseData.minigame}" not yet implemented.\nThe HUD remains active.`,
      {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#8b949e',
        align: 'center'
      }
    );
    placeholder.setOrigin(0.5);
  }

  shutdown() {
    this.tweens.killAll();
  }
}

// Make PhaseSelectScene available globally
window.PhaseSelectScene = PhaseSelectScene;
