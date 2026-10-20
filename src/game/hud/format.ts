import type { Snapshot } from '../../sim/sim';
import type { Vec } from '../../sim/types';

const STATION_RANGE = 28;
const HELP_RANGE = 32;

export type IncidentStatus = 'en cours' | 'interrompu' | 'perdu' | 'sauvé';

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export interface SummaryRow {
  label: string;
  value: string;
}

export interface SummaryData {
  title: string;
  newRecord: boolean;
  rows: SummaryRow[];
}

/** `record` is the best score of the same kind (KO / voluntary stop) saved before this session, or null. */
export function formatSummary(s: Snapshot, record: number | null): SummaryData {
  const st = s.stats;
  const school = st.schoolsSaved > 0 ? 'sauvée' : st.schoolsLost > 0 ? 'détruite' : 'en cours';
  const rescue = st.rescuesOk > 0 ? 'réussi' : st.rescuesFailed > 0 ? 'manqué' : '—';
  return {
    title: s.endCause === 'quit' ? 'Session interrompue volontairement' : 'KO',
    newRecord: s.score > 0 && s.score > (record ?? 0),
    rows: [
      { label: 'Score', value: String(s.score) },
      { label: 'Record', value: record === null ? '—' : String(record) },
      { label: 'Vague atteinte', value: String(s.wave) },
      { label: 'Casseurs neutralisés', value: String(s.kos) },
      { label: 'École', value: school },
      { label: 'Secours', value: rescue },
      { label: 'Soins utilisés', value: String(st.healsUsed) },
      { label: 'Pierres ramassées', value: String(st.rocksPicked) },
      { label: 'Pierres renvoyées', value: String(st.rocksReturned) },
      { label: 'Pierres touchées', value: String(st.rocksHit) },
      { label: 'Durée active', value: formatDuration(st.activeSeconds) },
    ],
  };
}

const d = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

export interface Prompt {
  text: string;
  /** Short label for the touch Agir button. */
  label: string;
}

export const DEFAULT_ACT_LABEL = 'Agir';

export function contextPrompt(s: Snapshot): Prompt | null {
  const p = s.player.pos;
  if (s.rescue?.stage === 'secured' && d(p, s.rescue.victimPos) <= HELP_RANGE) return { text: 'F — Aider', label: 'Aider' };
  if (s.stationMessage) return { text: s.stationMessage, label: DEFAULT_ACT_LABEL };
  if (s.stations.some((st) => st.charged && d(p, st.pos) <= STATION_RANGE)) return { text: 'F — Se soigner', label: 'Soigner' };
  return null;
}

export interface IncidentLine {
  key: 'school' | 'rescue';
  name: string;
  /** Whole seconds remaining, rounded up, e.g. "23 s"; empty once the incident is over. */
  time: string;
  status: IncidentStatus;
  target: Vec;
}

/**
 * `rescueDrain` says whether the rescue reserve went down since the previous frame (the snapshot has no status for it).
 * The school status comes from the snapshot; the card stays hidden until the school incident starts.
 */
export function incidentLines(s: Snapshot, rescueDrain: 'en cours' | 'interrompu', schoolTarget: Vec = { x: 0, y: 0 }): IncidentLine[] {
  const out: IncidentLine[] = [];
  const secs = (n: number): string => `${Math.ceil(n - 1e-9)} s`;
  if (s.school.stage !== 'idle') {
    const over = s.school.stage === 'saved' || s.school.stage === 'destroyed';
    out.push({ key: 'school', name: 'École', time: over ? '' : secs(s.school.remaining), status: s.school.status, target: schoolTarget });
  }
  const r = s.rescue;
  if (r) {
    const status: IncidentStatus =
      r.stage === 'completed' ? 'sauvé' : r.stage === 'failed' ? 'perdu' : r.stage === 'secured' ? 'interrompu' : rescueDrain;
    const over = r.stage === 'completed' || r.stage === 'failed';
    out.push({ key: 'rescue', name: 'Secours', time: over ? '' : secs(r.remaining), status, target: r.victimPos });
  }
  return out;
}
