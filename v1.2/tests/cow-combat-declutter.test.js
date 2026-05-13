const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

test('CowCombat3D uses the decluttered camera and farm setup', () => {
  const source = read('public/js/babylon-game/scenes-absurd/CowCombat3D.js');

  assert.match(source, /fogDensity\s*=\s*0\.015/);
  assert.match(source, /orthoSize:\s*5\.5/);
  assert.match(source, /this\.cowRoot\.scaling\.setAll\(1\.3\)/);
  assert.doesNotMatch(source, /_makeFencePost|cowMud|cowRail_|cowSideRail_/);
});

test('CowCombat3D replaces cluttered prompts with one instruction text and simplified udder states', () => {
  const source = read('public/js/babylon-game/scenes-absurd/CowCombat3D.js');

  assert.match(source, /this\.instructionText\s*=\s*new BABYLON\.GUI\.TextBlock/);
  assert.match(source, /Click the glowing udder!/);
  assert.match(source, /udder\.mesh\.scaling\.setAll\(isActive \? 1\.3 : 0\.7\)/);
  assert.match(source, /new BABYLON\.Color3\(0\.8, 1(?:\.0)?, 0\.8\)/);
  assert.match(source, /const uddersDisabled = Boolean\(this\.currentAttack\) \|\| this\.stampedeActive/);
  assert.match(source, /if \(this\.stampedeActive\) \{\s*this\._tryDodge\(\);\s*return;\s*\}/);
  assert.match(source, /text: '🌀 WAIT\.\.\.'/);
  assert.doesNotMatch(source, /_showDodgeButton\('DODGE', '#d97706'/);
  assert.doesNotMatch(source, /_applyPenalty\('/);
  assert.doesNotMatch(source, /statusText|beatText|attackWarningText|promptArrow|udderLabels/);
});
