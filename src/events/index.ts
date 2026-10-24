import type Phaser from 'phaser';
import type { Role } from '../sim/types';
import type { DecorAnim } from '../game/render/decor';
import { buildHalloweenDecor } from './halloween/decor';
import { makePumpkinSheets } from './halloween/pumpkinSheets';
import { flagKind, pumpkinSheetFor, type FlagKind } from './halloween/rioterLook';
import { bakeEventTextures, ORB_TEXTURE } from './halloween/textures';
import { zombieSheetFor, zombieSheetKeys } from './halloween/zombieMath';
import { activeEventId, type EventId } from './schedule';

/**
 * Seasonal events: a theme laid over the base game (render only, never the simulation or the map). The event is decided
 * once at start from the date and `?event=` (schedule.ts). With none active every function here does nothing.
 */
let current: EventId | null | undefined;

/** The event on for this page load (computed once). */
function activeEvent(): EventId | null {
  current ??= activeEventId(new Date(), globalThis.location?.search ?? '');
  return current;
}

/** Extra character sheets the event needs: [texture key, url relative to the assets folder]; empty with no event. */
export function eventSheets(): [string, string][] {
  return activeEvent() === 'halloween' ? zombieSheetKeys().map((k) => [k, `events/halloween/${k}.png`]) : [];
}

/** Boot: bakes the event's extra textures (before the world starts). */
export function prepareEvent(scene: Phaser.Scene): void {
  if (activeEvent() !== 'halloween') return;
  bakeEventTextures(scene);
  makePumpkinSheets(scene);
}

/** The sheet a rioter wears under the event (his own sheet when no event changes it). */
export function themedSheet(sheet: string, role: Role, lifeId: number): string {
  if (activeEvent() !== 'halloween') return sheet;
  const zombie = zombieSheetFor(sheet, role, lifeId);
  return zombie !== sheet ? zombie : pumpkinSheetFor(sheet, role, lifeId);
}

/** The texture of a flying rock: under Halloween the rocks the zombies throw are spell orbs. */
export function flyingRockTexture(kind: string, owner: 'enemy' | 'player'): string {
  return activeEvent() === 'halloween' && owner === 'enemy' ? ORB_TEXTURE : `rock_${kind}`;
}

/** The event's decorations over the map: animated bits to step each frame (empty with no event). */
export function buildEventDecor(scene: Phaser.Scene, reducedMotion: boolean): DecorAnim[] {
  return activeEvent() === 'halloween' ? buildHalloweenDecor(scene, reducedMotion) : [];
}

/** The flag a rioter carries: his variant's, unless the event changes it (zombies carry a black skull flag or none). */
export function flagFor(role: Role, lifeId: number): FlagKind {
  return activeEvent() === 'halloween' ? flagKind(role, lifeId) : role === 'boss' ? 'none' : 'variant';
}
