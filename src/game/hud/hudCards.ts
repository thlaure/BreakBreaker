import { CONFIG } from '../../sim/config';
import type { Snapshot } from '../../sim/sim';
import { incidentLook, pixelSvg, type AlertIcon } from './alerts';
import { statusText, type IncidentLine } from './format';
import { el, type Cache } from './hudDom';

const TILE = CONFIG.tile;

export interface Card {
  root: HTMLElement;
  ico: HTMLElement;
  name: HTMLElement;
  time: HTMLElement;
  /** Mini health bar of an attacked target (hidden for the rescue). */
  bar: HTMLElement;
  fill: HTMLElement;
  status: HTMLElement;
  /** Rescue belongings progress (« Objets 1/3 rendus »), hidden otherwise. */
  items: HTMLElement;
  dist: HTMLElement;
}

export function makeCard(): Card {
  const root = el('div', 'bb-card');
  const bar = el('span', 'hpbar');
  const fill = el('span', 'fill');
  bar.append(fill);
  bar.setAttribute('aria-hidden', 'true');
  const c: Card = {
    root,
    ico: el('span', 'ico'),
    name: el('b', 'name'),
    time: el('span', 'time'),
    bar,
    fill,
    status: el('span', 'status'),
    items: el('span', 'items'),
    dist: el('span', 'dist'),
  };
  c.items.hidden = true;
  root.append(c.ico, c.name, bar, c.time, c.status, c.items, c.dist);
  return c;
}

export function renderCard(c: Cache, card: Card, line: IncidentLine, s: Snapshot): void {
  const slug = line.status.replace(/\s/g, '-');
  c.cls(card.root, `bb-card k-${line.kind} st-${slug}`);
  const target = line.hp !== null && line.kind !== 'flag';
  const icon: AlertIcon = incidentLook(line.kind, target ? line.status === 'en feu' : undefined).icon;
  if (card.ico.dataset.icon !== icon) {
    card.ico.dataset.icon = icon;
    card.ico.innerHTML = pixelSvg(icon, 1);
  }
  c.text(card.name, line.name);
  c.text(card.time, line.time);
  card.bar.hidden = line.hp === null;
  if (line.hp !== null) {
    c.style(card.fill, `width:${line.hp.toFixed(0)}%`);
    // a target's health turns red when low; the flag's capture bar fills up (no alarm colour)
    c.cls(card.fill, line.kind === 'flag' ? 'fill capture' : line.hp <= 30 ? 'fill low' : 'fill');
  }
  c.text(card.status, statusText(line.status));
  card.items.hidden = line.items === null;
  c.text(card.items, line.items ?? '');
  const tiles = Math.round(Math.hypot(line.target.x - s.player.pos.x, line.target.y - s.player.pos.y) / TILE);
  c.text(card.dist, `${tiles} m`);
}
