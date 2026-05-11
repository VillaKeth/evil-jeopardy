const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
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
});
