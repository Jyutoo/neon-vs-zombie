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
  const bossBar = document.getElementById('bossBar');
  const bossFill = document.getElementById('bossFill');
  const overlay = document.getElementById('overlay');

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
    sound('jump');
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
    sound('swing');
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
    if (knockback > 0) sound('hit');
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
      sound('death');
      if (state.stats.lifesteal > 0) healPlayer(state.stats.lifesteal);
      gainXp(enemy.cfg.xp);
    }
  }

  function gainXp(amount) {
    state.xp += amount;
    while (state.xp >= Logic.xpToNext(state.level)) {
      state.xp -= Logic.xpToNext(state.level);
      state.level += 1;
      state.pendingLevelUps += 1;
      sound('levelup');
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

  function renderUpgradeChips() {
    const unique = [...new Set(state.ownedUpgrades)];
    const chips = unique.map(id => {
      const up = DATA.upgrades.find(item => item.id === id);
      const count = state.ownedUpgrades.filter(item => item === id).length;
      return `<span class="upgrade-chip" title="${up.name} ×${count}">${up.name.slice(0, 2)}${count > 1 ? `×${count}` : ''}</span>`;
    });
    document.getElementById('upgradeChips').innerHTML = chips.join('');
  }

  const skillK = document.getElementById('skillK');
  const skillL = document.getElementById('skillL');
  const skillShift = document.getElementById('skillShift');

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

  function startDive() {
    const p = state.player;
    p.action = 'dive';
    p.actionTimer = 0;
    p.hitIds.clear();
    p.queuedCombo = false;
    p.vy = Math.max(p.vy, 420);
    sound('swing');
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
    sound('dash');
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
    sound('heavy');
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
    sound('fire');
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
    sound('boss');
    return boss;
  }

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

  function hurtPlayer(amount) {
    if (state.status !== 'playing') return;
    const p = state.player;
    if (state.time < p.invulnUntil || state.time < p.dashIframesUntil) return;
    p.hp -= amount;
    p.invulnUntil = state.time + DATA.player.hurtIframes;
    sound('hurt');
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

  function loseGame() {
    if (state.status !== 'playing') return;
    state.status = 'lost';
    sound('lose');
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
    document.getElementById('retryButton').addEventListener('click', resetActionGame);
  }

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

  function armorMarkup(type) {
    if (type === 'boss') return '<div class="armor boss-armor"></div><div class="boss-crown"></div>';
    if (type === 'cone') return '<div class="armor cone-armor"></div>';
    if (type === 'bucket' || type === 'elite') return '<div class="armor bucket-armor"></div>';
    return '';
  }

  function syncEnemyElements() {
    for (const enemy of state.enemies) {
      if (!enemy.el) {
        const el = document.createElement('div');
        el.className = `enemy ${enemy.type}`;
        el.style.width = `${72 * enemy.cfg.scale}px`;
        el.style.height = `${124 * enemy.cfg.scale}px`;
        el.innerHTML = `<img src="assets/zombie.png" alt="${enemy.cfg.name}">${armorMarkup(enemy.type)}<div class="enemy-hp"><div></div></div>`;
        enemy.el = el;
        enemyLayer.appendChild(el);
      }
      enemy.el.style.transform = `translate3d(${enemy.x}px, ${enemy.y}px, 0) translate(-50%, -100%)`;
      enemy.el.classList.toggle('windup', enemy.state === 'windup' && enemy.windup < 0.3);
      enemy.el.classList.toggle('hurt', enemy.hurt > 0);
      enemy.el.classList.toggle('dying', enemy.dying > 0);
      enemy.el.style.opacity = enemy.dying > 0 ? String(Math.max(0, enemy.dying / 0.4)) : '1';
      enemy.el.querySelector('.enemy-hp > div').style.width = `${Math.max(0, enemy.hp / enemy.maxHp) * 100}%`;
      if (enemy.type === 'boss') {
        enemy.el.classList.toggle('phase2', enemy.phase2);
        enemy.el.classList.toggle('charging', enemy.state === 'charge');
      }
      enemy.el.classList.toggle('flip', enemy.type === 'boss' && enemy.facing < 0);
    }
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 && enemy.dying <= 0) {
        enemy.el?.remove();
        enemy.el = null;
      }
    }
    state.enemies = state.enemies.filter(enemy => !(enemy.hp <= 0 && enemy.dying <= 0));
  }

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
      state.spawnQueue = [{ boss: true, at: state.time + DATA.level.batchDelay }];
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

  function finishEndless() {
    const saveKey = DATA.saveKey || 'nailong-vs-zombies-progress-v2';
    let newRecord = false;
    try {
      const saveData = JSON.parse(localStorage.getItem(saveKey) || 'null') || {};
      const best = saveData.endlessBest || { wave: 0, kills: 0, date: null };
      if (!best || state.wave > best.wave) {
        saveData.endlessBest = {
          wave: state.wave,
          kills: state.kills,
          date: new Date().toISOString().slice(0, 10)
        };
        localStorage.setItem(saveKey, JSON.stringify(saveData));
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
    document.getElementById('retryButton').addEventListener('click', resetActionGame);
  }

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
      if (next.boss) spawnBoss();
      else spawnEnemy(next.type, next.x);
    }

    if (state.levelPhase === 'advance') {
      if (state.screenIndex < DATA.level.screens.length - 1 && p.x >= boundary + DATA.level.edgeMargin) {
        startScreen(state.screenIndex + 1);
      }
      return;
    }

    if (state.levelPhase !== 'combat' && state.levelPhase !== 'boss') return;

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
    if (state.mode === 'level') updateLevelFlow();
    else updateEndless(dt);
    for (const enemy of [...state.enemies]) {
      if (enemy.type === 'boss') updateBoss(enemy, dt);
      else updateEnemy(enemy, dt);
    }
    updateShockwaves(dt);
    syncEnemyElements();
    if (state.mode === 'level' && state.levelPhase === 'boss' && state.status === 'playing') {
      const bossDead = state.boss?.dead || (state.boss && state.boss.hp <= 0 && state.boss.dying <= 0);
      if (bossDead) {
        state.levelPhase = 'cleared';
        winLevel();
      }
    }
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
    if (state.boss && state.boss.hp > 0) {
      bossBar.classList.add('visible');
      bossFill.style.width = `${Math.max(0, state.boss.hp / state.boss.maxHp) * 100}%`;
    } else {
      bossBar.classList.remove('visible');
    }
    updateSkillHud();
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

  function updateSoundButton() {
    document.getElementById('soundButton').textContent = state.sound ? '音效开' : '音效关';
  }

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
    document.getElementById('pauseRestart').addEventListener('click', resetActionGame);
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

  const GAME_KEYS = new Set(['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyJ', 'KeyK', 'KeyL', 'ShiftLeft', 'ShiftRight', 'KeyP', 'Escape']);
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
  window.addEventListener('keyup', event => {
    keys.delete(event.code);
  });
  window.addEventListener('resize', resize);
  window.addEventListener('blur', () => {
    keys.clear();
    if (state.status === 'playing') togglePause();
  });
  window.addEventListener('pointerdown', initAudio);

  document.getElementById('soundButton').addEventListener('click', () => {
    state.sound = !state.sound;
    updateSoundButton();
  });
  document.getElementById('pauseButton').addEventListener('click', togglePause);
  updateSoundButton();

  world.style.width = `${state.worldWidth}px`;
  resize();
  if (state.mode === 'level') {
    startScreen(0);
  } else {
    state.intermission = 1.5;
    stageLabel.textContent = '准备中';
  }
  renderHud();
  requestAnimationFrame(frame);
  setTimeout(() => document.getElementById('tipBar').classList.add('hidden'), 8000);

  window.__nailong = { state, spawnEnemy, hurtPlayer, startScreen, spawnBoss, gainXp, resetActionGame };
})();
