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
