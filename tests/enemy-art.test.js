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
const { boot } = require('./helpers/browser-env');

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

test('模式A ZOMBIES 每项都有 image、文件在磁盘上、名字不含"僵尸"', () => {
  const env = boot({ files: ['progress.js', 'game.js'] });
  const ZOMBIES = env.global.__nailongTower.ZOMBIES;
  assert.deepEqual(Object.keys(ZOMBIES), Object.keys(ART), '模式A 敌人表键集合变了');
  for (const [type, cfg] of Object.entries(ZOMBIES)) {
    assert.ok(cfg.image, `${type} 缺 image 字段`);
    assert.match(cfg.image, /^assets\/enemies\/[a-z]+\.png$/, `${type} 的 image 路径不规范：${cfg.image}`);
    assert.ok(fs.existsSync(path.join(SRC, cfg.image)), `${type} 的 ${cfg.image} 不在磁盘上`);
    assert.equal(cfg.image, `assets/enemies/${ART[type].file}`, `${type} 的 image 与规格表不符`);
    assert.ok(!cfg.name.includes('僵尸'), `${type} 仍叫「${cfg.name}」`);
  }
});

test('模式A 渲染不再产出假护甲节点', () => {
  const env = boot({ files: ['progress.js', 'game.js'] });
  const api = env.global.__nailongTower;
  api.game.sound = false;
  api.startLevel(1);
  for (const type of Object.keys(ART)) api.spawnZombie(type);
  api.render();
  // syncCollection 把 create() 产出的元素 appendChild 到 layers.zombies（game.js:1516），
  // 即 #zombieLayer；browser-env 的 getElementById 会把该节点登记进 env.nodes。
  const layer = env.nodes.get('zombieLayer');
  const markup = layer.children.map(node => node.innerHTML).join('\n');
  assert.equal(layer.children.length, Object.keys(ART).length, '敌人 DOM 数量与摆怪数不符，探针失效');
  assert.ok(markup, '没有取到任何敌人 DOM');
  assert.ok(!markup.includes('class="armor"'), '仍在渲染 <div class="armor">');
  for (const type of Object.keys(ART)) {
    assert.ok(markup.includes(ART[type].file), `没有渲染 ${ART[type].file}`);
  }
});
