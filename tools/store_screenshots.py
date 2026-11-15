#!/usr/bin/env python3
"""Google Play phone screenshots (1080x1920) captured from real play.

Serve the project first (any static server on PORT), then:

    python3 -m http.server 8777 &
    python3 tools/store_screenshots.py [out_dir] [port]

Plays a mid-game save in headless Chromium at 360x640 @3x: the title, a
banked double on Tin Alley, a clear card, Bounty Hunt, the Daily Showdown,
the streets map and the Wanted Posters.
"""
from __future__ import annotations

import asyncio
import json
import math
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "PlayStore_Assets" / "Screenshots-1.3.0"
PORT = sys.argv[2] if len(sys.argv) > 2 else "8777"
URL = f"http://127.0.0.1:{PORT}/"
W, H = 360, 640
S = W / 720  # stage scale on a 9:16 screen (the stage fills it exactly)

STATS = {
    "levelsCleared": 16, "bankKills": 31, "headKills": 7, "doubles": 1, "threeStarClears": 3,
    "kills": 58, "tumbleweeds": 6, "furthest": 13, "bestWave": 7, "bestDailyStreak": 2,
}
MID = {
    "best": 21_350, "unlocked": 13, "coached": True, "bounceCoached": True,
    "stars": [3, 3, 2, 2, 2, 1, 2, 2, 1, 2, 2, 2, 0] + [0] * 17,
    "run": {"lives": 2, "score": 18_420, "level": 13},
    "stats": STATS, "posters": [],
}
# One street before the clear card: The Hanging Pan, banked for three stars.
# (Three stars there already, so no unlock toast covers the card.)
PAN_RUN = dict(MID, unlocked=1, stars=[3, 3] + [0] * 28, run={"lives": 3, "score": 8_240, "level": 1})


def scr(wx: float, wy: float) -> tuple[float, float]:
    return wx * S, wy * S


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=3,
                                        service_workers="block")
        pg = await ctx.new_page()
        errors: list[str] = []
        pg.on("pageerror", lambda e: errors.append(str(e)))

        async def load(save: dict, query: str = "") -> None:
            await pg.goto(URL)
            await pg.evaluate(
                "s => { localStorage.clear(); localStorage.setItem('gw.save.v2', s);"
                " localStorage.setItem('gw.save.gunsmith', 'gold'); }",
                json.dumps(save),
            )
            await pg.goto(URL + query)
            await pg.wait_for_function("document.fonts.status === 'loaded'")
            await pg.wait_for_timeout(1500)

        async def shot(name: str) -> None:
            await pg.screenshot(path=str(OUT / f"{name}.png"))
            print("  ", name)

        async def cue() -> str:
            return await pg.inner_text("#hold-cue")

        async def aim_until(points, want: str, settle: int = 140) -> bool:
            """Hold the screen and drag across candidate points until the cue reads `want`."""
            await pg.mouse.move(W / 2, H * 0.72)
            await pg.mouse.down()
            await pg.wait_for_timeout(120)
            for x, y in points:
                await pg.mouse.move(x, y, steps=3)
                await pg.wait_for_timeout(settle)
                if want in await cue():
                    return True
            return False

        print("writing", OUT)

        # 1. Title
        await load(MID)
        await pg.wait_for_timeout(600)
        await shot("1_title")

        # 2-3. Tin Alley: bank off a tin sign through two men with one bullet
        ang = math.radians(-117.27)  # centre of the two-man window (1.4 deg wide)
        ray = [scr(360 + math.cos(ang) * d, 1172 + math.sin(ang) * d) for d in (650,)]
        jitter = [(ray[0][0] + dx, ray[0][1] + dy) for dx in (0, -2, 2, -4, 4) for dy in (0, -2, 2)]
        for attempt in range(3):
            await load(MID, "?play=12&go=1")
            if await aim_until(jitter, "×2"):
                break
            await pg.mouse.up()
        else:
            raise SystemExit("could not line up the Tin Alley double: " + await cue())
        await pg.wait_for_timeout(650)  # let the slow-mo settle in
        await shot("2_bank_shot")
        await pg.mouse.up()
        best = None
        for _ in range(30):
            await pg.wait_for_timeout(90)
            state = await pg.evaluate(
                "() => { const c = document.getElementById('callout');"
                " return [c.textContent, +getComputedStyle(c).opacity]; }"
            )
            if state[0].startswith("DOUBLE") and state[1] > 0.85:
                best = await pg.screenshot()
                break
        if best is None:
            raise SystemExit("never saw the DOUBLE COLLATERAL stamp")
        (OUT / "3_collateral.png").write_bytes(best)
        print("   3_collateral")

        # 4. Clear card: The Hanging Pan with one banked slug
        await load(PAN_RUN)
        await pg.click("#btn-start")
        await pg.wait_for_timeout(700)
        await pg.click("#btn-brief")
        await pg.wait_for_timeout(900)
        pan_ring = [scr(x, y) for y in range(470, 575, 9) for x in range(548, 660, 8)]
        if not await aim_until(pan_ring, "BOUNCE WILL HIT", settle=90):
            raise SystemExit("could not find a bank shot off the pan: " + await cue())
        await pg.wait_for_timeout(300)
        await pg.mouse.up()
        await pg.wait_for_timeout(4200)
        await shot("4_scene_clear")

        # 5. Bounty Hunt: drop wave one, then the saloon wave
        await load(MID)
        await pg.click("#btn-bounty-start")
        await pg.wait_for_timeout(900)
        await aim_until([scr(360, 400 - 84)], "WILL HIT")
        await pg.wait_for_timeout(300)
        await pg.mouse.up()
        await pg.wait_for_function("document.getElementById('chapter').textContent.startsWith('WAVE 2')", timeout=8000)
        await pg.wait_for_timeout(420)
        await shot("5_bounty_hunt")

        # 6. Daily Showdown
        await load(MID)
        await pg.click("#btn-daily")
        await pg.wait_for_timeout(700)
        await pg.click("#btn-brief")
        await pg.wait_for_timeout(1100)
        await shot("6_daily_showdown")

        # 7-8. Streets map and Wanted Posters
        await load(MID)
        await pg.click("#btn-map")
        await pg.wait_for_timeout(700)
        await shot("7_streets")
        await pg.click("#btn-map-close")
        await pg.click("#btn-posters")
        await pg.wait_for_timeout(700)
        await shot("8_wanted_posters")

        await browser.close()
        if errors:
            raise SystemExit("page errors: " + "; ".join(errors))


if __name__ == "__main__":
    asyncio.run(main())
