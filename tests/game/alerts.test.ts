// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  ALERT_MS,
  AlertBanner,
  DROPS,
  FURIE_ALERT_MS,
  incidentLook,
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
const fireEv = (kind: 'school' | 'car' | 'busStop' | 'shop', target: 'school' | 'car1' | 'busStop' | 'shop', pos: { x: number; y: number }, round = 3): SimEvent => ({
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
    expect(incidentAlert('bouclierDrop')).toMatchObject({ title: 'BOUCLIER DISPONIBLE !', sub: 'Fonce le ramasser', label: 'BOUCLIER', positioned: true, meta: '' });
  });

  test('the retro video-game shop: « BOUTIQUE EN FEU ! » on its fire only, « Boutique menacée » round line, warn then fire indicator', () => {
    expect(incidentAlert('shop', 2)).toMatchObject({ title: 'BOUTIQUE EN FEU !', sub: 'Défends la boutique', label: 'BOUTIQUE', tone: 'fire', icon: 'flame', meta: 'Manche 2', positioned: true });
    expect(incidentAlert('round', 2, 14, 'shop').sub).toBe('Boutique menacée · 14 casseurs');
    const door = DISTRICT.targets.find((t) => t.id === 'shop')!.door;
    // the attack start is silent; the bottle's ignition is announced at the shop door
    expect(alertFromEvent({ type: 'CasseStarted', incidentId: 'shop#1', kind: 'shop', target: 'shop', pos: { ...door }, round: 2, total: 14 })).toBeNull();
    expect(alertFromEvent(fireEv('shop', 'shop', { ...door }, 2))).toEqual({ id: 'shop#3', kind: 'shop', pos: door, wave: 2, total: 0, incident: 'shop' });
    expect(incidentLook('shop', false)).toEqual({ tone: 'warn', icon: 'alert' });
    expect(incidentLook('shop', true)).toEqual({ tone: 'fire', icon: 'flame' });
    const s = new Sim(1).snapshot();
    const shop = s.targets.find((t) => t.id === 'shop')!;
    expect(activeIncidents(s).some((i) => i.id === 'shop')).toBe(false);
    Object.assign(shop, { state: 'burning', burning: true });
    expect(activeIncidents(s)).toContainEqual({ id: 'shop', kind: 'shop', pos: door, burning: true });
  });

  test('the Phase C places: banner on their fire, round line, edge indicator at the door', () => {
    const cases = [
      ['nursery', 5, { title: 'ÉCOLE MATERNELLE EN DANGER !', sub: 'Protège les petits', label: 'MATERNELLE', tone: 'fire', icon: 'flame' }, 'École maternelle menacée'],
      ['kiosk', 5, { title: 'KIOSQUE SACCAGÉ !', sub: 'Protège le kiosque', label: 'KIOSQUE', tone: 'warn', icon: 'glass' }, 'Kiosque menacé'],
      ['townHall', 7, { title: 'MAIRIE ATTAQUÉE !', sub: 'Défends la mairie', label: 'MAIRIE', tone: 'fire', icon: 'flame' }, 'Mairie menacée'],
      ['library', 9, { title: 'BIBLIOTHÈQUE EN FEU !', sub: 'Sauve les livres', label: 'BIBLIOTHÈQUE', tone: 'fire', icon: 'flame' }, 'Bibliothèque menacée'],
    ] as const;
    expect(incidentAlert('booth', 3)).toMatchObject({ title: 'CABINE SACCAGÉE !', sub: 'Protège la cabine', label: 'CABINE', tone: 'warn', icon: 'glass', meta: 'Manche 3' });
    expect(incidentAlert('round', 3, 18, 'booth').sub).toBe('Cabine menacée · 18 casseurs');
    for (const [id, round, spec, headline] of cases) {
      expect(incidentAlert(id, round)).toMatchObject({ ...spec, meta: `Manche ${round}`, positioned: true });
      expect(incidentAlert('round', round, 26, id).sub).toBe(`${headline} · 26 casseurs`);
      const door = DISTRICT.targets.find((t) => t.id === id)!.door;
      expect(alertFromEvent({ type: 'CasseStarted', incidentId: `${id}#1`, kind: id, target: id, pos: { ...door }, round, total: 26 })).toBeNull();
      expect(alertFromEvent({ type: 'TargetIgnited', target: id, incidentId: `${id}#3`, kind: id, pos: { ...door }, round })).toEqual({
        id: `${id}#3`, kind: id, pos: door, wave: round, total: 0, incident: id,
      });
      const s = new Sim(1).snapshot();
      Object.assign(s.targets.find((t) => t.id === id)!, { state: 'burning', burning: true });
      expect(activeIncidents(s)).toContainEqual({ id, kind: id, pos: door, burning: true });
    }
  });

  test('alertFromEvent maps fires, rescue starts and round starts (a round has no position); an attack start is not announced', () => {
    // no fire before a bottle was thrown: the attack starts are silent
    expect(alertFromEvent(schoolEv)).toBeNull();
    expect(alertFromEvent(casseEv('car', 'car1', { x: 50, y: 60 }))).toBeNull();
    expect(alertFromEvent(schoolFire)).toEqual({ id: 'school#3', kind: 'school', pos: DOOR, wave: 1, total: 0, incident: 'school' });
    expect(alertFromEvent(rescueEv('elderlyRobbed'))).toEqual({ id: 'rescue#1', kind: 'elderlyRobbed', pos: { x: 900, y: 600 }, wave: 2, total: 3, incident: 'rescue' });
    expect(alertFromEvent(waveEv)).toEqual({ id: 'round#3', kind: 'round', pos: null, wave: 3, total: 9, headline: 'car' });
    expect(alertFromEvent(fireEv('car', 'car1', { x: 50, y: 60 }))).toEqual({ id: 'car#3', kind: 'car', pos: { x: 50, y: 60 }, wave: 3, total: 0, incident: 'car1' });
    // a special drop is tied to its pickup on the ground (same id as its activeIncidents entry)
    expect(alertFromEvent({ type: 'TwistStarted', kind: 'weaponDrop', pos: { x: 7, y: 8 }, special: 'bouclier' })).toMatchObject({ kind: 'bouclierDrop', pos: { x: 7, y: 8 }, incident: 'drop@7,8' });
    // a regular weapon drop has no banner
    expect(alertFromEvent({ type: 'TwistStarted', kind: 'weaponDrop', pos: { x: 7, y: 8 } })).toBeNull();
    // no banner for a drop that found no spot, nor for a second urgency (its own fire announces it)
    expect(alertFromEvent({ type: 'TwistStarted', kind: 'weaponDrop', pos: null })).toBeNull();
    expect(alertFromEvent({ type: 'TwistStarted', kind: 'secondUrgency', pos: { x: 1, y: 1 } })).toBeNull();
    expect(alertFromEvent({ type: 'HealCompleted' })).toBeNull();
  });

  test('a rescue round start names its kind: « Vol en cours » for a theft, « Agression en cours » for a harassed group', () => {
    const vol = alertFromEvent({ type: 'RoundStarted', index: 2, total: 14, headline: 'rescue', rescueKind: 'elderlyRobbed' })!;
    expect(vol.headline).toBe('elderlyRobbed');
    expect(incidentAlert(vol.kind, vol.wave, vol.total, vol.headline).sub).toBe('Vol en cours · 14 casseurs');
    const agr = alertFromEvent({ type: 'RoundStarted', index: 2, total: 14, headline: 'rescue', rescueKind: 'groupHarassed' })!;
    expect(incidentAlert(agr.kind, agr.wave, agr.total, agr.headline).sub).toBe('Agression en cours · 14 casseurs');
  });

  test('incidentAlert: round banner title/non-committal headline sub; incidents get a « Manche N[ · T casseurs] » line', () => {
    expect(incidentAlert('round', 3, 9, 'car')).toMatchObject({ title: 'MANCHE 3 !', sub: 'Voiture menacée · 9 casseurs', label: 'MANCHE', meta: '', tone: 'round', icon: 'horde', positioned: false });
    expect(incidentAlert('round', 1, 10, 'school').sub).toBe('École menacée · 10 casseurs');
    expect(incidentAlert('round', 2, 14, 'busStop').sub).toBe('Abribus menacé · 14 casseurs');
    expect(incidentAlert('round', 4, 1, 'rescue').sub).toBe('Agression en cours · 1 casseur');
    expect(incidentAlert('round', 4, 10, 'groupHarassed').sub).toBe('Agression en cours · 10 casseurs');
    expect(incidentAlert('round', 4, 10, 'elderlyRobbed').sub).toBe('Vol en cours · 10 casseurs');
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
    s.rescue = { id: 'rescue#1', stage: 'threat', remaining: 9, victimPos: { x: 5, y: 6 }, kind: 'groupHarassed', items: [], returnLeft: null };
    expect(activeIncidents(s).map((i) => i.kind)).toEqual(['school', 'car', 'groupHarassed']);
    expect(activeIncidents(s).find((i) => i.kind === 'car')).toEqual({ id: car.id, kind: 'car', pos: car.door, burning: false });
    for (const t of s.targets) t.state = t.id === 'school' ? 'intact' : 'ruined';
    s.rescue.stage = 'secured';
    expect(activeIncidents(s)).toEqual([]);
  });

  test('activeIncidents: every bouclier on the ground is one (kind-based, expiry or not); a regular weapon never', () => {
    const s = new Sim(1).snapshot();
    for (const t of s.targets) t.state = 'intact';
    s.weaponsOnGround = [
      { id: 1, kind: 'baton', pos: { x: 10, y: 20 }, expiresAt: null },
      { id: 2, kind: 'marteau', pos: { x: 30, y: 40 }, expiresAt: 99 },
      { id: 3, kind: 'bouclier', pos: { x: 50, y: 60 }, expiresAt: null },
      { id: 4, kind: 'bouclier', pos: { x: 70, y: 80 }, expiresAt: 99 },
    ];
    expect(activeIncidents(s)).toEqual([
      { id: 'drop@50,60', kind: 'bouclierDrop', pos: { x: 50, y: 60 } },
      { id: 'drop@70,80', kind: 'bouclierDrop', pos: { x: 70, y: 80 } },
    ]);
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
    for (const n of ['flame', 'alert', 'horde', 'glass', 'bolt', 'arrow', 'arrowDiag'] as const) {
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

  test('a bouclier drop is announced at the drop, with arrow and distance', () => {
    const b = new AlertBanner(document.body);
    b.push(alertFromEvent({ type: 'TwistStarted', kind: 'weaponDrop', pos: { x: 320, y: 0 }, special: 'bouclier' })!);
    expect(b.el.querySelector('.title')!.textContent).toBe('BOUCLIER DISPONIBLE !');
    expect(b.el.querySelector('.sub')!.textContent).toBe('Fonce le ramasser');
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

  test('health: no visible health row in the HUD, a visually hidden progressbar « Santé N sur M » follows hp', () => {
    const hud = new Hud(document.body, null);
    hud.update(snap((x) => { x.hp = 85; }), view);
    const bar = hud.root.querySelector<HTMLElement>('[role=progressbar]')!;
    expect(bar.classList.contains('bb-sr')).toBe(true);
    expect(bar.getAttribute('aria-label')).toBe('Santé 85 sur 100');
    expect(bar.getAttribute('aria-valuenow')).toBe('85');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    hud.update(snap((x) => { x.hp = 40.5; }), view);
    expect(bar.getAttribute('aria-label')).toBe('Santé 41 sur 100');
    expect(hud.root.querySelector('.bb-hp')).toBeNull();
    hud.destroy();
  });

  test('HUD round row shows K/T and pulses when the round number changes', () => {
    const hud = new Hud(document.body, null);
    const row = () => hud.root.querySelector<HTMLElement>('.bb-stats .wave')!;
    const val = () => row().querySelector('.val')!.textContent;
    hud.update(snap(() => {}), view);
    expect(val()).toBe('1');
    expect(row().getAttribute('aria-label')).toBe('Manche 1');
    expect(row().classList.contains('pulse')).toBe(false);
    hud.update(snap((x) => { x.roundTotal = 11; x.roundKos = 4; }), view);
    expect(val()).toBe('1 · 4/11');
    expect(row().getAttribute('aria-label')).toBe('Manche 1 : 4/11 casseurs');
    expect(row().classList.contains('pulse')).toBe(false);
    hud.update(snap((x) => { x.round = 2; x.roundTotal = 3; }), view);
    expect(val()).toBe('2 · 0/3');
    expect(row().classList.contains('pulse')).toBe(true);
    hud.destroy();
  });

  test('score list: one row per stat, in order, pixel labels and values; objects only while carrying', () => {
    const hud = new Hud(document.body, null);
    const rows = (): string[][] =>
      [...hud.root.querySelectorAll<HTMLElement>('.bb-stats > li')]
        .filter((li) => !li.hidden)
        .map((li) => [li.querySelector('.lbl')!.textContent!, li.querySelector('.val')!.textContent!]);
    hud.update(snap((x) => { x.score = 1250; x.kos = 34; x.round = 3; x.roundTotal = 18; x.roundKos = 12; x.carried = 1; x.weapon = { kind: 'baton', uses: 12 }; }), view);
    expect(rows()).toEqual([
      ['SCORE', '1250'],
      ['NEUTRALISÉS', '34'],
      ['MANCHE', '3 · 12/18'],
      ['PIERRES', '●○○'],
      ['ARME', 'Bâton (12)'],
      ['ÉNERGIE', ''],
    ]);
    const list = hud.root.querySelector('.bb-stats')!;
    expect(list.parentElement!.classList.contains('bb-top')).toBe(true);
    // the cards stay below the list
    expect(list.nextElementSibling!.classList.contains('bb-cards')).toBe(true);
    expect(hud.root.querySelector('.bb-stats .kos')!.getAttribute('aria-label')).toBe('Casseurs neutralisés : 34');
    expect(hud.root.textContent).not.toMatch(/OQTF/i);
    hud.update(snap((x) => { x.carriedItems = 2; x.weapon = null; x.furie = { secondsLeft: 8.2 }; }), view);
    expect(rows().slice(4)).toEqual([
      ['ARME', 'Mains nues · Mode furie 9 s'],
      ['ÉNERGIE', 'EN FURIE'],
      ['OBJETS', '2'],
    ]);
    expect(hud.root.querySelector('.bb-stats .weapon')!.classList.contains('furie')).toBe(true);
    hud.destroy();
  });

  test('score value pops only when the score goes up', () => {
    const hud = new Hud(document.body, null);
    const val = () => hud.root.querySelector<HTMLElement>('.bb-stats .score .val')!;
    hud.update(snap((x) => { x.score = 10; }), view);
    expect(val().classList.contains('pop')).toBe(false);
    hud.update(snap((x) => { x.score = 10; }), view);
    expect(val().classList.contains('pop')).toBe(false);
    hud.update(snap((x) => { x.score = 12; }), view);
    expect(val().classList.contains('pop')).toBe(true);
    val().dispatchEvent(new Event('animationend'));
    expect(val().classList.contains('pop')).toBe(false);
    hud.update(snap((x) => { x.score = 11; }), view);
    expect(val().classList.contains('pop')).toBe(false);
    hud.update(snap((x) => { x.score = 11; }), view);
    expect(val().classList.contains('pop')).toBe(false);
    hud.update(snap((x) => { x.score = 15; }), view);
    expect(val().classList.contains('pop')).toBe(true);
    hud.destroy();
  });

  test('no toolbox slot in the HUD (« Caisse » never shown), carrying one or not', () => {
    const hud = new Hud(document.body, null);
    hud.update(snap(() => {}), view);
    expect(hud.root.textContent).not.toContain('Caisse');
    hud.update(snap((x) => { x.toolboxes.carried = true; }), view);
    expect(hud.root.textContent).not.toContain('Caisse');
    expect(hud.root.querySelector('.kit')).toBeNull();
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
      x.rescue = { id: 'rescue#1', stage: 'threat', remaining: 20, victimPos: { x: 400, y: 300 }, kind: 'elderlyRobbed', items: [], returnLeft: null };
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

  test('a target still burning after its attack (state burning) keeps its card « en feu » and a flame indicator, with no new banner', () => {
    const hud = new Hud(document.body, null);
    const off = { ...view, x: 5000, y: 5000 };
    const a = hud.root.querySelector<HTMLElement>('.bb-alert')!;
    const s = snap((x) => {
      calm(x);
      Object.assign(x.targets.find((t) => t.id === 'car1')!, { state: 'burning', burning: true, hp: 30 });
    });
    expect(activeIncidents(s)).toEqual([{ id: 'car1', kind: 'car', pos: s.targets.find((t) => t.id === 'car1')!.door, burning: true }]);
    hud.update(s, off);
    const edge = hud.root.querySelector<HTMLElement>('.bb-edge')!;
    expect(edge.classList.contains('tone-fire')).toBe(true);
    expect(edge.querySelector('.lbl')!.textContent).toBe('VOITURE');
    const card = hud.root.querySelector<HTMLElement>('.bb-card')!;
    expect(card.querySelector('.status')!.textContent).toBe('en feu');
    expect(card.querySelector('.time')!.textContent).toBe('50 %');
    expect(a.hidden).toBe(true);
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

  test('HUD round row reads « 1 · 3/10 » (« Manche N : K/T casseurs » for screen readers); incident card shows the target hp %', () => {
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
    expect(hud.root.querySelector('.bb-stats .wave .val')!.textContent).toBe('1 · 3/10');
    expect(hud.root.querySelector('.bb-stats .wave')!.getAttribute('aria-label')).toBe('Manche 1 : 3/10 casseurs');
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
      x.rescue = { id: 'rescue#1', stage: 'threat', remaining: 20, victimPos: { x: 400, y: 300 }, kind: 'elderlyRobbed', items: [], returnLeft: null };
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
      x.weaponsOnGround = [{ id: 7, kind: 'bouclier', pos: { x: 5, y: 5 }, expiresAt: 30 }];
    };
    hud.onEvents([waveEv, { type: 'TwistStarted', kind: 'weaponDrop', pos: { x: 5, y: 5 }, special: 'bouclier' }]);
    hud.update(snap(dropped), view);
    hud.update(snap(dropped), view);
    expect(title()).toBe('MANCHE 3 !');
    vi.advanceTimersByTime(ALERT_MS);
    hud.update(snap(dropped), view);
    expect(title()).toBe('BOUCLIER DISPONIBLE !');
    // picked up or expired: the banner goes at once
    hud.update(snap(calm), view);
    expect(title()).toBeNull();
    hud.destroy();
  });

  test('the bouclier gets a « BOUCLIER » edge indicator with its own icon; regular weapons none', () => {
    const hud = new Hud(document.body, null);
    const edges = () => [...hud.root.querySelectorAll<HTMLElement>('.bb-edge')].filter((e) => !e.hidden);
    const off = { ...view, x: 5000, y: 5000 };
    hud.update(snap((x) => { calm(x); x.weaponsOnGround = [{ id: 3, kind: 'bouclier', pos: { x: 100, y: 100 }, expiresAt: null }]; }), off);
    expect(edges()).toHaveLength(1);
    expect(edges()[0]!.querySelector('.lbl')!.textContent).toBe('BOUCLIER');
    expect(edges()[0]!.classList.contains('tone-drop')).toBe(true);
    // a regular weapon has none, twist drop (expiry) or not
    hud.update(snap((x) => { calm(x); x.weaponsOnGround = [{ id: 4, kind: 'baton', pos: { x: 100, y: 100 }, expiresAt: null }, { id: 6, kind: 'panneau', pos: { x: 90, y: 90 }, expiresAt: 40 }]; }), off);
    expect(edges()).toHaveLength(0);
    hud.destroy();
  });

  test('bouclier icon: a shield, at most 10×11 art px', () => {
    expect(incidentLook('bouclierDrop')).toEqual({ tone: 'drop', icon: 'shield' });
    for (const icon of ['shield'] as const) {
      const svg = pixelSvg(icon, 1);
      const [, w, h] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)!;
      expect(Number(w)).toBeLessThanOrEqual(10);
      expect(Number(h)).toBeLessThanOrEqual(11);
    }
  });

  test('the rescue card has no health bar', () => {
    const hud = new Hud(document.body, null);
    hud.update(snap((x) => { calm(x); x.rescue = { id: 'rescue#1', stage: 'threat', remaining: 20, victimPos: { x: 1, y: 1 }, kind: 'groupHarassed', items: [], returnLeft: null }; }), view);
    const card = [...hud.root.querySelectorAll<HTMLElement>('.bb-card')].find((c) => !c.hidden)!;
    expect(card.querySelector<HTMLElement>('.hpbar')!.hidden).toBe(true);
    hud.destroy();
  });

  test('toolbox prompts: messages are informational, « Réparer » shows the touch Agir button', () => {
    document.body.innerHTML = '<div id="touch-ui" class="visible"><button data-action="act">Agir</button></div>';
    const touch = document.getElementById('touch-ui')!;
    const btn = touch.querySelector<HTMLElement>('[data-action=act]')!;
    const hud = new Hud(document.body, touch);
    const prompt = () => hud.root.querySelector<HTMLElement>('.bb-prompt')!;
    hud.update(snap((x) => { x.toolboxes.message = 'Caisse à outils requise'; }), view);
    expect(prompt().hidden).toBe(false);
    expect(prompt().textContent).toBe('Caisse à outils requise');
    expect(btn.style.display).toBe('none');
    hud.update(snap((x) => { x.toolboxes.carried = true; x.toolboxes.message = 'Abords non sécurisés'; }), view);
    expect(prompt().textContent).toBe('Abords non sécurisés');
    hud.update(snap((x) => { x.toolboxes.carried = true; x.toolboxes.repairTarget = 'car1'; x.toolboxes.canRepair = true; x.toolboxes.repairKind = 'ruin'; x.actionHint = { kind: 'repair', target: 'car1', at: { x: 0, y: 0 }, toolbox: null }; }), view);
    // touch: no key in the text, the Agir button shows with the action's label
    expect(prompt().textContent).toBe('Réparer');
    expect(btn.style.display).toBe('');
    expect(btn.textContent).toBe('Réparer');
    hud.update(snap((x) => { x.toolboxes.carried = true; x.toolboxes.progress = 0.5; x.toolboxes.started = true; x.toolboxes.repairTarget = 'car1'; x.toolboxes.canRepair = true; x.toolboxes.repairKind = 'ruin'; }), view);
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
        x.rescue = { id: 'rescue#1', stage: 'secured', remaining: 10, victimPos: { ...x.player.pos }, kind: 'groupHarassed', items: [], returnLeft: null };
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

describe('mode furie alerts', () => {
  const view: CameraView = { x: 0, y: 0, zoom: 1, width: 800, height: 600 };
  const calm = (x: Snapshot): void => {
    for (const t of x.targets) t.state = 'intact';
    x.rescue = null;
  };
  const snap = (patch: (s: Snapshot) => void): Snapshot => {
    const s = new Sim(1).snapshot();
    patch(s);
    return s;
  };

  test('specs: the short position-less banner of the mode furie start; no furie or onde drop kind exists any more', () => {
    expect(incidentAlert('furie')).toMatchObject({ title: 'MODE FURIE !', positioned: false, tone: 'furie', ms: FURIE_ALERT_MS });
    expect(FURIE_ALERT_MS).toBeLessThan(ALERT_MS);
    expect(pixelSvg('bolt')).toContain('<svg');
    expect(Object.keys(DROPS)).toEqual(['bouclierDrop']);
  });

  test('event mapping: the mode furie start (from the gauge)', () => {
    expect(alertFromEvent({ type: 'FurieStarted', secondsLeft: 12 })).toEqual({ id: 'furie', kind: 'furie', pos: null, wave: 0, total: 0 });
    expect(alertFromEvent({ type: 'FurieEnded' })).toBeNull();
    expect(alertFromEvent({ type: 'EnergyReady', level: 'furie' })).toBeNull();
    expect(alertFromEvent({ type: 'EnergyRefused', need: 100 })).toBeNull();
  });

  test('Hud: the furie banner has no arrow and goes quickly; no edge indicator for it', () => {
    const hud = new Hud(document.body, null);
    hud.update(snap(calm), { ...view, x: 5000, y: 5000 });
    expect([...hud.root.querySelectorAll<HTMLElement>('.bb-edge')].filter((e) => !e.hidden)).toHaveLength(0);
    hud.onEvents([{ type: 'FurieStarted', secondsLeft: 12 }]);
    const a = hud.root.querySelector<HTMLElement>('.bb-alert')!;
    expect(a.hidden).toBe(false);
    expect(a.querySelector('.title')!.textContent).toBe('MODE FURIE !');
    expect(a.querySelector<HTMLElement>('.dir')!.hidden).toBe(true);
    // the pickup banner survives prunes (it is tied to no incident) and hides after FURIE_ALERT_MS
    hud.update(snap(calm), view);
    expect(a.hidden).toBe(false);
    vi.advanceTimersByTime(FURIE_ALERT_MS + 10);
    expect(a.hidden).toBe(true);
    hud.destroy();
  });

  test('Hud weapon row turns gold while the mode is on', () => {
    const hud = new Hud(document.body, null);
    const line = () => hud.root.querySelector<HTMLElement>('.bb-stats .weapon')!;
    hud.update(snap((x) => { calm(x); x.furie = { secondsLeft: 5 }; }), view);
    expect(line().querySelector('.val')!.textContent).toBe('Mains nues · Mode furie 5 s');
    expect(line().classList.contains('furie')).toBe(true);
    hud.update(snap(calm), view);
    expect(line().classList.contains('furie')).toBe(false);
    hud.destroy();
  });
});

test('firebombs and their fire patches raise no banner (only a fire on a target does)', () => {
  expect(alertFromEvent({ type: 'FirebombThrown', from: { x: 0, y: 0 }, to: { x: 9, y: 9 }, until: 2 })).toBeNull();
  expect(alertFromEvent({ type: 'FirePatchStarted', id: 1, pos: { x: 9, y: 9 } })).toBeNull();
});

describe('« Le Caïd » alerts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const view: CameraView = { x: 0, y: 0, zoom: 1, width: 800, height: 600 };
  const boss = (lifeId: number, pos: { x: number; y: number }, state: Snapshot['hostiles'][number]['state'] = 'approach'): Snapshot['hostiles'][number] => ({
    lifeId,
    pos,
    facing: { x: 0, y: 1 },
    state,
    variant: 'antifa',
    role: 'boss',
    hp: 6,
    maxHp: 6,
    windup: false,
    bottleUp: false,
    aiming: false,
  });
  const snap = (patch: (s: Snapshot) => void): Snapshot => {
    const s = new Sim(1).snapshot();
    for (const t of s.targets) t.state = 'intact';
    s.rescue = null;
    patch(s);
    return s;
  };

  test('CaidArrived → a short, position-less « LE CAÏD ARRIVE ! / Mets-le KO » banner tied to his life', () => {
    const a = alertFromEvent({ type: 'CaidArrived', lifeId: 42, pos: { x: 10, y: 20 }, round: 3 });
    expect(a).toEqual({ id: 'caid#42', kind: 'caid', pos: null, wave: 3, total: 0, incident: 'caid#42' });
    expect(incidentAlert('caid')).toMatchObject({ title: 'LE CAÏD ARRIVE !', sub: 'Mets-le KO', label: 'CAÏD', icon: 'crown', positioned: false, meta: '' });
    expect(incidentAlert('caid').ms).toBeLessThan(ALERT_MS);
    expect(pixelSvg('crown')).toContain('<svg');
  });

  test('activeIncidents: an indicator « CAÏD » while he stands, none once KO; other roles never', () => {
    const s = snap((x) => {
      x.hostiles = [boss(42, { x: 100, y: 200 }), boss(7, { x: 5, y: 5 }, 'ko'), { ...boss(8, { x: 9, y: 9 }), role: 'brute' }];
    });
    expect(activeIncidents(s).filter((i) => i.kind === 'caid')).toEqual([{ id: 'caid#42', kind: 'caid', pos: { x: 100, y: 200 } }]);
  });

  test('Hud: the banner shows without arrow; it is pruned when he is KO; his edge indicator says « CAÏD »', () => {
    const hud = new Hud(document.body, null);
    const off = { ...view, x: 5000, y: 5000 };
    hud.update(snap((x) => (x.hostiles = [boss(42, { x: 100, y: 100 })])), off);
    const edges = [...hud.root.querySelectorAll<HTMLElement>('.bb-edge')];
    expect(edges).toHaveLength(1);
    expect(edges[0]!.querySelector('.lbl')!.textContent).toBe('CAÏD');
    hud.onEvents([{ type: 'CaidArrived', lifeId: 42, pos: { x: 100, y: 100 }, round: 3 }]);
    const a = hud.root.querySelector<HTMLElement>('.bb-alert')!;
    expect(a.hidden).toBe(false);
    expect(a.querySelector('.title')!.textContent).toBe('LE CAÏD ARRIVE !');
    expect(a.querySelector<HTMLElement>('.dir')!.hidden).toBe(true);
    hud.update(snap((x) => (x.hostiles = [boss(42, { x: 100, y: 100 })])), off);
    expect(a.hidden).toBe(false);
    // KO: banner dropped, indicator gone
    hud.update(snap((x) => (x.hostiles = [boss(42, { x: 100, y: 100 }, 'ko')])), off);
    expect(a.hidden).toBe(true);
    expect(hud.root.querySelectorAll('.bb-edge')).toHaveLength(0);
    hud.destroy();
  });
});
