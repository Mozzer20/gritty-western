#!/usr/bin/env python3
"""1024x500 Play feature graphic from the street plate and skillet icon."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PLAY = ROOT / "PlayStore_Assets"
BG = ROOT / "assets" / "art" / "bg-street.jpg"
ICON = ROOT / "assets" / "icons" / "icon-512.png"
OUT = PLAY / "Feature_Graphic_1024x500.png"


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        "/System/Library/Fonts/Supplemental/Copperplate.ttc",
        "/System/Library/Fonts/Supplemental/Didot.ttc",
        "/Library/Fonts/Georgia.ttf",
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
    ):
        p = Path(path)
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size)
            except OSError:
                continue
    return ImageFont.load_default()


def main() -> None:
    PLAY.mkdir(parents=True, exist_ok=True)
    street = Image.open(BG).convert("RGB")
    # Street is 720x1280 portrait; take a wide sunset band and scale to 1024x500.
    w, h = street.size
    band = street.crop((0, int(h * 0.18), w, int(h * 0.52)))
    canvas = band.resize((1024, 500), Image.Resampling.LANCZOS)
    canvas = ImageEnhance.Color(canvas).enhance(1.15)
    canvas = ImageEnhance.Contrast(canvas).enhance(1.08)

    overlay = Image.new("RGB", (1024, 500), (16, 10, 7))
    canvas = Image.blend(canvas, overlay, 0.28)
    shade = Image.new("L", (1024, 500), 0)
    sd = ImageDraw.Draw(shade)
    for x in range(1024):
        a = int(180 * max(0, (x - 420) / 600))
        sd.line([(x, 0), (x, 500)], fill=min(200, a))
    canvas.paste(Image.new("RGB", (1024, 500), (16, 10, 7)), mask=shade)

    skillet = Image.open(ICON).convert("RGBA")
    skillet.thumbnail((420, 420), Image.Resampling.LANCZOS)
    skillet = skillet.filter(ImageFilter.UnsharpMask(radius=1.2, percent=80, threshold=2))
    canvas_rgba = canvas.convert("RGBA")
    canvas_rgba.alpha_composite(skillet, (40, (500 - skillet.height) // 2 + 8))

    draw = ImageDraw.Draw(canvas_rgba)
    title = font(72)
    sub = font(22)
    kicker = font(16)
    draw.text((520, 148), "A RED DUST PICTURE", font=kicker, fill=(232, 195, 106, 220))
    draw.text((518, 188), "BJANGO", font=title, fill=(232, 195, 106, 255))
    draw.text((520, 278), "THE GRITTY WESTERN", font=sub, fill=(232, 215, 176, 230))
    draw.text((520, 328), "HOLD  ·  DRAG  ·  LET GO", font=kicker, fill=(196, 165, 116, 210))
    canvas_rgba.convert("RGB").save(OUT, "PNG")
    print("wrote", OUT, canvas_rgba.size)


if __name__ == "__main__":
    main()
