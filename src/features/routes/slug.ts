import { AIRPORTS } from '@/features/flight-search/airports';

/**
 * Readable route URLs: /flights/newcastle-to-malaga.
 *
 * Slugs come from city names rather than IATA codes because that is what people
 * type and what appears in a search result. `/flights/ncl-to-agp` would be
 * meaningless to everyone except the people who already know how to book.
 *
 * City codes win over airport codes where both exist — one page for London
 * rather than five near-identical ones competing with each other, which is a
 * self-inflicted ranking problem as much as a maintenance one.
 */

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Preferred code for a city — the city code if we have one, else the airport. */
export function preferredCode(iataCode: string): string {
  const place = AIRPORTS.find((entry) => entry.iataCode === iataCode);
  if (!place) return iataCode;

  const cityEntry = AIRPORTS.find(
    (entry) => entry.isCity && slugify(entry.city) === slugify(place.city),
  );
  return cityEntry?.iataCode ?? iataCode;
}

export function routeSlug(originCode: string, destinationCode: string): string | null {
  const origin = AIRPORTS.find((entry) => entry.iataCode === originCode);
  const destination = AIRPORTS.find((entry) => entry.iataCode === destinationCode);
  if (!origin || !destination) return null;

  return `${slugify(origin.city)}-to-${slugify(destination.city)}`;
}

export interface ResolvedRoute {
  originCode: string;
  destinationCode: string;
  originCity: string;
  destinationCity: string;
  originCountry: string;
  destinationCountry: string;
}

/**
 * Turns a slug back into a route, or null.
 *
 * Splits on the LAST occurrence of `-to-`, so a city containing those letters
 * doesn't break the parse. Returns null rather than guessing — an unresolvable
 * slug should 404, not render a page about somewhere we invented.
 */
export function resolveRouteSlug(slug: string): ResolvedRoute | null {
  const marker = slug.lastIndexOf('-to-');
  if (marker <= 0) return null;

  const originSlug = slug.slice(0, marker);
  const destinationSlug = slug.slice(marker + 4);

  const findCity = (citySlug: string) =>
    AIRPORTS.find((entry) => entry.isCity && slugify(entry.city) === citySlug) ??
    AIRPORTS.find((entry) => slugify(entry.city) === citySlug);

  const origin = findCity(originSlug);
  const destination = findCity(destinationSlug);
  if (!origin || !destination || origin.iataCode === destination.iataCode) return null;

  return {
    originCode: origin.iataCode,
    destinationCode: destination.iataCode,
    originCity: origin.city,
    destinationCity: destination.city,
    originCountry: origin.countryCode,
    destinationCountry: destination.countryCode,
  };
}
