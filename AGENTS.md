# AGENTS.md — 奶家人的奇妙冒险

## 项目与文件职责

纯原生 HTML / CSS / JavaScript，无构建步骤、无运行时依赖。未经用户要求，不引入框架、打包器或 npm 包。

| 功能 | 文件 |
| --- | --- |
| 首页 | `src/index.html`、`src/css/menu.css`、`src/js/menu.js` |
| 模式A：庭院守护，五行九列塔防 | `src/game.html`、`src/css/styles.css`、`src/js/game.js` |
| 模式B：操控奶娃横版闯关 / 无尽 | `src/action.html`、`src/css/action.css`、`src/js/action.js` |
| 横版选关 | `src/action-levels.html`、`src/css/action-levels.css`、`src/js/action-levels.js` |
| 永久强化 | `src/upgrade.html`、`src/css/upgrade.css`、`src/js/upgrade.js` |
| 共用存档 | `src/js/progress.js` |
| 横版数值 / 纯逻辑 | `src/js/action-data.js` / `src/js/action-logic.js` |
| 测试 / 真实脚本加载器 | `tests/*.test.js` / `tests/helpers/browser-env.js` |

素材在 `src/assets/`，开发期加工工具在 `tools/`。页面引用使用相对路径 `css/…`、`js/…`、`assets/…`；CSS 中素材路径为 `../assets/…`，保持兼容 GitHub Pages 的仓库子路径。

## 开发与验证

在仓库根目录执行：

```bash
python -m http.server 4173 --bind 127.0.0.1 --directory src
node --test tests/*.test.js
node --check src/js/game.js
```

- 本地入口为 `http://127.0.0.1:4173/`。端口占用时换空闲端口，不终止其他进程；验证结束关闭自己启动的服务，用户明确要求保留预览时除外。
- 逻辑改动先写失败用例，再实现并验证。测试不得复制被测函数；纯逻辑直接加载生产模块，跨页面 / 存档测试用 `boot({ files, search, save })` 加载真实脚本。脚本依赖顺序应与对应 HTML 一致。
- 修改 JS 后逐个做语法检查；UI 改动必须在浏览器实际检查目标操作、窄屏布局和控制台。按改动范围选择验证，不能用 DOM 桩测试代替视觉检查，也不能将受控结算称为人工通关。
- 每次更新在 `CHANGELOG.md` 倒序置顶记录更新类型、内容、影响范围与实际验证方式；不要写死测试数量或声称未执行的验证。
- 日常开发用 `dev`，默认发布分支为 `main`；仓库为 <https://github.com/Jyutoo/neons-adventure>。提交用中文 conventional 前缀，如 `fix:`、`feat:`、`docs:`。是否提交、推送或使用 PR 按用户要求，不默认创建 PR。
- 保留无关的用户改动和未跟踪素材；公共文档、issue 与提交说明不写个人本地路径。

## 界面与命名

- 延续绿色庭院背景、奶油白面板、深绿文字；黄色用于主要操作与奶黄。维持清晰层级，避免重新引入深色科技风。
- 首页「庭院守护」「亲自上阵」是同等主入口；「强化奶娃」为右上角小型次要入口，使用单色购物车图标，不喧宾夺主。
- 模式A 固定 12 关，不称为「无尽守护」；无尽仅属于模式B。模式B 主角为奶娃，技能名称为「音波」，不要写回奶龙或喷火。
- 保留锁定、选中、余额不足等状态的可辨识性；调整 HUD 时保护战斗区域和既有实体几何。

## 存档、货币与解锁

- `progress.js` 是唯一存档入口，页面先加载它再加载业务脚本。存档键 `nailong-vs-zombies-progress-v2` 保持不变；v1 迁移后删除旧键。新增字段同步维护默认值、`FIELDS`、`normalize()` 与迁移测试；v2 未携带的字段不能覆盖 v1 迁移值。
- 页面修改前读取最新存档，只改本次操作负责的字段，禁止回写陈旧整档缓存。普通更新优先用 `ProgressStore.update()`，塔防用 `saveProgress(mutator)`；仅明确的重置操作可以清空进度。
- `progress.custard` 是全局钱包，`game.custard` 是塔防局内资源。开局读取最新余额与强化，保底 150，记录 `game.startCustard`；退出 / 结算把 `game.custard - game.startCustard` 加到最新钱包，结算再加奖励，余额最低为 0。退出不能重新初始化一局触发保底。
- `leaveToHome()` 仅在 `running` / `paused` 保存未结算局；`won` / `lost` / `ready` 返回不再入账。首通奖励按结算时最新记录判断，防止重复奖励。
- 两模式上限均为 `ProgressStore.MAX_LEVEL`（12）。塔防拒绝越界，最终关不提供下一关；角色按塔防通关解锁，已拥有即保持解锁。
- 横版关卡按 `ProgressStore.actionLevelsUnlocked(endlessWave)` 解锁，每 3 波增加一关。选关页显示解锁目标，战斗入口独立校验，不能只在 UI 上加锁。
- 永久强化上限为 `MAX_UPGRADE_LEVEL`（7），两模式分别通过 `applyModeAUpgrades()` / `applyModeBUpgrades()` 注入。修改效果时验证其确实被战斗读取，而非只改变显示值。

## 战斗与素材约束

- 可独立计算的规则放无 DOM 纯逻辑模块，页面负责渲染与编排。模式B 数值集中在 `action-data.js`，模式A 在 `game.js` 的配置与关卡常量。
- 几何统一用脚底坐标：身体区间 `[y - height, y]`。命中检查水平与纵向重叠；横版震荡波检查 `onGround`。跳跃闪避是玩法，不要改成只比水平距离。
- `Logic.levelConfig(level)` 生成横版战斗段并追加 Boss 段，段数预览复用该配置；Boss 下标取实际 `levelFlow.screens.length - 1`。`updateLevelFlow()` 仅在 `combat` 清场推进，不能跳过 Boss 结算。
- 肉鸽乘法升级键须进入 `MULTIPLIER_KEYS` 并有消费点。`DATA.player.fire.halfAngleDeg` 当前未使用，音波按矩形命中框实现，不是锥形。
- `BABY_VIDEO_CROP` 绑定 `assets/baby-laugh.mp4` 原片（592×1280）；更换视频须重新标定裁切矩形并检查 canvas 帧，避免录屏界面混入角色。
- 敌人素材由 `ZOMBIES[type].image` / `DATA.enemies[type].image` 读取，新增类型必须提供图片。`src/assets/enemies/` 文件名是契约；`source-*` 与 `source-enemies/` 是有意保留的原始素材，不能按未引用文件删除。
- 横版舞台固定 1280×720，窄窗口存在偏移，这是待改善的已知限制；不要因菜单支持窄屏就宣称战斗已支持手机。含中文路径遇到工具兼容问题时，再考虑 ASCII 临时目录。
