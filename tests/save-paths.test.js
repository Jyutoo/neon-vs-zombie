'use strict';
/**
 * Issue #2 items 1, 2, 5, 6 — real page entry points, not copied formulas.
 * Each test boots the production script a browser would load and asserts what
 * that page actually reads or writes in localStorage.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const ProgressStore = require('../src/js/progress.js');
const { boot, createStorage } = require('./helpers/browser-env');

const V1 = ProgressStore.V1_SAVE_KEY;
const V2 = ProgressStore.SAVE_KEY;

const OLD_SAVE = {
  coins: 350, totalEarned: 800, highestCleared: 5, selectedLevel: 6,
  unlocked: ['egg', 'snake', 'ox', 'monkey', 'rat', 'dragon']
};

function bootTower(save) {
  const env = boot({ files: ['progress.js', 'game.js'], save });
  const api = env.global.__nailongTower;
  api.game.sound = false;
  return { env, api };
}

function bootAction(save, search = '?mode=endless') {
  const env = boot({
    files: ['progress.js', 'action-data.js', 'action-logic.js', 'action.js'],
    search,
    save
  });
  const api = env.global.window.__nailong;
  api.state.sound = false;
  return { env, api };
}

function bootUpgrade(save) {
  return boot({ files: ['progress.js', 'upgrade.js'], save });
}

test('endless-first player keeps the legacy wallet when the tower page loads', () => {
  const save = createStorage({ [V1]: JSON.stringify(OLD_SAVE) });
  const action = bootAction(save);
  action.api.state.wave = 3;
  action.api.state.kills = 12;
  action.api.finishEndless();

  const tower = bootTower(save);
  const progress = tower.api.progress;
  assert.equal(progress.custard, 350);
  assert.equal(progress.highestCleared, 5);
  assert.equal(progress.unlocked.includes('dragon'), true);
  assert.equal(progress.endlessBest.wave, 3);
});

test('endless and level results persist a complete save', () => {
  const save = createStorage({ [V1]: JSON.stringify(OLD_SAVE) });
  const action = bootAction(save);
  action.api.state.wave = 4;
  action.api.finishEndless();
  const afterEndless = JSON.parse(save.getItem(V2));
  assert.equal(afterEndless.custard, 350, 'endless result must not zero the wallet');
  assert.equal(afterEndless.highestCleared, 5);

  const levelSave = createStorage({ [V1]: JSON.stringify(OLD_SAVE) });
  const levelRun = bootAction(levelSave, '?mode=level&level=6');
  levelRun.api.state.levelParam = 6;
  levelRun.api.winLevel();
  const afterWin = JSON.parse(levelSave.getItem(V2));
  assert.equal(afterWin.actionHighestCleared, 6);
  assert.equal(afterWin.custard, 350, 'level result must not zero the wallet');
});

test('a brand new endless run does not lose the starting custard', () => {
  const save = createStorage();
  const action = bootAction(save);
  action.api.state.wave = 2;
  action.api.finishEndless();
  assert.equal(JSON.parse(save.getItem(V2)).custard, 500);
});

test('tower page reads the migrated progress, not zeros', () => {
  const save = createStorage({ [V1]: JSON.stringify(OLD_SAVE) });
  const { api } = bootTower(save);
  assert.equal(api.progress.custard, 350);
  assert.equal(api.progress.highestCleared, 5);
  assert.equal(save.getItem(V1), null, 'v1 key should be retired once v2 is complete');
});

test('upgrade shop renders all cards for a brand new player', () => {
  const env = bootUpgrade(createStorage());
  const grid = env.nodes.get('upgradeGrid');
  assert.equal(grid.children.length, Object.keys(ProgressStore.ALL_UNITS).length);
  assert.equal(env.nodes.get('custardBalance').textContent, 500);
  const locked = grid.children.filter(card => /card-locked/.test(card.innerHTML));
  // Only the nine level-gated characters start locked; the four initial ones are open.
  assert.equal(locked.length, ProgressStore.ALL_UNITS.length - ProgressStore.STARTING_UNITS.length);
});

function cardFor(cards, key) {
  return cards.find(card => card.innerHTML.includes(`assets/${key}.png`));
}

test('migrated characters are upgradeable, not re-locked', () => {
  const save = createStorage({ [V1]: JSON.stringify(OLD_SAVE) });
  const env = bootUpgrade(save);
  const cards = env.nodes.get('upgradeGrid').children;
  const dragon = cardFor(cards, 'dragon');
  assert.ok(dragon, 'no dragon card rendered');
  assert.doesNotMatch(dragon.innerHTML, /card-locked/);
  assert.match(dragon.innerHTML, /data-upgrade="dragon"/);
  const horse = cardFor(cards, 'horse');
  assert.ok(horse, 'no horse card rendered');
  assert.match(horse.innerHTML, /card-locked/);
});

test('clearing the last tower level does not offer a thirteenth', () => {
  const save = createStorage({
    [V2]: JSON.stringify({ custard: 500, highestCleared: 11, selectedLevel: 12 })
  });
  const { env, api } = bootTower(save);
  api.startLevel(12);
  assert.equal(api.game.state, 'running');
  api.finishGame(true);

  assert.equal(api.progress.highestCleared, 12);
  assert.equal(api.progress.selectedLevel, 12, 'selectedLevel must stay inside the 12-level track');
  assert.doesNotMatch(env.nodes.get('modal').innerHTML, /nextLevelButton/,
    'final level must not offer 下一关');
  assert.match(env.nodes.get('modal').innerHTML, /全部|通关/, 'final level should celebrate the clear');

  api.startLevel(13);
  assert.equal(api.game.levelIndex, 12, 'level 13 must never start');
  assert.equal(api.progress.selectedLevel, 12);
});
