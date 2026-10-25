'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, createStorage } = require('./helpers/browser-env');
const ProgressStore = require('../src/js/progress');

function bootLevels(progress = {}) {
  return boot({
    files: ['progress.js', 'action-data.js', 'action-logic.js', 'action-levels.js'],
    save: createStorage({ [ProgressStore.SAVE_KEY]: JSON.stringify(progress) })
  });
}

for (const [level, segments] of [[1, 3], [5, 4], [9, 5], [12, 5]]) {
  test(`level ${level} preview reports ${segments} combat segments and the boss`, () => {
    const page = bootLevels({ endlessBest: { wave: 36 } });
    page.global.selectLevel(level);
    const preview = page.nodes.get('levelPreview').innerHTML;
    assert.match(preview, new RegExp(`${segments} 段战斗`));
    assert.match(preview, /奶康/);
  });
}

test('replaying a cleared level still shows its actual length', () => {
  const page = bootLevels({ actionHighestCleared: 5, endlessBest: { wave: 36 } });
  page.global.selectLevel(5);
  const preview = page.nodes.get('levelPreview').innerHTML;
  assert.match(preview, /已通关/);
  assert.match(preview, /4 段战斗/);
});

for (const [wave, cleared, message] of [
  [0, 0, /第 3 波.*第 2 关/],
  [2, 1, /第 3 波.*第 2 关/],
  [3, 1, /第 6 波.*第 3 关/],
  [33, 0, /全部.*解锁/]
]) {
  test(`unlock guidance uses wave ${wave} even after clearing ${cleared} levels`, () => {
    const page = bootLevels({ endlessBest: { wave }, actionHighestCleared: cleared });
    assert.match(page.nodes.get('unlockHint')?.textContent || '', message);
  });
}

test('clicking a locked level explains its target without changing the selection', () => {
  const page = bootLevels({ endlessBest: { wave: 2 }, actionHighestCleared: 1 });
  const before = page.nodes.get('levelPreview').innerHTML;
  page.nodes.get('levelTrack').children[1].click();
  assert.match(page.nodes.get('unlockHint')?.textContent || '', /第 2 关.*第 3 波/);
  assert.equal(page.nodes.get('levelPreview').innerHTML, before);
  assert.equal(page.global.location.href, 'index.html');
});

test('available level clicks still select the level and start the correct battle', () => {
  const page = bootLevels({ endlessBest: { wave: 3 } });
  page.nodes.get('levelTrack').children[1].click();
  assert.match(page.nodes.get('levelPreview').innerHTML, /第 2 关/);
  page.nodes.get('startButton').click();
  assert.equal(page.global.location.href, 'action.html?mode=level&level=2');
});
