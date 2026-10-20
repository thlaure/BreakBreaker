import type { Snapshot } from '../../sim/sim';
import type { Vec } from '../../sim/types';
import { WEAPONS } from '../../sim/weapons';

/** 'renforts': the school cinematic (reinforcements on their way) — the countdown is frozen, not interrupted. */
export type IncidentStatus = 'en cours' | 'interrompu' | 'renforts' | 'sécurisé' | 'perdu' | 'sauvé';

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

export interface Prompt {
  text: string;
  /** Short label for the touch Agir button; null for an informational prompt (the button stays hidden). */
  label: string | null;
}

export const DEFAULT_ACT_LABEL = 'Agir';

/**
 * Contextual prompt under Paul. In this slice only the heal stations produce one, and it is informational (no key):
 * a rescue completes by itself. `touch` is kept for actionable prompts (repairs, shop shutter) that will drop the
 * keyboard hint ("F — ") on touch screens.
 */
export function contextPrompt(s: Snapshot, _touch = false): Prompt | null {
  if (s.stationMessage) return { text: s.stationMessage, label: null };
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
      r.stage === 'completed' ? 'sauvé' : r.stage === 'failed' ? 'perdu' : r.stage === 'secured' ? 'sécurisé' : rescueDrain;
    const over = r.stage === 'completed' || r.stage === 'failed';
    out.push({ key: 'rescue', name: 'Secours', time: over ? '' : secs(r.remaining), status, target: r.victimPos });
  }
  return out;
}

/** HUD wave line: « Vague 3 : 4/9 casseurs », or just « Vague 1 » while the wave has no objective yet (intro). */
export function waveLine(s: Snapshot): string {
  if (s.waveTotal <= 0) return `Vague ${s.wave}`;
  return `Vague ${s.wave} : ${s.waveKos}/${s.waveTotal} ${s.waveTotal === 1 ? 'casseur' : 'casseurs'}`;
}

/** HUD weapon line: weapon name and strikes left, or bare hands. */
export function weaponLine(s: Snapshot): string {
  return s.weapon ? `Arme : ${WEAPONS[s.weapon.kind].label} (${s.weapon.uses})` : 'Arme : mains nues';
}

