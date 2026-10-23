import { describe, expect, test, vi } from 'vitest';
import { CONTROLS, RULES } from '../../src/content/controls';
import {
  contextPrompt,
  formatDuration,
  formatSummary,
  hpLabel,
  incidentLines,
  roundPanel,
  roundValue,
  waveLine,
  weaponLine,
  weaponValue,
} from '../../src/game/hud/format';
import { HEALTH_BAR_W, HEALTH_GREEN, HEALTH_RED, HEALTH_YELLOW, chargeFill, healthColor } from '../../src/game/render/healthBar';
import { renderMarkdown } from '../../src/game/hud/markdown';
import { RescueIncident } from '../../src/sim/incidents/rescue';
import { DISTRICT } from '../../src/sim/map/district';
import { rng } from '../../src/sim/rng';
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
        ...{
          schoolsSaved: 1,
          schoolsLost: 0,
          rescuesOk: 0,
          rescuesFailed: 1,
          healsUsed: 2,
          rocksPicked: 4,
          rocksReturned: 3,
          rocksHit: 2,
          activeSeconds: 125.4,
        },
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
    expect(r['École']).toBe('1 sauvée · 0 perdue');
    expect(r['Secours']).toBe('0 réussi · 1 raté');
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
    expect(r['École']).toBe('—');
    expect(r['Secours']).toBe('—');
  });

  test('destroyed school, rescue done', () => {
    const s = snap((x) => {
      x.stats.schoolsLost = 1;
      x.stats.rescuesOk = 1;
    });
    const r = rows(s, 1);
    expect(r['École']).toBe('0 sauvée · 1 perdue');
    expect(r['Secours']).toBe('1 réussi · 0 raté');
  });

  test('École and Secours are session counts (plural from 2), not one status', () => {
    const s = snap((x) => {
      x.stats = { ...x.stats, schoolsSaved: 2, schoolsLost: 1, rescuesOk: 3, rescuesFailed: 1 };
    });
    const r = rows(s, null);
    expect(r['École']).toBe('2 sauvées · 1 perdue');
    expect(r['Secours']).toBe('3 réussis · 1 raté');
    const t = rows(
      snap((x) => (x.stats = { ...x.stats, schoolsSaved: 1, schoolsLost: 2, rescuesOk: 0, rescuesFailed: 2 })),
      null,
    );
    expect(t['École']).toBe('1 sauvée · 2 perdues');
    expect(t['Secours']).toBe('0 réussi · 2 ratés');
  });

  test('monument, belongings and repairs rows; Casseurs neutralisés kept', () => {
    const s = snap((x) => {
      x.kos = 31;
      x.stats = { ...x.stats, monumentsDefended: 2, flagsLost: 1, flagsCaptured: 1, itemsReturned: 4, repairs: 3 };
    });
    const r = rows(s, null);
    expect(r['Casseurs neutralisés']).toBe('31');
    expect(r['Défenses du monument']).toBe('2');
    expect(r['Drapeaux perdus']).toBe('1');
    expect(r['Drapeaux repris']).toBe('1');
    expect(r['Objets rendus']).toBe('4');
    expect(r['Lieux réparés']).toBe('3');
    const labels = formatSummary(s, null).rows.map((x) => x.label);
    expect(labels.indexOf('Casseurs neutralisés')).toBeLessThan(labels.indexOf('École'));
  });

  test('a belonging handed back in a session counts in stats.itemsReturned', () => {
    const sim = new Sim(1);
    const site = DISTRICT.rescueSites[0]!;
    const inc = new RescueIncident('rescue#t');
    inc.start(sim.horde, site, rng(1), { x: site.x + 400, y: site.y }, sim.grid, { count: 0 });
    inc.items[0]!.state = 'carried';
    sim.rescue = inc;
    sim.player.pos = { ...site };
    const ev = sim.step({
      move: { x: 0, y: 0 },
      aim: null,
      run: false,
      strike: false,
      chargeHeld: false,
      throwRock: false,
      act: false,
      furie: false,
    });
    expect(ev.filter((e) => e.type === 'ItemReturned')).toHaveLength(1);
    expect(sim.snapshot().stats.itemsReturned).toBe(1);
    expect(rows(sim.snapshot(), null)['Objets rendus']).toBe('1');
  });

  test('summary shows Manche atteinte, Manches parfaites, Lieux sauvés / détruits, Lieux réparés', () => {
    const s = snap((x) => {
      x.round = 4;
      x.stats = { ...x.stats, targetsSaved: 3, targetsLost: 2, repairs: 1, roundsPerfect: 2 };
    });
    const r = rows(s, null);
    expect(r['Manche atteinte']).toBe('4');
    expect(r['Manches parfaites']).toBe('2');
    expect(r['Lieux sauvés / détruits']).toBe('3 / 2');
    expect(r['Lieux réparés']).toBe('1');
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
      x.stationMessage = 'fullHealth';
    });
    // informational: no touch Agir button for it
    expect(contextPrompt(s)).toEqual({ text: 'Santé au maximum', label: null });
  });

  test('no "Aider" prompt next to a secured victim: the rescue completes by itself', () => {
    const s = snap((x) => {
      x.rescue = {
        id: 'rescue#1',
        stage: 'secured',
        remaining: 10,
        victimPos: { x: 100, y: 100 },
        kind: 'groupHarassed',
        items: [],
        returnLeft: null,
      };
      x.player.pos = { x: 110, y: 100 };
    });
    expect(contextPrompt(s)).toBeNull();
    expect(contextPrompt(s, true)).toBeNull();
  });
});

describe('contextPrompt: toolboxes', () => {
  const at = { x: 0, y: 0 };
  const ready =
    (kind: 'repair' | 'extinguish') =>
    (x: Snapshot): void => {
      x.toolboxes.carried = true;
      x.toolboxes.repairTarget = 'busStop';
      x.toolboxes.canRepair = true;
      x.toolboxes.repairKind = kind === 'repair' ? 'ruin' : 'fire';
      x.actionHint = { kind, target: 'busStop', at, toolbox: null };
    };

  test('with a toolbox next to a ruin or a fire, safe: an actionable F prompt (touch: no key, Agir labelled), drawn in the world', () => {
    expect(contextPrompt(snap(ready('repair')))).toEqual({ text: 'F — Réparer', label: 'Réparer', inWorld: true });
    expect(contextPrompt(snap(ready('repair')), true)).toEqual({ text: 'Réparer', label: 'Réparer', inWorld: true });
    expect(contextPrompt(snap(ready('extinguish')))).toEqual({ text: 'F — Éteindre le feu', label: 'Éteindre', inWorld: true });
    expect(contextPrompt(snap(ready('extinguish')), true)).toEqual({ text: 'Éteindre le feu', label: 'Éteindre', inWorld: true });
    // started: progress shown, no button
    expect(
      contextPrompt(
        snap((x) => {
          ready('repair')(x);
          x.toolboxes.started = true;
          x.toolboxes.progress = 0.3;
        }),
      ),
    ).toEqual({ text: 'Réparation…', label: null, inWorld: true });
  });

  test('the prompt follows actionHint, not the raw toolbox fields (it never promises what the press would not do)', () => {
    expect(
      contextPrompt(
        snap((x) => {
          x.toolboxes.carried = true;
          x.toolboxes.repairTarget = 'busStop';
          x.toolboxes.canRepair = true;
          x.toolboxes.repairKind = 'ruin';
        }),
      ),
    ).toBeNull();
  });

  test('needToolbox: « Il faut une caisse à outils », informational, in the world', () => {
    const s = snap((x) => {
      x.toolboxes.message = 'toolboxRequired';
      x.actionHint = { kind: 'needToolbox', target: 'busStop', at, toolbox: null };
    });
    expect(contextPrompt(s)).toEqual({ text: 'Il faut une caisse à outils', label: null, inWorld: true });
  });

  test('toolbox messages and the repair in progress are informational (no Agir label)', () => {
    expect(
      contextPrompt(
        snap((x) => {
          x.toolboxes.message = 'toolboxRequired';
        }),
      ),
    ).toEqual({ text: 'Caisse à outils requise', label: null });
    expect(
      contextPrompt(
        snap((x) => {
          x.toolboxes.message = 'areaUnsafe';
        }),
        true,
      ),
    ).toEqual({ text: 'Abords non sécurisés', label: null });
    const repairing = snap((x) => {
      x.toolboxes.carried = true;
      x.toolboxes.progress = 1.2;
      x.toolboxes.started = true;
      x.toolboxes.repairTarget = 'busStop';
      x.stationMessage = 'fullHealth';
    });
    expect(contextPrompt(repairing)).toEqual({ text: 'Réparation…', label: null, inWorld: true });
  });
});

describe('roundPanel', () => {
  const breather = (patch: (s: Snapshot) => void = () => {}) =>
    snap((x) => {
      x.roundPhase = 'breather';
      x.breatherLeft = 5.5;
      x.lastSummary = {
        index: 1,
        kos: 10,
        objectives: [
          { kind: 'school', result: 'won' },
          { kind: 'rescue', result: 'lost' },
        ],
        points: -1,
        bonus: false,
      };
      patch(x);
    });

  test('null outside the breather or once the session ended', () => {
    expect(roundPanel(snap())).toBeNull();
    expect(
      roundPanel(
        breather((x) => {
          x.ended = true;
        }),
      ),
    ).toBeNull();
    expect(
      roundPanel(
        breather((x) => {
          x.lastSummary = null;
        }),
      ),
    ).toBeNull();
  });

  test('title, KOs, objectives, signed points, bonus, heals and countdown', () => {
    expect(roundPanel(breather())).toEqual({
      title: 'Manche 1 terminée',
      kos: 'Casseurs neutralisés : 10',
      objectives: [
        { name: 'École', result: 'réussi', ok: true },
        { name: 'Secours', result: 'perdu', ok: false },
      ],
      points: '−1 point',
      bonus: null,
      heals: 'Soins rechargés',
      countdown: 'Manche 2 dans 6…',
    });
    const won = roundPanel(
      breather((x) => {
        x.lastSummary = { ...x.lastSummary!, points: 21, bonus: true };
        x.breatherLeft = 0.01;
      }),
    )!;
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
      s.step({ move: { x: 0, y: 0 }, aim: null, run: false, strike: false, chargeHeld: false, throwRock: false, act: false, furie: false });
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

  test('the retro video-game shop has its card « Boutique » (health of 100, attacked then on fire)', () => {
    const s = snap((x) => {
      calm(x);
      attacked(x, 'shop', 41.5);
    });
    expect(incidentLines(s, 'en cours')).toEqual([
      expect.objectContaining({ key: 'shop', kind: 'shop', name: 'Boutique', time: '42 %', hp: 41.5, status: 'attaquée' }),
    ]);
    const f = snap((x) => {
      calm(x);
      attacked(x, 'shop', 80, true);
    });
    expect(incidentLines(f, 'en cours')[0]).toMatchObject({ key: 'shop', name: 'Boutique', status: 'en feu' });
  });

  test('the phone booths have their own cards (Cabine rouge, Cabine bleue)', () => {
    const s = snap((x) => {
      calm(x);
      attacked(x, 'boothRed', 30, true);
      attacked(x, 'boothBlue', 45);
    });
    expect(incidentLines(s, 'en cours')).toEqual([
      expect.objectContaining({ key: 'boothRed', kind: 'booth', name: 'Cabine rouge', time: '50 %', status: 'en feu' }),
      expect.objectContaining({ key: 'boothBlue', kind: 'booth', name: 'Cabine bleue', time: '75 %', status: 'attaquée' }),
    ]);
  });

  test('the Phase C places have their cards (Maternelle, Kiosque, Mairie, Bibliothèque, Église)', () => {
    const s = snap((x) => {
      calm(x);
      attacked(x, 'nursery', 50);
      attacked(x, 'kiosk', 30, true);
      attacked(x, 'townHall', 99.2);
      attacked(x, 'library', 10, true);
      attacked(x, 'church', 60, true); // 60 of 150 hp
    });
    expect(incidentLines(s, 'en cours')).toEqual([
      expect.objectContaining({ key: 'nursery', kind: 'nursery', name: 'Maternelle', time: '50 %', status: 'attaquée' }),
      expect.objectContaining({ key: 'kiosk', kind: 'kiosk', name: 'Kiosque', time: '50 %', status: 'en feu' }),
      expect.objectContaining({ key: 'townHall', kind: 'townHall', name: 'Mairie', time: '100 %', status: 'attaquée' }),
      expect.objectContaining({ key: 'library', kind: 'library', name: 'Bibliothèque', time: '10 %', status: 'en feu' }),
      expect.objectContaining({ key: 'church', kind: 'church', name: 'Église', time: '40 %', status: 'en feu' }),
    ]);
  });

  test('resolved incidents have no card (rescue: once its thanks beat is over); rescue status derives from stage and drain', () => {
    const s = snap((x) => {
      calm(x);
      x.school.stage = 'saved';
      x.rescue = {
        id: 'rescue#1',
        stage: 'threat',
        remaining: 12.1,
        victimPos: { x: 0, y: 0 },
        kind: 'elderlyRobbed',
        items: [],
        returnLeft: null,
      };
    });
    const [rescue, none] = incidentLines(s, 'en cours');
    expect(none).toBeUndefined();
    expect(rescue).toMatchObject({ name: 'Secours', time: '13 s', status: 'en cours' });
    s.rescue = {
      id: 'rescue#1',
      stage: 'secured',
      remaining: 12,
      victimPos: { x: 0, y: 0 },
      kind: 'elderlyRobbed',
      items: [],
      returnLeft: null,
    };
    expect(incidentLines(s, 'en cours')[0]).toMatchObject({ status: 'sécurisé' });
    s.rescue = {
      id: 'rescue#1',
      stage: 'failed',
      remaining: 0,
      victimPos: { x: 0, y: 0 },
      kind: 'elderlyRobbed',
      items: [],
      returnLeft: null,
    };
    expect(incidentLines(s, 'en cours')).toEqual([]);
    s.rescue = {
      id: 'rescue#1',
      stage: 'completed',
      remaining: 12,
      victimPos: { x: 0, y: 0 },
      kind: 'elderlyRobbed',
      items: [],
      returnLeft: null,
    };
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
  test('4-7 rules (the energy gauge and the bouclier included) and a controls table', () => {
    expect(RULES.length).toBeGreaterThanOrEqual(4);
    expect(RULES.length).toBeLessThanOrEqual(7);
    const energy = RULES.find((r) => r.includes('jauge d’énergie'))!;
    // every KO fills the gauge; half of it lets a C tap charge the onde (0.7 s), a full one starts the mode furie (R, 18 s)
    expect(energy).toMatch(/Chaque casseur mis KO remplit la jauge d’énergie/);
    expect(energy).toMatch(/appuie sur C : l’onde d’énergie se charge 0,7 s/);
    expect(energy).toMatch(/appuie sur R pour le mode furie \(18 s\)/);
    expect(energy).not.toMatch(/maintiens/);
    expect(RULES.some((r) => /bouclier peut apparaître \(20 s\)/.test(r))).toBe(true);
    expect(RULES.some((r) => /repousse/.test(r))).toBe(false);
    for (const r of RULES) expect(r).not.toMatch(/saiyan|éclair jaune|ramasse.*(furie|onde)/i);
    expect(CONTROLS).toContainEqual({ action: 'Mode furie', keyboard: 'R (jauge pleine)', touch: 'Bouton Furie' });
    expect(CONTROLS).toContainEqual({ action: 'Onde d’énergie', keyboard: 'C (jauge à moitié)', touch: 'Bouton Onde' });
    expect(CONTROLS.some((c) => c.action === 'Pause' && c.keyboard === 'Échap')).toBe(true);
  });

  test('F / Agir repairs or puts out a fire with a toolbox (a press, never held); rescuing needs no key', () => {
    expect(CONTROLS).toContainEqual({
      action: 'Réparer / éteindre (caisse à outils)',
      keyboard: 'F',
      touch: 'Bouton Agir (près d’un lieu à réparer)',
    });
    // nothing is held any more (the onde d’énergie is a C tap too), and never to help or repair
    expect(CONTROLS.some((c) => /aider/i.test(c.action) || /maintenir/i.test(c.keyboard) || /maintenir/i.test(c.touch))).toBe(false);
    for (const r of RULES) expect(r).not.toMatch(/maintenir|reste à côté/);
    expect(RULES.some((r) => r.includes('passe sur une caisse à outils, va près du lieu en ruine ou en feu et appuie sur F'))).toBe(true);
  });
});

describe('GameAudio.reset', () => {
  test('clears the per-incident alarm memory so the alarm can play again after Rejouer', async () => {
    const { GameAudio } = await import('../../src/game/audio');
    const a = new GameAudio();
    const play = vi.spyOn(a, 'play').mockImplementation(() => undefined);
    const ev = [
      { type: 'TargetIgnited', incidentId: 'school#1', kind: 'school', target: 'school', pos: { x: 0, y: 0 }, round: 1 },
    ] as const;
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
    a.onEvents([
      { type: 'TargetSaved', incidentId: 'school#4', target: 'school' },
      { type: 'RoundCompleted', index: 4, bonus: true },
    ]);
    expect(chime).toHaveBeenCalledTimes(4);
    a.onEvents([{ type: 'FireOut', target: 'car1' }, { type: 'StationsRecharged' }]);
    expect(chime).toHaveBeenCalledTimes(4);
  });

  test('fire alarm once per incident (on the fire, not the attack start), whoosh on a Molotov, pickup sound on a toolbox', async () => {
    const { GameAudio } = await import('../../src/game/audio');
    const a = new GameAudio();
    const play = vi.spyOn(a, 'play').mockImplementation(() => undefined);
    const whoosh = vi.spyOn(a, 'whoosh').mockImplementation(() => undefined);
    const casse = {
      type: 'CasseStarted',
      incidentId: 'car#2',
      kind: 'car',
      target: 'car1',
      pos: { x: 0, y: 0 },
      round: 2,
      total: 14,
    } as const;
    a.onEvents([casse, { type: 'BuildingThreatStarted', incidentId: 'car#2' }]);
    expect(play.mock.calls.filter((c) => c[0] === 'alarm')).toHaveLength(0);
    const fire = { type: 'TargetIgnited', incidentId: 'car#2', kind: 'car', target: 'car1', pos: { x: 0, y: 0 }, round: 2 } as const;
    a.onEvents([fire, fire]);
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

  test('a firebomb whooshes like a Molotov when thrown; its fire patch raises no alarm', async () => {
    const { GameAudio } = await import('../../src/game/audio');
    const a = new GameAudio();
    const play = vi.spyOn(a, 'play').mockImplementation(() => undefined);
    const whoosh = vi.spyOn(a, 'whoosh').mockImplementation(() => undefined);
    a.onEvents([{ type: 'FirebombThrown', from: { x: 0, y: 0 }, to: { x: 9, y: 9 }, until: 2 }]);
    expect(whoosh).toHaveBeenCalledTimes(1);
    a.onEvents([{ type: 'FirePatchStarted', id: 1, pos: { x: 9, y: 9 } }]);
    expect(play.mock.calls.filter((c) => c[0] === 'alarm')).toHaveLength(0);
  });
});

describe('waveLine', () => {
  test('round number alone without a roster, else « Manche N : K/T casseurs »', () => {
    expect(waveLine(snap())).toBe('Manche 1');
    expect(
      waveLine(
        snap((x) => {
          x.round = 3;
          x.roundTotal = 9;
          x.roundKos = 4;
        }),
      ),
    ).toBe('Manche 3 : 4/9 casseurs');
    expect(
      waveLine(
        snap((x) => {
          x.round = 7;
          x.roundTotal = 1;
          x.roundKos = 0;
        }),
      ),
    ).toBe('Manche 7 : 0/1 casseur');
  });
});

describe('score list values', () => {
  test('round value « N · K/T » (just N without a roster); weapon value capitalised, furie seconds kept', () => {
    expect(roundValue(snap())).toBe('1');
    expect(
      roundValue(
        snap((x) => {
          x.round = 3;
          x.roundTotal = 18;
          x.roundKos = 20;
        }),
      ),
    ).toBe('3 · 18/18');
    expect(weaponValue(snap())).toBe('Mains nues');
    expect(
      weaponValue(
        snap((x) => {
          x.weapon = { kind: 'baton', uses: 12 };
        }),
      ),
    ).toBe('Bâton (12)');
    expect(
      weaponValue(
        snap((x) => {
          x.weapon = { kind: 'baton', uses: 12 };
          x.furie = { secondsLeft: 8.2 };
        }),
      ),
    ).toBe('Bâton (12) · Mode furie 9 s');
  });
});

describe('weaponLine', () => {
  test('bare hands, then weapon name and strikes left', () => {
    expect(weaponLine(snap())).toBe('Arme : mains nues');
    expect(
      weaponLine(
        snap((x) => {
          x.weapon = { kind: 'panneau', uses: 3 };
        }),
      ),
    ).toBe('Arme : Panneau (3)');
  });
});

describe('mode furie HUD and audio', () => {
  test('weapon line: the held weapon stays, the furie seconds (rounded up) follow', () => {
    expect(
      weaponLine(
        snap((x) => {
          x.weapon = { kind: 'baton', uses: 12 };
          x.furie = { secondsLeft: 8.2 };
        }),
      ),
    ).toBe('Arme : Bâton (12) · Mode furie 9 s');
    expect(
      weaponLine(
        snap((x) => {
          x.weapon = null;
          x.furie = { secondsLeft: 12 };
        }),
      ),
    ).toBe('Arme : mains nues · Mode furie 12 s');
    expect(
      weaponLine(
        snap((x) => {
          x.weapon = null;
          x.furie = { secondsLeft: 0.01 };
        }),
      ),
    ).toBe('Arme : mains nues · Mode furie 1 s');
    expect(
      weaponLine(
        snap((x) => {
          x.weapon = null;
          x.furie = null;
        }),
      ),
    ).toBe('Arme : mains nues');
  });

  test('a furie started in the sim (full gauge, R) shows in the snapshot and the weapon line', () => {
    const sim = new Sim(4);
    sim.weapons.held = { kind: 'panneau', uses: 3 };
    sim.energy.value = 100;
    sim.step({ move: { x: 0, y: 0 }, aim: null, run: false, strike: false, chargeHeld: false, throwRock: false, act: false, furie: true });
    const s = sim.snapshot();
    expect(s.furie!.secondsLeft).toBeCloseTo(18 - 1 / 60, 6);
    expect(weaponLine(s)).toBe('Arme : Panneau (3) · Mode furie 18 s');
  });

  test('power-up sweep and hum on FurieStarted, hum stopped and power-down on FurieEnded; reset stops the hum', async () => {
    const { GameAudio } = await import('../../src/game/audio');
    const a = new GameAudio();
    const up = vi.spyOn(a, 'powerUp').mockImplementation(() => undefined);
    const down = vi.spyOn(a, 'powerDown').mockImplementation(() => undefined);
    const priv = a as unknown as { startHum: () => void; stopHum: () => void };
    const start = vi.spyOn(priv, 'startHum');
    const stop = vi.spyOn(priv, 'stopHum');
    a.onEvents([{ type: 'FurieStarted', secondsLeft: 12 }]);
    expect(up).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
    a.onEvents([{ type: 'FurieEnded' }]);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(down).toHaveBeenCalledTimes(1);
    a.reset();
    expect(stop).toHaveBeenCalledTimes(2);
    // no AudioContext (not unlocked): everything stays silent and never throws
    a.onEvents([{ type: 'FurieStarted', secondsLeft: 12 }, { type: 'FurieEnded' }]);
  });
});

describe('special weapons HUD and audio', () => {
  test('weapon row: the held weapon stays, the bouclier time follows (« Bâton (12) · Bouclier 14 s », seconds rounded up); furie suffix kept', () => {
    expect(
      weaponValue(
        snap((x) => {
          x.weapon = { kind: 'baton', uses: 12 };
          x.shield = { secondsLeft: 13.2 };
        }),
      ),
    ).toBe('Bâton (12) · Bouclier 14 s');
    expect(
      weaponValue(
        snap((x) => {
          x.weapon = null;
          x.shield = { secondsLeft: 0.01 };
        }),
      ),
    ).toBe('Mains nues · Bouclier 1 s');
    expect(
      weaponLine(
        snap((x) => {
          x.weapon = { kind: 'marteau', uses: 2 };
          x.shield = { secondsLeft: 4 };
          x.furie = { secondsLeft: 3 };
        }),
      ),
    ).toBe('Arme : Marteau (2) · Bouclier 4 s · Mode furie 3 s');
    expect(
      weaponValue(
        snap((x) => {
          x.weapon = { kind: 'baton', uses: 12 };
          x.shield = null;
        }),
      ),
    ).toBe('Bâton (12)');
  });

  test('a bouclier picked up in the sim shows its 20 s next to the held weapon', () => {
    const sim = new Sim(4);
    sim.weapons.held = { kind: 'panneau', uses: 6 };
    sim.weapons.ground.push({ id: 78, kind: 'bouclier', pos: { ...sim.player.pos }, expiresAt: null });
    sim.step({ move: { x: 0, y: 0 }, aim: null, run: false, strike: false, chargeHeld: false, throwRock: false, act: false, furie: false });
    expect(weaponValue(sim.snapshot())).toBe('Panneau (6) · Bouclier 20 s');
  });

  test('charge bar under the health bar: fill follows the charge progress', () => {
    expect(chargeFill(0)).toBe(0);
    expect(chargeFill(0.5)).toBe(Math.round((HEALTH_BAR_W - 2) / 2));
    expect(chargeFill(1)).toBe(HEALTH_BAR_W - 2);
    expect(chargeFill(2)).toBe(HEALTH_BAR_W - 2);
  });

  test('charge hum on BeamCharging, stopped on cancel or fire (with a zap); clank on a shield block; reset stops the hum', async () => {
    const { GameAudio } = await import('../../src/game/audio');
    const a = new GameAudio();
    const start = vi.spyOn(a, 'startCharge');
    const stop = vi.spyOn(a, 'stopCharge');
    const zap = vi.spyOn(a, 'zap').mockImplementation(() => undefined);
    const clank = vi.spyOn(a, 'clank').mockImplementation(() => undefined);
    a.onEvents([{ type: 'BeamCharging' }]);
    expect(start).toHaveBeenCalledTimes(1);
    a.onEvents([{ type: 'BeamCancelled' }]);
    expect(stop).toHaveBeenCalledTimes(1);
    a.onEvents([{ type: 'BeamFired', from: { x: 0, y: 0 }, to: { x: 9, y: 0 }, kos: 2 }]);
    expect(stop).toHaveBeenCalledTimes(2);
    expect(zap).toHaveBeenCalledTimes(1);
    a.onEvents([{ type: 'ShieldBlocked', pos: { x: 1, y: 1 } }]);
    expect(clank).toHaveBeenCalledTimes(1);
    a.reset();
    expect(stop).toHaveBeenCalledTimes(3);
  });
});

describe('Paul health bar (world) and its screen-reader text', () => {
  test('healthColor: green above 50 %, yellow above 25 %, red at 25 % and below', () => {
    expect(healthColor(100, 100)).toBe(HEALTH_GREEN);
    expect(healthColor(51, 100)).toBe(HEALTH_GREEN);
    expect(healthColor(50, 100)).toBe(HEALTH_YELLOW);
    expect(healthColor(26, 100)).toBe(HEALTH_YELLOW);
    expect(healthColor(25, 100)).toBe(HEALTH_RED);
    expect(healthColor(0, 100)).toBe(HEALTH_RED);
    expect(healthColor(30, 40)).toBe(HEALTH_GREEN);
    expect(healthColor(5, 0)).toBe(HEALTH_RED);
  });

  test('hpLabel: « Santé 85 sur 100 », rounded up, never negative', () => {
    expect(hpLabel(85, 100)).toBe('Santé 85 sur 100');
    expect(hpLabel(84.2, 100)).toBe('Santé 85 sur 100');
    expect(hpLabel(-3, 100)).toBe('Santé 0 sur 100');
  });
});
