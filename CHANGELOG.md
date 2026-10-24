# 优化记录

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
