#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""开发期素材加工：把需求包三视图纸裁成正面立绘，抠底后导出到 src/assets/enemies/。

不进游戏运行时。依赖 Pillow / numpy / scipy。
用法：python tools/prep-enemy-art.py <源图目录>

抠底用逐行局部背景模型，不用全局种子色：面板背景是平滑渐变还带一条横向硬边
（奶康顶部白带与中部灰场差 152），全局中位数种子必然两头漏——灰场抠不掉、
唐包的白毛衣与浅蓝底只差 52 反被吃掉。

分区要给角色留出干净的背景余量：角色一旦顶到分区边界，边缘采样采到的就是角色
自己，模型被污染后会在肚皮上抠出一道缝（肥嘟嘟第一版就是这样）。分区定好后先用
边缘模型起个初值，再拿「当前可信为背景」的像素逐行重建背景、重算残差迭代两轮，
摄影棚光池这类横向起伏就能被模型吸收掉，不再被当成角色。
"""
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "src" / "assets" / "enemies"
EDGE = 10         # 边缘取 10px 中位数当该行的背景样本
MIN_AREA = 20000  # 小于此面积的连通块是水印、地板线和投影，不是角色
OPEN_V = 21       # 竖向开运算高度，比面板地平线厚、比任何角色的脚都薄


@dataclass(frozen=True)
class Spec:
    key: str
    src: str
    region: tuple           # 取正面角色的框
    height: int             # 导出高度（脚底贴画布下边缘）
    tol: int = 26           # 背景残差阈值
    trim: float = 0.03      # 连通块底部裁掉的比例（切落地投影）
    fade: float = 0.04      # 脚底渐隐比例
    model: str = "lr"       # lr=逐行左右内插；left=逐行左边缘常量
    segment: str = "color"  # color=比背景残差；flood=从边框生长的局部梯度连通域


# 分区只负责"取哪一格"，格子内角色的包围盒由前景最大连通块自动量出——上一版手写
# 像素框把唐包裁到 447-854，正好压在身上。
# 阈值按角色调：背景残差实测 p99.9 <=12，白毛衣这类浅色衣服亮部与背景只差 18-26，
# 沿用 26 会在衣服上抠出白斑。
# trim 切掉连通块底部的落地投影：投影比角色本体更宽、对比度又够不上阈值，泛洪和阈值
# 都拦不住（豆脚成品脚下那摊蓝色水渍就是它），只能按行裁。
# 分区右边界一律留出角色实测列宽以外的余量，让边缘样本落在纯背景上。
CHARACTERS = [
    Spec("naidou",  "naidou.jpg",  (0,    0,  760, 1280), 248, trim=0.045),
    Spec("feidudu", "feidudu.jpg", (0,    0,  800, 1280), 248, trim=0.07),   # 角色占 152-759
    Spec("niulai",  "niulai.jpg",  (0,    0,  480,  804), 248),              # 角色占 93-428
    Spec("doujiao", "doujiao.jpg", (0,  620, 1080, 1717), 240, trim=0.25, fade=0.0),
    # 豆脚就是"一颗大头挂在两条腿上"，没有躯干是设计如此，别当源图崩了去补身体。
    # 唐包三视图挨得太近（本视图手臂最宽处 x=382，左格头发右沿 x=376，逐行都有空隙
    # 但没有一列是全程干净的），任何"取边缘列建背景模型"的办法都会被邻格或本格手臂
    # 污染；加上白毛衣与摄影棚光池只差十几个单位，残差阈值两头漏。改走梯度连通域。
    Spec("tangbao", "tangbao.jpg", (345,   0,  905, 1279), 330, trim=0.02,
         segment="flood"),
    Spec("lulu",    "lulu.jpg",    (0,    0,  800, 1280), 240),              # 角色占 131-743
    Spec("naikang", "naikang.jpg", (760, 178, 1520, 1280), 448, trim=0.055),  # 正面在中格，顶边避开背景卡片凸舌
]
PLACEHOLDER_HEIGHT = 324   # 咕咕嘎嘎小孩：用户重出 3D 版前的占位剪影


def smooth_rows(model, win=15, max_dev=40):
    """沿 y 做保边中值：抹掉被角色污染的少数行，但不抹开面板自己的硬边。

    普通中值滤波会把白带/灰场那条 148 差的横向硬边摊到 ±7 行上，模型在这十几行
    既不是白也不是灰，残差反而冒过阈值，闭运算一封口就是奶康头顶那块灰色凸台。
    改成先取窗口中值，再只把与中值同侧的行平均进来：离群行被替换，硬边两侧各行其是。
    """
    h = model.shape[0]
    half = win // 2
    med = ndimage.median_filter(model, size=(win, 1, 1))
    out = model.copy()
    for y in range(h):
        w = model[max(0, y - half):min(h, y + half + 1)]
        keep = np.abs(w - med[y]).sum(axis=(1, 2)) <= max_dev
        out[y] = w[keep].mean(axis=0) if keep.any() else med[y]
    return out


def background_model(rgb, mode="lr"):
    """逐行取边缘样本当作该行背景，再沿 y 做保边中值去掉被角色污染的少数行。

    lr：左右边缘线性内插，适合背景横向有渐变的图。
    left：整行铺左边缘色，适合横向均匀、只在纵向渐变的图（唐包）。
    """
    h, w, _ = rgb.shape
    left = np.median(rgb[:, :EDGE, :].astype(np.int16), axis=1)[:, None, :]
    if mode == "left":
        model = np.repeat(left, w, axis=1)
    else:
        right = np.median(rgb[:, -EDGE:, :].astype(np.int16), axis=1)[:, None, :]
        t = np.linspace(0, 1, w)[None, :, None]
        model = left * (1 - t) + right * t
    return smooth_rows(model).astype(np.int16)


def repair_guide_lines(rgb):
    """把面板分隔线按左右邻列均值补掉。

    分隔线是画在源图上的 1px 深灰竖线，横穿角色本体，抠底只会把它当前景留下，
    成品里变成一根戳出剪影的细线，必须在裁切前修像素。取 ±3 而不是 ±2：
    线本身占 2px，用紧邻列会把线的深色一起平均进替换值，肚子上仍留一道淡痕。
    """
    h, w, _ = rgb.shape
    lum = rgb.mean(axis=2)
    darker = lum < np.minimum(np.roll(lum, 3, axis=1), np.roll(lum, -3, axis=1)) - 25
    cols = np.nonzero(darker.mean(axis=0) > 0.2)[0]
    if not len(cols):
        return rgb
    out = rgb.copy()
    for x in cols:
        a, b = rgb[:, max(0, x - 3), :], rgb[:, min(w - 1, x + 3), :]
        out[:, x, :] = ((a.astype(np.int16) + b.astype(np.int16)) // 2).astype(np.uint8)
    print(f"   修掉分隔线列 {list(cols)}")
    return out


def fill_rowwise(rgb, bg, fallback):
    """逐行用「当前可信为背景」的像素沿 x 内插，重建整行的背景。

    初版模型只看左右两条边缘，吃不掉摄影棚光池：唐包脚下那片地灯比边缘亮 19，
    和白色毛衣相对背景的差（18-26）落在同一个区间，靠调阈值两头都保不住。
    角色两侧的背景样本之间隔着身体，插值就是背景穿过身体时的走向，横向起伏因此
    被模型吸收；毛衣、皮肤与插出来的背景仍差得远，留在前景。
    整行都被角色占满时没有样本可用，退回边缘模型——绝不能拿本行中位数顶替，
    那等于把这一行判成背景，角色会被拦腰切掉。
    """
    h, w, _ = rgb.shape
    xs = np.arange(w)[None, :]
    li = np.maximum.accumulate(np.where(bg, xs, -1), axis=1)
    ri = -np.maximum.accumulate(np.where(bg, -xs, -2 * w - 1)[:, ::-1], axis=1)[:, ::-1]
    has_l, has_r = li >= 0, ri < w
    lc, rc = np.clip(li, 0, w - 1), np.clip(ri, 0, w - 1)
    rows = np.arange(h)[:, None]
    lv = rgb[rows, lc].astype(np.float32)
    rv = rgb[rows, rc].astype(np.float32)
    t = ((xs - lc) / np.maximum(rc - lc, 1))[..., None]
    both, only_l = has_l[..., None] & has_r[..., None], (~has_l[..., None]) & has_r[..., None]
    filled = np.where(both, lv + (rv - lv) * t,
                      np.where(only_l, rv, np.where(has_l[..., None], lv, 0.0)))
    return np.where(bg.any(axis=1)[:, None, None], filled, fallback.astype(np.float32))


def _biggest(fg):
    labels, n = ndimage.label(fg)
    if n == 0:
        return None
    sizes = ndimage.sum(fg, labels, np.arange(1, n + 1))
    if sizes.max() < MIN_AREA:
        return None
    return labels == (int(np.argmax(sizes)) + 1)


def flood_mask(rgb, sigma=1.6, tol=6.0):
    """从分区边框向内生长「平滑连通区」当作背景，走不到的就是角色。

    背景是摄影棚渐变，逐像素色差只有 1 上下；角色轮廓是硬边，高斯平滑后每像素仍差
    十几。所以按局部梯度能不能走通来分，跟颜色像不像没关系——白毛衣贴着浅蓝底也能
    保住。邻格的角色会被判成前景，但和本格之间隔着走得通的背景，最大连通块只留正面
    这一格。种子取内缩 2px 的边框：3x3 腐蚀已经把最外圈抹成前景了。
    """
    sm = np.stack([ndimage.gaussian_filter(rgb[:, :, c].astype(np.float32), sigma)
                   for c in range(3)], axis=2)
    g = np.zeros(sm.shape[:2], np.float32)
    for ax in (0, 1):
        for s in (1, 2):
            g += np.abs(sm - np.roll(sm, s, axis=ax)).sum(axis=2)
            g += np.abs(sm - np.roll(sm, -s, axis=ax)).sum(axis=2)
    passable = ndimage.binary_erosion(g / 8.0 < tol, np.ones((3, 3), bool))
    labels, _ = ndimage.label(passable)
    border = np.unique(np.concatenate([labels[2], labels[-3], labels[:, 2], labels[:, -3]]))
    fg = ndimage.binary_opening(~np.isin(labels, border[border > 0]), np.ones((OPEN_V, 1), bool))
    return _biggest(fg)


def largest_component(diff, tol):
    """残差超阈值的像素即角色，取最大连通块。

    闭运算只补「与外界相通」的凹口，不许把细线围成的孔填成实心：15px 闭运算本是
    为了填掉高光条在轮廓上咬出的缺口，但它同样会把背景里一圈 1-2px 的亮边封成实心块
    ——奶康头顶的卡片凸舌、肥嘟嘟两脚之间的白色标签都是这么被造出来的。区分很简单，
    凹口在 ~raw 里与图像边框连通，孔洞不连通。
    也不做 fill_holes：手臂与躯干之间的三角区颜色和背景一致，填洞会把这块背景一起
    留在剪影里（上一版唐包胸口右侧的白斑就是这么来的）。
    21px 竖向开运算切掉面板地平线：那是一条 2-3px 的实线，横穿整格、把脚底残影连成
    一片，逐行背景模型对它无解（该行整行都是前景，没有背景样本可插），只能按厚度剔除。
    """
    raw = diff > tol
    closed = ndimage.binary_closing(raw, np.ones((15, 15), bool))
    labels, n = ndimage.label(~raw)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    outside = np.isin(labels, border[border > 0])
    fg = ndimage.binary_opening(raw | (closed & outside), np.ones((OPEN_V, 1), bool))
    return _biggest(fg)


def character_mask(rgb, spec):
    """按 spec.segment 选分割方式；残差法需要先用边缘模型起个初值再迭代精修背景。"""
    if spec.segment == "flood":
        return flood_mask(rgb)

    def comp(model):
        return largest_component(
            np.abs(rgb.astype(np.int16) - model.astype(np.int16)).sum(axis=2), spec.tol)

    model0 = background_model(rgb, spec.model)
    mask = comp(model0)
    for _ in range(2):
        if mask is None:
            return None
        bg = ~ndimage.binary_dilation(mask, np.ones((9, 9), bool))
        model = smooth_rows(fill_rowwise(rgb, bg, model0)).astype(np.int16)
        mask = comp(model)
    return mask


def process(src_dir, spec):
    full = repair_guide_lines(
        np.asarray(Image.open(src_dir / spec.src).convert("RGB"), dtype=np.uint8))
    rgb = full[spec.region[1]:spec.region[3], spec.region[0]:spec.region[2]]
    mask = character_mask(rgb, spec)
    if mask is None:
        raise SystemExit(f"{spec.key}: 分区 {spec.region} 内找不到角色，检查正面格与源图")

    ys, xs = np.nonzero(mask)
    top = ys.min()
    bottom = top + int(round((ys.max() + 1 - top) * (1 - spec.trim)))
    band = mask[top:bottom, :]
    xs = np.nonzero(band.any(axis=0))[0]
    left, right = xs.min(), xs.max() + 1
    alpha = band[:, left:right].astype(np.uint8) * 255
    if spec.fade > 0:  # 裁切后仍贴在脚底的一两行投影残边
        n = max(1, int(alpha.shape[0] * spec.fade))
        alpha[-n:, :] = (alpha[-n:, :] * np.linspace(1.0, 0.0, n + 1)[1:, None]).astype(np.uint8)
    sprite = Image.fromarray(np.dstack([rgb[top:bottom, left:right], alpha]), "RGBA")
    out_w = max(1, round(sprite.width * spec.height / sprite.height))
    sprite = sprite.resize((out_w, spec.height), Image.LANCZOS)
    canvas_w = out_w + 2
    canvas = Image.new("RGBA", (canvas_w, spec.height), (0, 0, 0, 0))
    canvas.paste(sprite, (1, 0), sprite)   # 脚底贴画布下边缘
    canvas.save(OUT / f"{spec.key}.png")
    print(f"{spec.key:9s} region{spec.region} 裁切 {out_w}x{spec.height} -> png {canvas_w}x{spec.height}")


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
    print(f"{'gugugaga':9s} 占位剪影 -> png {width}x{height}")


def main():
    if len(sys.argv) != 2:
        raise SystemExit("用法：python tools/prep-enemy-art.py <源图目录>")
    src_dir = Path(sys.argv[1])
    if not src_dir.is_dir():
        raise SystemExit(f"源图目录不存在：{src_dir}")
    OUT.mkdir(parents=True, exist_ok=True)
    for spec in CHARACTERS:
        process(src_dir, spec)
    write_placeholder()
    print(f"完成 -> {OUT}")


if __name__ == "__main__":
    main()
