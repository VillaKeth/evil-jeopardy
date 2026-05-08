// Evil Jeopardy 1.2 - Phaser Game Configuration

const gameConfig = {
  type: Phaser.AUTO,
  parent: 'phaser-container',
  width: 1024,
  height: 768,
  backgroundColor: '#0d1117',
  scene: [], // scenes registered dynamically based on minigame selection
  physics: {
    default: 'arcade',
    arcade: { 
      gravity: { y: 0 }, 
      debug: false 
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

// Global game instance
let gameInstance = null;

/**
 * Initialize Phaser game with necessary context
 * @param {Socket} socket - Socket.io connection
 * @param {Array} inventory - Player's ingredient inventory
 * @param {Object} cakeGoal - Cake requirements for this round
 * @param {Object} evilLuckConfig - Evil luck/chaos configuration
 * @returns {Phaser.Game} - The initialized game instance
 */
window.initGame = function(socket, inventory, cakeGoal, evilLuckConfig) {
  // Destroy existing game if present
  if (gameInstance) {
    try {
      gameInstance.destroy(true);
    } catch (e) {
      console.warn('Error destroying previous game:', e);
    }
    gameInstance = null;
  }
  
  // Show the Phaser container
  const container = document.getElementById('phaser-container');
  if (container) {
    container.style.display = 'block';
  }
  
  // Create new game instance
  gameInstance = new Phaser.Game(gameConfig);
  
  // Store context in the game registry for access by scenes
  gameInstance.registry.set('socket', socket);
  gameInstance.registry.set('inventory', inventory || []);
  gameInstance.registry.set('cakeGoal', cakeGoal || {});
  gameInstance.registry.set('evilLuckConfig', evilLuckConfig || {});
  gameInstance.registry.set('score', 0);
  gameInstance.registry.set('currentPhase', null);
  
  // Register HUD scene (always available)
  gameInstance.scene.add('HUDScene', HUDScene, true); // true = start immediately
  
  // Register phase select scene (used for transitions)
  gameInstance.scene.add('PhaseSelectScene', PhaseSelectScene, false);
  
  console.log('Phaser game initialized with context:', {
    inventoryCount: inventory?.length || 0,
    cakeGoal: cakeGoal,
    evilLuckEnabled: !!evilLuckConfig
  });
  
  return gameInstance;
};

/**
 * Destroy the current game instance
 */
window.destroyGame = function() {
  if (gameInstance) {
    gameInstance.destroy(true);
    gameInstance = null;
    
    // Hide the container
    const container = document.getElementById('phaser-container');
    if (container) {
      container.style.display = 'none';
    }
    
    console.log('Phaser game destroyed');
  }
};

/**
 * Get the current game instance
 * @returns {Phaser.Game|null}
 */
window.getGame = function() {
  return gameInstance;
};
