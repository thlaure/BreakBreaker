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
/** The fire is announced when the bottle is thrown (TargetIgnited), not when the attack starts. */
const fireEv = (kind: 'school' | 'car' | 'busStop', target: 'school' | 'car1' | 'busStop', pos: { x: number; y: number }, round = 3): SimEvent => ({
  type: 'TargetIgnited',
  target,
  incidentId: `${kind}#3`,
  kind,
  pos,
  round,
});
const schoolFire = fireEv('school', 'school', { ...DOOR }, 1);
const rescueEv = (kind: 'groupHarassed' | 'elderlyRobbed'): SimEvent => ({
  type: 'RescueStarted',
  incidentId: 'rescue#1',
  pos: { x: 900, y: 600 },
  kind,
  wave: 2,
  total: 3,
});
const waveEv: SimEvent = { type: 'RoundStarted', index: 3, total: 9, headline: 'car' };
const casseEv = (kind: 'car' | 'busStop', target: 'car1' | 'busStop', pos: { x: number; y: number }): SimEvent => ({
  type: 'CasseStarted',
  incidentId: `${kind}#3`,
  kind,
  target,
  pos,
  round: 3,
  total: 18,
});

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
    expect(incidentAlert('car')).toMatchObject({ title: 'VOITURE EN FEU !', sub: 'Chasse les casseurs', label: 'VOITURE', tone: 'fire', icon: 'flame' });
    expect(incidentAlert('busStop')).toMatchObject({ title: 'ABRIBUS SACCAGÉ !', sub: 'Arrête la casse', label: 'ABRIBUS', tone: 'warn', icon: 'glass' });
    expect(incidentAlert('weaponDrop')).toMatchObject({ title: 'ARME SPÉCIALE !', sub: 'Fonce la ramasser', positioned: true, meta: '' });
  });

  test('alertFromEvent maps fires, rescue starts and round starts (a round has no position); an attack start is not announced', () => {
    // no fire before a bottle was thrown: the attack starts are silent
    expect(alertFromEvent(schoolEv)).toBeNull();
    expect(alertFromEvent(casseEv('car', 'car1', { x: 50, y: 60 }))).toBeNull();
    expect(alertFromEvent(schoolFire)).toEqual({ id: 'school#3', kind: 'school', pos: DOOR, wave: 1, total: 0, incident: 'school' });
    expect(alertFromEvent(rescueEv('elderlyRobbed'))).toEqual({ id: 'rescue#1', kind: 'elderlyRobbed', pos: { x: 900, y: 600 }, wave: 2, total: 3, incident: 'rescue' });
    expect(alertFromEvent(waveEv)).toEqual({ id: 'round#3', kind: 'round', pos: null, wave: 3, total: 9, headline: 'car' });
    expect(alertFromEvent(fireEv('car', 'car1', { x: 50, y: 60 }))).toEqual({ id: 'car#3', kind: 'car', pos: { x: 50, y: 60 }, wave: 3, total: 0, incident: 'car1' });
    // a drop is tied to its weapon on the ground (same id as its activeIncidents entry)
    expect(alertFromEvent({ type: 'TwistStarted', kind: 'weaponDrop', pos: { x: 7, y: 8 } })).toMatchObject({ kind: 'weaponDrop', pos: { x: 7, y: 8 }, incident: 'drop@7,8' });
    // no banner for a drop that found no spot, nor for a second urgency (its own fire announces it)
    expect(alertFromEvent({ type: 'TwistStarted', kind: 'weaponDrop', pos: null })).toBeNull();
    expect(alertFromEvent({ type: 'TwistStarted', kind: 'secondUrgency', pos: { x: 1, y: 1 } })).toBeNull();
    expect(alertFromEvent({ type: 'HealCompleted' })).toBeNull();
  });

  test('incidentAlert: round banner title/non-committal headline sub; incidents get a « Manche N[ · T casseurs] » line', () => {
    expect(incidentAlert('round', 3, 9, 'car')).toMatchObject({ title: 'MANCHE 3 !', sub: 'Voiture menacée · 9 casseurs', label: 'MANCHE', meta: '', tone: 'round', icon: 'horde', positioned: false });
    expect(incidentAlert('round', 1, 10, 'school').sub).toBe('École menacée · 10 casseurs');
    expect(incidentAlert('round', 2, 14, 'busStop').sub).toBe('Abribus menacé · 14 casseurs');
    expect(incidentAlert('round', 4, 1, 'rescue').sub).toBe('Agression en cours · 1 casseur');
    expect(incidentAlert('school', 1, 11)).toMatchObject({ title: 'ÉCOLE EN FEU !', meta: 'Manche 1 · 11 casseurs', positioned: true });
    expect(incidentAlert('elderlyRobbed', 2, 3).meta).toBe('Manche 2 · 3 casseurs');
    expect(incidentAlert('school').meta).toBe('');
    // a fire knows its round, not the round's roster
    expect(incidentAlert('car', 4)).toMatchObject({ title: 'VOITURE EN FEU !', meta: 'Manche 4' });
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

  test('activeIncidents: every attacked target (at its door), rescue only in threat', () => {
    const s = new Sim(1).snapshot();
    for (const t of s.targets) t.state = 'intact';
    expect(activeIncidents(s)).toEqual([]);
    const car = s.targets.find((t) => t.kind === 'car')!;
    s.targets.find((t) => t.id === 'school')!.state = 'attacked';
    car.state = 'attacked';
    s.rescue = { stage: 'threat', remaining: 9, victimPos: { x: 5, y: 6 }, kind: 'groupHarassed' };
    expect(activeIncidents(s).map((i) => i.kind)).toEqual(['school', 'car', 'groupHarassed']);
    expect(activeIncidents(s).find((i) => i.kind === 'car')).toEqual({ id: car.id, kind: 'car', pos: car.door, burning: false });
    for (const t of s.targets) t.state = t.id === 'school' ? 'intact' : 'ruined';
    s.rescue.stage = 'secured';
    expect(activeIncidents(s)).toEqual([]);
  });

  test('activeIncidents: a special drop on the ground (with an expiry) is one too, an ordinary weapon is not', () => {
    const s = new Sim(1).snapshot();
    for (const t of s.targets) t.state = 'intact';
    s.weaponsOnGround = [
      { id: 1, kind: 'baton', pos: { x: 10, y: 20 }, expiresAt: null },
      { id: 2, kind: 'marteau', pos: { x: 30, y: 40 }, expiresAt: 99 },
    ];
    expect(activeIncidents(s)).toEqual([{ id: 'drop@30,40', kind: 'weaponDrop', pos: { x: 30, y: 40 } }]);
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
    for (const n of ['flame', 'alert', 'horde', 'glass', 'star', 'arrow', 'arrowDiag'] as const) {
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
    b.push(alertFromEvent(schoolFire)!);
    expect(b.el.hidden).toBe(false);
    expect(b.el.getAttribute('role')).toBe('alert');
    expect(b.el.className).toContain('tone-fire');
    expect(b.el.querySelector('.title')!.textContent).toBe('ÉCOLE EN FEU !');
    expect(b.el.querySelector('.sub')!.textContent).toBe('Rejoins l’école');
    expect(b.el.querySelector<HTMLElement>('.meta')!.textContent).toBe('Manche 1');
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
    b.push(alertFromEvent(schoolFire)!);
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

  test('RoundStarted shows « MANCHE N ! » with its headline and casseurs count, no arrow or distance', () => {
    const b = new AlertBanner(document.body);
    b.push(alertFromEvent(rescueEv('groupHarassed'))!);
    b.push(alertFromEvent(waveEv)!);
    vi.advanceTimersByTime(ALERT_MS);
    expect(b.el.hidden).toBe(false);
    expect(b.el.getAttribute('role')).toBe('alert');
    expect(b.el.className).toContain('tone-round');
    expect(b.el.querySelector('.title')!.textContent).toBe('MANCHE 3 !');
    expect(b.el.querySelector('.sub')!.textContent).toBe('Voiture menacée · 9 casseurs');
    expect(b.el.querySelector<HTMLElement>('.meta')!.hidden).toBe(true);
    expect(b.el.querySelector<HTMLElement>('.dir')!.hidden).toBe(true);
    expect(b.el.querySelector('.ico svg')).toBeTruthy();
    b.track({ x: 0, y: 0 }); // no position: nothing to track, no crash
    expect(b.el.querySelector('.dist')!.textContent).toBe('');
    vi.advanceTimersByTime(ALERT_MS);
    expect(b.el.hidden).toBe(true);
  });

  test('TargetIgnited car → « VOITURE EN FEU ! » positioned at the car; busStop → « ABRIBUS SACCAGÉ ! »', () => {
    const b = new AlertBanner(document.body);
    const at = { x: 1000, y: 400 };
    b.push(alertFromEvent(fireEv('car', 'car1', at))!);
    expect(b.el.className).toContain('tone-fire');
    expect(b.el.querySelector('.title')!.textContent).toBe('VOITURE EN FEU !');
    expect(b.el.querySelector('.sub')!.textContent).toBe('Chasse les casseurs');
    expect(b.el.querySelector('.meta')!.textContent).toBe('Manche 3');
    expect(b.el.querySelector<HTMLElement>('.dir')!.hidden).toBe(false);
    b.track({ x: at.x - 32 * 5, y: at.y });
    expect(b.el.querySelector('.dist')!.textContent).toBe('5 m');
    vi.advanceTimersByTime(ALERT_MS);
    b.push(alertFromEvent(fireEv('busStop', 'busStop', at))!);
    expect(b.el.className).toContain('tone-warn');
    expect(b.el.querySelector('.title')!.textContent).toBe('ABRIBUS SACCAGÉ !');
    expect(b.el.querySelector('.sub')!.textContent).toBe('Arrête la casse');
  });

  test('a special weapon drop is announced at the drop, with arrow and distance', () => {
    const b = new AlertBanner(document.body);
    b.push(alertFromEvent({ type: 'TwistStarted', kind: 'weaponDrop', pos: { x: 320, y: 0 } })!);
    expect(b.el.querySelector('.title')!.textContent).toBe('ARME SPÉCIALE !');
    expect(b.el.querySelector('.sub')!.textContent).toBe('Fonce la ramasser');
    expect(b.el.querySelector<HTMLElement>('.dir')!.hidden).toBe(false);
    b.track({ x: 0, y: 0 });
    expect(b.el.querySelector('.dist')!.textContent).toBe('10 m');
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

  test('onEvents: no banner when the school attack starts, « ÉCOLE EN FEU ! » once the bottle is thrown', () => {
    const hud = new Hud(document.body, null);
    hud.onEvents([schoolEv]);
    const a = hud.root.querySelector<HTMLElement>('.bb-alert')!;
    expect(a.hidden).toBe(true);
    hud.onEvents([schoolFire]);
    expect(a.hidden).toBe(false);
    expect(a.textContent).toContain('ÉCOLE EN FEU !');
    expect(a.textContent).toContain('Manche 1');
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

  const calm = (x: Snapshot): void => {
    for (const t of x.targets) t.state = 'intact';
    x.school.stage = 'idle';
  };
  const attack = (x: Snapshot, id: string, hp?: number): void => {
    const t = x.targets.find((t) => t.id === id)!;
    t.state = 'attacked';
    if (hp !== undefined) t.hp = hp;
  };

  test('one indicator per active incident, only when off-screen', () => {
    const hud = new Hud(document.body, null);
    const s = snap((x) => {
      calm(x);
      attack(x, 'school');
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

  test('an attacked target’s indicator warns (alert icon) until it burns, then turns to fire (flame)', () => {
    const hud = new Hud(document.body, null);
    const off = { ...view, x: 5000, y: 5000 };
    const edge = () => hud.root.querySelector<HTMLElement>('.bb-edge')!;
    const html = (name: 'alert' | 'flame'): string => {
      const d = document.createElement('span');
      d.innerHTML = pixelSvg(name, 2);
      return d.innerHTML;
    };
    hud.update(snap((x) => { calm(x); attack(x, 'school'); x.targets.find((t) => t.id === 'school')!.burning = false; }), off);
    expect(edge().classList.contains('tone-warn')).toBe(true);
    expect(edge().querySelector('.ico')!.innerHTML).toBe(html('alert'));
    const card = () => hud.root.querySelector<HTMLElement>('.bb-card')!;
    expect(card().querySelector('.status')!.textContent).toBe('attaquée');
    hud.update(snap((x) => { calm(x); attack(x, 'school'); x.targets.find((t) => t.id === 'school')!.burning = true; }), off);
    expect(edge().classList.contains('tone-fire')).toBe(true);
    expect(edge().querySelector('.ico')!.innerHTML).toBe(html('flame'));
    expect(card().querySelector('.status')!.textContent).toBe('en feu');
    hud.destroy();
  });

  test('two attacked targets: second banner waits, both edge indicators show', () => {
    const hud = new Hud(document.body, null);
    const s = snap((x) => {
      calm(x);
      attack(x, 'car1');
      attack(x, 'busStop');
    });
    const car = s.targets.find((t) => t.id === 'car1')!;
    const bus = s.targets.find((t) => t.id === 'busStop')!;
    hud.onEvents([fireEv('car', 'car1', car.door), fireEv('busStop', 'busStop', bus.door)]);
    const a = hud.root.querySelector<HTMLElement>('.bb-alert')!;
    expect(a.querySelector('.title')!.textContent).toBe('VOITURE EN FEU !');
    hud.update(s, { ...view, x: 9000, y: 9000 });
    const labels = [...hud.root.querySelectorAll('.bb-edge .lbl')].map((e) => e.textContent).sort();
    expect(labels).toEqual(['ABRIBUS', 'VOITURE']);
    vi.advanceTimersByTime(ALERT_MS);
    expect(a.hidden).toBe(false);
    expect(a.querySelector('.title')!.textContent).toBe('ABRIBUS SACCAGÉ !');
    hud.destroy();
  });

  test('HUD reads « Manche N : K/T casseurs »; incident card shows the target hp %', () => {
    const hud = new Hud(document.body, null);
    hud.update(
      snap((x) => {
        calm(x);
        x.roundTotal = 10;
        x.roundKos = 3;
        attack(x, 'school', 63.2);
        attack(x, 'car1', 30);
      }),
      view,
    );
    expect(hud.root.textContent).toContain('Manche 1 : 3/10 casseurs');
    const cards = [...hud.root.querySelectorAll<HTMLElement>('.bb-card')].filter((c) => !c.hidden);
    expect(cards.map((c) => `${c.querySelector('.name')!.textContent} ${c.querySelector('.time')!.textContent}`)).toEqual(['École 64 %', 'Voiture 50 %']);
    expect(cards[0]!.querySelector<HTMLElement>('.hpbar .fill')!.style.width).toBe('63%');
    expect(cards[1]!.querySelector('.ico svg')).toBeTruthy();
    // the car is saved: its card goes away
    hud.update(snap((x) => { calm(x); attack(x, 'school', 70); }), view);
    expect([...hud.root.querySelectorAll<HTMLElement>('.bb-card')].filter((c) => !c.hidden)).toHaveLength(1);
    hud.destroy();
  });

  test('round panel lists objectives réussi/perdu, points, bonus only when earned, countdown; hidden outside the breather', () => {
    const hud = new Hud(document.body, null);
    const panel = () => hud.root.querySelector<HTMLElement>('.bb-round')!;
    const breather = (bonus: boolean, left: number) =>
      snap((x) => {
        calm(x);
        x.round = 2;
        x.roundPhase = 'breather';
        x.breatherLeft = left;
        x.lastSummary = {
          index: 2,
          kos: 14,
          objectives: bonus ? [{ kind: 'car', result: 'réussi' }, { kind: 'rescue', result: 'réussi' }] : [{ kind: 'car', result: 'perdu' }, { kind: 'rescue', result: 'réussi' }],
          points: bonus ? 23 : 12,
          bonus,
        };
      });
    hud.update(snap(calm), view);
    expect(panel().hidden).toBe(true);
    hud.update(breather(false, 3.2), view);
    const p = panel();
    expect(p.hidden).toBe(false);
    expect(p.getAttribute('role')).toBe('status');
    expect(p.querySelector('.title')!.textContent).toBe('Manche 2 terminée');
    expect(p.textContent).toContain('Casseurs neutralisés : 14');
    expect([...p.querySelectorAll('.obj li')].map((li) => li.textContent)).toEqual(['Voiture : perdu', 'Secours : réussi']);
    expect(p.textContent).toContain('+12 points');
    expect(p.textContent).not.toContain('Bonus');
    expect(p.textContent).toContain('Soins rechargés');
    expect(p.querySelector('.count')!.textContent).toBe('Manche 3 dans 4…');
    hud.update(breather(true, 0.4), view);
    expect(p.textContent).toContain('Bonus +5');
    expect(p.textContent).toContain('+23 points');
    expect(p.querySelector('.count')!.textContent).toBe('Manche 3 dans 1…');
    hud.update(snap((x) => { calm(x); x.round = 3; x.roundPhase = 'play'; }), view);
    expect(p.hidden).toBe(true);
    hud.destroy();
  });

  test('an incident banner is dropped once its incident is over, queued or on screen; a round banner stays, a drop banner lasts while its weapon is on the ground', () => {
    const hud = new Hud(document.body, null);
    const a = hud.root.querySelector<HTMLElement>('.bb-alert')!;
    const title = () => (a.hidden ? null : a.querySelector('.title')!.textContent);
    const threat = (x: Snapshot): void => {
      calm(x);
      attack(x, 'car1');
      x.rescue = { stage: 'threat', remaining: 20, victimPos: { x: 400, y: 300 }, kind: 'elderlyRobbed' };
    };
    // car + rescue start in the same frame: the rescue banner queues behind the car's
    hud.onEvents([fireEv('car', 'car1', { x: 10, y: 10 }), rescueEv('elderlyRobbed')]);
    hud.update(snap(threat), view);
    expect(title()).toBe('VOITURE EN FEU !');
    // fast KOs: the rescue resolves while still queued → never shown (no « VOL EN COURS ! » during the breather)
    hud.update(snap((x) => { threat(x); x.rescue!.stage = 'completed'; }), view);
    expect(title()).toBe('VOITURE EN FEU !');
    // the car is saved too: its visible banner goes away at once, nothing left to show
    hud.update(snap((x) => { calm(x); x.roundPhase = 'breather'; }), view);
    expect(title()).toBeNull();
    vi.advanceTimersByTime(ALERT_MS * 2);
    expect(title()).toBeNull();
    // a banner whose start is not in the snapshot yet survives one update
    hud.onEvents([fireEv('busStop', 'busStop', { x: 10, y: 10 })]);
    hud.update(snap(calm), view);
    expect(title()).toBe('ABRIBUS SACCAGÉ !');
    hud.update(snap(calm), view);
    expect(title()).toBeNull();
    // a round banner is not tied to an incident; a drop banner lasts while its weapon is on the ground
    const dropped = (x: Snapshot): void => {
      calm(x);
      x.weaponsOnGround = [{ id: 7, kind: 'marteau', pos: { x: 5, y: 5 }, expiresAt: 30 }];
    };
    hud.onEvents([waveEv, { type: 'TwistStarted', kind: 'weaponDrop', pos: { x: 5, y: 5 } }]);
    hud.update(snap(dropped), view);
    hud.update(snap(dropped), view);
    expect(title()).toBe('MANCHE 3 !');
    vi.advanceTimersByTime(ALERT_MS);
    hud.update(snap(dropped), view);
    expect(title()).toBe('ARME SPÉCIALE !');
    // picked up or expired: the banner goes at once
    hud.update(snap(calm), view);
    expect(title()).toBeNull();
    hud.destroy();
  });

  test('a special drop gets an « ARME » edge indicator while it lies on the ground', () => {
    const hud = new Hud(document.body, null);
    const edges = () => [...hud.root.querySelectorAll<HTMLElement>('.bb-edge')];
    const off = { ...view, x: 5000, y: 5000 };
    hud.update(snap((x) => { calm(x); x.weaponsOnGround = [{ id: 3, kind: 'baton', pos: { x: 100, y: 100 }, expiresAt: 40 }]; }), off);
    expect(edges()).toHaveLength(1);
    expect(edges()[0]!.querySelector('.lbl')!.textContent).toBe('ARME');
    expect(edges()[0]!.classList.contains('tone-drop')).toBe(true);
    // an ordinary weapon has none; a picked-up drop loses its indicator
    hud.update(snap((x) => { calm(x); x.weaponsOnGround = [{ id: 4, kind: 'baton', pos: { x: 100, y: 100 }, expiresAt: null }]; }), off);
    expect(edges()).toHaveLength(0);
    hud.destroy();
  });

  test('the rescue card has no health bar', () => {
    const hud = new Hud(document.body, null);
    hud.update(snap((x) => { calm(x); x.rescue = { stage: 'threat', remaining: 20, victimPos: { x: 1, y: 1 }, kind: 'groupHarassed' }; }), view);
    const card = [...hud.root.querySelectorAll<HTMLElement>('.bb-card')].find((c) => !c.hidden)!;
    expect(card.querySelector<HTMLElement>('.hpbar')!.hidden).toBe(true);
    hud.destroy();
  });

  test('toolbox prompts are informational (no Agir button); the toolbox slot reads Caisse 0/1 or 1/1', () => {
    document.body.innerHTML = '<div id="touch-ui" class="visible"><button data-action="act">Agir</button></div>';
    const touch = document.getElementById('touch-ui')!;
    const btn = touch.querySelector<HTMLElement>('[data-action=act]')!;
    const hud = new Hud(document.body, touch);
    const prompt = () => hud.root.querySelector<HTMLElement>('.bb-prompt')!;
    hud.update(snap((x) => { x.toolboxes.message = 'Caisse à outils requise'; }), view);
    expect(prompt().hidden).toBe(false);
    expect(prompt().textContent).toBe('Caisse à outils requise');
    expect(btn.style.display).toBe('none');
    expect(hud.root.textContent).toContain('Caisse 0/1');
    hud.update(snap((x) => { x.toolboxes.carried = true; x.toolboxes.message = 'Abords non sécurisés'; }), view);
    expect(prompt().textContent).toBe('Abords non sécurisés');
    expect(hud.root.textContent).toContain('Caisse 1/1');
    hud.update(snap((x) => { x.toolboxes.carried = true; x.toolboxes.progress = 0.5; x.toolboxes.repairTarget = 'car1'; }), view);
    expect(prompt().textContent).toBe('Réparation…');
    expect(btn.style.display).toBe('none');
    hud.destroy();
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
