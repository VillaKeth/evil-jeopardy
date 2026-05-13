const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const io = require('socket.io-client');
const { createApp } = require('../server/index.js');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function onceEventOrTimeout(socket, eventName, emitAction, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handleEvent);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    function handleEvent(...args) {
      clearTimeout(timer);
      resolve(args.length <= 1 ? args[0] : args);
    }

    socket.once(eventName, handleEvent);
    if (typeof emitAction === 'function') {
      emitAction();
    }
  });
}

async function joinRoom(socket, role) {
  const joined = await onceEventOrTimeout(socket, 'room-joined', () => {
    socket.emit('join-room', role);
  });

  assert.strictEqual(joined.role, role);
}

test('player judging UI includes live progress markup handlers and styles', () => {
  const playerHtml = read('public/player.html');
  const playerScript = read('public/js/player.js');
  const styleSheet = read('public/css/style.css');

  assert.match(playerHtml, /id="judging-section"/);
  assert.match(playerHtml, /id="judging-status"/);
  assert.match(playerHtml, /id="judging-progress"/);
  assert.match(playerHtml, /id="judging-team-cards"/);
  assert.match(playerHtml, /id="judging-dimensions"/);
  assert.match(playerHtml, /Taste/);
  assert.match(playerHtml, /Accuracy/);
  assert.match(playerHtml, /Creativity/);
  assert.doesNotMatch(playerHtml, /Judging interface will be added in later tasks/);

  assert.match(playerScript, /socket\.on\('judging:scores-updated'/);
  assert.match(playerScript, /socket\.on\('judging:results'/);
  assert.match(playerScript, /function renderJudgingProgress/);
  assert.match(playerScript, /judging-team-card/);
  assert.match(playerScript, /allTeamsScored/);

  assert.match(styleSheet, /\.judging-team-grid/);
  assert.match(styleSheet, /\.judging-team-card\.judged/);
  assert.match(styleSheet, /\.judging-team-card\.my-team/);
  assert.match(styleSheet, /\.judging-dimension-list/);
});

test('judging updates broadcast to players and rehydrate during judging state requests', async (t) => {
  let app;
  let hostSocket;
  let playerSocket;
  let latePlayerSocket;

  t.after(async () => {
    if (hostSocket) hostSocket.close();
    if (playerSocket) playerSocket.close();
    if (latePlayerSocket) latePlayerSocket.close();
    if (app) {
      await app.close();
    }
  });

  app = createApp({ dbPath: ':memory:', port: 0 });
  await app.listen();

  const serverPort = app.server.address().port;
  const baseUrl = `http://localhost:${serverPort}`;

  hostSocket = io(baseUrl);
  playerSocket = io(baseUrl);

  await Promise.all([
    new Promise((resolve) => hostSocket.on('connect', resolve)),
    new Promise((resolve) => playerSocket.on('connect', resolve))
  ]);

  await Promise.all([
    joinRoom(hostSocket, 'host'),
    joinRoom(playerSocket, 'player')
  ]);

  const team = app.db.createTeam('Judging Alpha');
  app.db.setState('phase', 'JUDGING');

  const update = await onceEventOrTimeout(playerSocket, 'judging:scores-updated', () => {
    hostSocket.emit('judging:score-team', { teamId: team.id, taste: 81, accuracy: 72, creativity: 60 });
  });

  assert.strictEqual(update.teamId, team.id);
  assert.strictEqual(update.allTeamsScored, true);
  assert.ok(Array.isArray(update.results));

  const judgedTeam = update.results.find((entry) => entry.teamId === team.id);
  assert.ok(judgedTeam);
  assert.strictEqual(judgedTeam.hasPhysicalScores, true);
  assert.strictEqual(judgedTeam.scores.taste, 81);
  assert.strictEqual(judgedTeam.scores.accuracy, 72);
  assert.strictEqual(judgedTeam.scores.creativity, 60);
  assert.strictEqual(judgedTeam.scores.total, 71);

  latePlayerSocket = io(baseUrl);
  await new Promise((resolve) => latePlayerSocket.on('connect', resolve));
  await joinRoom(latePlayerSocket, 'player');

  const statePromise = onceEventOrTimeout(latePlayerSocket, 'state');
  const resultsPromise = onceEventOrTimeout(latePlayerSocket, 'judging:results', () => {
    latePlayerSocket.emit('get-state');
  });

  const [state, results] = await Promise.all([statePromise, resultsPromise]);

  assert.strictEqual(state.phase, 'JUDGING');
  assert.ok(Array.isArray(results));
  assert.strictEqual(results[0].teamId, team.id);
  assert.strictEqual(results[0].scores.total, 71);
});
