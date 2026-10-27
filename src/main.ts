import * as Phaser from 'phaser';
import { createGameConfig } from './game/GameConfig';
import { music } from './game/music/Music';

const game = new Phaser.Game(createGameConfig('game'));
(window as unknown as { __game: Phaser.Game }).__game = game;
// Debug/test hook (read-only use by tools/playtest).
(window as unknown as { __music: typeof music }).__music = music;
