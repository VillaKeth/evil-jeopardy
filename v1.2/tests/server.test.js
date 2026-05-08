const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('Server', () => {
  it('should export createApp function', () => {
    const { createApp } = require('../server/index.js');
    assert.ok(typeof createApp === 'function');
  });
});
