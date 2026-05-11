const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const {
  startBaking,
  pauseBaking,
  resumeBaking,
  getTimeRemaining,
  completePhase,
  getPhaseScores,
  getTeamExtraTime,
  calculateVirtualCakeScores
} = require('../server/baking');

// Create test database
function createTestDb() {
  const testDbPath = path.join(__dirname, '../data/test-baking.db');
  
  // Remove if exists
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  const db = new Database(testDbPath);
  
  // Create schema
  db.exec(`
    CREATE TABLE teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      money INTEGER DEFAULT 0,
      is_virtual_team BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      item_key TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      approved_by_host BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id)
    );

    CREATE TABLE game_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      phase TEXT NOT NULL,
      score REAL NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id)
    );
  `);
  
  return { db, dbPath: testDbPath };
}

test('startBaking creates timer entry in game_state', () => {
  const { db, dbPath } = createTestDb();
  
  try {
    startBaking(db, 1800); // 30 minutes
    
    const startTime = db.prepare('SELECT value FROM game_state WHERE key = ?').get('baking_start_time');
    const duration = db.prepare('SELECT value FROM game_state WHERE key = ?').get('baking_duration');
    
    assert.ok(startTime, 'Start time should be set');
    assert.strictEqual(duration.value, '1800', 'Duration should be 1800 seconds');
    
    const parsedStartTime = parseInt(startTime.value, 10);
    assert.ok(Date.now() - parsedStartTime < 1000, 'Start time should be recent');
  } finally {
    db.close();
    fs.unlinkSync(dbPath);
  }
});

test('getTimeRemaining returns seconds left', () => {
  const { db, dbPath } = createTestDb();
  
  try {
    // Start timer with 10 seconds duration
    const startTime = Date.now();
    db.prepare('INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)').run('baking_start_time', startTime.toString());
    db.prepare('INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)').run('baking_duration', '10');
    
    const remaining = getTimeRemaining(db);
    
    assert.ok(remaining >= 9 && remaining <= 10, `Time remaining should be ~10 seconds, got ${remaining}`);
  } finally {
    db.close();
    fs.unlinkSync(dbPath);
  }
});

test('getTimeRemaining returns 0 when timer expired', () => {
  const { db, dbPath } = createTestDb();
  
  try {
    // Start timer in the past
    const startTime = Date.now() - 20000; // 20 seconds ago
    db.prepare('INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)').run('baking_start_time', startTime.toString());
    db.prepare('INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)').run('baking_duration', '10');
    
    const remaining = getTimeRemaining(db);
    
    assert.strictEqual(remaining, 0, 'Time remaining should be 0 when expired');
  } finally {
    db.close();
    fs.unlinkSync(dbPath);
  }
});

test('pauseBaking freezes remaining time until resumed', () => {
  const { db, dbPath } = createTestDb();

  try {
    const startTime = Date.now() - 3000;
    db.prepare('INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)').run('baking_start_time', startTime.toString());
    db.prepare('INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)').run('baking_duration', '10');

    const pausedRemaining = pauseBaking(db);
    const storedRemaining = db.prepare('SELECT value FROM game_state WHERE key = ?').get('baking_paused_remaining');

    assert.ok(pausedRemaining >= 6 && pausedRemaining <= 7, `Paused time should be about 7 seconds, got ${pausedRemaining}`);
    assert.strictEqual(Number(storedRemaining.value), pausedRemaining, 'Paused remaining time should be stored');
    assert.strictEqual(getTimeRemaining(db), pausedRemaining, 'Paused timer should stay frozen');
  } finally {
    db.close();
    fs.unlinkSync(dbPath);
  }
});

test('resumeBaking restarts timer from paused remaining time', () => {
  const { db, dbPath } = createTestDb();

  try {
    db.prepare('INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)').run('baking_paused_remaining', '7');

    const resumedRemaining = resumeBaking(db);
    const pausedRow = db.prepare('SELECT value FROM game_state WHERE key = ?').get('baking_paused_remaining');

    assert.ok(resumedRemaining >= 6 && resumedRemaining <= 7, `Resumed time should stay about 7 seconds, got ${resumedRemaining}`);
    assert.strictEqual(pausedRow, undefined, 'Paused marker should be cleared after resume');
    assert.ok(getTimeRemaining(db) >= 6 && getTimeRemaining(db) <= 7, 'Resumed timer should count down from paused value');
  } finally {
    db.close();
    fs.unlinkSync(dbPath);
  }
});

test('completePhase records phase score in scores table', () => {
  const { db, dbPath } = createTestDb();
  
  try {
    // Create a team
    db.prepare('INSERT INTO teams (name, money) VALUES (?, ?)').run('Test Team', 1000);
    const team = db.prepare('SELECT id FROM teams WHERE name = ?').get('Test Team');
    
    completePhase(db, team.id, 'prep', 85.5, JSON.stringify({ accuracy: 90, speed: 81 }));
    
    const score = db.prepare('SELECT * FROM scores WHERE team_id = ? AND phase = ?').get(team.id, 'prep');
    
    assert.ok(score, 'Score should be recorded');
    assert.strictEqual(score.team_id, team.id);
    assert.strictEqual(score.phase, 'prep');
    assert.strictEqual(score.score, 85.5);
    assert.ok(score.details, 'Details should be stored');
  } finally {
    db.close();
    fs.unlinkSync(dbPath);
  }
});

test('getPhaseScores returns all phase scores for a team', () => {
  const { db, dbPath } = createTestDb();
  
  try {
    // Create a team
    db.prepare('INSERT INTO teams (name, money) VALUES (?, ?)').run('Test Team', 1000);
    const team = db.prepare('SELECT id FROM teams WHERE name = ?').get('Test Team');
    
    // Add multiple phase scores
    completePhase(db, team.id, 'prep', 85, JSON.stringify({ notes: 'good prep' }));
    completePhase(db, team.id, 'mix', 90, JSON.stringify({ notes: 'excellent mixing' }));
    completePhase(db, team.id, 'bake', 78, JSON.stringify({ notes: 'slightly overbaked' }));
    
    const scores = getPhaseScores(db, team.id);
    
    assert.strictEqual(scores.length, 3, 'Should return 3 scores');
    assert.strictEqual(scores[0].phase, 'prep');
    assert.strictEqual(scores[1].phase, 'mix');
    assert.strictEqual(scores[2].phase, 'bake');
  } finally {
    db.close();
    fs.unlinkSync(dbPath);
  }
});

test('getTeamExtraTime returns extra seconds from boosts', () => {
  const { db, dbPath } = createTestDb();
  
  try {
    // Create a team
    db.prepare('INSERT INTO teams (name, money) VALUES (?, ?)').run('Test Team', 1000);
    const team = db.prepare('SELECT id FROM teams WHERE name = ?').get('Test Team');
    
    // Purchase extra-time items
    db.prepare('INSERT INTO purchases (team_id, item_key, category, price) VALUES (?, ?, ?, ?)').run(team.id, 'extra-time', 'boosts', 3000);
    db.prepare('INSERT INTO purchases (team_id, item_key, category, price) VALUES (?, ?, ?, ?)').run(team.id, 'extra-time', 'boosts', 3000);
    
    const extraTime = getTeamExtraTime(db, team.id);
    
    assert.strictEqual(extraTime, 600, 'Should return 600 seconds (2 × 300)');
  } finally {
    db.close();
    fs.unlinkSync(dbPath);
  }
});

test('getTeamExtraTime returns 0 when no extra-time purchased', () => {
  const { db, dbPath } = createTestDb();
  
  try {
    // Create a team
    db.prepare('INSERT INTO teams (name, money) VALUES (?, ?)').run('Test Team', 1000);
    const team = db.prepare('SELECT id FROM teams WHERE name = ?').get('Test Team');
    
    const extraTime = getTeamExtraTime(db, team.id);
    
    assert.strictEqual(extraTime, 0, 'Should return 0 when no extra-time purchased');
  } finally {
    db.close();
    fs.unlinkSync(dbPath);
  }
});

test('calculateVirtualCakeScores aggregates phase scores correctly', () => {
  const { db, dbPath } = createTestDb();
  
  try {
    // Create a team
    db.prepare('INSERT INTO teams (name, money) VALUES (?, ?)').run('Test Team', 1000);
    const team = db.prepare('SELECT id FROM teams WHERE name = ?').get('Test Team');
    
    // Add phase scores
    completePhase(db, team.id, 'prep', 90, null);
    completePhase(db, team.id, 'mix', 80, null);
    completePhase(db, team.id, 'bake', 85, null);
    completePhase(db, team.id, 'decorate', 75, null);
    completePhase(db, team.id, 'present', 88, null);
    
    // Add some inventory items
    db.prepare('INSERT INTO purchases (team_id, item_key, category, price) VALUES (?, ?, ?, ?)').run(team.id, 'cake-banana', 'cakes', 10000);
    db.prepare('INSERT INTO purchases (team_id, item_key, category, price) VALUES (?, ?, ?, ?)').run(team.id, 'flour-premium', 'ingredients', 800);
    db.prepare('INSERT INTO purchases (team_id, item_key, category, price) VALUES (?, ?, ?, ?)').run(team.id, 'eggs-premium', 'ingredients', 600);
    
    const inventory = db.prepare('SELECT * FROM purchases WHERE team_id = ?').all(team.id);
    const result = calculateVirtualCakeScores(db, team.id, inventory);
    
    assert.ok(result.taste, 'Should calculate taste score');
    assert.ok(result.accuracy, 'Should calculate accuracy score');
    assert.ok(result.creativity, 'Should calculate creativity score');
    assert.ok(result.total, 'Should calculate total score');
    assert.strictEqual(result.total, result.taste + result.accuracy + result.creativity, 'Total should be sum of dimensions');
  } finally {
    db.close();
    fs.unlinkSync(dbPath);
  }
});

test('calculateVirtualCakeScores handles missing phase scores gracefully', () => {
  const { db, dbPath } = createTestDb();
  
  try {
    // Create a team
    db.prepare('INSERT INTO teams (name, money) VALUES (?, ?)').run('Test Team', 1000);
    const team = db.prepare('SELECT id FROM teams WHERE name = ?').get('Test Team');
    
    // Only add some phase scores
    completePhase(db, team.id, 'prep', 90, null);
    completePhase(db, team.id, 'mix', 80, null);
    
    const inventory = [];
    const result = calculateVirtualCakeScores(db, team.id, inventory);
    
    assert.ok(result.taste >= 0, 'Should handle missing scores for taste');
    assert.ok(result.accuracy >= 0, 'Should handle missing scores for accuracy');
    assert.ok(result.creativity >= 0, 'Should handle missing scores for creativity');
  } finally {
    db.close();
    fs.unlinkSync(dbPath);
  }
});
