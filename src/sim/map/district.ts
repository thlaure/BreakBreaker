import { CONFIG } from '../config';
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
  /** Props (cars, bus stop, kiosk, phone booths) are solid obstacles outside `buildings`. */
  prop: boolean;
  maxHp: number;
  /** Share of maxHp a toolbox rebuild gives back (absent: all of it). */
  repairShare?: number;
}

/** Decor fronts (render only): ordinary solid buildings, never targets, no interaction. */
export type DecorId = 'caf' | 'pouletCrousti' | 'chateau' | 'sauna';
export interface DecorDef {
  id: DecorId;
  /** The sign text painted on its roof edge. */
  sign: string;
  /** One of DISTRICT.buildings. */
  footprint: Rect;
  /** Centre of the street tile in front of its door (on the row below the front). */
  door: Vec;
}

export interface District {
  tiles: 48;
  buildings: Rect[];
  trunks: Circle[];
  /** Peaceful protesters on the main square: each `area` is solid, its `members` stand inside it. */
  peacefulGroups: { area: Rect; members: Vec[] }[];
  school: { footprint: Rect; facadePoints: Vec[]; zone: Circle; door: Vec };
  stations: Vec[];
  playerSpawn: Vec;
  hostileSpawns: Vec[];
  rescueSites: Vec[];
  targets: TargetDef[];
  /** Decor fronts on free buildings (never in `targets`: never attacked, burnt or repaired). */
  decor: DecorDef[];
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

/** A peaceful group on a 3×2-tile area: six members, one per tile centre. */
function group(tx: number, ty: number): { area: Rect; members: Vec[] } {
  const members: Vec[] = [];
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 3; dx++) members.push(C(tx + dx, ty + dy));
  return { area: R(tx, ty, 3, 2), members };
}

/** A 100 hp building target on one of DISTRICT.buildings (its footprint), attacked from the street in front of `door`. */
function building(id: TargetId, kind: CasseKind, footprint: Rect, attackPoints: Vec[], door: Vec): TargetDef {
  return { id, kind, footprint, attackPoints, door, prop: false, maxHp: 100 };
}

export const DISTRICT: District = {
  tiles: 48,
  buildings: [
    R(4, 4, 8, 5), // 0: school (north-west)
    R(14, 27, 6, 4), // 1: town hall (south-west of the main square)
    R(26, 4, 7, 5), // 2: « CAF » office (decor)
    R(36, 3, 8, 5),
    R(4, 14, 6, 5),
    R(12, 15, 4, 4), // 5: retro video-game shop
    R(25, 25, 4, 5), // 6: church (south-east of the central plaza, the heart of the main square)
    R(27, 14, 6, 4), // 7: château (decor, north-east of the square, its balcony facing it)
    R(38, 16, 6, 6), // 8: « POULET CROUSTI » fast food (decor)
    R(6, 30, 7, 6), // 9: nursery school (south-west)
    R(22, 38, 8, 5), // 10: library (south)
    R(38, 36, 6, 6), // 11: prison (south-east)
    R(31, 29, 4, 3), // 12: sauna (decor, south-east of the square)
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
  // three peaceful groups on the main square: north-west, east and south-west of the church (the plaza between the
  // town hall, the church and the château stays open)
  peacefulGroups: [group(22, 16), group(30, 25), group(22, 32)],
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
    // the bus stop on the north street, between the CAF and the town hall (the château took its old block)
    prop('busStop', 'busStop', R(23, 11, 2, 1), [C(22, 11), C(25, 11), C(23, 12), C(24, 12)]),
    {
      // the retro video-game shop (« MICRO RÉTRO ») on building 5
      id: 'shop',
      kind: 'shop',
      footprint: R(12, 15, 4, 4),
      attackPoints: [C(12, 19), C(13, 19), C(15, 19)],
      door: C(14, 19),
      prop: false,
      maxHp: 100,
    },
    // Phase C places (§12.2): open from round 5 (nursery, kiosk), 7 (town hall), 9 (library), CONFIG.casse.fromRound
    building('nursery', 'nursery', R(6, 30, 7, 6), [C(7, 36), C(8, 36), C(10, 36), C(11, 36)], C(9, 36)),
    // the newspaper kiosk on the open ground south-east, a free tile all around it
    prop('kiosk', 'kiosk', R(34, 40, 2, 1), [C(33, 40), C(36, 40), C(34, 41), C(35, 41)]),
    building('townHall', 'townHall', R(14, 27, 6, 4), [C(15, 31), C(16, 31), C(18, 31), C(19, 31)], C(17, 31)),
    building('library', 'library', R(22, 38, 8, 5), [C(24, 43), C(25, 43), C(27, 43), C(28, 43)], C(26, 43)),
    // the two phone booths side by side on the centre-west plaza (red: fire truck, blue: police), a free tile all
    // around the island; open to attacks from round 3 (CONFIG.casse.fromRound.booth). Paul calls from the street row
    // in front (row 23), within CONFIG.services.callRange of the booth's door (its centre).
    prop('boothRed', 'booth', R(4, 22, 1, 1), [C(3, 22), C(4, 23), C(4, 21)]),
    prop('boothBlue', 'booth', R(5, 22, 1, 1), [C(6, 22), C(5, 23), C(5, 21)]),
    // the prison on the south-east block (building 11): CONFIG.prison.hp, open from round 4, rebuilt to 60 % of its hp;
    // its door on the street row below (row 42), its guards' posts in src/sim/prison.ts
    {
      ...building('prison', 'prison', R(38, 36, 6, 6), [C(39, 42), C(40, 42), C(42, 42), C(43, 42)], C(41, 42)),
      maxHp: CONFIG.prison.hp,
      repairShare: CONFIG.prison.repairShare,
    },
    // the church at the heart of the main square (building 6): CONFIG.church.hp, open from round 3, rebuilt to 60 %;
    // attacked from the street row below its front wall (row 30), its arched door in the middle of it
    {
      ...building('church', 'church', R(25, 25, 4, 5), [C(25, 30), C(26, 30), C(27, 30), C(28, 30)], C(27, 30)),
      maxHp: CONFIG.church.hp,
      repairShare: CONFIG.church.repairShare,
    },
  ],
  // decor only: solid buildings like the others, drawn with their own front (src/game/render/decor.ts)
  decor: [
    { id: 'caf', sign: 'CAF', footprint: R(26, 4, 7, 5), door: C(29, 9) },
    { id: 'pouletCrousti', sign: 'POULET CROUSTI', footprint: R(38, 16, 6, 6), door: C(41, 22) },
    { id: 'chateau', sign: 'CHÂTEAU', footprint: R(27, 14, 6, 4), door: C(30, 18) },
    { id: 'sauna', sign: 'SAUNA', footprint: R(31, 29, 4, 3), door: C(33, 32) },
  ],
  kitSites: [C(18, 12), C(23, 28), C(8, 26), C(36, 44)],
  monument: {
    plinth: R(33, 21, 2, 2),
    zone: { x: 1088, y: 704, r: 112 },
    mast: { x: 1088, y: 672 },
    attackPoints: [C(32, 21), C(32, 22), C(35, 21), C(35, 22), C(33, 23), C(34, 23), C(33, 20), C(34, 20)],
  },
};

/** Where a target's score changes show (saved, lost, extinguished, repaired): its door (a prop's footprint centre). */
export function targetDoor(id: TargetId): Vec {
  const def = DISTRICT.targets.find((t) => t.id === id);
  if (!def) throw new Error(`unknown target ${id}`);
  return { x: def.door.x, y: def.door.y };
}

/** Where the monument's score changes show (captured, defended, lost): the centre of its capture zone. */
export function monumentCentre(): Vec {
  return { x: DISTRICT.monument.zone.x, y: DISTRICT.monument.zone.y };
}
