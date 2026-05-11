const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('screen results reveal UI supports dramatic rankings with hybrid score breakdowns', () => {
  const screenHtml = read('public/screen.html');
  const screenScript = read('public/js/screen.js');

  assert.match(screenHtml, /id="results-container"/);
  assert.match(screenScript, /socket\.on\('results:reveal'/);
  assert.match(screenScript, /WINNER!/);
  assert.match(screenScript, /Physical:/);
  assert.match(screenScript, /Virtual:/);
  assert.match(screenScript, /Average:/);
});

test('player results reveal UI supports winner and consolation states', () => {
  const playerHtml = read('public/player.html');
  const playerScript = read('public/js/player.js');

  assert.match(playerHtml, /id="player-results-container"/);
  assert.match(playerScript, /socket\.on\('results:reveal'/);
  assert.match(playerScript, /Better luck next time/);
  assert.match(playerScript, /You won!/);
  assert.match(playerScript, /Your virtual cake contribution/);
});
