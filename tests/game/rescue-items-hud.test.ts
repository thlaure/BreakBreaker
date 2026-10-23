// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { AlertBanner, activeIncidents, alertFromEvent } from '../../src/game/hud/alerts';
import { incidentLines, itemsLine, rescueItemsLine } from '../../src/game/hud/format';
import { SHOUT_MS, THANKS_MS, VictimMood, itemShout } from '../../src/game/render/belongings';
import { RESCUE_ITEMS } from '../../src/sim/incidents/rescue';
import { Sim, type Snapshot } from '../../src/sim/sim';
import type { SimEvent } from '../../src/sim/types';

type Rescue = NonNullable<Snapshot['rescue']>;
type State = Rescue['items'][number]['state'];

function rescue(states: State[], patch: Partial<Rescue> = {}): Rescue {
  const victimPos = { x: 400, y: 300 };
  return {
    id: 'rescue#1',
    stage: 'threat',
    remaining: 20,
    victimPos,
    kind: 'elderlyRobbed',
    items: RESCUE_ITEMS.elderlyRobbed.map((it, i) => ({ ...it, state: states[i] ?? 'held', pos: { ...victimPos } })),
    returnLeft: null,
    ...patch,
  };
}

function snap(patch: (s: Snapshot) => void = () => {}): Snapshot {
  const s = new Sim(1).snapshot();
  patch(s);
  return s;
}

describe('rescue belongings in the HUD', () => {
  test('card progress « Objets n/3 rendus » (out of every belonging) once something was stolen', () => {
    expect(rescueItemsLine(rescue([]))).toBeNull();
    expect(rescueItemsLine(rescue(['carried-by-thief']))).toBe('Objets 0/3 rendus');
    expect(rescueItemsLine(rescue(['returned', 'dropped', 'carried']))).toBe('Objets 1/3 rendus');
    const lines = incidentLines(
      snap((x) => (x.rescue = rescue(['returned', 'carried-by-thief']))),
      'en cours',
    );
    const r = lines.find((l) => l.key === 'rescue')!;
    expect(r.items).toBe('Objets 1/3 rendus');
    expect(r.time).toBe('20 s');
  });

  test('during the wait the card reads « Rends les objets · 8 s »', () => {
    const s = snap((x) => (x.rescue = rescue(['returned', 'dropped'], { stage: 'secured', returnLeft: 7.2 })));
    const r = incidentLines(s, 'en cours').find((l) => l.key === 'rescue')!;
    expect(r.time).toBe('Rends les objets · 8 s');
    expect(r.status).toBe('sécurisé');
  });

  test('« Objets 2 » slot while carrying, hidden otherwise', () => {
    expect(itemsLine(snap())).toBeNull();
    expect(itemsLine(snap((x) => (x.carriedItems = 2)))).toBe('Objets 2');
  });

  test('edge indicator: rescue active while threatened, or secured with belongings on the ground or carried', () => {
    const has = (r: Rescue) => activeIncidents(snap((x) => (x.rescue = r))).some((i) => i.id === 'rescue');
    expect(has(rescue([]))).toBe(true);
    expect(has(rescue([], { stage: 'secured' }))).toBe(false);
    expect(has(rescue(['dropped'], { stage: 'secured', returnLeft: 5 }))).toBe(true);
    expect(has(rescue(['carried'], { stage: 'secured', returnLeft: 5 }))).toBe(true);
    expect(has(rescue(['returned', 'lost'], { stage: 'secured' }))).toBe(false);
    expect(has(rescue(['dropped'], { stage: 'completed' }))).toBe(false);
  });

  test('alert pruning unaffected: belonging events raise no banner; the rescue banner goes once the rescue is over', () => {
    const evs: SimEvent[] = [
      { type: 'ItemStolen', rescueId: 'rescue#1', item: 'handbag', thiefLifeId: 3 },
      { type: 'ItemDropped', rescueId: 'rescue#1', item: 'handbag', pos: { x: 1, y: 2 } },
      { type: 'ItemPickedUp', rescueId: 'rescue#1', item: 'handbag' },
      { type: 'ItemReturned', rescueId: 'rescue#1', item: 'handbag' },
    ];
    for (const e of evs) expect(alertFromEvent(e)).toBeNull();
    const host = document.createElement('div');
    const b = new AlertBanner(host);
    b.push(
      alertFromEvent({ type: 'RescueStarted', incidentId: 'rescue#1', pos: { x: 1, y: 1 }, kind: 'elderlyRobbed', wave: 1, total: 3 })!,
    );
    b.prune(new Set(activeIncidents(snap((x) => (x.rescue = rescue(['dropped'], { stage: 'secured', returnLeft: 4 })))).map((i) => i.id)));
    expect(b.shown?.id).toBe('rescue#1');
    b.prune(new Set(activeIncidents(snap((x) => (x.rescue = rescue(['lost'], { stage: 'completed' })))).map((i) => i.id)));
    expect(b.shown).toBeNull();
    b.destroy();
  });
});

describe('victim bubble', () => {
  test('every belonging has an ordinary shout', () => {
    for (const list of Object.values(RESCUE_ITEMS)) for (const it of list) expect(itemShout(it.id)).toMatch(/^(MON|MA) .+ !$/);
    expect(itemShout('handbag')).toBe('MON SAC !');
    expect(itemShout('cap')).toBe('MA CASQUETTE !');
  });

  test('help → « MON CHAPEAU ! » for 2 s after a theft → help; « MERCI ! » when handed back', () => {
    const m = new VictimMood();
    expect(m.update(rescue(['carried-by-thief']), 0)).toBe('help'); // first sight: no shout
    expect(m.update(rescue(['carried-by-thief', 'carried-by-thief']), 100)).toBe('shout:hat');
    expect(m.update(rescue(['carried-by-thief', 'carried-by-thief']), 100 + SHOUT_MS - 1)).toBe('shout:hat');
    expect(m.update(rescue(['carried-by-thief', 'carried-by-thief']), 100 + SHOUT_MS)).toBe('help');
    expect(m.update(rescue(['returned', 'carried-by-thief']), 5000)).toBe('thanks');
    expect(m.update(rescue(['returned', 'carried-by-thief']), 5000 + THANKS_MS)).toBe('help');
  });

  test('secured: asks for what is still out while waiting, thanks otherwise; a new rescue starts afresh', () => {
    const m = new VictimMood();
    expect(m.update(rescue(['returned', 'dropped'], { stage: 'secured', returnLeft: 6 }), 0)).toBe('shout:hat');
    expect(m.update(rescue(['returned', 'returned'], { stage: 'secured', returnLeft: null }), 10)).toBe('thanks');
    expect(m.update(rescue([], { stage: 'secured' }), 20)).toBe('thanks');
    expect(m.update(rescue([], { stage: 'failed' }), 30)).toBeNull();
    // same site, new id: the previous rescue's states are not carried over (no spurious shout)
    expect(m.update(rescue(['carried-by-thief'], { id: 'rescue#2' }), 40)).toBe('help');
  });
});
