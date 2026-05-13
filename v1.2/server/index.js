const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const { initDb } = require('./db');
const { startBaking, pauseBaking, resumeBaking, getTimeRemaining, completePhase, getPhaseScores, getApprovedPurchases, calculateFinalScores } = require('./baking');
const cakeGenerator = require('./cake-generator');
const {
  loadQuestions,
  getSlideQuestion,
  getJeopardyQuestion,
  markAnswered,
  isAnswered,
  getBoard,
  resetAnswered,
  getAllSlides,
  getSlideCount,
  scoreAnswer,
  awardIngredient,
  forceAllAnswer,
  getScoreboard
} = require('./trivia');
const { loadShop, purchaseItem, forceApprove, getTeamInventory, getTeamPurchases } = require('./shop');
const { scorePhysicalCake, getResults, ensureJudgingSchema } = require('./judging');
const evilLuck = require('./evil-luck');
const minigamesConfig = require('../data/minigames.json');

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

const BAKING_PHASE_ORDER = ['prep', 'mix', 'bake', 'cool', 'decorate', 'present'];
const MINIGAME_DETAILS = {
  'prep-measure': {
    sceneKey: 'PrepScene',
    description: 'Measure the core ingredients before the kitchen gets messy.'
  },
  'mix-circular': {
    sceneKey: 'MixScene',
    description: 'Keep the batter moving smoothly to build a stable mix.'
  },
  'bake-temperature': {
    sceneKey: 'BakeScene',
    description: 'Hold the oven in the sweet spot and avoid a scorched disaster.'
  },
  'cool-patience': {
    sceneKey: 'CoolScene',
    description: 'Cool the cake carefully so the structure stays intact.'
  },
  'decorate-freeform': {
    sceneKey: 'DecorateScene',
    description: 'Turn raw frosting into a cake worth showing off.'
  },
  'present-arrange': {
    sceneKey: 'PresentScene',
    description: 'Plate the cake cleanly and sell the final presentation.'
  },
  'mix-cow-combat': {
    sceneKey: 'CowCombatScene',
    description: 'Battle the bovine chaos while somehow still mixing batter.'
  },
  'bake-racing': {
    sceneKey: 'RacingOvenScene',
    description: 'Race the runaway oven before the bake gets away from you.'
  },
  'cool-jewel-sort': {
    sceneKey: 'JewelSortScene',
    description: 'Sort the cooling gems before the cake cracks apart.'
  },
  'decorate-gravity-flip': {
    sceneKey: 'GravityFlipScene',
    description: 'Decorate while gravity keeps changing its mind.'
  },
  'present-obstacle-course': {
    sceneKey: 'ObstacleCourseScene',
    description: 'Carry the final cake through a ridiculous finishing gauntlet.'
  }
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
  
  ensureJudgingSchema(db.db);

  // Initialize phase if not set
  if (!db.getState('phase')) {
    db.setState('phase', 'LOBBY');
  }
  
  // Load trivia questions
  const questionsPath = path.join(__dirname, '../data/questions.json');
  try {
    loadQuestions(questionsPath);
    console.log('Trivia questions loaded successfully');
  } catch (error) {
    console.error('Failed to load trivia questions:', error.message);
  }

  // Load shop data
  const shopPath = path.join(__dirname, '../data/shop.json');
  let shopData = null;
  try {
    shopData = loadShop(shopPath);
    console.log('Shop data loaded successfully');
  } catch (error) {
    console.error('Failed to load shop data:', error.message);
  }
  
  // Create Express app
  const app = express();
  const server = createServer(app);
  const io = new Server(server);
  
  // Serve static files from public directory
  app.use(express.static(path.join(__dirname, '../public')));
  
  // Baking timer interval
  let bakingTimerInterval = null;

  function transformTeam(team) {
    return {
      id: team.id,
      name: team.name,
      money: team.money,
      isVirtual: team.is_virtual_team === 1,
      createdAt: team.created_at
    };
  }

  function getSerializedTeams() {
    return db.getTeams().map(transformTeam);
  }

  function getShopItem(itemKey) {
    if (!shopData || !Array.isArray(shopData.categories)) {
      return null;
    }

    for (const category of shopData.categories) {
      const item = category.items.find((entry) => entry.key === itemKey);
      if (item) {
        return {
          ...item,
          category: category.key,
          categoryName: category.name
        };
      }
    }

    return null;
  }

  function getPendingShopPurchases() {
    return db.db.prepare('SELECT * FROM pending_purchases WHERE status = ? ORDER BY created_at DESC').all('pending');
  }

  function buildShopCatalogPayload() {
    const teams = getSerializedTeams();
    const inventories = {};
    const purchaseHistories = {};

    teams.forEach((team) => {
      inventories[String(team.id)] = getTeamInventory(db.db, team.id);
      purchaseHistories[String(team.id)] = getTeamPurchases(db.db, team.id);
    });

    return {
      ...(shopData || { categories: [], defaultKit: [] }),
      teams,
      inventories,
      purchaseHistories,
      pendingPurchases: getPendingShopPurchases()
    };
  }

  function emitTeamsUpdated(target = io) {
    target.emit('teams-updated', getSerializedTeams());
  }

  function areAllTeamsJudged() {
    const teamCountRow = db.db.prepare('SELECT COUNT(*) AS count FROM teams').get();
    const scoredCountRow = db.db.prepare('SELECT COUNT(*) AS count FROM physical_scores').get();
    return (teamCountRow?.count || 0) > 0 && (teamCountRow?.count || 0) === (scoredCountRow?.count || 0);
  }

  function roundRevealScore(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function averageRevealScores(values) {
    const safeValues = Array.isArray(values) ? values.map((value) => Number(value) || 0) : [];
    if (!safeValues.length) {
      return 0;
    }

    return safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length;
  }

  function getGeneratedCakeImagePaths(teamId) {
    const safeTeamId = Number(teamId);
    if (!Number.isInteger(safeTeamId) || safeTeamId <= 0) {
      return [];
    }

    const outputDir = path.join(__dirname, '..', 'public', 'assets', 'cake-results');
    if (!fs.existsSync(outputDir)) {
      return [];
    }

    return fs.readdirSync(outputDir)
      .filter((filename) => filename.startsWith(`team-${safeTeamId}-cake-`) && filename.toLowerCase().endsWith('.png'))
      .sort((left, right) => {
        const leftIndex = Number((left.match(/cake-(\d+)/) || [])[1]) || 0;
        const rightIndex = Number((right.match(/cake-(\d+)/) || [])[1]) || 0;
        return leftIndex - rightIndex;
      })
      .map((filename) => `/assets/cake-results/${filename}`);
  }

  function getResultCakeImagePath(result) {
    const generatedImages = getGeneratedCakeImagePaths(result.teamId);
    if (generatedImages.length) {
      return generatedImages[0];
    }

    if (result.isVirtualTeam) {
      const tier = cakeGenerator.getScoreTier(Number(result.scores?.total) || 0);
      return `/assets/cake-fallbacks/tier-${tier}-1.png`;
    }

    return '';
  }

  function buildJudgingResults() {
    return getResults(db.db).map((entry) => {
      const physicalAverage = roundRevealScore(averageRevealScores([
        entry.scores?.taste,
        entry.scores?.accuracy,
        entry.scores?.creativity
      ]));
      const virtualAverage = entry.scores?.virtualScores
        ? roundRevealScore(
            typeof entry.scores.virtualScores.average === 'number'
              ? entry.scores.virtualScores.average
              : averageRevealScores([
                  entry.scores.virtualScores.taste,
                  entry.scores.virtualScores.accuracy,
                  entry.scores.virtualScores.creativity
                ])
          )
        : 0;

      return {
        ...entry,
        cakeImagePath: getResultCakeImagePath(entry),
        scores: {
          ...entry.scores,
          physicalAverage,
          virtualAverage
        }
      };
    });
  }

  function parseJsonState(key, fallback) {
    const rawValue = db.getState(key);
    if (!rawValue) {
      return fallback;
    }

    try {
      return JSON.parse(rawValue);
    } catch (error) {
      console.warn(`Failed to parse state key ${key}:`, error);
      return fallback;
    }
  }

  function setJsonState(key, value) {
    db.setState(key, JSON.stringify(value));
  }

  function getBakingTeam(teamId) {
    if (typeof teamId === 'number') {
      const exactTeam = db.db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
      if (exactTeam) {
        return exactTeam;
      }
    }

    return db.db.prepare('SELECT * FROM teams WHERE is_virtual_team = 1 ORDER BY created_at LIMIT 1').get()
      || db.db.prepare('SELECT * FROM teams ORDER BY created_at LIMIT 1').get()
      || null;
  }

  function buildMinigameSelections(chaosLevel) {
    return evilLuck.selectMinigames(chaosLevel, minigamesConfig).map((selection) => {
      const detail = MINIGAME_DETAILS[selection.minigame] || {};
      const phaseConfig = minigamesConfig.phases?.[selection.phase] || {};
      const isAbsurd = Array.isArray(phaseConfig.absurd) && phaseConfig.absurd.includes(selection.minigame) && !phaseConfig.absurdExcluded;

      return {
        ...selection,
        sceneKey: detail.sceneKey || null,
        description: detail.description || 'Get ready!',
        phaseName: selection.phase.toUpperCase(),
        isAbsurd
      };
    });
  }

  function getBakingSessionState() {
    return {
      teamId: Number(db.getState('baking_team_id')) || null,
      chaosLevel: db.getState('baking_chaos_level') || null,
      currentPhaseIndex: Math.max(0, Number(db.getState('baking_current_phase_index')) || 0),
      minigames: parseJsonState('baking_minigames', []),
      chaosEvents: parseJsonState('baking_chaos_events', []),
      chaosLog: parseJsonState('baking_chaos_log', [])
    };
  }

  function getBakingSelectionForIndex(session, index = session.currentPhaseIndex) {
    if (!session || !Array.isArray(session.minigames) || !session.minigames.length) {
      return null;
    }

    return session.minigames[index] || null;
  }

  function buildBakingScoreboard() {
    const teams = getSerializedTeams();
    const rows = db.db.prepare('SELECT team_id AS teamId, phase, score FROM scores ORDER BY id').all();
    const scoreboard = new Map(teams.map((team) => [team.id, {
      teamId: team.id,
      teamName: team.name,
      isVirtual: team.isVirtual,
      phases: {},
      totalScore: 0,
      completedCount: 0
    }]));

    rows.forEach((row) => {
      if (!BAKING_PHASE_ORDER.includes(row.phase)) {
        return;
      }

      const entry = scoreboard.get(row.teamId) || {
        teamId: row.teamId,
        teamName: `Team ${row.teamId}`,
        isVirtual: false,
        phases: {},
        totalScore: 0,
        completedCount: 0
      };

      entry.phases[row.phase] = Number(row.score) || 0;
      entry.completedCount = Object.keys(entry.phases).length;
      entry.totalScore = BAKING_PHASE_ORDER.reduce((sum, phaseKey) => sum + (Number(entry.phases[phaseKey]) || 0), 0);
      scoreboard.set(row.teamId, entry);
    });

    return Array.from(scoreboard.values()).sort((left, right) => right.totalScore - left.totalScore || left.teamId - right.teamId);
  }

  function buildBakingTimerPayload() {
    const session = getBakingSessionState();
    return {
      durationSec: Number(db.getState('baking_duration')) || getTimeRemaining(db.db),
      timeRemaining: getTimeRemaining(db.db),
      teamId: session.teamId,
      chaosLevel: session.chaosLevel,
      currentPhaseIndex: session.currentPhaseIndex,
      totalPhases: session.minigames.length,
      currentSelection: getBakingSelectionForIndex(session),
      scoreboard: buildBakingScoreboard(),
      chaosLog: session.chaosLog,
      isPaused: db.getState('baking_paused_remaining') !== null
    };
  }

  function emitBakingSnapshot(target = io) {
    const session = getBakingSessionState();
    if (!session.minigames.length) {
      return;
    }

    // Only emit if the baking timer is actually running (not stale from a previous session)
    const remaining = getTimeRemaining(db.db);
    if (remaining <= 0 && !db.getState('baking_paused_remaining')) {
      return;
    }

    target.emit('baking:started', buildBakingTimerPayload());
    target.emit('baking:minigame-selections', {
      teamId: session.teamId,
      minigames: session.minigames,
      chaosEvents: session.chaosEvents,
      chaosLevel: session.chaosLevel,
      currentPhaseIndex: session.currentPhaseIndex
    });
  }

  function appendChaosLog(event) {
    const session = getBakingSessionState();
    const nextLog = [...session.chaosLog, event].slice(-12);
    setJsonState('baking_chaos_log', nextLog);
    return nextLog;
  }

  function emitChaosEventForSelection(selection, teamId) {
    if (!selection) {
      return null;
    }

    const session = getBakingSessionState();
    const chaosEvent = session.chaosEvents.find((event) => event.phaseKey === selection.phase);
    if (!chaosEvent) {
      return null;
    }

    const emittedEvent = {
      ...chaosEvent,
      teamId: teamId || session.teamId,
      phaseKey: selection.phase,
      phaseName: selection.phaseName || selection.phase.toUpperCase(),
      sceneKey: selection.sceneKey,
      minigame: selection.minigame,
      emittedAt: new Date().toISOString()
    };

    appendChaosLog(emittedEvent);
    io.emit('baking:chaos-event', emittedEvent);
    return emittedEvent;
  }

  function getCakeTypeForTeam(teamId) {
    const cakePurchase = [...getApprovedPurchases(db.db, teamId)].reverse().find((entry) => entry.category === 'cakes');
    if (!cakePurchase) {
      return 'chocolate';
    }

    const item = getShopItem(cakePurchase.item_key);
    return item?.name
      ? item.name.replace(/\bcake\b/i, '').replace(/\s+/g, ' ').trim().toLowerCase() || item.name.toLowerCase()
      : cakePurchase.item_key.replace(/^cake-/, '').replace(/-/g, ' ');
  }

  function getGalleryIngredients(teamId) {
    return getApprovedPurchases(db.db, teamId)
      .filter((entry) => entry.category === 'ingredients')
      .map((entry) => getShopItem(entry.item_key)?.name || entry.item_key);
  }

  function getGalleryChaosSummary(teamId) {
    const session = getBakingSessionState();
    const chaosSource = Array.isArray(session.chaosLog) && session.chaosLog.length
      ? session.chaosLog
      : session.chaosEvents;

    return (chaosSource || [])
      .filter((event) => !teamId || !event.teamId || Number(event.teamId) === Number(teamId))
      .slice(-6)
      .map((event) => ({
        title: event.name || event.phaseName || 'Chaos event',
        description: event.description || 'Something unfair happened.',
        phaseName: event.phaseName || event.phaseKey || 'Kitchen'
      }));
  }

  function buildFallbackGalleryPayload(teamId, scores, chaosEvents = []) {
    const safeScores = scores || { taste: 0, accuracy: 0, creativity: 0, total: 0 };
    const tier = cakeGenerator.getScoreTier(Number(safeScores.total) || 0);

    return {
      imagePaths: [`/assets/cake-fallbacks/tier-${tier}-1.png`],
      scores: safeScores,
      chaosEvents,
      teamId
    };
  }

  async function buildCakeGalleryPayload(teamId) {
    const resolvedTeam = getBakingTeam(teamId);
    if (!resolvedTeam) {
      throw new Error('No team available for gallery generation.');
    }

    const outputDir = path.join(__dirname, '..', 'public', 'assets', 'cake-results');
    fs.mkdirSync(outputDir, { recursive: true });

    const scores = calculateFinalScores(db.db, resolvedTeam.id);
    const chaosEvents = getGalleryChaosSummary(resolvedTeam.id);
    const gallery = await cakeGenerator.generateGalleryWithFallback(
      getCakeTypeForTeam(resolvedTeam.id),
      scores,
      getGalleryIngredients(resolvedTeam.id),
      chaosEvents,
      4
    );

    const imagePaths = [];
    for (let index = 0; index < gallery.length; index += 1) {
      const imageBuffer = gallery[index];
      if (!imageBuffer) {
        continue;
      }

      const filename = `team-${resolvedTeam.id}-cake-${index}.png`;
      fs.writeFileSync(path.join(outputDir, filename), imageBuffer);
      imagePaths.push(`/assets/cake-results/${filename}`);
    }

    if (!imagePaths.length) {
      return buildFallbackGalleryPayload(resolvedTeam.id, scores, chaosEvents);
    }

    return {
      imagePaths,
      scores,
      chaosEvents,
      teamId: resolvedTeam.id
    };
  }

  async function emitCakeGallery(teamId, target, { force = false } = {}) {
    const resolvedTeam = getBakingTeam(teamId);
    if (!resolvedTeam) {
      throw new Error('No team available for gallery generation.');
    }

    if (!force && db.getState('baking_gallery_generated_team_id') === String(resolvedTeam.id)) {
      return null;
    }

    try {
      const payload = await buildCakeGalleryPayload(resolvedTeam.id);
      db.setState('baking_gallery_generated_team_id', String(resolvedTeam.id));
      target.emit('baking:cake-gallery', payload);
      return payload;
    } catch (error) {
      const scores = (() => {
        try {
          return calculateFinalScores(db.db, resolvedTeam.id);
        } catch {
          return { taste: 0, accuracy: 0, creativity: 0, total: 0 };
        }
      })();
      const payload = buildFallbackGalleryPayload(resolvedTeam.id, scores, getGalleryChaosSummary(resolvedTeam.id));
      target.emit('baking:cake-gallery', payload);
      return payload;
    }
  }
  
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

        if (currentPhase === 'BAKING' && newPhase !== 'BAKING' && bakingTimerInterval) {
          clearInterval(bakingTimerInterval);
          bakingTimerInterval = null;
        }

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
    const handleStateRequest = () => {
      try {
        const phase = db.getState('phase');
        const transformedTeams = getSerializedTeams();
        
        socket.emit('state', {
          phase,
          teams: transformedTeams,
          baking: phase === 'BAKING' && (getTimeRemaining(db.db) > 0 || db.getState('baking_paused_remaining'))
            ? {
                ...buildBakingTimerPayload(),
                ...getBakingSessionState()
              }
            : null
        });

        if (phase === 'SHOP' && shopData) {
          socket.emit('shop:catalog', buildShopCatalogPayload());
        }

        if (phase === 'BAKING') {
          emitBakingSnapshot(socket);
        }

        const judgingResults = phase === 'JUDGING' || phase === 'RESULTS'
          ? buildJudgingResults()
          : null;

        if (phase === 'JUDGING') {
          socket.emit('judging:results', judgingResults);
        }

        if (phase === 'RESULTS') {
          socket.emit('judging:scores-updated', {
            results: judgingResults,
            allTeamsScored: areAllTeamsJudged()
          });
          socket.emit('results:reveal', judgingResults);
        }
      } catch (err) {
        console.error('Failed to get state:', err);
        socket.emit('error', { message: 'Server error retrieving state.' });
      }
    };

    socket.on('get-state', handleStateRequest);
    socket.on('request-state', handleStateRequest);
    
    // Handle team joining (lobby phase)
    socket.on('join-team', (data) => {
      try {
        const { name, isVirtual, claim } = data;
        
        // Validate input
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          socket.emit('error', { message: 'Team name is required.' });
          return;
        }
        
        if (name.trim().length > 50) {
          socket.emit('error', { message: 'Team name must be 50 characters or less.' });
          return;
        }
        
        // If claiming an existing team, link socket to that team
        if (claim) {
          const existingTeam = db.getTeamByName(name.trim());
          if (!existingTeam) {
            socket.emit('error', { message: 'Team not found.' });
            return;
          }
          
          // Link this socket to the team
          socket.teamId = existingTeam.id;
          socket.teamName = existingTeam.name;
          
          const transformedTeam = {
            id: existingTeam.id,
            name: existingTeam.name,
            money: existingTeam.money,
            isVirtual: existingTeam.is_virtual_team === 1,
            createdAt: existingTeam.created_at
          };
          
          console.log(`Player claimed team: ${existingTeam.name}`);
          socket.emit('team-claimed', transformedTeam);
          db.logEvent('team-claimed', { teamId: existingTeam.id, name: existingTeam.name, socketId: socket.id });
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
        emitTeamsUpdated(io);
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
        db.setState('currentSlideIndex', '-1');
        db.setState('triviaMode', 'SLIDE');
        resetAnswered();
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

    // ===== SHOP HANDLERS =====

    socket.on('shop:open', () => {
      try {
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can open the shop.' });
          return;
        }

        if (!shopData) {
          socket.emit('error', { message: 'Shop data is unavailable.' });
          return;
        }

        const currentPhase = db.getState('phase');
        if (currentPhase !== 'TRIVIA') {
          socket.emit('error', { message: 'Shop can only be opened from TRIVIA phase.' });
          return;
        }

        db.setState('phase', 'SHOP');
        db.logEvent('shop-opened', { from: currentPhase, to: 'SHOP' });

        io.emit('phase-changed', { phase: 'SHOP', previousPhase: currentPhase });
        io.emit('shop:catalog', buildShopCatalogPayload());
      } catch (err) {
        console.error('Failed to open shop:', err);
        socket.emit('error', { message: 'Server error opening shop.' });
      }
    });

    socket.on('shop:purchase', (data) => {
      try {
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can process purchases.' });
          return;
        }

        if (db.getState('phase') !== 'SHOP') {
          socket.emit('error', { message: 'Purchases are only available during SHOP phase.' });
          return;
        }

        if (!shopData) {
          socket.emit('error', { message: 'Shop data is unavailable.' });
          return;
        }

        const { teamId, itemKey } = data || {};
        if (typeof teamId !== 'number' || !itemKey || typeof itemKey !== 'string') {
          socket.emit('error', { message: 'Invalid purchase request.' });
          return;
        }

        const item = getShopItem(itemKey);
        if (!item) {
          socket.emit('error', { message: 'Requested item was not found.' });
          return;
        }

        const existingTeam = db.db.prepare('SELECT id FROM teams WHERE id = ?').get(teamId);
        if (!existingTeam) {
          socket.emit('error', { message: 'Team not found.' });
          return;
        }

        const result = purchaseItem(db.db, teamId, itemKey, shopData);

        if (result.success) {
          const inventory = getTeamInventory(db.db, teamId);
          const purchaseHistory = getTeamPurchases(db.db, teamId);

          io.emit('shop:purchase-result', teamId, {
            success: true,
            itemKey,
            itemName: item.name,
            category: item.category,
            categoryName: item.categoryName,
            price: item.price,
            newBalance: result.newBalance,
            approvedByOverride: false,
            purchaseHistory
          });
          io.emit('shop:team-inventory-updated', teamId, inventory);
          emitTeamsUpdated(io);
          return;
        }

        io.emit('shop:purchase-result', teamId, {
          success: false,
          itemKey,
          itemName: item.name,
          category: item.category,
          categoryName: item.categoryName,
          price: item.price,
          purchaseId: result.purchaseId,
          warning: result.warning,
          currentBalance: result.currentBalance
        });
        io.emit('shop:warning', teamId, `${item.name}: ${result.warning}`);
      } catch (err) {
        console.error('Failed to process purchase:', err);
        socket.emit('error', { message: err.message || 'Server error processing purchase.' });
      }
    });

    socket.on('shop:request-purchase', (data) => {
      try {
        if (!socket.rooms.has('player')) {
          socket.emit('error', { message: 'Only players can request purchases.' });
          return;
        }

        if (db.getState('phase') !== 'SHOP') {
          socket.emit('error', { message: 'Purchases only available during SHOP phase.' });
          return;
        }

        if (!shopData) {
          socket.emit('error', { message: 'Shop data is unavailable.' });
          return;
        }

        const { teamId, itemKey } = data || {};
        if (typeof teamId !== 'number' || Number.isNaN(teamId) || !itemKey || typeof itemKey !== 'string') {
          socket.emit('error', { message: 'Invalid purchase request.' });
          return;
        }

        const item = getShopItem(itemKey);
        if (!item) {
          socket.emit('error', { message: 'Item not found.' });
          return;
        }

        const team = db.db.prepare('SELECT id, name, money FROM teams WHERE id = ?').get(teamId);
        if (!team) {
          socket.emit('error', { message: 'Team not found.' });
          return;
        }

        const canAfford = team.money >= item.price;

        console.log(`Purchase request: Team ${teamId} (${team.name}) wants ${item.name} ($${item.price}), balance: $${team.money}`);

        io.to('host').emit('shop:purchase-request', {
          teamId,
          teamName: team.name,
          itemKey,
          itemName: item.name,
          category: item.category,
          price: item.price,
          currentBalance: team.money,
          canAfford
        });

        socket.emit('shop:request-acknowledged', {
          itemKey,
          itemName: item.name,
          price: item.price,
          status: 'pending'
        });
      } catch (err) {
        console.error('Failed to process purchase request:', err);
        socket.emit('error', { message: err.message || 'Server error processing request.' });
      }
    });

    socket.on('shop:deny-purchase-request', (data) => {
      try {
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can deny purchase requests.' });
          return;
        }

        if (db.getState('phase') !== 'SHOP') {
          socket.emit('error', { message: 'Purchase requests can only be denied during SHOP phase.' });
          return;
        }

        const { teamId, itemKey } = data || {};
        if (typeof teamId !== 'number' || Number.isNaN(teamId) || !itemKey || typeof itemKey !== 'string') {
          socket.emit('error', { message: 'Invalid purchase denial request.' });
          return;
        }

        const item = getShopItem(itemKey);
        if (!item) {
          socket.emit('error', { message: 'Item not found.' });
          return;
        }

        io.to('player').emit('shop:purchase-denied', {
          teamId,
          itemKey,
          itemName: item.name,
          status: 'denied'
        });
      } catch (err) {
        console.error('Failed to deny purchase request:', err);
        socket.emit('error', { message: err.message || 'Server error denying request.' });
      }
    });

    socket.on('shop:force-approve', (data) => {
      try {
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can override purchases.' });
          return;
        }

        if (db.getState('phase') !== 'SHOP') {
          socket.emit('error', { message: 'Overrides are only available during SHOP phase.' });
          return;
        }

        if (!shopData) {
          socket.emit('error', { message: 'Shop data is unavailable.' });
          return;
        }

        const { purchaseId } = data || {};
        if (typeof purchaseId !== 'number') {
          socket.emit('error', { message: 'Invalid purchase override request.' });
          return;
        }

        const pendingPurchase = db.db.prepare('SELECT * FROM pending_purchases WHERE id = ?').get(purchaseId);
        if (!pendingPurchase) {
          socket.emit('error', { message: 'Pending purchase not found.' });
          return;
        }

        const item = getShopItem(pendingPurchase.item_key);
        if (!item) {
          socket.emit('error', { message: 'Requested item was not found.' });
          return;
        }

        const result = forceApprove(db.db, purchaseId, shopData);
        const inventory = getTeamInventory(db.db, pendingPurchase.team_id);
        const purchaseHistory = getTeamPurchases(db.db, pendingPurchase.team_id);

        io.emit('shop:purchase-result', pendingPurchase.team_id, {
          success: true,
          itemKey: pendingPurchase.item_key,
          itemName: item.name,
          category: item.category,
          categoryName: item.categoryName,
          price: pendingPurchase.amount,
          purchaseId,
          newBalance: result.newBalance,
          approvedByOverride: true,
          purchaseHistory
        });
        io.emit('shop:team-inventory-updated', pendingPurchase.team_id, inventory);
        emitTeamsUpdated(io);
      } catch (err) {
        console.error('Failed to force approve purchase:', err);
        socket.emit('error', { message: err.message || 'Server error approving purchase.' });
      }
    });

    socket.on('shop:close', () => {
      try {
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can close the shop.' });
          return;
        }

        const currentPhase = db.getState('phase');
        if (currentPhase !== 'SHOP') {
          socket.emit('error', { message: 'Shop can only be closed from SHOP phase.' });
          return;
        }

        db.setState('phase', 'BAKING');
        db.logEvent('shop-closed', { from: currentPhase, to: 'BAKING' });

        io.emit('phase-changed', { phase: 'BAKING', previousPhase: currentPhase });
      } catch (err) {
        console.error('Failed to close shop:', err);
        socket.emit('error', { message: 'Server error closing shop.' });
      }
    });
    
    // ===== BAKING HANDLERS =====
    
    // Handle baking start (host only)
    socket.on('baking:start', (data = {}) => {
      try {
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can start baking timer.' });
          return;
        }

        const { durationSec, teamId } = data;
        if (typeof durationSec !== 'number' || durationSec <= 0) {
          socket.emit('error', { message: 'Invalid duration. Must be a positive number.' });
          return;
        }

        const bakingTeam = getBakingTeam(teamId);
        const chaosLevel = evilLuck.calculateChaosLevel(bakingTeam?.money || 0, 10000);
        const minigameSelections = buildMinigameSelections(chaosLevel);
        const chaosEvents = evilLuck.rollChaosEvents(chaosLevel);

        db.setState('baking_team_id', String(bakingTeam?.id || ''));
        db.setState('baking_chaos_level', chaosLevel);
        db.setState('baking_current_phase_index', '0');
        db.setState('baking_gallery_generated_team_id', '');
        setJsonState('baking_minigames', minigameSelections);
        setJsonState('baking_chaos_events', chaosEvents);
        setJsonState('baking_chaos_log', []);

        startBaking(db.db, durationSec);
        console.log(`Baking timer started: ${durationSec} seconds`);

        if (bakingTimerInterval) {
          clearInterval(bakingTimerInterval);
        }

        bakingTimerInterval = setInterval(() => {
          const timeRemaining = getTimeRemaining(db.db);
          io.emit('baking:timer-tick', { timeRemaining });

          if (timeRemaining === 0) {
            clearInterval(bakingTimerInterval);
            bakingTimerInterval = null;
            io.emit('baking:time-up');
            emitCakeGallery(bakingTeam?.id || null, io.to('host')).catch((error) => {
              console.error('Auto gallery generation failed after time up:', error);
            });
            console.log('Baking timer completed');
          }
        }, 1000);

        emitBakingSnapshot(io);
        const currentSelection = minigameSelections[0] || null;
        if (currentSelection) {
          emitChaosEventForSelection(currentSelection, bakingTeam?.id || null);
        }
      } catch (err) {
        console.error('Failed to start baking timer:', err);
        socket.emit('error', { message: 'Server error starting baking timer.' });
      }
    });
    
    // Handle baking pause (host only)
    socket.on('baking:pause', () => {
      try {
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can pause baking timer.' });
          return;
        }

        if (!bakingTimerInterval) {
          socket.emit('error', { message: 'Timer is not currently running.' });
          return;
        }

        clearInterval(bakingTimerInterval);
        bakingTimerInterval = null;
        const timeRemaining = pauseBaking(db.db);
        console.log('Baking timer paused');

        io.emit('baking:paused', { timeRemaining });
      } catch (err) {
        console.error('Failed to pause baking timer:', err);
        socket.emit('error', { message: 'Server error pausing baking timer.' });
      }
    });
    
    // Handle baking resume (host only)
    socket.on('baking:resume', () => {
      try {
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can resume baking timer.' });
          return;
        }

        if (bakingTimerInterval) {
          socket.emit('error', { message: 'Timer is already running.' });
          return;
        }

        const timeRemaining = resumeBaking(db.db);
        if (timeRemaining === 0) {
          socket.emit('error', { message: 'Timer has already expired.' });
          return;
        }

        console.log('Baking timer resumed');

        bakingTimerInterval = setInterval(() => {
          const nextTimeRemaining = getTimeRemaining(db.db);
          io.emit('baking:timer-tick', { timeRemaining: nextTimeRemaining });

          if (nextTimeRemaining === 0) {
            clearInterval(bakingTimerInterval);
            bakingTimerInterval = null;
            io.emit('baking:time-up');
            emitCakeGallery(Number(db.getState('baking_team_id')) || null, io.to('host')).catch((error) => {
              console.error('Auto gallery generation failed after resume timer ended:', error);
            });
            console.log('Baking timer completed');
          }
        }, 1000);

        io.emit('baking:resumed', { timeRemaining });
      } catch (err) {
        console.error('Failed to resume baking timer:', err);
        socket.emit('error', { message: 'Server error resuming baking timer.' });
      }
    });
    
    // Handle phase complete (from players)
    socket.on('baking:phase-complete', (data) => {
      try {
        const { teamId, phase, score, details } = data;

        if (!teamId || typeof teamId !== 'number') {
          socket.emit('error', { message: 'Invalid teamId.' });
          return;
        }

        if (!phase || typeof phase !== 'string') {
          socket.emit('error', { message: 'Invalid phase.' });
          return;
        }

        if (typeof score !== 'number' || score < 0 || score > 100) {
          socket.emit('error', { message: 'Invalid score. Must be between 0 and 100.' });
          return;
        }

        const safeDetails = (details != null && typeof details !== 'string')
          ? JSON.stringify(details)
          : details || null;

        completePhase(db.db, teamId, phase, score, safeDetails);
        console.log(`Phase completed: team ${teamId}, phase ${phase}, score ${score}`);

        const phaseScores = getPhaseScores(db.db, teamId);
        const session = getBakingSessionState();
        const activeTeamId = session.teamId || teamId;
        const completedIndex = session.minigames.findIndex((entry) => entry.phase === phase);
        let nextPhaseIndex = session.currentPhaseIndex;

        if (teamId === activeTeamId) {
          nextPhaseIndex = completedIndex >= 0 ? completedIndex + 1 : Math.max(session.currentPhaseIndex, 0);
          db.setState('baking_current_phase_index', String(nextPhaseIndex));
        }

        const nextSelection = teamId === activeTeamId
          ? (session.minigames[nextPhaseIndex] || null)
          : getBakingSelectionForIndex(session);
        const scoreboard = buildBakingScoreboard();

        io.emit('baking:phase-completed', {
          teamId,
          phase,
          score,
          phaseScores,
          scoreboard,
          currentPhaseIndex: nextPhaseIndex,
          currentSelection: nextSelection,
          completedCount: Math.min(nextPhaseIndex, session.minigames.length),
          totalPhases: session.minigames.length
        });

        if (teamId === activeTeamId && nextSelection) {
          emitChaosEventForSelection(nextSelection, activeTeamId);
        }

        if (teamId === activeTeamId && !nextSelection) {
          emitCakeGallery(activeTeamId, io.to('host')).catch((error) => {
            console.error('Auto gallery generation failed after final phase:', error);
          });
        }
      } catch (err) {
        console.error('Failed to complete phase:', err);
        socket.emit('error', { message: 'Server error completing phase.' });
      }
    });
    
    // ===== END BAKING HANDLERS =====

    // ===== JUDGING HANDLERS =====

    socket.on('judging:score-team', (data) => {
      try {
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can score judging.' });
          return;
        }

        if (db.getState('phase') !== 'JUDGING') {
          socket.emit('error', { message: 'Judging scores can only be submitted during JUDGING phase.' });
          return;
        }

        const { teamId, taste, accuracy, creativity } = data || {};
        if (typeof teamId !== 'number' || !Number.isInteger(teamId)) {
          socket.emit('error', { message: 'Invalid judging request.' });
          return;
        }

        const team = db.db.prepare('SELECT id, name FROM teams WHERE id = ?').get(teamId);
        if (!team) {
          socket.emit('error', { message: 'Team not found.' });
          return;
        }

        const scores = scorePhysicalCake(db.db, teamId, taste, accuracy, creativity);
        const results = buildJudgingResults();
        const allTeamsScored = areAllTeamsJudged();

        db.logEvent('judging-score-submitted', { teamId, taste: scores.taste, accuracy: scores.accuracy, creativity: scores.creativity });
        io.emit('judging:scores-updated', { teamId, scores, results, allTeamsScored });
      } catch (err) {
        console.error('Failed to score judging team:', err);
        socket.emit('error', { message: err.message || 'Server error submitting judging scores.' });
      }
    });

    socket.on('judging:get-results', () => {
      try {
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can retrieve judging results.' });
          return;
        }

        socket.emit('judging:results', buildJudgingResults());
      } catch (err) {
        console.error('Failed to get judging results:', err);
        socket.emit('error', { message: 'Server error retrieving judging results.' });
      }
    });

    socket.on('baking:generate-gallery', async ({ teamId } = {}) => {
      try {
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can generate cake galleries.' });
          return;
        }

        await emitCakeGallery(teamId, io.to('host'), { force: true });
      } catch (err) {
        console.error('Gallery generation error:', err);
        socket.emit('error', { message: 'Server error generating cake gallery.' });
      }
    });

    socket.on('results:cake-reveal', (payload = {}) => {
      try {
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can reveal cake results.' });
          return;
        }

        const cakeImagePath = typeof payload.cakeImagePath === 'string' ? payload.cakeImagePath : '';
        if (!cakeImagePath) {
          socket.emit('error', { message: 'Cake reveal requires an image path.' });
          return;
        }

        const scores = payload.scores || {};
        io.emit('results:cake-reveal', {
          cakeImagePath,
          scores: {
            taste: Number(scores.taste) || 0,
            accuracy: Number(scores.accuracy) || 0,
            creativity: Number(scores.creativity) || 0,
            total: Number(scores.total) || 0
          },
          chaosEvents: Array.isArray(payload.chaosEvents) ? payload.chaosEvents : [],
          teamId: Number(payload.teamId) || null
        });
      } catch (err) {
        console.error('Failed to reveal cake:', err);
        socket.emit('error', { message: 'Server error revealing cake.' });
      }
    });

    socket.on('results:reveal', () => {
      try {
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can reveal results.' });
          return;
        }

        const currentPhase = db.getState('phase');
        if (!['JUDGING', 'RESULTS'].includes(currentPhase)) {
          socket.emit('error', { message: 'Results can only be revealed from JUDGING or RESULTS phase.' });
          return;
        }

        const results = buildJudgingResults();

        if (currentPhase !== 'RESULTS') {
          db.setState('phase', 'RESULTS');
          db.logEvent('results-revealed', { previousPhase: currentPhase, resultCount: results.length });
          io.emit('phase-changed', { phase: 'RESULTS', previousPhase: currentPhase });
        }

        io.emit('results:reveal', results);
      } catch (err) {
        console.error('Failed to reveal results:', err);
        socket.emit('error', { message: 'Server error revealing results.' });
      }
    });
    
    // ===== TRIVIA HANDLERS =====
    
    // Handle next slide (host only)
    socket.on('trivia:next-slide', () => {
      try {
        // Check if socket is in host room
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can advance slides.' });
          return;
        }
        
        // Get current slide index from state (default to -1 so first call loads index 0)
        const currentIndex = parseInt(db.getState('currentSlideIndex') || '-1', 10);
        const nextIndex = currentIndex + 1;
        
        // Get the question
        const question = getSlideQuestion(nextIndex);
        
        if (!question) {
          socket.emit('error', { message: 'No more questions available.' });
          return;
        }
        
        // Update state
        db.setState('currentSlideIndex', nextIndex.toString());
        db.setState('currentQuestionId', question.id);
        
        console.log(`Slide advanced to index ${nextIndex}: ${question.id}`);
        
        // Broadcast question to all clients
        io.emit('trivia:question-shown', {
          question,
          mode: 'SLIDE'
        });
        
      } catch (err) {
        console.error('Failed to advance slide:', err);
        socket.emit('error', { message: 'Server error advancing slide.' });
      }
    });
    
    // Handle select jeopardy question (host only)
    socket.on('trivia:select-jeopardy', (data) => {
      try {
        // Check if socket is in host room
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can select jeopardy questions.' });
          return;
        }
        
        const { category, value } = data;
        
        if (!category || typeof value !== 'number') {
          socket.emit('error', { message: 'Invalid category or value.' });
          return;
        }
        
        // Get the question
        const question = getJeopardyQuestion(category, value);
        
        if (!question) {
          socket.emit('error', { message: 'Question not found.' });
          return;
        }
        
        // Check if already answered
        if (isAnswered(question.id)) {
          socket.emit('error', { message: 'This question has already been answered.' });
          return;
        }
        
        // Mark as answered
        markAnswered(question.id);
        
        // Store current question ID
        db.setState('currentQuestionId', question.id);
        
        console.log(`Jeopardy question selected: ${category} - $${value}`);
        
        // Broadcast question to all clients
        io.emit('trivia:question-shown', {
          question,
          mode: 'JEOPARDY'
        });
        
        // Broadcast updated board state
        io.emit('trivia:board-state', getBoard());
        
      } catch (err) {
        console.error('Failed to select jeopardy question:', err);
        socket.emit('error', { message: 'Server error selecting question.' });
      }
    });
    
    // Handle score answer (host only)
    socket.on('trivia:score-answer', (data) => {
      try {
        // Check if socket is in host room
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can score answers.' });
          return;
        }
        
        const { teamId, questionId, correct } = data;
        
        if (typeof teamId !== 'number' || !questionId || typeof correct !== 'boolean') {
          socket.emit('error', { message: 'Invalid score data.' });
          return;
        }
        
        // Score the answer
        scoreAnswer(db.db, teamId, questionId, correct);
        
        console.log(`Answer scored: Team ${teamId}, Question ${questionId}, Correct: ${correct}`);
        
        // Get updated team balance
        const team = db.db.prepare('SELECT id, name, money FROM teams WHERE id = ?').get(teamId);
        
        if (!team) {
          socket.emit('error', { message: 'Team not found after scoring.' });
          return;
        }
        
        // Broadcast result
        io.emit('trivia:answer-result', {
          teamId,
          correct,
          newBalance: team.money
        });
        
        // Broadcast updated scoreboard
        io.emit('trivia:scores-updated', getScoreboard(db.db));
        
      } catch (err) {
        console.error('Failed to score answer:', err);
        socket.emit('error', { message: err.message || 'Server error scoring answer.' });
      }
    });
    
    // Handle force all answer (host only)
    socket.on('trivia:force-answer', () => {
      try {
        // Check if socket is in host room
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can force answers.' });
          return;
        }
        
        const currentQuestionId = db.getState('currentQuestionId');
        
        if (!currentQuestionId) {
          socket.emit('error', { message: 'No active question.' });
          return;
        }
        
        // Get list of teams that must answer (all teams)
        const teamIds = forceAllAnswer(db.db, currentQuestionId, null);
        
        console.log('Force all answer triggered for teams:', teamIds);
        
        // Broadcast to all clients
        io.emit('trivia:force-answer-required', { teamIds });
        
      } catch (err) {
        console.error('Failed to force answer:', err);
        socket.emit('error', { message: 'Server error forcing answer.' });
      }
    });
    
    // Handle mode switch (host only)
    socket.on('trivia:switch-mode', (data) => {
      try {
        // Check if socket is in host room
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can switch modes.' });
          return;
        }
        
        const { mode } = data;
        
        if (!mode || !['SLIDE', 'JEOPARDY'].includes(mode)) {
          socket.emit('error', { message: 'Invalid mode. Must be SLIDE or JEOPARDY.' });
          return;
        }
        
        // Store mode in state
        db.setState('triviaMode', mode);
        
        console.log('Trivia mode changed to:', mode);
        
        // Broadcast mode change
        io.emit('trivia:mode-changed', { mode });
        
      } catch (err) {
        console.error('Failed to switch mode:', err);
        socket.emit('error', { message: 'Server error switching mode.' });
      }
    });
    
    // Handle get board (host only)
    socket.on('trivia:get-board', () => {
      try {
        // Check if socket is in host room
        if (!socket.rooms.has('host')) {
          socket.emit('error', { message: 'Only host can request board.' });
          return;
        }
        
        // Send board state to requester
        socket.emit('trivia:board-state', getBoard());
        
      } catch (err) {
        console.error('Failed to get board:', err);
        socket.emit('error', { message: 'Server error getting board.' });
      }
    });
    
    // Handle buzz (from any client)
    socket.on('trivia:buzz', (data) => {
      try {
        const { teamId } = data;
        
        if (typeof teamId !== 'number') {
          socket.emit('error', { message: 'Invalid team ID.' });
          return;
        }
        
        // Get team info
        const team = db.db.prepare('SELECT id, name FROM teams WHERE id = ?').get(teamId);
        
        if (!team) {
          socket.emit('error', { message: 'Team not found.' });
          return;
        }
        
        console.log(`Buzz received from team ${teamId}: ${team.name}`);
        
        // Broadcast buzz to all clients
        io.emit('trivia:buzz-received', {
          teamId: team.id,
          teamName: team.name
        });
        
      } catch (err) {
        console.error('Failed to handle buzz:', err);
        socket.emit('error', { message: 'Server error handling buzz.' });
      }
    });
    
    // ===== END TRIVIA HANDLERS =====
    
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
        if (bakingTimerInterval) {
          clearInterval(bakingTimerInterval);
          bakingTimerInterval = null;
        }

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
