#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = { console, globalThis: {} };
vm.createContext(ctx);
ctx.globalThis = ctx;
vm.runInContext(fs.readFileSync(path.join(root, "js/physics.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js/levels.js"), "utf8"), ctx);
const P = ctx.GW.physics;

function bodiesFor(L) {
  const bodies = [
    { id: "floor", kind: "segment", ax: 8, ay: 1266, bx: 712, by: 1266, r: 6, material: "dirt" },
    { id: "left", kind: "segment", ax: 6, ay: 18, bx: 6, by: 1266, r: 6, material: "adobe" },
    { id: "right", kind: "segment", ax: 714, ay: 18, bx: 714, by: 1266, r: 6, material: "adobe" },
    { id: "sky", kind: "segment", ax: 6, ay: 14, bx: 714, by: 14, r: 6, material: "adobe" },
  ];
  L.entities.forEach((raw, i) => {
    const e = Object.assign({ s: 1, id: raw.type + i }, raw);
    if (e.type === "enemy") {
      const sc = 0.92 * (e.s || 1);
      bodies.push({ id: e.id, kind: "circle", x: e.x, y: e.y - 86 * sc, r: 32 * sc, material: "flesh", tag: "body" });
      bodies.push({ id: e.id + "-head", kind: "circle", x: e.x, y: e.y - 154 * sc, r: 17 * sc, material: "flesh", tag: "head" });
    } else if (e.type === "pan") {
      bodies.push({ id: e.id, kind: "circle", x: e.x, y: e.y, r: 44 * (e.s || 1), material: "pan" });
    } else if (e.type === "barrel") {
      bodies.push({ id: e.id, kind: "circle", x: e.x, y: e.y, r: 46 * e.s, material: "hoop" });
    } else if (e.type === "crate") {
      bodies.push({ id: e.id, kind: "circle", x: e.x, y: e.y, r: 54 * e.s, material: "wood" });
    } else if (e.type === "sign") {
      const h = e.h || 200;
      bodies.push({ id: e.id, kind: "segment", ax: e.x, ay: e.y - h * 0.5, bx: e.x, by: e.y + h * 0.5, r: 5, material: "metal" });
    } else if (e.type === "fence") {
      bodies.push({ id: e.id, kind: "segment", ax: e.x0, ay: e.y, bx: e.x1, by: e.y, r: e.r || 10, material: "wood" });
    }
  });
  return bodies;
}

const origin = { x: 360, y: 1172 };
let failed = 0;
for (const L of ctx.GW.LEVELS) {
  const bodies = bodiesFor(L);
  const uniq = new Set();
  let bank = 0;
  for (let x = 40; x < 680; x += 12) {
    for (let y = 80; y < 1100; y += 14) {
      const tr = P.traceShot(origin, { x: x - origin.x, y: y - origin.y }, bodies, {
        speed: 1760,
        radius: 4,
        maxBounces: 6,
        muzzle: 22,
      });
      if (tr.end && tr.end.body && (tr.end.body.tag === "body" || tr.end.body.tag === "head")) {
        uniq.add(tr.end.body.id.replace("-head", ""));
        if (tr.bounces >= 1) bank += 1;
      }
    }
  }
  const need = L.entities.filter((e) => e.type === "enemy").length;
  const wantsBank = L.entities.some((e) => e.type === "pan" || e.type === "barrel" || e.type === "sign");
  const ok = uniq.size === need && (!wantsBank || bank > 0);
  console.log((ok ? "ok  " : "FAIL"), L.id, "reachable", uniq.size + "/" + need, "bank", bank);
  if (!ok) failed += 1;
}
if (failed) {
  console.error(failed + " unsolvable scenes");
  process.exit(1);
}
console.log("all scenes solvable");
