const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../server/index.js');
const { calculateFinalScores } = require('../server/baking');
const { io: Client } = require('socket.io-client');

function onceEvent(socket, eventName, emitAction, timeoutMs = 1500) {
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

async function connectClient(port, role, timeoutMs = 3000) {
  const socket = Client(`http://localhost:${port}`);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out connecting ${role} client on port ${port}`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleError);
    }

    function handleConnect() {
      cleanup();
      resolve();
    }

    function handleError(error) {
      cleanup();
      reject(error);
    }

    socket.once('connect', handleConnect);
    socket.once('connect_error', handleError);
  });

  const joined = await onceEvent(socket, 'room-joined', () => {
    socket.emit('join-room', role);
  });
  assert.strictEqual(joined.role, role);
  return socket;
}

async function emitToAllAndCollect(sockets, eventName, emitAction, timeoutMs = 1500) {
  const listeners = sockets.map((socket) => onceEvent(socket, eventName, null, timeoutMs));
  emitAction();
  return Promise.all(listeners);
}

function resolveAssetPath(relativeAssetPath) {
  return path.join(__dirname, '..', 'public', relativeAssetPath.replace(/^\/assets\//, 'assets/'));
}

describe('End-to-End Show Flow', () => {
  const testDbPath = path.join(__dirname, '../data/test-e2e.db');
  const port = 3012;
  const generatedFiles = new Set();
  const phaseTransitions = [];
  let app;
  let hostSocket;
  let screenSocket;
  let playerOneSocket;
  let playerTwoSocket;

  before(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    app = createApp({ dbPath: testDbPath, port });
    await app.listen();

    hostSocket = await connectClient(port, 'host');
    screenSocket = await connectClient(port, 'screen');
    playerOneSocket = await connectClient(port, 'player');
    playerTwoSocket = await connectClient(port, 'player');

    screenSocket.on('phase-changed', (payload) => {
      phaseTransitions.push(payload);
    });
  });

  after(async () => {
    [hostSocket, screenSocket, playerOneSocket, playerTwoSocket].forEach((socket) => {
      socket?.close();
    });

    await app.close();

    generatedFiles.forEach((filePath) => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('walks through the full show from lobby to results', async () => {
    const alpha = await onceEvent(hostSocket, 'team-joined', () => {
      playerOneSocket.emit('join-team', { name: 'Alpha Bakers', isVirtual: false });
    });
    const beta = await onceEvent(hostSocket, 'team-joined', () => {
      playerTwoSocket.emit('join-team', { name: 'Beta Bakers', isVirtual: false });
    });
    const virtual = await onceEvent(hostSocket, 'team-joined', () => {
      hostSocket.emit('join-team', { name: 'Virtual Villains', isVirtual: true });
    });

    assert.deepStrictEqual(
      app.db.getTeams().map((team) => ({ name: team.name, isVirtual: team.is_virtual_team === 1 })),
      [
        { name: 'Alpha Bakers', isVirtual: false },
        { name: 'Beta Bakers', isVirtual: false },
        { name: 'Virtual Villains', isVirtual: true }
      ]
    );

    const triviaPhasePayloads = await emitToAllAndCollect(
      [hostSocket, screenSocket, playerOneSocket, playerTwoSocket],
      'phase-changed',
      () => {
        hostSocket.emit('start-game');
      }
    );

    triviaPhasePayloads.forEach((payload) => {
      assert.deepStrictEqual(payload, { phase: 'TRIVIA', previousPhase: 'LOBBY' });
    });
    assert.strictEqual(app.db.getState('phase'), 'TRIVIA');

    const slideQuestionPayloads = await emitToAllAndCollect(
      [hostSocket, screenSocket, playerOneSocket, playerTwoSocket],
      'trivia:question-shown',
      () => {
        hostSocket.emit('trivia:next-slide');
      }
    );

    slideQuestionPayloads.forEach((payload) => {
      assert.strictEqual(payload.mode, 'SLIDE');
      assert.strictEqual(payload.question.id, 's1');
      assert.strictEqual(payload.question.value, 500);
    });

    const buzzPayloads = await emitToAllAndCollect(
      [hostSocket, screenSocket, playerOneSocket, playerTwoSocket],
      'trivia:buzz-received',
      () => {
        playerOneSocket.emit('trivia:buzz', { teamId: alpha.id });
      }
    );

    buzzPayloads.forEach((payload) => {
      assert.deepStrictEqual(payload, { teamId: alpha.id, teamName: 'Alpha Bakers' });
    });

    const [slideAnswerResult, slideScoreboard] = await Promise.all([
      onceEvent(screenSocket, 'trivia:answer-result', () => {
        hostSocket.emit('trivia:score-answer', {
          teamId: alpha.id,
          questionId: 's1',
          correct: true
        });
      }),
      onceEvent(screenSocket, 'trivia:scores-updated')
    ]);

    assert.deepStrictEqual(slideAnswerResult, {
      teamId: alpha.id,
      correct: true,
      newBalance: 500
    });
    assert.strictEqual(slideScoreboard[0].id, alpha.id);
    assert.strictEqual(slideScoreboard[0].money, 500);

    const forceAnswerPayloads = await emitToAllAndCollect(
      [hostSocket, screenSocket, playerOneSocket, playerTwoSocket],
      'trivia:force-answer-required',
      () => {
        hostSocket.emit('trivia:force-answer');
      }
    );

    forceAnswerPayloads.forEach((payload) => {
      assert.deepStrictEqual(payload.teamIds, [alpha.id, beta.id, virtual.id]);
    });

    const modeChangedPayloadsPromise = emitToAllAndCollect(
      [hostSocket, screenSocket, playerOneSocket, playerTwoSocket],
      'trivia:mode-changed',
      () => {
        hostSocket.emit('trivia:switch-mode', { mode: 'JEOPARDY' });
      }
    );
    const modeChangedPayloads = await modeChangedPayloadsPromise;

    modeChangedPayloads.forEach((payload) => {
      assert.deepStrictEqual(payload, { mode: 'JEOPARDY' });
    });

    const triviaAudience = [hostSocket, screenSocket, playerOneSocket, playerTwoSocket];
    const jeopardyQuestionListeners = triviaAudience.map((socket) => onceEvent(socket, 'trivia:question-shown', null, 1500));
    const boardStateListeners = triviaAudience.map((socket) => onceEvent(socket, 'trivia:board-state', null, 1500));
    hostSocket.emit('trivia:select-jeopardy', { category: 'Science', value: 200 });
    const [jeopardyQuestionPayloads, boardStatePayloads] = await Promise.all([
      Promise.all(jeopardyQuestionListeners),
      Promise.all(boardStateListeners)
    ]);
    jeopardyQuestionPayloads.forEach((payload) => {
      assert.strictEqual(payload.mode, 'JEOPARDY');
      assert.strictEqual(payload.question.id, 'j2');
      assert.strictEqual(payload.question.value, 200);
    });
    boardStatePayloads.forEach((board) => {
      const science = board.find((category) => category.name === 'Science');
      const selectedQuestion = science.questions.find((question) => question.id === 'j2');
      assert.strictEqual(selectedQuestion.answered, true);
    });

    const [jeopardyAnswerResult, jeopardyScoreboard] = await Promise.all([
      onceEvent(screenSocket, 'trivia:answer-result', () => {
        hostSocket.emit('trivia:score-answer', {
          teamId: virtual.id,
          questionId: 'j2',
          correct: true
        });
      }),
      onceEvent(screenSocket, 'trivia:scores-updated')
    ]);

    assert.deepStrictEqual(jeopardyAnswerResult, {
      teamId: virtual.id,
      correct: true,
      newBalance: 200
    });
    assert.deepStrictEqual(
      jeopardyScoreboard.map((team) => ({ id: team.id, money: team.money })),
      [
        { id: alpha.id, money: 500 },
        { id: virtual.id, money: 200 },
        { id: beta.id, money: 0 }
      ]
    );

    const shopAudience = [hostSocket, screenSocket, playerOneSocket, playerTwoSocket];
    const shopPhaseListeners = shopAudience.map((socket) => onceEvent(socket, 'phase-changed', null, 1500));
    const shopCatalogListeners = shopAudience.map((socket) => onceEvent(socket, 'shop:catalog', null, 1500));
    hostSocket.emit('shop:open');
    const shopOpenEvents = await Promise.all([
      Promise.all(shopPhaseListeners),
      Promise.all(shopCatalogListeners)
    ]);

    shopOpenEvents[0].forEach((payload) => {
      assert.deepStrictEqual(payload, { phase: 'SHOP', previousPhase: 'TRIVIA' });
    });
    shopOpenEvents[1].forEach((catalog) => {
      assert.ok(Array.isArray(catalog.categories));
      assert.ok(catalog.teams.some((team) => team.id === alpha.id));
      assert.ok(catalog.teams.some((team) => team.id === virtual.id));
    });

    const alphaPurchaseEvents = await Promise.all([
      onceEvent(screenSocket, 'shop:purchase-result', () => {
        hostSocket.emit('shop:purchase', { teamId: alpha.id, itemKey: 'flour-basic' });
      }),
      onceEvent(screenSocket, 'shop:team-inventory-updated'),
      onceEvent(screenSocket, 'teams-updated')
    ]);

    const [alphaPurchaseArgs, alphaInventoryArgs, alphaTeamsUpdated] = alphaPurchaseEvents;
    assert.strictEqual(alphaPurchaseArgs[0], alpha.id);
    assert.strictEqual(alphaPurchaseArgs[1].success, true);
    assert.strictEqual(alphaPurchaseArgs[1].itemKey, 'flour-basic');
    assert.strictEqual(alphaPurchaseArgs[1].newBalance, 300);
    assert.strictEqual(alphaInventoryArgs[0], alpha.id);
    assert.ok(alphaInventoryArgs[1].some((item) => item.item_key === 'flour-basic'));
    assert.strictEqual(alphaTeamsUpdated.find((team) => team.id === alpha.id).money, 300);

    const virtualPurchaseEvents = await Promise.all([
      onceEvent(screenSocket, 'shop:purchase-result', () => {
        hostSocket.emit('shop:purchase', { teamId: virtual.id, itemKey: 'cake-statue-liberty' });
      }),
      onceEvent(screenSocket, 'shop:team-inventory-updated')
    ]);

    const [virtualPurchaseArgs, virtualInventoryArgs] = virtualPurchaseEvents;
    assert.strictEqual(virtualPurchaseArgs[0], virtual.id);
    assert.strictEqual(virtualPurchaseArgs[1].success, true);
    assert.strictEqual(virtualPurchaseArgs[1].newBalance, 200);
    assert.ok(virtualInventoryArgs[1].some((item) => item.item_key === 'cake-statue-liberty'));

    const bakingPhasePayloads = await emitToAllAndCollect(
      [hostSocket, screenSocket, playerOneSocket, playerTwoSocket],
      'phase-changed',
      () => {
        hostSocket.emit('shop:close');
      }
    );

    bakingPhasePayloads.forEach((payload) => {
      assert.deepStrictEqual(payload, { phase: 'BAKING', previousPhase: 'SHOP' });
    });

    const [bakingStarted, bakingSelections] = await Promise.all([
      onceEvent(screenSocket, 'baking:started', () => {
        hostSocket.emit('baking:start', { durationSec: 300, teamId: virtual.id });
      }),
      onceEvent(playerOneSocket, 'baking:minigame-selections', null, 3000)
    ]);

    assert.strictEqual(bakingStarted.teamId, virtual.id);
    assert.strictEqual(bakingStarted.durationSec, 300);
    assert.strictEqual(bakingSelections.teamId, virtual.id);
    assert.strictEqual(bakingSelections.minigames.length, 6);
    assert.deepStrictEqual(
      bakingSelections.minigames.map((entry) => entry.phase),
      ['prep', 'mix', 'bake', 'cool', 'decorate', 'present']
    );

    const bakingScores = {
      prep: 70,
      mix: 80,
      bake: 90,
      cool: 60,
      decorate: 75,
      present: 85
    };

    let galleryPayloadPromise = null;

    for (const [index, phase] of Object.keys(bakingScores).entries()) {
      if (phase === 'present') {
        galleryPayloadPromise = onceEvent(hostSocket, 'baking:cake-gallery', null, 5000);
      }

      const phaseCompleted = await onceEvent(screenSocket, 'baking:phase-completed', () => {
        playerOneSocket.emit('baking:phase-complete', {
          teamId: virtual.id,
          phase,
          score: bakingScores[phase],
          details: { combo: index + 1 }
        });
      }, 3000);

      assert.strictEqual(phaseCompleted.teamId, virtual.id);
      assert.strictEqual(phaseCompleted.phase, phase);
      assert.strictEqual(phaseCompleted.score, bakingScores[phase]);
      assert.strictEqual(phaseCompleted.scoreboard[0].teamId, virtual.id);
      assert.strictEqual(phaseCompleted.scoreboard[0].completedCount, index + 1);
    }

    const recordedPhaseScores = app.db.db
      .prepare('SELECT phase, score FROM scores WHERE team_id = ? ORDER BY id')
      .all(virtual.id);
    assert.deepStrictEqual(
      recordedPhaseScores,
      [
        { phase: 'prep', score: 70 },
        { phase: 'mix', score: 80 },
        { phase: 'bake', score: 90 },
        { phase: 'cool', score: 60 },
        { phase: 'decorate', score: 75 },
        { phase: 'present', score: 85 }
      ]
    );

    const galleryPayload = await galleryPayloadPromise;
    const expectedFinalScores = calculateFinalScores(app.db.db, virtual.id);
    assert.deepStrictEqual(galleryPayload.scores, expectedFinalScores);
    assert.strictEqual(galleryPayload.teamId, virtual.id);
    assert.ok(Array.isArray(galleryPayload.imagePaths));
    assert.ok(galleryPayload.imagePaths.length > 0);
    galleryPayload.imagePaths.forEach((imagePath) => {
      if (imagePath.startsWith('/assets/cake-results/')) {
        generatedFiles.add(resolveAssetPath(imagePath));
      }
    });

    const judgingPhasePayloads = await emitToAllAndCollect(
      [hostSocket, screenSocket, playerOneSocket, playerTwoSocket],
      'phase-changed',
      () => {
        hostSocket.emit('set-phase', 'JUDGING');
      }
    );

    judgingPhasePayloads.forEach((payload) => {
      assert.deepStrictEqual(payload, { phase: 'JUDGING', previousPhase: 'BAKING' });
    });

    const judgingSubmissions = [
      { teamId: alpha.id, taste: 90, accuracy: 90, creativity: 90 },
      { teamId: beta.id, taste: 50, accuracy: 50, creativity: 50 },
      { teamId: virtual.id, taste: 80, accuracy: 60, creativity: 40 }
    ];

    for (const submission of judgingSubmissions) {
      const update = await onceEvent(hostSocket, 'judging:scores-updated', () => {
        hostSocket.emit('judging:score-team', submission);
      });
      assert.strictEqual(update.teamId, submission.teamId);
      assert.ok(Array.isArray(update.results));
    }

    const judgingResults = await onceEvent(hostSocket, 'judging:results', () => {
      hostSocket.emit('judging:get-results');
    });

    assert.deepStrictEqual(
      judgingResults.map((entry) => entry.teamName),
      ['Alpha Bakers', 'Virtual Villains', 'Beta Bakers']
    );
    assert.ok(judgingResults[0].scores.total > judgingResults[1].scores.total);
    assert.ok(judgingResults[1].scores.total > judgingResults[2].scores.total);

    const resultsAudience = [hostSocket, screenSocket, playerOneSocket, playerTwoSocket];
    const resultsRevealListeners = resultsAudience.map((socket) => onceEvent(socket, 'results:reveal', null, 1500));
    const resultsPhaseListeners = resultsAudience.map((socket) => onceEvent(socket, 'phase-changed', null, 1500));
    hostSocket.emit('results:reveal');
    const revealedResultsPayloads = await Promise.all([
      Promise.all(resultsRevealListeners),
      Promise.all(resultsPhaseListeners)
    ]);

    revealedResultsPayloads[0].forEach((payload) => {
      assert.deepStrictEqual(payload.map((entry) => entry.teamName), ['Alpha Bakers', 'Virtual Villains', 'Beta Bakers']);
    });
    revealedResultsPayloads[1].forEach((payload) => {
      assert.deepStrictEqual(payload, { phase: 'RESULTS', previousPhase: 'JUDGING' });
    });

    assert.deepStrictEqual(
      phaseTransitions.map((entry) => `${entry.previousPhase}->${entry.phase}`),
      ['LOBBY->TRIVIA', 'TRIVIA->SHOP', 'SHOP->BAKING', 'BAKING->JUDGING', 'JUDGING->RESULTS']
    );
  });
});
