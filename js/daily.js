/**
 * Daily Showdown: one new street per day, the same for everyone on that date.
 * Built from the date as a seed, then checked with GW.sceneCheck so it can
 * always be won.
 */
(function (root) {
  const GW = (root.GW = root.GW || {});

  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Small, fast seeded random (mulberry32). */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dateKey(d) {
    const x = d || new Date();
    const m = String(x.getMonth() + 1).padStart(2, "0");
    const day = String(x.getDate()).padStart(2, "0");
    return x.getFullYear() + "-" + m + "-" + day;
  }

  /** Prop layouts known to leave open lanes; enemies are placed on top. */
  const LAYOUTS = [
    [{ type: "pan", x: 120, y: 620, s: 1.05, swing: 36, period: 3.2 }, { type: "barrel", x: 600, y: 660, s: 1 }],
    [{ type: "fence", x0: 260, x1: 460, y: 790 }, { type: "sign", x: 90, y: 570, h: 220 }, { type: "sign", x: 630, y: 570, h: 220 }],
    [{ type: "crate", x: 200, y: 800, s: 0.95 }, { type: "crate", x: 520, y: 800, s: 0.95 }, { type: "pan", x: 360, y: 620, s: 1, swing: 48, period: 2.8 }],
    [{ type: "fence", x0: 220, x1: 500, y: 780 }, { type: "barrel", x: 80, y: 700, s: 1 }, { type: "barrel", x: 640, y: 700, s: 1 }],
    [{ type: "sign", x: 620, y: 600, h: 220 }, { type: "pan", x: 110, y: 600, s: 1, swing: 40, period: 3.0 }, { type: "crate", x: 360, y: 820, s: 0.9 }],
    [{ type: "pan", x: 130, y: 640, s: 1 }, { type: "pan", x: 590, y: 640, s: 1 }, { type: "fence", x0: 300, x1: 420, y: 800 }],
  ];
  const BGS = ["street", "saloon", "canyon", "depot", "gallows"];
  const NAMES = [
    "DUST DEVIL", "RATTLER'S REST", "COPPER GULCH", "SNAKE OIL", "WIDOW'S PEAK", "LAST CHANCE",
    "SIDEWINDER", "BUZZARD BLUFF", "LONESOME PINE", "TUMBLE CREEK", "BRIMSTONE", "HANGMAN'S HILL",
  ];
  const SLOTS = [
    { x: 190, y: 410 }, { x: 290, y: 370 }, { x: 360, y: 330 }, { x: 430, y: 370 }, { x: 530, y: 410 },
    { x: 240, y: 440 }, { x: 480, y: 440 },
  ];

  function attempt(r) {
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const props = pick(LAYOUTS).map((p) => Object.assign({}, p));
    const count = 2 + Math.floor(r() * 3); // 2–4 men
    const slots = SLOTS.slice();
    const enemies = [];
    for (let i = 0; i < count; i += 1) {
      const slot = slots.splice(Math.floor(r() * slots.length), 1)[0];
      const roll = r();
      const species = roll < 0.15 ? "marshal" : roll < 0.5 ? "sharp" : "outlaw";
      const e = { type: "enemy", x: slot.x, y: slot.y, species, draw: +(6.4 + r() * 1.4).toFixed(1) };
      if (species === "marshal") {
        e.hp = 2;
        e.draw = +(e.draw + 0.8).toFixed(1);
      }
      if (r() < 0.25) {
        e.pace = true;
        e.x0 = Math.max(150, slot.x - 60);
        e.x1 = Math.min(570, slot.x + 60);
        e.paceSp = 22 + Math.floor(r() * 10);
      }
      enemies.push(e);
    }
    return { props, enemies, bg: pick(BGS), name: pick(NAMES) };
  }

  /**
   * The street for a date. `check` (GW.sceneCheck.reach) is injectable for
   * tests; without it the first attempt is used.
   */
  function dailyLevel(key, check) {
    const k = key || dateKey();
    const r = rng(hashString("bjango-daily-" + k));
    const reach = check || (GW.sceneCheck && GW.sceneCheck.reach);
    let chosen = null;
    for (let i = 0; i < 40 && !chosen; i += 1) {
      const a = attempt(r);
      const entities = a.props.concat(a.enemies);
      if (!reach || reach(entities, { x: 20, y: 22 }).ok) chosen = Object.assign(a, { entities });
    }
    if (!chosen) {
      // Always-winnable fallback: open street, two men, one pan
      const entities = [
        { type: "pan", x: 120, y: 620, s: 1.05 },
        { type: "enemy", x: 290, y: 400, species: "outlaw", draw: 7.4 },
        { type: "enemy", x: 450, y: 400, species: "sharp", draw: 7.0 },
      ];
      chosen = { bg: "street", name: "QUIET STREET", entities, enemies: entities.slice(1) };
    }
    const men = chosen.entities.filter((e) => e.type === "enemy").length;
    return {
      id: "daily-" + k,
      daily: true,
      dateKey: k,
      chapter: "DAILY SHOWDOWN",
      numeral: "★",
      name: chosen.name,
      bg: chosen.bg,
      hint: "Today's street — the same for everyone. " + men + " men. One bullet for all of them gets three stars.",
      par: men,
      preview: "full",
      entities: chosen.entities,
    };
  }

  /** Streak after winning on `today`, given the last win's date key. */
  function nextStreak(lastKey, streak, today) {
    if (lastKey === today) return streak || 1;
    const d = new Date(today + "T12:00:00");
    d.setDate(d.getDate() - 1);
    return lastKey === dateKey(d) ? (streak || 0) + 1 : 1;
  }

  GW.daily = { dailyLevel, dateKey, nextStreak, hashString, rng };
})(typeof window !== "undefined" ? window : globalThis);
