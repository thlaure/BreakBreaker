/** The counter on the prison's roof. */
export function jailedText(n: number): string {
  return `Caïds enfermés : ${n}`;
}

/**
 * The count the counter shows: the sim's jailed Caïds minus those still riding the jail van (they enter the prison when
 * the van drops them off at the gate); never below 0.
 */
export function shownJailed(jailed: number, riding: number): number {
  return Math.max(0, jailed - riding);
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

/** « 1 Caïd libéré » / « 3 Caïds libérés ». */
export function releasedText(n: number): string {
  return n === 1 ? '1 Caïd libéré' : `${n} Caïds libérés`;
}

/** The searchlight's sweep angle (radians, 0 = east, π/2 = south) at `nowMs`: back and forth over the street below. */
export const SWEEP_MS = 5200;
export function sweepAngle(nowMs: number): number {
  const k = (nowMs % SWEEP_MS) / SWEEP_MS;
  const tri = k < 0.5 ? k * 2 : 2 - k * 2;
  return Math.PI * (0.18 + 0.5 * tri);
}
