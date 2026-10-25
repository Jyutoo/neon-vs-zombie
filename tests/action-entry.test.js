'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, createStorage } = require('./helpers/browser-env');
const ProgressStore = require('../src/js/progress');

function enter(search, wave = 0) {
  let frames = 0;
  const save = createStorage({
    [ProgressStore.SAVE_KEY]: JSON.stringify({ endlessBest: { wave } })
  });
  const page = boot({
    files: ['progress.js', 'action-data.js', 'action-logic.js', 'action.js'],
    search, save,
    globals: { requestAnimationFrame() { frames++; return frames; } }
  });
  return { page, frames };
}

for (const [level, wave] of [[12, 0], [2, 2], [3, 3]]) {
  test(`direct entry to level ${level} at wave ${wave} returns to selection before battle starts`, () => {
    const { page, frames } = enter(`?mode=level&level=${level}`, wave);
    assert.equal(page.global.location.href, 'action-levels.html');
    assert.equal(page.global.__nailong, undefined);
    assert.equal(frames, 0);
  });
}

for (const [level, wave] of [[1, 0], [2, 3], [12, 33]]) {
  test(`unlocked level ${level} at wave ${wave} can start normally`, () => {
    const { page, frames } = enter(`?mode=level&level=${level}`, wave);
    assert.equal(page.global.__nailong.state.levelParam, level);
    assert.equal(frames, 1);
  });
}

test('endless entry remains available without any unlocked levels', () => {
  const { page, frames } = enter('?mode=endless&level=12');
  assert.equal(page.global.__nailong.state.mode, 'endless');
  assert.equal(frames, 1);
});
