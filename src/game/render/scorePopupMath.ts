/**
 * Pure helpers of the floating score popups (« +1 » green, « −3 » red rising from where points were won or lost).
 * No Phaser here so they can be unit-tested; the Phaser layer is scorePopups.ts.
 */

/** Life of a popup (ms): pops, rises POPUP_RISE_PX with an ease-out, fades over the last POPUP_FADE_SHARE. */
export const POPUP_MS = 1000;
/** prefers-reduced-motion: no pop, no rise; it appears and fades out over POPUP_MS_REDUCED. */
export const POPUP_MS_REDUCED = 600;
export const POPUP_RISE_PX = 28;
export const POPUP_POP_MS = 80;
export const POPUP_FADE_SHARE = 0.4;
/** Batch stagger: each popup of a batch starts POPUP_STAGGER_MS × its rank later (rank capped at POPUP_MAX_RANK). */
export const POPUP_STAGGER_MS = 40;
export const POPUP_MAX_RANK = 7;
/** Hard cap of popups alive (the oldest is dropped). */
export const POPUP_CAP = 24;

export const POPUP_GAIN = '#7bd88f';
export const POPUP_LOSS = '#ff7b72';
export const POPUP_INK = '#14121c';

export interface PopupStyle {
  /**
   * « +N » or « -N »: the ASCII hyphen-minus, drawn by Press Start 2P as a full-width pixel minus (the font has no
   * U+2212 glyph, which would fall back to a blurry system font).
   */
  text: string;
  color: string;
  /** Font size in px (world px, before the zoom scale). */
  size: number;
}

/** Font size by |points|: 1 → 8 px, 2–4 → 10 px, 5–7 → 12 px, ≥ 8 → 14 px. */
export function popupSize(magnitude: number): number {
  const m = Math.abs(magnitude);
  return m >= 8 ? 14 : m >= 5 ? 12 : m >= 2 ? 10 : 8;
}

/** Text, colour and size of the popup for a signed score change (green gain, red loss). */
export function popupStyle(points: number): PopupStyle {
  const gain = points >= 0;
  return {
    text: `${gain ? '+' : '-'}${Math.abs(points)}`,
    color: gain ? POPUP_GAIN : POPUP_LOSS,
    size: popupSize(points),
  };
}

export interface PopupPose {
  /** Vertical offset (whole px, ≤ 0 = up). */
  dy: number;
  alpha: number;
  scale: number;
  /** The popup's life is over. */
  done: boolean;
}

/**
 * Pose `t` ms after the popup started (t < 0: not started yet, hidden). The pop is a short scale-up (bigger for big
 * changes) over the first POPUP_POP_MS, quantised to quarter steps; the rise eases out (cubic) over the whole life;
 * the alpha holds then fades linearly over the last POPUP_FADE_SHARE. Reduced motion: no pop, no rise, a linear fade
 * over POPUP_MS_REDUCED.
 */
export function popupPose(t: number, magnitude: number, reduced = false): PopupPose {
  if (t < 0) return { dy: 0, alpha: 0, scale: 1, done: false };
  if (reduced) {
    if (t >= POPUP_MS_REDUCED) return { dy: 0, alpha: 0, scale: 1, done: true };
    return { dy: 0, alpha: 1 - t / POPUP_MS_REDUCED, scale: 1, done: false };
  }
  if (t >= POPUP_MS) return { dy: -POPUP_RISE_PX, alpha: 0, scale: 1, done: true };
  const u = t / POPUP_MS;
  const rise = 1 - (1 - u) ** 3;
  const fadeFrom = 1 - POPUP_FADE_SHARE;
  const alpha = u <= fadeFrom ? 1 : Math.max(0, (1 - u) / POPUP_FADE_SHARE);
  const bump = Math.abs(magnitude) >= 8 ? 0.5 : 0.25;
  const scale = t < POPUP_POP_MS ? 1 + Math.round(bump * Math.sin((Math.PI * t) / POPUP_POP_MS) * 4) / 4 : 1;
  return { dy: -Math.round(POPUP_RISE_PX * rise) || 0, alpha, scale, done: false };
}

/**
 * Where the `rank`-th popup of one batch goes: started POPUP_STAGGER_MS × rank later (rank capped at POPUP_MAX_RANK)
 * and nudged sideways (0, +8, −8, +16, −16, +4, −4, +12 px, before the zoom scale) so a cascade (a rescue's
 * belongings and its completion at the victim…) does not stack on one spot.
 */
export function popupLayout(rank: number): { delayMs: number; dx: number } {
  const r = Math.max(0, Math.min(POPUP_MAX_RANK, Math.floor(rank)));
  const SPREAD = [0, 8, -8, 16, -16, 4, -4, 12] as const;
  return { delayMs: r * POPUP_STAGGER_MS, dx: SPREAD[r]! };
}
