/** Draw order. Actors and building fronts use their feet / footprint-bottom y (0..1536) as depth. */
export const DEPTH = {
  ground: -1000,
  decal: -900, // shadows, rings, trunks, debris
  roof: 10000,
  foliage: 10001,
  overlay: 20000, // telegraph lines, icons
  popup: 25000, // floating score popups (above everything in the world)
  edge: 30000, // offscreen indicators
} as const;

/** Rect containment (feet point). */
export const inRect = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }): boolean =>
  p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
