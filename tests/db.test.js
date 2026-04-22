const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Use temp directory for test databases
const TEST_DB_DIR = path.join(__dirname, '..', 'data-test');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test.db');

describe('db module', () => {
  let db;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (!fs.existsSync(TEST_DB_DIR)) fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    delete require.cache[require.resolve('../server/db')];
    db = require('../server/db');
    db.initDB(TEST_DB_PATH);
  });

  afterEach(() => {
    db.closeDB();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('initDB creates all required tables', () => {
    const tables = db.getDB().prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all().map(r => r.name);
    assert.ok(tables.includes('games'));
    assert.ok(tables.includes('game_events'));
    assert.ok(tables.includes('question_packs'));
    assert.ok(tables.includes('questions'));
    assert.ok(tables.includes('player_profiles'));
  });

  it('createGame inserts a game record', () => {
    const gameId = db.createGame('test-game-1', 3);
    const game = db.getDB().prepare('SELECT * FROM games WHERE game_id = ?').get(gameId);
    assert.ok(game);
    assert.strictEqual(game.player_count, 3);
    assert.ok(game.start_time > 0);
  });

  it('endGame sets end_time', () => {
    db.createGame('test-game-2', 2);
    db.endGame('test-game-2');
    const game = db.getDB().prepare('SELECT * FROM games WHERE game_id = ?').get('test-game-2');
    assert.ok(game.end_time > 0);
  });

  it('logEvent inserts an event', () => {
    db.createGame('g1', 2);
    db.logEvent('g1', 'game-start', { players: ['Kevin', 'Sarah'] });
    const events = db.getGameEvents('g1');
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].event_type, 'game-start');
    assert.deepStrictEqual(JSON.parse(events[0].event_data), { players: ['Kevin', 'Sarah'] });
  });

  it('getGameEvents returns events in order', () => {
    db.createGame('g2', 2);
    db.logEvent('g2', 'event-a', { order: 1 });
    db.logEvent('g2', 'event-b', { order: 2 });
    db.logEvent('g2', 'event-c', { order: 3 });
    const events = db.getGameEvents('g2');
    assert.strictEqual(events.length, 3);
    assert.strictEqual(events[0].event_type, 'event-a');
    assert.strictEqual(events[2].event_type, 'event-c');
  });

  it('listGames returns all games', () => {
    db.createGame('g3', 3);
    db.createGame('g4', 2);
    const games = db.listGames();
    assert.strictEqual(games.length, 2);
  });

  it('upsertPlayerProfile creates and updates profiles', () => {
    db.upsertPlayerProfile('Kevin', null);
    db.upsertPlayerProfile('Kevin', '/avatars/kevin.webp');
    const profile = db.getDB().prepare('SELECT * FROM player_profiles WHERE name = ?').get('Kevin');
    assert.strictEqual(profile.avatar_path, '/avatars/kevin.webp');
  });
});
