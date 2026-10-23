// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ALERT_MIN_MS, CAID_ALERT_MS, FLAG_ALERT_MS, guideMarks, isNewAttack } from '../../src/game/hud/alerts';
import { HELP_MS, Hud, type CameraView } from '../../src/game/hud/hud';
import { ACTION_WORDS, alarmPeriodMs, arrowToward, firstRuinHelp, hintAnchor, steppedPulse } from '../../src/game/render/actionHintMath';
import { DISTRICT } from '../../src/sim/map/district';
import { Sim, type Snapshot } from '../../src/sim/sim';
import type { SimEvent } from '../../src/sim/types';

const view: CameraView = { x: 0, y: 0, zoom: 1, width: 800, height: 600 };
const off: CameraView = { ...view, x: 5000, y: 5000 };

function snap(patch: (s: Snapshot) => void = () => {}): Snapshot {
  const s = new Sim(1).snapshot();
  patch(s);
  return s;
}
const ruin = (s: Snapshot, id: string): void => {
  s.targets.find((t) => t.id === id)!.state = 'ruined';
};

describe('action prompt words and placement', () => {
  test('every hint kind has its verb; only needToolbox has no button', () => {
    expect(ACTION_WORDS.repair.verb).toBe('Réparer');
    expect(ACTION_WORDS.extinguish.verb).toBe('Éteindre');
    expect(ACTION_WORDS.callFire.verb).toBe('Appeler les pompiers');
    expect(ACTION_WORDS.callPolice.verb).toBe('Appeler la police');
    expect(ACTION_WORDS.needToolbox).toEqual({ verb: 'Il faut une caisse à outils', line: 'Il faut une caisse à outils', button: null });
  });

  test('the bubble floats above the target, at its door’s x, whole pixels', () => {
    for (const t of DISTRICT.targets) {
      const a = hintAnchor(t.id);
      expect(a.x).toBe(Math.round(t.door.x));
      expect(a.y).toBeLessThan(t.footprint.y + t.footprint.h);
      expect(Number.isInteger(a.y)).toBe(true);
    }
  });

  test('the toolbox arrow sits r px from Paul toward the toolbox', () => {
    expect(arrowToward({ x: 0, y: 0 }, { x: 100, y: 0 }, 30)).toEqual({ x: 30, y: 0, angle: 0 });
    expect(arrowToward({ x: 0, y: 0 }, { x: 0, y: 50 }, 30)!.y).toBe(30);
    expect(arrowToward({ x: 5, y: 5 }, { x: 5, y: 5 }, 30)).toBeNull();
  });

  test('pulses are stepped, steady under reduced motion; the alarm speeds up as hp falls', () => {
    expect(new Set([0, 100, 200, 300].map((t) => steppedPulse(t, 400))).size).toBe(4);
    expect(steppedPulse(123, 400, true)).toBe(1);
    expect(alarmPeriodMs(1)).toBe(900);
    expect(alarmPeriodMs(0)).toBe(250);
    expect(alarmPeriodMs(0.5)).toBeLessThan(alarmPeriodMs(0.9));
    expect(alarmPeriodMs(-1)).toBe(250);
  });

  test('first-ruin help names F on keyboard, Agir on touch', () => {
    expect(firstRuinHelp(false)).toBe('Ramasse une caisse à outils, puis appuie sur F devant le bâtiment.');
    expect(firstRuinHelp(true)).toContain('Agir');
  });
});

describe('repair guidance marks', () => {
  test('no ruin: nothing', () => {
    expect(guideMarks(snap((s) => (s.toolboxes.ground = [{ id: 1, pos: { x: 10, y: 10 } }])))).toEqual([]);
  });

  test('a ruin, no toolbox carried: every toolbox on the ground', () => {
    const s = snap((x) => {
      ruin(x, 'busStop');
      x.toolboxes.ground = [{ id: 4, pos: { x: 10, y: 20 } }];
    });
    expect(guideMarks(s)).toEqual([{ id: 'toolbox:4', kind: 'toolbox', pos: { x: 10, y: 20 } }]);
  });

  test('carrying a toolbox: every ruin, at its door', () => {
    const s = snap((x) => {
      ruin(x, 'busStop');
      ruin(x, 'kiosk');
      x.toolboxes.carried = true;
      x.toolboxes.ground = [{ id: 4, pos: { x: 10, y: 20 } }];
    });
    const door = (id: string) => DISTRICT.targets.find((t) => t.id === id)!.door;
    expect(guideMarks(s)).toEqual([
      { id: 'ruin:busStop', kind: 'ruin', pos: door('busStop') },
      { id: 'ruin:kiosk', kind: 'ruin', pos: door('kiosk') },
    ]);
  });
});

describe('louder alerts', () => {
  test('warning banners stay at least 3.5 s', () => {
    expect(ALERT_MIN_MS).toBe(3500);
    expect(CAID_ALERT_MS).toBeGreaterThanOrEqual(ALERT_MIN_MS);
    expect(FLAG_ALERT_MS).toBeGreaterThanOrEqual(ALERT_MIN_MS);
  });

  test('new attacks are recognised', () => {
    expect(
      isNewAttack({ type: 'CasseStarted', incidentId: 'a', kind: 'car', target: 'car1', pos: { x: 0, y: 0 }, round: 1, total: 4 }),
    ).toBe(true);
    expect(isNewAttack({ type: 'FireOut', target: 'car1' })).toBe(false);
  });
});

describe('Hud: guidance, glow, help, Agir pulse', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });
  afterEach(() => vi.useRealTimers());

  test('guide indicators show off-screen and go once the ruin is repaired', () => {
    const hud = new Hud(document.body, null);
    const guides = () => [...hud.root.querySelectorAll<HTMLElement>('.bb-guide')];
    const s = snap((x) => {
      ruin(x, 'busStop');
      x.toolboxes.carried = true;
    });
    hud.update(s, off);
    expect(guides().map((g) => g.querySelector('.lbl')!.textContent)).toEqual(['RÉPARER']);
    expect(guides()[0]!.querySelector('.dist')!.textContent).toMatch(/^\d+ m$/);
    hud.update(
      snap((x) => (x.toolboxes.carried = true)),
      off,
    );
    expect(guides()).toHaveLength(0);
    hud.destroy();
  });

  test('an attacked target’s edge indicator pulses faster as its hp falls', () => {
    const hud = new Hud(document.body, null);
    const s = snap((x) => {
      const t = x.targets.find((t) => t.id === 'car1')!;
      t.state = 'attacked';
      t.hp = t.maxHp * 0.2;
    });
    hud.update(s, off);
    const e = hud.root.querySelector<HTMLElement>('.bb-edge')!;
    expect(e.style.getPropertyValue('--pulse')).toBe(`${alarmPeriodMs(0.2)}ms`);
    hud.destroy();
  });

  test('a new attack glows the screen edges once, briefly', () => {
    const hud = new Hud(document.body, null);
    const glow = hud.root.querySelector<HTMLElement>('.bb-glow')!;
    expect(glow.hidden).toBe(true);
    const ev: SimEvent = { type: 'CasseStarted', incidentId: 'a', kind: 'car', target: 'car1', pos: { x: 0, y: 0 }, round: 1, total: 4 };
    hud.onEvents([ev, ev]);
    expect(glow.hidden).toBe(false);
    expect(glow.classList.contains('on')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(glow.hidden).toBe(true);
    hud.destroy();
  });

  test('the first ruin of the game shows one line of help, once', () => {
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(1000);
    const hud = new Hud(document.body, null);
    const help = hud.root.querySelector<HTMLElement>('.bb-help')!;
    hud.update(snap(), view);
    expect(help.hidden).toBe(true);
    hud.update(
      snap((x) => ruin(x, 'busStop')),
      view,
    );
    expect(help.hidden).toBe(false);
    expect(help.textContent).toBe('Ramasse une caisse à outils, puis appuie sur F devant le bâtiment.');
    now.mockReturnValue(1000 + HELP_MS + 1);
    hud.update(
      snap((x) => ruin(x, 'busStop')),
      view,
    );
    expect(help.hidden).toBe(true);
    // a later ruin: not again
    hud.update(
      snap((x) => ruin(x, 'kiosk')),
      view,
    );
    expect(help.hidden).toBe(true);
    hud.destroy();
    now.mockRestore();
  });

  test('touch: the Agir button pulses and names the action only when one is available', () => {
    document.body.innerHTML = '<div id="touch-ui" class="visible"><button data-action="act">Agir</button></div>';
    const touch = document.getElementById('touch-ui')!;
    const btn = touch.querySelector<HTMLElement>('[data-action=act]')!;
    const hud = new Hud(document.body, touch);
    hud.update(snap(), view);
    expect(btn.classList.contains('bb-act-ready')).toBe(false);
    hud.update(
      snap((x) => (x.actionHint = { kind: 'callFire', target: 'boothRed', at: { x: 0, y: 0 }, toolbox: null })),
      view,
    );
    expect(btn.classList.contains('bb-act-ready')).toBe(true);
    expect(btn.textContent).toBe('Appeler');
    // the bubble in the world is the cue: the line under Paul is for screen readers only
    expect(hud.root.querySelector('.bb-prompt')!.classList.contains('bb-sr')).toBe(true);
    hud.update(
      snap((x) => (x.actionHint = { kind: 'needToolbox', target: 'busStop', at: { x: 0, y: 0 }, toolbox: null })),
      view,
    );
    expect(btn.classList.contains('bb-act-ready')).toBe(false);
    hud.destroy();
    expect(btn.classList.contains('bb-act-ready')).toBe(false);
  });
});
