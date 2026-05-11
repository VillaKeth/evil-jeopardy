// Evil Jeopardy 1.2 - Player Client Script (virtual player view)

// Initialize Socket.io connection
const socket = io();

// DOM elements
const phaseIndicator = document.getElementById('phase-indicator');
const phaseText = document.getElementById('phase-text');
const connectionStatus = document.getElementById('connection-status');
const connectionOverlay = document.getElementById('connection-overlay');
const connectionOverlayMessage = connectionOverlay ? connectionOverlay.querySelector('p') : null;
const loadingOverlay = document.getElementById('loading-overlay');
const loadingOverlayMessage = loadingOverlay ? loadingOverlay.querySelector('p') : null;
const teamDisplay = document.getElementById('team-display');
const teamNameDisplay = document.getElementById('team-name');
const joinForm = document.getElementById('join-form');
const playerTeamNameInput = document.getElementById('player-team-name');
const joinTeamBtn = document.getElementById('join-team-btn');
const otherTeamsList = document.getElementById('other-teams-list');

// Trivia DOM elements
const playerTriviaModeBadge = document.getElementById('player-trivia-mode-badge');
const playerTriviaCategory = document.getElementById('player-trivia-category');
const playerQuestionDisplay = document.getElementById('player-question-display');
const playerMediaArea = document.getElementById('player-media-area');
const playerBuzzBtn = document.getElementById('player-buzz-btn');
const playerTriviaStatus = document.getElementById('player-trivia-status');
const playerTriviaScoreboard = document.getElementById('player-trivia-scoreboard');
const playerTriviaTeamName = document.getElementById('player-trivia-team-name');

// Shop DOM elements
const playerShopStatus = document.getElementById('player-shop-status');
const playerShopTeamName = document.getElementById('player-shop-team-name');
const playerShopBalance = document.getElementById('player-shop-balance');
const playerShopSummaryName = document.getElementById('player-shop-summary-name');
const playerShopBalanceSummary = document.getElementById('player-shop-balance-summary');
const playerShopCatalog = document.getElementById('player-shop-catalog');
const playerShopInventory = document.getElementById('player-shop-inventory');
const playerShopPurchases = document.getElementById('player-shop-purchases');

// Baking DOM elements
const phaserContainer = document.getElementById('phaser-container');
const resultsSection = document.getElementById('results-section');
const playerResultsContainer = document.getElementById('player-results-container');
const phaserDefaultParent = phaserContainer ? phaserContainer.parentElement : null;

// State
let currentPhase = 'LOBBY';
let myTeam = null;
let allTeams = [];
let currentTriviaMode = 'SLIDE';
let currentQuestion = null;
let currentQuestionId = null;
let currentBoard = [];
let buzzedTeamId = null;
let buzzPending = false;
let forcedTeams = new Set();
let answeredTeams = new Set();
let latestAnswerResult = null;
let shopCatalog = { categories: [], defaultKit: [] };
let shopItemsByKey = new Map();
let shopInventories = {};
let shopPurchaseHistories = {};
let playerShopStatusMessage = '';
let playerShopStatusVariant = 'info';
let bakingSession = {
  teamId: null,
  minigames: [],
  chaosEvents: [],
  chaosLevel: null,
  currentPhaseIndex: 0
};
let cakeRevealActive = false;
let revealedResults = [];
let hasConnectedOnce = false;
let phaseTransitionTimer = null;

// ===== Socket Event Handlers =====

socket.on('connect', () => {
  console.log('Connected to server');
  hideConnectionOverlay();
  updateConnectionStatus('Connected', 'success');

  if (!hasConnectedOnce) {
    hasConnectedOnce = true;
    socket.emit('join-room', 'player');
    showLoadingOverlay('Loading latest show state...');
    socket.emit('get-state');
  }
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  hideLoadingOverlay();
  showConnectionOverlay('Connection lost. Reconnecting...');
  updateConnectionStatus('Disconnected - Reconnecting...', 'error');
});

function handleReconnect() {
  hideConnectionOverlay();
  updateConnectionStatus('Connected', 'success');
  showLoadingOverlay('Connection restored. Syncing current state...');
  socket.emit('join-room', 'player');
  socket.emit('request-state');
}

socket.on('reconnect', handleReconnect);
if (socket.io) {
  socket.io.on('reconnect', handleReconnect);
}

socket.on('room-joined', (data) => {
  console.log('Joined room:', data.role);
});

socket.on('phase-changed', (data) => {
  console.log('Phase changed:', data.phase);
  currentPhase = data.phase;
  updatePhaseUI(data.phase);
});

socket.on('state', (data) => {
  console.log('Received state:', data);
  hideLoadingOverlay();
  currentPhase = data.phase;
  allTeams = normalizeTeams(data.teams || []);

  if (data.baking) {
    bakingSession = normalizeBakingSession(data.baking);
  }

  syncMyTeamFromTeams();
  updatePhaseUI(data.phase);
  renderOtherTeamsList();
  renderTriviaScoreboard();
  updatePlayerTriviaView();
  renderShopDisplay();
});

socket.on('team-joined', (team) => {
  console.log('Team joined:', team);

  if (myTeam && team.name === myTeam.name) {
    myTeam = normalizeTeam(team);
    showTeamDisplay();
    resetJoinButton();
  }

  allTeams = mergeTeamList(allTeams, [team]);
  syncMyTeamFromTeams();
  renderOtherTeamsList();
  renderTriviaScoreboard();
  updateBuzzControls();
  renderShopDisplay();
});

socket.on('teams-updated', (updatedTeams) => {
  console.log('Teams updated:', updatedTeams);
  allTeams = mergeTeamList(allTeams, updatedTeams);
  syncMyTeamFromTeams();
  renderOtherTeamsList();
  renderTriviaScoreboard();
  updateBuzzControls();
  renderShopDisplay();
});

socket.on('error', (error) => {
  console.error('Server error:', error);
  hideLoadingOverlay();
  if (!myTeam || !myTeam.id) {
    resetJoinButton();
  }
  showNotification(error.message || 'An error occurred', 'error');
});

// ===== TRIVIA EVENT HANDLERS =====

socket.on('trivia:question-shown', (data) => {
  console.log('Question shown:', data);
  currentQuestion = data.question || null;
  currentQuestionId = currentQuestion ? currentQuestion.id : null;
  currentTriviaMode = data.mode || currentTriviaMode;
  buzzedTeamId = null;
  buzzPending = false;
  forcedTeams = new Set();
  answeredTeams = new Set();
  latestAnswerResult = null;

  updatePlayerTriviaView();
});

socket.on('trivia:scores-updated', (scoreboard) => {
  console.log('Scores updated:', scoreboard);
  allTeams = mergeTeamList(allTeams, scoreboard);
  syncMyTeamFromTeams();
  renderTriviaScoreboard();
  updateBuzzControls();
  renderShopDisplay();
});

socket.on('trivia:buzz-received', (data) => {
  console.log('Buzz received:', data);
  buzzedTeamId = data.teamId;
  buzzPending = false;
  latestAnswerResult = null;

  updateBuzzControls();

  if (myTeam && data.teamId === myTeam.id) {
    showNotification('Your team buzzed first!', 'success');
  }
});

socket.on('trivia:answer-result', (data) => {
  console.log('Answer result:', data);
  latestAnswerResult = data;
  answeredTeams.add(data.teamId);
  buzzedTeamId = null;
  buzzPending = false;

  allTeams = mergeTeamList(allTeams, [{ id: data.teamId, money: data.newBalance }]);
  syncMyTeamFromTeams();
  renderTriviaScoreboard();
  updateBuzzControls();
  renderShopDisplay();

  if (myTeam && data.teamId === myTeam.id) {
    showNotification(
      `Your team answered ${data.correct ? 'correctly' : 'incorrectly'}!`,
      data.correct ? 'success' : 'error'
    );
  }
});

socket.on('trivia:force-answer-required', (data) => {
  console.log('Force answer required:', data);
  forcedTeams = new Set(Array.isArray(data.teamIds) ? data.teamIds : []);
  buzzedTeamId = null;
  buzzPending = false;
  updateBuzzControls();
});

socket.on('trivia:mode-changed', (data) => {
  console.log('Mode changed:', data);
  currentTriviaMode = data.mode || 'SLIDE';
  updatePlayerTriviaView();
});

socket.on('trivia:board-state', (board) => {
  console.log('Board state:', board);
  currentBoard = Array.isArray(board) ? board : [];
  renderCategoryBadge();
});

// ===== SHOP EVENT HANDLERS =====

socket.on('shop:catalog', (data) => {
  console.log('Shop catalog:', data);
  shopCatalog = data || { categories: [], defaultKit: [] };
  shopItemsByKey = buildShopItemIndex(shopCatalog);
  shopInventories = normalizeShopCollections(shopCatalog.inventories);
  shopPurchaseHistories = normalizeShopCollections(shopCatalog.purchaseHistories);

  if (Array.isArray(shopCatalog.teams) && shopCatalog.teams.length > 0) {
    allTeams = normalizeTeams(shopCatalog.teams);
    syncMyTeamFromTeams();
    renderOtherTeamsList();
    renderTriviaScoreboard();
  }

  renderShopDisplay();
});

socket.on('shop:purchase-result', (teamId, result) => {
  console.log('Shop purchase result:', teamId, result);

  if (Array.isArray(result.purchaseHistory)) {
    shopPurchaseHistories[String(teamId)] = result.purchaseHistory;
  }

  if (typeof result.newBalance === 'number') {
    allTeams = mergeTeamList(allTeams, [{ id: teamId, money: result.newBalance }]);
    syncMyTeamFromTeams();
  }

  if (myTeam && teamId === myTeam.id) {
    const itemName = result.itemName || result.itemKey || 'item';

    if (result.success) {
      const overrideText = result.approvedByOverride ? ' with host override' : '';
      showNotification(`Your team bought ${itemName}${overrideText}.`, 'success');
      setPlayerShopStatus(`Your team bought ${itemName}.`, result.approvedByOverride ? 'warning' : 'success');
    } else {
      const warning = result.warning || 'Awaiting host review.';
      showNotification(`${itemName}: ${warning}`, 'warning');
      setPlayerShopStatus(`Purchase pending: ${itemName}. ${warning}`, 'warning');
    }
  }

  renderTriviaScoreboard();
  renderShopDisplay();
});

socket.on('shop:team-inventory-updated', (teamId, inventory) => {
  console.log('Team inventory updated:', teamId, inventory);
  shopInventories[String(teamId)] = Array.isArray(inventory) ? inventory : [];
  renderShopDisplay();
});

// ===== BAKING EVENT HANDLERS =====

socket.on('baking:started', (data) => {
  console.log('Baking started:', data);
  bakingSession = normalizeBakingSession({ ...bakingSession, ...data });

  if (currentPhase === 'BAKING' && bakingSession.minigames.length) {
    startBakingSession();
  }
});

socket.on('baking:minigame-selections', (data) => {
  console.log('Baking minigame selections:', data);
  bakingSession = normalizeBakingSession({ ...bakingSession, ...data });

  if (currentPhase === 'BAKING') {
    startBakingSession();
  }
});

socket.on('baking:phase-completed', (data) => {
  console.log('Baking phase completed:', data);
  bakingSession = normalizeBakingSession({
    ...bakingSession,
    currentPhaseIndex: typeof data.currentPhaseIndex === 'number' ? data.currentPhaseIndex : bakingSession.currentPhaseIndex
  });
});

socket.on('baking:time-up', () => {
  destroyBakingSession();
  showNotification('Time is up! Baking complete.', 'success');
});

socket.on('results:cake-reveal', (payload) => {
  showCakeReveal(payload);
});

socket.on('results:reveal', (results) => {
  revealedResults = normalizeRevealedResults(results);
  currentPhase = 'RESULTS';
  cakeRevealActive = false;
  restorePhaserContainer();
  destroyBakingSession();
  setActivePhaseSection('results-section');
  phaseText.textContent = 'RESULTS';
  phaseIndicator.className = 'phase-indicator phase-RESULTS';
  renderPlayerResultsView();
});

// ===== UI Updates =====

function updateConnectionStatus(message, type) {
  const statusSpan = connectionStatus.querySelector('span');
  if (statusSpan) {
    statusSpan.textContent = message;
  }

  connectionStatus.className = `status status-${type}`;
  connectionStatus.classList.remove('hidden');

  if (type === 'success') {
    setTimeout(() => {
      connectionStatus.classList.add('hidden');
    }, 3000);
  }
}

function showConnectionOverlay(message = 'Connection lost. Reconnecting...') {
  if (connectionOverlayMessage) {
    connectionOverlayMessage.textContent = message;
  }

  if (connectionOverlay) {
    connectionOverlay.classList.remove('hidden');
  }
}

function hideConnectionOverlay() {
  if (connectionOverlay) {
    connectionOverlay.classList.add('hidden');
  }
}

function showLoadingOverlay(message = 'Loading...') {
  if (loadingOverlayMessage) {
    loadingOverlayMessage.textContent = message;
  }

  if (loadingOverlay) {
    loadingOverlay.classList.remove('hidden');
  }
}

function hideLoadingOverlay() {
  if (loadingOverlay) {
    loadingOverlay.classList.add('hidden');
  }
}

function updatePhaseUI(phase) {
  phaseText.textContent = phase;
  phaseIndicator.className = `phase-indicator phase-${phase}`;
  setActivePhaseSection(`${phase.toLowerCase()}-section`);

  const preserveCakeReveal = phase === 'RESULTS' && cakeRevealActive;
  if (phase === 'BAKING') {
    cakeRevealActive = false;
    restorePhaserContainer();
    renderPlayerResultsPlaceholder();
    startBakingSession();
  } else if (phase === 'RESULTS') {
    restorePhaserContainer();
    destroyBakingSession();
    if (!preserveCakeReveal) {
      renderPlayerResultsView();
    }
  } else if (!preserveCakeReveal) {
    cakeRevealActive = false;
    restorePhaserContainer();
    destroyBakingSession();
    renderPlayerResultsPlaceholder();
  }

  if (phase === 'TRIVIA') {
    updatePlayerTriviaView();
  }

  if (phase === 'SHOP') {
    renderShopDisplay();
  }
}

function showTeamDisplay() {
  joinForm.classList.add('hidden');
  teamDisplay.classList.remove('hidden');
  teamNameDisplay.textContent = myTeam ? myTeam.name : '';
  updatePlayerIdentity();
  renderShopDisplay();
}

function renderOtherTeamsList() {
  const otherTeams = normalizeTeams(allTeams).filter((team) => !myTeam || team.id !== myTeam.id);

  if (otherTeams.length === 0) {
    otherTeamsList.innerHTML = '<li class="text-muted text-center">No other teams yet...</li>';
    return;
  }

  otherTeamsList.innerHTML = otherTeams.map((team) => `
    <li class="team-item">
      <div>
        <span class="team-name">${escapeHtml(team.name)}</span>
        ${team.isVirtual ? '<span class="team-badge virtual">Virtual</span>' : '<span class="team-badge physical">Physical</span>'}
      </div>
    </li>
  `).join('');
}

function renderTriviaScoreboard() {
  if (!playerTriviaScoreboard) {
    return;
  }

  if (!allTeams.length) {
    playerTriviaScoreboard.innerHTML = '<div class="text-muted text-center">Waiting for scores...</div>';
    return;
  }

  playerTriviaScoreboard.innerHTML = normalizeTeams(allTeams).map((team) => `
    <div class="score-card player-score-card ${myTeam && team.id === myTeam.id ? 'me' : ''}">
      <div class="score-team">${escapeHtml(team.name)}</div>
      <div class="score-value">${formatMoney(team.money)}</div>
    </div>
  `).join('');
}

function updatePlayerTriviaView() {
  updatePlayerIdentity();
  updateModeBadge();
  renderCurrentQuestion();
  renderTriviaScoreboard();
  updateBuzzControls();
}

function updatePlayerIdentity() {
  const teamName = myTeam ? myTeam.name : 'Not joined';
  const balanceText = formatMoney(myTeam ? myTeam.money : 0);

  if (playerTriviaTeamName) {
    playerTriviaTeamName.textContent = teamName;
  }

  if (playerShopTeamName) {
    playerShopTeamName.textContent = teamName;
  }

  if (playerShopSummaryName) {
    playerShopSummaryName.textContent = teamName;
  }

  if (playerShopBalance) {
    playerShopBalance.textContent = balanceText;
  }

  if (playerShopBalanceSummary) {
    playerShopBalanceSummary.textContent = balanceText;
  }

  if (myTeam && teamNameDisplay.textContent !== myTeam.name) {
    teamNameDisplay.textContent = myTeam.name;
  }
}

function updateModeBadge() {
  if (playerTriviaModeBadge) {
    playerTriviaModeBadge.textContent = currentTriviaMode === 'JEOPARDY' ? 'Jeopardy Round' : 'Slide Round';
  }

  renderCategoryBadge();
}

function renderCurrentQuestion() {
  if (!playerQuestionDisplay) {
    return;
  }

  if (!currentQuestion) {
    playerQuestionDisplay.innerHTML = '<p class="text-muted text-center">Waiting for host to reveal a question...</p>';
    displayMedia(playerMediaArea, null);
    renderCategoryBadge();
    return;
  }

  const valueMarkup = typeof currentQuestion.value === 'number'
    ? `<div class="player-question-meta">Value: ${formatMoney(currentQuestion.value)}</div>`
    : '';

  playerQuestionDisplay.innerHTML = `
    <div class="player-question-copy">${formatMultilineText(currentQuestion.question || '')}</div>
    ${valueMarkup}
  `;

  displayMedia(playerMediaArea, currentQuestion.media);
  renderCategoryBadge();
}

function renderCategoryBadge() {
  if (!playerTriviaCategory) {
    return;
  }

  const categoryName = currentTriviaMode === 'JEOPARDY' && currentQuestionId
    ? getCategoryName(currentQuestionId)
    : '';

  if (!categoryName) {
    playerTriviaCategory.classList.add('hidden');
    playerTriviaCategory.textContent = '';
    return;
  }

  playerTriviaCategory.classList.remove('hidden');
  playerTriviaCategory.textContent = categoryName;
}

function updateBuzzControls() {
  if (!playerTriviaStatus || !playerBuzzBtn) {
    return;
  }

  const state = getBuzzState();
  playerTriviaStatus.textContent = state.message;
  playerTriviaStatus.className = `player-status-banner ${state.variant}`;
  playerBuzzBtn.textContent = state.buttonLabel;
  playerBuzzBtn.disabled = !state.canBuzz;
  playerBuzzBtn.classList.toggle('is-live', state.canBuzz);
}

function getBuzzState() {
  if (!myTeam || !myTeam.id) {
    return {
      canBuzz: false,
      buttonLabel: 'BUZZ',
      message: 'Join a team to enable buzzing.',
      variant: 'info'
    };
  }

  if (currentPhase !== 'TRIVIA') {
    return {
      canBuzz: false,
      buttonLabel: 'BUZZ',
      message: 'Buzzing unlocks during the trivia phase.',
      variant: 'info'
    };
  }

  if (!currentQuestionId) {
    return {
      canBuzz: false,
      buttonLabel: 'BUZZ',
      message: 'Waiting for the next question...',
      variant: 'info'
    };
  }

  if (forcedTeams.has(myTeam.id)) {
    return {
      canBuzz: false,
      buttonLabel: 'ANSWER',
      message: 'Your team must answer.',
      variant: 'warning'
    };
  }

  if (answeredTeams.has(myTeam.id)) {
    const answeredCorrectly = latestAnswerResult && latestAnswerResult.teamId === myTeam.id && latestAnswerResult.correct;
    return {
      canBuzz: false,
      buttonLabel: 'ANSWERED',
      message: answeredCorrectly ? 'Your team answered correctly.' : 'Your team has already answered.',
      variant: answeredCorrectly ? 'success' : 'error'
    };
  }

  if (buzzPending) {
    return {
      canBuzz: false,
      buttonLabel: 'SENT',
      message: 'Buzz sent — waiting for confirmation...',
      variant: 'info'
    };
  }

  if (buzzedTeamId === myTeam.id) {
    return {
      canBuzz: false,
      buttonLabel: 'BUZZED',
      message: 'Your team buzzed first.',
      variant: 'success'
    };
  }

  if (buzzedTeamId) {
    return {
      canBuzz: false,
      buttonLabel: 'WAIT',
      message: 'Waiting for answer...',
      variant: 'info'
    };
  }

  return {
    canBuzz: true,
    buttonLabel: 'BUZZ',
    message: 'Question live — buzz when ready.',
    variant: 'info'
  };
}

function renderShopDisplay() {
  updatePlayerIdentity();
  renderPlayerShopStatus();
  renderPlayerShopCatalog();
  renderPlayerShopInventory();
  renderPlayerShopPurchases();
}

function renderPlayerShopStatus() {
  if (!playerShopStatus) {
    return;
  }

  if (!playerShopStatusMessage) {
    playerShopStatusMessage = myTeam && myTeam.id
      ? 'Host controls purchases for your team.'
      : 'Join a team to track your purchases.';
  }

  playerShopStatus.textContent = playerShopStatusMessage;
  playerShopStatus.className = `player-shop-status ${playerShopStatusVariant}`;
}

function setPlayerShopStatus(message, variant = 'info') {
  playerShopStatusMessage = message;
  playerShopStatusVariant = variant;
  renderPlayerShopStatus();
}

function renderPlayerShopCatalog() {
  if (!playerShopCatalog) {
    return;
  }

  if (!shopCatalog || !Array.isArray(shopCatalog.categories) || shopCatalog.categories.length === 0) {
    playerShopCatalog.innerHTML = `
      <div class="card">
        <div class="card-body">
          <p class="text-muted text-center">Waiting for host to open the shop...</p>
        </div>
      </div>
    `;
    return;
  }

  const inventory = getMyShopInventory();

  playerShopCatalog.innerHTML = shopCatalog.categories.map((category) => `
    <section class="player-shop-category">
      <h3>${escapeHtml(category.name)}</h3>
      ${category.description ? `<p class="text-muted">${escapeHtml(category.description)}</p>` : ''}
      <div class="player-shop-items">
        ${(category.items || []).map((item) => {
          const ownedCount = inventory.filter((entry) => entry.item_key === item.key).length;
          const meta = buildShopItemMeta(item);
          return `
            <article class="player-shop-item ${ownedCount > 0 ? 'owned' : ''}">
              <div class="player-shop-item-header">
                <div>
                  <h4>${escapeHtml(item.name)}</h4>
                  ${item.description ? `<p class="text-muted">${escapeHtml(item.description)}</p>` : ''}
                </div>
                <span class="player-shop-item-price">${formatMoney(item.price)}</span>
              </div>
              ${meta ? `<div class="player-shop-meta">${escapeHtml(meta)}</div>` : ''}
              <div class="player-shop-owned ${ownedCount > 0 ? 'is-owned' : ''}">${ownedCount > 0 ? `✓ Bought ×${ownedCount}` : 'Available via host'}</div>
              <div class="player-shop-host-note">Host controls purchases.</div>
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `).join('');
}

function renderPlayerShopInventory() {
  if (!playerShopInventory) {
    return;
  }

  const inventorySummary = summarizeInventory(getMyShopInventory());
  playerShopInventory.innerHTML = inventorySummary.length
    ? inventorySummary.map(({ itemKey, count }) => {
      const item = shopItemsByKey.get(itemKey);
      const itemName = item ? item.name : itemKey;
      return `<span class="player-shop-chip">✓ ${escapeHtml(itemName)}${count > 1 ? ` ×${count}` : ''}</span>`;
    }).join('')
    : '<span class="text-muted">No purchases yet.</span>';
}

function renderPlayerShopPurchases() {
  if (!playerShopPurchases) {
    return;
  }

  const purchases = getMyShopPurchaseHistory();
  playerShopPurchases.innerHTML = purchases.length
    ? purchases.map((purchase) => {
      const item = shopItemsByKey.get(purchase.item_key);
      const itemName = item ? item.name : purchase.item_key;
      const categoryName = item ? item.categoryName : purchase.category;
      return `
        <article class="player-shop-purchase-item">
          <div class="player-shop-purchase-row">
            <strong>${escapeHtml(itemName)}</strong>
            <span class="text-muted">${formatMoney(purchase.price)}</span>
          </div>
          <div class="player-shop-purchase-meta">${escapeHtml(categoryName || 'Shop Item')}</div>
        </article>
      `;
    }).join('')
    : '<div class="text-muted">Host approvals will appear here in real time.</div>';
}

function getMyShopInventory() {
  return myTeam && myTeam.id ? (shopInventories[String(myTeam.id)] || []) : [];
}

function getMyShopPurchaseHistory() {
  return myTeam && myTeam.id ? (shopPurchaseHistories[String(myTeam.id)] || []) : [];
}

function summarizeInventory(inventory) {
  const summary = new Map();

  inventory.forEach((item) => {
    const itemKey = item.item_key;
    summary.set(itemKey, (summary.get(itemKey) || 0) + 1);
  });

  return Array.from(summary.entries()).map(([itemKey, count]) => ({ itemKey, count }));
}

function buildShopItemIndex(data) {
  const itemMap = new Map();

  (data.categories || []).forEach((category) => {
    (category.items || []).forEach((item) => {
      itemMap.set(item.key, {
        ...item,
        category: category.key,
        categoryName: category.name
      });
    });
  });

  return itemMap;
}

function normalizeShopCollections(collections) {
  const normalized = {};

  Object.entries(collections || {}).forEach(([key, value]) => {
    normalized[String(key)] = Array.isArray(value) ? value : [];
  });

  return normalized;
}

function buildShopItemMeta(item) {
  const tags = [];

  if (typeof item.difficulty === 'number') {
    tags.push(`Difficulty ${item.difficulty}`);
  }

  if (typeof item.quality === 'number') {
    tags.push(`Quality ${item.quality}`);
  }

  if (typeof item.bonus === 'number') {
    tags.push(`${item.bonus}x bonus`);
  }

  if (item.effect) {
    tags.push(`Effect: ${item.effect}`);
  }

  if (typeof item.value === 'number' && item.effect) {
    tags.push(`Value ${item.value}`);
  }

  return tags.join(' • ');
}

function normalizeBakingSession(data = {}) {
  return {
    teamId: Number(data.teamId) || null,
    minigames: Array.isArray(data.minigames) ? data.minigames : bakingSession.minigames,
    chaosEvents: Array.isArray(data.chaosEvents) ? data.chaosEvents : bakingSession.chaosEvents,
    chaosLevel: data.chaosLevel || bakingSession.chaosLevel || null,
    currentPhaseIndex: typeof data.currentPhaseIndex === 'number' ? data.currentPhaseIndex : (bakingSession.currentPhaseIndex || 0)
  };
}

function startBakingSession() {
  if (typeof window.initGame !== 'function' || !bakingSession.minigames.length) {
    return;
  }

  const activeTeamId = bakingSession.teamId || myTeam?.id || null;
  if (activeTeamId && (!myTeam || (myTeam.id && activeTeamId !== myTeam.id))) {
    return;
  }

  const inventory = getMyShopInventory();
  const boosts = buildBakingBoosts(inventory);
  const game = window.initGame(socket, inventory, {}, {
    minigames: bakingSession.minigames,
    chaosEvents: bakingSession.chaosEvents,
    chaosLevel: bakingSession.chaosLevel,
    currentPhaseIndex: bakingSession.currentPhaseIndex,
    teamId: activeTeamId
  });

  const startSelection = getBakingStartSelection();
  if (game && startSelection) {
    game.scene.start('PhaseSelectScene', {
      phaseName: startSelection.phaseName || startSelection.phase.toUpperCase(),
      phaseKey: startSelection.phase,
      description: startSelection.description || 'Get ready!',
      minigame: startSelection.sceneKey,
      isEvil: Boolean(startSelection.isAbsurd),
      selectionIndex: bakingSession.currentPhaseIndex,
      inventory,
      boosts,
      chaosEvents: bakingSession.chaosEvents,
      teamId: activeTeamId
    });

    if (
      typeof game.scene.getScene === 'function' &&
      game.scene.getScene('EvilEventOverlay') &&
      !game.scene.isActive('EvilEventOverlay')
    ) {
      game.scene.launch('EvilEventOverlay', {
        socket,
        teamId: activeTeamId
      });
    }
  }
}

function getBakingStartSelection() {
  return bakingSession.minigames[bakingSession.currentPhaseIndex] || bakingSession.minigames[0] || null;
}

function destroyBakingSession() {
  if (typeof window.destroyGame === 'function') {
    window.destroyGame();
  }

  if (phaserContainer) {
    phaserContainer.style.display = 'none';
  }
}

function setActivePhaseSection(sectionId) {
  if (phaseTransitionTimer) {
    clearTimeout(phaseTransitionTimer);
  }

  document.querySelectorAll('.phase-section').forEach((section) => {
    section.classList.remove('active', 'phase-enter');
  });

  const section = document.getElementById(sectionId);
  if (!section) {
    return;
  }

  section.classList.add('phase-enter');
  phaseTransitionTimer = setTimeout(() => {
    section.classList.add('active');
  }, 30);
}

function restorePhaserContainer() {
  if (phaserContainer && phaserDefaultParent && phaserContainer.parentElement !== phaserDefaultParent) {
    phaserDefaultParent.prepend(phaserContainer);
  }
}

function movePhaserContainerToResults() {
  if (phaserContainer && resultsSection && phaserContainer.parentElement !== resultsSection) {
    resultsSection.prepend(phaserContainer);
  }
}

function renderPlayerResultsPlaceholder() {
  if (!playerResultsContainer) {
    return;
  }

  playerResultsContainer.innerHTML = `
    <div class="card player-results-empty">
      <div class="card-body">
        <p class="text-muted text-center">Waiting for the host to reveal the final standings...</p>
      </div>
    </div>
  `;
}

function formatRevealScore(value) {
  const numeric = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function normalizeCakeRevealPayload(payload = {}) {
  const scores = payload.scores || {};
  return {
    cakeImagePath: payload.cakeImagePath || payload.imagePath || '',
    scores: {
      taste: Number(scores.taste) || 0,
      accuracy: Number(scores.accuracy) || 0,
      creativity: Number(scores.creativity) || 0,
      total: Number(scores.total) || 0
    },
    chaosEvents: Array.isArray(payload.chaosEvents) ? payload.chaosEvents : [],
    teamId: Number(payload.teamId) || bakingSession.teamId || myTeam?.id || null
  };
}

function launchCakeRevealScene(payload) {
  if (!phaserContainer || typeof window.initGame !== 'function' || typeof window.ResultScene !== 'function') {
    return false;
  }

  renderPlayerResultsPlaceholder();
  movePhaserContainerToResults();
  const game = window.initGame(socket, getMyShopInventory(), {}, {
    minigames: bakingSession.minigames,
    chaosEvents: payload.chaosEvents,
    chaosLevel: bakingSession.chaosLevel,
    currentPhaseIndex: bakingSession.currentPhaseIndex,
    teamId: payload.teamId
  });

  if (!game || !game.scene) {
    return false;
  }

  if (typeof game.scene.getScene === 'function' && !game.scene.getScene('ResultScene') && typeof game.scene.add === 'function') {
    game.scene.add('ResultScene', window.ResultScene, false);
  }

  game.scene.start('ResultScene', payload);
  return true;
}

function renderCakeRevealFallback(payload) {
  if (!playerResultsContainer) {
    return;
  }

  playerResultsContainer.innerHTML = `
    <div class="card">
      <div class="card-header text-center">
        <h2>Your cake is ready...</h2>
      </div>
      <div class="card-body" style="display:grid; gap: var(--spacing-lg);">
        ${payload.cakeImagePath ? `<img src="${escapeHtml(payload.cakeImagePath)}" alt="Revealed cake" style="width:100%; max-width:420px; margin:0 auto; border-radius:16px; background:rgba(13,17,23,0.88);">` : ''}
        <div class="scoreboard player-trivia-scoreboard">
          ${[['Taste', payload.scores.taste], ['Accuracy', payload.scores.accuracy], ['Creativity', payload.scores.creativity], ['Total', payload.scores.total]].map(([label, value]) => `
            <div class="score-card player-score-card">
              <div class="score-team">${escapeHtml(label)}</div>
              <div class="score-value">${formatRevealScore(value)}</div>
            </div>
          `).join('')}
        </div>
        <div class="player-shop-purchase-list">
          ${(payload.chaosEvents.length ? payload.chaosEvents : [{ title: 'Chaos Summary', description: 'No kitchen disasters survived the edit.' }]).slice(-4).map((event) => `
            <article class="player-shop-purchase-item">
              <div class="player-shop-purchase-row">
                <strong>${escapeHtml(event.phaseName || event.title || 'Chaos Summary')}</strong>
              </div>
              <div class="player-shop-purchase-meta">${escapeHtml(event.description || event.title || 'Something unfair happened.')}</div>
            </article>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function normalizeRevealedResults(results) {
  return [...(results || [])]
    .filter(Boolean)
    .map((entry) => ({
      ...entry,
      rank: Number(entry.rank) || 0,
      teamId: Number(entry.teamId) || 0,
      cakeImagePath: entry.cakeImagePath || '',
      isVirtualTeam: Boolean(entry.isVirtualTeam),
      scores: {
        ...(entry.scores || {}),
        taste: Number(entry.scores?.taste) || 0,
        accuracy: Number(entry.scores?.accuracy) || 0,
        creativity: Number(entry.scores?.creativity) || 0,
        total: Number(entry.scores?.total) || 0,
        physicalAverage: Number(entry.scores?.physicalAverage) || 0,
        virtualAverage: Number(entry.scores?.virtualAverage) || 0,
        virtualScores: entry.scores?.virtualScores || null
      }
    }))
    .sort((left, right) => left.rank - right.rank);
}

function roundResultScore(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function averageResultScore(values) {
  const safeValues = Array.isArray(values) ? values.map((value) => Number(value) || 0) : [];
  if (!safeValues.length) {
    return 0;
  }

  return safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length;
}

function getVirtualAverage(virtualScores) {
  if (!virtualScores) {
    return 0;
  }

  if (typeof virtualScores.average === 'number') {
    return virtualScores.average;
  }

  return averageResultScore([virtualScores.taste, virtualScores.accuracy, virtualScores.creativity]);
}

function getPhysicalAverage(scores = {}) {
  if (typeof scores.physicalAverage === 'number' && scores.physicalAverage > 0) {
    return scores.physicalAverage;
  }

  return averageResultScore([scores.taste, scores.accuracy, scores.creativity]);
}

function getOrdinalLabel(rank) {
  const safeRank = Number(rank) || 0;
  const remainder = safeRank % 10;
  const remainderHundred = safeRank % 100;
  if (remainder === 1 && remainderHundred !== 11) {
    return `${safeRank}st`;
  }
  if (remainder === 2 && remainderHundred !== 12) {
    return `${safeRank}nd`;
  }
  if (remainder === 3 && remainderHundred !== 13) {
    return `${safeRank}rd`;
  }
  return `${safeRank}th`;
}

function buildCelebrationParticles() {
  return Array.from({ length: 16 }, (_, index) => {
    const hue = [42, 16, 198, 320][index % 4];
    const left = (index * 7) % 100;
    const drift = ((index % 2 === 0 ? 1 : -1) * (14 + ((index * 5) % 20)));
    const delay = (index % 5) * 0.18;
    return `<span style="left:${left}%; background:hsl(${hue} 95% 68%); animation-delay:${delay}s; --drift:${drift}px;"></span>`;
  }).join('');
}

function getMyRevealedResult() {
  if (!myTeam) {
    return null;
  }

  return revealedResults.find((entry) => entry.teamId === myTeam.id || entry.teamName === myTeam.name) || null;
}

function renderPlayerResultsStandings() {
  if (!revealedResults.length) {
    return '<div class="text-muted">No standings yet.</div>';
  }

  return `
    <div class="player-results-standings-list">
      ${revealedResults.map((entry) => `
        <div class="player-results-standings-row ${myTeam && entry.teamId === myTeam.id ? 'me' : ''}">
          <div>
            <strong>#${getOrdinalLabel(entry.rank)} · ${escapeHtml(entry.teamName)}</strong>
            <div class="player-shop-purchase-meta">${entry.isVirtualTeam ? 'Virtual hybrid score' : 'Physical judging score'}</div>
          </div>
          <strong>${formatRevealScore(entry.scores.total)}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPlayerResultsView() {
  if (!playerResultsContainer) {
    return;
  }

  if (!revealedResults.length) {
    renderPlayerResultsPlaceholder();
    return;
  }

  const myResult = getMyRevealedResult();
  if (!myResult) {
    playerResultsContainer.innerHTML = `
      <div class="card player-results-empty">
        <div class="card-header text-center">
          <h2>Final Results</h2>
        </div>
        <div class="card-body">
          ${renderPlayerResultsStandings()}
        </div>
      </div>
    `;
    return;
  }

  const isWinner = myResult.rank === 1;
  const physicalAverage = roundResultScore(getPhysicalAverage(myResult.scores));
  const virtualAverage = roundResultScore(getVirtualAverage(myResult.scores.virtualScores));
  const contributionMarkup = myResult.isVirtualTeam ? `
    <div class="player-results-highlight">
      <span>Your virtual cake contribution</span>
      <strong>Physical: ${formatRevealScore(physicalAverage)} + Virtual: ${formatRevealScore(virtualAverage)} = Average: ${formatRevealScore(myResult.scores.total)}</strong>
    </div>
  ` : '';
  const imageMarkup = myResult.cakeImagePath
    ? `<img src="${escapeHtml(myResult.cakeImagePath)}" alt="${escapeHtml(myResult.teamName)} cake">`
    : '<div class="player-results-image-placeholder">No virtual cake render</div>';

  playerResultsContainer.innerHTML = `
    <div class="player-results-shell">
      <article class="player-results-card ${isWinner ? 'is-winner' : 'is-consolation'}">
        ${isWinner ? `<div class="player-results-burst">${buildCelebrationParticles()}</div>` : ''}
        <div class="player-results-body">
          <div class="player-results-topline">
            <div>
              <div class="player-results-rank-pill">#${getOrdinalLabel(myResult.rank)} place</div>
              <h2 class="player-results-title">${escapeHtml(myResult.teamName)}</h2>
              <p class="player-results-copy">${isWinner ? 'You won!' : 'Better luck next time'} ${isWinner ? 'The virtual oven somehow conquered the judges.' : 'Your cake still made the finale and the judges noticed every chaotic choice.'}</p>
            </div>
            <div class="player-results-status-pill ${isWinner ? 'is-winner' : ''}">${isWinner ? 'Champion' : 'Finalist'}</div>
          </div>

          <div class="player-results-layout">
            <div class="player-results-poster">
              ${imageMarkup}
            </div>
            <div style="display:grid; gap: var(--spacing-md);">
              <div class="player-results-score-grid">
                ${[['Taste', myResult.scores.taste], ['Accuracy', myResult.scores.accuracy], ['Creativity', myResult.scores.creativity], ['Total', myResult.scores.total]].map(([label, value]) => `
                  <article class="player-results-score-card">
                    <span>${escapeHtml(label)}</span>
                    <strong>${formatRevealScore(value)}</strong>
                  </article>
                `).join('')}
              </div>
              ${contributionMarkup}
            </div>
          </div>
        </div>
      </article>

      <section class="player-results-standings">
        <h3>Full Standings</h3>
        ${renderPlayerResultsStandings()}
      </section>
    </div>
  `;
}

function showCakeReveal(rawPayload) {
  const payload = normalizeCakeRevealPayload(rawPayload);
  cakeRevealActive = true;
  setActivePhaseSection('results-section');
  phaseText.textContent = 'RESULTS';
  phaseIndicator.className = 'phase-indicator phase-RESULTS';

  if (!launchCakeRevealScene(payload)) {
    restorePhaserContainer();
    renderCakeRevealFallback(payload);
  }
}

function buildBakingBoosts(inventory) {
  const boosts = {};

  (inventory || []).forEach((item) => {
    const key = item?.item_key || item?.key;
    if (!key) {
      return;
    }

    boosts[key] = (boosts[key] || 0) + 1;
  });

  return boosts;
}

function displayMedia(container, media) {
  if (!container) {
    return;
  }

  container.innerHTML = '';

  if (!media || !media.type || !(media.url || media.src)) {
    container.classList.add('hidden');
    return;
  }

  const mediaSource = media.url || media.src;
  let mediaElement = null;

  if (media.type === 'image') {
    mediaElement = document.createElement('img');
    mediaElement.alt = 'Question media';
  } else if (media.type === 'audio') {
    mediaElement = document.createElement('audio');
    mediaElement.controls = true;
  } else if (media.type === 'video') {
    mediaElement = document.createElement('video');
    mediaElement.controls = true;
  }

  if (!mediaElement) {
    container.classList.add('hidden');
    return;
  }

  mediaElement.src = mediaSource;
  container.appendChild(mediaElement);
  container.classList.remove('hidden');
}

function syncMyTeamFromTeams() {
  if (!myTeam) {
    return;
  }

  const match = allTeams.find((team) => (
    (myTeam.id && team.id === myTeam.id) ||
    (!myTeam.id && team.name === myTeam.name)
  ));

  if (!match) {
    return;
  }

  myTeam = { ...myTeam, ...match };
  showTeamDisplay();

  if (currentPhase === 'BAKING') {
    startBakingSession();
  }
}

function normalizeTeam(team) {
  return {
    ...team,
    money: Number(team.money) || 0,
    isVirtual: team.isVirtual === true || team.isVirtual === 1
  };
}

function normalizeTeams(teamList) {
  return [...(teamList || [])]
    .filter(Boolean)
    .map((team) => normalizeTeam(team))
    .sort((left, right) => right.money - left.money);
}

function mergeTeamList(existingTeams, incomingTeams) {
  const mergedById = new Map((existingTeams || []).map((team) => [team.id, { ...team }]));

  (incomingTeams || []).forEach((team) => {
    if (!team || typeof team.id === 'undefined') {
      return;
    }

    const normalized = normalizeTeam(team);
    const existing = mergedById.get(normalized.id) || {};
    mergedById.set(normalized.id, { ...existing, ...normalized });
  });

  return normalizeTeams(Array.from(mergedById.values()));
}

function getCategoryName(questionId) {
  for (const category of currentBoard) {
    if (category.questions.some((question) => question.id === questionId)) {
      return category.name;
    }
  }

  return '';
}

function formatMoney(value) {
  const amount = Number(value) || 0;
  const formatted = Math.abs(amount).toLocaleString();
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatMultilineText(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function showNotification(message, type) {
  const notification = document.createElement('div');
  const normalizedType = type === 'warning' ? 'info' : type;
  const content = document.createElement('span');

  notification.className = `status status-${normalizedType}`;
  notification.style.position = 'fixed';
  notification.style.top = '80px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.zIndex = '9999';
  notification.style.minWidth = '300px';
  content.textContent = message;

  notification.appendChild(content);
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function resetJoinButton() {
  joinTeamBtn.disabled = false;
  joinTeamBtn.textContent = 'Join Game';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== Event Listeners =====

joinTeamBtn.addEventListener('click', () => {
  const name = playerTeamNameInput.value.trim();

  if (!name) {
    showNotification('Please enter a team name', 'error');
    return;
  }

  if (allTeams.some((team) => team.name.toLowerCase() === name.toLowerCase())) {
    showNotification('A team with that name already exists', 'error');
    return;
  }

  myTeam = { name, isVirtual: true };

  socket.emit('join-team', { name, isVirtual: true });

  joinTeamBtn.disabled = true;
  joinTeamBtn.textContent = 'Joining...';
});

if (playerBuzzBtn) {
  playerBuzzBtn.addEventListener('click', () => {
    if (!myTeam || !myTeam.id || !currentQuestionId || playerBuzzBtn.disabled) {
      return;
    }

    buzzPending = true;
    updateBuzzControls();
    socket.emit('trivia:buzz', { teamId: myTeam.id });
  });
}

// Allow Enter key to join
playerTeamNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinTeamBtn.click();
  }
});

// ===== Initialization =====

console.log('Player client initialized');
