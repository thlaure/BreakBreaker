/** A prop that tells a sauna guest apart (outfit and objects only, never a physical trait or a religious item). */
export type GuestProp = 'capTie' | 'judoBelt' | 'feltHat';

/** The three guests of the glazed sauna: a walking-around character sheet each, plus the prop drawn over it. */
export const SAUNA_GUESTS: readonly { sheet: string; prop: GuestProp }[] = [
  { sheet: 'protester_1', prop: 'capTie' },
  { sheet: 'protester_3', prop: 'judoBelt' },
  { sheet: 'elder_2', prop: 'feltHat' },
];
