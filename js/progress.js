/**
 * Things to earn: gun finishes unlocked by stars, and Wanted Posters
 * (achievements) earned from lifetime stats. Pure data + checks so the
 * tests can run them without a browser.
 */
(function (root) {
  const GW = (root.GW = root.GW || {});

  /** Canvas filters for each finish live in game.js drawGun. */
  const FINISHES = [
    { id: "blued", name: "Blued", stars: 0 },
    { id: "silver", name: "Silver", stars: 6 },
    { id: "gold", name: "Gold", stars: 15 },
    { id: "charred", name: "Charred", stars: 24 },
    { id: "rose", name: "Rose Gold", stars: 36 },
    { id: "jade", name: "Jade", stars: 48 },
    { id: "midnight", name: "Midnight", stars: 60 },
    { id: "bloodred", name: "Devil Red", stars: 75 },
    { id: "legend", name: "Legend", stars: 90 },
  ];

  function totalStars(stars) {
    return (stars || []).reduce((s, v) => s + (v || 0), 0);
  }

  function finishUnlocked(id, stars) {
    const f = FINISHES.find((x) => x.id === id);
    return !!f && totalStars(stars) >= f.stars;
  }

  /** Finishes that a jump from `before` to `after` stars just unlocked. */
  function newlyUnlockedFinishes(before, after) {
    return FINISHES.filter((f) => f.stars > before && f.stars <= after);
  }

  const POSTERS = [
    { id: "first-blood", name: "First Draw", desc: "Win your first street", stat: "levelsCleared", goal: 1 },
    { id: "bank-shot", name: "Bank Robber", desc: "Hit a man with a bounced bullet", stat: "bankKills", goal: 1 },
    { id: "bank-50", name: "Ricochet Rider", desc: "50 bounced hits", stat: "bankKills", goal: 50 },
    { id: "head", name: "Hat Trick", desc: "10 hits to the hat", stat: "headKills", goal: 10 },
    { id: "double", name: "Two for One", desc: "Hit two men with one bullet", stat: "doubles", goal: 1 },
    { id: "double-25", name: "Bullet Train", desc: "25 two-for-ones", stat: "doubles", goal: 25 },
    { id: "perfect", name: "Dead Eye", desc: "Get three stars on a street", stat: "threeStarClears", goal: 1 },
    { id: "kills-100", name: "Hundred Hats", desc: "Win 100 duels", stat: "kills", goal: 100 },
    { id: "weeds", name: "Weed Whacker", desc: "Shoot 10 tumbleweeds", stat: "tumbleweeds", goal: 10 },
    { id: "chapter-2", name: "Dry Well", desc: "Reach street VI", stat: "furthest", goal: 6 },
    { id: "chapter-5", name: "Silver Creek", desc: "Reach street XVII", stat: "furthest", goal: 17 },
    { id: "all-streets", name: "Devil's Noon", desc: "Win all 30 streets", stat: "furthest", goal: 30 },
    { id: "stars-45", name: "Sheriff", desc: "Earn 45 stars", stat: "totalStars", goal: 45 },
    { id: "stars-90", name: "Legend of Red Dust", desc: "Earn all 90 stars", stat: "totalStars", goal: 90 },
    { id: "bounty-10", name: "Wave Ten", desc: "Survive 10 Bounty Hunt waves", stat: "bestWave", goal: 10 },
    { id: "daily-3", name: "Regular", desc: "Win the Daily Showdown 3 days running", stat: "bestDailyStreak", goal: 3 },
  ];

  /** ids of posters earned by these stats that aren't in `have` yet. */
  function newPosters(stats, have) {
    const owned = new Set(have || []);
    return POSTERS.filter((p) => !owned.has(p.id) && (stats[p.stat] || 0) >= p.goal);
  }

  function posterProgress(p, stats) {
    return Math.min(1, (stats[p.stat] || 0) / p.goal);
  }

  GW.progress = { FINISHES, POSTERS, totalStars, finishUnlocked, newlyUnlockedFinishes, newPosters, posterProgress };
})(typeof window !== "undefined" ? window : globalThis);
