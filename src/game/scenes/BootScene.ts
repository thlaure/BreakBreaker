import Phaser from 'phaser';
import { BASE, CHAR_SHEETS, SFX, type CharLayout } from '../assets';
import { hideLoading, showMessage, showProgress } from '../loadingUi';
import { createCharAnims } from '../render/actors';

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
    // Playback is Task 14; loading them here keeps a single loading phase.
    for (const key of SFX) this.load.audio(key, `${BASE}sfx/${key}.ogg`);
  }

  create(): void {
    const layout = this.cache.json.get('layout') as CharLayout | undefined;
    const sfx: readonly string[] = SFX;
    const fatal = this.failed.filter((k) => !sfx.includes(k));
    if (this.failed.length > fatal.length) console.warn('Sounds failed to load (game continues):', this.failed);
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
