import { getLocale, onLocaleChange, setLocale, t, type Locale } from '../../content/i18n';
import { flagSvg, type FlagId } from '../../site/flags';

const LANGS: readonly { locale: Locale; flag: FlagId; label: 'landing.flagFr' | 'landing.flagEn' }[] = [
  { locale: 'fr', flag: 'fr', label: 'landing.flagFr' },
  { locale: 'en', flag: 'us', label: 'landing.flagEn' },
];

/**
 * The language selector of the pause menu: the same two pixel flags as the landing page, as real buttons (>= 44 px
 * touch targets). The current language is in colour with an outline and `aria-current`, the other greyed. A click calls
 * setLocale (saved; the menus and HUD re-read their texts through onLocaleChange). Styled inline: no stylesheet needed.
 */
export function createLangSwitch(): HTMLElement {
  const group = document.createElement('div');
  group.className = 'bb-lang';
  group.setAttribute('role', 'group');
  Object.assign(group.style, { display: 'flex', gap: '8px', justifyContent: 'center' });

  const buttons = LANGS.map(({ locale, flag }) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.lang = locale;
    b.innerHTML = flagSvg(flag); // static markup built from our own data
    Object.assign(b.style, {
      minWidth: '48px',
      minHeight: '44px',
      padding: '0',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      border: '0',
      cursor: 'pointer',
    });
    b.addEventListener('click', () => {
      setLocale(locale);
      paint(); // also when the switch is not (yet) in the document
    });
    return b;
  });

  const paint = (): void => {
    const current = getLocale();
    group.setAttribute('aria-label', t('landing.langNav'));
    buttons.forEach((b, i) => {
      const on = LANGS[i]!.locale === current;
      b.setAttribute('aria-label', t(LANGS[i]!.label));
      if (on) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
      const svg = b.querySelector('svg');
      if (svg) {
        svg.style.filter = on ? 'none' : 'grayscale(1) brightness(0.8)';
        svg.style.opacity = on ? '1' : '0.55';
        svg.style.outline = on ? '2px solid #ffd166' : 'none';
        svg.style.outlineOffset = '2px';
      }
    });
  };

  // Follows changes made elsewhere while shown; stops listening once the pause panel that held it is rebuilt.
  const off = onLocaleChange(() => {
    if (!group.isConnected) off();
    else paint();
  });

  group.append(...buttons);
  paint();
  return group;
}
