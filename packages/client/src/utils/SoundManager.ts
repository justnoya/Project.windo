class SoundManagerClass {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientTimers: ReturnType<typeof setTimeout>[] = [];

  private get(volume = 0.35): { ctx: AudioContext; out: GainNode } | null {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const out = this.ctx.createGain();
      out.gain.value = volume;
      out.connect(this.master!);
      return { ctx: this.ctx, out };
    } catch { return null; }
  }

  private osc(ctx: AudioContext, out: AudioNode, type: OscillatorType, freq: number,
    startFreq: number, endFreq: number, startGain: number, endGain: number,
    duration: number, delay = 0) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(out);
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, t);
    if (endFreq !== startFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
    gain.gain.setValueAtTime(startGain, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(endGain, 0.0001), t + duration);
    osc.start(t); osc.stop(t + duration + 0.01);
  }

  private noise(ctx: AudioContext, out: AudioNode, filterFreq: number, startGain: number, endGain: number, duration: number, delay = 0) {
    const t = ctx.currentTime + delay;
    const bufSize = Math.ceil(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.5;
    const gain = ctx.createGain();
    src.connect(filter); filter.connect(gain); gain.connect(out);
    gain.gain.setValueAtTime(startGain, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(endGain, 0.0001), t + duration);
    src.start(t); src.stop(t + duration + 0.01);
  }

  unlock() { this.get(); }

  // ── Splash ────────────────────────────────────────────────────────────────

  splashReveal() {
    const s = this.get(0.4); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'triangle', 0, 55, 55, 0.6, 0.001, 1.2);
    this.osc(ctx, out, 'sine',    0, 220, 440, 0.15, 0.001, 0.9, 0.3);
    this.noise(ctx, out, 3000, 0.3, 0.001, 0.4, 0.1);
  }

  handleReveal() {
    const s = this.get(0.3); if (!s) return;
    const { ctx, out } = s;
    const t = ctx.currentTime;
    [0, 0.04, 0.08, 0.13].forEach((delay, i) => {
      const freqs = [300, 900, 500, 750];
      this.osc(ctx, out, 'square', 0, freqs[i], freqs[i], 0.12, 0.001, 0.06, delay);
    });
    this.osc(ctx, out, 'sine', 0, 1200, 600, 0.1, 0.001, 0.25, 0.05);
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  loadingBeep() {
    const s = this.get(0.12); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'sine', 0, 440, 480, 0.3, 0.001, 0.12);
    this.osc(ctx, out, 'sine', 0, 880, 920, 0.08, 0.001, 0.08, 0.02);
  }

  startLoadingAmbient() {
    this.stopLoadingAmbient();
    let tick = 0;
    const schedule = () => {
      this.loadingBeep();
      tick++;
      const delay = tick < 4 ? 900 : tick < 8 ? 700 : 550;
      this.ambientTimers.push(setTimeout(schedule, delay));
    };
    this.ambientTimers.push(setTimeout(schedule, 600));
  }

  stopLoadingAmbient() {
    this.ambientTimers.forEach(t => clearTimeout(t));
    this.ambientTimers = [];
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  loginChime() {
    const s = this.get(0.3); if (!s) return;
    const { ctx, out } = s;
    const notes = [880, 698, 523];
    notes.forEach((freq, i) => {
      this.osc(ctx, out, 'triangle', 0, freq, freq * 0.98, 0.25, 0.001, 0.28, i * 0.22);
      this.osc(ctx, out, 'sine',    0, freq * 2, freq * 2, 0.06, 0.001, 0.15, i * 0.22 + 0.02);
    });
  }

  loginSuccess() {
    const s = this.get(0.35); if (!s) return;
    const { ctx, out } = s;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      this.osc(ctx, out, 'triangle', 0, freq, freq, 0.3, 0.001, 0.2, i * 0.13);
      this.osc(ctx, out, 'sine',    0, freq, freq * 0.99, 0.08, 0.001, 0.18, i * 0.13);
    });
  }

  // ── Desktop startup ───────────────────────────────────────────────────────

  startup() {
    const s = this.get(0.38); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'triangle', 0, 110, 110,  0.5, 0.001, 2.2);
    this.osc(ctx, out, 'sine',    0, 220, 222,  0.25, 0.001, 1.8, 0.25);
    this.osc(ctx, out, 'sine',    0, 330, 330,  0.18, 0.001, 1.5, 0.5);
    this.osc(ctx, out, 'sine',    0, 440, 442,  0.22, 0.001, 1.8, 0.55);
    this.osc(ctx, out, 'sine',    0, 554, 554,  0.15, 0.001, 1.4, 0.7);
    this.osc(ctx, out, 'sine',    0, 660, 662,  0.12, 0.001, 1.2, 0.85);
    this.osc(ctx, out, 'sine',    0, 880, 884,  0.08, 0.001, 0.9, 1.0);
    this.noise(ctx, out, 2000, 0.12, 0.001, 0.6, 0.5);
  }

  // ── UI interactions ───────────────────────────────────────────────────────

  click() {
    const s = this.get(0.18); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'sine', 0, 900, 400, 0.4, 0.001, 0.07);
  }

  dblClick() {
    const s = this.get(0.18); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'sine', 0, 900, 450, 0.4, 0.001, 0.065);
    this.osc(ctx, out, 'sine', 0, 950, 480, 0.4, 0.001, 0.065, 0.09);
  }

  windowOpen() {
    const s = this.get(0.22); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'triangle', 0, 180, 720, 0.3, 0.001, 0.22);
    this.osc(ctx, out, 'sine',    0, 360, 900, 0.1, 0.001, 0.18, 0.04);
    this.noise(ctx, out, 1500, 0.08, 0.001, 0.15, 0.02);
  }

  windowClose() {
    const s = this.get(0.2); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'triangle', 0, 600, 120, 0.28, 0.001, 0.18);
    this.osc(ctx, out, 'sine',    0, 300, 80,  0.1, 0.001, 0.14);
  }

  windowMinimize() {
    const s = this.get(0.15); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'sine', 0, 420, 240, 0.28, 0.001, 0.12);
  }

  windowRestore() {
    const s = this.get(0.15); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'sine', 0, 260, 440, 0.28, 0.001, 0.12);
  }

  menuOpen() {
    const s = this.get(0.16); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'triangle', 0, 240, 560, 0.22, 0.001, 0.13);
    this.noise(ctx, out, 800, 0.06, 0.001, 0.1);
  }

  menuClose() {
    const s = this.get(0.12); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'triangle', 0, 480, 220, 0.18, 0.001, 0.1);
  }

  menuItem() {
    const s = this.get(0.1); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'sine', 0, 660, 600, 0.2, 0.001, 0.05);
  }

  error() {
    const s = this.get(0.3); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'square', 0, 120, 120, 0.25, 0.001, 0.25);
    this.osc(ctx, out, 'square', 0, 180, 180, 0.15, 0.001, 0.25, 0.01);
    this.osc(ctx, out, 'square', 0, 120, 120, 0.22, 0.001, 0.25, 0.35);
  }

  hover() {
    const s = this.get(0.05); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'sine', 0, 800, 700, 0.12, 0.001, 0.035);
  }

  wypPick() {
    const s = this.get(0.2); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'sine',     0, 440, 550, 0.3,  0.001, 0.1);
    this.osc(ctx, out, 'sine',     0, 880, 1100, 0.1, 0.001, 0.08, 0.06);
    this.noise(ctx, out, 2000, 0.07, 0.001, 0.08, 0.03);
  }

  wypHint() {
    const s = this.get(0.15); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'triangle', 0, 600, 800, 0.25, 0.001, 0.12);
    this.osc(ctx, out, 'sine',     0, 1200, 1000, 0.08, 0.001, 0.1, 0.05);
  }

  wypReveal() {
    const s = this.get(0.3); if (!s) return;
    const { ctx, out } = s;
    this.osc(ctx, out, 'triangle', 0, 330, 660,  0.35, 0.001, 0.35);
    this.osc(ctx, out, 'sine',     0, 660, 1320, 0.18, 0.001, 0.28, 0.1);
    this.osc(ctx, out, 'sine',     0, 990, 1980, 0.1,  0.001, 0.22, 0.18);
    this.noise(ctx, out, 3000, 0.1, 0.001, 0.2, 0.05);
  }

  wypCorrect() {
    const s = this.get(0.32); if (!s) return;
    const { ctx, out } = s;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      this.osc(ctx, out, 'triangle', 0, f, f,    0.3, 0.001, 0.22, i * 0.11);
      this.osc(ctx, out, 'sine',     0, f, f * 0.99, 0.1, 0.001, 0.18, i * 0.11 + 0.02);
    });
  }
}

export const SoundManager = new SoundManagerClass();
