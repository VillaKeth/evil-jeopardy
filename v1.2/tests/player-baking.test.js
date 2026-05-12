const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('player baking bootstrap uses BabylonGameEngine for minigame scenes', () => {
  const playerScript = fs.readFileSync(path.join(__dirname, '../public/js/player.js'), 'utf8');

  assert.match(
    playerScript,
    /BabylonGameEngine/,
    'player baking bootstrap should use BabylonGameEngine class'
  );

  assert.match(
    playerScript,
    /startBakingSession/,
    'player baking bootstrap should define startBakingSession function'
  );

  assert.match(
    playerScript,
    /destroyBakingSession/,
    'player baking bootstrap should define destroyBakingSession function'
  );
});
