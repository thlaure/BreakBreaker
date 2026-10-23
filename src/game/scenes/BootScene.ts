import Phaser from 'phaser';
import { BASE, CHAR_SHEETS, SFX, type CharLayout } from '../assets';
import { provideSfx, type Sfx } from '../audio';
import { hideLoading, showMessage, showProgress } from '../loadingUi';
import { createCharAnims } from '../render/actors';
import { makeCaidSheets } from '../render/caidSheets';

const SFX_PREFIX = 'sfx:';
/** Never wait longer than this for the pixel font (the game starts anyway with the monospace fallback). */
const FONT_WAIT_MS = 2000;

/** Resolves once 'Press Start 2P' (declared in hud.css) is loaded, after FONT_WAIT_MS, or on failure. */
export function waitForPixelFont(timeoutMs = FONT_WAIT_MS): Promise<void> {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts?.load) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    const done = (): void => {
      clearTimeout(timer);
      resolve();
    };
    fonts.load('8px "Press Start 2P"').then(done, done);
  });
}
const sfxKey = (key: Sfx): string => SFX_PREFIX + key;

/** Loads every asset, drives the HTML progress bar, builds the character animations, then starts the world. */
export class BootScene extends Phaser.Scene {
  private failed: string[] = [];

  constructor() {
    super('boot');
  }

  preload(): void {
    this.load.on('progress', (p: number) => showProgress(p));
    this.load.on('loaderror', (file: Phaser.Loader.File) => this.failed.push(file.key));

    this.load.json('layout', `${BASE}chars/layout.json`);
    for (const key of CHAR_SHEETS) this.load.spritesheet(key, `${BASE}chars/${key}.png`, { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('streets', `${BASE}tiles/streets.png`, { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('urban', `${BASE}tiles/urban.png`, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('city', `${BASE}tiles/city.png`, { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('flags', `${BASE}props/flags.png`, { frameWidth: 16, frameHeight: 12 });
    // Raw bytes only (Phaser audio is disabled): one fetch per sound, counted by the progress bar.
    // GameAudio decodes them in its own AudioContext once Commencer unlocks audio.
    for (const key of SFX) this.load.binary(sfxKey(key), `${BASE}sfx/${key}.ogg`);
  }

  create(): void {
    const layout = this.cache.json.get('layout') as CharLayout | undefined;
    const fatal = this.failed.filter((k) => !k.startsWith(SFX_PREFIX));
    if (this.failed.length > fatal.length) console.warn('Sounds failed to load (game continues):', this.failed);
    const sounds: [Sfx, ArrayBuffer][] = [];
    for (const key of SFX) {
      const data: unknown = this.cache.binary.get(sfxKey(key));
      if (data instanceof ArrayBuffer) sounds.push([key, data]);
      this.cache.binary.remove(sfxKey(key));
    }
    provideSfx(sounds);
    if (fatal.length > 0 || !layout) {
      console.error('Assets failed to load:', fatal);
      showMessage('Le chargement a échoué. Vérifie ta connexion.', true);
      return;
    }
    // the five Caïd looks are painted over loaded sheets, then animated like every character sheet
    makeCaidSheets(this);
    createCharAnims(this, layout);
    // Phaser text (victim bubbles) is drawn with the pixel font: wait for it (bounded) before starting the world.
    void waitForPixelFont().then(() => {
      hideLoading();
      this.scene.start('world');
    });
  }
}
