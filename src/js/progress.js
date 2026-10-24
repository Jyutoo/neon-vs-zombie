/* progress.js — the single owner of the persistent save.

   Every page (tower defence, action mode, level select, upgrade shop, main
   menu) must read and write progress through this module. A partial save is
   always completed from the defaults and, when present, the legacy v1 save,
   so no page can silently zero out another page's fields. */

(function (root) {
  'use strict';

  const SAVE_KEY = 'nailong-vs-zombies-progress-v2';
  const V1_SAVE_KEY = 'nailong-vs-zombies-progress-v1';
  const MAX_LEVEL = 12;
  const MAX_UPGRADE_LEVEL = 7;
  const STARTING_UNITS = ['egg', 'snake', 'ox', 'monkey'];
  const ALL_UNITS = [
    'egg', 'rat', 'snake', 'dragon', 'rabbit', 'tiger', 'ox', 'monkey',
    'goat', 'rooster', 'pig', 'horse', 'dog'
  ];
  const CHARACTER_UNLOCK_LEVELS = {
    rat: 2, rabbit: 3, dog: 4, tiger: 5,
    goat: 6, rooster: 7, pig: 8, horse: 9, dragon: 10
  };
  const FIELDS = ['custard', 'highestCleared', 'actionHighestCleared',
    'endlessBest', 'selectedLevel', 'unlocked', 'upgrades'];

  function intOf(value, fallback) {
    const num = Math.floor(Number(value));
    return Number.isFinite(num) ? num : fallback;
  }

  function has(object, key) {
    return object && typeof object === 'object' &&
      Object.prototype.hasOwnProperty.call(object, key);
  }

  function defaultUpgrades() {
    const upgrades = {};
    ALL_UNITS.forEach(key => { upgrades[key] = 0; });
    return upgrades;
  }

  function defaultProgress() {
    return {
      custard: 500,
      highestCleared: 0,
      actionHighestCleared: 0,
      endlessBest: { wave: 0, kills: 0, date: null },
      selectedLevel: 1,
      unlocked: [...STARTING_UNITS],
      upgrades: defaultUpgrades()
    };
  }

  function normalizeUnlocked(rawUnlocked) {
    const list = Array.isArray(rawUnlocked)
      ? rawUnlocked.filter(key => ALL_UNITS.includes(key))
      : [];
    STARTING_UNITS.forEach(key => { if (!list.includes(key)) list.push(key); });
    return [...new Set(list)];
  }

  function normalizeUpgrades(rawUpgrades) {
    const upgrades = defaultUpgrades();
    if (!rawUpgrades || typeof rawUpgrades !== 'object') return upgrades;
    for (const key of ALL_UNITS) {
      if (!has(rawUpgrades, key)) continue;
      upgrades[key] = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, intOf(rawUpgrades[key], 0)));
    }
    return upgrades;
  }

  function normalizeEndlessBest(rawBest) {
    if (!rawBest || typeof rawBest !== 'object') return { wave: 0, kills: 0, date: null };
    return {
      wave: Math.max(0, intOf(rawBest.wave, 0)),
      kills: Math.max(0, intOf(rawBest.kills, 0)),
      date: rawBest.date || null
    };
  }

  // Turns any object into a complete, in-range save.
  function normalize(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const highestCleared = Math.max(0, Math.min(MAX_LEVEL, intOf(source.highestCleared, 0)));
    return {
      custard: Math.max(0, intOf(source.custard, 0)),
      highestCleared,
      actionHighestCleared: Math.max(0, Math.min(MAX_LEVEL, intOf(source.actionHighestCleared, 0))),
      endlessBest: normalizeEndlessBest(source.endlessBest),
      selectedLevel: Math.max(1, Math.min(MAX_LEVEL, Math.min(highestCleared + 1,
        intOf(source.selectedLevel, 1)))),
      unlocked: normalizeUnlocked(source.unlocked),
      upgrades: normalizeUpgrades(source.upgrades)
    };
  }

  function migrateV1(v1Data) {
    const source = v1Data && typeof v1Data === 'object' ? v1Data : {};
    const highestCleared = Math.max(0, Math.min(MAX_LEVEL, intOf(source.highestCleared, 0)));
    return {
      custard: Math.max(0, intOf(source.coins, 0)),
      highestCleared,
      actionHighestCleared: 0,
      endlessBest: { wave: 0, kills: 0, date: null },
      selectedLevel: Math.max(1, Math.min(MAX_LEVEL, Math.min(highestCleared + 1,
        intOf(source.selectedLevel, 1)))),
      unlocked: normalizeUnlocked(source.unlocked),
      upgrades: defaultUpgrades()
    };
  }

  // Layered so a save written by one page cannot erase fields owned by another:
  // defaults, then the legacy v1 save, then only the fields v2 actually carries.
  function mergeProgress(rawV1, rawV2) {
    const base = rawV1 && typeof rawV1 === 'object' ? migrateV1(rawV1) : defaultProgress();
    if (!rawV2 || typeof rawV2 !== 'object') return base;
    const cleaned = normalize(rawV2);
    const merged = {};
    for (const field of FIELDS) {
      merged[field] = has(rawV2, field) ? cleaned[field] : base[field];
    }
    return merged;
  }

  function readJson(storage, key) {
    try {
      return JSON.parse(storage.getItem(key));
    } catch {
      return null;
    }
  }

  function save(progress, storage) {
    try {
      (storage || localStorage).setItem(SAVE_KEY, JSON.stringify(progress));
    } catch {}
  }

  function load(storage) {
    const store = storage || localStorage;
    const rawV1 = readJson(store, V1_SAVE_KEY);
    const progress = normalize(mergeProgress(rawV1, readJson(store, SAVE_KEY)));
    save(progress, store);
    try {
      if (rawV1) store.removeItem(V1_SAVE_KEY);
    } catch {}
    return progress;
  }

  // Read-modify-write that always persists a complete save.
  function update(mutator, storage) {
    const store = storage || localStorage;
    const progress = load(store);
    mutator(progress);
    const normalized = normalize(progress);
    save(normalized, store);
    return normalized;
  }

  // Mode B level track is gated by endless-mode progress: three waves per level.
  function actionLevelsUnlocked(endlessWave) {
    return Math.min(MAX_LEVEL, Math.floor(Math.max(0, intOf(endlessWave, 0)) / 3) + 1);
  }

  // Owning a character and reaching its level gate are both sufficient, so a
  // character bought in the old save stays usable and upgradeable.
  function isCharacterUnlocked(key, progress) {
    if (STARTING_UNITS.includes(key)) return true;
    if (progress.unlocked && progress.unlocked.includes(key)) return true;
    const requiredLevel = CHARACTER_UNLOCK_LEVELS[key];
    return Boolean(requiredLevel) && progress.highestCleared >= requiredLevel;
  }

  function upgradeLevel(progress, key) {
    return (progress.upgrades && progress.upgrades[key]) || 0;
  }

  const api = {
    SAVE_KEY,
    V1_SAVE_KEY,
    MAX_LEVEL,
    MAX_UPGRADE_LEVEL,
    STARTING_UNITS,
    ALL_UNITS,
    CHARACTER_UNLOCK_LEVELS,
    defaultProgress,
    normalize,
    migrateV1,
    mergeProgress,
    load,
    save,
    update,
    actionLevelsUnlocked,
    isCharacterUnlocked,
    upgradeLevel
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProgressStore = api;
})(typeof window !== 'undefined' ? window : globalThis);
