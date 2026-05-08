const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { initDb } = require('./db');

// Valid phase transitions
const PHASES = ['LOBBY', 'TRIVIA', 'SHOP', 'BAKING', 'JUDGING', 'RESULTS'];
const PHASE_TRANSITIONS = {
  'LOBBY': ['TRIVIA'],
  'TRIVIA': ['SHOP'],
  'SHOP': ['BAKING'],
  'BAKING': ['JUDGING'],
  'JUDGING': ['RESULTS'],
  'RESULTS': ['LOBBY'] // Can restart the game
};

/**
 * Create Express + Socket.io app
 * @param {object} options - Configuration options
 * @param {string} options.dbPath - Path to SQLite database (default: ./data/game.db)
 * @param {number} options.port - Port to listen on (default: 3001)
 * @returns {object} { app, server, io, db }
 */
function createApp(options = {}) {
  const dbPath = options.dbPath || path.join(__dirname, '../data/game.db');
  const port = options.port || 3001;
  
  // Initialize database
  const db = initDb(dbPath);
  
  // Initialize phase if not set
  if (!db.getState('phase')) {
    db.setState('phase', 'LOBBY');
  }
  
  // Create Express app
  const app = express();
  const server = createServer(app);
  const io = new Server(server);
  
  // Serve static files from public directory
  app.use(express.static(path.join(__dirname, '../public')));
  
  // Socket.io connection handling
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    // Handle room joining
    socket.on('join-room', (role) => {
      if (!['host', 'screen', 'player'].includes(role)) {
        socket.emit('error', { message: 'Invalid role. Must be host, screen, or player.' });
        return;
      }
      
      // Leave all rooms first
      socket.rooms.forEach(room => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });
      
      // Join the requested room
      socket.join(role);
      console.log(`Socket ${socket.id} joined room: ${role}`);
      
      // Send confirmation
      socket.emit('room-joined', { role });
      
      // Log event
      db.logEvent('client-joined', { socketId: socket.id, role });
    });
    
    // Handle phase changes (host only)
    socket.on('set-phase', (newPhase) => {
      try {
        // Check if socket is in host room
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can change phases.' });
          return;
        }
        
        // Validate phase
        if (typeof newPhase !== 'string' || !PHASES.includes(newPhase)) {
          socket.emit('error', { message: `Invalid phase: ${newPhase}. Valid phases: ${PHASES.join(', ')}` });
          return;
        }
        
        // Get current phase
        const currentPhase = db.getState('phase');
        
        // Validate transition
        const allowedTransitions = PHASE_TRANSITIONS[currentPhase] || [];
        if (!allowedTransitions.includes(newPhase)) {
          socket.emit('error', { 
            message: `Invalid transition from ${currentPhase} to ${newPhase}. Allowed: ${allowedTransitions.join(', ')}` 
          });
          return;
        }
        
        // Update phase
        db.setState('phase', newPhase);
        console.log(`Phase changed: ${currentPhase} → ${newPhase}`);
        
        // Log event
        db.logEvent('phase-changed', { from: currentPhase, to: newPhase });
        
        // Broadcast to all clients
        io.emit('phase-changed', { phase: newPhase, previousPhase: currentPhase });
      } catch (err) {
        console.error('Failed to change phase:', err);
        socket.emit('error', { message: 'Server error. Please try again.' });
      }
    });
    
    // Handle state requests
    socket.on('get-state', () => {
      try {
        const phase = db.getState('phase');
        const teams = db.getTeams();
        
        // Transform teams to match client expectations
        const transformedTeams = teams.map(team => ({
          id: team.id,
          name: team.name,
          money: team.money,
          isVirtual: team.is_virtual_team === 1,
          createdAt: team.created_at
        }));
        
        socket.emit('state', {
          phase,
          teams: transformedTeams
        });
      } catch (err) {
        console.error('Failed to get state:', err);
        socket.emit('error', { message: 'Server error retrieving state.' });
      }
    });
    
    // Handle team joining (lobby phase)
    socket.on('join-team', (data) => {
      try {
        const { name, isVirtual } = data;
        
        // Validate input
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          socket.emit('error', { message: 'Team name is required.' });
          return;
        }
        
        if (name.trim().length > 50) {
          socket.emit('error', { message: 'Team name must be 50 characters or less.' });
          return;
        }
        
        // Create team in database
        const team = db.createTeam(name.trim(), isVirtual || false);
        console.log(`Team created: ${team.name} (${team.is_virtual_team ? 'virtual' : 'physical'})`);
        
        // Transform team data for client
        const transformedTeam = {
          id: team.id,
          name: team.name,
          money: team.money,
          isVirtual: team.is_virtual_team === 1,
          createdAt: team.created_at
        };
        
        // Log event
        db.logEvent('team-joined', { teamId: team.id, name: team.name, isVirtual: team.is_virtual_team === 1 });
        
        // Broadcast to all clients that a team joined
        io.emit('team-joined', transformedTeam);
        
        // Get all teams and broadcast updated list
        const teams = db.getTeams();
        const transformedTeams = teams.map(t => ({
          id: t.id,
          name: t.name,
          money: t.money,
          isVirtual: t.is_virtual_team === 1,
          createdAt: t.created_at
        }));
        
        io.emit('teams-updated', transformedTeams);
      } catch (err) {
        console.error('Failed to create team:', err);
        
        // Check for unique constraint violation
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
          socket.emit('error', { message: 'A team with that name already exists.' });
        } else {
          socket.emit('error', { message: 'Server error creating team.' });
        }
      }
    });
    
    // Handle start game (host only, transitions from LOBBY to TRIVIA)
    socket.on('start-game', () => {
      try {
        // Check if socket is in host room
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can start the game.' });
          return;
        }
        
        // Check current phase
        const currentPhase = db.getState('phase');
        if (currentPhase !== 'LOBBY') {
          socket.emit('error', { message: 'Game can only be started from LOBBY phase.' });
          return;
        }
        
        // Check if there are teams
        const teams = db.getTeams();
        if (teams.length === 0) {
          socket.emit('error', { message: 'At least one team is required to start the game.' });
          return;
        }
        
        // Transition to TRIVIA phase (use set-phase logic)
        db.setState('phase', 'TRIVIA');
        console.log('Game started: LOBBY → TRIVIA');
        
        // Log event
        db.logEvent('game-started', { teamCount: teams.length });
        
        // Broadcast to all clients
        io.emit('phase-changed', { phase: 'TRIVIA', previousPhase: 'LOBBY' });
      } catch (err) {
        console.error('Failed to start game:', err);
        socket.emit('error', { message: 'Server error starting game.' });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      db.logEvent('client-disconnected', { socketId: socket.id });
    });
  });
  
  return {
    app,
    server,
    io,
    db,
    port,
    
    /**
     * Start the server
     * @returns {Promise} Resolves when server is listening
     */
    listen() {
      return new Promise((resolve) => {
        server.listen(port, () => {
          console.log(`Server listening on http://localhost:${port}`);
          resolve();
        });
      });
    },
    
    /**
     * Stop the server and close database
     * @returns {Promise} Resolves when server is closed
     */
    close() {
      return new Promise((resolve) => {
        server.close(() => {
          db.close();
          resolve();
        });
      });
    }
  };
}

// Run server if this file is executed directly
if (require.main === module) {
  const app = createApp();
  app.listen();
}

module.exports = { createApp };
