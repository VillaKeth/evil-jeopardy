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
  
  return { ...questionsData.slides[index] };
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
  
  return question ? { ...question } : null;
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

module.exports = {
  loadQuestions,
  getSlideQuestion,
  getJeopardyQuestion,
  markAnswered,
  isAnswered,
  getBoard,
  resetAnswered,
  getAllSlides,
  getSlideCount
};
