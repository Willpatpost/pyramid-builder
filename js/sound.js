export class SFX {
  constructor() {
    this._ctx = null;
    this._master = null;
    this._noiseBuffer = null;
    this._muted = false;
  }

  get muted() {
    return this._muted;
  }

  set muted(v) {
    this._muted = !!v;
  }

  play(name) {
    if (this._muted) {
      return;
    }
    try {
      this._ensureContext();
      if (this._ctx.state === "suspended") {
        this._ctx.resume();
      }
      const t = this._ctx.currentTime;
      switch (name) {
        case "dig": this._dig(t); break;
        case "break": this._break(t); break;
        case "place": this._place(t); break;
        case "hurt": this._hurt(t); break;
        case "mobhurt": this._mobhurt(t); break;
        case "mobdie": this._mobdie(t); break;
        case "die": this._die(t); break;
        case "pickup": this._pickup(t); break;
        case "eat": this._eat(t); break;
        case "craft": this._craft(t); break;
        case "click": this._click(t); break;
        case "win": this._win(t); break;
        default: break;
      }
    } catch {
      return;
    }
  }

  _ensureContext() {
    if (!this._ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      this._ctx = new Ctor();
      this._master = this._ctx.createGain();
      this._master.gain.value = 0.3;
      this._master.connect(this._ctx.destination);
      const frames = this._ctx.sampleRate;
      const buffer = this._ctx.createBuffer(1, frames, this._ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this._noiseBuffer = buffer;
    }
  }

  _tone(type, f0, f1, t, dur, gainVal, lowpassHz) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 != null) {
      osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    }
    if (lowpassHz) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = lowpassHz;
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(this._master);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gainVal, t + 0.01);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise(t, dur, gainVal, filterType, f0, f1, q) {
    const ctx = this._ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(f0, t);
    if (f1 != null) {
      filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
    }
    filter.Q.value = q || 1;
    const gain = ctx.createGain();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this._master);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gainVal, t + 0.01);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  _sawWobble(t, dur, gainVal, fEnd) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    filter.type = "lowpass";
    filter.frequency.value = 650;
    const base = 140;
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const center = base + (fEnd - base) * frac;
      const wobble = 12 * (1 - frac);
      const f = i % 2 === 0 ? center + wobble : center - wobble;
      osc.frequency.setValueAtTime(f, t + dur * frac);
    }
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this._master);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gainVal, t + 0.02);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _dig(t) {
    this._noise(t, 0.07, 0.3, "bandpass", 850, 500, 0.8);
  }

  _break(t) {
    this._noise(t, 0.18, 0.4, "lowpass", 600, 250, 0.7);
    this._tone("sine", 130, 70, t, 0.18, 0.35);
  }

  _place(t) {
    this._tone("triangle", 190, 120, t, 0.06, 0.3);
  }

  _hurt(t) {
    this._tone("square", 330, 170, t, 0.18, 0.32);
  }

  _mobhurt(t) {
    this._sawWobble(t, 0.25, 0.3, 110);
  }

  _mobdie(t) {
    this._sawWobble(t, 0.5, 0.32, 55);
  }

  _die(t) {
    this._tone("square", 400, 70, t, 0.7, 0.32);
    this._tone("square", 200, 45, t + 0.05, 0.65, 0.2);
  }

  _pickup(t) {
    this._tone("sine", 480, 900, t, 0.09, 0.28);
  }

  _eat(t) {
    this._noise(t, 0.07, 0.3, "bandpass", 320, 220, 2);
    this._noise(t + 0.1, 0.07, 0.3, "bandpass", 300, 200, 2);
    this._noise(t + 0.2, 0.07, 0.3, "bandpass", 280, 190, 2);
  }

  _craft(t) {
    this._tone("square", 620, 620, t, 0.05, 0.18);
    this._tone("square", 930, 930, t + 0.07, 0.05, 0.18);
  }

  _click(t) {
    this._tone("square", 950, 700, t, 0.03, 0.12);
  }

  _win(t) {
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
    for (let i = 0; i < notes.length; i++) {
      const start = t + i * 0.15;
      const dur = i === notes.length - 1 ? 1.6 : 0.16;
      this._tone("triangle", notes[i], null, start, dur, 0.16);
      this._tone("square", notes[i], null, start, dur, 0.07);
    }
  }
}
