import { describe, expect, test } from 'vitest';
import { activeEventId, eventActivationScript } from '../../src/events/schedule';

const day = (m: number, d: number): Date => new Date(2026, m - 1, d, 12);

describe('event schedule', () => {
  test('Halloween runs from 24 October to 2 November, both included', () => {
    expect(activeEventId(day(10, 23), '')).toBeNull();
    expect(activeEventId(day(10, 24), '')).toBe('halloween');
    expect(activeEventId(day(10, 31), '')).toBe('halloween');
    expect(activeEventId(day(11, 2), '')).toBe('halloween');
    expect(activeEventId(day(11, 3), '')).toBeNull();
    expect(activeEventId(day(6, 15), '')).toBeNull();
  });

  test('the window is the same every year', () => {
    expect(activeEventId(new Date(2031, 9, 28), '')).toBe('halloween');
  });

  test('?event=halloween forces it on, ?event=none forces it off', () => {
    expect(activeEventId(day(6, 15), '?event=halloween')).toBe('halloween');
    expect(activeEventId(day(10, 31), '?go&event=none')).toBeNull();
  });

  test('an unknown ?event= value is ignored', () => {
    expect(activeEventId(day(10, 31), '?event=xmas')).toBe('halloween');
    expect(activeEventId(day(6, 15), '?event=xmas')).toBeNull();
  });
});

describe('landing activation script', () => {
  /** Runs the inline script against a fake page on `date` with query `search`; returns the data-event it sets. */
  function runOnLanding(date: Date, search: string): string | null {
    let set: string | null = null;
    class FakeDate extends Date {
      constructor() {
        super(date.getTime());
      }
    }
    new Function('location', 'document', 'Date', eventActivationScript())(
      { search },
      { documentElement: { setAttribute: (_: string, v: string) => (set = v) } },
      FakeDate,
    );
    return set;
  }

  test('it agrees with activeEventId on every day of the year and with every ?event= value', () => {
    for (const search of ['', '?event=halloween', '?event=none', '?event=xmas', '?go&event=none']) {
      for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d = new Date(2026, d.getMonth(), d.getDate() + 1, 12)) {
        expect(runOnLanding(d, search), `${d.toDateString()} ${search}`).toBe(activeEventId(d, search));
      }
    }
  });

  test('it is short enough to inline', () => {
    expect(eventActivationScript().length).toBeLessThan(600);
  });
});
