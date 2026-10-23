/// <reference types="vite/client" />
import Phaser from 'phaser';
import { t } from '../content/i18n';
import { hasWebGL, showMessage, showProgress } from './loadingUi';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';

function start(): void {
  if (!hasWebGL()) {
    showMessage(t('world.boot.noWebgl'), false);
    return;
  }
  showProgress(0);
  try {
    const game = new Phaser.Game({
      type: Phaser.WEBGL,
      parent: 'game',
      pixelArt: true,
      roundPixels: true,
      backgroundColor: '#14121c',
      // Sound is raw WebAudio in GameAudio (one context, created on Commencer): no Phaser sound manager.
      audio: { noAudio: true },
      // RESIZE: canvas = container size in CSS px (no CSS stretching, resolution 1); WorldScene zooms by integers.
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: '100%',
        height: '100%',
      },
      scene: [BootScene, WorldScene],
    });
    // dev-only handle for debugging in the console
    if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
  } catch (err) {
    console.error(err);
    showMessage(t('world.boot.noWebgl'), false);
  }
}

start();
