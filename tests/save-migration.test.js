/**
 * Tests for v1 → v2 save migration.
 *
 * The migrateSaveV1ToV2 function is defined in game.js (browser context).
 * To keep it testable in Node without a build step, we duplicate the pure
 * logic here and assert against it.  A comment in game.js cross-references
 * this test file so future maintainers keep both copies in sync.
 *
 * Run:  node tests/save-migration.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// ── Constants (must match game.js) ──────────────────────────────────────────
const V1_KEY = 'nailong-vs-zombies-progress-v1';
const V2_KEY = 'nailong-vs-zombies-progress-v2';
const STARTING_UNITS = ['egg', 'snake', 'ox', 'monkey'];

// ── Migration function (must be identical to the one in game.js) ────────────
function migrateSaveV1ToV2(v1Data) {
  if (!v1Data || typeof v1Data !== 'object') v1Data = {};
  const coins = Math.max(0, Math.floor(Number(v1Data.coins) || 0));
  const totalEarned = Math.max(coins, Math.floor(Number(v1Data.totalEarned) || 0));
  const highestCleared = Math.max(0, Math.floor(Number(v1Data.highestCleared) || 0));
  const validUnits = [
    'egg','rat','snake','dragon','rabbit','tiger','ox','monkey',
    'goat','rooster','pig','horse','dog'
  ];
  const rawUnlocked = Array.isArray(v1Data.unlocked) ? v1Data.unlocked : [];
  const unlocked = [...new Set(rawUnlocked.filter(k => validUnits.includes(k)))];
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

// ── Mock localStorage ───────────────────────────────────────────────────────
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

// Simulates loadProgress with migration logic (mirrors game.js implementation)
function loadProgressWithMigration(storage) {
  const fallback = defaultProgress();

  // Try v2 first
  try {
    const raw2 = JSON.parse(storage.getItem(V2_KEY));
    if (raw2 && typeof raw2 === 'object') return raw2;
  } catch {}

  // Try v1 → migrate
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

// ── Tests ───────────────────────────────────────────────────────────────────

test('migrateSaveV1ToV2 converts coins to custard 1:1', () => {
  const v1 = { coins: 420, totalEarned: 1000, highestCleared: 5, unlocked: ['egg', 'snake', 'ox', 'monkey', 'rat'] };
  const v2 = migrateSaveV1ToV2(v1);
  assert.equal(v2.custard, 420);
});

test('migrateSaveV1ToV2 preserves highestCleared', () => {
  const v1 = { coins: 0, totalEarned: 0, highestCleared: 12, unlocked: ['egg'] };
  const v2 = migrateSaveV1ToV2(v1);
  assert.equal(v2.highestCleared, 12);
});

test('migrateSaveV1ToV2 preserves unlocked units and ensures starting units', () => {
  const v1 = { coins: 100, totalEarned: 200, highestCleared: 3, unlocked: ['rat', 'tiger'] };
  const v2 = migrateSaveV1ToV2(v1);
  assert.ok(v2.unlocked.includes('rat'));
  assert.ok(v2.unlocked.includes('tiger'));
  // Starting units must always be present
  for (const unit of STARTING_UNITS) {
    assert.ok(v2.unlocked.includes(unit), `Missing starting unit: ${unit}`);
  }
});

test('migrateSaveV1ToV2 filters invalid unit keys', () => {
  const v1 = { coins: 0, totalEarned: 0, highestCleared: 0, unlocked: ['egg', 'invalidUnit', 'dragon'] };
  const v2 = migrateSaveV1ToV2(v1);
  assert.ok(!v2.unlocked.includes('invalidUnit'));
  assert.ok(v2.unlocked.includes('egg'));
  assert.ok(v2.unlocked.includes('dragon'));
});

test('migrateSaveV1ToV2 initializes actionHighestCleared and endlessBest', () => {
  const v1 = { coins: 0, totalEarned: 0, highestCleared: 0, unlocked: [] };
  const v2 = migrateSaveV1ToV2(v1);
  assert.equal(v2.actionHighestCleared, 0);
  assert.deepEqual(v2.endlessBest, { wave: 0, kills: 0, date: null });
});

test('migrateSaveV1ToV2 initializes all upgrades to 0', () => {
  const v1 = { coins: 50, totalEarned: 50, highestCleared: 1, unlocked: ['egg'] };
  const v2 = migrateSaveV1ToV2(v1);
  const expectedKeys = ['egg','rat','snake','dragon','rabbit','tiger','ox','monkey','goat','rooster','pig','horse','dog'];
  for (const key of expectedKeys) {
    assert.equal(v2.upgrades[key], 0, `Upgrade ${key} should be 0`);
  }
});

test('migrateSaveV1ToV2 handles missing coins field gracefully', () => {
  const v1 = { totalEarned: 100, highestCleared: 2, unlocked: ['egg'] };
  const v2 = migrateSaveV1ToV2(v1);
  assert.equal(v2.custard, 0);
});

test('migrateSaveV1ToV2 handles null/undefined input gracefully', () => {
  const v2null = migrateSaveV1ToV2(null);
  assert.equal(v2null.custard, 0);
  assert.equal(v2null.highestCleared, 0);

  const v2undef = migrateSaveV1ToV2(undefined);
  assert.equal(v2undef.custard, 0);
});

test('loadProgressWithMigration migrates v1 to v2 and deletes v1 key', () => {
  const storage = createMockStorage();
  const v1Data = { coins: 300, totalEarned: 600, highestCleared: 7, unlocked: ['egg', 'snake', 'ox', 'monkey', 'dragon'] };
  storage.setItem(V1_KEY, JSON.stringify(v1Data));

  const result = loadProgressWithMigration(storage);

  // Should have migrated data
  assert.equal(result.custard, 300);
  assert.equal(result.highestCleared, 7);
  assert.ok(result.unlocked.includes('dragon'));

  // v2 key should now exist
  assert.ok(storage.getItem(V2_KEY) !== null);
  // v1 key should be deleted
  assert.equal(storage.getItem(V1_KEY), null);
});

test('loadProgressWithMigration returns v2 data directly when available', () => {
  const storage = createMockStorage();
  const v2Data = defaultProgress();
  v2Data.custard = 1200;
  v2Data.highestCleared = 10;
  storage.setItem(V2_KEY, JSON.stringify(v2Data));

  const result = loadProgressWithMigration(storage);
  assert.equal(result.custard, 1200);
  assert.equal(result.highestCleared, 10);
});

test('loadProgressWithMigration returns default when no save exists', () => {
  const storage = createMockStorage();
  const result = loadProgressWithMigration(storage);
  const expected = defaultProgress();
  assert.equal(result.custard, expected.custard);
  assert.equal(result.highestCleared, expected.highestCleared);
  assert.deepEqual(result.unlocked, expected.unlocked);
  assert.deepEqual(result.endlessBest, expected.endlessBest);
});

test('loadProgressWithMigration prefers v2 over v1 when both exist', () => {
  const storage = createMockStorage();
  const v1Data = { coins: 100, totalEarned: 100, highestCleared: 1, unlocked: ['egg'] };
  const v2Data = defaultProgress();
  v2Data.custard = 999;
  storage.setItem(V1_KEY, JSON.stringify(v1Data));
  storage.setItem(V2_KEY, JSON.stringify(v2Data));

  const result = loadProgressWithMigration(storage);
  // Should use v2 data (custard=999), not migrate v1 (coins=100)
  assert.equal(result.custard, 999);
  // v1 key should still exist (no migration performed)
  assert.ok(storage.getItem(V1_KEY) !== null);
});

test('defaultProgress has correct initial values', () => {
  const dp = defaultProgress();
  assert.equal(dp.custard, 500);
  assert.equal(dp.highestCleared, 0);
  assert.equal(dp.actionHighestCleared, 0);
  assert.deepEqual(dp.endlessBest, { wave: 0, kills: 0, date: null });
  assert.deepEqual(dp.unlocked, STARTING_UNITS);
  assert.equal(Object.keys(dp.upgrades).length, 13);
});
