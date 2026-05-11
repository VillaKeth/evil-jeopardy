const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('path');
const { createApp } = require('../server/index.js');
const io = require('socket.io-client');
const { loadShop } = require('../server/shop');

const shopData = loadShop(path.join(__dirname, '../data/shop.json'));

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

function ensureTeam(app, name, money) {
  let team = app.db.db.prepare('SELECT * FROM teams WHERE name = ?').get(name);
  if (!team) {
    team = app.db.createTeam(name);
  }

  app.db.db.prepare('UPDATE teams SET money = ? WHERE id = ?').run(money, team.id);
  return { ...team, money };
}

async function ensureShopPhase(app, hostSocket, screenSocket) {
  const currentPhase = app.db.getState('phase');

  if (currentPhase === 'SHOP') {
    return;
  }

  if (currentPhase === 'LOBBY') {
    const triviaPhasePromise = onceEvent(screenSocket, 'phase-changed');
    hostSocket.emit('set-phase', 'TRIVIA');
    await triviaPhasePromise;
  }

  if (app.db.getState('phase') === 'TRIVIA') {
    const shopPhasePromise = onceEvent(screenSocket, 'phase-changed');
    const shopCatalogPromise = onceEvent(screenSocket, 'shop:catalog');
    hostSocket.emit('shop:open');
    await Promise.all([shopPhasePromise, shopCatalogPromise]);
  }
}

async function ensureBakingPhase(app, hostSocket, screenSocket) {
  const currentPhase = app.db.getState('phase');

  if (currentPhase === 'BAKING') {
    return;
  }

  if (currentPhase === 'LOBBY') {
    const triviaPhasePromise = onceEvent(screenSocket, 'phase-changed');
    hostSocket.emit('set-phase', 'TRIVIA');
    await triviaPhasePromise;
  }

  if (app.db.getState('phase') === 'TRIVIA') {
    const shopPhasePromise = onceEvent(screenSocket, 'phase-changed');
    const shopCatalogPromise = onceEvent(screenSocket, 'shop:catalog');
    hostSocket.emit('shop:open');
    await Promise.all([shopPhasePromise, shopCatalogPromise]);
  }

  if (app.db.getState('phase') === 'SHOP') {
    const bakingPhasePromise = onceEvent(screenSocket, 'phase-changed');
    hostSocket.emit('shop:close');
    await bakingPhasePromise;
  }
}

async function ensureJudgingPhase(app, hostSocket, screenSocket) {
  await ensureBakingPhase(app, hostSocket, screenSocket);

  if (app.db.getState('phase') === 'BAKING') {
    const judgingPhasePromise = onceEvent(screenSocket, 'phase-changed');
    hostSocket.emit('set-phase', 'JUDGING');
    await judgingPhasePromise;
  }
}

describe('Server Integration', () => {
  let app, hostSocket, screenSocket, playerSocket;
  const testDbPath = './data/test-game.db';
  
  before(async () => {
    const fs = require('fs');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Create server instance
    app = createApp({ dbPath: testDbPath, port: 3002 });
    await app.listen();
    
    // Create socket clients
    hostSocket = io('http://localhost:3002');
    screenSocket = io('http://localhost:3002');
    playerSocket = io('http://localhost:3002');
    
    // Wait for connections
    await Promise.all([
      new Promise(resolve => hostSocket.on('connect', resolve)),
      new Promise(resolve => screenSocket.on('connect', resolve)),
      new Promise(resolve => playerSocket.on('connect', resolve))
    ]);
  });
  
  after(async () => {
    // Close sockets
    hostSocket.close();
    screenSocket.close();
    playerSocket.close();
    
    // Close server
    await app.close();
    
    // Clean up test database
    const fs = require('fs');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });
  
  it('should allow clients to join rooms', async () => {
    await new Promise((resolve) => {
      hostSocket.emit('join-room', 'host');
      hostSocket.on('room-joined', (data) => {
        assert.strictEqual(data.role, 'host');
        resolve();
      });
    });
    
    await new Promise((resolve) => {
      screenSocket.emit('join-room', 'screen');
      screenSocket.on('room-joined', (data) => {
        assert.strictEqual(data.role, 'screen');
        resolve();
      });
    });
    
    await new Promise((resolve) => {
      playerSocket.emit('join-room', 'player');
      playerSocket.on('room-joined', (data) => {
        assert.strictEqual(data.role, 'player');
        resolve();
      });
    });
  });
  
  it('should return current game state', async () => {
    await new Promise((resolve) => {
      hostSocket.emit('get-state');
      hostSocket.on('state', (data) => {
        assert.ok(data.phase);
        assert.strictEqual(data.phase, 'LOBBY');
        assert.ok(Array.isArray(data.teams));
        resolve();
      });
    });
  });
  
  it('should allow host to change phase and broadcast to all clients', async () => {
    const phaseChangePromises = [
      new Promise(resolve => screenSocket.on('phase-changed', resolve)),
      new Promise(resolve => playerSocket.on('phase-changed', resolve))
    ];
    
    hostSocket.emit('set-phase', 'TRIVIA');
    
    const results = await Promise.all(phaseChangePromises);
    results.forEach(data => {
      assert.strictEqual(data.phase, 'TRIVIA');
      assert.strictEqual(data.previousPhase, 'LOBBY');
    });
  });
  
  it('should reject invalid phase transitions', async () => {
    await new Promise((resolve) => {
      hostSocket.emit('set-phase', 'RESULTS'); // Invalid: TRIVIA -> RESULTS
      hostSocket.on('error', (data) => {
        assert.ok(data.message.includes('Invalid transition'));
        resolve();
      });
    });
  });
  
  it('should reject phase changes from non-host clients', async () => {
    await new Promise((resolve) => {
      playerSocket.emit('set-phase', 'SHOP');
      playerSocket.on('error', (data) => {
        assert.strictEqual(data.message, 'Only host can change phases.');
        resolve();
      });
    });
  });

  it('should open the shop phase and broadcast the catalog', async () => {
    const team = ensureTeam(app, 'Shop Team', 500);

    const catalogPromise = onceEvent(screenSocket, 'shop:catalog');
    const phasePromise = onceEvent(screenSocket, 'phase-changed');

    hostSocket.emit('shop:open');

    const [catalog, phaseChange] = await Promise.all([catalogPromise, phasePromise]);
    assert.strictEqual(phaseChange.phase, 'SHOP');
    assert.strictEqual(phaseChange.previousPhase, 'TRIVIA');
    assert.ok(Array.isArray(catalog.categories));
    assert.ok(catalog.categories.length > 0);
    assert.ok(Array.isArray(catalog.teams));
    assert.ok(catalog.teams.some((entry) => entry.id === team.id));
    assert.ok(Array.isArray(catalog.purchaseHistories[String(team.id)]));
  });

  it('should process affordable shop purchases and broadcast inventory updates', async () => {
    const team = ensureTeam(app, 'Shop Team', 500);
    await ensureShopPhase(app, hostSocket, screenSocket);

    const purchaseResultPromise = onceEvent(screenSocket, 'shop:purchase-result');
    const inventoryPromise = onceEvent(screenSocket, 'shop:team-inventory-updated');

    hostSocket.emit('shop:purchase', { teamId: team.id, itemKey: 'flour-basic' });

    const [purchaseResultArgs, inventoryArgs] = await Promise.all([purchaseResultPromise, inventoryPromise]);
    const [resultTeamId, result] = purchaseResultArgs;
    const [inventoryTeamId, inventory] = inventoryArgs;

    assert.strictEqual(resultTeamId, team.id);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.itemKey, 'flour-basic');
    const flourBasic = shopData.categories.flatMap((category) => category.items).find((item) => item.key === 'flour-basic');
    assert.ok(flourBasic);
    assert.strictEqual(result.newBalance, 500 - flourBasic.price);
    assert.strictEqual(result.approvedByOverride, false);
    assert.strictEqual(inventoryTeamId, team.id);
    assert.ok(inventory.some((item) => item.item_key === 'flour-basic'));
  });

  it('should warn when a team cannot afford a shop item and allow force approval', async () => {
    const team = ensureTeam(app, 'Shop Team', 100);
    await ensureShopPhase(app, hostSocket, screenSocket);

    const warningPromise = onceEvent(screenSocket, 'shop:warning');
    const pendingResultPromise = onceEvent(screenSocket, 'shop:purchase-result');

    hostSocket.emit('shop:purchase', { teamId: team.id, itemKey: 'cake-banana' });

    const [warningArgs, pendingResultArgs] = await Promise.all([warningPromise, pendingResultPromise]);
    const [warningTeamId, warningMessage] = warningArgs;
    const [pendingTeamId, pendingResult] = pendingResultArgs;

    assert.strictEqual(warningTeamId, team.id);
    assert.match(warningMessage, /override/i);
    assert.strictEqual(pendingTeamId, team.id);
    assert.strictEqual(pendingResult.success, false);
    assert.strictEqual(pendingResult.itemKey, 'cake-banana');
    assert.ok(pendingResult.purchaseId);

    const approvalResultPromise = onceEvent(screenSocket, 'shop:purchase-result');
    const inventoryPromise = onceEvent(screenSocket, 'shop:team-inventory-updated');

    hostSocket.emit('shop:force-approve', { purchaseId: pendingResult.purchaseId });

    const [approvalArgs, inventoryArgs] = await Promise.all([approvalResultPromise, inventoryPromise]);
    const [approvalTeamId, approvalResult] = approvalArgs;
    const [inventoryTeamId, inventory] = inventoryArgs;

    assert.strictEqual(approvalTeamId, team.id);
    assert.strictEqual(approvalResult.success, true);
    assert.strictEqual(approvalResult.itemKey, 'cake-banana');
    assert.strictEqual(approvalResult.approvedByOverride, true);
    assert.strictEqual(inventoryTeamId, team.id);
    assert.ok(inventory.some((item) => item.item_key === 'cake-banana'));
  });

  it('should close the shop and move to baking phase', async () => {
    await ensureShopPhase(app, hostSocket, screenSocket);
    const phasePromise = onceEvent(screenSocket, 'phase-changed');

    hostSocket.emit('shop:close');

    const phaseChange = await phasePromise;
    assert.strictEqual(phaseChange.phase, 'BAKING');
    assert.strictEqual(phaseChange.previousPhase, 'SHOP');
  });

  it('should start baking and broadcast minigame selections with chaos data', async () => {
    await ensureBakingPhase(app, hostSocket, screenSocket);

    const virtual = ensureTeam(app, 'Baking Virtual Team', 2500);
    app.db.db.prepare('UPDATE teams SET is_virtual_team = 1 WHERE id = ?').run(virtual.id);

    const startedPromise = onceEventOrTimeout(screenSocket, 'baking:started');
    const selectionsPromise = onceEventOrTimeout(playerSocket, 'baking:minigame-selections');

    hostSocket.emit('baking:start', { durationSec: 90, teamId: virtual.id });

    const [started, selections] = await Promise.all([startedPromise, selectionsPromise]);
    const selectionPhases = selections.minigames.map((entry) => entry.phase);

    assert.strictEqual(started.durationSec, 90);
    assert.ok(started.timeRemaining <= 90);
    assert.ok(started.timeRemaining >= 0);
    assert.strictEqual(selections.chaosLevel, 'medium');
    assert.strictEqual(selections.minigames.length, 6);
    assert.deepStrictEqual(selectionPhases, ['prep', 'mix', 'bake', 'cool', 'decorate', 'present']);
    selections.minigames.forEach((entry) => {
      assert.ok(entry.sceneKey);
      assert.ok(typeof entry.description === 'string');
      assert.strictEqual(typeof entry.isAbsurd, 'boolean');
    });
    assert.ok(Array.isArray(selections.chaosEvents));
  });

  it('should score judging teams and return sorted results', async () => {
    await ensureJudgingPhase(app, hostSocket, screenSocket);

    const alpha = ensureTeam(app, 'Judge Alpha', 0);
    const bravo = ensureTeam(app, 'Judge Bravo', 0);
    const virtual = ensureTeam(app, 'Judge Virtual', 0);
    app.db.db.prepare('UPDATE teams SET is_virtual_team = 1 WHERE id = ?').run(virtual.id);

    ['prep', 'mix', 'bake', 'decorate', 'present'].forEach((phase) => {
      app.db.db.prepare('INSERT INTO scores (team_id, phase, score, details) VALUES (?, ?, ?, ?)').run(virtual.id, phase, 60, null);
    });
    app.db.db.prepare('INSERT INTO purchases (team_id, item_key, category, price, approved_by_host) VALUES (?, ?, ?, ?, ?)')
      .run(virtual.id, 'cake-statue-liberty', 'cakes', 0, 1);

    await onceEventOrTimeout(hostSocket, 'judging:scores-updated', () => {
      hostSocket.emit('judging:score-team', { teamId: alpha.id, taste: 10, accuracy: 20, creativity: 30 });
    });
    await onceEventOrTimeout(hostSocket, 'judging:scores-updated', () => {
      hostSocket.emit('judging:score-team', { teamId: bravo.id, taste: 70, accuracy: 80, creativity: 90 });
    });
    await onceEventOrTimeout(hostSocket, 'judging:scores-updated', () => {
      hostSocket.emit('judging:score-team', { teamId: virtual.id, taste: 90, accuracy: 60, creativity: 30 });
    });

    const results = await onceEventOrTimeout(hostSocket, 'judging:results', () => {
      hostSocket.emit('judging:get-results');
    });

    assert.strictEqual(results[0].teamName, 'Judge Bravo');
    assert.strictEqual(results[0].scores.total, 80);
    assert.strictEqual(results[1].teamName, 'Judge Virtual');
    assert.strictEqual(results[1].scores.total, 60);
    assert.strictEqual(results[2].teamName, 'Judge Alpha');
    assert.strictEqual(results[2].scores.total, 20);
  });

  it('should generate a cake gallery for the host after baking', async () => {
    await ensureBakingPhase(app, hostSocket, screenSocket);

    const team = ensureTeam(app, 'Gallery Virtual Team', 2500);
    app.db.db.prepare('UPDATE teams SET is_virtual_team = 1 WHERE id = ?').run(team.id);
    ['prep', 'mix', 'bake', 'cool', 'decorate', 'present'].forEach((phase, index) => {
      app.db.db.prepare('INSERT INTO scores (team_id, phase, score, details) VALUES (?, ?, ?, ?)').run(team.id, phase, 70 + index, null);
    });
    app.db.db.prepare('INSERT INTO purchases (team_id, item_key, category, price, approved_by_host) VALUES (?, ?, ?, ?, ?)')
      .run(team.id, 'cake-chocolate-layer', 'cakes', 5000, 1);
    app.db.db.prepare('INSERT INTO purchases (team_id, item_key, category, price, approved_by_host) VALUES (?, ?, ?, ?, ?)')
      .run(team.id, 'flour-premium', 'ingredients', 800, 1);

    const galleryPayload = await onceEventOrTimeout(hostSocket, 'baking:cake-gallery', () => {
      hostSocket.emit('baking:generate-gallery', { teamId: team.id });
    }, 4000);

    assert.strictEqual(galleryPayload.teamId, team.id);
    assert.ok(Array.isArray(galleryPayload.imagePaths));
    assert.ok(galleryPayload.imagePaths.length > 0, 'Should return at least one generated image path');
    assert.ok(galleryPayload.scores.total > 0, 'Should include final scores');

    galleryPayload.imagePaths.forEach((imagePath) => {
      assert.match(imagePath, /^\/assets\/cake-results\/team-\d+-cake-\d+\.png$/);
      const filePath = path.join(__dirname, '..', 'public', imagePath.replace(/^\/assets\//, 'assets/'));
      assert.ok(fs.existsSync(filePath), `Generated gallery image should exist on disk: ${filePath}`);
      fs.unlinkSync(filePath);
    });
  });

  it('should broadcast cake reveal payload to screen and player clients', async () => {
    const revealPayload = {
      cakeImagePath: '/assets/cake-results/team-99-cake-0.png',
      scores: { taste: 88, accuracy: 77, creativity: 66, total: 231 },
      chaosEvents: [{ title: 'Butter spill', description: 'A slippery disaster nearly ruined the frosting.' }],
      teamId: 99
    };

    const screenRevealPromise = onceEventOrTimeout(screenSocket, 'results:cake-reveal', null, 1500);
    const playerRevealPromise = onceEventOrTimeout(playerSocket, 'results:cake-reveal', () => {
      hostSocket.emit('results:cake-reveal', revealPayload);
    }, 1500);

    const [screenReveal, playerReveal] = await Promise.all([screenRevealPromise, playerRevealPromise]);

    assert.deepStrictEqual(screenReveal, revealPayload);
    assert.deepStrictEqual(playerReveal, revealPayload);
  });

  it('should reveal judging results to all clients', async () => {
    await ensureJudgingPhase(app, hostSocket, screenSocket);

    const screenRevealPromise = onceEventOrTimeout(screenSocket, 'results:reveal', null, 1500);
    const playerRevealPromise = onceEventOrTimeout(playerSocket, 'results:reveal', null, 1500);
    const screenPhasePromise = onceEventOrTimeout(screenSocket, 'phase-changed', () => {
      hostSocket.emit('results:reveal');
    }, 1500);

    const [screenResults, playerResults, phaseChange] = await Promise.all([
      screenRevealPromise,
      playerRevealPromise,
      screenPhasePromise
    ]);

    assert.ok(Array.isArray(screenResults));
    assert.ok(Array.isArray(playerResults));
    assert.strictEqual(phaseChange.phase, 'RESULTS');
    assert.strictEqual(screenResults[0].teamName, 'Judge Bravo');
    assert.strictEqual(playerResults[0].teamName, 'Judge Bravo');
  });
});
