/**
 * The Gritty Western — procedural score & Foley.
 */
(function (root) {
  const GW = (root.GW = root.GW || {});

  function env(ctx, a, d, s, r, peak) {
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * s), t + a + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r);
    return g;
  }

  class AudioBus {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this._theme = 0;
      this._wind = null;
      this._heartT = 0;
      this._banks = {
        ugh: {
          paths: ["assets/sfx/ugh.wav", "assets/sfx/ugh-2.wav", "assets/sfx/ugh-3.wav"],
          raw: [],
          bufs: [],
          last: -1,
        },
        pan: {
          paths: ["assets/sfx/pan-ping.wav"],
          raw: [],
          bufs: [],
          last: -1,
        },
        drop: {
          paths: [
            "assets/sfx/drop-1.wav",
            "assets/sfx/drop-2.wav",
            "assets/sfx/drop-3.wav",
            "assets/sfx/drop-4.wav",
          ],
          raw: [],
          bufs: [],
          last: -1,
        },
        gun: {
          paths: ["assets/sfx/gun-1.wav"],
          raw: [],
          bufs: [],
          last: -1,
        },
        wood: {
          paths: ["assets/sfx/wood-1.wav"],
          raw: [],
          bufs: [],
          last: -1,
        },
        cock: {
          paths: ["assets/sfx/cock-1.wav"],
          raw: [],
          bufs: [],
          last: -1,
        },
        plate: {
          paths: ["assets/sfx/plate-1.wav"],
          raw: [],
          bufs: [],
          last: -1,
        },
        barrel: {
          paths: ["assets/sfx/barrel-1.wav"],
          raw: [],
          bufs: [],
          last: -1,
        },
      };
      this._fetchBanks();
    }

    _fetchBanks() {
      const later = this;
      Object.keys(this._banks).forEach(function (name) {
        const bank = later._banks[name];
        bank.paths.forEach(function (path, i) {
          bank.raw[i] = null;
          bank.bufs[i] = null;
          fetch(path)
            .then(function (r) {
              if (!r.ok) throw new Error("sfx missing");
              return r.arrayBuffer();
            })
            .then(function (buf) {
              bank.raw[i] = buf;
              later._decodeBanks();
            })
            .catch(function () {});
        });
      });
    }

    _decodeBanks() {
      if (!this.ctx) return;
      const later = this;
      Object.keys(this._banks).forEach(function (name) {
        const bank = later._banks[name];
        bank.raw.forEach(function (raw, i) {
          if (!raw || bank.bufs[i]) return;
          const copy = raw.slice(0);
          const p = later.ctx.decodeAudioData(copy);
          if (p && typeof p.then === "function") {
            p.then(function (decoded) {
              bank.bufs[i] = decoded;
            }).catch(function () {});
          } else {
            later.ctx.decodeAudioData(copy, function (decoded) {
              bank.bufs[i] = decoded;
            });
          }
        });
      });
    }

    _playBank(name, rate, gain) {
      if (!this.ctx || this.muted) return false;
      const bank = this._banks[name];
      if (!bank) return false;
      const ready = bank.bufs.filter(function (b) {
        return !!b;
      });
      if (!ready.length) return false;
      let pick = Math.floor(Math.random() * ready.length);
      if (ready.length > 1 && pick === bank.last) pick = (pick + 1) % ready.length;
      bank.last = pick;
      const src = this.ctx.createBufferSource();
      src.buffer = ready[pick];
      src.playbackRate.value = rate;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g);
      g.connect(this._out(1));
      src.start();
      return true;
    }

    unlock() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        this._decodeBanks();
        return;
      }
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 8;
      comp.ratio.value = 3.2;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this._startWind();
      this._decodeBanks();
    }

    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    }

    setTension(on) {
      if (!this._wind || !this.ctx) return;
      this._wind.g.gain.setTargetAtTime(on ? 0.01 : 0.04, this.ctx.currentTime, 0.1);
      this._wind.f.frequency.setTargetAtTime(on ? 140 : 380, this.ctx.currentTime, 0.12);
    }

    stopHeart() {
      if (this._heartT) {
        clearTimeout(this._heartT);
        this._heartT = 0;
      }
    }

    heartbeat() {
      this.stopHeart();
      this.tone(48, 0.09, "sine", 0.08, 28, 1);
      const later = this;
      this._heartT = setTimeout(function () {
        later._heartT = 0;
        later.tone(40, 0.12, "sine", 0.05, 24, 1);
      }, 160);
    }

    _startWind() {
      if (!this.ctx || this._wind) return;
      const len = this.ctx.sampleRate * 4;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      let acc = 0;
      for (let i = 0; i < len; i++) {
        acc = acc * 0.97 + (Math.random() * 2 - 1) * 0.03;
        d[i] = acc + (Math.random() * 2 - 1) * 0.08;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 380;
      f.Q.value = 0.55;
      const g = this.ctx.createGain();
      g.gain.value = 0.04;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start();
      this._wind = { src, g, f };
    }

    _out(near) {
      const n = near == null ? 1 : near;
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900 + 13000 * n;
      const g = this.ctx.createGain();
      g.gain.value = 0.38 + 0.62 * n;
      lp.connect(g);
      g.connect(this.master);
      return lp;
    }

    noise(dur, peak, hp, lp, near) {
      if (!this.ctx || this.muted) return;
      const n = Math.max(32, this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      let node = src;
      if (hp) {
        const f = this.ctx.createBiquadFilter();
        f.type = "highpass";
        f.frequency.value = hp;
        node.connect(f);
        node = f;
      }
      if (lp) {
        const f = this.ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = lp;
        node.connect(f);
        node = f;
      }
      const e = env(this.ctx, 0.002, 0.025, 0.2, dur, peak);
      node.connect(e);
      e.connect(this._out(near));
      src.start();
    }

    tone(freq, dur, type, peak, slide, near) {
      if (!this.ctx || this.muted) return;
      const o = this.ctx.createOscillator();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), this.ctx.currentTime + dur);
      const e = env(this.ctx, 0.008, dur * 0.22, 0.28, dur * 0.72, peak || 0.12);
      o.connect(e);
      e.connect(this._out(near));
      o.start();
      o.stop(this.ctx.currentTime + dur + 0.05);
    }

    gunshot() {
      const rate = 0.97 + Math.random() * 0.06;
      if (this._playBank("gun", rate, 1)) return true;
      this.noise(0.28, 0.7, 90, 1800, 1);
      this.noise(0.08, 0.45, 1800, 10000, 1);
      this.noise(0.05, 0.22, 4000, 14000, 1);
      this.tone(62, 0.32, "sine", 0.38, 28, 1);
      this.tone(148, 0.14, "triangle", 0.12, 55, 1);
      this.tone(320, 0.05, "square", 0.04, 80, 1);
      return false;
    }

    ping(bounce, kind) {
      if (kind === "pan") {
        const rate = 0.96 + (bounce || 0) * 0.05 + (Math.random() * 0.04 - 0.02);
        if (this._playBank("pan", rate, 0.95)) return;
      }
      if (kind === "plate") {
        const rate = 0.97 + (bounce || 0) * 0.03 + (Math.random() * 0.04 - 0.02);
        if (this._playBank("plate", rate, 0.9)) return;
      }
      if (kind === "barrel") {
        const rate = 0.96 + (bounce || 0) * 0.03 + (Math.random() * 0.05 - 0.02);
        if (this._playBank("barrel", rate, 0.95)) return;
      }
      const f = 1540 + bounce * 260;
      this.tone(f, 0.22, "sine", 0.16, f * 0.48, 0.42);
      this.tone(f * 2.03, 0.09, "triangle", 0.05, f * 0.9, 0.42);
      this.noise(0.05, 0.08, 2800, 11000, 0.4);
    }

    lock() {
      this.tone(880, 0.035, "sine", 0.05, 640, 1);
      this.noise(0.018, 0.06, 2000, 7000, 1);
    }

    wood() {
      const rate = 0.96 + Math.random() * 0.08;
      if (this._playBank("wood", rate, 0.95)) return;
      this.noise(0.12, 0.22, 80, 700, 0.55);
      this.tone(110, 0.14, "triangle", 0.08, 50, 0.55);
    }

    cock() {
      const rate = 0.98 + Math.random() * 0.04;
      if (this._playBank("cock", rate, 0.9)) return;
      this.noise(0.025, 0.1, 900, 4000);
      this.tone(310, 0.05, "triangle", 0.06, 180);
      this.tone(190, 0.04, "square", 0.03);
    }

    slam() {
      this.noise(0.06, 0.12, 200, 900);
      this.tone(90, 0.08, "sine", 0.1, 40);
    }

    click() {
      this.noise(0.028, 0.13, 1400, 6000);
      this.tone(480, 0.035, "square", 0.045);
    }

    reload() {
      this.click();
      const later = this;
      setTimeout(function () {
        later.tone(210, 0.07, "triangle", 0.07);
      }, 80);
      setTimeout(function () {
        later.click();
      }, 170);
      setTimeout(function () {
        later.tone(260, 0.05, "square", 0.04);
      }, 260);
    }

    thud() {
      const rate = 0.96 + Math.random() * 0.08;
      if (this._playBank("drop", rate, 0.95)) return;
      this.tone(58, 0.34, "sine", 0.24, 24, 0.62);
      this.tone(92, 0.18, "triangle", 0.07, 40, 0.62);
      this.noise(0.2, 0.16, 60, 420, 0.58);
    }

    ugh(head) {
      if (!this.ctx || this.muted) return;
      const rate = (head ? 1.06 : 0.96) + (Math.random() * 0.05 - 0.025);
      if (this._playBank("ugh", rate, 0.95)) return;
      const now = this.ctx.currentTime;
      const pitch = (head ? 155 : 118) + Math.random() * 14;
      const o = this.ctx.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(pitch, now);
      o.frequency.exponentialRampToValueAtTime(Math.max(70, pitch * 0.58), now + 0.22);
      const o2 = this.ctx.createOscillator();
      o2.type = "sawtooth";
      o2.frequency.setValueAtTime(pitch * 2.1, now);
      o2.frequency.exponentialRampToValueAtTime(pitch * 1.15, now + 0.2);
      const bp = this.ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(520, now);
      bp.frequency.linearRampToValueAtTime(300, now + 0.22);
      bp.Q.value = 1.6;
      const e = env(this.ctx, 0.008, 0.06, 0.45, 0.2, head ? 0.28 : 0.34);
      o.connect(bp);
      o2.connect(bp);
      bp.connect(e);
      e.connect(this._out(1));
      o.start(now);
      o2.start(now);
      o.stop(now + 0.28);
      o2.stop(now + 0.26);
      this.noise(0.11, 0.16, 180, 1100, 0.9);
    }

    hurt() {
      this.noise(0.28, 0.34, 180, 1400);
      this.tone(128, 0.32, "sawtooth", 0.09, 42);
    }

    whistle() {
      if (!this.ctx || this.muted) return;
      const o = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      o.type = "sine";
      o2.type = "sine";
      const now = this.ctx.currentTime;
      o.frequency.setValueAtTime(740, now);
      o.frequency.linearRampToValueAtTime(660, now + 0.38);
      o.frequency.linearRampToValueAtTime(880, now + 0.72);
      o.frequency.linearRampToValueAtTime(784, now + 1.15);
      o2.frequency.setValueAtTime(746, now);
      const e = env(this.ctx, 0.1, 0.22, 0.45, 0.85, 0.085);
      o.connect(e);
      o2.connect(e);
      e.connect(this.master);
      o.start(now);
      o2.start(now);
      o.stop(now + 1.35);
      o2.stop(now + 1.35);
    }

    sting(win) {
      if (win) {
        this.tone(262, 0.16, "triangle", 0.1);
        const later = this;
        setTimeout(function () {
          later.tone(330, 0.16, "triangle", 0.1);
        }, 110);
        setTimeout(function () {
          later.tone(392, 0.42, "triangle", 0.13);
        }, 220);
        setTimeout(function () {
          later.whistle();
        }, 280);
      } else {
        this.tone(174, 0.45, "sine", 0.14, 70);
        this.noise(0.2, 0.12, 120, 400);
      }
    }

    tickTheme(dt, onTitle) {
      if (!this.ctx || this.muted || !onTitle) return;
      this._theme += dt;
      if (this._theme > 7.2) {
        this._theme = 0;
        this.whistle();
      }
    }
  }

  GW.audio = new AudioBus();
})(typeof window !== "undefined" ? window : globalThis);
