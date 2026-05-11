// Evil Jeopardy 1.2 - HUD Scene (Always-on Overlay)

class HUDScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HUDScene' });
    this.timerText = null;
    this.phaseText = null;
    this.scoreText = null;
    this.inventoryList = null;
    this.evilLuckIndicator = null;
    this.timeRemaining = 0;
    this.isEvilLuckActive = false;
  }

  create() {
    console.log('HUDScene created');
    
    // Ensure HUD is always on top
    this.scene.bringToTop();
    
    // Get context from registry
    this.socket = this.registry.get('socket');
    this.inventory = this.registry.get('inventory') || [];
    
    // Create HUD elements
    this.createTimer();
    this.createPhaseLabel();
    this.createScoreDisplay();
    this.createInventorySidebar();
    this.createEvilLuckIndicator();
    
    // Setup socket listeners
    this.setupSocketListeners();
    
    // Setup registry listeners for updates
    this.setupRegistryListeners();
  }

  createTimer() {
    // Timer background
    const timerBg = this.add.rectangle(512, 30, 200, 50, 0x161b22, 0.9);
    timerBg.setStrokeStyle(2, 0x30363d);
    
    // Timer text
    this.timerText = this.add.text(512, 30, '00:00', {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#ffa657',
      fontStyle: 'bold'
    });
    this.timerText.setOrigin(0.5);
  }

  createPhaseLabel() {
    // Phase label at top-left
    const phaseBg = this.add.rectangle(100, 30, 180, 40, 0x161b22, 0.9);
    phaseBg.setStrokeStyle(2, 0x30363d);
    
    this.phaseText = this.add.text(100, 30, 'BAKING', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffa657',
      fontStyle: 'bold'
    });
    this.phaseText.setOrigin(0.5);
  }

  createScoreDisplay() {
    // Score display at top-right
    const scoreBg = this.add.rectangle(924, 30, 180, 40, 0x161b22, 0.9);
    scoreBg.setStrokeStyle(2, 0x30363d);
    
    this.scoreText = this.add.text(924, 30, 'Score: 0', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#56d364',
      fontStyle: 'bold'
    });
    this.scoreText.setOrigin(0.5);
  }

  createInventorySidebar() {
    // Inventory panel on the left side
    const panelX = 20;
    const panelY = 100;
    const panelWidth = 200;
    const panelHeight = 400;
    
    // Background panel
    const inventoryBg = this.add.rectangle(
      panelX, panelY, panelWidth, panelHeight, 0x161b22, 0.85
    );
    inventoryBg.setOrigin(0, 0);
    inventoryBg.setStrokeStyle(2, 0x30363d);
    
    // Title
    this.add.text(panelX + 10, panelY + 10, 'INGREDIENTS', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#79c0ff',
      fontStyle: 'bold'
    });
    
    // Inventory items container
    this.inventoryList = this.add.container(panelX + 10, panelY + 50);
    
    // Render initial inventory
    this.updateInventoryDisplay();
  }

  createEvilLuckIndicator() {
    // Evil luck indicator in top-right corner (above score)
    const indicatorX = 924;
    const indicatorY = 80;
    
    const indicatorBg = this.add.rectangle(
      indicatorX, indicatorY, 180, 40, 0x161b22, 0.9
    );
    indicatorBg.setStrokeStyle(2, 0x30363d);
    
    // Skull emoji/icon with text
    this.evilLuckIndicator = this.add.text(
      indicatorX, indicatorY, '💀 CHAOS', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#da3633',
      fontStyle: 'bold'
    });
    this.evilLuckIndicator.setOrigin(0.5);
    this.evilLuckIndicator.setAlpha(0.3); // Start dimmed
    
    // Create pulsing tween for when evil luck is active
    this.evilLuckTween = this.tweens.add({
      targets: this.evilLuckIndicator,
      alpha: 1,
      scale: 1.1,
      duration: 500,
      yoyo: true,
      repeat: -1,
      paused: true
    });
  }

  setupSocketListeners() {
    if (!this.socket) return;
    
    // Listen for timer updates
    this.socket.on('baking:timer-tick', (data) => {
      this.timeRemaining = data.timeRemaining;
      this.updateTimerDisplay();
    });
    
    // Listen for evil luck/chaos events
    this.socket.on('baking:chaos-event', (data) => {
      this.activateEvilLuck(data);
    });
    
    // Listen for chaos event end
    this.socket.on('baking:chaos-end', () => {
      this.deactivateEvilLuck();
    });
  }

  setupRegistryListeners() {
    // Listen for registry changes — store handler for cleanup
    this.registryHandler = (parent, key, value) => {
      switch (key) {
        case 'score':
          this.updateScoreDisplay(value);
          break;
        case 'inventory':
          this.inventory = value;
          this.updateInventoryDisplay();
          break;
        case 'currentPhase':
          this.updatePhaseDisplay(value);
          break;
      }
    };
    this.registry.events.on('changedata', this.registryHandler);
  }

  updateTimerDisplay() {
    const minutes = Math.floor(this.timeRemaining / 60);
    const seconds = this.timeRemaining % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    this.timerText.setText(timeStr);
    
    // Change color based on time remaining
    if (this.timeRemaining <= 10) {
      this.timerText.setColor('#ff7b72'); // Red for low time
    } else if (this.timeRemaining <= 30) {
      this.timerText.setColor('#ffa657'); // Orange for medium time
    } else {
      this.timerText.setColor('#56d364'); // Green for plenty of time
    }
  }

  updateScoreDisplay(score) {
    this.scoreText.setText(`Score: ${score || 0}`);
  }

  updatePhaseDisplay(phaseName) {
    if (phaseName) {
      this.phaseText.setText(phaseName.toUpperCase());
    }
  }

  updateInventoryDisplay() {
    // Clear existing items
    this.inventoryList.removeAll(true);
    
    // Render each inventory item
    this.inventory.forEach((item, index) => {
      const itemText = this.add.text(0, index * 25, `• ${item}`, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#c9d1d9'
      });
      this.inventoryList.add(itemText);
    });
    
    // Show empty message if no items
    if (this.inventory.length === 0) {
      const emptyText = this.add.text(0, 0, 'No ingredients yet...', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#6e7681',
        fontStyle: 'italic'
      });
      this.inventoryList.add(emptyText);
    }
  }

  activateEvilLuck(data) {
    console.log('Evil luck activated:', data);
    this.isEvilLuckActive = true;
    
    // Make indicator fully visible and start pulsing
    this.evilLuckIndicator.setAlpha(1);
    this.evilLuckTween.resume();
    
    // Update text if specific chaos event provided
    if (data && data.type) {
      this.evilLuckIndicator.setText(`💀 ${data.type.toUpperCase()}`);
    }
  }

  deactivateEvilLuck() {
    console.log('Evil luck deactivated');
    this.isEvilLuckActive = false;
    
    // Reset to dimmed state
    this.evilLuckIndicator.setAlpha(0.3);
    this.evilLuckIndicator.setText('💀 CHAOS');
    this.evilLuckTween.pause();
    this.evilLuckIndicator.setScale(1); // Reset scale
  }

  shutdown() {
    // Cleanup socket listeners when scene shuts down
    if (this.socket) {
      this.socket.off('baking:timer-tick');
      this.socket.off('baking:chaos-event');
      this.socket.off('baking:chaos-end');
    }
    
    // Cleanup registry listener
    if (this.registryHandler) {
      this.registry.events.off('changedata', this.registryHandler);
    }
    
    // Stop evil luck tween
    if (this.evilLuckTween) {
      this.evilLuckTween.remove();
    }
  }
}

// Make HUDScene available globally
window.HUDScene = HUDScene;
