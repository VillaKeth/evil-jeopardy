const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('horror maze rooms source defines reusable atmospheric helpers', () => {
  const source = read('public/js/babylon-game/shared/horror-maze/rooms.js');

  assert.match(source, /_addRoomLight\(root, x, y, z, color, intensity, range\)/);
  assert.match(source, /new BABYLON\.PointLight/);
  assert.match(source, /_addWallStain\(root, x, y, z, side, color\)/);
  assert.match(source, /alpha\s*=\s*0\.7/);
  assert.match(source, /_addCobweb\(root, x, y, z, size\)/);
  assert.match(source, /BABYLON\.VertexData/);
});

test('horror maze rooms include broad atmospheric decoration coverage', () => {
  const source = read('public/js/babylon-game/shared/horror-maze/rooms.js');

  const lightCalls = (source.match(/_addRoomLight\(/g) || []).length;
  const stainCalls = (source.match(/_addWallStain\(/g) || []).length;
  const cobwebCalls = (source.match(/_addCobweb\(/g) || []).length;
  const pipeMentions = (source.match(/ceilingPipe_/g) || []).length;

  assert.ok(lightCalls >= 15, `expected at least 15 room light calls, got ${lightCalls}`);
  assert.ok(stainCalls >= 20, `expected at least 20 wall stains, got ${stainCalls}`);
  assert.ok(cobwebCalls >= 14, `expected at least 14 cobwebs, got ${cobwebCalls}`);
  assert.ok(pipeMentions >= 6, `expected at least 6 ceiling pipes, got ${pipeMentions}`);
});

test('each horror maze room includes unique visual set pieces', () => {
  const source = read('public/js/babylon-game/shared/horror-maze/rooms.js');

  [
    'pantrySwingLight',
    'freezerIcicle_',
    'boilingSteam_',
    'knifeSplatter_',
    'meatChain_',
    'sinkDrop_',
    'dishShard_',
    'ovenHeatShimmer_',
    'spiceJar_',
    'walkInBreath_',
    'dumbSpark_',
    'chaseTable_',
    'judgeTorch_',
    'chamberCandleFlame_'
  ].forEach((token) => {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});
