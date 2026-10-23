import { controlsFor, rulesFor, satireNoticeFor } from '../../content/controls';
import { onLocaleChange, t } from '../../content/i18n';
import type { SummaryData } from './format';
import { SITE_BASE } from '../assets';
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

type Panel = 'start' | 'pause' | 'help' | 'credits' | 'confirm' | 'summary' | 'controls';

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
  /** The summary on screen, rebuilt when the language changes. */
  private summary: () => SummaryData = () => ({ title: '', newRecord: false, rows: [] });
  /** Rebuilds the open panel in the new language, focus kept on the same control. */
  private readonly offLocale = onLocaleChange(() => this.rerender());

  constructor(
    parent: HTMLElement,
    private readonly act: MenuActions,
    private muted: boolean,
  ) {
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
    this.offLocale();
    this.root.remove();
  }

  private rerender(): void {
    const panel = this.panel;
    if (panel === null) return;
    const items = [...this.root.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (panel === 'start') this.showStart();
    else if (panel === 'controls') this.showControls();
    else if (panel === 'pause') this.showPause();
    else if (panel === 'help') this.showHelp();
    else if (panel === 'credits') this.showCredits();
    else if (panel === 'confirm') this.showConfirm();
    else this.showSummary(this.summary);
    if (at >= 0) this.root.querySelectorAll<HTMLElement>(FOCUSABLE)[at]?.focus();
  }

  close(): void {
    this.panel = null;
    this.root.hidden = true;
    this.root.replaceChildren();
  }

  /** Esc: dialogs go back to the pause menu, the pause menu and the Commandes modal resume; start and summary ignore it. */
  escape(): void {
    if (this.panel === 'pause' || this.panel === 'controls') this.act.resume();
    else if (this.panel === 'help' || this.panel === 'credits' || this.panel === 'confirm') this.showPause(this.panel);
  }

  showStart(): void {
    const p = this.begin('start', 'BreakBreaker');
    p.append(h('p', 'notice', satireNoticeFor()));
    const row = h('div', 'row');
    row.append(
      this.btn(t('hud.menu.start'), () => this.act.start(), 'primary'),
      this.sound(),
      this.btn(t('hud.menu.backToSite'), () => this.act.leave()),
    );
    p.append(row, h('h2', '', t('hud.menu.rules')), this.rules(), h('h2', '', t('hud.menu.controls')), this.controls());
    this.end(t('hud.menu.start'));
  }

  /** "Commandes" modal opened from the HUD button: keys and rules, closes straight back into the game. */
  showControls(): void {
    const p = this.begin('controls', t('hud.menu.controls'));
    const close = t('hud.menu.close');
    // Fermer first: it takes the focus, so the modal opens at its top rather than scrolled to its end.
    p.append(
      this.btn(close, () => this.act.resume(), 'primary'),
      this.controls(),
      h('h2', '', t('hud.menu.rules')),
      this.rules(),
      this.btn(close, () => this.act.resume()),
    );
    this.end(close);
  }

  showPause(from?: Panel): void {
    const p = this.begin('pause', t('hud.menu.pause'));
    const col = h('div', 'col');
    col.append(
      this.btn(t('hud.menu.resume'), () => this.act.resume(), 'primary'),
      this.sound(),
      this.btn(t('hud.menu.help'), () => this.showHelp()),
      this.btn(t('hud.menu.credits'), () => this.showCredits()),
      this.btn(t('hud.menu.backToSite'), () => this.showConfirm()),
      this.btn(t('hud.menu.stop'), () => this.act.stopGame()),
    );
    p.append(col);
    const back =
      from === 'help' ? 'hud.menu.help' : from === 'credits' ? 'hud.menu.credits' : from === 'confirm' ? 'hud.menu.backToSite' : null;
    this.end(t(back ?? 'hud.menu.resume'));
  }

  private showHelp(): void {
    const p = this.begin('help', t('hud.menu.help'));
    p.append(
      h('h2', '', t('hud.menu.rules')),
      this.rules(),
      h('h2', '', t('hud.menu.controls')),
      this.controls(),
      this.btn(t('hud.menu.back'), () => this.showPause('help')),
    );
    this.end(t('hud.menu.back'));
  }

  private showCredits(): void {
    const p = this.begin('credits', t('hud.menu.credits'));
    const body = h('div', 'md');
    body.tabIndex = 0;
    body.setAttribute('role', 'region');
    body.setAttribute('aria-label', t('hud.menu.credits'));
    p.append(
      body,
      this.btn(t('hud.menu.back'), () => this.showPause('credits')),
    );
    this.end(t('hud.menu.back'));
    const fill = (html: string): void => {
      if (this.panel === 'credits') body.innerHTML = html;
    };
    if (this.credits !== null) return fill(this.credits);
    body.textContent = t('hud.menu.loading');
    fetch(`${SITE_BASE}CREDITS.md`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((md) => {
        this.credits = renderMarkdown(md);
        fill(this.credits);
      })
      .catch(() => {
        body.textContent = t('hud.menu.creditsError');
      });
  }

  private showConfirm(): void {
    const p = this.begin('confirm', t('hud.menu.backToSite'), 'alertdialog');
    p.append(h('p', '', t('hud.menu.confirmText')));
    const row = h('div', 'row');
    row.append(
      this.btn(t('hud.menu.continue'), () => this.showPause('confirm'), 'primary'),
      this.btn(t('hud.menu.quit'), () => this.act.leave()),
    );
    p.append(row);
    this.end(t('hud.menu.continue'));
  }

  /** The end screen; pass a function to have it rebuilt (texts recomputed) when the language changes. */
  showSummary(source: SummaryData | (() => SummaryData)): void {
    this.summary = typeof source === 'function' ? source : () => source;
    const data = this.summary();
    const p = this.begin('summary', t('hud.menu.summary'));
    const dl = h('dl', 'summary');
    const add = (k: string, v: string): void => {
      dl.append(h('dt', '', k), h('dd', '', v));
    };
    add(t('hud.menu.cause'), data.title);
    for (const r of data.rows) add(r.label, r.value);
    p.append(dl);
    if (data.newRecord) p.append(h('p', 'record', t('hud.menu.newRecord')));
    const row = h('div', 'row');
    row.append(
      this.btn(t('hud.menu.replay'), () => this.act.replay(), 'primary'),
      this.btn(t('hud.menu.backToSite'), () => this.act.leave()),
    );
    p.append(row);
    this.end(t('hud.menu.replay'));
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
    const head = h('h1', '', title);
    head.id = 'bb-title';
    p.setAttribute('aria-labelledby', 'bb-title');
    p.append(head);
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
    this.soundBtn.textContent = t(this.muted ? 'hud.menu.soundOff' : 'hud.menu.soundOn');
    this.soundBtn.setAttribute('aria-pressed', String(!this.muted));
  }

  private rules(): HTMLElement {
    const ul = h('ul', 'rules');
    for (const r of rulesFor()) ul.append(h('li', '', r));
    return ul;
  }

  private controls(): HTMLElement {
    const wrap = h('div', 'controls');
    for (const c of controlsFor()) {
      const row = h('div', 'ctl');
      const kb = h('div', '');
      kb.append(h('span', 'dev', t('hud.menu.keyboard')), document.createTextNode(c.keyboard));
      const touch = h('div', '');
      touch.append(h('span', 'dev', t('hud.menu.touch')), document.createTextNode(c.touch));
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
