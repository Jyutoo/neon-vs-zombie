# 敌方形象素材

邪恶家人阵营 8 名角色的透明底立绘。**文件名与高度是契约**，模式A `ZOMBIES[type].image`
与模式B 的敌人配置都按这张表引用，改任何一项都要同步改代码。

| 文件 | 角色 | 对应旧僵尸类型 | 导出高度 |
| --- | --- | --- | --- |
| `naidou.png` | 奶豆 | `basic` | 248 |
| `feidudu.png` | 肥嘟嘟 | `cone` | 248 |
| `niulai.png` | 牛奶 | `bucket` | 248 |
| `doujiao.png` | 豆脚 | `runner` | 240 |
| `tangbao.png` | 唐包 | `brute` | 330 |
| `lulu.png` | 露露 | `spitter` | 240 |
| `gugugaga.png` | 咕咕嘎嘎 | `jumper` | 324 |
| `naikang.png` | 奶康 | `boss` | 448 |

高度 = 两个模式里渲染高度的较大值 × 2，保证放大后不糊。宽度按原图比例算，不固定。

## 锚点约定

**脚底贴画布下边缘**，左右各留 1px。两个模式都按脚底坐标定位实体（身体占
`[y - height, y]`），渲染时把 PNG 的下边缘对齐脚底。换图时必须守住这条线，否则角色
会浮在半空或陷进地里。

## 替换契约

要换掉某个形象：用新图跑一遍加工脚本，或直接**同名同规格**（同高度、透明底、脚底贴
边）覆盖这个文件即可，不需要改任何代码。

## 重新生成

```bash
cd "D:/奶龙大战僵尸"
"C:/Users/Lenovo/miniconda3/python.exe" tools/prep-enemy-art.py src/assets/source-enemies
```

源图是 `src/assets/source-enemies/` 下的需求包三视图纸（有意保留，代码零引用，别删）。
加工脚本只服务开发期，不进游戏运行时。

`gugugaga.png` 目前是纯色剪影**占位图**——用户重出 3D 卡通版之前先用它占住文件位与
尺寸，重出后同名覆盖即可。

`doujiao.png` 就是"一颗大头挂在两条腿上"，没有躯干是设计如此，不要当抠图事故去补。
