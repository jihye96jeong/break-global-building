// Synthesised 8-bit style SFX with Web Audio. No files, no network. Created on the first user gesture.
type Sfx = 'swing' | 'hit' | 'crack' | 'crumble' | 'combo' | 'gaugeFull' | 'ultCharge' | 'ultBoom' | 'hurt' | 'clear' | 'gameOver' | 'start' | 'land'
  | 'glass' | 'stone' | 'steel' | 'wood' | 'mixed' | 'jump' | 'guardThud' | 'guardClang' | 'repel' | 'finish' | 'danger' | 'stinger';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastPlayed = new Map<Sfx, number>();
  private voices = 0;
  enabled = true;

  /** Must be called from a user gesture (iOS/Chrome autoplay rules). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  suspend() { if (this.ctx?.state === 'running') void this.ctx.suspend(); }
  resume() { if (this.ctx?.state === 'suspended' && this.enabled) void this.ctx.resume(); }

  private tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t); o.stop(t + dur + 0.02);
    this.track(dur);
  }

  private burst(t: number, dur: number, vol: number, filter: BiquadFilterType, f0: number, f1 = f0, q = 1) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const bq = ctx.createBiquadFilter();
    bq.type = filter; bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, t);
    bq.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(bq).connect(g).connect(this.master!);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    this.track(dur);
  }

  private track(dur: number) {
    this.voices++;
    setTimeout(() => { this.voices--; }, dur * 1000 + 40);
  }

  play(name: Sfx, opts: { pitch?: number } = {}) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const minGap = name === 'crumble' || name === 'land' ? 0.05 : 0.025;
    if (now - (this.lastPlayed.get(name) ?? -1) < minGap) return; // no stacking on rapid fire
    if (this.voices > 24 && name !== 'ultBoom' && name !== 'hurt') return; // voice cap
    this.lastPlayed.set(name, now);
    // ±3% so rapid hits never sound like one sample on repeat
    const p = (opts.pitch ?? 1) * (name === 'swing' || name === 'hit' ? 0.97 + Math.random() * 0.06 : 1);
    const t = now + 0.005;
    switch (name) {
      case 'swing': this.burst(t, 0.12, 0.25, 'bandpass', 900, 3000, 2); break;
      case 'hit':
        this.tone('square', 520 * p, 140 * p, t, 0.09, 0.22);
        this.burst(t, 0.14, 0.45, 'lowpass', 4000, 600);
        break;
      case 'crack': this.tone('square', 900, 400, t, 0.06, 0.15); this.burst(t, 0.06, 0.2, 'highpass', 2500); break;
      case 'crumble':
        this.burst(t, 0.35, 0.4, 'lowpass', 1800, 150);
        this.tone('triangle', 160, 50, t, 0.25, 0.25);
        break;
      case 'land': this.burst(t, 0.12, 0.15, 'lowpass', 900, 200); break;
      case 'combo': {
        const base = 520 * p;
        [0, 0.06, 0.12].forEach((d, i) => this.tone('square', base * [1, 1.26, 1.5][i], base * [1, 1.26, 1.5][i], t + d, 0.08, 0.12));
        break;
      }
      case 'gaugeFull': [0, 0.08, 0.16, 0.24].forEach((d, i) => this.tone('square', [660, 830, 990, 1320][i], [660, 830, 990, 1320][i], t + d, 0.1, 0.13)); break;
      case 'ultCharge':
        this.tone('sawtooth', 60, 240, t, 0.55, 0.22);
        this.burst(t, 0.55, 0.2, 'bandpass', 200, 2400, 4);
        break;
      case 'ultBoom':
        this.tone('sine', 120, 30, t, 0.9, 0.6);
        this.burst(t, 1.3, 0.7, 'lowpass', 3000, 80);
        this.tone('square', 220, 55, t, 0.5, 0.15);
        break;
      case 'hurt': this.tone('square', 440, 110, t, 0.3, 0.25); this.burst(t, 0.15, 0.25, 'lowpass', 1200, 300); break;
      case 'clear': [0, 0.1, 0.2, 0.3, 0.45].forEach((d, i) => this.tone('square', [523, 659, 784, 1047, 1319][i], [523, 659, 784, 1047, 1319][i], t + d, i === 4 ? 0.35 : 0.12, 0.14)); break;
      case 'gameOver': [0, 0.18, 0.36, 0.54].forEach((d, i) => this.tone('triangle', [392, 330, 262, 196][i], [392, 330, 262, 196][i] * (i === 3 ? 0.7 : 1), t + d, i === 3 ? 0.6 : 0.16, 0.2)); break;
      case 'glass': // floor break, glass curtain wall: bright tinkle + crash
        this.burst(t, 0.25, 0.4, 'highpass', 3000, 6000, 2);
        [0, 0.03, 0.07].forEach((d, i) => this.tone('sine', 2400 + i * 700, 1800 + i * 500, t + d, 0.12, 0.08));
        this.tone('triangle', 140, 50, t, 0.25, 0.3);
        break;
      case 'stone':
        this.burst(t, 0.45, 0.55, 'lowpass', 1400, 120);
        this.tone('sine', 110, 40, t, 0.35, 0.5);
        break;
      case 'steel':
        this.tone('square', 880, 620, t, 0.18, 0.12); this.tone('triangle', 1320, 990, t, 0.35, 0.1);
        this.burst(t, 0.2, 0.3, 'bandpass', 2600, 1200, 3);
        this.tone('sine', 120, 45, t, 0.3, 0.35);
        break;
      case 'wood':
        this.burst(t, 0.12, 0.45, 'bandpass', 1600, 700, 2); this.burst(t + 0.05, 0.2, 0.35, 'lowpass', 1200, 200);
        this.tone('triangle', 180, 70, t, 0.25, 0.35);
        break;
      case 'mixed': this.burst(t, 0.35, 0.5, 'lowpass', 2200, 160); this.tone('sine', 130, 45, t, 0.3, 0.4); break;
      case 'jump': this.burst(t, 0.16, 0.25, 'bandpass', 600, 2400, 2); this.tone('sine', 140, 90, t, 0.06, 0.18); break;
      case 'guardThud': this.tone('sine', 90, 40, t, 0.28, 0.65); this.burst(t, 0.18, 0.4, 'lowpass', 900, 120); break;
      case 'guardClang': this.tone('square', 1200, 900, t, 0.12, 0.15); this.tone('triangle', 1800, 1500, t, 0.25, 0.1); this.burst(t, 0.1, 0.2, 'highpass', 3000); break;
      case 'repel': this.burst(t, 0.22, 0.3, 'bandpass', 300, 1600, 3); this.tone('sawtooth', 70, 160, t, 0.18, 0.15); break;
      case 'finish':
        this.tone('sine', 70, 28, t, 0.9, 0.7); this.burst(t, 1.0, 0.6, 'lowpass', 2600, 70);
        [0, 0.08, 0.16].forEach((d, i) => this.tone('square', [523, 784, 1047][i], [523, 784, 1047][i], t + 0.1 + d, 0.12, 0.08));
        break;
      case 'danger': this.tone('sine', 70, 55, t, 0.12, 0.4); this.tone('sine', 70, 55, t + 0.18, 0.12, 0.3); break;
      case 'stinger': [0, 0.06, 0.12, 0.2].forEach((d, i) => this.tone('square', [660, 880, 990, 1320][i] * p, [660, 880, 990, 1320][i] * p, t + d, 0.09, 0.1)); break;
      case 'start': [0, 0.07, 0.14].forEach((d, i) => this.tone('square', [440, 660, 880][i], [440, 660, 880][i], t + d, 0.09, 0.13)); break;
    }
  }
}
