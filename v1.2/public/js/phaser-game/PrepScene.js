// Evil Jeopardy 1.2 - Prep Scene (Ingredient Measurement Minigame)

class PrepScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PrepScene' });
    
    // Game state
    this.inventory = [];
    this.boosts = {};
    this.teamId = null;
    this.timeLimit = 75;
    this.timeRemaining = 75;
    this.timerEvent = null;
    
    // Required ingredients for the cake
    this.requiredIngredients = [
      'flour',
      'sugar',
      'eggs',
      'butter',
      'milk'
    ];
    
    // Game progress
    this.currentIngredientIndex = 0;
    this.ingredientScores = [];
    this.isProcessing = false;
    
    // Precision meter
    this.meterActive = false;
    this.meterIndicatorPosition = 0;
    this.meterDirection = 1;
    this.meterSpeed = 200; // pixels per second
    
    // UI elements
    this.timerText = null;
    this.instructionText = null;
    this.ingredientListTexts = [];
    this.draggingIngredient = null;
    this.meterGraphics = null;
    this.meterIndicator = null;
    this.shelfItems = [];
  }

  init(data) {
    // Get data from PhaseSelectScene and registry
    this.inventory = data.inventory || this.registry.get('inventory') || [];
    this.boosts = data.boosts || {};
    this.teamId = data.teamId || 'unknown-team';
    this.socket = this.registry.get('socket');
    
    // Reset game state
    this.currentIngredientIndex = 0;
    this.ingredientScores = [];
    this.isProcessing = false;
    this.meterActive = false;
    this.timeRemaining = this.timeLimit;
    
    console.log('PrepScene initialized:', {
      inventory: this.inventory,
      boosts: this.boosts,
      teamId: this.teamId
    });
  }

  create() {
    // Background
    this.cameras.main.setBackgroundColor('#0d1117');
    
    // Create game areas
    this.createBackground();
    this.createRequiredIngredientsList();
    this.createIngredientShelf();
    this.createMixingBowlArea();
    this.createInstructionText();
    this.createTimer();
    
    // Show recipe hint boost if available
    if (this.boosts['recipe-hint']) {
      this.showRecipeHint();
    }
    
    // Start the game timer
    this.startTimer();
  }

  createBackground() {
    // Add subtle background elements
    const bg = this.add.rectangle(512, 384, 1024, 768, 0x0d1117);
    
    // Decorative lines
    const lineGraphics = this.add.graphics();
    lineGraphics.lineStyle(2, 0x30363d, 0.5);
    
    // Vertical dividers
    lineGraphics.lineBetween(256, 100, 256, 668);
    lineGraphics.lineBetween(768, 100, 768, 668);
  }

  createRequiredIngredientsList() {
    const panelX = 50;
    const panelY = 120;
    const panelWidth = 180;
    
    // Title
    const title = this.add.text(panelX, panelY, 'REQUIRED', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#79c0ff',
      fontStyle: 'bold'
    });
    
    // Background for list
    const listBg = this.add.rectangle(
      panelX + 90, panelY + 80,
      panelWidth, 400,
      0x161b22, 0.8
    );
    listBg.setStrokeStyle(2, 0x30363d);
    
    // List ingredients
    this.requiredIngredients.forEach((ingredient, index) => {
      const yPos = panelY + 40 + (index * 50);
      const hasIngredient = this.inventory.includes(ingredient);
      
      const text = this.add.text(
        panelX + 20, yPos,
        `${index + 1}. ${ingredient}`,
        {
          fontFamily: 'Arial',
          fontSize: '18px',
          color: hasIngredient ? '#c9d1d9' : '#8b949e',
          fontStyle: hasIngredient ? 'normal' : 'italic'
        }
      );
      
      // Add checkmark/warning icon
      const icon = this.add.text(
        panelX, yPos,
        hasIngredient ? '✓' : '⚠',
        {
          fontFamily: 'Arial',
          fontSize: '18px',
          color: hasIngredient ? '#56d364' : '#f85149'
        }
      );
      
      this.ingredientListTexts.push({ text, icon, ingredient, hasIngredient });
    });
  }

  createIngredientShelf() {
    const shelfX = 850;
    const shelfY = 120;
    
    // Shelf title
    this.add.text(shelfX, shelfY, 'INGREDIENTS', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#79c0ff',
      fontStyle: 'bold'
    });
    
    // Create draggable ingredient items
    this.requiredIngredients.forEach((ingredient, index) => {
      const yPos = shelfY + 60 + (index * 80);
      const hasIngredient = this.inventory.includes(ingredient);
      
      // Item background
      const itemBg = this.add.rectangle(
        shelfX + 70, yPos,
        140, 60,
        hasIngredient ? 0x238636 : 0x6e1a22,
        0.3
      );
      itemBg.setStrokeStyle(2, hasIngredient ? 0x2ea043 : 0xda3633);
      
      // Item text
      const itemText = this.add.text(
        shelfX + 70, yPos,
        hasIngredient ? ingredient : `(substitute)`,
        {
          fontFamily: 'Arial',
          fontSize: '16px',
          color: hasIngredient ? '#c9d1d9' : '#8b949e',
          align: 'center'
        }
      );
      itemText.setOrigin(0.5);
      
      // Make interactive
      itemBg.setInteractive({ useHandCursor: true });
      itemText.setInteractive({ useHandCursor: true });
      
      // Store reference
      const shelfItem = {
        bg: itemBg,
        text: itemText,
        ingredient: ingredient,
        hasIngredient: hasIngredient,
        originalX: shelfX + 70,
        originalY: yPos
      };
      
      this.shelfItems.push(shelfItem);
      
      // Drag handlers
      this.setupDragHandlers(shelfItem, index);
    });
  }

  setupDragHandlers(shelfItem, ingredientIndex) {
    const { bg, text } = shelfItem;
    
    // Start drag on either bg or text
    [bg, text].forEach(obj => {
      obj.on('pointerdown', () => {
        if (this.isProcessing || this.meterActive) return;
        if (ingredientIndex !== this.currentIngredientIndex) return; // Must do in order
        
        this.draggingIngredient = shelfItem;
        
        // Visual feedback
        bg.setFillStyle(0x388bfd, 0.6);
        bg.setScale(1.1);
        text.setScale(1.1);
      });
    });
  }

  createMixingBowlArea() {
    const bowlX = 512;
    const bowlY = 450;
    
    // Bowl
    const bowl = this.add.ellipse(bowlX, bowlY, 200, 120, 0x30363d);
    bowl.setStrokeStyle(4, 0x58a6ff);
    
    // Label
    this.add.text(bowlX, bowlY - 100, 'MIXING BOWL', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#58a6ff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Drop zone - make interactive
    bowl.setInteractive({ useHandCursor: true });
    bowl.on('pointerup', () => {
      if (this.draggingIngredient) {
        this.handleIngredientDrop();
      }
    });
    
    // Store reference
    this.mixingBowl = bowl;
  }

  handleIngredientDrop() {
    if (!this.draggingIngredient || this.meterActive) return;
    
    const shelfItem = this.draggingIngredient;
    
    // Reset visual state
    shelfItem.bg.setFillStyle(
      shelfItem.hasIngredient ? 0x238636 : 0x6e1a22,
      0.3
    );
    shelfItem.bg.setScale(1);
    shelfItem.text.setScale(1);
    
    this.draggingIngredient = null;
    
    // Disable the shelf item
    shelfItem.bg.disableInteractive();
    shelfItem.text.disableInteractive();
    
    // Show precision meter
    this.showPrecisionMeter(shelfItem);
  }

  showPrecisionMeter(shelfItem) {
    this.meterActive = true;
    this.isProcessing = true;
    this.meterIndicatorPosition = 0;
    this.meterDirection = 1;
    
    const meterX = 512;
    const meterY = 250;
    const meterWidth = 400;
    const meterHeight = 60;
    
    // Instruction
    this.instructionText.setText('Click when the indicator is in the center!');
    
    // Meter background
    const meterBg = this.add.rectangle(
      meterX, meterY, meterWidth, meterHeight, 0x161b22
    );
    meterBg.setStrokeStyle(3, 0x30363d);
    
    // Color zones (red-yellow-green-yellow-red)
    const graphics = this.add.graphics();
    
    // Red zones (edges)
    graphics.fillStyle(0xda3633, 0.5);
    graphics.fillRect(meterX - meterWidth/2, meterY - meterHeight/2, 60, meterHeight);
    graphics.fillRect(meterX + meterWidth/2 - 60, meterY - meterHeight/2, 60, meterHeight);
    
    // Yellow zones
    graphics.fillStyle(0xffa657, 0.5);
    graphics.fillRect(meterX - meterWidth/2 + 60, meterY - meterHeight/2, 80, meterHeight);
    graphics.fillRect(meterX + meterWidth/2 - 140, meterY - meterHeight/2, 80, meterHeight);
    
    // Green zone (center)
    graphics.fillStyle(0x56d364, 0.5);
    graphics.fillRect(meterX - meterWidth/2 + 140, meterY - meterHeight/2, 120, meterHeight);
    
    // Moving indicator
    const indicator = this.add.rectangle(
      meterX - meterWidth/2, meterY,
      10, meterHeight - 10,
      0xffffff
    );
    
    // Store references
    this.meterGraphics = graphics;
    this.meterIndicator = indicator;
    this.meterBg = meterBg;
    this.meterWidth = meterWidth;
    this.meterCenterX = meterX;
    this.currentShelfItem = shelfItem;
    
    // Click to stop meter
    this.input.once('pointerdown', () => {
      if (this.meterActive) {
        this.stopPrecisionMeter();
      }
    });
  }

  stopPrecisionMeter() {
    this.meterActive = false;
    
    // Calculate score based on indicator position
    const centerX = this.meterCenterX;
    const indicatorX = this.meterIndicator.x;
    const distance = Math.abs(indicatorX - centerX);
    const maxDistance = this.meterWidth / 2;
    
    // Score: 0-100 based on distance from center
    // Green zone (60px from center): 85-100
    // Yellow zone (60-140px): 60-84
    // Red zone (140-200px): 0-59
    let precisionScore;
    if (distance <= 60) {
      precisionScore = 85 + (1 - distance / 60) * 15;
    } else if (distance <= 140) {
      precisionScore = 60 + (1 - (distance - 60) / 80) * 24;
    } else {
      precisionScore = Math.max(0, 60 * (1 - (distance - 140) / 60));
    }
    
    // Penalty if ingredient is missing (substitute used)
    const ingredientScore = this.currentShelfItem.hasIngredient ? precisionScore : precisionScore * 0.6;
    
    this.ingredientScores.push({
      ingredient: this.currentShelfItem.ingredient,
      hasIngredient: this.currentShelfItem.hasIngredient,
      precisionScore: Math.round(precisionScore),
      finalScore: Math.round(ingredientScore)
    });
    
    // Show feedback
    this.showScoreFeedback(Math.round(ingredientScore), distance);
    
    // Clean up meter
    this.time.delayedCall(1500, () => {
      this.meterGraphics.destroy();
      this.meterIndicator.destroy();
      this.meterBg.destroy();
      
      // Mark ingredient as complete
      this.markIngredientComplete();
      
      // Move to next ingredient or finish
      this.currentIngredientIndex++;
      this.isProcessing = false;
      
      if (this.currentIngredientIndex >= this.requiredIngredients.length) {
        this.completeMinigame();
      } else {
        this.instructionText.setText(`Drag ${this.requiredIngredients[this.currentIngredientIndex]} to the bowl`);
      }
    });
  }

  showScoreFeedback(score, distance) {
    let feedbackText;
    let feedbackColor;
    
    if (score >= 85) {
      feedbackText = 'PERFECT!';
      feedbackColor = '#56d364';
    } else if (score >= 70) {
      feedbackText = 'GREAT!';
      feedbackColor = '#79c0ff';
    } else if (score >= 50) {
      feedbackText = 'GOOD';
      feedbackColor = '#ffa657';
    } else {
      feedbackText = 'MISSED';
      feedbackColor = '#ff7b72';
    }
    
    const feedback = this.add.text(
      512, 350,
      `${feedbackText}\n+${score} points`,
      {
        fontFamily: 'Arial',
        fontSize: '48px',
        color: feedbackColor,
        fontStyle: 'bold',
        align: 'center',
        stroke: '#0d1117',
        strokeThickness: 4
      }
    );
    feedback.setOrigin(0.5);
    
    // Animate
    feedback.setScale(0);
    this.tweens.add({
      targets: feedback,
      scale: 1.2,
      alpha: 0,
      duration: 1200,
      ease: 'Cubic.easeOut',
      onComplete: () => feedback.destroy()
    });
  }

  markIngredientComplete() {
    const index = this.currentIngredientIndex;
    if (index < this.ingredientListTexts.length) {
      const listItem = this.ingredientListTexts[index];
      listItem.text.setColor('#56d364');
      listItem.icon.setText('✓');
      listItem.icon.setColor('#56d364');
    }
  }

  createInstructionText() {
    this.instructionText = this.add.text(
      512, 580,
      `Drag ${this.requiredIngredients[0]} to the bowl`,
      {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffa657',
        align: 'center',
        wordWrap: { width: 600 }
      }
    );
    this.instructionText.setOrigin(0.5);
  }

  createTimer() {
    this.timerText = this.add.text(
      512, 650,
      `Time: ${this.timeRemaining}s`,
      {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#56d364'
      }
    );
    this.timerText.setOrigin(0.5);
  }

  startTimer() {
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true
    });
  }

  updateTimer() {
    this.timeRemaining--;
    this.timerText.setText(`Time: ${this.timeRemaining}s`);
    
    // Color changes
    if (this.timeRemaining <= 10) {
      this.timerText.setColor('#ff7b72');
    } else if (this.timeRemaining <= 30) {
      this.timerText.setColor('#ffa657');
    }
    
    // Time's up
    if (this.timeRemaining <= 0) {
      this.completeMinigame();
    }
  }

  showRecipeHint() {
    // Show hint overlay for 5 seconds
    const overlay = this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.8);
    
    const hintText = this.add.text(
      512, 384,
      '💡 RECIPE HINT 💡\n\nKeep the indicator in the center\nfor the best measurement!',
      {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#ffa657',
        align: 'center',
        fontStyle: 'bold'
      }
    );
    hintText.setOrigin(0.5);
    
    // Fade out after 5 seconds
    this.time.delayedCall(5000, () => {
      this.tweens.add({
        targets: [overlay, hintText],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          overlay.destroy();
          hintText.destroy();
        }
      });
    });
  }

  completeMinigame() {
    if (this.timerEvent) {
      this.timerEvent.remove();
    }
    
    // Stop any active meter
    this.meterActive = false;
    
    // Calculate final score
    const finalScore = this.calculateFinalScore();
    
    console.log('PrepScene complete:', {
      ingredientScores: this.ingredientScores,
      finalScore: finalScore
    });
    
    // Emit completion to server
    if (this.socket) {
      this.socket.emit('baking:phase-complete', {
        teamId: this.teamId,
        phase: 'prep',
        score: finalScore,
        details: {
          ingredientScores: this.ingredientScores,
          timeRemaining: this.timeRemaining
        }
      });
    }
    
    // Show completion screen
    this.showCompletionScreen(finalScore);
  }

  calculateFinalScore() {
    if (this.ingredientScores.length === 0) {
      return 0;
    }
    
    // Order score: 25% (full points if all ingredients processed in order, which is guaranteed by UI)
    const orderScore = 25;
    
    // Precision score: 75% (average of all ingredient scores)
    const totalPrecisionScore = this.ingredientScores.reduce(
      (sum, item) => sum + item.finalScore, 0
    );
    const avgPrecisionScore = totalPrecisionScore / this.ingredientScores.length;
    const precisionScore = (avgPrecisionScore / 100) * 75;
    
    return Math.round(orderScore + precisionScore);
  }

  showCompletionScreen(finalScore) {
    // Dim the scene
    const overlay = this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.7);
    
    // Results panel
    const panel = this.add.rectangle(512, 384, 600, 400, 0x161b22, 0.95);
    panel.setStrokeStyle(3, 0x30363d);
    
    // Title
    const title = this.add.text(
      512, 220,
      'PREP COMPLETE!',
      {
        fontFamily: 'Arial',
        fontSize: '48px',
        color: '#ffa657',
        fontStyle: 'bold'
      }
    );
    title.setOrigin(0.5);
    
    // Score
    const scoreText = this.add.text(
      512, 300,
      `Score: ${finalScore}/100`,
      {
        fontFamily: 'Arial',
        fontSize: '36px',
        color: '#56d364',
        fontStyle: 'bold'
      }
    );
    scoreText.setOrigin(0.5);
    
    // Breakdown
    let breakdownY = 360;
    this.ingredientScores.forEach((item, index) => {
      const text = this.add.text(
        512, breakdownY,
        `${item.ingredient}: ${item.finalScore} ${!item.hasIngredient ? '(substitute)' : ''}`,
        {
          fontFamily: 'Arial',
          fontSize: '18px',
          color: item.hasIngredient ? '#c9d1d9' : '#8b949e'
        }
      );
      text.setOrigin(0.5);
      breakdownY += 30;
    });
    
    // Continue message
    const continueText = this.add.text(
      512, 520,
      'Moving to next phase...',
      {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#79c0ff',
        fontStyle: 'italic'
      }
    );
    continueText.setOrigin(0.5);
    
    // Transition to next phase after delay
    this.time.delayedCall(4000, () => {
      this.scene.stop('PrepScene');
      // PhaseSelectScene will handle next phase transition
    });
  }

  update(time, delta) {
    // Update meter indicator if active
    if (this.meterActive && this.meterIndicator) {
      const deltaSeconds = delta / 1000;
      this.meterIndicatorPosition += this.meterSpeed * deltaSeconds * this.meterDirection;
      
      // Bounce at edges
      const maxPos = this.meterWidth / 2 - 5;
      if (this.meterIndicatorPosition >= maxPos || this.meterIndicatorPosition <= -maxPos) {
        this.meterDirection *= -1;
        this.meterIndicatorPosition = Phaser.Math.Clamp(
          this.meterIndicatorPosition, -maxPos, maxPos
        );
      }
      
      // Update indicator position
      this.meterIndicator.x = this.meterCenterX + this.meterIndicatorPosition;
    }
  }

  shutdown() {
    // Clean up timers and tweens
    if (this.timerEvent) {
      this.timerEvent.remove();
    }
    this.tweens.killAll();
    
    console.log('PrepScene shutdown');
  }
}

// Make PrepScene available globally
window.PrepScene = PrepScene;
