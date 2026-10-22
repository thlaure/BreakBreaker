import { describe, expect, test } from 'vitest';
import { BREAKOUT_ALERT_MS, activeIncidents, alertFromEvent, incidentAlert } from '../../src/game/hud/alerts';
import { incidentLines } from '../../src/game/hud/format';
import {
  HOP_END,
  HOP_START,
  VAN_IN_MS,
  VAN_OUT_MS,
  VAN_RUN_MS,
  VAN_RUN_PX,
  VAN_STOP_MS,
  hopProgress,
  jailedText,
  releasedText,
  shownJailed,
  sweepAngle,
  vanPose,
} from '../../src/game/render/prisonMath';
import { ALLY_LOOKS } from '../../src/game/render/serviceMath';
import { targetDoor } from '../../src/sim/map/district';
import { Sim, type Snapshot } from '../../src/sim/sim';

function snap(patch: (s: Snapshot) => void = () => {}): Snapshot {
  const s = new Sim(1).snapshot();
  patch(s);
  return s;
}

describe('prison counter', () => {
  test('« Caïds enfermés : N »', () => {
    expect(jailedText(0)).toBe('Caïds enfermés : 0');
    expect(jailedText(3)).toBe('Caïds enfermés : 3');
  });

  test('a Caïd still riding the van is not counted yet, never below 0', () => {
    expect(shownJailed(3, 1)).toBe(2);
    expect(shownJailed(1, 1)).toBe(0);
    expect(shownJailed(0, 2)).toBe(0);
  });
});

describe('jail van', () => {
  test('drives in from behind, stops, drives on fading out', () => {
    expect(vanPose(-1, 1)).toBeNull();
    expect(vanPose(0, 1)).toMatchObject({ dx: -VAN_RUN_PX, alpha: 0, stage: 'in' });
    expect(vanPose(0, -1)!.dx).toBe(VAN_RUN_PX);
    expect(vanPose(VAN_IN_MS, 1)).toMatchObject({ dx: 0, alpha: 1, stage: 'stop', t: 0 });
    expect(vanPose(VAN_IN_MS + VAN_STOP_MS / 2, 1)).toMatchObject({ dx: 0, stage: 'stop', t: 0.5 });
    const out = vanPose(VAN_IN_MS + VAN_STOP_MS + VAN_OUT_MS / 2, 1)!;
    expect(out.stage).toBe('out');
    expect(out.dx).toBeGreaterThan(0);
    expect(out.alpha).toBeCloseTo(0.5);
    expect(vanPose(VAN_RUN_MS, 1)).toBeNull();
  });

  test('the Caïd hops during the stop only', () => {
    expect(hopProgress('in', 0.9)).toBe(0);
    expect(hopProgress('stop', HOP_START)).toBe(0);
    expect(hopProgress('stop', (HOP_START + HOP_END) / 2)).toBeCloseTo(0.5);
    expect(hopProgress('stop', HOP_END)).toBe(1);
    expect(hopProgress('out', 0)).toBe(1);
  });

  test('the searchlight sweeps the street below (south half)', () => {
    for (let t = 0; t < 6000; t += 250) {
      const a = sweepAngle(t);
      expect(a).toBeGreaterThan(0);
      expect(a).toBeLessThan(Math.PI);
    }
  });
});

describe('breakout banner', () => {
  test('PrisonBreakout pops « ÉVASION ! » pointing at the gate', () => {
    const pos = targetDoor('prison');
    const a = alertFromEvent({ type: 'PrisonBreakout', count: 3, pos })!;
    expect(a).toMatchObject({ kind: 'breakout', pos, total: 3 });
    expect(a.incident).toBeUndefined();
    const shown = incidentAlert(a.kind, a.wave, a.total);
    expect(shown).toMatchObject({ title: 'ÉVASION !', sub: '3 Caïds libérés', positioned: true, ms: BREAKOUT_ALERT_MS, icon: 'bars' });
    expect(incidentAlert('breakout', 0, 1).sub).toBe('1 Caïd libéré');
    expect(releasedText(2)).toBe('2 Caïds libérés');
  });

  test('released Caïds (role boss) each get the Caïd edge indicator', () => {
    const sim = new Sim(1);
    const h = sim.horde.spawn({ variant: 'classic', role: 'boss', pos: targetDoor('prison'), round: 4 })!;
    expect(activeIncidents(sim.snapshot()).some((i) => i.id === `caid#${h.lifeId}` && i.kind === 'caid')).toBe(true);
  });

  test('the prison attack banner and card', () => {
    expect(alertFromEvent({ type: 'TargetIgnited', target: 'prison', kind: 'prison', pos: targetDoor('prison'), incidentId: 'x', round: 4 } as never)).toMatchObject({
      kind: 'prison',
    });
    expect(incidentAlert('prison', 4).title).toBe('PRISON ATTAQUÉE !');
    const s = snap((x) => {
      const t = x.targets.find((tg) => tg.id === 'prison')!;
      t.state = 'attacked';
      t.hp = 300;
      x.prison = { ...x.prison, jailed: 2 };
    });
    const card = incidentLines(s, 'en cours').find((l) => l.key === 'prison')!;
    expect(card).toMatchObject({ name: 'Prison', time: '75 %', items: 'Caïds enfermés : 2' });
    const empty = incidentLines(
      snap((x) => {
        x.targets.find((tg) => tg.id === 'prison')!.state = 'attacked';
      }),
      'en cours',
    ).find((l) => l.key === 'prison')!;
    expect(empty.items).toBeNull();
  });
});

describe('guard look', () => {
  test('dark-grey uniform, a beret, bare hands: not the blue police', () => {
    const g = ALLY_LOOKS.guard;
    const p = ALLY_LOOKS.police;
    expect(g.cap).toBe('beret');
    expect(p.cap).toBe('kepi');
    expect(g.uniform).not.toBe(p.uniform);
    expect(g.baton).toBeNull();
    expect(p.baton).not.toBeNull();
    // grey: the channels close together, darker than mid-grey
    const [r, gg, b] = [(g.uniform >> 16) & 255, (g.uniform >> 8) & 255, g.uniform & 255];
    expect(Math.max(r, gg, b) - Math.min(r, gg, b)).toBeLessThan(20);
    expect(Math.max(r, gg, b)).toBeLessThan(0x80);
  });
});
