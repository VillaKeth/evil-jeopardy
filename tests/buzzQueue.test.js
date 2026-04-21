const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createBuzzQueue, recordBuzz, getBuzzWinner, isOpen, open, lock, reset, getBuzzOrder } = require('../server/buzzQueue');

describe('buzz queue', () => {
  it('starts closed', () => {
    const q = createBuzzQueue();
    assert.equal(isOpen(q), false);
  });

  it('can be opened and locked', () => {
    const q = createBuzzQueue();
    open(q, 300);
    assert.equal(isOpen(q), true);
    assert.equal(q.pointValue, 300);
    lock(q);
    assert.equal(isOpen(q), false);
  });

  it('ignores buzzes when closed', () => {
    const q = createBuzzQueue();
    const recorded = recordBuzz(q, 'player1', 100, 5);
    assert.equal(recorded, false);
  });

  it('records buzz with latency adjustment', () => {
    const q = createBuzzQueue();
    open(q, 200);
    const now = Date.now();
    recordBuzz(q, 'player1', now, 100);
    recordBuzz(q, 'player2', now + 10, 20);
    const winner = getBuzzWinner(q);
    assert.equal(winner.socketId, 'player1');
  });

  it('handles tie within 10ms with tiebreak', () => {
    const q = createBuzzQueue();
    open(q, 100);
    const now = Date.now();
    recordBuzz(q, 'p1', now, 20);
    recordBuzz(q, 'p2', now + 5, 30);
    const winner = getBuzzWinner(q);
    assert.ok(['p1', 'p2'].includes(winner.socketId));
    assert.equal(winner.tie, true);
  });

  it('prevents duplicate buzzes from same player', () => {
    const q = createBuzzQueue();
    open(q, 200);
    const now = Date.now();
    recordBuzz(q, 'p1', now, 10);
    recordBuzz(q, 'p1', now + 100, 10);
    assert.equal(q.buzzes.length, 1);
  });

  it('resets for next question', () => {
    const q = createBuzzQueue();
    open(q, 200);
    recordBuzz(q, 'p1', Date.now(), 10);
    reset(q);
    assert.equal(q.buzzes.length, 0);
    assert.equal(isOpen(q), false);
  });

  it('returns empty winner when no buzzes', () => {
    const q = createBuzzQueue();
    open(q, 100);
    assert.equal(getBuzzWinner(q), null);
  });

  it('returns buzz order', () => {
    const q = createBuzzQueue();
    open(q, 200);
    const now = Date.now();
    recordBuzz(q, 'p2', now, 10);
    recordBuzz(q, 'p1', now + 500, 10);
    const order = getBuzzOrder(q);
    assert.equal(order[0], 'p2');
    assert.equal(order[1], 'p1');
  });
});
