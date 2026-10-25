# 敌方角色替换（第一步：换形象 + 改身份）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用用户设计的 8 名「邪恶家人」角色替换两个模式里的旧僵尸形象与全部玩家可见称呼，不改任何数值、波次、碰撞几何与存档。

**Architecture:** 三个改动面各自独立闭合——(1) 一条离线 Python 流水线把需求包三视图加工成 8 张透明 PNG；(2) 两个模式各加一个 `image` 字段驱动渲染，同时删掉过去用来"区分同一张图"的 CSS 假护甲与调色滤镜；(3) 一次纯文本层的称呼清扫。形象与身份分两轮落地，机制层（光环/护盾/亡语/敌方弹道）整体推到第二步。

**Tech Stack:** 原生 HTML / CSS / JS（无构建、无依赖）；Node 内置 `node --test`；开发期 Python 3 + Pillow 12.3.0 + numpy 2.5.4 + scipy 1.18.1（`C:/Users/Lenovo/miniconda3/python.exe`，不进游戏运行时）。

**Spec:** [docs/superpowers/specs/2026-10-25-enemy-reskin-design.md](../specs/2026-10-25-enemy-reskin-design.md) — 本计划从它论证，执行者两份都要读。角色映射见 spec §三，**完整文案替换对照表见 spec §四**，素材实测面板数据见 spec §6.1。

## Global Constraints

- 不引入框架、打包器或 npm 包；`<script>` 标签顺序是唯一的模块机制。
- 内部标识符一律不改：`game.zombies`、`damageZombie`、`ZOMBIES`、`.zombie` / `.hero-zombie` CSS 类名、`state.boss`。
- 不改存档键 `nailong-vs-zombies-progress-v2`，不改仓库名与项目目录名。
- 不改任何数值曲线、波次编排、碰撞几何：`hitW` / `hitH`、`Logic.rectsOverlap`、`Logic.verticalOverlap`、脚底坐标约定一个字节都不改。
- 测试不许复制被测函数；跨页面/跨存档用例走 `tests/helpers/browser-env.js` 的 `boot()` 加载**未经修改**的生产脚本，需要的内部量由生产脚本自己加进调试句柄。
- `src/assets/source-*` 与 `.superpowers/` 有意保留，不许删。
- 每个 JS 文件改完跑 `node --check`。
- 提交信息中文 + conventional 前缀（`feat:` / `fix:` / `test:` / `docs:` / `chore:`），分支 `dev`。
- 本地服务 `"C:/Users/Lenovo/miniconda3/python.exe" -m http.server 4173 --bind 127.0.0.1`，入口 `http://127.0.0.1:4173/src/index.html`，**用完必须关掉**。
- 最终任务必须写 `CHANGELOG.md`（倒序置顶，含更新类型 / 改动内容 / 影响范围 + 验证方式）。
- 稳定契约：`src/assets/enemies/` 下恰好 8 个文件 `naidou.png` `feidudu.png` `niulai.png` `doujiao.png` `tangbao.png` `lulu.png` `gugugaga.png` `naikang.png`。

---

### Task 1: 素材加工流水线与 8 张 PNG

**Files:**
- Create: `tools/prep-enemy-art.py`
- Create: `src/assets/enemies/`（脚本产出 8 个 PNG）
- Create: `src/assets/source-enemies/`（需求包 8 张原始 jpg）
- Create: `src/assets/enemies/README.md`
- Test: `tests/enemy-art.test.js`

**Interfaces:**
- Consumes: 无（首个任务）。
- Produces: `src/assets/enemies/<key>.png` 8 个文件，供 Task 2/3 的 `image` 字段引用；`tests/enemy-art.test.js` 与其中的 `ART` 表、`SRC` 常量，供 Task 2/3/4 追加断言时复用。

- [x] **Step 1: 拷贝原始参考图进仓库**

需求包解在一个 ASCII 临时目录（避开中文路径工具链问题）。源目录 = 本计划执行时由控制者提供的 `pack/assets/enemies` 路径，下记为 `$SRC_DIR`。

```bash
mkdir -p "D:/奶龙大战僵尸/src/assets/source-enemies"
cp "C:/Users/Lenovo/AppData/Local/Temp/enemy-pack/pack/assets/enemies/"*.jpg "D:/奶龙大战僵尸/src/assets/source-enemies/"
ls -1 "D:/奶龙大战僵尸/src/assets/source-enemies/"
```

Expected: 8 个文件 —— `doujiao.jpg feidudu.jpg gugugaga-child.jpg lulu.jpg naidou.jpg naikang.jpg niulai.jpg tangbao.jpg`。

若 `$SRC_DIR` 不存在，**停下来问控制者要路径**，不要自己造图或跳过。

- [x] **Step 2: 写失败测试**

创建 `tests/enemy-art.test.js`。断言真实文件，不复制任何生产逻辑。PNG 尺寸直接读 IHDR，不引入图片库依赖：

```js
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
```

- [x] **Step 3: 跑测试确认失败**

Run: `node --test tests/enemy-art.test.js`
Expected: FAIL —— `ENOENT: no such file or directory, scandir '...\src\assets\enemies'`

- [x] **Step 4: 写加工脚本**

创建 `tools/prep-enemy-art.py`：

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""开发期素材加工：把需求包三视图纸裁成正面立绘，抠底后导出到 src/assets/enemies/。

不进游戏运行时。依赖 Pillow / numpy / scipy。
用法：python tools/prep-enemy-art.py <源图目录>
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "src" / "assets" / "enemies"
TOLERANCE = 60      # RGB 绝对差之和
H_MARGIN = 1.06     # 左右各留约 3% 余量

# (key, 源文件, 正面格裁切框, 导出高度, 底部渐隐比例)
# 裁切框逐张目视确认过：naikang / tangbao 的正面在中格，其余在左格，
# doujiao 是手机截图需先裁到照片矩形。凭"取左 1/3"的假设做会产出背对玩家走路的敌人。
CHARACTERS = [
    ("naidou",  "naidou.jpg",           (0,   0,  792, 1280), 248, 0.0),
    ("feidudu", "feidudu.jpg",          (153, 0,  861, 1280), 248, 0.0),
    ("niulai",  "niulai.jpg",           (92,  0,  429,  804), 248, 0.0),
    ("doujiao", "doujiao.jpg",          (0,   618, 1080, 1718), 240, 0.0),
    ("tangbao", "tangbao.jpg",          (447, 0,  854, 1279), 330, 0.0),
    ("lulu",    "lulu.jpg",             (0,   0,  759, 1280), 240, 0.0),
    ("naikang", "naikang.jpg",          (759, 0, 1519, 1280), 448, 0.0),
]
PLACEHOLDER_HEIGHT = 324   # 咕咕嘎嘎小孩：用户重出 3D 版前的占位剪影


def strip_background(rgb):
    """只抠掉与图像边界连通且接近背景中位色的区域。

    不能用全局颜色距离：奶豆/奶康的米白肚皮和浅灰背景亮度差极小会被抠穿。
    肚皮是被黄色身体包住的封闭区域，边界泛洪进不去，因此安全。
    """
    border = np.concatenate([rgb[0, :], rgb[-1, :], rgb[:, 0, :], rgb[:, -1, :]])
    seed = np.median(border, axis=0).astype(np.int16)
    near_bg = np.abs(rgb.astype(np.int16) - seed).sum(axis=2) <= TOLERANCE
    labels, _ = ndimage.label(near_bg)
    touching = np.unique(np.concatenate(
        [labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]]))
    touching = touching[touching != 0]
    return np.where(np.isin(labels, touching), 0, 255).astype(np.uint8)


def process(src_dir, key, filename, box, height, fade):
    panel = Image.open(src_dir / filename).convert("RGB").crop(box)
    rgb = np.asarray(panel, dtype=np.uint8)
    alpha = strip_background(rgb)
    if fade > 0:  # 柔化脚底接触阴影，泛洪吃不掉它；默认关闭，目检发现灰边再开
        n = max(1, int(alpha.shape[0] * fade))
        ramp = np.linspace(1.0, 0.0, n + 1)[1:]
        alpha[-n:, :] = (alpha[-n:, :] * ramp[:, None]).astype(np.uint8)
    ys, xs = np.nonzero(alpha > 8)
    if len(ys) == 0:
        raise SystemExit(f"{key}: 抠底后整图透明，检查裁切框 {box}")
    rgba = np.dstack([rgb, alpha])[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    cut = Image.fromarray(rgba, "RGBA")
    out_w = max(1, round(cut.width * height / cut.height))
    cut = cut.resize((out_w, height), Image.LANCZOS)
    canvas_w = max(out_w + 1, round(out_w * H_MARGIN))
    canvas = Image.new("RGBA", (canvas_w, height), (0, 0, 0, 0))
    canvas.paste(cut, ((canvas_w - out_w) // 2, 0), cut)   # 脚底贴画布下边缘
    canvas.save(OUT / f"{key}.png")
    print(f"{key:9s} 裁切框{box} → 包围盒 {out_w}x{height} → 导出 {canvas_w}x{height}")


def write_placeholder():
    """纯色剪影占位图。文件位置与尺寸规格和正式素材完全一致，重出后同名覆盖零代码改动。"""
    height = PLACEHOLDER_HEIGHT
    width = round(height * 0.62)
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fill, edge = (255, 220, 110, 255), (94, 62, 34, 255)
    head_r = round(width * 0.42)
    head_cy = head_r + round(height * 0.02)
    d.rounded_rectangle([round(width * 0.12), head_cy + round(head_r * 0.5),
                         round(width * 0.88), height - 1],
                        radius=round(width * 0.22), fill=fill, outline=edge, width=3)
    d.ellipse([round(width / 2) - head_r, head_cy - head_r,
               round(width / 2) + head_r, head_cy + head_r],
              fill=fill, outline=edge, width=3)
    eye_r = max(2, round(width * 0.05))
    for ex in (round(width * 0.36), round(width * 0.64)):
        d.ellipse([ex - eye_r, head_cy - eye_r, ex + eye_r, head_cy + eye_r], fill=edge)
    pr = round(width * 0.14)
    py = head_cy + round(head_r * 0.55)
    d.ellipse([round(width / 2) - pr, py - pr, round(width / 2) + pr, py + pr],
              fill=(243, 181, 138, 255), outline=edge, width=3)   # 奶嘴
    img.save(OUT / "gugugaga.png")
    print(f"{'gugugaga':9s} 占位剪影 → 导出 {width}x{height}")


def main():
    if len(sys.argv) != 2:
        raise SystemExit("用法：python tools/prep-enemy-art.py <源图目录>")
    src_dir = Path(sys.argv[1])
    if not src_dir.is_dir():
        raise SystemExit(f"源图目录不存在：{src_dir}")
    OUT.mkdir(parents=True, exist_ok=True)
    for key, filename, box, height, fade in CHARACTERS:
        process(src_dir, key, filename, box, height, fade)
    write_placeholder()
    print(f"完成 → {OUT}")


if __name__ == "__main__":
    main()
```

- [x] **Step 5: 跑脚本**

Run（在项目根执行，脚本自己算 `OUT`）:

```bash
cd "D:/奶龙大战僵尸" && "C:/Users/Lenovo/miniconda3/python.exe" tools/prep-enemy-art.py "C:/Users/Lenovo/AppData/Local/Temp/enemy-pack/pack/assets/enemies"
```

Expected: 7 行 `裁切框… → 导出 …` + 1 行占位 + `完成 →`，无异常退出。

- [x] **Step 6: 逐张目检（本任务真正的验收）**

用 Read 工具逐张看 `src/assets/enemies/` 下 8 张 PNG，检查四件事：

1. **是正面**，不是背面或侧身（最容易错在 `naikang` / `tangbao`，它们的正面在中格）。
2. **肚皮没有被抠穿**（`naidou` / `naikang` 风险最高）。
3. **没有水印**（`lulu` / `naikang` 豆包、`niulai` 小红书）。
4. **脚底贴画布下边缘**，身体完整没有被裁掉。

发现问题按性质处理，不要将就：
- 视角错了 → 改 `CHARACTERS` 里那一行的裁切框，重跑。
- 留了一圈灰边 / 接触阴影 → 把那一行的 `fade` 从 `0.0` 改成 `0.06` 重跑；仍不行就调 `TOLERANCE`（先试 80）。
- 抠穿了身体 → `TOLERANCE` 调小（先试 40）。
- 水印进了画面 → 收紧裁切框右边界。

- [x] **Step 7: 跑测试确认通过**

Run: `node --test tests/enemy-art.test.js`
Expected: PASS，2 项。

- [x] **Step 8: 写素材契约说明**

创建 `src/assets/enemies/README.md`，内容含：8 个文件名与对应角色、spec §6.2 的导出高度表、**脚底贴画布下边缘**的锚点约定、透明底 PNG、"同名同规格覆盖即可，无需改代码"的替换契约、以及重新生成的命令（Step 5 那条）。

- [x] **Step 9: 提交**

```bash
cd "D:/奶龙大战僵尸"
git add tools/prep-enemy-art.py src/assets/enemies src/assets/source-enemies tests/enemy-art.test.js
git commit -m "feat: 新增敌方角色形象加工流水线与 8 张立绘素材"
```

---

### Task 2: 模式A 接入独立形象

**Files:**
- Modify: `src/js/game.js:25-34`（`ZOMBIES`）、`:1555`（渲染）、`:1902-1925`（调试句柄）
- Modify: `src/css/styles.css:117-123`（图例色）、`:174-194`（假护甲与调色滤镜）
- Test: `tests/enemy-art.test.js`（追加）

**Interfaces:**
- Consumes: Task 1 的 `src/assets/enemies/*.png`；`tests/enemy-art.test.js` 里已有的 `SRC`、`ART` 常量与 `boot` 导入位。
- Produces: `ZOMBIES[type].image` 字段；`window.__nailongTower.ZOMBIES` 与 `.spawnZombie` 两个新的调试句柄成员（Task 4 的浏览器实测、Task 6 的全量回归都靠它们逐种摆怪）。

- [x] **Step 1: 写失败测试**

在 `tests/enemy-art.test.js` 顶部补上导入（放在 `const path` 之后）：

```js
const { boot } = require('./helpers/browser-env');
```

在文件末尾追加：

```js
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
```

- [x] **Step 2: 跑测试确认失败**

Run: `node --test tests/enemy-art.test.js`
Expected: FAIL —— `__nailongTower.ZOMBIES` 为 `undefined`（`TypeError: Cannot convert undefined or null to object`）

- [x] **Step 3: 给 ZOMBIES 加 image 并改名**

`src/js/game.js:25-34` 整块替换（数值字段一个不动）：

```js
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
```

- [x] **Step 4: 渲染改读 image，删掉假护甲节点**

`src/js/game.js:1555` 整行替换：

```js
    element.innerHTML = `<img src="${ZOMBIES[zombie.type].image}" alt="${ZOMBIES[zombie.type].name}"><div class="health-track"><div class="health-fill"></div></div>`;
```

- [x] **Step 5: 扩调试句柄**

`src/js/game.js` 的 `window.__nailongTower = {` 块内，在 `game,` 之后插入三行：

```js
  ZOMBIES,
  spawnZombie,
  render,
```

三者都是 `game.js` 顶层已有的标识符（`ZOMBIES` 在 `:25`、`function spawnZombie(type, row, summoned)` 在 `:827`、`function render()` 在 `:1534`），只是过去没导出。浏览器实测与 Task 6 的完整回归都用这三个。

若 Step 1 第二条测试在 `api.render()` 处因 DOM 桩缺东西而抛错，**补 `tests/helpers/browser-env.js` 的桩**（它是测试基建，允许扩展），不要改成断言源码文本来绕过去。

- [x] **Step 6: 删 CSS 假护甲，逐条点名**

`src/css/styles.css` 删除以下整行（**不要按区间删**，`179`/`180`/`186`/`187`/`188`/`192`/`193` 必须保留）：

| 行 | 规则 | 动作 |
| --- | --- | --- |
| 174 | `.armor { position: absolute; pointer-events: none; display: none; }` | 删 |
| 175 | `.zombie.cone .armor, .zombie.bucket .armor, .zombie.runner .armor { display: block; }` | 删 |
| 176 | `.zombie.cone .armor { … }` | 删 |
| 177 | `.zombie.bucket .armor { … }` | 删 |
| 178 | `.zombie.runner .armor { … }` | 删 |
| 179 | `.zombie.runner > img { animation-duration: .34s; }` | **保留** |
| 180 | `.zombie.brute { width: 14%; height: 30%; }` | **保留**（占位盒） |
| 181 | `.zombie.brute > img { filter: saturate(.65) brightness(.82) drop-shadow(…); }` | 删（调色滤镜） |
| 182 | `.zombie.brute .armor { … }` | 删 |
| 183 | `.zombie.spitter .armor { … }` | 删 |
| 184 | `.zombie.spitter > img { filter: hue-rotate(35deg) …; }` | 删 |
| 185 | `.zombie.jumper .armor { … }` | 删 |
| 186 | `.zombie.jumper > img { animation-duration: .28s; }` | **保留** |
| 187 | `.zombie.boss { width: 18%; height: 38%; }` | **保留**（占位盒） |
| 188 | `.zombie.boss::before { … bossAura … }` | **保留**（Boss 红光气质） |
| 189 | `.zombie.boss .armor { … }` | 删 |
| 190 | `.zombie.boss > img { filter: saturate(.75) …; }` | 删 |
| 191 | `.zombie.boss.enraged > img { filter: … }` | **保留**（暴怒强化光） |
| 192–193 | `.zombie.dying` / `.zombie.dying > img` | **保留** |
| 194 | `.zombie.dying .armor, .zombie.dying::before { animation: deathFade …; }` | 改：选择器去掉 `.zombie.dying .armor,`，只留 `.zombie.dying::before` |

删完用 `grep -n "armor" src/css/styles.css` 确认零命中。

- [x] **Step 7: 图例点按新角色主色重调**

`src/css/styles.css:117-123` 七行整块替换：

```css
.legend-dot.basic { background: #f2e3b6; }
.legend-dot.cone { background: #f0a83c; }
.legend-dot.bucket { background: #c9a27a; }
.legend-dot.brute { background: #e0b8a0; }
.legend-dot.spitter { background: #ffd95e; }
.legend-dot.jumper { background: #b98a5a; }
.legend-dot.boss { background: #d94f3a; }
```

（Boss 保留红色警示，不跟随形象成色。Task 6 浏览器实测时若发现相邻两点难分辨，按实际成图微调亮度即可。）

- [x] **Step 8: 语法检查 + 跑测试**

```bash
cd "D:/奶龙大战僵尸" && node --check src/js/game.js && node --test tests/enemy-art.test.js
```
Expected: `node --check` 无输出；测试 PASS，4 项。

- [x] **Step 9: 跑全量测试确认无回归**

Run: `node --test tests/*.test.js`
Expected: 全绿。既有 132 项**不应有任何修改**——若有用例红了，说明本任务误改了数值/波次/几何，回去比对而不是改用例。

- [x] **Step 10: 浏览器实测模式A**

起服务，进 `game.html`，用 `__nailongTower.spawnZombie` 逐种摆怪截图（完整配方见 Task 6 Step 4）。确认：8 种各是独立正面立绘、头顶不再长 CSS 路障/铁桶/皇冠、脚底贴地、`dying` 倒下动画仍生效。**看完关掉服务。**

- [x] **Step 11: 提交**

```bash
git add src/js/game.js src/css/styles.css tests/enemy-art.test.js
git commit -m "feat: 模式A 敌人改用独立形象并移除 CSS 假护甲"
```

---

### Task 3: 模式B 接入独立形象

**Files:**
- Modify: `src/js/action-data.js:72-78`（`enemies`）、`:79-94`（`boss`）
- Modify: `src/js/action.js:974-979`（删 `armorMarkup`）、`:988`（渲染）
- Modify: `src/css/action.css:57-58`（调色滤镜）、`:63-65`、`:94-95`（假护甲）
- Test: `tests/enemy-art.test.js`（追加）

**Interfaces:**
- Consumes: Task 1 的 PNG；Task 2 建立的 `ART` 表（`elite` / `jumper` 共用 `gugugaga.png`，`boss` 共用 `naikang.png`）。
- Produces: `DATA.enemies[type].image` 与 `DATA.boss.image`。

- [ ] **Step 1: 写失败测试**

在 `tests/enemy-art.test.js` 顶部补上（紧跟 `action-data` 相关位置）：

```js
const DATA = require('../src/js/action-data.js');
```

末尾追加。模式B 只有 5 个 `enemies` key（无 `brute` / `spitter` / `jumper`），`boss` 是独立顶层对象：

```js
test('模式B enemies 与 boss 都有 image、文件在磁盘上、名字不含"僵尸"', () => {
  assert.deepEqual(Object.keys(DATA.enemies), ['basic', 'cone', 'bucket', 'runner', 'elite']);
  const table = { ...DATA.enemies, boss: DATA.boss };
  for (const [type, cfg] of Object.entries(table)) {
    assert.ok(cfg.image, `${type} 缺 image 字段`);
    assert.ok(fs.existsSync(path.join(SRC, cfg.image)), `${type} 的 ${cfg.image} 不在磁盘上`);
    assert.ok(!cfg.name.includes('僵尸'), `${type} 仍叫「${cfg.name}」`);
  }
  assert.equal(DATA.enemies.elite.image, 'assets/enemies/gugugaga.png');
  assert.equal(DATA.boss.image, 'assets/enemies/naikang.png');
});

test('模式B 渲染不再注入假护甲', () => {
  const env = boot({
    files: ['progress.js', 'action-data.js', 'action-logic.js', 'action.js'],
    search: '?mode=level&level=1'
  });
  const api = env.global.window.__nailong;
  api.state.sound = false;
  const spawned = Object.keys(DATA.enemies).map((type, i) => api.spawnEnemy(type, 900 + i * 40));
  const boss = api.spawnBoss();
  api.update(0.016);   // update() 在 action.js:1187 调 syncEnemyElements()，走真实渲染路径
  const markup = [...spawned, boss].map(enemy => enemy.el.innerHTML).join('\n');
  assert.equal([...spawned, boss].length, 6, '5 种杂兵 + Boss 应各一只');
  assert.ok(markup, '没有取到任何敌人 DOM，探针失效');
  for (const cls of ['armor', 'cone-armor', 'bucket-armor', 'boss-armor', 'boss-crown']) {
    assert.ok(!markup.includes(cls), `仍在渲染 .${cls} 节点`);
  }
  for (const cfg of Object.values(DATA.enemies)) {
    assert.ok(markup.includes(cfg.image.split('/').pop()), `没有渲染 ${cfg.image}`);
  }
  assert.ok(markup.includes('naikang.png'), '没有渲染 Boss 形象');
});

test('假护甲样式与调色滤镜已从 action.css 删除', () => {
  const css = fs.readFileSync(path.join(SRC, 'css', 'action.css'), 'utf8');
  for (const cls of ['.armor', '.cone-armor', '.bucket-armor', '.boss-armor', '.boss-crown']) {
    assert.ok(!css.includes(cls), `action.css 仍保留 ${cls}`);
  }
  assert.ok(!css.includes('hue-rotate(310deg)'), '.elite 调色滤镜仍在');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/enemy-art.test.js`
Expected: FAIL —— `basic 缺 image 字段`

- [ ] **Step 3: 配置表加 image 并改名**

`src/js/action-data.js:72-78` 整块替换（数值一个不动）：

```js
    enemies: {
      basic: { name: '奶豆', image: 'assets/enemies/naidou.png', hp: 60, speed: 62, damage: 8, range: 58, interval: 1.2, windup: 0.35, xp: 8, knockbackResist: 1, scale: 1 },
      cone: { name: '肥嘟嘟', image: 'assets/enemies/feidudu.png', hp: 100, speed: 58, damage: 10, range: 62, interval: 1.3, windup: 0.4, xp: 12, knockbackResist: 0.9, scale: 1 },
      bucket: { name: '牛来', image: 'assets/enemies/niulai.png', hp: 180, speed: 48, damage: 14, range: 66, interval: 1.5, windup: 0.5, xp: 18, knockbackResist: 0.55, scale: 1 },
      runner: { name: '豆脚', image: 'assets/enemies/doujiao.png', hp: 45, speed: 105, damage: 6, range: 54, interval: 0.9, windup: 0.25, xp: 6, knockbackResist: 1.2, scale: 0.92 },
      elite: { name: '咕咕嘎嘎', image: 'assets/enemies/gugugaga.png', hp: 340, speed: 52, damage: 18, range: 70, interval: 1.4, windup: 0.5, xp: 35, knockbackResist: 0.35, scale: 1.3 }
    },
```

`src/js/action-data.js:79-80` 两行替换（`:81` 起的 `hp: 1200` 等全部保留）：

```js
    boss: {
      name: '奶康',
      image: 'assets/enemies/naikang.png',
```

- [ ] **Step 4: 删 armorMarkup，渲染改读 image**

`src/js/action.js:974-979` 整个函数（含结尾 `}` 与它前面的空行）**删除**：

```js
  function armorMarkup(type) {
    if (type === 'boss') return '<div class="armor boss-armor"></div><div class="boss-crown"></div>';
    if (type === 'cone') return '<div class="armor cone-armor"></div>';
    if (type === 'bucket' || type === 'elite') return '<div class="armor bucket-armor"></div>';
    return '';
  }
```

`src/js/action.js` 的渲染行（原 `:988`）整行替换：

```js
        el.innerHTML = `<img src="${enemy.cfg.image}" alt="${enemy.cfg.name}"><div class="enemy-hp"><div></div></div>`;
```

Run: `grep -n "armorMarkup\|boss-crown" src/js/action.js`
Expected: 零命中。

- [ ] **Step 5: 删假护甲与调色滤镜**

`src/css/action.css` 删除整行：

| 行 | 规则 |
| --- | --- |
| 57 | `.enemy.elite img { filter: hue-rotate(310deg) saturate(1.35) drop-shadow(…); }` |
| 58 | `.enemy.runner img { filter: contrast(1.1) brightness(1.05); }` |
| 63 | `.armor { position: absolute; left: 50%; top: -8%; … }` |
| 64 | `.cone-armor { … }` |
| 65 | `.bucket-armor { … }` |
| 94 | `.boss-armor { … }` |
| 95 | `.boss-crown { … }` |

**保留** `:55 .enemy`、`:56 .enemy img`（含其 `drop-shadow`，改色在 Task 5）、`:59 .enemy.windup img`、`:60 .enemy.dying`、`:66 .enemy.hurt img`、`:90 .enemy.boss`——这些是状态动画与占位盒，与形象无关。

Run: `grep -n "armor\|hue-rotate\|contrast(1.1)" src/css/action.css`
Expected: 零命中。

- [ ] **Step 6: 语法检查 + 跑测试**

```bash
cd "D:/奶龙大战僵尸" && node --check src/js/action.js && node --check src/js/action-data.js && node --test tests/enemy-art.test.js
```
Expected: 测试 PASS，7 项（Task 1 的 2 项 + Task 2 的 2 项 + 本任务 3 项）。

- [ ] **Step 7: 跑全量测试**

Run: `node --test tests/*.test.js`
Expected: 全绿，既有用例零修改。特别注意 `tests/action-logic.test.js:79-82` 读的是 `DATA.boss.scale` 与 `boss.slam.jumpHeight`——本任务没碰这两个字段，红了就是误改。

- [ ] **Step 8: 浏览器实测模式B**

进 `action.html`，用 `__nailong.spawnEnemy` / `spawnBoss` 摆出 5 种 + Boss 截图。确认形象正确、脚底贴地、`windup` / `hurt` / `dying` / `flip` 状态动画仍生效（`flip` 靠 `<img>` 上的 transform，删滤镜不该影响它）。**看完关掉服务。**

- [ ] **Step 9: 提交**

```bash
git add src/js/action-data.js src/js/action.js src/css/action.css tests/enemy-art.test.js
git commit -m "feat: 模式B 敌人改用独立形象并删除 armorMarkup 假护甲"
```

---

### Task 4: 玩家可见文案全量改名

**Files:**
- Modify: `src/index.html`、`src/game.html`、`src/action.html`、`src/action-levels.html`
- Modify: `src/js/game.js`（`:9-22` 我方描述 + 播报/结算/帮助文案）
- Modify: `src/js/action.js`、`src/js/action-levels.js`
- Test: `tests/enemy-art.test.js`（追加）

**Interfaces:**
- Consumes: Task 2/3 已改完的两张配置表（本任务不再动 `name`）。
- Produces: 无（终端改动，Task 5/6 只依赖它把 `assets/zombie.png` 引用清零）。

- [ ] **Step 1: 写失败测试**

末尾追加。扫描的是**真实源码文本**，不是抄一份清单进测试：

```js
function sourceFiles() {
  const out = [];
  for (const dir of [path.join(SRC, 'js'), SRC]) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isFile() && /\.(js|html)$/.test(entry)) out.push(full);
    }
  }
  return out;
}

test('src 下的 js 与 html 不再引用 assets/zombie.png', () => {
  const hits = sourceFiles().filter(f => fs.readFileSync(f, 'utf8').includes('assets/zombie.png'));
  assert.deepEqual(hits.map(f => path.relative(SRC, f)), [], '仍在引用旧僵尸图');
});

test('src 下的 js 与 html 可见文案不再出现"僵尸"', () => {
  const hits = [];
  for (const file of sourceFiles()) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (line.includes('僵尸')) hits.push(`${path.relative(SRC, file)}:${i + 1}`);
    });
  }
  assert.deepEqual(hits, [], '仍有含"僵尸"的文案');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/enemy-art.test.js`
Expected: FAIL，两条都红，且第二条列出的行号应与 spec §四 清单一致。**把这份行号清单当作本任务的作业清单**——它就是权威，比 spec 里的表更即时。

- [ ] **Step 3: 改主菜单与 hero 图**

`src/index.html`：

| 行 | 现文案 | 改为 |
| --- | --- | --- |
| 7 | `<title>奶龙大战僵尸 · 奶家小院</title>` | `<title>奶家人的奇妙冒险</title>` |
| 23 | `<img class="hero-zombie" src="assets/zombie.png" alt="僵尸">` | `<img class="hero-zombie" src="assets/enemies/naikang.png" alt="奶康">`（类名 `hero-zombie` 是内部标识符，保留） |
| 27 | `<h1>奶龙大战僵尸</h1>` | `<h1>奶家人的奇妙冒险</h1>` |
| 41 | `<span class="mode-tag">奶龙战僵尸</span>` | `<span class="mode-tag">邪恶家人来袭</span>` |
| 44 | `横版格斗闯关，逐段清怪决战僵尸王；或挑战无尽波次。` | `横版格斗闯关，逐段清怪决战奶康；或挑战无尽波次。` |
| 71 | `<span class="eyebrow">奶龙战僵尸</span>` | `<span class="eyebrow">邪恶家人</span>` |
| 76 | `<span>12 关闯关 · 精英怪 · 僵尸王</span>` | `<span>12 关闯关 · 精英怪 · 奶康</span>` |
| 100 | `<h3>奶龙战僵尸</h3>` | `<h3>奶家人的奇妙冒险</h3>` |
| 101 | `…闯关终点是僵尸王，无尽模式波次无限增强。` | `…闯关终点是奶康，无尽模式波次无限增强。` |

- [ ] **Step 4: 改塔防页**

`src/game.html`：`:7` `<title>` → `奶家人的奇妙冒险`；`:33` `aria-label="奶龙大战僵尸主页面"` → `aria-label="奶家人的奇妙冒险主页面"`；`:42` 与 `:111` 的 `<h1>奶龙大战僵尸</h1>` → `奶家人的奇妙冒险`；`:66` `第 12 关迎战僵尸王` → `第 12 关迎战奶康`；`:165` `<strong>僵尸王</strong>` → `<strong>奶康</strong>`（同行 `<span id="bossPhase">召唤援军 · 远程压制</span>` 与现有 Boss 行为一致，保留）。

`:147` 图鉴整行替换（`legend-dot` 类名保留，它们是内部标识符）：

```html
          <div class="zombie-legend"><span class="legend-dot basic"></span>奶豆<span class="legend-dot cone"></span>肥嘟嘟<span class="legend-dot bucket"></span>牛来<span class="legend-dot brute"></span>唐包<span class="legend-dot spitter"></span>噜噜<span class="legend-dot jumper"></span>咕咕嘎嘎<span class="legend-dot boss"></span>奶康</div>
```

- [ ] **Step 5: 改模式B 两页**

`src/action.html`：`:6` `<title>奶龙战僵尸</title>` → `<title>奶家人的奇妙冒险</title>`；`:37` Boss 血条 `<span>僵尸王</span>` → `<span>奶康</span>`。

`src/action-levels.html`：`:6` `<title>奶龙战僵尸 - 闯关模式</title>` → `<title>邪恶家人 - 闯关模式</title>`。

- [ ] **Step 6: 改 game.js 我方描述与播报**

`src/js/game.js:9-22` 的 `TYPES` 里，7 处含"僵尸"的 `description`（`:11 :13 :15 :16 :18 :19 :22`）按规则改写：泛指个体 → `敌人`，首次/强调 → `邪恶家人`。示例（其余同规则）：

```js
  rat: { … description: '向本行最近的敌人丢石头，稳定单体输出。' },
  dragon: { … description: '喷出奶香火焰，对目标及附近敌人造成范围伤害。' },
  dog: { … description: '吠叫使本行敌人减速；敌人靠近时会直接撕咬。' }
```

`game.js` 其余行（`:746 :750 :751 :847 :1088 :1354 :1426 :1461 :1463 :1491 :1669 :1729 :1732 :1733`）同规则替换。两处固定搭配：`僵尸王` → `奶康`；`击退僵尸` → `击退敌人`。

- [ ] **Step 7: 改 action.js 与 action-levels.js**

`src/js/action.js` 的 `:604 :670 :866 :946 :1031 :1100 :1141 :1142 :1282 :1284` 同规则。`:1282` 的 `<h2>奶龙战僵尸</h2>` → `<h2>奶家人的奇妙冒险</h2>`。

`src/js/action-levels.js:75`：`最终决战：僵尸王` → `最终决战：奶康`，`击败所有僵尸` → `击败所有邪恶家人`。

- [ ] **Step 8: 跑测试确认通过**

```bash
cd "D:/奶龙大战僵尸" && node --check src/js/game.js && node --check src/js/action.js && node --check src/js/action-levels.js && node --test tests/enemy-art.test.js
```
Expected: 测试 PASS，9 项。

- [ ] **Step 9: 跑全量测试**

Run: `node --test tests/*.test.js`
Expected: 全绿。

- [ ] **Step 10: 浏览器实测三页文案**

主菜单 / `game.html` / `action.html` 各截一张，确认标题、卡片、图鉴、Boss 血条都换了新称呼，hero 图是奶康。**关掉服务。**

- [ ] **Step 11: 提交**

```bash
git add src/index.html src/game.html src/action.html src/action-levels.html src/js/game.js src/js/action.js src/js/action-levels.js tests/enemy-art.test.js
git commit -m "feat: 玩家可见文案改用邪恶家人称呼，标题改为奶家人的奇妙冒险"
```

---

### Task 5: 拆开敌我落地阴影

**Files:**
- Modify: `src/css/styles.css:159`
- Modify: `src/css/action.css:56`

**Interfaces:**
- Consumes: Task 2/3 完成后的成图（8 名新角色与奶家人同为奶黄色系）。
- Produces: 无。纯观感调整，回退只需还原两行 CSS。

- [ ] **Step 1: 拆模式A 共用阴影**

`src/css/styles.css:159` 现为敌我共用：

```css
.entity > img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 5px 3px rgba(45,65,30,.25)); }
```

替换为三行（我方保持绿调，敌人改暗红调）：

```css
.entity > img { width: 100%; height: 100%; object-fit: contain; }
.plant > img { filter: drop-shadow(0 5px 3px rgba(45,65,30,.25)); }
.zombie > img { filter: drop-shadow(0 5px 3px rgba(120,40,30,.30)); }
```

注意 `.zombie.hit > img`（`:171`）会整体覆盖 `filter`，受击闪白行为不变，符合预期。

- [ ] **Step 2: 模式B 敌人阴影同调**

`src/css/action.css:56` 整行替换：

```css
.enemy img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 8px 7px rgba(120, 40, 30, .28)); }
```

- [ ] **Step 3: 跑全量测试**

```bash
cd "D:/奶龙大战僵尸" && node --test tests/*.test.js
```
Expected: 全绿（CSS 不在单测覆盖内，此步只确认没误碰 JS）。

- [ ] **Step 4: 浏览器对比看图（本任务验收）**

模式A `startLevel(12)` 摆满 8 种 + 若干我方角色，截图判断"能否一眼分清敌我"。再对照改动前的截图。若用户/控制者认为多余，还原这两行即可，不影响任何逻辑。

- [ ] **Step 5: 提交**

```bash
git add src/css/styles.css src/css/action.css
git commit -m "style: 敌人落地阴影改暗红调，与奶家人区分"
```

---

### Task 6: 文档同步与完整回归

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Test: 全量 `node --test tests/*.test.js`

**Interfaces:**
- Consumes: Task 1–5 的全部产出。
- Produces: 无（终端任务）。

- [ ] **Step 1: 同步 README**

`README.md` 里"僵尸"出现在标题、模式A 玩法、敌人表（`:87-97`）、模式B 段（`:101 :114 :116 :118`）。按 spec §四 的规则全量替换：`僵尸王` → `奶康`，泛指个体 → `敌人` / `邪恶家人`，标题 → `奶家人的奇妙冒险`。敌人表七行改成新角色名（保留各自数值与定位描述）。

Run: `grep -n "僵尸" README.md`
Expected: 零命中。

- [ ] **Step 2: 更新 AGENTS.md**

在「文件职责」代码块补两行，并新增一条已知坑：

```
src/assets/enemies/                                       8 名敌方角色立绘；文件名是稳定契约，同名同规格覆盖即可
src/assets/source-enemies/                                需求包原始三视图，抠图用，代码零引用，不许删
tools/prep-enemy-art.py                                    开发期素材加工（Pillow/numpy/scipy），不进运行时
```

已知坑新增一条：

```
- **敌人形象靠 `ZOMBIES[type].image` / `DATA.enemies[type].image` 读取**，假护甲 CSS 已删除。加新敌人类型必须同时给 `image`，否则渲染出 `src="undefined"`。`tests/enemy-art.test.js` 会守住这一点。
```

- [ ] **Step 3: 写 CHANGELOG（倒序置顶）**

在 `CHANGELOG.md` 第一个 `## ` 之前插入新条目，四段齐全：**更新类型 / 改动内容 / 影响范围 / 验证**。验证段必须是实跑结果，抄 Step 5 与 Step 4 的实际输出，不许写"应该没问题"。

- [ ] **Step 4: 完整浏览器回归**

起服务后按此配方跑（合成按键不可靠，一律走调试句柄）：

```js
// game.html —— 模式A 八种齐出
const api = window.__nailongTower;
api.game.sound = false;
api.startLevel(12);
Object.keys(api.ZOMBIES).forEach(t => api.spawnZombie(t));
```

```js
// action.html —— 模式B 五种 + Boss
const api = window.__nailong;
Object.keys(window.ACTION_DATA.enemies).forEach(t => api.spawnEnemy(t));
api.spawnBoss();
```

检查清单：
- 控制台 error / warn 为 **0**；`list_network_requests` 无 404（尤其 `assets/zombie.png` 不再被请求）。
- 模式A：8 种独立形象、无假护甲残留、脚底对齐、`dying` 倒下动画正常。
- 模式B：闯关 3 屏推进 + 无尽各截一张；`windup` / `hurt` / `dying` / `flip` 状态动画都还在。
- 主菜单：hero 图与三张卡片文案。
- 存档未被破坏：刷新后奶黄余额与通关进度仍在。

**测完清掉浏览器 localStorage 并关掉本地服务。**

- [ ] **Step 5: 全量测试**

```bash
cd "D:/奶龙大战僵尸" && node --test tests/*.test.js
```
Expected: 全绿，共 141 项（既有 132 + 新增 9）。**以实跑输出为准，不要照抄这个数字。**

- [ ] **Step 6: 提交**

```bash
git add README.md CHANGELOG.md AGENTS.md
git commit -m "docs: 同步敌方角色替换说明并记录本次更新"
```
