import { CONFIG } from './config';
import type { Fall, FallKind, Vec, WeaponKind } from './types';

/** What KO'd the rioter: bare hands, the held weapon, a returned rock, mode furie, the beam, or a domino body. */
export type FallSource = 'hands' | WeaponKind | 'rock' | 'furie' | 'beam' | 'knocked';

/** The rare WTF falls, picked uniformly. */
export const WTF_KINDS = ['tripleflip', 'helicopter', 'faceplant', 'trashcan', 'domino'] as const satisfies readonly FallKind[];

const BY_SOURCE: Readonly<Record<Exclude<FallSource, 'hands'>, FallKind>> = {
  marteau: 'pancake',
  panneau: 'flyspin',
  baton: 'flyspin',
  gant: 'bounce',
  flashball: 'backflip',
  rock: 'wobble',
  furie: 'flyspin',
  beam: 'flyspin',
  knocked: 'knocked',
};

/**
 * The fall of a body KO'd by `source`, along `dir`. Always 3 draws from `r` (WTF roll, WTF sub-kind, variant), so the
 * stream stays aligned whatever the branch. The Caïd always crumples; a launched or knocked body is never WTF. A
 * 'domino' is only a wish: the Sim turns it into 'faceplant' when no rioter stands next to the body.
 */
export function pickFall(source: FallSource, opts: { boss: boolean; launched: boolean; dir: Vec }, r: () => number): Fall {
  const roll = r();
  const sub = r();
  const variant = r();
  const dir = { x: opts.dir.x, y: opts.dir.y };
  if (opts.boss) return { kind: 'crumple', wtf: false, dir };
  if (!opts.launched && source !== 'knocked' && roll < CONFIG.falls.wtfChance) {
    const kind = WTF_KINDS[Math.min(WTF_KINDS.length - 1, Math.floor(sub * WTF_KINDS.length))]!;
    return { kind, wtf: true, dir };
  }
  const kind = source === 'hands' ? (variant < 0.5 ? 'crumple' : 'spin') : BY_SOURCE[source];
  return { kind, wtf: false, dir };
}
