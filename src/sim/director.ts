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
export const NEXT_WAVE_AT = 3;
export const PATROL_SIZE = 3;
export const THROWER_SHARE = 0.3;
const VARIANTS: Variant[] = ['classic', 'palestinian', 'antifa'];

/** Waves replace "manche" in this slice. */
export function pressure(waveIndex: number, kos: number): number {
  return Math.min(CONFIG.pressureMax, 1 + waveIndex + Math.floor(kos / 12));
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
        // A secured victim is no longer urgent: waves may start while Paul goes to help.
        if (!host.rescue || host.rescue.stage !== 'threat') {
          this.enter('waves');
          this.launchWave(host, events);
        }
        break;
      case 'waves':
        if (host.horde.active().length <= NEXT_WAVE_AT) this.launchWave(host, events);
        break;
    }
    this.idlePatrol(dt, host);
    return events;
  }

  private enter(phase: DirectorPhase): void {
    this.phase = phase;
    this.timer = 0;
  }

  private launchWave(host: DirectorHost, events: SimEvent[]): void {
    this.wave += 1;
    const p = this.pressure(host.rules.kos);
    const size = Math.max(0, Math.min(CONFIG.caps.hostiles - host.horde.active().length, 4 + 2 * p));
    const pts = spawnPoints(host.player.pos);
    for (let i = 0; i < size; i++) {
      // floor((i+1)·0.3) > floor(i·0.3) marks exactly floor(size·0.3) throwers, spread through the wave
      const thrower = Math.floor((i + 1) * THROWER_SHARE) > Math.floor(i * THROWER_SHARE);
      if (!this.spawn(host, thrower ? 'thrower' : 'contact', pts)) break;
    }
    events.push({ type: 'WaveAnnounced', index: this.wave });
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
