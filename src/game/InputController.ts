import type { InputFrame } from '../core/types';
import type { Keymap } from './Settings';

type Action = 'left' | 'right' | 'up' | 'down' | 'dig' | 'pound';

const MAPS: Record<Keymap, Record<string, Action>> = {
  modern: {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    KeyJ: 'dig',
    KeyK: 'pound',
  },
  classic: {
    KeyJ: 'left',
    KeyK: 'right',
    KeyI: 'up',
    KeyM: 'down',
    KeyA: 'dig',
    KeyS: 'pound',
  },
};

/**
 * Keyboard -> InputFrame. Only ONE keymap is active at a time (no conflicts).
 * Key-down edges are latched until consumed by the next logic step, so a tap is never
 * lost on frames where zero logic steps run (e.g. 144 Hz displays).
 */
export class InputController {
  private held = new Set<Action>();
  private pressed = new Set<Action>();
  keymap: Keymap;
  /** Non-gameplay keys (pause, speed, help...) forwarded to the scene. */
  onCommand: (code: string, ev: KeyboardEvent) => void = () => {};

  private readonly down = (ev: KeyboardEvent) => {
    const a = MAPS[this.keymap][ev.code];
    if (a) {
      ev.preventDefault();
      if (!ev.repeat) {
        this.pressed.add(a);
      }
      this.held.add(a);
      return;
    }
    if (ev.code === 'Space' || ev.code.startsWith('Arrow')) ev.preventDefault();
    if (!ev.repeat) this.onCommand(ev.code, ev);
  };

  private readonly up = (ev: KeyboardEvent) => {
    const a = MAPS[this.keymap][ev.code];
    if (a) this.held.delete(a);
  };

  private readonly blur = () => this.held.clear();

  constructor(keymap: Keymap) {
    this.keymap = keymap;
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.blur);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.blur);
  }

  clear(): void {
    this.held.clear();
    this.pressed.clear();
  }

  /** Build the frame for one logic step and consume press edges. */
  consume(): InputFrame {
    const h = this.held;
    const p = this.pressed;
    const frame: InputFrame = {
      left: h.has('left') || p.has('left'),
      right: h.has('right') || p.has('right'),
      up: h.has('up') || p.has('up'),
      down: h.has('down') || p.has('down'),
      digHeld: h.has('dig'),
      digPressed: p.has('dig'),
      poundHeld: h.has('pound'),
      poundPressed: p.has('pound'),
    };
    p.clear();
    return frame;
  }
}
