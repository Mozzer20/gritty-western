#!/usr/bin/env python3
"""Compose the 1200×630 X / WhatsApp share card from live game art."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUT = ASSETS / "ui"


def load_rgba(path: Path) -> Image.Image:
    im = Image.open(path)
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    return im


def paste_scaled(dst: Image.Image, src: Image.Image, cx: float, cy: float, height: float, anchor="mid"):
    ratio = src.width / src.height
    h = int(height)
    w = max(1, int(h * ratio))
    spr = src.resize((w, h), Image.Resampling.LANCZOS)
    if anchor == "feet":
        x = int(cx - w / 2)
        y = int(cy - h)
    else:
        x = int(cx - w / 2)
        y = int(cy - h / 2)
    dst.alpha_composite(spr, (x, y))


def world_to_card(x, y):
    # Crop of the 720×1280 street that holds the bank: x 40–700, y 220–820
    return (
        (x - 40) * (1200 / 660),
        (y - 220) * (630 / 600),
    )


def main():
    bg = Image.open(ASSETS / "art" / "bg-street.jpg").convert("RGBA")
    bg = bg.resize((720, 1280), Image.Resampling.LANCZOS)
    crop = bg.crop((40, 220, 700, 820)).resize((1200, 630), Image.Resampling.LANCZOS)
    card = crop.convert("RGBA")

    crate = load_rgba(ASSETS / "props" / "crate.webp")
    pan = load_rgba(ASSETS / "props" / "pan.webp")
    outlaw = load_rgba(ASSETS / "characters" / "outlaw.webp")

    paste_scaled(card, crate, *world_to_card(360, 820), 210, "mid")
    paste_scaled(card, pan, *world_to_card(600, 520), 150, "mid")
    paste_scaled(card, outlaw, *world_to_card(360, 400), 340, "feet")

    draw = ImageDraw.Draw(card)
    path = [world_to_card(366, 1151), world_to_card(547, 533), world_to_card(377, 358)]
    # First point is below the crop; start from the bottom edge toward the pan.
    path[0] = (path[1][0] * 0.35 + 1200 * 0.22, 630)
    draw.line([path[0], path[1]], fill=(255, 196, 70, 90), width=18)
    draw.line([path[1], path[2]], fill=(255, 230, 140, 110), width=16)

    def dash(a, b, color, width=6, on=18, off=14):
        ax, ay = a
        bx, by = b
        dx, dy = bx - ax, by - ay
        length = (dx * dx + dy * dy) ** 0.5 or 1
        ux, uy = dx / length, dy / length
        t = 0
        while t < length:
            t2 = min(length, t + on)
            draw.line(
                [(ax + ux * t, ay + uy * t), (ax + ux * t2, ay + uy * t2)],
                fill=color,
                width=width,
            )
            t = t2 + off

    dash(path[0], path[1], (255, 231, 160, 230), 6)
    dash(path[1], path[2], (255, 244, 176, 240), 6)

    spark = world_to_card(547, 533)
    r = 11
    draw.ellipse([spark[0] - r, spark[1] - r, spark[0] + r, spark[1] + r], fill=(255, 244, 200, 255))
    draw.ellipse(
        [spark[0] - 20, spark[1] - 20, spark[0] + 20, spark[1] + 20],
        outline=(255, 220, 120, 200),
        width=3,
    )
    end = path[2]
    draw.ellipse([end[0] - 7, end[1] - 7, end[0] + 7, end[1] + 7], fill=(255, 246, 208, 255))

    shade = Image.new("RGBA", card.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    sd.rectangle([0, 430, 1200, 630], fill=(8, 4, 2, 150))
    for i in range(90):
        a = int(110 * (i / 90))
        sd.rectangle([0, 430 - i, 1200, 431 - i], fill=(8, 4, 2, a))
    card = Image.alpha_composite(card, shade)
    card = ImageEnhance.Color(card).enhance(1.06)
    card = ImageEnhance.Contrast(card).enhance(1.04)

    draw = ImageDraw.Draw(card)
    font_dir = Path("/System/Library/Fonts/Supplemental")
    try:
        brand = ImageFont.truetype(str(font_dir / "Copperplate.ttc"), 86)
        sub = ImageFont.truetype(str(font_dir / "Copperplate.ttc"), 22)
        tag = ImageFont.truetype("/System/Library/Fonts/Supplemental/Courier New.ttf", 20)
    except OSError:
        brand = ImageFont.load_default()
        sub = brand
        tag = brand

    def center_text(text, y, font, fill, shadow=True):
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        x = (1200 - w) / 2 - bbox[0]
        if shadow:
            draw.text((x + 2, y + 3), text, font=font, fill=(58, 20, 8, 220))
        draw.text((x, y), text, font=font, fill=fill)

    center_text("BJANGO", 468, brand, (232, 195, 106, 255))
    center_text("THE GRITTY WESTERN", 556, sub, (232, 215, 184, 255), shadow=False)
    center_text("HOLD  ·  DRAG  ·  LET GO", 590, tag, (196, 165, 116, 255), shadow=False)

    rgb = card.convert("RGB")
    rgb.save(OUT / "og-share.jpg", "JPEG", quality=88, optimize=True, progressive=True)
    rgb.save(OUT / "screenshot-wide.jpg", "JPEG", quality=88, optimize=True, progressive=True)
    print("wrote", OUT / "og-share.jpg", rgb.size)


if __name__ == "__main__":
    main()
