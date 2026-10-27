import { describe, expect, it } from 'vitest';
import { STEPS_PER_BAR, TRACKS, compileTrack, noteToFreq } from '../src/game/music/score';

describe('original BGM score', () => {
  it('converts pitches to frequencies', () => {
    expect(noteToFreq('A4')).toBeCloseTo(440, 6);
    expect(noteToFreq('C4')).toBeCloseTo(261.626, 2);
    expect(noteToFreq('A5')).toBeCloseTo(880, 6);
    expect(noteToFreq('F#3')).toBeCloseTo(184.997, 2);
    expect(() => noteToFreq('H2')).toThrow();
  });

  for (const track of Object.values(TRACKS)) {
    it(`${track.id}: every voice and drum bar fills exactly ${track.bars} bars`, () => {
      const c = compileTrack(track); // throws on any length mismatch
      expect(c.totalSteps).toBe(track.bars * STEPS_PER_BAR);
      const notes = c.events.flat();
      expect(notes.length).toBeGreaterThan(20);
      for (const n of notes) {
        expect(n.freq).toBeGreaterThan(60); // above ~B1
        expect(n.freq).toBeLessThan(1400); // below ~F6, keeps it gentle
        expect(n.length).toBeGreaterThan(0);
      }
    });
  }

  it('the in-game loop has a steady kick on beat 1 of every bar', () => {
    const c = compileTrack(TRACKS.game);
    for (let b = 0; b < TRACKS.game.bars; b++) expect(c.drums[b * STEPS_PER_BAR]).toContain('k');
  });
});
