'use strict';
/**
 * Issue #2 (regression, P1): when the boss is the last living enemy of the
 * final screen, the level never settles.
 *
 * These tests boot production action.js in a DOM shim and drive the real
 * update() loop — no logic is copied here.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./helpers/browser-env');

const FILES = ['progress.js', 'action-data.js', 'action-logic.js', 'action.js'];

function bootLevel() {
  const env = boot({ files: FILES, search: '?mode=level&level=1' });
  const api = env.global.window.__nailong;
  api.state.sound = false;
  return { env, api, state: api.state, overlay: env.nodes.get('overlay') };
}

function enterBossPhase(api) {
  api.startScreen(api.state.levelFlow.screens.length - 1);
  api.state.spawnQueue = [];
  api.state.player.x = api.state.levelFlow.worldWidth - 1000;
  // xpToNext(6) = 130, above the boss's 100 XP, so killing it cannot raise the
  // roguelike pick screen and mask the settlement assertion under test.
  api.state.level = 6;
  api.state.xp = 0;
  return api.spawnBoss();
}

test('boss killed while a minion still lives settles the level', () => {
  const { api, state, overlay } = bootLevel();
  const boss = enterBossPhase(api);
  api.spawnEnemy('basic', 4900);
  api.damageEnemy(boss, boss.hp + 1, 0, 1);
  for (let i = 0; i < 60 && state.status === 'playing'; i++) api.update(0.05);
  assert.equal(state.status, 'won');
  assert.match(overlay.innerHTML, /闯关成功/);
});

test('boss as the last living enemy settles the level', () => {
  const { api, state, overlay } = bootLevel();
  const boss = enterBossPhase(api);
  api.damageEnemy(boss, boss.hp + 1, 0, 1);
  for (let i = 0; i < 60 && state.status === 'playing'; i++) api.update(0.05);
  assert.equal(state.enemies.filter(enemy => enemy.hp > 0).length, 0);
  assert.equal(state.status, 'won', `phase was ${state.levelPhase}`);
  assert.match(overlay.innerHTML, /闯关成功/);
});

test('a cleared combat screen still advances to the next screen', () => {
  const { api, state } = bootLevel();
  api.startScreen(0);
  assert.equal(state.levelPhase, 'combat');
  state.spawnQueue = [];
  for (let i = 0; i < 5; i++) api.update(0.05);
  assert.equal(state.levelPhase, 'advance');
});

test('player death in the boss phase does not report a win', () => {
  const { api, state, overlay } = bootLevel();
  enterBossPhase(api);
  api.hurtPlayer(9999);
  for (let i = 0; i < 20; i++) api.update(0.05);
  assert.equal(state.status, 'lost');
  assert.doesNotMatch(overlay.innerHTML, /闯关成功/);
});
