const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

function initDB(dbPath) {
  const resolvedPath = dbPath || path.join(__dirname, '..', 'data', 'evil-jeopardy.db');
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      game_id TEXT PRIMARY KEY,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      player_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL REFERENCES games(game_id),
      event_type TEXT NOT NULL,
      event_data TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS question_packs (
      pack_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      question_id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_id TEXT NOT NULL REFERENCES question_packs(pack_id),
      category TEXT NOT NULL,
      value INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      answer TEXT NOT NULL,
      used_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS player_profiles (
      name TEXT PRIMARY KEY,
      avatar_path TEXT,
      games_played INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 0
    );
  `);

  return db;
}

function getDB() {
  if (!db) throw new Error('Database not initialized — call initDB() first');
  return db;
}

function closeDB() {
  if (db) { db.close(); db = null; }
}

function createGame(gameId, playerCount) {
  getDB().prepare(
    'INSERT INTO games (game_id, start_time, player_count) VALUES (?, ?, ?)'
  ).run(gameId, Date.now(), playerCount);
  return gameId;
}

function endGame(gameId) {
  getDB().prepare('UPDATE games SET end_time = ? WHERE game_id = ?').run(Date.now(), gameId);
}

function logEvent(gameId, eventType, eventData) {
  getDB().prepare(
    'INSERT INTO game_events (game_id, event_type, event_data, timestamp) VALUES (?, ?, ?, ?)'
  ).run(gameId, eventType, JSON.stringify(eventData), Date.now());
}

function getGameEvents(gameId) {
  return getDB().prepare(
    'SELECT * FROM game_events WHERE game_id = ? ORDER BY event_id ASC'
  ).all(gameId);
}

function listGames() {
  return getDB().prepare(
    'SELECT * FROM games ORDER BY start_time DESC'
  ).all();
}

function upsertPlayerProfile(name, avatarPath) {
  getDB().prepare(`
    INSERT INTO player_profiles (name, avatar_path) VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET avatar_path = COALESCE(excluded.avatar_path, avatar_path)
  `).run(name, avatarPath);
}

module.exports = {
  initDB, getDB, closeDB,
  createGame, endGame, logEvent, getGameEvents, listGames,
  upsertPlayerProfile
};
