// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  ALERT_MS,
  AlertBanner,
  activeIncidents,
  alertFromEvent,
  arrowFor,
  bearingDeg,
  edgePosition,
  formatMeters,
  incidentAlert,
  pixelSvg,
} from '../../src/game/hud/alerts';
import { Hud, type CameraView } from '../../src/game/hud/hud';
import { DISTRICT } from '../../src/sim/map/district';
import { Sim, type Snapshot } from '../../src/sim/sim';
import type { SimEvent } from '../../src/sim/types';

const DOOR = DISTRICT.school.door;
const schoolEv: SimEvent = { type: 'SchoolStarted', incidentId: 'school#1', pos: { ...DOOR }, wave: 1, total: 11 };
const rescueEv = (kind: 'groupHarassed' | 'elderlyRobbed'): SimEvent => ({
  type: 'RescueStarted',
  incidentId: 'rescue#1',
  pos: { x: 900, y: 600 },
  kind,
  wave: 2,
  total: 3,
});
const waveEv: SimEvent = { type: 'RoundStarted', index: 3, total: 9, headline: 'car' };

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('pure helpers', () => {
  test('incidentAlert gives the title, sub-line, tone and icon of each kind', () => {
    expect(incidentAlert('school')).toMatchObject({ title: 'ÉCOLE EN FEU !', sub: 'Rejoins l’école', label: 'ÉCOLE', tone: 'fire', icon: 'flame' });
    expect(incidentAlert('groupHarassed')).toMatchObject({ title: 'AGRESSION EN COURS !', sub: 'Une personne est menacée', label: 'AGRESSION', tone: 'warn', icon: 'alert' });
    expect(incidentAlert('elderlyRobbed')).toMatchObject({ title: 'VOL EN COURS !', sub: 'Une personne âgée est menacée', label: 'VOL', tone: 'warn', icon: 'alert' });
  });

  test('alertFromEvent maps incident starts and round starts (a round has no position)', () => {
    expect(alertFromEvent(schoolEv)).toEqual({ id: 'school#1', kind: 'school', pos: DOOR, wave: 1, total: 11 });
    expect(alertFromEvent(rescueEv('elderlyRobbed'))).toEqual({ id: 'rescue#1', kind: 'elderlyRobbed', pos: { x: 900, y: 600 }, wave: 2, total: 3 });
    expect(alertFromEvent(waveEv)).toEqual({ id: 'round#3', kind: 'wave', pos: null, wave: 3, total: 9 });
    expect(alertFromEvent({ type: 'HealCompleted' })).toBeNull();
  });

  test('incidentAlert: round banner title/sub; incidents get a « Manche N · T casseurs » line', () => {
    expect(incidentAlert('wave', 3, 9)).toMatchObject({ title: 'MANCHE 3 !', sub: '9 casseurs à neutraliser', meta: '', tone: 'wave', icon: 'horde', positioned: false });
    expect(incidentAlert('wave', 4, 1).sub).toBe('1 casseur à neutraliser');
    expect(incidentAlert('school', 1, 11)).toMatchObject({ title: 'ÉCOLE EN FEU !', meta: 'Manche 1 · 11 casseurs', positioned: true });
    expect(incidentAlert('elderlyRobbed', 2, 3).meta).toBe('Manche 2 · 3 casseurs');
    expect(incidentAlert('school').meta).toBe('');
  });

  test('distance in metres (32 px = 1 m) and bearing in degrees', () => {
    expect(formatMeters({ x: 0, y: 0 }, { x: 32 * 38, y: 0 })).toBe('38 m');
    expect(formatMeters({ x: 0, y: 0 }, { x: 30, y: 40 })).toBe('2 m');
    expect(bearingDeg({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
    expect(bearingDeg({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(90);
    expect(bearingDeg({ x: 0, y: 0 }, { x: -10, y: 0 })).toBe(180);
    expect(bearingDeg({ x: 0, y: 0 }, { x: 0, y: -10 })).toBe(-90);
  });

  test('edgePosition: null on screen, clamped to the edge off screen, clear of avoided boxes', () => {
    const view = { width: 800, height: 600 };
    const half = { x: 60, y: 20 };
    expect(edgePosition({ x: 400, y: 300 }, view, half, 8)).toBeNull();
    expect(edgePosition({ x: 2000, y: 300 }, view, half, 8)).toEqual({ x: 732, y: 300 });
    expect(edgePosition({ x: 400, y: -500 }, view, half, 8)).toEqual({ x: 400, y: 28 });
    // top-left HUD panel: pushed below it
    const p = edgePosition({ x: -1000, y: -1000 }, view, half, 8, [{ left: 0, top: 0, right: 300, bottom: 200 }])!;
    expect(p.x <= 300 + half.x && p.y <= 200 + half.y).toBe(false);
    expect(p.x).toBeGreaterThanOrEqual(68);
    expect(p.y).toBeLessThanOrEqual(580);
  });

  test('activeIncidents: school while threatened, rescue only in threat', () => {
    const s = new Sim(1).snapshot();
    expect(activeIncidents(s)).toEqual([]);
    s.school.stage = 'attack';
    s.rescue = { stage: 'threat', remaining: 9, victimPos: { x: 5, y: 6 }, kind: 'groupHarassed' };
    expect(activeIncidents(s).map((i) => i.kind)).toEqual(['school', 'groupHarassed']);
    s.school.stage = 'saved';
    s.rescue.stage = 'secured';
    expect(activeIncidents(s)).toEqual([]);
  });

  test('arrows snap to 8 directions and only turn by multiples of 90°', () => {
    expect(arrowFor(0)).toEqual({ sprite: 'arrow', rot: 0 });
    expect(arrowFor(20)).toEqual({ sprite: 'arrow', rot: 0 });
    expect(arrowFor(30)).toEqual({ sprite: 'arrowDiag', rot: 0 });
    expect(arrowFor(90)).toEqual({ sprite: 'arrow', rot: 90 });
    expect(arrowFor(-90)).toEqual({ sprite: 'arrow', rot: 270 });
    expect(arrowFor(-135)).toEqual({ sprite: 'arrowDiag', rot: 180 });
    expect(arrowFor(179)).toEqual({ sprite: 'arrow', rot: 180 });
    for (let d = -180; d <= 180; d += 7) expect(arrowFor(d).rot % 90).toBe(0);
  });

  test('pixel icons are crisp inline SVGs', () => {
    for (const n of ['flame', 'alert', 'horde', 'arrow', 'arrowDiag'] as const) {
      const svg = pixelSvg(n);
      expect(svg).toContain('shape-rendering="crispEdges"');
      expect(svg).toContain('<rect');
      expect(svg).not.toMatch(/href|<image/);
    }
  });
});

describe('AlertBanner', () => {
  test('shows the right text and icon, live arrow and distance, then hides after ~6 s', () => {
    const b = new AlertBanner(document.body);
    b.push(alertFromEvent(schoolEv)!);
    expect(b.el.hidden).toBe(false);
    expect(b.el.getAttribute('role')).toBe('alert');
    expect(b.el.className).toContain('tone-fire');
    expect(b.el.querySelector('.title')!.textContent).toBe('ÉCOLE EN FEU !');
    expect(b.el.querySelector('.sub')!.textContent).toBe('Rejoins l’école');
    expect(b.el.querySelector<HTMLElement>('.meta')!.textContent).toBe('Manche 1 · 11 casseurs');
    expect(b.el.querySelector<HTMLElement>('.meta')!.hidden).toBe(false);
    expect(b.el.querySelector<HTMLElement>('.dir')!.hidden).toBe(false);
    expect(b.el.querySelector('.ico svg')).toBeTruthy();
    b.track({ x: DOOR.x - 32 * 10, y: DOOR.y });
    expect(b.el.querySelector('.dist')!.textContent).toBe('10 m');
    const arrow = b.el.querySelector<HTMLElement>('.arrow')!;
    expect(arrow.dataset.dir).toBe('arrow:0');
    expect(arrow.querySelector('svg')).toBeTruthy();
    b.track({ x: DOOR.x, y: DOOR.y - 64 });
    expect(arrow.dataset.dir).toBe('arrow:90');
    expect(arrow.style.transform).toBe('rotate(90deg)');
    b.track({ x: DOOR.x - 64, y: DOOR.y - 64 });
    expect(arrow.dataset.dir).toBe('arrowDiag:0');
    vi.advanceTimersByTime(ALERT_MS - 100);
    expect(b.el.hidden).toBe(false);
    vi.advanceTimersByTime(200);
    expect(b.el.hidden).toBe(true);
  });

  test('queues a second alert and shows it after the first', () => {
    const b = new AlertBanner(document.body);
    b.push(alertFromEvent(schoolEv)!);
    b.push(alertFromEvent(rescueEv('groupHarassed'))!);
    expect(b.el.querySelector('.title')!.textContent).toBe('ÉCOLE EN FEU !');
    vi.advanceTimersByTime(ALERT_MS);
    expect(b.el.hidden).toBe(false);
    expect(b.el.querySelector('.title')!.textContent).toBe('AGRESSION EN COURS !');
    expect(b.el.querySelector('.sub')!.textContent).toBe('Une personne est menacée');
    expect(b.el.className).toContain('tone-warn');
    vi.advanceTimersByTime(ALERT_MS);
    expect(b.el.hidden).toBe(true);
  });

  test('round start: « MANCHE 3 ! », objective line, no arrow or distance, queued like other alerts', () => {
    const b = new AlertBanner(document.body);
    b.push(alertFromEvent(rescueEv('groupHarassed'))!);
    b.push(alertFromEvent(waveEv)!);
    vi.advanceTimersByTime(ALERT_MS);
    expect(b.el.hidden).toBe(false);
    expect(b.el.getAttribute('role')).toBe('alert');
    expect(b.el.className).toContain('tone-wave');
    expect(b.el.querySelector('.title')!.textContent).toBe('MANCHE 3 !');
    expect(b.el.querySelector('.sub')!.textContent).toBe('9 casseurs à neutraliser');
    expect(b.el.querySelector<HTMLElement>('.meta')!.hidden).toBe(true);
    expect(b.el.querySelector<HTMLElement>('.dir')!.hidden).toBe(true);
    expect(b.el.querySelector('.ico svg')).toBeTruthy();
    b.track({ x: 0, y: 0 }); // no position: nothing to track, no crash
    expect(b.el.querySelector('.dist')!.textContent).toBe('');
    vi.advanceTimersByTime(ALERT_MS);
    expect(b.el.hidden).toBe(true);
  });

  test('elderly robbery reads VOL EN COURS !', () => {
    const b = new AlertBanner(document.body);
    b.push(alertFromEvent(rescueEv('elderlyRobbed'))!);
    expect(b.el.querySelector('.title')!.textContent).toBe('VOL EN COURS !');
    expect(b.el.querySelector('.sub')!.textContent).toBe('Une personne âgée est menacée');
  });
});

describe('Hud alerts and edge indicators', () => {
  const view: CameraView = { x: 0, y: 0, zoom: 1, width: 800, height: 600 };
  const snap = (patch: (s: Snapshot) => void): Snapshot => {
    const s = new Sim(1).snapshot();
    patch(s);
    return s;
  };

  test('onEvents pops the banner for SchoolStarted', () => {
    const hud = new Hud(document.body, null);
    hud.onEvents([schoolEv]);
    const a = hud.root.querySelector<HTMLElement>('.bb-alert')!;
    expect(a.hidden).toBe(false);
    expect(a.textContent).toContain('ÉCOLE EN FEU !');
    expect(a.textContent).toContain('Manche 1 · 11 casseurs');
    hud.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('onEvents pops the round banner for RoundStarted', () => {
    const hud = new Hud(document.body, null);
    hud.onEvents([waveEv]);
    const a = hud.root.querySelector<HTMLElement>('.bb-alert')!;
    expect(a.hidden).toBe(false);
    expect(a.textContent).toContain('MANCHE 3 !');
    hud.update(snap(() => {}), view);
    expect(a.querySelector('.dist')!.textContent).toBe('');
    hud.destroy();
  });

  test('HUD round line shows K/T and pulses when the round number changes', () => {
    const hud = new Hud(document.body, null);
    const line = () => [...hud.root.querySelectorAll<HTMLElement>('.stat')].find((e) => e.textContent!.startsWith('Manche'))!;
    hud.update(snap(() => {}), view);
    expect(line().textContent).toBe('Manche 1');
    expect(line().classList.contains('pulse')).toBe(false);
    hud.update(snap((x) => { x.roundTotal = 11; x.roundKos = 4; }), view);
    expect(line().textContent).toBe('Manche 1 : 4/11 casseurs');
    expect(line().classList.contains('pulse')).toBe(false);
    hud.update(snap((x) => { x.round = 2; x.roundTotal = 3; }), view);
    expect(line().textContent).toBe('Manche 2 : 0/3 casseurs');
    expect(line().classList.contains('pulse')).toBe(true);
    expect(hud.root.textContent).toContain('Casseurs neutralisés : 0');
    hud.destroy();
  });

  test('one indicator per active incident, only when off-screen', () => {
    const hud = new Hud(document.body, null);
    const s = snap((x) => {
      x.school.stage = 'attack';
      x.rescue = { stage: 'threat', remaining: 20, victimPos: { x: 400, y: 300 }, kind: 'elderlyRobbed' };
      x.player.pos = { x: 400, y: 300 };
    });
    const edges = () => [...hud.root.querySelectorAll<HTMLElement>('.bb-edge')];
    const off = { ...view, x: 5000, y: 5000 };
    hud.update(s, off);
    expect(edges().map((e) => e.querySelector('.lbl')!.textContent).sort()).toEqual(['VOL', 'ÉCOLE']);
    for (const e of edges()) expect(e.querySelector('.dist')!.textContent).toMatch(/^\d+ m$/);
    // both on screen: no indicator
    hud.update(s, { x: 0, y: 0, zoom: 1, width: 4000, height: 4000 });
    expect(edges()).toHaveLength(0);
    // rescue secured: never an indicator for it
    s.rescue!.stage = 'secured';
    hud.update(s, off);
    expect(edges().map((e) => e.querySelector('.lbl')!.textContent)).toEqual(['ÉCOLE']);
  });

  test('touch Agir button is hidden without an actionable prompt', () => {
    document.body.innerHTML = '<div id="touch-ui" class="visible"><button data-action="act">Agir</button></div>';
    const touch = document.getElementById('touch-ui')!;
    const btn = touch.querySelector<HTMLElement>('[data-action=act]')!;
    const hud = new Hud(document.body, touch);
    expect(btn.style.display).toBe('none');
    hud.update(snap((x) => { x.stationMessage = 'Santé au maximum'; }), view);
    expect(btn.style.display).toBe('none');
    hud.update(
      snap((x) => {
        x.rescue = { stage: 'secured', remaining: 10, victimPos: { ...x.player.pos }, kind: 'groupHarassed' };
      }),
      view,
    );
    expect(btn.style.display).toBe('none');
  });

  test('cinematic hint names Espace ou F', () => {
    const hud = new Hud(document.body, null);
    hud.update(snap((x) => { x.school.stage = 'cinematic'; }), view);
    expect(hud.root.querySelector('.bb-banner .hint')!.textContent).toBe('Espace ou F pour passer');
  });
});
