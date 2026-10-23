import { topUp, type StressState } from '../sim/stress';
import type { Sim } from '../sim/sim';

/**
 * Dev-only stress mode: `/play/?stress=40` keeps N hostiles (mixed contact/thrower/firebomber, all variants) and a full
 * flying-rock budget alive, Paul invulnerable. Every call site is guarded by `import.meta.env.DEV`, so none of
 * this is reachable in production (tree-shaken).
 */
export function stressTarget(): number {
  if (!import.meta.env.DEV) return 0;
  const raw = new URLSearchParams(window.location.search).get('stress');
  const n = raw === null ? 0 : Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 40) : 0;
}

export function stressTick(sim: Sim, target: number, st: StressState): void {
  if (!import.meta.env.DEV) return;
  topUp(sim, target, st);
}
