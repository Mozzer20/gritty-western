/**
 * "Can every man in this scene actually be shot?" Used by the level tests and
 * by the Daily Showdown generator, so no level ships unwinnable.
 *
 * Deliberately strict: hitboxes are smaller than the game's, and only aim
 * directions the gun really allows (game.js aimDir clamps dy to ≤ −160).
 */
(function (root) {
  const GW = (root.GW = root.GW || {});
  const ORIGIN = { x: 360, y: 1172 };
  const MIN_UP = -160;

  function bodiesFor(entities) {
    const bodies = [
      { id: "floor", kind: "segment", ax: 8, ay: 1266, bx: 712, by: 1266, r: 6, material: "dirt" },
      { id: "left", kind: "segment", ax: 6, ay: 18, bx: 6, by: 1266, r: 6, material: "adobe" },
      { id: "right", kind: "segment", ax: 714, ay: 18, bx: 714, by: 1266, r: 6, material: "adobe" },
      { id: "sky", kind: "segment", ax: 6, ay: 14, bx: 714, by: 14, r: 6, material: "adobe" },
    ];
    entities.forEach((raw, i) => {
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

  /**
   * Sweeps the aim across the screen. Returns which enemies can be hit, and
   * how many hitting shots used at least one bounce.
   * `step` trades accuracy for speed (the daily generator uses a coarser one).
   */
  function reach(entities, step) {
    const P = GW.physics;
    const sx = (step && step.x) || 12;
    const sy = (step && step.y) || 14;
    const bodies = bodiesFor(entities);
    const hit = new Set();
    let bank = 0;
    for (let x = 40; x < 680; x += sx) {
      for (let y = 80; y < 1100; y += sy) {
        const dy = y - ORIGIN.y;
        if (dy > MIN_UP) continue;
        const tr = P.traceShot(ORIGIN, { x: x - ORIGIN.x, y: dy }, bodies, {
          speed: 1760,
          radius: 4,
          maxBounces: 6,
          muzzle: 22,
        });
        if (tr.end && tr.end.body && (tr.end.body.tag === "body" || tr.end.body.tag === "head")) {
          hit.add(tr.end.body.id.replace("-head", ""));
          if (tr.bounces >= 1) bank += 1;
        }
      }
    }
    const need = entities.filter((e) => e.type === "enemy").length;
    const wantsBank = entities.some((e) => e.type === "pan" || e.type === "barrel" || e.type === "sign");
    return { reachable: hit.size, need, bank, ok: hit.size === need && (!wantsBank || bank > 0) };
  }

  GW.sceneCheck = { bodiesFor, reach, ORIGIN };
})(typeof window !== "undefined" ? window : globalThis);
