const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../server/index.js');
const io = require('socket.io-client');

describe('Server Integration', () => {
  let app, hostSocket, screenSocket, playerSocket;
  const testDbPath = './data/test-game.db';
  
  before(async () => {
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
});
