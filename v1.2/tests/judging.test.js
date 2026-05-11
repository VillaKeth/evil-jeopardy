const test = require('node:test');
const assert = require('node:assert');
const { initDb } = require('../server/db');
const { scorePhysicalCake, getTeamFinalScore, getResults } = require('../server/judging');

function createTestDb() {
  return initDb(':memory:');
}

function seedVirtualScores(db, teamId, score = 60) {
  ['prep', 'mix', 'bake', 'decorate', 'present'].forEach((phase) => {
    db.prepare('INSERT INTO scores (team_id, phase, score, details) VALUES (?, ?, ?, ?)').run(teamId, phase, score, null);
  });

  db.prepare('INSERT INTO purchases (team_id, item_key, category, price, approved_by_host) VALUES (?, ?, ?, ?, ?)')
    .run(teamId, 'cake-statue-liberty', 'cakes', 0, 1);
}

test('scorePhysicalCake records physical cake scores and clamps values to 0-100', () => {
  const dbWrapper = createTestDb();
  const team = dbWrapper.createTeam('Clamp Squad');

  try {
    scorePhysicalCake(dbWrapper.db, team.id, -10, 150, 55);

    const stored = dbWrapper.db.prepare('SELECT * FROM physical_scores WHERE team_id = ?').get(team.id);
    assert.ok(stored, 'Physical score row should be stored');
    assert.strictEqual(stored.taste, 0);
    assert.strictEqual(stored.accuracy, 100);
    assert.strictEqual(stored.creativity, 55);
  } finally {
    dbWrapper.close();
  }
});

test('getTeamFinalScore returns averaged physical score for non-virtual teams', () => {
  const dbWrapper = createTestDb();
  const team = dbWrapper.createTeam('Physical Team');

  try {
    scorePhysicalCake(dbWrapper.db, team.id, 80, 70, 90);

    const result = getTeamFinalScore(dbWrapper.db, team.id, false);
    assert.deepStrictEqual(result, {
      taste: 80,
      accuracy: 70,
      creativity: 90,
      total: 80
    });
  } finally {
    dbWrapper.close();
  }
});

test('getTeamFinalScore combines virtual and physical scores for virtual teams', () => {
  const dbWrapper = createTestDb();
  const team = dbWrapper.createTeam('Hybrid Team', true);

  try {
    scorePhysicalCake(dbWrapper.db, team.id, 90, 60, 30);
    seedVirtualScores(dbWrapper.db, team.id, 60);

    const result = getTeamFinalScore(dbWrapper.db, team.id, true);
    assert.strictEqual(result.taste, 90);
    assert.strictEqual(result.accuracy, 60);
    assert.strictEqual(result.creativity, 30);
    assert.strictEqual(result.total, 60);
    assert.ok(result.virtualScores, 'Virtual team should include virtual score details');
    assert.strictEqual(result.virtualScores.taste, 60);
    assert.strictEqual(result.virtualScores.accuracy, 60);
    assert.strictEqual(result.virtualScores.creativity, 60);
    assert.strictEqual(result.virtualScores.total, 180);
  } finally {
    dbWrapper.close();
  }
});

test('getTeamFinalScore defaults missing scores to 0', () => {
  const dbWrapper = createTestDb();
  const team = dbWrapper.createTeam('Unscored Team');

  try {
    const result = getTeamFinalScore(dbWrapper.db, team.id, false);
    assert.deepStrictEqual(result, {
      taste: 0,
      accuracy: 0,
      creativity: 0,
      total: 0
    });
  } finally {
    dbWrapper.close();
  }
});

test('getResults returns ranked standings sorted by highest final score first', () => {
  const dbWrapper = createTestDb();
  const alpha = dbWrapper.createTeam('Alpha Bakers');
  const bravo = dbWrapper.createTeam('Bravo Bakers');
  const charlie = dbWrapper.createTeam('Charlie Virtual', true);

  try {
    scorePhysicalCake(dbWrapper.db, alpha.id, 10, 20, 30);
    scorePhysicalCake(dbWrapper.db, bravo.id, 70, 80, 90);
    scorePhysicalCake(dbWrapper.db, charlie.id, 90, 60, 30);
    seedVirtualScores(dbWrapper.db, charlie.id, 60);

    const results = getResults(dbWrapper.db);

    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0].teamName, 'Bravo Bakers');
    assert.strictEqual(results[0].scores.total, 80);
    assert.strictEqual(results[0].rank, 1);
    assert.strictEqual(results[1].teamName, 'Charlie Virtual');
    assert.strictEqual(results[1].scores.total, 60);
    assert.strictEqual(results[1].rank, 2);
    assert.strictEqual(results[2].teamName, 'Alpha Bakers');
    assert.strictEqual(results[2].scores.total, 20);
    assert.strictEqual(results[2].rank, 3);
  } finally {
    dbWrapper.close();
  }
});
