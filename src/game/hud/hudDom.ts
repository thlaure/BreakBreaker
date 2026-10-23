export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export interface StatRow {
  li: HTMLElement;
  /** The small label (rewritten when the language changes). */
  lbl: HTMLElement;
  val: HTMLElement;
}

/** One row of the score list: small muted label, big bright value. */
export function statRow(cls: string, label: string): StatRow {
  const li = el('li', `row ${cls}`);
  const val = el('span', 'val');
  const lbl = el('span', 'lbl', label);
  li.append(lbl, val);
  return { li, lbl, val };
}

export function aria(node: HTMLElement, label: string): void {
  if (node.getAttribute('aria-label') !== label) node.setAttribute('aria-label', label);
}

/** Writes to the DOM only when the value changed. */
export class Cache {
  private readonly texts = new WeakMap<HTMLElement, string>();
  private readonly classes = new WeakMap<HTMLElement, string>();
  private readonly styles = new WeakMap<HTMLElement, string>();
  text(node: HTMLElement, value: string): void {
    if (this.texts.get(node) === value) return;
    this.texts.set(node, value);
    node.textContent = value;
  }
  cls(node: HTMLElement, value: string): void {
    if (this.classes.get(node) === value) return;
    this.classes.set(node, value);
    node.className = value;
  }
  style(node: HTMLElement, css: string): void {
    if (this.styles.get(node) === css) return;
    this.styles.set(node, css);
    node.style.cssText = css;
  }
}
