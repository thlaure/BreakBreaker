/** Character sheet keys (Task 11). Every sheet follows `layout.json`. */
export const CHAR_SHEETS = [
  'paul',
  'rioter_classic_a',
  'rioter_classic_b',
  'rioter_palestinian_a',
  'rioter_palestinian_b',
  'rioter_antifa_a',
  'rioter_antifa_b',
  'protester_1',
  'protester_2',
  'protester_3',
  'protester_4',
  'elder_1',
  'elder_2',
] as const;
export type CharSheet = (typeof CHAR_SHEETS)[number];

export const SFX = ['hit1', 'hit2', 'hit3', 'throw', 'land', 'pickup', 'hurt', 'fire_loop', 'alarm', 'ui_click'] as const;

/** Shape of public/assets/chars/layout.json (loaded at boot under the cache key `layout`). */
export interface CharLayout {
  frame: number;
  anims: {
    walk: { rows: Record<Dir, number>; frames: number };
    slash: { rows: Record<Dir, number>; frames: number };
    hurt: { row: number; frames: number };
  };
}
export type Dir = 'n' | 'w' | 's' | 'e';

/** Tile frames, see public/assets/tiles/README.md. `city`/`urban` are 16 px sheets drawn ×2. */
export const TILE = {
  streets: { road: 170, sidewalk: 11 },
  city: {
    roofs: [38, 46, 54, 62],
    wallRed: 186,
    wallGrey: 5 * 37 + 9,
    pavers: 741,
    grass: 888,
    treeTop: 10 * 37 + 31, // green tall tree, col 31
    treeTrunk: 11 * 37 + 31,
  },
} as const;

/** flags.png frames (16×12). */
export const FLAG = { fr: 0, palestinian: 1, antifa: 2 } as const;

export const BASE = '/assets/';
