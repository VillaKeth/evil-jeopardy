const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  loadQuestions,
  getSlideQuestion,
  getJeopardyQuestion,
  markAnswered,
  getBoard
} = require('../server/trivia');

describe('Trivia Data Model & Loader', () => {
  const questionsPath = path.join(__dirname, '../data/questions.json');

  before(() => {
    loadQuestions(questionsPath);
  });

  describe('loadQuestions()', () => {
    it('should load questions from JSON file', () => {
      const result = loadQuestions(questionsPath);
      assert.strictEqual(typeof result, 'object');
      assert.ok(Array.isArray(result.slides));
      assert.strictEqual(typeof result.jeopardy, 'object');
    });

    it('should load slide questions with required fields', () => {
      const result = loadQuestions(questionsPath);
      assert.ok(result.slides.length >= 10, 'Should have at least 10 slide questions');
      
      result.slides.forEach(slide => {
        assert.ok('id' in slide);
        assert.ok('text' in slide);
        assert.ok('answer' in slide);
        assert.ok('value' in slide);
        assert.ok('media' in slide);
        assert.ok('awardType' in slide);
      });
    });

    it('should load jeopardy questions with required fields', () => {
      const result = loadQuestions(questionsPath);
      assert.ok(Array.isArray(result.jeopardy.categories));
      assert.strictEqual(result.jeopardy.categories.length, 6);

      result.jeopardy.categories.forEach(category => {
        assert.ok('name' in category);
        assert.ok('questions' in category);
        assert.strictEqual(category.questions.length, 6);

        category.questions.forEach(question => {
          assert.ok('id' in question);
          assert.ok('text' in question);
          assert.ok('answer' in question);
          assert.ok('value' in question);
          assert.ok('media' in question);
        });
      });
    });

    it('should validate bonus questions have awardItem when awardType is ingredient', () => {
      const result = loadQuestions(questionsPath);
      const bonusSlides = result.slides.filter(s => s.awardType === 'ingredient');
      
      bonusSlides.forEach(slide => {
        assert.ok('awardItem' in slide, `Bonus slide ${slide.id} should have awardItem`);
      });
    });
  });

  describe('getSlideQuestion()', () => {
    it('should return a slide question by index', () => {
      const slide = getSlideQuestion(0);
      assert.strictEqual(typeof slide, 'object');
      assert.ok('id' in slide);
      assert.ok('text' in slide);
      assert.ok('answer' in slide);
    });

    it('should return null for invalid index', () => {
      const slide = getSlideQuestion(999);
      assert.strictEqual(slide, null);
    });
  });

  describe('getJeopardyQuestion()', () => {
    it('should return a jeopardy question by category and value', () => {
      const question = getJeopardyQuestion('Science', 100);
      assert.strictEqual(typeof question, 'object');
      assert.ok('id' in question);
      assert.ok('text' in question);
      assert.strictEqual(question.value, 100);
    });

    it('should return null for non-existent category', () => {
      const question = getJeopardyQuestion('Nonexistent', 100);
      assert.strictEqual(question, null);
    });

    it('should return null for non-existent value', () => {
      const question = getJeopardyQuestion('Science', 999);
      assert.strictEqual(question, null);
    });
  });

  describe('markAnswered()', () => {
    it('should mark a question as answered', () => {
      const question = getJeopardyQuestion('Science', 100);
      markAnswered(question.id);
      
      const board = getBoard();
      const scienceCategory = board.find(cat => cat.name === 'Science');
      const q = scienceCategory.questions.find(q => q.value === 100);
      
      assert.strictEqual(q.answered, true);
    });

    it('should handle marking non-existent question', () => {
      assert.doesNotThrow(() => markAnswered('nonexistent-id'));
    });
  });

  describe('getBoard()', () => {
    it('should return a 6×6 grid with answered status', () => {
      const board = getBoard();
      assert.ok(Array.isArray(board));
      assert.strictEqual(board.length, 6);

      board.forEach(category => {
        assert.ok('name' in category);
        assert.ok('questions' in category);
        assert.strictEqual(category.questions.length, 6);

        category.questions.forEach(question => {
          assert.ok('id' in question);
          assert.ok('value' in question);
          assert.ok('answered' in question);
        });
      });
    });

    it('should not include question text or answers in board view', () => {
      const board = getBoard();
      
      board.forEach(category => {
        category.questions.forEach(question => {
          assert.ok(!('text' in question), 'Board should not include question text');
          assert.ok(!('answer' in question), 'Board should not include answer');
        });
      });
    });
  });
});
