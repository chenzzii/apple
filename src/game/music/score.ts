/**
 * Original background music for Orchard Panic, written as plain data (no audio files).
 * Pure module (no DOM / Web Audio) so it can be unit-tested.
 *
 * Time unit: one sixteenth note = 1 step. A bar = 16 steps.
 */

/** [pitch like 'C5' / 'F#3', or null for a rest, length in sixteenths] */
export type Note = readonly [string | null, number];

export type Instrument = 'lead' | 'softLead' | 'bass' | 'arp';

export interface Track {
  id: TrackId;
  bpm: number;
  bars: number;
  voices: { instrument: Instrument; notes: readonly Note[] }[];
  /** One 16-char string per bar: k = kick, s = snare, h = hi-hat, '.' = nothing. */
  drums?: readonly string[];
}

export type TrackId = 'menu' | 'game';

export const STEPS_PER_BAR = 16;

// ------------------------------------------------------------------ helpers

/** Alternating root/fifth eighth notes for one bar ("oom-pah" bass). */
function oomPah(root: string, fifth: string): Note[] {
  const out: Note[] = [];
  for (let i = 0; i < 4; i++) out.push([root, 2], [fifth, 2]);
  return out;
}

/** 16 sixteenth-note arpeggio over a chord (up then back down). */
function arpeggio(tones: [string, string, string, string]): Note[] {
  const [a, b, c, d] = tones;
  const order = [a, b, c, d, c, b, a, b, a, b, c, d, c, b, c, b];
  return order.map((p) => [p, 1] as Note);
}

// ------------------------------------------------------------------ "Orchard Run" (in-game, 140 BPM)

const gameLead: Note[] = [
  // A section
  ['E5', 2], ['G5', 2], ['A5', 4], ['G5', 2], ['E5', 2], ['C5', 4],
  ['D5', 2], ['E5', 2], ['F5', 2], ['E5', 2], ['D5', 4], [null, 4],
  ['E5', 2], ['G5', 2], ['C6', 4], ['B5', 2], ['A5', 2], ['G5', 4],
  ['A5', 2], ['G5', 2], ['F5', 2], ['D5', 2], ['C5', 6], [null, 2],
  // B section
  ['F5', 4], ['A5', 2], ['F5', 2], ['E5', 4], ['G5', 2], ['E5', 2],
  ['D5', 2], ['F5', 2], ['E5', 2], ['D5', 2], ['C5', 4], ['A4', 4],
  ['B4', 2], ['C5', 2], ['D5', 2], ['E5', 2], ['F5', 2], ['G5', 2], ['A5', 2], ['B5', 2],
  ['C6', 4], ['G5', 2], ['E5', 2], ['C5', 4], [null, 4],
];

const gameBass: Note[] = [
  ...oomPah('C3', 'G3'),
  ...oomPah('G2', 'D3'),
  ...oomPah('A2', 'E3'),
  ['F2', 2], ['C3', 2], ['F2', 2], ['C3', 2], ['C3', 2], ['G3', 2], ['C3', 2], ['G3', 2],
  ...oomPah('F2', 'C3'),
  ...oomPah('D3', 'A3'),
  ...oomPah('G2', 'D3'),
  ['C3', 2], ['G3', 2], ['C3', 2], ['G3', 2], ['C3', 4], ['G2', 4],
];

const gameDrums = [
  'k.h.s.h.k.h.s.h.',
  'k.h.s.h.k.h.s.h.',
  'k.h.s.h.k.h.s.h.',
  'k.h.s.h.k.k.s.h.',
  'k.h.s.h.k.h.s.h.',
  'k.h.s.h.k.h.s.h.',
  'k.h.s.h.k.h.s.h.',
  'k.h.s.h.k.s.s.ss',
];

// ------------------------------------------------------------------ "Morning Orchard" (menu, 100 BPM)

const menuChords: [string, string, string, string][] = [
  ['C4', 'E4', 'G4', 'C5'],
  ['A3', 'C4', 'E4', 'A4'],
  ['F3', 'A3', 'C4', 'F4'],
  ['G3', 'B3', 'D4', 'G4'],
  ['C4', 'E4', 'G4', 'C5'],
  ['A3', 'C4', 'E4', 'A4'],
  ['D4', 'F4', 'A4', 'D5'],
  ['G3', 'B3', 'D4', 'G4'],
];

const menuLead: Note[] = [
  ['E5', 8], ['G5', 8],
  ['E5', 8], ['C5', 8],
  ['F5', 6], ['E5', 2], ['D5', 8],
  ['D5', 12], [null, 4],
  ['E5', 8], ['G5', 8],
  ['A5', 8], ['E5', 8],
  ['F5', 6], ['A5', 2], ['G5', 4], ['F5', 4],
  ['G5', 12], [null, 4],
];

const menuBass: Note[] = [
  ['C3', 8], ['C3', 8],
  ['A2', 8], ['A2', 8],
  ['F2', 8], ['F2', 8],
  ['G2', 8], ['G2', 8],
  ['C3', 8], ['C3', 8],
  ['A2', 8], ['A2', 8],
  ['D3', 8], ['D3', 8],
  ['G2', 8], ['B2', 8],
];

const menuDrums = Array.from({ length: 8 }, () => '....h.......h...');

export const TRACKS: Record<TrackId, Track> = {
  game: {
    id: 'game',
    bpm: 140,
    bars: 8,
    voices: [
      { instrument: 'lead', notes: gameLead },
      { instrument: 'bass', notes: gameBass },
    ],
    drums: gameDrums,
  },
  menu: {
    id: 'menu',
    bpm: 100,
    bars: 8,
    voices: [
      { instrument: 'softLead', notes: menuLead },
      { instrument: 'arp', notes: menuChords.flatMap(arpeggio) },
      { instrument: 'bass', notes: menuBass },
    ],
    drums: menuDrums,
  },
};

// ------------------------------------------------------------------ compilation

const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'A4' -> 440 Hz. Supports sharps/flats: 'F#3', 'Bb2'. */
export function noteToFreq(pitch: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(pitch);
  if (!m) throw new Error(`bad pitch ${pitch}`);
  const semi = SEMITONE[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + semi;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface NoteEvent {
  instrument: Instrument;
  freq: number;
  /** Length in steps (sixteenths). */
  length: number;
}

export type DrumHit = 'k' | 's' | 'h';

export interface CompiledTrack {
  track: Track;
  totalSteps: number;
  /** events[step] = notes starting on that step. */
  events: NoteEvent[][];
  drums: DrumHit[][];
}

export function compileTrack(track: Track): CompiledTrack {
  const totalSteps = track.bars * STEPS_PER_BAR;
  const events: NoteEvent[][] = Array.from({ length: totalSteps }, () => []);
  for (const v of track.voices) {
    let step = 0;
    for (const [pitch, len] of v.notes) {
      if (pitch !== null && step < totalSteps) {
        events[step]!.push({ instrument: v.instrument, freq: noteToFreq(pitch), length: len });
      }
      step += len;
    }
    if (step !== totalSteps) {
      throw new Error(`track ${track.id}: voice ${v.instrument} is ${step} steps, expected ${totalSteps}`);
    }
  }
  const drums: DrumHit[][] = Array.from({ length: totalSteps }, () => []);
  (track.drums ?? []).forEach((bar, b) => {
    if (bar.length !== STEPS_PER_BAR) throw new Error(`track ${track.id}: drum bar ${b} is not 16 steps`);
    [...bar].forEach((ch, i) => {
      if (ch === 'k' || ch === 's' || ch === 'h') drums[b * STEPS_PER_BAR + i]!.push(ch);
    });
  });
  return { track, totalSteps, events, drums };
}
