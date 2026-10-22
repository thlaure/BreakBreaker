import { describe, expect, test } from 'vitest';
import { PICKUP_BLINK_SEC, pickupBlinkOff } from '../../src/game/render/pickupBlink';

describe('pickup blink (weapons on the ground, field heals)', () => {
  test('never blinks without an expiry, nor before the last 3 s', () => {
    expect(PICKUP_BLINK_SEC).toBe(3);
    for (let ms = 0; ms < 2000; ms += 10) {
      expect(pickupBlinkOff(null, 10, ms)).toBe(false);
      expect(pickupBlinkOff(70, 10, ms)).toBe(false);
      expect(pickupBlinkOff(13.01, 10, ms)).toBe(false);
    }
  });

  test('blinks (140 ms phases) during the last 3 s, faster (70 ms) in the very last one', () => {
    const offs = (expiresAt: number, simNow: number) => [0, 70, 140, 210, 280].map((ms) => pickupBlinkOff(expiresAt, simNow, ms));
    expect(offs(70, 68)).toEqual([true, true, false, false, true]);
    expect(offs(70, 69.5)).toEqual([true, false, true, false, true]);
  });

  test('a 60 s street weapon blinks only from 57 s', () => {
    const spawn = 20;
    const exp = spawn + 60;
    const any = (simNow: number) => [0, 140].some((ms) => pickupBlinkOff(exp, simNow, ms));
    expect(any(spawn + 56.9)).toBe(false);
    expect(any(spawn + 57.1)).toBe(true);
  });
});
