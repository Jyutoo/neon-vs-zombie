'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, createStorage } = require('./helpers/browser-env');
const ProgressStore = require('../src/js/progress');

function tower(save = createStorage()) {
  const page = boot({ files: ['progress.js', 'game.js'], save });
  page.global.__nailongTower.game.sound = false;
  return { page, api: page.global.__nailongTower, save };
}

function shop(save) {
  return boot({ files: ['progress.js', 'upgrade.js'], save });
}

function collect(api) {
  api.spawnCustard(200, 100, false, 25);
  api.collectCustard(api.game.custards.at(-1).id);
}

for (const path of ['pause', 'topbar']) {
  for (const operation of ['spend', 'collect']) {
    test(`${path} exit saves ${operation} and does not bank the run twice`, () => {
      const { page, api, save } = tower();
      api.startLevel(1);
      if (operation === 'spend') assert.equal(api.placeUnit('egg', 0, 0), true);
      else collect(api);
      const expected = operation === 'spend' ? 440 : 525;
      page.nodes.get(path === 'pause' ? 'pauseButton' : 'homeButton').click();
      assert.equal(api.game.state, 'paused');
      page.nodes.get(path === 'pause' ? 'pauseHome' : 'leaveConfirm').click();
      assert.equal(ProgressStore.load(save).custard, expected);
      page.global.leaveToHome();
      assert.equal(ProgressStore.load(save).custard, expected);
    });
  }
}

test('a stale selection page starts with the latest shop balance and upgrades', () => {
  const { api, save } = tower();
  shop(save).global.upgradeCharacter('egg');
  api.startLevel(1);
  const current = ProgressStore.load(save);
  assert.equal(current.custard, 400);
  assert.equal(current.upgrades.egg, 1);
  assert.equal(api.game.custard, 400);
  assert.equal(api.game.babies[0].usesLeft, 2);
});

test('a stale selection does not undo a real action-mode result', () => {
  const { api, save } = tower();
  const action = boot({ files: ['progress.js', 'action-data.js', 'action-logic.js', 'action.js'], save, search: '?mode=level&level=1' });
  action.global.__nailong.state.sound = false;
  action.global.__nailong.winLevel();
  api.startLevel(1);
  assert.equal(ProgressStore.load(save).actionHighestCleared, 1);
});

for (const result of ['exit', 'win', 'lose']) {
  test(`${result} merges run spending into the latest wallet without undoing a purchase`, () => {
    const { page, api, save } = tower();
    api.startLevel(1);
    assert.equal(api.placeUnit('egg', 0, 0), true);
    shop(save).global.upgradeCharacter('egg');
    if (result === 'exit') {
      page.nodes.get('pauseButton').click();
      page.nodes.get('pauseHome').click();
    } else api.finishGame(result === 'win');
    const current = ProgressStore.load(save);
    assert.equal(current.custard, result === 'win' ? 390 : 340);
    assert.equal(current.upgrades.egg, 1);
  });
}

for (const won of [true, false]) {
  test(`returning from a ${won ? 'won' : 'lost'} result preserves a later purchase and cannot settle twice`, () => {
    const { page, api, save } = tower();
    api.startLevel(1);
    api.finishGame(won);
    shop(save).global.upgradeCharacter('egg');
    const expected = ProgressStore.load(save).custard;
    page.nodes.get('resultHome').click();
    api.finishGame(won);
    assert.equal(ProgressStore.load(save).custard, expected);
    assert.equal(ProgressStore.load(save).upgrades.egg, 1);
  });
}

test('two tower results award the first-clear bonus only to the first completion', () => {
  const first = tower();
  const second = tower(first.save);
  first.api.startLevel(1);
  second.api.startLevel(1);
  first.api.finishGame(true);
  second.api.finishGame(true);
  assert.equal(ProgressStore.load(first.save).custard, 565);
  assert.match(second.page.nodes.get('modal').innerHTML, /重复通关奖励/);
});

test('settlement cannot undo action progress or a newer tower record', () => {
  const { api, save } = tower();
  api.startLevel(1);
  ProgressStore.update(saved => {
    saved.highestCleared = 5;
    saved.selectedLevel = 6;
    saved.actionHighestCleared = 3;
    saved.endlessBest.wave = 9;
  }, save);
  api.finishGame(true);
  const current = ProgressStore.load(save);
  assert.equal(current.highestCleared, 5);
  assert.equal(current.selectedLevel, 6);
  assert.equal(current.actionHighestCleared, 3);
  assert.equal(current.endlessBest.wave, 9);
});

test('concurrent spending never persists a negative wallet', () => {
  const { page, api, save } = tower();
  api.startLevel(1);
  api.placeUnit('egg', 0, 0);
  ProgressStore.update(saved => { saved.custard = 10; }, save);
  page.nodes.get('pauseButton').click();
  page.nodes.get('pauseHome').click();
  assert.equal(ProgressStore.load(save).custard, 0);
});

test('collected custard is added to the post-purchase wallet on exit', () => {
  const { page, api, save } = tower();
  api.startLevel(1);
  collect(api);
  shop(save).global.upgradeCharacter('egg');
  page.nodes.get('pauseButton').click();
  page.nodes.get('pauseHome').click();
  assert.equal(ProgressStore.load(save).custard, 425);
  assert.equal(ProgressStore.load(save).upgrades.egg, 1);
});

test('selecting a newly available tower level keeps other tabs records', () => {
  const { page, save } = tower();
  shop(save).global.upgradeCharacter('egg');
  ProgressStore.update(saved => {
    saved.highestCleared = 2;
    saved.actionHighestCleared = 1;
  }, save);
  page.global.selectLevel(2);
  const current = ProgressStore.load(save);
  assert.equal(current.selectedLevel, 2);
  assert.equal(current.custard, 400);
  assert.equal(current.upgrades.egg, 1);
  assert.equal(current.actionHighestCleared, 1);
});

test('the starting resource floor preserves the latest non-wallet fields', () => {
  const { api, save } = tower();
  ProgressStore.update(saved => {
    saved.custard = 0;
    saved.upgrades.egg = 1;
    saved.actionHighestCleared = 2;
  }, save);
  api.startLevel(1);
  const current = ProgressStore.load(save);
  assert.equal(current.custard, 150);
  assert.equal(api.game.custard, 150);
  assert.equal(current.upgrades.egg, 1);
  assert.equal(current.actionHighestCleared, 2);
});

test('explicit reset still replaces the complete save', () => {
  const { page, save } = tower();
  shop(save).global.upgradeCharacter('egg');
  ProgressStore.update(saved => { saved.actionHighestCleared = 2; }, save);
  page.global.showResetConfirm();
  page.nodes.get('resetConfirm').click();
  assert.deepEqual(ProgressStore.load(save), ProgressStore.defaultProgress());
});
