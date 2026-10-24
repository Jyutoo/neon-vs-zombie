'use strict';
/**
 * Issue #2 items 1, 2, 5, 6 — the shared save store.
 * These import production progress.js; nothing is re-implemented here.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const ProgressStore = require('../src/js/progress.js');
const { createStorage } = require('./helpers/browser-env');

const V1 = ProgressStore.V1_SAVE_KEY;
const V2 = ProgressStore.SAVE_KEY;

test('a brand new player keeps the starting 500 custard', () => {
  const save = createStorage();
  assert.equal(ProgressStore.load(save).custard, 500);
});

test('v1 save survives an endless record written before the tower page loads', () => {
  const old = {
    coins: 350, totalEarned: 800, highestCleared: 5, selectedLevel: 6,
    unlocked: ['egg', 'snake', 'ox', 'monkey', 'rat', 'dragon']
  };
  const save = createStorage({ [V1]: JSON.stringify(old) });
  // Endless finishes first and owns only its own field.
  ProgressStore.update(progress => {
    progress.endlessBest = { wave: 3, kills: 12, date: '2026-10-25' };
  }, save);

  const progress = ProgressStore.load(save);
  assert.equal(progress.custard, 350);
  assert.equal(progress.highestCleared, 5);
  assert.deepEqual(progress.unlocked, old.unlocked);
  assert.deepEqual(progress.endlessBest, { wave: 3, kills: 12, date: '2026-10-25' });
});

test('a partial v2 object never masks the legacy save', () => {
  const save = createStorage({
    [V1]: JSON.stringify({ coins: 900, highestCleared: 4, unlocked: ['egg', 'snake', 'ox', 'monkey', 'pig'] }),
    [V2]: JSON.stringify({ endlessBest: { wave: 7, kills: 40, date: '2026-10-25' } })
  });
  const progress = ProgressStore.load(save);
  assert.equal(progress.custard, 900);
  assert.equal(progress.highestCleared, 4);
  assert.equal(progress.unlocked.includes('pig'), true);
  assert.equal(progress.endlessBest.wave, 7);
});

test('loading persists a complete save and retires the v1 key', () => {
  const save = createStorage({ [V1]: JSON.stringify({ coins: 120, highestCleared: 2 }) });
  ProgressStore.load(save);
  assert.equal(save.getItem(V1), null);
  const stored = JSON.parse(save.getItem(V2));
  for (const field of ['custard', 'highestCleared', 'actionHighestCleared',
    'endlessBest', 'selectedLevel', 'unlocked', 'upgrades']) {
    assert.ok(Object.prototype.hasOwnProperty.call(stored, field), `${field} missing`);
  }
});

test('characters kept by migration stay upgradeable', () => {
  const save = createStorage({
    [V1]: JSON.stringify({ coins: 500, highestCleared: 5, unlocked: ['egg', 'snake', 'ox', 'monkey', 'dragon'] })
  });
  const progress = ProgressStore.load(save);
  assert.equal(ProgressStore.isCharacterUnlocked('dragon', progress), true);
  // A character nobody owns still needs its own level gate.
  assert.equal(ProgressStore.isCharacterUnlocked('horse', progress), false);
  assert.equal(ProgressStore.isCharacterUnlocked('rat', {
    highestCleared: 2, unlocked: ['egg', 'snake', 'ox', 'monkey']
  }), true);
});

test('progress cannot point past the twelve level track', () => {
  const progress = ProgressStore.normalize({
    highestCleared: 40, actionHighestCleared: 40, selectedLevel: 13
  });
  assert.equal(progress.highestCleared, 12);
  assert.equal(progress.actionHighestCleared, 12);
  assert.equal(progress.selectedLevel, 12);
});

test('winning the final level does not select a thirteenth', () => {
  const save = createStorage({ [V2]: JSON.stringify({ highestCleared: 11, selectedLevel: 12 }) });
  const progress = ProgressStore.update(p => {
    p.highestCleared = 12;
    p.selectedLevel = Math.min(ProgressStore.MAX_LEVEL, 12 + 1);
  }, save);
  assert.equal(progress.selectedLevel, 12);
});

test('junk values are coerced instead of trusted', () => {
  const progress = ProgressStore.normalize({
    custard: 'NaN', highestCleared: -5, unlocked: ['egg', 'wizard', 'egg'],
    upgrades: { egg: 99, rat: -3, snake: 'four' }, endlessBest: 'oops'
  });
  assert.equal(progress.custard, 0);
  assert.equal(progress.highestCleared, 0);
  assert.deepEqual(progress.unlocked, ['egg', 'snake', 'ox', 'monkey']);
  assert.equal(progress.upgrades.egg, ProgressStore.MAX_UPGRADE_LEVEL);
  assert.equal(progress.upgrades.rat, 0);
  assert.equal(progress.upgrades.snake, 0);
  assert.deepEqual(progress.endlessBest, { wave: 0, kills: 0, date: null });
});

test('mode B levels unlock three endless waves apart', () => {
  assert.equal(ProgressStore.actionLevelsUnlocked(0), 1);
  assert.equal(ProgressStore.actionLevelsUnlocked(5), 2);
  assert.equal(ProgressStore.actionLevelsUnlocked(6), 3);
  assert.equal(ProgressStore.actionLevelsUnlocked(33), 12);
  assert.equal(ProgressStore.actionLevelsUnlocked(999), 12);
});
