/** A pickup with an expiry (weapons on the ground, field heals) blinks during its last seconds (faster in the very last one). */
export const PICKUP_BLINK_SEC = 3;

/**
 * Whether a pickup expiring at sim time `expiresAt` (null = never) is in the « off » phase of its blink at `simNow`,
 * real time `nowMs`: 140 ms phases during the last PICKUP_BLINK_SEC s, 70 ms in the very last second.
 */
export function pickupBlinkOff(expiresAt: number | null, simNow: number, nowMs: number): boolean {
  if (expiresAt === null) return false;
  const left = expiresAt - simNow;
  return left < PICKUP_BLINK_SEC && Math.floor(nowMs / (left < 1 ? 70 : 140)) % 2 === 0;
}
