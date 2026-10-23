import { t, type Key } from '../../content/i18n';
import { CONFIG } from '../../sim/config';
import type { Snapshot } from '../../sim/sim';
import { energyRefusedHint, energyView, itemsLine, roundValue, waveLine, weaponValue } from './format';
import { aria, el, statRow, type Cache, type StatRow } from './hudDom';

const SLOTS = CONFIG.rock.maxCarried;

/** The score list (top-left, pixel font) and its rows: score, KOs, round, rocks, weapon, energy gauge, belongings. */
export class StatsPanel {
  /** Score list (top-left, pixel font): one row per stat, in order. */
  readonly list = el('ul', 'bb-stats');
  // « SCORE » is the same word in both languages
  private readonly score = statRow('score', 'SCORE');
  private readonly kos = statRow('kos', t('hud.stat.kos'));
  private readonly wave = statRow('wave', t('hud.stat.wave'));
  private readonly rocks = statRow('rocks minor', t('hud.stat.rocks'));
  private readonly weapon = statRow('weapon minor', t('hud.stat.weapon'));
  /** The energy gauge: a segmented pixel bar (a tick at 50 %; the bar's end is 100 %) and what it allows (« C · Onde », « R · Furie »). */
  private readonly energy = statRow('energy minor', t('hud.stat.energy'));
  private readonly energyBar = el('span', 'ebar');
  private readonly energyFill = el('span', 'efill');
  private readonly energyTag = el('span', 'etag');
  /** Gauge value last shown (the bar pops when it goes up). */
  private lastEnergy = Number.NaN;
  /** Belongings Paul carries back to the rescue victim (hidden when none). */
  private readonly items = statRow('items minor', t('hud.stat.items'));
  private readonly slots: HTMLElement[] = [];
  /** Round number last shown (the row pulses once when it changes). */
  private lastWave = -1;
  /** Score last shown (its value pops when it goes up). */
  private lastScore = Number.NaN;

  constructor(private readonly c: Cache) {
    for (let i = 0; i < SLOTS; i++) {
      const slot = el('span', 'slot', '○');
      this.slots.push(slot);
      this.rocks.val.append(slot);
    }
    this.items.li.hidden = true;
    this.score.val.addEventListener('animationend', () => this.score.val.classList.remove('pop'));
    this.energyBar.setAttribute('aria-hidden', 'true');
    this.energyBar.append(this.energyFill, el('i', 'tick t50'));
    this.energyBar.addEventListener('animationend', () => this.energyBar.classList.remove('pop'));
    this.energy.val.append(this.energyBar, this.energyTag);
    this.list.setAttribute('aria-label', t('hud.stats.aria'));
    this.list.append(...[this.score, this.kos, this.wave, this.rocks, this.weapon, this.energy, this.items].map((r) => r.li));
  }

  /** Rewrites the labels in the current locale (the values follow on the next update). */
  relabel(): void {
    const rows: [StatRow, Key][] = [
      [this.kos, 'hud.stat.kos'],
      [this.wave, 'hud.stat.wave'],
      [this.rocks, 'hud.stat.rocks'],
      [this.weapon, 'hud.stat.weapon'],
      [this.energy, 'hud.stat.energy'],
      [this.items, 'hud.stat.items'],
    ];
    for (const [row, key] of rows) row.lbl.textContent = t(key);
    this.list.setAttribute('aria-label', t('hud.stats.aria'));
  }

  /** The score list: values, the score pop (only when it goes up) and the round pulse (when the round changes). */
  update(s: Snapshot): void {
    const c = this.c;
    c.text(this.score.val, String(s.score));
    if (s.score !== this.lastScore) {
      const up = s.score > this.lastScore; // false on the first frame (NaN)
      this.lastScore = s.score;
      // restart the stepped pop (CSS, off under prefers-reduced-motion); a drop clears it
      this.score.val.classList.remove('pop');
      if (up) {
        void this.score.val.offsetWidth;
        this.score.val.classList.add('pop');
      }
    }
    c.text(this.kos.val, String(s.kos));
    aria(this.kos.li, t('hud.kos.aria', { n: s.kos }));
    c.text(this.wave.val, roundValue(s));
    aria(this.wave.li, waveLine(s));
    if (s.round !== this.lastWave) {
      if (this.lastWave >= 0) {
        // restart the stepped pulse (CSS, off under prefers-reduced-motion)
        this.wave.li.classList.remove('pulse');
        void this.wave.li.offsetWidth;
        this.wave.li.classList.add('pulse');
      }
      this.lastWave = s.round;
    }
    this.slots.forEach((slot, i) => c.text(slot, i < s.carried ? '●' : '○'));
    aria(this.rocks.li, t('hud.rocks.aria', { n: s.carried, max: SLOTS }));
    c.text(this.weapon.val, weaponValue(s));
    this.weapon.li.classList.toggle('furie', s.furie !== null);
    const items = itemsLine(s);
    this.items.li.hidden = items === null;
    c.text(this.items.val, String(s.carriedItems));
  }

  /** The ÉNERGIE row: bar width, a pop when it fills, the state class and the refusal hint (`refused`). */
  updateEnergy(s: Snapshot, touch: boolean, refused: boolean): void {
    const c = this.c;
    const v = energyView(s, touch);
    c.style(this.energyFill, `width:${v.pct.toFixed(1)}%`);
    c.cls(this.energy.li, `row energy minor st-${v.state}${refused ? ' refused' : ''}`);
    c.text(this.energyTag, refused ? energyRefusedHint() : v.tag);
    aria(this.energy.li, v.aria);
    if (s.energy.value !== this.lastEnergy) {
      const up = s.energy.value > this.lastEnergy; // false on the first frame (NaN)
      this.lastEnergy = s.energy.value;
      if (up) {
        this.energyBar.classList.remove('pop');
        void this.energyBar.offsetWidth;
        this.energyBar.classList.add('pop');
      }
    }
  }
}
