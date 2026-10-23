import { onLocaleChange } from '../../content/i18n';
import type { Vec } from '../../sim/types';
import { bearingDeg, formatMeters } from './edgeMath';
import { incidentAlert, type Alert } from './incidents';
import { pixelSvg, setArrow } from './pixelIcons';

export * from './incidents';
export * from './edgeMath';
export * from './pixelIcons';

/* ---------- banner ---------- */

/** How long a banner stays on screen. */
export const ALERT_MS = 6000;
/** Alerts waiting behind the one on screen (older ones are dropped beyond this). */
const QUEUE_MAX = 3;

/**
 * Top-centre pixel banner announcing a new incident, round or special drop (role="alert"). One at a time; later ones queue and
 * show after. For a positioned alert the arrow and distance are refreshed by `track(playerPos)` while visible
 * (aria-hidden: not re-announced); a round start has neither.
 */
export class AlertBanner {
  readonly el: HTMLElement;
  private readonly ico: HTMLElement;
  private readonly title: HTMLElement;
  private readonly sub: HTMLElement;
  private readonly meta: HTMLElement;
  private readonly dir: HTMLElement;
  private readonly arrow: HTMLElement;
  private readonly dist: HTMLElement;
  private current: Alert | null = null;
  private readonly queue: Alert[] = [];
  /** Alerts pushed since the last `prune`: their incident may not show in the snapshot yet. */
  private readonly fresh = new Set<Alert>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastDist = '';
  /** Repaints the alert on screen in the new language (its timer and queue are kept). */
  private readonly offLocale = onLocaleChange(() => {
    if (this.current) this.paint(this.current);
  });

  constructor(parent: HTMLElement) {
    const mk = (tag: string, cls: string): HTMLElement => {
      const e = document.createElement(tag);
      e.className = cls;
      return e;
    };
    this.el = mk('div', 'bb-alert');
    this.el.setAttribute('role', 'alert');
    this.el.hidden = true;
    this.ico = mk('span', 'ico');
    const txt = mk('div', 'txt');
    this.title = mk('b', 'title');
    this.sub = mk('span', 'sub');
    this.meta = mk('span', 'meta');
    txt.append(this.title, this.sub, this.meta);
    const dir = mk('div', 'dir');
    dir.setAttribute('aria-hidden', 'true');
    this.dir = dir;
    this.arrow = mk('span', 'arrow');
    this.dist = mk('span', 'dist');
    dir.append(this.arrow, this.dist);
    this.el.append(this.ico, txt, dir);
    parent.append(this.el);
  }

  get shown(): Alert | null {
    return this.current;
  }

  push(incident: Alert): void {
    this.fresh.add(incident);
    if (this.current) {
      this.queue.push(incident);
      if (this.queue.length > QUEUE_MAX) this.queue.shift();
      return;
    }
    this.show(incident);
  }

  /** Live arrow (player → incident, 8 directions) and distance. */
  track(playerPos: Vec): void {
    const inc = this.current;
    if (!inc?.pos) return;
    setArrow(this.arrow, bearingDeg(playerPos, inc.pos), 3);
    const d = formatMeters(playerPos, inc.pos);
    if (d !== this.lastDist) {
      this.lastDist = d;
      this.dist.textContent = d;
    }
  }

  /**
   * Drops incident and drop alerts whose incident is no longer active (`active` = `activeIncidents` ids), queued or on
   * screen, so a banner never announces an urgency that is already over (e.g. during the breather) nor a weapon already
   * gone. Alerts pushed since the previous call are kept once (their start may not be in this snapshot yet); round
   * starts are never dropped.
   */
  prune(active: ReadonlySet<string>): void {
    const stale = (a: Alert): boolean => a.incident !== undefined && !active.has(a.incident) && !this.fresh.has(a);
    for (let i = this.queue.length - 1; i >= 0; i--) if (stale(this.queue[i]!)) this.queue.splice(i, 1);
    if (this.current && stale(this.current)) {
      if (this.timer) clearTimeout(this.timer);
      this.next();
    }
    this.fresh.clear();
  }

  clear(): void {
    this.fresh.clear();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.queue.length = 0;
    this.current = null;
    this.el.hidden = true;
  }

  destroy(): void {
    this.offLocale();
    this.clear();
    this.el.remove();
  }

  private show(incident: Alert): void {
    const spec = incidentAlert(incident.kind, incident.wave, incident.total, incident.headline);
    this.current = incident;
    // a danger shakes once on entry (CSS, off under prefers-reduced-motion)
    const danger = spec.tone === 'fire' || spec.tone === 'warn';
    this.el.className = `bb-alert tone-${spec.tone}${danger ? ' shake' : ''}`;
    this.ico.innerHTML = pixelSvg(spec.icon, 3);
    this.paint(incident);
    this.dir.hidden = !spec.positioned;
    this.lastDist = '';
    this.dist.textContent = '';
    this.el.hidden = false;
    this.timer = setTimeout(() => this.next(), spec.ms ?? ALERT_MS);
  }

  /** The banner's texts, in the current locale. */
  private paint(incident: Alert): void {
    const spec = incidentAlert(incident.kind, incident.wave, incident.total, incident.headline);
    this.title.textContent = spec.title;
    this.sub.textContent = spec.sub;
    this.sub.hidden = !spec.sub;
    this.meta.textContent = spec.meta;
    this.meta.hidden = !spec.meta;
  }

  private next(): void {
    this.timer = null;
    this.current = null;
    this.el.hidden = true;
    const n = this.queue.shift();
    if (!n) return;
    void this.el.offsetWidth; // restart the stepped entry animation
    this.show(n);
  }
}
