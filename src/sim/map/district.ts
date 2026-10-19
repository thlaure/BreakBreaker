import type { Vec } from '../types';

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

export const DISTRICT: District = {
  tiles: 48,
  buildings: [
    R(4, 4, 8, 5), // 0: school (north-west)
    R(15, 3, 6, 4),
    R(26, 4, 7, 5),
    R(36, 3, 8, 5),
    R(4, 14, 6, 5),
    R(12, 15, 4, 4),
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
};
