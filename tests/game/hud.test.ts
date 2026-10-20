import { describe, expect, test, vi } from 'vitest';
import { CONTROLS, RULES } from '../../src/content/controls';
import { contextPrompt, formatDuration, formatSummary, incidentLines, roundPanel, waveLine, weaponLine } from '../../src/game/hud/format';
import { renderMarkdown } from '../../src/game/hud/markdown';
import { Sim, type Snapshot } from '../../src/sim/sim';

function snap(patch: (s: Snapshot) => void = () => {}): Snapshot {
  const s = new Sim(1).snapshot();
  patch(s);
  return s;
}

describe('formatDuration', () => {
  test('mm:ss, floored, minutes may exceed 59', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65.9)).toBe('01:05');
    expect(formatDuration(4503)).toBe('75:03');
    expect(formatDuration(-3)).toBe('00:00');
  });
});

describe('formatSummary', () => {
  const rows = (s: Snapshot, record: number | null) => Object.fromEntries(formatSummary(s, record).rows.map((r) => [r.label, r.value]));

  test('KO session with a previous record', () => {
    const s = snap((x) => {
      x.ended = true;
      x.endCause = 'ko';
      x.score = 12;
      x.round = 3;
      x.kos = 9;
      x.stats = {
        ...x.stats,
        ...{ schoolsSaved: 1, schoolsLost: 0, rescuesOk: 0, rescuesFailed: 1, healsUsed: 2, rocksPicked: 4, rocksReturned: 3, rocksHit: 2, activeSeconds: 125.4 },
      };
    });
    const f = formatSummary(s, 20);
    expect(f.title).toBe('KO');
    expect(f.newRecord).toBe(false);
    const r = rows(s, 20);
    expect(r['Score']).toBe('12');
    expect(r['Record']).toBe('20');
    expect(r['Manche atteinte']).toBe('3');
    expect(r['Casseurs neutralisés']).toBe('9');
    expect(r['École']).toBe('sauvée');
    expect(r['Secours']).toBe('manqué');
    expect(r['Soins utilisés']).toBe('2');
    expect(r['Pierres ramassées']).toBe('4');
    expect(r['Pierres renvoyées']).toBe('3');
    expect(r['Pierres touchées']).toBe('2');
    expect(r['Durée active']).toBe('02:05');
  });

  test('voluntary stop, new record, undecided incidents', () => {
    const s = snap((x) => {
      x.ended = true;
      x.endCause = 'quit';
      x.score = 5;
    });
    const f = formatSummary(s, null);
    expect(f.title).toBe('Session interrompue volontairement');
    expect(f.newRecord).toBe(true);
    const r = rows(s, null);
    expect(r['Record']).toBe('—');
    expect(r['École']).toBe('en cours');
    expect(r['Secours']).toBe('—');
  });

  test('destroyed school, rescue done', () => {
    const s = snap((x) => {
      x.stats.schoolsLost = 1;
      x.stats.rescuesOk = 1;
    });
    const r = rows(s, 1);
    expect(r['École']).toBe('détruite');
    expect(r['Secours']).toBe('réussi');
  });

  test('summary shows Manche atteinte, Manches parfaites, Lieux sauvés / détruits, Réparations', () => {
    const s = snap((x) => {
      x.round = 4;
      x.stats = { ...x.stats, targetsSaved: 3, targetsLost: 2, repairs: 1, roundsPerfect: 2 };
    });
    const r = rows(s, null);
    expect(r['Manche atteinte']).toBe('4');
    expect(r['Manches parfaites']).toBe('2');
    expect(r['Lieux sauvés / détruits']).toBe('3 / 2');
    expect(r['Réparations']).toBe('1');
    expect(Object.keys(r)).not.toContain('Vague atteinte');
  });
});

describe('contextPrompt', () => {
  test('no key prompt near a charged station: walking onto it heals', () => {
    const s = snap((x) => {
      const st = x.stations[0]!;
      x.player.pos = { x: st.pos.x + 10, y: st.pos.y };
      x.stationMessage = null;
    });
    expect(contextPrompt(s)).toBeNull();
  });

  test('no prompt away from stations', () => {
    expect(contextPrompt(snap())).toBeNull();
  });

  test('station message is shown as is', () => {
    const s = snap((x) => {
      x.stationMessage = 'Santé au maximum';
    });
    // informational: no touch Agir button for it
    expect(contextPrompt(s)).toEqual({ text: 'Santé au maximum', label: null });
  });

  test('no "Aider" prompt next to a secured victim: the rescue completes by itself', () => {
    const s = snap((x) => {
      x.rescue = { stage: 'secured', remaining: 10, victimPos: { x: 100, y: 100 }, kind: 'groupHarassed' };
      x.player.pos = { x: 110, y: 100 };
    });
    expect(contextPrompt(s)).toBeNull();
    expect(contextPrompt(s, true)).toBeNull();
  });
});

describe('contextPrompt: toolboxes', () => {
  test('toolbox messages and the repair in progress are informational (no Agir label)', () => {
    expect(contextPrompt(snap((x) => { x.toolboxes.message = 'Caisse à outils requise'; }))).toEqual({ text: 'Caisse à outils requise', label: null });
    expect(contextPrompt(snap((x) => { x.toolboxes.message = 'Abords non sécurisés'; }), true)).toEqual({ text: 'Abords non sécurisés', label: null });
    const repairing = snap((x) => {
      x.toolboxes.carried = true;
      x.toolboxes.progress = 1.2;
      x.toolboxes.repairTarget = 'busStop';
      x.stationMessage = 'Santé au maximum';
    });
    expect(contextPrompt(repairing)).toEqual({ text: 'Réparation…', label: null });
  });
});

describe('roundPanel', () => {
  const breather = (patch: (s: Snapshot) => void = () => {}) =>
    snap((x) => {
      x.roundPhase = 'breather';
      x.breatherLeft = 5.5;
      x.lastSummary = { index: 1, kos: 10, objectives: [{ kind: 'school', result: 'réussi' }, { kind: 'rescue', result: 'perdu' }], points: -1, bonus: false };
      patch(x);
    });

  test('null outside the breather or once the session ended', () => {
    expect(roundPanel(snap())).toBeNull();
    expect(roundPanel(breather((x) => { x.ended = true; }))).toBeNull();
    expect(roundPanel(breather((x) => { x.lastSummary = null; }))).toBeNull();
  });

  test('title, KOs, objectives, signed points, bonus, heals and countdown', () => {
    expect(roundPanel(breather())).toEqual({
      title: 'Manche 1 terminée',
      kos: 'Casseurs neutralisés : 10',
      objectives: [{ name: 'École', result: 'réussi' }, { name: 'Secours', result: 'perdu' }],
      points: '−1 point',
      bonus: null,
      heals: 'Soins rechargés',
      countdown: 'Manche 2 dans 6…',
    });
    const won = roundPanel(breather((x) => { x.lastSummary = { ...x.lastSummary!, points: 21, bonus: true }; x.breatherLeft = 0.01; }))!;
    expect(won.points).toBe('+21 points');
    expect(won.bonus).toBe('Bonus +5');
    expect(won.countdown).toBe('Manche 2 dans 1…');
  });
});

describe('incidentLines', () => {
  test('school card reads "renforts" during the cinematic (not "interrompu")', () => {
    const s = new Sim(21, { invulnerable: true });
    for (let i = 0; i < 60 * 30 && s.school.stage !== 'cinematic'; i++) {
      for (const h of s.horde.active()) s.horde.applyHit(h.lifeId, 99);
      s.step({ move: { x: 0, y: 0 }, aim: null, run: false, strike: false, throwRock: false, act: false });
    }
    const [school] = incidentLines(s.snapshot(), 'en cours');
    expect(school).toMatchObject({ key: 'school', status: 'renforts' });
  });

  const attacked = (x: Snapshot, id: string, hp: number, burning = false): void => {
    const t = x.targets.find((t) => t.id === id)!;
    Object.assign(t, { state: 'attacked', hp, burning });
  };
  const calm = (x: Snapshot): void => {
    for (const t of x.targets) t.state = 'intact';
    x.school.stage = 'attack';
  };

  test('one card per attacked target with its health rounded up; rescue hidden when absent', () => {
    const s = snap((x) => {
      calm(x);
      attacked(x, 'school', 63.2, true);
      attacked(x, 'busStop', 15);
    });
    const lines = incidentLines(s, 'interrompu');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ key: 'school', kind: 'school', name: 'École', time: '64 %', hp: 63.2, status: 'en feu' });
    expect(lines[1]).toMatchObject({ key: 'busStop', kind: 'busStop', name: 'Abribus', time: '25 %', hp: 25, status: 'attaquée' });
  });

  test('resolved incidents have no card (rescue: once its thanks beat is over); rescue status derives from stage and drain', () => {
    const s = snap((x) => {
      calm(x);
      x.school.stage = 'saved';
      x.rescue = { stage: 'threat', remaining: 12.1, victimPos: { x: 0, y: 0 }, kind: 'elderlyRobbed' };
    });
    const [rescue, none] = incidentLines(s, 'en cours');
    expect(none).toBeUndefined();
    expect(rescue).toMatchObject({ name: 'Secours', time: '13 s', status: 'en cours' });
    s.rescue = { stage: 'secured', remaining: 12, victimPos: { x: 0, y: 0 }, kind: 'elderlyRobbed' };
    expect(incidentLines(s, 'en cours')[0]).toMatchObject({ status: 'sécurisé' });
    s.rescue = { stage: 'failed', remaining: 0, victimPos: { x: 0, y: 0 }, kind: 'elderlyRobbed' };
    expect(incidentLines(s, 'en cours')).toEqual([]);
    s.rescue = { stage: 'completed', remaining: 12, victimPos: { x: 0, y: 0 }, kind: 'elderlyRobbed' };
    expect(incidentLines(s, 'en cours')).toEqual([]);
  });
});

describe('renderMarkdown', () => {
  test('escapes HTML and renders headings, lists and http links only', () => {
    const html = renderMarkdown('# Titre <b>\n\n- [a](https://x.org/?a=1&b=2)\n- [bad](javascript:alert(1))\n\ntexte `code` <script>');
    expect(html).toContain('<h1>Titre &lt;b&gt;</h1>');
    expect(html).toContain('<li><a href="https://x.org/?a=1&amp;b=2"');
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('<code>code</code>');
    expect(html).not.toContain('<script>');
  });
});

describe('content', () => {
  test('4-5 rules and a controls table', () => {
    expect(RULES.length).toBeGreaterThanOrEqual(4);
    expect(RULES.length).toBeLessThanOrEqual(5);
    expect(CONTROLS.some((c) => c.action === 'Pause' && c.keyboard === 'Échap')).toBe(true);
  });

  test('no Agir row: rescuing needs no key, F only skips the school sequence in this slice', () => {
    expect(CONTROLS.some((c) => /Agir|aider/i.test(c.action) || /maintenir/.test(c.keyboard))).toBe(false);
    for (const r of RULES) expect(r).not.toMatch(/maintenir|\bF\b/);
  });
});

describe('GameAudio.reset', () => {
  test('clears the per-incident alarm memory so the alarm can play again after Rejouer', async () => {
    const { GameAudio } = await import('../../src/game/audio');
    const a = new GameAudio();
    const play = vi.spyOn(a, 'play').mockImplementation(() => undefined);
    const ev = [{ type: 'BuildingThreatStarted', incidentId: 'school#1' }] as const;
    a.onEvents([...ev]);
    a.onEvents([...ev]);
    expect(play.mock.calls.filter((c) => c[0] === 'alarm')).toHaveLength(1);
    a.reset();
    a.onEvents([...ev]);
    expect(play.mock.calls.filter((c) => c[0] === 'alarm')).toHaveLength(2);
  });

  test('alarm once on RescueStarted too', async () => {
    const { GameAudio } = await import('../../src/game/audio');
    const a = new GameAudio();
    const play = vi.spyOn(a, 'play').mockImplementation(() => undefined);
    const e = { type: 'RescueStarted', incidentId: 'rescue#1', pos: { x: 1, y: 2 }, kind: 'groupHarassed', wave: 2, total: 3 } as const;
    a.onEvents([e]);
    a.onEvents([e]);
    expect(play.mock.calls.filter((c) => c[0] === 'alarm')).toHaveLength(1);
  });

  test('a round announcement does not sound the incident alarm (rounds are frequent)', async () => {
    const { GameAudio } = await import('../../src/game/audio');
    const a = new GameAudio();
    const play = vi.spyOn(a, 'play').mockImplementation(() => undefined);
    a.onEvents([{ type: 'RoundStarted', index: 3, total: 18, headline: 'car' }]);
    a.onEvents([{ type: 'RoundStarted', index: 3, total: 18, headline: 'car' }]);
    a.onEvents([{ type: 'RoundStarted', index: 4, total: 22, headline: 'school' }]);
    expect(play.mock.calls.filter((c) => c[0] === 'alarm')).toHaveLength(0);
  });
});

describe('GameAudio.onEvents', () => {
  test('chime plays once per TargetSaved / TargetRepaired / RoundCompleted, at most once per batch', async () => {
    const { GameAudio } = await import('../../src/game/audio');
    const a = new GameAudio();
    const chime = vi.spyOn(a, 'chime').mockImplementation(() => undefined);
    a.onEvents([{ type: 'TargetSaved', incidentId: 'car#2', target: 'car1' }]);
    expect(chime).toHaveBeenCalledTimes(1);
    a.onEvents([{ type: 'TargetRepaired', target: 'busStop', incidentId: 'busStop#3' }]);
    a.onEvents([{ type: 'RoundCompleted', index: 3, bonus: true }]);
    expect(chime).toHaveBeenCalledTimes(3);
    // the round's last KO saves a target and completes the round in the same step: one chime
    a.onEvents([{ type: 'TargetSaved', incidentId: 'school#4', target: 'school' }, { type: 'RoundCompleted', index: 4, bonus: true }]);
    expect(chime).toHaveBeenCalledTimes(4);
    a.onEvents([{ type: 'FireOut', target: 'car1' }, { type: 'StationsRecharged' }]);
    expect(chime).toHaveBeenCalledTimes(4);
  });

  test('casse alarm once per incident, whoosh on a Molotov, pickup sound on a toolbox', async () => {
    const { GameAudio } = await import('../../src/game/audio');
    const a = new GameAudio();
    const play = vi.spyOn(a, 'play').mockImplementation(() => undefined);
    const whoosh = vi.spyOn(a, 'whoosh').mockImplementation(() => undefined);
    const casse = { type: 'CasseStarted', incidentId: 'car#2', kind: 'car', target: 'car1', pos: { x: 0, y: 0 }, round: 2, total: 14 } as const;
    a.onEvents([casse, casse]);
    expect(play.mock.calls.filter((c) => c[0] === 'alarm')).toHaveLength(1);
    a.onEvents([{ type: 'MolotovThrown', from: { x: 0, y: 0 }, to: { x: 9, y: 9 }, target: 'car1' }]);
    expect(whoosh).toHaveBeenCalledTimes(1);
    a.onEvents([{ type: 'ToolboxPickedUp', id: 1 }]);
    expect(play).toHaveBeenLastCalledWith('pickup');
  });

  test('threat level follows the lowest attacked target and any burning one', async () => {
    const { threatLevel } = await import('../../src/game/audio');
    const s = snap((x) => {
      for (const t of x.targets) Object.assign(t, { state: 'intact', burning: false, hp: t.maxHp });
    });
    expect(threatLevel(s)).toBe(0);
    const car = s.targets.find((t) => t.id === 'car1')!;
    Object.assign(car, { state: 'attacked', hp: car.maxHp / 2 });
    expect(threatLevel(s)).toBeCloseTo(0.35 + 0.65 * 0.5);
    const school = s.targets.find((t) => t.id === 'school')!;
    Object.assign(school, { state: 'attacked', hp: 10 });
    expect(threatLevel(s)).toBeCloseTo(0.35 + 0.65 * 0.9);
    // fire still burning while it goes out (no longer attacked): the loop keeps going
    for (const t of s.targets) Object.assign(t, { state: 'intact', hp: t.maxHp });
    car.burning = true;
    expect(threatLevel(s)).toBeCloseTo(0.35);
    s.ended = true;
    expect(threatLevel(s)).toBe(0);
  });

  test('throw sound on EnemyRockThrown only, not at windup start', async () => {
    const { GameAudio } = await import('../../src/game/audio');
    const a = new GameAudio();
    const play = vi.spyOn(a, 'play').mockImplementation(() => undefined);
    a.onEvents([{ type: 'EnemyThrowStarted', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, until: 5 }]);
    expect(play).not.toHaveBeenCalled();
    a.onEvents([{ type: 'EnemyRockThrown', rockId: 3 }]);
    expect(play).toHaveBeenCalledWith('throw');
  });
});

describe('waveLine', () => {
  test('round number alone without a roster, else « Manche N : K/T casseurs »', () => {
    expect(waveLine(snap())).toBe('Manche 1');
    expect(waveLine(snap((x) => { x.round = 3; x.roundTotal = 9; x.roundKos = 4; }))).toBe('Manche 3 : 4/9 casseurs');
    expect(waveLine(snap((x) => { x.round = 7; x.roundTotal = 1; x.roundKos = 0; }))).toBe('Manche 7 : 0/1 casseur');
  });
});

describe('weaponLine', () => {
  test('bare hands, then weapon name and strikes left', () => {
    expect(weaponLine(snap())).toBe('Arme : mains nues');
    expect(weaponLine(snap((x) => { x.weapon = { kind: 'panneau', uses: 3 }; }))).toBe('Arme : Panneau (3)');
  });
});
