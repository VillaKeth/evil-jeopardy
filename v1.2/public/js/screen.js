// Evil Jeopardy 1.2 - Screen Client Script (for projection display)

// Initialize Socket.io connection
const socket = io();

// DOM elements
const phaseIndicator = document.getElementById('phase-indicator');
const phaseText = document.getElementById('phase-text');
const connectionStatus = document.getElementById('connection-status');
const teamsList = document.getElementById('teams-list');

// State
let currentPhase = 'LOBBY';
let teams = [];

// ===== Socket Event Handlers =====

socket.on('connect', () => {
  console.log('Connected to server');
  updateConnectionStatus('Connected', 'success');
  
  // Join as screen
  socket.emit('join-room', 'screen');
  
  // Request current state
  socket.emit('get-state');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  updateConnectionStatus('Disconnected', 'error');
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

socket.on('teams-updated', (updatedTeams) => {
  console.log('Teams updated:', updatedTeams);
  teams = updatedTeams;
  renderTeamsList();
});

socket.on('error', (error) => {
  console.error('Server error:', error);
});

// ===== UI Updates =====

function updateConnectionStatus(message, type) {
  const statusSpan = connectionStatus.querySelector('span');
  statusSpan.textContent = message;
  connectionStatus.className = `status status-${type}`;
  connectionStatus.style.position = 'fixed';
  connectionStatus.style.top = '20px';
  connectionStatus.style.right = '20px';
  connectionStatus.style.zIndex = '1000';
  
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
    teamsList.innerHTML = `
      <li class="text-muted text-center" style="font-size: 1.5rem;">
        No teams connected yet
      </li>
    `;
  } else {
    teamsList.innerHTML = teams.map(team => `
      <li class="team-item">
        <div>
          <span class="team-name">${escapeHtml(team.name)}</span>
          ${team.isVirtual ? '<span class="team-badge virtual">Virtual</span>' : '<span class="team-badge physical">Physical</span>'}
        </div>
      </li>
    `).join('');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== Initialization =====

console.log('Screen client initialized');
