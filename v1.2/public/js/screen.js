// Evil Jeopardy 1.2 - Screen Client Script (for projection display)

const socket = io();

// DOM elements
const phaseIndicator = document.getElementById('phase-indicator');
const phaseText = document.getElementById('phase-text');
const connectionStatus = document.getElementById('connection-status');
const connectionOverlay = document.getElementById('connection-overlay');
const connectionOverlayMessage = connectionOverlay ? connectionOverlay.querySelector('p') : null;
const loadingOverlay = document.getElementById('loading-overlay');
const loadingOverlayMessage = loadingOverlay ? loadingOverlay.querySelector('p') : null;
const teamsList = document.getElementById('teams-list');

// Trivia DOM elements
const screenTriviaModeBadge = document.getElementById('screen-trivia-mode-badge');
const screenTriviaCategory = document.getElementById('screen-trivia-category');
const screenQuestionDisplay = document.getElementById('screen-question-display');
const screenMediaArea = document.getElementById('screen-media-area');
const screenTriviaStatus = document.getElementById('screen-trivia-status');
const screenJeopardyPanel = document.getElementById('screen-jeopardy-panel');
const screenJeopardyBoard = document.getElementById('screen-jeopardy-board');
const screenTriviaScoreboard = document.getElementById('screen-trivia-scoreboard');
const screenBuzzStatus = document.getElementById('screen-buzz-status');
const screenAnswerStatus = document.getElementById('screen-answer-status');

// Shop DOM elements
const screenShopCatalog = document.getElementById('screen-shop-catalog');
const screenShopTeams = document.getElementById('screen-shop-teams');
const screenShopActivity = document.getElementById('screen-shop-activity');
const screenShopLiveBanner = document.getElementById('screen-shop-live-banner');

// Baking DOM elements
const screenBakingTimer = document.getElementById('screen-baking-timer');
const screenBakingPhase = document.getElementById('screen-baking-phase');
const screenBakingProgress = document.getElementById('screen-baking-progress');
const screenBakingScoreboard = document.getElementById('screen-baking-scoreboard');
const screenBakingChaos = document.getElementById('screen-baking-chaos');
const screenCakeReveal = document.getElementById('screen-cake-reveal');
const screenCakeRevealTitle = document.querySelector('.screen-cake-reveal-title');
const screenCakeRevealImage = document.getElementById('screen-cake-reveal-image');
const screenCakeRevealScores = document.getElementById('screen-cake-reveal-scores');
const screenCakeRevealChaos = document.getElementById('screen-cake-reveal-chaos');
const screenResultsContainer = document.getElementById('results-container');

// State
let currentPhase = 'LOBBY';
let teams = [];
let currentTriviaMode = 'SLIDE';
let currentQuestion = null;
let currentQuestionId = null;
let currentBoard = [];
let latestBuzz = null;
let latestAnswerResult = null;
let shopCatalog = null;
let shopItemsByKey = new Map();
let shopInventories = {};
let shopActivities = [];
let pendingShopContext = null;
let activeShopItemKey = null;
let shopHighlightTimer = null;
let shopBannerTimer = null;
let cakeRevealTimers = [];
let bakingState = {
  teamId: null,
  minigames: [],
  currentPhaseIndex: 0,
  totalPhases: 6,
  timeRemaining: 300,
  scoreboard: [],
  chaosLog: []
};
let revealedResults = [];
let resultsRevealTimers = [];
let hasConnectedOnce = false;
let phaseTransitionTimer = null;

// ===== Socket Event Handlers =====

socket.on('connect', () => {
  console.log('Connected to server');
  hideConnectionOverlay();
  updateConnectionStatus('Connected', 'success');

  if (!hasConnectedOnce) {
    hasConnectedOnce = true;
    socket.emit('join-room', 'screen');
    showLoadingOverlay('Loading latest show state...');
    socket.emit('get-state');
  }
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  hideLoadingOverlay();
  showConnectionOverlay('Connection lost. Reconnecting...');
  updateConnectionStatus('Disconnected', 'error');
});

function handleReconnect() {
  hideConnectionOverlay();
  updateConnectionStatus('Connected', 'success');
  showLoadingOverlay('Connection restored. Syncing current state...');
  socket.emit('join-room', 'screen');
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
  teams = normalizeTeams(data.teams || []);

  if (data.baking) {
    bakingState = normalizeBakingState({ ...bakingState, ...data.baking });
  }

  updatePhaseUI(data.phase);
  renderTeamsList();
  renderTriviaScoreboard();
  renderCurrentQuestion();
  renderStatusPanels();
  renderShopDisplay();
  renderBakingDisplay();
});

socket.on('teams-updated', (updatedTeams) => {
  console.log('Teams updated:', updatedTeams);
  teams = mergeTeamList(teams, updatedTeams);
  renderTeamsList();
  renderTriviaScoreboard();
  renderShopTeams();
  renderBakingDisplay();
});

socket.on('error', (error) => {
  console.error('Server error:', error);
  hideLoadingOverlay();
});

// ===== TRIVIA EVENT HANDLERS =====

socket.on('trivia:question-shown', (data) => {
  console.log('Question shown:', data);
  currentQuestion = data.question || null;
  currentQuestionId = currentQuestion ? currentQuestion.id : null;
  currentTriviaMode = data.mode || currentTriviaMode;
  latestBuzz = null;
  latestAnswerResult = null;

  renderTriviaMode();
  renderCurrentQuestion();
  renderStatusPanels();
});

socket.on('trivia:scores-updated', (scoreboard) => {
  console.log('Scores updated:', scoreboard);
  teams = mergeTeamList(teams, scoreboard);
  renderTriviaScoreboard();
  renderShopTeams();
});

socket.on('trivia:buzz-received', (data) => {
  console.log('Buzz received:', data);
  latestBuzz = data;
  latestAnswerResult = null;
  renderStatusPanels();
});

socket.on('trivia:answer-result', (data) => {
  console.log('Answer result:', data);
  latestAnswerResult = data;
  latestBuzz = null;

  teams = normalizeTeams(
    teams.map((team) => team.id === data.teamId ? { ...team, money: data.newBalance } : team)
  );

  renderTriviaScoreboard();
  renderStatusPanels();
  renderShopTeams();
});

socket.on('trivia:mode-changed', (data) => {
  console.log('Mode changed:', data);
  currentTriviaMode = data.mode || 'SLIDE';
  renderTriviaMode();
  renderStatusPanels();
});

socket.on('trivia:board-state', (board) => {
  console.log('Board state:', board);
  currentBoard = Array.isArray(board) ? board : [];
  renderJeopardyBoard();
  renderCategoryBadge();
});

// ===== SHOP EVENT HANDLERS =====

socket.on('shop:catalog', (data) => {
  console.log('Shop catalog:', data);
  shopCatalog = data || { categories: [], defaultKit: [] };
  shopItemsByKey = buildShopItemIndex(shopCatalog);
  shopInventories = normalizeShopCollections(shopCatalog.inventories);

  if (Array.isArray(shopCatalog.teams) && shopCatalog.teams.length > 0) {
    teams = normalizeTeams(shopCatalog.teams);
  }

  seedShopActivity(shopCatalog.purchaseHistories || {});
  renderShopDisplay();
});

socket.on('shop:purchase-result', (teamId, result) => {
  console.log('Shop purchase result:', teamId, result);

  if (typeof result.newBalance === 'number') {
    teams = normalizeTeams(
      teams.map((team) => team.id === teamId ? { ...team, money: result.newBalance } : team)
    );
  }

  if (result.success) {
    pendingShopContext = null;
    const approvalText = result.approvedByOverride ? 'with host override' : 'successfully';
    addShopActivity({
      status: result.approvedByOverride ? 'override' : 'success',
      title: `${getTeamName(teamId)} bought ${result.itemName || result.itemKey}`,
      copy: `${approvalText} for ${formatMoney(result.price)}. New balance: ${formatMoney(result.newBalance)}.`
    });
    showShopBanner(`${getTeamName(teamId)} bought ${result.itemName || result.itemKey}`, result.approvedByOverride ? 'override' : 'success');
    flashShopItem(result.itemKey);
  } else {
    pendingShopContext = {
      teamId,
      itemKey: result.itemKey,
      itemName: result.itemName || result.itemKey,
      price: result.price
    };
    showShopBanner(`${getTeamName(teamId)} is attempting ${result.itemName || result.itemKey}`, 'pending');
    flashShopItem(result.itemKey, true);
  }

  renderShopCatalog();
  renderShopTeams();
  renderShopActivity();
});

socket.on('shop:team-inventory-updated', (teamId, inventory) => {
  console.log('Team inventory updated:', teamId, inventory);
  shopInventories[String(teamId)] = Array.isArray(inventory) ? inventory : [];
  renderShopTeams();
});

socket.on('shop:warning', (teamId, message) => {
  console.log('Shop warning:', teamId, message);
  const itemName = pendingShopContext && pendingShopContext.teamId === teamId
    ? pendingShopContext.itemName
    : 'their selected item';

  addShopActivity({
    status: 'pending',
    title: `${getTeamName(teamId)} needs approval`,
    copy: `${itemName}: ${message}`
  });
  showShopBanner(`${getTeamName(teamId)} needs host override`, 'pending');
  renderShopActivity();
  renderShopCatalog();
});

// ===== BAKING EVENT HANDLERS =====

socket.on('baking:started', (payload) => {
  console.log('Baking started:', payload);
  bakingState = normalizeBakingState({ ...bakingState, ...payload });
  renderBakingDisplay();
});

socket.on('baking:minigame-selections', (payload) => {
  console.log('Baking selections:', payload);
  bakingState = normalizeBakingState({ ...bakingState, ...payload });
  renderBakingDisplay();
});

socket.on('baking:timer-tick', ({ timeRemaining }) => {
  bakingState.timeRemaining = Number(timeRemaining) || 0;
  renderBakingDisplay();
});

socket.on('baking:paused', ({ timeRemaining }) => {
  bakingState = normalizeBakingState({ ...bakingState, timeRemaining });
  renderBakingDisplay();
});

socket.on('baking:resumed', ({ timeRemaining }) => {
  bakingState = normalizeBakingState({ ...bakingState, timeRemaining });
  renderBakingDisplay();
});

socket.on('baking:phase-completed', (payload) => {
  console.log('Baking phase completed:', payload);
  bakingState = normalizeBakingState({
    ...bakingState,
    currentPhaseIndex: typeof payload.currentPhaseIndex === 'number' ? payload.currentPhaseIndex : bakingState.currentPhaseIndex,
    scoreboard: payload.scoreboard || bakingState.scoreboard
  });
  renderBakingDisplay();
});

socket.on('baking:chaos-event', (payload) => {
  console.log('Baking chaos event:', payload);
  bakingState.chaosLog = [...(bakingState.chaosLog || []), payload].slice(-8);
  renderBakingDisplay();
});

socket.on('baking:time-up', () => {
  bakingState.timeRemaining = 0;
  renderBakingDisplay();
});

socket.on('results:cake-reveal', (payload) => {
  startCakeReveal(payload);
});

socket.on('results:reveal', (results) => {
  revealedResults = normalizeRevealedResults(results);
  currentPhase = 'RESULTS';
  hideCakeReveal();
  updatePhaseUI('RESULTS');
  startResultsRevealSequence();
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

function updatePhaseUI(phase) {
  phaseText.textContent = phase;
  phaseIndicator.className = `phase-indicator phase-${phase}`;
  setActivePhaseSection(`${phase.toLowerCase()}-section`);

  if (phase !== 'RESULTS') {
    clearResultsRevealSequence();
  }

  if (!['JUDGING', 'RESULTS'].includes(phase)) {
    hideCakeReveal();
  }

  if (phase === 'TRIVIA') {
    initializeTriviaDisplay();
  } else if (phase === 'SHOP') {
    initializeShopDisplay();
  } else if (phase === 'BAKING') {
    clearShopBanner();
    initializeBakingDisplay();
  } else if (phase === 'RESULTS') {
    clearShopBanner();
    initializeResultsDisplay();
  } else {
    clearShopBanner();
  }
}

function initializeTriviaDisplay() {
  renderTriviaMode();
  renderTriviaScoreboard();
  renderJeopardyBoard();
  renderCurrentQuestion();
  renderStatusPanels();
}

function initializeShopDisplay() {
  renderShopDisplay();
}

function initializeResultsDisplay() {
  if (!revealedResults.length) {
    renderResultsPlaceholder();
  }
}

function renderResultsPlaceholder() {
  if (!screenResultsContainer) {
    return;
  }

  screenResultsContainer.innerHTML = `
    <div class="screen-results-shell screen-results-shell-empty">
      <p class="screen-results-kicker">Final Ceremony</p>
      <h2 class="screen-results-headline">Awaiting the host's dramatic reveal...</h2>
      <p class="screen-results-subtitle">The podium is set. The frosting panic is eternal.</p>
    </div>
  `;
}

function renderTeamsList() {
  if (teams.length === 0) {
    teamsList.innerHTML = `
      <li class="text-muted text-center" style="font-size: 1.5rem;">
        No teams connected yet
      </li>
    `;
    return;
  }

  teamsList.innerHTML = teams.map((team) => `
    <li class="team-item">
      <div>
        <span class="team-name">${escapeHtml(team.name)}</span>
        ${team.isVirtual ? '<span class="team-badge virtual">Virtual</span>' : '<span class="team-badge physical">Physical</span>'}
      </div>
    </li>
  `).join('');
}

function renderTriviaMode() {
  if (screenTriviaModeBadge) {
    screenTriviaModeBadge.textContent = currentTriviaMode === 'JEOPARDY' ? 'Jeopardy Board' : 'Slide Round';
  }

  if (screenJeopardyPanel) {
    screenJeopardyPanel.classList.toggle('hidden', currentTriviaMode !== 'JEOPARDY');
  }

  renderCategoryBadge();
}

function renderTriviaScoreboard() {
  if (!screenTriviaScoreboard) {
    return;
  }

  if (teams.length === 0) {
    screenTriviaScoreboard.innerHTML = '<div class="text-muted text-center">Waiting for teams...</div>';
    return;
  }

  screenTriviaScoreboard.innerHTML = normalizeTeams(teams).map((team) => `
    <div class="score-card">
      <div class="score-team">${escapeHtml(team.name)}</div>
      <div class="score-value">${formatMoney(team.money)}</div>
    </div>
  `).join('');
}

function renderCurrentQuestion() {
  if (!screenQuestionDisplay) {
    return;
  }

  if (!currentQuestion) {
    screenQuestionDisplay.innerHTML = '<p class="text-muted text-center">Waiting for host to reveal a question...</p>';
    displayMedia(screenMediaArea, null);
    renderCategoryBadge();
    return;
  }

  const valueMarkup = typeof currentQuestion.value === 'number'
    ? `<div class="screen-question-meta">Value: ${formatMoney(currentQuestion.value)}</div>`
    : '';

  screenQuestionDisplay.innerHTML = `
    <div class="screen-question-copy">${formatMultilineText(currentQuestion.question || '')}</div>
    ${valueMarkup}
  `;

  displayMedia(screenMediaArea, currentQuestion.media);
  renderCategoryBadge();
}

function renderCategoryBadge() {
  if (!screenTriviaCategory) {
    return;
  }

  const categoryName = currentTriviaMode === 'JEOPARDY' && currentQuestionId
    ? getCategoryName(currentQuestionId)
    : '';

  if (!categoryName) {
    screenTriviaCategory.classList.add('hidden');
    screenTriviaCategory.textContent = '';
    return;
  }

  screenTriviaCategory.classList.remove('hidden');
  screenTriviaCategory.textContent = categoryName;
}

function renderJeopardyBoard() {
  if (!screenJeopardyBoard) {
    return;
  }

  if (!currentBoard.length) {
    screenJeopardyBoard.innerHTML = '<p class="text-muted text-center">Board will appear when Jeopardy mode starts.</p>';
    return;
  }

  let html = '';

  currentBoard.forEach((category) => {
    html += `<div class="jeopardy-category">${escapeHtml(category.name)}</div>`;
  });

  const maxQuestions = Math.max(...currentBoard.map((category) => category.questions.length));

  for (let rowIndex = 0; rowIndex < maxQuestions; rowIndex += 1) {
    currentBoard.forEach((category) => {
      const question = category.questions[rowIndex];
      if (!question) {
        html += '<div class="jeopardy-cell blank-cell" aria-hidden="true"></div>';
        return;
      }

      const valueText = typeof question.value === 'number'
        ? formatMoney(question.value)
        : escapeHtml(String(question.value || ''));

      html += `<div class="jeopardy-cell ${question.answered ? 'answered' : ''}">${valueText}</div>`;
    });
  }

  screenJeopardyBoard.innerHTML = html;
}

function renderStatusPanels() {
  if (screenTriviaStatus) {
    screenTriviaStatus.textContent = getQuestionStatusText();
  }

  if (screenBuzzStatus) {
    screenBuzzStatus.textContent = latestBuzz
      ? `${getBuzzTeamName()} buzzed in first.`
      : (currentQuestionId ? 'Waiting for someone to buzz.' : 'No buzz received yet.');
  }

  if (screenAnswerStatus) {
    screenAnswerStatus.textContent = latestAnswerResult
      ? `${getTeamName(latestAnswerResult.teamId)} answered ${latestAnswerResult.correct ? 'correctly' : 'incorrectly'} (${formatMoney(latestAnswerResult.newBalance)}).`
      : 'No answer scored yet.';
  }
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

function getQuestionStatusText() {
  if (!currentQuestionId) {
    return 'Waiting for host to reveal a question.';
  }

  if (latestAnswerResult) {
    return `${getTeamName(latestAnswerResult.teamId)} answered ${latestAnswerResult.correct ? 'correctly' : 'incorrectly'}.`;
  }

  if (latestBuzz) {
    return `${getBuzzTeamName()} buzzed in.`;
  }

  return currentTriviaMode === 'JEOPARDY'
    ? 'Jeopardy question live on the board.'
    : 'Slide question live on screen.';
}

function getTeamName(teamId) {
  const team = teams.find((entry) => entry.id === teamId);
  return team ? team.name : `Team ${teamId}`;
}

function getBuzzTeamName() {
  if (!latestBuzz) {
    return 'A team';
  }

  return latestBuzz.teamName || getTeamName(latestBuzz.teamId);
}

function getCategoryName(questionId) {
  for (const category of currentBoard) {
    if (category.questions.some((question) => question.id === questionId)) {
      return category.name;
    }
  }

  return '';
}

// ===== SHOP UI FUNCTIONS =====

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

function seedShopActivity(purchaseHistories) {
  const flattened = [];

  Object.entries(purchaseHistories || {}).forEach(([teamId, purchases]) => {
    (purchases || []).forEach((purchase) => {
      flattened.push({ teamId: Number(teamId), purchase });
    });
  });

  flattened.sort((left, right) => {
    const leftTime = new Date(left.purchase.created_at || 0).getTime();
    const rightTime = new Date(right.purchase.created_at || 0).getTime();
    return rightTime - leftTime;
  });

  shopActivities = flattened.slice(0, 6).map(({ teamId, purchase }) => ({
    id: `history-${purchase.id}`,
    status: 'history',
    title: `${getTeamName(teamId)} bought ${getShopItemName(purchase.item_key)}`,
    copy: `${formatMoney(purchase.price)} • ${getShopCategoryName(purchase.item_key, purchase.category)}`,
    timestamp: Date.now() - 5000
  }));
}

function renderShopDisplay() {
  renderShopCatalog();
  renderShopTeams();
  renderShopActivity();
}

function renderShopCatalog() {
  if (!screenShopCatalog) {
    return;
  }

  if (!shopCatalog || !Array.isArray(shopCatalog.categories) || shopCatalog.categories.length === 0) {
    screenShopCatalog.innerHTML = `
      <div class="card">
        <div class="card-body">
          <p class="text-muted text-center">Waiting for host to open the shop...</p>
        </div>
      </div>
    `;
    return;
  }

  screenShopCatalog.innerHTML = shopCatalog.categories.map((category) => `
    <section class="screen-shop-category">
      <h3>${escapeHtml(category.name)}</h3>
      ${category.description ? `<p class="text-muted" style="font-size: 1.1rem;">${escapeHtml(category.description)}</p>` : ''}
      <div class="screen-shop-items">
        ${(category.items || []).map((item) => {
          const meta = buildShopItemMeta(item);
          const isPending = pendingShopContext && pendingShopContext.itemKey === item.key;
          const liveClass = activeShopItemKey === item.key ? 'is-live' : '';
          return `
            <article class="screen-shop-item ${liveClass} ${isPending ? 'pending' : ''}">
              <div class="screen-shop-item-header">
                <div>
                  <h4>${escapeHtml(item.name)}</h4>
                  ${item.description ? `<p class="text-muted">${escapeHtml(item.description)}</p>` : ''}
                </div>
                <span class="screen-shop-item-price">${formatMoney(item.price)}</span>
              </div>
              ${meta ? `<div class="screen-shop-meta">${escapeHtml(meta)}</div>` : ''}
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `).join('');
}

function renderShopTeams() {
  if (!screenShopTeams) {
    return;
  }

  if (!teams.length) {
    screenShopTeams.innerHTML = '<div class="text-muted text-center">Waiting for teams...</div>';
    return;
  }

  screenShopTeams.innerHTML = teams.map((team) => {
    const inventoryCount = (shopInventories[String(team.id)] || []).length;
    return `
      <div class="score-card">
        <div class="score-team">${escapeHtml(team.name)}</div>
        <div class="score-value">${formatMoney(team.money)}</div>
        <div class="screen-shop-team-meta">${inventoryCount} item${inventoryCount === 1 ? '' : 's'} purchased</div>
      </div>
    `;
  }).join('');
}

function renderShopActivity() {
  if (!screenShopActivity) {
    return;
  }

  if (!shopActivities.length) {
    screenShopActivity.innerHTML = '<div class="text-muted text-center">Purchases will animate here in real time.</div>';
    return;
  }

  screenShopActivity.innerHTML = shopActivities.map((entry) => `
    <article class="screen-shop-activity-item ${entry.status} ${Date.now() - entry.timestamp < 3000 ? 'is-new' : ''}">
      <div class="screen-shop-activity-title">${escapeHtml(entry.title)}</div>
      <div class="screen-shop-activity-copy">${escapeHtml(entry.copy)}</div>
    </article>
  `).join('');
}

function addShopActivity(entry) {
  shopActivities = [
    {
      id: `shop-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: Date.now(),
      ...entry
    },
    ...shopActivities
  ].slice(0, 8);
}

function getShopItemName(itemKey) {
  const item = shopItemsByKey.get(itemKey);
  return item ? item.name : itemKey;
}

function getShopCategoryName(itemKey, fallbackCategory) {
  const item = shopItemsByKey.get(itemKey);
  return item ? item.categoryName : (fallbackCategory || 'Shop Item');
}

function flashShopItem(itemKey, keepPending = false) {
  activeShopItemKey = itemKey || null;

  if (shopHighlightTimer) {
    clearTimeout(shopHighlightTimer);
  }

  shopHighlightTimer = setTimeout(() => {
    activeShopItemKey = keepPending && pendingShopContext ? pendingShopContext.itemKey : null;
    renderShopCatalog();
  }, 2200);

  renderShopCatalog();
}

function showShopBanner(message, variant = 'success') {
  if (!screenShopLiveBanner) {
    return;
  }

  screenShopLiveBanner.textContent = message;
  screenShopLiveBanner.className = `screen-shop-live-banner ${variant}`;
  screenShopLiveBanner.classList.remove('hidden');

  if (shopBannerTimer) {
    clearTimeout(shopBannerTimer);
  }

  shopBannerTimer = setTimeout(() => {
    clearShopBanner();
  }, 4000);
}

function clearShopBanner() {
  if (!screenShopLiveBanner) {
    return;
  }

  screenShopLiveBanner.textContent = '';
  screenShopLiveBanner.className = 'screen-shop-live-banner hidden';
}

// ===== BAKING UI FUNCTIONS =====

function normalizeBakingState(data = {}) {
  return {
    teamId: Number(data.teamId) || bakingState.teamId || null,
    minigames: Array.isArray(data.minigames) ? data.minigames : bakingState.minigames,
    currentPhaseIndex: typeof data.currentPhaseIndex === 'number' ? data.currentPhaseIndex : (bakingState.currentPhaseIndex || 0),
    totalPhases: Number(data.totalPhases) || (Array.isArray(data.minigames) ? data.minigames.length : bakingState.totalPhases || 6),
    timeRemaining: typeof data.timeRemaining === 'number' ? data.timeRemaining : (bakingState.timeRemaining || 0),
    scoreboard: Array.isArray(data.scoreboard) ? data.scoreboard : bakingState.scoreboard,
    chaosLog: Array.isArray(data.chaosLog) ? data.chaosLog : bakingState.chaosLog
  };
}

function initializeBakingDisplay() {
  renderBakingDisplay();
}

function renderBakingDisplay() {
  if (screenBakingTimer) {
    screenBakingTimer.textContent = formatBakingTime(bakingState.timeRemaining || 0);
  }

  const currentSelection = bakingState.minigames[bakingState.currentPhaseIndex] || null;
  if (screenBakingPhase) {
    screenBakingPhase.textContent = currentSelection
      ? (currentSelection.phaseName || currentSelection.phase.toUpperCase())
      : (bakingState.timeRemaining === 0 && bakingState.scoreboard.length ? 'Bake Complete' : 'Waiting to start');
  }

  if (screenBakingProgress) {
    const phaseNumber = Math.min((bakingState.currentPhaseIndex || 0) + (currentSelection ? 1 : 0), bakingState.totalPhases || 6);
    screenBakingProgress.textContent = `Phase ${phaseNumber} of ${bakingState.totalPhases || 6}`;
  }

  renderBakingScoreboard();
  renderBakingChaosFeed();
}

function renderBakingScoreboard() {
  if (!screenBakingScoreboard) {
    return;
  }

  if (!Array.isArray(bakingState.scoreboard) || !bakingState.scoreboard.length) {
    screenBakingScoreboard.innerHTML = '<div class="text-muted text-center">Virtual baking scores will appear here.</div>';
    return;
  }

  screenBakingScoreboard.innerHTML = bakingState.scoreboard.map((entry) => `
    <div class="score-card">
      <div class="score-team">${escapeHtml(entry.teamName)}</div>
      <div class="score-value">${Math.round(entry.totalScore || 0)}</div>
      <div class="screen-shop-team-meta">${Object.keys(entry.phases || {}).length} phases scored</div>
    </div>
  `).join('');
}

function renderBakingChaosFeed() {
  if (!screenBakingChaos) {
    return;
  }

  if (!Array.isArray(bakingState.chaosLog) || !bakingState.chaosLog.length) {
    screenBakingChaos.innerHTML = '<div class="text-muted text-center">Chaos alerts will slam onto the screen here.</div>';
    return;
  }

  screenBakingChaos.innerHTML = [...bakingState.chaosLog].reverse().map((event) => `
    <article class="screen-baking-chaos-card">
      <div class="screen-shop-activity-title">${escapeHtml(event.name || 'Chaos event')}</div>
      <div class="screen-shop-activity-copy">${escapeHtml(event.description || 'Something unfair happened.')} · ${escapeHtml((event.phaseName || event.phaseKey || 'ANY').toUpperCase())}</div>
    </article>
  `).join('');
}

function formatBakingTime(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function clearCakeRevealTimers() {
  cakeRevealTimers.forEach((timerId) => clearTimeout(timerId));
  cakeRevealTimers = [];
}

function hideCakeReveal() {
  clearCakeRevealTimers();
  if (!screenCakeReveal) {
    return;
  }

  screenCakeReveal.classList.remove('is-active', 'is-open');
  screenCakeReveal.classList.add('hidden');
}

function formatRevealScore(value) {
  const numeric = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function renderCakeRevealScores(scores = {}) {
  if (!screenCakeRevealScores) {
    return;
  }

  const entries = [
    ['Taste', scores.taste],
    ['Accuracy', scores.accuracy],
    ['Creativity', scores.creativity],
    ['Total', scores.total]
  ];

  screenCakeRevealScores.innerHTML = entries.map(([label, value]) => `
    <article class="screen-cake-score-card">
      <span>${escapeHtml(label)}</span>
      <strong>${formatRevealScore(value)}</strong>
    </article>
  `).join('');
}

function renderCakeRevealChaos(chaosEvents = []) {
  if (!screenCakeRevealChaos) {
    return;
  }

  if (!Array.isArray(chaosEvents) || !chaosEvents.length) {
    screenCakeRevealChaos.innerHTML = '<article class="screen-cake-chaos-item"><span>Chaos Summary</span><strong>No kitchen disasters survived the edit.</strong></article>';
    return;
  }

  screenCakeRevealChaos.innerHTML = chaosEvents.slice(-4).map((event) => `
    <article class="screen-cake-chaos-item">
      <span>${escapeHtml(event.phaseName || event.title || 'Chaos Summary')}</span>
      <strong>${escapeHtml(event.description || event.title || 'Something unfair happened.')}</strong>
    </article>
  `).join('');
}

function startCakeReveal(payload = {}) {
  if (!screenCakeReveal || !screenCakeRevealImage) {
    return;
  }

  clearCakeRevealTimers();
  renderCakeRevealScores(payload.scores || {});
  renderCakeRevealChaos(payload.chaosEvents || []);
  if (screenCakeRevealTitle) {
    screenCakeRevealTitle.textContent = 'Your cake is ready...';
  }
  screenCakeRevealImage.src = payload.cakeImagePath || '';
  screenCakeReveal.classList.remove('hidden', 'is-open');
  screenCakeReveal.classList.add('is-active');
  phaseText.textContent = 'RESULTS';
  phaseIndicator.className = 'phase-indicator phase-RESULTS';

  cakeRevealTimers.push(setTimeout(() => {
    screenCakeReveal.classList.add('is-open');
  }, 2000));

  cakeRevealTimers.push(setTimeout(() => {
    hideCakeReveal();
  }, 18000));
}

function clearResultsRevealSequence() {
  resultsRevealTimers.forEach((timerId) => clearTimeout(timerId));
  resultsRevealTimers = [];
}

function normalizeRevealedResults(results) {
  return [...(results || [])]
    .filter(Boolean)
    .map((entry) => ({
      ...entry,
      rank: Number(entry.rank) || 0,
      teamId: Number(entry.teamId) || 0,
      isVirtualTeam: Boolean(entry.isVirtualTeam),
      cakeImagePath: entry.cakeImagePath || '',
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

function roundScore(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function averageScore(values) {
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

  return averageScore([virtualScores.taste, virtualScores.accuracy, virtualScores.creativity]);
}

function getPhysicalAverage(scores = {}) {
  if (typeof scores.physicalAverage === 'number' && scores.physicalAverage > 0) {
    return scores.physicalAverage;
  }

  return averageScore([scores.taste, scores.accuracy, scores.creativity]);
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

function startResultsRevealSequence() {
  if (!screenResultsContainer) {
    return;
  }

  clearResultsRevealSequence();

  if (!revealedResults.length) {
    renderResultsPlaceholder();
    return;
  }

  const revealOrder = [...revealedResults].sort((left, right) => right.rank - left.rank);
  renderResultsRevealBoard(revealOrder);

  revealOrder.forEach((entry, index) => {
    const delay = 2000 + (index * 3000);
    resultsRevealTimers.push(setTimeout(() => {
      const card = screenResultsContainer.querySelector(`[data-team-id="${entry.teamId}"]`);
      if (!card) {
        return;
      }

      card.classList.add('is-visible');
      if (entry.rank === 1) {
        card.classList.add('is-winner');
        createWinnerParticles(card.querySelector('.screen-results-particles'));
      }
    }, delay));
  });
}

function renderResultsRevealBoard(revealOrder) {
  screenResultsContainer.innerHTML = `
    <div class="screen-results-shell">
      <div class="screen-results-podium">
        <header>
          <p class="screen-results-kicker">Final Ceremony</p>
          <h2 class="screen-results-headline">The judges have decided.</h2>
          <p class="screen-results-subtitle">One by one, the cakes rise from the wreckage. The dramatic reveal runs from the bottom of the podium to the top.</p>
        </header>
        ${revealOrder.map((entry) => buildResultCardMarkup(entry)).join('')}
      </div>
    </div>
  `;
}

function buildResultCardMarkup(entry) {
  const physicalAverage = roundScore(getPhysicalAverage(entry.scores));
  const virtualAverage = roundScore(getVirtualAverage(entry.scores.virtualScores));
  const scoreCards = [
    ['Taste', entry.scores.taste],
    ['Accuracy', entry.scores.accuracy],
    ['Creativity', entry.scores.creativity],
    ['Total', entry.scores.total]
  ].map(([label, value]) => `
    <article class="screen-result-score">
      <span>${escapeHtml(label)}</span>
      <strong>${formatRevealScore(value)}</strong>
    </article>
  `).join('');
  const formulaMarkup = entry.isVirtualTeam ? `
    <div class="screen-result-formula">
      <span>Your hybrid judging formula</span>
      <strong>Physical: ${formatRevealScore(physicalAverage)} + Virtual: ${formatRevealScore(virtualAverage)} = Average: ${formatRevealScore(entry.scores.total)}</strong>
    </div>
  ` : '';
  const winnerMarkup = entry.rank === 1 ? '<div class="screen-result-winner-label">WINNER!</div>' : '';
  const imageMarkup = entry.cakeImagePath
    ? `<img src="${escapeHtml(entry.cakeImagePath)}" alt="${escapeHtml(entry.teamName)} cake">`
    : '<div class="screen-result-image-placeholder">No virtual cake render</div>';

  return `
    <article class="screen-result-card rank-${entry.rank}" data-team-id="${entry.teamId}">
      <div class="screen-results-particles"></div>
      <div class="screen-result-poster">
        <div class="screen-result-rank">#${getOrdinalLabel(entry.rank)}</div>
        ${imageMarkup}
      </div>
      <div class="screen-result-copy">
        <div class="screen-result-title-row">
          <div>
            <div class="screen-result-meta">${entry.isVirtualTeam ? 'Virtual hybrid finalist' : 'Physical finalist'}</div>
            <h3 class="screen-result-team">${escapeHtml(entry.teamName)}</h3>
          </div>
          <div class="screen-result-total">
            <span>Final total</span>
            <strong>${formatRevealScore(entry.scores.total)}</strong>
          </div>
        </div>
        ${winnerMarkup}
        <div class="screen-result-grid">${scoreCards}</div>
        ${formulaMarkup}
      </div>
    </article>
  `;
}

function buildWinnerParticles() {
  return Array.from({ length: 20 }, (_, index) => {
    const hue = [42, 352, 198, 24][index % 4];
    const left = (index * 5) % 100;
    const drift = ((index % 2 === 0 ? 1 : -1) * (18 + ((index * 7) % 26)));
    const delay = (index % 6) * 0.18;
    return `<span style="left:${left}%; background:hsl(${hue} 95% 70%); animation-delay:${delay}s; --drift:${drift}px;"></span>`;
  }).join('');
}

function createWinnerParticles(container) {
  if (!container) {
    return;
  }

  container.innerHTML = buildWinnerParticles();
}

function normalizeTeams(teamList) {
  return [...(teamList || [])]
    .filter(Boolean)
    .map((team) => ({
      ...team,
      money: Number(team.money) || 0,
      isVirtual: team.isVirtual === true || team.isVirtual === 1
    }))
    .sort((left, right) => right.money - left.money || left.id - right.id);
}

function mergeTeamList(existingTeams, incomingTeams) {
  const mergedById = new Map((existingTeams || []).map((team) => [team.id, { ...team }]));

  (incomingTeams || []).forEach((team) => {
    if (!team || typeof team.id === 'undefined') {
      return;
    }

    const existing = mergedById.get(team.id) || {};
    mergedById.set(team.id, {
      ...existing,
      ...team,
      money: Number(team.money ?? existing.money) || 0,
      isVirtual: team.isVirtual === true || team.isVirtual === 1 || existing.isVirtual === true || existing.isVirtual === 1
    });
  });

  return normalizeTeams(Array.from(mergedById.values()));
}

function formatMoney(value) {
  const amount = Number(value) || 0;
  const formatted = Math.abs(amount).toLocaleString();
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatMultilineText(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

console.log('Screen client initialized');
