import { CONFIG } from './config';
import type { Horde } from './hostiles';
import { RescueIncident } from './incidents/rescue';
import type { SchoolIncident } from './incidents/school';
import { DISTRICT } from './map/district';
import { FlowField } from './map/flowfield';
import type { Grid } from './map/grid';
import { dist } from './math';
import type { Player } from './player';
import type { Rules } from './rules';
import type { Role, SimEvent, Variant, Vec } from './types';

export type DirectorPhase = 'intro' | 'school' | 'breather' | 'rescue' | 'waves';

/** What the director reads and drives on the Sim (kept as an interface to avoid an import cycle). */
export interface DirectorHost {
  readonly player: Player;
  readonly horde: Horde;
  readonly school: SchoolIncident;
  readonly rules: Rules;
  readonly grid: Grid;
  readonly rand: () => number;
  rescue: RescueIncident | null;
}

export const INTRO_SEC = 4;
export const BREATHER_SEC = 8;
export const SPAWN_MIN_DIST = 320;
export const RESCUE_PATH_MIN = 300;
export const RESCUE_PATH_MAX = 900;
/** Next wave is prepared once at most this many rioters are left and the wave queue is empty. */
export const NEXT_WAVE_AT = 2;
/** Rest (s) between a cleared wave and the next one. */
export const WAVE_BREATHER_SEC = 6;
/** Rioters of a wave enter one by one, this many seconds apart. */
export const WAVE_SPAWN_INTERVAL = 1.5;
/** Waves never put more than this many rioters on the map at once (the rest wait their turn). */
export const WAVE_ACTIVE_CAP = 12;
export const WAVE_MAX_SIZE = 18;
export const PATROL_SIZE = 3;
/** Share of rock throwers in a wave (none in the first wave, so Paul learns to fight first). */
export const THROWER_SHARE = 0.2;
const VARIANTS: Variant[] = ['classic', 'palestinian', 'antifa'];

/** Waves replace "manche" in this slice. Rises one step every 2 waves and every 30 KOs. */
export function pressure(waveIndex: number, kos: number): number {
  return Math.min(CONFIG.pressureMax, 1 + Math.floor(waveIndex / 2) + Math.floor(kos / 30));
}

/** Rioters in wave n (1-based): 5, 7, 9 … capped. */
export function waveSize(wave: number): number {
  return Math.min(WAVE_MAX_SIZE, 3 + 2 * wave);
}

/** Edge spawn points >= 320 px from Paul; if none qualifies, the farthest one. */
export function spawnPoints(playerPos: Vec): Vec[] {
  const all = DISTRICT.hostileSpawns;
  const far = all.filter((p) => dist(p, playerPos) >= SPAWN_MIN_DIST);
  if (far.length > 0) return far;
  let best = all[0]!;
  for (const p of all) if (dist(p, playerPos) > dist(best, playerPos)) best = p;
  return [best];
}

/**
 * Rescue site whose path distance from Paul (BFS steps × tile) is within 300–900 px, chosen with `rand` among
 * qualifying sites; otherwise the closest one above 300 px; otherwise the farthest reachable (or the first).
 */
export function chooseRescueSite(grid: Grid, playerPos: Vec, rand: () => number): Vec {
  const field = new FlowField(grid);
  field.rebuild(playerPos);
  const sites = DISTRICT.rescueSites.map((p) => {
    const steps = field.stepsAt(p);
    return { p, d: steps < 0 ? Infinity : steps * grid.tile };
  });
  const ok = sites.filter((s) => s.d >= RESCUE_PATH_MIN && s.d <= RESCUE_PATH_MAX);
  if (ok.length > 0) return ok[Math.floor(rand() * ok.length) % ok.length]!.p;
  const above = sites.filter((s) => s.d > RESCUE_PATH_MIN && s.d !== Infinity).sort((a, b) => a.d - b.d);
  if (above.length > 0) return above[0]!.p;
  const reachable = sites.filter((s) => s.d !== Infinity).sort((a, b) => b.d - a.d);
  return (reachable[0] ?? sites[0]!).p;
}

/**
 * Session sequencing: 4 s intro → school incident → 8 s breather → rescue → endless waves.
 * Never more than one urgent incident (school threat or rescue threat) at a time in this slice.
 */
export class Director {
  phase: DirectorPhase = 'intro';
  /** Waves announced so far; the current wave's 1-based index (0 before the first wave). */
  wave = 0;
  private timer = 0;
  private idle = 0;
  private variantCursor = 0;
  private spawnCursor = 0;
  /** Rioters of the current wave still waiting to enter. */
  private queue: Role[] = [];
  private spawnTimer = 0;
  private rest = 0;

  /** Pressure for the current wave (0-based wave index) and session KOs. */
  pressure(kos: number): number {
    return pressure(Math.max(0, this.wave - 1), kos);
  }

  step(dt: number, host: DirectorHost): SimEvent[] {
    const events: SimEvent[] = [];
    this.timer += dt;
    switch (this.phase) {
      case 'intro':
        if (this.timer >= INTRO_SEC - 1e-9) {
          host.school.start(host.horde, spawnPoints(host.player.pos));
          events.push({ type: 'SchoolStarted', incidentId: host.school.id, pos: { ...DISTRICT.school.door } });
          this.enter('school');
        }
        break;
      case 'school':
        if (host.school.stage === 'saved' || host.school.stage === 'destroyed') this.enter('breather');
        break;
      case 'breather':
        if (this.timer >= BREATHER_SEC - 1e-9) {
          const rescue = new RescueIncident('rescue#1');
          const site = chooseRescueSite(host.grid, host.player.pos, host.rand);
          rescue.start(host.horde, site, host.rand, host.player.pos, host.grid);
          host.rescue = rescue;
          this.enter('rescue');
        }
        break;
      case 'rescue':
        // A secured victim is no longer urgent: waves may start while the victim thanks Paul.
        if (!host.rescue || host.rescue.stage !== 'threat') {
          this.enter('waves');
          this.launchWave(host, events);
        }
        break;
      case 'waves':
        this.stepWave(dt, host, events);
        break;
    }
    this.idlePatrol(dt, host);
    return events;
  }

  private enter(phase: DirectorPhase): void {
    this.phase = phase;
    this.timer = 0;
  }

  /** Feeds the queued rioters one by one; once the wave is nearly cleared, rests, then launches the next. */
  private stepWave(dt: number, host: DirectorHost, events: SimEvent[]): void {
    const active = host.horde.active().length;
    if (this.queue.length > 0) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= WAVE_SPAWN_INTERVAL - 1e-9 && active < WAVE_ACTIVE_CAP) this.enterNext(host);
      return;
    }
    if (active > NEXT_WAVE_AT) {
      this.rest = 0;
      return;
    }
    this.rest += dt;
    if (this.rest >= WAVE_BREATHER_SEC - 1e-9) this.launchWave(host, events);
  }

  private launchWave(host: DirectorHost, events: SimEvent[]): void {
    this.wave += 1;
    this.rest = 0;
    const size = waveSize(this.wave);
    const share = this.wave === 1 ? 0 : THROWER_SHARE;
    this.queue = [];
    for (let i = 0; i < size; i++) {
      // floor((i+1)·s) > floor(i·s) marks exactly floor(size·s) throwers, spread through the wave
      const thrower = Math.floor((i + 1) * share) > Math.floor(i * share);
      this.queue.push(thrower ? 'thrower' : 'contact');
    }
    events.push({ type: 'WaveAnnounced', index: this.wave });
    this.enterNext(host);
  }

  private enterNext(host: DirectorHost): void {
    const role = this.queue[0];
    if (!role) return;
    if (this.spawn(host, role, spawnPoints(host.player.pos))) this.queue.shift();
    this.spawnTimer = 0;
  }

  /** 25 s with nobody active → a small patrol of 3 contacts. */
  private idlePatrol(dt: number, host: DirectorHost): void {
    if (this.phase === 'intro' || host.horde.active().length > 0) {
      this.idle = 0;
      return;
    }
    this.idle += dt;
    if (this.idle < CONFIG.idlePatrolSec - 1e-9) return;
    this.idle = 0;
    const pts = spawnPoints(host.player.pos);
    for (let i = 0; i < PATROL_SIZE; i++) this.spawn(host, 'contact', pts);
  }

  private spawn(host: DirectorHost, role: Role, pts: Vec[]): boolean {
    const variant = VARIANTS[this.variantCursor % VARIANTS.length]!;
    const pos = pts[this.spawnCursor % pts.length]!;
    if (!host.horde.spawn({ variant, role, pos })) return false;
    this.variantCursor++;
    this.spawnCursor++;
    return true;
  }
}
