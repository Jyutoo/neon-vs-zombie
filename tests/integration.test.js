'use strict';
/**
 * Integration tests — drive the real pages, never a copy of their logic.
 *
 * Issue #2's coverage gap was that this file re-implemented about a dozen
 * production functions (and several of them no longer exist now that
 * `progress.js` owns every save read/write) and then asserted against its own
 * copies. Everything below instead boots the unmodified production scripts in
 * the DOM shim from `tests/helpers/browser-env.js`, seeds state through the
 * localStorage stub, calls the real entry points (`window.__nailongTower`,
 * `window.__nailong`, `upgradeCharacter`, `unlockedLevel`, `ProgressStore.*`)
 * and asserts what the pages actually wrote back: the persisted save, the
 * rendered cards, the debug state. Helpers here only *drive* production; none
 * of them recomputes an expected value.
 *
 * Covers:
 *   1. Save migration v1 → v2 through the tower page
 *   2. Mode A progression: clear level → reward → wallet → next level
 *   3. Character unlock progression through the real settlement path
 *   4. The upgrade shop purchase path
 *   5. Mode A level configuration (12 levels, waves, reward ladder)
 *   6. Mode B track: endless record / level win → the level-select page
 *   7. Upgrade effects that really reach the baby and the player
 *   8. Cross-page / cross-mode persistence, and one end-to-end run
 *
 * Run:  node --test tests/integration.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const ProgressStore = require('../progress.js');
const DATA = require('../action-data.js');
const { boot, createStorage } = require('./helpers/browser-env');

const V1 = ProgressStore.V1_SAVE_KEY;
const V2 = ProgressStore.SAVE_KEY;

// Load order taken from each HTML page's own <script> tags.
const TOWER_FILES = ['progress.js', 'game.js'];                                   // game.html
const ACTION_FILES = ['progress.js', 'action-data.js', 'action-logic.js', 'action.js']; // action.html
const SHOP_FILES = ['progress.js', 'upgrade.js'];                                 // upgrade.html
const LEVELS_FILES = ['progress.js', 'action-levels.js'];                         // action-levels.html

// ── Drivers (they only read/seed production output) ────────────────────────

// The shim hands out (and caches) a node per id, including ids a page only
// touches lazily, so ask the document instead of the cache map.
const node = (env, id) => env.document.getElementById(id);

function seedV1(v1Data) {
  return createStorage({ [V1]: JSON.stringify(v1Data) });
}

function seedV2(v2Data) {
  return createStorage({ [V2]: JSON.stringify(v2Data) });
}

// What a page last wrote into the shared save.
function stored(save) {
  return JSON.parse(save.getItem(V2));
}

// Objects built inside a VM context carry that context's prototypes, so strict
// deep equality against a value from this realm fails on prototype identity
// alone. Copy across the boundary before comparing whole structures.
const plain = value => JSON.parse(JSON.stringify(value));

function bootTower(save = createStorage()) {
  const env = boot({ files: TOWER_FILES, save });
  const api = env.global.__nailongTower;
  api.game.sound = false;
  return { env, api, save };
}

function bootAction(save = createStorage(), search = '?mode=endless') {
  const env = boot({ files: ACTION_FILES, search, save });
  const api = env.global.window.__nailong;
  api.state.sound = false;
  return { env, api, save };
}

function bootShop(save = createStorage()) {
  return boot({ files: SHOP_FILES, save });
}

function bootLevels(save = createStorage()) {
  return boot({ files: LEVELS_FILES, save });
}

// upgrade.js re-renders by appending; assigning innerHTML = '' on the shim does
// not truncate `children`, so the newest card for a key is the last one.
function upgradeCard(env, key) {
  const cards = node(env, 'upgradeGrid').children;
  return cards.filter(card => card.innerHTML.includes(`assets/${key}.png`)).pop();
}

// The price the shop itself shows, straight off the card.
function renderedPrice(card) {
  const match = card.innerHTML.match(/强化：(\d+) 奶黄/);
  return match ? Number(match[1]) : null;
}

// Same append-only quirk for the Mode B track, keyed off the level number the
// card prints.
function levelCards(env) {
  const byLevel = new Map();
  for (const card of node(env, 'levelTrack').children) {
    const match = card.innerHTML.match(/第 (\d+) 关/);
    if (match) byLevel.set(Number(match[1]), card);
  }
  return byLevel;
}

function maxUpgrades() {
  const upgrades = {};
  for (const key of ProgressStore.ALL_UNITS) upgrades[key] = ProgressStore.MAX_UPGRADE_LEVEL;
  return upgrades;
}

// Production multipliers come out of float math (e.g. 1 - 0.7 === 0.30000000000000004),
// so compare them with a tolerance instead of pinning their last bit.
function closeTo(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message || ''} expected ~${expected}, got ${actual}`);
}

// ── 1. Save migration v1 → v2 ──────────────────────────────────────────────

test('Integration: legacy v1 save migrates through the tower page into a complete v2 save', () => {
  const save = seedV1({
    coins: 1200,
    totalEarned: 3000,
    highestCleared: 5,
    selectedLevel: 4,
    unlocked: ['egg', 'snake', 'ox', 'monkey', 'rat', 'tiger', 'dragon']
  });
  const { api } = bootTower(save);
  const progress = api.progress;

  // Values carried over by production.
  assert.equal(progress.custard, 1200);
  assert.equal(progress.highestCleared, 5);
  assert.equal(progress.selectedLevel, 4);
  assert.equal(progress.actionHighestCleared, 0);
  assert.deepEqual(plain(progress.endlessBest), { wave: 0, kills: 0, date: null });
  for (const key of ['rat', 'tiger', 'dragon']) {
    assert.equal(progress.unlocked.includes(key), true, `${key} should survive migration`);
  }
  for (const key of ProgressStore.STARTING_UNITS) {
    assert.equal(progress.unlocked.includes(key), true, `missing starting unit: ${key}`);
  }
  for (const key of ProgressStore.ALL_UNITS) {
    assert.equal(progress.upgrades[key], 0, `upgrade ${key} should start at 0`);
  }

  // The page persisted a full save and retired the legacy key.
  assert.equal(save.getItem(V1), null, 'v1 key must be gone once v2 is complete');
  assert.deepEqual(Object.keys(stored(save)).sort(), Object.keys(ProgressStore.defaultProgress()).sort());

  // v1's totalEarned is not a v2 field any more — production drops it, while
  // the wallet survives, so nothing is lost that the pages still read.
  assert.equal(Object.prototype.hasOwnProperty.call(progress, 'totalEarned'), false);
});

test('Integration: a fresh player boots the tower page with the store defaults', () => {
  const { api, save } = bootTower();
  assert.deepEqual(plain(api.progress), ProgressStore.defaultProgress());
  assert.equal(api.progress.custard, 500);
  assert.equal(api.progress.highestCleared, 0);
  assert.equal(api.progress.selectedLevel, 1);
  assert.deepEqual(plain(api.progress.unlocked), ProgressStore.STARTING_UNITS);
  assert.equal(Object.keys(api.progress.upgrades).length, ProgressStore.ALL_UNITS.length);
  assert.deepEqual(stored(save), ProgressStore.defaultProgress(), 'defaults are persisted, not just held in memory');
});

test('Integration: out-of-range legacy values are clamped before any page reads them', () => {
  const junk = {
    coins: -50, totalEarned: 9999, highestCleared: 40, selectedLevel: 9,
    unlocked: ['wizard', 'pig', 'pig']
  };
  const raw = ProgressStore.load(seedV1(junk));
  assert.equal(raw.custard, 0, 'a negative legacy wallet floors to 0');
  assert.equal(raw.highestCleared, ProgressStore.MAX_LEVEL, 'the legacy track is capped to 12 levels');
  assert.deepEqual(raw.unlocked, ['pig', ...ProgressStore.STARTING_UNITS], 'unknown units are dropped, starting units kept');

  // The tower page then applies its own 150 entry floor on the way in.
  assert.equal(bootTower(seedV1(junk)).api.progress.custard, 150);

  // A v2 save claiming a level nobody cleared is pulled back to the track.
  assert.equal(bootTower(seedV2({ custard: 700, highestCleared: 0, selectedLevel: 8 })).api.progress.selectedLevel, 1);
});

// ── 2. Mode A level progression ────────────────────────────────────────────

test('Integration: clearing a level pays the first-clear reward and opens the next one', () => {
  const { env, api } = bootTower();
  const wallet = api.progress.custard;

  api.startLevel(1);
  assert.equal(api.game.state, 'running');
  api.finishGame(true);

  assert.equal(api.progress.highestCleared, 1);
  assert.equal(api.progress.selectedLevel, 2);
  assert.equal(api.progress.custard, wallet + api.firstClearReward(1));
  assert.match(node(env, 'modal').innerHTML, /首次通关第 1 关/);

  // Re-entering the settlement must not pay again (the old copy had no such guard).
  const paid = api.progress.custard;
  api.finishGame(true);
  assert.equal(api.progress.custard, paid);
  assert.equal(api.progress.highestCleared, 1);

  api.startLevel(2);
  api.finishGame(true);
  assert.equal(api.progress.highestCleared, 2);
  assert.equal(api.progress.selectedLevel, 3);
  assert.equal(api.progress.custard, paid + api.firstClearReward(2));
});

test('Integration: replaying a cleared level pays the repeat reward and never advances the track', () => {
  const { env, api } = bootTower(seedV2({ custard: 500, highestCleared: 5, selectedLevel: 6 }));
  api.startLevel(3);
  api.finishGame(true);

  assert.equal(api.progress.custard, 500 + api.repeatReward(3));
  assert.equal(api.repeatReward(3) < api.firstClearReward(3), true, 'a repeat pays strictly less');
  assert.equal(api.progress.highestCleared, 5, 'replaying must not advance the track');
  assert.equal(api.progress.selectedLevel, 3, 'playing an old level moves the selection, not the track');
  assert.match(node(env, 'modal').innerHTML, /重复通关奖励/);
});

test('Integration: losing writes back the in-run custard and keeps the track', () => {
  const clean = bootTower();
  clean.api.startLevel(1);
  clean.api.finishGame(false);
  assert.equal(clean.api.game.state, 'lost');
  assert.equal(clean.api.progress.custard, 500, 'a run where nothing was spent changes nothing');
  assert.equal(clean.api.progress.highestCleared, 0);
  assert.equal(clean.api.progress.unlocked.length, ProgressStore.STARTING_UNITS.length);

  const spent = bootTower();
  spent.api.startLevel(1);
  assert.equal(spent.api.placeUnit('egg', 0, 0), true);
  const leftInRun = spent.api.game.custard;
  assert.ok(leftInRun < 500, 'planting spends in-run custard');
  spent.api.finishGame(false);
  assert.equal(spent.api.progress.custard, leftInRun, 'a lost run banks what is left in the field');
});

test('Integration: clearing all twelve levels pays each first-clear reward exactly once', () => {
  const { api } = bootTower();
  const start = api.progress.custard;
  let owed = 0;

  for (let level = 1; level <= ProgressStore.MAX_LEVEL; level++) {
    api.startLevel(level);
    assert.equal(api.game.levelIndex, level, `level ${level} should actually start`);
    owed += api.firstClearReward(level);
    api.finishGame(true);
    assert.equal(api.progress.highestCleared, level);
  }

  assert.equal(api.progress.custard, start + owed);
  assert.equal(api.progress.selectedLevel, ProgressStore.MAX_LEVEL, 'the final level does not open a thirteenth');
  assert.equal(api.progress.unlocked.length, ProgressStore.ALL_UNITS.length, 'the whole roster is owned by the end');
});

test('Integration: selectedLevel never runs ahead of the cleared track', () => {
  const { env, api } = bootTower();
  for (let level = 1; level <= 3; level++) {
    api.startLevel(level);
    api.finishGame(true);
    assert.ok(api.progress.selectedLevel <= api.progress.highestCleared + 1);
  }
  assert.equal(api.progress.highestCleared, 3);
  assert.equal(api.progress.selectedLevel, 4);

  api.startLevel(6);
  assert.equal(api.game.levelIndex, 3, 'a level past the gate never starts');
  assert.match(node(env, 'toast').textContent, /先通关第 4 关/, 'production names the real next gate');
});

// ── 3. Character unlock progression ────────────────────────────────────────

test('Integration: clearing level 2 unlocks 奶鼠 for the battlefield and the shop', () => {
  const save = createStorage();
  const { env, api } = bootTower(save);

  api.startLevel(1);
  api.finishGame(true);
  assert.equal(api.isUnlocked('rat'), false, 'rat must still be gated after level 1');

  api.startLevel(2);
  api.finishGame(true);
  assert.equal(api.isUnlocked('rat'), true);
  assert.equal(api.progress.unlocked.includes('rat'), true);
  assert.equal(node(env, 'toast').textContent, '解锁新角色：奶鼠');
  assert.equal(ProgressStore.upgradeLevel(stored(save), 'rat'), 0, 'unlocking is not the same as upgrading');

  // The shop, reading the same save, sells the newly unlocked character.
  const shop = bootShop(save);
  assert.match(upgradeCard(shop, 'rat').innerHTML, /data-upgrade="rat"/);
  shop.global.upgradeCharacter('rat');
  assert.equal(ProgressStore.upgradeLevel(stored(save), 'rat'), 1);
});

test('Integration: character unlock pacing matches the level gates', () => {
  const { api } = bootTower();
  for (let level = 1; level <= 10; level++) {
    api.startLevel(level);
    api.finishGame(true);

    if (level === 1) {
      assert.deepEqual([...api.progress.unlocked].sort(), [...ProgressStore.STARTING_UNITS].sort());
    }
    if (level === 2) {
      assert.equal(api.progress.unlocked.includes('rat'), true);
      assert.equal(api.progress.unlocked.length, 5);
    }
    if (level === 4) {
      assert.equal(api.progress.unlocked.includes('rabbit'), true);
      assert.equal(api.progress.unlocked.includes('dog'), true);
      assert.equal(api.progress.unlocked.length, 7);
    }
    if (level === 5) {
      assert.equal(api.progress.unlocked.includes('tiger'), true);
      assert.equal(api.progress.unlocked.length, 8);
      assert.equal(api.progress.unlocked.includes('goat'), false, 'goat still needs level 6');
    }
    if (level === 10) {
      // 奶龙 is the last gate, so the tenth level owns the whole roster.
      assert.equal(api.progress.unlocked.length, ProgressStore.ALL_UNITS.length);
      for (const key of ProgressStore.ALL_UNITS) {
        assert.equal(api.progress.unlocked.includes(key), true, `${key} should be owned after level 10`);
      }
    }
  }
});

test('Integration: checkCharacterUnlocks is idempotent and persists its result', () => {
  const save = seedV2({
    custard: 900, highestCleared: 7, selectedLevel: 8,
    unlocked: [...ProgressStore.STARTING_UNITS]
  });
  const { api } = bootTower(save);
  assert.equal(api.progress.unlocked.length, ProgressStore.STARTING_UNITS.length);

  api.checkCharacterUnlocks();
  const once = [...api.progress.unlocked];
  api.checkCharacterUnlocks();

  assert.deepEqual(plain(api.progress.unlocked), once, 'a second pass must not add duplicates');
  assert.equal(api.progress.unlocked.length, new Set(api.progress.unlocked).size);
  assert.equal(api.isUnlocked('rooster'), true);
  assert.equal(api.isUnlocked('pig'), false, 'pig still waits for level 8');
  assert.deepEqual(stored(save).unlocked, once, 'the unlock is written to the shared save');
});

// ── 4. Upgrade shop purchase path ──────────────────────────────────────────

test('Integration: buying an upgrade spends exactly the price the shop renders', () => {
  const save = createStorage();
  const env = bootShop(save);
  const price = renderedPrice(upgradeCard(env, 'egg'));
  assert.equal(node(env, 'custardBalance').textContent, 500);
  assert.ok(price !== null, 'an unlocked card must show its price');

  env.global.upgradeCharacter('egg');

  const after = stored(save);
  assert.equal(after.upgrades.egg, 1);
  assert.equal(after.custard, 500 - price);
  assert.equal(node(env, 'custardBalance').textContent, 500 - price, 'the banner re-renders from the new save');
  assert.match(upgradeCard(env, 'egg').innerHTML, /Lv\.1/);
  assert.deepEqual(Object.keys(after).sort(), Object.keys(ProgressStore.defaultProgress()).sort());
});

test('Integration: the seven-level ladder charges every rendered price and then refuses', () => {
  const save = seedV2({ custard: 100000 });
  const env = bootShop(save);

  const prices = [];
  for (let i = 0; i < ProgressStore.MAX_UPGRADE_LEVEL; i++) {
    const before = stored(save).custard;
    prices.push(renderedPrice(upgradeCard(env, 'egg')));
    env.global.upgradeCharacter('egg');
    assert.equal(stored(save).custard, before - prices[i], `step ${i + 1} charges the rendered price`);
    assert.equal(stored(save).upgrades.egg, i + 1);
  }

  assert.deepEqual(prices, [100, 200, 400, 800, 1600, 3200, 6400], 'costs escalate per level, never flat');
  assert.equal(100000 - stored(save).custard, 12700, 'one character to max costs 12,700');
  assert.equal(stored(save).upgrades.egg, ProgressStore.MAX_UPGRADE_LEVEL);

  const maxed = upgradeCard(env, 'egg');
  assert.match(maxed.innerHTML, /已满级/);
  assert.doesNotMatch(maxed.innerHTML, /data-upgrade="egg"/, 'a maxed card offers no button');
  env.global.upgradeCharacter('egg');
  assert.equal(stored(save).upgrades.egg, ProgressStore.MAX_UPGRADE_LEVEL, 'max stays max');
  assert.equal(stored(save).custard, 100000 - 12700, 'the refused purchase is free');
});

test('Integration: maxing the whole roster costs 13 x 12,700 through the shop', () => {
  const save = seedV2({ custard: 200000, highestCleared: ProgressStore.MAX_LEVEL, selectedLevel: ProgressStore.MAX_LEVEL });
  const env = bootShop(save);
  const wallet = () => stored(save).custard;

  let spent = 0;
  for (const key of ProgressStore.ALL_UNITS) {
    const card = upgradeCard(env, key);
    assert.match(card.innerHTML, new RegExp(`data-upgrade="${key}"`), `${key} must be purchasable once the track is cleared`);
    for (let i = 0; i < ProgressStore.MAX_UPGRADE_LEVEL; i++) {
      const before = wallet();
      const price = renderedPrice(upgradeCard(env, key));
      env.global.upgradeCharacter(key);
      assert.equal(before - wallet(), price, `${key} step ${i + 1} charged the rendered price`);
      spent += price;
    }
    assert.equal(ProgressStore.upgradeLevel(stored(save), key), ProgressStore.MAX_UPGRADE_LEVEL);
  }

  assert.equal(spent, 165100, 'thirteen characters to max cost 13 × 12,700');
  assert.equal(wallet(), 200000 - spent);
});

test('Integration: an unaffordable upgrade is refused without touching the save', () => {
  const save = seedV2({ custard: 50 });
  const env = bootShop(save);
  const card = upgradeCard(env, 'egg');
  assert.match(card.innerHTML, /disabled/);
  assert.match(card.innerHTML, /奶黄不足/);
  assert.equal(renderedPrice(card), 100, 'the shop still shows the real price');

  env.global.upgradeCharacter('egg');

  assert.equal(stored(save).custard, 50);
  assert.equal(ProgressStore.upgradeLevel(stored(save), 'egg'), 0);
});

test('Integration: a level-gated character is sold no purchase button', () => {
  const env = bootShop(createStorage());
  const horse = upgradeCard(env, 'horse');
  assert.match(horse.innerHTML, /card-locked/);
  assert.doesNotMatch(horse.innerHTML, /data-upgrade="horse"/);
  assert.equal(ProgressStore.isCharacterUnlocked(stored(env.save), 'horse'), false);
  assert.equal(ProgressStore.upgradeLevel(stored(env.save), 'horse'), 0);
});

// ── 5. Mode A level configuration ──────────────────────────────────────────

test('Integration: all twelve tower levels report their waves through the page', () => {
  const { api } = bootTower();
  const expectedWaves = [5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 10];
  let previous = 0;

  expectedWaves.forEach((waves, index) => {
    const level = index + 1;
    assert.equal(api.levelWaveCount(level), waves, `level ${level} wave count`);
    assert.equal(api.levelWaves(level).length, waves, 'the generated wave list matches the count');
    assert.ok(waves >= previous, `level ${level} must not be shorter than level ${level - 1}`);
    previous = waves;
  });

  assert.equal(api.levelWaveCount(200), 10, 'the final wave count holds past the track');
  assert.equal(api.enemyTypesForLevel(12).includes('boss'), true, 'only the final level runs a boss');
  assert.equal(api.enemyTypesForLevel(11).includes('boss'), false);
  assert.equal(api.difficultyLabel(12), 'BOSS 关');
});

test('Integration: the level a run actually plays is the level the page configured', () => {
  // Every level has to be startable, so hand the page a completed track.
  const { api } = bootTower(seedV2({
    custard: 500,
    highestCleared: ProgressStore.MAX_LEVEL,
    selectedLevel: ProgressStore.MAX_LEVEL
  }));
  for (const level of [1, 6, ProgressStore.MAX_LEVEL]) {
    api.startLevel(level);
    assert.equal(api.game.levelIndex, level);
    assert.equal(api.game.waves.length, api.levelWaveCount(level), 'the run carries the configured wave count');
    assert.equal(api.game.queue.length, api.game.waves.reduce((sum, wave) => sum + wave.types.length, 0),
      'every scheduled zombie reaches the spawn queue');
    assert.deepEqual(plain(api.game.scaling), plain(api.levelScaling(level)), 'the run uses this level scaling');
    assert.equal(api.game.custard, api.progress.custard, 'the run starts from the shared wallet');
    assert.equal(api.game.queue.some(entry => entry.type === 'boss'), level === ProgressStore.MAX_LEVEL,
      'only the final run summons the zombie king');
  }
});

test('Integration: the reward ladder grows with the level and repeats pay less', () => {
  const { api } = bootTower();
  for (let level = 1; level <= ProgressStore.MAX_LEVEL; level++) {
    assert.ok(api.repeatReward(level) >= 10, `level ${level} repeat reward has a floor of 10`);
    assert.ok(api.repeatReward(level) < api.firstClearReward(level), `level ${level} repeat < first clear`);
    assert.ok(api.firstClearReward(level) > 0);
    if (level > 1) {
      assert.equal(api.firstClearReward(level) - api.firstClearReward(level - 1), 15,
        `level ${level} should pay 15 more than level ${level - 1}`);
    }
  }
});

// ── 6. Mode B track through the real pages ─────────────────────────────────

test('Integration: an endless record opens Mode B levels on the level-select page', () => {
  const save = createStorage();
  const action = bootAction(save);
  action.api.state.wave = 9;
  action.api.state.kills = 20;
  action.api.finishEndless();
  assert.equal(stored(save).endlessBest.wave, 9);

  const levels = bootLevels(save);
  assert.equal(levels.global.unlockedLevel(), 4, 'floor(9/3) + 1 levels open');
  const cards = levelCards(levels);
  for (let level = 1; level <= 4; level++) {
    assert.equal(cards.get(level).classList.contains('locked'), false, `level ${level} should be open`);
  }
  assert.equal(cards.get(5).classList.contains('locked'), true, 'level 5 still needs three more waves');
  assert.equal(node(levels, 'actionEndlessBest').textContent, '第 9 波');
});

test('Integration: a deep endless run opens the whole Mode B track, junk never does', () => {
  assert.equal(bootLevels(seedV2({ endlessBest: { wave: 33 } })).global.unlockedLevel(), ProgressStore.MAX_LEVEL);
  assert.equal(bootLevels(seedV2({ endlessBest: { wave: 999 } })).global.unlockedLevel(), ProgressStore.MAX_LEVEL);

  const broken = bootLevels(seedV2({ endlessBest: { wave: -5 } }));
  assert.equal(broken.global.unlockedLevel(), 1, 'a negative record cannot unlock past level 1');
  assert.equal(stored(broken.save).endlessBest.wave, 0, 'the store floors the record itself');
});

test('Integration: winning a Mode B level marks it cleared on the level-select page', () => {
  const save = seedV2({ custard: 500, endlessBest: { wave: 12 } });
  const action = bootAction(save, '?mode=level&level=3');
  action.api.winLevel();
  assert.equal(stored(save).actionHighestCleared, 3);
  assert.equal(stored(save).custard, 500, 'a Mode B win must not touch the wallet');

  const levels = bootLevels(save);
  assert.equal(levels.global.unlockedLevel(), 5);
  const cards = levelCards(levels);
  for (let level = 1; level <= 3; level++) {
    assert.equal(cards.get(level).classList.contains('cleared'), true, `level ${level} should read as cleared`);
  }
  assert.equal(cards.get(4).classList.contains('available'), true);
  assert.equal(node(levels, 'actionCleared').textContent, 3);
});

// ── 7. Upgrade effects, consumed for real ──────────────────────────────────

test('Integration: maxed upgrades reach the tower baby and the Mode B player', () => {
  const save = seedV2({ custard: 1000, upgrades: maxUpgrades() });

  const tower = bootTower(save);
  const modeA = tower.api.applyModeAUpgrades();
  assert.equal(modeA.babyUses, 1 + ProgressStore.MAX_UPGRADE_LEVEL);
  closeTo(modeA.babyDamageMul, 4.15, 'ox + tiger + monkey at 7 each');
  closeTo(modeA.babyDotMul, 3.8, 'snake + dragon at 7 each');
  assert.equal(modeA.babyHealPerUse, 140);
  assert.equal(modeA.babyShieldPerUse, 280);
  closeTo(modeA.babyCooldownMul, 0.3, 'cooldown reduction is capped');

  tower.api.startLevel(1);
  assert.equal(tower.api.game.babies[0].maxUses, modeA.babyUses, 'the baby really gets the extra uses');
  assert.equal(tower.api.game.babies[0].usesLeft, modeA.babyUses);

  const action = bootAction(save);
  const modeB = action.api.applyModeBUpgrades();
  assert.equal(modeB.autoHealPerSec, ProgressStore.MAX_UPGRADE_LEVEL);
  closeTo(modeB.attackDamageMul, 4.15, 'same damage ladder as Mode A');
  closeTo(modeB.dotDamageMul, 3.8, 'same DoT ladder as Mode A');
  assert.equal(modeB.healOnKill, 28);
  assert.equal(modeB.shieldHp, 420);
  closeTo(modeB.skillCooldownMul, 0.3, 'cooldown reduction is capped');

  const player = action.api.state.player;
  assert.equal(player.autoHealPerSec, modeB.autoHealPerSec, 'auto heal is wired into the player');
  assert.equal(player.healOnKill, modeB.healOnKill, 'heal on kill is wired into the player');
  assert.equal(player.persistentAttackDamageMul, modeB.attackDamageMul, 'damage multiplier is really read');
  assert.equal(player.persistentDotDamageMul, modeB.dotDamageMul, 'DoT multiplier is really read');
  assert.equal(player.persistentSkillCooldownMul, modeB.skillCooldownMul);
  assert.equal(player.maxHpBase, DATA.player.maxHp + modeB.shieldHp, 'shield HP is added to the player');
});

test('Integration: a fresh save boots with baseline effects in both modes', () => {
  const modeA = bootTower().api.applyModeAUpgrades();
  assert.equal(modeA.babyUses, 1);
  assert.equal(modeA.babyDamageMul, 1);
  assert.equal(modeA.babyDotMul, 1);
  assert.equal(modeA.babyHealPerUse, 0);
  assert.equal(modeA.babyShieldPerUse, 0);
  assert.equal(modeA.babyCooldownMul, 1);

  const modeB = bootAction().api.applyModeBUpgrades();
  assert.equal(modeB.autoHealPerSec, 0);
  assert.equal(modeB.attackDamageMul, 1);
  assert.equal(modeB.dotDamageMul, 1);
  assert.equal(modeB.healOnKill, 0);
  assert.equal(modeB.shieldHp, 0);
  assert.equal(modeB.skillCooldownMul, 1);
});

test('Integration: upgrading one character does not leak into another group', () => {
  const modeA = bootTower(seedV2({ custard: 500, upgrades: { ox: 5 } })).api.applyModeAUpgrades();
  closeTo(modeA.babyDamageMul, 1.75, 'ox alone gives 5 × 15%');
  assert.equal(modeA.babyCooldownMul, 1, 'rat is still level 0');
  assert.equal(modeA.babyDotMul, 1, 'snake is still level 0');
  assert.equal(modeA.babyUses, 1, 'egg is still level 0');
});

test('Integration: both modes read the same ladder from the same save', () => {
  const save = seedV2({ custard: 500, upgrades: { egg: 3, rat: 2, snake: 1, ox: 4, horse: 2, dog: 1 } });
  const modeA = bootTower(save).api.applyModeAUpgrades();
  const modeB = bootAction(save).api.applyModeBUpgrades();

  assert.equal(modeA.babyDamageMul, modeB.attackDamageMul);
  assert.equal(modeA.babyDotMul, modeB.dotDamageMul);
  assert.equal(modeA.babyCooldownMul, modeB.skillCooldownMul);

  // Per-mode scaling stays per mode: same source levels, different payouts.
  assert.equal(modeA.babyHealPerUse, 20);
  assert.equal(modeB.healOnKill, 4);
  assert.equal(modeA.babyShieldPerUse, 20);
  assert.equal(modeB.shieldHp, 30);
});

test('Integration: shop purchases are consumed by both modes', () => {
  const save = seedV2({ custard: 10000 });
  const shop = bootShop(save);
  for (let i = 0; i < 3; i++) shop.global.upgradeCharacter('egg');
  for (let i = 0; i < 2; i++) shop.global.upgradeCharacter('rat');
  assert.equal(ProgressStore.upgradeLevel(stored(save), 'egg'), 3);
  assert.equal(ProgressStore.upgradeLevel(stored(save), 'rat'), 2);

  const tower = bootTower(save);
  assert.equal(tower.api.applyModeAUpgrades().babyUses, 4);
  closeTo(tower.api.applyModeAUpgrades().babyCooldownMul, 0.8, 'rat level 2 gives -20%');
  tower.api.startLevel(1);
  assert.equal(tower.api.game.babies[0].usesLeft, 4, 'the live run sees the purchase');

  const action = bootAction(save);
  assert.equal(action.api.applyModeBUpgrades().autoHealPerSec, 3);
  assert.equal(action.api.state.player.autoHealPerSec, 3, 'the live player sees the purchase');
  closeTo(action.api.state.player.persistentSkillCooldownMul, 0.8);

  for (let i = 0; i < 2; i++) shop.global.upgradeCharacter('egg');
  assert.equal(bootTower(save).api.applyModeAUpgrades().babyUses, 6);
  assert.equal(bootAction(save).api.applyModeBUpgrades().autoHealPerSec, 5);
});

// ── 8. End-to-end flow and persistence ─────────────────────────────────────

test('Integration: full run — migrate, clear levels, buy upgrades, feel them, open Mode B', () => {
  const save = seedV1({
    coins: 300, totalEarned: 300, highestCleared: 0, selectedLevel: 1,
    unlocked: [...ProgressStore.STARTING_UNITS]
  });

  // Step 1: the tower page migrates the legacy wallet.
  const tower = bootTower(save);
  assert.equal(tower.api.progress.custard, 300);
  assert.equal(save.getItem(V1), null);

  // Step 2: clear levels 1-5 through the real settlement path.
  let owed = 0;
  for (let level = 1; level <= 5; level++) {
    tower.api.startLevel(level);
    owed += tower.api.firstClearReward(level);
    tower.api.finishGame(true);
  }
  assert.equal(tower.api.progress.custard, 300 + owed, 'migrated wallet plus exactly the level rewards');
  assert.equal(tower.api.progress.highestCleared, 5);
  for (const key of ['rat', 'rabbit', 'dog', 'tiger']) {
    assert.equal(tower.api.progress.unlocked.includes(key), true, `${key} unlocked by the run`);
  }
  assert.equal(tower.api.progress.unlocked.includes('goat'), false);

  // Step 3: spend part of it in the shop, paying the prices the shop shows.
  const shop = bootShop(save);
  let wallet = stored(save).custard;
  assert.equal(wallet, 300 + owed);
  for (let i = 0; i < 2; i++) {
    const price = renderedPrice(upgradeCard(shop, 'rat'));
    shop.global.upgradeCharacter('rat');
    wallet -= price;
    assert.equal(stored(save).custard, wallet, `purchase ${i + 1} charged ${price}`);
  }
  assert.equal(ProgressStore.upgradeLevel(stored(save), 'rat'), 2);

  // Step 4: both modes read the cooldown level off the same save.
  const modeA = bootTower(save).api.applyModeAUpgrades();
  const modeB = bootAction(save).api.applyModeBUpgrades();
  closeTo(modeA.babyCooldownMul, 0.8);
  assert.equal(modeA.babyCooldownMul, modeB.skillCooldownMul);

  // Step 5: an endless record opens the Mode B track.
  const endless = bootAction(save);
  endless.api.state.wave = 9;
  endless.api.finishEndless();
  assert.equal(bootLevels(save).global.unlockedLevel(), 4);

  // Step 6: nobody along the way clobbered the shared wallet.
  assert.equal(stored(save).custard, wallet, 'every page preserved the wallet it inherited');
  assert.equal(stored(save).highestCleared, 5);
  assert.equal(stored(save).endlessBest.wave, 9);
  assert.equal(ProgressStore.upgradeLevel(stored(save), 'rat'), 2);
});

test('Integration: a rich save round-trips through every page that reads it', () => {
  const rich = {
    custard: 1234,
    highestCleared: 7,
    actionHighestCleared: 5,
    endlessBest: { wave: 15, kills: 200, date: '2026-10-25' },
    selectedLevel: 8,
    unlocked: [...ProgressStore.STARTING_UNITS, 'rat', 'rabbit', 'dog', 'tiger', 'goat', 'rooster', 'pig', 'horse'],
    upgrades: { egg: 3, rat: 2 }
  };
  const save = seedV2(rich);

  const tower = bootTower(save);
  assert.equal(tower.api.progress.custard, 1234);
  assert.equal(tower.api.progress.highestCleared, 7);
  assert.equal(tower.api.progress.actionHighestCleared, 5);
  assert.deepEqual(plain(tower.api.progress.endlessBest), rich.endlessBest);
  assert.deepEqual([...tower.api.progress.unlocked].sort(), [...rich.unlocked].sort());
  assert.equal(tower.api.progress.upgrades.egg, 3);
  assert.equal(tower.api.progress.upgrades.rat, 2);
  assert.equal(tower.api.progress.upgrades.snake, 0, 'units absent from the save read as 0');

  const shop = bootShop(save);
  assert.equal(node(shop, 'custardBalance').textContent, 1234);
  assert.equal(bootLevels(save).global.unlockedLevel(), 6, 'floor(15/3) + 1');
  assert.equal(bootAction(save).api.state.player.autoHealPerSec, 3);

  // A run writes the save back, and another page reloads it unchanged.
  tower.api.startLevel(8);
  tower.api.finishGame(true);
  assert.equal(tower.api.progress.highestCleared, 8);
  const persisted = plain(tower.api.progress);
  assert.deepEqual(stored(save), persisted, 'the page persists the object it holds');
  assert.deepEqual(plain(bootTower(save).api.progress), persisted, 'a fresh page reads the same values back');
  assert.deepEqual(
    plain(ProgressStore.load(createStorage({ [V2]: JSON.stringify(stored(save)) }))),
    persisted,
    'serialization round-trips through the real store'
  );
});
