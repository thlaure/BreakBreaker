import { CONFIG } from './config';
import type { AllyTarget, Horde, Hostile } from './hostiles';
import { moveCircle } from './map/collide';
import { DISTRICT, targetDoor } from './map/district';
import { FlowField } from './map/flowfield';
import type { Grid } from './map/grid';
import { dist, norm, sub } from './math';
import type { Rules } from './rules';
import type { Targets } from './targets';
import type { ServiceKind, SimEvent, TargetId, Vec } from './types';

/**
 * What an ally is. 'truck' = the fire truck; 'police' = an officer of the police group; 'guard' = a prison guard, held
 * to a post (src/sim/prison.ts owns them). Foot units ("fighters") share one brain.
 */
export type AllyRole = 'truck' | 'police' | 'guard';
/** The roles that fight on foot (every role but the truck). */
export type FighterRole = Exclude<AllyRole, 'truck'>;

/** Where a fighter is held: it only chases rioters within `radius` px of `pos`, never leaves that circle, and walks back to `pos` when idle. */
export interface AllyPost {
  pos: Vec;
  radius: number;
}

/** What every ally has: rioters' blows take hp off it (each unit has its own hp / maxHp). */
export interface AllyUnit {
  id: number;
  role: AllyRole;
  pos: Vec;
  hp: number;
  maxHp: number;
  /** null = free to roam (the police); set = held to a post. */
  post: AllyPost | null;
}

export type TruckState = 'arriving' | 'spraying' | 'leaving';

export interface Truck extends AllyUnit {
  role: 'truck';
  state: TruckState;
  /** The burning target it drives to / sprays (null while leaving). */
  target: TargetId | null;
  /** Where it parks for `target` (one of its attack points), or the entry point it leaves by. */
  goal: Vec | null;
  /** Seconds on the map (it leaves at CONFIG.services.truck.maxStaySec). */
  elapsed: number;
}

export type FighterState = 'run' | 'strike' | 'down';

export interface Fighter extends AllyUnit {
  role: FighterRole;
  state: FighterState;
  /** The rioter it goes for (lifeId), null when none. */
  quarry: number | null;
  /** End of the current baton windup. */
  strikeUntil: number;
  nextStrikeAt: number;
  /** Sim time it was knocked out (null while up). */
  downAt: number | null;
}

export interface AlliesCtx {
  now: number;
  horde: Horde;
  targets: Targets;
  rules: Rules;
  /** A fighter's (`role`) baton blow lands on rioter `lifeId` from `from` (the Sim applies the hit and scores the KO). */
  strike(lifeId: number, from: Vec, role: FighterRole): void;
}

/** What the render reads (Snapshot.allies). */
export interface AlliesView {
  truck: { pos: Vec; hp: number; maxHp: number; state: TruckState; target: TargetId | null } | null;
  /** The police group's officers (the prison guards are in Snapshot.prison); `role` picks their look. */
  police: { id: number; role: FighterRole; pos: Vec; hp: number; maxHp: number; state: FighterState }[];
}

const EPS = 1e-9;
/** Close enough to its goal (parking spot, entry point, post) to be there. */
const AT_GOAL = 4;
/** A fighter's field toward its moving quarry is rebuilt at most this often (close by, it goes straight anyway). */
const FIELD_REBUILD_SEC = 0.5;
/** Officers walking in from the same entry point fan out over this many px. */
const FAN = 10;
/** Within this many px of its goal with a clear line an ally walks straight; farther, it follows its field. */
const STRAIGHT_MAX = 128;

const v = (p: Vec): Vec => ({ x: p.x, y: p.y });

/**
 * The emergency services' allies on the map: at most one fire truck and one police group (CONFIG.services). They come
 * in at one of the rioters' entry points drawn from their own random stream, move through the street graph (the
 * horde's flow fields, other speeds), collide with solids only, and are fought by rioters after Paul (HordeCtx.allies).
 *
 * Truck: drives to the burning target nearest by path (parking on its nearest attack point), sprays every burning door
 * within sprayRadius at sprayRate fire per second (TruckSprayed once per target, FireOut when out: Targets.douse keeps
 * the hp left, the toolbox's `<fire>:extinguished` award and points), then the next fire; none left (or maxStaySec on
 * the map): it leaves by the entry point nearest by path (TruckLeft). 0 hp: TruckDestroyed, gone.
 * Fighters: each goes for the nearest active rioter not already taken by an earlier fighter (else the nearest), winds
 * its baton up within reach and strikes; a held one keeps to its post. A blow takes their hp (police: one blow) → down
 * (PoliceDown; a guard GuardDown), removed after downSec. The police group leaves after staySec, or once every officer is gone (PoliceLeft).
 */
export class Allies {
  truck: Truck | null = null;
  readonly fighters: Fighter[] = [];
  /** Sim time the police group leaves (null = no group on the map). */
  policeUntil: number | null = null;
  private nextId = 1;
  private now = 0;
  /** Steering field toward the truck's goal. */
  private readonly nav: FlowField;
  /** Scratch field for path measures (rebuilt at the truck when it picks a goal). */
  private readonly probe: FlowField;
  /** Each fighter's steering field and when it was last rebuilt. */
  private readonly fields = new Map<number, { field: FlowField; at: number }>();
  /** Spray progress on each target in reach (0..1); a key = its TruckSprayed was sent. */
  private readonly sprays = new Map<TargetId, number>();
  /** Fires put out that no incident set (fallback award keys). */
  private douses = 0;

  constructor(
    private readonly grid: Grid,
    private readonly rand: () => number,
  ) {
    this.nav = new FlowField(grid);
    this.probe = new FlowField(grid);
  }

  /** The help of `kind` is on the map (what makes a new call 'busy'). */
  onMap(kind: ServiceKind): boolean {
    return kind === 'fire' ? this.truck !== null : this.policeUntil !== null;
  }

  /** An accepted call: the truck, or CONFIG.services.police.count officers, come in at a drawn entry point. */
  call(kind: ServiceKind, now: number): SimEvent[] {
    this.now = now;
    const spawns = DISTRICT.hostileSpawns;
    const from = spawns[Math.min(spawns.length - 1, Math.floor(this.rand() * spawns.length))]!;
    if (kind === 'fire') {
      const c = CONFIG.services.truck;
      this.truck = {
        id: this.nextId++,
        role: 'truck',
        pos: v(from),
        hp: c.hp,
        maxHp: c.hp,
        post: null,
        state: 'arriving',
        target: null,
        goal: null,
        elapsed: 0,
      };
      return [{ type: 'TruckArrived', from: v(from) }];
    }
    const c = CONFIG.services.police;
    for (let i = 0; i < c.count; i++) {
      const off = (i - (c.count - 1) / 2) * FAN;
      const at = moveCircle(this.grid, from, { x: off, y: off }, CONFIG.hostile.radius);
      this.addFighter('police', at, { hp: c.hp });
    }
    this.policeUntil = now + c.staySec;
    return [{ type: 'PoliceArrived', from: v(from), count: c.count }];
  }

  /** Puts a fighter of `role` at `pos` with `hp` (and a post to hold, if any); returns it. */
  addFighter(role: FighterRole, pos: Vec, opts: { hp: number; post?: AllyPost }): Fighter {
    const f: Fighter = {
      id: this.nextId++,
      role,
      pos: v(pos),
      hp: opts.hp,
      maxHp: opts.hp,
      post: opts.post ? { pos: v(opts.post.pos), radius: opts.post.radius } : null,
      state: 'run',
      quarry: null,
      strikeUntil: 0,
      nextStrikeAt: 0,
      downAt: null,
    };
    this.fighters.push(f);
    this.fields.set(f.id, { field: new FlowField(this.grid), at: -Infinity });
    return f;
  }

  /** Takes fighter `id` off the map at once (a prison guard replaced at its post). */
  removeFighter(id: number): void {
    this.removeFighters((f) => f.id === id);
  }

  /** The allies rioters can fight: the truck and every fighter still up. */
  targetsFor(): AllyTarget[] {
    const out: AllyTarget[] = [];
    if (this.truck) out.push({ id: this.truck.id, pos: this.truck.pos, r: CONFIG.services.truck.reach });
    for (const f of this.fighters) if (f.state !== 'down') out.push({ id: f.id, pos: f.pos, r: CONFIG.hostile.radius });
    return out;
  }

  /** A rioter's blow: `amount` hp off ally `id`. The truck at 0: TruckDestroyed (gone); a fighter at 0: down. */
  damage(id: number, amount: number): SimEvent[] {
    const t = this.truck;
    if (t && t.id === id) {
      t.hp = Math.max(0, t.hp - amount);
      if (t.hp > 0) return [];
      this.truck = null;
      return [{ type: 'TruckDestroyed', pos: v(t.pos) }];
    }
    const f = this.fighters.find((x) => x.id === id);
    if (!f || f.state === 'down') return [];
    f.hp = Math.max(0, f.hp - amount);
    if (f.hp > 0) return [];
    f.state = 'down';
    f.downAt = this.now;
    f.quarry = null;
    return [f.role === 'guard' ? { type: 'GuardDown', id: f.id } : { type: 'PoliceDown', id: f.id }];
  }

  step(dt: number, ctx: AlliesCtx): SimEvent[] {
    this.now = ctx.now;
    const ev: SimEvent[] = [];
    if (this.truck) this.stepTruck(this.truck, dt, ctx, ev);
    if (this.fighters.length > 0) this.stepFighters(dt, ctx);
    if (this.policeUntil !== null) {
      const timeUp = ctx.now >= this.policeUntil - EPS;
      if (timeUp) this.removeFighters((f) => f.role === 'police');
      if (timeUp || !this.fighters.some((f) => f.role === 'police')) {
        this.policeUntil = null;
        ev.push({ type: 'PoliceLeft' });
      }
    }
    return ev;
  }

  /** BFS steps from `from` to the nearest attack point of `id` (-1 when none is reachable). */
  pathSteps(from: Vec, id: TargetId): number {
    this.probe.rebuild(from);
    return this.parkingOf(id)?.steps ?? -1;
  }

  view(): AlliesView {
    const t = this.truck;
    return {
      truck: t ? { pos: v(t.pos), hp: t.hp, maxHp: t.maxHp, state: t.state, target: t.target } : null,
      police: this.fighters
        .filter((f) => f.role === 'police')
        .map((f) => ({ id: f.id, role: f.role, pos: v(f.pos), hp: f.hp, maxHp: f.maxHp, state: f.state })),
    };
  }

  private stepTruck(t: Truck, dt: number, ctx: AlliesCtx, ev: SimEvent[]): void {
    const c = CONFIG.services.truck;
    t.elapsed += dt;
    if (t.state !== 'leaving' && t.elapsed >= c.maxStaySec - EPS) this.leave(t);
    if (t.state === 'spraying') {
      const inReach = this.burningNear(t.pos, ctx.targets);
      if (inReach.length === 0) this.pick(t, ctx.targets);
      else {
        if (t.target === null || !inReach.includes(t.target)) t.target = inReach[0]!;
        // a fire put out by someone else drops its progress (a new fire there is announced again)
        for (const id of [...this.sprays.keys()]) if (!inReach.includes(id)) this.sprays.delete(id);
        for (const id of inReach) this.spray(id, dt, ctx, ev);
        return;
      }
    }
    if (t.state === 'arriving' && (t.target === null || !ctx.targets.get(t.target).burning)) this.pick(t, ctx.targets);
    if (t.state === 'arriving') {
      if (this.drive(t, dt)) {
        t.state = 'spraying';
        for (const id of this.burningNear(t.pos, ctx.targets)) this.spray(id, dt, ctx, ev);
      }
      return;
    }
    if (t.state === 'leaving' && this.drive(t, dt)) {
      this.truck = null;
      ev.push({ type: 'TruckLeft' });
    }
  }

  private spray(id: TargetId, dt: number, ctx: AlliesCtx, ev: SimEvent[]): void {
    const was = this.sprays.get(id);
    if (was === undefined) ev.push({ type: 'TruckSprayed', target: id });
    const p = (was ?? 0) + CONFIG.services.truck.sprayRate * dt;
    if (p + EPS < 1) {
      this.sprays.set(id, p);
      return;
    }
    this.sprays.delete(id);
    const fire = ctx.targets.douse(id);
    const kind = DISTRICT.targets.find((d) => d.id === id)!.kind;
    // the toolbox's key: one fire scores once, whoever puts it out
    const key = fire !== null ? `${fire}:extinguished` : `${id}:extinguished#truck${++this.douses}`;
    ctx.rules.award(key, CONFIG.casse.scores[kind][2], targetDoor(id));
    ev.push({ type: 'FireOut', target: id });
  }

  /** Burning targets whose door is within sprayRadius of `pos`, in DISTRICT order. */
  private burningNear(pos: Vec, targets: Targets): TargetId[] {
    const r = CONFIG.services.truck.sprayRadius;
    return DISTRICT.targets.filter((d) => targets.get(d.id).burning && dist(pos, d.door) <= r).map((d) => d.id);
  }

  /** Next fire: the burning target nearest by path (ties: DISTRICT order), parking on its nearest attack point; none: leave. */
  private pick(t: Truck, targets: Targets): void {
    this.probe.rebuild(t.pos);
    let best: { id: TargetId; at: Vec; steps: number } | null = null;
    for (const d of DISTRICT.targets) {
      if (!targets.get(d.id).burning) continue;
      const p = this.parkingOf(d.id);
      if (p && (!best || p.steps < best.steps)) best = { id: d.id, at: p.at, steps: p.steps };
    }
    this.sprays.clear();
    if (!best) {
      this.leave(t);
      return;
    }
    t.state = 'arriving';
    t.target = best.id;
    t.goal = v(best.at);
    this.nav.rebuild(best.at);
  }

  /** The attack point of `id` nearest by the probe field (built at the truck), or null when none is reachable. */
  private parkingOf(id: TargetId): { at: Vec; steps: number } | null {
    let best: { at: Vec; steps: number } | null = null;
    for (const q of DISTRICT.targets.find((d) => d.id === id)!.attackPoints) {
      const s = this.probe.stepsAt(q);
      if (s >= 0 && (!best || s < best.steps)) best = { at: q, steps: s };
    }
    return best;
  }

  /** Off the map by the entry point nearest by path (ties: DISTRICT order; none reachable: the first). */
  private leave(t: Truck): void {
    this.probe.rebuild(t.pos);
    let exit = DISTRICT.hostileSpawns[0]!;
    let bestSteps = Infinity;
    for (const q of DISTRICT.hostileSpawns) {
      const s = this.probe.stepsAt(q);
      if (s >= 0 && s < bestSteps) {
        exit = q;
        bestSteps = s;
      }
    }
    t.state = 'leaving';
    t.target = null;
    t.goal = v(exit);
    this.sprays.clear();
    this.nav.rebuild(exit);
  }

  /** One step toward the truck's goal (straight when the line is clear, else the nav field); true once there. */
  private drive(t: Truck, dt: number): boolean {
    const goal = t.goal!;
    const c = CONFIG.services.truck;
    t.pos = this.walk(t.pos, goal, this.nav, this.straight(t.pos, goal), c.speed * dt, c.radius);
    return dist(t.pos, goal) <= AT_GOAL;
  }

  /** Close to `goal` with a clear line: go straight (far off, the field: a long line test costs more than it saves). */
  private straight(pos: Vec, goal: Vec): boolean {
    return dist(pos, goal) <= STRAIGHT_MAX && this.grid.lineClear(pos, goal);
  }

  private walk(pos: Vec, goal: Vec, field: FlowField, straight: boolean, max: number, r: number): Vec {
    const d = dist(pos, goal);
    if (d <= EPS) return pos;
    let dir = straight ? norm(sub(goal, pos)) : field.dirAt(pos);
    if (dir.x === 0 && dir.y === 0) dir = norm(sub(goal, pos));
    const s = Math.min(max, d);
    return moveCircle(this.grid, pos, { x: dir.x * s, y: dir.y * s }, r);
  }

  private stepFighters(dt: number, ctx: AlliesCtx): void {
    const c = CONFIG.services.police;
    const now = ctx.now;
    // the down ones are carried off after downSec
    this.removeFighters((f) => f.state === 'down' && f.downAt !== null && now - f.downAt >= c.downSec - EPS);
    const active = ctx.horde.active();
    const taken = new Set<number>();
    for (const f of this.fighters) {
      if (f.state === 'down') continue;
      if (f.state === 'strike') {
        if (now < f.strikeUntil - EPS) continue;
        f.state = 'run';
        const q = active.find((h) => h.lifeId === f.quarry);
        if (q && q.state !== 'ko' && dist(f.pos, q.pos) <= c.hitRange) ctx.strike(q.lifeId, v(f.pos), f.role);
        continue;
      }
      const q = this.quarryOf(f, active, taken);
      f.quarry = q?.lifeId ?? null;
      if (q) taken.add(q.lifeId);
      if (!q) {
        if (f.post && dist(f.pos, f.post.pos) > AT_GOAL) this.stride(f, f.post.pos, dt, now);
        continue;
      }
      if (dist(f.pos, q.pos) <= c.reach) {
        if (now >= f.nextStrikeAt - EPS) {
          f.state = 'strike';
          f.strikeUntil = now + c.windup;
          f.nextStrikeAt = now + c.cooldown;
        }
        continue;
      }
      this.stride(f, q.pos, dt, now);
    }
  }

  /** The nearest active rioter (within its post, if held) not taken by an earlier fighter this step, else the nearest. */
  private quarryOf(f: Fighter, active: Hostile[], taken: Set<number>): Hostile | null {
    let free: Hostile | null = null;
    let any: Hostile | null = null;
    let freeD = Infinity;
    let anyD = Infinity;
    for (const h of active) {
      if (f.post && dist(h.pos, f.post.pos) > f.post.radius) continue;
      const d = dist(f.pos, h.pos);
      if (d < anyD) {
        any = h;
        anyD = d;
      }
      if (!taken.has(h.lifeId) && d < freeD) {
        free = h;
        freeD = d;
      }
    }
    return free ?? any;
  }

  /**
   * A fighter's run toward `goal`: straight when close with a clear line, else its own field (rebuilt at most every
   * FIELD_REBUILD_SEC); a held one never leaves its post.
   */
  private stride(f: Fighter, goal: Vec, dt: number, now: number): void {
    const slot = this.fields.get(f.id)!;
    // the field is only needed off the straight line
    const straight = this.straight(f.pos, goal);
    if (!straight && now - slot.at >= FIELD_REBUILD_SEC - EPS) {
      slot.at = now;
      slot.field.rebuild(goal);
    }
    const next = this.walk(f.pos, goal, slot.field, straight, CONFIG.services.police.speed * dt, CONFIG.hostile.radius);
    // a held one never steps out of its post (back toward it is always allowed)
    if (f.post && dist(next, f.post.pos) > f.post.radius && dist(next, f.post.pos) >= dist(f.pos, f.post.pos)) return;
    f.pos = next;
  }

  private removeFighters(pred: (f: Fighter) => boolean): void {
    for (let i = this.fighters.length - 1; i >= 0; i--) {
      const f = this.fighters[i]!;
      if (!pred(f)) continue;
      this.fighters.splice(i, 1);
      this.fields.delete(f.id);
    }
  }
}
