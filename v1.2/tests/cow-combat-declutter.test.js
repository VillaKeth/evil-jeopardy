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
  assert.match(source, /orthoSize:\s*5\b/);
  assert.match(source, /this\.cowRoot\.scaling\.setAll\(1\.3\)/);
  assert.doesNotMatch(source, /_makeFencePost|cowMud|cowRail_|cowSideRail_/);
});

test('CowCombat3D replaces cluttered prompts with one instruction text and simplified udder states', () => {
  const source = read('public/js/babylon-game/scenes-absurd/CowCombat3D.js');

  assert.match(source, /this\.instructionText\s*=\s*new BABYLON\.GUI\.TextBlock/);
  assert.match(source, /Squeeze the.*udder!/);
  assert.match(source, /udder\.mesh\.scaling\.setAll\(pulse\)/);
  assert.match(source, /udder\.material\.emissiveColor/);
  assert.match(source, /const uddersDisabled = Boolean\(this\.currentAttack\) \|\| this\.stampedeActive/);
  assert.match(source, /if \(this\.stampedeActive\) \{\s*this\._tryDodge\(\);\s*return;\s*\}/);
  assert.match(source, /text: '🌀 WAIT\.\.\.'/);
  assert.doesNotMatch(source, /statusText|beatText|attackWarningText|udderLabels/);
});

test('CowCombat3D has color-coded udders with arrow and glow ring', () => {
  const source = read('public/js/babylon-game/scenes-absurd/CowCombat3D.js');

  assert.match(source, /UDDER_COLORS/);
  assert.match(source, /_buildPromptArrow\(\)/);
  assert.match(source, /_buildGlowRing\(\)/);
  assert.match(source, /this\.promptArrow\.setEnabled\(true\)/);
  assert.match(source, /this\.glowRing\.setEnabled\(true\)/);
});

test('CowCombat3D has attack warning overlays and tutorial', () => {
  const source = read('public/js/babylon-game/scenes-absurd/CowCombat3D.js');

  assert.match(source, /_buildWarningOverlay\(\)/);
  assert.match(source, /_showAttackWarning\(/);
  assert.match(source, /_hideAttackWarning\(\)/);
  assert.match(source, /KICK.*HANDS OFF/);
  assert.match(source, /CHARGE.*DODGE NOW/);
  assert.match(source, /SPIN.*WAIT IT OUT/);
  assert.match(source, /STAMPEDE/);
  assert.match(source, /_buildTutorialOverlay\(\)/);
  assert.match(source, /COW COMBAT/);
});
