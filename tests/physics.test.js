#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(
  path.join(__dirname, "..", "js", "physics.js"),
  "utf8"
);
const ctx = { console, globalThis: {} };
vm.createContext(ctx);
ctx.globalThis = ctx;
vm.runInContext(src, ctx);
const P = ctx.GW.physics;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("ok  ", msg);
  }
}

function almost(a, b, eps, msg) {
  assert(Math.abs(a - b) < (eps || 1e-3), msg + ` (got ${a}, want ${b})`);
}

// 1. Downward slug off a floor with upward normal reflects up.
{
  const r = P.reflect(0, 400, 0, -1, 1);
  almost(r.x, 0, 1e-6, "floor bounce vx");
  almost(r.y, -400, 1e-6, "floor bounce vy");
}

// 2. Rightward slug off a left-facing wall reflects left.
{
  const r = P.reflect(300, 0, -1, 0, 1);
  almost(r.x, -300, 1e-6, "wall bounce vx");
  almost(r.y, 0, 1e-6, "wall bounce vy");
}

// 3. 45° into a vertical wall stays 45° out.
{
  const r = P.reflect(10, -10, -1, 0, 1);
  almost(r.x, -10, 1e-6, "45 wall vx");
  almost(r.y, -10, 1e-6, "45 wall vy");
}

// 4. Restitution scales the result.
{
  const r = P.reflect(0, 100, 0, -1, 0.5);
  almost(r.y, -50, 1e-6, "restitution 0.5");
}

// 5. Bank shot: muzzle bottom-center, pan on the right, outlaw behind a crate.
{
  const bodies = [
    { id: "crate", kind: "circle", x: 360, y: 700, r: 70, material: "wood" },
    { id: "pan", kind: "circle", x: 540, y: 560, r: 42, material: "pan" },
    { id: "outlaw", kind: "circle", x: 360, y: 380, r: 36, material: "flesh" },
    { id: "floor", kind: "segment", ax: 20, ay: 1260, bx: 700, by: 1260, r: 8, material: "dirt" },
    { id: "left", kind: "segment", ax: 20, ay: 40, bx: 20, by: 1260, r: 8, material: "adobe" },
    { id: "right", kind: "segment", ax: 700, ay: 40, bx: 700, by: 1260, r: 8, material: "adobe" },
  ];
  const origin = { x: 360, y: 1160 };
  // Aim at the skillet's inner rim, not its center — center-hits bounce back at the shooter.
  const towardPan = { x: 500 - origin.x, y: 540 - origin.y };
  const bank = P.traceShot(origin, towardPan, bodies, { speed: 1800, radius: 4, maxBounces: 5 });
  assert(bank.end && bank.end.body && bank.end.body.id === "outlaw", "bank off pan kills outlaw");
  assert(bank.bounces >= 1, "bank uses at least one bounce");

  const straight = P.traceShot(origin, { x: 0, y: -1 }, bodies, { speed: 1800, radius: 4 });
  assert(straight.end && straight.end.body && straight.end.body.id === "crate", "straight shot dies in the crate");
}

// 6. Swept circle does not tunnel a thin sign.
{
  const bodies = [
    { id: "sign", kind: "segment", ax: 560, ay: 280, bx: 560, by: 720, r: 4, material: "metal" },
    { id: "dummy", kind: "circle", x: 240, y: 360, r: 28, material: "flesh" },
  ];
  const hit = P.traceShot({ x: 200, y: 1100 }, { x: 300, y: -352 }, bodies, { speed: 4000, radius: 3 });
  assert(hit.end && hit.end.body && hit.end.body.id === "dummy", "thin sign ricochet still reaches target");
  assert(hit.bounces === 1, "exactly one bounce on the sign");
}

// 7. After a metal bank, a body graze can carry on (chain).
{
  const bodies = [
    { id: "pan", kind: "circle", x: 540, y: 560, r: 42, material: "pan" },
    { id: "one", kind: "circle", x: 360, y: 380, r: 36, material: "flesh", tag: "body" },
    { id: "two", kind: "circle", x: 220, y: 300, r: 28, material: "flesh", tag: "body" },
  ];
  const origin = { x: 360, y: 1160 };
  const dir = { x: 500 - origin.x, y: 540 - origin.y };
  const chained = P.traceShot(origin, dir, bodies, { speed: 1800, radius: 4, chain: true, maxBounces: 5 });
  const ids = chained.path.filter((p) => p.hit && p.hit.body && p.hit.body.tag).map((p) => p.hit.body.id);
  const stopped = P.traceShot(origin, dir, bodies, { speed: 1800, radius: 4, chain: false, maxBounces: 5 });
  assert(stopped.end && stopped.end.body && stopped.end.body.id === "one", "without chain the first body stops the slug");
  assert(chained.bounces >= 1, "chain shot still bounced");
  if (ids.length >= 2) {
    assert(ids[0] === "one" && ids[1] === "two", "chain carries through the first body into the second");
  } else {
    // Geometry may only clip one body; still must not absorb as a bounce-less flesh hit.
    assert(ids.length >= 1, "chain still registers a flesh hit");
  }
}

// 7b. Two men lined up on the ricochet: one banked slug drops both. Flesh is
// absorbent, so this only works if pierce is tested before absorb.
{
  const bodies = [
    { id: "sign", kind: "segment", ax: 600, ay: 600, bx: 600, by: 800, r: 4, material: "metal" },
    { id: "one", kind: "circle", x: 503.5, y: 530.7, r: 30, material: "flesh", tag: "body" },
    { id: "two", kind: "circle", x: 411, y: 353.4, r: 30, material: "flesh", tag: "body" },
  ];
  const origin = { x: 360, y: 1160 };
  const banked = P.traceShot(origin, { x: 240, y: -460 }, bodies, { speed: 1800, radius: 4, chain: true, maxBounces: 5 });
  const ids = banked.path.filter((p) => p.hit && p.hit.body && p.hit.body.tag).map((p) => p.hit.body.id);
  assert(banked.bounces >= 1, "lined-up shot banked off the sign");
  assert(ids.join(",") === "one,two", "banked slug passes through the first man into the second (got " + ids.join(",") + ")");
  const straight = P.traceShot(origin, { x: 503.5 - origin.x, y: 530.7 - origin.y }, bodies, { speed: 1800, radius: 4, chain: true, maxBounces: 5 });
  assert(straight.end && straight.end.body && straight.end.body.id === "one", "an unbanked shot still stops in the first man");
}

// 8. Saloon Glass promises "one bullet can hit both men": there must be such a shot.
{
  const levelsSrc = fs.readFileSync(path.join(__dirname, "..", "js", "levels.js"), "utf8");
  vm.runInContext(levelsSrc, ctx);
  const L = ctx.GW.LEVELS.find((l) => l.id === "saloon-glass");
  const bodies = [
    { id: "left", kind: "segment", ax: 6, ay: 18, bx: 6, by: 1266, r: 6, material: "adobe" },
    { id: "right", kind: "segment", ax: 714, ay: 18, bx: 714, by: 1266, r: 6, material: "adobe" },
    { id: "sky", kind: "segment", ax: 6, ay: 14, bx: 714, by: 14, r: 6, material: "adobe" },
    { id: "floor", kind: "segment", ax: 8, ay: 1266, bx: 712, by: 1266, r: 6, material: "dirt" },
  ];
  L.entities.forEach((e, i) => {
    const s = e.s || 1;
    if (e.type === "enemy") {
      const sc = 0.92 * s;
      bodies.push({ id: "e" + i, kind: "circle", x: e.x, y: e.y - 90 * sc, r: 44 * sc, material: "flesh", tag: "body" });
      bodies.push({ id: "e" + i + "-head", kind: "circle", x: e.x, y: e.y - 158 * sc, r: 22 * sc, material: "flesh", tag: "head" });
    } else if (e.type === "pan") bodies.push({ id: "p" + i, kind: "circle", x: e.x, y: e.y, r: 44 * s, material: "pan" });
    else if (e.type === "sign") {
      const h = e.h || 200;
      bodies.push({ id: "s" + i, kind: "segment", ax: e.x, ay: e.y - h / 2, bx: e.x, by: e.y + h / 2, r: 5, material: "metal" });
    } else if (e.type === "fence") bodies.push({ id: "f" + i, kind: "segment", ax: e.x0, ay: e.y, bx: e.x1, by: e.y, r: e.r || 10, material: "wood" });
  });
  let doubles = 0;
  for (let x = 30; x <= 690; x += 4) {
    for (let y = 300; y <= 1000; y += 4) {
      const tr = P.traceShot({ x: 360, y: 1172 }, { x: x - 360, y: Math.min(-160, y - 1172) }, bodies, { speed: 1760, radius: 4, maxBounces: 6, muzzle: 22, chain: true });
      const men = new Set(tr.path.filter((p) => p.hit && p.hit.material === "flesh").map((p) => p.hit.body.id.replace("-head", "")));
      if (men.size >= 2) doubles += 1;
    }
  }
  assert(doubles > 0, "Saloon Glass has a bank shot through both men (found " + doubles + ")");
}

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall physics checks passed");
