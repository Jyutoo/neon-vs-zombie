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
