const { describe, it, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const {
  loadQuestions,
  getSlideQuestion,
  getJeopardyQuestion,
  markAnswered,
  getBoard,
  scoreAnswer,
  awardIngredient,
  forceAllAnswer,
  getScoreboard
} = require('../server/trivia');
const { initDb } = require('../server/db');

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

  describe('Scoring Functions', () => {
    let dbInstance;
    const testDbPath = path.join(__dirname, 'test-scoring.db');

    beforeEach(() => {
      // Clean up any existing test database
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      dbInstance = initDb(testDbPath);
      
      // Create test teams
      dbInstance.createTeam('Team Alpha', false);
      dbInstance.createTeam('Team Beta', false);
      dbInstance.createTeam('Team Gamma', false);
    });

    afterEach(() => {
      if (dbInstance) {
        dbInstance.close();
      }
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    });

    describe('scoreAnswer()', () => {
      it('should add money for correct answer on slide question', () => {
        const slide = getSlideQuestion(0);
        scoreAnswer(dbInstance.db, 1, slide.id, true);
        
        const team = dbInstance.db.prepare('SELECT money FROM teams WHERE id = ?').get(1);
        assert.strictEqual(team.money, slide.value);
      });

      it('should subtract money for wrong answer on slide question', () => {
        const slide = getSlideQuestion(0);
        scoreAnswer(dbInstance.db, 1, slide.id, false);
        
        const team = dbInstance.db.prepare('SELECT money FROM teams WHERE id = ?').get(1);
        assert.strictEqual(team.money, -slide.value);
      });

      it('should add money for correct answer on jeopardy question', () => {
        const question = getJeopardyQuestion('Science', 100);
        scoreAnswer(dbInstance.db, 2, question.id, true);
        
        const team = dbInstance.db.prepare('SELECT money FROM teams WHERE id = ?').get(2);
        assert.strictEqual(team.money, question.value);
      });

      it('should subtract money for wrong answer on jeopardy question', () => {
        const question = getJeopardyQuestion('Science', 100);
        scoreAnswer(dbInstance.db, 2, question.id, false);
        
        const team = dbInstance.db.prepare('SELECT money FROM teams WHERE id = ?').get(2);
        assert.strictEqual(team.money, -question.value);
      });

      it('should award ingredient for correct bonus question', () => {
        // Find a bonus slide with awardType: "ingredient"
        const bonusSlide = getSlideQuestion(5); // s-bonus1 based on questions.json
        scoreAnswer(dbInstance.db, 1, bonusSlide.id, true);
        
        // Check that ingredient was added to purchases
        const purchase = dbInstance.db.prepare('SELECT * FROM purchases WHERE team_id = ? AND item_key = ?').get(1, bonusSlide.awardItem);
        assert.ok(purchase);
        assert.strictEqual(purchase.price, 0);
        assert.strictEqual(purchase.category, 'ingredient');
        assert.strictEqual(purchase.approved_by_host, 1);
      });

      it('should not award ingredient for wrong bonus question', () => {
        const bonusSlide = getSlideQuestion(5);
        scoreAnswer(dbInstance.db, 1, bonusSlide.id, false);
        
        // Check that no ingredient was added
        const purchase = dbInstance.db.prepare('SELECT * FROM purchases WHERE team_id = ?').get(1);
        assert.strictEqual(purchase, undefined);
      });
    });

    describe('awardIngredient()', () => {
      it('should insert ingredient into purchases with price 0', () => {
        awardIngredient(dbInstance.db, 1, 'eggs-premium');
        
        const purchase = dbInstance.db.prepare('SELECT * FROM purchases WHERE team_id = ? AND item_key = ?').get(1, 'eggs-premium');
        assert.ok(purchase);
        assert.strictEqual(purchase.price, 0);
        assert.strictEqual(purchase.category, 'ingredient');
        assert.strictEqual(purchase.approved_by_host, 1);
      });

      it('should allow multiple awards to same team', () => {
        awardIngredient(dbInstance.db, 1, 'eggs-premium');
        awardIngredient(dbInstance.db, 1, 'flour-organic');
        
        const purchases = dbInstance.db.prepare('SELECT * FROM purchases WHERE team_id = ?').all(1);
        assert.strictEqual(purchases.length, 2);
      });
    });

    describe('forceAllAnswer()', () => {
      it('should return all teams when no team buzzed', () => {
        const teams = forceAllAnswer(dbInstance.db, 'q-test', null);
        assert.strictEqual(teams.length, 3);
        assert.ok(teams.includes(1));
        assert.ok(teams.includes(2));
        assert.ok(teams.includes(3));
      });

      it('should exclude the team that buzzed correctly', () => {
        const teams = forceAllAnswer(dbInstance.db, 'q-test', 2);
        assert.strictEqual(teams.length, 2);
        assert.ok(teams.includes(1));
        assert.ok(!teams.includes(2));
        assert.ok(teams.includes(3));
      });

      it('should return empty array if only one team exists and they buzzed', () => {
        // Remove teams 2 and 3
        dbInstance.db.prepare('DELETE FROM teams WHERE id IN (2, 3)').run();
        
        const teams = forceAllAnswer(dbInstance.db, 'q-test', 1);
        assert.strictEqual(teams.length, 0);
      });
    });

    describe('getScoreboard()', () => {
      it('should return all teams sorted by money descending', () => {
        // Give teams different scores
        dbInstance.db.prepare('UPDATE teams SET money = ? WHERE id = ?').run(500, 1);
        dbInstance.db.prepare('UPDATE teams SET money = ? WHERE id = ?').run(1000, 2);
        dbInstance.db.prepare('UPDATE teams SET money = ? WHERE id = ?').run(200, 3);
        
        const scoreboard = getScoreboard(dbInstance.db);
        assert.strictEqual(scoreboard.length, 3);
        assert.strictEqual(scoreboard[0].id, 2);
        assert.strictEqual(scoreboard[0].money, 1000);
        assert.strictEqual(scoreboard[1].id, 1);
        assert.strictEqual(scoreboard[1].money, 500);
        assert.strictEqual(scoreboard[2].id, 3);
        assert.strictEqual(scoreboard[2].money, 200);
      });

      it('should include team name in scoreboard', () => {
        const scoreboard = getScoreboard(dbInstance.db);
        assert.ok('name' in scoreboard[0]);
        assert.strictEqual(scoreboard[0].name, 'Team Alpha');
      });

      it('should handle teams with same score', () => {
        dbInstance.db.prepare('UPDATE teams SET money = ? WHERE id = ?').run(500, 1);
        dbInstance.db.prepare('UPDATE teams SET money = ? WHERE id = ?').run(500, 2);
        
        const scoreboard = getScoreboard(dbInstance.db);
        assert.strictEqual(scoreboard.length, 3);
        // Both should be included, order doesn't matter for ties
        assert.ok(scoreboard[0].money === 500 || scoreboard[1].money === 500);
      });
    });
  });
});
