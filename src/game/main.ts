import Phaser from 'phaser';

class EmptyScene extends Phaser.Scene {
  constructor() {
    super('empty');
  }
}

new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#14121c',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 640,
    height: 360,
  },
  scene: [EmptyScene],
});
