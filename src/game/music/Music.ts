import { settings } from '../Settings';
import { sfx } from '../Sfx';
import { TRACKS, compileTrack, type CompiledTrack, type DrumHit, type NoteEvent, type TrackId } from './score';

const LOOKAHEAD_SEC = 0.15;
const TICK_MS = 25;
const MUSIC_VOLUME = 0.55;

/**
 * Look-ahead Web Audio sequencer for the original BGM. Notes are scheduled slightly ahead
 * on the AudioContext clock so timing stays steady even if a frame is slow.
 * Call want() every frame with the track the game state calls for (or null for silence).
 */
export class Music {
  private compiled = new Map<TrackId, CompiledTrack>();
  private current: CompiledTrack | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  /** Tempo multiplier (world speed, "hurry" mode). */
  tempo = 1;

  constructor() {
    for (const id of Object.keys(TRACKS) as TrackId[]) this.compiled.set(id, compileTrack(TRACKS[id]));
  }

  /** Current sixteenth-note position in the loop (debug / tests). */
  get position(): number {
    return this.step;
  }

  /** Debug/test helper: an AnalyserNode fed by the music bus, to confirm sound is produced. */
  analyser(): AnalyserNode | null {
    const ctx = sfx.context;
    if (!ctx || !this.master) return null;
    const a = ctx.createAnalyser();
    a.fftSize = 2048;
    this.master.connect(a);
    return a;
  }

  /** Debug/test helper: also route the music bus into `node` (e.g. a recorder). */
  debugTap(node: AudioNode): void {
    this.master?.connect(node);
  }

  get playing(): TrackId | null {
    return this.current?.track.id ?? null;
  }

  /** Request a track (null = silence). Cheap to call every frame. */
  want(id: TrackId | null): void {
    const enabled = settings.music && !settings.muted;
    const target = enabled ? id : null;
    if (target === this.playing && (target === null || this.timer)) return;
    this.stop();
    if (target === null) return;
    const ctx = sfx.context;
    if (!ctx || ctx.state !== 'running') return; // retried next frame after the audio unlock
    this.ensureNodes(ctx);
    this.current = this.compiled.get(target)!;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.06;
    this.master!.gain.cancelScheduledValues(ctx.currentTime);
    this.master!.gain.setValueAtTime(MUSIC_VOLUME, ctx.currentTime);
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const ctx = sfx.context;
    if (ctx && this.master) {
      // quick fade so already-scheduled notes do not ring on
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.setValueAtTime(this.master.gain.value, ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
    }
    this.current = null;
  }

  private ensureNodes(ctx: AudioContext): void {
    if (this.master) return;
    this.master = ctx.createGain();
    this.master.gain.value = MUSIC_VOLUME;
    this.master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.3);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x7fffffff) * 2 - 1;
    }
  }

  private tick(): void {
    const ctx = sfx.context;
    const tr = this.current;
    if (!ctx || !tr) return;
    const stepSec = 60 / (tr.track.bpm * Math.max(0.25, this.tempo)) / 4;
    // If we fell far behind (e.g. throttled timer), skip ahead instead of bursting notes.
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.02;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_SEC) {
      for (const ev of tr.events[this.step]!) this.playNote(ctx, ev, this.nextTime, stepSec);
      for (const d of tr.drums[this.step]!) this.playDrum(ctx, d, this.nextTime);
      this.nextTime += stepSec;
      this.step = (this.step + 1) % tr.totalSteps;
    }
  }

  private playNote(ctx: AudioContext, ev: NoteEvent, t: number, stepSec: number): void {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const dur = Math.max(0.05, ev.length * stepSec);
    let peak: number;
    let release: number;
    switch (ev.instrument) {
      case 'lead':
        o.type = 'square';
        peak = 0.07;
        release = Math.min(dur * 0.9, dur - 0.01);
        break;
      case 'softLead':
        o.type = 'triangle';
        peak = 0.12;
        release = dur * 0.95;
        break;
      case 'arp':
        o.type = 'sine';
        peak = 0.05;
        release = dur * 0.9;
        break;
      case 'bass':
        o.type = 'triangle';
        peak = 0.16;
        release = dur * 0.85;
        break;
    }
    o.frequency.setValueAtTime(ev.freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.setValueAtTime(peak, t + Math.max(0.013, release * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t + release);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private playDrum(ctx: AudioContext, d: DrumHit, t: number): void {
    if (d === 'k') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g).connect(this.master!);
      o.start(t);
      o.stop(t + 0.16);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const isSnare = d === 's';
    f.type = isSnare ? 'bandpass' : 'highpass';
    f.frequency.value = isSnare ? 1800 : 7000;
    const len = isSnare ? 0.12 : 0.035;
    g.gain.setValueAtTime(isSnare ? 0.16 : 0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + len + 0.02);
  }
}

export const music = new Music();
