import type { Snapshot } from '../../sim/sim';
import type { Vec } from '../../sim/types';
import { alarmPeriodMs } from '../render/actionHintMath';
import {
  bearingDeg,
  edgePosition,
  GUIDE_LOOK,
  formatMeters,
  incidentAlert,
  incidentLook,
  pixelSvg,
  setArrow,
  type Box,
  type GuideMark,
  type Incident,
} from './alerts';
import { el, type Cache } from './hudDom';

export interface CameraView {
  /** World coordinates of the top-left corner of the visible area. */
  x: number;
  y: number;
  zoom: number;
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
}

/** Half-size (px) of an edge indicator and its distance from the screen border. */
const EDGE_HALF: Vec = { x: 84, y: 26 };
const EDGE_PAD = 8;

interface Edge {
  root: HTMLElement;
  arrow: HTMLElement;
  dist: HTMLElement;
}

/** The edge indicators inside `.bb-edges`: one per active incident and one per repair guide, while off-screen. */
export class EdgeMarkers {
  private readonly edgeEls = new Map<string, Edge>();
  private readonly guideEls = new Map<string, Edge>();

  constructor(
    private readonly edges: HTMLElement,
    private readonly c: Cache,
  ) {}

  /**
   * One pixel indicator per active incident, at the screen edge toward it, only while it is off-screen. A target under
   * attack pulses faster as its health falls (--pulse).
   */
  updateEdges(list: Incident[], s: Snapshot, view: CameraView, avoid: Box[]): void {
    const seen = new Set<string>();
    for (const inc of list) {
      const screen = { x: (inc.pos.x - view.x) * view.zoom, y: (inc.pos.y - view.y) * view.zoom };
      const at = edgePosition(screen, view, EDGE_HALF, EDGE_PAD, avoid);
      if (!at) continue;
      seen.add(inc.id);
      const e = this.edge(inc);
      const t = s.targets.find((x) => x.id === inc.id);
      const pulse = t ? `;--pulse:${alarmPeriodMs(t.hp / t.maxHp)}ms` : '';
      this.c.style(e.root, `left:${at.x}px;top:${at.y}px${pulse}`);
      setArrow(e.arrow, bearingDeg(at, screen));
      this.c.text(e.dist, formatMeters(s.player.pos, inc.pos));
    }
    for (const [id, e] of this.edgeEls) {
      if (seen.has(id)) continue;
      e.root.remove();
      this.edgeEls.delete(id);
    }
  }

  /** Repair guidance (guideMarks): the ruins to rebuild or the toolboxes to fetch, at the screen edge while off-screen. */
  updateGuides(list: GuideMark[], s: Snapshot, view: CameraView, avoid: Box[]): void {
    const seen = new Set<string>();
    for (const g of list) {
      const screen = { x: (g.pos.x - view.x) * view.zoom, y: (g.pos.y - view.y) * view.zoom };
      const at = edgePosition(screen, view, EDGE_HALF, EDGE_PAD, avoid);
      if (!at) continue;
      seen.add(g.id);
      let e = this.guideEls.get(g.id);
      if (!e) {
        const look = GUIDE_LOOK[g.kind];
        const root = el('div', `bb-guide k-${g.kind}`);
        const arrow = el('span', 'arrow');
        const ico = el('span', 'ico');
        ico.innerHTML = pixelSvg(look.icon, 2);
        const txt = el('span', 'txt');
        const dist = el('span', 'dist');
        txt.append(el('b', 'lbl', look.label), dist);
        root.append(arrow, ico, txt);
        this.edges.append(root);
        e = { root, arrow, dist };
        this.guideEls.set(g.id, e);
      }
      this.c.style(e.root, `left:${at.x}px;top:${at.y}px`);
      setArrow(e.arrow, bearingDeg(at, screen));
      this.c.text(e.dist, formatMeters(s.player.pos, g.pos));
    }
    for (const [id, e] of this.guideEls) {
      if (seen.has(id)) continue;
      e.root.remove();
      this.guideEls.delete(id);
    }
  }

  /** Removes every indicator (they are rebuilt, in the current locale, on the next update). */
  clear(): void {
    for (const e of [...this.edgeEls.values(), ...this.guideEls.values()]) e.root.remove();
    this.edgeEls.clear();
    this.guideEls.clear();
  }

  private edge(inc: Incident): Edge {
    const key = inc.id;
    const spec = incidentAlert(inc.kind);
    const look = incidentLook(inc.kind, inc.burning);
    let e = this.edgeEls.get(key);
    if (e && (e.root.dataset.kind !== inc.kind || e.root.dataset.tone !== look.tone)) {
      e.root.remove();
      e = undefined;
    }
    if (e) return e;
    const root = el('div', `bb-edge tone-${look.tone}`);
    root.dataset.kind = inc.kind;
    root.dataset.tone = look.tone;
    const arrow = el('span', 'arrow');
    const ico = el('span', 'ico');
    ico.innerHTML = pixelSvg(look.icon, 2);
    const txt = el('span', 'txt');
    const dist = el('span', 'dist');
    txt.append(el('b', 'lbl', spec.label), dist);
    root.append(arrow, ico, txt);
    this.edges.append(root);
    e = { root, arrow, dist };
    this.edgeEls.set(key, e);
    return e;
  }
}
