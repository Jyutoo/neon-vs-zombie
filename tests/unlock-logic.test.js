'use strict';
/**
 * 模式A 角色解锁逻辑：按通关关卡解锁。
 *
 * Issue #2 的测试覆盖缺口：本文件过去自带一份 checkCharacterUnlocks(highestCleared,
 * currentlyUnlocked) 的副本，加上手写 assert 计数器与打印，生产的 `game.js`
 * 里同名函数（无参数、直接改写 progress、写中文名并落盘）坏了也测不出来。
 * 现在改为 boot 真实塔防页面，调用 `window.__nailongTower.checkCharacterUnlocks()`，
 * 再断言 progress / 落盘存档 / toast 文案。
 *
 * Run:  node --test tests/unlock-logic.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const ProgressStore = require('../progress.js');
const { boot, createStorage } = require('./helpers/browser-env');

const V2 = ProgressStore.SAVE_KEY;
const STARTING = ProgressStore.STARTING_UNITS;
const GATES = ProgressStore.CHARACTER_UNLOCK_LEVELS;

// 把存档写进 localStorage 桩，再加载真实页面脚本，读取生产算出来的 progress。
function towerWithProgress(overrides = {}) {
  const stored = {
    custard: 500,
    highestCleared: 0,
    unlocked: [...STARTING],
    ...overrides
  };
  const save = createStorage({ [V2]: JSON.stringify(stored) });
  const env = boot({ files: ['progress.js', 'game.js'], save });
  const api = env.global.__nailongTower;
  api.game.sound = false;
  return { env, api, save };
}

function toastText(env) {
  const node = env.nodes.get('toast');
  return node ? node.textContent : '';
}

function persisted(save) {
  return JSON.parse(save.getItem(V2));
}

function sorted(list) {
  return [...list].sort();
}

// ── Tests ────────────────────────────────────────────────────────────────────

test('通关 0 关时只有四个初始角色，也不会弹解锁提示', () => {
  const { env, api } = towerWithProgress({ highestCleared: 0 });
  api.checkCharacterUnlocks();
  assert.deepEqual(sorted(api.progress.unlocked), sorted(STARTING));
  assert.equal(toastText(env), '');
});

test('通关第 2 关解锁奶鼠（toast 用角色中文名）', () => {
  const { env, api } = towerWithProgress({ highestCleared: 2 });
  api.checkCharacterUnlocks();
  assert.ok(api.progress.unlocked.includes('rat'));
  assert.deepEqual(sorted(api.progress.unlocked), sorted([...STARTING, 'rat']));
  assert.match(toastText(env), /解锁新角色/);
  assert.match(toastText(env), /奶鼠/);
});

test('通关第 5 关解锁奶鼠、奶兔、奶狗、奶虎，奶羊还不解锁', () => {
  const { env, api } = towerWithProgress({ highestCleared: 5 });
  api.checkCharacterUnlocks();
  for (const key of ['rat', 'rabbit', 'dog', 'tiger']) {
    assert.ok(api.progress.unlocked.includes(key), `${key} 应已解锁`);
  }
  assert.equal(api.progress.unlocked.includes('goat'), false);
  assert.deepEqual(sorted(api.progress.unlocked), sorted([...STARTING, 'rat', 'rabbit', 'dog', 'tiger']));
  for (const name of ['奶鼠', '奶兔', '奶狗', '奶虎']) {
    assert.ok(toastText(env).includes(name), `toast 缺少 ${name}`);
  }
});

test('通关第 10 关解锁全部十三个角色', () => {
  const { api } = towerWithProgress({ highestCleared: 10 });
  api.checkCharacterUnlocks();
  const all = [...STARTING, ...Object.keys(GATES)];
  assert.equal(all.length, ProgressStore.ALL_UNITS.length);
  assert.deepEqual(sorted(api.progress.unlocked), sorted(all));
});

test('已登记的角色不会被重复加进解锁列表', () => {
  const { env, api } = towerWithProgress({
    highestCleared: 3,
    unlocked: [...STARTING, 'rat', 'rabbit']
  });
  api.checkCharacterUnlocks();
  assert.deepEqual(sorted(api.progress.unlocked), sorted([...STARTING, 'rat', 'rabbit']));
  assert.equal(toastText(env), '');
});

test('通关第 7 关解锁到奶鸡，奶猪/奶马/奶龙仍未解锁', () => {
  const { api } = towerWithProgress({ highestCleared: 7 });
  api.checkCharacterUnlocks();
  for (const key of ['rat', 'rabbit', 'dog', 'tiger', 'goat', 'rooster']) {
    assert.ok(api.progress.unlocked.includes(key), `${key} 应已解锁`);
  }
  for (const key of ['pig', 'horse', 'dragon']) {
    assert.equal(api.progress.unlocked.includes(key), false, `${key} 不该提前解锁`);
  }
  assert.deepEqual(sorted(api.progress.unlocked),
    sorted([...STARTING, 'rat', 'rabbit', 'dog', 'tiger', 'goat', 'rooster']));
});

test('CHARACTER_UNLOCK_LEVELS 的等级门槛与关卡顺序一致', () => {
  assert.deepEqual(GATES, {
    rat: 2, rabbit: 3, dog: 4, tiger: 5,
    goat: 6, rooster: 7, pig: 8, horse: 9, dragon: 10
  });
  for (const key of Object.keys(GATES)) {
    assert.ok(ProgressStore.ALL_UNITS.includes(key), `${key} 必须是真实存在的角色`);
    assert.equal(STARTING.includes(key), false, `初始角色不该配门槛`);
  }
});

test('通关第 1 关不解锁任何新角色', () => {
  const { env, api } = towerWithProgress({ highestCleared: 1 });
  api.checkCharacterUnlocks();
  assert.deepEqual(sorted(api.progress.unlocked), sorted(STARTING));
  assert.equal(toastText(env), '');
});

test('奶黄时代买下的角色保持可用（拥有即解锁）', () => {
  const { env, api } = towerWithProgress({ highestCleared: 0, unlocked: [...STARTING, 'dragon'] });
  api.checkCharacterUnlocks();
  assert.ok(api.progress.unlocked.includes('dragon'), 'dragon 不能被检查过程抹掉');
  assert.equal(toastText(env), '');
  assert.equal(api.isUnlocked('dragon'), true);
  assert.equal(ProgressStore.isCharacterUnlocked('dragon', api.progress), true);
  assert.equal(api.isUnlocked('horse'), false);
});

test('解锁检查是幂等的，第二次运行不再新增', () => {
  const { api, save } = towerWithProgress({ highestCleared: 5 });
  api.checkCharacterUnlocks();
  const afterFirst = sorted(api.progress.unlocked);
  const storedAfterFirst = JSON.stringify(persisted(save));
  api.checkCharacterUnlocks();
  assert.deepEqual(sorted(api.progress.unlocked), afterFirst);
  assert.equal(JSON.stringify(persisted(save)), storedAfterFirst, '第二次运行不该改存档');
});

test('解锁结果会写回存档，登记前卡池也已按关卡门槛放行', () => {
  const { api, save } = towerWithProgress({ highestCleared: 2 });
  // 生产的 isUnlocked 判定是"达到门槛 或 已经拥有"，
  // 所以 unlocked 列表还没登记奶鼠时，第 2 关通关本身就已经放行。
  assert.equal(api.progress.unlocked.includes('rat'), false);
  assert.equal(api.isUnlocked('rat'), true);

  api.checkCharacterUnlocks();

  assert.ok(persisted(save).unlocked.includes('rat'), 'unlocked 必须落盘，否则下次进页面又被锁');
  assert.equal(api.isUnlocked('rat'), true);
});
