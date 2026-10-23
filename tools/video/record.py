import asyncio, json, base64, os, time
from playwright.async_api import async_playwright
URL = "http://127.0.0.1:8766/?nosw=1"
VETERAN = {"coached": True, "bounceCoached": True}
HOOK = """() => {
  const a = GW.audio, log = (window.__snd = []);
  const now = () => performance.timeOrigin + performance.now();
  const pb = a._playBank.bind(a);
  a._playBank = (name, rate, gain) => { const r = pb(name, rate, gain); if (r) log.push({t: now(), kind: 'bank', name, i: a._banks[name].last, rate, gain}); return r; };
  const say = a.say.bind(a);
  a.say = (line, urgent) => { const r = say(line, urgent); if (r) log.push({t: now(), kind: 'vo', name: line}); return r; };
  const sh = a.startHeart.bind(a); a.startHeart = () => { if (!(a._heart && a._heart.alive)) log.push({t: now(), kind: 'heart+'}); sh(); };
  const st = a.stopHeart.bind(a); a.stopHeart = () => { if (a._heart && a._heart.alive) log.push({t: now(), kind: 'heart-'}); st(); };
}"""

frames, marks, sounds = [], [], []
def mark(kind): marks.append({"t": time.time() * 1000, "kind": kind})

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        ctx = await b.new_context(viewport={"width": 360, "height": 640}, device_scale_factor=3)
        pg = await ctx.new_page()

        async def load(save):
            try:
                sounds.extend(await pg.evaluate("() => window.__snd || []"))
            except Exception:
                pass
            await pg.goto(URL)
            await pg.evaluate("s=>localStorage.setItem('gw.save.v2', s)", json.dumps(save))
            await pg.goto(URL)
            await pg.wait_for_timeout(1500)
            await pg.evaluate(HOOK)

        cdp = await ctx.new_cdp_session(pg)
        os.makedirs("frames", exist_ok=True)
        async def on_frame(ev):
            ts = ev["metadata"]["timestamp"] * 1000
            fn = f"frames/{len(frames):05d}.jpg"
            open(fn, "wb").write(base64.b64decode(ev["data"]))
            frames.append({"t": ts, "f": fn})
            await cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})
        cdp.on("Page.screencastFrame", lambda ev: asyncio.ensure_future(on_frame(ev)))

        async def find_aim(want):
            # searching is cut from the video; the street freezes while aiming
            mark("cut")
            await pg.mouse.move(180, 430); await pg.mouse.down(); await pg.wait_for_timeout(200)
            for y in range(110, 470, 12):
                for x in range(15, 350, 12):
                    await pg.mouse.move(x, y); await pg.wait_for_timeout(25)
                    if (await pg.inner_text("#hold-cue")).strip() == want:
                        return await centre(x, y, want)
            return None

        async def lethal(x, y, want):
            await pg.mouse.move(x, y); await pg.wait_for_timeout(110)
            return (await pg.inner_text("#hold-cue")).strip() == want

        # The first hit sits on the edge of the window; settle in its middle.
        async def centre(x, y, want):
            xs = [x + d for d in range(-18, 19, 3) if await lethal(x + d, y, want)]
            if xs: x = xs[len(xs) // 2]
            ys = [y + d for d in range(-18, 19, 3) if await lethal(x, y + d, want)]
            if ys: y = ys[len(ys) // 2]
            return x, y

        async def shoot(want, start, hold=700, watch=3200):
            hit = await find_aim(want)
            print(want, hit)
            await pg.mouse.move(*start); await pg.wait_for_timeout(120)
            mark("keep")
            sx, sy = start
            for k in range(1, 31):
                f = k / 30; e = f * f * (3 - 2 * f)
                await pg.mouse.move(sx + (hit[0] - sx) * e, sy + (hit[1] - sy) * e)
                await pg.wait_for_timeout(33)
            await pg.wait_for_timeout(hold)
            for _ in range(6):
                if (await pg.inner_text("#hold-cue")).strip() == want: break
                mark("cut")
                again = None
                for dy in range(-24, 25, 6):
                    for dx in range(-24, 25, 6):
                        if await lethal(hit[0] + dx, hit[1] + dy, want):
                            again = await centre(hit[0] + dx, hit[1] + dy, want); break
                    if again: break
                if again: hit = again
                await pg.mouse.move(*hit); await pg.wait_for_timeout(200)
                mark("keep"); await pg.wait_for_timeout(400)
            print("  at release:", (await pg.inner_text("#hold-cue")).strip())
            await pg.mouse.up()
            await pg.wait_for_timeout(watch)

        await cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": 1080, "maxHeight": 1920, "everyNthFrame": 1})

        # 1. title
        await load({})
        await pg.mouse.click(300, 40)  # unlock audio on a harmless spot
        mark("keep"); await pg.wait_for_timeout(2200)
        # 2. street I: lesson, then the shot (chapter line + deadeye)
        await pg.click("#btn-start"); await pg.wait_for_timeout(3600)
        await shoot("WILL HIT", (180, 470), hold=500, watch=3000)
        # 3. canyon bank shot
        mark("cut"); await load(dict(VETERAN, unlocked=6, run={"lives": 3, "score": 1840, "level": 6}))
        await pg.click("#btn-start"); await pg.wait_for_timeout(700)
        mark("keep"); await pg.wait_for_timeout(1300)
        await pg.click("#btn-brief"); await pg.wait_for_timeout(1400)
        await shoot("BOUNCE WILL HIT", (120, 470), hold=700, watch=3400)
        # 4. iron hoops bounce
        mark("cut"); await load(dict(VETERAN, unlocked=2, run={"lives": 3, "score": 620, "level": 2}))
        await pg.click("#btn-start"); await pg.wait_for_timeout(500)
        await pg.click("#btn-brief"); await pg.wait_for_timeout(300)
        mark("keep"); await pg.wait_for_timeout(1200)
        await shoot("BOUNCE WILL HIT", (240, 470), hold=600, watch=3000)
        # 5. back to the title to close
        mark("cut"); await load({"coached": True, "bounceCoached": True, "unlocked": 12, "stars": [3,3,2,3,3,2,3,1,3,2,3,3]})
        mark("keep"); await pg.wait_for_timeout(2600)
        mark("end")

        await cdp.send("Page.stopScreencast")
        sounds.extend(await pg.evaluate("() => window.__snd || []"))
        json.dump({"frames": frames, "marks": marks, "sounds": sounds}, open("log.json", "w"))
        await b.close()

asyncio.run(main())
