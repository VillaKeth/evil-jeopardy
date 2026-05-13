const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('prep scene tracks disposable ingredient label resources across container swaps', () => {
  const source = read('public/js/babylon-game/scenes/PrepScene3D.js');

  assert.match(source, /this\._containerDecorResources\s*=\s*\[\]/);
  assert.match(source, /_disposeContainerDecorResources\(\)\s*\{/);
  assert.match(source, /_createIngredientLabelMaterial\(name, text(?:, options = \{\})?\)\s*\{/);
  assert.match(source, /_createTrackedFoodMaterial\(name, color(?:, options = \{\})?\)\s*\{/);
  assert.match(source, /new BABYLON\.DynamicTexture\(/);
  assert.match(source, /this\._disposeContainerDecorResources\(\);/);
});

test('prep scene adds dynamic texture labels plus flour sugar and milk container accents', () => {
  const source = read('public/js/babylon-game/scenes/PrepScene3D.js');

  ['FLOUR', 'SUGAR', 'MILK', 'flourCrease', 'sugarHandle', 'milkHandle'].forEach((token) => {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

test('prep scene styles egg carton with six eggs varied shells and divider ridges', () => {
  const source = read('public/js/babylon-game/scenes/PrepScene3D.js');
  const eggPositionsMatch = source.match(/const eggPositions = \[([\s\S]*?)\];/);

  assert.ok(eggPositionsMatch, 'expected egg positions array in eggs styling');
  const eggPositionCount = (eggPositionsMatch[1].match(/new BABYLON\.Vector3/g) || []).length;

  assert.equal(eggPositionCount, 6, `expected 6 egg positions, got ${eggPositionCount}`);
  assert.match(source, /const eggColors = \[/);
  assert.match(source, /eggDivider/);
});

test('prep scene gives butter a foil wrapper and visible slice mark', () => {
  const source = read('public/js/babylon-game/scenes/PrepScene3D.js');

  assert.match(source, /butterFoilMat|butterWrapperMat/);
  assert.match(source, /metallic\s*=\s*0\.(?:9[5-9]|[0-9]{2,})|metallic\s*=\s*1/);
  assert.match(source, /roughness\s*=\s*0\.(?:0[5-9]|1[0-9])/);
  assert.match(source, /butterSlice/);
});
