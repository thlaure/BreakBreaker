import { CONFIG } from '../../sim/config';
import type { Snapshot } from '../../sim/sim';
import type { CasseKind, Vec } from '../../sim/types';
import { WEAPONS } from '../../sim/weapons';
import { casseurs, type IncidentKind, type RoundHeadline } from './alerts';

/**
 * Rescue: 'en cours' | 'interrompu' | 'sécurisé' | 'perdu' | 'sauvé'. Attacked target: 'en feu' | 'attaquée' |
 * 'renforts' (the school cinematic: reinforcements on their way); 'perdue' | 'sauvée' are kept for the school.
 */
export type IncidentStatus =
  | 'en cours'
  | 'interrompu'
  | 'renforts'
  | 'sécurisé'
  | 'perdu'
  | 'sauvé'
  | 'en feu'
  | 'attaquée'
  | 'perdue'
  | 'sauvée';

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
      { label: 'Manche atteinte', value: String(s.round) },
      { label: 'Manches parfaites', value: String(st.roundsPerfect) },
      { label: 'Casseurs neutralisés', value: String(s.kos) },
      { label: 'Lieux sauvés / détruits', value: `${st.targetsSaved} / ${st.targetsLost}` },
      { label: 'Réparations', value: String(st.repairs) },
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
 * Contextual prompt under Paul. Every prompt of this slice is informational (no key, no touch Agir button): heal
 * stations, the toolbox messages near a ruin and the repair in progress all complete by themselves. `touch` is kept for
 * a future actionable prompt that will drop the keyboard hint on touch screens.
 */
export function contextPrompt(s: Snapshot, _touch = false): Prompt | null {
  const kit = s.toolboxes;
  if (kit.repairTarget && kit.progress > 0) return { text: 'Réparation…', label: null };
  if (kit.message) return { text: kit.message, label: null };
  if (s.stationMessage) return { text: s.stationMessage, label: null };
  return null;
}

export const TARGET_NAMES: Readonly<Record<CasseKind, string>> = { school: 'École', car: 'Voiture', busStop: 'Abribus' };
const OBJECTIVE_NAMES: Readonly<Record<RoundHeadline, string>> = { ...TARGET_NAMES, rescue: 'Secours' };

export interface IncidentLine {
  /** Target id, or 'rescue'. */
  key: string;
  kind: IncidentKind;
  name: string;
  /** Rescue: whole seconds remaining, rounded up, e.g. "23 s"; target: health, e.g. "64 %"; empty once over. */
  time: string;
  /** Target health in percent (mini bar), null for the rescue. */
  hp: number | null;
  status: IncidentStatus;
  target: Vec;
}

/**
 * One card per target under an urgent attack (health and fire), then the rescue. `rescueDrain` says whether the
 * rescue reserve went down since the previous frame (the snapshot has no status for it).
 */
export function incidentLines(s: Snapshot, rescueDrain: 'en cours' | 'interrompu'): IncidentLine[] {
  const out: IncidentLine[] = [];
  const secs = (n: number): string => `${Math.ceil(n - 1e-9)} s`;
  for (const t of s.targets) {
    if (t.state !== 'attacked') continue;
    const hp = Math.max(0, Math.min(100, (100 * t.hp) / t.maxHp));
    const status: IncidentStatus = t.id === 'school' && s.school.stage === 'cinematic' ? 'renforts' : t.burning ? 'en feu' : 'attaquée';
    out.push({ key: t.id, kind: t.kind, name: TARGET_NAMES[t.kind], time: `${Math.ceil(hp - 1e-9)} %`, hp, status, target: t.door });
  }
  const r = s.rescue;
  if (r) {
    const status: IncidentStatus =
      r.stage === 'completed' ? 'sauvé' : r.stage === 'failed' ? 'perdu' : r.stage === 'secured' ? 'sécurisé' : rescueDrain;
    const over = r.stage === 'completed' || r.stage === 'failed';
    out.push({ key: 'rescue', kind: r.kind, name: 'Secours', time: over ? '' : secs(r.remaining), hp: null, status, target: r.victimPos });
  }
  return out;
}

/** Content of the non-modal round panel shown during the breather (null otherwise). */
export interface RoundPanel {
  title: string;
  kos: string;
  objectives: { name: string; result: 'réussi' | 'perdu' }[];
  points: string;
  /** « Bonus +5 », or null when not earned. */
  bonus: string | null;
  heals: string;
  countdown: string;
}

export function roundPanel(s: Snapshot): RoundPanel | null {
  const sum = s.lastSummary;
  if (s.ended || s.roundPhase !== 'breather' || !sum) return null;
  const p = sum.points;
  const pts = `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)} ${Math.abs(p) === 1 ? 'point' : 'points'}`;
  return {
    title: `Manche ${sum.index} terminée`,
    kos: `Casseurs neutralisés : ${sum.kos}`,
    objectives: sum.objectives.map((o) => ({ name: OBJECTIVE_NAMES[o.kind], result: o.result })),
    points: pts,
    bonus: sum.bonus ? `Bonus +${CONFIG.round.bonus}` : null,
    heals: 'Soins rechargés',
    countdown: `Manche ${sum.index + 1} dans ${Math.max(1, Math.ceil(s.breatherLeft - 1e-9))}…`,
  };
}

/** HUD round line: « Manche 3 : 4/18 casseurs », or just « Manche 1 » while the round has no roster yet (intro). */
export function waveLine(s: Snapshot): string {
  if (s.roundTotal <= 0) return `Manche ${s.round}`;
  return `Manche ${s.round} : ${Math.min(s.roundKos, s.roundTotal)}/${casseurs(s.roundTotal)}`;
}

/** HUD toolbox slot: « Caisse 0/1 » or « Caisse 1/1 ». */
export function toolboxLine(s: Snapshot): string {
  return `Caisse ${s.toolboxes.carried ? 1 : 0}/1`;
}

/** HUD weapon line: weapon name and strikes left, or bare hands. */
export function weaponLine(s: Snapshot): string {
  return s.weapon ? `Arme : ${WEAPONS[s.weapon.kind].label} (${s.weapon.uses})` : 'Arme : mains nues';
}

