import { CONFIG } from './config';
import { DISTRICT } from './map/district';
import type { Sim } from './sim';
import type { Role, Variant } from './types';

const VARIANTS: Variant[] = ['classic', 'palestinian', 'antifa'];

export interface StressState {
  n: number;
}

/**
 * Stress driver (debug / bench only): keeps `target` active hostiles alive (mixed contact/thrower, all variants,
 * ~30 % throwers) and keeps the flying-rock budget full. Call once per step before `sim.step`.
 * Ground rocks (cap 16) accumulate naturally as flying ones land.
 */
export function topUp(sim: Sim, target: number, st: StressState): void {
  const spawns = DISTRICT.hostileSpawns;
  const want = Math.min(target, CONFIG.caps.hostiles);
  let active = sim.horde.active().length;
  while (active < want) {
    const i = st.n++;
    const role: Role = i % 10 < 3 ? 'thrower' : 'contact';
    const pos = spawns[i % spawns.length]!;
    if (!sim.horde.spawn({ variant: VARIANTS[i % 3]!, role, pos })) break;
    active += 1;
  }
  const flying = sim.rocks.flying().length;
  for (let k = flying; k < CONFIG.rock.maxFlying; k++) {
    const from = spawns[(st.n + k) % spawns.length]!;
    const a = ((st.n + k) * 2.399963) % (Math.PI * 2);
    const to = { x: sim.player.pos.x + Math.cos(a) * 200, y: sim.player.pos.y + Math.sin(a) * 200 };
    if (!sim.rocks.spawnEnemy(from, to, sim.now)) break;
  }
}
