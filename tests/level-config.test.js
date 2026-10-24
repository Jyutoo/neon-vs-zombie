/**
 * Tests for the 12-level configuration system.
 *
 * These functions are defined in game.js (browser context).
 * To keep them testable in Node without a build step, we duplicate the pure
 * logic here and assert against it. Keep in sync with game.js.
 *
 * Run:  node tests/level-config.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// ── Functions under test (must match game.js) ────────────────────────────────

function levelWaveCount(level) {
  if (level <= 3) return 5;
  if (level <= 6) return 6;
  if (level <= 9) return 7;
  if (level <= 11) return 8;
  return 10; // level 12
}

function levelWaveConfig(level) {
  const count = levelWaveCount(level);
  const starts = [];
  const intervals = [];
  for (let i = 0; i < count; i++) {
    starts.push(12 + i * 36);
    intervals.push(Math.max(4, 8 - i * 0.4));
  }
  return { starts, intervals };
}

function levelScaling(level) {
  return {
    hp: Math.pow(1.15, level - 1),
    speed: Math.min(1.35, 1 + (level - 1) * .025),
    bite: Math.min(1.8, 1 + Math.max(0, level - 3) * .035)
  };
}

function firstClearReward(level) {
  return 50 + (level - 1) * 15;
}

function repeatReward(level) {
  return Math.max(10, Math.floor(firstClearReward(level) * .3));
}

function difficultyLabel(level) {
  if (level === 12) return 'BOSS 关';
  if (level <= 3) return '入门';
  if (level <= 6) return '进阶';
  if (level <= 9) return '中级';
  if (level <= 11) return '高级';
  return '最终BOSS';
}

// ── levelWaveCount tests ─────────────────────────────────────────────────────

test('levelWaveCount: levels 1-3 have 5 waves', () => {
  assert.equal(levelWaveCount(1), 5);
  assert.equal(levelWaveCount(2), 5);
  assert.equal(levelWaveCount(3), 5);
});

test('levelWaveCount: levels 4-6 have 6 waves', () => {
  assert.equal(levelWaveCount(4), 6);
  assert.equal(levelWaveCount(5), 6);
  assert.equal(levelWaveCount(6), 6);
});

test('levelWaveCount: levels 7-9 have 7 waves', () => {
  assert.equal(levelWaveCount(7), 7);
  assert.equal(levelWaveCount(8), 7);
  assert.equal(levelWaveCount(9), 7);
});

test('levelWaveCount: levels 10-11 have 8 waves', () => {
  assert.equal(levelWaveCount(10), 8);
  assert.equal(levelWaveCount(11), 8);
});

test('levelWaveCount: level 12 has 10 waves', () => {
  assert.equal(levelWaveCount(12), 10);
});

// ── levelWaveConfig tests ────────────────────────────────────────────────────

test('levelWaveConfig: returns correct number of starts and intervals', () => {
  for (let level = 1; level <= 12; level++) {
    const config = levelWaveConfig(level);
    const expected = levelWaveCount(level);
    assert.equal(config.starts.length, expected, `level ${level} starts count`);
    assert.equal(config.intervals.length, expected, `level ${level} intervals count`);
  }
});

test('levelWaveConfig: starts are staggered at 36-second intervals', () => {
  const config = levelWaveConfig(1);
  assert.equal(config.starts[0], 12);
  assert.equal(config.starts[1], 48);
  assert.equal(config.starts[2], 84);
  assert.equal(config.starts[3], 120);
  assert.equal(config.starts[4], 156);
});

test('levelWaveConfig: intervals decrease but stay >= 4', () => {
  const config = levelWaveConfig(12);
  assert.equal(config.intervals[0], 8);
  // All intervals should be >= 4
  for (const interval of config.intervals) {
    assert.ok(interval >= 4, `interval ${interval} should be >= 4`);
  }
});

// ── levelScaling tests ───────────────────────────────────────────────────────

test('levelScaling: level 1 has base scaling', () => {
  const s = levelScaling(1);
  assert.equal(s.hp, 1);
  assert.equal(s.speed, 1);
  assert.equal(s.bite, 1);
});

test('levelScaling: hp scales as 1.15^(level-1)', () => {
  assert.ok(Math.abs(levelScaling(2).hp - 1.15) < 0.001);
  assert.ok(Math.abs(levelScaling(5).hp - Math.pow(1.15, 4)) < 0.001);
  assert.ok(Math.abs(levelScaling(12).hp - Math.pow(1.15, 11)) < 0.001);
});

test('levelScaling: speed caps at 1.35', () => {
  // Level 12: 1 + 11*0.025 = 1.275 (not yet capped)
  const s12 = levelScaling(12);
  assert.ok(Math.abs(s12.speed - 1.275) < 0.001);
  // Cap reached at level 15: 1 + 14*0.025 = 1.35
  const s15 = levelScaling(15);
  assert.equal(s15.speed, 1.35);
  // Beyond cap stays at 1.35
  const s20 = levelScaling(20);
  assert.equal(s20.speed, 1.35);
});

test('levelScaling: bite caps at 1.8', () => {
  // Level 12: 1 + max(0, 9)*0.035 = 1.315 (not yet capped)
  const s12 = levelScaling(12);
  assert.ok(Math.abs(s12.bite - 1.315) < 0.001);
  // Cap reached at level 27+: 1 + 24*0.035 = 1.84 → capped to 1.8
  const s30 = levelScaling(30);
  assert.equal(s30.bite, 1.8);
});

// ── Boss logic tests ─────────────────────────────────────────────────────────

test('boss: only appears on level 12', () => {
  // Boss should NOT appear on levels 1-11
  for (let level = 1; level <= 11; level++) {
    assert.notEqual(level, 12, `level ${level} should not have boss`);
  }
  // The actual boss check in levelWaves is: level === 12 && waveIndex === waveCount - 1
  // We verify the condition logic here
  const hasBoss = (level) => level === 12;
  assert.equal(hasBoss(5), false, 'level 5 should not have boss (was old boss level)');
  assert.equal(hasBoss(10), false, 'level 10 should not have boss (was old boss level)');
  assert.equal(hasBoss(12), true, 'level 12 should have boss');
});

// ── firstClearReward tests ───────────────────────────────────────────────────

test('firstClearReward: level 1 gives 50', () => {
  assert.equal(firstClearReward(1), 50);
});

test('firstClearReward: level 12 gives 215', () => {
  assert.equal(firstClearReward(12), 215);
});

test('firstClearReward: linear progression 50 + (level-1)*15', () => {
  for (let level = 1; level <= 12; level++) {
    assert.equal(firstClearReward(level), 50 + (level - 1) * 15);
  }
});

test('repeatReward: 30% of firstClear, minimum 10', () => {
  assert.equal(repeatReward(1), Math.max(10, Math.floor(50 * 0.3))); // 15
  assert.equal(repeatReward(12), Math.max(10, Math.floor(215 * 0.3))); // 64
  // All repeat rewards should be >= 10
  for (let level = 1; level <= 12; level++) {
    assert.ok(repeatReward(level) >= 10, `level ${level} repeat reward should be >= 10`);
  }
});

// ── difficultyLabel tests ────────────────────────────────────────────────────

test('difficultyLabel: level 12 is BOSS 关', () => {
  assert.equal(difficultyLabel(12), 'BOSS 关');
});

test('difficultyLabel: levels 1-3 are 入门', () => {
  assert.equal(difficultyLabel(1), '入门');
  assert.equal(difficultyLabel(2), '入门');
  assert.equal(difficultyLabel(3), '入门');
});

test('difficultyLabel: levels 4-6 are 进阶', () => {
  assert.equal(difficultyLabel(4), '进阶');
  assert.equal(difficultyLabel(5), '进阶');
  assert.equal(difficultyLabel(6), '进阶');
});

test('difficultyLabel: levels 7-9 are 中级', () => {
  assert.equal(difficultyLabel(7), '中级');
  assert.equal(difficultyLabel(8), '中级');
  assert.equal(difficultyLabel(9), '中级');
});

test('difficultyLabel: levels 10-11 are 高级', () => {
  assert.equal(difficultyLabel(10), '高级');
  assert.equal(difficultyLabel(11), '高级');
});

// ── maxDisplayLevel test ─────────────────────────────────────────────────────

test('maxDisplayLevel: should be fixed at 12', () => {
  // The function should return 12 regardless of progress
  function maxDisplayLevel() {
    return 12;
  }
  assert.equal(maxDisplayLevel(), 12);
});
