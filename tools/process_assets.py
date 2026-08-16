#!/usr/bin/env python3
"""Key magenta/rose backdrops and copy art into the game folders."""
from __future__ import annotations

import os
import shutil
from pathlib import Path

from PIL import Image, ImageFilter

SESSION = Path(
    "/Users/shanemorris/.grok/sessions/%2F/01a009a1-b120-7ba3-94a9-eaa900033212/images"
)
ROOT = Path("/Users/shanemorris/Desktop/GrittyWestern/assets")

BACKGROUNDS = {
    "2.jpg": "art/bg-street.jpg",
    "7.jpg": "art/bg-saloon.jpg",
    "8.jpg": "art/bg-canyon.jpg",
    "13.jpg": "art/bg-depot.jpg",
    "15.jpg": "art/bg-gallows.jpg",
}

SPRITES = {
    "1.jpg": "characters/player-idle.png",
    "3.jpg": "characters/revolver.png",
    "6.jpg": "characters/outlaw.png",
    "10.jpg": "characters/marshal.png",
    "16.jpg": "characters/sharp.png",
    "21.jpg": "characters/outlaw-draw.png",
    "22.jpg": "characters/outlaw-dead.png",
    "18.jpg": "characters/marshal-draw.png",
    "19.jpg": "characters/marshal-dead.png",
    "20.jpg": "characters/sharp-draw.png",
    "17.jpg": "characters/sharp-dead.png",
    "4.jpg": "props/pan.png",
    "5.jpg": "props/barrel.png",
    "9.jpg": "props/crate.png",
    "12.jpg": "props/sign.png",
}

ICONS = {
    "11.jpg": "icons/icon-source.jpg",
}


def dist2(a, b):
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2


def border_key(im: Image.Image):
    px = im.load()
    w, h = im.size
    samples = []
    band = max(4, min(w, h) // 40)
    for x in range(0, w, 3):
        for y in range(band):
            samples.append(px[x, y])
            samples.append(px[x, h - 1 - y])
    for y in range(0, h, 3):
        for x in range(band):
            samples.append(px[x, y])
            samples.append(px[w - 1 - x, y])
    samples.sort()
    mid = samples[len(samples) // 2]
    return mid, band


def key_sprite(src: Path, dest: Path, thresh: int = 72):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    key, band = border_key(im)
    limit = thresh * thresh
    rgb = im.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dst = out.load()
    visited = bytearray(w * h)
    stack = []

    def push(x, y):
        if x < 0 or y < 0 or x >= w or y >= h:
            return
        i = y * w + x
        if visited[i]:
            return
        if dist2(rgb[x, y], key) > limit:
            return
        visited[i] = 1
        stack.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)
    while stack:
        x, y = stack.pop()
        push(x + 1, y)
        push(x - 1, y)
        push(x, y + 1)
        push(x, y - 1)

    # copy kept pixels; soft edge where neighbor was keyed
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if visited[i]:
                continue
            r, g, b = rgb[x, y]
            alpha = 255
            # feather if adjacent to keyed
            if (
                (x and visited[i - 1])
                or (x + 1 < w and visited[i + 1])
                or (y and visited[i - w])
                or (y + 1 < h and visited[i + w])
            ):
                d = dist2((r, g, b), key) ** 0.5
                alpha = 255 if d > thresh else int(255 * (d / thresh))
            dst[x, y] = (r, g, b, alpha)

    bbox = out.getbbox()
    if bbox:
        pad = 8
        x0 = max(0, bbox[0] - pad)
        y0 = max(0, bbox[1] - pad)
        x1 = min(w, bbox[2] + pad)
        y1 = min(h, bbox[3] + pad)
        out = out.crop((x0, y0, x1, y1))
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, "PNG")
    print(f"keyed {src.name} -> {dest} {out.size}")


def copy_bg(src: Path, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(src).convert("RGB")
    im.save(dest, "JPEG", quality=88, optimize=True)
    print(f"bg    {src.name} -> {dest} {im.size}")


def make_icons(src: Path):
    im = Image.open(src).convert("RGB")
    icon_dir = ROOT / "icons"
    icon_dir.mkdir(parents=True, exist_ok=True)
    for size, name in [(32, "favicon.png"), (180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
        canvas = Image.new("RGB", (size, size), (16, 10, 8))
        fitted = im.copy()
        fitted.thumbnail((size, size), Image.Resampling.LANCZOS)
        x = (size - fitted.size[0]) // 2
        y = (size - fitted.size[1]) // 2
        canvas.paste(fitted, (x, y))
        canvas.save(icon_dir / name, "PNG")
        print(f"icon  {name} {size}")


def main():
    if not SESSION.exists():
        raise SystemExit(f"missing session images: {SESSION}")
    for src_name, rel in BACKGROUNDS.items():
        src = SESSION / src_name
        if src.exists():
            copy_bg(src, ROOT / rel)
        else:
            print(f"skip bg {src_name}")
    for src_name, rel in SPRITES.items():
        src = SESSION / src_name
        if src.exists():
            key_sprite(src, ROOT / rel)
        else:
            print(f"skip sprite {src_name}")
    for src_name, rel in ICONS.items():
        src = SESSION / src_name
        if src.exists():
            copy_bg(src, ROOT / rel)
            make_icons(src)
        else:
            print(f"skip icon {src_name}")


if __name__ == "__main__":
    main()
