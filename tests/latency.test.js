const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateAvgLatency, shouldRecalibrate } = require('../server/latency');

describe('calculateAvgLatency', () => {
  it('averages RTT samples', () => {
    const samples = [10, 20, 30, 40, 50];
    assert.equal(calculateAvgLatency(samples), 30);
  });

  it('drops highest and lowest when 5+ samples', () => {
    const samples = [10, 20, 30, 40, 100];
    assert.equal(calculateAvgLatency(samples), 30);
  });

  it('returns 0 for empty samples', () => {
    assert.equal(calculateAvgLatency([]), 0);
  });
});

describe('shouldRecalibrate', () => {
  it('returns true after 5 minutes', () => {
    const lastCalibration = Date.now() - 6 * 60 * 1000;
    assert.equal(shouldRecalibrate(lastCalibration), true);
  });

  it('returns false before 5 minutes', () => {
    const lastCalibration = Date.now() - 2 * 60 * 1000;
    assert.equal(shouldRecalibrate(lastCalibration), false);
  });
});
