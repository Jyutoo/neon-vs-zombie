/* action-levels.js — Mode B level select logic */

const MAX_LEVEL = ProgressStore.MAX_LEVEL;
const PER_PAGE = 5;

let trackStart = 1;
let selectedLevel = 1;

function loadProgress() {
  return ProgressStore.load();
}

function unlockedLevel() {
  return ProgressStore.actionLevelsUnlocked(loadProgress().endlessBest.wave);
}

function renderLevelTrack() {
  const track = document.getElementById('levelTrack');
  const unlocked = unlockedLevel();
  const progress = loadProgress();
  const actionCleared = progress.actionHighestCleared || 0;

  track.innerHTML = '';
  const end = Math.min(MAX_LEVEL, trackStart + PER_PAGE - 1);

  for (let i = trackStart; i <= end; i++) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'level-card';

    const isCleared = i <= actionCleared;
    const isAvailable = i <= unlocked && !isCleared;
    const isLocked = i > unlocked;

    if (isCleared) card.classList.add('cleared');
    else if (isAvailable) card.classList.add('available');
    else card.classList.add('locked');

    if (i === selectedLevel && !isLocked) card.classList.add('selected');

    card.innerHTML = `
      <span class="level-number">LEVEL ${String(i).padStart(2, '0')}</span>
      <span class="level-title">第 ${i} 关</span>
      ${i === MAX_LEVEL ? '<span class="boss-tag">BOSS</span>' : ''}
    `;

    card.setAttribute('aria-label', `第 ${i} 关${isLocked ? `，无尽最佳达到第 ${(i - 1) * 3} 波后解锁` : ''}`);
    card.addEventListener('click', () => {
      if (isLocked) {
        document.getElementById('unlockHint').textContent = `第 ${i} 关需无尽最佳达到第 ${(i - 1) * 3} 波后解锁。`;
      } else {
        selectLevel(i);
      }
    });

    track.appendChild(card);
  }

  document.getElementById('trackRange').textContent = `第 ${trackStart} – ${end} 关`;
  document.getElementById('trackPrev').disabled = trackStart <= 1;
  document.getElementById('trackNext').disabled = end >= MAX_LEVEL;
}

function selectLevel(level) {
  selectedLevel = level;
  renderLevelTrack();
  renderLevelPreview();
  renderUnlockHint();
}

function renderUnlockHint() {
  const unlocked = unlockedLevel();
  document.getElementById('unlockHint').textContent = unlocked >= MAX_LEVEL
    ? '全部闯关关卡已解锁。'
    : `无尽最佳达到第 ${unlocked * 3} 波，即可解锁第 ${unlocked + 1} 关。`;
}

function renderLevelPreview() {
  const preview = document.getElementById('levelPreview');
  const isBoss = selectedLevel === MAX_LEVEL;
  const progress = loadProgress();
  const actionCleared = progress.actionHighestCleared || 0;
  const isCleared = selectedLevel <= actionCleared;
  const combatSegments = ActionLogic.levelConfig(selectedLevel).screens.filter(screen => !screen.boss).length;

  preview.innerHTML = `
    <div class="preview-main">
      <span class="preview-kicker">LEVEL ${String(selectedLevel).padStart(2, '0')} · ${isBoss ? 'BOSS 关' : '闯关'}</span>
      <h3>第 ${selectedLevel} 关</h3>
      <p class="preview-desc">${isCleared ? '已通关 · ' : ''}${combatSegments} 段战斗 + 奶康 Boss 战</p>
    </div>
    <div class="preview-action">
      <button id="startButton" class="primary-button">${isCleared ? '再次闯关' : '开始闯关'}</button>
    </div>
  `;
  document.getElementById('startButton').addEventListener('click', startLevel);
}

function startLevel() {
  window.location.href = `action.html?mode=level&level=${selectedLevel}`;
}

// Event listeners
document.getElementById('backButton').addEventListener('click', () => {
  window.location.href = 'index.html';
});

document.getElementById('trackPrev').addEventListener('click', () => {
  if (trackStart > 1) {
    trackStart = Math.max(1, trackStart - PER_PAGE);
    renderLevelTrack();
  }
});

document.getElementById('trackNext').addEventListener('click', () => {
  if (trackStart + PER_PAGE <= MAX_LEVEL) {
    trackStart = Math.min(MAX_LEVEL - PER_PAGE + 1, trackStart + PER_PAGE);
    renderLevelTrack();
  }
});

// Initialize
function init() {
  const progress = loadProgress();
  document.getElementById('actionCleared').textContent = progress.actionHighestCleared || 0;
  const best = progress.endlessBest;
  document.getElementById('actionEndlessBest').textContent = best?.wave > 0 ? `第 ${best.wave} 波` : '暂无';
  renderLevelTrack();
  selectLevel(1);
}

init();
