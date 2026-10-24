# 优化记录

## 2026-10-25 项目结构调整：全部代码收进 `src/`

**更新类型：** 重构（无功能变更）

**改动内容：**
1. **建立 `src/` 目录树** — 5 个页面移到 `src/`，5 个样式移到 `src/css/`，8 个脚本移到 `src/js/`，`assets/` 整目录移到 `src/assets/`（含 `source-*` 抠图源文件，按约定保留）。全部用 `git mv` 完成，`git status` 里 40 项都是 `R`（重命名），历史未断
2. **素材引用零改动** — 之所以让 `assets/` 跟着进 `src/`，是因为 `game.js` / `action.js` / `upgrade.js` 里有 14 处动态拼的 `assets/${key}.png`（还有 `assets/baby-laugh.mp4`），另有 2 处测试断言按 `assets/${key}.png` 字符串匹配卡片。页面与素材同在 `src/` 下，这些字符串一个字都不用改；若把 assets 留在根目录，这 16 处都要改成 `../assets/` 且极易漏
3. **页面引用加目录前缀** — 17 处 `<link>` / `<script>` 改为 `css/xxx.css` 与 `js/xxx.js`；跨页链接（`index.html`、`game.html`、`action.html?mode=endless` 等）因页面仍在同一目录而不受影响；5 个 CSS 文件内 **没有任何 `url()`**，所以移动 css 不牵动素材
4. **启动器改指新入口** — `启动游戏.bat` 由 `start "" "%~dp0index.html"` 改为 `start "" "%~dp0src/index.html"`
5. **测试层跟进** — `tests/helpers/browser-env.js` 的 `readFile()` 改为在 `src/js` 下解析裸文件名，因此 6 处 `boot({ files: [...] })` 不必逐个改；9 个测试文件里 12 处 `require('../x.js')` 统一改为 `require('../src/js/x.js')`。`action-logic.js` UMD 尾巴里的 `require('./action-data.js')` 是同目录相对路径，随两个文件一起移动仍然成立
6. **文档同步** — AGENTS.md 的文件职责树、模式A/B 入口、常用命令（`node --check src/js/action.js`）、本地服务入口 URL 全部更新，并新增「页面引用必须带 `css/` `js/` 前缀、`assets/` 与页面同级」的约定；README 的启动说明、入口表、项目结构树（顺带把过期的「6 个文件 80 项」修正为「10 个文件 132 项」并补上 4 个新测试文件与 `progress.js`）、开发与测试命令一并更新

**影响范围：**
- 移动：`src/*.html`（5）、`src/css/*`（5）、`src/js/*`（8）、`src/assets/*`（22）；仓库根现在只剩 `启动游戏.bat`、`AGENTS.md`、`CHANGELOG.md`、`README.md`、`src/`、`tests/`、`docs/`
- 修改：5 个 HTML 的资源引用、`启动游戏.bat`、`tests/helpers/browser-env.js`、9 个测试文件的 `require` 路径、`README.md`、`AGENTS.md`
- **未改动任何生产 JS/CSS 的内容**（除路径无关的部分为零）：`src/js/*.js` 与 `src/css/*.css` 的文件内容一字未变
- 用户侧影响：入口从仓库根的 `index.html` 变为 `src/index.html`。若曾在浏览器里收藏过 `file:///D:/奶龙大战僵尸/index.html`，需要重新收藏新地址；`localStorage` 不会因移动丢档 —— 实测 `file://` 页面的 `location.origin` 就是 `file://`（不是按目录切分的 opaque origin），从 `src/upgrade.html` 写入的键在 `src/index.html` 里直接读得到，所以旧存档按新路径照样能读

**验证：** `node --test tests/*.test.js` → 132 项 / 0 失败（移动前后各跑一次，数字一致）；`node --check` 对 `src/js/` 下 8 个脚本全部通过。另在真实浏览器（`file:///D:/奶龙大战僵尸/src/...`）逐页复核：
- `src/index.html` — `css/menu.css` 载入 64 条规则，5 张图全部解码成功，`ProgressStore` 存在，余额横幅由 `menu.js` 填成 500
- `src/game.html` — `css/styles.css` 383 条规则，33 张带 `src` 的图 0 失败，`__nailongTower` 就绪，`startLevel(1)` 后 `state = running`、`custard = 500`、90 个格子渲染
- `src/action.html?mode=level&level=12` — `css/action.css` 99 条规则，12 张图 0 失败，第 12 关配置正确（`screens 6`、`worldWidth 7680`、僵尸王 3180 血），舞台宽 1280，`status = playing`
- `src/action-levels.html` — 45 条规则，渲染 5 张关卡卡片、全新玩家 4 张锁定
- `src/upgrade.html` — 40 条规则，14 张图 0 失败，13 张强化卡片中 9 张显示解锁条件
- 网络面板 17 个资源请求全部 200、无 404；控制台 error / warn 为 0；测试结束后已清空该浏览器的 `localStorage`

---

## 2026-10-25 重写 `tests/integration.test.js`：改用真实入口（Issue #2 测试缺口收尾）

**更新类型：** 测试

**改动内容：**
1. **删除 14 份生产函数副本** — 文件顶部原本抄了 `migrateSaveV1ToV2` / `defaultProgress` / `createMockStorage` / `loadProgressWithMigration` / `levelWaveCount` / `firstClearReward` / `repeatReward` / `checkCharacterUnlocks` / `modeBUnlockedLevel` / `getUpgradeMultiplier` / `computeModeAEffects` / `computeModeBEffects` / `finishModeALevel` / `performUpgrade`，然后对着自己的副本断言；其中存档相关的几份在 `progress.js` 收口后已不存在于生产代码，等于永久绿灯。现在 29 个用例全部经 `tests/helpers/browser-env.js` 载入未修改的生产脚本来驱动：`window.__nailongTower`、`window.__nailong`、`upgradeCharacter`、`unlockedLevel` 与 `ProgressStore.*`
2. **场景改为跨页面串联** — 打关用 `startLevel()` + `finishGame(true/false)` 并断言落盘存档；解锁用真实结算路径（顺带校验 `toast` 文案与 `isUnlocked()`）；强化走商店真实购买路径，价格从卡片 `innerHTML` 里读来而不是写死（含「全阵容升满花 165,100」）；模式B 解锁走 `finishEndless()` / `winLevel()` → 关卡选择页渲染出的卡片 class
3. **按生产实现校正断言**（副本与真实行为不一致的地方一律保留生产行为）：结算写回是 `progress.custard = game.custard + reward`（含 150 保底与局内消费），重玩旧关卡会把 `selectedLevel` 移到该关，`highestCleared` 在迁移时钳到 12，`totalEarned` 已不是 v2 字段，`finishGame` 有 `state !== 'running'` 守卫（重复结算不再二次发钱），越界的波次记录经 `actionLevelsUnlocked` 归到 1
4. **去掉与 `tests/save-paths.test.js` / `tests/progress-store.test.js` 重复的用例** — 五个纯 `modeBUnlockedLevel` 公式用例、以及「模式B 结算不会抹掉钱包」「第 12 关通关不给第十三关」两类场景不再重复添加

**影响范围：** 仅 `tests/integration.test.js`（824 行 → 749 行，33 个用例 → 29 个）；未改动任何生产文件与其他测试文件。测试文件内只剩驱动型辅助（boot / 播种存档 / 读取渲染结果 / 跨 realm 复制值）
- 注意：VM 上下文里造出的对象带的是那个 realm 的原型，跨 realm 的 `deepEqual` 会只因原型不同而失败，故加了 `plain()` 再比较
- 注意：DOM 桩不会因 `innerHTML = ''` 清空 `children`，页面重渲染是追加，取卡片必须取最后一个匹配项

**验证：** `node --check tests/integration.test.js` 通过；`node --test tests/integration.test.js` → 29/29 通过；`node --test tests/*.test.js` 全绿。另在仓库外的临时副本上做过变异测试（仅改副本，未动生产文件）：`firstClearReward` 斜率 15→14、`actionLevelsUnlocked` 除 3→除 4、`UPGRADE_COSTS` 800→900、`healOnKill` ×2→×3、`levelWaveCount` 5→6、结算改回 `progress.custard + reward` 均导致对应用例失败，改回后重新全绿。

---

## 2026-10-25 修复 Issue #2：存档遮蔽、强化空卡片与关卡边界（6 项）

**更新类型：** 修复

**改动内容：**
1. **新增 `progress.js` 统一存档层**（对应 Issue #2 第 1、2、6 项） — 此前 `game.js` / `action.js` / `upgrade.js` / `action-levels.js` / `menu.js` 各自实现一份读写逻辑，字段还不一样。新模块把「读档 → v1 迁移 → 归一化 → 落盘」收成一个入口，并按字段是否存在分层合并：无尽模式只写 `endlessBest` 时不会把 v1 迁移来的 `custard`/`highestCleared`/`unlocked` 覆盖成默认值，塔防页面不再显示 0 奶黄、0 通关、4 个角色
2. **强化页面不再依赖存档存在**（第 2 项） — 删除 `renderUpgradeCards()` 里 `if (!progress) return;` 的提前返回，全新玩家直接进入「强化奶娃」也能看到 13 张卡片与 500 奶黄余额，而不是空白网格
3. **拥有即解锁**（第 6 项） — `isCharacterUnlocked()` 同时接受「存档里已拥有」与「通关等级达标」两个条件，v1 迁移保留下来的角色（如奶龙）在强化页保持可用，不会被重新锁回
4. **模式B 12 关独立战斗配置**（第 4 项） — 新增 `Logic.levelConfig(level)`，按关卡生成屏幕数、每屏批次、怪物成长与世界宽度；`action-data.js` 的 `level.screens` 退化为「基础战斗模板」，Boss 屏改由 `levelConfig` 追加。第 1 关 3 段 / 僵尸王 1200 血，第 12 关 5 段 / 僵尸王 3180 血，怪物血量与伤害按关卡倍率缩放
5. **塔防关卡硬上限 12**（第 5 项） — `startLevel()` 拒绝越界请求并提示「第 12 关就是最终关」；通关第 12 关时 `selectedLevel` 钳制在 12，结算弹窗不再出现「下一关」，改为全通关庆祝文案
6. **Boss 作为最后一名敌人时正常结算**（旧缺陷回归 P1） — `updateLevelFlow()` 的清场推进只作用于 `levelPhase === 'combat'`，避免 Boss 屏在 Boss 尚存活时被切成 `advance` 而绕过胜利判定
7. **补齐真实入口测试**（Issue #2 的测试覆盖缺口） — 新增 `tests/helpers/browser-env.js`（在不修改源码的前提下把生产脚本载入 Node VM，含 DOM/localStorage 桩），配套 `progress-store`、`save-paths`、`action-level-flow`、`boss-settlement` 四个新测试文件，全部调用页面真实入口而非复制逻辑；`game.js`/`action.js` 的调试句柄相应扩充导出面
8. **同步失效文案与文档** — 关卡结构调整后，`index.html` 的"击退五波僵尸""三段关卡"与 `game.html` 的"每关五波…每 5 关迎战僵尸王"都已与实现不符，改为"守住 12 关庭院""逐段清怪决战僵尸王""每关 5–10 波…第 12 关迎战僵尸王"；README 的模式B 闯关段补上逐关成长公式；AGENTS.md 明确 `progress.js` 是唯一存档入口，并新增"测试不许复制被测函数"的流程约定与两条已知坑（Boss 屏下标、清场推进只作用于 combat 阶段）
9. **改造 5 份复制逻辑的旧测试** — `tests/save-migration.test.js`、`unlock-logic.test.js`、`level-config.test.js`、`upgrade-effects.test.js`、`integration.test.js` 原先各自抄一份被测函数再对副本断言（`progress.js` 收口后，抄存档的那几份等于永久绿灯）。现全部改为经 `browser-env.js` 驱动生产入口，用例总数从 80 增至 132；`integration.test.js` 的重写细节见本文顶部那条独立记录

**影响范围：**
- 新增 `progress.js`；`index.html`、`game.html`、`action.html`、`action-levels.html`、`upgrade.html` 均在其页面脚本之前加载该文件
- `game.js`：删除 `defaultProgress` / `migrateSaveV1ToV2` / `loadProgress`，改由 `ProgressStore` 提供；新增关卡上限与最终关结算
- `action.js`：`levelFlow` 进入 state，敌人/Boss 按关卡缩放，`winLevel` / `finishEndless` 改走 `ProgressStore.update`，删除废弃的 `nailong.action.endlessBest` 独立键
- `action-logic.js` / `action-data.js`：新增 `levelConfig` 与 `level.progression` / `level.maxLevel`，删除死配置 `storageKeys`
- `upgrade.js`、`action-levels.js`、`menu.js`：改为调用 `ProgressStore`
- 测试：新增 4 个文件共 26 个用例；另把 5 份复制被测函数的旧文件改为驱动生产入口，套件规模 80 → 132 项

**验证：** `node --test tests/*.test.js` 全部通过（132 项 / 0 失败），8 个 JS 文件 `node --check` 无语法错误。另在真实浏览器（file:// 打开各页面）逐项复核 Issue #2：先玩无尽再进塔防仍读到 350 奶黄 / 5 关 / 6 个角色且 v1 键被正常退役；全新玩家进入强化页得到 13 张卡片与 500 余额；第 12 关实测 6 段（5 段战斗 + 僵尸王）、`worldWidth 7680`、僵尸王 3180 血、小怪 126 血 / 12.4 伤害 / 75.6 速度（对第 1 关的 60 / 8 / 62），舞台标签为「第 1 / 5 段」；清空第 12 关最后一名敌人（僵尸王）后 `status = won`、`levelPhase = cleared` 并弹出「闯关成功 第 12 关通过」，存档写入 `actionHighestCleared: 12`；通关第 12 关后 `selectedLevel` 停在 12、结算无「下一关」按钮、`startLevel(13)` 被提示拒绝；v1 迁移来的奶龙在强化页可升级而小马显示「通关第 9 关解锁」；关卡选择页在 `endlessBest.wave = 9` 时放出 4 关、第 5 关锁定。全过程控制台无 error / warn。

---

## 2026-10-25 新增 AGENTS.md、重写 README、清理失效文档

**更新类型：** 文档

**改动内容：**
1. **新增 `AGENTS.md`** — 为 AI 编码代理沉淀项目约定：模式A/模式B 术语、文件职责、测试与语法检查命令、纯逻辑与 DOM 分离、脚底坐标几何约定、奶黄双概念与存档生命周期、必须写 CHANGELOG 的流程，以及中文路径、舞台缩放、`fire.halfAngleDeg` 死配置等已知坑
2. **重写 `README.md`** — 旧版仍停留在"无限关卡 + 奶币解锁 + v1 存档键 + 6 项测试"，与重构后的实现严重不符；按现状改写为 12 关塔防、12 关格斗、全局奶黄经济、奶娃强化系统、解锁公式与完整项目结构树
3. **删除 7 份失效文档** — `OPTIMIZATION_PLAN.md`、`ROUND2~5_OPTIMIZATION_PLAN.md`（第 1~5 轮历史计划，已被本 CHANGELOG 与 `docs/superpowers/` 取代）、`docs/superpowers/` 下 2026-10-24 的 spec 与 plan（对应功能已完成上线）

**影响范围：**
- 新增 AGENTS.md；README.md 全文重写
- 删除 5 份根目录优化计划文档与 2 份 2026-10-24 设计文档
- 保留 `.superpowers/` 本地暂存与 `assets/source-*` 原始素材（用户确认不删）

**验证：** 无代码改动；`node --test tests/*.test.js` 仍为 80/80 通过。

---

## 2026-10-25 修复模式B攻速选项与空中命中判定

**更新类型：** 修复

**改动内容：**
1. **删除攻速肉鸽强化** — 移除"疾风连击"（普攻攻速 +12%）升级项；同时清掉从未被读取的 `attackSpeedMul` 属性，避免留下无效数值
2. **空中命中判定改为立体判定** — 此前僵尸普攻、僵尸王冲撞、音波吐息只比较水平距离，导致玩家跳起后仍被地面攻击命中
3. **音波吐息改用矩形碰撞** — 命中框与 `.fire-breath` 的 92px 视觉高度对齐，并跟随玩家实际高度上下移动

**影响范围：**
- action-data.js：删除 `swift` 升级项与 `baseStats.attackSpeedMul`
- action-logic.js：新增 `verticalOverlap(aFootY, aHeight, bFootY, bHeight)`（脚底坐标约定：身体占据 `[footY - height, footY]`）；`MULTIPLIER_KEYS` 去掉 `attackSpeedMul`
- action.js：新增 `PLAYER_BODY_HEIGHT` / `ENEMY_BODY_HEIGHT` / `FIRE_*` 常量；僵尸普攻（`updateEnemy`）与僵尸王冲撞（`updateBoss`）在水平距离之外增加纵向重叠检查；`resolveFireBreath` 重写为 AABB 碰撞
- tests/action-logic.test.js：新增 3 个用例（升级池无攻速项、跳跃最高点可躲过僵尸普攻、空中僵尸王打不到地面玩家）

**验证：** `node --test tests/*.test.js` 80/80 通过；浏览器实测原地站立掉血、连续跳跃 4 秒零伤害。

---

## 2026-10-25 修复奶黄经济系统与主菜单导航

**更新类型：** 修复

**改动内容：**
1. **奶黄作为全局资源入场** — 模式A开局使用 `progress.custard` 作为初始奶黄（最低保底150），不再硬编码150
2. **奶黄余额持久化** — 通关/失败后剩余奶黄自动写回 `progress.custard`，中途退出同样保留
3. **模式A关卡选择页添加"返回主菜单"按钮** — 在 homeScreen 头部新增跳转 index.html 的链接
4. **结算文案更新** — 结果弹窗和提示文字反映新的奶黄经济模型

**影响范围：**
- game.js：`resetGame()` 使用 `Math.max(150, progress.custard)` 开局；`finishGame()` 保存剩余奶黄；`leaveToHome()` 中途退出时保存
- game.html：homeScreen header 新增 `.home-actions` 容器和"返回主菜单"链接；更新 home-tips 文案
- styles.css：新增 `.home-actions` 和 `.back-to-menu` 样式

---

## 2026-10-25 修复主菜单、返回按钮与奶黄持久化

**更新类型：** 修复

**改动内容：**
1. **主菜单强化奶娃按钮放大** — 将 footer 小链接改为与模式卡同等大小的第三张卡片
2. **模式A返回主菜单按钮可见性** — 修复 CSS 规则 `body.home-open #app { visibility: hidden }` 导致 header 也被隐藏的问题，改为只隐藏 `.game-layout`
3. **奶黄持久化修复** — 局内收集的奶黄（`game.collected`）现在会正确转入全局货币（`progress.custard`），无论通关还是中途返回主菜单
4. **主菜单奶黄余额显示** — 在模式卡片下方新增奶黄余额横幅

**影响范围：**
- index.html：新增第三张模式卡片（强化奶娃），新增奶黄余额横幅，移除 footer 小链接
- menu.css：mode-grid 改为 3 列，新增 `.mode-card.upgrade` 和 `.custard-banner` 样式
- styles.css：修改 `body.home-open` 规则，仅隐藏游戏区域而非整个 #app
- game.js：`finishGame()` 和 `leaveToHome()` 现在将 `game.collected` 转入 `progress.custard`

---

## 2026-10-25 大型重构：经济系统、关卡扩展、强化系统

**更新类型：** 大型重构

**改动内容：**

### Phase 1: 核心系统
1. **存档系统升级 v2** (`f67f68f`)
   - 奶黄成为唯一全局持久货币，移除奶币
   - 存档键名升级为 `nailong-vs-zombies-progress-v2`
   - 支持 v1→v2 自动迁移（奶币 1:1 转换为奶黄）
   - 新增 upgrades 字段存储强化等级

2. **模式A扩展到12关** (`39419b6`)
   - 关卡从5关扩展到12关，难度递增
   - 波数配置：1-3关5波，4-6关6波，7-9关7波，10-11关8波，12关10波
   - Boss仅出现在第12关
   - 首通奖励 50-215 奶黄，重复通关 30%

3. **模式B关卡选择界面** (`ae7c013`)
   - 新增 action-levels.html 关卡选择页面
   - 12关显示，类似模式A的关卡轨道
   - 解锁逻辑：无尽模式每3波解锁一关

4. **解锁逻辑重构** (`6da7bb4`)
   - 角色解锁改为通关模式A关卡解锁
   - 移除奶币解锁机制
   - 通关第2-10关逐步解锁9个角色

### Phase 2: 角色替换
5. **奶娃角色替换** (`cf45e63`)
   - 模式B主角从奶龙替换为奶娃
   - 喷火攻击改为音波攻击
   - 更新所有UI文本和图标

### Phase 3: 强化系统
6. **强化系统界面** (`84cadcf`)
   - 新增 upgrade.html 强化界面
   - 13个强化方向（对应13个角色）
   - 每个方向最多7级，消耗递增（100→6400）
   - 主菜单新增"强化奶娃"入口

7. **强化效果实现** (`5eb4c60` + `30b5700`)
   - 模式A：奶娃使用次数、伤害、回血、盾牌、冷却
   - 模式B：自动回复、攻击力、杀敌回血、盾牌、技能冷却
   - 强化效果跨模式持久化生效

### Phase 4: 测试验证
8. **完整测试与平衡性调整** (`c96a3f3`)
   - 新增集成测试覆盖全部8个任务
   - 175个测试全部通过（6个测试套件）
   - 所有JS文件语法验证通过

**测试覆盖：**
- tests/save-migration.test.js: 13 tests
- tests/level-config.test.js: 23 tests
- tests/unlock-logic.test.js: 37 tests
- tests/upgrade-effects.test.js: 63 tests
- tests/integration.test.js: 33 tests
- tests/action-logic.test.js: 6 tests

**影响范围：**
- 存档系统：v1→v2 迁移，奶黄持久化
- 模式A：12关，通关解锁角色，奶娃多次数使用
- 模式B：12关选择界面，奶娃主角，音波攻击
- 强化系统：13方向×7级，跨模式生效
- 主菜单：新增强化入口，显示奶黄余额

**文件清单：**
- 修改：game.js, action.js, action-data.js, action.html, index.html, menu.js, menu.css, styles.css, game.html
- 新增：action-levels.html, action-levels.css, action-levels.js, upgrade.html, upgrade.css, upgrade.js, tests/integration.test.js

---

## 2026-10-24 修复模式B闯关 Boss 战后不结束

**更新类型：** 修复

**改动内容：**
- 修复模式B闯关模式击败僵尸王后不触发胜利结算的问题
- 增强胜利检测逻辑，同时检查 `boss.dead` 和 `boss.hp <= 0 && boss.dying <= 0`

**影响范围：**
- action.js：胜利检测逻辑（第 1098-1104 行）

---

## 2026-10-24 修复返回主菜单按钮

**更新类型：** 修复

**改动内容：**
- 修复模式A（塔防）返回主菜单按钮无效的问题
- `leaveToHome()` 函数现在会正确跳转到 index.html

**影响范围：**
- game.js：`leaveToHome()` 函数添加 `window.location.href = 'index.html'` 跳转

---

## 2026-10-24 合并 feature-round5-progression + 主菜单与模式B

**更新类型：** 功能合并

**改动内容：**
1. 合并 feature-round5-progression 分支（无限关卡、奶币经济、角色解锁、拖拽种植）
2. 新增主菜单系统（index.html、menu.css、menu.js）
3. 新增模式B横版格斗（action.html、action.css、action.js、action-data.js、action-logic.js）
4. 页面结构调整：原 index.html → game.html（模式A塔防页面）
5. 新增单元测试（tests/action-logic.test.js）
6. 新增设计文档（docs/superpowers/）

**影响范围：**
- 主菜单：新增入口页面，可选择模式A或模式B
- 模式A（game.html）：集成第五轮优化内容（无限关卡、奶币、解锁）
- 模式B（action.html）：全新横版格斗玩法（闯关+无尽）
- README：更新项目结构与验证结果

**文件清单：**
- 修改：README.md、index.html、styles.css
- 新增：game.html、action.html、action.css、action.js、action-data.js、action-logic.js、menu.css、menu.js、tests/action-logic.test.js
