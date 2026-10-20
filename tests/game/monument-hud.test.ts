// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { activeIncidents, alertFromEvent, incidentAlert, incidentLook, ROUND_HEADLINES } from '../../src/game/hud/alerts';
import { incidentLines, roundPanel } from '../../src/game/hud/format';
import { Hud, type CameraView } from '../../src/game/hud/hud';
import { DISTRICT } from '../../src/sim/map/district';
import { Sim, type Snapshot } from '../../src/sim/sim';
import type { SimEvent } from '../../src/sim/types';

const MAST = DISTRICT.monument.mast;
const attacked: SimEvent = { type: 'MonumentAttacked', incidentId: 'monument#1', pos: { ...MAST }, round: 4, total: 28 };
const swapped: SimEvent = { type: 'FlagSwapped', incidentId: 'monument#1', pos: { ...MAST } };
const captured: SimEvent = { type: 'FlagCaptured', swap: 1, pos: { ...MAST } };

function snap(patch: (s: Snapshot) => void = () => {}): Snapshot {
  const s = new Sim(1).snapshot();
  patch(s);
  return s;
}
const palestinian = (x: Snapshot, capture = 0, o: { inZone?: boolean; contested?: boolean } = {}): void => {
  x.monument.flag = 'palestinian';
  x.monument.capture = capture;
  x.monument.inZone = o.inZone ?? false;
  x.monument.contested = o.contested ?? false;
};

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('monument alerts', () => {
  test('banners: « MONUMENT ATTAQUÉ ! » at the monument (warn, flag icon), « DRAPEAU REMPLACÉ ! », short « DRAPEAU RÉCUPÉRÉ ! »', () => {
    expect(alertFromEvent(attacked)).toEqual({ id: 'monument#1', kind: 'monument', pos: MAST, wave: 4, total: 28, incident: 'monument' });
    expect(incidentAlert('monument', 4, 28)).toMatchObject({
      title: 'MONUMENT ATTAQUÉ !',
      sub: 'Défends le drapeau',
      tone: 'warn',
      icon: 'flag',
      meta: 'Manche 4 · 28 casseurs',
      positioned: true,
    });
    expect(alertFromEvent(swapped)).toEqual({ id: 'monument#1:swap', kind: 'flag', pos: MAST, wave: 0, total: 0, incident: 'monument' });
    expect(incidentAlert('flag')).toMatchObject({ title: 'DRAPEAU REMPLACÉ !', sub: 'Reprends le monument', label: 'DRAPEAU', positioned: true });
    expect(alertFromEvent(captured)).toEqual({ id: 'flag#1', kind: 'flagCaptured', pos: null, wave: 0, total: 0 });
    const won = incidentAlert('flagCaptured');
    expect(won).toMatchObject({ title: 'DRAPEAU RÉCUPÉRÉ !', positioned: false });
    expect(won.ms).toBeLessThan(4000);
    expect(alertFromEvent({ type: 'MonumentDefended', incidentId: 'monument#1' })).toBeNull();
    expect(ROUND_HEADLINES.monument).toBe('Monument menacé');
    expect(incidentLook('flag')).toEqual({ tone: 'warn', icon: 'flag' });
  });

  test('activeIncidents: the monument while occupied, the flag while Palestinian (one id: monument), nothing when French and calm', () => {
    expect(activeIncidents(snap()).filter((i) => i.id === 'monument')).toEqual([]);
    const occ = snap((x) => {
      x.monument.occupation = { id: 'monument#1', stage: 'occupy', swap: 1, swapSec: 4 };
    });
    expect(activeIncidents(occ).filter((i) => i.id === 'monument')).toEqual([{ id: 'monument', kind: 'monument', pos: MAST }]);
    const defended = snap((x) => {
      x.monument.occupation = { id: 'monument#1', stage: 'defended', swap: 1, swapSec: 4 };
    });
    expect(activeIncidents(defended).filter((i) => i.id === 'monument')).toEqual([]);
    const lost = snap((x) => {
      palestinian(x);
      x.monument.occupation = { id: 'monument#1', stage: 'swapped', swap: 4, swapSec: 4 };
      x.roundPhase = 'breather';
    });
    expect(activeIncidents(lost).filter((i) => i.id === 'monument')).toEqual([{ id: 'monument', kind: 'flag', pos: MAST }]);
  });

  test('card « Drapeau — capture 5/8 s » with a capture bar; « zone contestée » when blocked; none while French', () => {
    expect(incidentLines(snap(), 'en cours').find((l) => l.key === 'monument')).toBeUndefined();
    const go = incidentLines(snap((x) => palestinian(x, 5.4, { inZone: true })), 'en cours').find((l) => l.key === 'monument')!;
    expect(go).toMatchObject({ kind: 'flag', name: 'Drapeau', time: 'capture 5/8 s', status: 'en cours', target: MAST });
    expect(go.hp).toBeCloseTo(67.5, 5);
    const blocked = incidentLines(snap((x) => palestinian(x, 3, { inZone: true, contested: true })), 'en cours').find((l) => l.key === 'monument')!;
    expect(blocked.status).toBe('zone contestée');
    const away = incidentLines(snap((x) => palestinian(x, 3)), 'en cours').find((l) => l.key === 'monument')!;
    expect(away.status).toBe('à reprendre');
  });

  test('round panel names the monument objective', () => {
    const s = snap((x) => {
      x.roundPhase = 'breather';
      x.breatherLeft = 3;
      x.lastSummary = { index: 4, kos: 28, objectives: [{ kind: 'monument', result: 'perdu' }], points: 25, bonus: false };
    });
    expect(roundPanel(s)!.objectives).toEqual([{ name: 'Monument', result: 'perdu' }]);
  });
});

describe('monument in the Hud', () => {
  const off: CameraView = { x: 5000, y: 5000, zoom: 1, width: 800, height: 600 };

  test('edge indicator « MONUMENT » during the occupation, « DRAPEAU » while the flag is Palestinian; flag card with its bar', () => {
    const hud = new Hud(document.body, null);
    const label = () => [...hud.root.querySelectorAll<HTMLElement>('.bb-edge .lbl')].map((e) => e.textContent);
    hud.update(snap((x) => (x.monument.occupation = { id: 'monument#1', stage: 'occupy', swap: 0, swapSec: 4 })), off);
    expect(label()).toEqual(['MONUMENT']);
    hud.update(snap((x) => palestinian(x, 2, { inZone: true, contested: true })), off);
    expect(label()).toEqual(['DRAPEAU']);
    const card = hud.root.querySelector<HTMLElement>('.bb-card.k-flag')!;
    expect(card.textContent).toContain('Drapeau');
    expect(card.textContent).toContain('capture 2/8 s');
    expect(card.textContent).toContain('zone contestée');
    expect(card.querySelector<HTMLElement>('.hpbar')!.hidden).toBe(false);
    expect(card.querySelector('.hpbar .fill')!.className).toBe('fill capture');
    hud.update(snap(), off);
    expect(label()).toEqual([]);
    expect(hud.root.querySelector('.bb-card.k-flag')).toBeNull();
    hud.destroy();
  });

  test('the occupation banner is dropped once the occupation is over (stale pruning by the monument id)', () => {
    const hud = new Hud(document.body, null);
    const a = hud.root.querySelector<HTMLElement>('.bb-alert')!;
    hud.onEvents([attacked]);
    hud.update(snap((x) => (x.monument.occupation = { id: 'monument#1', stage: 'occupy', swap: 0, swapSec: 4 })), off);
    expect(a.hidden).toBe(false);
    expect(a.textContent).toContain('MONUMENT ATTAQUÉ !');
    hud.update(snap((x) => (x.monument.occupation = { id: 'monument#1', stage: 'defended', swap: 0, swapSec: 4 })), off);
    expect(a.hidden).toBe(true);
    // the capture banner is position-less and never pruned
    hud.onEvents([captured]);
    hud.update(snap(), off);
    expect(a.hidden).toBe(false);
    expect(a.textContent).toContain('DRAPEAU RÉCUPÉRÉ !');
    hud.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('monument sounds', () => {
  test('alarm once when the monument is attacked, a chime on a capture or a defence', async () => {
    const { GameAudio } = await import('../../src/game/audio');
    const a = new GameAudio();
    const play = vi.spyOn(a, 'play').mockImplementation(() => undefined);
    const chime = vi.spyOn(a, 'chime').mockImplementation(() => undefined);
    a.onEvents([attacked]);
    a.onEvents([attacked]);
    expect(play.mock.calls.filter((c) => c[0] === 'alarm')).toHaveLength(1);
    a.onEvents([captured]);
    a.onEvents([{ type: 'MonumentDefended', incidentId: 'monument#2' }]);
    expect(chime).toHaveBeenCalledTimes(2);
  });
});
