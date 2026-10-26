import * as Phaser from 'phaser';
import { createGameConfig } from './game/GameConfig';

const game = new Phaser.Game(createGameConfig('game'));
(window as unknown as { __game: Phaser.Game }).__game = game;
