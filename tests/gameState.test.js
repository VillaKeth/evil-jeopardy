const { test } = require('node:test');
const assert = require('node:assert');
const {
  createGameState,
  addPlayer,
  removePlayer,
  reconnectPlayer,
  setPlayerLatency,
  setPlayerAfk,
  startGame,
  selectMainQuestion,
  startNestedQuestion,
  recordNestedPlacement,
  endNestedGame,
  recordBuzzResult,
  nextAnswer,
  endAnswerPhase,
  startFinalJeopardy,
  submitWager,
  submitAnswer,
  scoreFinalJeopardy,
  updateScore,
  getStandings,
  getCurrentAnswerer,
  getClientState
} = require('../server/gameState.js');

test('createGameState returns correct default structure', () => {
  const state = createGameState();
  
  assert.strictEqual(state.phase, 'LOBBY');
  assert.deepStrictEqual(state.players, {});
  assert.deepStrictEqual(state.mainBoard, {
    currentQuestion: null,
    usedQuestions: []
  });
  assert.deepStrictEqual(state.nestedGame, {
    active: false,
    parentQuestion: null,
    placements: [],
    currentQuestion: null,
    usedQuestions: []
  });
  assert.deepStrictEqual(state.answerPhase, {
    order: [],
    currentIndex: 0,
    buzzResults: []
  });
  assert.deepStrictEqual(state.finalJeopardy, {
    wagers: {},
    answers: {},
    results: {}
  });
  assert.deepStrictEqual(state.settings, {
    minPlayers: 2,
    maxPlayers: 10,
    valueScale: [100, 200, 300, 400, 500]
  });
});

test('addPlayer adds player in LOBBY', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  
  assert.deepStrictEqual(state.players.socket1, {
    name: 'Player1',
    score: 0,
    connected: true,
    latency: 0,
    afk: false
  });
});

test('addPlayer throws in non-LOBBY phases', () => {
  let state = createGameState();
  state = { ...state, phase: 'MAIN_BOARD' };
  
  assert.throws(() => {
    addPlayer(state, 'socket1', 'Player1');
  }, /LOBBY/);
});

test('removePlayer removes correctly', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = addPlayer(state, 'socket2', 'Player2');
  
  state = removePlayer(state, 'socket1');
  
  assert.strictEqual(state.players.socket1, undefined);
  assert.strictEqual(state.players.socket2.name, 'Player2');
});

test('reconnectPlayer updates socket ID and connected status', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = { ...state, players: { ...state.players, socket1: { ...state.players.socket1, connected: false } } };
  
  state = reconnectPlayer(state, 'socket1', 'socket1-new');
  
  assert.strictEqual(state.players.socket1, undefined);
  assert.deepStrictEqual(state.players['socket1-new'], {
    name: 'Player1',
    score: 0,
    connected: true,
    latency: 0,
    afk: false
  });
});

test('startGame transitions to MAIN_BOARD', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = addPlayer(state, 'socket2', 'Player2');
  
  state = startGame(state);
  
  assert.strictEqual(state.phase, 'MAIN_BOARD');
});

test('startGame throws if < minPlayers', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  
  assert.throws(() => {
    startGame(state);
  }, /minPlayers/);
});

test('selectMainQuestion sets up nested game correctly', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = addPlayer(state, 'socket2', 'Player2');
  state = startGame(state);
  
  state = selectMainQuestion(state, 'CATEGORY1', 200);
  
  assert.strictEqual(state.phase, 'NESTED_GAME');
  assert.deepStrictEqual(state.mainBoard.currentQuestion, { category: 'CATEGORY1', value: 200 });
  assert.deepStrictEqual(state.mainBoard.usedQuestions, [{ category: 'CATEGORY1', value: 200 }]);
  assert.strictEqual(state.nestedGame.active, true);
  assert.deepStrictEqual(state.nestedGame.parentQuestion, { category: 'CATEGORY1', value: 200 });
});

test('recordNestedPlacement adds to placements, skips duplicates', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = addPlayer(state, 'socket2', 'Player2');
  state = startGame(state);
  state = selectMainQuestion(state, 'CATEGORY1', 200);
  
  state = recordNestedPlacement(state, 'socket1');
  state = recordNestedPlacement(state, 'socket2');
  state = recordNestedPlacement(state, 'socket1'); // duplicate
  
  assert.deepStrictEqual(state.nestedGame.placements, ['socket1', 'socket2']);
});

test('endNestedGame builds correct answer order', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = addPlayer(state, 'socket2', 'Player2');
  state = addPlayer(state, 'socket3', 'Player3');
  state = { ...state, players: { ...state.players, socket3: { ...state.players.socket3, afk: true } } };
  state = startGame(state);
  state = selectMainQuestion(state, 'CATEGORY1', 200);
  state = recordNestedPlacement(state, 'socket2');
  
  state = endNestedGame(state);
  
  assert.strictEqual(state.phase, 'ANSWER_PHASE');
  assert.strictEqual(state.nestedGame.active, false);
  // Order: placements first (socket2), then remaining connected players (socket1), then AFK (socket3)
  assert.deepStrictEqual(state.answerPhase.order, ['socket2', 'socket1', 'socket3']);
  assert.strictEqual(state.answerPhase.currentIndex, 0);
});

test('updateScore adds delta positive and negative', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  
  state = updateScore(state, 'socket1', 500);
  assert.strictEqual(state.players.socket1.score, 500);
  
  state = updateScore(state, 'socket1', -200);
  assert.strictEqual(state.players.socket1.score, 300);
  
  state = updateScore(state, 'socket1', -500);
  assert.strictEqual(state.players.socket1.score, -200);
});

test('startFinalJeopardy transitions phase', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = addPlayer(state, 'socket2', 'Player2');
  state = startGame(state);
  
  state = startFinalJeopardy(state);
  
  assert.strictEqual(state.phase, 'FINAL_JEOPARDY');
});

test('submitWager validates correctly', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = updateScore(state, 'socket1', 1000);
  state = startFinalJeopardy(state);
  
  // Valid wager within score
  state = submitWager(state, 'socket1', 500);
  assert.strictEqual(state.finalJeopardy.wagers.socket1, 500);
  
  // Valid wager equal to score
  state = submitWager(state, 'socket1', 1000);
  assert.strictEqual(state.finalJeopardy.wagers.socket1, 1000);
  
  // Invalid wager above score
  assert.throws(() => {
    submitWager(state, 'socket1', 1500);
  }, /wager/);
  
  // Valid wager of 0
  state = submitWager(state, 'socket1', 0);
  assert.strictEqual(state.finalJeopardy.wagers.socket1, 0);
});

test('submitWager allows negative score players to wager up to 0', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = updateScore(state, 'socket1', -500);
  state = startFinalJeopardy(state);
  
  // Can wager 0 when score is negative
  state = submitWager(state, 'socket1', 0);
  assert.strictEqual(state.finalJeopardy.wagers.socket1, 0);
  
  // Cannot wager positive when score is negative
  assert.throws(() => {
    submitWager(state, 'socket1', 100);
  }, /wager/);
});

test('scoreFinalJeopardy applies wagers correctly and transitions to GAME_OVER', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = addPlayer(state, 'socket2', 'Player2');
  state = updateScore(state, 'socket1', 1000);
  state = updateScore(state, 'socket2', 800);
  state = startFinalJeopardy(state);
  state = submitWager(state, 'socket1', 500);
  state = submitWager(state, 'socket2', 300);
  
  const results = {
    socket1: true,  // correct
    socket2: false  // incorrect
  };
  
  state = scoreFinalJeopardy(state, results);
  
  assert.strictEqual(state.phase, 'GAME_OVER');
  assert.strictEqual(state.players.socket1.score, 1500); // 1000 + 500
  assert.strictEqual(state.players.socket2.score, 500);  // 800 - 300
  assert.deepStrictEqual(state.finalJeopardy.results, results);
});

test('getStandings returns sorted array', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = addPlayer(state, 'socket2', 'Player2');
  state = addPlayer(state, 'socket3', 'Player3');
  state = updateScore(state, 'socket1', 300);
  state = updateScore(state, 'socket2', 100);
  state = updateScore(state, 'socket3', 500);
  
  const standings = getStandings(state);
  
  assert.deepStrictEqual(standings, [
    { socketId: 'socket3', name: 'Player3', score: 500 },
    { socketId: 'socket1', name: 'Player1', score: 300 },
    { socketId: 'socket2', name: 'Player2', score: 100 }
  ]);
});

test('getCurrentAnswerer returns correct player', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = addPlayer(state, 'socket2', 'Player2');
  state = startGame(state);
  state = selectMainQuestion(state, 'CATEGORY1', 200);
  state = recordNestedPlacement(state, 'socket2');
  state = endNestedGame(state);
  
  assert.strictEqual(getCurrentAnswerer(state), 'socket2');
  
  state = nextAnswer(state);
  assert.strictEqual(getCurrentAnswerer(state), 'socket1');
});

test('getCurrentAnswerer returns null when no more answerers', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = addPlayer(state, 'socket2', 'Player2');
  state = startGame(state);
  state = selectMainQuestion(state, 'CATEGORY1', 200);
  state = endNestedGame(state);
  state = nextAnswer(state); // to socket2
  state = nextAnswer(state); // past the end
  
  assert.strictEqual(getCurrentAnswerer(state), null);
});

test('setPlayerLatency sets latency value', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  
  state = setPlayerLatency(state, 'socket1', 50);
  
  assert.strictEqual(state.players.socket1.latency, 50);
});

test('setPlayerAfk sets AFK status', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  
  state = setPlayerAfk(state, 'socket1', true);
  
  assert.strictEqual(state.players.socket1.afk, true);
});

test('startNestedQuestion sets nested question', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = addPlayer(state, 'socket2', 'Player2');
  state = startGame(state);
  state = selectMainQuestion(state, 'CATEGORY1', 200);
  
  state = startNestedQuestion(state, 'NESTED_CAT', 100);
  
  assert.deepStrictEqual(state.nestedGame.currentQuestion, { category: 'NESTED_CAT', value: 100 });
  assert.deepStrictEqual(state.nestedGame.usedQuestions, [{ category: 'NESTED_CAT', value: 100 }]);
});

test('recordBuzzResult adds to buzz results', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = addPlayer(state, 'socket2', 'Player2');
  state = startGame(state);
  state = selectMainQuestion(state, 'CATEGORY1', 200);
  state = endNestedGame(state);
  
  state = recordBuzzResult(state, 'socket1', 1234);
  state = recordBuzzResult(state, 'socket2', 1240);
  
  assert.deepStrictEqual(state.answerPhase.buzzResults, [
    { playerId: 'socket1', adjustedTime: 1234 },
    { playerId: 'socket2', adjustedTime: 1240 }
  ]);
});

test('nextAnswer increments current index', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = addPlayer(state, 'socket2', 'Player2');
  state = startGame(state);
  state = selectMainQuestion(state, 'CATEGORY1', 200);
  state = endNestedGame(state);
  
  assert.strictEqual(state.answerPhase.currentIndex, 0);
  
  state = nextAnswer(state);
  assert.strictEqual(state.answerPhase.currentIndex, 1);
});

test('endAnswerPhase transitions to MAIN_BOARD and resets', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = addPlayer(state, 'socket2', 'Player2');
  state = startGame(state);
  state = selectMainQuestion(state, 'CATEGORY1', 200);
  state = endNestedGame(state);
  state = nextAnswer(state);
  state = recordBuzzResult(state, 'socket1', 1234);
  
  state = endAnswerPhase(state);
  
  assert.strictEqual(state.phase, 'MAIN_BOARD');
  assert.deepStrictEqual(state.answerPhase, {
    order: [],
    currentIndex: 0,
    buzzResults: []
  });
});

test('submitAnswer stores answer', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = startFinalJeopardy(state);
  
  state = submitAnswer(state, 'socket1', 'What is the answer?');
  
  assert.strictEqual(state.finalJeopardy.answers.socket1, 'What is the answer?');
});

test('getClientState sanitizes other players FJ data', () => {
  let state = createGameState();
  state = addPlayer(state, 'socket1', 'Player1');
  state = addPlayer(state, 'socket2', 'Player2');
  state = updateScore(state, 'socket1', 1000);
  state = updateScore(state, 'socket2', 800);
  state = startFinalJeopardy(state);
  state = submitWager(state, 'socket1', 500);
  state = submitWager(state, 'socket2', 300);
  state = submitAnswer(state, 'socket1', 'Answer1');
  state = submitAnswer(state, 'socket2', 'Answer2');
  
  const clientState = getClientState(state, 'socket1');
  
  // Should see own wager/answer but not others
  assert.strictEqual(clientState.finalJeopardy.wagers.socket1, 500);
  assert.strictEqual(clientState.finalJeopardy.wagers.socket2, undefined);
  assert.strictEqual(clientState.finalJeopardy.answers.socket1, 'Answer1');
  assert.strictEqual(clientState.finalJeopardy.answers.socket2, undefined);
});