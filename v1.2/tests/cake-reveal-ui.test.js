const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('host gallery UI exposes generation and reveal controls', () => {
  const hostHtml = read('public/host.html');
  const hostScript = read('public/js/host.js');

  assert.match(hostHtml, /id="cake-gallery-section"/);
  assert.match(hostHtml, /id="generate-gallery-btn"/);
  assert.match(hostHtml, /id="reveal-cake-btn"/);
  assert.match(hostScript, /baking:generate-gallery/);
  assert.match(hostScript, /baking:cake-gallery/);
  assert.match(hostScript, /results:cake-reveal/);
});

test('screen reveal UI listens for cake reveal broadcasts', () => {
  const screenHtml = read('public/screen.html');
  const screenScript = read('public/js/screen.js');

  assert.match(screenHtml, /id="screen-cake-reveal"/);
  assert.match(screenHtml, /id="screen-cake-reveal-image"/);
  assert.match(screenScript, /results:cake-reveal/);
  assert.match(screenScript, /Your cake is ready/);
});

test('player reveal flow wires ResultScene into Phaser and fallback handling', () => {
  const playerHtml = read('public/player.html');
  const playerScript = read('public/js/player.js');
  const gameConfig = read('public/js/phaser-game/config.js');
  const resultScene = read('public/js/phaser-game/ResultScene.js');

  assert.match(playerHtml, /ResultScene\.js/);
  assert.match(playerScript, /results:cake-reveal/);
  assert.match(playerScript, /ResultScene/);
  assert.match(gameConfig, /ResultScene:\s*window\.ResultScene/);
  assert.match(resultScene, /window\.ResultScene\s*=\s*ResultScene/);
  assert.match(resultScene, /Your cake is ready/);
});
