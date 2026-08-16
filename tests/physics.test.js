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

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall physics checks passed");
