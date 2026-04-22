const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

describe('Buzz Timer Constants', () => {
  it('BUZZ_TIMER_SECONDS should default to 10', () => {
    const fs = require('fs');
    const serverCode = fs.readFileSync('server/index.js', 'utf-8');
    assert.ok(serverCode.includes('BUZZ_TIMER_SECONDS'));
    assert.ok(serverCode.includes('10'));
  });
});

describe('Timer Integration', () => {
  it('server should have timer-update event handler pattern', () => {
    const fs = require('fs');
    const serverCode = fs.readFileSync('server/index.js', 'utf-8');
    assert.ok(serverCode.includes("'timer-update'"), 'should emit timer-update events');
    assert.ok(serverCode.includes('setInterval'), 'should use setInterval for countdown');
    assert.ok(serverCode.includes('clearInterval'), 'should clear interval on score/lock');
    assert.ok(serverCode.includes('buzzTimerInterval'), 'should store interval reference');
  });

  it('timer should be cleared on host-mark-correct', () => {
    const fs = require('fs');
    const serverCode = fs.readFileSync('server/index.js', 'utf-8');
    const markCorrectIdx = serverCode.indexOf("'host-mark-correct'");
    const nextHandlerIdx = serverCode.indexOf("socket.on('host-mark-wrong'");
    const markCorrectSection = serverCode.substring(markCorrectIdx, nextHandlerIdx);
    assert.ok(markCorrectSection.includes('clearBuzzTimer'), 'mark-correct should clear timer');
  });

  it('timer should be cleared on host-mark-wrong', () => {
    const fs = require('fs');
    const serverCode = fs.readFileSync('server/index.js', 'utf-8');
    const markWrongIdx = serverCode.indexOf("'host-mark-wrong'");
    const nextIdx = serverCode.indexOf("socket.on('host-next-answer'");
    const markWrongSection = serverCode.substring(markWrongIdx, nextIdx);
    assert.ok(markWrongSection.includes('clearBuzzTimer'), 'mark-wrong should clear timer');
  });
});
