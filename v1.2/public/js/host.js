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

// State
let currentPhase = 'LOBBY';
let teams = [];

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

// ===== Initialization =====

console.log('Host client initialized');
