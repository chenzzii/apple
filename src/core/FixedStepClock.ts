import { STEP_MS } from './config';

/**
 * Converts variable real frame deltas into a whole number of fixed 60 Hz logic steps.
 *
 * - Real delta is clamped to [0, maxFrameMs] so a background tab or debugger pause
 *   can never cause a large catch-up burst.
 * - The speed multiplier scales game time, NOT render FPS: at 2.0x the same real
 *   time produces twice as many logic steps.
 * - If more than maxSteps would be needed in one frame the excess is dropped and
 *   counted in `droppedMs` (avoids the spiral of death).
 */
export class FixedStepClock {
  private accumulator = 0;
  paused = false;
  speed = 1;
  droppedMs = 0;
  totalSteps = 0;

  constructor(
    readonly maxFrameMs = 100,
    readonly baseMaxSteps = 5,
  ) {}

  /** Returns number of logic steps to run for this frame. */
  advance(realDeltaMs: number): number {
    if (this.paused) return 0;
    const clamped = Math.min(Math.max(realDeltaMs, 0), this.maxFrameMs);
    this.accumulator += clamped * this.speed;
    // Small epsilon so float accumulation of e.g. 144 Hz deltas does not lose a step.
    let steps = Math.floor((this.accumulator + 1e-6) / STEP_MS);
    const maxSteps = Math.ceil(this.baseMaxSteps * this.speed);
    if (steps > maxSteps) {
      this.droppedMs += (steps - maxSteps) * STEP_MS;
      steps = maxSteps;
      this.accumulator = 0;
    } else {
      this.accumulator = Math.max(0, this.accumulator - steps * STEP_MS);
    }
    this.totalSteps += steps;
    return steps;
  }

  /** Interpolation factor in [0,1) between previous and current logic state. */
  get alpha(): number {
    return Math.min(this.accumulator / STEP_MS, 1);
  }

  /** Call when resuming from pause / tab return so stale time is never replayed. */
  resetAccumulator(): void {
    this.accumulator = 0;
  }
}
