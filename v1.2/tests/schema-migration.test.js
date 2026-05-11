const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const io = require('socket.io-client');
const { createApp } = require('../server/index.js');

function onceEvent(socket, eventName, emitAction) {
  return new Promise((resolve) => {
    socket.once(eventName, (...args) => {
      resolve(args.length <= 1 ? args[0] : args);
    });

    if (typeof emitAction === 'function') {
      emitAction();
    }
  });
}

test('get-state succeeds against legacy score schema during baking rehydration', async () => {
  const dbPath = './data/test-legacy-state.db';
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  const rawDb = new Database(dbPath);
  rawDb.exec(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE pending_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      item_key TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE game_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      dimension TEXT NOT NULL,
      value INTEGER NOT NULL,
      source TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE physical_scores (
      team_id INTEGER PRIMARY KEY,
      taste INTEGER DEFAULT 0,
      accuracy INTEGER DEFAULT 0,
      creativity INTEGER DEFAULT 0
    );

    CREATE TABLE events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  rawDb.prepare('INSERT INTO teams (name, money, is_virtual_team) VALUES (?, ?, ?)').run('Legacy Virtual', 1200, 1);
  const setState = rawDb.prepare('INSERT INTO game_state (key, value) VALUES (?, ?)');
  setState.run('phase', 'BAKING');
  setState.run('baking_team_id', '1');
  setState.run('baking_duration', '300');
  setState.run('baking_start_time', String(Date.now()));
  setState.run('baking_current_phase_index', '0');
  setState.run('baking_minigames', JSON.stringify([
    {
      phase: 'prep',
      minigame: 'prep-measure',
      sceneKey: 'PrepScene',
      description: 'Measure ingredients.',
      phaseName: 'PREP',
      isAbsurd: false
    }
  ]));
  setState.run('baking_chaos_events', '[]');
  setState.run('baking_chaos_log', '[]');
  rawDb.close();

  const app = createApp({ dbPath, port: 3014 });
  await app.listen();

  const socket = io('http://localhost:3014');
  await new Promise((resolve) => socket.on('connect', resolve));

  socket.emit('join-room', 'player');
  const statePromise = onceEvent(socket, 'state', () => {
    socket.emit('get-state');
  });
  const errorPromise = onceEvent(socket, 'error');

  const result = await Promise.race([
    statePromise.then((state) => ({ kind: 'state', state })),
    errorPromise.then((error) => ({ kind: 'error', error }))
  ]);

  socket.close();
  await app.close();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  assert.strictEqual(result.kind, 'state');
  assert.strictEqual(result.state.phase, 'BAKING');
  assert.ok(Array.isArray(result.state.teams));
  assert.ok(result.state.baking);
});
