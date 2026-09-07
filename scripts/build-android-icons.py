#!/usr/bin/env python3
"""Build Android launcher / splash / Play hi-res icon from the skillet 512 art."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "icons" / "icon-512.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
PLAY = ROOT / "PlayStore_Assets"
INK = (16, 10, 7, 255)

LAUNCHER = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
FOREGROUND = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
SPLASH_PORT = {
    "mdpi": (320, 480),
    "hdpi": (480, 800),
    "xhdpi": (720, 1280),
    "xxhdpi": (960, 1600),
    "xxxhdpi": (1280, 1920),
}
SPLASH_LAND = {
    "mdpi": (480, 320),
    "hdpi": (800, 480),
    "xhdpi": (1280, 720),
    "xxhdpi": (1600, 960),
    "xxxhdpi": (1920, 1280),
}


def fit_on_ink(src: Image.Image, size: int, scale: float = 0.78) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), INK)
    inner = max(1, int(size * scale))
    im = src.convert("RGBA").copy()
    im.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    x = (size - im.width) // 2
    y = (size - im.height) // 2
    canvas.alpha_composite(im, (x, y))
    return canvas


def main() -> None:
    if not SRC.exists():
        raise SystemExit("missing " + str(SRC))
    src = Image.open(SRC).convert("RGBA")
    PLAY.mkdir(parents=True, exist_ok=True)

    store = Image.new("RGBA", (512, 512), INK)
    art = src.copy()
    art.thumbnail((480, 480), Image.Resampling.LANCZOS)
    store.alpha_composite(art, ((512 - art.width) // 2, (512 - art.height) // 2))
    store.convert("RGB").save(PLAY / "App_Icon_512x512.png", "PNG")

    for dens, px in LAUNCHER.items():
        folder = RES / f"mipmap-{dens}"
        folder.mkdir(parents=True, exist_ok=True)
        ico = fit_on_ink(src, px, 0.9)
        ico.save(folder / "ic_launcher.png", "PNG")
        ico.save(folder / "ic_launcher_round.png", "PNG")
        ico.save(folder / "ic_launcher_foreground.png", "PNG")

    for dens, px in FOREGROUND.items():
        folder = RES / f"mipmap-{dens}"
        folder.mkdir(parents=True, exist_ok=True)
        fg = fit_on_ink(src, px, 0.62)
        fg.save(folder / "ic_launcher_foreground.png", "PNG")

    anydpi = RES / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    xml = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"""
    (anydpi / "ic_launcher.xml").write_text(xml)
    (anydpi / "ic_launcher_round.xml").write_text(xml)

    values = RES / "values"
    values.mkdir(parents=True, exist_ok=True)
    (values / "ic_launcher_background.xml").write_text(
        """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#100A07</color>
</resources>
"""
    )

    splash_src = fit_on_ink(src, 512, 0.42)
    for dens, (w, h) in SPLASH_PORT.items():
        folder = RES / f"drawable-port-{dens}"
        folder.mkdir(parents=True, exist_ok=True)
        canvas = Image.new("RGB", (w, h), INK[:3])
        mark = splash_src.copy()
        mark.thumbnail((int(w * 0.42), int(h * 0.28)), Image.Resampling.LANCZOS)
        canvas.paste(mark, ((w - mark.width) // 2, (h - mark.height) // 2), mark)
        canvas.save(folder / "splash.png", "PNG")
    for dens, (w, h) in SPLASH_LAND.items():
        folder = RES / f"drawable-land-{dens}"
        folder.mkdir(parents=True, exist_ok=True)
        canvas = Image.new("RGB", (w, h), INK[:3])
        mark = splash_src.copy()
        mark.thumbnail((int(h * 0.5), int(h * 0.5)), Image.Resampling.LANCZOS)
        canvas.paste(mark, ((w - mark.width) // 2, (h - mark.height) // 2), mark)
        canvas.save(folder / "splash.png", "PNG")

    drawable = RES / "drawable"
    drawable.mkdir(parents=True, exist_ok=True)
    splash_src.convert("RGB").save(drawable / "splash.png", "PNG")
    print("android icons + splash written")


if __name__ == "__main__":
    main()
