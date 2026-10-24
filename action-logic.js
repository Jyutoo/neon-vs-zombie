(function (root) {
  function createLogic(DATA) {
    const MULTIPLIER_KEYS = [
      'attackDamageMul', 'heavyDamageMul', 'heavyKnockbackMul',
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

    // Each of the twelve levels gets its own fight: more screens, bigger batches,
    // tougher zombies and a beefier zombie king.
    function growBatch(batch, extra) {
      const grown = batch.slice();
      for (let i = 0; i < extra; i++) grown.push(batch[i % batch.length]);
      return grown;
    }

    function levelConfig(level) {
      const L = DATA.level;
      const P = L.progression;
      const index = Math.max(1, Math.min(L.maxLevel, Math.floor(Number(level)) || 1));
      const step = index - 1;
      const extraScreens = Math.floor(step / P.extraScreenEvery);
      const extraEnemies = Math.floor(step / P.extraEnemyEvery);
      const combat = L.screens.map(screen => ({
        batches: screen.batches.map(batch => growBatch(batch, extraEnemies))
      }));
      for (let i = 0; i < extraScreens; i++) {
        const source = L.screens[i % L.screens.length];
        combat.push({ batches: source.batches.map(batch => growBatch(batch, extraEnemies)) });
      }
      const screens = combat.concat([{ boss: true }]);
      return {
        index,
        screens,
        worldWidth: screens.length * L.screenWidth,
        scaling: {
          hpMul: 1 + P.hpPerLevel * step,
          dmgMul: 1 + P.dmgPerLevel * step,
          speedMul: Math.min(P.maxSpeedMul, 1 + P.speedPerLevel * step)
        },
        bossHp: Math.round(DATA.boss.hp * (1 + P.bossHpPerLevel * step))
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

    // Foot-based Y: a body spans [footY - height, footY].
    function verticalOverlap(aFootY, aHeight, bFootY, bHeight) {
      return aFootY > bFootY - bHeight && aFootY - aHeight < bFootY;
    }

    function clampCamera(targetX, worldWidth, viewWidth) {
      return Math.max(0, Math.min(targetX, worldWidth - viewWidth));
    }

    return { xpToNext, waveConfig, levelConfig, applyUpgrade, rollUpgrades, scaleEnemy, rectsOverlap, verticalOverlap, clampCamera };
  }

  if (typeof module === 'object' && module.exports) module.exports = createLogic(require('./action-data.js'));
  else root.ActionLogic = createLogic(root.ACTION_DATA);
})(typeof window !== 'undefined' ? window : globalThis);
