const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('BaseMinigameScene defines glow pulse helper and update/dispose hooks', () => {
  const source = read('public/js/babylon-game/scene-manager.js');

  assert.match(source, /highlightInteractive\(mesh, color, speed\)/);
  assert.match(source, /this\._glowPulses\s*=\s*\[\]/);
  assert.match(source, /mesh\.material\s*=\s*mesh\.material\.clone\(/);
  assert.match(source, /pulse\.mesh\.material\.emissiveColor\s*=\s*pulse\.color\.scale\(intensity\)/);
  assert.match(source, /this\._glowPulses\s*=\s*null;/);
});

test('PrepScene3D highlights the active ingredient container', () => {
  const source = read('public/js/babylon-game/scenes/PrepScene3D.js');

  assert.match(source, /this\.highlightInteractive\(this\.currentContainer, new BABYLON\.Color3\(0\.4, 1, 0\.5\)\)/);
});

test('DecorateScene3D highlights sample toppings including sprinkle hitboxes', () => {
  const source = read('public/js/babylon-game/scenes/DecorateScene3D.js');

  assert.match(source, /const highlightTarget = sample\.metadata && sample\.metadata\.glowTarget \? sample\.metadata\.glowTarget : sample;/);
  assert.match(source, /this\.highlightInteractive\(highlightTarget, new BABYLON\.Color3\(1, 0\.85, 0\.4\)\)/);
  assert.match(source, /root\.metadata\s*=\s*\{\s*glowTarget: hitbox\s*\}/);
});
