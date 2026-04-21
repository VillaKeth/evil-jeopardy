function createGameState() {
  return {
    phase: 'LOBBY',        // LOBBY | MAIN_BOARD | NESTED_GAME | ANSWER_PHASE | FINAL_JEOPARDY | GAME_OVER
    players: {},            // { socketId: { name, score, connected, latency, afk } }
    mainBoard: {
      currentQuestion: null,  // { category, value }
      usedQuestions: [],      // [{ category, value }]
    },
    nestedGame: {
      active: false,
      parentQuestion: null,   // { category, value } from main board
      placements: [],         // [socketId] in order of correct nested answers
      currentQuestion: null,
      usedQuestions: [],
    },
    answerPhase: {
      order: [],              // [socketId] — who answers in what order
      currentIndex: 0,        // index into order array
      buzzResults: [],        // [{ playerId, adjustedTime }] for buzz queue
    },
    finalJeopardy: {
      wagers: {},             // { socketId: amount }
      answers: {},            // { socketId: string }
      results: {},            // { socketId: { correct: bool } }
    },
    settings: {
      minPlayers: 2,
      maxPlayers: 10,
      valueScale: [100, 200, 300, 400, 500],
    },
  };
}

function addPlayer(state, socketId, name) {
  if (state.phase !== 'LOBBY') {
    throw new Error('Players can only be added in LOBBY phase');
  }
  
  return {
    ...state,
    players: {
      ...state.players,
      [socketId]: {
        name,
        score: 0,
        connected: true,
        latency: 0,
        afk: false
      }
    }
  };
}

function removePlayer(state, socketId) {
  const { [socketId]: removed, ...remainingPlayers } = state.players;
  
  return {
    ...state,
    players: remainingPlayers
  };
}

function reconnectPlayer(state, socketId, newSocketId) {
  if (!state.players[socketId]) {
    return state;
  }
  
  const player = { ...state.players[socketId], connected: true };
  const { [socketId]: removed, ...otherPlayers } = state.players;
  
  return {
    ...state,
    players: {
      ...otherPlayers,
      [newSocketId]: player
    }
  };
}

function setPlayerLatency(state, socketId, latency) {
  if (!state.players[socketId]) {
    return state;
  }
  
  return {
    ...state,
    players: {
      ...state.players,
      [socketId]: {
        ...state.players[socketId],
        latency
      }
    }
  };
}

function setPlayerAfk(state, socketId, afk) {
  if (!state.players[socketId]) {
    return state;
  }
  
  return {
    ...state,
    players: {
      ...state.players,
      [socketId]: {
        ...state.players[socketId],
        afk
      }
    }
  };
}

function startGame(state) {
  const playerCount = Object.keys(state.players).length;
  if (playerCount < state.settings.minPlayers) {
    throw new Error(`Cannot start game with ${playerCount} players. minPlayers requirement is ${state.settings.minPlayers}`);
  }
  
  return {
    ...state,
    phase: 'MAIN_BOARD'
  };
}

function selectMainQuestion(state, category, value) {
  const question = { category, value };
  
  return {
    ...state,
    phase: 'NESTED_GAME',
    mainBoard: {
      ...state.mainBoard,
      currentQuestion: question,
      usedQuestions: [...state.mainBoard.usedQuestions, question]
    },
    nestedGame: {
      ...state.nestedGame,
      active: true,
      parentQuestion: question
    }
  };
}

function startNestedQuestion(state, category, value) {
  const question = { category, value };
  
  return {
    ...state,
    nestedGame: {
      ...state.nestedGame,
      currentQuestion: question,
      usedQuestions: [...state.nestedGame.usedQuestions, question]
    }
  };
}

function recordNestedPlacement(state, socketId) {
  if (state.nestedGame.placements.includes(socketId)) {
    return state; // Skip duplicates
  }
  
  return {
    ...state,
    nestedGame: {
      ...state.nestedGame,
      placements: [...state.nestedGame.placements, socketId]
    }
  };
}

function endNestedGame(state) {
  // Build answer order: placements first, then remaining players in connection order, AFK players last
  const playerIds = Object.keys(state.players);
  const placedPlayers = state.nestedGame.placements;
  const connectedPlayers = playerIds.filter(id => !placedPlayers.includes(id) && !state.players[id].afk);
  const afkPlayers = playerIds.filter(id => !placedPlayers.includes(id) && state.players[id].afk);
  
  const order = [...placedPlayers, ...connectedPlayers, ...afkPlayers];
  
  return {
    ...state,
    phase: 'ANSWER_PHASE',
    nestedGame: {
      ...state.nestedGame,
      active: false
    },
    answerPhase: {
      ...state.answerPhase,
      order,
      currentIndex: 0
    }
  };
}

function recordBuzzResult(state, playerId, adjustedTime) {
  return {
    ...state,
    answerPhase: {
      ...state.answerPhase,
      buzzResults: [...state.answerPhase.buzzResults, { playerId, adjustedTime }]
    }
  };
}

function nextAnswer(state) {
  return {
    ...state,
    answerPhase: {
      ...state.answerPhase,
      currentIndex: state.answerPhase.currentIndex + 1
    }
  };
}

function endAnswerPhase(state) {
  return {
    ...state,
    phase: 'MAIN_BOARD',
    answerPhase: {
      order: [],
      currentIndex: 0,
      buzzResults: []
    }
  };
}

function startFinalJeopardy(state) {
  return {
    ...state,
    phase: 'FINAL_JEOPARDY'
  };
}

function submitWager(state, socketId, amount) {
  const player = state.players[socketId];
  if (!player) {
    throw new Error('Player not found');
  }
  
  if (player.score > 0 && (amount < 0 || amount > player.score)) {
    throw new Error(`Invalid wager: ${amount}. Must be between 0 and ${player.score}`);
  }
  
  if (player.score <= 0 && amount > 0) {
    throw new Error(`Invalid wager: ${amount}. Players with non-positive scores can only wager 0`);
  }
  
  return {
    ...state,
    finalJeopardy: {
      ...state.finalJeopardy,
      wagers: {
        ...state.finalJeopardy.wagers,
        [socketId]: amount
      }
    }
  };
}

function submitAnswer(state, socketId, answer) {
  return {
    ...state,
    finalJeopardy: {
      ...state.finalJeopardy,
      answers: {
        ...state.finalJeopardy.answers,
        [socketId]: answer
      }
    }
  };
}

function scoreFinalJeopardy(state, results) {
  const updatedPlayers = { ...state.players };
  
  for (const [socketId, correct] of Object.entries(results)) {
    const player = updatedPlayers[socketId];
    const wager = state.finalJeopardy.wagers[socketId] || 0;
    
    if (player) {
      updatedPlayers[socketId] = {
        ...player,
        score: correct ? player.score + wager : player.score - wager
      };
    }
  }
  
  return {
    ...state,
    phase: 'GAME_OVER',
    players: updatedPlayers,
    finalJeopardy: {
      ...state.finalJeopardy,
      results
    }
  };
}

function updateScore(state, socketId, delta) {
  const player = state.players[socketId];
  if (!player) {
    return state;
  }
  
  return {
    ...state,
    players: {
      ...state.players,
      [socketId]: {
        ...player,
        score: player.score + delta
      }
    }
  };
}

function getStandings(state) {
  return Object.entries(state.players)
    .map(([socketId, player]) => ({
      socketId,
      name: player.name,
      score: player.score
    }))
    .sort((a, b) => b.score - a.score);
}

function getCurrentAnswerer(state) {
  const { order, currentIndex } = state.answerPhase;
  if (currentIndex >= order.length) {
    return null;
  }
  return order[currentIndex];
}

function getClientState(state, socketId) {
  // Sanitize Final Jeopardy data - only show current player's wagers/answers
  const sanitizedFinalJeopardy = {
    ...state.finalJeopardy,
    wagers: state.finalJeopardy.wagers[socketId] ? { [socketId]: state.finalJeopardy.wagers[socketId] } : {},
    answers: state.finalJeopardy.answers[socketId] ? { [socketId]: state.finalJeopardy.answers[socketId] } : {}
  };
  
  return {
    ...state,
    finalJeopardy: sanitizedFinalJeopardy
  };
}

module.exports = {
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
};