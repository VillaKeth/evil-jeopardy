const crypto = require('crypto');
const { getDB } = require('./db');

function importPack(packData) {
  if (!packData?.name || !Array.isArray(packData?.categories)) {
    throw new Error('Invalid pack format: requires name and categories array');
  }

  const packId = crypto.randomUUID();
  const db = getDB();

  db.prepare(
    'INSERT INTO question_packs (pack_id, name, source, created_at) VALUES (?, ?, ?, ?)'
  ).run(packId, packData.name, 'import', Date.now());

  const insertQ = db.prepare(
    'INSERT INTO questions (pack_id, category, value, question_text, answer) VALUES (?, ?, ?, ?, ?)'
  );

  const insertMany = db.transaction((categories) => {
    for (const cat of categories) {
      if (!cat.name || !Array.isArray(cat.questions)) continue;
      for (const q of cat.questions) {
        insertQ.run(packId, cat.name, q.value, q.question, q.answer);
      }
    }
  });

  insertMany(packData.categories);
  return packId;
}

function listPacks() {
  return getDB().prepare(`
    SELECT qp.*, COUNT(q.question_id) as question_count
    FROM question_packs qp
    LEFT JOIN questions q ON qp.pack_id = q.pack_id
    GROUP BY qp.pack_id
    ORDER BY qp.created_at DESC
  `).all();
}

function getPackQuestions(packId) {
  return getDB().prepare(
    'SELECT * FROM questions WHERE pack_id = ? ORDER BY category, value'
  ).all(packId);
}

function getUnusedQuestion(packId, category, value) {
  return getDB().prepare(
    'SELECT * FROM questions WHERE pack_id = ? AND category = ? AND value = ? AND used_count = 0 LIMIT 1'
  ).get(packId, category, value);
}

function markQuestionUsed(questionId) {
  getDB().prepare(
    'UPDATE questions SET used_count = used_count + 1 WHERE question_id = ?'
  ).run(questionId);
}

function getPackCategories(packId) {
  return getDB().prepare(
    'SELECT DISTINCT category FROM questions WHERE pack_id = ?'
  ).all(packId).map(r => r.category);
}

function parseOllamaResponse(responseText) {
  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```json?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1];

  const parsed = JSON.parse(jsonStr.trim());
  if (!parsed.name || !Array.isArray(parsed.categories)) {
    throw new Error('Invalid response format');
  }
  return parsed;
}

async function generateWithOllama(topic, categoryCount = 5, questionsPerCategory = 5) {
  const model = process.env.OLLAMA_MODEL || 'llama3.2';
  const prompt = `Generate a trivia question pack about "${topic}" in valid JSON format.
Create exactly ${categoryCount} categories, each with exactly ${questionsPerCategory} questions.
Questions should range from $100 (easy) to $500 (hard) in increments of $100.
Format answers in Jeopardy "What is..." style.

Respond with ONLY valid JSON in this exact format:
{
  "name": "${topic} Pack",
  "categories": [
    {
      "name": "Category Name",
      "questions": [
        { "value": 100, "question": "Easy question text", "answer": "What is the answer?" },
        { "value": 200, "question": "...", "answer": "..." },
        { "value": 300, "question": "...", "answer": "..." },
        { "value": 400, "question": "...", "answer": "..." },
        { "value": 500, "question": "...", "answer": "..." }
      ]
    }
  ]
}`;

  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false })
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return parseOllamaResponse(data.response);
}

module.exports = {
  importPack, listPacks, getPackQuestions,
  getUnusedQuestion, markQuestionUsed, getPackCategories,
  parseOllamaResponse, generateWithOllama
};
