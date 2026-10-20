/// <reference types="vite/client" />
import Phaser from 'phaser';
import { hasWebGL, showMessage, showProgress } from './loadingUi';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';

const NO_WEBGL = 'Ce jeu nécessite WebGL.';

function start(): void {
  if (!hasWebGL()) {
    showMessage(NO_WEBGL, false);
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
    showMessage(NO_WEBGL, false);
  }
}

start();
