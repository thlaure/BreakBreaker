import Phaser from 'phaser';

/** Small runtime textures (particles, rocks, station icon) – no extra image files needed. */
export function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('px')) return;
  const g = scene.make.graphics({}, false);
  g.fillStyle(0xffffff, 1).fillRect(0, 0, 2, 2);
  g.generateTexture('px', 2, 2);
  g.clear();
  // station: white plate with green cross
  g.fillStyle(0x14121c, 1).fillRoundedRect(0, 0, 20, 20, 4);
  g.fillStyle(0xf4f4f0, 1).fillRoundedRect(1, 1, 18, 18, 3);
  g.fillStyle(0x23a84a, 1).fillRect(8, 4, 4, 12).fillRect(4, 8, 12, 4);
  g.generateTexture('station', 20, 20);
  g.destroy();
}

const ROCK_SHAPES: Record<'caillou' | 'pave' | 'brique', { w: number; h: number; color: number; round: boolean }> = {
  caillou: { w: 8, h: 7, color: 0x9a948c, round: true },
  pave: { w: 8, h: 8, color: 0x7d8290, round: false },
  brique: { w: 12, h: 6, color: 0xa4553a, round: false },
};

/** `rock_<kind>` (flying) and `rock_<kind>_o` (on the ground, 1-px white outline). */
export function makeRockTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('rock_caillou')) return;
  const g = scene.make.graphics({}, false);
  for (const [kind, s] of Object.entries(ROCK_SHAPES)) {
    for (const outlined of [false, true]) {
      g.clear();
      const o = outlined ? 1 : 0;
      const shape = (x: number, y: number, w: number, h: number): void => {
        if (s.round) g.fillEllipse(x + w / 2, y + h / 2, w, h);
        else g.fillRect(x, y, w, h);
      };
      if (outlined) {
        g.fillStyle(0xffffff, 1);
        shape(0, 0, s.w + 2, s.h + 2);
      }
      g.fillStyle(s.color, 1);
      shape(o, o, s.w, s.h);
      g.fillStyle(0x000000, 0.25).fillRect(o, o + s.h - 1, s.w, 1);
      g.generateTexture(`rock_${kind}${outlined ? '_o' : ''}`, s.w + 2 * o, s.h + 2 * o);
    }
  }
  g.destroy();
}
