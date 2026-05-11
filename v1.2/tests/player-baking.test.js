const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('player baking bootstrap uses Phaser SceneManager getScene API for overlay checks', () => {
  const playerScript = fs.readFileSync(path.join(__dirname, '../public/js/player.js'), 'utf8');

  assert.doesNotMatch(
    playerScript,
    /game\.scene\.get\(/,
    'player baking bootstrap should not call game.scene.get because Phaser SceneManager exposes getScene()'
  );

  assert.match(
    playerScript,
    /game\.scene\.getScene\(/,
    'player baking bootstrap should check overlay scenes with game.scene.getScene()'
  );
});
