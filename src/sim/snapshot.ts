import type { AlliesView } from './allies';
import { actionHint, callCtx, type ActionHint } from './agir';
import { CONFIG } from './config';
import type { RoundPhase, RoundSummary } from './director';
import type { StationMessage } from './healing';
import type { Hostile } from './hostiles';
import type { ItemState, RescueItemId, RescueKind, RescueStage } from './incidents/rescue';
import type { SchoolStage, SchoolStatus } from './incidents/school';
import { DISTRICT, type Rect } from './map/district';
import { v } from './math';
import type { MonumentIncident, MonumentStage } from './monument';
import type { RockState } from './projectiles';
import type { PrisonView } from './prison';
import type { ToolboxMessage } from './repair';
import type { SessionStats } from './rules';
import type { Sim } from './sim';
import type { CasseKind, MonumentFlag, Role, TargetId, Variant, Vec } from './types';
import type { HeldKind, PickupKind } from './weapons';

export interface Telegraph {
  from: Vec;
  to: Vec;
  until: number;
}

/** Plain, readonly render data (no class instances, no functions). */
export interface Snapshot {
  now: number;
  paused: boolean;
  ended: boolean;
  endCause: 'ko' | 'quit' | null;
  /** Current round (1-based, 1 from the start). */
  round: number;
  roundPhase: RoundPhase;
  /** Rioters in the current round's roster (0 during the intro). */
  roundTotal: number;
  /** Round-tagged rioters knocked out this round, clamped to [0, roundTotal]. */
  roundKos: number;
  /** Seconds of breather left (0 outside the breather). */
  breatherLeft: number;
  lastSummary: RoundSummary | null;
  player: { pos: Vec; facing: Vec; ko: boolean; invulnerable: boolean };
  hp: number;
  hpMax: number;
  carried: number;
  score: number;
  kos: number;
  hostiles: {
    lifeId: number;
    pos: Vec;
    facing: Vec;
    state: Hostile['state'];
    variant: Variant;
    role: Role;
    hp: number;
    /** Starting HP (bars: a brute once damaged, the Caïd always). */
    maxHp: number;
    /** Winding up a blow, a throw or a Molotov. */
    windup: boolean;
    /** Holding up a lit bottle (a Molotov or firebomber windup; not a firebomber's melee blow). */
    bottleUp: boolean;
    /** A shooter aiming or firing its burst (raised rifle, « ! »). */
    aiming: boolean;
  }[];
  rocks: { id: number; state: RockState; owner: 'enemy' | 'player'; kind: 'caillou' | 'pave' | 'brique'; pos: Vec }[];
  telegraphs: Telegraph[];
  /** Shooters' aim lines (from the shooter to where Paul stood at aim start) while they aim; gone at a KO. */
  aims: Telegraph[];
  /** Shooters' bullets in flight (`dir` unit). */
  bullets: { id: number; pos: Vec; dir: Vec }[];
  /** Paul's flashball shots in flight (`dir` unit). */
  flashballs: { id: number; pos: Vec; dir: Vec }[];
  /** The peaceful groups on the main square. */
  groups: { area: Rect; members: Vec[] }[];
  victim: Vec | null;
  /** `attacked` = an urgent attack on it; `burning` = on fire with no urgent attack (smouldering until put out). */
  targets: {
    id: TargetId;
    kind: CasseKind;
    hp: number;
    maxHp: number;
    burning: boolean;
    state: 'intact' | 'attacked' | 'burning' | 'ruined';
    door: Vec;
    footprint: Rect;
    prop: boolean;
  }[];
  toolboxes: {
    ground: { id: number; pos: Vec }[];
    carried: boolean;
    /** Seconds of repair done (0..CONFIG.kit.repairSec). */
    progress: number;
    message: ToolboxMessage;
    /** The ruin within reach of Paul, if any. */
    repairTarget: TargetId | null;
    /** A toolbox carried, a target to repair in reach, no hostile close: Agir (F) would start the repair. */
    canRepair: boolean;
    /** What the repair in reach would do: rebuild a ruin, or put out a fire; null with nothing in reach. */
    repairKind: 'ruin' | 'fire' | null;
    /** Agir was pressed: the repair progresses on its own. */
    started: boolean;
  };
  /** Bottles in flight toward a target (render only). */
  molotovs: Telegraph[];
  /** Firebombers' bottles in flight toward where Paul stood (`until` = landing). */
  firebombs: Telegraph[];
  /** Ground fire left by firebombs (Paul only); `secondsLeft` until it goes out. */
  firePatches: { id: number; pos: Vec; r: number; secondsLeft: number }[];
  /** The latest school attack; `integrity` = school hp in percent. */
  school: { stage: SchoolStage; integrity: number; status: SchoolStatus };
  /**
   * The latest rescue. `items`: the victim's belongings (`pos` = the victim, its thief, the ground or Paul);
   * `returnLeft`: seconds left of the wait for them while secured (null when not waiting).
   */
  rescue: {
    id: string;
    stage: RescueStage;
    remaining: number;
    victimPos: Vec;
    kind: RescueKind;
    items: { id: RescueItemId; state: ItemState; pos: Vec }[];
    returnLeft: number | null;
  } | null;
  /** Belongings of the rescue victim Paul carries. */
  carriedItems: number;
  stations: { id: string; pos: Vec; charged: boolean }[];
  stationMessage: StationMessage;
  /** Small field heals on the ground; `expiresAt` = sim time it vanishes (the render blinks its last seconds). */
  fieldHeals: { id: number; pos: Vec; expiresAt: number }[];
  /** Weapon in Paul's hands (null = bare hands) and its strikes left. */
  weapon: { kind: HeldKind; uses: number } | null;
  /** The bouclier's protection bubble on top of the held weapon (seconds left), or null. */
  shield: { secondsLeft: number } | null;
  /** Onde d’énergie charging: `progress` in [0, 1] of CONFIG.kamehame.chargeSec; null when not charging. */
  charge: { progress: number } | null;
  /** `expiresAt` = sim time the weapon vanishes (special drops 15 s, the others 60 s; null = never). */
  weaponsOnGround: { id: number; kind: PickupKind; pos: Vec; expiresAt: number | null }[];
  /** Mode furie on (seconds left), or null. */
  furie: { secondsLeft: number } | null;
  /**
   * The energy gauge (0..max, kept across rounds): `ready.onde` = the onde d’énergie can be charged (>= ondeCost),
   * `ready.furie` = the mode furie can start (full).
   */
  energy: { value: number; max: number; ready: { onde: boolean; furie: boolean } };
  /**
   * The equestrian monument: its flag; `occupation` = the latest occupation's stage and swap timer (null before the
   * first); capture the flag (`capture` seconds of `captureSec`, Paul `inZone`, `contested` by a hostile inside).
   */
  monument: {
    flag: MonumentFlag;
    capture: number;
    captureSec: number;
    inZone: boolean;
    contested: boolean;
    swaps: number;
    occupation: { id: string; stage: MonumentStage; swap: number; swapSec: number } | null;
    mast: Vec;
    zone: { x: number; y: number; r: number };
  };
  stats: SessionStats;
  /**
   * Emergency calls left (3 + 3 per session) and `hint`: a call of that kind would be accepted right now (booth
   * standing, a call left, no help of that kind on the map, a fire burning / enough rioters).
   */
  services: { calls: { fire: number; police: number }; hint: { fire: boolean; police: boolean } };
  /**
   * The emergency services on the map: the fire truck (null when none; `target` = the fire it drives to or sprays) and
   * the police officers (`down` = knocked out, carried off a few seconds later).
   */
  allies: AlliesView;
  /** The prison: Caïds jailed, its guards (by post), whether it stands. */
  prison: PrisonView;
  /**
   * What a fresh Agir press would do now, by the same rules as the press itself (Sim.agirChoice): a repair or an
   * extinguish that would start, a booth call that would be accepted; or `needToolbox` next to a ruin or a fire without
   * a toolbox. Null otherwise (nothing in reach, a rioter too close, a call that would be refused, cinematic, KO, end).
   */
  actionHint: ActionHint | null;
}

/** The Sim's own step-to-step state the snapshot reads (render-side lines, facings, last messages, the charge). */
export interface SnapshotExtras {
  facings: Map<number, Vec>;
  telegraphs: Telegraph[];
  aims: Telegraph[];
  molotovs: Telegraph[];
  toolboxMessage: ToolboxMessage;
  stationMessage: StationMessage;
  charge: { t: number } | null;
  lastOccupation: MonumentIncident | null;
}

export function buildSnapshot(sim: Sim, x: SnapshotExtras): Snapshot {
  const p = sim.player;
  const r = sim.rescue;
  const d = sim.director;
  const victim = r && (r.stage === 'threat' || r.stage === 'secured') ? v(r.victimPos) : null;
  return {
    now: sim.now,
    paused: sim.paused,
    ended: sim.rules.ended,
    endCause: sim.rules.endCause,
    round: d.round,
    roundPhase: d.phase,
    roundTotal: d.total,
    roundKos: d.roundKos(sim),
    breatherLeft: d.breatherLeft,
    lastSummary: d.lastSummary ? { ...d.lastSummary, objectives: d.lastSummary.objectives.map((o) => ({ ...o })) } : null,
    player: { pos: v(p.pos), facing: v(p.facing), ko: p.ko, invulnerable: sim.now < p.invulnUntil },
    hp: p.hp,
    hpMax: CONFIG.player.maxHp,
    carried: sim.rocks.carried,
    score: sim.rules.score,
    kos: sim.rules.kos,
    hostiles: sim.horde.list.map((h) => ({
      lifeId: h.lifeId,
      pos: v(h.pos),
      facing: v(x.facings.get(h.lifeId) ?? { x: 0, y: 1 }),
      state: h.state,
      variant: h.variant,
      role: h.role,
      hp: h.hp,
      maxHp: h.maxHp,
      windup: h.state === 'windup',
      bottleUp: h.state === 'windup' && sim.horde.bottleUp(h.lifeId),
      aiming: h.state === 'windup' && sim.horde.aiming(h.lifeId),
    })),
    rocks: [...sim.rocks.flying(), ...sim.rocks.ground()].map((k) => ({
      id: k.id,
      state: k.state,
      owner: k.owner,
      kind: k.kind,
      pos: v(k.pos),
    })),
    telegraphs: x.telegraphs.map((t) => ({ from: v(t.from), to: v(t.to), until: t.until })),
    aims: x.aims.map((t) => ({ from: v(t.from), to: v(t.to), until: t.until })),
    bullets: sim.bullets.enemy().map((b) => ({ id: b.id, pos: v(b.pos), dir: v(b.dir) })),
    flashballs: sim.bullets.player().map((b) => ({ id: b.id, pos: v(b.pos), dir: v(b.dir) })),
    groups: DISTRICT.peacefulGroups.map((g) => ({ area: { ...g.area }, members: g.members.map(v) })),
    victim,
    targets: DISTRICT.targets.map((def) => {
      const t = sim.targets.get(def.id);
      const attacked = sim.attacks.some((a) => a.target === def.id && a.urgent());
      return {
        id: def.id,
        kind: def.kind,
        hp: t.hp,
        maxHp: t.maxHp,
        burning: t.burning,
        state: t.state === 'ruined' ? 'ruined' : attacked ? 'attacked' : t.burning ? 'burning' : 'intact',
        door: v(def.door),
        footprint: { ...def.footprint },
        prop: def.prop,
      };
    }),
    toolboxes: {
      ground: sim.toolboxes.ground.map((g) => ({ id: g.id, pos: v(g.pos) })),
      carried: sim.toolboxes.carried,
      progress: sim.toolboxes.progress,
      message: x.toolboxMessage,
      ...repairView(sim),
    },
    molotovs: x.molotovs.map((t) => ({ from: v(t.from), to: v(t.to), until: t.until })),
    firebombs: sim.firePatches.flying().map((b) => ({ from: v(b.from), to: v(b.to), until: b.landAt })),
    firePatches: sim.firePatches.view(sim.now),
    school: {
      stage: sim.school.stage,
      integrity: sim.school.integrity(),
      status: sim.school.status(),
    },
    rescue: r
      ? {
          id: r.id,
          stage: r.stage,
          remaining: r.remaining,
          victimPos: v(r.victimPos),
          kind: r.kind,
          items: r.items.map((it) => ({ id: it.id, state: it.state, pos: v(it.pos) })),
          returnLeft: r.returnLeft,
        }
      : null,
    carriedItems: r ? r.carried : 0,
    stations: sim.stations.list.map((s) => ({ id: s.id, pos: v(s.pos), charged: s.charged })),
    stationMessage: x.stationMessage,
    fieldHeals: sim.fieldHeals.ground.map((h) => ({ id: h.id, pos: v(h.pos), expiresAt: h.expiresAt })),
    weapon: sim.weapons.held ? { kind: sim.weapons.held.kind, uses: sim.weapons.held.uses } : null,
    shield: sim.weapons.shield() ? { secondsLeft: sim.weapons.shieldLeft } : null,
    charge: x.charge ? { progress: Math.min(1, x.charge.t / CONFIG.kamehame.chargeSec) } : null,
    weaponsOnGround: sim.weapons.ground.map((w) => ({ id: w.id, kind: w.kind, pos: v(w.pos), expiresAt: w.expiresAt })),
    furie: sim.weapons.furie() ? { secondsLeft: sim.weapons.furieLeft } : null,
    energy: { value: sim.energy.value, max: CONFIG.energy.max, ready: sim.energy.ready() },
    monument: monumentView(sim, x.lastOccupation),
    stats: { ...sim.rules.stats },
    allies: sim.allies.view(),
    prison: sim.prison.view(sim.targets),
    services: {
      calls: { ...sim.services.calls },
      hint: {
        fire: sim.services.check('fire', callCtx(sim, 'fire')).ok,
        police: sim.services.check('police', callCtx(sim, 'police')).ok,
      },
    },
    actionHint: actionHint(sim),
  };
}

function monumentView(sim: Sim, lastOccupation: MonumentIncident | null): Snapshot['monument'] {
  const m = sim.monument;
  const o = sim.occupations[sim.occupations.length - 1] ?? lastOccupation;
  const z = DISTRICT.monument.zone;
  return {
    flag: m.flag,
    capture: m.progress,
    captureSec: CONFIG.monument.captureSec,
    inZone: m.paulInZone,
    contested: m.contested,
    swaps: m.swaps,
    occupation: o ? { id: o.id, stage: o.stage, swap: o.swapTimer, swapSec: CONFIG.monument.swapSec } : null,
    mast: v(DISTRICT.monument.mast),
    zone: { x: z.x, y: z.y, r: z.r },
  };
}

/** The toolbox repair in reach of Paul, as the HUD shows it. */
function repairView(sim: Sim): Pick<Snapshot['toolboxes'], 'repairTarget' | 'canRepair' | 'repairKind' | 'started'> {
  const kit = sim.toolboxes;
  const target = kit.repairTarget(sim.player.pos, sim.targets);
  const repairKind = target === null ? null : sim.targets.get(target).state === 'ruined' ? 'ruin' : 'fire';
  return { repairTarget: target, canRepair: target !== null && kit.ready, repairKind, started: kit.started };
}
