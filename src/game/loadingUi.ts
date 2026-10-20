/** HTML loading overlay shown over the game container while BootScene loads (removed once the world starts). */
let root: HTMLDivElement | null = null;
let bar: HTMLDivElement | null = null;

const STYLE = `
#bb-loading{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
gap:12px;background:#14121c;color:#e8e4f0;font:16px system-ui,sans-serif;z-index:10;text-align:center;padding:16px}
#bb-loading .track{width:min(320px,80vw);height:10px;border:1px solid #6b6680;border-radius:5px;overflow:hidden}
#bb-loading .fill{height:100%;width:0;background:#e8e4f0;transition:width .1s}
#bb-loading button{font:inherit;min-height:44px;padding:0 20px;border-radius:6px;border:1px solid #e8e4f0;
background:#2a2638;color:#e8e4f0;cursor:pointer}
`;

function ensure(): HTMLDivElement {
  if (root) return root;
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);
  root = document.createElement('div');
  root.id = 'bb-loading';
  root.setAttribute('role', 'status');
  document.body.appendChild(root);
  return root;
}

export function showProgress(p: number): void {
  const r = ensure();
  if (!bar) {
    r.innerHTML = '<p>Chargement…</p><div class="track"><div class="fill"></div></div>';
    bar = r.querySelector('.fill');
  }
  if (bar) bar.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
}

/** Fatal message; with `retry` a `Réessayer` button reloads the page. */
export function showMessage(text: string, retry: boolean): void {
  const r = ensure();
  bar = null;
  r.setAttribute('role', 'alert');
  r.textContent = '';
  const msg = document.createElement('p');
  msg.textContent = text;
  r.appendChild(msg);
  if (retry) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Réessayer';
    b.addEventListener('click', () => location.reload());
    r.appendChild(b);
  }
}

export function hideLoading(): void {
  root?.remove();
  root = null;
  bar = null;
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}
