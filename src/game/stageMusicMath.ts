/**
 * Pure data and curves of the stage music (render only): the volume against the distance to the stage, and the notes
 * of the original heavy-metal riff loop played by `StageRiff` (audioStage.ts).
 */
import { DISTRICT } from '../sim/map/district';

/** Inaudible from 12 tiles away. */
export const STAGE_FAR_PX = 384;
/** Full volume within 4 tiles. */
export const STAGE_NEAR_PX = 128;

/** Centre of the stage: building 3, R(36,3,8,5) (north-east). */
const STAGE_RECT = DISTRICT.buildings[3]!;
export const STAGE_CENTER: Readonly<{ x: number; y: number }> = {
  x: STAGE_RECT.x + STAGE_RECT.w / 2,
  y: STAGE_RECT.y + STAGE_RECT.h / 2,
};

/** Distance in px from a point (Paul's feet) to the stage centre. */
export function stageDistance(pos: { x: number; y: number }): number {
  return Math.hypot(pos.x - STAGE_CENTER.x, pos.y - STAGE_CENTER.y);
}

/**
 * Volume 0..1 for a distance in px: 1 within STAGE_NEAR_PX, 0 from STAGE_FAR_PX, a smoothstep between (monotonic).
 * NaN counts as far (silent), a negative distance as near.
 */
export function stageVolume(distPx: number): number {
  if (Number.isNaN(distPx) || distPx >= STAGE_FAR_PX) return 0;
  if (distPx <= STAGE_NEAR_PX) return 1;
  const u = (STAGE_FAR_PX - distPx) / (STAGE_FAR_PX - STAGE_NEAR_PX);
  return Math.max(0, Math.min(1, u * u * (3 - 2 * u)));
}

/** One sixteenth note of the loop. `guitar` is the power chord root (MIDI); `mute` = palm-muted chug. */
export interface RiffStep {
  guitar: number | null;
  mute: boolean;
  bass: number | null;
  kick: boolean;
  snare: boolean;
  hat: boolean;
}

export const RIFF_TEMPO_BPM = 150;
/** One step = a sixteenth note. */
export const RIFF_STEP_SEC = 60 / RIFF_TEMPO_BPM / 4;

// MIDI: E2 = 40, F#2 = 42, G2 = 43, A2 = 45, B2 = 47.
const E = 40;
type Row = [guitar: number | null, mute: boolean, kick: boolean, snare: boolean];
/**
 * Original one-bar loop in E minor (written for this game): open E accent, palm-muted E chugs answered by a G and an
 * A stab, then a descending B-A-G-F# turnaround that leads back to E. Kick on the chugs, snare on beats 2 and 4,
 * hi-hat on eighth notes; the bass doubles the guitar root an octave lower.
 */
const ROWS: Row[] = [
  [E, false, true, false],
  [E, true, false, false],
  [E, true, true, false],
  [E, true, false, false],
  [43, false, false, true],
  [E, true, false, false],
  [E, true, true, false],
  [45, false, false, false],
  [E, true, true, false],
  [E, true, false, false],
  [E, true, true, false],
  [null, false, false, false],
  [47, false, false, true],
  [45, false, false, false],
  [43, false, true, false],
  [42, false, false, false],
];

export const RIFF_STEPS: readonly RiffStep[] = ROWS.map(([guitar, mute, kick, snare], i) => ({
  guitar,
  mute,
  bass: guitar === null ? null : guitar - 12,
  kick,
  snare,
  hat: i % 2 === 0,
}));

export function riffSteps(): readonly RiffStep[] {
  return RIFF_STEPS;
}

/** Length of one loop in seconds. */
export function riffLoopSec(): number {
  return RIFF_STEPS.length * RIFF_STEP_SEC;
}

/** Frequency in Hz of a MIDI note. */
export function midiHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/** Soft-clipping curve (tanh) of the guitar waveshaper: `drive` > 1 saturates more. */
export function driveCurve(samples: number, drive: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(samples);
  const norm = Math.tanh(drive);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / norm;
  }
  return curve;
}
