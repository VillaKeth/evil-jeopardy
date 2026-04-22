const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const TEST_DB_DIR = path.join(__dirname, '..', 'data-test');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test-questions.db');

describe('questions module', () => {
  let db, questions;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (!fs.existsSync(TEST_DB_DIR)) fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    delete require.cache[require.resolve('../server/db')];
    delete require.cache[require.resolve('../server/questions')];
    db = require('../server/db');
    db.initDB(TEST_DB_PATH);
    questions = require('../server/questions');
  });

  afterEach(() => {
    db.closeDB();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('importPack inserts questions from JSON', () => {
    const pack = {
      name: 'Test Pack',
      categories: [
        { name: 'Science', questions: [
          { value: 100, question: 'Q1?', answer: 'A1' },
          { value: 200, question: 'Q2?', answer: 'A2' }
        ]}
      ]
    };
    const packId = questions.importPack(pack);
    assert.ok(packId);
    const qs = questions.getPackQuestions(packId);
    assert.strictEqual(qs.length, 2);
    assert.strictEqual(qs[0].category, 'Science');
  });

  it('importPack rejects invalid format', () => {
    assert.throws(() => questions.importPack({ bad: 'data' }));
  });

  it('listPacks returns all packs', () => {
    questions.importPack({
      name: 'Pack 1',
      categories: [{ name: 'Cat1', questions: [{ value: 100, question: 'Q', answer: 'A' }] }]
    });
    const packs = questions.listPacks();
    assert.strictEqual(packs.length, 1);
    assert.strictEqual(packs[0].name, 'Pack 1');
  });

  it('getUnusedQuestion returns unused question for category/value', () => {
    const packId = questions.importPack({
      name: 'P',
      categories: [{ name: 'History', questions: [
        { value: 100, question: 'H1?', answer: 'HA1' },
        { value: 200, question: 'H2?', answer: 'HA2' }
      ]}]
    });
    const q = questions.getUnusedQuestion(packId, 'History', 100);
    assert.ok(q);
    assert.strictEqual(q.question_text, 'H1?');
  });

  it('markQuestionUsed increments used_count', () => {
    const packId = questions.importPack({
      name: 'P2',
      categories: [{ name: 'Geo', questions: [{ value: 100, question: 'G1?', answer: 'GA1' }] }]
    });
    const q = questions.getUnusedQuestion(packId, 'Geo', 100);
    questions.markQuestionUsed(q.question_id);
    const q2 = questions.getUnusedQuestion(packId, 'Geo', 100);
    assert.strictEqual(q2, undefined);
  });

  it('parseOllamaResponse extracts valid question pack', () => {
    const mockResponse = JSON.stringify({
      name: 'AI Generated',
      categories: [
        { name: 'Space', questions: [
          { value: 100, question: 'Nearest star?', answer: 'What is Proxima Centauri?' }
        ]}
      ]
    });
    const pack = questions.parseOllamaResponse(mockResponse);
    assert.strictEqual(pack.name, 'AI Generated');
    assert.strictEqual(pack.categories[0].questions.length, 1);
  });
});
