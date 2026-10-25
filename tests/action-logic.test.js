const test = require('node:test');
const assert = require('node:assert/strict');
const DATA = require('../src/js/action-data.js');
const L = require('../src/js/action-logic.js');

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

test('attack pool has no attack-speed option', () => {
  assert.equal(DATA.upgrades.some(u => u.id === 'swift'), false);
  assert.equal(DATA.upgrades.some(u => (u.apply || {}).attackSpeedMul), false);
});

test('verticalOverlap: grounded bodies overlap, airborne body is out of reach', () => {
  const ground = DATA.arena.groundY;
  const playerH = 128;
  const zombieH = 118;
  assert.equal(L.verticalOverlap(ground, playerH, ground, zombieH), true);
  const jumpPeak = ground - 138;
  assert.equal(L.verticalOverlap(jumpPeak, playerH, ground, zombieH), false);
  assert.equal(L.verticalOverlap(ground - 50, playerH, ground, zombieH), true);
});

test('verticalOverlap: airborne boss is out of grounded player reach', () => {
  const ground = DATA.arena.groundY;
  const playerH = 128;
  const bossH = 118 * DATA.boss.scale;
  const bossPeak = ground - DATA.boss.slam.jumpHeight;
  assert.equal(L.verticalOverlap(bossPeak, bossH, ground, playerH), false);
  assert.equal(L.verticalOverlap(ground, bossH, ground, playerH), true);
});
