import { CONFIG } from './config';
import type { ServiceKind, ServiceRefusal, TargetId } from './types';

/** The booth that calls each service: the red one the fire truck, the blue one the police. */
export const BOOTH_OF: Readonly<Record<ServiceKind, TargetId>> = { fire: 'boothRed', police: 'boothBlue' };

/** What a call needs to know about the world when Agir is pressed at a booth. */
export interface CallCtx {
  /** Targets on fire right now (the booths included). */
  burning: number;
  /** Active rioters on the map (the entry line not counted). */
  activeHostiles: number;
  /** The calling booth stands (a ruin cannot call). */
  boothStanding: boolean;
  /** The previous truck (fire) or police group (police) is still on the map. */
  busy: boolean;
}

export type CallResult = { ok: true } | { ok: false; reason: ServiceRefusal };

/**
 * Emergency calls from the phone booths: CONFIG.services.calls per kind and per session (a new Sim starts again).
 * Refusals, in order: the booth is a ruin ('ruined'), no call of that kind left ('noCalls'), the previous truck or
 * police group is still on the map ('busy'), nothing burns ('noFire') / fewer than CONFIG.services.policeMinHostiles
 * active rioters ('fewRioters'). Only an accepted call is spent; it stays spent whatever becomes of the help.
 * `active` says whether the help of each kind is on the map (the allies set it; it feeds `busy`).
 */
export class Services {
  readonly calls: Record<ServiceKind, number> = { fire: CONFIG.services.calls, police: CONFIG.services.calls };
  readonly active: Record<ServiceKind, boolean> = { fire: false, police: false };

  /** Would a call of `kind` be accepted now (nothing spent)? */
  check(kind: ServiceKind, ctx: CallCtx): CallResult {
    if (!ctx.boothStanding) return { ok: false, reason: 'ruined' };
    if (this.calls[kind] <= 0) return { ok: false, reason: 'noCalls' };
    if (ctx.busy) return { ok: false, reason: 'busy' };
    if (kind === 'fire' && ctx.burning < 1) return { ok: false, reason: 'noFire' };
    if (kind === 'police' && ctx.activeHostiles < CONFIG.services.policeMinHostiles) return { ok: false, reason: 'fewRioters' };
    return { ok: true };
  }

  /** Calls `kind`: spends one call only when accepted. */
  tryCall(kind: ServiceKind, ctx: CallCtx): CallResult {
    const r = this.check(kind, ctx);
    if (r.ok) this.calls[kind] -= 1;
    return r;
  }
}
