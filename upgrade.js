/* upgrade.js — Upgrade system logic */

const SAVE_KEY = 'nailong-vs-zombies-progress-v2';
const UPGRADE_COSTS = [100, 200, 400, 800, 1600, 3200, 6400];
const MAX_UPGRADE_LEVEL = 7;

const CHARACTER_UPGRADES = {
  egg:     { name: '奶蛋', modeA: '+使用次数',   modeB: '+自动回复',   perLevel: { modeA: '+1次',    modeB: '+1HP/秒' } },
  rat:     { name: '奶鼠', modeA: '-使用冷却',   modeB: '-技能冷却',   perLevel: { modeA: '-10%',    modeB: '-10%' } },
  snake:   { name: '奶蛇', modeA: '+持续伤害',   modeB: '+持续伤害',   perLevel: { modeA: '+20%',    modeB: '+20%' } },
  dragon:  { name: '奶龙', modeA: '+持续伤害',   modeB: '+持续伤害',   perLevel: { modeA: '+20%',    modeB: '+20%' } },
  rabbit:  { name: '奶兔', modeA: '-使用冷却',   modeB: '-技能冷却',   perLevel: { modeA: '-10%',    modeB: '-10%' } },
  tiger:   { name: '奶虎', modeA: '+攻击力',     modeB: '+攻击力',     perLevel: { modeA: '+15%',    modeB: '+15%' } },
  ox:      { name: '奶牛', modeA: '+攻击力',     modeB: '+攻击力',     perLevel: { modeA: '+15%',    modeB: '+15%' } },
  monkey:  { name: '奶猴', modeA: '+攻击力',     modeB: '+攻击力',     perLevel: { modeA: '+15%',    modeB: '+15%' } },
  goat:    { name: '奶羊', modeA: '+同行回血',   modeB: '+杀敌回血',   perLevel: { modeA: '+10HP',   modeB: '+2HP' } },
  rooster: { name: '奶鸡', modeA: '-使用冷却',   modeB: '-技能冷却',   perLevel: { modeA: '-10%',    modeB: '-10%' } },
  pig:     { name: '奶猪', modeA: '+同行盾牌',   modeB: '+盾牌',       perLevel: { modeA: '+20HP',   modeB: '+30HP' } },
  horse:   { name: '奶马', modeA: '+同行回血',   modeB: '+杀敌回血',   perLevel: { modeA: '+10HP',   modeB: '+2HP' } },
  dog:     { name: '奶狗', modeA: '+同行盾牌',   modeB: '+盾牌',       perLevel: { modeA: '+20HP',   modeB: '+30HP' } }
};

const CHARACTER_UNLOCK_LEVELS = {
  rat: 2, rabbit: 3, dog: 4, tiger: 5,
  goat: 6, rooster: 7, pig: 8, horse: 9, dragon: 10
};

const STARTING_UNITS = ['egg', 'snake', 'ox', 'monkey'];

function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!raw) return null;
    return raw;
  } catch {
    return null;
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
  } catch {}
}

function isUnlocked(key, progress) {
  if (STARTING_UNITS.includes(key)) return true;
  const requiredLevel = CHARACTER_UNLOCK_LEVELS[key];
  return requiredLevel && progress.highestCleared >= requiredLevel;
}

function renderUpgradeCards() {
  const progress = loadProgress();
  if (!progress) return;

  const grid = document.getElementById('upgradeGrid');
  const custardEl = document.getElementById('custardBalance');

  custardEl.textContent = progress.custard || 0;
  grid.innerHTML = '';

  for (const [key, info] of Object.entries(CHARACTER_UPGRADES)) {
    const level = (progress.upgrades && progress.upgrades[key]) || 0;
    const unlocked = isUnlocked(key, progress);
    const cost = level < MAX_UPGRADE_LEVEL ? UPGRADE_COSTS[level] : null;
    const canAfford = cost !== null && progress.custard >= cost;
    const isMaxed = level >= MAX_UPGRADE_LEVEL;

    const card = document.createElement('div');
    card.className = 'upgrade-card';
    if (!unlocked) card.classList.add('locked');
    if (isMaxed) card.classList.add('maxed');

    // Build level bar
    const filledDots = '\u25CF'.repeat(level);
    const emptyDots = '\u25CB'.repeat(MAX_UPGRADE_LEVEL - level);

    card.innerHTML = `
      <div class="card-header">
        <img src="assets/${key}.png" alt="${info.name}" class="char-icon">
        <span class="char-name">${info.name}</span>
      </div>
      <div class="card-level">
        <span class="level-label">Lv.${level}</span>
        <span class="level-bar">${filledDots}<span class="empty">${emptyDots}</span></span>
      </div>
      <div class="card-effects">
        <div class="effect-row"><span class="effect-mode">模式A</span><span>${info.modeA} ${info.perLevel.modeA}/级</span></div>
        <div class="effect-row"><span class="effect-mode">模式B</span><span>${info.modeB} ${info.perLevel.modeB}/级</span></div>
      </div>
      ${!unlocked ? `<div class="card-locked">通关第 ${CHARACTER_UNLOCK_LEVELS[key]} 关解锁</div>` : ''}
      ${unlocked && !isMaxed ? `<div class="card-action">
        <span class="upgrade-cost">强化：${cost} 奶黄</span>
        <button class="upgrade-button" data-upgrade="${key}" ${canAfford ? '' : 'disabled'}>
          ${canAfford ? '强化' : '奶黄不足'}
        </button>
      </div>` : ''}
      ${isMaxed ? '<div class="card-maxed">已满级</div>' : ''}
    `;

    grid.appendChild(card);
  }

  // Attach click handlers
  grid.querySelectorAll('.upgrade-button:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => upgradeCharacter(btn.dataset.upgrade));
  });
}

function upgradeCharacter(key) {
  const progress = loadProgress();
  if (!progress) return;

  const level = (progress.upgrades && progress.upgrades[key]) || 0;
  if (level >= MAX_UPGRADE_LEVEL) return;

  const cost = UPGRADE_COSTS[level];
  if (progress.custard < cost) return;

  progress.custard -= cost;
  if (!progress.upgrades) progress.upgrades = {};
  progress.upgrades[key] = level + 1;

  saveProgress(progress);
  renderUpgradeCards();

  // Play upgrade sound (simple ascending tone)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

// Event listeners
document.getElementById('backButton').addEventListener('click', () => {
  window.location.href = 'index.html';
});

// Initialize
renderUpgradeCards();
