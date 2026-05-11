const fs = require('fs');
const path = require('path');

// In-memory storage
let questionsData = null;
const answeredQuestions = new Set();

/**
 * Load questions from JSON file
 * @param {string} filePath - Path to questions.json
 * @returns {object} - Questions data structure
 */
function loadQuestions(filePath) {
  try {
    const jsonData = fs.readFileSync(filePath, 'utf8');
    questionsData = JSON.parse(jsonData);
    
    // Reset answered questions when loading new data
    answeredQuestions.clear();
    
    return questionsData;
  } catch (error) {
    throw new Error(`Failed to load questions: ${error.message}`);
  }
}

/**
 * Get a slide question by index
 * @param {number} index - Zero-based index
 * @returns {object|null} - Question object or null
 */
function getSlideQuestion(index) {
  if (!questionsData || !questionsData.slides) {
    return null;
  }
  
  if (index < 0 || index >= questionsData.slides.length) {
    return null;
  }
  
  const q = { ...questionsData.slides[index] };
  // Normalize: ensure 'question' field exists (data uses 'text')
  if (!q.question && q.text) q.question = q.text;
  return q;
}

/**
 * Get a Jeopardy question by category and value
 * @param {string} categoryName - Category name
 * @param {number} value - Question value
 * @returns {object|null} - Question object or null
 */
function getJeopardyQuestion(categoryName, value) {
  if (!questionsData || !questionsData.jeopardy || !questionsData.jeopardy.categories) {
    return null;
  }
  
  const category = questionsData.jeopardy.categories.find(
    cat => cat.name === categoryName
  );
  
  if (!category) {
    return null;
  }
  
  const question = category.questions.find(q => q.value === value);
  
  if (!question) return null;
  const q = { ...question };
  if (!q.question && q.text) q.question = q.text;
  return q;
}

/**
 * Mark a question as answered
 * @param {string} questionId - The ID of the question
 */
function markAnswered(questionId) {
  if (questionId) {
    answeredQuestions.add(questionId);
  }
}

/**
 * Check if a question has been answered
 * @param {string} questionId - The ID of the question
 * @returns {boolean} - True if answered
 */
function isAnswered(questionId) {
  return answeredQuestions.has(questionId);
}

/**
 * Get the Jeopardy board with answered status
 * Returns a 6×6 grid without question text or answers
 * @returns {array} - Array of categories with questions
 */
function getBoard() {
  if (!questionsData || !questionsData.jeopardy || !questionsData.jeopardy.categories) {
    return [];
  }
  
  return questionsData.jeopardy.categories.map(category => ({
    name: category.name,
    questions: category.questions.map(q => ({
      id: q.id,
      value: q.value,
      answered: answeredQuestions.has(q.id)
    }))
  }));
}

/**
 * Reset all answered questions (for new games)
 */
function resetAnswered() {
  answeredQuestions.clear();
}

/**
 * Get all slide questions
 * @returns {array} - All slide questions
 */
function getAllSlides() {
  if (!questionsData || !questionsData.slides) {
    return [];
  }
  return questionsData.slides;
}

/**
 * Get total number of slide questions
 * @returns {number} - Count of slide questions
 */
function getSlideCount() {
  if (!questionsData || !questionsData.slides) {
    return 0;
  }
  return questionsData.slides.length;
}

/**
 * Find a question by ID (searches both slides and jeopardy)
 * @param {string} questionId - Question ID to look up
 * @returns {object|null} - Question object or null
 */
function findQuestionById(questionId) {
  if (!questionsData) {
    return null;
  }

  // Search in slides
  if (questionsData.slides) {
    const slide = questionsData.slides.find(s => s.id === questionId);
    if (slide) {
      return slide;
    }
  }

  // Search in jeopardy categories
  if (questionsData.jeopardy && questionsData.jeopardy.categories) {
    for (const category of questionsData.jeopardy.categories) {
      const question = category.questions.find(q => q.id === questionId);
      if (question) {
        return question;
      }
    }
  }

  return null;
}

/**
 * Score an answer for a team
 * @param {object} db - Database instance (better-sqlite3)
 * @param {number} teamId - Team ID
 * @param {string} questionId - Question ID
 * @param {boolean} correct - Whether the answer was correct
 */
function scoreAnswer(db, teamId, questionId, correct) {
  const question = findQuestionById(questionId);
  
  if (!question) {
    throw new Error(`Question ${questionId} not found`);
  }

  const value = question.value;
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error(`Question ${questionId} has invalid value: ${value}`);
  }

  const change = correct ? value : -value;

  // Update team money
  const stmt = db.prepare('UPDATE teams SET money = money + ? WHERE id = ?');
  const result = stmt.run(change, teamId);
  if (result.changes === 0) {
    throw new Error(`Team ${teamId} not found`);
  }

  // If bonus question with ingredient award and correct answer, award the ingredient
  if (correct && question.awardType === 'ingredient' && question.awardItem) {
    awardIngredient(db, teamId, question.awardItem);
  }
}

/**
 * Award an ingredient to a team (free item from bonus question)
 * @param {object} db - Database instance (better-sqlite3)
 * @param {number} teamId - Team ID
 * @param {string} itemKey - Item key (e.g., 'eggs-premium')
 */
function awardIngredient(db, teamId, itemKey) {
  const teamExists = db.prepare('SELECT 1 FROM teams WHERE id = ?').get(teamId);
  if (!teamExists) {
    throw new Error(`Team ${teamId} not found`);
  }
  const stmt = db.prepare(
    'INSERT INTO purchases (team_id, item_key, category, price, approved_by_host) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(teamId, itemKey, 'ingredient', 0, 1);
}

/**
 * Get list of teams that must answer (forced answer evil rule)
 * @param {object} db - Database instance (better-sqlite3)
 * @param {string} questionId - Question ID (for future use)
 * @param {number|null} buzzedTeamId - Team that buzzed and answered correctly (to exclude)
 * @returns {array} - Array of team IDs that must answer
 */
function forceAllAnswer(db, questionId, buzzedTeamId) {
  const stmt = db.prepare('SELECT id FROM teams ORDER BY id');
  const teams = stmt.all();
  
  return teams
    .map(t => t.id)
    .filter(id => id !== buzzedTeamId);
}

/**
 * Get the scoreboard (all teams sorted by money)
 * @param {object} db - Database instance (better-sqlite3)
 * @returns {array} - Array of {id, name, money} sorted by money descending
 */
function getScoreboard(db) {
  const stmt = db.prepare('SELECT id, name, money FROM teams ORDER BY money DESC');
  return stmt.all();
}

module.exports = {
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
};
