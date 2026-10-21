import type { Snapshot } from '../../sim/sim';

type TargetSnap = Snapshot['targets'][number];

/**
 * The French flag over the school: shown whenever the school stands and is not on fire, whatever its incident's stage
 * (so a repaired ruin, or a fire put out, gets it back; a burning or ruined school has none). `burning` = the fire as
 * drawn (held back while the igniting bottle is still in the air). Pure, for tests.
 */
export function schoolFlagShown(t: Pick<TargetSnap, 'id' | 'state'>, burning: boolean): boolean {
  return t.id === 'school' && t.state !== 'ruined' && t.state !== 'burning' && !burning;
}
