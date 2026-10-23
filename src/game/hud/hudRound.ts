import type { RoundPanel } from './format';
import { el, type Cache } from './hudDom';

/** The round panel's nodes; `objKey` is the objectives list last written (rebuilt only when it changes). */
export interface RoundEls {
  root: HTMLElement;
  title: HTMLElement;
  kos: HTMLElement;
  obj: HTMLElement;
  points: HTMLElement;
  bonus: HTMLElement;
  heals: HTMLElement;
  count: HTMLElement;
  objKey: string;
}

export function makeRound(): RoundEls {
  const root = el('div', 'bb-round');
  root.setAttribute('role', 'status');
  root.hidden = true;
  const r: RoundEls = {
    root,
    title: el('b', 'title'),
    kos: el('span', 'kos'),
    obj: el('ul', 'obj'),
    points: el('span', 'points'),
    bonus: el('span', 'bonus'),
    heals: el('span', 'heals'),
    count: el('span', 'count'),
    objKey: '',
  };
  const score = el('div', 'score');
  score.append(r.points, r.bonus);
  root.append(r.title, r.kos, r.obj, score, r.heals, r.count);
  return r;
}

/** Writes `p` into the round panel (hides it when null); true when the panel shows (the caller then places it). */
export function renderRound(c: Cache, r: RoundEls, p: RoundPanel | null): boolean {
  if (!p) {
    r.root.hidden = true;
    return false;
  }
  if (r.root.hidden) {
    r.root.hidden = false;
    // restart the stepped entry animation
    r.root.classList.remove('in');
    void r.root.offsetWidth;
    r.root.classList.add('in');
  }
  c.text(r.title, p.title);
  c.text(r.kos, p.kos);
  const key = p.objectives.map((o) => `${o.name}:${o.result}`).join('|');
  if (key !== r.objKey) {
    r.objKey = key;
    r.obj.replaceChildren(
      ...p.objectives.map((o) => {
        const li = el('li', o.result === 'réussi' ? 'ok' : 'bad');
        li.append(`${o.name} : `, el('b', '', o.result));
        return li;
      }),
    );
  }
  c.text(r.points, p.points);
  r.bonus.hidden = !p.bonus;
  c.text(r.bonus, p.bonus ?? '');
  c.text(r.heals, p.heals);
  c.text(r.count, p.countdown);
  return true;
}
