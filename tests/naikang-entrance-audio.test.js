'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, createStorage } = require('./helpers/browser-env');

const AUDIO_SRC = 'assets/naikang-entrance.mp3';

function audioSpy() {
  const instances = [];
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.currentTime = 0;
      this.muted = false;
      this.playCalls = 0;
      instances.push(this);
    }
    play() {
      this.playCalls += 1;
      return Promise.resolve();
    }
  }
  return { FakeAudio, instances };
}

function bootTower(spy) {
  const env = boot({
    files: ['progress.js', 'game.js'],
    save: createStorage(),
    globals: { Audio: spy.FakeAudio }
  });
  return env.global.__nailongTower;
}

function bootAction(spy) {
  const env = boot({
    files: ['progress.js', 'action-data.js', 'action-logic.js', 'action.js'],
    search: '?mode=level&level=1',
    save: createStorage(),
    globals: { Audio: spy.FakeAudio }
  });
  return env.global.window.__nailong;
}

test('模式A只在奶康上场时播放指定音频', () => {
  const spy = audioSpy();
  const api = bootTower(spy);
  api.spawnZombie('basic');
  assert.equal(spy.instances.length, 0);
  api.spawnZombie('boss');
  assert.equal(spy.instances.length, 1);
  assert.equal(spy.instances[0].src, AUDIO_SRC);
  assert.equal(spy.instances[0].playCalls, 1);
});

test('模式B只在奶康上场时播放指定音频', () => {
  const spy = audioSpy();
  const api = bootAction(spy);
  api.spawnEnemy('basic', 900);
  assert.equal(spy.instances.length, 0);
  api.spawnBoss();
  assert.equal(spy.instances.length, 1);
  assert.equal(spy.instances[0].src, AUDIO_SRC);
  assert.equal(spy.instances[0].playCalls, 1);
});

test('奶康再次上场从头播放，静音时不播放', () => {
  const towerSpy = audioSpy();
  const tower = bootTower(towerSpy);
  tower.game.sound = false;
  tower.spawnZombie('boss');
  assert.equal(towerSpy.instances.length, 0);
  tower.game.sound = true;
  tower.spawnZombie('boss');
  towerSpy.instances[0].currentTime = 4;
  tower.spawnZombie('boss');
  assert.equal(towerSpy.instances.length, 1);
  assert.equal(towerSpy.instances[0].currentTime, 0);
  assert.equal(towerSpy.instances[0].playCalls, 2);

  const actionSpy = audioSpy();
  const action = bootAction(actionSpy);
  action.state.sound = false;
  action.spawnBoss();
  assert.equal(actionSpy.instances.length, 0);
  action.state.sound = true;
  action.spawnBoss();
  actionSpy.instances[0].currentTime = 4;
  action.spawnBoss();
  assert.equal(actionSpy.instances.length, 1);
  assert.equal(actionSpy.instances[0].currentTime, 0);
  assert.equal(actionSpy.instances[0].playCalls, 2);
});
