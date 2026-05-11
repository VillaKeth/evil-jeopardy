/**
 * Baking Engine — Server-Side Timer & Phase Management
 * 
 * Manages the virtual cake baking minigame:
 * - Timer management (start, pause, resume)
 * - Phase completion tracking (prep, mix, bake, decorate, present)
 * - Score aggregation (taste, accuracy, creativity)
 * - Extra time boosts from shop purchases
 */

/**
 * Start a baking timer
 * @param {object} db - Database instance
 * @param {number} durationSec - Duration in seconds
 */
function startBaking(db, durationSec) {
  const startTime = Date.now();

  db.prepare('INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)').run('baking_start_time', startTime.toString());
  db.prepare('INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)').run('baking_duration', durationSec.toString());
  db.prepare('DELETE FROM game_state WHERE key IN (?, ?)').run('baking_paused_remaining', 'baking_paused_at');
}

/**
 * Pause the baking timer and persist the remaining time.
 * @param {object} db - Database instance
 * @returns {number} Remaining seconds at the moment of pause
 */
function pauseBaking(db) {
  const remaining = getTimeRemaining(db);
  db.prepare('INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)').run('baking_paused_remaining', remaining.toString());
  db.prepare('INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)').run('baking_paused_at', Date.now().toString());
  return remaining;
}

/**
 * Resume the baking timer from the persisted paused time.
 * @param {object} db - Database instance
 * @returns {number} Remaining seconds after resume
 */
function resumeBaking(db) {
  const pausedRow = db.prepare('SELECT value FROM game_state WHERE key = ?').get('baking_paused_remaining');
  const remaining = Math.max(0, parseInt(pausedRow?.value || '0', 10) || 0);

  db.prepare('INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)').run('baking_start_time', Date.now().toString());
  db.prepare('INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)').run('baking_duration', remaining.toString());
  db.prepare('DELETE FROM game_state WHERE key IN (?, ?)').run('baking_paused_remaining', 'baking_paused_at');

  return remaining;
}

/**
 * Get time remaining in seconds
 * @param {object} db - Database instance
 * @returns {number} Seconds remaining (0 if expired)
 */
function getTimeRemaining(db) {
  const pausedRow = db.prepare('SELECT value FROM game_state WHERE key = ?').get('baking_paused_remaining');
  if (pausedRow) {
    return Math.max(0, parseInt(pausedRow.value, 10) || 0);
  }

  const startTimeRow = db.prepare('SELECT value FROM game_state WHERE key = ?').get('baking_start_time');
  const durationRow = db.prepare('SELECT value FROM game_state WHERE key = ?').get('baking_duration');
  
  if (!startTimeRow || !durationRow) {
    return 0;
  }
  
  const startTime = parseInt(startTimeRow.value, 10);
  const duration = parseInt(durationRow.value, 10);
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const remaining = duration - elapsed;
  
  return Math.max(0, remaining);
}

/**
 * Record a completed phase score
 * @param {object} db - Database instance
 * @param {number} teamId - Team ID
 * @param {string} phaseKey - Phase key (prep, mix, bake, decorate, present)
 * @param {number} score - Phase score (0-100)
 * @param {string|null} details - Optional JSON details
 */
function completePhase(db, teamId, phaseKey, score, details) {
  db.prepare('INSERT INTO scores (team_id, phase, score, details) VALUES (?, ?, ?, ?)').run(teamId, phaseKey, score, details);
}

/**
 * Get all phase scores for a team
 * @param {object} db - Database instance
 * @param {number} teamId - Team ID
 * @returns {Array<object>} Array of score records
 */
function getPhaseScores(db, teamId) {
  return db.prepare('SELECT * FROM scores WHERE team_id = ? ORDER BY created_at').all(teamId);
}

/**
 * Get extra time from purchased boosts
 * @param {object} db - Database instance
 * @param {number} teamId - Team ID
 * @returns {number} Total extra seconds
 */
function getTeamExtraTime(db, teamId) {
  const extraTimeItems = db.prepare('SELECT COUNT(*) as count FROM purchases WHERE team_id = ? AND item_key = ?').get(teamId, 'extra-time');
  
  // Each extra-time item gives 300 seconds (5 minutes)
  return (extraTimeItems.count || 0) * 300;
}

/**
 * Calculate virtual cake scores from phase scores and inventory
 * @param {object} db - Database instance
 * @param {number} teamId - Team ID
 * @param {Array<object>} inventory - Team's purchased items
 * @returns {object} {taste, accuracy, creativity, total}
 */
function calculateVirtualCakeScores(db, teamId, inventory) {
  if (!Array.isArray(inventory)) inventory = [];
  
  // Get phase scores
  const phaseScores = getPhaseScores(db, teamId);
  const scoreMap = {};
  phaseScores.forEach(s => {
    scoreMap[s.phase] = s.score;
  });
  
  // Get scores for each phase (default to 0 if missing)
  const prepScore = scoreMap.prep || 0;
  const mixScore = scoreMap.mix || 0;
  const bakeScore = scoreMap.bake || 0;
  const decorateScore = scoreMap.decorate || 0;
  const presentScore = scoreMap.present || 0;
  
  // Calculate average ingredient quality from inventory
  const ingredientQualities = [];
  inventory.forEach(item => {
    if (item.category === 'ingredients') {
      // Look up quality from shop data
      const qualityMap = {
        'flour-basic': 1, 'flour-premium': 3,
        'eggs-basic': 1, 'eggs-premium': 3,
        'butter-basic': 1, 'butter-premium': 3,
        'sugar': 2, 'chocolate': 3, 'vanilla': 2,
        'fondant': 3, 'food-coloring': 2, 'fruits': 2
      };
      const quality = qualityMap[item.item_key];
      if (quality) {
        ingredientQualities.push(quality);
      }
    }
  });
  
  const avgIngredientQuality = ingredientQualities.length > 0
    ? ingredientQualities.reduce((sum, q) => sum + q, 0) / ingredientQualities.length
    : 1;
  
  // Get cake difficulty from inventory
  let cakeDifficulty = 1;
  const cakeItem = inventory.find(item => item.category === 'cakes');
  if (cakeItem) {
    const difficultyMap = {
      'cake-banana': 1,
      'cake-chocolate-layer': 3,
      'cake-wedding': 5,
      'cake-statue-liberty': 10
    };
    cakeDifficulty = difficultyMap[cakeItem.item_key] || 1;
  }
  
  // Calculate bonus decorations (from tools/boosts)
  let bonusDecorations = 0;
  inventory.forEach(item => {
    if (item.category === 'tools') {
      const bonusMap = {
        'piping-tips': 5,
        'mixer-electric': 3,
        'pans-set': 2
      };
      bonusDecorations += bonusMap[item.item_key] || 0;
    }
  });
  
  // Calculate final scores
  // Taste = avg(prep, mix, bake) × avg_ingredient_quality
  const taste = ((prepScore + mixScore + bakeScore) / 3) * avgIngredientQuality;
  
  // Accuracy = avg(decorate, present) × (1 / cake_difficulty × 10)
  const accuracy = ((decorateScore + presentScore) / 2) * (1 / cakeDifficulty * 10);
  
  // Creativity = decorate × 0.6 + present × 0.4 + bonus_decorations
  const creativity = decorateScore * 0.6 + presentScore * 0.4 + bonusDecorations;
  
  const total = taste + accuracy + creativity;
  
  return {
    taste: Math.round(taste * 100) / 100,
    accuracy: Math.round(accuracy * 100) / 100,
    creativity: Math.round(creativity * 100) / 100,
    total: Math.round(total * 100) / 100
  };
}

module.exports = {
  startBaking,
  pauseBaking,
  resumeBaking,
  getTimeRemaining,
  completePhase,
  getPhaseScores,
  getTeamExtraTime,
  calculateVirtualCakeScores
};
