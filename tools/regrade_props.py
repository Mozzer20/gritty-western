#!/usr/bin/env python3
"""Pull the stray magenta / teal / neon-orange out of the sprites so they sit in
the dusty palette of the painted streets. Originals are kept in assets/_orig."""
import os, shutil, sys
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..", "assets")
ORIG = os.path.join(ROOT, "_orig")

# file -> which hues to tame
JOBS = {
    "props/crate": ("magenta", "teal", "orange"),
    "props/barrel": ("magenta", "teal"),
    "props/pan": ("magenta",),
    "props/sign": ("magenta",),
    "characters/revolver": ("magenta",),
    "characters/outlaw": ("magenta",),
    "characters/outlaw-dead": ("magenta",),
    "characters/outlaw-draw": ("magenta",),
}
BANDS = {"magenta": (0.76, 0.99), "teal": (0.40, 0.58), "orange": (0.04, 0.12)}
RUST = 0.065  # hue of weathered wood / rust


def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rc = np.where(m, (mx - r) / np.where(m, d, 1), 0)
    gc = np.where(m, (mx - g) / np.where(m, d, 1), 0)
    bc = np.where(m, (mx - b) / np.where(m, d, 1), 0)
    h = np.where(r == mx, bc - gc, np.where(g == mx, 2 + rc - bc, 4 + gc - rc))
    h = np.where(m, (h / 6) % 1, 0)
    s = np.where(mx > 0, d / np.where(mx > 0, mx, 1), 0)
    return h, s, mx


def hsv_to_rgb(h, s, v):
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    out = np.stack([np.choose(i, [v, q, p, p, t, v]), np.choose(i, [t, v, v, q, p, p]), np.choose(i, [p, p, t, v, v, q])], -1)
    return out


def regrade(path, bands):
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im).astype(np.float32) / 255
    h, s, v = rgb_to_hsv(a[..., :3])
    hit = np.zeros(h.shape, bool)
    for name in bands:
        lo, hi = BANDS[name]
        sat_floor = {"orange": 0.5, "teal": 0.12, "magenta": 0.15}[name]
        hit |= (h >= lo) & (h <= hi) & (s > sat_floor)
    h2 = np.where(hit, RUST, h)
    s2 = np.where(hit, np.minimum(s, 0.38) * 0.8, s)
    v2 = np.where(hit, v * 0.82, v)
    a[..., :3] = hsv_to_rgb(h2, s2, v2)
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "RGBA"), hit.mean()


for key, bands in JOBS.items():
    for ext in ("webp", "png"):
        src = os.path.join(ROOT, key + "." + ext)
        if not os.path.exists(src):
            continue
        keep = os.path.join(ORIG, key + "." + ext)
        os.makedirs(os.path.dirname(keep), exist_ok=True)
        if not os.path.exists(keep):
            shutil.copy2(src, keep)
        out, frac = regrade(keep, bands)
        if ext == "webp":
            out.save(src, "WEBP", quality=88, method=6)
        else:
            out.save(src, "PNG", optimize=True)
        print(f"{key}.{ext}: recoloured {frac * 100:.1f}% of pixels")
