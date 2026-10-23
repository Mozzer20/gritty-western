import json, os, subprocess, bisect, sys
d = json.load(open("log.json"))
G = "/Users/shanemorris/Desktop/GrittyWestern/"
FPS = 30
frames = d["frames"]; ft = [f["t"] for f in frames]
# keep intervals in wall-clock ms
keeps, cur = [], None
for m in d["marks"]:
    if m["kind"] == "keep": cur = m["t"]
    elif cur is not None: keeps.append((cur, m["t"])); cur = None
def out_time(t):
    acc = 0
    for a, b in keeps:
        if a <= t <= b: return acc + (t - a)
        acc += b - a
    return None
total = sum(b - a for a, b in keeps)
os.makedirs("seq", exist_ok=True)
for f in os.listdir("seq"): os.remove("seq/" + f)
n = int(total / 1000 * FPS)
acc, idx = 0, 0
for a, b in keeps:
    t = a
    while t < b and idx < n:
        i = max(0, bisect.bisect_right(ft, t) - 1)
        os.symlink(os.path.abspath(frames[i]["f"]), f"seq/{idx:05d}.jpg")
        idx += 1; t += 1000 / FPS
# closing card
card_at = idx * 1000 / FPS
for _ in range(int(3.2 * FPS)):
    os.symlink(os.path.abspath("endcard.jpg"), f"seq/{idx:05d}.jpg"); idx += 1
total = idx * 1000 / FPS
print("video seconds", total / 1000, "frames", idx)
# audio: place each logged sound at its output time
inputs, filters = [], []
heart_on = None
ev = sorted(d["sounds"], key=lambda s: s["t"])
def add(path, at_ms, gain=1.0, rate=1.0, dur=None):
    k = len(filters)
    inputs.extend(["-i", path])
    f = f"[{k+1}:a]aformat=sample_rates=44100:channel_layouts=stereo"
    if rate != 1.0: f += f",asetrate={int(44100*rate)},aresample=44100"
    if dur: f += f",atrim=0:{dur/1000:.3f}"
    f += f",volume={gain:.3f},adelay={int(at_ms)}|{int(at_ms)}[s{k}]"
    filters.append(f)
for s in ev:
    ot = out_time(s["t"])
    if s["kind"] == "heart+": heart_on = s["t"]; continue
    if s["kind"] == "heart-":
        if heart_on is not None:
            a = out_time(max(heart_on, s["t"] - 2500))
            # only the part of the hold that survived the cut
            for ka, kb in keeps:
                if ka <= s["t"] <= kb:
                    start = max(heart_on, ka); a = out_time(start)
                    add(G + "assets/sfx/heart-1.mp3", a, 0.5, 1.0, s["t"] - start)
        heart_on = None; continue
    if ot is None: continue
    if s["kind"] == "vo": add(G + f"assets/vo/{s['name']}.mp3", ot, 1.3)
    else:
        import re
        js = open(G + "js/audio.js").read()
        m = re.search(s["name"] + r': \{\s*paths: \[([^\]]*)\]', js)
        paths = re.findall(r'"([^"]+)"', m.group(1)) if m else []
        if not paths: continue
        p = paths[min(max(s.get("i", 0), 0), len(paths) - 1)]
        add(G + p, ot, (s.get("gain") or 1) * 0.8, s.get("rate") or 1)
add(G + "assets/sfx/whistle-1.mp3", card_at + 150, 0.9)
# wind bed under everything
k = len(filters); inputs.extend(["-stream_loop", "-1", "-i", G + "assets/sfx/wind-1.mp3"])
filters.append(f"[{k+1}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.25,atrim=0:{total/1000:.3f}[s{k}]")
mix = "".join(f"[s{i}]" for i in range(len(filters)))
fc = ";".join(filters) + f";{mix}amix=inputs={len(filters)}:normalize=0,alimiter=limit=0.9,atrim=0:{total/1000:.3f},afade=t=out:st={total/1000-0.8:.3f}:d=0.8[mix]"
open("fc.txt", "w").write(fc)
cmd = ["ffmpeg", "-y", "-v", "error", "-framerate", str(FPS), "-i", "seq/%05d.jpg"] + inputs + [
    "-/filter_complex", "fc.txt", "-map", "0:v", "-map", "[mix]",
    "-vf", f"scale=1080:1920:flags=lanczos,format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st={total/1000-0.8:.3f}:d=0.8",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-c:a", "aac", "-b:a", "160k", "-shortest", sys.argv[1]]
subprocess.run(cmd, check=True)
print("wrote", sys.argv[1])
