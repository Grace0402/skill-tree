"""生成应用图标：深色圆角底 + 暖金水晶球。用法：python scripts/make-icon.py"""
from __future__ import annotations

import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
os.makedirs(BUILD, exist_ok=True)

S = 2048  # 超采样画布
SS = S / 512.0


def lerp(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


# ---------- 背景 ----------
y = np.linspace(0, 1, S)[:, None]
top = np.array([10, 13, 22], dtype=float)
bottom = np.array([20, 27, 44], dtype=float)
bg = top + (bottom - top) * y
bg = np.repeat(bg[:, None, :], S, axis=1)
bg_img = Image.fromarray(bg.astype(np.uint8), "RGB").convert("RGBA")

# 右上角暖光
glow = Image.new("L", (S, S), 0)
gd = ImageDraw.Draw(glow)
for r, a in [(900 * SS, 8), (700 * SS, 12), (500 * SS, 18), (320 * SS, 26)]:
    gd.ellipse(
        [S * 0.78 - r, S * 0.18 - r, S * 0.78 + r, S * 0.18 + r],
        fill=a,
    )
glow = glow.filter(ImageFilter.GaussianBlur(60 * SS))
warm = Image.new("RGBA", (S, S), (255, 186, 92, 0))
warm.putalpha(glow)
bg_img = Image.alpha_composite(bg_img, warm)

# 圆角遮罩
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle(
    [0, 0, S - 1, S - 1], radius=int(118 * SS), fill=255
)
base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
base.paste(bg_img, (0, 0), mask)

# ---------- 光晕 ----------
cx, cy = S * 0.5, S * 0.52
R = S * 0.292

halo = Image.new("L", (S, S), 0)
hd = ImageDraw.Draw(halo)
for scale, alpha in [(1.9, 6), (1.55, 12), (1.25, 22), (1.08, 38)]:
    r = R * scale
    hd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=alpha)
halo = halo.filter(ImageFilter.GaussianBlur(38 * SS))
halo_layer = Image.new("RGBA", (S, S), (255, 180, 80, 0))
halo_layer.putalpha(halo)
base = Image.alpha_composite(base, halo_layer)

# ---------- 水晶球 ----------
yy, xx = np.mgrid[0:S, 0:S]
dx = (xx - cx) / R
dy = (yy - cy) / R
dist = np.sqrt(dx * dx + dy * dy)
inside = dist <= 1.0

# 光源方向（左上）
lx, ly, lz = -0.42, -0.48, 0.77
nx = dx
ny = dy
nz = np.sqrt(np.clip(1.0 - dx * dx - dy * dy, 0, 1))
lambert = np.clip(nx * lx + ny * ly + nz * lz, 0, 1)

# 边缘暗、中心暖、背光处更暖
edge = np.clip(dist, 0, 1)
core = np.exp(-((dist / 0.55) ** 2))
colors = np.zeros((S, S, 3), dtype=float)
dark = np.array([26, 22, 18], dtype=float)
deep_gold = np.array([138, 78, 18], dtype=float)
gold = np.array([255, 196, 105], dtype=float)
bright = np.array([255, 232, 186], dtype=float)

for i in range(3):
    c = dark[i] + (deep_gold[i] - dark[i]) * np.clip(1 - edge, 0, 1) * 0.9
    c = c + (gold[i] - c) * core * 0.85
    c = c + (bright[i] - c) * np.clip(lambert, 0, 1) ** 5 * 0.75
    colors[:, :, i] = c

alpha_orb = np.clip((1.0 - dist) * 8, 0, 1)
orb = np.dstack([colors, alpha_orb * 255]).astype(np.uint8)
orb_img = Image.fromarray(orb, "RGBA")
base = Image.alpha_composite(base, orb_img)

# 球体高光
spec = Image.new("L", (S, S), 0)
sd = ImageDraw.Draw(spec)
sd.ellipse(
    [cx - R * 0.52, cy - R * 0.62, cx - R * 0.10, cy - R * 0.33],
    fill=190,
)
spec = spec.filter(ImageFilter.GaussianBlur(9 * SS))
spec_layer = Image.new("RGBA", (S, S), (255, 255, 255, 0))
spec_layer.putalpha(spec)
base = Image.alpha_composite(base, spec_layer)

# 轮廓
ring = Image.new("RGBA", (S, S), (0, 0, 0, 0))
rd = ImageDraw.Draw(ring)
rd.ellipse(
    [cx - R, cy - R, cx + R, cy + R],
    outline=(255, 216, 158, 150),
    width=int(3.2 * SS),
)
rd.ellipse(
    [cx - R * 1.09, cy - R * 1.09, cx + R * 1.09, cy + R * 1.09],
    outline=(255, 196, 105, 62),
    width=int(2.0 * SS),
)
base = Image.alpha_composite(base, ring)

# 微弱十字星光
star = Image.new("L", (S, S), 0)
std = ImageDraw.Draw(star)
scx, scy = cx + R * 0.62, cy - R * 0.66
std.line([scx - 22 * SS, scy, scx + 22 * SS, scy], fill=170, width=int(3 * SS))
std.line([scx, scy - 22 * SS, scx, scy + 22 * SS], fill=170, width=int(3 * SS))
star = star.filter(ImageFilter.GaussianBlur(3 * SS))
star_layer = Image.new("RGBA", (S, S), (255, 238, 200, 0))
star_layer.putalpha(star)
base = Image.alpha_composite(base, star_layer)

# ---------- 输出 ----------
icon_1024 = base.resize((1024, 1024), Image.LANCZOS)
icon_1024.save(os.path.join(BUILD, "icon.png"))
icon_1024.save(os.path.join(BUILD, "icon-1024.png"))

sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
icon_1024.save(os.path.join(BUILD, "icon.ico"), sizes=sizes)
print("icons written to", BUILD)
