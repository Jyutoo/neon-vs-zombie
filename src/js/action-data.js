(function (root) {
  const ACTION_DATA = {
    arena: { width: 1280, height: 720, groundY: 560, minX: 60, maxX: 1220, endlessStartX: 240 },
    progression: { xpBase: 30, xpStep: 20, upgradeCount: 3 },
    level: {
      maxLevel: 12,
      screenWidth: 1280,
      startX: 200,
      edgeMargin: 70,
      spawnOffset: 40,
      spawnSpacing: 50,
      rightMargin: 80,
      batchDelay: 1.2,
      spawnInterval: 0.6,
      // Combat screens for level 1. levelConfig() grows them and appends the
      // boss screen, so each of the twelve levels fights differently.
      screens: [
        { batches: [['basic', 'basic', 'basic'], ['basic', 'cone', 'cone']] },
        { batches: [['cone', 'cone', 'runner', 'runner'], ['basic', 'bucket'], ['elite', 'basic', 'basic']] },
        { batches: [['cone', 'cone', 'bucket', 'bucket'], ['runner', 'runner', 'basic', 'basic'], ['elite', 'cone', 'cone']] }
      ],
      progression: {
        hpPerLevel: 0.1,
        dmgPerLevel: 0.05,
        speedPerLevel: 0.02,
        maxSpeedMul: 1.35,
        bossHpPerLevel: 0.15,
        extraScreenEvery: 4,
        extraEnemyEvery: 4
      }
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
      { id: 'ironhead', name: '铁头功', desc: '重击伤害 +30%，击退 +25%', apply: { heavyDamageMul: 1.3, heavyKnockbackMul: 1.25 } },
      { id: 'breath', name: '音波强化', desc: '音波伤害 +30%', apply: { fireDamageMul: 1.3 } },
      { id: 'deepbreath', name: '深呼吸', desc: '音波冷却 -20%', apply: { fireCooldownMul: 0.8 } },
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
    }
  };

  if (typeof module === 'object' && module.exports) module.exports = ACTION_DATA;
  else root.ACTION_DATA = ACTION_DATA;
})(typeof window !== 'undefined' ? window : globalThis);
