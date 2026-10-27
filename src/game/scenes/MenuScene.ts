import * as Phaser from 'phaser';
import { SPEED_OPTIONS } from '../../core/config';
import { PALETTE, drawEnemy, drawGardener } from '../../rendering/VectorArt';
import { FONT, GAME_H, GAME_W } from '../constants';
import { KEYMAP_HELP, saveSettings, settings } from '../Settings';
import { sfx } from '../Sfx';
import { music } from '../music/Music';

export class MenuScene extends Phaser.Scene {
  private info!: Phaser.GameObjects.Text;
  private help!: Phaser.GameObjects.Text;
  private showHelp = false;
  private art!: Phaser.GameObjects.Graphics;
  private t = 0;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(PALETTE.skyTop, PALETTE.skyTop, PALETTE.skyBottom, PALETTE.skyBottom, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);
    g.fillStyle(PALETTE.hillNear, 1);
    g.fillEllipse(640, 760, 1600, 320);
    g.fillStyle(PALETTE.brick, 1);
    g.fillRect(0, 600, GAME_W, 24);
    g.fillStyle(PALETTE.grassTop, 1);
    g.fillRect(0, 600, GAME_W, 6);

    this.add
      .text(GAME_W / 2, 120, '果園危機', { fontFamily: FONT, fontSize: '84px', color: '#ffe066', fontStyle: 'bold', stroke: '#2a1b3d', strokeThickness: 10 })
      .setOrigin(0.5);
    this.add
      .text(GAME_W / 2, 192, 'ORCHARD PANIC · Stage 1 prototype', { fontFamily: FONT, fontSize: '24px', color: '#2a1b3d', fontStyle: 'bold' })
      .setOrigin(0.5);

    const btn = (y: number, label: string, cb: () => void) => {
      const t = this.add
        .text(GAME_W / 2, y, label, { fontFamily: FONT, fontSize: '30px', color: '#ffffff', backgroundColor: '#2a1b3d', padding: { x: 22, y: 8 }, fontStyle: 'bold' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor('#ffe066'));
      t.on('pointerout', () => t.setColor('#ffffff'));
      t.on('pointerdown', () => {
        sfx.unlock();
        cb();
      });
      return t;
    };
    btn(280, 'Enter  開始遊戲', () => this.start('level01'));
    btn(345, 'T  機制測試關', () => this.start('mechanics-test'));
    btn(410, 'H  操作說明', () => this.toggleHelp());

    this.info = this.add.text(GAME_W / 2, 480, '', { fontFamily: FONT, fontSize: '20px', color: '#2a1b3d', align: 'center', lineSpacing: 6 }).setOrigin(0.5);
    this.help = this.add
      .text(GAME_W / 2, GAME_H / 2, '', { fontFamily: FONT, fontSize: '20px', color: '#ffffff', backgroundColor: '#2a1b3dee', padding: { x: 30, y: 24 }, align: 'left', lineSpacing: 8 })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);
    this.art = this.add.graphics();

    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => this.onKey(ev));
    this.refresh();
  }

  override update(_t: number, dt: number): void {
    this.t += dt / 1000;
    music.tempo = 1;
    music.want('menu');
    const g = this.art;
    g.clear();
    const px = 200 + ((this.t * 90) % 900);
    drawGardener(g, px, 600, { facing: 1, walkPhase: px * 0.25, climbing: false, falling: false, action: 'none', actionT: 0, blink: false, hurt: false });
    drawEnemy(g, 'red', px - 120, 600, { t: this.t, dir: 1, trapped: false, falling: false, stunned: false, climbing: false });
    drawEnemy(g, 'green', 1060, 560, { t: this.t, dir: -1, trapped: false, falling: false, stunned: false, climbing: false });
    drawEnemy(g, 'blue', 1150, 600, { t: this.t, dir: -1, trapped: false, falling: false, stunned: false, climbing: false });
  }

  private onKey(ev: KeyboardEvent): void {
    sfx.unlock();
    if (this.showHelp && (ev.code === 'Escape' || ev.code === 'KeyH' || ev.code === 'Enter')) {
      this.toggleHelp();
      return;
    }
    switch (ev.code) {
      case 'Enter':
      case 'NumpadEnter':
      case 'Space':
        this.start('level01');
        break;
      case 'KeyT':
        this.start('mechanics-test');
        break;
      case 'KeyH':
      case 'F1':
        this.toggleHelp();
        break;
      case 'KeyB':
        settings.music = !settings.music;
        saveSettings();
        this.refresh();
        break;
      case 'KeyC':
        settings.keymap = settings.keymap === 'modern' ? 'classic' : 'modern';
        saveSettings();
        sfx.blip();
        this.refresh();
        break;
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Digit4':
        settings.speed = SPEED_OPTIONS[Number(ev.code.slice(5)) - 1]!;
        saveSettings();
        sfx.blip();
        this.refresh();
        break;
    }
  }

  private start(levelId: string): void {
    this.scene.start('GameScene', { levelId });
  }

  private toggleHelp(): void {
    this.showHelp = !this.showHelp;
    this.help.setVisible(this.showHelp);
    this.refresh();
  }

  private refresh(): void {
    const km = KEYMAP_HELP[settings.keymap];
    this.info.setText(
      [
        `鍵位：${settings.keymap === 'modern' ? '現代（方向鍵/WASD + J 左 / K 右：挖・補・敲）' : '原典（I J K M 移動 + A 左 / S 右：挖・補・敲）'}　［C 切換］`,
        `世界速度：${settings.speed.toFixed(2)}x　［1 = 1.0　2 = 1.25　3 = 1.5　4 = 2.0］`,
        `背景音樂：${settings.music ? '開' : '關'}　［B 切換］　（按任一鍵後開始播放）`,
      ].join('\n'),
    );
    this.help.setText(
      [
        '操作說明',
        '',
        `移動：${km.move}　　爬梯：${km.climb}（沒有跳躍）`,
        `${km.digLeft}：對左邊一格　　${km.digRight}：對右邊一格（每個動作 6 下）`,
        '　地板 → 挖洞　已經有洞 → 補起來　困著敵人 → 敲下去',
        '注意：走到挖好的洞上，自己也會掉到下一層！',
        '',
        '紅蘋果：連續掉 1 層消滅（每層 100 分）',
        '綠蝴蝶：連續掉 2 層消滅（每層 200 分）',
        '藍面具：連續掉 3 層消滅（每層 300 分）',
        '多層掉落需要下面樓層「同一直行」也有洞。',
        '',
        '遊戲中：Esc/P 暫停　1–4 調速　R 重來　N 靜音　B 音樂開關',
        '',
        'H / Esc 關閉',
      ].join('\n'),
    );
  }
}
