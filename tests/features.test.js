#!/usr/bin/env node
"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "css", "game.css"), "utf8");
const audioSrc = fs.readFileSync(path.join(__dirname, "..", "js", "audio.js"), "utf8");
const physicsSrc = fs.readFileSync(path.join(__dirname, "..", "js", "physics.js"), "utf8");
const gameSrc = fs.readFileSync(path.join(__dirname, "..", "js", "game.js"), "utf8");
const swSrc = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");

describe("1. Spatial Audio & New Sound FX", () => {
  it("defines stereo panning in audio engine", () => {
    assert.match(audioSrc, /_out\(near,\s*panX\)/);
    assert.match(audioSrc, /createStereoPanner/);
    assert.match(audioSrc, /panX\s*==\s*null/);
  });

  it("provides synthesized sound effects for tumbleweeds, lanterns, ricochet whiz, hat pop plink, and deadeye", () => {
    assert.match(audioSrc, /tumbleweedCrunch/);
    assert.match(audioSrc, /lanternShatter/);
    assert.match(audioSrc, /whiz/);
    assert.match(audioSrc, /hatPopPlink/);
    assert.match(audioSrc, /deadeyeWhoosh/);
    assert.match(audioSrc, /bountyStinger/);
  });
});

describe("2. Tumbleweeds & Destructibles Physics", () => {
  it("simulates physics-based rolling tumbleweeds", () => {
    assert.match(gameSrc, /updateTumbleweeds/);
    assert.match(gameSrc, /checkBulletTumbleweeds/);
    assert.match(gameSrc, /drawTumbleweeds/);
  });

  it("loads realistic tumbleweed sprite asset and precaches it in service worker", () => {
    assert.match(gameSrc, /tumbleweed:\s*"assets\/props\/tumbleweed\.webp"/);
    assert.match(swSrc, /assets\/props\/tumbleweed\.webp/);
    assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", "props", "tumbleweed.webp")));
  });

  it("integrates tumbleweeds into physics engine and aiming reticle lock-on", () => {
    assert.match(physicsSrc, /tumbleweed:\s*\{[^}]*crunch:\s*true/);
    assert.match(gameSrc, /material:\s*"tumbleweed"/);
    assert.match(gameSrc, /drawLockRing/);
    assert.match(gameSrc, /sctx\.arc\(tw\.x,\s*tw\.y/);
  });

  it("awards trick score and plays crunch SFX when shooting a tumbleweed", () => {
    assert.match(gameSrc, /TUMBLEWEED SNIPER \+100/);
    assert.match(gameSrc, /audio\.tumbleweedCrunch/);
  });
});

describe("3. Cinematic Bullet Kill-Cam & Deadeye Slow-Mo", () => {
  it("triggers kill-cam slow motion on final lethal shot of a scene", () => {
    assert.match(gameSrc, /state\.killCam/);
    assert.match(gameSrc, /audio\.deadeyeWhoosh/);
    assert.match(gameSrc, /killcam/);
    assert.match(css, /#bt-veil\.killcam/);
  });
});

describe("4. Western Combat Combo Banners", () => {
  it("supports combo style names for multi-bounce, skillet, barrel, and deadeye shots", () => {
    assert.match(gameSrc, /TRIPLE RICOCHET!/);
    assert.match(gameSrc, /DOUBLE BANK!/);
    assert.match(gameSrc, /SKILLET SLAM!/);
    assert.match(gameSrc, /BARREL BOUNCE!/);
    assert.match(gameSrc, /HAT POP \/ HEADSHOT!/);
    assert.match(gameSrc, /DOUBLE COLLATERAL!/);
    assert.match(gameSrc, /DEADEYE!/);
  });
});

describe("5. Endless Bounty Hunt Arcade Mode", () => {
  it("provides Bounty Hunt mode HUD, wave generation, and streak multipliers", () => {
    assert.match(html, /id="bounty-hud"/);
    assert.match(html, /id="btn-bounty-mode"/);
    assert.match(html, /id="btn-bounty-start"/);
    assert.match(gameSrc, /startBountyMode/);
    assert.match(gameSrc, /startBountyWave/);
    assert.match(gameSrc, /bountyWaveClear/);
    assert.match(gameSrc, /bountyGameOver/);
  });

  it("saves high bounty record to localStorage", () => {
    assert.match(gameSrc, /gw\.save\.bounty/);
  });
});

describe("6. Revolver Finishes & Gunsmith Customization", () => {
  it("provides 4 collectible finishes (Blued, Silver, Gold, Charred) in Menu and storage", () => {
    assert.match(html, /data-skin="blued"/);
    assert.match(html, /data-skin="silver"/);
    assert.match(html, /data-skin="gold"/);
    assert.match(html, /data-skin="charred"/);
    assert.match(gameSrc, /gw\.save\.gunsmith/);
    assert.match(gameSrc, /setGunsmithSkin/);
  });

  it("applies finish-specific shaders and highlights in drawGun", () => {
    assert.match(gameSrc, /skin === "silver"/);
    assert.match(gameSrc, /skin === "gold"/);
    assert.match(gameSrc, /skin === "charred"/);
  });
});

describe("7. Title Cowboy Hat-Pop Easter Egg", () => {
  it("includes interactive hat hitbox and popping animation", () => {
    assert.match(html, /id="portrait-wrap"/);
    assert.match(html, /id="hat-hitbox"/);
    assert.match(css, /\.hat-popping/);
    assert.match(css, /cowboyHatPop/);
    assert.match(gameSrc, /hatPopPlink/);
  });
});

describe("8. Aiming Stability & Trajectory Sight Cleanliness", () => {
  it("drawPath uses forward path directly with no backward stub", () => {
    assert.match(gameSrc, /splitByBounce\(all\)/);
    assert.doesNotMatch(gameSrc, /tip\.x,\s*y:\s*tip\.y,\s*bounce:\s*0\s*\}\]\.concat\(all\)/);
  });

  it("drawSight hides lingering ghost shot while active aiming", () => {
    assert.match(gameSrc, /else if \(state\.ghost\)/);
  });

  it("aimDir bounds safeDy to eliminate near-muzzle touch singularity jumping", () => {
    assert.match(gameSrc, /safeDy\s*=\s*Math\.min\(-160,\s*dy\)/);
  });

  it("binds pointermove and pointerup to window for continuous tracking", () => {
    assert.match(gameSrc, /window\.addEventListener\("pointermove"/);
    assert.match(gameSrc, /window\.addEventListener\("pointerup"/);
  });
});
