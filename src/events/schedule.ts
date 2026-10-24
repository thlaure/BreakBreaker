/** Seasonal events: each has a window of dates that repeats every year (month 1-12, day 1-31, both ends included). */
export type EventId = 'halloween';

interface EventWindow {
  id: EventId;
  from: { month: number; day: number };
  to: { month: number; day: number };
}

const EVENT_WINDOWS: readonly EventWindow[] = [{ id: 'halloween', from: { month: 10, day: 24 }, to: { month: 11, day: 2 } }];

const key = (month: number, day: number): number => month * 100 + day;

function inWindow(w: EventWindow, now: Date): boolean {
  const k = key(now.getMonth() + 1, now.getDate());
  const a = key(w.from.month, w.from.day);
  const b = key(w.to.month, w.to.day);
  return a <= b ? k >= a && k <= b : k >= a || k <= b;
}

/**
 * The event on for `now`: `?event=<id>` forces one, `?event=none` forces none, any other value is ignored and the dates
 * decide. Pure: the caller passes the date and the query string.
 */
export function activeEventId(now: Date, search: string): EventId | null {
  const asked = new URLSearchParams(search).get('event');
  if (asked === 'none') return null;
  const forced = EVENT_WINDOWS.find((w) => w.id === asked);
  if (forced) return forced.id;
  return EVENT_WINDOWS.find((w) => inWindow(w, now))?.id ?? null;
}
