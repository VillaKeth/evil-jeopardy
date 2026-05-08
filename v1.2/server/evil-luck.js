const evilLuckConfig = require('../data/evil-luck.json');

/**
 * Calculate chaos level based on team's performance in trivia
 * @param {number} teamMoney - Amount of money the team earned
 * @param {number} maxPossibleMoney - Maximum possible money that could be earned
 * @returns {string} - Chaos level: "good", "medium", or "bad"
 */
function calculateChaosLevel(teamMoney, maxPossibleMoney) {
  if (!maxPossibleMoney || maxPossibleMoney <= 0) {
    return teamMoney < 0 ? 'bad' : 'medium';
  }
  
  if (teamMoney < 0) {
    return 'bad';
  }
  
  const moneyPercent = (teamMoney / maxPossibleMoney) * 100;
  
  if (moneyPercent >= 50) {
    return 'good';
  }
  
  return 'medium';
}

/**
 * Select minigames for a baking session based on chaos level
 * @param {string} chaosLevel - The chaos level ("good", "medium", or "bad")
 * @param {object} minigamesConfig - Configuration object with phase definitions
 * @returns {array} - Array of 6 minigame selections [{phase, minigame}, ...]
 */
function selectMinigamesForSession(chaosLevel, minigamesConfig) {
  const chaosTier = evilLuckConfig.chaosTiers[chaosLevel];
  const phases = ['prep', 'mix', 'bake', 'cool', 'decorate', 'present'];
  const selections = [];
  
  // Find eligible phases for guaranteed absurd (not absurdExcluded)
  const eligiblePhases = phases.filter(phase => {
    const phaseConfig = minigamesConfig.phases[phase];
    return !phaseConfig.absurdExcluded;
  });
  
  if (eligiblePhases.length === 0) {
    throw new Error('No eligible phases for absurd minigames');
  }
  
  // Pick one random phase for guaranteed absurd
  const guaranteedAbsurdPhase = eligiblePhases[Math.floor(Math.random() * eligiblePhases.length)];
  
  // Select minigame for each phase
  for (const phase of phases) {
    const phaseConfig = minigamesConfig.phases[phase];
    let useAbsurd = false;
    
    // Check if this is the guaranteed absurd phase
    if (phase === guaranteedAbsurdPhase) {
      useAbsurd = true;
    } else if (!phaseConfig.absurdExcluded) {
      // Roll for absurd chance for other eligible phases
      useAbsurd = Math.random() < chaosTier.absurdChance;
    }
    
    // Select from appropriate pool
    const pool = useAbsurd && phaseConfig.absurd ? phaseConfig.absurd : phaseConfig.normal;
    if (!pool || pool.length === 0) {
      throw new Error(`Empty minigame pool for phase: ${phase}`);
    }
    const minigame = pool[Math.floor(Math.random() * pool.length)];
    
    selections.push({ phase, minigame });
  }
  
  return selections;
}

/**
 * Roll for a chaos event during a specific phase
 * @param {string} chaosLevel - The chaos level ("good", "medium", or "bad")
 * @param {string} currentPhase - The current baking phase
 * @param {object} evilLuckConfig - Configuration object with chaos tiers and events
 * @returns {object|null} - Event object if triggered, null otherwise
 */
function rollChaosEvent(chaosLevel, currentPhase, evilLuckConfig) {
  const chaosTier = evilLuckConfig.chaosTiers[chaosLevel];
  
  // Roll for event
  if (Math.random() >= chaosTier.eventChance) {
    return null;
  }
  
  // Filter events that match current phase or "any"
  const eligibleEvents = evilLuckConfig.events.filter(event => 
    event.phase.includes(currentPhase) || event.phase.includes('any')
  );
  
  if (eligibleEvents.length === 0) {
    return null;
  }
  
  // Pick random event from eligible ones
  const event = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];
  
  return event;
}

module.exports = {
  calculateChaosLevel,
  selectMinigamesForSession,
  rollChaosEvent
};
