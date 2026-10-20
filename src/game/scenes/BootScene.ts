import Phaser from 'phaser';
import { BASE, CHAR_SHEETS, SFX, type CharLayout } from '../assets';
import { provideSfx, type Sfx } from '../audio';
import { hideLoading, showMessage, showProgress } from '../loadingUi';
import { createCharAnims } from '../render/actors';

const SFX_PREFIX = 'sfx:';
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
    createCharAnims(this, layout);
    hideLoading();
    this.scene.start('world');
  }
}
