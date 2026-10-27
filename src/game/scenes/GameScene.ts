import * as Phaser from 'phaser';
import { SPEED_OPTIONS, TILE, WORLD_H, WORLD_W, secToSteps } from '../../core/config';
import { FixedStepClock } from '../../core/FixedStepClock';
import { MapGrid } from '../../core/MapGrid';
import { Simulation, type Enemy } from '../../core/Simulation';
import { ENEMY_KINDS, type GameEvent } from '../../core/types';
import { CAMPAIGN, LEVELS } from '../../levels';
import { ENEMY_COLORS, PALETTE, drawDizzy, drawEnemy, drawGardener, drawHeart } from '../../rendering/VectorArt';
import { FONT, GAME_H, GAME_W } from '../constants';
import { InputController } from '../InputController';
import { KEYMAP_HELP, saveSettings, settings } from '../Settings';
import { sfx } from '../Sfx';
import { music } from '../music/Music';

/** Stage origin inside the 1280x720 design canvas. */
const OX = (GAME_W - WORLD_W) / 2;
const OY = 84;
const FLOOR_THICK = 18;

interface SceneData {
  levelId?: string;
  score?: number;
  lives?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: number;
  size: number;
}

export class GameScene extends Phaser.Scene {
  sim!: Simulation;
  clock!: FixedStepClock;
  private input2!: InputController;
  private levelId = 'level01';
  private paused = false;
  private helpOpen = false;
  private dyn!: Phaser.GameObjects.Graphics;
  private hudG!: Phaser.GameObjects.Graphics;
  private texts: Record<string, Phaser.GameObjects.Text> = {};
  private overlay!: Phaser.GameObjects.Container;
  private overlayTitle!: Phaser.GameObjects.Text;
  private overlayBody!: Phaser.GameObjects.Text;
  private overlayBg!: Phaser.GameObjects.Rectangle;
  private particles: Particle[] = [];
  private t = 0;
  private fpsSamples: number[] = [];
  private trapSteps = 300;
  private onHidden = () => this.setPaused(true, true);
  private onVisibility = () => {
    if (document.hidden) this.setPaused(true, true);
    else {
      this.lastFrame = performance.now();
      this.clock?.resetAccumulator();
    }
  };

  constructor() {
    super('GameScene');
  }

  init(data: SceneData): void {
    this.levelId = data.levelId && LEVELS[data.levelId] ? data.levelId : 'level01';
    const level = LEVELS[this.levelId]!;
    this.sim = new Simulation(level, { score: data.score, lives: data.lives });
    this.clock = new FixedStepClock();
    this.clock.speed = settings.speed;
    this.trapSteps = secToSteps(this.sim.cfg.trapSeconds);
    this.paused = false;
    this.helpOpen = false;
    this.particles = [];
  }

  create(): void {
    // Scene instances are reused by scene.restart(): never keep objects from a previous run.
    this.texts = {};
    this.hudCache = '';
    this.fpsSamples = [];
    this.lastFrame = performance.now();
    this.drawBackground();
    this.drawStaticTerrain();
    this.dyn = this.add.graphics();
    this.hudG = this.add.graphics();
    this.createHud();
    this.createOverlay();

    this.input2 = new InputController(settings.keymap);
    this.input2.onCommand = (code) => this.command(code);
    window.addEventListener('keydown', this.unlockAudio);

    this.game.events.on('hidden', this.onHidden);
    this.game.events.on('blur', this.onHidden);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.events.once('shutdown', () => this.cleanup());

    // Test/debug hook for browser automation (read-only use).
    const scene = this;
    (window as unknown as { __orchard: unknown }).__orchard = {
      scene,
      get sim() {
        return scene.sim;
      },
    };
  }

  private unlockAudio = () => sfx.unlock();

  private cleanup(): void {
    this.input2.destroy();
    window.removeEventListener('keydown', this.unlockAudio);
    this.game.events.off('hidden', this.onHidden);
    this.game.events.off('blur', this.onHidden);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  // ------------------------------------------------------------------ loop

  private lastFrame = 0;

  override update(): void {
    // Use our own real-time delta (Phaser's delta is smoothed); the clock clamps it.
    const now = performance.now();
    const delta = now - this.lastFrame;
    this.lastFrame = now;
    this.fpsSamples.push(delta);
    if (this.fpsSamples.length > 60) this.fpsSamples.shift();

    const steps = this.clock.advance(delta);
    for (let i = 0; i < steps; i++) {
      this.sim.step(this.input2.consume());
      for (const ev of this.sim.drainEvents()) this.onEvent(ev);
    }
    if (!this.paused) {
      this.t += (delta / 1000) * this.clock.speed;
      this.updateParticles(delta / 1000);
    }
    this.render(this.clock.alpha);
    this.updateHud();
    this.updateOverlay();
    this.syncMusic();
  }

  /** BGM follows the game state: plays while READY/PLAYING, silent when paused, hit, cleared or over. */
  private syncMusic(): void {
    const st = this.sim.status;
    const active = !this.paused && (st === 'PLAYING' || st === 'READY');
    // Tempo follows world speed (half as strongly) and speeds up when time is running out.
    const hurry = st === 'PLAYING' && this.sim.timeLeftSec <= 20 ? 1.2 : 1;
    music.tempo = (1 + (this.clock.speed - 1) * 0.5) * hurry;
    music.want(active ? 'game' : null);
  }

  // ------------------------------------------------------------------ commands

  private command(code: string): void {
    const st = this.sim.status;
    switch (code) {
      case 'Escape':
      case 'KeyP':
        if (this.helpOpen) {
          this.helpOpen = false;
          this.setPaused(false);
        } else if (st !== 'GAME_OVER' && st !== 'LEVEL_CLEAR') this.setPaused(!this.paused);
        break;
      case 'KeyH':
      case 'F1':
        this.helpOpen = !this.helpOpen;
        this.setPaused(this.helpOpen);
        break;
      case 'Enter':
      case 'NumpadEnter':
        if (st === 'LEVEL_CLEAR') this.nextLevel();
        else if (st === 'GAME_OVER') this.restart(true);
        else if (this.paused) {
          this.helpOpen = false;
          this.setPaused(false);
        }
        break;
      case 'KeyR':
        this.restart(true);
        break;
      case 'KeyQ':
        if (this.paused || st === 'GAME_OVER' || st === 'LEVEL_CLEAR') this.scene.start('MenuScene');
        break;
      case 'KeyB':
        settings.music = !settings.music;
        saveSettings();
        break;
      case 'KeyN':
        settings.muted = !settings.muted;
        saveSettings();
        break;
      case 'KeyG':
        if (this.sim.level.debug) this.sim.reopenPresetHoles();
        break;
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Digit4': {
        const s = SPEED_OPTIONS[Number(code.slice(5)) - 1]!;
        settings.speed = s;
        this.clock.speed = s;
        saveSettings();
        sfx.blip();
        break;
      }
    }
  }

  setPaused(p: boolean, auto = false): void {
    if (this.sim.status === 'GAME_OVER' || this.sim.status === 'LEVEL_CLEAR') p = false;
    this.paused = p;
    this.clock.paused = p;
    this.clock.resetAccumulator();
    this.lastFrame = performance.now();
    this.input2?.clear();
    if (auto && p) this.helpOpen = false;
  }

  private restart(fresh: boolean): void {
    this.scene.restart(fresh ? { levelId: this.levelId } : { levelId: this.levelId, score: this.sim.score, lives: this.sim.lives });
  }

  private nextLevel(): void {
    const idx = (CAMPAIGN as readonly string[]).indexOf(this.levelId);
    const next = idx >= 0 && idx < CAMPAIGN.length - 1 ? CAMPAIGN[idx + 1]! : 'mechanics-test';
    if (this.levelId === 'mechanics-test') {
      this.scene.start('MenuScene');
      return;
    }
    this.scene.restart({ levelId: next, score: this.sim.score, lives: this.sim.lives });
  }

  // ------------------------------------------------------------------ events -> feedback

  private onEvent(ev: GameEvent): void {
    const fy = (f: number) => OY + this.sim.level.floorY[f]!;
    const cx = (c: number) => OX + MapGrid.colCenter(c);
    switch (ev.type) {
      case 'hole-dig-progress':
        sfx.dig(ev.progress);
        this.burst(cx(ev.col), fy(ev.floor) + 4, PALETTE.brickLight, 6, 90);
        break;
      case 'hole-opened':
        sfx.holeOpen();
        this.burst(cx(ev.col), fy(ev.floor) + 6, PALETTE.brick, 14, 160);
        break;
      case 'hole-fill-progress':
        sfx.fill();
        this.burst(cx(ev.col), fy(ev.floor) + 2, PALETTE.grassTop, 4, 70);
        break;
      case 'hole-filled':
        sfx.holeFilled();
        this.burst(cx(ev.col), fy(ev.floor), PALETTE.grassTop, 10, 110);
        break;
      case 'player-fall-started':
        sfx.playerFall();
        break;
      case 'player-landed':
        this.burst(OX + this.sim.player.x, fy(ev.floor), PALETTE.grassTop, 8, 80);
        break;
      case 'enemy-trapped':
        sfx.trapped();
        break;
      case 'hole-pound-progress':
        sfx.pound(ev.progress);
        this.burst(cx(ev.col), fy(ev.floor) - 10, PALETTE.gold, 4, 120);
        break;
      case 'enemy-fall-started':
        sfx.fall();
        break;
      case 'enemy-landed':
        if (ev.survived) {
          sfx.survive();
          const e = this.sim.enemies.find((x) => x.id === ev.enemyId)!;
          const need = ENEMY_KINDS[e.kind].requiredFallFloors;
          this.popup(OX + e.x, OY + e.y - 60, `${ev.floorsFallen}/${need} 層 不夠！`, '#ff8a8a');
        }
        break;
      case 'enemy-defeated':
        sfx.defeat();
        this.burst(OX + ev.x, OY + ev.y - 16, ENEMY_COLORS[ev.kind].main, 24, 220);
        this.popup(OX + ev.x, OY + ev.y - 50, `+${ev.points}  (${ev.floorsFallen} 層)`, '#ffe066');
        break;
      case 'enemy-escaped':
        sfx.escape();
        break;
      case 'invalid-action':
        sfx.invalid();
        break;
      case 'player-hit':
        sfx.hurt();
        this.cameras.main.shake(250, 0.008);
        break;
      case 'life-lost':
        if (ev.reason === 'time') this.popup(GAME_W / 2, GAME_H / 2 - 80, '時間到！', '#ff8a8a');
        break;
      case 'level-cleared':
        sfx.clear();
        break;
      case 'game-over':
        sfx.gameOver();
        break;
    }
  }

  private burst(x: number, y: number, color: number, n: number, speed: number): void {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * Math.random();
      const v = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5, max: 0.5, color, size: 2 + Math.random() * 3 });
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += 600 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private popup(x: number, y: number, msg: string, color: string): void {
    const t = this.add
      .text(x, y, msg, { fontFamily: FONT, fontSize: '22px', color, stroke: '#2a1b3d', strokeThickness: 5, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(50);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  // ------------------------------------------------------------------ static drawing

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(PALETTE.skyTop, PALETTE.skyTop, PALETTE.skyBottom, PALETTE.skyBottom, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);
    // sun + clouds
    g.fillStyle(0xfff3a0, 0.9);
    g.fillCircle(1080, 150, 46);
    g.fillStyle(0xffffff, 0.8);
    for (const [x, y, s] of [[260, 140, 1], [700, 110, 1.3], [980, 260, 0.9]] as const) {
      g.fillEllipse(x, y, 90 * s, 30 * s);
      g.fillEllipse(x + 30 * s, y - 12 * s, 60 * s, 34 * s);
    }
    // rolling hills + orchard trees (original decorative art)
    g.fillStyle(PALETTE.hillFar, 1);
    g.fillEllipse(300, 700, 900, 360);
    g.fillEllipse(1050, 720, 900, 380);
    g.fillStyle(PALETTE.hillNear, 1);
    g.fillEllipse(640, 760, 1500, 300);
    for (let i = 0; i < 9; i++) {
      const x = 60 + i * 145;
      const y = 560 + (i % 2) * 20;
      g.fillStyle(PALETTE.wood, 1);
      g.fillRect(x - 5, y, 10, 40);
      g.fillStyle(0x4fae4a, 1);
      g.fillCircle(x, y - 6, 30);
      g.fillStyle(PALETTE.red, 1);
      g.fillCircle(x - 12, y - 4, 5);
      g.fillCircle(x + 10, y - 14, 5);
    }
    // stage panel
    g.fillStyle(0x2a1b3d, 0.22);
    g.fillRoundedRect(OX - 8, OY - 8, WORLD_W + 16, WORLD_H - 40, 18);
    // side panels
    g.fillStyle(0x2a1b3d, 0.55);
    g.fillRoundedRect(8, OY, OX - 24, 506, 14);
    g.fillRoundedRect(OX + WORLD_W + 16, OY, OX - 24, 506, 14);
    // top HUD bar
    g.fillStyle(0x2a1b3d, 0.75);
    g.fillRoundedRect(8, 8, GAME_W - 16, 60, 14);
  }

  private drawStaticTerrain(): void {
    const g = this.add.graphics();
    const lv = this.sim.level;
    for (let f = 0; f < lv.floorY.length; f++) {
      const y = OY + lv.floorY[f]!;
      const diggable = lv.diggableFloors.includes(f);
      for (let c = 0; c < lv.cols; c++) {
        const x = OX + c * TILE;
        g.fillStyle(diggable ? PALETTE.brick : 0x8a6a5a, 1);
        g.fillRect(x, y, TILE, FLOOR_THICK);
        g.fillStyle(PALETTE.grassTop, 1);
        g.fillRect(x, y, TILE, 5);
        // brick seams: makes each logical tile visibly separate
        g.lineStyle(2, diggable ? PALETTE.brickDark : 0x5c4438, 1);
        g.lineBetween(x, y + 5, x, y + FLOOR_THICK);
        g.lineBetween(x + TILE / 2, y + 11, x + TILE / 2, y + FLOOR_THICK);
        g.lineBetween(x, y + 11, x + TILE, y + 11);
      }
      g.lineStyle(3, PALETTE.ink, 1);
      g.strokeRect(OX, y, WORLD_W, FLOOR_THICK);
    }
    for (const l of lv.ladders) {
      const x = OX + MapGrid.colCenter(l.col);
      const y0 = OY + lv.floorY[l.top]! - 6;
      const y1 = OY + lv.floorY[l.bottom]!;
      g.lineStyle(5, PALETTE.ladder, 1);
      g.lineBetween(x - 13, y0, x - 13, y1);
      g.lineBetween(x + 13, y0, x + 13, y1);
      g.lineStyle(4, PALETTE.ladderLight, 1);
      for (let y = y0 + 10; y < y1; y += 13) g.lineBetween(x - 12, y, x + 12, y);
    }
  }

  // ------------------------------------------------------------------ dynamic drawing

  private render(alpha: number): void {
    const g = this.dyn;
    const sim = this.sim;
    const lv = sim.level;
    g.clear();
    const lerp = (a: number, b: number) => a + (b - a) * alpha;

    // Holes (and dig cracks). Logical tile = what you see.
    for (const t of sim.map.activeTiles()) {
      const x = OX + t.col * TILE;
      const y = OY + lv.floorY[t.floor]!;
      const st = sim.map.holeState(t.floor, t.col);
      const frac = t.progress / sim.cfg.digPulses;
      if (st === 'OPEN' || st === 'OCCUPIED' || st === 'POUNDING') {
        g.fillStyle(PALETTE.hole, 1);
        g.fillRect(x + 2, y, TILE - 4, FLOOR_THICK);
        g.lineStyle(2, PALETTE.holeRim, 1);
        g.strokeRect(x + 2, y, TILE - 4, FLOOR_THICK);
      } else {
        // partially dug: dark wedge grows + crack lines (6 stages)
        g.fillStyle(PALETTE.hole, 0.85);
        const w = (TILE - 4) * frac;
        g.fillRect(x + TILE / 2 - w / 2, y, w, FLOOR_THICK * frac);
        g.lineStyle(2, PALETTE.ink, 0.9);
        for (let i = 0; i < t.progress; i++) {
          const cx = x + 6 + i * 6;
          g.lineBetween(cx, y + 2, cx + (i % 2 ? 4 : -3), y + FLOOR_THICK - 2);
        }
        this.pips(g, x + TILE / 2, y - 10, t.progress, sim.cfg.digPulses, st === 'REFILLING' ? PALETTE.grassTop : PALETTE.gold);
      }
    }

    // Player action targets: J = left tile, K = right tile (gold = will pound a trapped enemy).
    const p = sim.player;
    const km = KEYMAP_HELP[settings.keymap];
    const showTargets = sim.status === 'PLAYING' && sim.playerOnFloor;
    for (const [dir, key, label] of [[-1, 'keyL', km.digLeft], [1, 'keyR', km.digRight]] as const) {
      const col = sim.playerCol + dir;
      let txt = this.texts[key];
      if (!txt) {
        txt = this.add
          .text(0, 0, '', { fontFamily: FONT, fontSize: '13px', color: '#ffffff', fontStyle: 'bold', stroke: '#2a1b3d', strokeThickness: 4 })
          .setOrigin(0.5, 0)
          .setDepth(15);
        this.texts[key] = txt;
      }
      if (!showTargets || col < 0 || col >= lv.cols) {
        txt.setVisible(false);
        continue;
      }
      const ok = sim.map.canDig(p.floor, col);
      // What the key will do on this tile: 挖 dig / 補 fill / 敲 pound.
      const hs = sim.map.holeState(p.floor, col);
      const mode = hs === 'OCCUPIED' || hs === 'POUNDING' ? 'pound' : hs === 'OPEN' || hs === 'REFILLING' ? 'fill' : 'dig';
      const color = mode === 'pound' ? PALETTE.gold : mode === 'fill' ? PALETTE.good : PALETTE.white;
      const tx = OX + col * TILE;
      const ty = OY + lv.floorY[p.floor]!;
      g.lineStyle(3, ok ? color : PALETTE.bad, ok ? 0.85 : 0.45);
      g.strokeRoundedRect(tx + 1, ty - 2, TILE - 2, FLOOR_THICK + 4, 4);
      const verb = mode === 'pound' ? '敲' : mode === 'fill' ? '補' : '挖';
      txt
        .setText(ok ? `${label} ${verb}` : '✕')
        .setColor(!ok ? '#ff8a8a' : mode === 'pound' ? '#ffe066' : mode === 'fill' ? '#7dff96' : '#ffffff')
        .setPosition(tx + TILE / 2, ty + FLOOR_THICK + 3)
        .setVisible(true);
    }

    // Enemies: trapped ones first (behind floor lip), then others
    const ordered = [...sim.enemies].sort((a, b) => Number(b.state === 'TRAPPED' || b.state === 'ESCAPING') - Number(a.state === 'TRAPPED' || a.state === 'ESCAPING'));
    for (const e of ordered) {
      if (e.state === 'DEFEATED') continue;
      const ex = OX + lerp(e.prevX, e.x);
      const ey = OY + lerp(e.prevY, e.y);
      if (e.state === 'TRAPPED' || e.state === 'ESCAPING') {
        this.drawTrapped(g, e, ex, ey);
        continue;
      }
      drawEnemy(g, e.kind, ex, ey, {
        t: this.t + e.id,
        dir: e.dir,
        trapped: false,
        falling: e.state === 'FALLING',
        stunned: e.state === 'STUNNED',
        climbing: e.state === 'CLIMBING',
      });
      if (e.state === 'STUNNED') drawDizzy(g, ex, ey - 50, this.t);
      if (e.state === 'FALLING') {
        g.lineStyle(3, PALETTE.white, 0.6);
        g.lineBetween(ex - 10, ey - 50, ex - 10, ey - 80);
        g.lineBetween(ex + 10, ey - 46, ex + 10, ey - 72);
      }
    }

    // Player
    const px = OX + lerp(p.prevX, p.x);
    const py = OY + lerp(p.prevY, p.y);
    const action = p.state === 'DIGGING' ? 'dig' : p.state === 'POUNDING' ? 'pound' : 'none';
    drawGardener(g, px, py, {
      facing: p.facing,
      walkPhase: p.ladder ? p.y * 0.3 : p.x * 0.25,
      climbing: !!p.ladder,
      falling: p.state === 'FALLING',
      action,
      actionT: 1 - p.actionAnimSteps / 8,
      blink: sim.status === 'PLAYING' && p.invulnSteps > 0 && Math.floor(this.t * 12) % 2 === 0,
      hurt: sim.status === 'LIFE_LOST' || sim.status === 'GAME_OVER',
    });

    for (const pt of this.particles) {
      g.fillStyle(pt.color, Math.max(0, pt.life / pt.max));
      g.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
  }

  private drawTrapped(g: Phaser.GameObjects.Graphics, e: Enemy, ex: number, ey: number): void {
    const sim = this.sim;
    const lv = sim.level;
    const floorTop = OY + lv.floorY[e.floor]!;
    drawEnemy(g, e.kind, ex, ey, { t: this.t, dir: e.dir, trapped: true, falling: false, stunned: false, climbing: false });
    // Front lip of the floor hides the sunk body => clearly "in the hole".
    g.fillStyle(PALETTE.brick, 1);
    g.fillRect(ex - TILE / 2 + 2, floorTop + 6, TILE - 4, FLOOR_THICK - 6);
    g.fillStyle(PALETTE.hole, 1);
    g.fillRect(ex - TILE / 2 + 4, floorTop + 6, TILE - 8, 4);
    g.lineStyle(2, PALETTE.holeRim, 1);
    g.strokeRect(ex - TILE / 2 + 2, floorTop, TILE - 4, FLOOR_THICK);
    if (e.state !== 'TRAPPED') return;

    const headY = ey - (e.kind === 'blue' ? 52 : e.kind === 'green' ? 44 : 38);
    drawDizzy(g, ex, headY, this.t);
    // Escape timer ring
    const frac = Math.max(0, e.timerSteps / this.trapSteps);
    const ry = headY - 22;
    g.lineStyle(4, 0x000000, 0.3);
    g.strokeCircle(ex, ry, 9);
    g.lineStyle(4, frac > 0.3 ? PALETTE.good : PALETTE.bad, 1);
    g.beginPath();
    g.arc(ex, ry, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
    g.strokePath();
    // Pound progress pips
    const tile = sim.map.tile(e.floor, e.trapCol);
    this.pips(g, ex, floorTop + FLOOR_THICK + 8, tile?.poundProgress ?? 0, sim.cfg.poundPulses, PALETTE.gold);

    // Predicted fall path through ALIGNED open holes, with pass/fail vs required floors.
    let target = e.floor + 1;
    while (target < sim.map.bottomFloor && sim.map.isOpen(target, e.trapCol)) target++;
    const floors = target - e.floor;
    const need = ENEMY_KINDS[e.kind].requiredFallFloors;
    const ok = floors >= need;
    const landY = OY + lv.floorY[target]!;
    g.lineStyle(3, ok ? PALETTE.good : PALETTE.bad, 0.9);
    for (let y = floorTop + FLOOR_THICK + 4; y < landY - 6; y += 12) g.lineBetween(ex, y, ex, y + 6);
    g.fillStyle(ok ? PALETTE.good : PALETTE.bad, 0.9);
    g.fillTriangle(ex - 7, landY - 12, ex + 7, landY - 12, ex, landY - 3);
    const key = `fall${e.id}`;
    let label = this.texts[key];
    if (!label) {
      label = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '15px', color: '#fff', stroke: '#2a1b3d', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(20);
      this.texts[key] = label;
    }
    label.setText(`${floors}/${need} 層 ${ok ? '✔' : '✘'}`).setColor(ok ? '#7dff96' : '#ff8a8a').setPosition(ex + 10, (floorTop + landY) / 2).setVisible(true);
  }

  private pips(g: Phaser.GameObjects.Graphics, x: number, y: number, n: number, max: number, color: number): void {
    const w = 6;
    const start = x - ((max - 1) * w) / 2;
    for (let i = 0; i < max; i++) {
      g.fillStyle(i < n ? color : 0x000000, i < n ? 1 : 0.35);
      g.fillCircle(start + i * w, y, 2.4);
    }
  }

  // ------------------------------------------------------------------ HUD

  private createHud(): void {
    const style = { fontFamily: FONT, fontSize: '22px', color: '#ffffff', fontStyle: 'bold' } as const;
    this.texts.score = this.add.text(30, 38, '', style).setOrigin(0, 0.5);
    this.texts.level = this.add.text(GAME_W / 2, 38, '', { ...style, fontSize: '20px' }).setOrigin(0.5);
    this.texts.time = this.add.text(830, 38, '', style).setOrigin(0, 0.5);
    this.texts.speed = this.add.text(1020, 38, '', style).setOrigin(0, 0.5);
    this.texts.lives = this.add.text(300, 38, '生命', { ...style, fontSize: '18px' }).setOrigin(0, 0.5);
    const small = { fontFamily: FONT, fontSize: '15px', color: '#f6ecff', lineSpacing: 6 } as const;
    this.texts.left = this.add.text(22, OY + 14, '', small);
    this.texts.right = this.add.text(OX + WORLD_W + 30, OY + 14, '', small);
    this.texts.fps = this.add.text(GAME_W - 14, GAME_H - 10, '', { fontFamily: FONT, fontSize: '12px', color: '#2a1b3d' }).setOrigin(1, 1);
  }

  private hudCache = '';

  private updateHud(): void {
    // Hide stale fall-path labels; render() re-shows live ones each frame.
    for (const [k, t] of Object.entries(this.texts)) {
      if (k.startsWith('fall')) {
        const id = Number(k.slice(4));
        const e = this.sim.enemies.find((x) => x.id === id);
        if (!e || e.state !== 'TRAPPED') t.setVisible(false);
      }
    }
    const sim = this.sim;
    const km = KEYMAP_HELP[settings.keymap];
    const timeLeft = Math.ceil(sim.timeLeftSec);
    const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / Math.max(1, this.fpsSamples.length);
    const key = [sim.score, sim.lives, timeLeft, this.clock.speed, settings.keymap, sim.remainingEnemies, settings.muted, settings.music, sim.status].join('|');
    this.texts.fps!.setText(`${(1000 / Math.max(1, avg)).toFixed(0)} fps (render) · logic 60 Hz`);
    if (key === this.hudCache) return;
    this.hudCache = key;

    this.texts.score!.setText(`分數 ${sim.score.toString().padStart(6, '0')}`);
    this.texts.level!.setText(sim.level.name);
    this.texts.time!.setText(`時間 ${timeLeft}`).setColor(timeLeft <= 20 ? '#ff8a8a' : '#ffffff');
    this.texts.speed!.setText(`速度 ${this.clock.speed.toFixed(2)}x`);

    this.hudG.clear();
    for (let i = 0; i < sim.cfg.startLives; i++) {
      drawHeart(this.hudG, 370 + i * 30, 36, 10, i < sim.lives ? PALETTE.red : 0x5a4a6a);
    }

    this.texts.left!.setText(
      [
        '操作說明',
        '',
        `移動  ${km.move}`,
        `爬梯  ${km.climb}`,
        `左邊一格  ${km.digLeft}`,
        `右邊一格  ${km.digRight}`,
        '同一鍵：',
        ' 地板→挖 洞→補',
        ' 有敵人→敲下去',
        '（沒有跳躍）',
        '',
        '暫停  Esc / P',
        '說明  H',
        '速度  1 2 3 4',
        '重來  R',
        `音效  N ${settings.muted ? '(關)' : '(開)'}`,
        `音樂  B ${settings.music && !settings.muted ? '(開)' : '(關)'}`,
        ...(sim.level.debug ? ['', '重開測試洞  G'] : []),
      ].join('\n'),
    );
    const counts = { red: 0, green: 0, blue: 0 };
    for (const e of sim.enemies) if (e.state !== 'DEFEATED') counts[e.kind]++;
    this.texts.right!.setText('敵人圖鑑');
    const rx = OX + WORLD_W + 16;
    (['red', 'green', 'blue'] as const).forEach((k, i) => {
      const by = OY + 54 + i * 112;
      drawEnemy(this.hudG, k, rx + 32, by + 62, { t: 0, dir: 1, trapped: false, falling: false, stunned: false, climbing: false });
      const key = `legend-${k}`;
      let t = this.texts[key];
      if (!t) {
        t = this.add.text(rx + 60, by, '', { fontFamily: FONT, fontSize: '14px', color: '#f6ecff', lineSpacing: 6 });
        this.texts[key] = t;
      }
      t.setText([`${ENEMY_COLORS[k].label}`, `剩 ${counts[k]} 隻`, `落 ${ENEMY_KINDS[k].requiredFallFloors} 層消滅`, `${ENEMY_KINDS[k].baseScore}分/層`].join('\n'));
      t.setAlpha(counts[k] > 0 ? 1 : 0.45);
    });
    const tip = this.texts.tip ?? (this.texts.tip = this.add.text(rx + 14, OY + 400, '', { fontFamily: FONT, fontSize: '14px', color: '#ffe066', lineSpacing: 4 }));
    tip.setText('洞要上下對齊\n才算連續落下');
  }

  // ------------------------------------------------------------------ overlay

  private createOverlay(): void {
    this.overlayBg = this.add.rectangle(GAME_W / 2, GAME_H / 2, 620, 330, 0x2a1b3d, 0.9).setStrokeStyle(4, PALETTE.gold);
    this.overlayTitle = this.add
      .text(GAME_W / 2, GAME_H / 2 - 110, '', { fontFamily: FONT, fontSize: '44px', color: '#ffe066', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5);
    this.overlayBody = this.add
      .text(GAME_W / 2, GAME_H / 2 + 20, '', { fontFamily: FONT, fontSize: '20px', color: '#ffffff', align: 'center', lineSpacing: 8 })
      .setOrigin(0.5);
    this.overlay = this.add.container(0, 0, [this.overlayBg, this.overlayTitle, this.overlayBody]).setDepth(100);
  }

  private updateOverlay(): void {
    const sim = this.sim;
    const km = KEYMAP_HELP[settings.keymap];
    let title = '';
    let body = '';
    let small = false;
    if (this.helpOpen) {
      title = '怎麼玩';
      body = [
        `${km.move} 左右走，在梯子前按 ${km.climb} 爬梯（沒有跳躍）`,
        `${km.digLeft} 對左邊一格、${km.digRight} 對右邊一格動作，每個動作都要 6 下：`,
        '　地板 → 挖洞　　已經有洞 → 補起來　　洞裡困著敵人 → 敲下去',
        '敵人走到洞上會掉進去被困住（約 5 秒後會爬出來）',
        '長按時，挖好／補好／敲落後會自動停住，放開再按才會繼續',
        '紅蘋果掉 1 層、綠捕蠅草 2 層、藍仙人掌 3 層才會消滅',
        '要連續掉多層：下面樓層同一直行也要先挖好洞',
        '小心！自己走到挖好的洞上，也會掉到下一層',
        '',
        'Esc / Enter 回到遊戲',
      ].join('\n');
      small = true;
    } else if (sim.status === 'GAME_OVER') {
      title = 'GAME OVER';
      body = `最終分數 ${sim.score}\n\nEnter / R 重試　Q 回選單`;
    } else if (sim.status === 'LEVEL_CLEAR') {
      title = '過關！';
      const next = this.levelId === 'mechanics-test' ? 'Enter 回選單' : 'Enter 進入機制測試關';
      body = `分數 ${sim.score}（含剩餘時間獎勵）\n\n${next}\nR 重玩本關　Q 回選單`;
    } else if (this.paused) {
      title = '暫停';
      body = 'Esc / Enter 繼續\nH 操作說明　R 重來　Q 回選單\n\n切換分頁時會自動暫停';
    } else if (sim.status === 'READY') {
      title = this.sim.lives < this.sim.cfg.startLives ? `剩 ${sim.lives} 條命` : 'READY!';
      body = '把敵人困在洞裡，再敲下去！';
    } else if (sim.status === 'LIFE_LOST') {
      title = '哎呀！';
      body = `剩 ${sim.lives} 條命`;
    }
    const show = title !== '';
    this.overlay.setVisible(show);
    if (!show) return;
    this.overlayTitle.setText(title);
    this.overlayBody.setText(body).setFontSize(small ? 18 : 20);
    const h = small ? 420 : sim.status === 'READY' || sim.status === 'LIFE_LOST' ? 200 : 330;
    this.overlayBg.setSize(small ? 760 : 620, h);
    this.overlayBg.setPosition(GAME_W / 2, GAME_H / 2);
    this.overlayTitle.setY(GAME_H / 2 - h / 2 + 50);
    this.overlayBody.setY(GAME_H / 2 + (small ? 30 : 20));
  }
}
