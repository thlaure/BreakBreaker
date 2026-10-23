import { t, type Key } from '../../content/i18n';
import { CONFIG } from '../../sim/config';
import { DISTRICT } from '../../sim/map/district';
import { BOOTH_OF } from '../../sim/services';
import type { Snapshot } from '../../sim/sim';
import type { CasseKind, ServiceKind, TargetId, Vec } from '../../sim/types';
import { CASSE_KINDS, casseurs, type IncidentKind, type RoundHeadline } from './alerts';
import { liveRecord } from './liveText';
import { jailedText } from '../render/prisonMath';
import { ACTION_WORDS, REPAIRING_VERB } from '../render/actionHintMath';

/**
 * Rescue: 'en cours' | 'interrompu' | 'sécurisé'. Attacked target: 'en feu' | 'attaquée' |
 * 'renforts' (the school cinematic: reinforcements on their way); 'perdue' | 'sauvée' are kept for the school.
 */
export type IncidentStatus =
  'en cours' | 'interrompu' | 'renforts' | 'sécurisé' | 'en feu' | 'attaquée' | 'perdue' | 'sauvée' | 'zone contestée' | 'à reprendre';

/**
 * The status ids are stable (the card's CSS class `st-<id>` and the logic read them, whatever the language); the card
 * shows `statusText(id)`.
 */
const STATUS_KEYS = {
  'en cours': 'hud.status.active',
  interrompu: 'hud.status.interrupted',
  renforts: 'hud.status.backup',
  sécurisé: 'hud.status.secured',
  'en feu': 'hud.status.burning',
  attaquée: 'hud.status.attacked',
  perdue: 'hud.status.lost',
  sauvée: 'hud.status.saved',
  'zone contestée': 'hud.status.contested',
  'à reprendre': 'hud.status.retake',
} as const satisfies Record<IncidentStatus, Key>;

/** The word shown for a card status, in the current locale. */
export function statusText(status: IncidentStatus): string {
  return t(STATUS_KEYS[status]);
}

/** « 23 s » / « 23s ». */
const secondsText = (n: number): string => t('hud.seconds', { n });

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

type CountKey = 'hud.sum.saved' | 'hud.sum.lost' | 'hud.sum.ok' | 'hud.sum.failed';

/** « 2 sauvées · 1 perdue » (French: 0 and 1 take the singular); « — » when nothing happened. */
function tally(ok: number, ko: number, okKey: CountKey, koKey: CountKey): string {
  if (ok === 0 && ko === 0) return '—';
  return `${t(okKey, { n: ok })} · ${t(koKey, { n: ko })}`;
}

/**
 * End-of-game rows. `record` is the best score of the same kind (KO / voluntary stop) saved before this session, or
 * null. The incident rows are counts over the session (« École » « 2 sauvées · 1 perdue », « Secours » « 3 réussis ·
 * 1 raté »), then the monument and the belongings handed back.
 */
export function formatSummary(s: Snapshot, record: number | null): SummaryData {
  const st = s.stats;
  return {
    title: s.endCause === 'quit' ? t('hud.end.quit') : t('hud.end.ko'),
    newRecord: s.score > 0 && s.score > (record ?? 0),
    rows: [
      // « Score » is the same word in both languages
      { label: 'Score', value: String(s.score) },
      { label: t('hud.sum.record'), value: record === null ? '—' : String(record) },
      { label: t('hud.sum.round'), value: String(s.round) },
      { label: t('hud.sum.perfect'), value: String(st.roundsPerfect) },
      { label: t('hud.sum.kos'), value: String(s.kos) },
      { label: t('hud.sum.places'), value: `${st.targetsSaved} / ${st.targetsLost}` },
      { label: t('hud.sum.repairs'), value: String(st.repairs) },
      { label: t('hud.sum.school'), value: tally(st.schoolsSaved, st.schoolsLost, 'hud.sum.saved', 'hud.sum.lost') },
      { label: t('hud.sum.rescue'), value: tally(st.rescuesOk, st.rescuesFailed, 'hud.sum.ok', 'hud.sum.failed') },
      { label: t('hud.sum.items'), value: String(st.itemsReturned) },
      { label: t('hud.sum.monument'), value: String(st.monumentsDefended) },
      { label: t('hud.sum.flagsLost'), value: String(st.flagsLost) },
      { label: t('hud.sum.flagsTaken'), value: String(st.flagsCaptured) },
      { label: t('hud.sum.heals'), value: String(st.healsUsed) },
      { label: t('hud.sum.rocksPicked'), value: String(st.rocksPicked) },
      { label: t('hud.sum.rocksReturned'), value: String(st.rocksReturned) },
      { label: t('hud.sum.rocksHit'), value: String(st.rocksHit) },
      { label: t('hud.sum.time'), value: formatDuration(st.activeSeconds) },
    ],
  };
}

export interface Prompt {
  text: string;
  /** Short label for the touch Agir button; null for an informational prompt (the button stays hidden). */
  label: string | null;
  /**
   * The in-world bubble above the target already says it (Snapshot.actionHint, or the repair running): the line under
   * Paul steps aside, the touch Agir button keeps the label.
   */
  inWorld?: boolean;
}

/** The touch Agir button's label when no action names it (it is hidden then). */
export function defaultActLabel(): string {
  return t('hud.touch.act');
}

/**
 * Contextual prompt. The actionable ones come from Snapshot.actionHint (the sim's own Agir rules, so it never lies):
 * « F — Réparer » / « F — Éteindre le feu » / « F — Appeler les pompiers » / « F — Appeler la police » (touch: no key,
 * the Agir button takes the label), and « Il faut une caisse à outils » next to a ruin or a fire without one (no
 * button); all of them, and the repair in progress (« Réparation… »), are drawn in the world above the target
 * (`inWorld`). Informational ones under Paul (no button): a ruined booth in call range (« Cabine hors service »), the
 * toolbox messages, the heal stations.
 */
export function contextPrompt(s: Snapshot, touch = false): Prompt | null {
  const kit = s.toolboxes;
  if (kit.repairTarget && kit.started) return { text: REPAIRING_VERB, label: null, inWorld: true };
  const h = s.actionHint;
  if (h) {
    const w = ACTION_WORDS[h.kind];
    if (w.button === null) return { text: w.line, label: null, inWorld: true };
    return { text: touch ? w.line : `F — ${w.line}`, label: w.button, inWorld: true };
  }
  if (nearestBooth(s)?.ruined) return { text: t('hud.prompt.boothOut'), label: null };
  if (kit.message) return { text: t(`toolbox.${kit.message}`), label: null };
  if (s.stationMessage) return { text: t(`station.${s.stationMessage}`), label: null };
  return null;
}

/** The booth whose door is nearest Paul within callRange (red first on a tie), or null. */
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

export const TARGET_NAMES: Readonly<Record<CasseKind, string>> = liveRecord(CASSE_KINDS, (k) => `hud.place.${k}`);
/** Card names of the targets a kind's name does not tell apart: the two phone booths. */
const TARGET_CARD_NAMES: Readonly<Partial<Record<TargetId, string>>> = liveRecord(
  ['boothRed', 'boothBlue'] as const,
  (id) => `hud.card.${id}`,
);
const OBJECTIVE_NAMES: Readonly<Record<RoundHeadline, string>> = liveRecord(
  [...CASSE_KINDS, 'rescue', 'monument'],
  (k) => `hud.place.${k}`,
);

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
  const secs = (n: number): string => secondsText(Math.ceil(n - 1e-9));
  for (const tg of s.targets) {
    if (tg.state !== 'attacked' && tg.state !== 'burning') continue;
    const hp = Math.max(0, Math.min(100, (100 * tg.hp) / tg.maxHp));
    const status: IncidentStatus = tg.id === 'school' && s.school.stage === 'cinematic' ? 'renforts' : tg.burning ? 'en feu' : 'attaquée';
    // the prison's card tells what is at stake: the Caïds who would walk out
    const items = tg.id === 'prison' && s.prison.jailed > 0 ? jailedText(s.prison.jailed) : null;
    out.push({
      key: tg.id,
      kind: tg.kind,
      name: TARGET_CARD_NAMES[tg.id] ?? TARGET_NAMES[tg.kind],
      time: t('hud.percent', { n: Math.ceil(hp - 1e-9) }),
      hp,
      status,
      target: tg.door,
      items,
    });
  }
  const r = s.rescue;
  if (r && (r.stage === 'threat' || r.stage === 'secured')) {
    const status: IncidentStatus = r.stage === 'secured' ? 'sécurisé' : rescueDrain;
    // secured, waiting for the belongings: the wait replaces the (frozen) reserve
    const time = r.returnLeft !== null ? t('hud.card.returnItems', { t: secs(r.returnLeft) }) : secs(r.remaining);
    out.push({
      key: 'rescue',
      kind: r.kind,
      name: t('hud.place.rescue'),
      time,
      hp: null,
      status,
      target: r.victimPos,
      items: rescueItemsLine(r),
    });
  }
  const m = s.monument;
  if (m.flag === 'palestinian') {
    // capture the flag: whole seconds held, a mini bar, paused while a hostile is inside the zone
    const status: IncidentStatus = m.contested ? 'zone contestée' : m.inZone ? 'en cours' : 'à reprendre';
    const held = Math.min(m.captureSec, Math.floor(m.capture + 1e-9));
    const hp = Math.max(0, Math.min(100, (100 * m.capture) / m.captureSec));
    out.push({
      key: 'monument',
      kind: 'flag',
      name: t('hud.card.flag'),
      time: t('hud.card.capture', { held, total: m.captureSec }),
      hp,
      status,
      target: m.mast,
      items: null,
    });
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
  return t('hud.card.itemsBack', { back, total: r.items.length });
}

/** HUD slot beside the toolbox while Paul carries belongings to hand back: « Objets 2 »; null when he carries none. */
export function itemsLine(s: Snapshot): string | null {
  return s.carriedItems > 0 ? t('hud.items', { n: s.carriedItems }) : null;
}

/** Content of the non-modal round panel shown during the breather (null otherwise). */
export interface RoundPanel {
  title: string;
  kos: string;
  /** `result`: the translated outcome (« réussi » / « perdu »); `ok`: whether it was won. */
  objectives: { name: string; result: string; ok: boolean }[];
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
  // « point(s) » is the same word in both languages (and « 0 points » in both)
  const pts = `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)} ${Math.abs(p) === 1 ? 'point' : 'points'}`;
  return {
    title: t('hud.round.done', { n: sum.index }),
    kos: t('hud.round.kos', { n: sum.kos }),
    objectives: sum.objectives.map((o) => ({ name: OBJECTIVE_NAMES[o.kind], result: t(`objective.${o.result}`), ok: o.result === 'won' })),
    points: pts,
    bonus: sum.bonus ? t('hud.round.bonus', { n: CONFIG.round.bonus }) : null,
    heals: t('hud.round.heals'),
    countdown: t('hud.round.next', { n: sum.index + 1, s: Math.max(1, Math.ceil(s.breatherLeft - 1e-9)) }),
  };
}

/** Screen-reader text of Paul's health (the bar itself is drawn over his head): « Santé 85 sur 100 ». */
export function hpLabel(hp: number, max: number): string {
  return t('hud.hp', { hp: Math.max(0, Math.ceil(hp)), max });
}

/** HUD round line: « Manche 3 : 4/18 casseurs », or just « Manche 1 » while the round has no roster yet (intro). */
export function waveLine(s: Snapshot): string {
  if (s.roundTotal <= 0) return t('hud.round.n', { n: s.round });
  return t('hud.round.line', { n: s.round, kos: Math.min(s.roundKos, s.roundTotal), rioters: casseurs(s.roundTotal) });
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
  return t('hud.weapon.line', { w: weaponText(s, t('hud.weapon.bareLower')) });
}

/**
 * Value of the HUD « ARME » row, same logic as weaponLine: « Bâton (12) », « Mains nues », « … · Bouclier 14 s »,
 * « … · Mode furie 9 s ».
 */
export function weaponValue(s: Snapshot): string {
  return weaponText(s, t('hud.weapon.bare'));
}

/** Whole seconds left, rounded up (at least 1 while on). */
const secs = (t: number): number => Math.max(1, Math.ceil(t - 1e-9));

function weaponText(s: Snapshot, bare: string): string {
  let out = s.weapon ? `${t(`held.${s.weapon.kind}`)} (${s.weapon.uses})` : bare;
  if (s.shield) out += ` · ${t('held.bouclier')} ${secondsText(secs(s.shield.secondsLeft))}`;
  if (s.furie) out += ` · ${t('hud.weapon.furie', { s: secondsText(secs(s.furie.secondsLeft)) })}`;
  return out;
}

/** State of the HUD « ÉNERGIE » row: under 50 (`low`), the onde available (`onde`), full (`furie`), mode furie on (`active`). */
export type EnergyState = 'low' | 'onde' | 'furie' | 'active';

export interface EnergyView {
  /** Bar fill in percent: the gauge, or the mode furie's time left while it is on (the bar drains over CONFIG.furie.durationSec). */
  pct: number;
  state: EnergyState;
  /**
   * Short tag next to the bar, the key first so it reads as an instruction: « C · Onde » from the onde cost, « R · Furie »
   * when full (touch: « ONDE ! » / « FURIE ! », the buttons carry the names), « EN FURIE », or empty.
   */
  tag: string;
  /** Screen-reader line: « Énergie 36 sur 100 », with what is available. */
  aria: string;
}

/** The HUD « ÉNERGIE » row (and the touch Furie / Onde buttons' state). */
export function energyView(s: Pick<Snapshot, 'energy' | 'furie'>, touch = false): EnergyView {
  const e = s.energy;
  const value = Math.max(0, Math.min(e.max, e.value));
  const base = t('hud.energy.base', { v: Math.floor(value), max: e.max });
  if (s.furie) {
    const pct = Math.max(0, Math.min(100, (s.furie.secondsLeft / CONFIG.furie.durationSec) * 100));
    return { pct, state: 'active', tag: t('hud.energy.activeTag'), aria: t('hud.energy.active', { base }) };
  }
  const pct = e.max > 0 ? (value / e.max) * 100 : 0;
  if (e.ready.furie)
    return {
      pct,
      state: 'furie',
      tag: t(touch ? 'hud.energy.furieTagTouch' : 'hud.energy.furieTag'),
      aria: t('hud.energy.furieReady', { base, how: t(touch ? 'hud.energy.furieButton' : 'hud.energy.furieKey') }),
    };
  if (e.ready.onde)
    return {
      pct,
      state: 'onde',
      tag: t(touch ? 'hud.energy.ondeTagTouch' : 'hud.energy.ondeTag'),
      aria: t('hud.energy.ondeReady', { base, how: t(touch ? 'hud.energy.ondeButton' : 'hud.energy.ondeKey') }),
    };
  return { pct, state: 'low', tag: '', aria: base };
}

/** The short hint shown after Furie or Onde was pressed with too little energy. */
export function energyRefusedHint(): string {
  return t('hud.energy.refused');
}
