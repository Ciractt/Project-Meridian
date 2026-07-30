/**
 * Calendar-date helpers.
 *
 * Everything here works on 'YYYY-MM-DD' strings and does its arithmetic in
 * UTC. Departure dates are calendar dates, not instants — a flight on the 14th
 * is on the 14th regardless of who's looking. Using local Date objects here is
 * how date pickers end up off by one for users west of Greenwich.
 */

export type DateKey = string; // YYYY-MM-DD
export type MonthKey = string; // YYYY-MM

export function todayKey(): DateKey {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export function monthOf(date: DateKey): MonthKey {
  return date.slice(0, 7);
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1 + delta;
  const nextYear = year + Math.floor(index / 12);
  const nextMonth = ((index % 12) + 12) % 12;
  return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`;
}

export function addDays(date: DateKey, delta: number): DateKey {
  const ms = Date.parse(`${date}T00:00:00Z`) + delta * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function clampToMonth(date: DateKey, month: MonthKey): DateKey {
  return monthOf(date) === month ? date : `${month}-01`;
}

/**
 * Weeks for a month, Monday-first, padded with nulls so every row has seven
 * cells. Nulls render as empty cells rather than being skipped, which keeps
 * the grid rectangular for arrow-key navigation.
 */
export function monthGrid(month: MonthKey): Array<Array<DateKey | null>> {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const dayCount = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  // getUTCDay is Sunday-first; shift so Monday is 0.
  const leading = (firstOfMonth.getUTCDay() + 6) % 7;

  const cells: Array<DateKey | null> = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= dayCount; day++) {
    cells.push(`${month}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: Array<Array<DateKey | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function monthLabel(month: MonthKey, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
}

export function dayOfMonth(date: DateKey): number {
  return Number(date.slice(8, 10));
}

export function formatShort(date: DateKey, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T12:00:00Z`));
}

export function formatFull(date: DateKey, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));
}
