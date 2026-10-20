import { expect, test } from 'vitest';
import { CONFIG } from '../../src/sim/config';
import { EntryQueue, ImmediateSpawner, type SpawnRequest } from '../../src/sim/entry';
import { Horde } from '../../src/sim/hostiles';
import type { Vec } from '../../src/sim/types';

const DT = 1 / 60;
const POINTS: Vec[] = [{ x: 16, y: 16 }];
const FAR: Vec = { x: 1000, y: 1000 };

const reqs = (n: number, incidentId: string, round = 1): SpawnRequest[] =>
  Array.from({ length: n }, () => ({ variant: 'classic' as const, role: 'contact' as const, incidentId, round }));

/** Steps the queue `sec` seconds from `t0`; returns the entry times and incident ids. */
function run(q: EntryQueue, horde: Horde, t0: number, sec: number): { t: number; id: string | null }[] {
  const out: { t: number; id: string | null }[] = [];
  const n = Math.round(sec / DT);
  for (let i = 1; i <= n; i++) for (const h of q.step(DT, horde, POINTS)) out.push({ t: t0 + i * DT, id: h.incidentId });
  return out;
}

test('entry queue: first entry 2 s after request, then 1.5 s apart, none while 12 active, front batch jumps the line', () => {
  const horde = new Horde();
  const q = new EntryQueue();
  q.request(reqs(3, 'a'));
  expect(q.length).toBe(3);
  expect(q.pendingForRound(1)).toBe(3);
  expect(q.pendingForRound(2)).toBe(0);
  const e = run(q, horde, 0, 5.1);
  expect(e.map((x) => x.t)).toEqual([
    expect.closeTo(CONFIG.round.firstDelay, 6),
    expect.closeTo(CONFIG.round.firstDelay + CONFIG.round.interval, 6),
    expect.closeTo(CONFIG.round.firstDelay + 2 * CONFIG.round.interval, 6),
  ]);
  expect(q.length).toBe(0);

  // gate: 12 active hostiles hold the line
  for (let i = horde.active().length; i < CONFIG.round.gate; i++) horde.spawn({ variant: 'classic', role: 'contact', pos: FAR });
  q.request(reqs(2, 'b'));
  expect(run(q, horde, 0, 4)).toEqual([]);
  horde.applyHit(horde.active()[0]!.lifeId, 99);
  const g = run(q, horde, 0, DT);
  expect(g).toHaveLength(1);
  expect(q.length).toBe(1);

  // front: a batch requested later enters before the rest of the line
  horde.active().forEach((h) => horde.applyHit(h.lifeId, 99));
  q.clear();
  q.request(reqs(4, 'fill'));
  run(q, horde, 0, CONFIG.round.firstDelay); // first fill entry
  q.request(reqs(2, 'obj'), { front: true });
  const f = run(q, horde, 0, CONFIG.round.firstDelay + CONFIG.round.interval + 0.01);
  expect(f.map((x) => x.id)).toEqual(['obj', 'obj']);
  expect(run(q, horde, 0, 3.1).map((x) => x.id)).toEqual(['fill', 'fill']);
});

test('entry queue keeps a refused request at the head when the 40 cap is reached', () => {
  const horde = new Horde();
  const q = new EntryQueue({ ...CONFIG.round, gate: 99 });
  for (let i = 0; i < CONFIG.caps.hostiles; i++) horde.spawn({ variant: 'classic', role: 'contact', pos: FAR });
  q.request([{ variant: 'antifa', role: 'degrader', incidentId: 'x', site: 'school', round: 2 }]);
  expect(run(q, horde, 0, 3)).toEqual([]);
  expect(q.length).toBe(1);
  expect(q.pendingForRound(2)).toBe(1);
  horde.applyHit(horde.active()[0]!.lifeId, 99);
  const [h] = q.step(DT, horde, POINTS);
  expect(h).toMatchObject({ variant: 'antifa', role: 'degrader', incidentId: 'x', site: 'school', round: 2 });
  expect(q.length).toBe(0);
});

test('immediate spawner spawns at once and retries refused requests on step', () => {
  const horde = new Horde();
  for (let i = 0; i < CONFIG.caps.hostiles - 1; i++) horde.spawn({ variant: 'classic', role: 'contact', pos: FAR });
  const sp = new ImmediateSpawner(horde, () => POINTS);
  sp.request(reqs(2, 'i'));
  expect(horde.active().filter((h) => h.incidentId === 'i')).toHaveLength(1);
  expect(sp.length).toBe(1);
  expect(sp.step()).toEqual([]);
  horde.applyHit(horde.active()[0]!.lifeId, 99);
  expect(sp.step()).toHaveLength(1);
  expect(sp.length).toBe(0);
});
