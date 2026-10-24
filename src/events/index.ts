import type Phaser from 'phaser';
import type { Role } from '../sim/types';
import type { DecorAnim } from '../game/render/decor';
import { buildHalloweenDecor } from './halloween/decor';
import { zombieSheetFor } from './halloween/zombieMath';
import { makeZombieSheets } from './halloween/zombieSheets';
import { activeEventId, type EventId } from './schedule';

/**
 * Seasonal events: a theme laid over the base game (render only, never the simulation or the map). The event is decided
 * once at start from the date and `?event=` (schedule.ts). With none active every function here does nothing.
 */
let current: EventId | null | undefined;

/** The event on for this page load (computed once). */
export function activeEvent(): EventId | null {
  current ??= activeEventId(new Date(), globalThis.location?.search ?? '');
  return current;
}

/** Boot: paints the event's extra character sheets (before createCharAnims). */
export function prepareEvent(scene: Phaser.Scene): void {
  if (activeEvent() === 'halloween') makeZombieSheets(scene);
}

/** The sheet a rioter wears under the event (his own sheet when no event changes it). */
export function themedSheet(sheet: string, role: Role, lifeId: number): string {
  return activeEvent() === 'halloween' ? zombieSheetFor(sheet, role, lifeId) : sheet;
}

/** The event's decorations over the map: animated bits to step each frame (empty with no event). */
export function buildEventDecor(scene: Phaser.Scene, reducedMotion: boolean): DecorAnim[] {
  return activeEvent() === 'halloween' ? buildHalloweenDecor(scene, reducedMotion) : [];
}
