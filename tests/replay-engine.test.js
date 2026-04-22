const { describe, it } = require('node:test');
const assert = require('node:assert');

// Simulate browser globals for the IIFE module
global.window = {};
require('../public/js/replay-engine');
const ReplayEngine = global.window.ReplayEngine;

describe('ReplayEngine', () => {
  it('initializes with events', () => {
    const engine = ReplayEngine.create([
      { event_type: 'game-start', event_data: '{"players":[{"name":"Kevin"}]}', timestamp: 1000 },
      { event_type: 'game-over', event_data: '{"standings":[]}', timestamp: 2000 }
    ]);
    assert.strictEqual(engine.totalEvents, 2);
    assert.strictEqual(engine.currentIndex, -1);
  });

  it('stepForward advances to next event', () => {
    const engine = ReplayEngine.create([
      { event_type: 'game-start', event_data: '{"players":[{"name":"Kevin","id":"k1"}]}', timestamp: 1000 },
      { event_type: 'phase-change', event_data: '{"from":"LOBBY","to":"MAIN_BOARD"}', timestamp: 2000 }
    ]);
    const event = engine.stepForward();
    assert.strictEqual(event.event_type, 'game-start');
    assert.strictEqual(engine.currentIndex, 0);
  });

  it('stepForward returns null at end', () => {
    const engine = ReplayEngine.create([
      { event_type: 'game-start', event_data: '{"players":[]}', timestamp: 1000 }
    ]);
    engine.stepForward(); // event 0
    const result = engine.stepForward(); // past end
    assert.strictEqual(result, null);
  });

  it('getProgress returns correct percentage', () => {
    const engine = ReplayEngine.create([
      { event_type: 'a', event_data: '{}', timestamp: 1 },
      { event_type: 'b', event_data: '{}', timestamp: 2 },
      { event_type: 'c', event_data: '{}', timestamp: 3 },
      { event_type: 'd', event_data: '{}', timestamp: 4 }
    ]);
    engine.stepForward(); // 0
    engine.stepForward(); // 1
    assert.strictEqual(engine.getProgress(), 50);
  });

  it('seekTo jumps to specific event index', () => {
    const engine = ReplayEngine.create([
      { event_type: 'a', event_data: '{}', timestamp: 1 },
      { event_type: 'b', event_data: '{}', timestamp: 2 },
      { event_type: 'c', event_data: '{}', timestamp: 3 }
    ]);
    engine.seekTo(2);
    assert.strictEqual(engine.currentIndex, 2);
  });
});
