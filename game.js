const BOARD_W = 1080;
const BOARD_H = 550;
const GRID_LEFT = 120;
const COL_W = 100;
const ROW_H = 110;
const ROWS = 5;
const COLS = 9;

const TYPES = {
  egg: { name: '奶蛋', role: '奶黄生产', cost: 60, hp: 160, cooldown: 5, rate: 12, produce: 20, description: '每隔 12 秒生成 20 奶黄，需要更谨慎地规划阵容。' },
  rat: { name: '奶鼠', role: '远程投石', cost: 120, hp: 190, cooldown: 5, rate: 1.15, damage: 30, range: Infinity, projectile: 'rock', description: '向本行最近的僵尸丢石头，稳定单体输出。' },
  snake: { name: '奶蛇', role: '毒液持续伤害', cost: 90, hp: 160, cooldown: 7, rate: 1.7, damage: 16, range: Infinity, projectile: 'glob', description: '喷出毒液，命中后造成 4 秒持续毒伤。' },
  dragon: { name: '奶龙', role: '范围火焰', cost: 210, hp: 280, cooldown: 11, rate: 1.9, damage: 48, range: 330, projectile: 'fire', description: '喷出奶香火焰，对目标及附近僵尸造成范围伤害。' },
  rabbit: { name: '奶兔', role: '群体治疗', cost: 90, hp: 170, cooldown: 9, rate: 3, description: '每 3 秒治疗自身及周围八格的奶家人 24 点耐久。' },
  tiger: { name: '奶虎', role: '近战爆发', cost: 180, hp: 330, cooldown: 9, rate: .85, damage: 75, range: 100, description: '近距离猛击僵尸，出手快、单次伤害高。' },
  ox: { name: '奶牛', role: '高耐久防线', cost: 90, hp: 900, cooldown: 11, rate: 2.2, damage: 20, range: 90, description: '拥有 900 点耐久，能长时间挡住僵尸并近身顶撞。' },
  monkey: { name: '奶猴', role: '双目标攻击', cost: 150, hp: 200, cooldown: 8, rate: 1.4, damage: 24, range: Infinity, projectile: 'seed', description: '灵活投掷果核，每次同时攻击本行两个目标。' },
  goat: { name: '奶羊', role: '击退控制', cost: 150, hp: 250, cooldown: 9, rate: 2.2, damage: 38, range: 135, description: '用头槌造成伤害并击退僵尸，击退后僵尸会获得短暂抗性。' },
  horse: { name: '奶马', role: '冲锋突击', cost: 180, hp: 250, cooldown: 10, rate: 3.4, damage: 65, range: 310, description: '向远处僵尸发起冲锋，造成高伤害并将其撞退，击退后有抗性窗口。' },
  rooster: { name: '奶鸡', role: '攻速增益', cost: 120, hp: 180, cooldown: 10, rate: 0, description: '晨鸣助威，使本行其他奶家人的攻击速度提高 25%。' },
  pig: { name: '奶猪', role: '奶黄寻宝', cost: 150, hp: 280, cooldown: 9, rate: 13, produce: 25, description: '每 13 秒拱出 25 奶黄，耐久比奶蛋更高。' },
  dog: { name: '奶狗', role: '减速守卫', cost: 120, hp: 260, cooldown: 8, rate: 4.5, damage: 30, range: 120, description: '吠叫使本行僵尸减速；僵尸靠近时会直接撕咬。' }
};

const ZOMBIES = {
  basic: { name: '普通僵尸', hp: 190, speed: 11, bite: 24 },
  cone: { name: '路障僵尸', hp: 325, speed: 11, bite: 27 },
  bucket: { name: '铁桶僵尸', hp: 525, speed: 9, bite: 31 },
  runner: { name: '快速僵尸', hp: 155, speed: 16, bite: 22 },
  brute: { name: '大块头僵尸', hp: 1100, speed: 5.5, bite: 60 },
  spitter: { name: '远程僵尸', hp: 260, speed: 8, bite: 24, range: 340, rate: 2.8, damage: 35 },
  jumper: { name: '跳跃僵尸', hp: 190, speed: 20, bite: 26 },
  boss: { name: '僵尸王', hp: 4200, speed: 3.8, bite: 70 }
};

const LEVEL = [
  { start: 10, interval: 8, types: ['basic', 'basic', 'basic', 'cone'] },
  { start: 46, interval: 7, types: ['basic', 'cone', 'jumper', 'basic', 'cone', 'basic', 'basic'] },
  { start: 88, interval: 6, types: ['runner', 'spitter', 'cone', 'basic', 'jumper', 'runner', 'cone', 'basic'] },
  { start: 132, interval: 5.5, types: ['cone', 'brute', 'bucket', 'spitter', 'basic', 'jumper', 'runner', 'cone', 'bucket'] },
  { start: 178, interval: 4.5, types: ['runner', 'cone', 'brute', 'bucket', 'spitter', 'jumper', 'cone', 'brute', 'spitter', 'bucket', 'runner', 'boss'] }
];

const $ = id => document.getElementById(id);
const layers = {
  plants: $('plantLayer'),
  zombies: $('zombieLayer'),
  projectiles: $('projectileLayer'),
  enemyProjectiles: $('enemyProjectileLayer'),
  custards: $('custardLayer')
};
const entityDom = { plants: new Map(), zombies: new Map(), projectiles: new Map(), enemyProjectiles: new Map(), custards: new Map() };
const cardDom = new Map();
let nextId = 1;
let toastTimer;
let audioContext;
const activeBabyVideos = new Set();
let lastFrame = performance.now();

const game = {
  state: 'ready',
  time: 0,
  custard: 150,
  speed: 1,
  sound: true,
  plants: [],
  zombies: [],
  projectiles: [],
  enemyProjectiles: [],
  custards: [],
  babies: [],
  cooldowns: {},
  selected: null,
  queue: [],
  total: LEVEL.reduce((sum, wave) => sum + wave.types.length, 0),
  spawned: 0,
  kills: 0,
  collected: 0,
  placed: 0,
  wave: -1,
  naturalTimer: 5
};

function buildQueue() {
  return LEVEL.flatMap((wave, waveIndex) => wave.types.map((type, index) => ({
    time: wave.start + index * wave.interval,
    type,
    wave: waveIndex
  }))).sort((a, b) => a.time - b.time);
}

function xForCol(col) { return GRID_LEFT + col * COL_W + COL_W / 2; }
function yForRow(row) { return row * ROW_H + ROW_H / 2; }
function pctX(x) { return `${x / BOARD_W * 100}%`; }
function pctY(y) { return `${y / BOARD_H * 100}%`; }
function randomBetween(min, max) { return min + Math.random() * (max - min); }

function initGrid() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = document.createElement('button');
      cell.className = `cell ${(row + col) % 2 ? 'alt' : ''}`;
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.setAttribute('aria-label', `第 ${row + 1} 行第 ${col + 1} 格`);
      const preview = document.createElement('img');
      preview.className = 'cell-preview';
      preview.alt = '';
      cell.appendChild(preview);
      cell.addEventListener('click', () => useCell(row, col));
      cell.addEventListener('mouseenter', () => updateCellPreview(cell, row, col));
      cell.addEventListener('mouseleave', () => preview.classList.remove('visible'));
      $('grid').appendChild(cell);
    }
  }
}

function initCards() {
  Object.entries(TYPES).forEach(([key, type]) => {
    const card = document.createElement('button');
    card.className = 'unit-card';
    card.dataset.type = key;
    card.innerHTML = `
      <img src="assets/${key}.png" alt="${type.name}">
      <span class="card-name">${type.name}</span>
      <span class="card-role">${type.role}</span>
      <span class="card-cost">${type.cost}</span>
      <span class="cooldown-mask"></span>
      <span class="cooldown-text"></span>`;
    card.addEventListener('click', () => selectUnit(key));
    card.addEventListener('mouseenter', () => showUnitDetail(key));
    $('cardGrid').appendChild(card);
    cardDom.set(key, card);
    game.cooldowns[key] = 0;
  });
}

function showUnitDetail(key) {
  const type = TYPES[key];
  $('unitDetail').innerHTML = `
    <div class="detail-title"><strong>${type.name}</strong><span>${type.role}</span></div>
    <p>${type.description}</p>
    <div class="detail-stats"><span>耐久 ${type.hp}</span><span>冷却 ${type.cooldown} 秒</span></div>`;
}

function selectUnit(key) {
  if (game.state !== 'running') return;
  const type = TYPES[key];
  showUnitDetail(key);
  if (game.cooldowns[key] > 0) {
    toast(`${type.name}还在休息，${Math.ceil(game.cooldowns[key])} 秒后可用`);
    return;
  }
  if (game.custard < type.cost) {
    toast(`奶黄不足，还需要 ${type.cost - game.custard}`);
    shakeCard(key);
    sound('deny');
    return;
  }
  game.selected = game.selected === key ? null : key;
  $('shovelButton').classList.remove('selected');
  $('statusText').textContent = game.selected ? `已选择${type.name}，点击一块空草地放置` : '已取消选择';
  sound('select');
  updateCards();
}

function updateCellPreview(cell, row, col) {
  const preview = cell.querySelector('.cell-preview');
  preview.classList.remove('visible');
  cell.classList.remove('valid', 'invalid');
  if (!game.selected || game.state !== 'running') return;
  if (game.selected === 'shovel') {
    cell.classList.add(plantAt(row, col) ? 'valid' : 'invalid');
    return;
  }
  const occupied = Boolean(plantAt(row, col));
  cell.classList.add(occupied ? 'invalid' : 'valid');
  if (!occupied) {
    preview.src = `assets/${game.selected}.png`;
    preview.classList.add('visible');
  }
}

function useCell(row, col) {
  if (game.state !== 'running' || !game.selected) {
    if (game.state === 'running') toast('先选择一张奶家人卡牌');
    return;
  }
  const existing = plantAt(row, col);
  if (game.selected === 'shovel') {
    if (!existing) return toast('这块草地上没有奶家人');
    removePlant(existing);
    game.selected = null;
    $('shovelButton').classList.remove('selected');
    $('statusText').textContent = '已移除角色，可以重新布置阵容';
    sound('shovel');
    return;
  }
  const key = game.selected;
  const type = TYPES[key];
  if (existing) return toast('这里已经有奶家人了');
  if (game.cooldowns[key] > 0) return toast('卡牌仍在冷却');
  if (game.custard < type.cost) {
    game.selected = null;
    updateCards();
    return toast('奶黄不足，先收集一些奶黄吧');
  }
  game.custard -= type.cost;
  game.cooldowns[key] = type.cooldown;
  game.placed++;
  game.plants.push({
    id: nextId++, type: key, row, col,
    x: xForCol(col), y: yForRow(row),
    hp: type.hp, maxHp: type.hp,
    timer: key === 'egg' || key === 'pig' ? 4 : .35
  });
  game.selected = null;
  $('statusText').textContent = `${type.name}已就位，继续布置防线吧`;
  spawnEffect('', xForCol(col), yForRow(row) + 30, 'dirt-burst');
  sound('plant');
  render();
}

function plantAt(row, col) {
  return game.plants.find(plant => plant.row === row && plant.col === col);
}

function resetGame(autostart = true) {
  nextId = 1;
  Object.assign(game, {
    state: autostart ? 'running' : 'ready',
    time: 0, custard: 150, speed: 1,
    plants: [], zombies: [], projectiles: [], enemyProjectiles: [], custards: [], babies: [],
    selected: null, queue: buildQueue(), spawned: 0, kills: 0,
    collected: 0, placed: 0, wave: -1, naturalTimer: 5,
    total: LEVEL.reduce((sum, wave) => sum + wave.types.length, 0)
  });
  Object.keys(game.cooldowns).forEach(key => game.cooldowns[key] = 0);
  stopBabyPerformances();
  $('babyLayer').innerHTML = '';
  $('effectLayer').innerHTML = '';
  for (let row = 0; row < ROWS; row++) {
    const baby = { row, used: false, element: document.createElement('button') };
    baby.element.className = 'baby-button';
    baby.element.style.left = pctX(62);
    baby.element.style.top = pctY(yForRow(row));
    baby.element.innerHTML = `<img src="assets/baby-glance.png" alt="第 ${row + 1} 行奶娃">`;
    baby.element.title = '点击让奶娃捧腹大笑，清空本行僵尸';
    baby.element.addEventListener('click', () => triggerBaby(row, false));
    $('babyLayer').appendChild(baby.element);
    game.babies.push(baby);
  }
  $('speedButton').textContent = '1×';
  $('shovelButton').classList.remove('selected');
  $('statusText').textContent = '先放奶蛋攒奶黄，再布置攻击角色';
  hideModal();
  updatePauseButton();
  render();
  lastFrame = performance.now();
  if (!autostart) showStart();
}

function startGame() {
  resetGame(true);
  initAudio();
  sound('start');
  toast('先种奶蛋，收集奶黄后布置攻击角色');
}

function spawnZombie(type, row = Math.floor(Math.random() * ROWS), summoned = false) {
  const config = ZOMBIES[type];
  game.zombies.push({
    id: nextId++, type, row,
    x: 1050 + randomBetween(0, 25), y: yForRow(row),
    hp: config.hp, maxHp: config.hp,
    speed: config.speed, bite: config.bite,
    biteTimer: .4, attackTimer: .8, eating: false,
    poisonUntil: 0, poisonTick: 0, slowUntil: 0,
    jumped: false, skillCount: 0, nextSkill: game.time + 5, enraged: false,
    knockbackProtected: false, knockbackGraceUntil: 0
  });
  game.spawned++;
  if (summoned) game.total++;
  if (type === 'boss') {
    announce('僵尸王来了！');
    sound('wave');
  }
}

function spawnCustard(x, y, falling = false, value = 25) {
  game.custards.push({
    id: nextId++, x, y: falling ? 15 : y,
    targetY: falling ? y : y - 16,
    life: 12, falling, collected: false, value
  });
}

function collectCustard(id) {
  if (game.state !== 'running') return;
  const drop = game.custards.find(item => item.id === id);
  if (!drop) return;
  game.custards = game.custards.filter(item => item.id !== id);
  game.custard += drop.value;
  game.collected += drop.value;
  $('resourcePill').classList.remove('bump');
  void $('resourcePill').offsetWidth;
  $('resourcePill').classList.add('bump');
  sound('collect');
  render();
}

function update(dt) {
  game.time += dt;
  game.naturalTimer -= dt;
  if (game.naturalTimer <= 0) {
    spawnCustard(randomBetween(180, 970), randomBetween(70, 500), true);
    game.naturalTimer = 8.5;
  }
  Object.keys(game.cooldowns).forEach(key => {
    game.cooldowns[key] = Math.max(0, game.cooldowns[key] - dt);
  });
  updateWaves();
  updateCustards(dt);
  updatePlants(dt);
  updateProjectiles(dt);
  updateEnemyProjectiles(dt);
  updateZombies(dt);
  if (!game.queue.length && !game.zombies.length && game.state === 'running') finishGame(true);
}

function updateWaves() {
  let currentWave = 0;
  LEVEL.forEach((wave, index) => { if (game.time >= wave.start) currentWave = index; });
  if (currentWave !== game.wave) {
    game.wave = currentWave;
    announce(currentWave === LEVEL.length - 1 ? '最后一波！' : `第 ${currentWave + 1} 波`);
    if (currentWave > 0) sound('wave');
  }
  while (game.queue.length && game.queue[0].time <= game.time) {
    spawnZombie(game.queue.shift().type);
  }
}

function updateCustards(dt) {
  for (const drop of game.custards) {
    drop.life -= dt;
    if (drop.falling && drop.y < drop.targetY) drop.y = Math.min(drop.targetY, drop.y + 42 * dt);
  }
  game.custards = game.custards.filter(drop => drop.life > 0);
}

function attackRate(plant, base) {
  if (plant.type === 'rooster') return base;
  const boosted = game.plants.some(other => other.type === 'rooster' && other.row === plant.row);
  return base / (boosted ? 1.25 : 1);
}

function updatePlants(dt) {
  const plantsSnapshot = [...game.plants];
  for (const plant of plantsSnapshot) {
    const type = TYPES[plant.type];
    plant.timer -= dt;
    if (plant.type === 'rooster') continue;
    const targets = game.zombies
      .filter(zombie => zombie.row === plant.row && zombie.x >= plant.x - 15 && zombie.x - plant.x <= (type.range ?? Infinity))
      .sort((a, b) => a.x - b.x);
    if (plant.type === 'egg' || plant.type === 'pig') {
      if (plant.timer <= 0) {
        spawnCustard(plant.x, plant.y, false, type.produce);
        plant.timer += type.rate;
        animateEntity('plants', plant.id, 'attacking', 300);
        sound('produce');
      }
      continue;
    }
    if (plant.type === 'rabbit') {
      if (plant.timer <= 0) {
        const friends = game.plants.filter(friend => Math.abs(friend.row - plant.row) <= 1 && Math.abs(friend.col - plant.col) <= 1 && friend.hp < friend.maxHp);
        friends.forEach(friend => {
          friend.hp = Math.min(friend.maxHp, friend.hp + 24);
          spawnEffect('+24', friend.x, friend.y - 25, 'combat-text heal');
        });
        if (friends.length) {
          animateEntity('plants', plant.id, 'attacking', 300);
          sound('heal');
        }
        plant.timer += type.rate;
      }
      continue;
    }
    if (plant.type === 'dog') {
      if (plant.timer <= 0 && (targets.length || game.zombies.some(z => z.row === plant.row))) {
        if (targets.length && targets[0].x - plant.x <= type.range) {
          damageZombie(targets[0], type.damage);
          spawnEffect('嗷呜', plant.x + 45, plant.y - 30, 'combat-text');
        } else {
          game.zombies.filter(z => z.row === plant.row).forEach(z => z.slowUntil = game.time + 4);
          spawnEffect('汪汪！减速', plant.x + 60, plant.y - 25, 'combat-text');
        }
        plant.timer += attackRate(plant, type.rate);
        animateEntity('plants', plant.id, 'attacking', 300);
        sound('bark');
      }
      continue;
    }
    if (!targets.length || plant.timer > 0) continue;
    const target = targets[0];
    if (type.projectile) {
      const count = plant.type === 'monkey' ? Math.min(2, targets.length) : 1;
      for (let i = 0; i < count; i++) {
        game.projectiles.push({
          id: nextId++, kind: type.projectile, row: plant.row,
          x: plant.x + 28, y: plant.y - 18 + i * 12,
          speed: type.projectile === 'fire' ? 280 : 350,
          damage: type.damage, targetId: targets[i].id,
          poison: plant.type === 'snake', splash: plant.type === 'dragon'
        });
      }
      sound(plant.type === 'snake' ? 'snake' : plant.type === 'monkey' ? 'monkey' : type.projectile === 'fire' ? 'fire' : 'throw');
    } else if (plant.type === 'tiger') {
      damageZombie(target, type.damage);
      spawnEffect('', target.x, target.y, 'slash-effect');
      sound('tiger');
      sound('hit');
    } else if (plant.type === 'ox' || plant.type === 'goat' || plant.type === 'horse') {
      damageZombie(target, type.damage);
      const canKnock = plant.type !== 'ox' && !target.eating && !target.knockbackProtected && game.time >= target.knockbackGraceUntil;
      if (canKnock) {
        target.x += plant.type === 'goat' ? 65 : 48;
        target.knockbackProtected = true;
        target.knockbackGraceUntil = game.time + 4;
        if (plant.type === 'horse') {
          spawnEffect('', (plant.x + target.x) / 2, plant.y, 'charge-effect', Math.max(80, target.x - plant.x));
        }
        spawnEffect(plant.type === 'horse' ? '冲锋！' : '嘿！', target.x, target.y - 35, 'combat-text');
      } else {
        spawnEffect(plant.type === 'horse' ? '突刺！' : '顶！', target.x, target.y - 35, 'combat-text');
      }
      sound(plant.type === 'goat' ? 'goat' : plant.type === 'horse' ? 'horse' : 'ox');
      sound('hit');
    }
    plant.timer += attackRate(plant, type.rate);
    animateEntity('plants', plant.id, 'attacking', 280);
  }
}

function updateProjectiles(dt) {
  const active = new Set();
  for (const projectile of game.projectiles) {
    projectile.x += projectile.speed * dt;
    let target = game.zombies.find(zombie => zombie.id === projectile.targetId);
    if (!target) target = game.zombies.find(zombie => zombie.row === projectile.row && Math.abs(zombie.x - projectile.x) < 24);
    if (target && projectile.x >= target.x - 15) {
      damageZombie(target, projectile.damage);
      if (projectile.poison) {
        target.poisonUntil = game.time + 4;
        target.poisonTick = game.time + .5;
      }
      if (projectile.splash) {
        game.zombies.filter(zombie => zombie.row === target.row && zombie.id !== target.id && Math.abs(zombie.x - target.x) < 115)
          .forEach(zombie => damageZombie(zombie, 24));
      }
      sound('impact');
    } else if (projectile.x < BOARD_W + 40) {
      active.add(projectile.id);
    }
  }
  game.projectiles = game.projectiles.filter(projectile => active.has(projectile.id));
}

function spawnEnemyProjectile(zombie, target, kind = 'acid') {
  const bossShot = kind === 'boss-rock';
  game.enemyProjectiles.push({
    id: nextId++, kind, targetId: target.id,
    x: zombie.x - 25, y: zombie.y - 30,
    speed: bossShot ? 230 : 280,
    damage: bossShot ? 80 : ZOMBIES.spitter.damage
  });
  spawnEffect(bossShot ? '巨石！' : '腐蚀液！', zombie.x, zombie.y - 65, 'combat-text damage');
  sound(bossShot ? 'fire' : 'throw');
}

function updateEnemyProjectiles(dt) {
  const active = new Set();
  for (const projectile of game.enemyProjectiles) {
    const target = game.plants.find(plant => plant.id === projectile.targetId);
    if (!target) continue;
    const dx = target.x - projectile.x;
    const dy = target.y - 20 - projectile.y;
    const distance = Math.hypot(dx, dy);
    const step = projectile.speed * dt;
    if (distance <= step + 22) {
      damagePlant(target, projectile.damage);
      spawnEffect(`-${projectile.damage}`, target.x, target.y - 35, 'combat-text damage');
      sound('impact');
    } else {
      projectile.x += dx / distance * step;
      projectile.y += dy / distance * step;
      active.add(projectile.id);
    }
  }
  game.enemyProjectiles = game.enemyProjectiles.filter(projectile => active.has(projectile.id));
}

function damagePlant(plant, amount) {
  if (!game.plants.includes(plant)) return;
  plant.hp -= amount;
  animateEntity('plants', plant.id, 'hurt', 180);
  if (plant.hp <= 0) removePlant(plant);
}

function updateBossSkill(zombie) {
  if (!zombie.enraged && zombie.hp <= zombie.maxHp * .4) {
    zombie.enraged = true;
    announce('僵尸王暴怒！');
    spawnEffect('暴怒！', zombie.x, zombie.y - 80, 'combat-text damage');
  }
  if (game.time < zombie.nextSkill) return;
  if (zombie.skillCount % 2 === 0 || !game.plants.length) {
    const summonType = zombie.skillCount % 4 === 0 ? 'runner' : 'basic';
    spawnZombie(summonType, (zombie.row + 1) % ROWS, true);
    spawnZombie(summonType, (zombie.row + ROWS - 1) % ROWS, true);
    spawnEffect('召唤援军！', zombie.x, zombie.y - 80, 'combat-text damage');
    sound('wave');
  } else {
    const target = game.plants[Math.floor(Math.random() * game.plants.length)];
    spawnEnemyProjectile(zombie, target, 'boss-rock');
  }
  zombie.skillCount++;
  zombie.nextSkill = game.time + (zombie.enraged ? 4.2 : 7);
}

function moveZombie(zombie, distance) {
  const nextX = zombie.x - distance;
  const blocker = game.plants
    .filter(plant => plant.row === zombie.row && zombie.x > plant.x + 22 && nextX < plant.x + 23)
    .sort((a, b) => b.x - a.x)[0];
  zombie.x = blocker ? blocker.x + 23 : nextX;
}

function updateZombies(dt) {
  for (const zombie of [...game.zombies]) {
    if (zombie.poisonUntil > game.time && game.time >= zombie.poisonTick) {
      zombie.poisonTick += .5;
      damageZombie(zombie, 4);
      if (!game.zombies.includes(zombie)) continue;
    }
    if (zombie.type === 'boss') updateBossSkill(zombie);
    const blockers = game.plants
      .filter(plant => plant.row === zombie.row && zombie.x - plant.x < 48 && zombie.x - plant.x > -22)
      .sort((a, b) => b.x - a.x);
    const blocker = blockers[0];
    const jumped = zombie.type === 'jumper' && blocker && !zombie.jumped;
    const rangedTarget = zombie.type === 'spitter' && !blocker ? game.plants
      .filter(plant => plant.row === zombie.row && plant.x < zombie.x && zombie.x - plant.x <= ZOMBIES.spitter.range)
      .sort((a, b) => b.x - a.x)[0] : null;
    zombie.eating = Boolean(blocker) && !jumped;
    if (jumped) {
      zombie.jumped = true;
      zombie.x = Math.max(35, blocker.x - 65);
      spawnEffect('跳过！', zombie.x, zombie.y - 45, 'combat-text damage');
      sound('throw');
    } else if (rangedTarget) {
      zombie.attackTimer -= dt;
      if (zombie.attackTimer <= 0) {
        spawnEnemyProjectile(zombie, rangedTarget);
        zombie.attackTimer += ZOMBIES.spitter.rate;
      }
    } else if (blocker) {
      zombie.biteTimer -= dt;
      if (zombie.biteTimer <= 0) {
        damagePlant(blocker, zombie.bite);
        zombie.biteTimer += .85;
        if (zombie.type === 'brute') {
          game.plants.filter(plant => plant.id !== blocker.id && plant.row === blocker.row && Math.abs(plant.x - blocker.x) <= 100)
            .forEach(plant => damagePlant(plant, 25));
          spawnEffect('重击！', blocker.x, blocker.y - 40, 'combat-text damage');
        }
        sound('bite');
        if (!game.plants.includes(blocker)) {
          zombie.eating = false;
          zombie.knockbackProtected = false;
        }
      }
    } else {
      const slowed = zombie.slowUntil > game.time;
      const enraged = zombie.type === 'boss' && zombie.enraged ? 1.45 : 1;
      moveZombie(zombie, zombie.speed * (slowed ? .55 : 1) * enraged * dt);
    }
    const baby = game.babies[zombie.row];
    if (zombie.x < 122 && baby && !baby.used) triggerBaby(zombie.row, true);
    if (zombie.x < 20 && game.state === 'running') finishGame(false);
  }
}

function damageZombie(zombie, amount) {
  if (!game.zombies.includes(zombie)) return;
  zombie.hp -= amount;
  animateEntity('zombies', zombie.id, 'hit', 130);
  if (zombie.hp <= 0) {
    game.zombies = game.zombies.filter(item => item.id !== zombie.id);
    game.kills++;
    spawnEffect('', zombie.x, zombie.y + 20, 'dirt-burst');
  }
}

function removePlant(plant) {
  game.plants = game.plants.filter(item => item.id !== plant.id);
  spawnEffect('', plant.x, plant.y + 25, 'dirt-burst');
}

function playBabyVideo(video) {
  if (game.state !== 'running') return;
  video.play().catch(() => {
    video.muted = true;
    video.play().catch(() => {});
    if (game.sound) toast('浏览器阻止了原声，本次以静音播放');
  });
}

function startBabyPerformance(row) {
  const container = document.createElement('div');
  container.className = 'baby-performance';
  container.style.left = pctX(70);
  container.style.top = pctY(Math.max(108, Math.min(BOARD_H - 108, yForRow(row))));
  const video = document.createElement('video');
  video.src = 'assets/baby-laugh.mp4';
  video.playsInline = true;
  video.preload = 'auto';
  video.muted = !game.sound;
  video.setAttribute('aria-label', `第 ${row + 1} 行奶娃捧腹大笑`);
  container.appendChild(video);
  $('babyPerformanceLayer').appendChild(container);
  activeBabyVideos.add(video);
  video.addEventListener('ended', () => {
    activeBabyVideos.delete(video);
    container.remove();
  }, { once: true });
  playBabyVideo(video);
}

function pauseBabyPerformances() {
  activeBabyVideos.forEach(video => video.pause());
}

function resumeBabyPerformances() {
  activeBabyVideos.forEach(playBabyVideo);
}

function stopBabyPerformances() {
  activeBabyVideos.forEach(video => {
    video.pause();
    video.currentTime = 0;
  });
  activeBabyVideos.clear();
  $('babyPerformanceLayer').innerHTML = '';
}

function triggerBaby(row, automatic) {
  if (game.state !== 'running') return;
  const baby = game.babies[row];
  if (!baby || baby.used) return;
  if (!automatic && !game.zombies.some(zombie => zombie.row === row)) {
    toast('这一行暂时没有僵尸，奶娃先保留体力');
    return;
  }
  baby.used = true;
  baby.element.classList.add('laughing');
  baby.element.disabled = true;
  const laugh = document.createElement('div');
  laugh.className = 'laugh-wave';
  laugh.style.top = pctY(yForRow(row));
  laugh.textContent = '哈哈哈哈！';
  $('effectLayer').appendChild(laugh);
  setTimeout(() => laugh.remove(), 950);
  startBabyPerformance(row);
  [...game.zombies].filter(zombie => zombie.row === row).forEach(zombie => damageZombie(zombie, 99999));
  $('statusText').textContent = automatic ? `第 ${row + 1} 行奶娃自动触发大笑，防线已清空` : `第 ${row + 1} 行奶娃捧腹大笑，僵尸全被笑跑了`;
  setTimeout(() => {
    baby.element.classList.remove('laughing');
    baby.element.classList.add('used');
  }, 750);
  render();
}

function finishGame(won) {
  if (game.state !== 'running') return;
  game.state = won ? 'won' : 'lost';
  game.selected = null;
  stopBabyPerformances();
  updatePauseButton();
  sound(won ? 'win' : 'lose');
  const title = won ? '小院守住了！' : '僵尸闯进奶家了';
  const copy = won ? '奶家人齐心协力，击退了全部五波僵尸。' : '别灰心，多种奶蛋发展奶黄，把奶虎和奶牛放在前排。';
  showModal(`
    <span class="modal-kicker">${won ? '守护成功' : '本局结束'}</span>
    <h2>${title}</h2>
    <p>${copy}</p>
    <div class="result-stats">
      <div><strong>${game.kills}</strong><span>击退僵尸</span></div>
      <div><strong>${game.collected}</strong><span>收集奶黄</span></div>
      <div><strong>${game.placed}</strong><span>放置角色</span></div>
    </div>
    <div class="modal-actions"><button class="primary-button" id="againButton">再玩一局<svg><use href="#i-restart"></use></svg></button></div>`, 'compact');
  $('againButton').addEventListener('click', startGame);
}

function syncCollection(kind, items, create, updateElement) {
  const map = entityDom[kind];
  const alive = new Set(items.map(item => item.id));
  for (const [id, element] of map) {
    if (!alive.has(id)) {
      element.remove();
      map.delete(id);
    }
  }
  for (const item of items) {
    let element = map.get(item.id);
    if (!element) {
      element = create(item);
      map.set(item.id, element);
      layers[kind].appendChild(element);
    }
    updateElement(element, item);
  }
}

function setEntityPosition(element, entity) {
  element.style.left = pctX(entity.x);
  element.style.top = pctY(entity.y);
}

function updateHealth(element, entity) {
  const ratio = Math.max(0, entity.hp / entity.maxHp);
  const track = element.querySelector('.health-track');
  track.classList.toggle('damaged', ratio < .999);
  element.querySelector('.health-fill').style.width = `${ratio * 100}%`;
}

function render() {
  syncCollection('plants', game.plants, plant => {
    const element = document.createElement('div');
    element.className = `entity plant ${plant.type}`;
    element.innerHTML = `<img src="assets/${plant.type}.png" alt="${TYPES[plant.type].name}"><div class="health-track"><div class="health-fill"></div></div>`;
    setEntityPosition(element, plant);
    return element;
  }, (element, plant) => updateHealth(element, plant));

  syncCollection('zombies', game.zombies, zombie => {
    const element = document.createElement('div');
    element.className = `entity zombie ${zombie.type}`;
    element.innerHTML = `<div class="armor"></div><img src="assets/zombie.png" alt="${ZOMBIES[zombie.type].name}"><div class="health-track"><div class="health-fill"></div></div>`;
    setEntityPosition(element, zombie);
    return element;
  }, (element, zombie) => {
    setEntityPosition(element, zombie);
    if (zombie.type === 'boss') element.style.top = pctY(Math.max(110, Math.min(BOARD_H - 110, zombie.y)));
    if (zombie.type === 'brute') element.style.top = pctY(Math.max(85, Math.min(BOARD_H - 85, zombie.y)));
    element.classList.toggle('eating', zombie.eating);
    element.classList.toggle('enraged', zombie.enraged);
    updateHealth(element, zombie);
  });

  syncCollection('projectiles', game.projectiles, projectile => {
    const element = document.createElement('div');
    element.className = `projectile ${projectile.kind}`;
    return element;
  }, setEntityPosition);

  syncCollection('enemyProjectiles', game.enemyProjectiles, projectile => {
    const element = document.createElement('div');
    element.className = `enemy-projectile ${projectile.kind}`;
    return element;
  }, setEntityPosition);

  syncCollection('custards', game.custards, drop => {
    const element = document.createElement('button');
    element.className = 'custard-drop';
    element.title = `收集 ${drop.value} 奶黄`;
    element.innerHTML = `<svg><use href="#i-custard"></use></svg><span>${drop.value}</span>`;
    element.addEventListener('click', event => {
      event.stopPropagation();
      collectCustard(drop.id);
    });
    return element;
  }, setEntityPosition);

  $('custardCount').textContent = game.custard;
  $('waveLabel').textContent = `第 ${Math.max(0, game.wave) + 1} / ${LEVEL.length} 波`;
  $('levelProgress').style.width = `${game.kills / game.total * 100}%`;
  $('progressText').textContent = `${game.kills} / ${game.total}`;
  const boss = game.zombies.find(zombie => zombie.type === 'boss');
  $('bossHud').classList.toggle('visible', Boolean(boss));
  if (boss) {
    $('bossHealthFill').style.width = `${Math.max(0, boss.hp / boss.maxHp * 100)}%`;
    $('bossPhase').textContent = boss.enraged ? '暴怒：加速移动 · 技能更频繁' : '召唤援军 · 远程压制';
  }
  updateCards();
}

function updateCards() {
  for (const [key, card] of cardDom) {
    const cooling = game.cooldowns[key] > .05;
    card.classList.toggle('selected', game.selected === key);
    card.classList.toggle('cooling', cooling);
    card.classList.toggle('unaffordable', game.custard < TYPES[key].cost);
    const ratio = cooling ? game.cooldowns[key] / TYPES[key].cooldown : 0;
    card.querySelector('.cooldown-mask').style.height = `${ratio * 100}%`;
    card.querySelector('.cooldown-text').textContent = cooling ? Math.ceil(game.cooldowns[key]) : '';
  }
}

function animateEntity(kind, id, className, duration) {
  const element = entityDom[kind].get(id);
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  setTimeout(() => element.classList.remove(className), duration);
}

function spawnEffect(text, x, y, className, width) {
  const effect = document.createElement('div');
  effect.className = className;
  effect.style.left = pctX(x);
  effect.style.top = pctY(y);
  if (width) effect.style.width = pctX(width);
  effect.textContent = text;
  $('effectLayer').appendChild(effect);
  setTimeout(() => effect.remove(), 1000);
}

function announce(text) {
  const banner = $('waveBanner');
  banner.textContent = text;
  banner.classList.remove('show');
  void banner.offsetWidth;
  banner.classList.add('show');
}

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').classList.add('show');
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2200);
}

function shakeCard(key) {
  const card = cardDom.get(key);
  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
}

function showModal(content, className = '') {
  $('modal').innerHTML = `<div class="modal-card ${className}">${content}</div>`;
  $('modal').classList.add('visible');
}

function hideModal() { $('modal').classList.remove('visible'); }

function showStart() {
  showModal(`
    <div class="modal-art"><img class="hero-rat" src="assets/rat.png" alt="奶鼠"><img class="hero-egg" src="assets/egg.png" alt="奶蛋"><img class="hero-dragon" src="assets/dragon.png" alt="奶龙"></div>
    <span class="modal-kicker">奶家小院 · 第一关</span>
    <h2>奶家人，集合！</h2>
    <p>收集奶黄，种下奶家人，守住五行小院。</p>
    <div class="start-rules"><span><b>01</b>奶蛋持续产奶黄</span><span><b>02</b>十二生肖各怀本领</span><span><b>03</b>奶娃大笑清空一行</span></div>
    <button id="startButton" class="primary-button">开始守护<svg><use href="#i-play"></use></svg></button>
    <small>鼠标操作 · 空格暂停 · 支持 2 倍速</small>`, 'start-card');
  $('startButton').addEventListener('click', startGame);
}

function togglePause() {
  if (game.state === 'running') {
    game.state = 'paused';
    pauseBabyPerformances();
    updatePauseButton();
    showModal(`
      <span class="modal-kicker">休息一下</span><h2>游戏已暂停</h2><p>奶家人和僵尸都在原地等你。</p>
      <div class="modal-actions"><button class="primary-button" id="resumeButton">继续游戏<svg><use href="#i-play"></use></svg></button><button class="secondary-button" id="pauseRestart">重新开局</button></div>
      <small>按空格也可以继续</small>`, 'compact');
    $('resumeButton').addEventListener('click', resumeGame);
    $('pauseRestart').addEventListener('click', startGame);
  } else if (game.state === 'paused') {
    resumeGame();
  }
}

function resumeGame() {
  game.state = 'running';
  hideModal();
  updatePauseButton();
  resumeBabyPerformances();
  lastFrame = performance.now();
}

function updatePauseButton() {
  const paused = game.state === 'paused';
  $('pauseButton').innerHTML = `<svg><use href="#i-${paused ? 'play' : 'pause'}"></use></svg><span>${paused ? '继续' : '暂停'}</span>`;
}

function showHelp() {
  const previous = game.state;
  if (previous === 'running') {
    game.state = 'paused';
    pauseBabyPerformances();
  }
  showModal(`
    <span class="modal-kicker">玩法说明</span><h2>守护奶家小院</h2>
    <div class="help-list">
      <div><strong>收集与放置</strong><br>点击发光的奶黄收集资源。选择左侧卡牌，再点击空草地放置；小铲子可移除角色。</div>
      <div><strong>奶娃的最后防线</strong><br>每行奶娃都可点击触发捧腹大笑，清空本行僵尸；僵尸突破时也会自动触发。每次只能用一次。</div>
      <div><strong>阵容搭配</strong><br>奶蛋与奶猪发展经济，奶牛与奶虎守前排，奶鸡提升本行攻速，奶兔治疗周围伙伴。</div>
      <div><strong>快捷键</strong><br>空格暂停或继续，数字 1 / 2 切换速度，Esc 或鼠标右键取消选择。</div>
    </div>
    <button class="primary-button" id="helpClose">知道了</button>`, 'compact');
  $('helpClose').addEventListener('click', () => {
    if (previous === 'ready') showStart();
    else if (previous === 'won' || previous === 'lost') {
      game.state = 'running';
      finishGame(previous === 'won');
    } else {
      game.state = previous === 'paused' ? 'paused' : 'running';
      if (game.state === 'paused') {
        game.state = 'running';
        togglePause();
      } else {
        hideModal();
        resumeBabyPerformances();
      }
    }
    updatePauseButton();
    lastFrame = performance.now();
  });
}

function initAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
}

function tone(frequency, duration, type = 'sine', volume = .025, delay = 0) {
  if (!game.sound || !audioContext) return;
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function sound(name) {
  if (!game.sound) return;
  const sounds = {
    select: () => tone(440, .06, 'sine', .015),
    deny: () => tone(150, .14, 'square', .015),
    plant: () => { tone(220, .09, 'sine'); tone(330, .12, 'sine', .025, .07); },
    collect: () => { tone(660, .1, 'sine'); tone(880, .15, 'sine', .025, .07); },
    produce: () => tone(520, .12, 'sine', .012),
    throw: () => tone(240, .06, 'triangle', .009),
    fire: () => tone(120, .18, 'sawtooth', .015),
    snake: () => { tone(310, .06, 'sawtooth', .011); tone(180, .1, 'triangle', .008, .045); },
    monkey: () => { tone(700, .035, 'triangle', .008); tone(900, .045, 'triangle', .007, .055); },
    tiger: () => { tone(190, .07, 'sawtooth', .012); tone(120, .1, 'triangle', .01, .05); },
    ox: () => { tone(112, .17, 'sawtooth', .012); tone(82, .2, 'triangle', .01, .09); },
    goat: () => { tone(500, .06, 'square', .008); tone(410, .09, 'square', .009, .07); },
    horse: () => { tone(250, .08, 'sawtooth', .011); tone(370, .12, 'triangle', .009, .07); },
    impact: () => tone(110, .045, 'square', .007),
    hit: () => tone(95, .09, 'triangle', .018),
    bite: () => tone(85, .06, 'sawtooth', .006),
    heal: () => { tone(520, .15, 'sine', .015); tone(690, .18, 'sine', .015, .08); },
    bark: () => { tone(180, .08, 'square', .012); tone(140, .1, 'square', .012, .1); },
    shovel: () => tone(190, .12, 'triangle'),
    wave: () => { tone(220, .18, 'triangle'); tone(330, .2, 'triangle', .025, .13); },
    start: () => { tone(330, .12); tone(440, .12, 'sine', .025, .1); tone(660, .2, 'sine', .025, .2); },
    win: () => [523, 659, 784, 1047].forEach((freq, i) => tone(freq, .3, 'sine', .025, i * .13)),
    lose: () => [300, 240, 180].forEach((freq, i) => tone(freq, .3, 'triangle', .025, i * .18))
  };
  sounds[name]?.();
}

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, .05);
  lastFrame = now;
  if (game.state === 'running') {
    update(dt * game.speed);
    render();
  }
  requestAnimationFrame(frame);
}

$('shovelButton').addEventListener('click', () => {
  if (game.state !== 'running') return;
  game.selected = game.selected === 'shovel' ? null : 'shovel';
  $('shovelButton').classList.toggle('selected', game.selected === 'shovel');
  $('statusText').textContent = game.selected ? '点击一个已放置的奶家人将其移除' : '已取消选择';
  updateCards();
});
$('pauseButton').addEventListener('click', togglePause);
$('restartButton').addEventListener('click', startGame);
$('helpButton').addEventListener('click', showHelp);
$('speedButton').addEventListener('click', () => {
  game.speed = game.speed === 1 ? 2 : 1;
  $('speedButton').textContent = `${game.speed}×`;
  toast(`游戏速度已切换为 ${game.speed} 倍`);
});
$('soundButton').addEventListener('click', () => {
  game.sound = !game.sound;
  if (game.sound) initAudio();
  activeBabyVideos.forEach(video => { video.muted = !game.sound; });
  $('soundButton').innerHTML = `<svg><use href="#i-${game.sound ? 'sound' : 'muted'}"></use></svg>`;
  $('soundButton').title = game.sound ? '关闭声音' : '打开声音';
});
$('board').addEventListener('contextmenu', event => {
  event.preventDefault();
  game.selected = null;
  $('shovelButton').classList.remove('selected');
  updateCards();
});
document.addEventListener('keydown', event => {
  if (event.code === 'Space' && !event.repeat) {
    event.preventDefault();
    togglePause();
  }
  if (event.key === '1' || event.key === '2') {
    game.speed = Number(event.key);
    $('speedButton').textContent = `${game.speed}×`;
  }
  if (event.key === 'Escape') {
    game.selected = null;
    $('shovelButton').classList.remove('selected');
    updateCards();
  }
});

initGrid();
initCards();
resetGame(false);
requestAnimationFrame(frame);
