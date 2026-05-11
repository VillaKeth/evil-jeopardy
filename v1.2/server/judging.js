const { calculateVirtualCakeScores } = require('./baking');

function getRawDb(db) {
  if (db && typeof db.prepare === 'function') {
    return db;
  }

  if (db && db.db && typeof db.db.prepare === 'function') {
    return db.db;
  }

  throw new Error('A valid database connection is required.');
}

function ensureJudgingSchema(db) {
  return getRawDb(db);
}

function clampScore(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

function roundScore(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function averageScores(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getPhysicalScores(db, teamId) {
  const rawDb = ensureJudgingSchema(db);
  const row = rawDb.prepare('SELECT taste, accuracy, creativity FROM physical_scores WHERE team_id = ?').get(teamId);

  return {
    taste: clampScore(row ? row.taste : 0),
    accuracy: clampScore(row ? row.accuracy : 0),
    creativity: clampScore(row ? row.creativity : 0)
  };
}

function getVirtualScores(db, teamId) {
  const rawDb = ensureJudgingSchema(db);
  const inventory = rawDb.prepare(`
    SELECT *
    FROM purchases
    WHERE team_id = ? AND COALESCE(approved_by_host, 1) = 1
    ORDER BY created_at, id
  `).all(teamId);

  const calculated = calculateVirtualCakeScores(rawDb, teamId, inventory);
  const taste = clampScore(calculated.taste);
  const accuracy = clampScore(calculated.accuracy);
  const creativity = clampScore(calculated.creativity);

  return {
    taste,
    accuracy,
    creativity,
    total: roundScore(taste + accuracy + creativity),
    average: roundScore(averageScores([taste, accuracy, creativity]))
  };
}

function scorePhysicalCake(db, teamId, taste, accuracy, creativity) {
  const rawDb = ensureJudgingSchema(db);

  if (typeof teamId !== 'number' || !Number.isInteger(teamId) || teamId <= 0) {
    throw new Error('A valid team ID is required.');
  }

  const safeTaste = clampScore(taste);
  const safeAccuracy = clampScore(accuracy);
  const safeCreativity = clampScore(creativity);

  rawDb.prepare(`
    INSERT INTO physical_scores (team_id, taste, accuracy, creativity)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(team_id) DO UPDATE SET
      taste = excluded.taste,
      accuracy = excluded.accuracy,
      creativity = excluded.creativity
  `).run(teamId, safeTaste, safeAccuracy, safeCreativity);

  return {
    teamId,
    taste: safeTaste,
    accuracy: safeAccuracy,
    creativity: safeCreativity,
    total: roundScore(averageScores([safeTaste, safeAccuracy, safeCreativity]))
  };
}

function getTeamFinalScore(db, teamId, isVirtualTeam) {
  const physicalScores = getPhysicalScores(db, teamId);
  const physicalAverage = roundScore(averageScores([
    physicalScores.taste,
    physicalScores.accuracy,
    physicalScores.creativity
  ]));

  if (!isVirtualTeam) {
    return {
      ...physicalScores,
      total: physicalAverage
    };
  }

  const virtualScores = getVirtualScores(db, teamId);

  return {
    ...physicalScores,
    total: roundScore(averageScores([physicalAverage, virtualScores.average])),
    virtualScores
  };
}

function getResults(db) {
  const rawDb = ensureJudgingSchema(db);
  const teams = rawDb.prepare(`
    SELECT id, name, is_virtual_team
    FROM teams
    ORDER BY created_at, id
  `).all();

  return teams
    .map((team) => ({
      teamId: team.id,
      teamName: team.name,
      isVirtualTeam: team.is_virtual_team === 1,
      hasPhysicalScores: Boolean(rawDb.prepare('SELECT 1 FROM physical_scores WHERE team_id = ?').get(team.id)),
      scores: getTeamFinalScore(rawDb, team.id, team.is_virtual_team === 1)
    }))
    .sort((left, right) => right.scores.total - left.scores.total || left.teamName.localeCompare(right.teamName))
    .map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
}

module.exports = {
  scorePhysicalCake,
  getTeamFinalScore,
  getResults,
  ensureJudgingSchema
};
