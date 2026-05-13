const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('HandController3D uses rounded finger meshes and palm edge overlays', () => {
  const source = read('public/js/babylon-game/shared/hand-controller.js');

  assert.match(source, /const proximal = BABYLON\.MeshBuilder\.CreateCylinder/);
  assert.match(source, /const distal = BABYLON\.MeshBuilder\.CreateCylinder/);
  assert.match(source, /const baseKnuckle = BABYLON\.MeshBuilder\.CreateSphere/);
  assert.match(source, /const middleKnuckle = BABYLON\.MeshBuilder\.CreateSphere/);
  assert.match(source, /const tip = BABYLON\.MeshBuilder\.CreateSphere/);
  assert.match(source, /this\._addPalmEdgeSphere\(hand, 'wristEdge'/);
  assert.match(source, /this\._addPalmEdgeSphere\(hand, 'knuckleEdge'/);
  assert.doesNotMatch(source, /CreateBox\(`handController_\$\{hand\.side\}_\$\{config\.name\}_proximal`/);
  assert.doesNotMatch(source, /CreateBox\(`handController_\$\{hand\.side\}_\$\{config\.name\}_distal`/);
});
