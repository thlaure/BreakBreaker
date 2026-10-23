import { onLocaleChange, t } from '../../content/i18n';
import { DISTRICT } from '../../sim/map/district';
import type { ActionHintKind } from '../../sim/sim';
import type { TargetId, Vec } from '../../sim/types';
import { FACADE_H, PROP_RISE } from './geometry';

/**
 * Pure bits of the in-world action prompt (render/actionHint.ts draws it): its words, where it floats, its arrow
 * toward a toolbox, and the pulses of the repair guidance and the attacked places.
 */

export interface ActionWords {
  /** In-world bubble verb (after the « F » keycap). */
  verb: string;
  /** Line under Paul (HUD prompt, screen readers), « F — » prefixed on keyboard when actionable. */
  line: string;
  /** Touch Agir button label; null = informational (no key, no button). */
  button: string | null;
}

/** The words of `kind` in the current language, read at each access (catalog keys `world.action.<kind>.*`). */
function words(kind: ActionHintKind, button: boolean): ActionWords {
  return {
    get verb() {
      return t(`world.action.${kind}.verb`);
    },
    get line() {
      return t(`world.action.${kind}.line`);
    },
    get button() {
      return button ? t(`world.action.${kind as Exclude<ActionHintKind, 'needToolbox'>}.button`) : null;
    },
  };
}

/** Each hint kind's words; the getters follow the language (a locale switch shows at the next frame). */
export const ACTION_WORDS: Readonly<Record<ActionHintKind, ActionWords>> = {
  repair: words('repair', true),
  extinguish: words('extinguish', true),
  callFire: words('callFire', true),
  callPolice: words('callPolice', true),
  needToolbox: words('needToolbox', false),
};

/** The bubble's text while the repair runs (the ring fills around the keycap), in the current language. */
export function repairingVerb(): string {
  return t('world.action.repairing');
}

/**
 * Same as repairingVerb(), kept as a live binding for older importers (src/game/hud/format.ts): reassigned on every
 * language switch. Prefer repairingVerb().
 */
export let REPAIRING_VERB = repairingVerb();
onLocaleChange(() => {
  REPAIRING_VERB = repairingVerb();
});

/** One-line help shown once per game, the first time a ruin stands on the map. */
export function firstRuinHelp(touch: boolean): string {
  return t(touch ? 'world.help.firstRuin.touch' : 'world.help.firstRuin.keys');
}

/** Gap (px) between the top of a target's drawing and the bottom of its bubble (clear of its hp bar). */
const ABOVE = 26;

/**
 * World point (whole px) the bubble's bottom-centre sits on: above the target's drawing at its door's x (a building:
 * above its facade's hp bar; a prop: above its top), so Paul standing at the door never hides it.
 */
export function hintAnchor(id: TargetId): Vec {
  const def = DISTRICT.targets.find((t) => t.id === id);
  if (!def) return { x: 0, y: 0 };
  const f = def.footprint;
  const kind = def.kind === 'car' || def.kind === 'busStop' || def.kind === 'kiosk' || def.kind === 'booth' ? def.kind : null;
  const top = def.prop && kind ? f.y - PROP_RISE[kind] - 12 : f.y + f.h - FACADE_H - 56;
  return { x: Math.round(def.door.x), y: Math.round(top - ABOVE) };
}

/**
 * Where the small « go get a toolbox » arrow sits around Paul (whole px, `r` px from `from` toward `to`) and its angle
 * in radians (0 = right, y down); null when they coincide.
 */
export function arrowToward(from: Vec, to: Vec, r: number): { x: number; y: number; angle: number } | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const l = Math.hypot(dx, dy);
  if (l < 1e-6) return null;
  return { x: Math.round(from.x + (dx / l) * r), y: Math.round(from.y + (dy / l) * r), angle: Math.atan2(dy, dx) };
}

/**
 * A stepped pulse in [0, 1] of period `periodMs` (4 steps, pixel-style, no smooth tween); 1 with reduced motion
 * (shown steady).
 */
export function steppedPulse(nowMs: number, periodMs: number, reducedMotion = false): number {
  if (reducedMotion) return 1;
  const phase = (((nowMs % periodMs) + periodMs) % periodMs) / periodMs;
  return [0.25, 0.75, 1, 0.5][Math.floor(phase * 4)]!;
}

/** Period (ms) of an attacked place's red flash / an edge indicator's pulse: 900 ms at full health down to 250 ms at 0. */
export function alarmPeriodMs(hpFrac: number): number {
  const f = Math.max(0, Math.min(1, hpFrac));
  return Math.round(250 + 650 * f);
}
