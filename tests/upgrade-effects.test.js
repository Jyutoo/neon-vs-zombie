'use strict';
/**
 * Issue #2 item 3 — persistent character upgrades.
 *
 * The previous version of this file re-implemented getUpgradeMultiplier /
 * computeModeAEffects / computeModeBEffects inside the test and then asserted
 * against its own copies, so changing the real per-level percentages in
 * game.js or action.js kept it green. Every case below boots the untouched
 * production pages and asks *those pages* what they would apply:
 *
 *   game.js    → window.__nailongTower.applyModeAUpgrades()
 *   action.js  → window.__nailong.applyModeBUpgrades()
 *
 * The helpers only drive production: they lay a save down through progress.js
 * (the production write path), let the page read it back the way its own boot
 * code does, and call the production effect function. Nothing here computes an
 * expected value — expectations are relationships between production calls,
 * anchored on the ProgressStore constants.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const ProgressStore = require('../progress.js');
const { boot, createStorage } = require('./helpers/browser-env');

const MAX = ProgressStore.MAX_UPGRADE_LEVEL;
const TOWER_FILES = ['progress.js', 'game.js'];
const ACTION_FILES = ['progress.js', 'action-data.js', 'action-logic.js', 'action.js'];

function assertClose(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ~${expected}, got ${actual}`);
}

/**
 * Tower page. `seed` replaces the whole upgrade table (progress.js fills the
 * characters it is not given with level 0), reloads the save the way
 * game.js:66 does, and returns production's own effects.
 */
function bootTower() {
  const env = boot({ files: TOWER_FILES, save: createStorage() });
  const api = env.global.__nailongTower;
  const store = env.global.ProgressStore;
  api.game.sound = false;
  return {
    env,
    api,
    seed(upgrades = {}) {
      store.update(progress => { progress.upgrades = upgrades; });
      api.progress = store.load();
      return api.applyModeAUpgrades();
    },
    effects: () => api.applyModeAUpgrades()
  };
}

/**
 * Action page. applyModeBUpgrades() re-reads the save on every call and
 * resetActionGame() rebuilds the 奶娃 from it, so a single boot can sweep
 * every level and still show what the live run actually got.
 */
function bootAction() {
  const env = boot({ files: ACTION_FILES, search: '?mode=endless', save: createStorage() });
  const api = env.global.window.__nailong;
  const store = env.global.ProgressStore;
  api.state.sound = false;
  return {
    env,
    api,
    data: env.global.ACTION_DATA,
    logic: env.global.ActionLogic,
    seed(upgrades = {}) {
      store.update(progress => { progress.upgrades = upgrades; });
      api.resetActionGame();
      return api.applyModeBUpgrades();
    },
    effects: () => api.applyModeBUpgrades()
  };
}

test('the exposed getUpgradeMultiplier is linear in levels and percent', () => {
  const { api: tower } = bootTower();
  const { api: action } = bootAction();
  const g = tower.getUpgradeMultiplier;

  assert.equal(g(0, 15), 1, 'level 0 must be a neutral multiplier');
  assert.equal(g(0, 20), 1, 'level 0 must be neutral at any percentage');
  assertClose(g(1, 15), 1.15, 1e-9, 'level 1 at 15%');
  assertClose(g(7, 15), 2.05, 1e-9, 'level 7 at 15%');
  assertClose(g(5, 20), 2.0, 1e-9, 'level 5 at 20%');
  assertClose(g(3, 10), 1.3, 1e-9, 'level 3 at 10%');
  for (let level = 1; level <= MAX; level++) {
    assertClose(g(level, 15) - g(level - 1, 15), g(1, 15) - 1, 1e-9,
      `every level must add the same step at ${level}`);
  }
  // Both pages must agree, otherwise Mode A and Mode B drift apart silently.
  for (const [level, percent] of [[0, 15], [1, 15], [4, 15], [2, 20], [7, 20]]) {
    assert.equal(action.getUpgradeMultiplier(level, percent), g(level, percent),
      `page mismatch for ${level} levels at ${percent}%`);
  }
});

test('Mode A: egg levels only add baby uses, one per level', () => {
  const { api, seed } = bootTower();
  assert.equal(seed().babyUses, 1, 'no upgrades: the base single use');
  for (let level = 0; level <= MAX; level++) {
    const effects = seed({ egg: level });
    // Compare against the level the page actually stored, not what was asked for.
    assert.equal(effects.babyUses, 1 + api.progress.upgrades.egg, `egg level ${level}`);
  }
  assert.equal(seed({ egg: MAX }).babyUses, 1 + MAX, '满级奶蛋给满次数');
  assert.equal(seed({ egg: 3 }).babyDamageMul, 1, 'egg must not touch damage');
  assert.equal(seed({ egg: 3 }).babyHealPerUse, 0, 'egg must not add heal');
});

test('Mode A: ox/tiger/monkey share one damage curve', () => {
  const { api, seed } = bootTower();
  assert.equal(seed().babyDamageMul, 1, 'no upgrades: neutral damage');

  const one = seed({ ox: 1 }).babyDamageMul;
  assertClose(one, 1.15, 1e-9, '奶牛 1 级应给 +15% 伤害');
  const step = one - 1;

  for (let level = 1; level <= MAX; level++) {
    assertClose(seed({ ox: level }).babyDamageMul, 1 + step * level, 1e-9,
      `奶牛 ${level} 级要线性成长`);
  }
  assertClose(seed({ tiger: 2 }).babyDamageMul, 1 + step * 2, 1e-9, '奶虎按同一权重计');
  assert.equal(seed({ monkey: 1 }).babyDamageMul, one, '奶猴与奶牛等价');
  assertClose(seed({ ox: 1, tiger: 1, monkey: 1 }).babyDamageMul, 1 + step * 3, 1e-9,
    '三个角色各 1 级要相加');
  assertClose(seed({ ox: 3, tiger: 2, monkey: 2 }).babyDamageMul, 1 + step * MAX, 1e-9,
    '合计满级 7 级');
  assertClose(seed({ ox: 3, tiger: 2, monkey: 2 }).babyDamageMul, 2.05, 1e-9,
    '合计满级要停在 2.05 倍');
  // Same production function the page uses, fed the step it just reported.
  assertClose(seed({ ox: 2, tiger: 1 }).babyDamageMul,
    api.getUpgradeMultiplier(3, step * 100), 1e-9, '倍率必须出自 getUpgradeMultiplier');
});

test('Mode A: snake/dragon run a separate, steeper DoT curve', () => {
  const { seed } = bootTower();
  assert.equal(seed().babyDotMul, 1, 'no upgrades: neutral DoT');

  const one = seed({ snake: 1 }).babyDotMul;
  assertClose(one, 1.2, 1e-9, '奶蛇 1 级应给 +20% 毒伤');
  const step = one - 1;
  assert.ok(step > seed({ ox: 1 }).babyDamageMul - 1, '毒伤曲线每级要比伤害曲线更陡');

  assert.equal(seed({ dragon: 1 }).babyDotMul, one, '奶龙与奶蛇等价');
  assertClose(seed({ snake: 2, dragon: 1 }).babyDotMul, 1 + step * 3, 1e-9, '蛇 2 + 龙 1');
  assertClose(seed({ snake: MAX }).babyDotMul, 1 + step * MAX, 1e-9, '满级奶蛇');
  assertClose(seed({ snake: MAX }).babyDotMul, 2.4, 1e-9, '满级奶蛇毒伤倍率');
  assert.equal(seed({ snake: MAX }).babyDamageMul, 1, '毒伤升级不能改动伤害倍率');
});

test('Mode A: horse/goat heal and dog/pig shield stack additively', () => {
  const { seed } = bootTower();
  const flat = seed();
  assert.equal(flat.babyHealPerUse, 0, 'no upgrades: no heal');
  assert.equal(flat.babyShieldPerUse, 0, 'no upgrades: no shield');

  const healStep = seed({ horse: 1 }).babyHealPerUse;
  assert.equal(healStep, 10, '奶马 1 级应回 10 点耐久');
  assert.equal(seed({ goat: 1 }).babyHealPerUse, healStep, '奶羊与奶马等价');
  assert.equal(seed({ horse: 2, goat: 1 }).babyHealPerUse, healStep * 3, '马 2 + 羊 1');
  assert.equal(seed({ horse: MAX }).babyHealPerUse, healStep * MAX, '满级奶马');

  const shieldStep = seed({ dog: 1 }).babyShieldPerUse;
  assert.equal(shieldStep, 20, '奶狗 1 级应给 20 点护盾');
  assert.equal(seed({ pig: 1 }).babyShieldPerUse, shieldStep, '奶猪与奶狗等价');
  assert.equal(seed({ dog: 2, pig: 1 }).babyShieldPerUse, shieldStep * 3, '狗 2 + 猪 1');
  assert.equal(shieldStep, healStep * 2, '每级护盾必须是每级治疗的两倍');
  assert.equal(seed({ dog: 1 }).babyHealPerUse, 0, '护盾升级不能漏进治疗');
});

test('Mode A: rat/rabbit/rooster shrink the cooldown and clamp at the cap', () => {
  const { seed } = bootTower();
  assert.equal(seed().babyCooldownMul, 1, 'no upgrades: no cooldown reduction');

  const one = seed({ rat: 1 }).babyCooldownMul;
  const step = 1 - one;
  assertClose(one, 0.9, 1e-9, '奶鼠 1 级应减 10% 冷却');
  assert.equal(seed({ rabbit: 1 }).babyCooldownMul, one, '奶兔与奶鼠等价');
  assert.equal(seed({ rooster: 1 }).babyCooldownMul, one, '奶鸡与奶鼠等价');

  let previous = 1;
  for (let level = 1; level <= MAX; level++) {
    const current = seed({ rat: level }).babyCooldownMul;
    assert.ok(current < previous, `level ${level} must be shorter than level ${level - 1}`);
    assertClose(current, 1 - step * level, 1e-9, `cooldown must fall linearly at level ${level}`);
    previous = current;
  }
  assertClose(seed({ rat: 3, rabbit: 2, rooster: 2 }).babyCooldownMul, 1 - step * MAX, 1e-9,
    '合计满级 7 级');
  assertClose(seed({ rat: MAX }).babyCooldownMul, 0.3, 1e-9, '满级冷却倍率应为 0.3');
  // Out-of-range saves: progress.js clamps the level and the page caps the
  // reduction, so neither path can go below the 0.7 reduction.
  assertClose(seed({ rat: MAX + 5 }).babyCooldownMul, 0.3, 1e-9, '超出上限的等级仍停在 0.3');
  assertClose(seed({ rat: 4, rabbit: 4, rooster: 4 }).babyCooldownMul, 0.3, 1e-9,
    '三个角色同时超上限也不会跌破 0.3');
});

test('Mode A: a save with no upgrade table stays neutral', () => {
  const { api, seed } = bootTower();
  const fresh = seed();
  assert.equal(fresh.babyUses, 1);
  assert.equal(fresh.babyDamageMul, 1);
  assert.equal(fresh.babyDotMul, 1);
  assert.equal(fresh.babyHealPerUse, 0);
  assert.equal(fresh.babyShieldPerUse, 0);
  assert.equal(fresh.babyCooldownMul, 1);

  // The `progress.upgrades || {}` guard, hit with an incomplete progress object.
  api.progress = {
    custard: 500, selectedLevel: 1, unlocked: [...ProgressStore.STARTING_UNITS]
  };
  const guarded = api.applyModeAUpgrades();
  assert.equal(guarded.babyUses, 1, 'missing upgrades key must behave like level 0');
  assert.equal(guarded.babyDamageMul, 1, 'missing upgrades key must not scale damage');
  assert.equal(guarded.babyCooldownMul, 1, 'missing upgrades key must not cut cooldown');
});

test('Mode A: startLevel really builds the babies from applyModeAUpgrades', () => {
  const { api, seed } = bootTower();
  const effects = seed({ egg: 3 });
  api.startLevel(1);
  assert.equal(api.game.state, 'running');
  assert.equal(api.game.babies.length, 5, 'one 奶娃 per row');
  for (const baby of api.game.babies) {
    assert.equal(baby.usesLeft, effects.babyUses, 'uses must come from the production effect');
    assert.equal(baby.maxUses, effects.babyUses);
  }
});

test('Mode B: an empty upgrade table gives neutral values', () => {
  const { env, api, seed } = bootAction();
  const fresh = seed();
  assert.equal(fresh.autoHealPerSec, 0);
  assert.equal(fresh.skillCooldownMul, 1);
  assert.equal(fresh.attackDamageMul, 1);
  assert.equal(fresh.dotDamageMul, 1);
  assert.equal(fresh.healOnKill, 0);
  assert.equal(fresh.shieldHp, 0);

  // Same neutral result when the save carries no upgrades field at all.
  env.save.data[ProgressStore.SAVE_KEY] = JSON.stringify({ custard: 500 });
  const legacy = api.applyModeBUpgrades();
  assert.equal(legacy.attackDamageMul, 1, 'save without upgrades must stay neutral');
  assert.equal(legacy.shieldHp, 0, 'save without upgrades must not grant HP');
});

test('Mode B: egg buys auto heal and reaches the live player', () => {
  const { api, seed } = bootAction();
  assert.equal(seed().autoHealPerSec, 0, 'no upgrades: no auto heal');

  const one = seed({ egg: 1 }).autoHealPerSec;
  assert.equal(one, 1, '奶蛋 1 级应是 1 HP/秒');
  assert.equal(seed({ egg: 3 }).autoHealPerSec, one * 3, '每秒回复按等级线性成长');
  assert.equal(seed({ egg: MAX }).autoHealPerSec, one * MAX, '满级奶蛋');

  const effects = seed({ egg: 2 });
  assert.equal(api.state.player.autoHealPerSec, effects.autoHealPerSec,
    '本局奶娃必须拿到刚算出的回复速度');
});

test('Mode B: rat/rabbit/rooster cut skill cooldowns and clamp', () => {
  const { api, seed } = bootAction();
  assert.equal(seed().skillCooldownMul, 1, 'no upgrades: neutral cooldown');

  const one = seed({ rat: 1 }).skillCooldownMul;
  const step = 1 - one;
  assertClose(one, 0.9, 1e-9, '奶鼠 1 级应减 10% 技能冷却');
  assert.equal(seed({ rabbit: 1 }).skillCooldownMul, one, '奶兔与奶鼠等价');
  assert.equal(seed({ rooster: 1 }).skillCooldownMul, one, '奶鸡与奶鼠等价');

  let previous = 1;
  for (let level = 1; level <= MAX; level++) {
    const current = seed({ rat: level }).skillCooldownMul;
    assert.ok(current < previous, `level ${level} must be shorter than level ${level - 1}`);
    assertClose(current, 1 - step * level, 1e-9, `cooldown must fall linearly at level ${level}`);
    previous = current;
  }
  assertClose(seed({ rat: 3, rabbit: 2, rooster: 2 }).skillCooldownMul, 0.3, 1e-9, '合计满级封顶 0.3');
  assertClose(seed({ rat: MAX + 5 }).skillCooldownMul, 0.3, 1e-9, '超上限等级仍停在 0.3');

  seed();
  const baseCooldown = api.state.stats.fireCooldownMul;
  const baseDash = api.state.stats.dashCooldownMul;
  const effects = seed({ rat: 2, rabbit: 1 });
  assert.equal(api.state.player.persistentSkillCooldownMul, effects.skillCooldownMul);
  assertClose(api.state.stats.fireCooldownMul, baseCooldown * effects.skillCooldownMul, 1e-9,
    '音波冷却要真的吃到持久倍率');
  assertClose(api.state.stats.dashCooldownMul, baseDash * effects.skillCooldownMul, 1e-9,
    '冲刺冷却要真的吃到持久倍率');
});

test('Mode B: ox/tiger/monkey attack damage is applied to the run stats', () => {
  const { api, seed } = bootAction();
  assert.equal(seed().attackDamageMul, 1, 'no upgrades: neutral attack');

  const one = seed({ ox: 1 }).attackDamageMul;
  assertClose(one, 1.15, 1e-9, '奶牛 1 级应给 +15% 攻击伤害');
  const step = one - 1;
  for (let level = 1; level <= MAX; level++) {
    assertClose(seed({ ox: level }).attackDamageMul, 1 + step * level, 1e-9,
      `攻击伤害要线性成长到 ${level} 级`);
  }
  assertClose(seed({ ox: 2, tiger: 1 }).attackDamageMul, 1 + step * 3, 1e-9, '牛 2 + 虎 1');
  assert.equal(seed({ tiger: 1 }).attackDamageMul, one, '奶虎与奶牛等价');
  assert.equal(seed({ monkey: 1 }).attackDamageMul, one, '奶猴与奶牛等价');

  seed();
  const baseAttack = api.state.stats.attackDamageMul;
  const effects = seed({ ox: 2 });
  assert.equal(api.state.player.persistentAttackDamageMul, effects.attackDamageMul,
    '奶娃要带上刚算出的攻击倍率');
  assertClose(api.state.stats.attackDamageMul, baseAttack * effects.attackDamageMul, 1e-9,
    '本局攻击力 = 基础值 × 持久倍率');
});

test('Mode B: snake/dragon DoT feeds the burn damage path', () => {
  const { api, seed, data } = bootAction();
  assert.equal(seed().dotDamageMul, 1, 'no upgrades: neutral DoT');

  const one = seed({ snake: 1 }).dotDamageMul;
  assertClose(one, 1.2, 1e-9, '奶蛇 1 级应给 +20% 持续伤害');
  const step = one - 1;
  assert.equal(seed({ dragon: 1 }).dotDamageMul, one, '奶龙与奶蛇等价');
  assertClose(seed({ snake: 1, dragon: 1 }).dotDamageMul, 1 + step * 2, 1e-9, '蛇 1 + 龙 1');
  assertClose(seed({ snake: 2, dragon: 1 }).dotDamageMul, 1 + step * 3, 1e-9, '蛇 2 + 龙 1');
  assertClose(seed({ snake: MAX }).dotDamageMul, 1 + step * MAX, 1e-9, '满级奶蛇毒伤');
  assert.equal(seed({ snake: 3 }).attackDamageMul, 1, '毒伤升级不得改动攻击倍率');

  const effects = seed({ dragon: 2 });
  assert.equal(api.state.player.persistentDotDamageMul, effects.dotDamageMul);
  assertClose(api.state.stats.fireDamageMul,
    data.player.baseStats.fireDamageMul * effects.dotDamageMul, 1e-9, '灼烧伤害要吃到持久倍率');
});

test('Mode B: horse/goat heal on kill and dog/pig shield HP reach the player', () => {
  const { api, seed } = bootAction();
  const flat = seed();
  assert.equal(flat.healOnKill, 0, 'no upgrades: no heal on kill');
  assert.equal(flat.shieldHp, 0, 'no upgrades: no bonus HP');

  const healStep = seed({ horse: 1 }).healOnKill;
  assert.equal(healStep, 2, '奶马 1 级击杀应回 2 HP');
  assert.equal(seed({ goat: 1 }).healOnKill, healStep, '奶羊与奶马等价');
  assert.equal(seed({ horse: 2, goat: 1 }).healOnKill, healStep * 3, '马 2 + 羊 1');
  assert.equal(seed({ horse: MAX }).healOnKill, healStep * MAX, '满级奶马');

  const shieldStep = seed({ dog: 1 }).shieldHp;
  assert.equal(shieldStep, 30, '奶狗 1 级应加 30 点护盾血量');
  assert.equal(seed({ pig: 1 }).shieldHp, shieldStep, '奶猪与奶狗等价');
  assert.equal(seed({ dog: 2, pig: 1 }).shieldHp, shieldStep * 3, '狗 2 + 猪 1');
  assert.equal(shieldStep, healStep * 15, '每级护盾血量必须是每级击杀回复的 15 倍');

  seed();
  const neutralPlayer = { ...api.state.player };
  const effects = seed({ horse: 1, dog: 2 });
  assert.equal(api.state.player.healOnKill, effects.healOnKill,
    '本局奶娃要带上刚算出的击杀回复');
  assert.equal(api.state.player.hp - neutralPlayer.hp, effects.shieldHp,
    '护盾血量要真的加进奶娃当前血量');
  assert.equal(api.state.player.maxHpBase, neutralPlayer.maxHpBase + effects.shieldHp);
  assert.equal(api.state.stats.maxHp, api.state.player.maxHpBase, '血上限要同步到本局属性');
});

test('Mode B: the save layer clamps levels and drops unknown characters', () => {
  const { api, seed } = bootAction();
  const capped = seed({ ox: MAX + 4, egg: MAX + 4, dog: MAX + 4 });
  assert.equal(api.state.player.autoHealPerSec, MAX, '等级要夹到 MAX_UPGRADE_LEVEL');
  assertClose(capped.shieldHp, seed({ dog: MAX }).shieldHp, 1e-9,
    '超过上限的等级不能比上限本身更强');
  assert.equal(capped.skillCooldownMul, 1, '没升级的角色必须保持中性');

  const bogus = seed({ unicorn: 5, ox: 0 });
  const neutral = seed();
  for (const key of Object.keys(neutral)) {
    assert.deepEqual(bogus[key], neutral[key], `${key} must ignore an unknown character`);
  }
  assert.equal(seed({ unicorn: 9 }).shieldHp, 0, 'unknown keys must not leak into the shield');
});

test('both modes read the same curve constants for the same save', () => {
  const tower = bootTower();
  const action = bootAction();
  const levels = {
    egg: 4, rat: 2, snake: 3, dragon: 1, rabbit: 1, tiger: 1, ox: 2, monkey: 1,
    goat: 1, rooster: 1, pig: 2, horse: 2, dog: 1
  };
  const a = tower.seed(levels);
  const b = action.seed(levels);

  assertClose(a.babyDamageMul, b.attackDamageMul, 1e-9, '两种模式的伤害倍率必须一致');
  assertClose(a.babyDotMul, b.dotDamageMul, 1e-9, '两种模式的持续伤害倍率必须一致');
  assertClose(a.babyCooldownMul, b.skillCooldownMul, 1e-9, '两种模式的冷却倍率必须一致');
  // 同一张存档在两个模式里的每级权重比例：治疗 10↔2、护盾 20↔30。
  assert.equal(a.babyHealPerUse, b.healOnKill * 5, 'Mode A 每级治疗应是 Mode B 击杀回复的 5 倍');
  assert.equal(b.shieldHp, a.babyShieldPerUse * 1.5, 'Mode B 护盾血量应是 Mode A 护盾的 1.5 倍');
});

test('Mode B: persistent upgrades stack multiplicatively with the roguelike', () => {
  const { api, seed, data, logic } = bootAction();
  const persistent = seed({ ox: 2 });
  assertClose(persistent.attackDamageMul, 1.3, 1e-9, '奶牛 2 级的持久倍率');

  const power = data.upgrades.find(upgrade => upgrade.apply && upgrade.apply.attackDamageMul);
  assert.ok(power, '肉鸽升级池里已经没有攻击倍率升级可测了');
  const roguelike = logic.applyUpgrade(api.state.stats, power);

  assertClose(roguelike.attackDamageMul,
    persistent.attackDamageMul * power.apply.attackDamageMul, 1e-9,
    '持久倍率与肉鸽倍率要相乘');
  assertClose(roguelike.attackDamageMul, 1.56, 1e-9, '1.3 持久 × 1.2 肉鸽 = 1.56');
  assert.ok(roguelike.attackDamageMul > api.state.stats.attackDamageMul,
    '肉鸽升级必须再抬一层');
});
