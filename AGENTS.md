# AGENTS.md — 奶龙大战僵尸

本文件为在此仓库上工作的 AI 编码代理（与人类协作者）提供项目约定。修改代码前先读这里。

## 项目性质

纯原生 HTML / CSS / JavaScript 网页游戏合集。**没有构建步骤、没有依赖、没有 `package.json`** —— 所有 `.js` / `.css` 通过 `<script>` / `<link>` 标签直接加载。不要引入框架、打包器或 npm 包，除非用户明确要求。

全部可运行代码在 `src/` 下（页面在 `src/*.html`，样式在 `src/css/`，脚本在 `src/js/`，素材在 `src/assets/`）；仓库根只留 `启动游戏.bat`、三份文档、`tests/` 与 `docs/`。

## 术语：模式A 与 模式B

| 称呼 | 含义 | 入口 |
| --- | --- | --- |
| **模式A** | 塔防（五行九列庭院，放置奶家人） | `src/game.html` |
| **模式B** | 横版格斗（操控奶娃清怪与打僵尸王） | `src/action.html` |

用户说"模式A/模式B"时按此对应，不要混淆两套代码。

## 文件职责

```
src/index.html + src/css/menu.css + src/js/menu.js      主菜单（三张模式卡 + 奶黄余额横幅）
src/js/progress.js                                      唯一存档层（读/迁移/归一化/写），UMD 同时供 Node 测试
src/game.html + src/css/styles.css + src/js/game.js     模式A：塔防主逻辑与关卡选择页
src/action.html + action.css + action.js                模式B：横版格斗主逻辑
src/js/action-data.js                                   模式B 全部数值配置（玩家/敌人/Boss/升级池/无尽）
src/js/action-logic.js                                  模式B 纯逻辑层（无 DOM，可单测）
src/action-levels.*                                     模式B 关卡选择页
src/upgrade.*                                           奶娃强化系统（主菜单进入，消耗全局奶黄）
src/assets/                                             角色图与 baby-laugh.mp4；source-* 是抠图源文件
tests/helpers/browser-env.js                            把 src/js 下生产脚本载入 Node VM 的最小 DOM 桩
tests/*.test.js                                         Node 内置测试运行器的用例
启动游戏.bat                                             双击打开 src/index.html
```

页面里引用样式与脚本必须带目录前缀（`href="css/menu.css"`、`src="js/progress.js"`）；`assets/` 与页面同级，所以 JS 里动态拼的 `assets/${key}.png` 不需要改前缀。

## 常用命令

```bash
node --test tests/*.test.js          # 全部单元测试（当前 132 项）
node --check src/js/action.js        # 语法检查，改完每个 JS 文件都跑一遍
"C:/Users/Lenovo/miniconda3/python.exe" -m http.server 4173 --bind 127.0.0.1
```

本地服务只用于验证，**用完必须关掉**——残留的 socket 会干扰用户自己的应用。起服务后入口是 `http://127.0.0.1:4173/src/index.html`（根路径不再有 `index.html`）。

## 架构约定

**纯逻辑与 DOM 分离。** 任何可独立计算的规则（波次缩放、经验曲线、碰撞几何、解锁判定）都放进 `action-logic.js` 这类无 DOM 模块并配单测；页面脚本只负责编排与渲染。`action-logic.js` 用 UMD 尾巴同时服务 Node 与浏览器：

```js
if (typeof module === 'object' && module.exports) module.exports = createLogic(require('./action-data.js'));
else root.ActionLogic = createLogic(root.ACTION_DATA);
```

**几何统一用脚底坐标。** 实体 `y` 是脚底，身体占据 `[y - height, y]`。命中判定必须同时检查水平与纵向重叠，只比 `dx` 会导致"玩家跳起来了还是被打到"。工具函数：`Logic.rectsOverlap(a, b)`（AABB）与 `Logic.verticalOverlap(footY, height, otherFootY, otherHeight)`。

**数值集中在配置里。** 模式B 改数值去 `action-data.js`，模式A 改数值去 `game.js` 顶部的 `TYPES` / 关卡常量，不要在逻辑分支里写魔法数字。

**升级属性必须真正被读取。** 肉鸽升级池（`DATA.upgrades`）的每个 `apply` 键都要在 `MULTIPLIER_KEYS` 里且在 `action.js` 有消费点。历史上出现过 `attackSpeedMul` 这种"加了但从没生效"的死属性，加新属性时确认读取路径存在。

## 存档与货币（最容易改错的地方）

**`progress.js` 是唯一被允许的存档入口。** 任何页面（`game.js` / `action.js` / `upgrade.js` / `action-levels.js` / `menu.js`）读写进度都必须走 `ProgressStore.load()` / `.update(mutator)` / `.save(progress)`，**不要**再自己 `JSON.parse(localStorage[...])`——历史上每个页面各存一份实现，字段集合不一致，一个页面写出的半成品存档会把另一个页面的字段读成默认值（Issue #2 第 1 项就是这个）。每个 HTML 都在自己的页面脚本之前加载 `progress.js`。

- 存档键 `nailong-vs-zombies-progress-v2`；旧键 `...-v1` 只用于读取迁移，迁移完成后 `load()` 会删除它。损坏/缺字段一律经 `normalize()` 回退默认档。
- **分层合并**：`mergeProgress(v1, v2)` 只在 v2 *确实携带*某字段（`hasOwnProperty`）时才覆盖 v1 迁移结果。新增字段要同时进 `FIELDS` 和 `normalize()`，否则会被静默丢弃。
- **两个"奶黄"是不同的东西**：
  - `progress.custard` —— 全局持久货币，主菜单/强化页/关卡选择页显示的都是它。
  - `game.custard` —— 模式A 单局内的可用资源。
- 生命周期：进关用 `Math.max(150, progress.custard)` 开局（保底 150 防止破产软锁），结算 `progress.custard = game.custard + reward` 写回，中途退出在 `leaveToHome()` 写回。
- `leaveToHome()` 有 `game.state === 'running'` 守卫，防止结算弹窗里再点"返回主页"导致重复计入。**改动这几处时务必保住该守卫**，否则会双倍发钱。
- 关卡上限是 `ProgressStore.MAX_LEVEL`（12）。模式A 到 12 就封顶：`startLevel()` 拒绝越界，最终关结算不给"下一关"按钮。模式B 每关的战斗配置由 `Logic.levelConfig(level)` 现算，不要在 `action-data.js` 里写死单关。
- 解锁：`isCharacterUnlocked()` 采用"**拥有即解锁**"——存档里已登记的角色永远可用（保护 v1 迁移来的角色），否则按 `CHARACTER_UNLOCK_LEVELS` 通关等级。模式B 关卡按 `ProgressStore.actionLevelsUnlocked(endlessWave)` = `Math.floor(endlessWave / 3) + 1`（上限 12）解锁。
- 持久强化：`progress.upgrades[key]` 等级 0–7（`MAX_UPGRADE_LEVEL`），费用 `[100,200,400,800,1600,3200,6400]`，在模式A `applyModeAUpgrades()` 与模式B `applyModeBUpgrades()` 注入本局数值。

## 必须遵守的流程

1. **每次更新都要写 `CHANGELOG.md`** —— 倒序置顶，含"更新类型 / 改动内容 / 影响范围"，并写清验证方式。这是项目既有硬性约定。
2. **先测试后实现**（TDD）—— 逻辑改动先在 `tests/` 写失败用例，确认红→绿，再提交。
3. **测试不许复制被测函数。** 把生产逻辑抄进测试文件只会让它在生产改动后继续"绿灯"（Issue #2 的测试覆盖缺口就是这样）。跨页面/跨存档的用例走 `tests/helpers/browser-env.js` 的 `boot({ files, search, save })` 加载**未经修改**的生产脚本来驱动，需要的内部函数由生产脚本自己加进调试句柄（`window.__nailong`、`window.__nailongTower`）导出；纯计算函数用 UMD 直接 `require`。
4. 提交信息沿用仓库风格：中文、conventional 前缀（`fix:` / `feat:` / `test:` / `docs:`）。
5. 分支：日常开发在 `dev`，`main` 为默认分支；远端 `origin` = `https://github.com/Jyutoo/neon-vs-zombie.git`。

## 已知坑

- **目录名是中文**（`D:\奶龙大战僵尸`）。个别 Windows 工具链对中文路径有 bug，涉及编译/外部工具时先复制到 ASCII 临时目录。
- **舞台固定 1280×720**：`action.css` 的 `.stage-wrap { place-items: center }` 配 `action.js` 的等比缩放，窗口窄于 1280 CSS px 时舞台会被推出可视区。用户正常浏览器宽度下不显现，改布局前先确认是不是这个既有行为。
- **`BABY_VIDEO_CROP` 与 `assets/baby-laugh.mp4` 的实际分辨率绑死**：模式A 不直接放视频，`drawBabyFrame()` 按这个矩形把视频帧画到 176×243 canvas 再抠底。换视频文件必须按新分辨率重算矩形（微信原片是 592×1280 的整屏录屏，矩形必须躲开状态栏、录屏胶囊、底部「停止」按钮和左边缘 1px 黑边），否则奶娃跑偏或把 UI 画进来。改完用浏览器导出 canvas 帧确认构图。
- `DATA.player.fire.halfAngleDeg` 是**未被使用的配置**：`.fire-breath` 实际画成固定 92px 高的横条，命中框按矩形实现以对齐视觉。不要以为它是活的锥角参数。
- 模式B 主角是**奶娃**（不是奶龙）；喷火技能已改为"音波"。文案与素材别写回奶龙。
- `assets/source-*` 是抠图用的原始素材，代码零引用但有意保留，**不要当垃圾删**。
- 模式B 的震荡波依赖 `state.player.onGround`，僵尸普攻与 Boss 冲撞依赖纵向重叠——"跳起来就闪避"是刻意设计，别改回只比水平距离。
- **最后一段 Boss 屏不在 `DATA.level.screens` 里**：`action-data.js` 只配第 1 关的基础战斗段，`Logic.levelConfig()` 负责成长并**追加** `{ boss: true }`。要拿 Boss 段下标就读 `state.levelFlow.screens.length - 1`，写 `DATA.level.screens.length - 1` 会指到一个战斗段、绕过 Boss 的胜利判定。
- `updateLevelFlow()` 的"清场即推进"只在 `levelPhase === 'combat'` 生效。Boss 常常是最后一名敌人，若允许在 `boss` 阶段推进，阶段会被切成 `advance`、胜利检查再也进不去（Issue #2 的 P1 回归）。

## 验证要求

声称"修好了"之前必须给出证据：测试输出、`node --check` 结果、或浏览器实测数据（控制台无错 + 行为差异对照）。UI 改动要在浏览器里实际看过，否则明确说明未经验证。
