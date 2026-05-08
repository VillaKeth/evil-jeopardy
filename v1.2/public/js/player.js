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

// State
let currentPhase = 'LOBBY';
let myTeam = null;
let allTeams = [];

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
  allTeams = data.teams || [];
  
  updatePhaseUI(data.phase);
  renderOtherTeamsList();
});

socket.on('team-joined', (team) => {
  console.log('Team joined:', team);
  
  // Check if this is our team (by matching the name we just submitted)
  if (myTeam && team.name === myTeam.name) {
    myTeam = team;
    showTeamDisplay();
  }
});

socket.on('teams-updated', (updatedTeams) => {
  console.log('Teams updated:', updatedTeams);
  allTeams = updatedTeams;
  renderOtherTeamsList();
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

function showTeamDisplay() {
  joinForm.classList.add('hidden');
  teamDisplay.classList.remove('hidden');
  teamNameDisplay.textContent = myTeam.name;
}

function renderOtherTeamsList() {
  // Filter out our team
  const otherTeams = allTeams.filter(team => !myTeam || team.id !== myTeam.id);
  
  if (otherTeams.length === 0) {
    otherTeamsList.innerHTML = '<li class="text-muted text-center">No other teams yet...</li>';
  } else {
    otherTeamsList.innerHTML = otherTeams.map(team => `
      <li class="team-item">
        <div>
          <span class="team-name">${escapeHtml(team.name)}</span>
          ${team.isVirtual ? '<span class="team-badge virtual">Virtual</span>' : '<span class="team-badge physical">Physical</span>'}
        </div>
      </li>
    `).join('');
  }
}

function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.className = `status status-${type}`;
  notification.style.position = 'fixed';
  notification.style.top = '80px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.zIndex = '9999';
  notification.style.minWidth = '300px';
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

joinTeamBtn.addEventListener('click', () => {
  const name = playerTeamNameInput.value.trim();
  
  if (!name) {
    showNotification('Please enter a team name', 'error');
    return;
  }
  
  // Check for duplicate names
  if (allTeams.some(team => team.name.toLowerCase() === name.toLowerCase())) {
    showNotification('A team with that name already exists', 'error');
    return;
  }
  
  // Store our team info (will be confirmed when team-joined event arrives)
  myTeam = { name, isVirtual: true };
  
  // Emit join-team event (all virtual players are virtual teams)
  socket.emit('join-team', { name, isVirtual: true });
  
  // Disable button while waiting
  joinTeamBtn.disabled = true;
  joinTeamBtn.textContent = 'Joining...';
});

// Allow Enter key to join
playerTeamNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinTeamBtn.click();
  }
});

// ===== Initialization =====

console.log('Player client initialized');
