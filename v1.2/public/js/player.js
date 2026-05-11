// Evil Jeopardy 1.2 - Player Client Script (virtual player view)

// Initialize Socket.io connection
const socket = io();

// DOM elements
const phaseIndicator = document.getElementById('phase-indicator');
const phaseText = document.getElementById('phase-text');
const connectionStatus = document.getElementById('connection-status');
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

// ===== Socket Event Handlers =====

socket.on('connect', () => {
  console.log('Connected to server');
  updateConnectionStatus('Connected', 'success');

  // Join as player
  socket.emit('join-room', 'player');

  // Request current state
  socket.emit('get-state');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  updateConnectionStatus('Disconnected - Reconnecting...', 'error');
});

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
  currentPhase = data.phase;
  allTeams = normalizeTeams(data.teams || []);

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

function updatePhaseUI(phase) {
  phaseText.textContent = phase;
  phaseIndicator.className = `phase-indicator phase-${phase}`;

  document.querySelectorAll('.phase-section').forEach((section) => {
    section.classList.remove('active');
  });

  const sectionId = `${phase.toLowerCase()}-section`;
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.add('active');
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
