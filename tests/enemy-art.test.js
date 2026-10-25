'use strict';
/**
 * 敌方形象资产与配置护栏。
 *
 * 断言的是真实文件与真实配置，不复制被测函数（AGENTS.md 硬性要求）。
 * 模式A 配置经 window.__nailongTower 读取（game.js 是页面脚本、没有 UMD 尾巴），
 * 模式B 配置经 require 读取（action-data.js 有 UMD 尾巴）。
 *
 * Run: node --test tests/enemy-art.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.resolve(__dirname, '..', 'src');
const ENEMIES_DIR = path.join(SRC, 'assets', 'enemies');

// 导出高度 = 两模式渲染高度较大值 × 2（spec §6.2）。模式B boss.scale=1.8 决定奶康 448。
const ART = {
  basic:   { file: 'naidou.png',   height: 248 },
  cone:    { file: 'feidudu.png',  height: 248 },
  bucket:  { file: 'niulai.png',   height: 248 },
  runner:  { file: 'doujiao.png',  height: 240 },
  brute:   { file: 'tangbao.png',  height: 330 },
  spitter: { file: 'lulu.png',     height: 240 },
  jumper:  { file: 'gugugaga.png', height: 324 },
  boss:    { file: 'naikang.png',  height: 448 }
};

function pngSize(file) {
  const buf = fs.readFileSync(file);
  assert.equal(buf.subarray(1, 4).toString('latin1'), 'PNG', `${path.basename(file)} 不是 PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('8 张敌人形象齐备且导出高度符合规格', () => {
  for (const [type, art] of Object.entries(ART)) {
    const file = path.join(ENEMIES_DIR, art.file);
    assert.ok(fs.existsSync(file), `缺少素材 ${art.file}（类型 ${type}）`);
    assert.ok(fs.statSync(file).size > 1000, `${art.file} 体积过小，疑似空图`);
    const { width, height } = pngSize(file);
    assert.equal(height, art.height, `${art.file} 高度应为 ${art.height}，实际 ${height}`);
    assert.ok(width > 0 && width <= height, `${art.file} 宽度 ${width} 不合理（应 ≤ 高度）`);
  }
});

test('src/assets/enemies/ 下恰好 8 个文件，无多余产物', () => {
  const extra = fs.readdirSync(ENEMIES_DIR).filter(n => n !== 'README.md');
  assert.deepEqual(extra.sort(), Object.values(ART).map(a => a.file).sort());
});
