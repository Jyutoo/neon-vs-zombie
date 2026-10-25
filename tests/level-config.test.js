'use strict';
/**
 * 模式A 的十二关卡配置：波次数量、出场排布、难度缩放、奖励与难度标签。
 *
 * Issue #2 的测试覆盖缺口：本文件过去抄了 levelWaveCount / levelWaveConfig /
 * levelScaling / firstClearReward / repeatReward / difficultyLabel 六份副本，
 * game.js 改了它们也照样绿灯。现在每个断言都调用 `window.__nailongTower`
 * 导出的同名生产函数（progress.js + game.js 未经修改地载入）。
 *
 * Run:  node --test tests/level-config.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const ProgressStore = require('../src/js/progress.js');
const { boot, createStorage } = require('./helpers/browser-env');

const V2 = ProgressStore.SAVE_KEY;
const MAX_LEVEL = ProgressStore.MAX_LEVEL;
const LEVELS = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);

// 关卡配置函数是纯函数，但只在浏览器脚本里定义，所以先加载真实页面再取句柄。
function tower(save = createStorage()) {
  const env = boot({ files: ['progress.js', 'game.js'], save });
  const api = env.global.__nailongTower;
  api.game.sound = false;
  return { env, api };
}

function toastText(env) {
  const node = env.nodes.get('toast');
  return node ? node.textContent : '';
}

// ── levelWaveCount ───────────────────────────────────────────────────────────

test('levelWaveCount: 第 1-3 关 5 波', () => {
  const { api } = tower();
  for (const level of [1, 2, 3]) assert.equal(api.levelWaveCount(level), 5);
});

test('levelWaveCount: 第 4-6 关 6 波', () => {
  const { api } = tower();
  for (const level of [4, 5, 6]) assert.equal(api.levelWaveCount(level), 6);
});

test('levelWaveCount: 第 7-9 关 7 波', () => {
  const { api } = tower();
  for (const level of [7, 8, 9]) assert.equal(api.levelWaveCount(level), 7);
});

test('levelWaveCount: 第 10-11 关 8 波', () => {
  const { api } = tower();
  for (const level of [10, 11]) assert.equal(api.levelWaveCount(level), 8);
});

test('levelWaveCount: 第 12 关 10 波', () => {
  const { api } = tower();
  assert.equal(api.levelWaveCount(12), 10);
});

// ── levelWaveConfig ──────────────────────────────────────────────────────────

test('levelWaveConfig: starts 与 intervals 的长度等于波次数', () => {
  const { api } = tower();
  for (const level of LEVELS) {
    const config = api.levelWaveConfig(level);
    const expected = api.levelWaveCount(level);
    assert.equal(config.starts.length, expected, `第 ${level} 关 starts 数量`);
    assert.equal(config.intervals.length, expected, `第 ${level} 关 intervals 数量`);
  }
});

test('levelWaveConfig: 首波 12 秒出场，之后每 36 秒一波', () => {
  const { api } = tower();
  // 展开一次：VM 里创建的数组与测试脚本不同 realm，严格深比较会因原型不同而失败。
  const config = api.levelWaveConfig(1);
  assert.deepEqual([...config.starts], [12, 48, 84, 120, 156]);
});

test('levelWaveConfig: 波间隔递减但下限 4 秒', () => {
  const { api } = tower();
  const config = api.levelWaveConfig(12);
  assert.equal(config.intervals[0], 8);
  for (const interval of config.intervals) {
    assert.ok(interval >= 4, `interval ${interval} 应 >= 4`);
  }
});

// ── levelScaling ─────────────────────────────────────────────────────────────

test('levelScaling: 第 1 关是基准值', () => {
  const { api } = tower();
  const scaling = api.levelScaling(1);
  assert.equal(scaling.hp, 1);
  assert.equal(scaling.speed, 1);
  assert.equal(scaling.bite, 1);
});

test('levelScaling: 血量按每关 ×1.15 增长', () => {
  const { api } = tower();
  assert.ok(Math.abs(api.levelScaling(2).hp - 1.15) < 0.001);
  assert.ok(Math.abs(api.levelScaling(3).hp - 1.3225) < 0.001);
  assert.ok(Math.abs(api.levelScaling(5).hp - 1.749) < 0.001);
  assert.ok(Math.abs(api.levelScaling(12).hp - 4.6524) < 0.001);
});

test('levelScaling: 速度封顶 1.35', () => {
  const { api } = tower();
  assert.ok(Math.abs(api.levelScaling(12).speed - 1.275) < 0.001);
  assert.equal(api.levelScaling(15).speed, 1.35);
  assert.equal(api.levelScaling(20).speed, 1.35);
});

test('levelScaling: 啃咬封顶 1.8', () => {
  const { api } = tower();
  assert.ok(Math.abs(api.levelScaling(12).bite - 1.315) < 0.001);
  assert.equal(api.levelScaling(30).bite, 1.8);
});

// ── Boss 出场 ────────────────────────────────────────────────────────────────

test('僵尸王只出现在第 12 关的最后一波', () => {
  const { api } = tower();
  for (const level of LEVELS.filter(level => level < 12)) {
    const waves = api.levelWaves(level);
    assert.equal(waves.some(wave => wave.types.includes('boss')), false,
      `第 ${level} 关不应刷僵尸王（含曾经的第 5/10 关）`);
    assert.equal(api.enemyTypesForLevel(level).includes('boss'), false);
  }
  const finalWaves = api.levelWaves(12);
  assert.equal(finalWaves.slice(0, -1).some(wave => wave.types.includes('boss')), false,
    '最终关的前几波也不该提前刷僵尸王');
  assert.ok(finalWaves[finalWaves.length - 1].types.includes('boss'), '最终关末波必须刷僵尸王');
  assert.ok(api.enemyTypesForLevel(12).includes('boss'));
});

test('levelWaves 的出场时间与间隔取自 levelWaveConfig', () => {
  const { api } = tower();
  for (const level of LEVELS) {
    const waves = api.levelWaves(level);
    const config = api.levelWaveConfig(level);
    assert.equal(waves.length, config.starts.length, `第 ${level} 关波次数量`);
    waves.forEach((wave, index) => {
      assert.equal(wave.start, config.starts[index], `第 ${level} 关第 ${index + 1} 波出场时间`);
      assert.equal(wave.interval, config.intervals[index], `第 ${level} 关第 ${index + 1} 波间隔`);
      assert.ok(wave.types.length > 0, `第 ${level} 关第 ${index + 1} 波必须有敌人`);
    });
  }
});

// ── 奖励 ─────────────────────────────────────────────────────────────────────

test('firstClearReward: 第 1 关 50 奶黄', () => {
  const { api } = tower();
  assert.equal(api.firstClearReward(1), 50);
});

test('firstClearReward: 第 12 关 215 奶黄', () => {
  const { api } = tower();
  assert.equal(api.firstClearReward(12), 215);
});

test('firstClearReward: 每关线性 +15', () => {
  const { api } = tower();
  assert.deepEqual(LEVELS.map(level => api.firstClearReward(level)),
    [50, 65, 80, 95, 110, 125, 140, 155, 170, 185, 200, 215]);
});

test('repeatReward: 首通奖励的三成，最低 10 奶黄', () => {
  const { api } = tower();
  assert.equal(api.repeatReward(1), 15);
  assert.equal(api.repeatReward(2), 19);
  assert.equal(api.repeatReward(12), 64);
  for (const level of LEVELS) {
    assert.ok(api.repeatReward(level) >= 10, `第 ${level} 关重复奖励应 >= 10`);
    assert.ok(api.repeatReward(level) < api.firstClearReward(level), '重复奖励必须低于首通奖励');
  }
});

// ── difficultyLabel ──────────────────────────────────────────────────────────

test('difficultyLabel: 第 12 关是 BOSS 关', () => {
  const { api } = tower();
  assert.equal(api.difficultyLabel(12), 'BOSS 关');
});

test('difficultyLabel: 第 1-3 关是入门', () => {
  const { api } = tower();
  for (const level of [1, 2, 3]) assert.equal(api.difficultyLabel(level), '入门');
});

test('difficultyLabel: 第 4-6 关是进阶', () => {
  const { api } = tower();
  for (const level of [4, 5, 6]) assert.equal(api.difficultyLabel(level), '进阶');
});

test('difficultyLabel: 第 7-9 关是中级', () => {
  const { api } = tower();
  for (const level of [7, 8, 9]) assert.equal(api.difficultyLabel(level), '中级');
});

test('difficultyLabel: 第 10-11 关是高级', () => {
  const { api } = tower();
  for (const level of [10, 11]) assert.equal(api.difficultyLabel(level), '高级');
});

test('difficultyLabel: 十二关的标签都落在已定义的档位里', () => {
  const { api } = tower();
  const known = new Set(['入门', '进阶', '中级', '高级', 'BOSS 关']);
  for (const level of LEVELS) {
    assert.ok(known.has(api.difficultyLabel(level)), `第 ${level} 关标签未知`);
  }
  // '最终BOSS' 是生产代码里到不了的兜底分支：第 12 关先命中 'BOSS 关'。
  assert.equal(LEVELS.some(level => api.difficultyLabel(level) === '最终BOSS'), false);
});

// ── 关卡上限 ─────────────────────────────────────────────────────────────────

test('关卡轨道封顶 12 关，页面不会接受第 13 关', () => {
  assert.equal(MAX_LEVEL, 12);
  const save = createStorage({
    [V2]: JSON.stringify({ custard: 900, highestCleared: 12, selectedLevel: 12 })
  });
  const { env, api } = tower(save);

  // 关卡轨道只渲染封顶以内的关卡。
  const rendered = [...env.nodes.get('levelTrack').innerHTML.matchAll(/data-level="(\d+)"/g)]
    .map(match => Number(match[1]));
  assert.ok(rendered.length > 0, '关卡轨道没有渲染出任何关卡');
  for (const level of rendered) {
    assert.ok(level >= 1 && level <= MAX_LEVEL, `轨道渲染出越界的第 ${level} 关`);
  }

  api.startLevel(12);
  assert.equal(api.game.levelIndex, 12);
  api.startLevel(13);
  assert.equal(api.game.levelIndex, 12, '第 13 关绝不能开局');
  assert.match(toastText(env), /第 12 关就是最终关/);
  assert.equal(api.progress.selectedLevel, MAX_LEVEL);
});
