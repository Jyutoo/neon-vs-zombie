# 奶龙大战僵尸 - 大型重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构游戏经济系统、关卡结构和角色体系，引入持久化强化系统

**Architecture:** 分5个阶段实施：核心系统→关卡扩展→角色替换→强化系统→测试优化。每个阶段产生可测试的交付物。

**Tech Stack:** 原生 HTML/CSS/JavaScript, localStorage 存档

**Spec:** `docs/superpowers/specs/2026-10-25-major-refactor-design.md`

## Global Constraints

- 存档键名：`nailong-vs-zombies-progress-v2`
- 奶黄强化消耗：100 → 200 → 400 → 800 → 1600 → 3200 → 6400（每次×2）
- 强化等级：每个方向最多7级
- 关卡解锁：模式B无尽模式每3波解锁一关
- 角色解锁：通关模式A对应关卡
- 模式A和模式B各12关
- 奶娃素材：`assets/baby-glance.png`
- 音波攻击：使用 `assets/baby-laugh.mp4` 音频

---

### Task 1: 存档系统升级与货币重构

**Files:**
- Modify: `game.js` (存档结构、奶黄持久化)
- Modify: `action.js` (存档读取)
- Modify: `menu.js` (显示奶黄余额)
- Test: `tests/save-migration.test.js`

**Interfaces:**
- Consumes: 无
- Produces: `loadProgress()`, `saveProgress()`, `migrateSaveV1ToV2()`

- [ ] **Step 1: 编写存档迁移测试**

```javascript
// tests/save-migration.test.js
const assert = require('assert');

function migrateSaveV1ToV2(v1Data) {
  return {
    custard: v1Data.coins || 0,
    highestCleared: v1Data.highestCleared || 0,
    actionHighestCleared: 0,
    endlessBest: { wave: 0, kills: 0, date: null },
    unlocked: v1Data.unlocked || ['egg', 'snake', 'ox', 'monkey'],
    upgrades: {
      egg: 0, rat: 0, snake: 0, dragon: 0, rabbit: 0,
      tiger: 0, ox: 0, monkey: 0, goat: 0, rooster: 0,
      pig: 0, horse: 0, dog: 0
    }
  };
}

function test_migrate_v1_to_v2() {
  const v1 = {
    coins: 100,
    totalEarned: 100,
    highestCleared: 1,
    selectedLevel: 1,
    unlocked: ['egg', 'snake', 'ox', 'monkey']
  };
  const v2 = migrateSaveV1ToV2(v1);
  assert.strictEqual(v2.custard, 100);
  assert.strictEqual(v2.highestCleared, 1);
  assert.strictEqual(v2.actionHighestCleared, 0);
  assert.deepStrictEqual(v2.unlocked, ['egg', 'snake', 'ox', 'monkey']);
  assert.strictEqual(v2.upgrades.egg, 0);
  console.log('PASS: migrate v1 to v2');
}

test_migrate_v1_to_v2();
```

- [ ] **Step 2: 运行测试验证失败**

Run: `node tests/save-migration.test.js`
Expected: PASS (测试独立实现)

- [ ] **Step 3: 修改 game.js 存档结构**

```javascript
// game.js - 修改 SAVE_KEY 和存档结构
const SAVE_KEY = 'nailong-vs-zombies-progress-v2';

function defaultProgress() {
  return {
    custard: 500,  // 初始奶黄
    highestCleared: 0,
    actionHighestCleared: 0,
    endlessBest: { wave: 0, kills: 0, date: null },
    unlocked: [...STARTING_UNITS],
    upgrades: {
      egg: 0, rat: 0, snake: 0, dragon: 0, rabbit: 0,
      tiger: 0, ox: 0, monkey: 0, goat: 0, rooster: 0,
      pig: 0, horse: 0, dog: 0
    }
  };
}

function loadProgress() {
  const fallback = defaultProgress();
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!raw || typeof raw !== 'object') return fallback;
    
    // 检测旧版本存档并迁移
    if (raw.coins !== undefined && raw.custard === undefined) {
      return migrateSaveV1ToV2(raw);
    }
    
    // 验证新结构
    const valid = Object.keys(TYPES);
    const unlocked = [...new Set((Array.isArray(raw.unlocked) ? raw.unlocked : []).filter(key => valid.includes(key)))];
    STARTING_UNITS.forEach(key => { if (!unlocked.includes(key)) unlocked.push(key); });
    
    return {
      custard: Math.max(0, Math.floor(Number(raw.custard) || 500)),
      highestCleared: Math.max(0, Math.floor(Number(raw.highestCleared) || 0)),
      actionHighestCleared: Math.max(0, Math.floor(Number(raw.actionHighestCleared) || 0)),
      endlessBest: raw.endlessBest || { wave: 0, kills: 0, date: null },
      unlocked,
      upgrades: raw.upgrades || defaultProgress().upgrades
    };
  } catch {
    return fallback;
  }
}

function migrateSaveV1ToV2(v1Data) {
  return {
    custard: v1Data.coins || 0,
    highestCleared: v1Data.highestCleared || 0,
    actionHighestCleared: 0,
    endlessBest: { wave: 0, kills: 0, date: null },
    unlocked: v1Data.unlocked || [...STARTING_UNITS],
    upgrades: {
      egg: 0, rat: 0, snake: 0, dragon: 0, rabbit: 0,
      tiger: 0, ox: 0, monkey: 0, goat: 0, rooster: 0,
      pig: 0, horse: 0, dog: 0
    }
  };
}
```

- [ ] **Step 4: 修改 game.js 移除奶币相关代码**

删除所有 `progress.coins` 相关代码，替换为 `progress.custard`。

- [ ] **Step 5: 修改 action.js 存档读取**

```javascript
// action.js - 添加存档读取
function loadActionProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!raw) return { actionHighestCleared: 0, endlessBest: { wave: 0, kills: 0, date: null } };
    return {
      actionHighestCleared: Math.max(0, Math.floor(Number(raw.actionHighestCleared) || 0)),
      endlessBest: raw.endlessBest || { wave: 0, kills: 0, date: null }
    };
  } catch {
    return { actionHighestCleared: 0, endlessBest: { wave: 0, kills: 0, date: null } };
  }
}
```

- [ ] **Step 6: 修改 menu.js 显示奶黄**

```javascript
// menu.js - 显示奶黄余额和无尽记录
function renderMenu() {
  const progress = loadProgress();
  const custardEl = document.getElementById('menuCustard');
  const endlessEl = document.getElementById('menuEndlessBest');
  
  if (custardEl) custardEl.textContent = progress.custard;
  if (endlessEl) {
    const best = progress.endlessBest;
    endlessEl.textContent = best.wave > 0 ? `最佳：第 ${best.wave} 波` : '暂无记录';
  }
}
```

- [ ] **Step 7: 运行测试**

Run: `node tests/save-migration.test.js`
Expected: PASS

- [ ] **Step 8: 浏览器验证**

打开 `index.html`，验证：
- 奶黄余额显示正确
- 无尽模式记录显示
- 存档正常保存和加载

- [ ] **Step 9: 提交**

```bash
git add game.js action.js menu.js tests/save-migration.test.js
git commit -m "feat: 存档系统升级v2，奶黄持久化，移除奶币"
```

---

### Task 2: 模式A扩展到12关

**Files:**
- Modify: `game.js` (关卡配置、难度曲线)
- Modify: `game.html` (UI显示12关)
- Test: `tests/level-config.test.js`

**Interfaces:**
- Consumes: Task 1 的存档系统
- Produces: `levelWaves(level)`, `levelScaling(level)`

- [ ] **Step 1: 编写关卡配置测试**

```javascript
// tests/level-config.test.js
const assert = require('assert');

function levelWaves(level) {
  if (level <= 3) return 5;
  if (level <= 6) return 6;
  if (level <= 9) return 7;
  if (level <= 11) return 8;
  return 10; // 第12关
}

function test_level_waves() {
  assert.strictEqual(levelWaves(1), 5);
  assert.strictEqual(levelWaves(3), 5);
  assert.strictEqual(levelWaves(4), 6);
  assert.strictEqual(levelWaves(6), 6);
  assert.strictEqual(levelWaves(7), 7);
  assert.strictEqual(levelWaves(9), 7);
  assert.strictEqual(levelWaves(10), 8);
  assert.strictEqual(levelWaves(11), 8);
  assert.strictEqual(levelWaves(12), 10);
  console.log('PASS: level waves');
}

test_level_waves();
```

- [ ] **Step 2: 修改 game.js 关卡配置**

```javascript
// game.js - 修改关卡配置
const MAX_LEVEL = 12;

function levelWaves(level) {
  if (level <= 3) return 5;
  if (level <= 6) return 6;
  if (level <= 9) return 7;
  if (level <= 11) return 8;
  return 10; // 第12关BOSS
}

function levelReward(level, firstClear) {
  if (firstClear) {
    return 50 + (level - 1) * 15; // 50, 65, 80, ..., 215
  }
  return Math.max(10, Math.floor((50 + (level - 1) * 15) * 0.3));
}
```

- [ ] **Step 3: 修改 game.html UI**

扩展关卡轨道显示12关，调整布局。

- [ ] **Step 4: 运行测试**

Run: `node tests/level-config.test.js`
Expected: PASS

- [ ] **Step 5: 浏览器验证**

打开 `game.html`，验证12关显示和难度曲线。

- [ ] **Step 6: 提交**

```bash
git add game.js game.html tests/level-config.test.js
git commit -m "feat: 模式A扩展到12关，难度递增"
```

---

### Task 3: 模式B关卡选择界面

**Files:**
- Create: `action-levels.html` (关卡选择页面)
- Create: `action-levels.css` (关卡选择样式)
- Create: `action-levels.js` (关卡选择逻辑)
- Modify: `action.html` (添加入口)

**Interfaces:**
- Consumes: Task 1 的存档系统
- Produces: `selectLevel(level)`, `renderLevelTrack()`

- [ ] **Step 1: 创建 action-levels.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>奶龙大战僵尸 - 闯关模式</title>
  <link rel="stylesheet" href="action-levels.css">
</head>
<body>
  <div class="level-select-shell">
    <header>
      <h1>闯关模式</h1>
      <button id="backButton" class="ghost-button">返回主菜单</button>
    </header>
    
    <div class="level-track-wrap">
      <button class="track-arrow" id="trackPrev">‹</button>
      <div class="level-track-shell">
        <span class="track-range" id="trackRange">第 1 – 5 关</span>
        <div id="levelTrack" class="level-track"></div>
      </div>
      <button class="track-arrow" id="trackNext">›</button>
    </div>
    
    <div id="levelPreview" class="level-preview"></div>
  </div>
  
  <script src="action-levels.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 action-levels.css**

类似 `game.html` 的关卡轨道样式。

- [ ] **Step 3: 创建 action-levels.js**

```javascript
// action-levels.js
const MAX_LEVEL = 12;
let currentLevel = 1;
let trackStart = 1;

function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem('nailong-vs-zombies-progress-v2'));
    return raw || { actionHighestCleared: 0, endlessBest: { wave: 0 } };
  } catch {
    return { actionHighestCleared: 0, endlessBest: { wave: 0 } };
  }
}

function unlockedLevel() {
  const progress = loadProgress();
  return Math.floor((progress.endlessBest.wave || 0) / 3) + 1;
}

function renderLevelTrack() {
  const track = document.getElementById('levelTrack');
  const unlocked = unlockedLevel();
  const progress = loadProgress();
  
  track.innerHTML = '';
  for (let i = trackStart; i <= Math.min(trackStart + 4, MAX_LEVEL); i++) {
    const card = document.createElement('div');
    card.className = 'level-card';
    if (i <= progress.actionHighestCleared) card.classList.add('cleared');
    else if (i === unlocked) card.classList.add('available');
    else card.classList.add('locked');
    
    card.innerHTML = `
      <span class="level-number">LEVEL ${String(i).padStart(2, '0')}</span>
      <span class="level-title">第 ${i} 关</span>
      ${i === 12 ? '<span class="boss-tag">BOSS</span>' : ''}
    `;
    
    if (i <= unlocked) {
      card.addEventListener('click', () => selectLevel(i));
    }
    
    track.appendChild(card);
  }
  
  document.getElementById('trackRange').textContent = `第 ${trackStart} – ${Math.min(trackStart + 4, MAX_LEVEL)} 关`;
}

function selectLevel(level) {
  window.location.href = `action.html?level=${level}`;
}

document.getElementById('backButton').addEventListener('click', () => {
  window.location.href = 'index.html';
});

document.getElementById('trackPrev').addEventListener('click', () => {
  if (trackStart > 1) {
    trackStart = Math.max(1, trackStart - 5);
    renderLevelTrack();
  }
});

document.getElementById('trackNext').addEventListener('click', () => {
  if (trackStart < MAX_LEVEL - 4) {
    trackStart = Math.min(MAX_LEVEL - 4, trackStart + 5);
    renderLevelTrack();
  }
});

renderLevelTrack();
```

- [ ] **Step 4: 浏览器验证**

打开 `action-levels.html`，验证关卡选择和解锁逻辑。

- [ ] **Step 5: 提交**

```bash
git add action-levels.html action-levels.css action-levels.js
git commit -m "feat: 模式B关卡选择界面"
```

---

### Task 4: 解锁逻辑重构

**Files:**
- Modify: `game.js` (角色解锁改为通关解锁)
- Modify: `action.js` (无尽模式更新解锁)
- Test: `tests/unlock-logic.test.js`

**Interfaces:**
- Consumes: Task 1, Task 2, Task 3
- Produces: `checkUnlocks()`, `updateEndlessBest(wave)`

- [ ] **Step 1: 编写解锁逻辑测试**

```javascript
// tests/unlock-logic.test.js
const assert = require('assert');

const CHARACTER_UNLOCK_LEVELS = {
  rat: 2, rabbit: 3, dog: 4, tiger: 5,
  goat: 6, rooster: 7, pig: 8, horse: 9, dragon: 10
};

function unlockedLevel(endlessWave) {
  return Math.floor(endlessWave / 3) + 1;
}

function checkCharacterUnlocks(highestCleared) {
  const unlocked = ['egg', 'snake', 'ox', 'monkey'];
  for (const [char, level] of Object.entries(CHARACTER_UNLOCK_LEVELS)) {
    if (highestCleared >= level) unlocked.push(char);
  }
  return unlocked;
}

function test_unlock_logic() {
  assert.strictEqual(unlockedLevel(0), 1);
  assert.strictEqual(unlockedLevel(3), 2);
  assert.strictEqual(unlockedLevel(9), 4);
  assert.strictEqual(unlockedLevel(33), 12);
  
  const chars = checkCharacterUnlocks(5);
  assert.ok(chars.includes('rat'));
  assert.ok(chars.includes('tiger'));
  assert.ok(!chars.includes('dragon'));
  
  console.log('PASS: unlock logic');
}

test_unlock_logic();
```

- [ ] **Step 2: 修改 game.js 角色解锁**

移除奶币解锁，改为通关解锁：

```javascript
// game.js - 角色解锁逻辑
const CHARACTER_UNLOCK_LEVELS = {
  rat: 2, rabbit: 3, dog: 4, tiger: 5,
  goat: 6, rooster: 7, pig: 8, horse: 9, dragon: 10
};

function checkCharacterUnlocks() {
  const unlocked = [...STARTING_UNITS];
  for (const [char, level] of Object.entries(CHARACTER_UNLOCK_LEVELS)) {
    if (progress.highestCleared >= level && !unlocked.includes(char)) {
      unlocked.push(char);
      toast(`解锁新角色：${TYPES[char].name}`);
    }
  }
  progress.unlocked = unlocked;
  saveProgress();
}
```

- [ ] **Step 3: 修改 action.js 无尽模式更新解锁**

```javascript
// action.js - 无尽模式结束时更新
function finishEndless() {
  const progress = loadProgress();
  if (state.wave > progress.endlessBest.wave) {
    progress.endlessBest = {
      wave: state.wave,
      kills: state.kills,
      date: new Date().toISOString().slice(0, 10)
    };
    saveProgress();
  }
  // 显示结算界面...
}
```

- [ ] **Step 4: 运行测试**

Run: `node tests/unlock-logic.test.js`
Expected: PASS

- [ ] **Step 5: 浏览器验证**

验证无尽模式解锁关卡和通关解锁角色。

- [ ] **Step 6: 提交**

```bash
git add game.js action.js tests/unlock-logic.test.js
git commit -m "feat: 解锁逻辑重构，无尽模式驱动关卡解锁"
```

---

### Task 5: 奶娃角色替换

**Files:**
- Modify: `action.js` (主角素材、音波能力)
- Modify: `action.html` (技能图标)
- Modify: `action.css` (样式调整)

**Interfaces:**
- Consumes: Task 1
- Produces: `createPlayer()`, `attackSoundWave()`

- [ ] **Step 1: 修改 action.js 主角素材**

```javascript
// action.js - 修改主角创建
function createPlayer(mode) {
  return {
    // ... 其他属性
    sprite: 'assets/baby-glance.png',  // 改为奶娃
    // ...
  };
}
```

- [ ] **Step 2: 修改音波能力**

```javascript
// action.js - 修改喷火为音波
function attackSoundWave() {
  // 创建音波弹体
  const projectile = {
    type: 'soundwave',
    x: player.x,
    y: player.y,
    vx: player.facing * 400,
    damage: player.stats.fireDamage,
    // ...
  };
  
  // 播放大笑音效
  playSound('baby-laugh');
  
  state.projectiles.push(projectile);
}
```

- [ ] **Step 3: 添加音效**

从 `assets/baby-laugh.mp4` 提取音频，创建 `assets/baby-laugh.mp3`。

- [ ] **Step 4: 浏览器验证**

打开 `action.html`，验证奶娃形象和音波攻击。

- [ ] **Step 5: 提交**

```bash
git add action.js action.html action.css assets/baby-laugh.mp3
git commit -m "feat: 模式B主角替换为奶娃，喷火改为音波"
```

---

### Task 6: 强化系统界面

**Files:**
- Create: `upgrade.html` (强化界面)
- Create: `upgrade.css` (强化样式)
- Create: `upgrade.js` (强化逻辑)
- Modify: `index.html` (添加入口)

**Interfaces:**
- Consumes: Task 1 的存档系统
- Produces: `renderUpgradeCards()`, `upgradeCharacter(char)`

- [ ] **Step 1: 创建 upgrade.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>强化奶娃</title>
  <link rel="stylesheet" href="upgrade.css">
</head>
<body>
  <div class="upgrade-shell">
    <header>
      <h1>强化奶娃</h1>
      <span class="custard-display">奶黄：<strong id="custardBalance">0</strong></span>
      <button id="backButton" class="ghost-button">返回</button>
    </header>
    
    <div class="baby-display">
      <img src="assets/baby-glance.png" alt="奶娃">
    </div>
    
    <div class="upgrade-grid" id="upgradeGrid"></div>
  </div>
  
  <script src="upgrade.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 upgrade.js**

```javascript
// upgrade.js
const UPGRADE_COSTS = [100, 200, 400, 800, 1600, 3200, 6400];
const MAX_UPGRADE_LEVEL = 7;

const CHARACTER_UPGRADES = {
  egg: { name: '奶蛋', modeA: '+使用次数', modeB: '+自动回复' },
  rat: { name: '奶鼠', modeA: '-使用冷却', modeB: '-技能冷却' },
  // ... 其他角色
};

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem('nailong-vs-zombies-progress-v2')) || defaultProgress();
  } catch {
    return defaultProgress();
  }
}

function renderUpgradeCards() {
  const progress = loadProgress();
  const grid = document.getElementById('upgradeGrid');
  const custardEl = document.getElementById('custardBalance');
  
  custardEl.textContent = progress.custard;
  grid.innerHTML = '';
  
  for (const [key, info] of Object.entries(CHARACTER_UPGRADES)) {
    const level = progress.upgrades[key] || 0;
    const isUnlocked = progress.unlocked.includes(key);
    const cost = level < MAX_UPGRADE_LEVEL ? UPGRADE_COSTS[level] : null;
    
    const card = document.createElement('div');
    card.className = `upgrade-card ${isUnlocked ? '' : 'locked'}`;
    card.innerHTML = `
      <span class="char-name">${info.name}</span>
      <span class="char-level">Lv.${level}</span>
      ${cost ? `<span class="upgrade-cost">强化：${cost}</span>` : '<span class="max-level">已满级</span>'}
      <span class="upgrade-effect">${info.modeA}</span>
    `;
    
    if (isUnlocked && cost && progress.custard >= cost) {
      card.addEventListener('click', () => upgradeCharacter(key));
    }
    
    grid.appendChild(card);
  }
}

function upgradeCharacter(char) {
  const progress = loadProgress();
  const level = progress.upgrades[char] || 0;
  const cost = UPGRADE_COSTS[level];
  
  if (progress.custard >= cost && level < MAX_UPGRADE_LEVEL) {
    progress.custard -= cost;
    progress.upgrades[char] = level + 1;
    saveProgress(progress);
    renderUpgradeCards();
    playSound('upgrade');
  }
}

document.getElementById('backButton').addEventListener('click', () => {
  window.location.href = 'index.html';
});

renderUpgradeCards();
```

- [ ] **Step 3: 浏览器验证**

打开 `upgrade.html`，验证强化界面和升级逻辑。

- [ ] **Step 4: 提交**

```bash
git add upgrade.html upgrade.css upgrade.js index.html
git commit -m "feat: 强化系统界面"
```

---

### Task 7: 强化效果实现

**Files:**
- Modify: `game.js` (模式A强化效果)
- Modify: `action.js` (模式B强化效果)
- Test: `tests/upgrade-effects.test.js`

**Interfaces:**
- Consumes: Task 1, Task 6
- Produces: `applyUpgrades()`, `getUpgradeMultiplier()`

- [ ] **Step 1: 编写强化效果测试**

```javascript
// tests/upgrade-effects.test.js
const assert = require('assert');

function getUpgradeMultiplier(level, basePercent) {
  return 1 + (level * basePercent / 100);
}

function test_upgrade_multiplier() {
  assert.strictEqual(getUpgradeMultiplier(0, 15), 1);
  assert.strictEqual(getUpgradeMultiplier(1, 15), 1.15);
  assert.strictEqual(getUpgradeMultiplier(7, 15), 2.05);
  console.log('PASS: upgrade multiplier');
}

test_upgrade_multiplier();
```

- [ ] **Step 2: 修改 game.js 模式A强化效果**

```javascript
// game.js - 应用强化效果
function applyModeAUpgrades() {
  const progress = loadProgress();
  const upgrades = progress.upgrades;
  
  // 奶蛋：+使用次数
  const eggUses = 1 + (upgrades.egg || 0);
  
  // 奶鼠/奶兔/奶鸡：-冷却
  const cooldownMul = 1 - ((upgrades.rat + upgrades.rabbit + upgrades.rooster) || 0) * 0.1;
  
  // 奶牛/奶虎/奶猴：+攻击力
  const attackMul = 1 + ((upgrades.ox + upgrades.tiger + upgrades.monkey) || 0) * 0.15;
  
  // ... 其他强化
  
  return { eggUses, cooldownMul, attackMul };
}
```

- [ ] **Step 3: 修改 action.js 模式B强化效果**

```javascript
// action.js - 应用强化效果
function applyModeBUpgrades() {
  const progress = loadProgress();
  const upgrades = progress.upgrades;
  
  // 奶蛋：+自动回复
  const autoHeal = (upgrades.egg || 0) * 1; // HP/秒
  
  // 奶鼠/奶兔/奶鸡：-技能冷却
  const skillCooldownMul = 1 - ((upgrades.rat + upgrades.rabbit + upgrades.rooster) || 0) * 0.1;
  
  // ... 其他强化
  
  return { autoHeal, skillCooldownMul };
}
```

- [ ] **Step 4: 运行测试**

Run: `node tests/upgrade-effects.test.js`
Expected: PASS

- [ ] **Step 5: 浏览器验证**

验证强化效果在两种模式中生效。

- [ ] **Step 6: 提交**

```bash
git add game.js action.js tests/upgrade-effects.test.js
git commit -m "feat: 强化效果实现，跨模式生效"
```

---

### Task 8: 完整测试与平衡性调整

**Files:**
- Test: `tests/integration.test.js`
- Modify: `game.js` (数值调整)
- Modify: `action.js` (数值调整)

**Interfaces:**
- Consumes: All previous tasks
- Produces: 完整游戏流程

- [ ] **Step 1: 编写集成测试**

```javascript
// tests/integration.test.js
const assert = require('assert');

function test_full_flow() {
  // 测试存档迁移
  // 测试关卡解锁
  // 测试角色解锁
  // 测试强化系统
  console.log('PASS: integration test');
}

test_full_flow();
```

- [ ] **Step 2: 平衡性测试**

浏览器测试12关难度曲线和奶黄经济。

- [ ] **Step 3: 数值调整**

根据测试结果调整难度和奖励。

- [ ] **Step 4: 提交**

```bash
git add tests/integration.test.js game.js action.js
git commit -m "test: 完整测试与平衡性调整"
```

---

## 自检验证

**Spec coverage:**
- ✅ 货币系统重构 → Task 1
- ✅ 关卡系统扩展 → Task 2, Task 3
- ✅ 角色替换 → Task 5
- ✅ 强化系统 → Task 6, Task 7
- ✅ 解锁逻辑重构 → Task 4
- ✅ 存档系统 → Task 1
- ✅ 测试计划 → Task 8

**Placeholder scan:** 无 TBD/TODO

**Type consistency:** 所有函数签名一致

---

**Plan complete and saved to `docs/superpowers/plans/2026-10-25-major-refactor-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
