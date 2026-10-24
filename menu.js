(function () {
  const modals = Array.from(document.querySelectorAll('.modal'));
  const bestEls = Array.from(document.querySelectorAll('[data-best-wave]'));
  const custardEls = Array.from(document.querySelectorAll('[data-custard-balance]'));
  const SAVE_KEY = 'nailong-vs-zombies-progress-v2';

  function readBest() {
    try {
      const save = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (save && save.endlessBest && save.endlessBest.wave > 0) return save.endlessBest;
      // Fallback: try legacy key
      return JSON.parse(localStorage.getItem('nailong.action.endlessBest') || 'null');
    } catch {
      return null;
    }
  }

  function readCustard() {
    try {
      const save = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (save && typeof save.custard === 'number') return save.custard;
    } catch {}
    return null;
  }

  function renderBest() {
    const best = readBest();
    const label = best && best.wave ? `最佳：第 ${best.wave} 波` : '暂无记录';
    bestEls.forEach(el => { el.textContent = label; });
  }

  function renderCustard() {
    const custard = readCustard();
    if (custard !== null) {
      custardEls.forEach(el => { el.textContent = custard; });
    }
  }

  function open(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
  }

  function close(modal) {
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
  }

  document.querySelectorAll('[data-open]').forEach(button => {
    button.addEventListener('click', () => open(button.dataset.open));
  });

  document.querySelectorAll('[data-close]').forEach(button => {
    button.addEventListener('click', () => close(button.closest('.modal')));
  });

  modals.forEach(modal => {
    modal.addEventListener('click', event => {
      if (event.target === modal) close(modal);
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    modals.filter(modal => modal.classList.contains('visible')).forEach(close);
  });

  renderBest();
  renderCustard();
})();
