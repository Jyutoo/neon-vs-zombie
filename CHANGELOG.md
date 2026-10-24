# 优化记录

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
