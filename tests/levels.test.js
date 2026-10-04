#!/usr/bin/env node
"use strict";
// Every campaign street must be winnable: each man reachable by a shot the
// gun can really fire, and banking possible where there's metal to bank off.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = { console, globalThis: {} };
vm.createContext(ctx);
ctx.globalThis = ctx;
for (const f of ["js/physics.js", "js/levels.js", "js/scenecheck.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
}
const { reach } = ctx.GW.sceneCheck;

let failed = 0;
const ids = new Set();
for (const L of ctx.GW.LEVELS) {
  const r = reach(L.entities);
  const problems = [];
  if (!r.ok) problems.push("reachable " + r.reachable + "/" + r.need + " bank " + r.bank);
  if (ids.has(L.id)) problems.push("duplicate id");
  ids.add(L.id);
  if (!L.name || !L.hint || !L.chapter || !L.numeral || !L.bg) problems.push("missing text");
  if (!(L.par >= 1)) problems.push("par");
  console.log(problems.length ? "FAIL" : "ok  ", L.numeral.padEnd(6), L.id, problems.join("; ") || "reachable " + r.reachable + "/" + r.need + ", bank " + r.bank);
  if (problems.length) failed += 1;
}
if (failed) {
  console.error(failed + " unsolvable or broken scenes");
  process.exit(1);
}
console.log("all " + ctx.GW.LEVELS.length + " scenes solvable");
