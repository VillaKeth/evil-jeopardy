const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const {
  createGameState, addPlayer, removePlayer, reconnectPlayer,
  setPlayerLatency, setPlayerAfk, startGame, getStandings,
  selectMainQuestion, startNestedQuestion, recordNestedPlacement,
  endNestedGame, recordBuzzResult, nextAnswer, endAnswerPhase,
  startFinalJeopardy, submitWager, submitAnswer, scoreFinalJeopardy,
  updateScore, getCurrentAnswerer, getClientState
} = require('./gameState');
const {
  PING_COUNT, calculateAvgLatency,
  createCalibrationSession, recordPingSent, recordPong
} = require('./latency');
const {
  createBuzzQueue, open: openQueue, lock: lockQueue,
  recordBuzz, getBuzzWinner: getWinner, getBuzzOrder, reset: resetQueue
} = require('./buzzQueue');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Game state
let gameState = createGameState();
let buzzQueue = createBuzzQueue();
const calibrationSessions = new Map(); // socketId -> session
const disconnectedPlayers = new Map(); // name -> { oldSocketId, disconnectTime }

app.use(express.static(path.join(__dirname, '..', 'public')));

// Helper: broadcast player list to all clients
function broadcastPlayerList() {
  const players = Object.entries(gameState.players).map(([id, p]) => ({
    id,
    name: p.name,
    score: p.score,
    connected: p.connected,
  }));
  io.emit('player-list', players);
}

// Helper: broadcast game state to all clients
function broadcastGameState() {
  // Send sanitized state to each player
  Object.keys(gameState.players).forEach(socketId => {
    const sock = io.sockets.sockets.get(socketId);
    if (sock) {
      sock.emit('game-state', getClientState(gameState, socketId));
    }
  });
  // Send full state to non-player sockets (host dashboard)
  io.sockets.sockets.forEach((sock, socketId) => {
    if (!gameState.players[socketId]) {
      sock.emit('game-state', gameState);
    }
  });
}

// Helper: run latency calibration for a socket
function runCalibration(socket) {
  const session = createCalibrationSession();
  calibrationSessions.set(socket.id, session);
  recordPingSent(session);
  socket.emit('calibration-ping', { index: session.pingsSent });
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send current state to newly connected client
  const players = Object.entries(gameState.players).map(([id, p]) => ({
    id, name: p.name, score: p.score, connected: p.connected,
  }));
  socket.emit('player-list', players);
  if (gameState.phase !== 'LOBBY') {
    socket.emit('game-state', getClientState(gameState, socket.id));
  }

  // --- LOBBY EVENTS ---

  socket.on('join', ({ name }) => {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      socket.emit('join-error', { message: 'Please enter a valid name' });
      return;
    }

    const trimmedName = name.trim().substring(0, 20);

    // Check for reconnection
    const disconnected = disconnectedPlayers.get(trimmedName.toLowerCase());
    if (disconnected && gameState.phase !== 'LOBBY') {
      gameState = reconnectPlayer(gameState, disconnected.oldSocketId, socket.id);
      disconnectedPlayers.delete(trimmedName.toLowerCase());
      socket.emit('joined', { name: trimmedName, reconnected: true });
      broadcastPlayerList();
      broadcastGameState();
      console.log(`${trimmedName} reconnected (${socket.id})`);
      runCalibration(socket);
      return;
    }

    // Check for duplicate names
    const existingNames = Object.values(gameState.players).map(p => p.name.toLowerCase());
    if (existingNames.includes(trimmedName.toLowerCase())) {
      socket.emit('join-error', { message: 'That name is already taken' });
      return;
    }

    try {
      gameState = addPlayer(gameState, socket.id, trimmedName);
      socket.emit('joined', { name: trimmedName });
      broadcastPlayerList();
      console.log(`${trimmedName} joined (${socket.id})`);

      // Start latency calibration
      runCalibration(socket);
    } catch (err) {
      socket.emit('join-error', { message: err.message });
    }
  });

  // --- CALIBRATION ---

  socket.on('calibration-pong', (data) => {
    const session = calibrationSessions.get(socket.id);
    if (!session) return;

    const done = recordPong(session);
    if (done) {
      const avgLatency = calculateAvgLatency(session.samples);
      gameState = setPlayerLatency(gameState, socket.id, avgLatency);
      calibrationSessions.delete(socket.id);
      console.log(`Calibration complete for ${socket.id}: ${avgLatency}ms avg latency`);
    } else {
      recordPingSent(session);
      socket.emit('calibration-ping', { index: session.pingsSent });
    }
  });

  // --- HOST EVENTS ---

  socket.on('host-start-game', () => {
    try {
      gameState = startGame(gameState);
      io.emit('game-started', {});
      broadcastGameState();
      console.log('Game started!');
    } catch (err) {
      socket.emit('host-error', { message: err.message });
    }
  });

  socket.on('host-select-question', ({ category, value }) => {
    try {
      gameState = selectMainQuestion(gameState, category, value);
      broadcastGameState();
    } catch (err) {
      socket.emit('host-error', { message: err.message });
    }
  });

  socket.on('host-start-nested-question', ({ category, value }) => {
    try {
      gameState = startNestedQuestion(gameState, category, value);
      resetQueue(buzzQueue);
      openQueue(buzzQueue, value);
      broadcastGameState();
      io.emit('buzz-open', { category, value });
    } catch (err) {
      socket.emit('host-error', { message: err.message });
    }
  });

  socket.on('host-end-nested', () => {
    try {
      gameState = endNestedGame(gameState);
      broadcastGameState();
      io.emit('answer-phase', {
        order: gameState.answerPhase.order.map(id => ({
          id,
          name: gameState.players[id]?.name
        })),
        currentIndex: 0
      });
    } catch (err) {
      socket.emit('host-error', { message: err.message });
    }
  });

  socket.on('host-mark-correct', ({ socketId }) => {
    const question = gameState.mainBoard.currentQuestion || gameState.nestedGame.currentQuestion;
    const value = question?.value || 0;
    gameState = updateScore(gameState, socketId, value);
    gameState = recordNestedPlacement(gameState, socketId);
    broadcastGameState();
  });

  socket.on('host-mark-wrong', ({ socketId }) => {
    const question = gameState.mainBoard.currentQuestion || gameState.nestedGame.currentQuestion;
    const value = question?.value || 0;
    gameState = updateScore(gameState, socketId, -value);
    broadcastGameState();
  });

  socket.on('host-next-answer', () => {
    gameState = nextAnswer(gameState);
    broadcastGameState();
  });

  socket.on('host-end-answer-phase', () => {
    gameState = endAnswerPhase(gameState);
    broadcastGameState();
  });

  socket.on('host-start-final', () => {
    try {
      gameState = startFinalJeopardy(gameState);
      broadcastGameState();
      // Notify players to submit wagers
      io.emit('fj-phase', { step: 'wager' });
    } catch (err) {
      socket.emit('host-error', { message: err.message });
    }
  });

  socket.on('host-fj-advance', ({ step }) => {
    if (step === 'answer') {
      io.emit('fj-phase', { step: 'answer' });
    } else if (step === 'reveal') {
      io.emit('fj-phase', { step: 'reveal' });
    }
  });

  socket.on('host-score-final', ({ results }) => {
    try {
      gameState = scoreFinalJeopardy(gameState, results);
      broadcastGameState();
      io.emit('game-over', { standings: getStandings(gameState) });
    } catch (err) {
      socket.emit('host-error', { message: err.message });
    }
  });

  socket.on('host-reset', () => {
    gameState = createGameState();
    buzzQueue = createBuzzQueue();
    calibrationSessions.clear();
    io.emit('game-reset', {});
    console.log('Game reset');
  });

  // --- PLAYER EVENTS ---

  socket.on('buzz', () => {
    const player = gameState.players[socket.id];
    if (!player) return;

    const recorded = recordBuzz(buzzQueue, socket.id, Date.now(), player.latency);
    if (recorded) {
      const winner = getWinner(buzzQueue);
      io.emit('buzz-update', {
        buzzes: buzzQueue.buzzes.map(b => ({
          playerId: b.socketId,
          name: gameState.players[b.socketId]?.name,
          adjustedTime: Math.round(b.adjustedTime - buzzQueue.openedAt)
        })),
        winner: winner ? { id: winner.socketId, name: gameState.players[winner.socketId]?.name } : null
      });
    }
  });

  socket.on('submit-wager', ({ amount }) => {
    try {
      gameState = submitWager(gameState, socket.id, amount);
      socket.emit('wager-accepted', { amount });
      // Notify host
      io.emit('wager-submitted', { playerId: socket.id, name: gameState.players[socket.id]?.name });
      broadcastGameState();
      
      // Check if all players have wagered
      const allWagered = Object.keys(gameState.players)
        .filter(id => gameState.players[id].connected)
        .every(id => gameState.finalJeopardy.wagers[id] !== undefined);
      if (allWagered) {
        io.emit('all-wagers-in', {});
      }
    } catch (err) {
      socket.emit('wager-error', { message: err.message });
    }
  });

  socket.on('submit-answer', ({ answer }) => {
    try {
      gameState = submitAnswer(gameState, socket.id, answer);
      socket.emit('answer-accepted', {});
      // Notify host
      io.emit('answer-submitted', { playerId: socket.id, name: gameState.players[socket.id]?.name });
      broadcastGameState();
      
      // Check if all players have answered
      const allAnswered = Object.keys(gameState.players)
        .filter(id => gameState.players[id].connected)
        .every(id => gameState.finalJeopardy.answers[id] !== undefined);
      if (allAnswered) {
        io.emit('all-answers-in', {});
      }
    } catch (err) {
      socket.emit('answer-error', { message: err.message });
    }
  });

  // --- DISCONNECT ---

  socket.on('disconnect', () => {
    const player = gameState.players[socket.id];
    if (player) {
      if (gameState.phase === 'LOBBY') {
        gameState = removePlayer(gameState, socket.id);
      } else {
        // Mark as disconnected but keep in game
        gameState = {
          ...gameState,
          players: {
            ...gameState.players,
            [socket.id]: { ...player, connected: false }
          }
        };
        // Store disconnection info for potential reconnection
        disconnectedPlayers.set(player.name.toLowerCase(), {
          oldSocketId: socket.id,
          disconnectTime: Date.now()
        });
      }
      broadcastPlayerList();
      console.log(`${player.name} disconnected`);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Evil Jeopardy² server running on http://localhost:${PORT}`);
  console.log(`Local network: http://${getLocalIP()}:${PORT}`);
});

function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}
