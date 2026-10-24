// tests/upgrade-effects.test.js
// Tests for upgrade multiplier calculations used in both Mode A and Mode B

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

function assertClose(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) <= tolerance) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${message} (expected ~${expected}, got ${actual})`);
  }
}

// --- Functions under test (mirrored from game.js / action.js) ---

function getUpgradeMultiplier(totalLevels, percentPerLevel) {
  return 1 + (totalLevels * percentPerLevel / 100);
}

function computeModeAEffects(upgrades) {
  const u = upgrades || {};
  return {
    babyUses: 1 + (u.egg || 0),
    babyDamageMul: getUpgradeMultiplier(
      (u.ox || 0) + (u.tiger || 0) + (u.monkey || 0), 15
    ),
    babyDotMul: getUpgradeMultiplier(
      (u.snake || 0) + (u.dragon || 0), 20
    ),
    babyHealPerUse: ((u.horse || 0) + (u.goat || 0)) * 10,
    babyShieldPerUse: ((u.dog || 0) + (u.pig || 0)) * 20,
    babyCooldownMul: 1 - Math.min(0.7,
      ((u.rat || 0) + (u.rabbit || 0) + (u.rooster || 0)) * 0.1
    )
  };
}

function computeModeBEffects(upgrades) {
  const u = upgrades || {};
  return {
    autoHealPerSec: (u.egg || 0) * 1,
    skillCooldownMul: 1 - Math.min(0.7,
      ((u.rat || 0) + (u.rabbit || 0) + (u.rooster || 0)) * 0.1
    ),
    attackDamageMul: getUpgradeMultiplier(
      (u.ox || 0) + (u.tiger || 0) + (u.monkey || 0), 15
    ),
    dotDamageMul: getUpgradeMultiplier(
      (u.snake || 0) + (u.dragon || 0), 20
    ),
    healOnKill: ((u.horse || 0) + (u.goat || 0)) * 2,
    shieldHp: ((u.dog || 0) + (u.pig || 0)) * 30
  };
}

// --- Tests ---

console.log('Running upgrade-effects tests...\n');

// 1. getUpgradeMultiplier basic cases
console.log('--- getUpgradeMultiplier ---');
assert(getUpgradeMultiplier(0, 15) === 1, 'level 0 at 15% should be 1.0');
assert(getUpgradeMultiplier(1, 15) === 1.15, 'level 1 at 15% should be 1.15');
assert(getUpgradeMultiplier(7, 15) === 2.05, 'level 7 at 15% should be 2.05');
assert(getUpgradeMultiplier(0, 20) === 1, 'level 0 at 20% should be 1.0');
assert(getUpgradeMultiplier(1, 20) === 1.2, 'level 1 at 20% should be 1.2');
assert(getUpgradeMultiplier(5, 20) === 2.0, 'level 5 at 20% should be 2.0');
assert(getUpgradeMultiplier(3, 10) === 1.3, 'level 3 at 10% should be 1.3');

// 2. Mode A: egg gives +1 use per level
console.log('--- Mode A: egg (baby uses) ---');
assert(computeModeAEffects({}).babyUses === 1, 'no upgrades: 1 base use');
assert(computeModeAEffects({ egg: 0 }).babyUses === 1, 'egg 0: 1 use');
assert(computeModeAEffects({ egg: 1 }).babyUses === 2, 'egg 1: 2 uses');
assert(computeModeAEffects({ egg: 3 }).babyUses === 4, 'egg 3: 4 uses');
assert(computeModeAEffects({ egg: 7 }).babyUses === 8, 'egg 7: 8 uses');

// 3. Mode A: ox/tiger/monkey give +15% damage per level
console.log('--- Mode A: ox/tiger/monkey (damage multiplier) ---');
assert(computeModeAEffects({}).babyDamageMul === 1, 'no upgrades: 1x damage');
assert(computeModeAEffects({ ox: 1 }).babyDamageMul === 1.15, 'ox 1: 1.15x');
assert(computeModeAEffects({ tiger: 2 }).babyDamageMul === 1.3, 'tiger 2: 1.3x');
assert(computeModeAEffects({ monkey: 1 }).babyDamageMul === 1.15, 'monkey 1: 1.15x');
assert(computeModeAEffects({ ox: 1, tiger: 1, monkey: 1 }).babyDamageMul === 1.45, 'ox+tiger+monkey 1 each: 1.45x');
assert(computeModeAEffects({ ox: 3, tiger: 2, monkey: 2 }).babyDamageMul === 2.05, 'total 7 levels: 2.05x');

// 4. Mode A: snake/dragon give +20% DoT per level
console.log('--- Mode A: snake/dragon (DoT multiplier) ---');
assert(computeModeAEffects({}).babyDotMul === 1, 'no upgrades: 1x DoT');
assert(computeModeAEffects({ snake: 1 }).babyDotMul === 1.2, 'snake 1: 1.2x');
assert(computeModeAEffects({ dragon: 1 }).babyDotMul === 1.2, 'dragon 1: 1.2x');
assert(computeModeAEffects({ snake: 2, dragon: 1 }).babyDotMul === 1.6, 'snake 2 + dragon 1: 1.6x');

// 5. Mode A: horse/goat give +10HP heal per level
console.log('--- Mode A: horse/goat (heal per use) ---');
assert(computeModeAEffects({}).babyHealPerUse === 0, 'no upgrades: 0 heal');
assert(computeModeAEffects({ horse: 1 }).babyHealPerUse === 10, 'horse 1: 10HP');
assert(computeModeAEffects({ goat: 1 }).babyHealPerUse === 10, 'goat 1: 10HP');
assert(computeModeAEffects({ horse: 2, goat: 1 }).babyHealPerUse === 30, 'horse 2 + goat 1: 30HP');

// 6. Mode A: dog/pig give +20HP shield per level
console.log('--- Mode A: dog/pig (shield per use) ---');
assert(computeModeAEffects({}).babyShieldPerUse === 0, 'no upgrades: 0 shield');
assert(computeModeAEffects({ dog: 1 }).babyShieldPerUse === 20, 'dog 1: 20HP');
assert(computeModeAEffects({ pig: 1 }).babyShieldPerUse === 20, 'pig 1: 20HP');
assert(computeModeAEffects({ dog: 2, pig: 1 }).babyShieldPerUse === 60, 'dog 2 + pig 1: 60HP');

// 7. Mode A: rat/rabbit/rooster give -10% cooldown per level (max -70%)
console.log('--- Mode A: rat/rabbit/rooster (cooldown multiplier) ---');
assert(computeModeAEffects({}).babyCooldownMul === 1, 'no upgrades: 1x cooldown (no reduction)');
assert(computeModeAEffects({ rat: 1 }).babyCooldownMul === 0.9, 'rat 1: 0.9x');
assert(computeModeAEffects({ rabbit: 1 }).babyCooldownMul === 0.9, 'rabbit 1: 0.9x');
assert(computeModeAEffects({ rooster: 1 }).babyCooldownMul === 0.9, 'rooster 1: 0.9x');
assertClose(computeModeAEffects({ rat: 3, rabbit: 2, rooster: 2 }).babyCooldownMul, 0.3, 0.001, 'total 7 levels: 0.3x (max reduction)');
assertClose(computeModeAEffects({ rat: 7 }).babyCooldownMul, 0.3, 0.001, 'rat 7: capped at 0.3x');
assertClose(computeModeAEffects({ rat: 10 }).babyCooldownMul, 0.3, 0.001, 'rat 10: still capped at 0.3x');

// 8. Mode B: egg gives +1HP/sec auto heal per level
console.log('--- Mode B: egg (auto heal) ---');
assert(computeModeBEffects({}).autoHealPerSec === 0, 'no upgrades: 0 HP/sec');
assert(computeModeBEffects({ egg: 1 }).autoHealPerSec === 1, 'egg 1: 1 HP/sec');
assert(computeModeBEffects({ egg: 3 }).autoHealPerSec === 3, 'egg 3: 3 HP/sec');

// 9. Mode B: rat/rabbit/rooster give -10% skill cooldown per level
console.log('--- Mode B: rat/rabbit/rooster (skill cooldown) ---');
assert(computeModeBEffects({}).skillCooldownMul === 1, 'no upgrades: 1x cooldown');
assert(computeModeBEffects({ rat: 1 }).skillCooldownMul === 0.9, 'rat 1: 0.9x');
assertClose(computeModeBEffects({ rat: 3, rabbit: 2, rooster: 2 }).skillCooldownMul, 0.3, 0.001, 'total 7: 0.3x');
assertClose(computeModeBEffects({ rat: 10 }).skillCooldownMul, 0.3, 0.001, 'rat 10: capped at 0.3x');

// 10. Mode B: ox/tiger/monkey give +15% attack damage per level
console.log('--- Mode B: ox/tiger/monkey (attack damage) ---');
assert(computeModeBEffects({}).attackDamageMul === 1, 'no upgrades: 1x');
assert(computeModeBEffects({ ox: 1 }).attackDamageMul === 1.15, 'ox 1: 1.15x');
assert(computeModeBEffects({ ox: 2, tiger: 1 }).attackDamageMul === 1.45, 'ox 2 + tiger 1: 1.45x');

// 11. Mode B: snake/dragon give +20% DoT per level
console.log('--- Mode B: snake/dragon (DoT damage) ---');
assert(computeModeBEffects({}).dotDamageMul === 1, 'no upgrades: 1x');
assert(computeModeBEffects({ snake: 1 }).dotDamageMul === 1.2, 'snake 1: 1.2x');
assert(computeModeBEffects({ snake: 1, dragon: 1 }).dotDamageMul === 1.4, 'snake 1 + dragon 1: 1.4x');

// 12. Mode B: horse/goat give +2HP heal on kill per level
console.log('--- Mode B: horse/goat (heal on kill) ---');
assert(computeModeBEffects({}).healOnKill === 0, 'no upgrades: 0');
assert(computeModeBEffects({ horse: 1 }).healOnKill === 2, 'horse 1: 2HP');
assert(computeModeBEffects({ goat: 1 }).healOnKill === 2, 'goat 1: 2HP');
assert(computeModeBEffects({ horse: 2, goat: 1 }).healOnKill === 6, 'horse 2 + goat 1: 6HP');

// 13. Mode B: dog/pig give +30HP shield per level
console.log('--- Mode B: dog/pig (shield HP) ---');
assert(computeModeBEffects({}).shieldHp === 0, 'no upgrades: 0');
assert(computeModeBEffects({ dog: 1 }).shieldHp === 30, 'dog 1: 30HP');
assert(computeModeBEffects({ pig: 1 }).shieldHp === 30, 'pig 1: 30HP');
assert(computeModeBEffects({ dog: 2, pig: 1 }).shieldHp === 90, 'dog 2 + pig 1: 90HP');

// 14. Backward compatibility: undefined upgrades
console.log('--- Backward compatibility ---');
assert(computeModeAEffects(undefined).babyUses === 1, 'undefined upgrades: 1 use');
assert(computeModeAEffects(null).babyDamageMul === 1, 'null upgrades: 1x damage');
assert(computeModeBEffects(undefined).autoHealPerSec === 0, 'undefined upgrades: 0 heal');
assert(computeModeBEffects({}).shieldHp === 0, 'empty upgrades: 0 shield');

// 15. Stacking: persistent upgrades stack multiplicatively with roguelike
console.log('--- Stacking with roguelike ---');
const persistentAtkMul = computeModeBEffects({ ox: 2 }).attackDamageMul; // 1.3
const roguelikeAtkMul = 1.2; // from a roguelike upgrade
const combined = persistentAtkMul * roguelikeAtkMul;
assertClose(combined, 1.56, 0.001, 'persistent 1.3x * roguelike 1.2x = 1.56x');

// Summary
console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!');
  process.exit(0);
}
