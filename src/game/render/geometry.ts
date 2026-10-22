/** Drawing sizes shared by the Phaser views and the pure render helpers (no Phaser import here). */

/** Height of a building's front wall, drawn at the bottom of its footprint. */
export const FACADE_H = 32;
export type PropKind = 'car' | 'busStop' | 'kiosk' | 'booth';
/** World px a prop texture rises above its footprint (it is anchored on the footprint's bottom edge). */
export const PROP_RISE: Record<PropKind, number> = { car: 10, busStop: 16, kiosk: 16, booth: 24 };
