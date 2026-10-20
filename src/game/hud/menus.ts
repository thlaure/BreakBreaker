import { CONTROLS, RULES, SATIRE_NOTICE } from '../../content/controls';
import type { SummaryData } from './format';
import { renderMarkdown } from './markdown';

export interface MenuActions {
  start(): void;
  resume(): void;
  /** Toggles the sound pref and returns the new `muted` value. */
  toggleSound(): boolean;
  /** Arrêter la partie. */
  stopGame(): void;
  /** Leaves to the landing page (after the in-game confirmation, when a game is running). */
  leave(): void;
  replay(): void;
  click(): void;
}

type Panel = 'start' | 'pause' | 'help' | 'credits' | 'confirm' | 'summary';

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

const FOCUSABLE = 'button, a[href], [tabindex="0"]';

/** Modal HTML overlay: one panel at a time, real buttons, focus moved in and trapped, Esc goes back / resumes. */
export class Menus {
  readonly root = h('div', 'bb-overlay');
  private panel: Panel | null = null;
  private soundBtn: HTMLButtonElement | null = null;
  private credits: string | null = null;

  constructor(parent: HTMLElement, private readonly act: MenuActions, private muted: boolean) {
    this.root.hidden = true;
    this.root.addEventListener('keydown', (e) => this.keydown(e));
    this.root.addEventListener('click', (e) => {
      if ((e.target as Element).closest('button')) this.act.click();
    });
    parent.append(this.root);
  }

  get open(): Panel | null {
    return this.panel;
  }

  destroy(): void {
    this.root.remove();
  }

  close(): void {
    this.panel = null;
    this.root.hidden = true;
    this.root.replaceChildren();
  }

  /** Esc: dialogs go back to the pause menu, the pause menu resumes; start and summary ignore it. */
  escape(): void {
    if (this.panel === 'pause') this.act.resume();
    else if (this.panel === 'help' || this.panel === 'credits' || this.panel === 'confirm') this.showPause(this.panel);
  }

  showStart(): void {
    const p = this.begin('start', 'BreakBreaker');
    p.append(h('p', 'notice', SATIRE_NOTICE));
    const row = h('div', 'row');
    row.append(this.btn('Commencer', () => this.act.start(), 'primary'), this.sound(), this.btn('Retour au site', () => this.act.leave()));
    p.append(row, h('h2', '', 'Règles'), this.rules(), h('h2', '', 'Commandes'), this.controls());
    this.end('Commencer');
  }

  showPause(from?: Panel): void {
    const p = this.begin('pause', 'Pause');
    const col = h('div', 'col');
    col.append(
      this.btn('Reprendre', () => this.act.resume(), 'primary'),
      this.sound(),
      this.btn('Aide', () => this.showHelp()),
      this.btn('Crédits', () => this.showCredits()),
      this.btn('Retour au site', () => this.showConfirm()),
      this.btn('Arrêter la partie', () => this.act.stopGame()),
    );
    p.append(col);
    this.end(from === 'help' ? 'Aide' : from === 'credits' ? 'Crédits' : from === 'confirm' ? 'Retour au site' : 'Reprendre');
  }

  private showHelp(): void {
    const p = this.begin('help', 'Aide');
    p.append(h('h2', '', 'Règles'), this.rules(), h('h2', '', 'Commandes'), this.controls(), this.btn('Retour', () => this.showPause('help')));
    this.end('Retour');
  }

  private showCredits(): void {
    const p = this.begin('credits', 'Crédits');
    const body = h('div', 'md');
    body.tabIndex = 0;
    body.setAttribute('role', 'region');
    body.setAttribute('aria-label', 'Crédits');
    p.append(body, this.btn('Retour', () => this.showPause('credits')));
    this.end('Retour');
    const fill = (html: string): void => {
      if (this.panel === 'credits') body.innerHTML = html;
    };
    if (this.credits !== null) return fill(this.credits);
    body.textContent = 'Chargement…';
    fetch('/CREDITS.md')
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => {
        this.credits = renderMarkdown(t);
        fill(this.credits);
      })
      .catch(() => {
        body.textContent = 'Crédits indisponibles pour le moment. Ils sont consultables dans le fichier CREDITS.md du site.';
      });
  }

  private showConfirm(): void {
    const p = this.begin('confirm', 'Retour au site', 'alertdialog');
    p.append(h('p', '', 'La partie en cours sera abandonnée.'));
    const row = h('div', 'row');
    row.append(this.btn('Continuer la partie', () => this.showPause('confirm'), 'primary'), this.btn('Quitter la partie', () => this.act.leave()));
    p.append(row);
    this.end('Continuer la partie');
  }

  showSummary(data: SummaryData): void {
    const p = this.begin('summary', 'Résumé de la partie');
    const dl = h('dl', 'summary');
    const add = (k: string, v: string): void => {
      dl.append(h('dt', '', k), h('dd', '', v));
    };
    add('Cause', data.title);
    for (const r of data.rows) add(r.label, r.value);
    p.append(dl);
    if (data.newRecord) p.append(h('p', 'record', 'Nouveau record !'));
    const row = h('div', 'row');
    row.append(this.btn('Rejouer', () => this.act.replay(), 'primary'), this.btn('Retour au site', () => this.act.leave()));
    p.append(row);
    this.end('Rejouer');
  }

  private begin(panel: Panel, title: string, role: 'dialog' | 'alertdialog' = 'dialog'): HTMLElement {
    this.panel = panel;
    this.soundBtn = null;
    this.root.replaceChildren();
    this.root.hidden = false;
    this.root.dataset.panel = panel;
    const p = h('div', 'bb-panel');
    p.setAttribute('role', role);
    p.setAttribute('aria-modal', 'true');
    const t = h('h1', '', title);
    t.id = 'bb-title';
    p.setAttribute('aria-labelledby', 'bb-title');
    p.append(t);
    this.root.append(p);
    return p;
  }

  /** Moves focus into the dialog: on the button with this label, else the first focusable element. */
  private end(focusLabel: string): void {
    const items = [...this.root.querySelectorAll<HTMLElement>(FOCUSABLE)];
    (items.find((b) => b.textContent === focusLabel) ?? items[0])?.focus();
    this.root.querySelector('.bb-panel')?.scrollTo?.(0, 0);
  }

  private btn(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
    const b = h('button', cls, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  private sound(): HTMLButtonElement {
    const b = this.btn('', () => {
      this.muted = this.act.toggleSound();
      this.paintSound();
    });
    this.soundBtn = b;
    this.paintSound();
    return b;
  }

  private paintSound(): void {
    if (!this.soundBtn) return;
    this.soundBtn.textContent = this.muted ? 'Son : coupé' : 'Son : activé';
    this.soundBtn.setAttribute('aria-pressed', String(!this.muted));
  }

  private rules(): HTMLElement {
    const ul = h('ul', 'rules');
    for (const r of RULES) ul.append(h('li', '', r));
    return ul;
  }

  private controls(): HTMLElement {
    const wrap = h('div', 'controls');
    for (const c of CONTROLS) {
      const row = h('div', 'ctl');
      const kb = h('div', '');
      kb.append(h('span', 'dev', 'Clavier / souris : '), document.createTextNode(c.keyboard));
      const touch = h('div', '');
      touch.append(h('span', 'dev', 'Tactile : '), document.createTextNode(c.touch));
      row.append(h('b', '', c.action), kb, touch);
      wrap.append(row);
    }
    return wrap;
  }

  private keydown(e: KeyboardEvent): void {
    // Menus own the keyboard while open: nothing reaches the game input (Space would otherwise strike and block button activation).
    e.stopPropagation();
    if (e.code === 'Escape') {
      e.preventDefault();
      if (!e.repeat) this.escape();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...this.root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => !n.hasAttribute('disabled'));
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (!this.root.contains(active)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
