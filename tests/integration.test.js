/**
 * Integration tests — verify all game systems work together.
 *
 * Covers:
 *   1. Save migration v1 → v2
 *   2. Level unlock progression (Mode A: clear level → unlock next)
 *   3. Character unlock progression (clear level → unlock character)
 *   4. Upgrade system (spend custard → increase level)
 *   5. Mode A level configuration (12 levels, correct waves)
 *   6. Mode B unlock formula (endless wave → level unlock)
 *   7. Upgrade effects calculation (multipliers correct)
 *   8. Cross-mode upgrade persistence
 *
 * Run:  node tests/integration.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// ── Shared constants (must match game.js / upgrade.js / action-levels.js) ──

const V1_KEY = 'nailong-vs-zombies-progress-v1';
const V2_KEY = 'nailong-vs-zombies-progress-v2';

const STARTING_UNITS = ['egg', 'snake', 'ox', 'monkey'];
const UNIT_ORDER = ['egg', 'snake', 'ox', 'monkey', 'rat', 'rabbit', 'dog', 'tiger', 'goat', 'rooster', 'pig', 'horse', 'dragon'];
const VALID_UNITS = UNIT_ORDER; // all 13 characters

const CHARACTER_UNLOCK_LEVELS = {
  rat: 2, rabbit: 3, dog: 4, tiger: 5,
  goat: 6, rooster: 7, pig: 8, horse: 9, dragon: 10
};

const UPGRADE_COSTS = [100, 200, 400, 800, 1600, 3200, 6400];
const MAX_UPGRADE_LEVEL = 7;

const MAX_MODE_B_LEVEL = 12;

// ── Pure logic functions (mirrored from game.js / upgrade.js / action-levels.js) ──

function migrateSaveV1ToV2(v1Data) {
  if (!v1Data || typeof v1Data !== 'object') v1Data = {};
  const coins = Math.max(0, Math.floor(Number(v1Data.coins) || 0));
  const totalEarned = Math.max(coins, Math.floor(Number(v1Data.totalEarned) || 0));
  const highestCleared = Math.max(0, Math.floor(Number(v1Data.highestCleared) || 0));
  const rawUnlocked = Array.isArray(v1Data.unlocked) ? v1Data.unlocked : [];
  const unlocked = [...new Set(rawUnlocked.filter(k => VALID_UNITS.includes(k)))];
  STARTING_UNITS.forEach(k => { if (!unlocked.includes(k)) unlocked.push(k); });
  return {
    custard: coins,
    highestCleared,
    actionHighestCleared: 0,
    endlessBest: { wave: 0, kills: 0, date: null },
    selectedLevel: Math.min(highestCleared + 1, Math.max(1, Math.floor(Number(v1Data.selectedLevel) || 1))),
    unlocked,
    upgrades: {
      egg: 0, rat: 0, snake: 0, dragon: 0, rabbit: 0,
      tiger: 0, ox: 0, monkey: 0, goat: 0, rooster: 0,
      pig: 0, horse: 0, dog: 0
    }
  };
}

function defaultProgress() {
  return {
    custard: 500,
    highestCleared: 0,
    actionHighestCleared: 0,
    endlessBest: { wave: 0, kills: 0, date: null },
    selectedLevel: 1,
    unlocked: [...STARTING_UNITS],
    upgrades: {
      egg: 0, rat: 0, snake: 0, dragon: 0, rabbit: 0,
      tiger: 0, ox: 0, monkey: 0, goat: 0, rooster: 0,
      pig: 0, horse: 0, dog: 0
    }
  };
}

function createMockStorage() {
  const store = {};
  return {
    getItem(key) { return store[key] ?? null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    clear() { for (const k in store) delete store[k]; },
    _store: store
  };
}

function loadProgressWithMigration(storage) {
  const fallback = defaultProgress();
  try {
    const raw2 = JSON.parse(storage.getItem(V2_KEY));
    if (raw2 && typeof raw2 === 'object') return raw2;
  } catch {}
  try {
    const raw1 = JSON.parse(storage.getItem(V1_KEY));
    if (raw1 && typeof raw1 === 'object') {
      const migrated = migrateSaveV1ToV2(raw1);
      storage.setItem(V2_KEY, JSON.stringify(migrated));
      storage.removeItem(V1_KEY);
      return migrated;
    }
  } catch {}
  return fallback;
}

// Level config
function levelWaveCount(level) {
  if (level <= 3) return 5;
  if (level <= 6) return 6;
  if (level <= 9) return 7;
  if (level <= 11) return 8;
  return 10;
}

function firstClearReward(level) {
  return 50 + (level - 1) * 15;
}

function repeatReward(level) {
  return Math.max(10, Math.floor(firstClearReward(level) * 0.3));
}

// Character unlock check
function checkCharacterUnlocks(highestCleared, currentlyUnlocked) {
  const unlocked = [...currentlyUnlocked];
  const newlyUnlocked = [];
  for (const [char, level] of Object.entries(CHARACTER_UNLOCK_LEVELS)) {
    if (highestCleared >= level && !unlocked.includes(char)) {
      unlocked.push(char);
      newlyUnlocked.push(char);
    }
  }
  return { unlocked, newlyUnlocked };
}

// Mode B level unlock formula
function modeBUnlockedLevel(endlessWave) {
  return Math.min(MAX_MODE_B_LEVEL, Math.floor(endlessWave / 3) + 1);
}

// Upgrade effects
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

// Simulate finishing a Mode A level (mirrors game.js finishGame logic)
function finishModeALevel(progress, level, won) {
  if (!won) return { progress, reward: 0, firstClear: false };
  const firstClear = level === progress.highestCleared + 1;
  const reward = firstClear ? firstClearReward(level) : repeatReward(level);
  progress.custard += reward;
  if (firstClear) {
    progress.highestCleared = level;
    progress.selectedLevel = Math.min(level + 1, 12);
    const unlockResult = checkCharacterUnlocks(progress.highestCleared, progress.unlocked);
    progress.unlocked = unlockResult.unlocked;
  }
  return { progress, reward, firstClear };
}

// Simulate upgrading a character (mirrors upgrade.js upgradeCharacter logic)
function performUpgrade(progress, key) {
  const level = (progress.upgrades && progress.upgrades[key]) || 0;
  if (level >= MAX_UPGRADE_LEVEL) return { progress, success: false, reason: 'maxed' };
  const cost = UPGRADE_COSTS[level];
  if (progress.custard < cost) return { progress, success: false, reason: 'insufficient_custard' };
  progress.custard -= cost;
  if (!progress.upgrades) progress.upgrades = {};
  progress.upgrades[key] = level + 1;
  return { progress, success: true, cost };
}

// ══════════════════════════════════════════════════════════════════════════════
// Integration Test 1: Save migration v1 → v2
// ══════════════════════════════════════════════════════════════════════════════

test('Integration: v1 save migrates to valid v2 format with all fields', () => {
  const storage = createMockStorage();
  const v1Data = {
    coins: 1200,
    totalEarned: 3000,
    highestCleared: 5,
    selectedLevel: 4,
    unlocked: ['egg', 'snake', 'ox', 'monkey', 'rat', 'tiger', 'dragon']
  };
  storage.setItem(V1_KEY, JSON.stringify(v1Data));

  const result = loadProgressWithMigration(storage);

  // All v2 fields present
  assert.equal(typeof result.custard, 'number');
  assert.equal(typeof result.highestCleared, 'number');
  assert.equal(typeof result.actionHighestCleared, 'number');
  assert.ok(result.endlessBest && typeof result.endlessBest === 'object');
  assert.equal(typeof result.selectedLevel, 'number');
  assert.ok(Array.isArray(result.unlocked));
  assert.ok(result.upgrades && typeof result.upgrades === 'object');

  // Values preserved
  assert.equal(result.custard, 1200);
  assert.equal(result.highestCleared, 5);
  assert.equal(result.actionHighestCleared, 0);
  assert.deepEqual(result.endlessBest, { wave: 0, kills: 0, date: null });

  // Unlocked characters preserved
  assert.ok(result.unlocked.includes('rat'));
  assert.ok(result.unlocked.includes('tiger'));
  assert.ok(result.unlocked.includes('dragon'));
  for (const unit of STARTING_UNITS) {
    assert.ok(result.unlocked.includes(unit), `Missing starting unit: ${unit}`);
  }

  // All upgrades initialized to 0
  for (const key of UNIT_ORDER) {
    assert.equal(result.upgrades[key], 0, `Upgrade ${key} should be 0`);
  }

  // v1 deleted, v2 created
  assert.equal(storage.getItem(V1_KEY), null);
  assert.ok(storage.getItem(V2_KEY) !== null);
});

test('Integration: fresh start (no save) returns valid default progress', () => {
  const storage = createMockStorage();
  const result = loadProgressWithMigration(storage);
  const expected = defaultProgress();

  assert.equal(result.custard, expected.custard);
  assert.equal(result.highestCleared, expected.highestCleared);
  assert.equal(result.actionHighestCleared, expected.actionHighestCleared);
  assert.deepEqual(result.endlessBest, expected.endlessBest);
  assert.deepEqual(result.unlocked, expected.unlocked);
  assert.equal(result.selectedLevel, 1);

  // All 13 upgrade keys present
  assert.equal(Object.keys(result.upgrades).length, 13);
});

// ══════════════════════════════════════════════════════════════════════════════
// Integration Test 2: Level unlock progression (Mode A)
// ══════════════════════════════════════════════════════════════════════════════

test('Integration: clearing levels sequentially unlocks next level each time', () => {
  let progress = defaultProgress();
  assert.equal(progress.highestCleared, 0);
  assert.equal(progress.selectedLevel, 1);

  // Clear level 1
  const r1 = finishModeALevel(progress, 1, true);
  assert.equal(r1.firstClear, true);
  assert.equal(r1.reward, firstClearReward(1)); // 50
  assert.equal(progress.highestCleared, 1);
  assert.equal(progress.selectedLevel, 2);

  // Clear level 2
  const r2 = finishModeALevel(progress, 2, true);
  assert.equal(r2.firstClear, true);
  assert.equal(r2.reward, firstClearReward(2)); // 65
  assert.equal(progress.highestCleared, 2);
  assert.equal(progress.selectedLevel, 3);

  // Clear level 5
  progress.highestCleared = 4;
  progress.selectedLevel = 5;
  const r5 = finishModeALevel(progress, 5, true);
  assert.equal(r5.firstClear, true);
  assert.equal(r5.reward, firstClearReward(5)); // 110
  assert.equal(progress.highestCleared, 5);
  assert.equal(progress.selectedLevel, 6);
});

test('Integration: replaying a cleared level gives repeat reward, no progression', () => {
  let progress = defaultProgress();
  progress.highestCleared = 5;
  progress.selectedLevel = 6;

  // Replay level 3 (already cleared)
  const r = finishModeALevel(progress, 3, true);
  assert.equal(r.firstClear, false);
  assert.equal(r.reward, repeatReward(3)); // 30% of 80 = 24
  assert.equal(progress.highestCleared, 5); // unchanged
  assert.equal(progress.selectedLevel, 6); // unchanged
});

test('Integration: losing a level gives no reward and no progression', () => {
  let progress = defaultProgress();
  progress.highestCleared = 3;

  const r = finishModeALevel(progress, 4, false);
  assert.equal(r.reward, 0);
  assert.equal(r.firstClear, false);
  assert.equal(progress.highestCleared, 3); // unchanged
  assert.equal(progress.custard, 500); // default, unchanged
});

test('Integration: clearing all 12 levels accumulates correct total custard', () => {
  let progress = defaultProgress();
  const initialCustard = progress.custard; // 500
  let totalReward = 0;

  for (let level = 1; level <= 12; level++) {
    const r = finishModeALevel(progress, level, true);
    assert.equal(r.firstClear, true, `Level ${level} should be first clear`);
    totalReward += r.reward;
  }

  // Sum of firstClearReward(1..12) = sum of 50 + (level-1)*15
  // = 50 + 65 + 80 + 95 + 110 + 125 + 140 + 155 + 170 + 185 + 200 + 215
  const expectedTotal = 12 * 50 + 15 * (0 + 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11);
  // = 600 + 15 * 66 = 600 + 990 = 1590
  assert.equal(totalReward, expectedTotal);
  assert.equal(progress.custard, initialCustard + expectedTotal);
  assert.equal(progress.highestCleared, 12);
});

// ══════════════════════════════════════════════════════════════════════════════
// Integration Test 3: Character unlock progression
// ══════════════════════════════════════════════════════════════════════════════

test('Integration: clearing level 2 unlocks rat character', () => {
  let progress = defaultProgress();
  assert.ok(!progress.unlocked.includes('rat'));

  finishModeALevel(progress, 1, true);
  assert.ok(!progress.unlocked.includes('rat'), 'rat should NOT unlock at level 1');

  finishModeALevel(progress, 2, true);
  assert.ok(progress.unlocked.includes('rat'), 'rat should unlock at level 2');
});

test('Integration: clearing level 10 unlocks all characters', () => {
  let progress = defaultProgress();

  for (let level = 1; level <= 10; level++) {
    finishModeALevel(progress, level, true);
  }

  // All 13 characters should be unlocked
  for (const char of UNIT_ORDER) {
    assert.ok(progress.unlocked.includes(char), `${char} should be unlocked after clearing level 10`);
  }
  assert.equal(progress.unlocked.length, 13);
});

test('Integration: character unlock pacing — correct characters at each milestone', () => {
  let progress = defaultProgress();

  // After clearing level 1: no new characters
  finishModeALevel(progress, 1, true);
  assert.deepEqual(progress.unlocked.sort(), [...STARTING_UNITS].sort());

  // After clearing level 2: rat
  finishModeALevel(progress, 2, true);
  assert.ok(progress.unlocked.includes('rat'));
  assert.equal(progress.unlocked.length, 5); // 4 starting + rat

  // After clearing level 4: rat, rabbit, dog
  finishModeALevel(progress, 3, true);
  finishModeALevel(progress, 4, true);
  assert.ok(progress.unlocked.includes('rabbit'));
  assert.ok(progress.unlocked.includes('dog'));
  assert.equal(progress.unlocked.length, 7);

  // After clearing level 5: + tiger
  finishModeALevel(progress, 5, true);
  assert.ok(progress.unlocked.includes('tiger'));
  assert.equal(progress.unlocked.length, 8);
});

// ══════════════════════════════════════════════════════════════════════════════
// Integration Test 4: Upgrade system (spend custard → increase level)
// ══════════════════════════════════════════════════════════════════════════════

test('Integration: upgrading egg from 0→1 costs 100 custard', () => {
  let progress = defaultProgress();
  const initialCustard = progress.custard; // 500

  const result = performUpgrade(progress, 'egg');
  assert.equal(result.success, true);
  assert.equal(result.cost, 100);
  assert.equal(progress.custard, initialCustard - 100);
  assert.equal(progress.upgrades.egg, 1);
});

test('Integration: upgrading through all 7 levels costs total 12,700', () => {
  let progress = defaultProgress();
  progress.custard = 100000; // plenty of custard

  let totalCost = 0;
  for (let i = 0; i < MAX_UPGRADE_LEVEL; i++) {
    const result = performUpgrade(progress, 'egg');
    assert.equal(result.success, true);
    assert.equal(result.cost, UPGRADE_COSTS[i]);
    totalCost += result.cost;
  }

  // Sum: 100 + 200 + 400 + 800 + 1600 + 3200 + 6400 = 12700
  assert.equal(totalCost, 12700);
  assert.equal(progress.upgrades.egg, 7);
});

test('Integration: cannot upgrade beyond max level', () => {
  let progress = defaultProgress();
  progress.custard = 100000;
  progress.upgrades.egg = 7;

  const result = performUpgrade(progress, 'egg');
  assert.equal(result.success, false);
  assert.equal(result.reason, 'maxed');
});

test('Integration: cannot upgrade without enough custard', () => {
  let progress = defaultProgress();
  progress.custard = 50; // not enough for first upgrade (100)

  const result = performUpgrade(progress, 'egg');
  assert.equal(result.success, false);
  assert.equal(result.reason, 'insufficient_custard');
  assert.equal(progress.upgrades.egg, 0);
});

test('Integration: upgrade costs escalate correctly per level', () => {
  const expectedCosts = [100, 200, 400, 800, 1600, 3200, 6400];
  for (let i = 0; i < expectedCosts.length; i++) {
    assert.equal(UPGRADE_COSTS[i], expectedCosts[i], `Level ${i} cost should be ${expectedCosts[i]}`);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Integration Test 5: Mode A level configuration (12 levels, correct waves)
// ══════════════════════════════════════════════════════════════════════════════

test('Integration: all 12 levels have valid wave counts', () => {
  const expectedWaves = {
    1: 5, 2: 5, 3: 5,
    4: 6, 5: 6, 6: 6,
    7: 7, 8: 7, 9: 7,
    10: 8, 11: 8,
    12: 10
  };

  for (const [level, expected] of Object.entries(expectedWaves)) {
    assert.equal(levelWaveCount(Number(level)), expected, `Level ${level} should have ${expected} waves`);
  }
});

test('Integration: difficulty curve — wave count increases with level', () => {
  let prevWaves = 0;
  for (let level = 1; level <= 12; level++) {
    const waves = levelWaveCount(level);
    assert.ok(waves >= prevWaves, `Level ${level} waves (${waves}) should be >= level ${level - 1} waves (${prevWaves})`);
    prevWaves = waves;
  }
});

test('Integration: rewards scale linearly with level', () => {
  for (let level = 1; level <= 12; level++) {
    assert.equal(firstClearReward(level), 50 + (level - 1) * 15);
    assert.ok(repeatReward(level) >= 10, `Level ${level} repeat reward should be >= 10`);
    assert.ok(repeatReward(level) < firstClearReward(level), `Level ${level} repeat should be less than first clear`);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Integration Test 6: Mode B unlock formula (endless wave → level unlock)
// ══════════════════════════════════════════════════════════════════════════════

test('Integration: Mode B level unlock formula — wave 0 unlocks level 1', () => {
  assert.equal(modeBUnlockedLevel(0), 1);
});

test('Integration: Mode B level unlock formula — wave 3 unlocks level 2', () => {
  assert.equal(modeBUnlockedLevel(3), 2);
});

test('Integration: Mode B level unlock formula — wave 33 unlocks all 12 levels', () => {
  assert.equal(modeBUnlockedLevel(33), 12);
});

test('Integration: Mode B level unlock formula — caps at 12', () => {
  assert.equal(modeBUnlockedLevel(100), 12);
  assert.equal(modeBUnlockedLevel(999), 12);
});

test('Integration: Mode B unlock progression — each 3 waves unlocks one level', () => {
  for (let wave = 0; wave <= 33; wave++) {
    const unlocked = modeBUnlockedLevel(wave);
    const expected = Math.min(12, Math.floor(wave / 3) + 1);
    assert.equal(unlocked, expected, `Wave ${wave} should unlock level ${expected}`);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Integration Test 7: Upgrade effects calculation
// ══════════════════════════════════════════════════════════════════════════════

test('Integration: Mode A effects — max upgrades give expected values', () => {
  const maxUpgrades = {
    egg: 7, rat: 7, snake: 7, dragon: 7, rabbit: 7,
    tiger: 7, ox: 7, monkey: 7, goat: 7, rooster: 7,
    pig: 7, horse: 7, dog: 7
  };

  const effects = computeModeAEffects(maxUpgrades);

  // egg 7 → 1 + 7 = 8 uses
  assert.equal(effects.babyUses, 8);

  // ox+tiger+monkey = 21 levels * 15% = 3.15 → multiplier 4.15
  assert.ok(Math.abs(effects.babyDamageMul - 4.15) < 0.001, `babyDamageMul should be ~4.15, got ${effects.babyDamageMul}`);

  // snake+dragon = 14 levels * 20% = 2.8 → multiplier 3.8
  assert.ok(Math.abs(effects.babyDotMul - 3.8) < 0.001, `babyDotMul should be ~3.8, got ${effects.babyDotMul}`);

  // horse+goat = 14 levels * 10 = 140 HP heal
  assert.equal(effects.babyHealPerUse, 140);

  // dog+pig = 14 levels * 20 = 280 HP shield
  assert.equal(effects.babyShieldPerUse, 280);

  // rat+rabbit+rooster = 21 levels * 10% = 2.1 → capped at 0.7 → multiplier 0.3
  assert.ok(Math.abs(effects.babyCooldownMul - 0.3) < 0.001);
});

test('Integration: Mode B effects — max upgrades give expected values', () => {
  const maxUpgrades = {
    egg: 7, rat: 7, snake: 7, dragon: 7, rabbit: 7,
    tiger: 7, ox: 7, monkey: 7, goat: 7, rooster: 7,
    pig: 7, horse: 7, dog: 7
  };

  const effects = computeModeBEffects(maxUpgrades);

  // egg 7 → 7 HP/sec
  assert.equal(effects.autoHealPerSec, 7);

  // ox+tiger+monkey = 21 * 15% → 4.15x
  assert.ok(Math.abs(effects.attackDamageMul - 4.15) < 0.001, `attackDamageMul should be ~4.15, got ${effects.attackDamageMul}`);

  // snake+dragon = 14 * 20% → 3.8x
  assert.ok(Math.abs(effects.dotDamageMul - 3.8) < 0.001, `dotDamageMul should be ~3.8, got ${effects.dotDamageMul}`);

  // horse+goat = 14 * 2 = 28 HP on kill
  assert.equal(effects.healOnKill, 28);

  // dog+pig = 14 * 30 = 420 HP shield
  assert.equal(effects.shieldHp, 420);

  // cooldown capped at 0.3
  assert.ok(Math.abs(effects.skillCooldownMul - 0.3) < 0.001);
});

test('Integration: zero upgrades give baseline effects', () => {
  const modeA = computeModeAEffects({});
  assert.equal(modeA.babyUses, 1);
  assert.equal(modeA.babyDamageMul, 1);
  assert.equal(modeA.babyDotMul, 1);
  assert.equal(modeA.babyHealPerUse, 0);
  assert.equal(modeA.babyShieldPerUse, 0);
  assert.equal(modeA.babyCooldownMul, 1);

  const modeB = computeModeBEffects({});
  assert.equal(modeB.autoHealPerSec, 0);
  assert.equal(modeB.attackDamageMul, 1);
  assert.equal(modeB.dotDamageMul, 1);
  assert.equal(modeB.healOnKill, 0);
  assert.equal(modeB.shieldHp, 0);
  assert.equal(modeB.skillCooldownMul, 1);
});

// ══════════════════════════════════════════════════════════════════════════════
// Integration Test 8: Cross-mode upgrade persistence
// ══════════════════════════════════════════════════════════════════════════════

test('Integration: upgrades persist across Mode A and Mode B', () => {
  let progress = defaultProgress();

  // Upgrade egg to level 3
  progress.custard = 10000;
  progress.upgrades.egg = 3;

  // Mode A should see egg level 3
  const modeA = computeModeAEffects(progress.upgrades);
  assert.equal(modeA.babyUses, 4); // 1 + 3

  // Mode B should also see egg level 3
  const modeB = computeModeBEffects(progress.upgrades);
  assert.equal(modeB.autoHealPerSec, 3);

  // Upgrade egg to level 5 more
  progress.upgrades.egg = 5;

  // Both modes should see the new level
  const modeA2 = computeModeAEffects(progress.upgrades);
  assert.equal(modeA2.babyUses, 6);

  const modeB2 = computeModeBEffects(progress.upgrades);
  assert.equal(modeB2.autoHealPerSec, 5);
});

test('Integration: upgrading one character does not affect others', () => {
  let progress = defaultProgress();
  progress.custard = 100000;

  // Upgrade only ox
  progress.upgrades.ox = 5;

  const modeA = computeModeAEffects(progress.upgrades);
  // ox contributes to babyDamageMul: 5 * 15% = 0.75 → 1.75x
  assert.equal(modeA.babyDamageMul, 1.75);

  // rat is still 0, so cooldown should be baseline
  assert.equal(modeA.babyCooldownMul, 1);

  // snake is still 0, so dot should be baseline
  assert.equal(modeA.babyDotMul, 1);
});

test('Integration: full game flow — migrate, play levels, unlock chars, upgrade, verify effects', () => {
  const storage = createMockStorage();

  // Step 1: Start with a v1 save
  const v1Data = {
    coins: 300,
    totalEarned: 300,
    highestCleared: 0,
    selectedLevel: 1,
    unlocked: ['egg', 'snake', 'ox', 'monkey']
  };
  storage.setItem(V1_KEY, JSON.stringify(v1Data));

  // Step 2: Migrate to v2
  let progress = loadProgressWithMigration(storage);
  assert.equal(progress.custard, 300);
  assert.equal(progress.highestCleared, 0);

  // Step 3: Play and clear levels 1-5
  for (let level = 1; level <= 5; level++) {
    const result = finishModeALevel(progress, level, true);
    assert.equal(result.firstClear, true);
    progress.custard += 0; // reward already added by finishModeALevel
  }

  // After clearing level 5: should have earned 50+65+80+95+110 = 400 custard
  // Total: 300 (migrated) + 400 = 700
  assert.equal(progress.custard, 700);
  assert.equal(progress.highestCleared, 5);

  // Characters unlocked: rat (lv2), rabbit (lv3), dog (lv4), tiger (lv5)
  assert.ok(progress.unlocked.includes('rat'));
  assert.ok(progress.unlocked.includes('rabbit'));
  assert.ok(progress.unlocked.includes('dog'));
  assert.ok(progress.unlocked.includes('tiger'));
  assert.ok(!progress.unlocked.includes('goat')); // needs level 6

  // Step 4: Spend custard on upgrades
  // Upgrade rat (cooldown) to level 2: costs 100 + 200 = 300
  let r1 = performUpgrade(progress, 'rat');
  assert.equal(r1.success, true);
  assert.equal(r1.cost, 100);
  let r2 = performUpgrade(progress, 'rat');
  assert.equal(r2.success, true);
  assert.equal(r2.cost, 200);

  // Remaining custard: 700 - 300 = 400
  assert.equal(progress.custard, 400);
  assert.equal(progress.upgrades.rat, 2);

  // Step 5: Verify upgrade effects
  const modeAEffects = computeModeAEffects(progress.upgrades);
  // rat 2 → cooldown: 1 - min(0.7, 2*0.1) = 1 - 0.2 = 0.8
  assert.equal(modeAEffects.babyCooldownMul, 0.8);

  const modeBEffects = computeModeBEffects(progress.upgrades);
  assert.equal(modeBEffects.skillCooldownMul, 0.8);

  // Step 6: Save and reload — verify persistence
  storage.setItem(V2_KEY, JSON.stringify(progress));
  const reloaded = JSON.parse(storage.getItem(V2_KEY));
  assert.equal(reloaded.custard, 400);
  assert.equal(reloaded.highestCleared, 5);
  assert.equal(reloaded.upgrades.rat, 2);
  assert.ok(reloaded.unlocked.includes('tiger'));

  // Step 7: Verify Mode B unlock from endless best
  reloaded.endlessBest = { wave: 9, kills: 50, date: '2026-10-25' };
  storage.setItem(V2_KEY, JSON.stringify(reloaded));
  const reloaded2 = JSON.parse(storage.getItem(V2_KEY));
  const modeBLevel = modeBUnlockedLevel(reloaded2.endlessBest.wave);
  assert.equal(modeBLevel, 4); // floor(9/3) + 1 = 4
});

// ══════════════════════════════════════════════════════════════════════════════
// Additional integration checks
// ══════════════════════════════════════════════════════════════════════════════

test('Integration: selectedLevel never exceeds highestCleared + 1', () => {
  let progress = defaultProgress();

  // Clear level 3
  for (let level = 1; level <= 3; level++) {
    finishModeALevel(progress, level, true);
  }

  assert.equal(progress.highestCleared, 3);
  assert.equal(progress.selectedLevel, 4);
  assert.ok(progress.selectedLevel <= progress.highestCleared + 1);
});

test('Integration: total custard economy — clearing all 12 levels once gives correct total', () => {
  let progress = defaultProgress();
  const startCustard = progress.custard;

  for (let level = 1; level <= 12; level++) {
    finishModeALevel(progress, level, true);
  }

  const totalEarned = progress.custard - startCustard;
  // Sum of firstClearReward(1..12) = 50+65+80+95+110+125+140+155+170+185+200+215
  let expectedSum = 0;
  for (let i = 1; i <= 12; i++) expectedSum += firstClearReward(i);
  assert.equal(totalEarned, expectedSum);
});

test('Integration: upgrade all 13 characters to max costs 13 × 12,700 = 165,100', () => {
  let progress = defaultProgress();
  progress.custard = 200000;

  let totalSpent = 0;
  for (const char of UNIT_ORDER) {
    for (let i = 0; i < MAX_UPGRADE_LEVEL; i++) {
      const result = performUpgrade(progress, char);
      assert.equal(result.success, true);
      totalSpent += result.cost;
    }
  }

  assert.equal(totalSpent, 13 * 12700);
  assert.equal(progress.custard, 200000 - totalSpent);

  // All upgrades at max level
  for (const char of UNIT_ORDER) {
    assert.equal(progress.upgrades[char], 7);
  }
});

test('Integration: Mode A and Mode B effects are consistent for same upgrades', () => {
  const upgrades = { egg: 3, rat: 2, snake: 1, ox: 4, horse: 2, dog: 1 };

  const modeA = computeModeAEffects(upgrades);
  const modeB = computeModeBEffects(upgrades);

  // Damage multiplier should be same formula in both modes
  assert.equal(modeA.babyDamageMul, modeB.attackDamageMul);

  // DoT multiplier should be same formula in both modes
  assert.equal(modeA.babyDotMul, modeB.dotDamageMul);

  // Cooldown multiplier should be same formula in both modes
  assert.equal(modeA.babyCooldownMul, modeB.skillCooldownMul);
});

test('Integration: save data round-trips through JSON serialization', () => {
  let progress = defaultProgress();
  progress.custard = 1234;
  progress.highestCleared = 7;
  progress.actionHighestCleared = 5;
  progress.endlessBest = { wave: 15, kills: 200, date: '2026-10-25' };
  progress.unlocked = ['egg', 'snake', 'ox', 'monkey', 'rat', 'rabbit', 'dog', 'tiger'];
  progress.upgrades.egg = 3;
  progress.upgrades.rat = 2;

  // Serialize and deserialize
  const json = JSON.stringify(progress);
  const restored = JSON.parse(json);

  assert.equal(restored.custard, 1234);
  assert.equal(restored.highestCleared, 7);
  assert.equal(restored.actionHighestCleared, 5);
  assert.deepEqual(restored.endlessBest, { wave: 15, kills: 200, date: '2026-10-25' });
  assert.deepEqual(restored.unlocked, progress.unlocked);
  assert.equal(restored.upgrades.egg, 3);
  assert.equal(restored.upgrades.rat, 2);
  assert.equal(restored.upgrades.snake, 0);
});
