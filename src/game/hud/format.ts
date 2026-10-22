import { CONFIG } from '../../sim/config';
import { DISTRICT } from '../../sim/map/district';
import { BOOTH_OF } from '../../sim/services';
import type { Snapshot } from '../../sim/sim';
import type { CasseKind, ServiceKind, TargetId, Vec } from '../../sim/types';
import { HELD_LABELS } from '../../sim/weapons';
import { casseurs, type IncidentKind, type RoundHeadline } from './alerts';
import { jailedText } from '../render/prisonMath';

/**
 * Rescue: 'en cours' | 'interrompu' | 'sécurisé'. Attacked target: 'en feu' | 'attaquée' |
 * 'renforts' (the school cinematic: reinforcements on their way); 'perdue' | 'sauvée' are kept for the school.
 */
export type IncidentStatus =
  | 'en cours'
  | 'interrompu'
  | 'renforts'
  | 'sécurisé'
  | 'en feu'
  | 'attaquée'
  | 'perdue'
  | 'sauvée'
  | 'zone contestée'
  | 'à reprendre';

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

/** « 1 sauvée », « 2 sauvées », « 0 sauvée » (French: 0 and 1 take the singular). */
function count(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** « 2 sauvées · 1 perdue »; « — » when nothing happened. */
function tally(ok: number, ko: number, okWords: [string, string], koWords: [string, string]): string {
  if (ok === 0 && ko === 0) return '—';
  return `${count(ok, ...okWords)} · ${count(ko, ...koWords)}`;
}

/**
 * End-of-game rows. `record` is the best score of the same kind (KO / voluntary stop) saved before this session, or
 * null. The incident rows are counts over the session (« École » « 2 sauvées · 1 perdue », « Secours » « 3 réussis ·
 * 1 raté »), then the monument and the belongings handed back.
 */
export function formatSummary(s: Snapshot, record: number | null): SummaryData {
  const st = s.stats;
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
      { label: 'Lieux réparés', value: String(st.repairs) },
      { label: 'École', value: tally(st.schoolsSaved, st.schoolsLost, ['sauvée', 'sauvées'], ['perdue', 'perdues']) },
      { label: 'Secours', value: tally(st.rescuesOk, st.rescuesFailed, ['réussi', 'réussis'], ['raté', 'ratés']) },
      { label: 'Objets rendus', value: String(st.itemsReturned) },
      { label: 'Défenses du monument', value: String(st.monumentsDefended) },
      { label: 'Drapeaux perdus', value: String(st.flagsLost) },
      { label: 'Drapeaux repris', value: String(st.flagsCaptured) },
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
 * Contextual prompt under Paul. With a toolbox next to a ruin or a burning target and no hostile close, an actionable
 * prompt: « F — Réparer » / « F — Éteindre le feu » (touch: no key, the Agir button takes the label). Informational
 * ones (no button): the repair in progress, the toolbox messages, the heal stations. Next to a standing phone booth
 * (door within CONFIG.services.callRange): « F — Appeler les pompiers » / « F — Appeler la police », label « Appeler »,
 * when it is what a press would do (the sim's Agir priority: the nearest wins, a repair on a tie, red before blue); a
 * ruined booth: « Cabine hors service » (no button).
 */
export function contextPrompt(s: Snapshot, touch = false): Prompt | null {
  const kit = s.toolboxes;
  if (kit.repairTarget && kit.started) return { text: 'Réparation…', label: null };
  const booth = nearestBooth(s);
  if (booth) {
    const repairDoor = kit.repairTarget && kit.canRepair ? DISTRICT.targets.find((t) => t.id === kit.repairTarget)?.door : undefined;
    const repairD = repairDoor ? Math.hypot(repairDoor.x - s.player.pos.x, repairDoor.y - s.player.pos.y) : Infinity;
    if (booth.d < repairD - 1e-9) {
      if (booth.ruined) return { text: 'Cabine hors service', label: null };
      const text = BOOTH_PROMPTS[booth.kind];
      return { text: touch ? text : `F — ${text}`, label: 'Appeler' };
    }
  }
  if (kit.message) return { text: kit.message, label: null };
  if (kit.repairTarget && kit.canRepair) {
    const [text, label] = kit.repairKind === 'fire' ? ['Éteindre le feu', 'Éteindre'] : ['Réparer', 'Réparer'];
    return { text: touch ? text : `F — ${text}`, label };
  }
  if (s.stationMessage) return { text: s.stationMessage, label: null };
  return null;
}

const BOOTH_PROMPTS: Readonly<Record<ServiceKind, string>> = { fire: 'Appeler les pompiers', police: 'Appeler la police' };

/** The booth whose door is nearest Paul within callRange (red first on a tie; a ruin still takes the press), or null. */
function nearestBooth(s: Snapshot): { kind: ServiceKind; d: number; ruined: boolean } | null {
  let best: { kind: ServiceKind; d: number; ruined: boolean } | null = null;
  for (const kind of ['fire', 'police'] as const) {
    const id = BOOTH_OF[kind];
    const ruined = s.targets.find((t) => t.id === id)?.state === 'ruined';
    const door = DISTRICT.targets.find((t) => t.id === id)?.door;
    if (!door) continue;
    const d = Math.hypot(door.x - s.player.pos.x, door.y - s.player.pos.y);
    if (d <= CONFIG.services.callRange && (!best || d < best.d - 1e-9)) best = { kind, d, ruined };
  }
  return best;
}

export const TARGET_NAMES: Readonly<Record<CasseKind, string>> = {
  school: 'École',
  car: 'Voiture',
  busStop: 'Abribus',
  shop: 'Boutique',
  nursery: 'Maternelle',
  kiosk: 'Kiosque',
  townHall: 'Mairie',
  library: 'Bibliothèque',
  booth: 'Cabine',
  prison: 'Prison',
};
/** Card names of the targets a kind's name does not tell apart: the two phone booths. */
const TARGET_CARD_NAMES: Readonly<Partial<Record<TargetId, string>>> = { boothRed: 'Cabine rouge', boothBlue: 'Cabine bleue' };
const OBJECTIVE_NAMES: Readonly<Record<RoundHeadline, string>> = { ...TARGET_NAMES, rescue: 'Secours', monument: 'Monument' };

export interface IncidentLine {
  /** Target id, or 'rescue'. */
  key: string;
  kind: IncidentKind;
  name: string;
  /** Rescue: whole seconds remaining, rounded up, e.g. "23 s"; target: health, e.g. "64 %"; flag: « capture 5/8 s ». */
  time: string;
  /** Target health (or the flag's capture) in percent (mini bar), null for the rescue. */
  hp: number | null;
  status: IncidentStatus;
  target: Vec;
  /** Rescue only, once a belonging was stolen: « Objets 1/3 rendus »; null otherwise. */
  items: string | null;
}

/**
 * One card per target under an urgent attack or still burning after it (health and fire), then the rescue until it is resolved (its card stays
 * through the thanks beat, then goes like a target's). `rescueDrain` says whether the rescue reserve went down since
 * the previous frame (the snapshot has no status for it).
 */
export function incidentLines(s: Snapshot, rescueDrain: 'en cours' | 'interrompu'): IncidentLine[] {
  const out: IncidentLine[] = [];
  const secs = (n: number): string => `${Math.ceil(n - 1e-9)} s`;
  for (const t of s.targets) {
    if (t.state !== 'attacked' && t.state !== 'burning') continue;
    const hp = Math.max(0, Math.min(100, (100 * t.hp) / t.maxHp));
    const status: IncidentStatus = t.id === 'school' && s.school.stage === 'cinematic' ? 'renforts' : t.burning ? 'en feu' : 'attaquée';
    // the prison's card tells what is at stake: the Caïds who would walk out
    const items = t.id === 'prison' && s.prison.jailed > 0 ? jailedText(s.prison.jailed) : null;
    out.push({ key: t.id, kind: t.kind, name: TARGET_CARD_NAMES[t.id] ?? TARGET_NAMES[t.kind], time: `${Math.ceil(hp - 1e-9)} %`, hp, status, target: t.door, items });
  }
  const r = s.rescue;
  if (r && (r.stage === 'threat' || r.stage === 'secured')) {
    const status: IncidentStatus = r.stage === 'secured' ? 'sécurisé' : rescueDrain;
    // secured, waiting for the belongings: the wait replaces the (frozen) reserve
    const time = r.returnLeft !== null ? `Rends les objets · ${secs(r.returnLeft)}` : secs(r.remaining);
    out.push({ key: 'rescue', kind: r.kind, name: 'Secours', time, hp: null, status, target: r.victimPos, items: rescueItemsLine(r) });
  }
  const m = s.monument;
  if (m.flag === 'palestinian') {
    // capture the flag: whole seconds held, a mini bar, paused while a hostile is inside the zone
    const status: IncidentStatus = m.contested ? 'zone contestée' : m.inZone ? 'en cours' : 'à reprendre';
    const held = Math.min(m.captureSec, Math.floor(m.capture + 1e-9));
    const hp = Math.max(0, Math.min(100, (100 * m.capture) / m.captureSec));
    out.push({ key: 'monument', kind: 'flag', name: 'Drapeau', time: `capture ${held}/${m.captureSec} s`, hp, status, target: m.mast, items: null });
  }
  return out;
}

/**
 * Rescue card progress once a belonging was stolen: « Objets 1/3 rendus » (returned / every belonging the victim
 * carries); null before any theft.
 */
export function rescueItemsLine(r: NonNullable<Snapshot['rescue']>): string | null {
  if (!r.items.some((it) => it.state !== 'held')) return null;
  const back = r.items.filter((it) => it.state === 'returned').length;
  return `Objets ${back}/${r.items.length} rendus`;
}

/** HUD slot beside the toolbox while Paul carries belongings to hand back: « Objets 2 »; null when he carries none. */
export function itemsLine(s: Snapshot): string | null {
  return s.carriedItems > 0 ? `Objets ${s.carriedItems}` : null;
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

/** Screen-reader text of Paul's health (the bar itself is drawn over his head): « Santé 85 sur 100 ». */
export function hpLabel(hp: number, max: number): string {
  return `Santé ${Math.max(0, Math.ceil(hp))} sur ${max}`;
}

/** HUD round line: « Manche 3 : 4/18 casseurs », or just « Manche 1 » while the round has no roster yet (intro). */
export function waveLine(s: Snapshot): string {
  if (s.roundTotal <= 0) return `Manche ${s.round}`;
  return `Manche ${s.round} : ${Math.min(s.roundKos, s.roundTotal)}/${casseurs(s.roundTotal)}`;
}

/** Value of the HUD « MANCHE » row: « 3 · 4/18 » (K/T casseurs), or just « 1 » while the round has no roster yet. */
export function roundValue(s: Snapshot): string {
  if (s.roundTotal <= 0) return String(s.round);
  return `${s.round} · ${Math.min(s.roundKos, s.roundTotal)}/${s.roundTotal}`;
}

/**
 * HUD weapon line: weapon name and strikes left, or bare hands; while the bouclier protects Paul, its whole seconds left
 * (rounded up) follow, then the mode furie's: « Arme : Bâton (12) · Bouclier 14 s · Mode furie 9 s ».
 */
export function weaponLine(s: Snapshot): string {
  return `Arme : ${weaponText(s, 'mains nues')}`;
}

/**
 * Value of the HUD « ARME » row, same logic as weaponLine: « Bâton (12) », « Mains nues », « … · Bouclier 14 s »,
 * « … · Mode furie 9 s ».
 */
export function weaponValue(s: Snapshot): string {
  return weaponText(s, 'Mains nues');
}

/** Whole seconds left, rounded up (at least 1 while on). */
const secs = (t: number): number => Math.max(1, Math.ceil(t - 1e-9));

function weaponText(s: Snapshot, bare: string): string {
  let out = s.weapon ? `${HELD_LABELS[s.weapon.kind]} (${s.weapon.uses})` : bare;
  if (s.shield) out += ` · ${HELD_LABELS.bouclier} ${secs(s.shield.secondsLeft)} s`;
  if (s.furie) out += ` · Mode furie ${secs(s.furie.secondsLeft)} s`;
  return out;
}


/** State of the HUD « ÉNERGIE » row: under 50 (`low`), the onde available (`onde`), full (`furie`), mode furie on (`active`). */
export type EnergyState = 'low' | 'onde' | 'furie' | 'active';

export interface EnergyView {
  /** Bar fill in percent: the gauge, or the mode furie's time left while it is on (the bar drains over its 12 s). */
  pct: number;
  state: EnergyState;
  /** Short tag next to the bar: « ONDE · C », « FURIE · R » (touch: the button names), « EN FURIE », or empty. */
  tag: string;
  /** Screen-reader line: « Énergie 36 sur 100 », with what is available. */
  aria: string;
}

/** The HUD « ÉNERGIE » row (and the touch Furie / Onde buttons' state). */
export function energyView(s: Pick<Snapshot, 'energy' | 'furie'>, touch = false): EnergyView {
  const e = s.energy;
  const value = Math.max(0, Math.min(e.max, e.value));
  const base = `Énergie ${Math.floor(value)} sur ${e.max}`;
  if (s.furie) {
    const pct = Math.max(0, Math.min(100, (s.furie.secondsLeft / CONFIG.furie.durationSec) * 100));
    return { pct, state: 'active', tag: 'EN FURIE', aria: `${base}, mode furie en cours` };
  }
  const pct = e.max > 0 ? (value / e.max) * 100 : 0;
  if (e.ready.furie)
    return { pct, state: 'furie', tag: touch ? 'FURIE !' : 'FURIE · R', aria: `${base}, mode furie disponible (${touch ? 'bouton Furie' : 'touche R'})` };
  if (e.ready.onde)
    return { pct, state: 'onde', tag: touch ? 'ONDE !' : 'ONDE · C', aria: `${base}, onde d’énergie disponible (${touch ? 'maintenir Onde' : 'maintenir C'})` };
  return { pct, state: 'low', tag: '', aria: base };
}

/** The short hint shown after Furie or Onde was pressed with too little energy. */
export const ENERGY_REFUSED_HINT = 'Énergie insuffisante';
