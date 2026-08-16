/**
 * The Gritty Western — procedural score & Foley.
 * No samples. Dust, brass, and a whistle that is not anybody else's theme.
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
    }

    unlock() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return;
      }
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.46;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 10;
      comp.ratio.value = 3.5;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this._startWind();
    }

    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.46;
    }

    setTension(on) {
      if (!this._wind) return;
      this._wind.g.gain.setTargetAtTime(on ? 0.012 : 0.035, this.ctx.currentTime, 0.08);
      this._wind.f.frequency.setTargetAtTime(on ? 180 : 420, this.ctx.currentTime, 0.1);
    }

    heartbeat() {
      this.tone(54, 0.11, "sine", 0.07, 32);
    }

    _startWind() {
      if (!this.ctx || this._wind) return;
      const len = this.ctx.sampleRate * 3;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 420;
      f.Q.value = 0.7;
      const g = this.ctx.createGain();
      g.gain.value = 0.035;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start();
      this._wind = { src, g, f };
    }

    noise(dur, peak, hp, lp) {
      if (!this.ctx || this.muted) return;
      const n = Math.max(32, this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
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
      const e = env(this.ctx, 0.002, 0.03, 0.22, dur, peak);
      node.connect(e);
      e.connect(this.master);
      src.start();
    }

    tone(freq, dur, type, peak, slide) {
      if (!this.ctx || this.muted) return;
      const o = this.ctx.createOscillator();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), this.ctx.currentTime + dur);
      const e = env(this.ctx, 0.01, dur * 0.25, 0.3, dur * 0.7, peak || 0.12);
      o.connect(e);
      e.connect(this.master);
      o.start();
      o.stop(this.ctx.currentTime + dur + 0.05);
    }

    gunshot() {
      this.noise(0.22, 0.62, 140, 2400);
      this.noise(0.09, 0.4, 1600, 9000);
      this.tone(78, 0.28, "sine", 0.32, 34);
      this.tone(196, 0.12, "triangle", 0.1, 70);
    }

    ping(bounce) {
      const f = 1680 + bounce * 220;
      this.tone(f, 0.16, "sine", 0.18, f * 0.55);
      this.tone(f * 2.01, 0.07, "triangle", 0.05, f);
      this.noise(0.04, 0.08, 3000, 9000);
    }

    click() {
      this.noise(0.03, 0.12, 1200, 5000);
      this.tone(420, 0.04, "square", 0.04);
    }

    reload() {
      this.click();
      setTimeout(() => this.tone(220, 0.08, "triangle", 0.07), 90);
      setTimeout(() => this.click(), 180);
    }

    thud() {
      this.tone(70, 0.28, "sine", 0.22, 30);
      this.noise(0.16, 0.16, 80, 500);
    }

    hurt() {
      this.noise(0.25, 0.3, 200, 1200);
      this.tone(140, 0.3, "sawtooth", 0.08, 50);
    }

    whistle() {
      if (!this.ctx || this.muted) return;
      const o = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      o.type = "sine";
      o2.type = "sine";
      const now = this.ctx.currentTime;
      o.frequency.setValueAtTime(784, now);
      o.frequency.linearRampToValueAtTime(698, now + 0.45);
      o.frequency.linearRampToValueAtTime(880, now + 0.9);
      o2.frequency.setValueAtTime(788, now);
      const e = env(this.ctx, 0.08, 0.2, 0.5, 0.7, 0.07);
      o.connect(e);
      o2.connect(e);
      e.connect(this.master);
      o.start(now);
      o2.start(now);
      o.stop(now + 1.15);
      o2.stop(now + 1.15);
    }

    sting(win) {
      if (win) {
        this.tone(294, 0.18, "triangle", 0.1);
        setTimeout(() => this.tone(370, 0.18, "triangle", 0.1), 120);
        setTimeout(() => this.tone(440, 0.4, "triangle", 0.12), 240);
      } else {
        this.tone(196, 0.4, "sine", 0.12, 90);
      }
    }

    tickTheme(dt, onTitle) {
      if (!this.ctx || this.muted || !onTitle) return;
      this._theme += dt;
      if (this._theme > 6.4) {
        this._theme = 0;
        this.whistle();
      }
    }
  }

  GW.audio = new AudioBus();
})(typeof window !== "undefined" ? window : globalThis);
