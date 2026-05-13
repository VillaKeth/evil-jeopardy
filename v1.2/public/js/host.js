// Evil Jeopardy 1.2 - Host Client Script

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
const teamNameInput = document.getElementById('team-name');
const teamVirtualCheckbox = document.getElementById('team-virtual');
const addTeamBtn = document.getElementById('add-team-btn');
const startGameBtn = document.getElementById('start-game-btn');
const openShopBtn = document.getElementById('open-shop-btn');

// Trivia DOM elements
const triviaScoreboard = document.getElementById('trivia-scoreboard');
const triviaModeToggle = document.getElementById('trivia-mode-toggle');
const triviaCurrentMode = document.getElementById('trivia-current-mode');
const slideModeSection = document.getElementById('slide-mode-section');
const jeopardyModeSection = document.getElementById('jeopardy-mode-section');

// Slide mode elements
const slideQuestionDisplay = document.getElementById('slide-question-display');
const hostAnswerReveal = document.getElementById('host-answer-reveal');
const slideMediaArea = document.getElementById('slide-media-area');
const nextSlideBtn = document.getElementById('next-slide-btn');
const slideTeamAnswers = document.getElementById('slide-team-answers');
const forceAnswerBtn = document.getElementById('force-answer-btn');

// Jeopardy mode elements
const jeopardyBoard = document.getElementById('jeopardy-board');
const jeopardyQuestionCard = document.getElementById('jeopardy-question-card');
const jeopardyQuestionDisplay = document.getElementById('jeopardy-question-display');
const jeopardyMediaArea = document.getElementById('jeopardy-media-area');
const jeopardyAnswersCard = document.getElementById('jeopardy-answers-card');
const jeopardyTeamAnswers = document.getElementById('jeopardy-team-answers');
const forceAnswerJeopardyBtn = document.getElementById('force-answer-jeopardy-btn');

// Shop DOM elements
const shopTeamSelect = document.getElementById('shop-team-select');
const shopTeamBalance = document.getElementById('shop-team-balance');
const shopCatalogContainer = document.getElementById('shop-catalog');
let shopPurchaseRequests = document.getElementById('shop-purchase-requests');
const shopSelectedTeamName = document.getElementById('shop-selected-team-name');
const shopTeamInventory = document.getElementById('shop-team-inventory');
const shopTeamHistory = document.getElementById('shop-team-history');
const closeShopBtn = document.getElementById('close-shop-btn');
const shopWarningModal = document.getElementById('shop-warning-modal');
const shopWarningTitle = document.getElementById('shop-warning-title');
const shopWarningCopy = document.getElementById('shop-warning-copy');
const shopOverrideBtn = document.getElementById('shop-override-btn');
const shopWarningCancelBtn = document.getElementById('shop-warning-cancel-btn');

// Baking DOM elements
const bakingDurationInput = document.getElementById('baking-duration-input');
const startBakingBtn = document.getElementById('start-baking-btn');
const pauseBakingBtn = document.getElementById('pause-baking-btn');
const resumeBakingBtn = document.getElementById('resume-baking-btn');
const bakingTimerDisplay = document.getElementById('baking-timer-display');
const bakingCurrentPhase = document.getElementById('baking-current-phase');
const bakingProgressDisplay = document.getElementById('baking-progress-display');
const bakingScoreboardWrapper = document.getElementById('baking-scoreboard-wrapper');
const bakingChaosLog = document.getElementById('baking-chaos-log');

// Judging DOM elements
const judgingTeamPanels = document.getElementById('judging-team-panels');
const judgingResultsPreview = document.getElementById('judging-results-preview');
const judgingStatusText = document.getElementById('judging-status-text');
const revealResultsBtn = document.getElementById('reveal-results-btn');
const resultsStandings = document.getElementById('results-standings');
const cakeGallerySection = document.getElementById('cake-gallery-section');
const cakeGalleryMeta = document.getElementById('cake-gallery-meta');
const cakeGalleryGrid = document.getElementById('cake-gallery-grid');
const generateGalleryBtn = document.getElementById('generate-gallery-btn');
const revealCakeBtn = document.getElementById('reveal-cake-btn');

// Buzz notification
const buzzNotification = document.getElementById('buzz-notification');
const buzzTeamName = document.getElementById('buzz-team-name');

// State
let currentPhase = 'LOBBY';
let teams = [];
let currentMode = 'SLIDE';
let currentQuestionId = null;
let answeredTeams = new Set();
let forcedTeams = new Set();
let shopCatalog = null;
let shopItemsByKey = new Map();
let shopInventories = {};
let shopPurchaseHistories = {};
let selectedShopTeamId = null;
let pendingShopApproval = null;
let bakingState = {
  teamId: null,
  minigames: [],
  chaosEvents: [],
  chaosLevel: null,
  currentPhaseIndex: 0,
  totalPhases: 6,
  timeRemaining: 300,
  scoreboard: [],
  chaosLog: [],
  isPaused: false
};
let judgingResults = [];
let judgingDraftScores = {};
let judgedTeamIds = new Set();
let allTeamsJudged = false;
let cakeGalleryState = {
  teamId: null,
  imagePaths: [],
  selectedImagePath: '',
  scores: null,
  chaosEvents: []
};
let hasConnectedOnce = false;
let phaseTransitionTimer = null;

// ===== Socket Event Handlers =====

socket.on('connect', () => {
  console.log('Connected to server');
  hideConnectionOverlay();
  updateConnectionStatus('Connected', 'success');

  if (!hasConnectedOnce) {
    hasConnectedOnce = true;
    socket.emit('join-room', 'host');
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
  socket.emit('join-room', 'host');
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

  updatePhaseUI(data.phase);
  renderTeamsList();
  renderTriviaScoreboard();
  renderTeamAnswerButtons();
  renderShopTeamSelect();
  renderShopTeamSummary();
  renderJudgingPanels();
  renderJudgingResultsPreview();
  renderResultsStandings();
  updateRevealResultsState();
});

socket.on('team-joined', (team) => {
  console.log('Team joined:', team);
  showNotification(`Team "${team.name}" joined!`, 'success');
});

socket.on('teams-updated', (updatedTeams) => {
  console.log('Teams updated:', updatedTeams);
  teams = normalizeTeams(updatedTeams);
  renderTeamsList();
  renderTriviaScoreboard();
  renderTeamAnswerButtons();
  renderShopTeamSelect();
  renderShopCatalog();
  renderShopTeamSummary();
  renderBakingDashboard();
  renderJudgingPanels();
  renderJudgingResultsPreview();
  renderResultsStandings();
  updateRevealResultsState();
});

socket.on('error', (error) => {
  console.error('Server error:', error);
  hideLoadingOverlay();
  showNotification(error.message || 'An error occurred', 'error');
});

// ===== TRIVIA EVENT HANDLERS =====

socket.on('trivia:question-shown', (data) => {
  console.log('Question shown:', data);
  hideHostAnswerReveal();
  currentQuestionId = data.question.id;
  answeredTeams.clear();
  forcedTeams.clear();

  if (data.mode === 'SLIDE') {
    displaySlideQuestion(data.question);
  } else if (data.mode === 'JEOPARDY') {
    displayJeopardyQuestion(data.question);
  }

  renderTeamAnswerButtons();
});

socket.on('trivia:scores-updated', (scoreboard) => {
  console.log('Scores updated:', scoreboard);
  teams = normalizeTeams(scoreboard);
  renderTriviaScoreboard();
  renderTeamAnswerButtons();
  renderShopTeamSelect();
  renderShopTeamSummary();
});

socket.on('trivia:buzz-received', (data) => {
  console.log('Buzz received:', data);
  showBuzzNotification(data.teamName);
  highlightBuzzedTeam(data.teamId);
});

socket.on('trivia:answer-result', (data) => {
  console.log('Answer result:', data);
  answeredTeams.add(data.teamId);
  teams = normalizeTeams(
    teams.map((team) => team.id === data.teamId ? { ...team, money: data.newBalance } : team)
  );
  renderTeamAnswerButtons();
  renderTriviaScoreboard();
  renderShopTeamSelect();
  renderShopTeamSummary();
  showNotification(
    `Team answered ${data.correct ? 'correctly' : 'incorrectly'}! New balance: ${formatMoney(data.newBalance)}`,
    data.correct ? 'success' : 'error'
  );

  if (data.answer) {
    showHostAnswerReveal(data.answer);
  }
});

socket.on('trivia:answer-revealed', (data) => {
  console.log('Answer revealed:', data);
  showHostAnswerReveal(data.answer);
});

socket.on('trivia:force-answer-required', (data) => {
  console.log('Force answer required:', data);
  data.teamIds.forEach((id) => forcedTeams.add(id));
  renderTeamAnswerButtons();
  showNotification('All teams must answer!', 'info');
});

socket.on('trivia:mode-changed', (data) => {
  console.log('Mode changed:', data);
  currentMode = data.mode;
  updateTriviaMode(data.mode);
});

socket.on('trivia:board-state', (board) => {
  console.log('Board state:', board);
  renderJeopardyBoard(board);
});

// ===== SHOP EVENT HANDLERS =====

socket.on('shop:catalog', (data) => {
  console.log('Shop catalog:', data);
  shopCatalog = data || { categories: [], defaultKit: [] };
  shopItemsByKey = buildShopItemIndex(shopCatalog);
  shopInventories = normalizeShopCollections(shopCatalog.inventories);
  shopPurchaseHistories = normalizeShopCollections(shopCatalog.purchaseHistories);

  if (Array.isArray(shopCatalog.teams) && shopCatalog.teams.length > 0) {
    teams = normalizeTeams(shopCatalog.teams);
  }

  if (!selectedShopTeamId || !teams.some((team) => team.id === selectedShopTeamId)) {
    selectedShopTeamId = teams[0] ? teams[0].id : null;
  }

  renderTeamsList();
  renderTriviaScoreboard();
  initializeShopUI();
});

socket.on('shop:purchase-result', (teamId, result) => {
  console.log('Shop purchase result:', teamId, result);

  if (Array.isArray(result.purchaseHistory)) {
    shopPurchaseHistories[String(teamId)] = result.purchaseHistory;
  }

  if (typeof result.newBalance === 'number') {
    teams = normalizeTeams(
      teams.map((team) => team.id === teamId ? { ...team, money: result.newBalance } : team)
    );
  }

  if (!result.success) {
    pendingShopApproval = {
      teamId,
      teamName: getTeamName(teamId),
      purchaseId: result.purchaseId,
      itemKey: result.itemKey,
      itemName: result.itemName || result.itemKey,
      price: result.price,
      currentBalance: result.currentBalance,
      warning: result.warning || 'Team cannot afford this item.'
    };
    openShopWarningModal();
  } else {
    if (pendingShopApproval && pendingShopApproval.purchaseId === result.purchaseId) {
      pendingShopApproval = null;
      closeShopWarningModal();
    }

    const approvalNote = result.approvedByOverride ? ' with host override' : '';
    showNotification(
      `${getTeamName(teamId)} bought ${result.itemName || result.itemKey}${approvalNote}. Balance: ${formatMoney(result.newBalance)}`,
      'success'
    );
  }

  renderShopTeamSelect();
  renderShopCatalog();
  renderShopTeamSummary();
  renderTriviaScoreboard();
});

socket.on('shop:team-inventory-updated', (teamId, inventory) => {
  console.log('Team inventory updated:', teamId, inventory);
  shopInventories[String(teamId)] = Array.isArray(inventory) ? inventory : [];
  renderShopCatalog();
  renderShopTeamSummary();
});

socket.on('shop:warning', (teamId, message) => {
  console.log('Shop warning:', teamId, message);

  if (pendingShopApproval && pendingShopApproval.teamId === teamId) {
    pendingShopApproval.warningMessage = message;
    openShopWarningModal();
    return;
  }

  showNotification(`${getTeamName(teamId)}: ${message}`, 'info');
});

socket.on('shop:purchase-request', (data) => {
  console.log('Purchase request from player:', data);
  showPurchaseRequestNotification(data);
});

// ===== BAKING EVENT HANDLERS =====

socket.on('baking:started', (payload) => {
  console.log('Baking started:', payload);
  bakingState = normalizeBakingState({ ...bakingState, ...payload });
  cakeGalleryState = {
    teamId: Number(payload?.teamId) || null,
    imagePaths: [],
    selectedImagePath: '',
    scores: null,
    chaosEvents: []
  };
  renderBakingDashboard();
  renderCakeGallery();
});

socket.on('baking:minigame-selections', (payload) => {
  console.log('Baking selections:', payload);
  bakingState = normalizeBakingState({ ...bakingState, ...payload });
  renderBakingDashboard();
});

socket.on('baking:timer-tick', ({ timeRemaining }) => {
  bakingState.timeRemaining = Number(timeRemaining) || 0;
  renderBakingDashboard();
});

socket.on('baking:paused', ({ timeRemaining }) => {
  bakingState = normalizeBakingState({ ...bakingState, timeRemaining, isPaused: true });
  showNotification('Baking timer paused.', 'info');
  renderBakingDashboard();
});

socket.on('baking:resumed', ({ timeRemaining }) => {
  bakingState = normalizeBakingState({ ...bakingState, timeRemaining, isPaused: false });
  showNotification('Baking timer resumed.', 'success');
  renderBakingDashboard();
});

socket.on('baking:phase-completed', (payload) => {
  console.log('Baking phase completed:', payload);
  bakingState = normalizeBakingState({
    ...bakingState,
    currentPhaseIndex: typeof payload.currentPhaseIndex === 'number' ? payload.currentPhaseIndex : bakingState.currentPhaseIndex,
    scoreboard: payload.scoreboard || bakingState.scoreboard
  });
  renderBakingDashboard();
});

socket.on('baking:chaos-event', (payload) => {
  console.log('Baking chaos event:', payload);
  bakingState.chaosLog = [...(bakingState.chaosLog || []), payload].slice(-12);
  renderBakingDashboard();
});

socket.on('baking:time-up', () => {
  bakingState.timeRemaining = 0;
  bakingState.isPaused = false;
  renderBakingDashboard();
  showNotification('Baking timer finished.', 'success');
});

socket.on('baking:cake-gallery', (payload) => {
  console.log('Cake gallery ready:', payload);
  hideLoadingOverlay();
  cakeGalleryState = {
    teamId: Number(payload?.teamId) || null,
    imagePaths: Array.isArray(payload?.imagePaths) ? payload.imagePaths : [],
    selectedImagePath: Array.isArray(payload?.imagePaths) && payload.imagePaths.length ? payload.imagePaths[0] : '',
    scores: payload?.scores || null,
    chaosEvents: Array.isArray(payload?.chaosEvents) ? payload.chaosEvents : getCurrentChaosSummary()
  };
  renderCakeGallery();
  showNotification('Cake gallery ready for selection.', 'success');
});

// ===== JUDGING EVENT HANDLERS =====

socket.on('judging:scores-updated', (payload) => {
  console.log('Judging scores updated:', payload);
  judgingResults = Array.isArray(payload?.results) ? payload.results : [];
  allTeamsJudged = Boolean(payload?.allTeamsScored);
  syncJudgingDraftScores(true);
  renderJudgingPanels();
  renderJudgingResultsPreview();
  renderResultsStandings();
  updateRevealResultsState();

  if (payload?.teamId) {
    showNotification(`Saved judging scores for ${getTeamName(payload.teamId)}.`, 'success');
  }
});

socket.on('judging:results', (results) => {
  console.log('Judging results:', results);
  judgingResults = Array.isArray(results) ? results : [];
  judgedTeamIds = new Set(judgingResults.filter((entry) => entry.hasPhysicalScores).map((entry) => entry.teamId));
  allTeamsJudged = teams.length > 0 && judgedTeamIds.size === teams.length;
  syncJudgingDraftScores(false);
  renderJudgingPanels();
  renderJudgingResultsPreview();
  renderResultsStandings();
  updateRevealResultsState();
});

socket.on('results:cake-reveal', (payload) => {
  if (!payload?.cakeImagePath) {
    return;
  }

  cakeGalleryState = {
    ...cakeGalleryState,
    teamId: Number(payload.teamId) || cakeGalleryState.teamId || null,
    selectedImagePath: payload.cakeImagePath,
    scores: payload.scores || cakeGalleryState.scores,
    chaosEvents: Array.isArray(payload.chaosEvents) ? payload.chaosEvents : cakeGalleryState.chaosEvents
  };
  renderCakeGallery();
  showNotification('Cake reveal sent to all clients.', 'success');
});

socket.on('results:reveal', (results) => {
  console.log('Results revealed:', results);
  judgingResults = Array.isArray(results) ? results : [];
  judgedTeamIds = new Set(judgingResults.filter((entry) => entry.hasPhysicalScores).map((entry) => entry.teamId));
  allTeamsJudged = teams.length > 0 && judgedTeamIds.size === teams.length;
  syncJudgingDraftScores(true);
  renderJudgingResultsPreview();
  renderResultsStandings();
  updateRevealResultsState();
  showNotification('Results revealed to all clients.', 'success');
});

// ===== UI Updates =====

function updateConnectionStatus(message, type) {
  connectionStatus.innerHTML = `<span>${escapeHtml(message)}</span>`;
  connectionStatus.className = `status status-${type}`;

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

  if (phase === 'TRIVIA') {
    initializeTriviaUI();
  } else if (phase === 'SHOP') {
    initializeShopUI();
  } else if (phase === 'BAKING') {
    closeShopWarningModal();
    initializeBakingUI();
  } else if (phase === 'JUDGING') {
    closeShopWarningModal();
    initializeJudgingUI();
  } else if (phase === 'RESULTS') {
    closeShopWarningModal();
    initializeResultsUI();
  } else {
    closeShopWarningModal();
  }
}

function renderTeamsList() {
  if (teams.length === 0) {
    teamsList.innerHTML = '<li class="text-muted text-center">No teams connected yet...</li>';
    startGameBtn.disabled = true;
    return;
  }

  teamsList.innerHTML = teams.map((team) => `
    <li class="team-item">
      <div>
        <span class="team-name">${escapeHtml(team.name)}</span>
        ${team.isVirtual ? '<span class="team-badge virtual">Virtual</span>' : '<span class="team-badge physical">Physical</span>'}
      </div>
      <span class="text-muted text-small">
        Joined ${new Date(team.createdAt).toLocaleTimeString()}
      </span>
    </li>
  `).join('');

  startGameBtn.disabled = false;
}

function showNotification(message, type) {
  const safeType = ['success', 'error', 'info'].includes(type) ? type : 'info';
  const notification = document.createElement('div');
  notification.className = `status status-${safeType}`;
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.zIndex = '9999';
  notification.innerHTML = `<span>${escapeHtml(message)}</span>`;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatMoney(value) {
  const amount = Number(value) || 0;
  const formatted = Math.abs(amount).toLocaleString();
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

function normalizeTeams(teamList) {
  return [...(teamList || [])]
    .filter(Boolean)
    .map((team) => ({
      ...team,
      money: Number(team.money) || 0,
      isVirtual: team.isVirtual === true || team.isVirtual === 1 || team.is_virtual_team === true || team.is_virtual_team === 1,
      createdAt: team.createdAt || team.created_at || new Date().toISOString()
    }))
    .sort((left, right) => right.money - left.money || left.id - right.id);
}

function normalizeShopCollections(collections) {
  const normalized = {};

  Object.entries(collections || {}).forEach(([key, value]) => {
    normalized[String(key)] = Array.isArray(value) ? value : [];
  });

  return normalized;
}

function getTeamName(teamId) {
  const team = teams.find((entry) => entry.id === teamId);
  return team ? team.name : `Team ${teamId}`;
}

function getActiveVirtualTeam() {
  return teams.find((team) => team.id === cakeGalleryState.teamId)
    || teams.find((team) => team.id === bakingState.teamId)
    || teams.find((team) => team.isVirtual)
    || teams[0]
    || null;
}

function getCurrentChaosSummary() {
  const source = Array.isArray(bakingState.chaosLog) && bakingState.chaosLog.length
    ? bakingState.chaosLog
    : bakingState.chaosEvents;

  return (source || []).slice(-6).map((event) => ({
    title: event.name || event.phaseName || 'Chaos event',
    description: event.description || 'Something unfair happened.',
    phaseName: event.phaseName || event.phaseKey || 'Kitchen'
  }));
}

function renderCakeGallery() {
  if (!cakeGallerySection || !cakeGalleryGrid || !revealCakeBtn) {
    return;
  }

  const shouldShow = currentPhase === 'JUDGING' || currentPhase === 'RESULTS' || cakeGalleryState.imagePaths.length > 0;
  cakeGallerySection.style.display = shouldShow ? 'block' : 'none';

  if (!shouldShow) {
    return;
  }

  if (!cakeGalleryState.imagePaths.length) {
    cakeGalleryGrid.innerHTML = '<div class="text-muted">Generate cake images once baking is complete.</div>';
    if (cakeGalleryMeta) {
      cakeGalleryMeta.innerHTML = `<span>${escapeHtml(getActiveVirtualTeam()?.name || 'Virtual team')} is ready for a gallery render.</span>`;
    }
    revealCakeBtn.disabled = true;
    return;
  }

  cakeGalleryGrid.innerHTML = cakeGalleryState.imagePaths.map((imagePath, index) => `
    <button type="button" class="gallery-card ${imagePath === cakeGalleryState.selectedImagePath ? 'is-selected' : ''}" data-image-path="${escapeHtml(imagePath)}">
      <img src="${escapeHtml(imagePath)}" alt="Cake gallery option ${index + 1}">
      <div class="gallery-card-label">Option ${index + 1}${imagePath === cakeGalleryState.selectedImagePath ? ' · selected' : ''}</div>
    </button>
  `).join('');

  if (cakeGalleryMeta) {
    const scores = cakeGalleryState.scores || {};
    cakeGalleryMeta.innerHTML = `
      <span>${escapeHtml(getTeamName(cakeGalleryState.teamId || getActiveVirtualTeam()?.id || 0))}</span>
      <span>Taste ${formatScore(scores.taste)} · Accuracy ${formatScore(scores.accuracy)} · Creativity ${formatScore(scores.creativity)} · Total ${formatScore(scores.total)}</span>
    `;
  }

  revealCakeBtn.disabled = !cakeGalleryState.selectedImagePath;
}

// ===== TRIVIA UI FUNCTIONS =====

function initializeTriviaUI() {
  if (currentMode === 'JEOPARDY') {
    socket.emit('trivia:get-board');
  }

  renderTriviaScoreboard();
  updateTriviaMode(currentMode);
  renderTeamAnswerButtons();
}

function renderTriviaScoreboard() {
  if (!teams || teams.length === 0) {
    triviaScoreboard.innerHTML = '<div class="text-muted text-center">No teams yet</div>';
    return;
  }

  triviaScoreboard.innerHTML = teams.map((team) => `
    <div class="score-card">
      <div class="score-team">${escapeHtml(team.name)}</div>
      <div class="score-value">${formatMoney(team.money)}</div>
    </div>
  `).join('');
}

function updateTriviaMode(mode) {
  currentMode = mode;
  triviaCurrentMode.textContent = mode;

  if (mode === 'SLIDE') {
    slideModeSection.classList.add('active');
    jeopardyModeSection.classList.remove('active');
    triviaModeToggle.textContent = 'Switch to Jeopardy Mode';
  } else {
    slideModeSection.classList.remove('active');
    jeopardyModeSection.classList.add('active');
    triviaModeToggle.textContent = 'Switch to Slide Mode';
    socket.emit('trivia:get-board');
  }
}

function hideHostAnswerReveal() {
  if (!hostAnswerReveal) {
    return;
  }

  hostAnswerReveal.textContent = '';
  hostAnswerReveal.classList.add('hidden');
}

function showHostAnswerReveal(answer) {
  if (!hostAnswerReveal || !answer) {
    return;
  }

  hostAnswerReveal.textContent = `Answer: ${answer}`;
  hostAnswerReveal.classList.remove('hidden');
}

function displaySlideQuestion(question) {
  slideQuestionDisplay.innerHTML = `
    <h3>${escapeHtml(question.question)}</h3>
    ${question.value ? `<p class="text-muted mt-2">Value: ${formatMoney(question.value)}</p>` : ''}
  `;

  if (question.media) {
    displayMedia(slideMediaArea, question.media);
  } else {
    slideMediaArea.classList.add('hidden');
    slideMediaArea.innerHTML = '';
  }
}

function displayJeopardyQuestion(question) {
  jeopardyQuestionDisplay.innerHTML = `
    <h3>${escapeHtml(question.question)}</h3>
    ${question.value ? `<p class="text-muted mt-2">Value: ${formatMoney(question.value)}</p>` : ''}
  `;

  if (question.media) {
    displayMedia(jeopardyMediaArea, question.media);
  } else {
    jeopardyMediaArea.classList.add('hidden');
    jeopardyMediaArea.innerHTML = '';
  }

  jeopardyQuestionCard.style.display = 'block';
  jeopardyAnswersCard.style.display = 'block';
}

function displayMedia(container, media) {
  const { type, url } = media;
  container.classList.remove('hidden');

  if (type === 'image') {
    container.innerHTML = `<img src="${escapeHtml(url)}" alt="Question media">`;
  } else if (type === 'video') {
    container.innerHTML = `<video controls src="${escapeHtml(url)}"></video>`;
  } else if (type === 'audio') {
    container.innerHTML = `<audio controls src="${escapeHtml(url)}"></audio>`;
  }
}

function renderTeamAnswerButtons() {
  const slideContainer = slideTeamAnswers;
  const jeopardyContainer = jeopardyTeamAnswers;

  if (!teams || teams.length === 0) {
    const noTeamsHtml = '<p class="text-muted text-center">No teams to display</p>';
    slideContainer.innerHTML = noTeamsHtml;
    jeopardyContainer.innerHTML = noTeamsHtml;
    return;
  }

  const html = teams.map((team) => {
    const hasAnswered = answeredTeams.has(team.id);
    const mustAnswer = forcedTeams.has(team.id);

    return `
      <div class="team-answer-item ${mustAnswer ? 'must-answer' : ''}" data-team-id="${team.id}">
        <div class="team-answer-header">
          <span>${escapeHtml(team.name)}</span>
          <span class="team-answer-money">${formatMoney(team.money)}</span>
        </div>
        ${hasAnswered
          ? '<div class="team-answer-status">Already answered</div>'
          : `<div class="team-answer-buttons">
              <button class="btn btn-correct" onclick="scoreTeamAnswer(${team.id}, true)">✓ Correct</button>
              <button class="btn btn-wrong" onclick="scoreTeamAnswer(${team.id}, false)">✗ Wrong</button>
            </div>`
        }
      </div>
    `;
  }).join('');

  slideContainer.innerHTML = html;
  jeopardyContainer.innerHTML = html;
}

function renderJeopardyBoard(board) {
  if (!board || board.length === 0) {
    jeopardyBoard.innerHTML = '<p class="text-muted text-center">No board data available</p>';
    return;
  }

  let html = '';

  board.forEach((category) => {
    html += `<div class="jeopardy-category">${escapeHtml(category.name)}</div>`;
  });

  const maxQuestions = Math.max(...board.map((category) => category.questions.length));

  for (let index = 0; index < maxQuestions; index += 1) {
    board.forEach((category) => {
      const question = category.questions[index];
      if (question) {
        const answeredClass = question.answered ? 'answered' : '';
        const safeCategory = JSON.stringify(category.name);
        html += `
          <div class="jeopardy-cell ${answeredClass}"
               onclick='${question.answered ? '' : `selectJeopardyQuestion(${safeCategory}, ${question.value})`}'>
            $${question.value}
          </div>
        `;
      } else {
        html += '<div class="jeopardy-cell" style="opacity: 0;"></div>';
      }
    });
  }

  jeopardyBoard.innerHTML = html;
}

function showBuzzNotification(teamName) {
  buzzTeamName.textContent = teamName;
  buzzNotification.classList.remove('hidden');

  setTimeout(() => {
    buzzNotification.classList.add('hidden');
  }, 2000);
}

function highlightBuzzedTeam(teamId) {
  document.querySelectorAll('.team-answer-item.buzzed').forEach((element) => {
    element.classList.remove('buzzed');
  });

  document.querySelectorAll(`.team-answer-item[data-team-id="${teamId}"]`).forEach((element) => {
    element.classList.add('buzzed');
  });
}

// ===== SHOP UI FUNCTIONS =====

function initializeShopUI() {
  renderShopTeamSelect();
  renderShopCatalog();
  renderShopTeamSummary();
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

function buildShopItemMeta(item) {
  const tags = [];

  if (typeof item.difficulty === 'number') {
    tags.push(`Difficulty ${item.difficulty}`);
  }
  if (typeof item.quality === 'number') {
    tags.push(`Quality ${item.quality}`);
  }
  if (typeof item.bonus === 'number') {
    tags.push(`${item.bonus}x tool bonus`);
  }
  if (item.effect) {
    tags.push(`Effect: ${item.effect}`);
  }
  if (typeof item.value === 'number' && item.effect) {
    tags.push(`Value ${item.value}`);
  }

  return tags.join(' • ');
}

function getSelectedShopTeam() {
  return teams.find((team) => team.id === selectedShopTeamId) || null;
}

function getTeamInventory(teamId) {
  return shopInventories[String(teamId)] || [];
}

function getTeamHistory(teamId) {
  return shopPurchaseHistories[String(teamId)] || [];
}

function summarizeInventory(inventory) {
  const summary = new Map();

  inventory.forEach((item) => {
    const key = item.item_key;
    summary.set(key, (summary.get(key) || 0) + 1);
  });

  return Array.from(summary.entries()).map(([itemKey, count]) => ({ itemKey, count }));
}

function renderShopTeamSelect() {
  if (!shopTeamSelect) {
    return;
  }

  if (!teams.length) {
    selectedShopTeamId = null;
    shopTeamSelect.disabled = true;
    shopTeamSelect.innerHTML = '<option value="">No teams available</option>';
    return;
  }

  if (!selectedShopTeamId || !teams.some((team) => team.id === selectedShopTeamId)) {
    selectedShopTeamId = teams[0].id;
  }

  shopTeamSelect.disabled = false;
  shopTeamSelect.innerHTML = teams.map((team) => `
    <option value="${team.id}" ${team.id === selectedShopTeamId ? 'selected' : ''}>
      ${escapeHtml(team.name)} — ${formatMoney(team.money)}
    </option>
  `).join('');
}

function renderShopCatalog() {
  if (!shopCatalogContainer) {
    return;
  }

  updatePurchaseRequestPlaceholder();

  if (!shopCatalog || !Array.isArray(shopCatalog.categories) || shopCatalog.categories.length === 0) {
    shopCatalogContainer.innerHTML = `
      <div class="card">
        <div class="card-body">
          <p class="text-muted text-center">Open the shop to load the catalog.</p>
        </div>
      </div>
    `;
    return;
  }

  const selectedTeam = getSelectedShopTeam();
  const selectedInventory = selectedTeam ? getTeamInventory(selectedTeam.id) : [];

  shopCatalogContainer.innerHTML = shopCatalog.categories.map((category) => `
    <section class="shop-category-card">
      <h3>${escapeHtml(category.name)}</h3>
      ${category.description ? `<p class="text-muted">${escapeHtml(category.description)}</p>` : ''}
      <div class="shop-item-grid">
        ${(category.items || []).map((item) => {
          const ownedCount = selectedInventory.filter((entry) => entry.item_key === item.key).length;
          const meta = buildShopItemMeta(item);
          return `
            <article class="shop-item-card">
              <div class="shop-item-header">
                <div>
                  <h4>${escapeHtml(item.name)}</h4>
                  ${item.description ? `<p class="text-muted">${escapeHtml(item.description)}</p>` : ''}
                </div>
                <span class="shop-item-price">${formatMoney(item.price)}</span>
              </div>
              ${meta ? `<div class="shop-item-meta">${escapeHtml(meta)}</div>` : ''}
              <div class="shop-item-owned">${ownedCount > 0 ? `${ownedCount} owned by selected team` : 'Not owned yet'}</div>
              <button class="btn btn-primary shop-buy-btn" data-item-key="${escapeHtml(item.key)}" ${selectedTeam ? '' : 'disabled'}>
                Buy for Team
              </button>
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `).join('');

  shopCatalogContainer.querySelectorAll('.shop-buy-btn').forEach((button) => {
    button.addEventListener('click', () => {
      buyShopItem(button.dataset.itemKey);
    });
  });
}

function renderShopTeamSummary() {
  if (!shopSelectedTeamName || !shopTeamBalance || !shopTeamInventory || !shopTeamHistory) {
    return;
  }

  const selectedTeam = getSelectedShopTeam();
  if (!selectedTeam) {
    shopSelectedTeamName.textContent = 'Selected Team';
    shopTeamBalance.textContent = formatMoney(0);
    shopTeamInventory.innerHTML = '<span class="text-muted">No team selected.</span>';
    shopTeamHistory.innerHTML = '<div class="text-muted">No purchases recorded yet.</div>';
    return;
  }

  shopSelectedTeamName.textContent = selectedTeam.name;
  shopTeamBalance.textContent = formatMoney(selectedTeam.money);

  const inventorySummary = summarizeInventory(getTeamInventory(selectedTeam.id));
  shopTeamInventory.innerHTML = inventorySummary.length
    ? inventorySummary.map(({ itemKey, count }) => {
      const item = shopItemsByKey.get(itemKey);
      const name = item ? item.name : itemKey;
      return `<span class="shop-inventory-chip">${escapeHtml(name)} ×${count}</span>`;
    }).join('')
    : '<span class="text-muted">No purchases yet.</span>';

  const history = getTeamHistory(selectedTeam.id);
  shopTeamHistory.innerHTML = history.length
    ? history.map((purchase) => {
      const item = shopItemsByKey.get(purchase.item_key);
      const itemName = item ? item.name : purchase.item_key;
      const categoryName = item ? item.categoryName : purchase.category;
      return `
        <div class="shop-history-item">
          <div class="flex flex-between gap-md">
            <strong>${escapeHtml(itemName)}</strong>
            <span class="text-muted">${formatMoney(purchase.price)}</span>
          </div>
          <div class="text-muted text-small">${escapeHtml(categoryName || '')}</div>
        </div>
      `;
    }).join('')
    : '<div class="text-muted">No purchases recorded yet.</div>';
}

function getPurchaseRequestContainer() {
  if (shopPurchaseRequests) {
    return shopPurchaseRequests;
  }

  shopPurchaseRequests = createPurchaseRequestContainer();
  return shopPurchaseRequests;
}

function updatePurchaseRequestPlaceholder() {
  const container = getPurchaseRequestContainer();
  if (!container) {
    return;
  }

  const hasCards = Boolean(container.querySelector('.purchase-request-card'));
  let placeholder = container.querySelector('.purchase-request-empty');

  if (hasCards) {
    if (placeholder) {
      placeholder.remove();
    }
    return;
  }

  if (!placeholder) {
    placeholder = document.createElement('p');
    placeholder.className = 'text-muted text-small purchase-request-empty';
    placeholder.textContent = 'Player requests will appear here';
    container.appendChild(placeholder);
  }
}

function showPurchaseRequestNotification(request) {
  const container = getPurchaseRequestContainer();
  if (!container) {
    return;
  }

  const placeholder = container.querySelector('.purchase-request-empty');
  if (placeholder) {
    placeholder.remove();
  }

  const requestEl = document.createElement('div');
  requestEl.className = 'purchase-request-card';
  requestEl.dataset.teamId = String(request.teamId);
  requestEl.dataset.itemKey = request.itemKey;
  requestEl.dataset.itemName = request.itemName;

  const info = document.createElement('div');
  info.className = 'purchase-request-info';
  info.innerHTML = `
    <strong>${escapeHtml(request.teamName)}</strong> wants to buy
    <strong>${escapeHtml(request.itemName)}</strong> (${formatMoney(request.price)})
    <span class="text-muted">(Balance: ${formatMoney(request.currentBalance)})</span>
    ${!request.canAfford ? '<span class="text-warning">⚠️ Can\'t afford!</span>' : ''}
  `;

  const actions = document.createElement('div');
  actions.className = 'purchase-request-actions';

  const approveBtn = document.createElement('button');
  approveBtn.className = 'btn btn-sm btn-primary';
  approveBtn.textContent = '✓ Approve';
  approveBtn.addEventListener('click', () => {
    approvePurchaseRequest(Number(request.teamId), request.itemKey, approveBtn);
  });

  const denyBtn = document.createElement('button');
  denyBtn.className = 'btn btn-sm btn-danger';
  denyBtn.textContent = '✗ Deny';
  denyBtn.addEventListener('click', () => {
    denyPurchaseRequest(denyBtn);
  });

  actions.appendChild(approveBtn);
  actions.appendChild(denyBtn);
  requestEl.appendChild(info);
  requestEl.appendChild(actions);

  const firstCard = container.querySelector('.purchase-request-card');
  if (firstCard) {
    container.insertBefore(requestEl, firstCard);
  } else {
    container.appendChild(requestEl);
  }
}

function createPurchaseRequestContainer() {
  const shopSection = document.getElementById('shop-section') || document.querySelector('.shop-section');
  if (!shopSection) {
    return null;
  }

  const container = document.createElement('div');
  container.id = 'shop-purchase-requests';
  container.className = 'purchase-request-container';
  container.style.marginBottom = 'var(--spacing-md)';

  const header = document.createElement('h4');
  header.textContent = '📋 Player Purchase Requests';
  container.appendChild(header);

  shopSection.insertBefore(container, shopSection.firstChild);
  shopPurchaseRequests = container;
  updatePurchaseRequestPlaceholder();
  return container;
}

function openShopWarningModal() {
  if (!pendingShopApproval || !shopWarningModal) {
    return;
  }

  const itemLabel = pendingShopApproval.itemName || pendingShopApproval.itemKey || 'this item';
  shopWarningTitle.textContent = `${pendingShopApproval.teamName} cannot afford ${itemLabel}`;
  shopWarningCopy.innerHTML = `${escapeHtml(pendingShopApproval.warningMessage || pendingShopApproval.warning || 'Host override required.')}<br><br>Current balance: ${escapeHtml(formatMoney(pendingShopApproval.currentBalance))}<br>Item price: ${escapeHtml(formatMoney(pendingShopApproval.price))}`;
  shopWarningModal.classList.remove('hidden');
}

function closeShopWarningModal() {
  if (!shopWarningModal) {
    return;
  }

  shopWarningModal.classList.add('hidden');
}

function buyShopItem(itemKey) {
  const selectedTeam = getSelectedShopTeam();
  if (!selectedTeam) {
    showNotification('Select a team before making a purchase.', 'error');
    return;
  }

  socket.emit('shop:purchase', { teamId: selectedTeam.id, itemKey });
}

// ===== BAKING UI FUNCTIONS =====

function normalizeBakingState(data = {}) {
  return {
    teamId: Number(data.teamId) || bakingState.teamId || null,
    minigames: Array.isArray(data.minigames) ? data.minigames : bakingState.minigames,
    chaosEvents: Array.isArray(data.chaosEvents) ? data.chaosEvents : bakingState.chaosEvents,
    chaosLevel: data.chaosLevel || bakingState.chaosLevel || null,
    currentPhaseIndex: typeof data.currentPhaseIndex === 'number' ? data.currentPhaseIndex : (bakingState.currentPhaseIndex || 0),
    totalPhases: Number(data.totalPhases) || (Array.isArray(data.minigames) ? data.minigames.length : bakingState.totalPhases || 6),
    timeRemaining: typeof data.timeRemaining === 'number' ? data.timeRemaining : (bakingState.timeRemaining || 0),
    scoreboard: Array.isArray(data.scoreboard) ? data.scoreboard : bakingState.scoreboard,
    chaosLog: Array.isArray(data.chaosLog) ? data.chaosLog : bakingState.chaosLog,
    isPaused: Boolean(data.isPaused)
  };
}

function initializeBakingUI() {
  renderBakingDashboard();
}

function renderBakingDashboard() {
  if (bakingTimerDisplay) {
    bakingTimerDisplay.textContent = formatBakingTime(bakingState.timeRemaining || 0);
  }

  const currentSelection = bakingState.minigames[bakingState.currentPhaseIndex] || null;
  if (bakingCurrentPhase) {
    bakingCurrentPhase.textContent = currentSelection
      ? `${currentSelection.phaseName || currentSelection.phase.toUpperCase()}${bakingState.isPaused ? ' (Paused)' : ''}`
      : (bakingState.timeRemaining === 0 && bakingState.scoreboard.length ? 'Bake complete' : 'Waiting to start');
  }

  if (bakingProgressDisplay) {
    const completedCount = Math.min(bakingState.currentPhaseIndex, bakingState.totalPhases || 6);
    bakingProgressDisplay.textContent = `${completedCount} / ${bakingState.totalPhases || 6}`;
  }

  renderBakingScoreboard();
  renderBakingChaosLog();
}

function renderBakingScoreboard() {
  if (!bakingScoreboardWrapper) {
    return;
  }

  if (!Array.isArray(bakingState.scoreboard) || !bakingState.scoreboard.length) {
    bakingScoreboardWrapper.innerHTML = '<div class="text-muted text-center">Start baking to track the virtual team.</div>';
    return;
  }

  bakingScoreboardWrapper.innerHTML = `
    <table class="baking-score-table">
      <thead>
        <tr>
          <th>Team</th>
          <th>Prep</th>
          <th>Mix</th>
          <th>Bake</th>
          <th>Cool</th>
          <th>Decorate</th>
          <th>Present</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${bakingState.scoreboard.map((entry) => `
          <tr>
            <td>${escapeHtml(entry.teamName)}${entry.teamId === bakingState.teamId ? ' <span class="team-badge virtual">Active</span>' : ''}</td>
            ${['prep', 'mix', 'bake', 'cool', 'decorate', 'present'].map((phaseKey) => `<td>${formatBakingScore(entry.phases?.[phaseKey])}</td>`).join('')}
            <td><strong>${formatBakingScore(entry.totalScore)}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderBakingChaosLog() {
  if (!bakingChaosLog) {
    return;
  }

  if (!Array.isArray(bakingState.chaosLog) || !bakingState.chaosLog.length) {
    bakingChaosLog.innerHTML = '<div class="text-muted">Chaos events will appear here as the bake unfolds.</div>';
    return;
  }

  bakingChaosLog.innerHTML = [...bakingState.chaosLog].reverse().map((event) => `
    <article class="baking-chaos-item">
      <strong>${escapeHtml(event.name || 'Chaos event')}</strong>
      <div class="text-muted text-small">${escapeHtml((event.phaseName || event.phaseKey || 'ANY').toUpperCase())}</div>
      <div>${escapeHtml(event.description || 'Something unfair happened.')}</div>
    </article>
  `).join('');
}

function formatBakingTime(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatBakingScore(value) {
  return typeof value === 'number' ? Math.round(value).toString() : '—';
}

// ===== JUDGING UI FUNCTIONS =====

function roundScore(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatScore(value) {
  const rounded = roundScore(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function averageScore(values) {
  const safeValues = Array.isArray(values) ? values.map((value) => Number(value) || 0) : [];
  if (!safeValues.length) {
    return 0;
  }

  return safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length;
}

function getJudgingResult(teamId) {
  return judgingResults.find((entry) => entry.teamId === teamId) || null;
}

function getJudgingDraft(teamId) {
  return judgingDraftScores[String(teamId)] || { taste: 0, accuracy: 0, creativity: 0 };
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

function syncJudgingDraftScores(overwrite) {
  const nextDrafts = {};
  const nextJudgedIds = new Set();

  teams.forEach((team) => {
    const result = getJudgingResult(team.id);
    const savedScores = result?.scores || {};
    const existingDraft = getJudgingDraft(team.id);

    nextDrafts[String(team.id)] = overwrite || !judgingDraftScores[String(team.id)]
      ? {
          taste: Number(savedScores.taste) || 0,
          accuracy: Number(savedScores.accuracy) || 0,
          creativity: Number(savedScores.creativity) || 0
        }
      : existingDraft;

    if (result?.hasPhysicalScores) {
      nextJudgedIds.add(team.id);
    }
  });

  judgingDraftScores = nextDrafts;
  judgedTeamIds = nextJudgedIds;
}

function updateJudgingCardPreview(teamId) {
  const previewElement = document.getElementById(`judging-preview-${teamId}`);
  const stateElement = document.getElementById(`judging-submit-state-${teamId}`);
  const draft = getJudgingDraft(teamId);
  const result = getJudgingResult(teamId);
  const virtualScores = result?.scores?.virtualScores;
  const physicalAverage = roundScore(averageScore([draft.taste, draft.accuracy, draft.creativity]));
  const finalPreview = virtualScores
    ? roundScore(averageScore([physicalAverage, getVirtualAverage(virtualScores)]))
    : physicalAverage;

  ['taste', 'accuracy', 'creativity'].forEach((dimension) => {
    const valueElement = document.getElementById(`judging-${dimension}-value-${teamId}`);
    if (valueElement) {
      valueElement.textContent = String(Number(draft[dimension]) || 0);
    }
  });

  if (previewElement) {
    previewElement.textContent = formatScore(finalPreview);
  }

  if (stateElement) {
    stateElement.textContent = judgedTeamIds.has(teamId) ? 'Submitted to server' : 'Draft only — submit when ready';
  }
}

function updateRevealResultsState() {
  if (revealResultsBtn) {
    revealResultsBtn.disabled = !(allTeamsJudged && judgingResults.length > 0);
  }

  if (judgingStatusText) {
    judgingStatusText.textContent = allTeamsJudged
      ? 'All teams scored — reveal is ready.'
      : 'Submit physical scores for every team to unlock reveal.';
  }
}

function renderStandingsMarkup(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return '<div class="text-muted">No judging data yet.</div>';
  }

  return `
    <div class="judging-standing-list">
      ${results.map((entry) => `
        <div class="judging-standing-row">
          <div class="flex gap-md flex-center">
            <span class="judging-standing-rank">#${entry.rank}</span>
            <div>
              <strong>${escapeHtml(entry.teamName)}</strong>
              <div class="text-muted text-small">${entry.isVirtualTeam ? 'Virtual hybrid score' : 'Physical judging score'}</div>
            </div>
          </div>
          <strong>${formatScore(entry.scores?.total)}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function renderJudgingResultsPreview() {
  if (!judgingResultsPreview) {
    return;
  }

  judgingResultsPreview.innerHTML = `
    <h3>Live Standings Preview</h3>
    ${renderStandingsMarkup(judgingResults)}
  `;
}

function renderResultsStandings() {
  if (!resultsStandings) {
    return;
  }

  resultsStandings.innerHTML = `
    <h3>Standings</h3>
    ${renderStandingsMarkup(judgingResults)}
  `;
}

function renderJudgingPanels() {
  if (!judgingTeamPanels) {
    return;
  }

  if (!teams.length) {
    allTeamsJudged = false;
    judgingTeamPanels.innerHTML = '<div class="text-muted text-center">No teams available for judging.</div>';
    updateRevealResultsState();
    return;
  }

  syncJudgingDraftScores(false);
  allTeamsJudged = teams.length > 0 && judgedTeamIds.size === teams.length;

  judgingTeamPanels.innerHTML = teams.map((team) => {
    const draft = getJudgingDraft(team.id);
    const result = getJudgingResult(team.id);
    const virtualScores = result?.scores?.virtualScores;
    const physicalAverage = roundScore(averageScore([draft.taste, draft.accuracy, draft.creativity]));
    const finalPreview = virtualScores
      ? roundScore(averageScore([physicalAverage, getVirtualAverage(virtualScores)]))
      : physicalAverage;

    return `
      <article class="judging-team-card ${team.isVirtual ? 'virtual-team' : ''}">
        <div class="judging-team-header">
          <div>
            <h3>${escapeHtml(team.name)}</h3>
            <div class="text-muted text-small">${team.isVirtual ? 'Virtual team · hybrid scoring' : 'Physical team · judging only'}</div>
          </div>
          <div>
            <div class="text-muted text-small">${team.isVirtual ? 'Hybrid preview' : 'Live total'}</div>
            <div class="judging-preview-total" id="judging-preview-${team.id}">${formatScore(finalPreview)}</div>
          </div>
        </div>

        ${['taste', 'accuracy', 'creativity'].map((dimension) => `
          <label class="judging-slider-group">
            <span class="judging-slider-label">
              <span>${escapeHtml(dimension.charAt(0).toUpperCase() + dimension.slice(1))}</span>
              <strong id="judging-${dimension}-value-${team.id}">${Number(draft[dimension]) || 0}</strong>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value="${Number(draft[dimension]) || 0}"
              class="judging-range"
              data-team-id="${team.id}"
              data-dimension="${dimension}"
            >
          </label>
        `).join('')}

        ${virtualScores ? `
          <div class="judging-virtual-panel">
            <h4>Virtual Cake Scores</h4>
            <div class="judging-virtual-score-line"><span>Taste</span><strong>${formatScore(virtualScores.taste)}</strong></div>
            <div class="judging-virtual-score-line"><span>Accuracy</span><strong>${formatScore(virtualScores.accuracy)}</strong></div>
            <div class="judging-virtual-score-line"><span>Creativity</span><strong>${formatScore(virtualScores.creativity)}</strong></div>
            <div class="judging-virtual-score-line"><span>Virtual average</span><strong>${formatScore(getVirtualAverage(virtualScores))}</strong></div>
          </div>
        ` : ''}

        <div class="judging-actions">
          <span class="judging-submit-state" id="judging-submit-state-${team.id}">${judgedTeamIds.has(team.id) ? 'Submitted to server' : 'Draft only — submit when ready'}</span>
          <button class="btn btn-primary judging-submit-btn" data-team-id="${team.id}">Submit Scores</button>
        </div>
      </article>
    `;
  }).join('');

  updateRevealResultsState();
}

function initializeJudgingUI() {
  syncJudgingDraftScores(false);
  renderJudgingPanels();
  renderJudgingResultsPreview();
  renderResultsStandings();
  updateRevealResultsState();
  renderCakeGallery();
  socket.emit('judging:get-results');
}

function initializeResultsUI() {
  renderJudgingResultsPreview();
  renderResultsStandings();
  updateRevealResultsState();
  renderCakeGallery();
  socket.emit('judging:get-results');
}

// Global functions for onclick handlers
window.approvePurchaseRequest = function approvePurchaseRequest(teamId, itemKey, btn) {
  socket.emit('shop:purchase', { teamId, itemKey });
  const card = btn.closest('.purchase-request-card');
  if (card) {
    card.remove();
  }
  updatePurchaseRequestPlaceholder();
};

window.denyPurchaseRequest = function denyPurchaseRequest(btn) {
  const card = btn.closest('.purchase-request-card');
  if (card) {
    const teamId = Number(card.dataset.teamId);
    const itemKey = card.dataset.itemKey;
    socket.emit('shop:deny-purchase-request', { teamId, itemKey });
    card.remove();
  }
  updatePurchaseRequestPlaceholder();
};

window.scoreTeamAnswer = function scoreTeamAnswer(teamId, correct) {
  if (!currentQuestionId) {
    showNotification('No active question', 'error');
    return;
  }

  socket.emit('trivia:score-answer', {
    teamId,
    questionId: currentQuestionId,
    correct
  });
};

window.selectJeopardyQuestion = function selectJeopardyQuestion(category, value) {
  socket.emit('trivia:select-jeopardy', { category, value });
};

window.revealAnswer = function revealAnswer() {
  if (!currentQuestionId) {
    showNotification('No active question', 'error');
    return;
  }

  socket.emit('trivia:reveal-answer');
};

// ===== Event Listeners =====

addTeamBtn.addEventListener('click', () => {
  const name = teamNameInput.value.trim();
  const isVirtual = teamVirtualCheckbox.checked;

  if (!name) {
    showNotification('Please enter a team name', 'error');
    return;
  }

  if (teams.some((team) => team.name.toLowerCase() === name.toLowerCase())) {
    showNotification('A team with that name already exists', 'error');
    return;
  }

  socket.emit('join-team', { name, isVirtual });

  teamNameInput.value = '';
  teamVirtualCheckbox.checked = false;
  teamNameInput.focus();
});

teamNameInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    addTeamBtn.click();
  }
});

startGameBtn.addEventListener('click', () => {
  if (teams.length === 0) {
    showNotification('Add at least one team before starting', 'error');
    return;
  }

  socket.emit('set-phase', 'TRIVIA');
});

if (openShopBtn) {
  openShopBtn.addEventListener('click', () => {
    socket.emit('shop:open');
  });
}

if (shopTeamSelect) {
  shopTeamSelect.addEventListener('change', (event) => {
    selectedShopTeamId = Number(event.target.value) || null;
    renderShopTeamSelect();
    renderShopCatalog();
    renderShopTeamSummary();
  });
}

if (closeShopBtn) {
  closeShopBtn.addEventListener('click', () => {
    socket.emit('shop:close');
  });
}

if (startBakingBtn) {
  startBakingBtn.addEventListener('click', () => {
    const durationSec = Number(bakingDurationInput?.value) || 300;
    const activeVirtualTeam = teams.find((team) => team.isVirtual) || teams[0] || null;
    socket.emit('baking:start', { durationSec, teamId: activeVirtualTeam?.id || null });
  });
}

if (pauseBakingBtn) {
  pauseBakingBtn.addEventListener('click', () => {
    socket.emit('baking:pause');
  });
}

if (resumeBakingBtn) {
  resumeBakingBtn.addEventListener('click', () => {
    socket.emit('baking:resume');
  });
}

if (generateGalleryBtn) {
  generateGalleryBtn.addEventListener('click', () => {
    const activeTeam = getActiveVirtualTeam();
    if (!activeTeam) {
      showNotification('Add or select a virtual team before generating a gallery.', 'error');
      return;
    }

    showLoadingOverlay('Generating cake gallery...');
    socket.emit('baking:generate-gallery', { teamId: activeTeam.id });
  });
}

if (cakeGalleryGrid) {
  cakeGalleryGrid.addEventListener('click', (event) => {
    const card = event.target.closest('[data-image-path]');
    if (!card) {
      return;
    }

    cakeGalleryState.selectedImagePath = card.dataset.imagePath || '';
    renderCakeGallery();
  });
}

if (revealCakeBtn) {
  revealCakeBtn.addEventListener('click', () => {
    if (!cakeGalleryState.selectedImagePath) {
      showNotification('Choose a cake image before revealing it.', 'error');
      return;
    }

    socket.emit('results:cake-reveal', {
      cakeImagePath: cakeGalleryState.selectedImagePath,
      scores: cakeGalleryState.scores || { taste: 0, accuracy: 0, creativity: 0, total: 0 },
      chaosEvents: cakeGalleryState.chaosEvents.length ? cakeGalleryState.chaosEvents : getCurrentChaosSummary(),
      teamId: cakeGalleryState.teamId || getActiveVirtualTeam()?.id || null
    });
  });
}

if (shopOverrideBtn) {
  shopOverrideBtn.addEventListener('click', () => {
    if (!pendingShopApproval || typeof pendingShopApproval.purchaseId !== 'number') {
      showNotification('No pending override to approve.', 'error');
      return;
    }

    socket.emit('shop:force-approve', { purchaseId: pendingShopApproval.purchaseId });
  });
}

if (shopWarningCancelBtn) {
  shopWarningCancelBtn.addEventListener('click', () => {
    pendingShopApproval = null;
    closeShopWarningModal();
  });
}

if (triviaModeToggle) {
  triviaModeToggle.addEventListener('click', () => {
    const newMode = currentMode === 'SLIDE' ? 'JEOPARDY' : 'SLIDE';
    socket.emit('trivia:switch-mode', { mode: newMode });
  });
}

if (nextSlideBtn) {
  nextSlideBtn.addEventListener('click', () => {
    socket.emit('trivia:next-slide');
  });
}

if (forceAnswerBtn) {
  forceAnswerBtn.addEventListener('click', () => {
    socket.emit('trivia:force-answer');
  });
}

if (forceAnswerJeopardyBtn) {
  forceAnswerJeopardyBtn.addEventListener('click', () => {
    socket.emit('trivia:force-answer');
  });
}

if (judgingTeamPanels) {
  judgingTeamPanels.addEventListener('input', (event) => {
    const slider = event.target.closest('.judging-range');
    if (!slider) {
      return;
    }

    const teamId = Number(slider.dataset.teamId);
    const dimension = slider.dataset.dimension;
    if (!teamId || !['taste', 'accuracy', 'creativity'].includes(dimension)) {
      return;
    }

    judgingDraftScores[String(teamId)] = {
      ...getJudgingDraft(teamId),
      [dimension]: Number(slider.value) || 0
    };
    updateJudgingCardPreview(teamId);
  });

  judgingTeamPanels.addEventListener('click', (event) => {
    const submitButton = event.target.closest('.judging-submit-btn');
    if (!submitButton) {
      return;
    }

    const teamId = Number(submitButton.dataset.teamId);
    if (!teamId) {
      showNotification('Missing team for judging submission.', 'error');
      return;
    }

    const draft = getJudgingDraft(teamId);
    socket.emit('judging:score-team', {
      teamId,
      taste: Number(draft.taste) || 0,
      accuracy: Number(draft.accuracy) || 0,
      creativity: Number(draft.creativity) || 0
    });
  });
}

if (revealResultsBtn) {
  revealResultsBtn.addEventListener('click', () => {
    if (!allTeamsJudged) {
      showNotification('Score every team before revealing results.', 'error');
      return;
    }

    socket.emit('results:reveal');
  });
}

console.log('Host client initialized');
