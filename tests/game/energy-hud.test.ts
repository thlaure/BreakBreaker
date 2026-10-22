// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CONTROLS } from '../../src/content/controls';
import { ENERGY_REFUSED_HINT, energyView } from '../../src/game/hud/format';
import { ENERGY_HINT_MS, Hud, type CameraView } from '../../src/game/hud/hud';
import { ENERGY_CYAN, ENERGY_GOLD, HEALTH_BAR_W, energyBar } from '../../src/game/render/healthBar';
import { CONFIG } from '../../src/sim/config';
import { Sim, type Snapshot } from '../../src/sim/sim';

const view: CameraView = { x: 0, y: 0, zoom: 1, width: 800, height: 600 };

function snap(patch: (s: Snapshot) => void = () => {}): Snapshot {
  const s = new Sim(1).snapshot();
  patch(s);
  return s;
}
const withEnergy = (value: number, furie: number | null = null) =>
  snap((x) => {
    x.energy = { value, max: 100, ready: { onde: value >= 50, furie: value >= 100 } };
    x.furie = furie === null ? null : { secondsLeft: furie };
  });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('energyView (HUD « ÉNERGIE » row)', () => {
  test('low: no tag; onde from 50 (« C · Onde »: the key first); full: « R · Furie »; touch names the buttons', () => {
    expect(energyView(withEnergy(0))).toEqual({ pct: 0, state: 'low', tag: '', aria: 'Énergie 0 sur 100' });
    expect(energyView(withEnergy(49))).toMatchObject({ pct: 49, state: 'low', tag: '' });
    expect(energyView(withEnergy(50))).toMatchObject({ pct: 50, state: 'onde', tag: 'C · Onde' });
    expect(energyView(withEnergy(99))).toMatchObject({ state: 'onde', tag: 'C · Onde' });
    expect(energyView(withEnergy(50)).aria).toBe('Énergie 50 sur 100, onde d’énergie disponible (appuyer sur C)');
    expect(energyView(withEnergy(50), true).aria).toContain('bouton Onde');
    expect(energyView(withEnergy(100))).toMatchObject({ pct: 100, state: 'furie', tag: 'R · Furie' });
    expect(energyView(withEnergy(100), true)).toMatchObject({ tag: 'FURIE !' });
    expect(energyView(withEnergy(64), true)).toMatchObject({ tag: 'ONDE !' });
    expect(energyView(withEnergy(100), true).aria).toContain('bouton Furie');
  });

  test('mode furie on: the bar shows the time left (drains over 18 s), tag « EN FURIE »', () => {
    expect(energyView(withEnergy(0, CONFIG.furie.durationSec))).toMatchObject({ pct: 100, state: 'active', tag: 'EN FURIE' });
    expect(energyView(withEnergy(0, 9)).pct).toBeCloseTo(50, 6);
    expect(energyView(withEnergy(0, 4.5)).pct).toBeCloseTo(25, 6);
  });
});

describe('world energy bar under Paul’s health bar', () => {
  test('fill follows the gauge; cyan while filling, gold when full or in furie (draining)', () => {
    const inner = HEALTH_BAR_W - 2;
    expect(energyBar(withEnergy(0))).toEqual({ fill: 0, color: ENERGY_CYAN });
    expect(energyBar(withEnergy(25))).toEqual({ fill: Math.round(inner / 4), color: ENERGY_CYAN });
    expect(energyBar(withEnergy(50)).fill).toBe(Math.round(inner / 2));
    expect(energyBar(withEnergy(100))).toEqual({ fill: inner, color: ENERGY_GOLD });
    expect(energyBar(withEnergy(0, 9))).toEqual({ fill: Math.round(inner / 2), color: ENERGY_GOLD });
  });
});

describe('Hud ÉNERGIE row, refusal hint and touch buttons', () => {
  const touchRoot = (): HTMLElement => {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div id="touch-ui" class="visible"><button data-action="act">Agir</button><button data-action="furie">Furie</button><button data-action="onde">Onde</button></div>`,
    );
    return document.getElementById('touch-ui')!;
  };
  const row = (hud: Hud) => hud.root.querySelector<HTMLElement>('.bb-stats .energy')!;

  test('row after ARME: label, bar width, state classes, tag text, pop when it fills', () => {
    const hud = new Hud(document.body, null);
    hud.update(withEnergy(20), view);
    const r = row(hud);
    expect(r.previousElementSibling!.classList.contains('weapon')).toBe(true);
    expect(r.querySelector('.lbl')!.textContent).toBe('ÉNERGIE');
    expect(r.querySelector<HTMLElement>('.efill')!.style.width).toBe('20%');
    expect(r.querySelectorAll('.tick')).toHaveLength(1);
    expect(r.classList.contains('st-low')).toBe(true);
    // first frame: no pop
    expect(r.querySelector('.ebar')!.classList.contains('pop')).toBe(false);
    hud.update(withEnergy(56), view);
    expect(r.querySelector('.ebar')!.classList.contains('pop')).toBe(true);
    expect(r.classList.contains('st-onde')).toBe(true);
    expect(r.querySelector('.etag')!.textContent).toBe('C · Onde');
    hud.update(withEnergy(100), view);
    expect(r.classList.contains('st-furie')).toBe(true);
    expect(r.querySelector('.etag')!.textContent).toBe('R · Furie');
    expect(r.getAttribute('aria-label')).toContain('mode furie disponible');
    hud.update(withEnergy(0, 9), view);
    expect(r.classList.contains('st-active')).toBe(true);
    expect(r.querySelector<HTMLElement>('.efill')!.style.width).toBe('50%');
    hud.destroy();
  });

  test('EnergyRefused shows « Énergie insuffisante » for a moment, then the usual tag', () => {
    const hud = new Hud(document.body, null);
    hud.update(withEnergy(30), view);
    hud.onEvents([{ type: 'EnergyRefused', need: 50 }]);
    hud.update(withEnergy(30), view);
    expect(row(hud).querySelector('.etag')!.textContent).toBe(ENERGY_REFUSED_HINT);
    expect(row(hud).classList.contains('refused')).toBe(true);
    vi.advanceTimersByTime(ENERGY_HINT_MS + 10);
    hud.update(withEnergy(30), view);
    expect(row(hud).querySelector('.etag')!.textContent).toBe('');
    expect(row(hud).classList.contains('refused')).toBe(false);
    hud.destroy();
  });

  test('touch Furie / Onde: dim until available, ready (glow) once the gauge allows them; touch tags', () => {
    const root = touchRoot();
    const hud = new Hud(document.body, root);
    const furie = root.querySelector<HTMLElement>('[data-action=furie]')!;
    const onde = root.querySelector<HTMLElement>('[data-action=onde]')!;
    hud.update(withEnergy(10), view);
    expect(furie.classList.contains('dim') && onde.classList.contains('dim')).toBe(true);
    expect(furie.getAttribute('aria-label')).toBe('Furie : énergie insuffisante');
    hud.update(withEnergy(60), view);
    expect(onde.classList.contains('ready')).toBe(true);
    expect(furie.classList.contains('dim')).toBe(true);
    expect(row(hud).querySelector('.etag')!.textContent).toBe('ONDE !');
    hud.update(withEnergy(100), view);
    expect(furie.classList.contains('ready') && onde.classList.contains('ready')).toBe(true);
    expect(furie.getAttribute('aria-label')).toBe('Furie : disponible');
    // in furie the gauge is spent: both dim
    hud.update(withEnergy(0, 8), view);
    expect(furie.classList.contains('dim') && onde.classList.contains('dim')).toBe(true);
    hud.destroy();
  });

  test('a real session: KOs feed the row; R with a full gauge empties it into the mode furie', () => {
    const sim = new Sim(4);
    const hud = new Hud(document.body, null);
    sim.energy.value = 96;
    hud.update(sim.snapshot(), view);
    expect(row(hud).classList.contains('st-onde')).toBe(true);
    sim.energy.value = 100;
    hud.update(sim.snapshot(), view);
    expect(row(hud).querySelector('.etag')!.textContent).toBe('R · Furie');
    const ev = sim.step({ move: { x: 0, y: 0 }, aim: null, run: false, strike: false, chargeHeld: false, throwRock: false, act: false, furie: true });
    hud.onEvents(ev);
    hud.update(sim.snapshot(), view);
    expect(row(hud).querySelector('.etag')!.textContent).toBe('EN FURIE');
    expect(hud.root.querySelector('.bb-alert .title')!.textContent).toBe('MODE FURIE !');
    hud.destroy();
  });

  test('controls help lists the two activations', () => {
    expect(CONTROLS.map((c) => c.action)).toEqual(expect.arrayContaining(['Mode furie', 'Onde d’énergie']));
  });
});

describe('audio cues of the gauge', () => {
  test('EnergyReady pings (onde soft, furie bright), EnergyRefused tocks; silent and safe without a context', async () => {
    const { GameAudio } = await import('../../src/game/audio');
    const a = new GameAudio();
    const ready = vi.spyOn(a, 'energyReady');
    const tock = vi.spyOn(a, 'tock');
    a.onEvents([{ type: 'EnergyReady', level: 'onde' }, { type: 'EnergyReady', level: 'furie' }, { type: 'EnergyRefused', need: 100 }]);
    expect(ready.mock.calls).toEqual([['onde'], ['furie']]);
    expect(tock).toHaveBeenCalledTimes(1);
  });
});
