/**
 * Presentation helpers. No business logic — these turn values into strings a
 * traveller reads.
 */

/** Duffel returns amounts as decimal strings ("412.30") to avoid float error.
 *  We keep them as strings right up to the point of display. */
export function formatMoney(amount: string, currency: string, locale = 'en-GB'): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currency} ${amount}`;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

/** Parses an ISO 8601 duration ("PT7H25M") into minutes. */
export function parseIsoDuration(duration: string | null): number | null {
  if (!duration) return null;
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(duration);
  if (!match) return null;
  const [, days, hours, minutes] = match;
  return Number(days ?? 0) * 1440 + Number(hours ?? 0) * 60 + Number(minutes ?? 0);
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Duffel gives local datetimes without an offset ("2026-09-14T07:25:00").
 * That is deliberate: departure times are local to the airport. Slicing the
 * string is correct here; passing it through `new Date()` would silently
 * reinterpret it in the server's timezone and shift every time on the page.
 */
export function formatLocalTime(isoLocal: string): string {
  return isoLocal.slice(11, 16);
}

export function localDate(isoLocal: string): string {
  return isoLocal.slice(0, 10);
}

/** "+1" when the flight lands on a later calendar day than it left. */
export function dayOffset(departingAt: string, arrivingAt: string): number {
  const from = Date.parse(`${localDate(departingAt)}T00:00:00Z`);
  const to = Date.parse(`${localDate(arrivingAt)}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function formatDateLong(isoDate: string, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

/**
 * Formats a real instant (one with a timezone, e.g. "2026-07-30T22:15:00Z") in
 * the viewer's local time.
 *
 * Distinct from `formatLocalTime`, which slices characters out of a string and
 * is only correct for Duffel's *offset-free* airport-local datetimes. Using
 * that on a UTC instant silently shows the wrong hour — an hour out in British
 * summer time, more elsewhere.
 */
export function formatInstantTime(iso: string, locale = 'en-GB'): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(at);
}
