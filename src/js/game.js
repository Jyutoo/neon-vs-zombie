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
  basic: { name: '奶豆', image: 'assets/enemies/naidou.png', hp: 190, speed: 11, bite: 24 },
  cone: { name: '肥嘟嘟', image: 'assets/enemies/feidudu.png', hp: 325, speed: 11, bite: 27 },
  bucket: { name: '牛来', image: 'assets/enemies/niulai.png', hp: 525, speed: 9, bite: 31 },
  runner: { name: '豆脚', image: 'assets/enemies/doujiao.png', hp: 155, speed: 16, bite: 22 },
  brute: { name: '唐包', image: 'assets/enemies/tangbao.png', hp: 1100, speed: 5.5, bite: 60 },
  spitter: { name: '噜噜', image: 'assets/enemies/lulu.png', hp: 260, speed: 8, bite: 24, range: 340, rate: 2.8, damage: 35 },
  jumper: { name: '咕咕嘎嘎', image: 'assets/enemies/gugugaga.png', hp: 190, speed: 20, bite: 26 },
  boss: { name: '奶康', image: 'assets/enemies/naikang.png', hp: 4200, speed: 3.8, bite: 70 }
};

const LAUGH_DAMAGE = { brute: 650, boss: 1400 };
const DEATH_DURATION = { basic: 850, cone: 850, bucket: 850, runner: 850, spitter: 850, jumper: 850, brute: 1050, boss: 1400 };

const STARTING_UNITS = ProgressStore.STARTING_UNITS;
const UNIT_ORDER = ['egg', 'snake', 'ox', 'monkey', 'rat', 'rabbit', 'dog', 'tiger', 'goat', 'rooster', 'pig', 'horse', 'dragon'];
const CHARACTER_UNLOCK_LEVELS = ProgressStore.CHARACTER_UNLOCK_LEVELS;
const MAX_LEVEL = ProgressStore.MAX_LEVEL;
function levelWaveCount(level) {
  if (level <= 3) return 5;
  if (level <= 6) return 6;
  if (level <= 9) return 7;
  if (level <= 11) return 8;
  return 10; // level 12
}

function levelWaveConfig(level) {
  const count = levelWaveCount(level);
  const starts = [];
  const intervals = [];
  for (let i = 0; i < count; i++) {
    starts.push(12 + i * 36);
    intervals.push(Math.max(4, 8 - i * 0.4));
  }
  return { starts, intervals };
}

function saveProgress() {
  ProgressStore.save(progress);
}

let progress = ProgressStore.load();
let homeTrackStart = 1;
let lastResult = null;

function isUnlocked(key) {
  return ProgressStore.isCharacterUnlocked(key, progress);
}

function checkCharacterUnlocks() {
  let newUnlocks = [];
  for (const [char, level] of Object.entries(CHARACTER_UNLOCK_LEVELS)) {
    if (progress.highestCleared >= level && !progress.unlocked.includes(char)) {
      progress.unlocked.push(char);
      newUnlocks.push(TYPES[char].name);
    }
  }
  if (newUnlocks.length > 0) {
    saveProgress();
    toast(`解锁新角色：${newUnlocks.join('、')}`);
  }
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function levelScaling(level) {
  return {
    hp: Math.pow(1.15, level - 1),
    speed: Math.min(1.35, 1 + (level - 1) * .025),
    bite: Math.min(1.8, 1 + Math.max(0, level - 3) * .035)
  };
}

function enemyPoolForLevel(level, waveIndex) {
  if (waveIndex === 0) return ['basic', 'basic', 'cone'];
  const pool = ['basic', 'basic', 'cone'];
  if (level >= 2) pool.push('runner');
  if (level >= 3) pool.push('bucket');
  if (level >= 4) pool.push('jumper');
  if (level >= 5) pool.push('spitter');
  if (level >= 6) pool.push('brute');
  return waveIndex < 2 ? pool.filter(type => type !== 'brute') : pool;
}

function levelWaves(level) {
  const random = seededRandom(level * 7919 + 13);
  const waveCount = levelWaveCount(level);
  const config = levelWaveConfig(level);
  const waves = [];

  for (let waveIndex = 0; waveIndex < waveCount; waveIndex++) {
    const pool = enemyPoolForLevel(level, waveIndex);
    const baseCount = 3 + Math.floor(waveIndex * 1.2);
    const types = [];
    for (let i = 0; i < baseCount; i++) {
      types.push(pool[Math.floor(random() * pool.length)]);
    }
    // Boss only on level 12, last wave
    if (level === 12 && waveIndex === waveCount - 1) types.push('boss');
    waves.push({ start: config.starts[waveIndex], interval: config.intervals[waveIndex], types });
  }
  return waves;
}

function enemyTypesForLevel(level) {
  const types = ['basic', 'cone'];
  if (level >= 2) types.push('runner');
  if (level >= 3) types.push('bucket');
  if (level >= 4) types.push('jumper');
  if (level >= 5) types.push('spitter');
  if (level >= 6) types.push('brute');
  if (level === 12) types.push('boss');
  return types;
}

function firstClearReward(level) {
  return 50 + (level - 1) * 15;
}

function repeatReward(level) {
  return Math.max(10, Math.floor(firstClearReward(level) * .3));
}

function difficultyLabel(level) {
  if (level === 12) return 'BOSS 关';
  if (level <= 3) return '入门';
  if (level <= 6) return '进阶';
  if (level <= 9) return '中级';
  if (level <= 11) return '高级';
  return '最终BOSS';
}

function getUpgradeMultiplier(totalLevels, percentPerLevel) {
  return 1 + (totalLevels * percentPerLevel / 100);
}

function applyModeAUpgrades() {
  const upgrades = progress.upgrades || {};
  return {
    babyUses: 1 + (upgrades.egg || 0),
    babyDamageMul: getUpgradeMultiplier(
      (upgrades.ox || 0) + (upgrades.tiger || 0) + (upgrades.monkey || 0), 15
    ),
    babyDotMul: getUpgradeMultiplier(
      (upgrades.snake || 0) + (upgrades.dragon || 0), 20
    ),
    babyHealPerUse: ((upgrades.horse || 0) + (upgrades.goat || 0)) * 10,
    babyShieldPerUse: ((upgrades.dog || 0) + (upgrades.pig || 0)) * 20,
    babyCooldownMul: 1 - Math.min(0.7,
      ((upgrades.rat || 0) + (upgrades.rabbit || 0) + (upgrades.rooster || 0)) * 0.1
    )
  };
}

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
const activeBabyRenderers = new Map();
// 裁切框是 baby-laugh.mp4 的原始像素坐标（592×1280 手机录屏），
// 取这个矩形是为了同时躲开状态栏、录屏胶囊、底部"停止"按钮和左边缘 1px 黑边。
const BABY_VIDEO_CROP = { x: 48, y: 304, width: 504, height: 696 };
const BABY_CANVAS_WIDTH = 176;
const BABY_CANVAS_HEIGHT = 243;
let noiseBuffer;
let lastFrame = performance.now();
let cardPress = null;
let dragState = null;
let dragClickUntil = 0;

const game = {
  state: 'ready',
  levelIndex: progress.selectedLevel,
  waves: [],
  scaling: levelScaling(progress.selectedLevel),
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
  total: 0,
  spawned: 0,
  kills: 0,
  collected: 0,
  placed: 0,
  wave: -1,
  naturalTimer: 5
};

function buildQueue(waves) {
  return waves.flatMap((wave, waveIndex) => wave.types.map((type, index) => ({
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
function zombieOccupiesRow(zombie, row) {
  return zombie.row === row || (zombie.type === 'boss' && zombie.row + 1 === row);
}
function zombieLaneRows(zombie) {
  return zombie.type === 'boss' ? [zombie.row, zombie.row + 1] : [zombie.row];
}

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
  UNIT_ORDER.forEach(key => {
    const type = TYPES[key];
    const card = document.createElement('button');
    card.className = 'unit-card';
    card.dataset.type = key;
    card.innerHTML = `
      <img src="assets/${key}.png" alt="${type.name}" draggable="false">
      <span class="card-name">${type.name}</span>
      <span class="card-role">${type.role}</span>
      <span class="card-cost">${type.cost}</span>
      <span class="cooldown-mask"></span>
      <span class="cooldown-text"></span>
      <span class="card-lock"><svg><use href="#i-lock"></use></svg>未解锁</span>`;
    card.addEventListener('pointerdown', event => beginCardPress(event, key, card));
    card.addEventListener('click', () => {
      if (performance.now() < dragClickUntil) return;
      selectUnit(key);
    });
    card.addEventListener('dragstart', event => event.preventDefault());
    card.addEventListener('mouseenter', () => {
      if (!dragState) showUnitDetail(key);
    });
    $('cardGrid').appendChild(card);
    cardDom.set(key, card);
    game.cooldowns[key] = 0;
  });
  applyCardLocks();
}

function applyCardLocks() {
  cardDom.forEach((card, key) => {
    const locked = !isUnlocked(key);
    card.classList.toggle('locked', locked);
    card.setAttribute('aria-disabled', String(locked));
    card.title = locked && CHARACTER_UNLOCK_LEVELS[key] ? `通关第 ${CHARACTER_UNLOCK_LEVELS[key]} 关解锁${TYPES[key].name}` : '';
  });
  $('unitCount').textContent = `可用 ${progress.unlocked.length} / ${Object.keys(TYPES).length}`;
}

function beginCardPress(event, key, card) {
  if (event.button !== 0 || event.isPrimary === false || game.state !== 'running' || !isUnlocked(key)) return;
  cardPress = { key, card, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
}

function startCardDrag(event) {
  if (!cardPress || game.state !== 'running' || !isUnlocked(cardPress.key)) return cancelCardDrag();
  const { key, card } = cardPress;
  const type = TYPES[key];
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.innerHTML = `<img src="assets/${key}.png" alt="" draggable="false">`;
  document.body.appendChild(ghost);
  document.body.classList.add('is-card-dragging');
  card.classList.add('dragging');
  game.selected = null;
  $('shovelButton').classList.remove('selected');
  showUnitDetail(key);
  updateCards();
  $('statusText').textContent = `拖动${type.name}到空草地，松手即可种植`;
  sound('select');
  dragState = { ...cardPress, active: true, ghost, cell: null, row: -1, col: -1, valid: false, issue: '' };
  updateCardDrag(event);
}

function cellFromPoint(clientX, clientY) {
  const grid = $('grid');
  const rect = grid.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
  const col = Math.min(COLS - 1, Math.max(0, Math.floor((clientX - rect.left) / rect.width * COLS)));
  const row = Math.min(ROWS - 1, Math.max(0, Math.floor((clientY - rect.top) / rect.height * ROWS)));
  return { row, col, cell: grid.children[row * COLS + col] };
}

function clearDropHighlights() {
  document.querySelectorAll('.cell.drop-valid, .cell.drop-invalid').forEach(cell => {
    cell.classList.remove('drop-valid', 'drop-invalid');
  });
}

function updateCardDrag(event) {
  if (!dragState) return;
  dragState.ghost.style.left = `${event.clientX}px`;
  dragState.ghost.style.top = `${event.clientY}px`;
  const target = cellFromPoint(event.clientX, event.clientY);
  clearDropHighlights();
  dragState.cell = target?.cell || null;
  dragState.row = target?.row ?? -1;
  dragState.col = target?.col ?? -1;
  if (!target) {
    dragState.valid = false;
    dragState.issue = '拖到草地上才能种植';
    dragState.deny = false;
  } else {
    const problem = placementProblem(dragState.key, target.row, target.col);
    dragState.valid = !problem;
    dragState.issue = problem?.message || '';
    dragState.deny = Boolean(problem?.deny);
    target.cell.classList.add(problem ? 'drop-invalid' : 'drop-valid');
  }
  dragState.ghost.classList.toggle('invalid', !dragState.valid);
  dragState.ghost.dataset.hint = dragState.valid ? '' : dragState.issue;
}

function finishCardDrag(event) {
  if (!dragState) return;
  updateCardDrag(event);
  const finished = dragState;
  dragState = null;
  cardPress = null;
  dragClickUntil = performance.now() + 250;
  finished.ghost.remove();
  finished.card.classList.remove('dragging');
  document.body.classList.remove('is-card-dragging');
  clearDropHighlights();
  if (finished.valid) {
    placeUnit(finished.key, finished.row, finished.col);
  } else {
    toast(finished.issue || '这里不能种植');
    if (finished.deny) {
      shakeCard(finished.key);
      sound('deny');
    }
    $('statusText').textContent = '拖动卡牌到空草地即可种植';
  }
  updateCards();
}

function cancelCardDrag() {
  if (dragState) {
    dragState.ghost.remove();
    dragState.card.classList.remove('dragging');
    clearDropHighlights();
    dragClickUntil = performance.now() + 250;
  }
  dragState = null;
  cardPress = null;
  document.body.classList.remove('is-card-dragging');
  updateCards();
}

window.addEventListener('pointermove', event => {
  if (!cardPress) return;
  if (event.pointerId !== cardPress.pointerId) return;
  if (!dragState) {
    if (Math.hypot(event.clientX - cardPress.startX, event.clientY - cardPress.startY) < 6) return;
    startCardDrag(event);
  }
  event.preventDefault();
  updateCardDrag(event);
}, { passive: false });
window.addEventListener('pointerup', event => {
  if (!cardPress || event.pointerId !== cardPress.pointerId) return;
  if (dragState) finishCardDrag(event);
  else cardPress = null;
});
window.addEventListener('pointercancel', () => cancelCardDrag());
window.addEventListener('blur', () => cancelCardDrag());
document.addEventListener('click', event => {
  if (performance.now() >= dragClickUntil) return;
  event.preventDefault();
  event.stopPropagation();
}, true);

function showUnitDetail(key) {
  const type = TYPES[key];
  if (!isUnlocked(key)) {
    $('unitDetail').innerHTML = `
      <div class="detail-title"><strong>${type.name}</strong><span>${type.role}</span></div>
      <p>${type.description}</p>
      <div class="detail-stats"><span>未解锁</span><span>通关第 ${CHARACTER_UNLOCK_LEVELS[key]} 关解锁</span></div>`;
    return;
  }
  $('unitDetail').innerHTML = `
    <div class="detail-title"><strong>${type.name}</strong><span>${type.role}</span></div>
    <p>${type.description}</p>
    <div class="detail-stats"><span>耐久 ${type.hp}</span><span>冷却 ${type.cooldown} 秒</span></div>`;
}

function selectUnit(key) {
  if (game.state !== 'running') return;
  const type = TYPES[key];
  showUnitDetail(key);
  if (!isUnlocked(key)) {
    toast(`${type.name}尚未解锁，通关第 ${CHARACTER_UNLOCK_LEVELS[key]} 关后解锁`);
    shakeCard(key);
    sound('deny');
    return;
  }
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
  $('statusText').textContent = game.selected ? `已选择${type.name}，拖到草地或点击空格放置` : '已取消选择';
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

function placementProblem(key, row, col) {
  if (game.state !== 'running') return { message: '游戏暂停中，先继续游戏吧' };
  if (!isUnlocked(key)) return { message: `${TYPES[key].name}尚未解锁，先去主页解锁`, deny: true };
  const type = TYPES[key];
  if (plantAt(row, col)) return { message: '这里已经有奶家人了' };
  if (game.cooldowns[key] > 0) {
    return { message: `${type.name}还在休息，${Math.ceil(game.cooldowns[key])} 秒后可用`, deny: true };
  }
  if (game.custard < type.cost) {
    return { message: `奶黄不足，还需要 ${type.cost - game.custard}`, deny: true };
  }
  return null;
}

function placeUnit(key, row, col) {
  const problem = placementProblem(key, row, col);
  if (problem) {
    toast(problem.message);
    if (problem.deny) {
      shakeCard(key);
      sound('deny');
    }
    return false;
  }
  const type = TYPES[key];
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
  $('shovelButton').classList.remove('selected');
  $('statusText').textContent = `${type.name}已就位，继续布置防线吧`;
  spawnEffect('', xForCol(col), yForRow(row) + 30, 'dirt-burst');
  sound('plant');
  render();
  return true;
}

function useCell(row, col) {
  if (performance.now() < dragClickUntil) return;
  if (game.state !== 'running' || !game.selected) {
    if (game.state === 'running') toast('拖动卡牌到空草地即可种植');
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
  placeUnit(game.selected, row, col);
}

function plantAt(row, col) {
  return game.plants.find(plant => plant.row === row && plant.col === col);
}

function resetGame(autostart = false, level = progress.selectedLevel) {
  nextId = 1;
  cancelCardDrag();
  dragClickUntil = 0;
  lastResult = null;
  const waves = levelWaves(level);
  const queue = buildQueue(waves);
  const startCustard = Math.max(150, progress.custard);
  if (startCustard > progress.custard) {
    progress.custard = startCustard;
    saveProgress();
  }
  Object.assign(game, {
    state: autostart ? 'running' : 'ready',
    levelIndex: level,
    waves,
    scaling: levelScaling(level),
    time: 0, custard: startCustard, speed: 1,
    plants: [], zombies: [], projectiles: [], enemyProjectiles: [], custards: [], babies: [],
    selected: null, queue, spawned: 0, kills: 0,
    collected: 0, placed: 0, wave: -1, naturalTimer: 5,
    total: queue.length
  });
  Object.keys(game.cooldowns).forEach(key => game.cooldowns[key] = 0);
  stopBabyPerformances();
  $('babyLayer').innerHTML = '';
  $('effectLayer').innerHTML = '';
  const upgradeEffects = applyModeAUpgrades();
  for (let row = 0; row < ROWS; row++) {
    const baby = { row, usesLeft: upgradeEffects.babyUses, maxUses: upgradeEffects.babyUses, cooldownUntil: 0, element: document.createElement('button') };
    baby.element.className = 'baby-button';
    baby.element.style.left = pctX(62);
    baby.element.style.top = pctY(yForRow(row));
    baby.element.innerHTML = `<img src="assets/baby-glance.png" alt="第 ${row + 1} 行奶娃">`;
    baby.element.title = `奶娃 (${baby.usesLeft}/${baby.maxUses} 次)`;
    baby.element.addEventListener('click', () => triggerBaby(row, false));
    $('babyLayer').appendChild(baby.element);
    game.babies.push(baby);
  }
  $('speedButton').textContent = '1×';
  $('shovelButton').classList.remove('selected');
  $('statusText').textContent = '先放奶蛋攒奶黄，再布置攻击角色';
  $('brandLevel').textContent = `第 ${level} 关`;
  applyCardLocks();
  hideModal();
  updatePauseButton();
  render();
  lastFrame = performance.now();
  if (autostart) hideHome(); else showHome();
}

function startLevel(level) {
  const target = Math.max(1, Math.floor(Number(level) || 1));
  if (target > MAX_LEVEL) {
    toast(`第 ${MAX_LEVEL} 关就是最终关，可以重复挑战`);
    sound('deny');
    return;
  }
  if (target > progress.highestCleared + 1) {
    toast(`先通关第 ${nextChallengeLevel()} 关才能继续`);
    sound('deny');
    return;
  }
  progress.selectedLevel = target;
  saveProgress();
  resetGame(true, target);
  initAudio();
  sound('start');
  toast(`第 ${target} 关开始：先种奶蛋，收集奶黄`);
}

function restartLevel() {
  startLevel(game.levelIndex || progress.selectedLevel);
}

function showHome() {
  game.state = 'ready';
  hideModal();
  document.body.classList.add('home-open');
  $('homeScreen').classList.add('visible');
  const maxLevel = maxDisplayLevel();
  homeTrackStart = Math.max(1, Math.min(progress.selectedLevel - 4, Math.max(1, maxLevel - 9)));
  renderHome();
  updatePauseButton();
  lastFrame = performance.now();
}

function hideHome() {
  $('homeScreen').classList.remove('visible');
  document.body.classList.remove('home-open');
}

function leaveToHome() {
  if (game.state === 'running') {
    progress.custard = game.custard;
    saveProgress();
  }
  resetGame(false);
  sound('select');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 300);
}

function maxDisplayLevel() {
  return MAX_LEVEL;
}

function nextChallengeLevel() {
  return Math.min(MAX_LEVEL, progress.highestCleared + 1);
}

function renderHome() {
  $('homeCoins').textContent = progress.custard;
  $('homeCleared').textContent = progress.highestCleared;
  $('homeUnlocked').textContent = progress.unlocked.length;
  $('homeRosterCount').textContent = progress.unlocked.length;
  $('homeNextLevel').textContent = nextChallengeLevel();
  renderLevelTrack();
  renderLevelPreview();
  renderRoster();
  applyCardLocks();
}

function renderLevelTrack() {
  const maxLevel = maxDisplayLevel();
  const maxStart = Math.max(1, maxLevel - 9);
  homeTrackStart = Math.max(1, Math.min(homeTrackStart, maxStart));
  const end = Math.min(maxLevel, homeTrackStart + 9);
  $('trackRange').textContent = `第 ${homeTrackStart} – ${end} 关`;
  $('trackPrev').disabled = homeTrackStart <= 1;
  $('trackNext').disabled = end >= maxLevel;
  const nodes = [];
  for (let level = homeTrackStart; level <= end; level++) {
    const cleared = level <= progress.highestCleared;
    const current = level === progress.highestCleared + 1;
    const locked = level > progress.highestCleared + 1;
    const selected = level === progress.selectedLevel;
    const boss = level === MAX_LEVEL;
    const reward = cleared ? repeatReward(level) : firstClearReward(level);
    const status = cleared
      ? '<span class="node-status"><svg><use href="#i-check"></use></svg>已通关</span>'
      : current
        ? '<span class="node-status">待挑战</span>'
        : '<span class="node-status">未解锁</span>';
    const rewardMarkup = locked
      ? '<span class="node-lock"><svg><use href="#i-lock"></use></svg></span>'
      : `<span class="node-reward"><svg><use href="#i-coin"></use></svg>+${reward}</span>`;
    nodes.push(`
      <button class="level-node ${cleared ? 'cleared' : ''} ${current ? 'current' : ''} ${locked ? 'locked' : ''} ${selected ? 'selected' : ''}" data-level="${level}" aria-label="第 ${level} 关${locked ? '，未解锁' : cleared ? '，已通关' : '，待挑战'}">
        ${boss ? '<span class="node-boss">BOSS</span>' : ''}
        <span class="node-index">LEVEL ${String(level).padStart(2, '0')}</span>
        <strong class="node-title">第 ${level} 关</strong>
        ${status}
        ${rewardMarkup}
      </button>`);
  }
  $('levelTrack').innerHTML = nodes.join('');
  requestAnimationFrame(() => {
    const selectedNode = $('levelTrack').querySelector(`[data-level="${progress.selectedLevel}"]`);
    if (selectedNode) selectedNode.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
}

function renderLevelPreview() {
  const level = progress.selectedLevel;
  const firstClear = level === progress.highestCleared + 1;
  const reward = firstClear ? firstClearReward(level) : repeatReward(level);
  const boss = level === 12;
  const scaling = levelScaling(level);
  const enemies = enemyTypesForLevel(level)
    .map(type => `<span class="enemy-chip ${type}"><i></i>${ZOMBIES[type].name}</span>`)
    .join('');
  $('levelPreview').innerHTML = `
    <div class="preview-main">
      <span class="preview-kicker">LEVEL ${level} · ${boss ? 'BOSS 关' : '无尽守护'}</span>
      <h3>第 ${level} 关<small>${levelWaveCount(level)} 波僵尸</small></h3>
      <div class="preview-tags">
        <span>${levelWaveCount(level)} 波</span>
        <span>${difficultyLabel(level)}</span>
        <span>僵尸血量 ×${scaling.hp.toFixed(2)}</span>
        ${boss ? '<span class="boss-tag">僵尸王出没</span>' : ''}
      </div>
      <div class="preview-enemies">${enemies}</div>
    </div>
    <div class="preview-action">
      <span class="preview-reward-label">${firstClear ? '首通奖励' : '重复通关 · 30%'}</span>
      <strong class="preview-reward"><svg><use href="#i-coin"></use></svg>+${reward}</strong>
      <small>${firstClear ? '通关后解锁下一关' : '不推进关卡进度'}</small>
      <button id="homeStartButton" class="primary-button home-start-button">${firstClear ? '开始守护' : '重玩本关'}<svg><use href="#i-play"></use></svg></button>
    </div>`;
  $('homeStartButton').addEventListener('click', () => startLevel(level));
}

function renderRoster() {
  $('rosterGrid').innerHTML = UNIT_ORDER.map(key => {
    const type = TYPES[key];
    const unlocked = isUnlocked(key);
    const initial = STARTING_UNITS.includes(key);
    if (unlocked) {
      return `
        <article class="roster-card" title="${type.description}">
          <img src="assets/${key}.png" alt="${type.name}">
          <div class="roster-copy"><strong>${type.name}<em>${initial ? '初始' : '已解锁'}</em></strong><span>${type.role}</span></div>
        </article>`;
    }
    const requiredLevel = CHARACTER_UNLOCK_LEVELS[key];
    return `
      <article class="roster-card locked" title="${type.description}">
        <img src="assets/${key}.png" alt="${type.name}">
        <div class="roster-copy"><strong>${type.name}</strong><span>${type.role}</span></div>
        <span class="unlock-requirement">通关第 ${requiredLevel} 关解锁</span>
      </article>`;
  }).join('');
}

function selectLevel(level) {
  if (level > progress.highestCleared + 1) {
    toast(`通关第 ${progress.highestCleared + 1} 关后解锁`);
    sound('deny');
    return;
  }
  if (progress.selectedLevel !== level) {
    progress.selectedLevel = level;
    saveProgress();
    sound('select');
  }
  renderHome();
}

function shiftTrack(delta) {
  const maxStart = Math.max(1, maxDisplayLevel() - 9);
  homeTrackStart = Math.max(1, Math.min(maxStart, homeTrackStart + delta));
  renderLevelTrack();
}

function showResetConfirm() {
  showModal(`
    <span class="modal-kicker">重置进度</span>
    <h2>重新开始无尽守护？</h2>
    <p>奶黄、累计记录、关卡进度与已解锁角色都会清空，无法恢复。</p>
    <div class="result-actions">
      <button class="secondary-button" id="resetCancel">取消</button>
      <button class="danger-button" id="resetConfirm">确认重置</button>
    </div>`, 'compact');
  $('resetCancel').addEventListener('click', hideModal);
  $('resetConfirm').addEventListener('click', () => {
    progress = ProgressStore.defaultProgress();
    homeTrackStart = 1;
    saveProgress();
    hideModal();
    resetGame(false);
    toast('进度已重置，重新开始吧');
    sound('start');
  });
}

function spawnZombie(type, row = Math.floor(Math.random() * ROWS), summoned = false) {
  const config = ZOMBIES[type];
  const hp = Math.round(config.hp * game.scaling.hp);
  if (type === 'boss') row = Math.min(row, ROWS - 2);
  game.zombies.push({
    id: nextId++, type, row,
    x: 1050 + randomBetween(0, 25),
    y: type === 'boss' ? (row + 1) * ROW_H : yForRow(row),
    hp, maxHp: hp,
    speed: config.speed * game.scaling.speed,
    bite: Math.round(config.bite * game.scaling.bite),
    biteTimer: .4, attackTimer: .8, eating: false,
    poisonUntil: 0, poisonTick: 0, slowUntil: 0,
    jumped: false, skillCount: 0, nextSkill: game.time + 5, enraged: false,
    knockbackProtected: false, knockbackGraceUntil: 0,
    dying: false, deathAt: 0, fallTilt: 0
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
  game.waves.forEach((wave, index) => { if (game.time >= wave.start) currentWave = index; });
  if (currentWave !== game.wave) {
    game.wave = currentWave;
    announce(currentWave === game.waves.length - 1 ? '最后一波！' : `第 ${currentWave + 1} / ${game.waves.length} 波`);
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
    plant.timer = Math.max(0, plant.timer - dt);
    if (plant.type === 'rooster') continue;
    const targets = game.zombies
      .filter(zombie => !zombie.dying && zombieOccupiesRow(zombie, plant.row) && zombie.x >= plant.x - 15 && zombie.x - plant.x <= (type.range ?? Infinity))
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
      if (plant.timer <= 0 && (targets.length || game.zombies.some(z => !z.dying && zombieOccupiesRow(z, plant.row)))) {
        if (targets.length && targets[0].x - plant.x <= type.range) {
          damageZombie(targets[0], type.damage);
          spawnEffect('嗷呜', plant.x + 45, plant.y - 30, 'combat-text');
        } else {
          game.zombies.filter(z => !z.dying && zombieOccupiesRow(z, plant.row)).forEach(z => z.slowUntil = game.time + 4);
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
    let target = game.zombies.find(zombie => zombie.id === projectile.targetId && !zombie.dying);
    if (!target) {
      target = game.zombies.find(zombie => !zombie.dying && zombieOccupiesRow(zombie, projectile.row) && Math.abs(zombie.x - projectile.x) < 24);
    }
    if (target && projectile.x >= target.x - 15) {
      damageZombie(target, projectile.damage);
      if (projectile.poison) {
        target.poisonUntil = game.time + 4;
        target.poisonTick = game.time + .5;
      }
      if (projectile.splash) {
        game.zombies.filter(zombie => !zombie.dying && zombie.id !== target.id && Math.abs(zombie.x - target.x) < 115 && zombieLaneRows(target).some(row => zombieOccupiesRow(zombie, row)))
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
    damage: Math.round((bossShot ? 80 : ZOMBIES.spitter.damage) * game.scaling.bite)
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
  // Shield absorbs damage first
  if (plant.shield && plant.shield > 0) {
    if (plant.shield >= amount) {
      plant.shield -= amount;
      return;
    }
    amount -= plant.shield;
    plant.shield = 0;
  }
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
    .filter(plant => zombieOccupiesRow(zombie, plant.row) && zombie.x > plant.x + 22 && nextX < plant.x + 23)
    .sort((a, b) => b.x - a.x)[0];
  zombie.x = blocker ? blocker.x + 23 : nextX;
}

function updateZombies(dt) {
  for (const zombie of [...game.zombies]) {
    if (zombie.dying) continue;
    if (zombie.poisonUntil > game.time && game.time >= zombie.poisonTick) {
      zombie.poisonTick += .5;
      const dotMul = applyModeAUpgrades().babyDotMul;
      damageZombie(zombie, Math.floor(4 * dotMul));
      if (zombie.dying) continue;
    }
    if (zombie.type === 'boss') updateBossSkill(zombie);
    const blockers = game.plants
      .filter(plant => zombieOccupiesRow(zombie, plant.row) && zombie.x - plant.x < 48 && zombie.x - plant.x > -22)
      .sort((a, b) => b.x - a.x);
    const blocker = blockers[0];
    const jumped = zombie.type === 'jumper' && blocker && !zombie.jumped;
    const rangedTarget = zombie.type === 'spitter' && !blocker ? game.plants
      .filter(plant => zombieOccupiesRow(zombie, plant.row) && plant.x < zombie.x && zombie.x - plant.x <= ZOMBIES.spitter.range)
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
    const babyRow = zombieLaneRows(zombie).find(row => game.babies[row] && game.babies[row].usesLeft > 0 && game.time >= game.babies[row].cooldownUntil);
    if (zombie.x < 122 && babyRow !== undefined) triggerBaby(babyRow, true);
    if (!zombie.dying && zombie.x < 20 && game.state === 'running') finishGame(false);
  }
  game.zombies = game.zombies.filter(zombie => !zombie.dying || performance.now() < zombie.deathAt);
}

function damageZombie(zombie, amount) {
  if (!game.zombies.includes(zombie) || zombie.dying) return;
  zombie.hp -= amount;
  animateEntity('zombies', zombie.id, 'hit', 130);
  if (zombie.hp <= 0) {
    zombie.hp = 0;
    zombie.dying = true;
    zombie.eating = false;
    zombie.deathAt = performance.now() + (DEATH_DURATION[zombie.type] || 850);
    zombie.fallTilt = (Math.random() < .5 ? -1 : 1) * (68 + Math.random() * 18);
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

function keyBabyBackdrop(context, width, height) {
  const frame = context.getImageData(0, 0, width, height);
  const pixels = frame.data;
  const count = width * height;
  const background = new Uint8Array(count);
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0;
  let tail = 0;
  // Enclosed belly and teeth stay opaque; only edge-connected or bottom backdrop is dropped.
  const isBackdrop = index => {
    const offset = index * 4;
    return Math.max(255 - pixels[offset], 255 - pixels[offset + 1], 255 - pixels[offset + 2]) <= 70;
  };
  const enqueue = index => {
    if (!visited[index] && isBackdrop(index)) {
      visited[index] = 1;
      queue[tail++] = index;
    }
  };
  for (let startIndex = 0; startIndex < count; startIndex++) {
    if (visited[startIndex] || !isBackdrop(startIndex)) continue;
    const start = tail;
    let minY = height;
    let touchesEdge = false;
    visited[startIndex] = 1;
    queue[tail++] = startIndex;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = (index / width) | 0;
      if (y < minY) minY = y;
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) touchesEdge = true;
      if (x > 0) enqueue(index - 1);
      if (x < width - 1) enqueue(index + 1);
      if (y > 0) enqueue(index - width);
      if (y < height - 1) enqueue(index + width);
    }
    if (touchesEdge || minY > height * .7) {
      for (let i = start; i < tail; i++) background[queue[i]] = 1;
    }
  }
  for (let index = 0; index < count; index++) {
    const offset = index * 4;
    if (background[index]) {
      pixels[offset + 3] = 0;
      continue;
    }
    const x = index % width;
    const y = (index / width) | 0;
    const touchesBackdrop =
      (x > 0 && background[index - 1]) ||
      (x < width - 1 && background[index + 1]) ||
      (y > 0 && background[index - width]) ||
      (y < height - 1 && background[index + width]);
    if (!touchesBackdrop) continue;
    const distance = 255 - Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
    pixels[offset + 3] = Math.round(255 * Math.min(1, Math.max(.2, (distance - 5) / 40)));
  }
  context.putImageData(frame, 0, 0);
}

function drawBabyFrame(video, canvas, context) {
  if (video.readyState < 2 || !video.videoWidth) return;
  const { x, y, width, height } = BABY_VIDEO_CROP;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(video, x, y, width, height, 0, 0, canvas.width, canvas.height);
  keyBabyBackdrop(context, canvas.width, canvas.height);
}

function watchBabyPerformance(video, canvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let lastTime = -1;
  let frameId;
  const renderFrame = () => {
    if (video.readyState >= 2 && video.currentTime !== lastTime) {
      lastTime = video.currentTime;
      drawBabyFrame(video, canvas, context);
    }
    frameId = requestAnimationFrame(renderFrame);
    activeBabyRenderers.set(video, frameId);
  };
  frameId = requestAnimationFrame(renderFrame);
  activeBabyRenderers.set(video, frameId);
}

function cancelBabyRender(video) {
  const frameId = activeBabyRenderers.get(video);
  if (frameId) cancelAnimationFrame(frameId);
  activeBabyRenderers.delete(video);
}

function startBabyPerformance(row) {
  const container = document.createElement('div');
  container.className = 'baby-performance';
  container.style.left = pctX(62);
  container.style.top = pctY(yForRow(row));
  const canvas = document.createElement('canvas');
  canvas.width = BABY_CANVAS_WIDTH;
  canvas.height = BABY_CANVAS_HEIGHT;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `第 ${row + 1} 行奶娃捧腹大笑`);
  const video = document.createElement('video');
  video.src = 'assets/baby-laugh.mp4';
  video.playsInline = true;
  video.preload = 'auto';
  video.muted = !game.sound;
  container.append(canvas, video);
  $('babyPerformanceLayer').appendChild(container);
  activeBabyVideos.add(video);
  video.addEventListener('ended', () => {
    cancelBabyRender(video);
    activeBabyVideos.delete(video);
    container.remove();
  }, { once: true });
  watchBabyPerformance(video, canvas);
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
    cancelBabyRender(video);
  });
  activeBabyVideos.clear();
  activeBabyRenderers.clear();
  $('babyPerformanceLayer').innerHTML = '';
}

function triggerBaby(row, automatic) {
  if (game.state !== 'running') return;
  const baby = game.babies[row];
  if (!baby || baby.usesLeft <= 0) return;

  const upgradeEffects = applyModeAUpgrades();

  // Check cooldown
  if (game.time < baby.cooldownUntil) {
    if (!automatic) toast(`奶娃还在休息，${(baby.cooldownUntil - game.time).toFixed(1)}秒后可用`);
    return;
  }

  const targets = game.zombies.filter(zombie => !zombie.dying && zombieOccupiesRow(zombie, row));
  if (!targets.length) {
    if (!automatic) toast('这一行暂时没有僵尸，奶娃先保留体力');
    return;
  }

  baby.usesLeft--;

  // Update baby button state
  baby.element.title = `奶娃 (${baby.usesLeft}/${baby.maxUses} 次)`;
  if (baby.usesLeft > 0) {
    // Set cooldown for next use
    baby.cooldownUntil = game.time + 10 * upgradeEffects.babyCooldownMul;
    baby.element.disabled = true;
    baby.element.classList.add('cooling');
    // Re-enable after cooldown
    const cooldownEnd = baby.cooldownUntil;
    const checkCooldown = () => {
      if (game.time >= cooldownEnd && baby.usesLeft > 0) {
        baby.element.disabled = false;
        baby.element.classList.remove('cooling');
      }
    };
    const intervalId = setInterval(() => {
      checkCooldown();
      if (game.time >= cooldownEnd || baby.usesLeft <= 0) clearInterval(intervalId);
    }, 200);
  } else {
    baby.element.classList.add('performing');
    baby.element.disabled = true;
  }

  startBabyPerformance(row);

  const survivors = [];
  targets.forEach(zombie => {
    const baseDamage = LAUGH_DAMAGE[zombie.type];
    if (baseDamage) {
      const damage = Math.floor(baseDamage * upgradeEffects.babyDamageMul);
      damageZombie(zombie, damage);
      if (!zombie.dying) {
        survivors.push(zombie);
        spawnEffect(`-${damage}`, zombie.x, zombie.y - 40, 'combat-text damage');
      }
    } else {
      const damage = Math.floor((zombie.hp + 9999) * upgradeEffects.babyDamageMul);
      damageZombie(zombie, damage);
    }
  });

  // Apply heal to same-row plants
  if (upgradeEffects.babyHealPerUse > 0) {
    game.plants.filter(p => p.row === row).forEach(plant => {
      const healed = Math.min(plant.maxHp - plant.hp, upgradeEffects.babyHealPerUse);
      if (healed > 0) {
        plant.hp += healed;
        spawnEffect(`+${healed}`, plant.x, plant.y - 25, 'combat-text heal');
      }
    });
  }

  // Apply shield to same-row plants
  if (upgradeEffects.babyShieldPerUse > 0) {
    game.plants.filter(p => p.row === row).forEach(plant => {
      plant.shield = (plant.shield || 0) + upgradeEffects.babyShieldPerUse;
      spawnEffect(`+${upgradeEffects.babyShieldPerUse}盾`, plant.x, plant.y - 45, 'combat-text heal');
    });
  }

  const prefix = automatic ? `第 ${row + 1} 行奶娃自动大笑` : `第 ${row + 1} 行奶娃捧腹大笑`;
  if (survivors.length) {
    const names = [...new Set(survivors.map(zombie => ZOMBIES[zombie.type].name))].join('、');
    $('statusText').textContent = `${prefix}，${names}被笑声震伤但仍在前进`;
  } else {
    $('statusText').textContent = `${prefix}，僵尸全被笑倒了`;
  }
  render();
}

function finishGame(won) {
  if (game.state !== 'running') return;
  game.state = won ? 'won' : 'lost';
  game.selected = null;
  cancelCardDrag();
  stopBabyPerformances();
  updatePauseButton();
  sound(won ? 'win' : 'lose');
  const level = game.levelIndex;
  const firstClear = won && level === progress.highestCleared + 1;
  const reward = won ? (firstClear ? firstClearReward(level) : repeatReward(level)) : 0;
  progress.custard = game.custard + reward;
  if (won && firstClear) {
    progress.highestCleared = level;
    progress.selectedLevel = Math.min(MAX_LEVEL, level + 1);
    checkCharacterUnlocks();
  }
  saveProgress();
  renderHome();
  lastResult = {
    won, level, reward, firstClear, custard: progress.custard,
    kills: game.kills, collected: game.collected, placed: game.placed
  };
  showResult(lastResult);
}

function showResult(result) {
  if (!result) { showHome(); return; }
  const { won, level, reward, firstClear } = result;
  const isFinal = won && level === MAX_LEVEL;
  const title = isFinal ? '全部关卡通关！' : won ? `第 ${level} 关守住啦！` : '僵尸闯进奶家了';
  const copy = isFinal
    ? `你守住了全部 ${MAX_LEVEL} 关，包括僵尸王镇守的最终决战。随时可以重复挑战任意关卡刷奶黄。`
    : won
      ? firstClear
        ? `首次通关第 ${level} 关，获得额外奶黄奖励，第 ${level + 1} 关正式解锁。`
        : `再次守住第 ${level} 关，重复通关获得 30% 额外奖励。`
      : `第 ${level} 关防守失败，剩余奶黄已保留。调整阵容再来一次。`;
  const rewardBox = reward > 0
    ? `<div class="result-reward">
        <svg><use href="#i-coin"></use></svg>
        <div><strong>+${reward}</strong><span>${firstClear ? '首通额外奖励' : '重复通关奖励 · 30%'}</span></div>
        <small>奶黄余额 ${result.custard}</small>
      </div>`
    : `<div class="result-reward muted"><span>剩余奶黄已保留 · 余额 ${result.custard}</span></div>`;
  const actions = won
    ? `<div class="result-actions">
        ${isFinal ? '' : '<button class="primary-button" id="nextLevelButton">下一关<svg><use href="#i-play"></use></svg></button>'}
        <button class="${isFinal ? 'primary' : 'secondary'}-button" id="resultRetry">重玩本关</button>
        <button class="ghost-button" id="resultHome">返回主页</button>
      </div>`
    : `<div class="result-actions">
        <button class="primary-button" id="resultRetry">再试一次<svg><use href="#i-restart"></use></svg></button>
        <button class="ghost-button" id="resultHome">返回主页</button>
      </div>`;
  showModal(`
    <span class="modal-kicker">${won ? `第 ${level} 关 · 守护成功` : '本局结束'}</span>
    <h2>${title}</h2>
    <p>${copy}</p>
    <div class="result-stats">
      <div><strong>${result.kills}</strong><span>击退僵尸</span></div>
      <div><strong>${result.collected}</strong><span>收集奶黄</span></div>
      <div><strong>${result.placed}</strong><span>放置角色</span></div>
    </div>
    ${rewardBox}
    ${actions}`, 'compact');
  $('nextLevelButton')?.addEventListener('click', () => startLevel(level + 1));
  $('resultRetry').addEventListener('click', restartLevel);
  $('resultHome').addEventListener('click', leaveToHome);
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
    element.innerHTML = `<img src="assets/${plant.type}.png" alt="${TYPES[plant.type].name}"><div class="health-track"><div class="health-fill"></div></div><div class="shield-track" style="display:none"><div class="shield-fill"></div></div>`;
    setEntityPosition(element, plant);
    return element;
  }, (element, plant) => {
    updateHealth(element, plant);
    const shieldTrack = element.querySelector('.shield-track');
    if (plant.shield && plant.shield > 0) {
      shieldTrack.style.display = '';
      shieldTrack.querySelector('.shield-fill').style.width = `${Math.min(100, plant.shield / 100 * 100)}%`;
    } else {
      shieldTrack.style.display = 'none';
    }
  });

  syncCollection('zombies', game.zombies, zombie => {
    const element = document.createElement('div');
    element.className = `entity zombie ${zombie.type}`;
    element.innerHTML = `<img src="${ZOMBIES[zombie.type].image}" alt="${ZOMBIES[zombie.type].name}"><div class="health-track"><div class="health-fill"></div></div>`;
    setEntityPosition(element, zombie);
    return element;
  }, (element, zombie) => {
    setEntityPosition(element, zombie);
    if (zombie.type === 'brute') element.style.top = pctY(Math.max(85, Math.min(BOARD_H - 85, zombie.y)));
    element.classList.toggle('eating', zombie.eating);
    element.classList.toggle('enraged', zombie.enraged);
    element.classList.toggle('dying', zombie.dying);
    element.style.setProperty('--death-duration', `${DEATH_DURATION[zombie.type] || 850}ms`);
    element.style.setProperty('--fall-tilt', `${zombie.fallTilt || 78}deg`);
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
  $('waveLabel').textContent = `第 ${Math.max(0, game.wave) + 1} / ${game.waves.length} 波`;
  $('levelProgress').style.width = `${game.kills / game.total * 100}%`;
  $('progressText').textContent = `${game.kills} / ${game.total}`;
  const boss = game.zombies.find(zombie => zombie.type === 'boss' && !zombie.dying);
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

function showPauseModal() {
  showModal(`
    <span class="modal-kicker">休息一下</span><h2>游戏已暂停</h2><p>奶家人和僵尸都在原地等你。</p>
    <div class="result-actions"><button class="primary-button" id="resumeButton">继续游戏<svg><use href="#i-play"></use></svg></button><button class="secondary-button" id="pauseRestart">重新开局</button><button class="ghost-button" id="pauseHome">返回主页</button></div>
    <small>按空格也可以继续</small>`, 'compact');
  $('resumeButton').addEventListener('click', resumeGame);
  $('pauseRestart').addEventListener('click', restartLevel);
  $('pauseHome').addEventListener('click', leaveToHome);
}

function togglePause() {
  if (game.state === 'running') {
    cancelCardDrag();
    game.state = 'paused';
    pauseBabyPerformances();
    updatePauseButton();
    showPauseModal();
  } else if (game.state === 'paused') {
    resumeGame();
  }
}

function requestHome() {
  if (game.state !== 'running') {
    leaveToHome();
    return;
  }
  cancelCardDrag();
  game.state = 'paused';
  pauseBabyPerformances();
  updatePauseButton();
  showModal(`
    <span class="modal-kicker">返回主页</span><h2>离开当前关卡？</h2><p>当前剩余奶黄将带回主页，通关奖励不再发放。</p>
    <div class="result-actions"><button class="secondary-button" id="leaveCancel">继续守护</button><button class="danger-button" id="leaveConfirm">返回主页</button></div>`, 'compact');
  $('leaveCancel').addEventListener('click', resumeGame);
  $('leaveConfirm').addEventListener('click', leaveToHome);
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
    cancelCardDrag();
    game.state = 'paused';
    pauseBabyPerformances();
    updatePauseButton();
  }
  showModal(`
    <span class="modal-kicker">玩法说明</span><h2>守护奶家小院</h2>
    <div class="help-list">
      <div><strong>关卡与奶黄</strong><br>每关有多波僵尸（5-10波，随关卡递增）。首次通关获得全额奶黄并解锁下一关；重复挑战旧关卡获得 30% 奶黄；失败不扣奶黄。</div>
      <div><strong>奶家人解锁</strong><br>初始可用奶蛋、奶蛇、奶牛、奶猴。其他奶家人通过通关对应关卡自动解锁（通关第 2 关解锁奶鼠，第 3 关解锁奶兔，依此类推）。</div>
      <div><strong>收集与放置</strong><br>点击发光的奶黄收集资源。拖动左侧卡牌到空草地即可种植；也可以点击卡牌后点击草地放置。小铲子可移除角色。</div>
      <div><strong>奶娃的最后防线</strong><br>每行奶娃都可点击触发捧腹大笑，击倒本行普通僵尸并重创大块头与僵尸王；僵尸突破时也会自动触发。升级后可多次使用，冷却后恢复。</div>
      <div><strong>僵尸王</strong><br>第 12 关的最后一波会出现僵尸王。它占据上下两行，两行的奶家人都能攻击它；它也必须吃掉挡路的角色才会继续前进。</div>
      <div><strong>快捷键</strong><br>空格暂停或继续，数字 1 / 2 切换速度，Esc 或鼠标右键取消选择。</div>
    </div>
    <button class="primary-button" id="helpClose">知道了</button>`, 'compact');
  $('helpClose').addEventListener('click', () => {
    if (previous === 'running') {
      resumeGame();
    } else if (previous === 'paused') {
      showPauseModal();
    } else if (previous === 'won' || previous === 'lost') {
      showResult(lastResult);
    } else {
      showHome();
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

function getNoiseBuffer() {
  if (noiseBuffer || !audioContext) return noiseBuffer;
  const length = Math.floor(audioContext.sampleRate * .4);
  noiseBuffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

function noiseBurst({ duration = .07, volume = .03, frequency = 1400, q = .8, delay = 0, type = 'bandpass' } = {}) {
  if (!game.sound || !audioContext) return;
  const start = audioContext.currentTime + delay;
  const source = audioContext.createBufferSource();
  source.buffer = getNoiseBuffer();
  const filter = audioContext.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, start);
  filter.Q.value = q;
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  source.connect(filter).connect(gain).connect(audioContext.destination);
  source.start(start);
  source.stop(start + duration + .02);
}

function pop(volume = .03, pitch = 400, delay = 0, duration = .07) {
  noiseBurst({ duration: duration * .8, volume, frequency: pitch * 3.2, q: .7, delay });
  tone(pitch, duration * .8, 'triangle', volume * .8, delay);
  tone(pitch * .55, duration, 'sine', volume, delay + .012);
}

function sound(name) {
  if (!game.sound) return;
  const sounds = {
    select: () => tone(440, .06, 'sine', .015),
    deny: () => tone(150, .14, 'square', .015),
    plant: () => { tone(220, .09, 'sine'); tone(330, .12, 'sine', .025, .07); },
    collect: () => { tone(660, .1, 'sine'); tone(880, .15, 'sine', .025, .07); },
    produce: () => tone(520, .12, 'sine', .012),
    throw: () => { pop(.032, 340, 0, .065); pop(.018, 470, .05, .045); },
    fire: () => { noiseBurst({ duration: .18, volume: .026, frequency: 820, q: .5, type: 'lowpass' }); tone(145, .18, 'sawtooth', .018); tone(82, .2, 'sine', .015, .035); },
    snake: () => { pop(.032, 300, 0, .08); noiseBurst({ duration: .11, volume: .022, frequency: 2300, q: 1.1, delay: .015, type: 'highpass' }); tone(210, .1, 'triangle', .014, .03); },
    monkey: () => { pop(.028, 520, 0, .055); pop(.024, 700, .055, .05); },
    tiger: () => { pop(.025, 180, 0, .09); tone(190, .07, 'sawtooth', .013); tone(110, .1, 'triangle', .012, .045); },
    ox: () => { noiseBurst({ duration: .09, volume: .022, frequency: 300, q: .7, type: 'lowpass' }); tone(112, .17, 'sawtooth', .015); tone(82, .2, 'triangle', .013, .08); },
    goat: () => { pop(.026, 380, 0, .07); tone(500, .06, 'square', .011); tone(410, .09, 'square', .012, .065); },
    horse: () => { noiseBurst({ duration: .1, volume: .022, frequency: 900, q: .6 }); tone(250, .08, 'sawtooth', .014); tone(370, .12, 'triangle', .012, .06); },
    impact: () => { noiseBurst({ duration: .035, volume: .012, frequency: 900, q: .8 }); tone(110, .045, 'square', .009); },
    hit: () => { noiseBurst({ duration: .045, volume: .016, frequency: 650, q: .8 }); tone(95, .09, 'triangle', .018); },
    bite: () => { noiseBurst({ duration: .035, volume: .01, frequency: 420, q: .7 }); tone(85, .06, 'sawtooth', .007); },
    heal: () => { tone(520, .15, 'sine', .015); tone(690, .18, 'sine', .015, .08); },
    bark: () => { pop(.02, 240, 0, .06); tone(180, .08, 'square', .013); tone(140, .1, 'square', .013, .1); },
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
$('restartButton').addEventListener('click', restartLevel);
$('homeButton').addEventListener('click', requestHome);
$('helpButton').addEventListener('click', showHelp);
$('resetProgressButton').addEventListener('click', showResetConfirm);
$('trackPrev').addEventListener('click', () => shiftTrack(-10));
$('trackNext').addEventListener('click', () => shiftTrack(10));
$('levelTrack').addEventListener('click', event => {
  const node = event.target.closest('[data-level]');
  if (node) selectLevel(Number(node.dataset.level));
});
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
  cancelCardDrag();
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
    cancelCardDrag();
    game.selected = null;
    $('shovelButton').classList.remove('selected');
    updateCards();
  }
});

initGrid();
initCards();
resetGame(false);
requestAnimationFrame(frame);

window.__nailongTower = {
  get progress() { return progress; },
  set progress(value) { progress = value; },
  game,
  ZOMBIES,
  spawnZombie,
  render,
  resetGame,
  startLevel,
  finishGame,
  placeUnit,
  spawnCustard,
  collectCustard,
  checkCharacterUnlocks,
  levelWaveCount,
  levelWaveConfig,
  levelWaves,
  levelScaling,
  enemyTypesForLevel,
  firstClearReward,
  repeatReward,
  difficultyLabel,
  getUpgradeMultiplier,
  applyModeAUpgrades,
  isUnlocked,
  saveProgress
};
