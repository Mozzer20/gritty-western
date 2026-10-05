"use strict";
// Daily Showdown: same street for everyone on a date, always winnable, streaks count properly.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const ctx = { console, globalThis: {} };
vm.createContext(ctx);
ctx.globalThis = ctx;
for (const f of ["js/physics.js", "js/levels.js", "js/scenecheck.js", "js/daily.js", "js/progress.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
}
const { daily, sceneCheck, progress } = ctx.GW;

describe("Daily Showdown", () => {
  it("gives the same street for the same date and a different one tomorrow", () => {
    const a = daily.dailyLevel("2026-10-05");
    const b = daily.dailyLevel("2026-10-05");
    const c = daily.dailyLevel("2026-10-06");
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    assert.notEqual(JSON.stringify(a.entities), JSON.stringify(c.entities));
  });

  it("every day for two months is winnable with the full check", () => {
    const d = new Date("2026-10-01T12:00:00");
    for (let i = 0; i < 60; i += 1) {
      const L = daily.dailyLevel(daily.dateKey(d));
      const r = sceneCheck.reach(L.entities);
      assert.ok(r.reachable === r.need, `${L.dateKey} ${L.name}: ${r.reachable}/${r.need}`);
      assert.ok(r.need >= 2 && r.need <= 4);
      d.setDate(d.getDate() + 1);
    }
  });

  it("streaks: yesterday continues, a gap restarts, same day keeps", () => {
    assert.equal(daily.nextStreak("2026-10-04", 3, "2026-10-05"), 4);
    assert.equal(daily.nextStreak("2026-10-02", 3, "2026-10-05"), 1);
    assert.equal(daily.nextStreak("2026-10-05", 4, "2026-10-05"), 4);
    assert.equal(daily.nextStreak(null, 0, "2026-10-05"), 1);
    assert.equal(daily.nextStreak("2026-12-31", 7, "2027-01-01"), 8);
  });
});

describe("Finishes and Wanted Posters", () => {
  it("finishes unlock at their star counts, the last needs all 90", () => {
    assert.equal(progress.finishUnlocked("blued", []), true);
    assert.equal(progress.finishUnlocked("gold", Array(5).fill(3)), true);
    assert.equal(progress.finishUnlocked("gold", Array(4).fill(3)), false);
    assert.equal(progress.FINISHES.at(-1).stars, ctx.GW.LEVELS.length * 3);
    assert.deepEqual([...progress.newlyUnlockedFinishes(5, 16).map((f) => f.id)], ["silver", "gold"]);
  });

  it("posters are earned once their stat reaches the goal", () => {
    // spread: arrays from the vm sandbox have a different prototype
    const got = [...progress.newPosters({ levelsCleared: 1, bankKills: 1, kills: 3 }, []).map((p) => p.id)];
    assert.deepEqual(got, ["first-blood", "bank-shot"]);
    assert.equal(progress.newPosters({ levelsCleared: 1 }, ["first-blood"]).length, 0);
  });

  it("every poster has a unique id", () => {
    const ids = progress.POSTERS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
