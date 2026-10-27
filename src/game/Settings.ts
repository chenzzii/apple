import { DEFAULT_SPEED, SPEED_OPTIONS, type SpeedOption } from '../core/config';

export type Keymap = 'modern' | 'classic';

export interface Settings {
  keymap: Keymap;
  speed: SpeedOption;
  muted: boolean;
  /** Background music on/off (independent of sound effects). */
  music: boolean;
}

const KEY = 'orchard-panic.settings.v1';

export const settings: Settings = load();

function load(): Settings {
  const d: Settings = { keymap: 'modern', speed: DEFAULT_SPEED, muted: false, music: true };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      keymap: s.keymap === 'classic' ? 'classic' : 'modern',
      speed: (SPEED_OPTIONS as readonly number[]).includes(s.speed as number) ? (s.speed as SpeedOption) : d.speed,
      muted: !!s.muted,
      music: s.music !== false,
    };
  } catch {
    return d;
  }
}

export function saveSettings(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable: settings stay in memory */
  }
}

export const KEYMAP_HELP: Record<Keymap, { move: string; climb: string; digLeft: string; digRight: string }> = {
  modern: { move: '← → / A D', climb: '↑ ↓ / W S', digLeft: 'J', digRight: 'K' },
  classic: { move: 'J  K', climb: 'I  M', digLeft: 'A', digRight: 'S' },
};
