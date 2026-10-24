# 主菜单与「奶龙战僵尸」模式实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为奶龙大战僵尸加入初代 PvZ 风格主菜单，以及单线横版格斗玩法「奶龙战僵尸」（闯关三段 + Boss、无尽模式、局内肉鸽升级）。

**Architecture:** 分页面静态站点。`index.html` 为主菜单；现有塔防迁移到 `game.html` 且 `game.js` 不改逻辑；奶龙模式独立为 `action.html` + `action.css` + `action-data.js` + `action-logic.js` + `action.js`。纯数值与成长计算放 `action-logic.js`，用 Node 内置测试覆盖；DOM 战斗与 UI 用浏览器实测。

**Tech Stack:** 原生 HTML / CSS / JavaScript（ES6），WebAudio 合成音，Node.js 内置 `node:test`，`python -m http.server` 本地预览。

**Spec:** `docs/superpowers/specs/2026-10-24-menu-and-action-mode-design.md`

## Global Constraints

- 不引入框架、构建工具或任何第三方运行依赖。
- 桌面端优先，`min-width: 1024px`；动作模式逻辑分辨率固定 1280×720，等比缩放。
- 中文界面，不使用 emoji；图标用内联 SVG 或 CSS。
- 页面脚本用 IIFE 隔离；`action-data.js` 与 `action-logic.js` 使用 UMD 写法，同时支持浏览器全局与 Node `require`。
- 所有可调数值集中在 `action-data.js`，不在业务代码里写魔法数字。
- 不修改 `game.js` 的塔防逻辑。
- **不自动执行 `git commit`**：仓库规则要求用户明确同意后才提交；每个任务以可运行验证作为检查点。
- 所有 JS 必须通过 `node --check`；单元测试命令为 `node --test tests/action-logic.test.js`。
- 本地预览：`python -m http.server 4173`，访问 `http://127.0.0.1:4173/`。
- 实体 DOM 必须复用并在重开时彻底清理；特效同时最多 40 个。
- 数值、文案、交互细节以 spec 为准；本计划给出关键实现代码，未展开的纯样式可按 spec 视觉规范补全。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `index.html` | 主菜单：标题、模式入口、帮助弹层、无尽最佳记录 |
| `menu.css` | 主菜单布局、木牌按钮、背景与动画 |
| `menu.js` | 弹层开关、Esc、遮罩点击、读取最佳记录 |
| `game.html` | 原塔防页面（由现 `index.html` 迁移），新增返回主菜单链接 |
| `styles.css` | 塔防样式；仅补 `a.icon-button` 与首页图标所需样式 |
| `game.js` | 原塔防逻辑，不改 |
| `action.html` | 奶龙模式页面骨架、HUD、弹层容器 |
| `action.css` | 舞台、角色、敌人、HUD、弹层、特效样式 |
| `action-data.js` | 玩家/敌人/Boss/强化/波次全部数值 |
| `action-logic.js` | 纯函数：经验、波次缩放、强化叠加、抽卡、碰撞、镜头钳制 |
| `action.js` | 奶龙模式运行时：状态机、输入、战斗、镜头、关卡、升级、结算 |
| `tests/action-logic.test.js` | 纯逻辑单元测试 |
| `README.md` | 更新结构与玩法说明 |

---

### Task 1: 数值配置与纯逻辑层

**Files:**
- Create: `action-data.js`
- Create: `action-logic.js`
- Create: `tests/action-logic.test.js`

**Interfaces:**
- Produces: `window.ACTION_DATA`（浏览器）/ `module.exports`（Node），结构见下。
- Produces: `window.ActionLogic` / `module.exports`，方法：
  - `xpToNext(level: number): number`
  - `waveConfig(wave: number, bossCount?: number): {count, hpMul, dmgMul, speedMul, hasElite, hasBoss, bossHp}`
  - `applyUpgrade(stats: object, upgrade: {apply: object}): object`（不修改入参）
  - `rollUpgrades(pool: array, ownedIds: string[], count?: number, rng?: () => number): string[]`
  - `scaleEnemy(base: object, cfg: object): object`
  - `rectsOverlap(a, b): boolean`
  - `clampCamera(targetX, worldWidth, viewWidth): number`

- [ ] **Step 1: 写失败测试**

创建 `tests/action-logic.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const DATA = require('../action-data.js');
const L = require('../action-logic.js');

test('xpToNext returns 30 + 20 * (level - 1)', () => {
  assert.equal(L.xpToNext(1), 30);
  assert.equal(L.xpToNext(2), 50);
  assert.equal(L.xpToNext(5), 110);
});

test('waveConfig scales endless waves', () => {
  const first = L.waveConfig(1, 0);
  assert.deepEqual(first, {
    count: 4, hpMul: 1, dmgMul: 1, speedMul: 1,
    hasElite: false, hasBoss: false, bossHp: 1200
  });
  const fifth = L.waveConfig(5, 0);
  assert.equal(fifth.hasElite, true);
  assert.equal(fifth.count, 9);
  assert.ok(Math.abs(fifth.hpMul - 1.32) < 1e-9);
  const tenth = L.waveConfig(10, 1);
  assert.equal(tenth.hasBoss, true);
  assert.equal(tenth.count, 12);
  assert.equal(tenth.bossHp, 1560);
});

test('applyUpgrade stacks and keeps input immutable', () => {
  const power = DATA.upgrades.find(u => u.id === 'power');
  const base = { ...DATA.player.baseStats };
  const once = L.applyUpgrade(base, power);
  const twice = L.applyUpgrade(once, power);
  assert.equal(base.attackDamageMul, 1);
  assert.ok(Math.abs(twice.attackDamageMul - 1.44) < 1e-9);
  const milk = L.applyUpgrade(base, DATA.upgrades.find(u => u.id === 'milk'));
  assert.equal(milk.maxHp, 120);
  const doubleJump = L.applyUpgrade(base, DATA.upgrades.find(u => u.id === 'doublejump'));
  assert.equal(doubleJump.doubleJump, true);
});

test('rollUpgrades returns distinct ids and respects unique upgrades', () => {
  const picks = L.rollUpgrades(DATA.upgrades, [], 3, () => 0);
  assert.equal(new Set(picks).size, 3);
  const withoutDouble = L.rollUpgrades(DATA.upgrades, ['doublejump'], 12, () => 0);
  assert.equal(withoutDouble.includes('doublejump'), false);
  assert.deepEqual(L.rollUpgrades([], [], 3), ['recover']);
});

test('rectsOverlap detects overlap', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  assert.equal(L.rectsOverlap(a, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(L.rectsOverlap(a, { x: 20, y: 0, w: 5, h: 5 }), false);
});

test('clampCamera keeps camera inside world', () => {
  assert.equal(L.clampCamera(-50, 5120, 1280), 0);
  assert.equal(L.clampCamera(2000, 5120, 1280), 2000);
  assert.equal(L.clampCamera(5000, 5120, 1280), 3840);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/action-logic.test.js`
Expected: FAIL，报 `Cannot find module '../action-data.js'`。

- [ ] **Step 3: 创建 action-data.js**

```js
(function (root) {
  const ACTION_DATA = {
    arena: { width: 1280, height: 720, groundY: 560, minX: 60, maxX: 1220, endlessStartX: 240 },
    progression: { xpBase: 30, xpStep: 20, upgradeCount: 3 },
    level: {
      worldWidth: 5120,
      screenWidth: 1280,
      startX: 200,
      edgeMargin: 70,
      batchDelay: 1.2,
      spawnInterval: 0.6,
      screens: [
        { batches: [['basic', 'basic', 'basic'], ['basic', 'cone', 'cone']] },
        { batches: [['cone', 'cone', 'runner', 'runner'], ['basic', 'bucket'], ['elite', 'basic', 'basic']] },
        { batches: [['cone', 'cone', 'bucket', 'bucket'], ['runner', 'runner', 'basic', 'basic'], ['elite', 'cone', 'cone']] },
        { boss: true }
      ]
    },
    player: {
      maxHp: 100,
      speed: 300,
      jumpVelocity: -780,
      gravity: 2200,
      coyoteTime: 0.1,
      jumpBuffer: 0.12,
      hurtIframes: 0.7,
      dashSpeed: 700,
      dashDuration: 0.16,
      dashIframes: 0.25,
      dashCooldown: 2,
      comboWindow: 0.55,
      combo: [
        { damage: 14, windup: 0.08, recover: 0.16, range: 85, knockback: 40 },
        { damage: 14, windup: 0.08, recover: 0.16, range: 85, knockback: 40 },
        { damage: 24, windup: 0.12, recover: 0.24, range: 100, knockback: 110 }
      ],
      heavy: { damage: 32, range: 100, windup: 0.18, recover: 0.3, knockback: 150, cooldown: 0.9 },
      dive: { damage: 30, range: 90, knockback: 80 },
      fire: { damage: 45, range: 240, halfAngleDeg: 22, burnDps: 3, burnSeconds: 4, cooldown: 6, windup: 0.2 },
      baseStats: {
        maxHp: 100,
        speed: 300,
        attackDamageMul: 1,
        attackSpeedMul: 1,
        heavyDamageMul: 1,
        heavyKnockbackMul: 1,
        fireDamageMul: 1,
        fireCooldownMul: 1,
        moveSpeedMul: 1,
        lifesteal: 0,
        doubleJump: false,
        diveDamageMul: 1,
        diveRangeMul: 1,
        dashCooldownMul: 1,
        dashIframesBonus: 0,
        thirdHitRangeMul: 1,
        thirdHitDamageMul: 1
      }
    },
    enemies: {
      basic: { name: '普通僵尸', hp: 60, speed: 62, damage: 8, range: 58, interval: 1.2, windup: 0.35, xp: 8, knockbackResist: 1, scale: 1 },
      cone: { name: '路障僵尸', hp: 100, speed: 58, damage: 10, range: 62, interval: 1.3, windup: 0.4, xp: 12, knockbackResist: 0.9, scale: 1 },
      bucket: { name: '铁桶僵尸', hp: 180, speed: 48, damage: 14, range: 66, interval: 1.5, windup: 0.5, xp: 18, knockbackResist: 0.55, scale: 1 },
      runner: { name: '快速僵尸', hp: 45, speed: 105, damage: 6, range: 54, interval: 0.9, windup: 0.25, xp: 6, knockbackResist: 1.2, scale: 0.92 },
      elite: { name: '精英铁桶', hp: 340, speed: 52, damage: 18, range: 70, interval: 1.4, windup: 0.5, xp: 35, knockbackResist: 0.35, scale: 1.3 }
    },
    boss: {
      name: '僵尸王',
      hp: 1200,
      speed: 55,
      xp: 100,
      knockbackResist: 0.15,
      scale: 1.8,
      attackInterval: 2.2,
      phase2At: 0.5,
      phase2SpeedMul: 1.2,
      phase2IntervalMul: 0.8,
      phase2WindupReduce: 0.1,
      charge: { windup: 0.7, speed: 700, duration: 0.5, damage: 26, knockback: 220, stunOnWall: 0.8 },
      slam: { windup: 0.8, damage: 20, waveSpeed: 260, jumpHeight: 170, recover: 1 },
      summon: { thresholds: [0.6, 0.3], windup: 0.8, adds: ['basic', 'basic', 'cone'] }
    },
    upgrades: [
      { id: 'power', name: '奶香重拳', desc: '普攻伤害 +20%', apply: { attackDamageMul: 1.2 } },
      { id: 'swift', name: '疾风连击', desc: '普攻攻速 +12%', apply: { attackSpeedMul: 1.12 } },
      { id: 'ironhead', name: '铁头功', desc: '重击伤害 +30%，击退 +25%', apply: { heavyDamageMul: 1.3, heavyKnockbackMul: 1.25 } },
      { id: 'breath', name: '龙息精炼', desc: '喷火伤害 +30%', apply: { fireDamageMul: 1.3 } },
      { id: 'deepbreath', name: '深呼吸', desc: '喷火冷却 -20%', apply: { fireCooldownMul: 0.8 } },
      { id: 'agility', name: '灵活走位', desc: '移动速度 +10%', apply: { moveSpeedMul: 1.1 } },
      { id: 'milk', name: '奶量充足', desc: '最大生命 +20 并回满', apply: { maxHpAdd: 20 } },
      { id: 'vamp', name: '越战越勇', desc: '每次击杀回复 2 生命', apply: { lifestealAdd: 2 } },
      { id: 'doublejump', name: '二段跳', desc: '解锁二段跳', unique: true, apply: { doubleJump: true } },
      { id: 'airdive', name: '空中霸主', desc: '跳劈伤害 +40%，范围 +20%', apply: { diveDamageMul: 1.4, diveRangeMul: 1.2 } },
      { id: 'dashmaster', name: '冲刺大师', desc: '冲刺冷却 -25%，无敌 +0.1s', apply: { dashCooldownMul: 0.75, dashIframesBonus: 0.1 } },
      { id: 'combomaster', name: '连击大师', desc: '第三段范围 +30%，伤害 +15%', apply: { thirdHitRangeMul: 1.3, thirdHitDamageMul: 1.15 } }
    ],
    endless: {
      baseCount: 3,
      countPerWave: 1.2,
      maxCount: 12,
      rest: 3,
      eliteEvery: 5,
      bossEvery: 10,
      healRatio: 0.15,
      bossHpGrowth: 0.3,
      scaling: { hp: 0.08, dmg: 0.05, speed: 0.02, maxSpeedMul: 1.4 }
    },
    storageKeys: { endlessBest: 'nailong.action.endlessBest' }
  };

  if (typeof module === 'object' && module.exports) module.exports = ACTION_DATA;
  else root.ACTION_DATA = ACTION_DATA;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: 创建 action-logic.js**

```js
(function (root) {
  function createLogic(DATA) {
    const MULTIPLIER_KEYS = [
      'attackDamageMul', 'attackSpeedMul', 'heavyDamageMul', 'heavyKnockbackMul',
      'fireDamageMul', 'fireCooldownMul', 'moveSpeedMul', 'diveDamageMul', 'diveRangeMul',
      'dashCooldownMul', 'thirdHitRangeMul', 'thirdHitDamageMul'
    ];

    function xpToNext(level) {
      const P = DATA.progression;
      return P.xpBase + P.xpStep * (level - 1);
    }

    function waveConfig(wave, bossCount = 0) {
      const E = DATA.endless;
      return {
        count: Math.min(E.maxCount, E.baseCount + Math.floor(wave * E.countPerWave)),
        hpMul: 1 + E.scaling.hp * (wave - 1),
        dmgMul: 1 + E.scaling.dmg * (wave - 1),
        speedMul: Math.min(E.scaling.maxSpeedMul, 1 + E.scaling.speed * (wave - 1)),
        hasElite: wave % E.eliteEvery === 0,
        hasBoss: wave % E.bossEvery === 0,
        bossHp: Math.round(DATA.boss.hp * (1 + E.bossHpGrowth * bossCount))
      };
    }

    function applyUpgrade(stats, upgrade) {
      const next = { ...stats };
      const apply = upgrade.apply || {};
      for (const key of MULTIPLIER_KEYS) {
        if (apply[key]) next[key] *= apply[key];
      }
      if (apply.maxHpAdd) next.maxHp += apply.maxHpAdd;
      if (apply.lifestealAdd) next.lifesteal += apply.lifestealAdd;
      if (apply.dashIframesBonus) next.dashIframesBonus += apply.dashIframesBonus;
      if (apply.doubleJump) next.doubleJump = true;
      return next;
    }

    function rollUpgrades(pool, ownedIds, count = DATA.progression.upgradeCount, rng = Math.random) {
      const bag = pool.filter(upgrade => !(upgrade.unique && ownedIds.includes(upgrade.id)));
      const picked = [];
      while (picked.length < count && bag.length) {
        const index = Math.floor(rng() * bag.length);
        picked.push(bag.splice(index, 1)[0].id);
      }
      return picked.length ? picked : ['recover'];
    }

    function scaleEnemy(base, cfg) {
      return {
        ...base,
        hp: Math.round(base.hp * cfg.hpMul),
        damage: base.damage * cfg.dmgMul,
        speed: base.speed * cfg.speedMul
      };
    }

    function rectsOverlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function clampCamera(targetX, worldWidth, viewWidth) {
      return Math.max(0, Math.min(targetX, worldWidth - viewWidth));
    }

    return { xpToNext, waveConfig, applyUpgrade, rollUpgrades, scaleEnemy, rectsOverlap, clampCamera };
  }

  if (typeof module === 'object' && module.exports) module.exports = createLogic(require('./action-data.js'));
  else root.ActionLogic = createLogic(root.ACTION_DATA);
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 5: 运行测试与语法检查**

Run: `node --test tests/action-logic.test.js`
Expected: 6 个测试全部 PASS。

Run: `node --check action-data.js && node --check action-logic.js`
Expected: 无输出，退出码 0。

- [ ] **Step 6: 检查点**

Run: `git status --short`
Expected: 只新增上述 3 个文件，不提交。

---

### Task 2: 塔防页面迁移与返回菜单入口

**Files:**
- Move: `index.html` → `game.html`
- Modify: `game.html`（SVG 符号库、顶栏操作区）
- Modify: `styles.css`（链接样式）
- Verify: `game.js`（不改）

**Interfaces:**
- Produces: `/game.html` 可独立运行塔防；顶栏包含指向 `index.html` 的链接。
- Note: 此任务完成时 `index.html` 尚不存在，返回链接会 404，Task 3 补齐。

- [ ] **Step 1: 移动文件**

Run: `git mv index.html game.html`
Expected: `game.html` 出现在工作区，`index.html` 暂时不存在。

- [ ] **Step 2: 在 game.html 的 SVG 符号库中添加首页图标**

在 `i-shovel` 符号之前加入：

```html
<symbol id="i-home" viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5M5.5 10v9h5v-5h3v5h5v-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
```

- [ ] **Step 3: 在顶栏加入返回主菜单链接**

在 `game.html` 的 `.top-actions` 中、`#helpButton` 之前加入：

```html
<a class="icon-button" href="index.html" title="返回主菜单" aria-label="返回主菜单"><svg><use href="#i-home"></use></svg></a>
```

- [ ] **Step 4: 补充链接样式**

在 `styles.css` 的 `.icon-button` 规则后加入：

```css
a.icon-button { text-decoration: none; color: #52705a; }
```

- [ ] **Step 5: 验证塔防未回归**

Run: `node --check game.js`
Expected: 退出码 0。

Run: `python -m http.server 4173`
打开 `http://127.0.0.1:4173/game.html`，检查：
- 页面与原来一致，顶栏出现首页图标。
- 点击「开始守护」后能种奶蛋、收集奶黄、出僵尸。
- 控制台无报错。

- [ ] **Step 6: 检查点**

Run: `git status --short`
Expected: `index.html` 显示为 renamed to `game.html`，`styles.css` 有修改。

---

### Task 3: 主菜单页面

**Files:**
- Create: `index.html`
- Create: `menu.css`
- Create: `menu.js`

**Interfaces:**
- Consumes: `assets/dragon.png`、`assets/zombie.png`、`assets/egg.png`；`localStorage['nailong.action.endlessBest']`。
- Produces: 菜单到 `game.html`、`action.html?mode=level`、`action.html?mode=endless` 的导航。

- [ ] **Step 1: 创建 menu.js**

```js
(function () {
  const modals = Array.from(document.querySelectorAll('.modal'));
  const bestEls = Array.from(document.querySelectorAll('[data-best-wave]'));

  function readBest() {
    try {
      return JSON.parse(localStorage.getItem('nailong.action.endlessBest') || 'null');
    } catch {
      return null;
    }
  }

  function renderBest() {
    const best = readBest();
    const label = best && best.wave ? `最佳：第 ${best.wave} 波` : '暂无记录';
    bestEls.forEach(el => { el.textContent = label; });
  }

  function open(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
  }

  function close(modal) {
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
  }

  document.querySelectorAll('[data-open]').forEach(button => {
    button.addEventListener('click', () => open(button.dataset.open));
  });

  document.querySelectorAll('[data-close]').forEach(button => {
    button.addEventListener('click', () => close(button.closest('.modal')));
  });

  modals.forEach(modal => {
    modal.addEventListener('click', event => {
      if (event.target === modal) close(modal);
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    modals.filter(modal => modal.classList.contains('visible')).forEach(close);
  });

  renderBest();
})();
```

- [ ] **Step 2: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#dff2c7">
  <title>奶龙大战僵尸 · 奶家小院</title>
  <link rel="stylesheet" href="menu.css">
</head>
<body>
  <div class="menu-bg" aria-hidden="true">
    <div class="cloud cloud-a"></div>
    <div class="cloud cloud-b"></div>
    <div class="hill hill-back"></div>
    <div class="hill hill-front"></div>
    <div class="fence"></div>
    <div class="grass"></div>
  </div>

  <main class="menu-shell">
    <header class="hero">
      <div class="hero-cast">
        <img class="hero-zombie" src="assets/zombie.png" alt="僵尸">
        <img class="hero-dragon" src="assets/dragon.png" alt="奶龙">
      </div>
      <p class="eyebrow">NAI FAMILY DEFENSE</p>
      <h1>奶龙大战僵尸</h1>
      <p class="subtitle">奶家小院保卫战</p>
    </header>

    <section class="mode-grid" aria-label="选择模式">
      <a class="mode-card adventure" href="game.html">
        <span class="mode-tag">冒险模式</span>
        <img src="assets/egg.png" alt="">
        <strong>守住奶家小院</strong>
        <p>收集奶黄，种植十二生肖，击退五波僵尸。</p>
        <span class="mode-cta">进入第 1 关</span>
      </a>

      <button class="mode-card action" id="actionModeCard" type="button" data-open="modeModal">
        <span class="mode-tag">奶龙战僵尸</span>
        <img src="assets/dragon.png" alt="">
        <strong>亲自上阵</strong>
        <p>横版格斗闯关，三段关卡与僵尸王；或挑战无尽波次。</p>
        <span class="mode-cta">选择模式</span>
      </button>
    </section>

    <footer class="menu-footer">
      <button class="text-button" type="button" data-open="helpModal">玩法说明</button>
      <span>v1.1 · 原生 HTML / CSS / JS</span>
    </footer>
  </main>

  <div class="modal" id="modeModal" aria-hidden="true">
    <div class="modal-card">
      <button class="modal-close" type="button" data-close aria-label="关闭">×</button>
      <span class="eyebrow">奶龙战僵尸</span>
      <h2>选择玩法</h2>
      <div class="mode-options">
        <a class="mode-option" href="action.html?mode=level">
          <strong>闯关模式</strong>
          <span>三段关卡 · 精英怪 · 僵尸王</span>
        </a>
        <a class="mode-option" href="action.html?mode=endless">
          <strong>无尽模式</strong>
          <span data-best-wave>暂无记录</span>
        </a>
      </div>
      <small>键盘操作 · A/D 移动 · 空格跳跃 · J/K/L 攻击</small>
    </div>
  </div>

  <div class="modal" id="helpModal" aria-hidden="true">
    <div class="modal-card help-card">
      <button class="modal-close" type="button" data-close aria-label="关闭">×</button>
      <span class="eyebrow">玩法说明</span>
      <h2>两种玩法</h2>
      <div class="help-grid">
        <section>
          <h3>冒险模式</h3>
          <p>点击发光的奶黄收集资源，选择左侧卡牌后点击草地放置。奶娃可清空一行，空格暂停，数字 1 / 2 切换速度。</p>
        </section>
        <section>
          <h3>奶龙战僵尸</h3>
          <p>A/D 移动，空格跳跃，J 普攻三连，K 重击，L 喷火，Shift 冲刺，Esc 暂停。击杀敌人升级并三选一强化；闯关终点是僵尸王，无尽模式波次无限增强。</p>
        </section>
      </div>
    </div>
  </div>

  <script src="menu.js"></script>
</body>
</html>
```

- [ ] **Step 3: 创建 menu.css**

必须包含以下完整规则（可在此基础上补充细节）：

```css
:root {
  --ink: #294433;
  --muted: #718273;
  --green: #558b47;
  --deep-green: #376b3d;
  --lime: #a8d96f;
  --cream: #fffdf3;
  --yellow: #f5c94c;
  --orange: #eaa638;
  --wood: #b97a3d;
  --wood-dark: #8a5426;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-width: 1024px;
  min-height: 100vh;
  color: var(--ink);
  font-family: "Microsoft YaHei", "PingFang SC", system-ui, sans-serif;
  background: linear-gradient(180deg, #bfe8ff 0%, #eaf7d8 55%, #cdeaa9 100%);
  overflow-x: auto;
  user-select: none;
}

button { font: inherit; }
button:focus-visible, a:focus-visible { outline: 3px solid rgba(239, 180, 48, .8); outline-offset: 4px; }

.menu-bg { position: fixed; inset: 0; overflow: hidden; pointer-events: none; }
.cloud { position: absolute; height: 90px; border-radius: 50%; background: rgba(255, 255, 255, .85); filter: blur(1px); animation: drift 40s linear infinite; }
.cloud-a { width: 280px; top: 12%; left: -300px; }
.cloud-b { width: 360px; height: 110px; top: 30%; left: -380px; animation-delay: -18s; opacity: .7; }
.hill { position: absolute; left: -10%; right: -10%; border-radius: 50% 50% 0 0; }
.hill-back { bottom: 18%; height: 34%; background: #b9dd8f; opacity: .8; }
.hill-front { bottom: 10%; height: 28%; background: #9fd073; }
.fence { position: absolute; left: 0; right: 0; bottom: 12%; height: 70px; background: repeating-linear-gradient(90deg, #e6c58f 0 14px, transparent 14px 58px); border-top: 8px solid #c99a5c; opacity: .8; }
.grass { position: absolute; left: 0; right: 0; bottom: 0; height: 14%; background: linear-gradient(180deg, #8fc45f, #6aa84a); }

.menu-shell { position: relative; z-index: 1; width: min(1180px, calc(100% - 48px)); margin: 0 auto; padding: 42px 0 32px; }

.hero { text-align: center; position: relative; }
.hero-cast { display: flex; justify-content: center; align-items: flex-end; gap: 40px; height: 170px; margin-bottom: 8px; }
.hero-dragon { height: 168px; filter: drop-shadow(0 12px 12px rgba(63, 84, 45, .22)); animation: bob 2.4s ease-in-out infinite; }
.hero-zombie { height: 128px; opacity: .9; filter: drop-shadow(0 10px 10px rgba(63, 84, 45, .18)); animation: bob 2.8s ease-in-out infinite reverse; }
.eyebrow { margin: 0; font-size: 12px; letter-spacing: 4px; font-weight: 800; color: #6f8a63; }
.hero h1 { margin: 8px 0 4px; font-size: 64px; line-height: 1.05; letter-spacing: 4px; color: #355b38; text-shadow: 0 4px 0 #fff, 0 10px 18px rgba(53, 91, 56, .18); }
.subtitle { margin: 0; font-size: 18px; font-weight: 700; color: #718273; letter-spacing: 6px; }

.mode-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px; margin: 40px auto 0; }
.mode-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-height: 240px;
  padding: 24px 26px 22px;
  border-radius: 26px;
  border: 4px solid #e8c184;
  background: linear-gradient(160deg, #fff4d8, #f3d79d);
  box-shadow: 0 14px 0 var(--wood-dark), 0 24px 40px rgba(80, 56, 23, .22);
  color: #4b3418;
  text-align: left;
  cursor: pointer;
  text-decoration: none;
  transition: transform .18s ease, box-shadow .18s ease;
}
.mode-card:hover { transform: translateY(-6px); box-shadow: 0 20px 0 var(--wood-dark), 0 30px 50px rgba(80, 56, 23, .26); }
.mode-card:active { transform: translateY(4px); box-shadow: 0 8px 0 var(--wood-dark), 0 14px 24px rgba(80, 56, 23, .22); }
.mode-card img { position: absolute; right: 18px; bottom: 16px; height: 132px; object-fit: contain; filter: drop-shadow(0 8px 8px rgba(80, 56, 23, .22)); }
.mode-tag { display: inline-block; padding: 5px 12px; border-radius: 999px; background: #7fae5a; color: #fff; font-size: 13px; font-weight: 800; letter-spacing: 1px; }
.mode-card.action .mode-tag { background: #d97f3a; }
.mode-card strong { font-size: 28px; letter-spacing: 1px; }
.mode-card p { margin: 0; max-width: 62%; font-size: 14px; line-height: 1.7; color: #7a6040; }
.mode-cta { margin-top: auto; font-size: 14px; font-weight: 800; color: #a56725; }
.mode-cta::after { content: " →"; }

.menu-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 36px; color: #6d8366; font-size: 13px; }
.text-button { border: 0; background: transparent; color: #4f7048; font-weight: 800; cursor: pointer; padding: 8px 4px; border-bottom: 2px solid transparent; }
.text-button:hover { border-bottom-color: #7fae5a; }

.modal { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; background: rgba(36, 55, 34, .45); backdrop-filter: blur(6px); opacity: 0; visibility: hidden; transition: opacity .2s ease, visibility .2s ease; }
.modal.visible { opacity: 1; visibility: visible; }
.modal-card { position: relative; width: min(560px, calc(100vw - 48px)); padding: 30px 32px 26px; border-radius: 26px; background: var(--cream); border: 3px solid #e8c184; box-shadow: 0 24px 60px rgba(30, 45, 28, .3); }
.modal-card h2 { margin: 6px 0 18px; font-size: 30px; color: #355b38; }
.modal-close { position: absolute; top: 12px; right: 16px; width: 38px; height: 38px; border: 0; border-radius: 12px; background: #efe7cd; color: #6f5a35; font-size: 22px; cursor: pointer; }
.modal-close:hover { background: #e6d9b4; }
.mode-options { display: grid; gap: 14px; }
.mode-option { display: flex; flex-direction: column; gap: 4px; padding: 18px 20px; border-radius: 18px; background: linear-gradient(135deg, #fff8dd, #f6e6b9); border: 2px solid #ecd39a; color: #4b3418; text-decoration: none; transition: transform .16s ease, border-color .16s ease; }
.mode-option:hover { transform: translateX(4px); border-color: #d99a3f; }
.mode-option strong { font-size: 20px; }
.mode-option span { font-size: 13px; color: #806943; }
.modal-card small { display: block; margin-top: 18px; color: #8a8f7d; font-size: 12px; }
.help-card { width: min(760px, calc(100vw - 48px)); }
.help-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.help-grid section { padding: 16px 18px; border-radius: 16px; background: #f5f1e2; }
.help-grid h3 { margin: 0 0 8px; font-size: 17px; color: #4a6b42; }
.help-grid p { margin: 0; font-size: 13px; line-height: 1.8; color: #6f7c69; }

@keyframes drift { from { transform: translateX(0); } to { transform: translateX(calc(100vw + 400px)); } }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
```

- [ ] **Step 4: 验证菜单**

Run: `python -m http.server 4173`（若已在运行则跳过）
打开 `http://127.0.0.1:4173/`，检查：
- 标题、两个模式卡片、页脚正常显示，无资源 404。
- 点击「冒险模式」进入 `game.html`，点击首页图标返回菜单。
- 点击「奶龙战僵尸」弹出选择弹层，`Esc` 与遮罩点击可关闭；两个入口 href 分别为 `action.html?mode=level`、`action.html?mode=endless`（此时 action 页尚未创建，点击会 404，属预期）。
- 控制台执行：
  ```js
  localStorage.setItem('nailong.action.endlessBest', JSON.stringify({wave: 7, kills: 40, date: '2026-10-24'}));
  location.reload();
  ```
  重新加载后无尽入口显示「最佳：第 7 波」。
- 控制台无报错。

- [ ] **Step 5: 语法检查**

Run: `node --check menu.js`
Expected: 退出码 0。

- [ ] **Step 6: 检查点**

Run: `git status --short`
Expected: 新增 `index.html`、`menu.css`、`menu.js`。

---

### Task 4: 动作模式舞台、玩家移动跳跃与镜头

**Files:**
- Create: `action.html`
- Create: `action.css`
- Create: `action.js`

**Interfaces:**
- Consumes: `window.ACTION_DATA`、`window.ActionLogic`。
- Produces: 全局状态对象 `state`（内部）与调试入口 `window.__nailong`，后续任务扩展。
- DOM 约定：`#stage`、`#world`、`#playerLayer`、`#enemyLayer`、`#effectLayer`、`#hpFill`、`#hpText`、`#overlay`。

- [ ] **Step 1: 创建 action.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>奶龙战僵尸</title>
  <link rel="stylesheet" href="action.css">
</head>
<body>
  <div class="stage-wrap">
    <div id="stage" class="stage">
      <div class="scene">
        <div class="parallax sky" data-factor="0.15"></div>
        <div class="parallax hills" data-factor="0.3"></div>
        <div class="parallax fence" data-factor="0.6"></div>
        <div class="parallax bushes" data-factor="0.85"></div>
        <div id="world" class="world">
          <div class="ground"></div>
          <div id="enemyLayer" class="layer"></div>
          <div id="playerLayer" class="layer"></div>
          <div id="effectLayer" class="layer"></div>
        </div>
      </div>

      <div class="hud">
        <div class="hud-left">
          <img class="hud-avatar" src="assets/dragon.png" alt="">
          <div class="bars">
            <div class="hp-track"><div id="hpFill" class="hp-fill"></div><span id="hpText">100 / 100</span></div>
            <div class="xp-track"><div id="xpFill" class="xp-fill"></div><span id="levelText">Lv.1</span></div>
          </div>
        </div>
        <div class="hud-center">
          <span id="stageLabel">第 1 / 3 段</span>
          <div id="comboText" class="combo"></div>
        </div>
        <div class="hud-right">
          <button id="soundButton" class="hud-button" type="button">音效</button>
          <button id="pauseButton" class="hud-button" type="button">暂停</button>
          <a class="hud-button" href="index.html">主菜单</a>
        </div>
      </div>

      <div id="tipBar" class="tip-bar">A/D 移动 · 空格跳跃 · J 普攻 · K 重击 · L 喷火 · Shift 冲刺</div>
      <div id="overlay" class="overlay" aria-hidden="true"></div>
    </div>
  </div>

  <script src="action-data.js"></script>
  <script src="action-logic.js"></script>
  <script src="action.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 action.css 基础规则**

```css
:root {
  --ink: #294433;
  --green: #558b47;
  --lime: #a8d96f;
  --cream: #fffdf3;
  --yellow: #f5c94c;
  --orange: #eaa638;
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 1024px; min-height: 100vh; overflow: hidden; background: #1c2a1b; font-family: "Microsoft YaHei", "PingFang SC", system-ui, sans-serif; color: var(--ink); user-select: none; }
button { font: inherit; }

.stage-wrap { position: fixed; inset: 0; display: grid; place-items: center; overflow: hidden; }
.stage { position: relative; width: 1280px; height: 720px; overflow: hidden; transform-origin: center center; background: #bfe8ff; }
.scene { position: absolute; inset: 0; overflow: hidden; }
.parallax { position: absolute; left: 0; top: 0; height: 100%; width: calc(100% + 3400px); will-change: transform; }
.sky { background: linear-gradient(180deg, #bfe8ff 0%, #e7f6d4 62%, #d8edb8 100%); }
.hills { background: radial-gradient(ellipse at 18% 78%, #b9dd8f 0 32%, transparent 33%), radial-gradient(ellipse at 78% 82%, #a9d47e 0 38%, transparent 39%); }
.fence { top: auto; bottom: 160px; height: 80px; background: repeating-linear-gradient(90deg, rgba(230,197,143,.85) 0 14px, transparent 14px 58px); border-top: 8px solid rgba(201,154,92,.9); }
.bushes { top: auto; bottom: 120px; height: 120px; background: radial-gradient(ellipse at 10% 100%, #7fb85c 0 18%, transparent 19%), radial-gradient(ellipse at 32% 100%, #8fc45f 0 14%, transparent 15%), radial-gradient(ellipse at 62% 100%, #7fb85c 0 20%, transparent 21%), radial-gradient(ellipse at 88% 100%, #8fc45f 0 16%, transparent 17%); }
.ground { position: absolute; left: 0; right: 0; bottom: 0; height: 160px; background: linear-gradient(180deg, #a6d273 0%, #8cc05f 32%, #7ab052 100%); border-top: 6px solid #c9a26a; }
.world { position: absolute; inset: 0; width: 5120px; will-change: transform; }
.layer { position: absolute; inset: 0; }

.player { position: absolute; width: 104px; height: 132px; transform-origin: 50% 100%; z-index: 3; }
.player img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 10px 8px rgba(45, 70, 40, .25)); }
.player.flip img { transform: scaleX(-1); }
.player.hurt img { animation: hurtFlash .35s linear; }
.player.invulnerable img { opacity: .55; }

.hud { position: absolute; inset: 0; pointer-events: none; z-index: 10; padding: 18px 22px; display: flex; justify-content: space-between; align-items: flex-start; }
.hud-left, .hud-right { display: flex; align-items: center; gap: 10px; pointer-events: auto; }
.hud-left { padding: 10px 14px; border-radius: 18px; background: rgba(255,255,248,.82); border: 1px solid rgba(255,255,255,.9); box-shadow: 0 10px 26px rgba(53,85,48,.14); }
.hud-avatar { width: 52px; height: 52px; object-fit: contain; }
.bars { display: grid; gap: 6px; width: 240px; }
.hp-track, .xp-track { position: relative; height: 16px; border-radius: 999px; background: #e4e9da; overflow: hidden; }
.hp-fill { height: 100%; width: 100%; background: linear-gradient(90deg, #f08a68, #d9553f); transition: width .15s linear; }
.xp-track { height: 14px; }
.xp-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #7fc95e, #4f9f48); transition: width .2s linear; }
.hp-track span, .xp-track span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 10px; font-weight: 800; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.35); }
.hud-center { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); text-align: center; color: #355b38; font-weight: 900; font-size: 15px; letter-spacing: 1px; }
.combo { margin-top: 6px; font-size: 26px; color: #e07a2f; text-shadow: 0 2px 0 #fff; opacity: 0; transition: opacity .15s ease, transform .15s ease; }
.combo.show { opacity: 1; transform: scale(1.05); }
.hud-button { pointer-events: auto; height: 40px; padding: 0 14px; border-radius: 12px; border: 1px solid rgba(103,137,88,.18); background: rgba(255,255,248,.86); color: #4c6a4f; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; cursor: pointer; }
.hud-button:hover { background: #fff; }
.tip-bar { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 12; padding: 9px 18px; border-radius: 999px; background: rgba(40, 60, 35, .62); color: #fffdf3; font-size: 13px; letter-spacing: 1px; transition: opacity .5s ease; pointer-events: none; }
.tip-bar.hidden { opacity: 0; }

.overlay { position: absolute; inset: 0; z-index: 30; display: none; align-items: center; justify-content: center; background: rgba(28, 42, 27, .55); backdrop-filter: blur(5px); }
.overlay.visible { display: flex; }

@keyframes hurtFlash { 0%, 100% { filter: none; } 50% { filter: brightness(1.8) sepia(1) saturate(4) hue-rotate(-30deg); } }
```

- [ ] **Step 3: 创建 action.js 基础运行时**

```js
(function () {
  const DATA = window.ACTION_DATA;
  const Logic = window.ActionLogic;

  const stage = document.getElementById('stage');
  const world = document.getElementById('world');
  const parallax = Array.from(document.querySelectorAll('.parallax'));
  const playerLayer = document.getElementById('playerLayer');
  const enemyLayer = document.getElementById('enemyLayer');
  const effectLayer = document.getElementById('effectLayer');
  const hpFill = document.getElementById('hpFill');
  const hpText = document.getElementById('hpText');
  const levelText = document.getElementById('levelText');
  const xpFill = document.getElementById('xpFill');
  const stageLabel = document.getElementById('stageLabel');
  const comboText = document.getElementById('comboText');
  const overlay = document.getElementById('overlay');

  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') === 'endless' ? 'endless' : 'level';

  function createPlayer(mode) {
    return {
      x: mode === 'level' ? DATA.level.startX : DATA.arena.endlessStartX,
      y: DATA.arena.groundY,
      vy: 0,
      facing: 1,
      onGround: true,
      jumps: 0,
      hp: DATA.player.maxHp,
      coyote: 0,
      jumpBuffer: 0,
      action: null,
      actionTimer: 0,
      actionWindup: 0,
      actionTotal: 0,
      comboIndex: 0,
      comboTimer: 0,
      queuedCombo: false,
      hitIds: new Set(),
      hitResolved: false,
      heavyReadyAt: 0,
      fireReadyAt: 0,
      dashReadyAt: 0,
      dashUntil: 0,
      dashIframesUntil: 0,
      invulnUntil: 0
    };
  }

  const state = {
    mode,
    status: 'playing',
    sound: true,
    helpReturn: null,
    time: 0,
    cameraX: 0,
    shake: 0,
    hitstop: 0,
    worldWidth: mode === 'level' ? DATA.level.worldWidth : DATA.arena.width,
    levelPhase: 'combat',
    screenIndex: 0,
    screenCleared: false,
    spawnQueue: [],
    wave: 0,
    bossCount: 0,
    intermission: 0,
    kills: 0,
    combo: { count: 0, timer: 0, max: 0 },
    level: 1,
    xp: 0,
    pendingLevelUps: 0,
    ownedUpgrades: [],
    upgradeChoices: [],
    enemies: [],
    shockwaves: [],
    boss: null,
    player: createPlayer(mode),
    stats: { ...DATA.player.baseStats },
    nextId: 1
  };

  const keys = new Set();
  const playerEl = document.createElement('div');
  playerEl.className = 'player';
  playerEl.innerHTML = '<img src="assets/dragon.png" alt="奶龙">';
  playerLayer.appendChild(playerEl);

  function resize() {
    const scale = Math.min(window.innerWidth / DATA.arena.width, window.innerHeight / DATA.arena.height);
    stage.style.transform = `scale(${scale})`;
  }

  function clampPlayerX() {
    const p = state.player;
    const minX = state.mode === 'endless' ? DATA.arena.minX : DATA.level.edgeMargin;
    const maxX = state.mode === 'endless' ? DATA.arena.maxX : state.worldWidth - DATA.level.edgeMargin;
    p.x = Math.max(minX, Math.min(maxX, p.x));
  }

  function startJump() {
    const p = state.player;
    p.vy = DATA.player.jumpVelocity;
    p.onGround = false;
    p.coyote = 0;
    p.jumps += 1;
  }

  function updatePlayer(dt) {
    const p = state.player;
    const speed = DATA.player.speed * state.stats.moveSpeedMul;
    let dir = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dir -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dir += 1;
    if (dir !== 0 && p.action !== 'dash') {
      p.facing = dir;
      p.x += dir * speed * dt;
    }
    const maxJumps = state.stats.doubleJump ? 2 : 1;
    if (p.jumpBuffer > 0) {
      p.jumpBuffer -= dt;
      if (p.onGround || p.coyote > 0 || (p.jumps > 0 && p.jumps < maxJumps)) {
        startJump();
        p.jumpBuffer = 0;
      }
    }
    p.vy += DATA.player.gravity * dt;
    p.y += p.vy * dt;
    if (p.y >= DATA.arena.groundY) {
      p.y = DATA.arena.groundY;
      p.vy = 0;
      p.onGround = true;
      p.jumps = 0;
      p.coyote = DATA.player.coyoteTime;
    } else {
      p.onGround = false;
      p.coyote = Math.max(0, p.coyote - dt);
    }
    clampPlayerX();
  }

  function updateCamera(dt) {
    const target = Logic.clampCamera(state.player.x - DATA.arena.width / 2, state.worldWidth, DATA.arena.width);
    state.cameraX += (target - state.cameraX) * Math.min(1, dt * 8);
  }

  function update(dt) {
    state.time += dt;
    state.shake = Math.max(0, state.shake - dt * 1.4);
    if (state.combo.timer > 0) {
      state.combo.timer -= dt;
      if (state.combo.timer <= 0) state.combo.count = 0;
    }
    if (state.hitstop > 0) {
      state.hitstop -= dt;
      renderHud();
      return;
    }
    updatePlayer(dt);
    updateCamera(dt);
    renderHud();
  }

  function renderHud() {
    const p = state.player;
    hpFill.style.width = `${Math.max(0, p.hp / state.stats.maxHp) * 100}%`;
    hpText.textContent = `${Math.max(0, Math.ceil(p.hp))} / ${state.stats.maxHp}`;
    levelText.textContent = `Lv.${state.level}`;
    xpFill.style.width = `${Math.min(1, state.xp / Logic.xpToNext(state.level)) * 100}%`;
    comboText.textContent = state.combo.count > 1 ? `${state.combo.count} 连击` : '';
    comboText.classList.toggle('show', state.combo.count > 1);
  }

  function render() {
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 26 : 0;
    world.style.transform = `translate3d(${-state.cameraX + shakeX}px, 0, 0)`;
    parallax.forEach(el => {
      el.style.transform = `translate3d(${-state.cameraX * Number(el.dataset.factor) + shakeX * 0.4}px, 0, 0)`;
    });
    const p = state.player;
    playerEl.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -100%)`;
    playerEl.classList.toggle('flip', p.facing < 0);
    playerEl.classList.toggle('invulnerable', state.time < p.invulnUntil || state.time < p.dashIframesUntil);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (state.status === 'playing') update(dt);
    render();
    requestAnimationFrame(frame);
  }

  const GAME_KEYS = new Set(['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyJ', 'KeyK', 'KeyL', 'ShiftLeft', 'ShiftRight', 'KeyP', 'Escape']);
  window.addEventListener('keydown', event => {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space') state.player.jumpBuffer = DATA.player.jumpBuffer;
  });
  window.addEventListener('keyup', event => {
    keys.delete(event.code);
  });
  window.addEventListener('resize', resize);
  window.addEventListener('blur', () => {
    keys.clear();
    state.player.jumpBuffer = 0;
  });

  world.style.width = `${state.worldWidth}px`;
  resize();
  renderHud();
  requestAnimationFrame(frame);
  setTimeout(() => document.getElementById('tipBar').classList.add('hidden'), 8000);

  window.__nailong = { state };
})();
```

- [ ] **Step 4: 验证移动与镜头**

Run: `python -m http.server 4173`
打开 `http://127.0.0.1:4173/action.html?mode=level`，检查：
- 奶龙站在地面上，`A/D`（或方向键）可移动，`空格`可跳跃并落回地面。
- 向右移动时镜头跟随，走到世界末端被限制。
- HUD 显示生命条与「第 1 / 3 段」。
- 控制台无报错；缩放浏览器窗口，舞台保持 16:9 居中。

- [ ] **Step 5: 语法检查**

Run: `node --check action.js`
Expected: 退出码 0。

- [ ] **Step 6: 检查点**

Run: `git status --short`
Expected: 新增 `action.html`、`action.css`、`action.js`。

---

### Task 5: 战斗基础与基础僵尸

**Files:**
- Modify: `action.js`
- Modify: `action.css`

**Interfaces:**
- Consumes: `state`（战斗字段已在 Task 4 一次性初始化）、`Logic.rectsOverlap`、`DATA.player.combo/heavy/dive/fire`、`DATA.enemies.basic`。
- Produces: `spawnEnemy(type, x, overrides?)`、`hurtPlayer(amount)`、`healPlayer(amount)`、`openOverlay(html)`、`closeOverlay()`。
- 任务边界：本任务不实现 `gainXp`（Task 9 在击杀分支接入）。

- [ ] **Step 1: 添加攻击入口**

在 `action.js` 中加入：

```js
function startAttack(index) {
  const p = state.player;
  const step = DATA.player.combo[index];
  p.action = 'attack';
  p.comboIndex = index;
  p.actionWindup = step.windup;
  p.actionTotal = step.windup + step.recover;
  p.actionTimer = 0;
  p.hitResolved = false;
  p.hitIds.clear();
  p.queuedCombo = false;
}

function tryAttack() {
  if (state.status !== 'playing') return;
  const p = state.player;
  if (p.action === 'attack') {
    if (p.onGround && p.comboIndex < 2) p.queuedCombo = true;
    return;
  }
  if (p.action) return;
  if (!p.onGround) { startDive(); return; }
  startAttack(p.comboTimer > 0 ? p.comboIndex : 0);
}
```

- [ ] **Step 2: 实现攻击判定与伤害**

```js
function playerHitbox(range) {
  const p = state.player;
  return {
    x: p.facing > 0 ? p.x + 6 : p.x - range - 6,
    y: p.y - 128,
    w: range,
    h: 128
  };
}

function damageEnemy(enemy, amount, knockback, direction) {
  if (enemy.hp <= 0) return;
  enemy.hp -= amount;
  enemy.hurt = 0.2;
  enemy.x += knockback * enemy.cfg.knockbackResist * direction;
  spawnEffect(`-${Math.round(amount)}`, enemy.x, enemy.y - 130, 'damage-number');
  state.combo.count += 1;
  state.combo.timer = 2;
  state.combo.max = Math.max(state.combo.max, state.combo.count);
  state.hitstop = Math.max(state.hitstop, 0.045);
  state.shake = Math.max(state.shake, 0.14);
  if (enemy.hp <= 0) {
    enemy.dying = 0.4;
    enemy.state = 'dying';
    state.kills += 1;
    if (state.stats.lifesteal > 0) healPlayer(state.stats.lifesteal);
  }
}

function resolveAttackHit(range, damage, knockback) {
  const box = playerHitbox(range);
  const p = state.player;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || p.hitIds.has(enemy.id)) continue;
    const width = 68 * enemy.cfg.scale;
    const height = 118 * enemy.cfg.scale;
    const body = { x: enemy.x - width / 2, y: enemy.y - height, w: width, h: height };
    if (!Logic.rectsOverlap(box, body)) continue;
    p.hitIds.add(enemy.id);
    damageEnemy(enemy, damage, knockback, p.facing);
  }
}
```

- [ ] **Step 3: 实现跳跃、冲刺、重击、喷火**

```js
function startDive() {
  const p = state.player;
  p.action = 'dive';
  p.actionTimer = 0;
  p.hitIds.clear();
  p.queuedCombo = false;
  p.vy = Math.max(p.vy, 420);
}

function tryDash() {
  if (state.status !== 'playing') return;
  const p = state.player;
  if (state.time < p.dashReadyAt || p.action) return;
  p.action = 'dash';
  p.actionTimer = 0;
  p.dashUntil = state.time + DATA.player.dashDuration;
  p.dashIframesUntil = state.time + DATA.player.dashIframes + state.stats.dashIframesBonus;
  p.dashReadyAt = state.time + DATA.player.dashCooldown * state.stats.dashCooldownMul;
}

function tryHeavy() {
  if (state.status !== 'playing') return;
  const p = state.player;
  if (p.action || state.time < p.heavyReadyAt) return;
  p.action = 'heavy';
  p.actionTimer = 0;
  p.hitResolved = false;
  p.hitIds.clear();
  p.queuedCombo = false;
  p.heavyReadyAt = state.time + DATA.player.heavy.cooldown;
}

function tryFire() {
  if (state.status !== 'playing') return;
  const p = state.player;
  if (p.action || state.time < p.fireReadyAt) return;
  p.action = 'fire';
  p.actionTimer = 0;
  p.hitResolved = false;
  p.hitIds.clear();
  p.queuedCombo = false;
  p.fireReadyAt = state.time + DATA.player.fire.cooldown * state.stats.fireCooldownMul;
}

function resolveFireBreath() {
  const p = state.player;
  const fire = DATA.player.fire;
  for (const enemy of [...state.enemies]) {
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - p.x;
    if (Math.abs(dx) > fire.range) continue;
    if (Math.sign(dx) !== p.facing && Math.abs(dx) > 20) continue;
    damageEnemy(enemy, fire.damage * state.stats.fireDamageMul, 30, p.facing);
    if (enemy.hp > 0) {
      enemy.burnUntil = state.time + fire.burnSeconds;
      enemy.burnTick = state.time + 1;
    }
  }
  spawnEffect('', p.x + p.facing * (fire.range / 2), p.y - 70, 'fire-breath', fire.range);
}

function updatePlayerAction(dt) {
  const p = state.player;
  if (p.action === 'attack') {
    p.actionTimer += dt;
    const step = DATA.player.combo[p.comboIndex];
    if (!p.hitResolved && p.actionTimer >= step.windup) {
      p.hitResolved = true;
      const isThird = p.comboIndex === 2;
      const damage = step.damage * state.stats.attackDamageMul * (isThird ? state.stats.thirdHitDamageMul : 1);
      const range = step.range * (isThird ? state.stats.thirdHitRangeMul : 1);
      resolveAttackHit(range, damage, step.knockback);
    }
    if (p.actionTimer >= p.actionTotal) {
      const nextIndex = p.comboIndex + 1;
      const queued = p.queuedCombo && nextIndex < 3;
      p.action = null;
      p.hitResolved = false;
      if (queued) {
        startAttack(nextIndex);
      } else if (nextIndex < 3) {
        p.comboIndex = nextIndex;
        p.comboTimer = DATA.player.comboWindow;
      } else {
        p.comboIndex = 0;
        p.comboTimer = 0;
      }
    }
  } else if (p.action === 'heavy') {
    p.actionTimer += dt;
    if (!p.hitResolved && p.actionTimer >= DATA.player.heavy.windup) {
      p.hitResolved = true;
      resolveAttackHit(
        DATA.player.heavy.range,
        DATA.player.heavy.damage * state.stats.heavyDamageMul,
        DATA.player.heavy.knockback * state.stats.heavyKnockbackMul
      );
    }
    if (p.actionTimer >= DATA.player.heavy.windup + DATA.player.heavy.recover) {
      p.action = null;
      p.hitResolved = false;
    }
  } else if (p.action === 'fire') {
    p.actionTimer += dt;
    if (!p.hitResolved && p.actionTimer >= DATA.player.fire.windup) {
      p.hitResolved = true;
      resolveFireBreath();
    }
    if (p.actionTimer >= DATA.player.fire.windup + 0.35) {
      p.action = null;
      p.hitResolved = false;
    }
  } else if (p.action === 'dive') {
    p.actionTimer += dt;
    if (p.onGround) {
      resolveAttackHit(
        DATA.player.dive.range * state.stats.diveRangeMul,
        DATA.player.dive.damage * state.stats.diveDamageMul,
        DATA.player.dive.knockback
      );
      spawnEffect('', p.x, p.y, 'dirt-burst');
      p.action = null;
    }
  } else if (p.action === 'dash') {
    p.actionTimer += dt;
    p.x += p.facing * DATA.player.dashSpeed * dt;
    clampPlayerX();
    if (state.time >= p.dashUntil) p.action = null;
  }
  if (p.action !== 'attack' && p.comboTimer > 0) {
    p.comboTimer -= dt;
    if (p.comboTimer <= 0) p.comboIndex = 0;
  }
}
```

- [ ] **Step 4: 实现基础僵尸**

```js
function spawnEnemy(type, x, overrides = {}) {
  const cfg = { ...DATA.enemies[type], ...overrides };
  const enemy = {
    id: state.nextId++,
    type,
    cfg,
    x,
    y: DATA.arena.groundY,
    hp: cfg.hp,
    maxHp: cfg.hp,
    state: 'walk',
    windup: cfg.windup,
    cooldown: 0,
    hurt: 0,
    dying: 0,
    burnUntil: 0,
    burnTick: 0,
    el: null
  };
  state.enemies.push(enemy);
  return enemy;
}

function updateEnemy(enemy, dt) {
  if (enemy.hp <= 0) { enemy.dying = Math.max(0, enemy.dying - dt); return; }
  if (enemy.burnUntil > state.time && state.time >= enemy.burnTick) {
    enemy.burnTick += 1;
    damageEnemy(enemy, DATA.player.fire.burnDps, 0, 1);
    if (enemy.hp <= 0) return;
  }
  if (enemy.hurt > 0) {
    enemy.hurt = Math.max(0, enemy.hurt - dt);
    enemy.state = 'hurt';
    return;
  }
  const p = state.player;
  const dx = p.x - enemy.x;
  if (enemy.state === 'windup') {
    enemy.windup -= dt;
    if (enemy.windup <= 0) {
      if (Math.abs(p.x - enemy.x) <= enemy.cfg.range + 12) hurtPlayer(enemy.cfg.damage);
      enemy.windup = enemy.cfg.windup;
      enemy.cooldown = enemy.cfg.interval;
      enemy.state = 'idle';
    }
    return;
  }
  if (Math.abs(dx) <= enemy.cfg.range + 8) {
    enemy.state = 'idle';
    if (enemy.cooldown > 0) {
      enemy.cooldown -= dt;
      return;
    }
    enemy.state = 'windup';
    enemy.windup = enemy.cfg.windup;
    return;
  }
  enemy.state = 'walk';
  enemy.x += Math.sign(dx) * enemy.cfg.speed * dt;
}
```

- [ ] **Step 5: 玩家受伤、死亡与 HUD**

```js
function hurtPlayer(amount) {
  if (state.status !== 'playing') return;
  const p = state.player;
  if (state.time < p.invulnUntil || state.time < p.dashIframesUntil) return;
  p.hp -= amount;
  p.invulnUntil = state.time + DATA.player.hurtIframes;
  playerEl.classList.remove('hurt');
  void playerEl.offsetWidth;
  playerEl.classList.add('hurt');
  state.shake = Math.max(state.shake, 0.2);
  if (p.hp <= 0) loseGame();
}

function healPlayer(amount) {
  state.player.hp = Math.min(state.stats.maxHp, state.player.hp + amount);
}

function openOverlay(html) {
  overlay.innerHTML = html;
  overlay.classList.add('visible');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeOverlay() {
  overlay.innerHTML = '';
  overlay.classList.remove('visible');
  overlay.setAttribute('aria-hidden', 'true');
}

function loseGame() {
  if (state.status !== 'playing') return;
  state.status = 'lost';
  openOverlay(`
    <div class="result-card">
      <span class="eyebrow">本局结束</span>
      <h2>奶龙倒下了</h2>
      <p>到达第 ${Math.min(state.screenIndex + 1, 4)} 屏，击杀 ${state.kills} 只僵尸，最高连击 ${state.combo.max}，达到 Lv.${state.level}。</p>
      <div class="result-actions">
        <button id="retryButton" class="primary-button">重新挑战</button>
        <a class="primary-button ghost" href="index.html">返回主菜单</a>
      </div>
    </div>`);
  document.getElementById('retryButton').addEventListener('click', () => location.reload());
}
```

注意：这里的 `location.reload()` 是 Task 5 的临时重开方式；Task 12 会替换为不刷新页面的 `resetActionGame`。

- [ ] **Step 6: 渲染敌人与特效，接入更新循环**

```js
function pruneEffects() {
  while (effectLayer.childElementCount >= 40) {
    effectLayer.firstElementChild.remove();
  }
}

function spawnEffect(text, x, y, className, width) {
  pruneEffects();
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  if (width) el.style.width = `${width}px`;
  effectLayer.appendChild(el);
  const life = className === 'damage-number' ? 700 : 900;
  setTimeout(() => el.remove(), life);
}

function syncEnemyElements() {
  for (const enemy of state.enemies) {
    if (!enemy.el) {
      const el = document.createElement('div');
      el.className = `enemy ${enemy.type}`;
      el.style.width = `${72 * enemy.cfg.scale}px`;
      el.style.height = `${124 * enemy.cfg.scale}px`;
      el.innerHTML = `<img src="assets/zombie.png" alt="${enemy.cfg.name}"><div class="enemy-hp"><div></div></div>`;
      enemy.el = el;
      enemyLayer.appendChild(el);
    }
    enemy.el.style.transform = `translate3d(${enemy.x}px, ${enemy.y}px, 0) translate(-50%, -100%)`;
    enemy.el.classList.toggle('windup', enemy.state === 'windup' && enemy.windup < 0.3);
    enemy.el.classList.toggle('hurt', enemy.hurt > 0);
    enemy.el.classList.toggle('dying', enemy.dying > 0);
    enemy.el.style.opacity = enemy.dying > 0 ? String(Math.max(0, enemy.dying / 0.4)) : '1';
    enemy.el.querySelector('.enemy-hp > div').style.width = `${Math.max(0, enemy.hp / enemy.maxHp) * 100}%`;
  }
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 && enemy.dying <= 0) {
      enemy.el?.remove();
      enemy.el = null;
    }
  }
  state.enemies = state.enemies.filter(enemy => !(enemy.hp <= 0 && enemy.dying <= 0));
}

function update(dt) {
  state.time += dt;
  state.shake = Math.max(0, state.shake - dt * 1.4);
  if (state.combo.timer > 0) {
    state.combo.timer -= dt;
    if (state.combo.timer <= 0) state.combo.count = 0;
  }
  if (state.hitstop > 0) {
    state.hitstop -= dt;
    renderHud();
    return;
  }
  updatePlayer(dt);
  updatePlayerAction(dt);
  for (const enemy of [...state.enemies]) updateEnemy(enemy, dt);
  syncEnemyElements();
  updateCamera(dt);
  renderHud();
}
```

- [ ] **Step 7: 绑定按键与调试入口**

把 keydown 处理器替换为：

```js
window.addEventListener('keydown', event => {
  if (GAME_KEYS.has(event.code)) event.preventDefault();
  if (event.repeat) return;
  keys.add(event.code);
  if (event.code === 'Space') state.player.jumpBuffer = DATA.player.jumpBuffer;
  if (state.status !== 'playing') return;
  if (event.code === 'KeyJ') tryAttack();
  else if (event.code === 'KeyK') tryHeavy();
  else if (event.code === 'KeyL') tryFire();
  else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') tryDash();
});
```

更新调试入口：

```js
window.__nailong = { state, spawnEnemy, hurtPlayer };
```

- [ ] **Step 8: 补充 CSS**

```css
.enemy { position: absolute; transform-origin: 50% 100%; z-index: 2; }
.enemy img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 8px 7px rgba(45, 70, 40, .22)); }
.enemy.elite img { filter: hue-rotate(310deg) saturate(1.35) drop-shadow(0 8px 7px rgba(120, 40, 20, .3)); }
.enemy.runner img { filter: contrast(1.1) brightness(1.05); }
.enemy.windup img { animation: enemyWindup .25s linear infinite alternate; }
.enemy.dying { pointer-events: none; }
.enemy-hp { position: absolute; left: 50%; top: -12px; width: 70%; height: 6px; transform: translateX(-50%); border-radius: 999px; background: rgba(40, 60, 35, .35); overflow: hidden; }
.enemy-hp > div { height: 100%; width: 100%; background: linear-gradient(90deg, #f0a24e, #d9553f); }
.damage-number { position: absolute; font-weight: 900; font-size: 20px; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,.35); animation: floatUp .7s ease-out forwards; }
.dirt-burst { position: absolute; width: 120px; height: 36px; border-radius: 50%; background: radial-gradient(ellipse, rgba(180,140,90,.55), transparent 70%); transform: translate(-50%, -50%); animation: dustFade .5s ease-out forwards; }
.fire-breath { position: absolute; height: 92px; border-radius: 50%; background: radial-gradient(ellipse at left, rgba(255,196,80,.95), rgba(240,120,50,.5) 55%, transparent 75%); transform: translate(-50%, -50%); animation: fireFade .35s ease-out forwards; }
.result-card { width: min(520px, 82%); padding: 30px 32px; border-radius: 24px; background: #fffdf3; border: 3px solid #e8c184; box-shadow: 0 24px 60px rgba(20,30,18,.35); text-align: center; }
.result-card h2 { margin: 6px 0 12px; color: #355b38; font-size: 30px; }
.result-card p { margin: 0 0 20px; color: #6f7c69; line-height: 1.7; }
.result-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.primary-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 12px 22px; border-radius: 14px; border: 0; background: linear-gradient(180deg, #7fae5a, #5d9147); color: #fff; font-weight: 800; text-decoration: none; cursor: pointer; }
.primary-button:hover { filter: brightness(1.06); }
.primary-button.ghost { background: #fff; color: #4c6a4f; border: 2px solid #dbe4d0; }
.eyebrow { margin: 0; font-size: 12px; letter-spacing: 4px; font-weight: 800; color: #8aa07c; }
@keyframes enemyWindup { from { transform: translateY(0); } to { transform: translateY(-4px); } }
@keyframes floatUp { from { opacity: 1; transform: translate(-50%, 0); } to { opacity: 0; transform: translate(-50%, -36px); } }
@keyframes dustFade { from { opacity: .9; transform: translate(-50%, -50%) scale(.7); } to { opacity: 0; transform: translate(-50%, -50%) scale(1.15); } }
@keyframes fireFade { from { opacity: .95; transform: translate(-50%, -50%) scaleX(.7); } to { opacity: 0; transform: translate(-50%, -50%) scaleX(1.1); } }
```

- [ ] **Step 9: 验证战斗**

打开 `http://127.0.0.1:4173/action.html?mode=level`，在控制台执行：

```js
__nailong.spawnEnemy('basic', 500);
```

检查：
- 僵尸向奶龙走来，靠近后停下并有前摇动作。
- 按 `J` 可三段连击，僵尸掉血、被击退、显示伤害数字，死亡后消失。
- 普攻结束后在 `comboWindow`（0.55s）内再按 `J`，连击从下一段继续；超过窗口则从第一段重新开始。
- 普攻命中后立即按 `K` 或空中 `J`，重击/跳劈也能命中同一只僵尸。
- 按 `K` 重击击退更明显；`L` 喷火命中并持续掉血；`Space` 跳跃中按 `J` 触发跳劈；`Shift` 快速位移。
- 攻击、重击、喷火的动作期间按 `Shift` 不会打断动作，也不消耗冲刺冷却。
- 让僵尸攻击奶龙，生命条下降；生命归零出现失败弹层。
- 控制台无报错。

- [ ] **Step 10: 语法检查**

Run: `node --check action.js`
Expected: 退出码 0。

---

### Task 6: 四种僵尸与精英怪

**Files:**
- Modify: `action.js`
- Modify: `action.css`

**Interfaces:**
- Consumes: `DATA.enemies` 全部条目、`spawnEnemy(type, x, overrides)`、`syncEnemyElements`。
- Produces: `armorMarkup(type)`；`spawnEnemy` 支持 `basic/cone/bucket/runner/elite`（数值早已在 `action-data.js`，本任务只补视觉与类型验证）。
- Task 8 会向 `armorMarkup` 追加 Boss 分支。

- [ ] **Step 1: 添加护甲渲染**

在 `syncEnemyElements` 之前加入：

```js
function armorMarkup(type) {
  if (type === 'cone') return '<div class="armor cone-armor"></div>';
  if (type === 'bucket' || type === 'elite') return '<div class="armor bucket-armor"></div>';
  return '';
}
```

把 `syncEnemyElements` 中创建元素的那一行替换为：

```js
el.innerHTML = `<img src="assets/zombie.png" alt="${enemy.cfg.name}">${armorMarkup(enemy.type)}<div class="enemy-hp"><div></div></div>`;
```

- [ ] **Step 2: 补充护甲 CSS**

```css
.armor { position: absolute; left: 50%; top: -8%; width: 88%; height: 46%; transform: translateX(-50%); pointer-events: none; }
.cone-armor { background: linear-gradient(180deg, #f0a24e 0 45%, #d47a2a 46% 100%); clip-path: polygon(50% 0, 100% 100%, 0 100%); }
.bucket-armor { background: linear-gradient(180deg, #c9d2d8, #8e9aa3 60%, #6f7a82); border-radius: 12px 12px 6px 6px; border: 2px solid #6f7a82; }
.enemy.hurt img { filter: brightness(1.7) saturate(.6); }
```

- [ ] **Step 3: 验证各类型**

控制台依次执行：

```js
['basic', 'cone', 'bucket', 'runner', 'elite'].forEach((type, i) => __nailong.spawnEnemy(type, 420 + i * 130));
```

检查：
- 五种敌人都能显示，路障、铁桶有对应护甲，精英更大且偏红。
- 快速僵尸移动明显更快，铁桶更慢、更耐打。
- 击杀全部后控制台无报错。

- [ ] **Step 4: 语法检查**

Run: `node --check action.js`

---

### Task 7: 三段关卡推进与镜头锁定

**Files:**
- Modify: `action-data.js`
- Modify: `action.js`
- Modify: `action.css`

**Interfaces:**
- Consumes: `DATA.level`（含本任务新增的 `spawnOffset`、`spawnSpacing`、`rightMargin`）、`state`（关卡字段已在 Task 4 初始化）、`spawnEnemy`、`stageLabel`。
- Produces: `startScreen(index)`、`updateLevelFlow()`、`announceWave(text)`；`state.screenIndex`、`state.levelPhase`、`state.spawnQueue`。
- 本任务完成三屏战斗与进入 Boss 庭院；Boss 本体与登场队列在 Task 8 接入。

- [ ] **Step 0: 集中关卡边界数值**

在 `action-data.js` 的 `level` 对象中加入：

```js
spawnOffset: 40,
spawnSpacing: 50,
rightMargin: 80,
```

- `spawnOffset`：敌人出生点距离当前屏右边界的距离。
- `spawnSpacing`：同一批敌人之间的水平间距。
- `rightMargin`：战斗段玩家距屏幕右边界的最小距离（无形屏障）。
- 进入下一屏的触发距离复用 `edgeMargin`，与下一屏左侧钳制距离一致，避免切换瞬间的位移回拉。

- [ ] **Step 1: 镜头按屏锁定**

把 `updateCamera(dt)` 替换为：

```js
function updateCamera(dt) {
  if (state.mode === 'endless') {
    state.cameraX = 0;
    return;
  }
  const target = state.levelPhase === 'advance'
    ? Logic.clampCamera(state.player.x - DATA.arena.width / 2, state.worldWidth, DATA.arena.width)
    : Logic.clampCamera(state.screenIndex * DATA.level.screenWidth, state.worldWidth, DATA.arena.width);
  state.cameraX += (target - state.cameraX) * Math.min(1, dt * 8);
}
```

- 战斗中镜头固定在当前屏左边界。
- 清怪后（`advance`）镜头跟随玩家；进入下一屏时目标切回新屏左边界，镜头平滑过渡。

- [ ] **Step 2: 按屏生成敌人**

在 `updateCamera` 之前加入：

```js
function announceWave(text) {
  stage.querySelectorAll('.wave-announce').forEach(el => el.remove());
  const el = document.createElement('div');
  el.className = 'wave-announce';
  el.textContent = text;
  stage.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

function startScreen(index) {
  state.screenIndex = index;
  state.screenCleared = false;
  state.levelPhase = 'combat';
  state.spawnQueue = [];
  const screen = DATA.level.screens[index];
  const boundary = (index + 1) * DATA.level.screenWidth;
  if (screen.boss) {
    state.levelPhase = 'boss';
    stageLabel.textContent = '僵尸王';
    return;
  }
  let offset = 0;
  screen.batches.forEach(batch => {
    batch.forEach((type, i) => {
      state.spawnQueue.push({
        type,
        x: boundary + DATA.level.spawnOffset + i * DATA.level.spawnSpacing,
        at: state.time + DATA.level.spawnInterval + offset + i * DATA.level.spawnInterval
      });
    });
    offset += DATA.level.batchDelay;
  });
  state.spawnQueue.sort((a, b) => a.at - b.at);
  stageLabel.textContent = `第 ${index + 1} / ${DATA.level.screens.length - 1} 段`;
}
```

- 敌人生成点在当前屏右边界之外，出现时从右侧走入。
- 每批从当前时间起按 `spawnInterval` 依次生成，批与批之间隔 `batchDelay`。
- Boss 屏本任务只切换状态与文案，不生成敌人（Task 8 补上）。

- [ ] **Step 3: 清怪判定与屏障**

在 `startScreen` 之后加入：

```js
function updateLevelFlow() {
  const p = state.player;
  const screen = DATA.level.screens[state.screenIndex];
  const boundary = (state.screenIndex + 1) * DATA.level.screenWidth;

  if (state.levelPhase !== 'advance') {
    const screenStart = state.screenIndex * DATA.level.screenWidth;
    p.x = Math.max(p.x, screenStart + DATA.level.edgeMargin);
    p.x = Math.min(p.x, boundary - DATA.level.rightMargin);
  }

  while (state.spawnQueue.length && state.spawnQueue[0].at <= state.time) {
    const next = state.spawnQueue.shift();
    spawnEnemy(next.type, next.x);
  }

  if (state.levelPhase === 'advance') {
    if (state.screenIndex < DATA.level.screens.length - 1 && p.x >= boundary + DATA.level.edgeMargin) {
      startScreen(state.screenIndex + 1);
    }
    return;
  }

  if (state.levelPhase !== 'combat' || screen.boss) return;

  if (!state.spawnQueue.length && !state.enemies.some(enemy => enemy.hp > 0)) {
    state.screenCleared = true;
    state.levelPhase = 'advance';
    if (state.screenIndex === DATA.level.screens.length - 2) {
      stageLabel.textContent = '前往僵尸王';
      announceWave('前方就是僵尸王');
    } else {
      stageLabel.textContent = '本段清空，继续前进';
      announceWave('本段清空，继续前进');
    }
  }
}
```

说明：
- `levelPhase` 取值：`combat`（战斗，右侧有屏障）、`advance`（本段清空，可前进）、`boss`（Boss 屏）。
- 敌人 `hp <= 0` 即视为已消灭，不需要等待倒地动画结束。
- 最后一屏清空后不再切换，等待 Task 8 的 Boss 登场。

- [ ] **Step 4: 接入更新循环与启动**

`update(dt)` 中，在 `updatePlayerAction(dt);` 之后加入：

```js
if (state.mode === 'level') updateLevelFlow();
```

启动代码块中，在 `renderHud();` 之前加入：

```js
if (state.mode === 'level') startScreen(0);
```

更新调试入口：

```js
window.__nailong = { state, spawnEnemy, hurtPlayer, startScreen };
```

- [ ] **Step 5: 横幅样式**

```css
.wave-announce { position: absolute; left: 50%; top: 32%; z-index: 14; transform: translateX(-50%); font-size: 44px; font-weight: 900; color: #fff; text-shadow: 0 4px 0 rgba(53,85,48,.35); animation: waveIn 1.6s ease forwards; pointer-events: none; }
@keyframes waveIn { 0% { opacity: 0; transform: translate(-50%, 12px) scale(.9); } 18%, 72% { opacity: 1; transform: translate(-50%, 0) scale(1); } 100% { opacity: 0; transform: translate(-50%, -18px) scale(1.04); } }
```

- [ ] **Step 6: 验证三屏推进**

打开 `http://127.0.0.1:4173/action.html?mode=level`：
- 第 1 屏分两批出现 3 普通 + 1 普通 2 路障；未清空时无法越过屏幕右边界。
- 战斗段向左移动或冲刺不会离开当前屏，镜头始终锁定在当前屏。
- 清空后出现「本段清空，继续前进」横幅，屏障解除，镜头随玩家向右。
- 走到第 2、3 屏，敌人配置与 spec 一致（第 2、3 屏各有第三批增援）。
- 第 2、3 屏的第三批在第二批开始 1.2s 后开始生成，不会因为前一批人数多而被压后。
- 第 3 屏清空后出现「前方就是僵尸王」，进入第 4 屏时 HUD 显示「僵尸王」，屏幕暂无敌人。
- 控制台无报错。

- [ ] **Step 7: 语法检查**

Run: `node --check action.js`
Expected: 退出码 0。

---

### Task 8: 僵尸王 Boss

**Files:**
- Modify: `action.js`
- Modify: `action.html`
- Modify: `action.css`

**Interfaces:**
- Consumes: `DATA.boss`、`spawnEnemy`、`hurtPlayer`、`spawnEffect`、`announceWave`、`enemyLayer`。
- Produces: `spawnBoss()`、`updateBoss(boss, dt)`、`createShockwave(x, direction)`、`updateShockwaves(dt)`；`state.boss`、`state.shockwaves`、`boss.dead`。
- 替换 Task 7 中 Boss 屏的空场状态，并把 `armorMarkup` 扩展到 Boss。

- [ ] **Step 1: 添加 Boss 血条与外观**

在 `action.html` 的 `.hud-center` 中、`#comboText` 之后加入：

```html
<div id="bossBar" class="boss-bar"><span>僵尸王</span><div class="boss-track"><div id="bossFill" class="boss-fill"></div></div></div>
```

CSS：

```css
.boss-bar { display: none; margin: 10px auto 0; width: 520px; padding: 8px 12px; border-radius: 14px; background: rgba(60, 30, 24, .72); color: #ffd9c4; font-size: 12px; font-weight: 800; text-align: left; }
.boss-bar.visible { display: block; }
.boss-track { margin-top: 6px; height: 12px; border-radius: 999px; background: rgba(255,255,255,.2); overflow: hidden; }
.boss-fill { height: 100%; width: 100%; background: linear-gradient(90deg, #ff7a4d, #c22c2c); transition: width .12s linear; }
.enemy.boss { z-index: 2; }
.enemy.boss img { filter: drop-shadow(0 10px 12px rgba(60, 20, 16, .4)) saturate(1.05); }
.enemy.boss.phase2 img { filter: drop-shadow(0 0 18px rgba(220, 50, 40, .8)) saturate(1.3) brightness(1.05); }
.enemy.flip img { transform: scaleX(-1); }
.boss-armor { top: 30%; height: 34%; background: linear-gradient(180deg, rgba(90,100,110,.85), rgba(50,58,66,.9)); border: 2px solid #3c444c; border-radius: 14px; }
.boss-crown { position: absolute; left: 50%; top: -20%; width: 54%; height: 24%; transform: translateX(-50%); background: linear-gradient(180deg, #ffe07a, #d9a12c); clip-path: polygon(0 100%, 8% 20%, 30% 62%, 50% 0, 70% 62%, 92% 20%, 100% 100%); }
.stage.boss-phase2::after { content: ""; position: absolute; inset: 0; z-index: 9; pointer-events: none; box-shadow: inset 0 0 90px rgba(150, 20, 20, .55); animation: phase2Pulse 2.4s ease-in-out infinite; }
@keyframes phase2Pulse { 0%, 100% { opacity: .35; } 50% { opacity: .8; } }
```

在 `action.js` 的 DOM 常量区加入：

```js
const bossBar = document.getElementById('bossBar');
const bossFill = document.getElementById('bossFill');
```

- [ ] **Step 2: 生成 Boss 并接入 Boss 屏**

在 `spawnEnemy` 之后加入：

```js
function bossBounds() {
  if (state.mode === 'endless') return { min: DATA.arena.minX, max: DATA.arena.maxX };
  return { min: state.worldWidth - DATA.arena.width + 40, max: state.worldWidth - 90 };
}

function spawnBoss() {
  const cfg = DATA.boss;
  const bounds = bossBounds();
  const boss = {
    id: state.nextId++,
    type: 'boss',
    cfg,
    x: Math.max(bounds.min, Math.min(bounds.max, state.player.x + 700)),
    y: DATA.arena.groundY,
    facing: -1,
    hp: cfg.hp,
    maxHp: cfg.hp,
    state: 'idle',
    action: null,
    actionTimer: 0,
    windup: 0,
    actionResolved: false,
    actionStartX: 0,
    targetX: 0,
    cooldown: 1.2,
    stunUntil: 0,
    phase2: false,
    summonIndex: 0,
    lastAction: null,
    repeatCount: 0,
    chargeDamageDone: false,
    hurt: 0,
    dying: 0,
    dead: false,
    burnUntil: 0,
    burnTick: 0,
    el: null
  };
  state.boss = boss;
  state.enemies.push(boss);
  announceWave('僵尸王登场');
  state.shake = Math.max(state.shake, 0.6);
  return boss;
}
```

把 `startScreen` 的 Boss 分支改为：

```js
if (screen.boss) {
  state.levelPhase = 'boss';
  stageLabel.textContent = '僵尸王';
  state.spawnQueue = [{ boss: true, at: state.time + DATA.level.batchDelay }];
  return;
}
```

把 `updateLevelFlow` 中处理生成队列的循环改为：

```js
while (state.spawnQueue.length && state.spawnQueue[0].at <= state.time) {
  const next = state.spawnQueue.shift();
  if (next.boss) spawnBoss();
  else spawnEnemy(next.type, next.x);
}
```

- [ ] **Step 3: Boss 状态机与招式**

在 `spawnBoss` 之后加入：

```js
function startBossAction(boss, action, windup) {
  boss.action = action;
  boss.actionTimer = 0;
  boss.windup = windup;
  boss.actionResolved = false;
  boss.chargeDamageDone = false;
  boss.actionStartX = boss.x;
  boss.facing = state.player.x >= boss.x ? 1 : -1;
  const bounds = bossBounds();
  boss.targetX = Math.max(bounds.min, Math.min(bounds.max, state.player.x));
  if (action === 'slam') {
    boss.targetX = Math.max(boss.actionStartX - 500, Math.min(boss.actionStartX + 500, boss.targetX));
  }
  boss.state = 'windup';
}

function finishBossAction(boss) {
  boss.action = null;
  boss.actionTimer = 0;
  boss.actionResolved = false;
  boss.chargeDamageDone = false;
  boss.y = DATA.arena.groundY;
  boss.cooldown = DATA.boss.attackInterval * (boss.phase2 ? DATA.boss.phase2IntervalMul : 1);
}

function chooseBossAction(boss) {
  const hpRatio = boss.hp / boss.maxHp;
  if (boss.summonIndex < DATA.boss.summon.thresholds.length &&
      hpRatio <= DATA.boss.summon.thresholds[boss.summonIndex]) {
    boss.summonIndex += 1;
    boss.lastAction = 'summon';
    boss.repeatCount = 1;
    startBossAction(boss, 'summon', DATA.boss.summon.windup);
    return;
  }
  const options = ['charge', 'slam'];
  let pick = options[Math.floor(Math.random() * options.length)];
  if (pick === boss.lastAction && boss.repeatCount >= 2) {
    pick = options.find(option => option !== pick);
  }
  if (pick === boss.lastAction) boss.repeatCount += 1;
  else { boss.lastAction = pick; boss.repeatCount = 1; }
  const reduce = boss.phase2 ? DATA.boss.phase2WindupReduce : 0;
  startBossAction(boss, pick, DATA.boss[pick].windup - reduce);
}

function updateBoss(boss, dt) {
  if (boss.hp <= 0) {
    boss.dying = Math.max(0, boss.dying - dt);
    if (boss.dying <= 0) boss.dead = true;
    return;
  }
  if (boss.burnUntil > state.time && state.time >= boss.burnTick) {
    boss.burnTick += 1;
    damageEnemy(boss, DATA.player.fire.burnDps, 0, 1);
    if (boss.hp <= 0) return;
  }
  if (!boss.phase2 && boss.hp <= boss.maxHp * DATA.boss.phase2At) {
    boss.phase2 = true;
    stage.classList.add('boss-phase2');
    announceWave('僵尸王暴怒');
    state.shake = Math.max(state.shake, 0.5);
  }
  if (boss.hurt > 0) {
    boss.hurt = Math.max(0, boss.hurt - dt);
    boss.state = 'hurt';
    return;
  }
  if (state.time < boss.stunUntil) {
    boss.state = 'stun';
    return;
  }
  boss.cooldown -= dt;
  if (!boss.action) {
    if (boss.cooldown <= 0) {
      chooseBossAction(boss);
      return;
    }
    const dx = state.player.x - boss.x;
    if (Math.abs(dx) > 200) {
      const speed = DATA.boss.speed * (boss.phase2 ? DATA.boss.phase2SpeedMul : 1);
      boss.facing = Math.sign(dx) || boss.facing;
      boss.x += Math.sign(dx) * speed * dt;
      boss.state = 'walk';
    } else {
      boss.state = 'idle';
    }
    return;
  }
  boss.actionTimer += dt;
  if (boss.action === 'charge') {
    if (boss.actionTimer < boss.windup) {
      boss.state = 'windup';
      return;
    }
    const bounds = bossBounds();
    boss.state = 'charge';
    boss.x += DATA.boss.charge.speed * boss.facing * dt;
    boss.x = Math.max(bounds.min, Math.min(bounds.max, boss.x));
    if (!boss.chargeDamageDone && Math.abs(boss.x - state.player.x) < 90) {
      boss.chargeDamageDone = true;
      hurtPlayer(DATA.boss.charge.damage);
      state.shake = Math.max(state.shake, 0.3);
    }
    if ((boss.facing > 0 && boss.x >= bounds.max) || (boss.facing < 0 && boss.x <= bounds.min)) {
      boss.stunUntil = state.time + DATA.boss.charge.stunOnWall;
      finishBossAction(boss);
      return;
    }
    if (boss.actionTimer >= boss.windup + DATA.boss.charge.duration) finishBossAction(boss);
    return;
  }
  if (boss.action === 'slam') {
    const t = Math.min(1, boss.actionTimer / boss.windup);
    boss.x = boss.actionStartX + (boss.targetX - boss.actionStartX) * t;
    boss.y = DATA.arena.groundY - Math.sin(t * Math.PI) * DATA.boss.slam.jumpHeight;
    if (!boss.actionResolved && boss.actionTimer >= boss.windup) {
      boss.actionResolved = true;
      boss.y = DATA.arena.groundY;
      spawnEffect('', boss.x, boss.y, 'dirt-burst');
      state.shake = Math.max(state.shake, 0.45);
      createShockwave(boss.x, -1);
      createShockwave(boss.x, 1);
    }
    if (boss.actionTimer >= boss.windup + DATA.boss.slam.recover) finishBossAction(boss);
    return;
  }
  if (boss.action === 'summon') {
    boss.state = 'summon';
    if (!boss.actionResolved && boss.actionTimer >= boss.windup) {
      boss.actionResolved = true;
      const dir = state.player.x < boss.x ? -1 : 1;
      DATA.boss.summon.adds.forEach((type, index) => {
        spawnEnemy(type, boss.x + dir * (90 + index * 60));
      });
    }
    if (boss.actionTimer >= boss.windup + 0.4) finishBossAction(boss);
  }
}
```

- [ ] **Step 4: 地面震波**

```js
function createShockwave(x, direction) {
  const el = document.createElement('div');
  el.className = 'shockwave';
  enemyLayer.appendChild(el);
  state.shockwaves.push({ x, direction, speed: DATA.boss.slam.waveSpeed, hit: false, el });
}

function updateShockwaves(dt) {
  for (const wave of state.shockwaves) {
    wave.x += wave.speed * wave.direction * dt;
    if (!wave.hit && state.player.onGround && Math.abs(wave.x - state.player.x) < 60) {
      wave.hit = true;
      hurtPlayer(DATA.boss.slam.damage);
    }
    wave.el.style.transform = `translate3d(${wave.x}px, ${DATA.arena.groundY}px, 0) translate(-50%, -100%)`;
    wave.el.classList.toggle('spent', wave.hit);
  }
  state.shockwaves = state.shockwaves.filter(wave => {
    if (wave.x < -100 || wave.x > state.worldWidth + 100) {
      wave.el.remove();
      return false;
    }
    return true;
  });
}
```

CSS：

```css
.shockwave { position: absolute; width: 90px; height: 54px; background: radial-gradient(ellipse at 50% 100%, rgba(255, 214, 140, .95), rgba(214, 138, 62, .55) 55%, transparent 75%); animation: shockPulse .4s ease-in-out infinite alternate; pointer-events: none; }
.shockwave.spent { opacity: .35; }
@keyframes shockPulse { from { filter: brightness(1); } to { filter: brightness(1.25); } }
```

- [ ] **Step 5: 接入渲染与更新循环**

把 `update(dt)` 中的敌人循环替换为：

```js
for (const enemy of [...state.enemies]) {
  if (enemy.type === 'boss') updateBoss(enemy, dt);
  else updateEnemy(enemy, dt);
}
updateShockwaves(dt);
syncEnemyElements();
```

在 `armorMarkup` 中追加 Boss 分支：

```js
if (type === 'boss') return '<div class="armor boss-armor"></div><div class="boss-crown"></div>';
```

在 `syncEnemyElements` 的敌人循环末尾（血条更新之后）追加：

```js
if (enemy.type === 'boss') {
  enemy.el.classList.toggle('phase2', enemy.phase2);
  enemy.el.classList.toggle('charging', enemy.state === 'charge');
}
enemy.el.classList.toggle('flip', enemy.type === 'boss' && enemy.facing < 0);
```

在 `renderHud()` 末尾追加：

```js
if (state.boss && state.boss.hp > 0) {
  bossBar.classList.add('visible');
  bossFill.style.width = `${Math.max(0, state.boss.hp / state.boss.maxHp) * 100}%`;
} else {
  bossBar.classList.remove('visible');
}
```

更新调试入口：

```js
window.__nailong = { state, spawnEnemy, hurtPlayer, startScreen, spawnBoss };
```

- [ ] **Step 6: 验证 Boss**

清完第 3 屏进入 Boss 庭院，等待 1.2 秒：
- Boss 登场时出现横幅与震屏，顶部显示大血条，缓慢逼近。
- 冲撞：前摇后向前冲，命中扣 26 血；撞到屏幕边界后眩晕 0.8 秒。
- 跳砸：跳向玩家当前位置，落地产生左右两道震波；跳跃时不会被震波命中。
- 血量首次低于 60% 与 30% 时各召唤一次 2 普通 + 1 路障；低于 50% 进入二阶段，移动与出招加快、眼睛发红光。
- 击杀后 Boss 倒地消失，血条隐藏；控制台无报错。

- [ ] **Step 7: 语法检查**

Run: `node --check action.js`
Expected: 退出码 0。

---

### Task 9: 局内肉鸽升级

**Files:**
- Modify: `action.js`
- Modify: `action.html`
- Modify: `action.css`

**Interfaces:**
- Consumes: `Logic.xpToNext`、`Logic.rollUpgrades`、`Logic.applyUpgrade`、`DATA.upgrades`、`healPlayer`、`openOverlay/closeOverlay`。
- Produces: `gainXp(amount)`、`openUpgrade()`、`pickUpgrade(id)`、`renderUpgradeChips()`；复用 Task 4 已初始化的 `state.level/xp/pendingLevelUps/ownedUpgrades/upgradeChoices`。
- 不重复初始化等级与经验字段。

- [ ] **Step 1: 击杀获得经验**

把 `damageEnemy` 的死亡分支改为：

```js
if (enemy.hp <= 0) {
  enemy.dying = 0.4;
  enemy.state = 'dying';
  state.kills += 1;
  if (state.stats.lifesteal > 0) healPlayer(state.stats.lifesteal);
  gainXp(enemy.cfg.xp);
}
```

- [ ] **Step 2: 经验与升级弹层**

在 `damageEnemy` 之后加入：

```js
function gainXp(amount) {
  state.xp += amount;
  while (state.xp >= Logic.xpToNext(state.level)) {
    state.xp -= Logic.xpToNext(state.level);
    state.level += 1;
    state.pendingLevelUps += 1;
  }
  if (state.pendingLevelUps > 0 && state.status === 'playing') openUpgrade();
}

function openUpgrade() {
  if (state.status !== 'playing') return;
  state.status = 'upgrading';
  keys.clear();
  state.upgradeChoices = Logic.rollUpgrades(DATA.upgrades, state.ownedUpgrades, 3);
  const cards = state.upgradeChoices.map((id, index) => {
    if (id === 'recover') {
      return `<button class="upgrade-option" data-upgrade="recover"><b>${index + 1}</b><strong>元气恢复</strong><span>回复 30% 最大生命</span></button>`;
    }
    const up = DATA.upgrades.find(item => item.id === id);
    return `<button class="upgrade-option" data-upgrade="${id}"><b>${index + 1}</b><strong>${up.name}</strong><span>${up.desc}</span></button>`;
  }).join('');
  openOverlay(`
    <div class="upgrade-card">
      <span class="eyebrow">LEVEL ${state.level}</span>
      <h2>选择一项强化</h2>
      <div class="upgrade-grid">${cards}</div>
    </div>`);
  overlay.querySelectorAll('[data-upgrade]').forEach(button => {
    button.addEventListener('click', () => pickUpgrade(button.dataset.upgrade));
  });
}
```

- [ ] **Step 3: 应用强化**

```js
function pickUpgrade(id) {
  if (state.status !== 'upgrading') return;
  if (id === 'recover') {
    healPlayer(state.stats.maxHp * 0.3);
  } else {
    const upgrade = DATA.upgrades.find(item => item.id === id);
    if (upgrade) {
      state.stats = Logic.applyUpgrade(state.stats, upgrade);
      state.ownedUpgrades.push(id);
      if (upgrade.apply.maxHpAdd) state.player.hp = state.stats.maxHp;
    }
  }
  state.pendingLevelUps = Math.max(0, state.pendingLevelUps - 1);
  closeOverlay();
  state.status = 'playing';
  renderUpgradeChips();
  if (state.pendingLevelUps > 0) openUpgrade();
}
```

- [ ] **Step 4: 键盘选择**

在 keydown 处理器中，`if (event.repeat) return;` 之后加入：

```js
if (state.status === 'upgrading') {
  if (['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
    const index = Number(event.code.slice(-1)) - 1;
    const id = state.upgradeChoices[index];
    if (id) pickUpgrade(id);
  }
  return;
}
```

这必须位于 `if (state.status !== 'playing') return;` 之前，否则升级状态会直接返回。

- [ ] **Step 5: HUD 强化栏**

`action.html` 的 `.bars` 中、经验条之后加入：

```html
<div id="upgradeChips" class="upgrade-chips"></div>
```

CSS：

```css
.upgrade-chips { display: flex; flex-wrap: wrap; gap: 4px; min-height: 0; }
.upgrade-chip { padding: 2px 7px; border-radius: 999px; background: #dff0d0; color: #456b3c; font-size: 10px; font-weight: 800; }
.upgrade-card { width: min(860px, 86%); padding: 26px; border-radius: 24px; background: #fffdf3; border: 3px solid #e8c184; text-align: center; }
.upgrade-card h2 { margin: 4px 0 18px; color: #355b38; }
.upgrade-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.upgrade-option { display: flex; flex-direction: column; gap: 8px; padding: 20px 16px; border-radius: 18px; border: 2px solid #ecd39a; background: #fff8dd; color: #4b3418; cursor: pointer; text-align: left; }
.upgrade-option:hover { border-color: #d99a3f; transform: translateY(-3px); }
.upgrade-option b { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; background: #7fae5a; color: #fff; }
.upgrade-option strong { font-size: 19px; }
.upgrade-option span { font-size: 13px; line-height: 1.6; color: #806943; }
```

`renderUpgradeChips`：

```js
function renderUpgradeChips() {
  const unique = [...new Set(state.ownedUpgrades)];
  const chips = unique.map(id => {
    const up = DATA.upgrades.find(item => item.id === id);
    const count = state.ownedUpgrades.filter(item => item === id).length;
    return `<span class="upgrade-chip" title="${up.name} ×${count}">${up.name.slice(0, 2)}${count > 1 ? `×${count}` : ''}</span>`;
  });
  document.getElementById('upgradeChips').innerHTML = chips.join('');
}
```

- [ ] **Step 6: 调试入口**

```js
window.__nailong = { state, spawnEnemy, hurtPlayer, startScreen, spawnBoss, gainXp };
```

- [ ] **Step 7: 验证升级**

控制台执行 `__nailong.gainXp(120)`：
- 游戏暂停，出现三张不同强化卡；鼠标与数字键 1/2/3 均可选择。
- 本次经验会连续升 2 级，选择完第一张后弹出第二张。
- 选择「奶量充足」后最大生命 +20 并回满；选择「二段跳」后空中可再跳一次；重复强化叠加。
- HUD 经验条、等级与强化图标更新；控制台无报错。

- [ ] **Step 8: 语法检查**

Run: `node --check action.js`
Expected: 退出码 0。

---

### Task 10: 无尽模式

**Files:**
- Modify: `action.js`

**Interfaces:**
- Consumes: `Logic.waveConfig`、`Logic.scaleEnemy`、`DATA.endless`、`DATA.storageKeys.endlessBest`、`spawnBoss`、`announceWave`。
- Produces: `startWave(wave)`、`updateEndless(dt)`、`finishEndless()`；复用 Task 4 已初始化的 `state.wave/bossCount/intermission`。
- 不重复初始化波次字段。

- [ ] **Step 1: 波次生成与推进**

在 `updateLevelFlow` 之后加入：

```js
function startWave(wave) {
  state.wave = wave;
  state.intermission = 0;
  const cfg = Logic.waveConfig(wave, state.bossCount);
  const types = ['basic', 'cone', 'bucket', 'runner'];
  for (let i = 0; i < cfg.count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    spawnEnemy(type, DATA.arena.width + 80 + i * 70, Logic.scaleEnemy(DATA.enemies[type], cfg));
  }
  if (cfg.hasElite) {
    spawnEnemy('elite', DATA.arena.width + 120, Logic.scaleEnemy(DATA.enemies.elite, cfg));
  }
  if (cfg.hasBoss) {
    const boss = spawnBoss();
    boss.hp = cfg.bossHp;
    boss.maxHp = cfg.bossHp;
    state.bossCount += 1;
  }
  stageLabel.textContent = `第 ${wave} 波`;
  announceWave(`第 ${wave} 波`);
}

function updateEndless(dt) {
  if (state.intermission > 0) {
    state.intermission -= dt;
    if (state.intermission <= 0) startWave(state.wave + 1);
    return;
  }
  if (!state.enemies.some(enemy => enemy.hp > 0)) {
    healPlayer(state.stats.maxHp * DATA.endless.healRatio);
    state.intermission = DATA.endless.rest;
  }
}
```

注意：Boss 在无尽模式中与普通怪同波生成；`spawnBoss` 会把 Boss 限制在 60–1220 内。

- [ ] **Step 2: 接入更新与启动**

`update(dt)` 中的模式分支改为：

```js
if (state.mode === 'level') updateLevelFlow();
else updateEndless(dt);
```

若 Task 7 已写入 `if (state.mode === 'level') startScreen(0);`，用下面的代码整体替换该行：

```js
if (state.mode === 'level') {
  startScreen(0);
} else {
  state.intermission = 1.5;
  stageLabel.textContent = '准备中';
}
```

- [ ] **Step 3: 无尽结算**

```js
function finishEndless() {
  const key = DATA.storageKeys.endlessBest;
  let newRecord = false;
  try {
    const best = JSON.parse(localStorage.getItem(key) || 'null');
    if (!best || state.wave > best.wave) {
      localStorage.setItem(key, JSON.stringify({
        wave: state.wave,
        kills: state.kills,
        date: new Date().toISOString().slice(0, 10)
      }));
      newRecord = true;
    }
  } catch {}
  openOverlay(`
    <div class="result-card">
      <span class="eyebrow">无尽模式</span>
      <h2>${newRecord ? '新纪录！' : '挑战结束'}</h2>
      <p>坚持到第 ${state.wave} 波，击杀 ${state.kills} 只僵尸，最高连击 ${state.combo.max}，达到 Lv.${state.level}。</p>
      <div class="result-actions">
        <button id="retryButton" class="primary-button">再来一局</button>
        <a class="primary-button ghost" href="index.html">返回主菜单</a>
      </div>
    </div>`);
  document.getElementById('retryButton').addEventListener('click', () => location.reload());
}
```

注意：这里的页面重载是临时方案，Task 12 会换成 `resetActionGame`。

把 `loseGame()` 改为模式分流：

```js
function loseGame() {
  if (state.status !== 'playing') return;
  state.status = 'lost';
  keys.clear();
  if (state.mode === 'endless') {
    finishEndless();
    return;
  }
  openOverlay(`
    <div class="result-card">
      <span class="eyebrow">本局结束</span>
      <h2>奶龙倒下了</h2>
      <p>到达第 ${Math.min(state.screenIndex + 1, DATA.level.screens.length)} 屏，击杀 ${state.kills} 只僵尸，最高连击 ${state.combo.max}，达到 Lv.${state.level}。</p>
      <div class="result-actions">
        <button id="retryButton" class="primary-button">重新挑战</button>
        <a class="primary-button ghost" href="index.html">返回主菜单</a>
      </div>
    </div>`);
  document.getElementById('retryButton').addEventListener('click', () => location.reload());
}
```

- [ ] **Step 4: 验证无尽模式**

打开 `http://127.0.0.1:4173/action.html?mode=endless`：
- 1.5 秒后第 1 波开始并显示横幅，敌人从右侧进入；镜头固定。
- 清空一波后回复 15% 生命，3 秒后进入下一波。
- 控制台执行 `__nailong.state.wave = 4; __nailong.state.intermission = 0.1;`，下一波（第 5 波）出现精英。
- 再执行 `__nailong.state.wave = 9; __nailong.state.intermission = 0.1;`，第 10 波出现僵尸王与普通怪。
- 死亡后出现无尽结算；刷新主菜单后无尽入口显示最佳波次。
- 控制台无报错。

- [ ] **Step 5: 语法检查**

Run: `node --check action.js`
Expected: 退出码 0。

---

### Task 11: 音效、技能 HUD、暂停与帮助

**Files:**
- Modify: `action.js`
- Modify: `action.html`
- Modify: `action.css`

**Interfaces:**
- Consumes: `state`、`overlay`、`openOverlay/closeOverlay`、`keys`、`player`。
- Produces: `initAudio()`、`tone()`、`sound(name)`、`updateSoundButton()`、`togglePause()`、`resumeGame()`、`openPauseOverlay()`、`showHelp()`、`updateSkillHud()`。
- 本任务的重开按钮暂用 `location.reload()`，Task 12 接入 `resetActionGame()`。

- [ ] **Step 1: 音效合成**

在 DOM 常量之后加入：

```js
let audioContext;
function initAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
}
function tone(freq, duration, type = 'sine', volume = 0.03, delay = 0) {
  if (!state.sound || !audioContext) return;
  const start = audioContext.currentTime + delay;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(audioContext.destination);
  osc.start(start);
  osc.stop(start + duration);
}
function sound(name) {
  if (!state.sound || !audioContext) return;
  const map = {
    jump: () => tone(420, 0.1, 'sine'),
    swing: () => tone(260, 0.05, 'triangle'),
    hit: () => tone(120, 0.06, 'square', 0.02),
    heavy: () => { tone(90, 0.12, 'sawtooth', 0.03); tone(60, 0.18, 'sawtooth', 0.02, 0.05); },
    fire: () => tone(150, 0.2, 'sawtooth', 0.02),
    dash: () => tone(520, 0.08, 'triangle', 0.015),
    hurt: () => tone(110, 0.15, 'square', 0.02),
    death: () => tone(180, 0.12, 'triangle', 0.02),
    levelup: () => [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'sine', 0.025, i * 0.09)),
    boss: () => tone(70, 0.5, 'sawtooth', 0.04),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'sine', 0.03, i * 0.12)),
    lose: () => [300, 240, 180].forEach((f, i) => tone(f, 0.3, 'triangle', 0.03, i * 0.15))
  };
  map[name]?.();
}
```

- [ ] **Step 2: 在关键节点插入音效**

逐处添加：

| 位置 | 代码 |
| --- | --- |
| `startJump()` 设置速度后 | `sound('jump');` |
| `startAttack()` 末尾 | `sound('swing');` |
| `startDive()` 末尾 | `sound('swing');` |
| `tryDash()` 设置 `dashReadyAt` 后 | `sound('dash');` |
| `tryHeavy()` 设置 `heavyReadyAt` 后 | `sound('heavy');` |
| `tryFire()` 设置 `fireReadyAt` 后 | `sound('fire');` |
| `damageEnemy()` 扣血后 | `if (knockback > 0) sound('hit');` |
| `damageEnemy()` 死亡分支 | `sound('death');` |
| `hurtPlayer()` 扣血后 | `sound('hurt');` |
| `gainXp()` 升级循环内 | `sound('levelup');` |
| `spawnBoss()` 末尾 | `sound('boss');` |

- [ ] **Step 3: 音效开关与暂停按钮**

```js
function updateSoundButton() {
  document.getElementById('soundButton').textContent = state.sound ? '音效开' : '音效关';
}

document.getElementById('soundButton').addEventListener('click', () => {
  state.sound = !state.sound;
  updateSoundButton();
});
document.getElementById('pauseButton').addEventListener('click', togglePause);
updateSoundButton();
```

- [ ] **Step 4: 暂停、帮助与失焦**

```js
function openPauseOverlay() {
  openOverlay(`
    <div class="result-card">
      <span class="eyebrow">休息一下</span>
      <h2>游戏已暂停</h2>
      <div class="result-actions">
        <button id="resumeButton" class="primary-button">继续游戏</button>
        <button id="pauseHelp" class="primary-button ghost">玩法说明</button>
        <button id="pauseRestart" class="primary-button ghost">重新开始</button>
        <a class="primary-button ghost" href="index.html">返回主菜单</a>
      </div>
      <small>Esc 或 P 继续</small>
    </div>`);
  document.getElementById('resumeButton').addEventListener('click', resumeGame);
  document.getElementById('pauseHelp').addEventListener('click', showHelp);
  document.getElementById('pauseRestart').addEventListener('click', () => location.reload());
}

function togglePause() {
  if (state.status === 'playing') {
    state.status = 'paused';
    keys.clear();
    openPauseOverlay();
  } else if (state.status === 'paused') {
    resumeGame();
  }
}

function resumeGame() {
  if (state.status !== 'paused') return;
  state.status = 'playing';
  closeOverlay();
}

function showHelp() {
  state.helpReturn = state.status;
  state.status = 'paused';
  keys.clear();
  openOverlay(`
    <div class="result-card help-card">
      <span class="eyebrow">玩法说明</span>
      <h2>奶龙战僵尸</h2>
      <p>A/D 或方向键移动，空格跳跃（获得二段跳后可再跳一次），J 普攻三连，空中 J 跳劈，K 重击，L 喷火，Shift 冲刺，Esc / P 暂停。</p>
      <p>击杀敌人获得经验，升级时三选一强化。闯关模式三段清怪后挑战僵尸王；无尽模式波次无限增强，每 5 波精英、每 10 波僵尸王。</p>
      <div class="result-actions"><button id="helpClose" class="primary-button">知道了</button></div>
    </div>`);
  document.getElementById('helpClose').addEventListener('click', () => {
    state.helpReturn = null;
    openPauseOverlay();
  });
}

window.addEventListener('blur', () => {
  keys.clear();
  if (state.status === 'playing') togglePause();
});
```

`showHelp` 从暂停界面进入，关闭后回到暂停菜单；Task 12 重开时清空 `helpReturn`。删除 Task 4 中旧的 `window.addEventListener('blur', () => { keys.clear(); });`，避免重复监听。

- [ ] **Step 5: 技能冷却 HUD**

`action.html` 的 `.hud-right` 中、`#soundButton` 之前加入：

```html
<div class="skill-row">
  <span class="skill" id="skillJ">J</span>
  <span class="skill" id="skillK">K</span>
  <span class="skill" id="skillL">L</span>
  <span class="skill" id="skillShift">Shift</span>
</div>
```

CSS：

```css
.skill-row { display: flex; gap: 6px; pointer-events: auto; }
.skill { position: relative; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,248,.86); color: #4c6a4f; font-size: 12px; font-weight: 900; overflow: hidden; }
.skill::after { content: ""; position: absolute; inset: 0; background: rgba(40,60,35,.5); transform: scaleY(var(--ratio, 0)); transform-origin: bottom; }
.skill::before { content: attr(data-cd); position: absolute; z-index: 1; font-size: 12px; }
.skill.cooling::before { color: #fff; }
```

在 DOM 常量区加入：

```js
const skillK = document.getElementById('skillK');
const skillL = document.getElementById('skillL');
const skillShift = document.getElementById('skillShift');
```

```js
function setSkillRatio(el, remaining, total) {
  const ratio = Math.max(0, Math.min(1, remaining / total));
  el.style.setProperty('--ratio', String(ratio));
  el.classList.toggle('cooling', ratio > 0);
  el.dataset.cd = ratio > 0 ? String(Math.ceil(remaining)) : '';
}

function updateSkillHud() {
  const p = state.player;
  document.getElementById('skillJ').style.setProperty('--ratio', '0');
  setSkillRatio(skillK, p.heavyReadyAt - state.time, DATA.player.heavy.cooldown);
  setSkillRatio(skillL, p.fireReadyAt - state.time, DATA.player.fire.cooldown * state.stats.fireCooldownMul);
  setSkillRatio(skillShift, p.dashReadyAt - state.time, DATA.player.dashCooldown * state.stats.dashCooldownMul);
}
```

在 `renderHud()` 末尾调用 `updateSkillHud();`。

- [ ] **Step 6: 键盘接入暂停**

把 keydown 处理器替换为：

```js
window.addEventListener('keydown', event => {
  if (GAME_KEYS.has(event.code)) event.preventDefault();
  if (event.repeat) return;
  initAudio();
  if (event.code === 'Escape' || event.code === 'KeyP') {
    if (state.status === 'playing' || state.status === 'paused') togglePause();
    return;
  }
  if (state.status === 'upgrading') {
    if (['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
      const index = Number(event.code.slice(-1)) - 1;
      const id = state.upgradeChoices[index];
      if (id) pickUpgrade(id);
    }
    return;
  }
  if (state.status !== 'playing') return;
  keys.add(event.code);
  if (event.code === 'Space') state.player.jumpBuffer = DATA.player.jumpBuffer;
  else if (event.code === 'KeyJ') tryAttack();
  else if (event.code === 'KeyK') tryHeavy();
  else if (event.code === 'KeyL') tryFire();
  else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') tryDash();
});
```

再补一个指针监听，保证鼠标玩家也能初始化音频：

```js
window.addEventListener('pointerdown', initAudio);
```

- [ ] **Step 7: 验证**

- 按 `Esc` / `P` 暂停与继续；暂停菜单的帮助可打开并返回暂停菜单。
- 切换标签页或点击窗口外自动暂停。
- 首次按键或点击后音效生效，右上角按钮即时切换「音效开 / 音效关」。
- 技能格显示重击、喷火、冲刺冷却遮罩与剩余秒数。
- 控制台无报错。

- [ ] **Step 8: 语法检查**

Run: `node --check action.js`
Expected: 退出码 0。

---

### Task 12: 胜利结算与无刷新重开

**Files:**
- Modify: `action.js`

**Interfaces:**
- Consumes: `state`、`openOverlay`、`closeOverlay`、`startScreen`、`startWave`、`sound`、`renderUpgradeChips`。
- Produces: `winLevel()`、`resetActionGame()`；替换 Task 10/11 中的 `location.reload()` 与最终胜利判定。

- [ ] **Step 1: 胜利结算**

```js
function winLevel() {
  if (state.status !== 'playing') return;
  state.status = 'won';
  keys.clear();
  const total = Math.floor(state.time);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  openOverlay(`
    <div class="result-card">
      <span class="eyebrow">闯关成功</span>
      <h2>僵尸王被击败了！</h2>
      <p>用时 ${minutes} 分 ${seconds} 秒，击杀 ${state.kills} 只僵尸，最高连击 ${state.combo.max}，达到 Lv.${state.level}。</p>
      <div class="result-actions">
        <button id="retryButton" class="primary-button">再玩一次</button>
        <a class="primary-button ghost" href="index.html">返回主菜单</a>
      </div>
    </div>`);
  document.getElementById('retryButton').addEventListener('click', resetActionGame);
  sound('win');
}
```

- [ ] **Step 2: 胜利判定**

在 `update(dt)` 中、`syncEnemyElements();` 之后加入：

```js
if (state.mode === 'level' && state.levelPhase === 'boss' && state.boss?.dead && state.status === 'playing') {
  state.levelPhase = 'cleared';
  winLevel();
}
```

Boss 在 `updateBoss` 中把 `dying` 降到 0 后设置 `dead = true`；若击杀同时触发升级，会等强化选择完成、状态回到 `playing` 后再结算。

- [ ] **Step 3: 替换临时重开并补失败音效**

在 `loseGame()` 的 `state.status = 'lost';` 之后加入 `sound('lose');`。

把以下三处 `location.reload()` 回调改为 `resetActionGame`：
- `loseGame()` 的闯关失败按钮；
- `finishEndless()` 的「再来一局」按钮；
- `openPauseOverlay()` 的「重新开始」按钮。

- [ ] **Step 4: 重开清理函数**

```js
function resetActionGame() {
  for (const enemy of state.enemies) enemy.el?.remove();
  for (const wave of state.shockwaves) wave.el.remove();
  enemyLayer.innerHTML = '';
  effectLayer.innerHTML = '';
  stage.querySelectorAll('.wave-announce').forEach(el => el.remove());
  stage.classList.remove('boss-phase2');

  state.enemies = [];
  state.shockwaves = [];
  state.boss = null;
  state.spawnQueue = [];
  state.screenIndex = 0;
  state.screenCleared = false;
  state.levelPhase = 'combat';
  state.wave = 0;
  state.bossCount = 0;
  state.intermission = 0;
  state.kills = 0;
  state.combo = { count: 0, timer: 0, max: 0 };
  state.level = 1;
  state.xp = 0;
  state.pendingLevelUps = 0;
  state.ownedUpgrades = [];
  state.upgradeChoices = [];
  state.time = 0;
  state.cameraX = 0;
  state.shake = 0;
  state.hitstop = 0;
  state.status = 'playing';
  state.helpReturn = null;
  state.stats = { ...DATA.player.baseStats };

  state.player = createPlayer(state.mode);

  playerEl.classList.remove('hurt', 'invulnerable', 'flip');
  keys.clear();
  closeOverlay();
  updateSoundButton();
  if (state.mode === 'level') {
    startScreen(0);
  } else {
    state.intermission = 1.5;
    stageLabel.textContent = '准备中';
  }
  renderUpgradeChips();
  renderHud();
}
```

- [ ] **Step 5: 更新调试入口**

```js
window.__nailong = { state, spawnEnemy, hurtPlayer, startScreen, spawnBoss, gainXp, resetActionGame };
```

- [ ] **Step 6: 验证结算与清理**

- 击败 Boss 出现胜利结算（用时、击杀、最高连击、等级）；「再玩一次」不刷新页面直接回到第 1 屏。
- 闯关失败与无尽失败分别显示对应结算；两个重开按钮均不刷新页面。
- 暂停菜单「重新开始」等效。
- 连续重开 3 次后执行：
  ```js
  document.querySelectorAll('.enemy').length + document.querySelectorAll('.shockwave').length + document.querySelectorAll('.wave-announce').length
  ```
  返回值应为 0（不计当前局正在播放的横幅），且不随重开次数增长。
- 控制台无报错。

- [ ] **Step 7: 语法检查**

Run: `node --check action.js`
Expected: 退出码 0。

---

### Task 13: README 更新与完整回归

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README**

必须更新：
- 项目结构表：新增 `index.html` / `menu.css` / `menu.js` / `game.html` / `action.html` / `action.css` / `action-data.js` / `action-logic.js` / `action.js` / `tests/`。
- 启动方式：双击 `启动游戏.bat` 打开主菜单；两种模式入口。
- 「奶龙战僵尸」操作表：A/D、空格、J/K/L、Shift、Esc。
- 模式说明：闯关三段 + 僵尸王；无尽波次、每 5 波精英、每 10 波 Boss；肉鸽三选一强化。
- 当前进度表新增两行：主菜单已完成、奶龙模式已完成；保留手机适配未开始。
- 验证结果更新：单元测试、两模式实测、菜单往返、控制台无报错。

- [ ] **Step 2: 全量语法检查**

Run:
```bash
node --check menu.js
node --check action-data.js
node --check action-logic.js
node --check action.js
node --check game.js
```
Expected: 全部退出码 0。

- [ ] **Step 3: 单元测试**

Run: `node --test tests/action-logic.test.js`
Expected: 6 个测试全部 PASS。

- [ ] **Step 4: 完整浏览器回归**

Run: `python -m http.server 4173`

逐项检查并记录结果：
1. 主菜单加载、两个模式入口、帮助弹层、`Esc` 关闭。
2. 冒险模式：进入 `game.html` 可开始、种植、收集、出怪、暂停、返回菜单。
3. 奶龙闯关：移动/跳跃/三段普攻/跳劈/重击/喷火/冲刺；三屏清怪；Boss 三招、召唤、二阶段；胜利结算；重开；回菜单。
4. 奶龙无尽：波次推进、每 5 波精英、每 10 波 Boss、波间回血、死亡结算、最佳记录写入并在主菜单显示。
5. 升级：击杀升级、三选一、键盘 1/2/3、强化叠加、HUD 更新。
6. 暂停、失焦暂停、音效开关。
7. 控制台无报错、无 404；连续重开后 DOM 节点稳定。
8. 桌面窗口缩放到 1024 宽仍可操作，舞台保持 16:9。

- [ ] **Step 5: 检查点**

Run: `git status --short`
Expected: 所有新增/修改文件齐全，未提交。

---

## 计划自检

- 覆盖 spec：
  - 主菜单、页面迁移与导航：Task 2、Task 3。
  - 动作模式舞台、移动、跳跃、镜头：Task 4、Task 7。
  - 三段战斗、四类敌人与精英：Task 5、Task 6、Task 7。
  - 僵尸王 Boss、震波、二阶段：Task 8。
  - 肉鸽升级：Task 9。
  - 无尽模式与最佳记录：Task 10。
  - HUD、暂停、帮助、音效：Task 11。
  - 胜负结算与无刷新重开：Task 12。
  - README 与完整回归：Task 13。
- 状态初始化只在 Task 4（首局）与 Task 12（重开）出现；Task 7–10 只读取/更新字段，不重复声明。
- 类型一致性：`spawnEnemy(type, x, overrides)`、`updateBoss(boss, dt)`、`startScreen(index)`、`gainXp(amount)`、`resetActionGame()` 在任务间保持同名同参。
- 依赖顺序：`announceWave` 在 Task 7 定义，Task 8/10 复用；`spawnBoss` 在 Task 8 定义，Task 10 复用；`sound` 在 Task 11 定义，Task 12 调用。
- 临时 `location.reload()` 只存在于 Task 5/10/11 的中间状态；Task 12 一次性替换为 `resetActionGame()`，按任务顺序执行不会留下临时代码。
- 无占位符：所有关键逻辑给出完整代码；纯样式按 spec 视觉规范与已给规则补全。
- 未安排 git commit，符合仓库规则。
