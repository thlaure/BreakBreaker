import { t } from '../../content/i18n';
import type { PrisonInmate } from '../../sim/prison';
import { rioterSheet } from './roleLook';

/** The counter on the prison's roof, in the current language. */
export function jailedText(n: number): string {
  return t('world.prison.jailed', { n });
}

/**
 * The count the counter shows: the sim's jailed Caïds minus those still riding the jail van (they enter the prison when
 * the van drops them off at the gate); never below 0.
 */
export function shownJailed(jailed: number, riding: number): number {
  return Math.max(0, jailed - riding);
}

/**
 * Caïds still riding a jail van: each jailed Caïd has one pickup and one drop-off run, so the drop-offs not through the
 * gate yet (the pickup is the same Caïd, never counted twice).
 */
export function ridingCount(runs: readonly { kind: 'pickup' | 'drop'; inside: boolean }[]): number {
  let n = 0;
  for (const r of runs) if (r.kind === 'drop' && !r.inside) n++;
  return n;
}

/** The jail van's run (ms): drives in, stops (the Caïd hops in or out), drives off fading. */
export const VAN_IN_MS = 450;
export const VAN_STOP_MS = 700;
export const VAN_OUT_MS = 450;
export const VAN_RUN_MS = VAN_IN_MS + VAN_STOP_MS + VAN_OUT_MS;
/** How far (px) the van drives in and out. */
export const VAN_RUN_PX = 90;
/** The pickup starts once the Caïd's fall has played. */
export const VAN_PICKUP_DELAY_MS = 600;
/** Between the pickup's end and the drop-off at the prison gate. */
export const VAN_TRANSFER_MS = 300;
/** The Caïd hops this long during the stop (after a short wait for the doors). */
export const HOP_START = 0.2;
export const HOP_END = 0.75;

export interface VanPose {
  /** Offset (px, along x) from the stop point. */
  dx: number;
  alpha: number;
  stage: 'in' | 'stop' | 'out';
  /** 0..1 through the stage. */
  t: number;
}

/**
 * The van `age` ms into its run, driving toward `dir` (+1 east, -1 west): it comes from VAN_RUN_PX behind the stop
 * point (easing out), stays VAN_STOP_MS, then drives VAN_RUN_PX on (easing in) while fading. Null before or after.
 */
export function vanPose(age: number, dir: 1 | -1): VanPose | null {
  if (age < 0 || age >= VAN_RUN_MS) return null;
  if (age < VAN_IN_MS) {
    const t = age / VAN_IN_MS;
    const e = 1 - (1 - t) * (1 - t);
    return { dx: -dir * VAN_RUN_PX * (1 - e), alpha: Math.min(1, age / 150), stage: 'in', t };
  }
  if (age < VAN_IN_MS + VAN_STOP_MS) return { dx: 0, alpha: 1, stage: 'stop', t: (age - VAN_IN_MS) / VAN_STOP_MS };
  const t = (age - VAN_IN_MS - VAN_STOP_MS) / VAN_OUT_MS;
  return { dx: dir * VAN_RUN_PX * t * t, alpha: 1 - t, stage: 'out', t };
}

/** Progress 0..1 of the Caïd's hop during a stop at `t` (0 before HOP_START, 1 after HOP_END). */
export function hopProgress(stage: VanPose['stage'], t: number): number {
  if (stage === 'in') return 0;
  if (stage === 'out') return 1;
  return Math.max(0, Math.min(1, (t - HOP_START) / (HOP_END - HOP_START)));
}

/** « 1 Caïd libéré » / « 3 Caïds libérés », in the current language. */
export function releasedText(n: number): string {
  return t('world.prison.released', { n });
}

/** The searchlight's sweep angle (radians, 0 = east, π/2 = south) at `nowMs`: back and forth over the street below. */
export const SWEEP_MS = 5200;
export function sweepAngle(nowMs: number): number {
  const k = (nowMs % SWEEP_MS) / SWEEP_MS;
  const tri = k < 0.5 ? k * 2 : 2 - k * 2;
  return Math.PI * (0.18 + 0.5 * tri);
}

/** The render hides the KO'd Caïd's body (the van loads him) when his hop into the pickup van starts. */
export const PICKUP_HOP_MS = VAN_PICKUP_DELAY_MS + VAN_IN_MS + HOP_START * VAN_STOP_MS;

/**
 * THE SKIN HOOK. The texture (character sheet) an inmate is drawn with in the prison yard: the Caïd look he wore on the
 * street (`caid_<caidSkinOf(lifeId)>`, the same as rioterSheet for a boss: the inmate keeps the lifeId he was jailed
 * with). PrisonLayer draws every inmate with this key and plays its walk-row frames (LPC layout, see caidSheets.ts).
 */
export function inmateTextureKey(inmate: Pick<PrisonInmate, 'id' | 'variant' | 'lifeId'>): string {
  return rioterSheet(inmate.variant, 'boss', inmate.lifeId);
}

/**
 * The exercise yard in the prison roof's middle, where the inmates stand: px from the prison footprint's top-left
 * (it sits on the roof, clear of the watchtower, the vents, the sign and the counter).
 */
export const YARD = { x: 36, y: -12, w: 96, h: 110 } as const;
/** Inmates shown in the yard (the others are a « +N » label), in rows of INMATE_COLS. */
export const INMATE_SLOTS = 8;
export const INMATE_COLS = 4;
/** px between two inmates of a row; feet of the back and front rows (from YARD.y). */
const SLOT_DX = 22;
const ROW_FEET = [58, 106] as const;
/** Sprite scale of an inmate (the Caïd is ×1.5 on the street; ×1 fits 4 abreast in the yard). */
export const INMATE_SCALE = 1;

/**
 * Where the first `count` inmates stand (feet, px from the footprint's top-left): back row first, each row centred,
 * at most INMATE_SLOTS; `extra` = how many more are in the cells (« +N »).
 */
export function inmateLayout(count: number): { slots: { x: number; y: number }[]; extra: number } {
  const n = Math.max(0, Math.min(INMATE_SLOTS, count));
  const slots: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / INMATE_COLS);
    const inRow = Math.min(INMATE_COLS, n - row * INMATE_COLS);
    const col = i % INMATE_COLS;
    slots.push({ x: YARD.x + YARD.w / 2 + (col - (inRow - 1) / 2) * SLOT_DX, y: YARD.y + ROW_FEET[row]! });
  }
  return { slots, extra: Math.max(0, count - n) };
}

/** « +3 »: inmates in the cells beyond the yard's slots. */
export function extraText(n: number): string {
  return `+${n}`;
}

/**
 * An inmate's idle at `nowMs`: facing the camera ('s') with a 1-px bob, now and then a glance aside ('e' / 'w'),
 * out of step between ids; still under prefers-reduced-motion.
 */
export function inmatePose(nowMs: number, id: number, reduced: boolean): { dir: 's' | 'e' | 'w'; bob: 0 | -1 } {
  if (reduced) return { dir: 's', bob: 0 };
  const bob = Math.sin(nowMs / 520 + id * 1.7) > 0.35 ? -1 : 0;
  const period = 4200 + (id % 5) * 370;
  const k = ((nowMs + id * 911) % period) / period;
  const dir = k >= 0.7 && k < 0.82 ? (id % 2 === 0 ? 'e' : 'w') : 's';
  return { dir, bob };
}

/** The breakout: the yard's inmates run out to the gate over ESCAPE_MS (the sim's released Caïds take over there). */
export const ESCAPE_MS = 500;
export function escapeProgress(age: number): number {
  return Math.max(0, Math.min(1, age / ESCAPE_MS));
}
