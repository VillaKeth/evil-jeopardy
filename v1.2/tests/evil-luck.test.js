const test = require('node:test');
const assert = require('node:assert');
const { calculateChaosLevel, selectMinigamesForSession, rollChaosEvent } = require('../server/evil-luck');
const evilLuckConfig = require('../data/evil-luck.json');
const minigamesConfig = require('../data/minigames.json');

test('calculateChaosLevel returns "good" when team has 50% or more of max money', () => {
  assert.strictEqual(calculateChaosLevel(500, 1000), 'good');
  assert.strictEqual(calculateChaosLevel(1000, 1000), 'good');
  assert.strictEqual(calculateChaosLevel(750, 1000), 'good');
});

test('calculateChaosLevel returns "medium" when team has 0-49% of max money', () => {
  assert.strictEqual(calculateChaosLevel(0, 1000), 'medium');
  assert.strictEqual(calculateChaosLevel(100, 1000), 'medium');
  assert.strictEqual(calculateChaosLevel(499, 1000), 'medium');
});

test('calculateChaosLevel returns "bad" when team has negative money', () => {
  assert.strictEqual(calculateChaosLevel(-100, 1000), 'bad');
  assert.strictEqual(calculateChaosLevel(-1, 1000), 'bad');
  assert.strictEqual(calculateChaosLevel(-5000, 1000), 'bad');
});

test('selectMinigamesForSession returns exactly 6 minigames', () => {
  const result = selectMinigamesForSession('good', minigamesConfig);
  assert.strictEqual(result.length, 6);
});

test('selectMinigamesForSession returns one minigame per phase', () => {
  const result = selectMinigamesForSession('medium', minigamesConfig);
  const phases = result.map(m => m.phase);
  const expectedPhases = ['prep', 'mix', 'bake', 'cool', 'decorate', 'present'];
  
  assert.deepStrictEqual(phases.sort(), expectedPhases.sort());
});

test('selectMinigamesForSession guarantees at least one absurd minigame from eligible phases', () => {
  // Run multiple times to ensure guarantee works
  const iterations = 50;
  let allHaveAbsurd = true;
  
  for (let i = 0; i < iterations; i++) {
    const result = selectMinigamesForSession('good', minigamesConfig);
    // Check if at least one absurd minigame exists in non-prep phases
    const hasAbsurd = result.some(m => 
      m.phase !== 'prep' && 
      minigamesConfig.phases[m.phase].absurd.includes(m.minigame)
    );
    
    if (!hasAbsurd) {
      allHaveAbsurd = false;
      break;
    }
  }
  
  assert.strictEqual(allHaveAbsurd, true, 'Should always have at least one absurd minigame from eligible phases');
});

test('selectMinigamesForSession never uses prep phase for guaranteed absurd', () => {
  // Run multiple times to ensure prep is never the guaranteed absurd
  const iterations = 100;
  
  for (let i = 0; i < iterations; i++) {
    const result = selectMinigamesForSession('medium', minigamesConfig);
    const prepMinigame = result.find(m => m.phase === 'prep');
    
    // Prep should always be normal (prep-measure is in both normal and absurd arrays, but prep is excluded)
    assert.strictEqual(prepMinigame.minigame, 'prep-measure');
  }
});

test('selectMinigamesForSession respects absurdChance based on chaos level', () => {
  // Test with "bad" chaos level (60% absurd chance)
  // Run many iterations and check distribution
  const iterations = 200;
  let totalAbsurdCount = 0;
  
  for (let i = 0; i < iterations; i++) {
    const result = selectMinigamesForSession('bad', minigamesConfig);
    const absurdCount = result.filter(m => {
      const phaseConfig = minigamesConfig.phases[m.phase];
      return phaseConfig.absurd && phaseConfig.absurd.includes(m.minigame);
    }).length;
    totalAbsurdCount += absurdCount;
  }
  
  const avgAbsurdCount = totalAbsurdCount / iterations;
  // With 60% chance on 5 eligible phases + 1 guaranteed, expect 3.5-4.5 absurd on average
  assert.ok(avgAbsurdCount >= 3.0 && avgAbsurdCount <= 5.0, 
    `Average absurd count ${avgAbsurdCount} should be between 3.0 and 5.0 for bad chaos level`);
});

test('rollChaosEvent returns null or event object', () => {
  const result = rollChaosEvent('good', 'mix', evilLuckConfig);
  
  if (result !== null) {
    assert.ok(typeof result === 'object');
    assert.ok(result.key);
    assert.ok(result.name);
    assert.ok(result.description);
    assert.ok(typeof result.scorePenalty === 'number');
  }
});

test('rollChaosEvent respects phase filtering', () => {
  // Mock Math.random to always trigger event
  const originalRandom = Math.random;
  Math.random = () => 0.01; // Always trigger event
  
  try {
    const result = rollChaosEvent('medium', 'bake', evilLuckConfig);
    
    if (result !== null) {
      // Event should be valid for bake phase or "any"
      assert.ok(
        result.phase.includes('bake') || result.phase.includes('any'),
        `Event phase ${result.phase} should include 'bake' or 'any'`
      );
    }
  } finally {
    Math.random = originalRandom;
  }
});

test('rollChaosEvent has base chance even at "good" chaos level', () => {
  // Run many iterations and ensure some events occur even at good level
  const iterations = 500;
  let eventCount = 0;
  
  for (let i = 0; i < iterations; i++) {
    const result = rollChaosEvent('good', 'mix', evilLuckConfig);
    if (result !== null) {
      eventCount++;
    }
  }
  
  const eventRate = eventCount / iterations;
  // Good level has 12% event chance, expect 8-16% range (allowing variance)
  assert.ok(eventRate >= 0.06 && eventRate <= 0.20, 
    `Event rate ${eventRate} should be between 6% and 20% for good chaos level (expected ~12%)`);
});

test('rollChaosEvent increases chance with higher chaos levels', () => {
  const originalRandom = Math.random;
  const rolls = [];
  let rollIndex = 0;
  
  Math.random = () => rolls[rollIndex++];
  
  try {
    // Test good level (12% chance) - should NOT trigger at 0.13
    rolls.push(0.13);
    rollIndex = 0;
    const goodResult = rollChaosEvent('good', 'mix', evilLuckConfig);
    assert.strictEqual(goodResult, null);
    
    // Test medium level (25% chance) - should trigger at 0.13
    rolls.push(0.13);
    rollIndex = 1;
    const mediumResult = rollChaosEvent('medium', 'mix', evilLuckConfig);
    assert.notStrictEqual(mediumResult, null);
    
    // Test bad level (40% chance) - should trigger at 0.35
    rolls.push(0.35);
    rollIndex = 2;
    const badResult = rollChaosEvent('bad', 'mix', evilLuckConfig);
    assert.notStrictEqual(badResult, null);
  } finally {
    Math.random = originalRandom;
  }
});
