import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const DIR = 'src/game/render';
const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'));
const uses = (re: RegExp): string[] => files.filter((f) => re.test(readFileSync(`${DIR}/${f}`, 'utf8')));

describe('batch-friendly render code', () => {
  test('no TileSprite: use tiledImage (a TileSprite has its own pipeline and breaks the batch)', () => {
    expect(uses(/\.tileSprite\(/)).toEqual([]);
  });

  test('rectangle shapes only where the fill colour pulses (decor.ts sign glow), everywhere else rectImage', () => {
    expect(uses(/add\s*\.rectangle\(/)).toEqual(['decor.ts']);
  });

  test('no flat ellipse shape for shadows and static glows (ellipseImage); the few pulsing glows may keep theirs', () => {
    const allowed = [
      'buildingFronts.ts',
      'items.ts',
      'pickups.ts',
      'saunaFront.ts',
      'stageFront.ts',
      'targetView.ts',
      'weapons.ts',
      'world.ts',
      'fx.ts',
    ];
    for (const f of uses(/add\s*\.ellipse\(/)) expect(allowed, f).toContain(f);
  });
});
