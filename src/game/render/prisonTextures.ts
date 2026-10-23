import Phaser from 'phaser';

const OUTLINE = 0x14121c;

type Fill = (c: number, x: number, y: number, w: number, h: number, a?: number) => void;

/** The jail van (`jail_van_<0|1>`, two flashing-light frames): side view facing east, 36 × 20 logical, west = flipped. */
export function makePrisonTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('jail_van_0')) return;
  const g = scene.make.graphics({}, false);
  const r: Fill = (c, x, y, w, h, a = 1) => {
    g.fillStyle(c, a).fillRect(x, y, w, h);
  };
  for (const f of [0, 1] as const) {
    g.clear();
    // white box body, a steel band, the cab at the front (east)
    r(OUTLINE, 0, 3, 36, 14);
    r(0xe8e8ec, 1, 4, 34, 12);
    r(0xffffff, 1, 4, 34, 1);
    r(0xb8bcc4, 1, 14, 34, 2);
    r(0x3a3f48, 1, 10, 34, 2);
    r(OUTLINE, 26, 4, 1, 10); // cab seam
    r(0x9fd8ef, 28, 5, 6, 4); // windshield
    r(0xe6f7ff, 29, 5, 2, 1);
    r(OUTLINE, 3, 4, 1, 10); // rear door seam
    // barred little windows of the cells in the back
    for (const x of [6, 15]) {
      r(OUTLINE, x, 5, 8, 4);
      r(0x1d2230, x + 1, 6, 6, 2);
      r(0xc8ccd4, x + 2, 6, 1, 2);
      r(0xc8ccd4, x + 5, 6, 1, 2);
    }
    // light bar on the roof (blue lights, flashing in turn)
    r(OUTLINE, 20, 0, 9, 4);
    r(f === 0 ? 0x8adcff : 0x24407a, 21, 1, 3, 2);
    r(f === 1 ? 0x8adcff : 0x24407a, 25, 1, 3, 2);
    r(0xffe066, 34, 12, 2, 2); // headlight
    r(0xff3b30, 0, 12, 1, 2); // tail light
    for (const wx of [4, 25]) {
      r(OUTLINE, wx + 1, 14, 6, 6);
      r(OUTLINE, wx, 15, 8, 4);
      r(0x1d1a24, wx + 2, 15, 4, 4);
      r(0x9aa0aa, wx + 3, 16, 2, 2);
    }
    g.generateTexture(`jail_van_${f}`, 36, 20);
  }
  g.destroy();
}
