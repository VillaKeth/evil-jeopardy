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
  assert.match(hostHtml, /id="connection-overlay"/);
  assert.match(hostHtml, /id="loading-overlay"/);
  assert.match(hostScript, /baking:generate-gallery/);
  assert.match(hostScript, /baking:cake-gallery/);
  assert.match(hostScript, /results:cake-reveal/);
  assert.match(hostScript, /socket\.on\('reconnect'/);
  assert.match(hostScript, /socket\.emit\('request-state'/);
  assert.match(hostScript, /showConnectionOverlay/);
  assert.match(hostScript, /hideConnectionOverlay/);
  assert.match(hostScript, /setTimeout\(\(\) => \{\s*section\.classList\.add\('active'\)/s);
});

test('shared stylesheet adds polished transitions overlays and mobile responsiveness', () => {
  const styleSheet = read('public/css/style.css');

  assert.match(styleSheet, /\.phase-section\s*\{[\s\S]*opacity:\s*0;[\s\S]*translateY\(20px\);[\s\S]*transition:\s*opacity 0\.4s ease, transform 0\.4s ease;[\s\S]*display:\s*none;/);
  assert.match(styleSheet, /\.phase-section\.active\s*\{[\s\S]*opacity:\s*1;[\s\S]*translateY\(0\);[\s\S]*display:\s*block;/);
  assert.match(styleSheet, /\.connection-overlay\s*\{[\s\S]*position:\s*fixed;[\s\S]*z-index:\s*9999;/);
  assert.match(styleSheet, /\.loading-overlay\s*\{[\s\S]*position:\s*fixed;/);
  assert.match(styleSheet, /\.spinner\s*\{/);
  assert.match(styleSheet, /\.btn:focus-visible/);
  assert.match(styleSheet, /@media \(max-width: 768px\)[\s\S]*\.player-buzz-btn/);
  assert.match(styleSheet, /@media \(max-width: 768px\)[\s\S]*\.player-shop-items/);
  assert.match(styleSheet, /@media \(max-width: 768px\)[\s\S]*#phaser-container/);
  assert.match(styleSheet, /@media \(max-width: 768px\)[\s\S]*\.player-results-shell/);
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
