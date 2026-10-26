import { validateLevel } from '../core/LevelLoader';
import type { LevelData } from '../core/types';
import level01 from './level01.json';
import mechanicsTest from './mechanics-test.json';

export const LEVELS: Record<string, LevelData> = {
  level01: validateLevel(level01),
  'mechanics-test': validateLevel(mechanicsTest),
};

/** Order of the normal campaign (Stage 1 has a single clearable level). */
export const CAMPAIGN = ['level01'] as const;
