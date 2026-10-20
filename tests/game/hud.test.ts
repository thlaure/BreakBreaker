import { describe, expect, test, vi } from 'vitest';
import { CONTROLS, RULES } from '../../src/content/controls';
import { contextPrompt, formatDuration, formatSummary, incidentLines, waveLine, weaponLine } from '../../src/game/hud/format';
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
      x.wave = 3;
      x.kos = 9;
      x.stats = { schoolsSaved: 1, schoolsLost: 0, rescuesOk: 0, rescuesFailed: 1, healsUsed: 2, rocksPicked: 4, rocksReturned: 3, rocksHit: 2, activeSeconds: 125.4 };
    });
    const f = formatSummary(s, 20);
    expect(f.title).toBe('KO');
    expect(f.newRecord).toBe(false);
    const r = rows(s, 20);
    expect(r['Score']).toBe('12');
    expect(r['Record']).toBe('20');
    expect(r['Vague atteinte']).toBe('3');
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

  test('school countdown rounds up; rescue hidden when absent', () => {
    const s = snap((x) => {
      x.school.remaining = 22.2;
      x.school.stage = 'firstLine';
      x.school.status = 'en cours';
    });
    const lines = incidentLines(s, 'interrompu');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ name: 'École', time: '23 s', status: 'en cours' });
  });

  test('finished incidents have no countdown; rescue status derives from stage and drain', () => {
    const s = snap((x) => {
      x.school.stage = 'saved';
      x.school.status = 'sauvé';
      x.rescue = { stage: 'threat', remaining: 12.1, victimPos: { x: 0, y: 0 }, kind: 'elderlyRobbed' };
    });
    const [school, rescue] = incidentLines(s, 'en cours');
    expect(school).toMatchObject({ time: '', status: 'sauvé' });
    expect(rescue).toMatchObject({ name: 'Secours', time: '13 s', status: 'en cours' });
    s.rescue = { stage: 'secured', remaining: 12, victimPos: { x: 0, y: 0 }, kind: 'elderlyRobbed' };
    expect(incidentLines(s, 'en cours')[1]).toMatchObject({ status: 'sécurisé' });
    s.rescue = { stage: 'failed', remaining: 0, victimPos: { x: 0, y: 0 }, kind: 'elderlyRobbed' };
    expect(incidentLines(s, 'en cours')[1]).toMatchObject({ status: 'perdu', time: '' });
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

  test('a wave announcement does not sound the incident alarm (waves are frequent)', async () => {
    const { GameAudio } = await import('../../src/game/audio');
    const a = new GameAudio();
    const play = vi.spyOn(a, 'play').mockImplementation(() => undefined);
    a.onEvents([{ type: 'WaveAnnounced', index: 3, total: 5 }]);
    a.onEvents([{ type: 'WaveAnnounced', index: 3, total: 5 }]);
    a.onEvents([{ type: 'WaveAnnounced', index: 4, total: 7 }]);
    expect(play.mock.calls.filter((c) => c[0] === 'alarm')).toHaveLength(0);
  });
});

describe('GameAudio.onEvents', () => {
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
  test('wave number alone without an objective, else « Vague N : K/T casseurs »', () => {
    expect(waveLine(snap())).toBe('Vague 1');
    expect(waveLine(snap((x) => { x.wave = 3; x.waveTotal = 9; x.waveKos = 4; }))).toBe('Vague 3 : 4/9 casseurs');
    expect(waveLine(snap((x) => { x.wave = 7; x.waveTotal = 1; x.waveKos = 0; }))).toBe('Vague 7 : 0/1 casseur');
  });
});

describe('weaponLine', () => {
  test('bare hands, then weapon name and strikes left', () => {
    expect(weaponLine(snap())).toBe('Arme : mains nues');
    expect(weaponLine(snap((x) => { x.weapon = { kind: 'panneau', uses: 3 }; }))).toBe('Arme : Panneau (3)');
  });
});
