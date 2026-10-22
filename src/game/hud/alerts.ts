import { CONFIG } from '../../sim/config';
import type { Snapshot } from '../../sim/sim';
import type { CasseKind, PickupKind, SimEvent, SpecialKind, Vec } from '../../sim/types';
import { releasedText } from '../render/prisonMath';

/**
 * Incident alerts: a pixel banner when a target is set on fire, a rescue, a round or a special drop starts, and one
 * edge indicator per active incident (the bouclier included while on the ground — the only special pickup; regular
 * weapons never get one). An attack start is not announced: the
 * fire is, once the bottle is thrown (TargetIgnited). Generic on purpose: a new kind of "casse" only needs an entry in
 * INCIDENT_ALERTS (and a headline line); `alertFromEvent` / `activeIncidents` read the generic TargetIgnited event and
 * `snapshot.targets`. A round start has no position: its banner shows no arrow and no distance.
 */
/**
 * `monument` = an occupation under way; `flag` = the flag replaced, to capture back; `caid` = « Le Caïd » (mini-boss)
 * standing (his banner is short and position-less, his edge indicator follows him).
 */
export type IncidentKind = CasseKind | 'groupHarassed' | 'elderlyRobbed' | 'monument' | 'flag' | 'caid';
/** A special pickup waiting on the ground: the bouclier (the mode furie and the onde come from the energy gauge). */
export type DropKind = 'bouclierDrop';
/**
 * Everything the banner can announce: positioned incidents and drops, and position-less round starts and mode furie
 * starts (`furie`); `breakout` = the prison fell and its Caïds burst out (pointing at its gate).
 */
export type AlertKind = IncidentKind | 'round' | DropKind | 'furie' | 'flagCaptured' | 'flashball' | 'breakout';
export type AlertTone = 'fire' | 'warn' | 'round' | 'drop' | 'furie' | 'win';
export type AlertIcon = 'flame' | 'alert' | 'horde' | 'glass' | 'bolt' | 'flag' | 'shield' | 'crown' | 'flashball' | 'bars';
/** What a round is about (its first beat), shown under « MANCHE N ! ». */
export type RoundHeadline = CasseKind | 'rescue' | 'monument';
/** A round headline as the banner words it: a rescue headline names its variant when known. */
export type BannerHeadline = RoundHeadline | 'groupHarassed' | 'elderlyRobbed';

export interface AlertSpec {
  /** Banner title. */
  title: string;
  /** Banner sub-line. */
  sub: string;
  /** Short label of the edge indicator. */
  label: string;
  tone: AlertTone;
  icon: AlertIcon;
}

export const INCIDENT_ALERTS: Readonly<Record<IncidentKind, AlertSpec>> = {
  school: { title: 'ÉCOLE EN FEU !', sub: 'Rejoins l’école', label: 'ÉCOLE', tone: 'fire', icon: 'flame' },
  car: { title: 'VOITURE EN FEU !', sub: 'Chasse les casseurs', label: 'VOITURE', tone: 'fire', icon: 'flame' },
  busStop: { title: 'ABRIBUS SACCAGÉ !', sub: 'Arrête la casse', label: 'ABRIBUS', tone: 'warn', icon: 'glass' },
  shop: { title: 'BOUTIQUE EN FEU !', sub: 'Défends la boutique', label: 'BOUTIQUE', tone: 'fire', icon: 'flame' },
  nursery: { title: 'ÉCOLE MATERNELLE EN DANGER !', sub: 'Protège les petits', label: 'MATERNELLE', tone: 'fire', icon: 'flame' },
  kiosk: { title: 'KIOSQUE SACCAGÉ !', sub: 'Protège le kiosque', label: 'KIOSQUE', tone: 'warn', icon: 'glass' },
  townHall: { title: 'MAIRIE ATTAQUÉE !', sub: 'Défends la mairie', label: 'MAIRIE', tone: 'fire', icon: 'flame' },
  library: { title: 'BIBLIOTHÈQUE EN FEU !', sub: 'Sauve les livres', label: 'BIBLIOTHÈQUE', tone: 'fire', icon: 'flame' },
  booth: { title: 'CABINE SACCAGÉE !', sub: 'Protège la cabine', label: 'CABINE', tone: 'warn', icon: 'glass' },
  prison: { title: 'PRISON ATTAQUÉE !', sub: 'Défends la prison', label: 'PRISON', tone: 'fire', icon: 'flame' },
  groupHarassed: { title: 'AGRESSION EN COURS !', sub: 'Une personne est menacée', label: 'AGRESSION', tone: 'warn', icon: 'alert' },
  elderlyRobbed: { title: 'VOL EN COURS !', sub: 'Une personne âgée est menacée', label: 'VOL', tone: 'warn', icon: 'alert' },
  monument: { title: 'MONUMENT ATTAQUÉ !', sub: 'Défends le drapeau', label: 'MONUMENT', tone: 'warn', icon: 'flag' },
  flag: { title: 'DRAPEAU REMPLACÉ !', sub: 'Reprends le monument', label: 'DRAPEAU', tone: 'warn', icon: 'flag' },
  caid: { title: 'LE CAÏD ARRIVE !', sub: 'Mets-le KO', label: 'CAÏD', tone: 'warn', icon: 'crown' },
};

export const DROPS: Readonly<Record<DropKind, AlertSpec>> = {
  bouclierDrop: { title: 'BOUCLIER DISPONIBLE !', sub: 'Fonce le ramasser', label: 'BOUCLIER', tone: 'drop', icon: 'shield' },
};
const DROP_OF: Readonly<Record<SpecialKind, DropKind>> = { bouclier: 'bouclierDrop' };

/** The indicator kind of a ground pickup: only the bouclier has one (regular weapons: null). */
export function dropKindOf(kind: PickupKind): DropKind | null {
  return kind === 'bouclier' ? DROP_OF[kind] : null;
}

function isDrop(kind: AlertKind): kind is DropKind {
  return kind === 'bouclierDrop';
}
/** How long the position-less « MODE FURIE ! » banner stays (short: Paul is busy hitting). */
export const FURIE_ALERT_MS = 2200;
/** The shortest a warning banner stays on screen (its alarm rang: give the player time to read it). */
export const ALERT_MIN_MS = 3500;
/** How long the short « DRAPEAU RÉCUPÉRÉ ! » banner stays. */
export const FLAG_ALERT_MS = ALERT_MIN_MS;
/** How long the short, position-less « LE CAÏD ARRIVE ! » banner stays. */
export const CAID_ALERT_MS = ALERT_MIN_MS;

/** How long the « ÉVASION ! » banner stays. */
export const BREAKOUT_ALERT_MS = 3600;

/** How long the one-line « FLASHBALL AU SOL » hint stays. */
export const FLASHBALL_ALERT_MS = 3200;

/** Id of the flashball hint of the drop at `pos`: alive while that flashball lies on the ground (see hintIds). */
export function flashballHintId(pos: Vec): string {
  return `flashball@${pos.x},${pos.y}`;
}

/**
 * Ids that keep a hint banner alive without an edge indicator: every flashball on the ground (the banner of the one
 * dropped with the first shooter goes once it is picked up).
 */
export function hintIds(s: Snapshot): string[] {
  return s.weaponsOnGround.filter((w) => w.kind === 'flashball').map((w) => flashballHintId(w.pos));
}

/** `activeIncidents` id of the Caïd of life `lifeId` (the banner is dropped once he is KO). */
export function caidId(lifeId: number): string {
  return `caid#${lifeId}`;
}

/** Non-committal: the round start does not know whether the bottle will be thrown. */
export const ROUND_HEADLINES: Readonly<Record<BannerHeadline, string>> = {
  school: 'École menacée',
  car: 'Voiture menacée',
  busStop: 'Abribus menacé',
  shop: 'Boutique menacée',
  nursery: 'École maternelle menacée',
  kiosk: 'Kiosque menacé',
  townHall: 'Mairie menacée',
  library: 'Bibliothèque menacée',
  booth: 'Cabine menacée',
  prison: 'Prison menacée',
  rescue: 'Agression en cours',
  groupHarassed: 'Agression en cours',
  elderlyRobbed: 'Vol en cours',
  monument: 'Monument menacé',
};

/** What the banner shows for an alert: the spec plus the round line and whether it points somewhere. */
export interface ShownAlert extends AlertSpec {
  /**
   * Small « Manche N · T casseurs » line of an incident banner, « Manche N » when the roster is unknown (a fire), empty
   * when the round is unknown, for a round start or a drop.
   */
  meta: string;
  /** False for a round start: no arrow, no distance. */
  positioned: boolean;
  /** Time on screen when not ALERT_MS. */
  ms?: number;
}

/** "1 casseur", "9 casseurs". */
export function casseurs(n: number): string {
  return `${n} ${n === 1 ? 'casseur' : 'casseurs'}`;
}

/**
 * Banner content of an alert kind; `round`/`total` give the round number and its roster (0 = unknown), `headline` what
 * a round start is about.
 */
export function incidentAlert(kind: AlertKind, round = 0, total = 0, headline?: BannerHeadline): ShownAlert {
  if (kind === 'round')
    return {
      title: `MANCHE ${round} !`,
      sub: headline ? `${ROUND_HEADLINES[headline]} · ${casseurs(total)}` : casseurs(total),
      label: 'MANCHE',
      tone: 'round',
      icon: 'horde',
      meta: '',
      positioned: false,
    };
  if (isDrop(kind)) return { ...DROPS[kind], meta: '', positioned: true };
  if (kind === 'furie')
    return {
      title: 'MODE FURIE !',
      sub: 'Frappe, ils volent !',
      label: 'FURIE',
      tone: 'furie',
      icon: 'bolt',
      meta: '',
      positioned: false,
      ms: FURIE_ALERT_MS,
    };
  if (kind === 'flagCaptured')
    return {
      title: 'DRAPEAU RÉCUPÉRÉ !',
      sub: 'Le drapeau français flotte à nouveau',
      label: 'DRAPEAU',
      tone: 'win',
      icon: 'flag',
      meta: '',
      positioned: false,
      ms: FLAG_ALERT_MS,
    };
  if (kind === 'caid') return { ...INCIDENT_ALERTS.caid, meta: '', positioned: false, ms: CAID_ALERT_MS };
  // the prison fell: `total` = the Caïds released, the arrow points at its gate
  if (kind === 'breakout')
    return {
      title: 'ÉVASION !',
      sub: releasedText(total),
      label: 'ÉVASION',
      tone: 'round',
      icon: 'bars',
      meta: '',
      positioned: true,
      ms: BREAKOUT_ALERT_MS,
    };
  // the flashball guaranteed with the first shooter: one line, with the arrow and distance to it (no edge indicator)
  if (kind === 'flashball')
    return { title: 'FLASHBALL AU SOL', sub: '', label: 'FLASHBALL', tone: 'drop', icon: 'flashball', meta: '', positioned: true, ms: FLASHBALL_ALERT_MS };
  const meta = round <= 0 ? '' : total > 0 ? `Manche ${round} · ${casseurs(total)}` : `Manche ${round}`;
  return { ...INCIDENT_ALERTS[kind], meta, positioned: true };
}

/** An incident on the map (or a special drop waiting to be picked up): what it is and where. */
export interface Incident {
  id: string;
  kind: IncidentKind | DropKind;
  pos: Vec;
  /** Targets only: on fire (fire tone, flame) or not yet (warn tone, alert icon). */
  burning?: boolean;
}

/**
 * Tone and icon of an incident's edge indicator and card: a target warns until it burns, then shows the fire; a rescue
 * or a drop keeps its own.
 */
export function incidentLook(kind: IncidentKind | DropKind, burning?: boolean): { tone: AlertTone; icon: AlertIcon } {
  if (burning === undefined) {
    const spec = isDrop(kind) ? DROPS[kind] : INCIDENT_ALERTS[kind];
    return { tone: spec.tone, icon: spec.icon };
  }
  return burning ? { tone: 'fire', icon: 'flame' } : { tone: 'warn', icon: 'alert' };
}

/** `activeIncidents` id of the special drop lying at `pos` (the drop banner knows only its position). */
function dropId(pos: Vec): string {
  return `drop@${pos.x},${pos.y}`;
}

/** Something the banner announces: an incident or drop (with a position) or a round start (pos null). */
export interface Alert {
  id: string;
  kind: AlertKind;
  pos: Vec | null;
  wave: number;
  total: number;
  /** Round starts only (a rescue headline carries its variant). */
  headline?: BannerHeadline;
  /**
   * Id of the incident in `activeIncidents` (target id, 'rescue' or the drop's id) for incident and drop alerts: the
   * banner drops the alert once that incident is over or that weapon gone. Absent for round starts, which run their course.
   */
  incident?: string;
}

/**
 * The alert announced by a sim event (a target set on fire, a rescue, round or special-drop start), or null. An attack
 * start (SchoolStarted / CasseStarted) announces nothing: no fire before a bottle was thrown.
 */
export function alertFromEvent(e: SimEvent): Alert | null {
  if (e.type === 'TargetIgnited')
    return { id: e.incidentId, kind: e.kind, pos: { ...e.pos }, wave: e.round, total: e.total ?? 0, incident: e.target };
  if (e.type === 'RescueStarted')
    return { id: e.incidentId, kind: e.kind, pos: { ...e.pos }, wave: e.wave, total: e.total, incident: 'rescue' };
  if (e.type === 'RoundStarted')
    return {
      id: `round#${e.index}`,
      kind: 'round',
      pos: null,
      wave: e.index,
      total: e.total,
      headline: e.headline === 'rescue' && e.rescueKind ? e.rescueKind : e.headline,
    };
  // a second urgency is announced by its own start event; a drop that found no spot, or a regular weapon (no special),
  // has nothing to show
  if (e.type === 'TwistStarted' && e.kind === 'weaponDrop' && e.pos && e.special) {
    const kind = DROP_OF[e.special];
    return { id: dropId(e.pos), kind, pos: { ...e.pos }, wave: 0, total: 0, incident: dropId(e.pos) };
  }
  // the mode furie started (full energy gauge spent): short position-less banner
  if (e.type === 'FurieStarted') return { id: 'furie', kind: 'furie', pos: null, wave: 0, total: 0 };
  // the monument: occupation start ('monument:occupy'), flag replaced ('monument:flag'), flag captured back (short)
  if (e.type === 'MonumentAttacked')
    return { id: e.incidentId, kind: 'monument', pos: { ...e.pos }, wave: e.round, total: e.total, incident: 'monument:occupy' };
  if (e.type === 'FlagSwapped')
    return { id: `${e.incidentId}:swap`, kind: 'flag', pos: { ...e.pos }, wave: 0, total: 0, incident: 'monument:flag' };
  if (e.type === 'FlagCaptured') return { id: `flag#${e.swap}`, kind: 'flagCaptured', pos: null, wave: 0, total: 0 };
  // the first shooter's flashball: a one-line hint pointing at it, dropped once it is picked up
  if (e.type === 'FlashballDropped') {
    const id = flashballHintId(e.pos);
    return { id, kind: 'flashball', pos: { ...e.pos }, wave: 0, total: 0, incident: id };
  }
  // the prison fell with Caïds inside (they send no CaidArrived: each gets the Caïd's edge indicator from activeIncidents)
  if (e.type === 'PrisonBreakout')
    return { id: `breakout@${e.pos.x},${e.pos.y}#${e.count}`, kind: 'breakout', pos: { ...e.pos }, wave: 0, total: e.count };
  // the Caïd walks in: short banner without arrow, dropped once he is KO
  if (e.type === 'CaidArrived') {
    const id = caidId(e.lifeId);
    return { id, kind: 'caid', pos: null, wave: e.round, total: 0, incident: id };
  }
  return null;
}

/**
 * Incidents that still need Paul: every target under an urgent attack or still burning (at its door: a fire stays until
 * put out with a toolbox), the rescue while threatened (or secured with belongings still to bring back), and
 * every bouclier on the ground (kind-based, twist drop or street spawn) until it is
 * picked up or vanishes, and « Le Caïd » while he stands. Regular weapons are never listed.
 */
export function activeIncidents(s: Snapshot): Incident[] {
  const out: Incident[] = [];
  for (const t of s.targets)
    if (t.state === 'attacked' || t.state === 'burning') out.push({ id: t.id, kind: t.kind, pos: { ...t.door }, burning: t.burning });
  // the rescue while threatened, and while belongings lie on the ground or Paul carries them back
  const r = s.rescue;
  const toReturn = r?.stage === 'secured' && r.items.some((it) => it.state === 'dropped' || it.state === 'carried');
  if (r && (r.stage === 'threat' || toReturn)) out.push({ id: 'rescue', kind: r.kind, pos: { ...r.victimPos } });
  // the monument: its flag to take back (any time, breather included), or an occupation under way. Distinct ids, so an
  // occupation banner still queued is dropped once the flag is swapped (or the occupation is over)
  const m = s.monument;
  if (m.flag === 'palestinian') out.push({ id: 'monument:flag', kind: 'flag', pos: { ...m.mast } });
  else if (m.occupation?.stage === 'occupy') out.push({ id: 'monument:occupy', kind: 'monument', pos: { ...m.mast } });
  for (const w of s.weaponsOnGround) {
    const kind = dropKindOf(w.kind);
    if (kind) out.push({ id: dropId(w.pos), kind, pos: { ...w.pos } });
  }
  // « Le Caïd » while he stands (his indicator follows him)
  for (const h of s.hostiles) if (h.role === 'boss' && h.state !== 'ko') out.push({ id: caidId(h.lifeId), kind: 'caid', pos: { ...h.pos } });
  return out;
}

export type GuideKind = 'ruin' | 'toolbox';
export type GuideIcon = 'wrench' | 'toolbox';
/** A repair-guidance edge indicator: a ruin to rebuild, or a toolbox to fetch. */
export interface GuideMark {
  id: string;
  kind: GuideKind;
  pos: Vec;
}
export const GUIDE_LOOK: Readonly<Record<GuideKind, { label: string; icon: GuideIcon }>> = {
  ruin: { label: 'RÉPARER', icon: 'wrench' },
  toolbox: { label: 'OUTILS', icon: 'toolbox' },
};

/**
 * Repair guidance: Paul carrying a toolbox, every ruin (at its door); without one, while at least one ruin waits,
 * every toolbox on the ground. Nothing once the session ended.
 */
export function guideMarks(s: Snapshot): GuideMark[] {
  if (s.ended) return [];
  const ruins = s.targets.filter((t) => t.state === 'ruined');
  if (ruins.length === 0) return [];
  if (s.toolboxes.carried) return ruins.map((t) => ({ id: `ruin:${t.id}`, kind: 'ruin', pos: { ...t.door } }));
  return s.toolboxes.ground.map((g) => ({ id: `toolbox:${g.id}`, kind: 'toolbox', pos: { ...g.pos } }));
}

/** Events that start a new danger: the red edge glow flashes once (several in one frame: once). */
export function isNewAttack(e: SimEvent): boolean {
  return e.type === 'CasseStarted' || e.type === 'SchoolStarted' || e.type === 'TargetIgnited' || e.type === 'RescueStarted' || e.type === 'MonumentAttacked';
}

/** Distance in metres (1 tile = 32 px = 1 m), rounded. */
export function meters(from: Vec, to: Vec): number {
  return Math.round(Math.hypot(to.x - from.x, to.y - from.y) / CONFIG.tile);
}

export function formatMeters(from: Vec, to: Vec): string {
  return `${meters(from, to)} m`;
}

/** Screen angle in whole degrees (0 = right, 90 = down) from `from` toward `to`. */
export function bearingDeg(from: Vec, to: Vec): number {
  return Math.round((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI);
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Targets closer than this to the screen border count as off-screen (they would sit under the indicator). */
export const ONSCREEN_MARGIN = 16;
const GAP = 4;

/**
 * Centre of an edge indicator of half-size `half` for a target at screen point `t`, or null when the target is on
 * screen. The point lies on the ray from the screen centre toward the target, clamped `pad` px inside the edges, then
 * moved out of every `avoid` box (HUD panel, Commandes button, touch controls) by the smallest in-bounds shift.
 */
export function edgePosition(t: Vec, view: { width: number; height: number }, half: Vec, pad: number, avoid: Box[] = []): Vec | null {
  const { width: w, height: h } = view;
  const m = ONSCREEN_MARGIN;
  if (t.x >= m && t.x <= w - m && t.y >= m && t.y <= h - m) return null;
  const minX = Math.min(w / 2, half.x + pad);
  const maxX = Math.max(w / 2, w - half.x - pad);
  const minY = Math.min(h / 2, half.y + pad);
  const maxY = Math.max(h / 2, h - half.y - pad);
  const cx = w / 2;
  const cy = h / 2;
  const dx = t.x - cx;
  const dy = t.y - cy;
  const kx = dx === 0 ? Infinity : (dx > 0 ? maxX - cx : cx - minX) / Math.abs(dx);
  const ky = dy === 0 ? Infinity : (dy > 0 ? maxY - cy : cy - minY) / Math.abs(dy);
  const k = Math.min(kx, ky);
  let p = { x: cx + dx * k, y: cy + dy * k };
  for (const b of avoid) {
    const l = b.left - half.x - GAP;
    const r = b.right + half.x + GAP;
    const tp = b.top - half.y - GAP;
    const bt = b.bottom + half.y + GAP;
    if (p.x <= l || p.x >= r || p.y <= tp || p.y >= bt) continue;
    const moves: Vec[] = [
      { x: p.x, y: bt },
      { x: p.x, y: tp },
      { x: r, y: p.y },
      { x: l, y: p.y },
    ].filter((q) => q.x >= minX && q.x <= maxX && q.y >= minY && q.y <= maxY);
    if (moves.length === 0) continue;
    moves.sort((a, c) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(c.x - p.x, c.y - p.y));
    p = moves[0]!;
  }
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

/* ---------- pixel-art SVG icons (built in code, crisp edges, no external images) ---------- */

const PALETTE: Record<string, string> = {
  K: '#14121c',
  R: '#c4372b',
  O: '#ff7a2e',
  Y: '#ffd166',
  W: '#fff7e0',
  B: '#3b6fd8',
  S: '#a9b6c8',
  L: '#8fd3ff',
  C: 'currentColor',
};

type Sprite = AlertIcon | GuideIcon | 'arrow' | 'arrowDiag';

const SPRITES: Record<Sprite, string[]> = {
  flame: [
    '....K.....',
    '...KRK....',
    '...KRRK.K.',
    '..KRORK.KK',
    '.KROORRKRK',
    '.KROYORRRK',
    'KROYYYORRK',
    'KROYWYYORK',
    'KROYWWYORK',
    '.KROYYORK.',
    '..KKKKKK..',
  ],
  alert: [
    '....KK....',
    '...KYYK...',
    '...KYYK...',
    '..KYKKYK..',
    '..KYKKYK..',
    '.KYYKKYYK.',
    '.KYYKKYYK.',
    'KYYYYYYYYK',
    'KYYYKKYYYK',
    'KKKKKKKKKK',
  ],
  // a small horde: three hooded silhouettes, red/orange
  horde: [
    '....KK....',
    '...KRRK...',
    '.KKKRRKKK.',
    'KOOKRRKOOK',
    'KOOKKKKOOK',
    'KKKRRRRKKK',
    'KOKRRRRKOK',
    'KOKRRRRKOK',
    'KKKRKKRKKK',
    '..KK..KK..',
  ],
  // a cracked glass pane with shards falling off
  glass: [
    'KKKKKKKKKK',
    'KWWYKWWWWK',
    'KWWWKWWKWK',
    'KWYWWKKWWK',
    'KWWKKWKWYK',
    'KWKWWWWKWK',
    'KKKKKKKWKK',
    '.....K..W.',
    '..WK....K.',
    '.......WK.',
  ],
  // a lightning bolt: the mode furie
  bolt: [
    '....KKKK.',
    '...KYYK..',
    '..KYYK...',
    '.KYYKKKK.',
    'KYYYYYYK.',
    'KKKKYYK..',
    '...KYK...',
    '..KYK....',
    '.KWK.....',
    '.KK......',
  ],
  // a neutral pennant on a pole (no national flag): the monument
  flag: [
    'KK........',
    'KWKKK.....',
    'KWKYYKK...',
    'KWKYYYYKK.',
    'KWKYYYYYYK',
    'KWKYYYYKK.',
    'KWKYYKK...',
    'KWKKK.....',
    'KWK.......',
    'KWK.......',
    'KKK.......',
  ],
  // a round blue/steel shield with a highlight: the bouclier to grab
  shield: [
    '..KKKKKK..',
    '.KBBBBBBK.',
    'KBWWBBBBBK',
    'KBWSSSSBBK',
    'KBSSSSSSBK',
    'KBSSSSSSBK',
    'KBBSSSSBBK',
    '.KBBSSBBK.',
    '..KBBBBK..',
    '...KBBK...',
    '....KK....',
  ],
  // a gold crown with a red jewel: « Le Caïd »
  crown: [
    'Y...Y...Y.',
    'KY.KYK.YK.',
    'KYYKYKYYK.',
    'KYYYYYYYK.',
    'KYYRYYRYK.',
    'KYYYYYYYK.',
    'KOOOOOOOK.',
    'KKKKKKKKK.',
  ],
  // prison bars bent apart: the breakout
  bars: [
    'KKKKKKKKKK',
    'KSKSK.KSKK',
    'KSKSK..KSK',
    'KSKK....SK',
    'KSK.....SK',
    'KSK.....SK',
    'KSKK...KSK',
    'KSKSK.KSKK',
    'KSKSK.KSKK',
    'KKKKKKKKKK',
  ],
  // the cartoon flashball launcher: grey body, orange muzzle
  flashball: [
    '..........',
    'KKKKKKKKK.',
    'KSSSSSSOOK',
    'KSKKKKSOYK',
    'KSSSSSSOOK',
    'KKKSSKKKK.',
    '..KSSK....',
    '..KSSK....',
    '.KSSSK....',
    '.KKKKK....',
  ],
  // a gold wrench: a ruin to repair
  wrench: [
    '..KKK.....',
    '.KYYK.....',
    'KYK.K.....',
    'KYYKKK....',
    '.KKYYYK...',
    '...KYYYK..',
    '....KYYYK.',
    '.....KYYYK',
    '......KYYK',
    '.......KK.',
  ],
  // a red toolbox with its handle: a toolbox on the ground
  toolbox: [
    '...KKKK...',
    '...K..K...',
    'KKKKKKKKKK',
    'KRRRRRRRRK',
    'KRRRRRRRRK',
    'KKKKYYKKKK',
    'KRRRYYRRRK',
    'KRRRRRRRRK',
    'KKKKKKKKKK',
  ],
  // points right (0°); rotated toward the target
  arrow: ['....C...', '....CC..', 'CCCCCCC.', 'CCCCCCCC', 'CCCCCCC.', '....CC..', '....C...'],
  // points down-right (45°)
  arrowDiag: ['CC......', 'CCC.....', '.CCC...C', '..CCC.CC', '...CCCCC', '....CCCC', '...CCCCC'],
};

/**
 * Pixel arrow toward `deg` (0 = right, 90 = down), snapped to 8 directions so the art is only ever turned by
 * multiples of 90° (stays crisp): a straight sprite for 0/90/180/270, a diagonal one for the others.
 */
export function arrowFor(deg: number): { sprite: 'arrow' | 'arrowDiag'; rot: number } {
  const q = (((Math.round(deg / 45) * 45) % 360) + 360) % 360;
  return q % 90 === 0 ? { sprite: 'arrow', rot: q } : { sprite: 'arrowDiag', rot: q - 45 };
}

/** Points the pixel arrow inside `el` toward `deg`; touches the DOM only when the direction changes. */
export function setArrow(el: HTMLElement, deg: number, scale = 2): void {
  const { sprite, rot } = arrowFor(deg);
  const key = `${sprite}:${rot}`;
  if (el.dataset.dir === key) return;
  if (!el.dataset.dir?.startsWith(`${sprite}:`)) el.innerHTML = pixelSvg(sprite, scale);
  el.dataset.dir = key;
  el.style.transform = rot ? `rotate(${rot}deg)` : '';
}

/** Inline SVG of a pixel sprite, `scale` CSS px per art pixel. */
export function pixelSvg(name: Sprite, scale = 2): string {
  const rows = SPRITES[name];
  const h = rows.length;
  const w = rows[0]!.length;
  let rects = '';
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = PALETTE[row[x]!];
      if (c) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
}

/* ---------- banner ---------- */

/** How long a banner stays on screen. */
export const ALERT_MS = 6000;
/** Alerts waiting behind the one on screen (older ones are dropped beyond this). */
const QUEUE_MAX = 3;

/**
 * Top-centre pixel banner announcing a new incident, round or special drop (role="alert"). One at a time; later ones queue and
 * show after. For a positioned alert the arrow and distance are refreshed by `track(playerPos)` while visible
 * (aria-hidden: not re-announced); a round start has neither.
 */
export class AlertBanner {
  readonly el: HTMLElement;
  private readonly ico: HTMLElement;
  private readonly title: HTMLElement;
  private readonly sub: HTMLElement;
  private readonly meta: HTMLElement;
  private readonly dir: HTMLElement;
  private readonly arrow: HTMLElement;
  private readonly dist: HTMLElement;
  private current: Alert | null = null;
  private readonly queue: Alert[] = [];
  /** Alerts pushed since the last `prune`: their incident may not show in the snapshot yet. */
  private readonly fresh = new Set<Alert>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastDist = '';

  constructor(parent: HTMLElement) {
    const mk = (tag: string, cls: string): HTMLElement => {
      const e = document.createElement(tag);
      e.className = cls;
      return e;
    };
    this.el = mk('div', 'bb-alert');
    this.el.setAttribute('role', 'alert');
    this.el.hidden = true;
    this.ico = mk('span', 'ico');
    const txt = mk('div', 'txt');
    this.title = mk('b', 'title');
    this.sub = mk('span', 'sub');
    this.meta = mk('span', 'meta');
    txt.append(this.title, this.sub, this.meta);
    const dir = mk('div', 'dir');
    dir.setAttribute('aria-hidden', 'true');
    this.dir = dir;
    this.arrow = mk('span', 'arrow');
    this.dist = mk('span', 'dist');
    dir.append(this.arrow, this.dist);
    this.el.append(this.ico, txt, dir);
    parent.append(this.el);
  }

  get shown(): Alert | null {
    return this.current;
  }

  push(incident: Alert): void {
    this.fresh.add(incident);
    if (this.current) {
      this.queue.push(incident);
      if (this.queue.length > QUEUE_MAX) this.queue.shift();
      return;
    }
    this.show(incident);
  }

  /** Live arrow (player → incident, 8 directions) and distance. */
  track(playerPos: Vec): void {
    const inc = this.current;
    if (!inc?.pos) return;
    setArrow(this.arrow, bearingDeg(playerPos, inc.pos), 3);
    const d = formatMeters(playerPos, inc.pos);
    if (d !== this.lastDist) {
      this.lastDist = d;
      this.dist.textContent = d;
    }
  }

  /**
   * Drops incident and drop alerts whose incident is no longer active (`active` = `activeIncidents` ids), queued or on
   * screen, so a banner never announces an urgency that is already over (e.g. during the breather) nor a weapon already
   * gone. Alerts pushed since the previous call are kept once (their start may not be in this snapshot yet); round
   * starts are never dropped.
   */
  prune(active: ReadonlySet<string>): void {
    const stale = (a: Alert): boolean => a.incident !== undefined && !active.has(a.incident) && !this.fresh.has(a);
    for (let i = this.queue.length - 1; i >= 0; i--) if (stale(this.queue[i]!)) this.queue.splice(i, 1);
    if (this.current && stale(this.current)) {
      if (this.timer) clearTimeout(this.timer);
      this.next();
    }
    this.fresh.clear();
  }

  clear(): void {
    this.fresh.clear();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.queue.length = 0;
    this.current = null;
    this.el.hidden = true;
  }

  destroy(): void {
    this.clear();
    this.el.remove();
  }

  private show(incident: Alert): void {
    const spec = incidentAlert(incident.kind, incident.wave, incident.total, incident.headline);
    this.current = incident;
    // a danger shakes once on entry (CSS, off under prefers-reduced-motion)
    const danger = spec.tone === 'fire' || spec.tone === 'warn';
    this.el.className = `bb-alert tone-${spec.tone}${danger ? ' shake' : ''}`;
    this.ico.innerHTML = pixelSvg(spec.icon, 3);
    this.title.textContent = spec.title;
    this.sub.textContent = spec.sub;
    this.sub.hidden = !spec.sub;
    this.meta.textContent = spec.meta;
    this.meta.hidden = !spec.meta;
    this.dir.hidden = !spec.positioned;
    this.lastDist = '';
    this.dist.textContent = '';
    this.el.hidden = false;
    this.timer = setTimeout(() => this.next(), spec.ms ?? ALERT_MS);
  }

  private next(): void {
    this.timer = null;
    this.current = null;
    this.el.hidden = true;
    const n = this.queue.shift();
    if (!n) return;
    void this.el.offsetWidth; // restart the stepped entry animation
    this.show(n);
  }
}
