import { settings } from './Settings';

/** Tiny original Web Audio synth effects (no audio files needed). */
export class Sfx {
  private ctx: AudioContext | null = null;

  unlock(): void {
    try {
      if (!this.ctx) this.ctx = new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.08, slideTo?: number, delay = 0): void {
    if (settings.muted || !this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  dig(progress: number) { this.tone(180 + progress * 30, 0.06, 'square', 0.06); }
  holeOpen() { this.tone(300, 0.08, 'triangle', 0.1); this.tone(450, 0.1, 'triangle', 0.1, undefined, 0.07); }
  fill() { this.tone(240, 0.05, 'sawtooth', 0.05); }
  holeFilled() { this.tone(330, 0.08, 'triangle', 0.08); this.tone(220, 0.1, 'triangle', 0.08, undefined, 0.07); }
  playerFall() { this.tone(520, 0.3, 'triangle', 0.08, 180); }
  trapped() { this.tone(600, 0.25, 'sine', 0.1, 200); }
  pound(progress: number) { this.tone(120 + progress * 20, 0.07, 'square', 0.09); }
  fall() { this.tone(700, 0.45, 'triangle', 0.08, 120); }
  defeat() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.1, 'square', 0.07, undefined, i * 0.06)); }
  survive() { this.tone(200, 0.15, 'sawtooth', 0.06, 300); }
  escape() { this.tone(260, 0.2, 'sine', 0.07, 520); }
  hurt() { this.tone(400, 0.4, 'sawtooth', 0.1, 80); }
  invalid() { this.tone(110, 0.05, 'square', 0.04); }
  clear() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.09, undefined, i * 0.09)); }
  gameOver() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.09, undefined, i * 0.2)); }
  blip() { this.tone(880, 0.04, 'square', 0.04); }
}

export const sfx = new Sfx();
