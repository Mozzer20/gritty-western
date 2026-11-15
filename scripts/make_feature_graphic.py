#!/usr/bin/env python3
"""1024x500 Google Play feature graphic.

Renders tools/feature-graphic.html (the game's street, outlaw, skillet and
logo) with headless Chromium at 2x, then downsamples to 1024x500 and saves a
24-bit PNG with no alpha channel, as Play requires.

    python3 scripts/make_feature_graphic.py
"""
from __future__ import annotations

import asyncio
import io
from pathlib import Path

from PIL import Image
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "tools" / "feature-graphic.html"
OUT = ROOT / "PlayStore_Assets" / "Feature_Graphic_1024x500.png"


async def render() -> bytes:
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1024, "height": 500}, device_scale_factor=2)
        await page.goto(SRC.as_uri())
        await page.evaluate("document.fonts.ready")
        await page.wait_for_function(
            "[...document.images].every(i => i.complete && i.naturalWidth > 0)"
        )
        await page.wait_for_timeout(300)
        png = await page.screenshot(clip={"x": 0, "y": 0, "width": 1024, "height": 500})
        await browser.close()
        return png


def main() -> None:
    big = Image.open(io.BytesIO(asyncio.run(render()))).convert("RGB")
    out = big.resize((1024, 500), Image.Resampling.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, "PNG", optimize=True)
    print("wrote", OUT.relative_to(ROOT), out.size, out.mode)


if __name__ == "__main__":
    main()
