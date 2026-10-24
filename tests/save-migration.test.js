'use strict';
/**
 * v1 → v2 存档迁移。
 *
 * Issue #2 的测试覆盖缺口：本文件过去把 game.js 里的 migrateSaveV1ToV2 /
 * loadProgress 抄了一份进来，生产代码删掉这两个函数后它还在测自己。
 * 现在全部改为驱动真实实现：纯迁移语义走 `require('../src/js/progress.js')`
 * （UMD，Node 直接可用），页面消费存档走 `boot()` 加载未经修改的
 * progress.js + game.js。
 *
 * Run:  node --test tests/save-migration.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const ProgressStore = require('../src/js/progress.js');
const { boot, createStorage } = require('./helpers/browser-env');

const V1 = ProgressStore.V1_SAVE_KEY;
const V2 = ProgressStore.SAVE_KEY;

// 驱动真实塔防页面：progress.js 先于 game.js 加载，与 game.html 一致。
function bootTower(save) {
  const env = boot({ files: ['progress.js', 'game.js'], save });
  const api = env.global.__nailongTower;
  api.game.sound = false;
  return { env, api };
}

function readStoredV2(storage) {
  const raw = storage.getItem(V2);
  assert.ok(raw !== null, 'v2 存档应当已经落盘');
  return JSON.parse(raw);
}

// ── migrateV1：字段换算 ──────────────────────────────────────────────────────

test('v1 的 coins 按 1:1 迁移成奶黄', () => {
  const v2 = ProgressStore.migrateV1({
    coins: 420, totalEarned: 1000, highestCleared: 5,
    unlocked: ['egg', 'snake', 'ox', 'monkey', 'rat']
  });
  assert.equal(v2.custard, 420);
});

test('v1 的最高通关关卡原样保留', () => {
  const v2 = ProgressStore.migrateV1({
    coins: 0, totalEarned: 0, highestCleared: 12, unlocked: ['egg']
  });
  assert.equal(v2.highestCleared, 12);
});

test('迁移保留 v1 已解锁角色并补齐四个初始角色', () => {
  const v2 = ProgressStore.migrateV1({
    coins: 100, totalEarned: 200, highestCleared: 3, unlocked: ['rat', 'tiger']
  });
  assert.ok(v2.unlocked.includes('rat'));
  assert.ok(v2.unlocked.includes('tiger'));
  for (const unit of ProgressStore.STARTING_UNITS) {
    assert.ok(v2.unlocked.includes(unit), `缺少初始角色: ${unit}`);
  }
});

test('迁移会过滤掉不存在的角色键', () => {
  const v2 = ProgressStore.migrateV1({
    coins: 0, totalEarned: 0, highestCleared: 0,
    unlocked: ['egg', 'invalidUnit', 'dragon']
  });
  assert.equal(v2.unlocked.includes('invalidUnit'), false);
  assert.ok(v2.unlocked.includes('egg'));
  assert.ok(v2.unlocked.includes('dragon'));
});

test('迁移为模式B 字段写入初始值', () => {
  const v2 = ProgressStore.migrateV1({
    coins: 0, totalEarned: 0, highestCleared: 0, unlocked: []
  });
  assert.equal(v2.actionHighestCleared, 0);
  assert.deepEqual(v2.endlessBest, { wave: 0, kills: 0, date: null });
});

test('迁移把全部角色的强化等级置 0', () => {
  const v2 = ProgressStore.migrateV1({
    coins: 50, totalEarned: 50, highestCleared: 1, unlocked: ['egg']
  });
  assert.equal(Object.keys(v2.upgrades).length, ProgressStore.ALL_UNITS.length);
  for (const key of ProgressStore.ALL_UNITS) {
    assert.equal(v2.upgrades[key], 0, `强化 ${key} 应为 0`);
  }
});

test('v1 缺少 coins 字段时奶黄为 0，totalEarned 不会当作钱包', () => {
  const v2 = ProgressStore.migrateV1({ totalEarned: 100, highestCleared: 2, unlocked: ['egg'] });
  assert.equal(v2.custard, 0);
});

test('null / undefined 输入迁移成安全的空档', () => {
  for (const input of [null, undefined]) {
    const v2 = ProgressStore.migrateV1(input);
    assert.equal(v2.custard, 0);
    assert.equal(v2.highestCleared, 0);
    assert.deepEqual(v2.unlocked, ProgressStore.STARTING_UNITS);
  }
});

// ── load()：读取、落盘与旧键清理 ─────────────────────────────────────────────

test('load() 迁移 v1 后写入完整的 v2 存档并删除 v1 键', () => {
  const storage = createStorage({
    [V1]: JSON.stringify({
      coins: 300, totalEarned: 600, highestCleared: 7,
      unlocked: ['egg', 'snake', 'ox', 'monkey', 'dragon']
    })
  });

  const result = ProgressStore.load(storage);

  assert.equal(result.custard, 300);
  assert.equal(result.highestCleared, 7);
  assert.ok(result.unlocked.includes('dragon'));
  const stored = readStoredV2(storage);
  assert.equal(stored.custard, 300);
  for (const field of ['custard', 'highestCleared', 'actionHighestCleared',
    'endlessBest', 'selectedLevel', 'unlocked', 'upgrades']) {
    assert.ok(Object.prototype.hasOwnProperty.call(stored, field), `${field} 未落盘`);
  }
  assert.equal(storage.getItem(V1), null);
});

test('只有 v2 存档时按 v2 读数并补齐缺失字段', () => {
  const storage = createStorage({
    [V2]: JSON.stringify({ custard: 1200, highestCleared: 10 })
  });
  const result = ProgressStore.load(storage);
  assert.equal(result.custard, 1200);
  assert.equal(result.highestCleared, 10);
  assert.deepEqual(result.unlocked, ProgressStore.STARTING_UNITS);
  assert.equal(result.upgrades.egg, 0);
});

test('没有任何存档时回退到默认档', () => {
  const result = ProgressStore.load(createStorage());
  const expected = ProgressStore.defaultProgress();
  assert.equal(result.custard, expected.custard);
  assert.equal(result.highestCleared, expected.highestCleared);
  assert.deepEqual(result.unlocked, expected.unlocked);
  assert.deepEqual(result.endlessBest, expected.endlessBest);
});

test('v1 与 v2 同时存在时以 v2 携带的字段为准', () => {
  const storage = createStorage({
    [V1]: JSON.stringify({ coins: 100, totalEarned: 100, highestCleared: 1, unlocked: ['egg'] }),
    [V2]: JSON.stringify({ custard: 999, highestCleared: 4 })
  });

  const result = ProgressStore.load(storage);

  // v2 的奶黄与通关数覆盖 v1 迁移值，v1 的角色记录仍保留。
  assert.equal(result.custard, 999);
  assert.equal(result.highestCleared, 4);
  // 生产实现只要读到过 v1 存档就会把它退休掉，无论这次是否需要迁移。
  assert.equal(storage.getItem(V1), null);
});

test('defaultProgress() 给出正确的初始值', () => {
  const dp = ProgressStore.defaultProgress();
  assert.equal(dp.custard, 500);
  assert.equal(dp.highestCleared, 0);
  assert.equal(dp.actionHighestCleared, 0);
  assert.deepEqual(dp.endlessBest, { wave: 0, kills: 0, date: null });
  assert.deepEqual(dp.unlocked, ProgressStore.STARTING_UNITS);
  assert.equal(Object.keys(dp.upgrades).length, 13);
});

// ── 真实页面如何消费迁移结果 ─────────────────────────────────────────────────

test('损坏的 v1 存档让塔防页面回退到初始 500 奶黄', () => {
  const { api } = bootTower(createStorage({ [V1]: '{ "coins": 300, ' }));
  assert.equal(api.progress.custard, 500);
  assert.equal(api.progress.highestCleared, 0);
});

test('迁移来的角色在塔防页面直接可用，未达标角色仍锁定', () => {
  const storage = createStorage({
    [V1]: JSON.stringify({
      coins: 200, totalEarned: 400, highestCleared: 1,
      unlocked: ['egg', 'snake', 'ox', 'monkey', 'dragon']
    })
  });
  const { api } = bootTower(storage);

  assert.equal(api.progress.unlocked.includes('dragon'), true);
  assert.equal(api.isUnlocked('dragon'), true, '拥有即解锁：奶黄时代买下的奶龙不能被重新锁上');
  assert.equal(api.isUnlocked('rat'), false, '第 2 关门槛未到且未拥有');
  assert.equal(api.isUnlocked('horse'), false);
  assert.equal(api.isUnlocked('egg'), true);
});
