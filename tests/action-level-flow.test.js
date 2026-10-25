'use strict';
/**
 * Issue #2 item 4: Mode B levels 1-12 all reused one identical battle config,
 * so only the settlement title changed. Every level must now describe its own
 * fight, and the page must actually play the level it was asked for.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const DATA = require('../src/js/action-data.js');
const Logic = require('../src/js/action-logic.js');
const ProgressStore = require('../src/js/progress.js');
const { boot, createStorage } = require('./helpers/browser-env');

const FILES = ['progress.js', 'action-data.js', 'action-logic.js', 'action.js'];

function bootAction(level) {
  const env = boot({
    files: FILES,
    search: `?mode=level&level=${level}`,
    save: createStorage({ [ProgressStore.SAVE_KEY]: JSON.stringify({ endlessBest: { wave: 33 } }) })
  });
  const api = env.global.window.__nailong;
  api.state.sound = false;
  return api;
}

function flowSnapshot(level) {
  const api = bootAction(level);
  const screens = [];
  for (let index = 0; index < api.state.levelFlow.screens.length; index++) {
    api.startScreen(index);
    screens.push(api.state.spawnQueue.map(entry => entry.boss ? 'boss' : entry.type));
  }
  const boss = api.spawnBoss();
  return { screens, bossHp: boss.hp, worldWidth: api.state.worldWidth };
}

test('every level builds its own screens, enemy pool and boss health', () => {
  const seen = new Map();
  for (let level = 1; level <= DATA.level.maxLevel; level++) {
    const config = Logic.levelConfig(level);
    assert.equal(config.index, level);
    const key = JSON.stringify(config);
    const clash = seen.get(key);
    assert.equal(clash, undefined, `level ${level} reuses level ${clash}'s config`);
    seen.set(key, level);
  }
  assert.equal(seen.size, DATA.level.maxLevel);
});

test('later levels are longer, meaner and bossier', () => {
  const first = Logic.levelConfig(1);
  const last = Logic.levelConfig(DATA.level.maxLevel);
  assert.ok(last.screens.length > first.screens.length, 'screen count must grow');
  assert.ok(last.scaling.hpMul > first.scaling.hpMul);
  assert.ok(last.scaling.dmgMul > first.scaling.dmgMul);
  assert.ok(last.bossHp > first.bossHp * 1.5);
  assert.ok(last.worldWidth > first.worldWidth);
  assert.equal(last.screens[last.screens.length - 1].boss, true);
});

test('speed scaling stops at its cap', () => {
  const cap = DATA.level.progression.maxSpeedMul;
  assert.ok(Logic.levelConfig(200).scaling.speedMul <= cap);
  assert.equal(Logic.levelConfig(1).scaling.speedMul, 1);
});

test('out-of-range levels clamp to the track', () => {
  assert.equal(Logic.levelConfig(0).index, 1);
  assert.equal(Logic.levelConfig(99).index, DATA.level.maxLevel);
  assert.deepEqual(Logic.levelConfig(99), Logic.levelConfig(DATA.level.maxLevel));
});

test('the page plays the level its URL asked for', () => {
  const level1 = flowSnapshot(1);
  const level12 = flowSnapshot(DATA.level.maxLevel);
  assert.notDeepEqual(level12.screens, level1.screens, 'spawn queues must differ');
  assert.notEqual(level12.bossHp, level1.bossHp);
  assert.notEqual(level12.worldWidth, level1.worldWidth);
  assert.equal(level1.worldWidth, level1.screens.length * DATA.level.screenWidth);
  assert.equal(level12.worldWidth, level12.screens.length * DATA.level.screenWidth);
});

test('level enemies carry the level scaling into the fight', () => {
  const api = bootAction(DATA.level.maxLevel);
  const base = DATA.enemies.basic;
  const scaling = api.state.levelFlow.scaling;
  const enemy = api.spawnEnemy('basic', 900);
  assert.equal(enemy.hp, Math.round(base.hp * scaling.hpMul));
  assert.equal(enemy.cfg.damage, base.damage * scaling.dmgMul);
  assert.equal(enemy.cfg.speed, base.speed * scaling.speedMul);
});
