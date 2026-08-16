/**
 * The Gritty Western — mobile bullet-time ricochet shooter.
 */
(function () {
  const VW = 720;
  const VH = 1280;
  const SAVE = "gw.save.v2";
  const P = GW.physics;
  const audio = GW.audio;

  const $ = (id) => document.getElementById(id);
  const canvas = $("view");
  const ctx = canvas.getContext("2d");
  const sight = $("sight");
  const sctx = sight.getContext("2d");
  const cyl = $("cylinder");
  const cctx = cyl.getContext("2d");

  const IMG = {
    street: "assets/art/bg-street.jpg",
    saloon: "assets/art/bg-saloon.jpg",
    canyon: "assets/art/bg-canyon.jpg",
    depot: "assets/art/bg-depot.jpg",
    gallows: "assets/art/bg-gallows.jpg",
    player: "assets/characters/player-idle.png",
    revolver: "assets/characters/revolver.png",
    outlaw: "assets/characters/outlaw.png",
    outlawDraw: "assets/characters/outlaw-draw.png",
    outlawDead: "assets/characters/outlaw-dead.png",
    marshal: "assets/characters/marshal.png",
    marshalDraw: "assets/characters/marshal-draw.png",
    marshalDead: "assets/characters/marshal-dead.png",
    sharp: "assets/characters/sharp.png",
    sharpDraw: "assets/characters/sharp-draw.png",
    sharpDead: "assets/characters/sharp-dead.png",
    pan: "assets/props/pan.png",
    barrel: "assets/props/barrel.png",
    crate: "assets/props/crate.png",
    sign: "assets/props/sign.png",
  };

  const images = {};

  const GRADES = {
    street: { shadow: "rgb(42,22,14)", shadowA: 0.16, high: "rgb(255,196,86)", highA: 0.13, sun: [0.72, 0.12] },
    saloon: { shadow: "rgb(10,5,8)", shadowA: 0.34, high: "rgb(255,132,46)", highA: 0.17, sun: null },
    canyon: { shadow: "rgb(22,16,36)", shadowA: 0.18, high: "rgb(255,158,64)", highA: 0.2, sun: [0.7, 0.1] },
    depot: { shadow: "rgb(32,18,12)", shadowA: 0.2, high: "rgb(255,168,74)", highA: 0.15, sun: [0.78, 0.14] },
    gallows: { shadow: "rgb(22,22,26)", shadowA: 0.1, high: "rgb(255,228,176)", highA: 0.22, sun: [0.5, 0.08] },
  };

  function depthScale(y) {
    return 0.78 + Math.max(0, Math.min(1, y / VH)) * 0.4;
  }
  const state = {
    mode: "title",
    level: 0,
    lives: 3,
    ammo: 6,
    score: 0,
    best: 0,
    unlocked: 0,
    stars: [],
    timeScale: 1,
    aiming: false,
    pointerId: null,
    aim: { x: 360, y: 640 },
    muzzle: { x: 360, y: 1172 },
    entities: [],
    bullet: null,
    particles: [],
    casings: [],
    smoke: [],
    hats: [],
    muzzleFlash: 0,
    motes: [],
    shake: 0,
    hitstop: 0,
    hintT: 0,
    fightT: 0,
    reloading: 0,
    sceneShots: 0,
    sceneChains: 0,
    sceneKills: 0,
    ghost: null,
    preview: null,
    cam: { x: VW / 2, y: VH / 2, z: 1, roll: 0 },
    camHold: 0,
    camFocus: null,
    heartT: 0,
    view: { scale: 1, ox: 0, oy: 0, cssScale: 1, cssOx: 0, cssOy: 0 },
    muted: false,
    ready: false,
  };

  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE) || "{}");
      state.best = s.best || 0;
      state.unlocked = s.unlocked || 0;
      state.stars = Array.isArray(s.stars) ? s.stars : [];
    } catch (e) {
      state.stars = [];
    }
    while (state.stars.length < GW.LEVELS.length) state.stars.push(0);
    $("bestEl").textContent = fmt(state.best);
    paintTitle();
  }

  function save() {
    try {
      localStorage.setItem(
        SAVE,
        JSON.stringify({
          best: state.best,
          unlocked: state.unlocked,
          stars: state.stars,
        })
      );
    } catch (e) {}
  }

  function fmt(n) {
    return String(n | 0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function rumble(ms) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {}
  }

  function loadImages() {
    return Promise.all(
      Object.keys(IMG).map(
        (key) =>
          new Promise((res) => {
            const im = new Image();
            im.onload = () => {
              images[key] = im;
              res();
            };
            im.onerror = () => res();
            im.src = IMG[key];
          })
      )
    );
  }

  function uid(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 8);
  }

  function spawnMotes() {
    state.motes = [];
    for (let i = 0; i < 48; i++) {
      state.motes.push({
        x: Math.random() * VW,
        y: Math.random() * VH,
        r: 0.6 + Math.random() * 1.6,
        v: 6 + Math.random() * 16,
        a: 0.08 + Math.random() * 0.18,
      });
    }
  }

  function resetCam() {
    state.cam.x = VW / 2;
    state.cam.y = VH / 2;
    state.cam.z = 1;
    state.cam.roll = 0;
    state.camHold = 0;
    state.camFocus = null;
  }

  function buildLevel(i) {
    const L = GW.LEVELS[i];
    state.entities = L.entities.map((raw) => {
      const e = Object.assign(
        {
          id: uid(raw.type),
          s: 1,
          spin: 0,
          spinV: 0,
          hp: 1,
          hurt: 0,
          fall: 0,
          hidden: false,
          peekT: raw.peekOff || 0,
          paceDir: 1,
          phase: 0,
        },
        raw
      );
      e.homeX = e.x;
      e.homeY = e.y;
      if (e.type === "enemy") {
        e.drawT = 0;
        e.drawMax = e.draw || 7;
        e.hp = e.hp || 1;
        e.dead = false;
        e.flash = 0;
      }
      if (e.type === "pan" && e.swing) {
        e.anchorX = e.x;
        e.anchorY = e.y;
      }
      return e;
    });
    state.ammo = 6;
    state.aiming = false;
    state.bullet = null;
    state.reloading = 0;
    state.fightT = 0;
    state.hintT = 5.8;
    state.sceneShots = 0;
    state.sceneChains = 0;
    state.sceneKills = 0;
    state.ghost = null;
    state.preview = null;
    state.particles = [];
    state.casings = [];
    state.smoke = [];
    state.hats = [];
    state.muzzleFlash = 0;
    resetCam();
    spawnMotes();
    $("chapter").textContent = L.name;
    $("hint").textContent = L.hint;
    $("hint").classList.add("show");
    $("hold-cue").textContent = "HOLD TO AIM";
    $("hold-cue").style.opacity = "0.6";
    $("scoreEl").textContent = fmt(state.score);
    renderHearts();
  }

  function renderHearts() {
    $("hearts").textContent = [0, 1, 2].map((i) => (i < state.lives ? "♥" : "♡")).join(" ");
  }

  function previewMode() {
    const L = GW.LEVELS[state.level];
    return (L && L.preview) || "full";
  }

  function collectBodies() {
    const bodies = [
      { id: "floor", kind: "segment", ax: 8, ay: 1266, bx: 712, by: 1266, r: 6, material: "dirt" },
      { id: "left", kind: "segment", ax: 6, ay: 18, bx: 6, by: 1266, r: 6, material: "adobe" },
      { id: "right", kind: "segment", ax: 714, ay: 18, bx: 714, by: 1266, r: 6, material: "adobe" },
      { id: "sky", kind: "segment", ax: 6, ay: 14, bx: 714, by: 14, r: 6, material: "adobe" },
    ];
    for (const e of state.entities) {
      if (e.type === "enemy") {
        if (e.dead || e.hidden) continue;
        const sc = 0.92 * (e.s || 1);
        bodies.push({
          id: e.id,
          kind: "circle",
          x: e.x,
          y: e.y - 86 * sc,
          r: 32 * sc,
          material: "flesh",
          tag: "body",
          ent: e,
        });
        bodies.push({
          id: e.id + "-head",
          kind: "circle",
          x: e.x,
          y: e.y - 154 * sc,
          r: 17 * sc,
          material: "flesh",
          tag: "head",
          ent: e,
        });
      } else if (e.type === "pan") {
        bodies.push({ id: e.id, kind: "circle", x: e.x, y: e.y, r: 44 * e.s, material: "pan", ent: e });
      } else if (e.type === "barrel") {
        bodies.push({ id: e.id, kind: "circle", x: e.x, y: e.y, r: 46 * e.s, material: "hoop", ent: e });
      } else if (e.type === "crate") {
        bodies.push({ id: e.id, kind: "circle", x: e.x, y: e.y, r: 54 * e.s, material: "wood", ent: e });
      } else if (e.type === "sign") {
        const h = e.h || 200;
        bodies.push({
          id: e.id,
          kind: "segment",
          ax: e.x,
          ay: e.y - h * 0.5,
          bx: e.x,
          by: e.y + h * 0.5,
          r: 5,
          material: "metal",
          ent: e,
        });
      } else if (e.type === "fence") {
        bodies.push({
          id: e.id,
          kind: "segment",
          ax: e.x0,
          ay: e.y,
          bx: e.x1,
          by: e.y,
          r: e.r || 10,
          material: "wood",
          ent: e,
        });
      }
    }
    return bodies;
  }

  function aimDir() {
    return { x: state.aim.x - state.muzzle.x, y: state.aim.y - state.muzzle.y };
  }

  function currentTrace() {
    return P.traceShot(state.muzzle, aimDir(), collectBodies(), {
      speed: 1760,
      radius: 4,
      maxBounces: 6,
      muzzle: 22,
      chain: true,
    });
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (speed || 140) * (0.3 + Math.random());
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.25 + Math.random() * 0.45,
        age: 0,
        r: 1 + Math.random() * 2.4,
        color,
      });
    }
  }

  function stamp(text) {
    const el = $("callout");
    el.textContent = text;
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
  }

  function flash() {
    const el = $("flash");
    el.classList.remove("bang");
    void el.offsetWidth;
    el.classList.add("bang");
  }

  function densify(path, spacing) {
    const out = [];
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      if (!out.length) {
        out.push({ x: p.x, y: p.y, bounce: p.bounce, hit: p.hit });
        continue;
      }
      const prev = out[out.length - 1];
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const len = Math.hypot(dx, dy);
      const n = Math.max(1, Math.floor(len / spacing));
      for (let k = 1; k <= n; k++) {
        out.push({
          x: prev.x + (dx * k) / n,
          y: prev.y + (dy * k) / n,
          bounce: p.bounce,
          hit: k === n ? p.hit : null,
        });
      }
    }
    return out;
  }

  function polyLen(pts) {
    let l = 0;
    for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return l;
  }

  function pointAt(pts, dist) {
    let left = dist;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      const l = Math.hypot(dx, dy) || 1;
      if (left <= l) {
        const t = left / l;
        return {
          x: pts[i - 1].x + dx * t,
          y: pts[i - 1].y + dy * t,
          i,
          hit: pts[i].hit,
          bounce: pts[i].bounce,
        };
      }
      left -= l;
    }
    const last = pts[pts.length - 1];
    return { x: last.x, y: last.y, i: pts.length - 1, hit: last.hit, bounce: last.bounce };
  }

  function eventsFromPath(path) {
    const ev = [];
    let dist = 0;
    for (let i = 1; i < path.length; i++) {
      dist += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
      const hit = path[i].hit;
      if (!hit) continue;
      const mat = P.MATERIALS[hit.material] || {};
      if (mat.lethal) ev.push({ dist, kind: "kill", hit, bounce: path[i].bounce });
      else if (mat.spark) ev.push({ dist, kind: "bounce", hit, bounce: path[i].bounce });
      else if (mat.absorb) ev.push({ dist, kind: "absorb", hit, bounce: path[i].bounce });
    }
    return ev;
  }

  function fire() {
    if (state.mode !== "fight" || state.bullet || state.reloading > 0) return;
    if (state.ammo <= 0) {
      audio.click();
      stamp("EMPTY");
      rumble(8);
      return;
    }
    const trace = currentTrace();
    const pts = densify(trace.path, 10);
    state.ammo -= 1;
    state.sceneShots += 1;
    state.bullet = {
      pts,
      dist: 0,
      total: polyLen(pts),
      bounces: trace.bounces,
      events: eventsFromPath(trace.path),
      fired: 0,
      kills: 0,
    };
    state.aiming = false;
    state.ghost = null;
    audio.gunshot();
    rumble(18);
    flash();
    state.shake = 10;
    state.muzzleFlash = 0.1;
    burst(state.muzzle.x, state.muzzle.y, "#f3d48a", 10, 220);
    spawnCasing();
    spawnSmoke(state.muzzle.x, state.muzzle.y - 36);
    $("hold-cue").style.opacity = "0";
  }

  function spawnCasing() {
    const side = state.aim.x >= state.muzzle.x ? 1 : -1;
    state.casings.push({
      x: state.muzzle.x + side * 18,
      y: state.muzzle.y - 48,
      vx: side * (90 + Math.random() * 70),
      vy: -240 - Math.random() * 90,
      rot: Math.random() * Math.PI,
      vr: side * (10 + Math.random() * 8),
      age: 0,
      life: 1.5,
    });
  }

  function spawnSmoke(x, y) {
    for (let i = 0; i < 5; i++) {
      state.smoke.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 18,
        vy: -12 - Math.random() * 18,
        r: 10 + Math.random() * 14,
        age: 0,
        life: 0.7 + Math.random() * 0.5,
      });
    }
  }

  function spawnHat(e) {
    const d = depthScale(e.y);
    state.hats.push({
      x: e.x + 10,
      y: e.y - 150 * d,
      vx: (Math.random() - 0.4) * 80,
      vy: -160 - Math.random() * 60,
      rot: 0,
      vr: (Math.random() - 0.5) * 10,
      age: 0,
      life: 1.2,
    });
  }

  function applyKill(hit, bounces, chainIndex) {
    const e = hit.body && hit.body.ent;
    if (!e || e.type !== "enemy" || e.dead) return false;
    const head = hit.body.tag === "head";
    e.hp -= head ? 2 : 1;
    e.flash = 0.12;
    e.hurt = 0.2;
    state.hitstop = 0.08;
    state.shake = 12;
    audio.thud();
    rumble(head ? 32 : 24);
    burst(hit.x, hit.y, head ? "#e8c36a" : "#8b1e1e", head ? 18 : 12, 200);
    if (e.hp <= 0) {
      e.dead = true;
      e.fall = 0.01;
      spawnHat(e);
      state.sceneKills += 1;
      if (chainIndex > 0) state.sceneChains += 1;
      const style = styleName(bounces, head, chainIndex);
      const pay = 120 + bounces * 160 + (head ? 220 : 0) + (chainIndex > 0 ? 280 : 0);
      state.score += pay;
      $("scoreEl").textContent = fmt(state.score);
      stamp(style);
      state.camFocus = e;
      state.camHold = 0.38;
      return true;
    }
    stamp(head ? "GRAZE THE HAT" : "HE'S STILL UP");
    return false;
  }

  function styleName(bounces, head, chainIndex) {
    if (chainIndex > 0 && bounces >= 2) return "IMPOSSIBLE";
    if (chainIndex > 0) return "TWO NAMES";
    if (bounces >= 3 && head) return "IMPOSSIBLE";
    if (bounces >= 3) return "TRICK SHOT";
    if (bounces === 2) return "DOUBLE BANK";
    if (bounces === 1 && head) return "DEAD EYE";
    if (bounces === 1) return "BANK SHOT";
    if (head) return "DEAD EYE";
    return "CLEAN";
  }

  function living() {
    return state.entities.filter((e) => e.type === "enemy" && !e.dead);
  }

  function rankForScene() {
    if (state.sceneShots <= 1) return 3;
    const L = GW.LEVELS[state.level];
    if (state.sceneShots <= (L.par || 3)) return 2;
    return 1;
  }

  function sceneClear() {
    const L = GW.LEVELS[state.level];
    const leftover = 6 - state.ammo;
    const bonus = Math.max(0, (L.par - leftover) * 200);
    const chainBonus = state.sceneChains * 150;
    state.score += bonus + chainBonus;
    const rank = rankForScene();
    state.stars[state.level] = Math.max(state.stars[state.level] || 0, rank);
    if (state.score > state.best) state.best = state.score;
    state.unlocked = Math.max(state.unlocked, state.level + 1);
    save();
    $("bestEl").textContent = fmt(state.best);
    $("scoreEl").textContent = fmt(state.score);
    audio.sting(true);
    rumble(40);
    state.mode = "end";
    resetCam();
    $("end-kicker").textContent = "SCENE CLEAR";
    $("end-name").textContent = L.name;
    $("end-stars").textContent = "★".repeat(rank) + "☆".repeat(3 - rank);
    $("end-detail").textContent =
      (state.sceneShots === 1 ? "One slug. " : state.sceneShots + " shots. ") +
      (state.sceneChains ? "Two names on one bullet. " : "") +
      "Score " +
      fmt(state.score) +
      ".";
    const last = state.level >= GW.LEVELS.length - 1;
    $("btn-next").hidden = false;
    $("btn-next").textContent = last ? "PLAY FROM START" : "NEXT STREET";
    if (last) {
      $("end-kicker").textContent = "RED DUST COUNTY";
      $("end-name").textContent = "THE END";
    }
    $("overlay-end").hidden = false;
    paintTitle();
  }

  function playerHit() {
    state.lives -= 1;
    renderHearts();
    audio.hurt();
    rumble(50);
    state.shake = 18;
    flash();
    stamp("THEY DREW");
    resetCam();
    if (state.lives <= 0) {
      audio.sting(false);
      state.mode = "end";
      if (state.score > state.best) {
        state.best = state.score;
        save();
        $("bestEl").textContent = fmt(state.best);
      }
      $("end-kicker").textContent = "DEAD IN THE DUST";
      $("end-name").textContent = "GAME OVER";
      $("end-stars").textContent = "";
      $("end-detail").textContent = "Score " + fmt(state.score) + ".";
      $("btn-next").hidden = true;
      $("overlay-end").hidden = false;
      paintTitle();
    } else {
      buildLevel(state.level);
      state.mode = "fight";
    }
  }

  function showBrief(i) {
    const L = GW.LEVELS[i];
    state.level = i;
    $("brief-chapter").textContent = L.chapter;
    $("brief-numeral").textContent = L.numeral;
    $("brief-name").textContent = L.name;
    $("brief-hint").textContent = L.hint;
    $("overlay-brief").hidden = false;
    $("overlay-title").hidden = true;
    $("overlay-end").hidden = true;
    state.mode = "brief";
  }

  function startFight() {
    $("overlay-brief").hidden = true;
    buildLevel(state.level);
    state.mode = "fight";
    stamp("AIM");
    audio.whistle();
  }

  function continueLevel() {
    if (state.unlocked >= GW.LEVELS.length) return 0;
    return Math.min(state.unlocked, GW.LEVELS.length - 1);
  }

  function paintTitle() {
    const start = $("btn-start");
    const neu = $("btn-new");
    const strip = $("star-strip");
    if (!start) return;
    const help = $("start-help");
    const newHelp = $("new-help");
    if (state.unlocked > 0) {
      const done = state.unlocked >= GW.LEVELS.length;
      start.textContent = done ? "PLAY FROM START" : "CONTINUE";
      if (help) {
        if (done) {
          help.textContent = "You finished the county. Play the first street again.";
        } else {
          const nxt = GW.LEVELS[continueLevel()];
          help.textContent = "Continue from " + nxt.numeral + " · " + nxt.name + ".";
        }
      }
      if (neu) neu.hidden = false;
      if (newHelp) newHelp.hidden = false;
    } else {
      start.textContent = "PLAY";
      if (help) help.textContent = "Hold the screen. Drag to aim. Let go to shoot.";
      if (neu) neu.hidden = true;
      if (newHelp) newHelp.hidden = true;
    }
    if (!strip) return;
    strip.innerHTML = "";
    GW.LEVELS.forEach((L, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "star-chip" + (i > state.unlocked ? " locked" : "");
      const r = state.stars[i] || 0;
      b.innerHTML = "<span>" + L.numeral + "</span><b>" + "★".repeat(r) + "☆".repeat(3 - r) + "</b>";
      b.disabled = i > state.unlocked;
      b.addEventListener("click", () => {
        if (i > state.unlocked) return;
        audio.unlock();
        state.lives = 3;
        state.score = 0;
        $("scoreEl").textContent = "0";
        renderHearts();
        showBrief(i);
      });
      strip.appendChild(b);
    });
  }

  function updateStreet(wdt) {
    for (const e of state.entities) {
      if (e.type === "pan" && e.swing) {
        e.phase += (Math.PI * 2 * wdt) / (e.period || 3);
        e.x = e.anchorX + Math.sin(e.phase) * e.swing;
        e.y = e.anchorY + Math.abs(Math.sin(e.phase)) * 8;
      }
      if (e.type !== "enemy" || e.dead) continue;
      if (e.pace && !e.hidden) {
        e.x += (e.paceDir || 1) * (e.paceSp || 24) * wdt;
        const lo = e.x0 != null ? e.x0 : e.homeX - 40;
        const hi = e.x1 != null ? e.x1 : e.homeX + 40;
        if (e.x > hi) {
          e.x = hi;
          e.paceDir = -1;
        } else if (e.x < lo) {
          e.x = lo;
          e.paceDir = 1;
        }
        e.homeX = e.x;
      }
      if (e.peek) {
        e.peekT += wdt;
        const open = 1.65;
        const hide = 1.15;
        const cycle = open + hide;
        const t = e.peekT % cycle;
        const wantHide = t > open;
        if (wantHide !== e.hidden) e.hidden = wantHide;
        if (e.hidden) {
          e.x += ((e.coverX != null ? e.coverX : e.homeX) - e.x) * Math.min(1, wdt * 6);
          e.y += ((e.coverY != null ? e.coverY : e.homeY + 40) - e.y) * Math.min(1, wdt * 6);
        } else {
          e.x += (e.homeX - e.x) * Math.min(1, wdt * 7);
          e.y += (e.homeY - e.y) * Math.min(1, wdt * 7);
        }
      }
    }
  }

  function updateCam(dt) {
    let tx = VW / 2;
    let ty = VH / 2;
    let tz = 1;
    let tr = 0;
    if (state.bullet) {
      const p = pointAt(state.bullet.pts, state.bullet.dist);
      tx = p.x;
      ty = p.y + 40;
      tz = 1.34;
      tr = state.cam.roll * 0.85;
    } else if (state.camHold > 0 && state.camFocus) {
      state.camHold -= dt;
      tx = state.camFocus.x;
      ty = state.camFocus.y - 90;
      tz = 1.42;
    }
    const k = Math.min(1, dt * (state.bullet ? 7 : 5));
    state.cam.x += (tx - state.cam.x) * k;
    state.cam.y += (ty - state.cam.y) * k;
    state.cam.z += (tz - state.cam.z) * k;
    state.cam.roll += (tr - state.cam.roll) * Math.min(1, dt * 4);
    state.cam.roll *= Math.pow(0.12, dt);
  }

  function update(dt) {
    if (state.hitstop > 0) {
      state.hitstop -= dt;
      dt *= 0.08;
    }

    let targetScale = 1;
    if (state.mode === "fight") {
      if (state.aiming) targetScale = 0.068;
      else if (state.bullet) targetScale = 0.16;
    }
    state.timeScale += (targetScale - state.timeScale) * Math.min(1, dt * 7);
    $("bt-veil").classList.toggle("on", state.timeScale < 0.55);
    audio.setTension(state.timeScale < 0.55 ? 1 : 0);

    const wdt = dt * state.timeScale;
    state.fightT += wdt;
    if (state.hintT > 0) {
      state.hintT -= dt;
      if (state.hintT <= 0) $("hint").classList.remove("show");
    }

    if (state.reloading > 0) {
      state.reloading -= dt;
      if (state.reloading <= 0) {
        state.ammo = 6;
        audio.click();
      }
    }

    if (state.ghost) {
      state.ghost.t -= dt;
      if (state.ghost.t <= 0) state.ghost = null;
    }

    state.shake *= Math.pow(0.04, dt);
    updateStreet(wdt);
    updateCam(dt);

    for (const e of state.entities) {
      e.spin += e.spinV * wdt;
      e.spinV *= Math.pow(0.18, wdt);
      if (e.hurt > 0) e.hurt -= dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.dead && e.fall < 1) e.fall = Math.min(1, e.fall + dt * 1.8);
    }

    const freeze = state.timeScale < 0.16;
    if (!freeze) {
      for (const m of state.motes) {
        m.y += m.v * wdt;
        if (m.y > VH) {
          m.y = -4;
          m.x = Math.random() * VW;
        }
      }
    }

    if (state.muzzleFlash > 0) state.muzzleFlash -= dt;

    for (let i = state.casings.length - 1; i >= 0; i--) {
      const c = state.casings[i];
      c.age += dt;
      c.vy += 780 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      if (c.y > 1248 && c.vy > 0) {
        c.y = 1248;
        c.vy *= -0.28;
        c.vx *= 0.6;
        c.vr *= 0.5;
      }
      if (c.age >= c.life) state.casings.splice(i, 1);
    }
    for (let i = state.smoke.length - 1; i >= 0; i--) {
      const s = state.smoke[i];
      s.age += freeze ? dt * 0.25 : dt;
      s.x += s.vx * wdt;
      s.y += s.vy * wdt;
      s.r += 18 * dt;
      if (s.age >= s.life) state.smoke.splice(i, 1);
    }
    for (let i = state.hats.length - 1; i >= 0; i--) {
      const h = state.hats[i];
      h.age += dt;
      h.vy += 620 * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.rot += h.vr * dt;
      if (h.y > 1240 && h.vy > 0) {
        h.y = 1240;
        h.vy *= -0.2;
        h.vx *= 0.5;
      }
      if (h.age >= h.life) state.hats.splice(i, 1);
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 280 * dt;
      if (p.age >= p.life) state.particles.splice(i, 1);
    }

    if (state.mode === "fight" && state.aiming && !state.bullet) {
      const tr = currentTrace();
      state.preview = tr;
      const lethal = tr.end && tr.end.body && tr.end.body.tag;
      const cue = $("hold-cue");
      cue.textContent = lethal ? (tr.bounces ? "BOUNCE WILL HIT" : "WILL HIT") : "DRAG TO AIM";
      cue.style.opacity = "0.9";
      state.heartT -= dt;
      if (state.heartT <= 0) {
        audio.heartbeat();
        state.heartT = 0.72;
      }
    }

    if (state.mode === "fight" && !state.bullet && $("overlay-how").hidden) {
      for (const e of living()) {
        if (e.hidden) continue;
        e.drawT += wdt;
        if (e.drawT >= e.drawMax) {
          playerHit();
          return;
        }
      }
    }

    if (state.bullet) {
      const b = state.bullet;
      const prev = b.dist;
      b.dist += 900 * dt;
      const now = pointAt(b.pts, b.dist);
      for (const ev of b.events) {
        if (ev.dist > prev && ev.dist <= b.dist + 0.01) {
          if (ev.kind === "bounce") {
            audio.ping(ev.bounce);
            rumble(12);
            burst(ev.hit.x, ev.hit.y, "#f4e0a8", 14, 260);
            state.shake = 6;
            state.cam.roll += ev.hit.nx > 0 ? 0.05 : -0.05;
            if (ev.hit.body && ev.hit.body.ent && ev.hit.body.ent.type === "pan") {
              ev.hit.body.ent.spinV += 10;
            }
          } else if (ev.kind === "kill") {
            const died = applyKill(ev.hit, b.bounces, b.kills);
            if (died) b.kills += 1;
          } else if (ev.kind === "absorb") {
            burst(ev.hit.x, ev.hit.y, "#c4a574", 10, 90);
          }
        }
      }
      if (b.dist >= b.total - 0.5) {
        const last = b.pts[b.pts.length - 1];
        if (b.kills === 0 && last.hit && last.hit.body && last.hit.body.tag) {
          applyKill(last.hit, b.bounces, 0);
        } else if (b.kills === 0) {
          stamp("DUST");
          state.ghost = { pts: b.pts, t: 1.05 };
        }
        state.bullet = null;
        if (living().length === 0) {
          setTimeout(sceneClear, 480);
        } else if (state.ammo <= 0) {
          startReload();
        }
      }
    }

    audio.tickTheme(dt, state.mode === "title");
  }

  function startReload() {
    if (state.reloading > 0 || state.ammo === 6) return;
    state.reloading = 1.15;
    state.aiming = false;
    audio.reload();
    rumble(10);
    stamp("RELOAD");
  }

  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.max(1, w * dpr);
    canvas.height = Math.max(1, h * dpr);
    if (sight) {
      sight.width = canvas.width;
      sight.height = canvas.height;
    }
    const scale = Math.min(w / VW, h / VH);
    state.view = {
      scale: scale * dpr,
      ox: (w * dpr - VW * scale * dpr) / 2,
      oy: (h * dpr - VH * scale * dpr) / 2,
      cssScale: scale,
      cssOx: (w - VW * scale) / 2,
      cssOy: (h - VH * scale) / 2,
    };
  }

  function clientToWorld(cx, cy) {
    const r = canvas.getBoundingClientRect();
    const x = (cx - r.left - state.view.cssOx) / state.view.cssScale;
    const y = (cy - r.top - state.view.cssOy) / state.view.cssScale;
    const c = state.cam;
    const z = c.z || 1;
    let lx = (x - VW / 2) / z;
    let ly = (y - VH / 2) / z;
    const cr = Math.cos(-c.roll);
    const sr = Math.sin(-c.roll);
    return { x: c.x + lx * cr - ly * sr, y: c.y + lx * sr + ly * cr };
  }

  function gunPivot() {
    return { x: 360, y: VH - 8 + (state.aiming ? 10 : 0) };
  }

  function barrelTip() {
    const p = gunPivot();
    const ang = Math.atan2(state.aim.y - p.y, state.aim.x - p.x);
    const tilt = (ang + Math.PI / 2) * 0.55 - (state.aiming ? 0.09 : 0);
    const len = 198;
    return { x: p.x + Math.sin(tilt) * len, y: p.y - Math.cos(tilt) * len };
  }

  function drawSprite(img, x, y, h, ang, flip) {
    if (!img) return false;
    const w = (img.width / img.height) * h;
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    if (ang) ctx.rotate(ang);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
    return true;
  }

  function drawFallbackEnemy(e) {
    const sc = 0.92 * (e.s || 1);
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.dead) ctx.rotate(e.fall * 1.25);
    ctx.fillStyle = e.species === "marshal" ? "#1a1412" : e.species === "sharp" ? "#2a2114" : "#5a4630";
    ctx.fillRect(-18 * sc, -150 * sc, 36 * sc, 110 * sc);
    ctx.fillStyle = "#1a120c";
    ctx.beginPath();
    ctx.ellipse(0, -168 * sc, 22 * sc, 7 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = e.species === "marshal" ? "#c9b48a" : "#d8b48a";
    ctx.beginPath();
    ctx.arc(0, -154 * sc, 14 * sc, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function applyWorldXform() {
    const v = state.view;
    const c = state.cam;
    ctx.setTransform(v.scale, 0, 0, v.scale, v.ox, v.oy);
    ctx.translate(VW / 2, VH / 2);
    ctx.rotate(c.roll);
    ctx.scale(c.z, c.z);
    ctx.translate(-c.x, -c.y);
    if (state.shake > 0.4) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
  }

  function drawWorld() {
    applyWorldXform();

    ctx.fillStyle = "#0b0705";
    ctx.fillRect(-80, -80, VW + 160, VH + 160);

    const L = GW.LEVELS[state.level] || GW.LEVELS[0];
    const farX = (state.cam.x - VW / 2) * 0.16;
    const farY = (state.cam.y - VH / 2) * 0.12;
    ctx.save();
    ctx.translate(farX, farY);
    const bg = images[L.bg];
    if (bg) ctx.drawImage(bg, -36, -36, VW + 72, VH + 72);
    else {
      const g = ctx.createLinearGradient(0, 0, 0, VH);
      g.addColorStop(0, "#6a3118");
      g.addColorStop(0.45, "#2a1a12");
      g.addColorStop(1, "#14100c");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VW, VH);
    }
    ctx.restore();
    drawSun(L.bg);

    for (const m of state.motes) {
      ctx.fillStyle = "rgba(232, 211, 170," + m.a + ")";
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const drawables = state.entities.slice().sort((a, b) => a.y - b.y);
    for (const e of drawables) drawShadowFor(e);
    for (const e of drawables) {
      if (e.type === "enemy") drawEnemy(e);
      else drawProp(e);
    }
    if (state.mode === "fight" && state.aiming) drawMetalGlow();
    drawCasings();
    drawHats();
    drawSmoke();
    drawParticles();
    if (!state.bullet && state.camHold <= 0) drawGun();
    drawEnemyMeters();
    drawNearGrit();
    drawGrade(L.bg);
    drawBullet();
    if (state.muzzleFlash > 0) drawMuzzleFlash();

    ctx.strokeStyle = "rgba(232, 195, 106, 0.12)";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, VW - 20, VH - 20);
  }

  function drawShadow(x, y, rx, ry, a) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0," + a + ")";
    ctx.beginPath();
    ctx.ellipse(x, y + 4, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawShadowFor(e) {
    if (e.type === "fence") return;
    const d = depthScale(e.y);
    if (e.type === "enemy") {
      if (e.dead) drawShadow(e.x, e.y + 8, 48 * d, 12 * d, 0.28);
      else drawShadow(e.x, e.y + 4, 28 * d, 9 * d, e.hidden ? 0.16 : 0.32);
    } else if (e.type === "pan") {
      drawShadow(e.x, e.y + 18 * d, 22 * d, 7 * d, 0.2);
    } else if (e.type === "barrel") {
      drawShadow(e.x, e.y + 28 * d, 36 * d, 12 * d, 0.3);
    } else if (e.type === "crate") {
      drawShadow(e.x, e.y + 26 * d, 40 * d, 13 * d, 0.3);
    } else if (e.type === "sign") {
      drawShadow(e.x, e.y + (e.h || 200) * 0.35, 16 * d, 6 * d, 0.18);
    }
  }

  function poseKey(e) {
    const s = e.species || "outlaw";
    if (e.dead) return s + "Dead";
    if (e.drawT / (e.drawMax || 1) > 0.55) return s + "Draw";
    return s;
  }

  function drawSun(bg) {
    const g = GRADES[bg];
    if (!g || !g.sun) return;
    const [sx, sy] = g.sun;
    const x = VW * sx;
    const y = VH * sy;
    const rad = ctx.createRadialGradient(x, y, 8, x, y, 280);
    rad.addColorStop(0, "rgba(255,230,160,0.55)");
    rad.addColorStop(0.35, "rgba(255,170,70,0.12)");
    rad.addColorStop(1, "rgba(255,160,60,0)");
    ctx.fillStyle = rad;
    ctx.fillRect(x - 280, y - 280, 560, 560);
  }

  function drawNearGrit() {
    const nx = (VW / 2 - state.cam.x) * 0.14;
    const ny = (VH / 2 - state.cam.y) * 0.1;
    ctx.save();
    ctx.translate(nx, ny);
    const g = ctx.createLinearGradient(0, VH * 0.9, 0, VH);
    g.addColorStop(0, "rgba(40,22,10,0)");
    g.addColorStop(1, "rgba(20,10,6,0.16)");
    ctx.fillStyle = g;
    ctx.fillRect(-40, VH * 0.9, VW + 80, VH * 0.14);
    ctx.restore();
  }

  function drawGrade(bg) {
    const g = GRADES[bg] || GRADES.street;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = g.shadowA;
    ctx.fillStyle = g.shadow;
    ctx.fillRect(-80, -80, VW + 160, VH + 160);
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = g.highA;
    ctx.fillStyle = g.high;
    ctx.fillRect(-80, -80, VW + 160, VH + 160);
    ctx.restore();

    if (state.timeScale < 0.55) {
      const beat = 0.16 + 0.1 * Math.sin(performance.now() / 360);
      const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.18, VW / 2, VH / 2, VH * 0.72);
      vg.addColorStop(0, "rgba(12, 28, 34, 0)");
      vg.addColorStop(1, "rgba(6, 14, 18," + (0.38 + beat) + ")");
      ctx.fillStyle = vg;
      ctx.fillRect(-80, -80, VW + 160, VH + 160);
      ctx.fillStyle = "rgba(180, 90, 30, 0.07)";
      ctx.fillRect(-80, -80, VW + 160, VH + 160);
    }
  }

  function drawCasings() {
    for (const c of state.casings) {
      const a = 1 - c.age / c.life;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = "#c4a050";
      ctx.fillRect(-3, -1.4, 7, 2.8);
      ctx.fillStyle = "#7a4a18";
      ctx.fillRect(-3, -1.4, 2, 2.8);
      ctx.restore();
    }
  }

  function drawHats() {
    for (const h of state.hats) {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.globalAlpha = Math.max(0, 1 - h.age / h.life);
      ctx.fillStyle = "#1a120c";
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-6, -6, 12, 6);
      ctx.restore();
    }
  }

  function drawSmoke() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of state.smoke) {
      const t = s.age / s.life;
      ctx.globalAlpha = (1 - t) * 0.22;
      ctx.fillStyle = "#d8c8a0";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMuzzleFlash() {
    const t = state.muzzleFlash / 0.1;
    const tip = barrelTip();
    const x = tip.x;
    const y = tip.y;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = t;
    ctx.fillStyle = "#fff6c8";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffb24a";
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 34, y + Math.sin(a) * 18);
      ctx.lineTo(x + Math.cos(a + 0.3) * 16, y + Math.sin(a + 0.3) * 10);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMetalGlow() {
    const pulse = 0.35 + 0.25 * Math.sin(performance.now() / 180);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const e of state.entities) {
      if (e.type !== "pan" && e.type !== "barrel" && e.type !== "sign") continue;
      ctx.strokeStyle = "rgba(232, 195, 106," + pulse + ")";
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (e.type === "sign") {
        const h = e.h || 200;
        ctx.strokeRect(e.x - 10, e.y - h * 0.5, 20, h);
      } else {
        ctx.arc(e.x, e.y, (e.type === "pan" ? 48 : 52) * e.s, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy(e) {
    const d = depthScale(e.y) * (e.s || 1);
    const key = poseKey(e);
    const img = images[key] || images[e.species] || images.outlaw;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.hurt > 0) ctx.translate((Math.random() - 0.5) * 6, 0);
    if (e.dead && images[e.species + "Dead"]) {
      const w = 190 * d;
      const h = (img.height / img.width) * w;
      ctx.globalAlpha = 1 - Math.min(0.25, e.fall * 0.2);
      ctx.drawImage(img, -w / 2, -h * 0.72, w, h);
    } else {
      const h = 236 * d * (e.hidden ? 0.9 : 1);
      const flip = e.x > 400;
      if (!drawSprite(img, 0, 0, h, e.dead ? e.fall * 1.2 : 0, flip)) {
        drawFallbackEnemy(Object.assign({}, e, { x: 0, y: 0 }));
      }
    }
    if (e.flash > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(255, 220, 160, 0.25)";
      ctx.fillRect(-70, -240 * d, 140, 240 * d);
    }
    ctx.restore();
  }

  function drawProp(e) {
    if (e.type === "fence") {
      const x0 = Math.min(e.x0, e.x1);
      const x1 = Math.max(e.x0, e.x1);
      const img = images.crate;
      const h = 70;
      for (let x = x0; x < x1; x += 58) {
        if (img) ctx.drawImage(img, x, e.y - h * 0.55, Math.min(62, x1 - x), h);
        else {
          ctx.fillStyle = "#5a3a1c";
          ctx.fillRect(x, e.y - 28, 54, 56);
        }
      }
      return;
    }
    const map = { pan: images.pan, barrel: images.barrel, crate: images.crate, sign: images.sign };
    const img = map[e.type];
    const d = depthScale(e.y);
    const h = (e.type === "pan" ? 92 * e.s : e.type === "sign" ? (e.h || 200) * 0.72 : 130 * e.s) * d;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.spin || 0);
    if (e.hurt > 0) ctx.translate((Math.random() - 0.5) * 3, 0);
    if (img) {
      const w = (img.width / img.height) * h;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = e.type === "pan" ? "#2a2a2a" : e.type === "sign" ? "#8a8a86" : "#6a4a28";
      ctx.beginPath();
      if (e.type === "pan") ctx.arc(0, 0, h * 0.38, 0, Math.PI * 2);
      else ctx.fillRect(-h * 0.4, -h * 0.5, h * 0.8, h);
      ctx.fill();
    }
    ctx.restore();
  }

  function splitByBounce(pts) {
    const segs = [[]];
    let b = 0;
    for (const p of pts) {
      if ((p.bounce || 0) !== b) {
        segs.push([]);
        b = p.bounce || 0;
        if (segs[segs.length - 2].length) segs[segs.length - 1].push(segs[segs.length - 2][segs[segs.length - 2].length - 1]);
      }
      segs[segs.length - 1].push(p);
    }
    return segs.filter((s) => s.length > 1);
  }

  function strokePoly(c, pts, alpha, bounced) {
    if (!pts || pts.length < 2) return;
    c.save();
    c.globalAlpha = alpha;
    c.lineCap = "round";
    c.lineJoin = "round";
    const trace = function () {
      c.beginPath();
      c.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    };
    trace();
    c.strokeStyle = bounced ? "rgba(255, 230, 140, 0.55)" : "rgba(255, 196, 70, 0.4)";
    c.lineWidth = bounced ? 13 : 11;
    c.setLineDash([]);
    c.stroke();
    trace();
    c.strokeStyle = bounced ? "#fff4b0" : "#ffe7a0";
    c.lineWidth = 4;
    c.setLineDash([11, 8]);
    c.stroke();
    c.setLineDash([]);
    c.restore();
  }

  function drawPath(c) {
    const trace = state.preview || currentTrace();
    if (!trace || !trace.path) return;
    const all = densify(trace.path, 12);
    if (all.length < 2) return;
    const tip = barrelTip();
    const pts = [{ x: tip.x, y: tip.y, bounce: 0 }].concat(all);
    const segs = splitByBounce(pts);
    for (let i = 0; i < segs.length; i++) strokePoly(c, segs[i], 1, i > 0);
    const last = pts[pts.length - 1];
    c.save();
    c.strokeStyle = "#fff6c4";
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(last.x - 10, last.y);
    c.lineTo(last.x + 10, last.y);
    c.moveTo(last.x, last.y - 10);
    c.lineTo(last.x, last.y + 10);
    c.stroke();
    c.restore();
    for (const p of pts) {
      if (p.hit && p.hit.material && P.MATERIALS[p.hit.material] && P.MATERIALS[p.hit.material].spark) {
        c.fillStyle = "#fff4c8";
        c.beginPath();
        c.arc(p.x, p.y, 6, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "rgba(255, 220, 120, 0.9)";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(p.x, p.y, 11, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }

  function drawSight() {
    if (!sctx || !sight) return;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, sight.width, sight.height);
    if (state.mode !== "fight") return;
    const v = state.view;
    const cam = state.cam;
    sctx.setTransform(v.scale, 0, 0, v.scale, v.ox, v.oy);
    sctx.translate(VW / 2, VH / 2);
    sctx.rotate(cam.roll);
    sctx.scale(cam.z, cam.z);
    sctx.translate(-cam.x, -cam.y);
    if (state.aiming) drawPath(sctx);
    if (state.ghost) strokePoly(sctx, state.ghost.pts, 0.35 * Math.max(0, state.ghost.t));
    if (state.aiming) {
      if (state.preview && state.preview.end && state.preview.end.body && state.preview.end.body.ent) {
        const t = state.preview.end.body.ent;
        if (t.type === "enemy" && !t.dead && !t.hidden) {
          sctx.save();
          sctx.strokeStyle = "rgba(255, 226, 140, 0.95)";
          sctx.lineWidth = 2.4;
          sctx.beginPath();
          sctx.arc(t.x, t.y - 110 * (t.s || 1), 52, 0, Math.PI * 2);
          sctx.stroke();
          sctx.restore();
        }
      }
    }
  }

  function drawLockRing() {
    if (
      state.mode !== "fight" ||
      !state.aiming ||
      !state.preview ||
      !state.preview.end ||
      !state.preview.end.body ||
      !state.preview.end.body.ent
    ) {
      return;
    }
    const t = state.preview.end.body.ent;
    if (t.type !== "enemy" || t.dead || t.hidden) return;
    ctx.save();
    ctx.strokeStyle = "rgba(232, 195, 106, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y - 110 * (t.s || 1), 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawGhost() {
    const a = Math.max(0, state.ghost.t);
    strokePoly(state.ghost.pts, 0.35 * a);
  }

  function drawFlightRibbon() {
    const b = state.bullet;
    const p = pointAt(b.pts, b.dist);
    ctx.save();
    ctx.strokeStyle = "rgba(255, 230, 160, 0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 10]);
    ctx.beginPath();
    ctx.moveTo(b.pts[0].x, b.pts[0].y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawBullet() {
    if (!state.bullet) return;
    const p = pointAt(state.bullet.pts, state.bullet.dist);
    const a = pointAt(state.bullet.pts, Math.max(0, state.bullet.dist - 86));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(255, 210, 120, 0.45)";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 246, 200, 0.85)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 70, 50, 0.55)";
    ctx.beginPath();
    ctx.arc(p.x + 1.7, p.y, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(60, 210, 255, 0.45)";
    ctx.beginPath();
    ctx.arc(p.x - 1.7, p.y, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6d0";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    for (const p of state.particles) {
      ctx.globalAlpha = 1 - p.age / p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawGun() {
    const ang = Math.atan2(state.aim.y - state.muzzle.y, state.aim.x - state.muzzle.x);
    const tilt = ang + Math.PI / 2;
    const cocked = state.aiming ? 1 : 0;
    const img = images.revolver;
    ctx.save();
    ctx.translate(state.muzzle.x, VH - 8 + cocked * 10);
    ctx.rotate(tilt * 0.55 - cocked * 0.09);
    if (img) {
      const h = 260;
      const w = (img.width / img.height) * h;
      ctx.drawImage(img, -w * 0.5, -h + 16, w, h);
    } else {
      ctx.fillStyle = "#2a2420";
      ctx.fillRect(-18, -160, 36, 150);
    }
    ctx.restore();
  }

  function drawEnemyMeters() {
    if (state.mode !== "fight") return;
    for (const e of living()) {
      if (e.hidden) continue;
      const t = Math.max(0, Math.min(1, e.drawT / e.drawMax));
      const x = e.x;
      const y = e.y - 210 * (e.s || 1);
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, 16, -Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();
      ctx.strokeStyle = t > 0.72 ? "#c43a2a" : "#e8c36a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawCylinder() {
    const w = cyl.width;
    const h = cyl.height;
    cctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    cctx.fillStyle = "rgba(16,10,7,0.55)";
    cctx.beginPath();
    cctx.arc(cx, cy, 78, 0, Math.PI * 2);
    cctx.fill();
    cctx.strokeStyle = "rgba(232,195,106,0.55)";
    cctx.lineWidth = 3;
    cctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * (Math.PI / 3);
      const x = cx + Math.cos(a) * 42;
      const y = cy + Math.sin(a) * 42;
      const live = i < state.ammo;
      cctx.beginPath();
      cctx.arc(x, y, 12, 0, Math.PI * 2);
      cctx.fillStyle = live ? "#e8c36a" : "#2a2118";
      cctx.fill();
      cctx.strokeStyle = live ? "#7a5a20" : "#1a140e";
      cctx.lineWidth = 2;
      cctx.stroke();
    }
    if (state.reloading > 0) {
      cctx.save();
      cctx.translate(cx, cy);
      cctx.rotate((1.15 - state.reloading) * 8);
      cctx.strokeStyle = "#e8c36a";
      cctx.beginPath();
      cctx.moveTo(0, -20);
      cctx.lineTo(0, 20);
      cctx.stroke();
      cctx.restore();
    }
  }

  function drawTitleBg() {
    const v = state.view;
    ctx.setTransform(v.scale, 0, 0, v.scale, v.ox, v.oy);
    const bg = images.street;
    if (bg) ctx.drawImage(bg, 0, 0, VW, VH);
    else {
      ctx.fillStyle = "#140c08";
      ctx.fillRect(0, 0, VW, VH);
    }
    ctx.fillStyle = "rgba(8,4,2,0.35)";
    ctx.fillRect(0, 0, VW, VH);
    for (const m of state.motes) {
      ctx.fillStyle = "rgba(232, 211, 170," + m.a + ")";
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop(then) {
    return function frame(now) {
      const dt = Math.min(0.033, (now - then) / 1000 || 0.016);
      update(dt);
      if (state.mode === "title" || state.mode === "brief" || state.mode === "how") {
        drawTitleBg();
        if (sctx && sight) {
          sctx.setTransform(1, 0, 0, 1, 0, 0);
          sctx.clearRect(0, 0, sight.width, sight.height);
        }
      } else {
        drawWorld();
        drawSight();
      }
      drawCylinder();
      requestAnimationFrame(loop(now));
    };
  }

  function onDown(ev) {
    if (state.mode !== "fight") return;
    if (ev.target.closest && ev.target.closest("#dock, #cylinder-wrap, .overlay, button, #star-strip")) return;
    ev.preventDefault();
    const t = ev.touches ? ev.touches[0] : ev;
    if (ev.pointerId != null && ev.target.setPointerCapture) {
      try {
        ev.target.setPointerCapture(ev.pointerId);
      } catch (err) {}
    }
    const w = clientToWorld(t.clientX, t.clientY);
    state.cam.x = VW / 2;
    state.cam.y = VH / 2;
    state.cam.z = 1;
    state.cam.roll = 0;
    state.aiming = true;
    state.aim.x = clamp(w.x, 20, 700);
    state.aim.y = clamp(w.y, 20, 1120);
    $("hold-cue").style.opacity = "0";
    $("hint").classList.remove("show");
    rumble(6);
  }

  function onMove(ev) {
    if (!state.aiming) return;
    ev.preventDefault();
    const t = ev.touches ? ev.touches[0] : ev;
    const w = clientToWorld(t.clientX, t.clientY);
    state.aim.x = clamp(w.x, 20, 700);
    state.aim.y = clamp(w.y, 20, 1120);
  }

  function onUp(ev) {
    if (!state.aiming) return;
    ev.preventDefault();
    fire();
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function beginRun(at) {
    audio.unlock();
    state.lives = 3;
    state.score = 0;
    $("scoreEl").textContent = "0";
    renderHearts();
    showBrief(at);
  }

  function bind() {
    const stage = $("stage");
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onUp);
    stage.addEventListener("contextmenu", (e) => e.preventDefault());

    $("btn-start").addEventListener("click", () => {
      const at = state.unlocked > 0 ? continueLevel() : 0;
      beginRun(at);
    });
    $("btn-new").addEventListener("click", () => beginRun(0));
    $("btn-brief").addEventListener("click", () => {
      audio.unlock();
      startFight();
    });
    $("btn-next").addEventListener("click", () => {
      $("overlay-end").hidden = true;
      if (state.lives <= 0) {
        $("overlay-title").hidden = false;
        state.mode = "title";
        paintTitle();
        return;
      }
      if (state.level >= GW.LEVELS.length - 1) {
        beginRun(0);
        return;
      }
      showBrief(state.level + 1);
    });
    $("btn-retry").addEventListener("click", () => {
      $("overlay-end").hidden = true;
      if (state.lives <= 0) {
        state.lives = 3;
        state.score = 0;
        renderHearts();
        $("scoreEl").textContent = "0";
        showBrief(state.level);
        return;
      }
      startFight();
    });
    function openHow() {
      audio.unlock();
      $("overlay-how").hidden = false;
    }
    $("btn-how").addEventListener("click", openHow);
    $("btn-how2").addEventListener("click", openHow);
    $("btn-how-close").addEventListener("click", () => {
      $("overlay-how").hidden = true;
    });
    $("btn-mute").addEventListener("click", () => {
      audio.unlock();
      state.muted = !state.muted;
      audio.setMuted(state.muted);
      $("btn-mute").textContent = state.muted ? "MUTED" : "SOUND";
    });
    $("cylinder-wrap").addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.mode === "fight") startReload();
    });
    window.addEventListener("resize", fit);
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && state.mode === "fight") {
        e.preventDefault();
        if (!state.aiming && !state.bullet) state.aiming = true;
      }
      if (e.code === "KeyR" && state.mode === "fight") startReload();
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space" && state.aiming) {
        e.preventDefault();
        fire();
      }
    });
  }

  function boot() {
    loadSave();
    spawnMotes();
    bind();
    fit();
    loadImages().then(() => {
      state.ready = true;
      if (images.player) $("portrait").src = IMG.player;
      const q = new URLSearchParams(location.search);
      if (q.has("play")) {
        audio.unlock();
        state.lives = 3;
        state.score = 0;
        const i = Math.max(0, Math.min(GW.LEVELS.length - 1, parseInt(q.get("play"), 10) || 0));
        showBrief(i);
        if (q.get("go") === "1") startFight();
      }
    });
    requestAnimationFrame(loop(performance.now()));
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  boot();
})();
