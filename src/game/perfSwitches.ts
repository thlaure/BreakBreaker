/** Layers the `?off=` diagnostic can switch off, to find which one costs frame time on a given machine. */
export const OFF_LAYERS = ['hud', 'graphics', 'shapes', 'particles', 'texts', 'images', 'tiles'] as const;
export type OffLayer = (typeof OFF_LAYERS)[number];

/** The layers named in `?off=a,b,c` (unknown names and blanks dropped, each once, in the order given). Pure. */
export function offLayers(search: string): OffLayer[] {
  const raw = new URLSearchParams(search).get('off') ?? '';
  const out: OffLayer[] = [];
  for (const name of raw.split(',').map((s) => s.trim())) {
    const layer = OFF_LAYERS.find((l) => l === name);
    if (layer && !out.includes(layer)) out.push(layer);
  }
  return out;
}

/** The Phaser game-object types of each layer (`hud` is the DOM overlay, handled apart). */
export const LAYER_TYPES: Record<Exclude<OffLayer, 'hud'>, readonly string[]> = {
  graphics: ['Graphics'],
  shapes: ['Ellipse', 'Rectangle'],
  particles: ['ParticleEmitter'],
  texts: ['Text'],
  images: ['Image', 'Sprite'],
  tiles: ['TileSprite', 'TilemapLayer'],
};
