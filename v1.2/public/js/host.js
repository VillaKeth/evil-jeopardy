// Evil Jeopardy 1.2 - Host Client Script

// Initialize Socket.io connection
const socket = io();

// DOM elements
const phaseIndicator = document.getElementById('phase-indicator');
const phaseText = document.getElementById('phase-text');
const connectionStatus = document.getElementById('connection-status');
const teamsList = document.getElementById('teams-list');
const teamNameInput = document.getElementById('team-name');
const teamVirtualCheckbox = document.getElementById('team-virtual');
const addTeamBtn = document.getElementById('add-team-btn');
const startGameBtn = document.getElementById('start-game-btn');

// Trivia DOM elements
const triviaScoreboard = document.getElementById('trivia-scoreboard');
const triviaModeToggle = document.getElementById('trivia-mode-toggle');
const triviaCurrentMode = document.getElementById('trivia-current-mode');
const slideModeSection = document.getElementById('slide-mode-section');
const jeopardyModeSection = document.getElementById('jeopardy-mode-section');

// Slide mode elements
const slideQuestionDisplay = document.getElementById('slide-question-display');
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

// ===== Socket Event Handlers =====

socket.on('connect', () => {
  console.log('Connected to server');
  updateConnectionStatus('Connected', 'success');
  
  // Join as host
  socket.emit('join-room', 'host');
  
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
  teams = data.teams || [];
  
  updatePhaseUI(data.phase);
  renderTeamsList();
});

socket.on('team-joined', (team) => {
  console.log('Team joined:', team);
  showNotification(`Team "${team.name}" joined!`, 'success');
});

socket.on('teams-updated', (updatedTeams) => {
  console.log('Teams updated:', updatedTeams);
  teams = updatedTeams;
  renderTeamsList();
});

socket.on('error', (error) => {
  console.error('Server error:', error);
  showNotification(error.message || 'An error occurred', 'error');
});

// ===== TRIVIA EVENT HANDLERS =====

socket.on('trivia:question-shown', (data) => {
  console.log('Question shown:', data);
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
  teams = scoreboard;
  renderTriviaScoreboard();
  renderTeamAnswerButtons();
});

socket.on('trivia:buzz-received', (data) => {
  console.log('Buzz received:', data);
  showBuzzNotification(data.teamName);
  highlightBuzzedTeam(data.teamId);
});

socket.on('trivia:answer-result', (data) => {
  console.log('Answer result:', data);
  answeredTeams.add(data.teamId);
  renderTeamAnswerButtons();
  showNotification(
    `Team answered ${data.correct ? 'correctly' : 'incorrectly'}! New balance: $${data.newBalance}`,
    data.correct ? 'success' : 'error'
  );
});

socket.on('trivia:force-answer-required', (data) => {
  console.log('Force answer required:', data);
  data.teamIds.forEach(id => forcedTeams.add(id));
  renderTeamAnswerButtons();
  showNotification('All teams must answer!', 'warning');
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

// ===== UI Updates =====

function updateConnectionStatus(message, type) {
  connectionStatus.innerHTML = `<span>${message}</span>`;
  connectionStatus.className = `status status-${type}`;
  
  // Hide after 3 seconds if success
  if (type === 'success') {
    setTimeout(() => {
      connectionStatus.classList.add('hidden');
    }, 3000);
  }
}

function updatePhaseUI(phase) {
  // Update indicator
  phaseText.textContent = phase;
  phaseIndicator.className = `phase-indicator phase-${phase}`;
  
  // Hide all phase sections
  document.querySelectorAll('.phase-section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Show current phase section
  const sectionId = `${phase.toLowerCase()}-section`;
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.add('active');
  }
  
  // If entering trivia phase, initialize trivia UI
  if (phase === 'TRIVIA') {
    initializeTriviaUI();
  }
}

function renderTeamsList() {
  if (teams.length === 0) {
    teamsList.innerHTML = '<li class="text-muted text-center">No teams connected yet...</li>';
    startGameBtn.disabled = true;
  } else {
    teamsList.innerHTML = teams.map(team => `
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
}

function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.className = `status status-${type}`;
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.zIndex = '9999';
  notification.innerHTML = `<span>${message}</span>`;
  
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

// ===== TRIVIA UI FUNCTIONS =====

function initializeTriviaUI() {
  // Request current scoreboard
  socket.emit('get-state');
  
  // Request board state if in jeopardy mode
  if (currentMode === 'JEOPARDY') {
    socket.emit('trivia:get-board');
  }
  
  renderTriviaScoreboard();
  updateTriviaMode(currentMode);
}

function renderTriviaScoreboard() {
  if (!teams || teams.length === 0) {
    triviaScoreboard.innerHTML = '<div class="text-muted text-center">No teams yet</div>';
    return;
  }
  
  triviaScoreboard.innerHTML = teams.map(team => `
    <div class="score-card">
      <div class="score-team">${escapeHtml(team.name)}</div>
      <div class="score-value">$${team.money}</div>
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

function displaySlideQuestion(question) {
  slideQuestionDisplay.innerHTML = `
    <h3>${escapeHtml(question.question)}</h3>
    ${question.value ? `<p class="text-muted mt-2">Value: $${question.value}</p>` : ''}
  `;
  
  // Handle media
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
    ${question.value ? `<p class="text-muted mt-2">Value: $${question.value}</p>` : ''}
  `;
  
  // Handle media
  if (question.media) {
    displayMedia(jeopardyMediaArea, question.media);
  } else {
    jeopardyMediaArea.classList.add('hidden');
    jeopardyMediaArea.innerHTML = '';
  }
  
  // Show question and answer cards
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
  
  const html = teams.map(team => {
    const hasAnswered = answeredTeams.has(team.id);
    const mustAnswer = forcedTeams.has(team.id);
    
    return `
      <div class="team-answer-item ${mustAnswer ? 'must-answer' : ''}" data-team-id="${team.id}">
        <div class="team-answer-header">
          <span>${escapeHtml(team.name)}</span>
          <span class="team-answer-money">$${team.money}</span>
        </div>
        ${hasAnswered ? 
          '<div class="team-answer-status">Already answered</div>' :
          `<div class="team-answer-buttons">
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
  
  // Render category headers
  board.forEach(category => {
    html += `<div class="jeopardy-category">${escapeHtml(category.name)}</div>`;
  });
  
  // Find max questions in any category
  const maxQuestions = Math.max(...board.map(cat => cat.questions.length));
  
  // Render questions row by row
  for (let i = 0; i < maxQuestions; i++) {
    board.forEach(category => {
      const question = category.questions[i];
      if (question) {
        const answeredClass = question.answered ? 'answered' : '';
        html += `
          <div class="jeopardy-cell ${answeredClass}" 
               onclick="${question.answered ? '' : `selectJeopardyQuestion('${escapeHtml(category.name)}', ${question.value})`}">
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
  // Remove existing highlights
  document.querySelectorAll('.team-answer-item.buzzed').forEach(el => {
    el.classList.remove('buzzed');
  });
  
  // Add highlight to buzzed team
  document.querySelectorAll(`.team-answer-item[data-team-id="${teamId}"]`).forEach(el => {
    el.classList.add('buzzed');
  });
}

// Global functions for onclick handlers
window.scoreTeamAnswer = function(teamId, correct) {
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

window.selectJeopardyQuestion = function(category, value) {
  socket.emit('trivia:select-jeopardy', { category, value });
};

// ===== Event Listeners =====

addTeamBtn.addEventListener('click', () => {
  const name = teamNameInput.value.trim();
  const isVirtual = teamVirtualCheckbox.checked;
  
  if (!name) {
    showNotification('Please enter a team name', 'error');
    return;
  }
  
  // Check for duplicate names
  if (teams.some(team => team.name.toLowerCase() === name.toLowerCase())) {
    showNotification('A team with that name already exists', 'error');
    return;
  }
  
  // Emit join-team event
  socket.emit('join-team', { name, isVirtual });
  
  // Clear form
  teamNameInput.value = '';
  teamVirtualCheckbox.checked = false;
  teamNameInput.focus();
});

// Allow Enter key to add team
teamNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addTeamBtn.click();
  }
});

startGameBtn.addEventListener('click', () => {
  if (teams.length === 0) {
    showNotification('Add at least one team before starting', 'error');
    return;
  }
  
  // Transition to TRIVIA phase
  socket.emit('set-phase', 'TRIVIA');
});

// ===== TRIVIA EVENT LISTENERS =====

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

// ===== Initialization =====

console.log('Host client initialized');
