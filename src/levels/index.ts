import { validateLevel } from '../core/LevelLoader';
import type { LevelData } from '../core/types';
import level01 from './level01.json';
import level02 from './level02.json';
import mechanicsTest from './mechanics-test.json';

export const LEVELS: Record<string, LevelData> = {
  level01: validateLevel(level01),
  level02: validateLevel(level02),
  'mechanics-test': validateLevel(mechanicsTest),
};

/** Order of the normal campaign. */
export const CAMPAIGN = ['level01', 'level02'] as const;

/** The level that follows `id` in the campaign, or null if `id` is the last one (or not in it). */
export function nextCampaignLevel(id: string): string | null {
  const i = (CAMPAIGN as readonly string[]).indexOf(id);
  return i >= 0 && i < CAMPAIGN.length - 1 ? CAMPAIGN[i + 1]! : null;
}
