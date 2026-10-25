# 敌方角色替换（第一步：换形象 + 改身份）设计文档

**日期：** 2026-10-25
**状态：** 待用户审阅
**需求来源：** 用户提供的 `敌方角色需求包_2026-10-25.zip`（`ENEMY_CHARACTER_DESIGN.md` + 8 张角色参考图）
**下一步：** 本文档通过后，用 writing-plans 出实现计划

---

## 一、背景与动机

现有敌人是「僵尸」，形象与《植物大战僵尸》高度同构（普通 / 路障 / 铁桶 / 大块头 / 远程 / 跳跃 / 僵尸王），存在版权风险。用户设计了一套 8 名新敌方角色替换它们，目标是**游戏内不再出现任何旧僵尸素材与旧僵尸称呼**。

新角色分两步接入。设计文档里的 8 套技能（亡语加速、范围治疗、加攻光环、套盾、降智光环、双阶段精英、第二 Boss）需要新建一整套机制层——两个模式现在都**没有**光环、治疗、护盾、亡语触发中的任何一项，模式B 还**完全没有敌方子弹系统**，Boss 在两个模式里都是单例硬编码。**本步不做这些**。

### 本步做什么

1. 8 名新角色的独立形象接入两套模式
2. 删除旧僵尸素材与所有"假护甲"CSS（详见 §五）
3. 玩家可见文案全量改名：阵营「邪恶家人」、标题《奶家人的奇妙冒险》
4. 主菜单 hero 图替换

### 本步不做什么

- 任何新技能机制 → 第二步单独开 spec
- 模式B 不引入噜噜与唐包（没有可挂的行为骨架）
- 不改内部标识符（`game.zombies` / `damageZombie` / `ZOMBIES` / `.zombie` CSS 类名全部保留）
- 不改存档键 `nailong-vs-zombies-progress-v2`、仓库名、项目目录名
- 不改任何数值曲线、波次编排、碰撞几何

---

## 二、为什么"换皮"是结构性改动

两个模式**所有敌人共用同一张 `src/assets/zombie.png`**，靠 CSS 画出差异：

| 位置 | 现状 |
| --- | --- |
| `src/js/game.js:1555` | 写死 `<img src="assets/zombie.png">` + `<div class="armor">` |
| `src/css/styles.css:174-189` | 用 `clip-path` / 渐变画出路障、铁桶、红头带、绿枪、跳跃粉带、Boss 皇冠 |
| `src/js/action.js:988` | 同样写死 `assets/zombie.png` |
| `src/js/action.js:974-979` | `armorMarkup()` 按类型返回 `.cone-armor` / `.bucket-armor` / `.boss-armor` + `.boss-crown` |
| `src/css/action.css:63-65, 94-95` | 上述假护甲的样式 |
| `src/css/action.css:57-58` | `.elite` / `.runner` 靠 `hue-rotate` / `contrast` 滤镜区分同一张图 |

所以换形象必须**三件事同时做**：配置表加 `image` 字段 → 渲染读它 → 删掉假护甲 DOM 与 CSS。只换 PNG 会让新角色头顶长出一个 CSS 画的橙色路障。

### 碰撞盒不受影响

两个模式的 `<img>` 都是 `object-fit: contain` 装在既有占位盒里：

- 模式A：棋盘百分比盒（普通 `10%×21.5%` ≈ 108×118px、大块头 `14%×30%` ≈ 151×165px、Boss `18%×38%` ≈ 194×209px，棋盘 1080×550）
- 模式B：`72*scale × 124*scale` px，锚点为脚底 `translate(-50%,-100%)`

**`hitW/hitH`、`Logic.rectsOverlap`、`Logic.verticalOverlap`、脚底坐标约定一个字节都不改。** 现有 132 项测试天然继续有效。这是本步风险可控的根本原因。

---

## 三、角色映射表

按定位 1:1 换皮，旧数值曲线、波次、解锁全部不动。

| 内部 key（不改） | 旧显示名 | 新角色 | 素材文件 | 模式A | 模式B |
| --- | --- | --- | --- | :-: | :-: |
| `basic` | 普通僵尸 | 奶豆 | `naidou.png` | ✅ | ✅ |
| `cone` | 路障僵尸 | 肥嘟嘟 | `feidudu.png` | ✅ | ✅ |
| `bucket` | 铁桶僵尸 | 牛来 | `niulai.png` | ✅ | ✅ |
| `runner` | 快速僵尸 | 豆脚 | `doujiao.png` | ✅ | ✅ |
| `brute` | 大块头僵尸 | 唐包 | `tangbao.png` | ✅ | — |
| `spitter` | 远程僵尸 | 噜噜 | `lulu.png` | ✅ | — |
| `jumper` | 跳跃僵尸 | 咕咕嘎嘎小孩 | `gugugaga.png` | ✅ 占位 | — |
| `elite` | 精英铁桶 | 咕咕嘎嘎小孩 | `gugugaga.png` | — | ✅ 占位 |
| `boss` | 僵尸王 | 奶康 | `naikang.png` | ✅ | ✅ |

映射依据：`jumper`（模式A）与 `elite`（模式B）本来就是两个模式的"精英位"，都由咕咕嘎嘎小孩占据，语义一致。`bucket`（最厚的非 Boss）给牛来（护盾辅助，天然要站得住）。`spitter` 是唯一现成的远程骨架，直接给噜噜。

**模式B 的 `enemies` 表只有 5 个 key（无 `brute` / `spitter` / `jumper`），`boss` 是独立的顶层对象**（`action-data.js:79-94`），这是两个模式表结构上的差异，接入时要分别处理。

---

## 四、命名与文案

### 阵营命名

- 阵营总称：**邪恶家人**
- Boss 显示名：**奶康**（不加头衔，用户明确要求）
- 游戏标题：**奶家人的奇妙冒险**

### 文案替换清单

| 文件:行 | 现文案 | 改为 |
| --- | --- | --- |
| `src/index.html:7` | `奶龙大战僵尸 · 奶家小院` | `奶家人的奇妙冒险` |
| `src/index.html:23` | `<img class="hero-zombie" src="assets/zombie.png" alt="僵尸">` | `src="assets/enemies/naikang.png"` `alt="奶康"` |
| `src/index.html:27,71,100` | `奶龙大战僵尸` / `奶龙战僵尸` | `奶家人的奇妙冒险` |
| `src/index.html:41` | `奶龙战僵尸` 模式标签 | `邪恶家人来袭` |
| `src/index.html:44,76,101` | `决战僵尸王` / `精英怪 · 僵尸王` / `终点是僵尸王` | `决战奶康` / `精英怪 · 奶康` / `终点是奶康` |
| `src/game.html:7,33,42,111` | 标题与 `h1`、`aria-label` | `奶家人的奇妙冒险` |
| `src/game.html:66` | `第 12 关迎战僵尸王` | `第 12 关迎战奶康` |
| `src/game.html:147` | 图鉴 `普通/路障/铁桶/大块头/远程/跳跃/僵尸王` | `奶豆/肥嘟嘟/牛来/唐包/噜噜/咕咕嘎嘎/奶康` |
| `src/game.html:165` | `<strong>僵尸王</strong><span>召唤援军 · 远程压制</span>` | `<strong>奶康</strong><span>召唤援军 · 远程压制</span>`（描述与现有 Boss 行为一致，保留） |
| `src/action.html:6` | `奶龙战僵尸` | `奶家人的奇妙冒险` |
| `src/action.html:37` | Boss 血条 `僵尸王` | `奶康` |
| `src/action-levels.html:6` | `奶龙战僵尸 - 闯关模式` | `邪恶家人 - 闯关模式` |
| `src/js/game.js:26-33` | `ZOMBIES` 表 8 个 `name` | 按 §三 映射表 |
| `src/js/game.js:15,16,18,19,22,11,13` | 我方角色 `description` 里的"僵尸" | 改为"敌人"或"邪恶家人" |
| `src/js/game.js:746,750,751,847,1088,1354,1426,1461,1463,1491,1669,1729,1732,1733` | 关卡预览、播报、结算、帮助文案 | 逐条替换（`僵尸王`→`奶康`，`僵尸`→`邪恶家人`/`敌人`） |
| `src/js/action-data.js:73-76,80` | `enemies` 与 `boss` 的 `name` | 按 §三 映射表 |
| `src/js/action.js:604,670,866,946,1031,1100,1141,1142,1282,1284` | 播报、结算、帮助文案 | 同上 |
| `src/js/action-levels.js:75` | `最终决战：僵尸王` / `击败所有僵尸` | `最终决战：奶康` / `击败所有邪恶家人` |

**规则：** `僵尸王` 一律 → `奶康`；泛指个体的 `僵尸` → `邪恶家人`（首次/强调处）或 `敌人`（量词、计数句，如"击杀 12 只敌人"读起来更顺）。

---

## 五、代码改动清单

### 5.1 模式A（塔防）

1. `src/js/game.js:25-34` — `ZOMBIES` 每个条目加 `image` 字段与改名。
2. `src/js/game.js:1555` — 渲染改为 `<img src="${ZOMBIES[zombie.type].image}">`，**删除 `<div class="armor">`**。
3. `src/css/styles.css` — 删除假护甲规则，**逐条点名删除，不要按区间删**（`174-194` 区间里混着必须保留的占位盒尺寸与 Boss 气质样式）：
   - `174` `.armor` 基类
   - `175` `.zombie.cone .armor, .zombie.bucket .armor, .zombie.runner .armor { display: block; }`
   - `176` `.zombie.cone .armor`、`177` `.zombie.bucket .armor`、`178` `.zombie.runner .armor`
   - `182` `.zombie.brute .armor`、`183` `.zombie.spitter .armor`、`185` `.zombie.jumper .armor`、`189` `.zombie.boss .armor`
   - **保留** `179` `.zombie.runner > img`、`180` `.zombie.brute`（占位盒尺寸）、`186` `.zombie.jumper > img`、`187` `.zombie.boss`（占位盒尺寸）、`188` `.zombie.boss::before`（红光光环）、`192` `.zombie.dying`、`193` `.zombie.dying > img`
4. `src/css/styles.css:194` — `.zombie.dying .armor, .zombie.dying::before` 选择器去掉 `.armor` 那一项（保留 `::before`）。
5. `src/css/styles.css:181,184,190` — 删除 `.zombie.brute > img` / `.zombie.spitter > img` / `.zombie.boss > img` 的 `saturate`/`hue-rotate` 调色滤镜（它们只为区分同一张图而存在）。**注意 `181` 与 `180`、`190` 与 `188` 相邻，别删错行。** **保留** `191` `.zombie.boss.enraged > img` 强化光、`188` `.zombie.boss::before` 红光光环——那是 Boss 气质，不是假护甲。删滤镜时保留各条 `filter` 里的 `drop-shadow` 部分（改色见 §5.3）。
6. `src/css/styles.css:116-123` — `.legend-dot` 七种颜色按新角色主色重调。
7. 保留 `.zombie.brute` / `.zombie.boss` 的宽高规则（占位盒尺寸，与形象无关）。
8. `src/js/game.js:1902-1925` — `window.__nailongTower` 加一行 `ZOMBIES,`，供 §7.1 的测试读取（这是本步唯一的运行时导出面改动，浏览器侧无副作用）。

### 5.2 模式B（横版格斗）

1. `src/js/action-data.js:72-78,79-94` — `enemies` 五个条目与 `boss` 各加 `image` 字段与改名。
2. `src/js/action.js:974-979` — **整个 `armorMarkup()` 函数删除**。
3. `src/js/action.js:988` — 改为 `<img src="${enemy.cfg.image}" alt="${enemy.cfg.name}">`，去掉 `armorMarkup()` 调用。
4. `src/css/action.css:63-65,94-95` — 删除 `.armor` / `.cone-armor` / `.bucket-armor` / `.boss-armor` / `.boss-crown`。
5. `src/css/action.css:57-58` — 删除 `.elite` / `.runner` 的 `hue-rotate` / `contrast` 滤镜。
6. 保留 `.enemy.windup` / `.enemy.dying` / `.enemy.hurt` / `.flip` 等状态动画——它们作用于 `<img>`，与形象无关。

### 5.3 敌我撞色处理

8 名新角色与奶家人我方角色同为奶黄色系，棋盘上可能一眼分不清敌我。处理方式：**把敌人的落地阴影改成暗红调**，我方保持现有绿色调。

- `styles.css:159` `.entity > img` 的 `drop-shadow(0 5px 3px rgba(45,65,30,.25))` 是敌我共用的，需要拆成 `.plant > img`（绿）与 `.zombie > img`（暗红 `rgba(120,40,30,.30)`）两条。
- `action.css:56` `.enemy img` 的 `drop-shadow(0 8px 7px rgba(45,70,40,.22))` → 暗红调。

这是观感层面的调整，**做出来在浏览器里看图再定**；若用户认为多余，删掉即可，不影响任何逻辑。

### 5.4 素材文件

- 新增目录 `src/assets/enemies/`，8 个透明 PNG，文件名见 §三。
- 旧 `src/assets/zombie.png` **保留**但不再被任何代码引用（`src/assets/source-zombie.png` 按仓库既有约定继续保留，AGENTS.md 明确 `source-*` 不许删）。
- 需求包里的 8 张原始参考图存入 `src/assets/source-enemies/`，与 `source-*` 约定一致。

---

## 六、素材加工流水线

新增 `tools/prep-enemy-art.py`（开发期脚本，不进游戏运行时；本机 PIL 12.3.0 + numpy 2.5.4 已验证可用）。

### 6.1 四步处理

1. **选视角并裁切** — 需求包 8 张图实测尺寸与构成：

   **正面视角所在格必须逐张目视确认——三张图的正面不在同一侧，凭"取左 1/3"的假设做会产出背对玩家走路的敌人。** 实测：

   | 文件 | 尺寸 | 背景色 | 面板划分 | **正面在第几格** | 备注 |
   | --- | --- | --- | --- | :-: | --- |
   | `naidou.jpg` | 2278×1280 | rgb(239,241,238) | 竖分隔段 x∈[792,840]、[1396,1452] | **左**（0–792） | 中格是 3/4 侧身，右格背面 |
   | `feidudu.jpg` | 2278×1280 | rgb(247,248,244) | 无内部空白段；左边缘 x∈[0,153] 为空白 | **左**（153–800） | 需按 (153..2278) 三等分 |
   | `lulu.jpg` | 2278×1280 | rgb(255,255,253) | 无空白段，三等分 | **左**（0–759） | 右下角「豆包 AI 生成」水印 |
   | `naikang.jpg` | 2278×1280 | rgb(255,255,255) | 无空白段，三等分 | **中**（759–1519） | 左格是侧身持枪；右下角「豆包 AI 生成」水印 |
   | `niulai.jpg` | 1440×804 | rgb(250,250,250) | 竖分隔段 x∈[0,92]、[429,581]、[853,989]、[1328,1440] | **左**（92–429） | 右下角是**小红书**水印，非豆包 |
   | `tangbao.jpg` | 1283×1279 | rgb(220,239,248) | 仅边缘空白 x∈[0,41]、[1260,1283] | **中** | 左格是正侧面轮廓 |
   | `doujiao.jpg` | 1080×2344 | 照片内 rgb(203,214,243) | **手机截图**：非照片区为纯黑上下边 + 顶部状态栏 | 单角色 | 照片内容区实测 y∈[618,1718]（高 1100），先裁到此矩形，再由泛洪 + alpha 包围盒自动定位角色 |
   | `gugugaga-child.jpg` | 1280×2777 | — | 写实照片风，与其余 7 张不是同一美术语言 | **本步用占位图** | 见 §6.3 |

   导出文件名不带面板序号——`naikang.png` 就是最终正面图，用户重出正式素材时同名覆盖即可。

2. **泛洪抠底（不用颜色距离）** — 奶豆/奶康的米白肚皮与浅灰背景亮度差极小，按颜色距离全局抠底会把肚皮抠穿。必须用**从图像边界连通的 flood-fill**：肚皮是被黄色身体包住的封闭区域，边界泛洪进不去，因此安全。实现：以四边中位色为种子色，`tolerance≈60`（RGB 绝对差之和）做连通标记，标记到的像素 alpha 置 0。

3. **去水印与辅助线** — 按上表逐张确认水印来源：`lulu` / `naikang` 右下角是「豆包 AI 生成」，`niulai` 右下角是**小红书** logo，`gugugaga-child` 同样带水印（本步用占位图，无需处理）；`naidou` / `feidudu` / `tangbao` / `doujiao` 实测无水印。处理：裁切时把水印区排除在视角框外（水印都贴在右下角，正面格裁切天然能躲开——除非该角色脚底需要完整保留，此时改为对水印矩形做局部修复）。细线属于背景，会被泛洪一并抠掉（线与背景同色且与边界连通）；若某条线穿过角色身体导致断开，则对该线做局部修复。

4. **归一化导出** — 按 alpha 包围盒裁切 → 等比缩放到目标高度 → 底部对齐放入透明画布（左右留 6% 余量）。**脚底贴画布下边缘**，与模式B 的 `translate(-50%,-100%)` 脚底锚点约定和模式A 的 `translate(-50%,-50%)` 中心锚点对齐。

### 6.2 导出规格

同一角色只出一张 PNG，两个模式共用，靠各自占位盒的 `object-fit: contain` 缩放。**导出高度 = 两模式渲染高度较大值 × 2（2× 采样余量）**，避免放大模糊。

两模式渲染高度实测来源：
- 模式A：`.zombie` 高 21.5%、`.zombie.brute` 30%、`.zombie.boss` 38%，相对 `.board`（`styles.css:125` `aspect-ratio: 1080 / 550`）；按棋盘 550 CSS px 计 = 118.25 / 165 / 209 px。
- 模式B：`action.js:986-987` 写死 `124 × enemy.cfg.scale` px；`scale` 见 `action-data.js`（basic/cone/bucket 1、runner 0.92、elite 1.3、**boss 1.8**）= 124 / 114.08 / 161.2 / **223.2** px。

| 文件 | 角色 | 模式A 高 | 模式B 高 | **导出高度** |
| --- | --- | ---: | ---: | ---: |
| `naidou.png` | 奶豆 | 118.25 | 124 | **248 px** |
| `feidudu.png` | 肥嘟嘟 | 118.25 | 124 | **248 px** |
| `niulai.png` | 牛来 | 118.25 | 124 | **248 px** |
| `doujiao.png` | 豆脚 | 118.25 | 114.08 | **240 px** |
| `tangbao.png` | 唐包 | 165 | — | **330 px** |
| `lulu.png` | 噜噜 | 118.25 | — | **240 px** |
| `gugugaga.png` | 咕咕嘎嘎小孩 | 118.25 | 161.2 | **324 px** |
| `naikang.png` | 奶康 | 209 | **223.2** | **448 px** |

**奶康由模式B 的 `boss.scale = 1.8` 决定，不是模式A 的 38% 盒**——按模式A 单侧算会导出 418 px，在模式B 里糊掉。

宽度不单独规定：按 alpha 包围盒的宽高比等比缩放，水平居中。

### 6.3 咕咕嘎嘎小孩的占位图

用户将重出 3D 卡通版。本步先由脚本生成占位图 `gugugaga.png`：**与其余角色同一套流程产出的纯色剪影**（圆身体 + 大头 + 手持奶嘴的轮廓，填充色取噜噜的奶黄 `rgb(255,220,110)`，描边深棕），文件位置与尺寸规格完全一致。用户重出后**同名替换即可，零代码改动**。

不使用旧 `zombie.png` 当占位——那会违反"游戏内不再出现旧僵尸形象"的验收标准。

### 6.4 可替换性约定

`src/assets/enemies/*.png` 这 8 个文件名是**稳定契约**。用户后续替换正式素材时只需同名同规格覆盖。规格写进 `src/assets/enemies/README.md`（尺寸、脚底锚点、透明底、命名）。

---

## 七、测试与验收

### 7.1 新增 `tests/enemy-art.test.js`

断言的是真实文件与真实配置，**不复制被测函数**（AGENTS.md 硬性要求）：

1. **模式A 配置表**：`game.js` 是页面脚本、**没有 UMD 尾巴**（`src/js/game.js:1902` 的 `window.__nailongTower` 是唯一导出面，当前不含 `ZOMBIES`）。因此本步给 `__nailongTower` 加一行 `ZOMBIES,`，测试用 `tests/helpers/browser-env.js` 的 `boot()` 载入未经修改的 `game.js` 后读 `window.__nailongTower.ZOMBIES`——这是 AGENTS.md 规定的做法，不许把 `ZOMBIES` 抄进测试文件。断言：每个条目都有 `image`，且该路径相对 `src/` 在磁盘上存在（`fs.existsSync`）。
2. **模式B 配置表**：`action-data.js` 有 UMD 尾巴，直接 `require('../src/js/action-data.js')`（现有 `tests/action-logic.test.js:3` 就是这么做的）。断言：`DATA.enemies` 五个条目与 `DATA.boss` 同上。
3. `src/js/*.js` 与 `src/*.html` 中**不再出现字符串 `assets/zombie.png`**（用 `fs.readdirSync` + 正则扫源码文本；测试文件自身在 `tests/` 下，不在扫描范围）。
4. 两个配置表的所有 `name` 字段**不含"僵尸"二字**。
5. 8 个 PNG 文件存在且非空。

第 3、4 条是"旧形象与旧称呼全部清除"的回归护栏——将来谁再把 `zombie.png` 塞回去，测试直接红。

### 7.2 现有测试

132 项应全绿且**不需要修改**（本步不碰数值、波次、几何、存档）。唯一需要复核的是 `tests/action-logic.test.js:61-64`（升级池内容）与 `:79-82`（`DATA.boss.scale`、`boss.slam.jumpHeight`）——本步不碰这些字段，预期无影响。

### 7.3 浏览器实测

- 模式A：`startLevel(12)` 让 8 种齐出，逐种截图确认无假护甲残留、脚底对齐、无抠图破洞或白边。
- 模式B：闯关 3 屏 + 无尽，确认 5 种 + Boss 形象正确，`windup` / `hurt` / `dying` / `flip` 状态动画仍生效。
- 主菜单：hero 图与三张卡片文案。
- 控制台 error / warn 为 0，网络请求无 404。

### 7.4 验收标准

1. 游戏内不再出现 `zombie.png`，且 `tests/enemy-art.test.js` 有断言守着这一点。
2. 模式A 8 种、模式B 6 种各有独立形象，无 CSS 假护甲残留。
3. 玩家可见文案中"僵尸"字样清零（内部标识符除外，见 §一）。
4. 标题为《奶家人的奇妙冒险》，Boss 显示名为"奶康"。
5. 132 项既有测试全绿 + 新增测试全绿。
6. 浏览器实测通过，脚底对齐、无抠图瑕疵。
7. `CHANGELOG.md` 按仓库硬性约定记录本次更新。

---

## 八、风险

1. **抠图质量不可保证。** 泛洪抠底对"背景与角色同亮度"的情况有效，但对**角色与背景之间的柔和投影**没有好办法——`naidou` / `feidudu` 脚下都有明显的接触阴影，泛洪可能只吃掉一部分，留下一圈灰边。缓解：脚本支持"底部 N% 强制渐隐 alpha"，把脚底阴影柔化掉。**这是本步最可能需要反复调的地方，做完逐张目检。**
2. **敌我撞色。** 见 §5.3，属观感判断，需用户看图后定。
3. **素材版权。** 8 张图里有 4 张右下角带 AI 平台水印（`lulu` / `naikang` / `gugugaga-child` 为「豆包 AI 生成」，`niulai` 为小红书标识），说明它们是 AI 产物。去水印不改变其来源性质。本步按用户指示推进，但**建议用户自行确认豆包生成内容的商用与再分发条款**——毕竟本轮动机正是降低版权风险。
4. **占位图会进主干。** 咕咕嘎嘎小孩在用户重出素材前是纯色剪影，功能与测试均正常，但观感上明显是占位。需用户接受"先合入、素材后补"。

---

## 九、第二步预告（不在本步范围）

第二步需要新建的机制层，本步**刻意不碰**，以便第一步独立可交付：

- 光环系统（治疗 / 加攻 / 套盾 / 降智扣血）——两个模式都没有任何光环或 tick 注册表，所有效果现在都写死在各自的逐帧循环里
- 敌方护盾——模式A 僵尸无 `shield` 字段，`damageZombie:1174` 不看护盾；模式B 敌人无吸收概念
- 亡语触发——模式A `damageZombie:1172` 无死亡效果派发；模式B `damageEnemy:272` **没有伤害来源参数**，"近战击杀才触发减速、远程击杀不触发"这条规则目前根本无法表达
- 模式B 敌方弹道系统——现在完全没有，唯一的非接触伤害是地面震荡波
- Boss 注册表——模式A 靠 7 处 `=== 'boss'` 字符串判断，模式B `state.boss` 是单个引用（第二个 Boss 会覆盖它，直接搞坏血条与胜利判定）
- 唐包升级为真第二 Boss、咕咕嘎嘎小孩双阶段
- 奶康入场音乐与"降维打击"语音（素材未提供）

第二步单独开 spec 与实现计划。
