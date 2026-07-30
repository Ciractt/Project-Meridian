/**
 * Recent searches, kept in a cookie.
 *
 * Every incumbent has this and it earns its place — most people search the same
 * route two or three times before booking, and retyping two airports and a date
 * range is the most repeated friction in the product.
 *
 * A cookie rather than the database, deliberately: it works for guests, it costs
 * no query, and it means we are not building a per-person search history on the
 * server. The privacy policy says searches are not linked to people, and this
 * keeps that true — the record lives on their machine and they can clear it.
 *
 * Written client-side on submit; read server-side on the home page.
 */
export const RECENT_COOKIE = 'meridian_recent';
const MAX_ENTRIES = 4;
const MAX_AGE_DAYS = 30;

export interface RecentSearch {
  origin: string;
  destination: string;
  originCity: string;
  destinationCity: string;
  departureDate: string;
  returnDate: string;
  travellers: number;
  /** Full search URL, so replaying one is a link rather than a reconstruction. */
  href: string;
}

export function parseRecent(raw: string | undefined): RecentSearch[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is RecentSearch =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as RecentSearch).origin === 'string' &&
          typeof (entry as RecentSearch).href === 'string',
      )
      .slice(0, MAX_ENTRIES);
  } catch {
    // A malformed cookie is not worth an error; it just means no history.
    return [];
  }
}

/** Client-side. Prepends, de-duplicates by route and dates, caps the list. */
export function rememberSearch(entry: RecentSearch): void {
  if (typeof document === 'undefined') return;

  const existing = parseRecent(
    document.cookie
      .split('; ')
      .find((part) => part.startsWith(`${RECENT_COOKIE}=`))
      ?.split('=')[1],
  );

  const key = (item: RecentSearch) =>
    `${item.origin}-${item.destination}-${item.departureDate}-${item.returnDate}`;

  const next = [entry, ...existing.filter((item) => key(item) !== key(entry))].slice(
    0,
    MAX_ENTRIES,
  );

  const value = encodeURIComponent(JSON.stringify(next));
  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60;
  // Lax, not None: this is only ever read by our own pages.
  document.cookie = `${RECENT_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}
