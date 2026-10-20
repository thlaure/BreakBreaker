import type { CasseKind, TargetId, Vec } from '../types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface TargetDef {
  id: TargetId;
  kind: CasseKind;
  footprint: Rect;
  attackPoints: Vec[];
  door: Vec;
  /** Props (cars, bus stop) are solid obstacles outside `buildings`. */
  prop: boolean;
  maxHp: number;
}

export interface District {
  tiles: 48;
  buildings: Rect[];
  trunks: Circle[];
  peacefulGroup: { area: Rect; members: Vec[] };
  school: { footprint: Rect; facadePoints: Vec[]; zone: Circle; door: Vec };
  stations: Vec[];
  playerSpawn: Vec;
  hostileSpawns: Vec[];
  rescueSites: Vec[];
  targets: TargetDef[];
  kitSites: Vec[];
  /**
   * Equestrian monument (§11): a solid stone `plinth` (like a prop), the capture `zone`, the flag `mast` (top of the
   * plinth, where the rider's flag flies) and the free tiles around the plinth where occupiers stand (`attackPoints`).
   */
  monument: { plinth: Rect; zone: Circle; mast: Vec; attackPoints: Vec[] };
}

const T = 32;
/** Tile-aligned rect from tile units. */
const R = (tx: number, ty: number, tw: number, th: number): Rect => ({
  x: tx * T,
  y: ty * T,
  w: tw * T,
  h: th * T,
});
/** Centre of a tile in pixels. */
const C = (tx: number, ty: number): Vec => ({ x: tx * T + T / 2, y: ty * T + T / 2 });

function prop(id: TargetId, kind: CasseKind, footprint: Rect, attackPoints: Vec[]): TargetDef {
  return {
    id,
    kind,
    footprint,
    attackPoints,
    door: { x: footprint.x + footprint.w / 2, y: footprint.y + footprint.h / 2 },
    prop: true,
    maxHp: 60,
  };
}

export const DISTRICT: District = {
  tiles: 48,
  buildings: [
    R(4, 4, 8, 5), // 0: school (north-west)
    R(15, 3, 6, 4),
    R(26, 4, 7, 5),
    R(36, 3, 8, 5),
    R(4, 14, 6, 5),
    R(12, 15, 4, 4), // 5: retro video-game shop
    R(14, 26, 6, 5),
    R(30, 28, 7, 5),
    R(38, 16, 6, 6),
    R(6, 30, 7, 6),
    R(22, 38, 8, 5),
    R(38, 36, 6, 6),
  ],
  trunks: [
    { ...C(10, 11), r: 6 },
    { ...C(22, 12), r: 6 },
    { ...C(34, 12), r: 6 },
    { ...C(30, 22), r: 6 },
    { ...C(18, 34), r: 6 },
    { ...C(42, 30), r: 6 },
    { ...C(10, 44), r: 6 },
    { ...C(32, 44), r: 6 },
  ],
  peacefulGroup: {
    area: R(24, 18, 4, 3),
    members: [
      { x: 792, y: 600 },
      { x: 832, y: 600 },
      { x: 872, y: 600 },
      { x: 792, y: 648 },
      { x: 832, y: 648 },
      { x: 872, y: 648 },
    ],
  },
  school: {
    footprint: R(4, 4, 8, 5),
    facadePoints: [C(5, 9), C(6, 9), C(8, 9), C(9, 9)],
    zone: { x: 240, y: 320, r: 96 },
    door: C(7, 9),
  },
  stations: [C(23, 25), C(44, 24)],
  playerSpawn: C(20, 22),
  hostileSpawns: [C(24, 0), C(47, 12), C(47, 30), C(24, 47), C(0, 34), C(0, 16)],
  rescueSites: [C(10, 24), C(34, 35), C(44, 10)],
  targets: [
    {
      id: 'school',
      kind: 'school',
      footprint: R(4, 4, 8, 5),
      attackPoints: [C(5, 9), C(6, 9), C(8, 9), C(9, 9)],
      door: C(7, 9),
      prop: false,
      maxHp: 100,
    },
    prop('car1', 'car', R(17, 10, 2, 1), [C(16, 10), C(19, 10), C(17, 11), C(18, 11)]),
    prop('car2', 'car', R(26, 34, 2, 1), [C(25, 34), C(28, 34), C(26, 35), C(27, 35)]),
    prop('busStop', 'busStop', R(28, 13, 2, 1), [C(27, 13), C(30, 13), C(28, 14), C(29, 14)]),
    {
      // the retro video-game shop (« JEUX RÉTRO ») on building 5
      id: 'shop',
      kind: 'shop',
      footprint: R(12, 15, 4, 4),
      attackPoints: [C(12, 19), C(13, 19), C(15, 19)],
      door: C(14, 19),
      prop: false,
      maxHp: 100,
    },
  ],
  kitSites: [C(18, 12), C(28, 25), C(8, 26), C(36, 44)],
  monument: {
    plinth: R(33, 21, 2, 2),
    zone: { x: 1088, y: 704, r: 112 },
    mast: { x: 1088, y: 672 },
    attackPoints: [C(32, 21), C(32, 22), C(35, 21), C(35, 22), C(33, 23), C(34, 23), C(33, 20), C(34, 20)],
  },
};
