const Database = require('better-sqlite3');

function tableExists(db, tableName) {
  return Boolean(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName)
  );
}

function getCompatibleLegacyScoresTableName(db) {
  let suffix = 0;
  let candidate = 'scores_legacy_backup';

  while (tableExists(db, candidate)) {
    suffix += 1;
    candidate = `scores_legacy_backup_${suffix}`;
  }

  return candidate;
}

function ensureScoresSchema(db) {
  const columns = db.prepare('PRAGMA table_info(scores)').all();
  if (!columns.length) {
    return;
  }

  const columnNames = new Set(columns.map((column) => column.name));
  const hasExpectedSchema = ['phase', 'score', 'details'].every((name) => columnNames.has(name));
  if (hasExpectedSchema) {
    return;
  }

  const legacyTableName = getCompatibleLegacyScoresTableName(db);
  db.transaction(() => {
    db.exec(`ALTER TABLE scores RENAME TO ${legacyTableName}`);
    db.exec(`
      CREATE TABLE scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL,
        phase TEXT NOT NULL,
        score REAL NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id)
      );
    `);
  })();

  console.warn(`Migrated incompatible scores table to ${legacyTableName}.`);
}

/**
 * Initialize SQLite database with schema
 * @param {string} dbPath - Path to database file
 * @returns {object} Database instance with helper methods
 */
function initDb(dbPath) {
  const db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      money INTEGER DEFAULT 0,
      is_virtual_team BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      item_key TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      approved_by_host BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id)
    );

    CREATE TABLE IF NOT EXISTS pending_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      item_key TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id)
    );

    CREATE TABLE IF NOT EXISTS game_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      phase TEXT NOT NULL,
      score REAL NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id)
    );

    CREATE TABLE IF NOT EXISTS physical_scores (
      team_id INTEGER PRIMARY KEY,
      taste INTEGER DEFAULT 0,
      accuracy INTEGER DEFAULT 0,
      creativity INTEGER DEFAULT 0,
      FOREIGN KEY (team_id) REFERENCES teams(id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  ensureScoresSchema(db);

  // Prepared statements
  const stmts = {
    getState: db.prepare('SELECT value FROM game_state WHERE key = ?'),
    setState: db.prepare('INSERT OR REPLACE INTO game_state (key, value) VALUES (?, ?)'),
    getTeams: db.prepare('SELECT * FROM teams ORDER BY created_at'),
    getTeamByName: db.prepare('SELECT * FROM teams WHERE name = ?'),
    createTeam: db.prepare('INSERT INTO teams (name, is_virtual_team) VALUES (?, ?) RETURNING *'),
    logEvent: db.prepare('INSERT INTO events (type, data) VALUES (?, ?)')
  };

  // Helper methods
  return {
    db,
    
    /**
     * Get a state value
     * @param {string} key - State key
     * @returns {string|null} State value or null if not found
     */
    getState(key) {
      const row = stmts.getState.get(key);
      return row ? row.value : null;
    },
    
    /**
     * Set a state value
     * @param {string} key - State key
     * @param {string} value - State value
     */
    setState(key, value) {
      stmts.setState.run(key, value);
    },
    
    /**
     * Get all teams
     * @returns {Array} Array of team objects
     */
    getTeams() {
      return stmts.getTeams.all();
    },
    
    /**
     * Get a team by name
     * @param {string} name - Team name
     * @returns {object|null} Team object or null
     */
    getTeamByName(name) {
      return stmts.getTeamByName.get(name) || null;
    },
    
    /**
     * Create a new team
     * @param {string} name - Team name
     * @param {boolean} isVirtual - Whether this is a virtual team
     * @returns {object} Created team object
     */
    createTeam(name, isVirtual = false) {
      return stmts.createTeam.get(name, isVirtual ? 1 : 0);
    },
    
    /**
     * Log an event
     * @param {string} type - Event type
     * @param {object} data - Event data (will be JSON stringified)
     */
    logEvent(type, data) {
      stmts.logEvent.run(type, JSON.stringify(data));
    },
    
    /**
     * Close the database connection
     */
    close() {
      db.close();
    }
  };
}

module.exports = { initDb };
