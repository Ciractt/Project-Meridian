import type { Place } from './types';

/**
 * A small bundled list, kept as the offline fallback.
 *
 * `searchPlaces` now calls Duffel via /api/places and only falls back to this
 * list if the request fails or the token isn't configured. Keeping it means
 * the form is never dead — a lookup outage degrades the airport list rather
 * than breaking the page.
 */
const AIRPORTS: Place[] = [
  { iataCode: 'LON', name: 'London (all airports)', city: 'London', countryCode: 'GB', isCity: true },
  { iataCode: 'LHR', name: 'Heathrow', city: 'London', countryCode: 'GB' },
  { iataCode: 'LGW', name: 'Gatwick', city: 'London', countryCode: 'GB' },
  { iataCode: 'STN', name: 'Stansted', city: 'London', countryCode: 'GB' },
  { iataCode: 'LTN', name: 'Luton', city: 'London', countryCode: 'GB' },
  { iataCode: 'LCY', name: 'London City', city: 'London', countryCode: 'GB' },
  { iataCode: 'MAN', name: 'Manchester', city: 'Manchester', countryCode: 'GB' },
  { iataCode: 'NCL', name: 'Newcastle', city: 'Newcastle', countryCode: 'GB' },
  { iataCode: 'EDI', name: 'Edinburgh', city: 'Edinburgh', countryCode: 'GB' },
  { iataCode: 'GLA', name: 'Glasgow', city: 'Glasgow', countryCode: 'GB' },
  { iataCode: 'BHX', name: 'Birmingham', city: 'Birmingham', countryCode: 'GB' },
  { iataCode: 'BRS', name: 'Bristol', city: 'Bristol', countryCode: 'GB' },
  { iataCode: 'LPL', name: 'Liverpool John Lennon', city: 'Liverpool', countryCode: 'GB' },
  { iataCode: 'LBA', name: 'Leeds Bradford', city: 'Leeds', countryCode: 'GB' },
  { iataCode: 'BFS', name: 'Belfast International', city: 'Belfast', countryCode: 'GB' },
  { iataCode: 'DUB', name: 'Dublin', city: 'Dublin', countryCode: 'IE' },
  { iataCode: 'PAR', name: 'Paris (all airports)', city: 'Paris', countryCode: 'FR', isCity: true },
  { iataCode: 'CDG', name: 'Charles de Gaulle', city: 'Paris', countryCode: 'FR' },
  { iataCode: 'ORY', name: 'Orly', city: 'Paris', countryCode: 'FR' },
  { iataCode: 'AMS', name: 'Schiphol', city: 'Amsterdam', countryCode: 'NL' },
  { iataCode: 'BCN', name: 'El Prat', city: 'Barcelona', countryCode: 'ES' },
  { iataCode: 'MAD', name: 'Barajas', city: 'Madrid', countryCode: 'ES' },
  { iataCode: 'AGP', name: 'Malaga', city: 'Malaga', countryCode: 'ES' },
  { iataCode: 'PMI', name: 'Palma de Mallorca', city: 'Palma', countryCode: 'ES' },
  { iataCode: 'ALC', name: 'Alicante', city: 'Alicante', countryCode: 'ES' },
  { iataCode: 'FCO', name: 'Fiumicino', city: 'Rome', countryCode: 'IT' },
  { iataCode: 'MXP', name: 'Malpensa', city: 'Milan', countryCode: 'IT' },
  { iataCode: 'LIS', name: 'Humberto Delgado', city: 'Lisbon', countryCode: 'PT' },
  { iataCode: 'FAO', name: 'Faro', city: 'Faro', countryCode: 'PT' },
  { iataCode: 'BER', name: 'Brandenburg', city: 'Berlin', countryCode: 'DE' },
  { iataCode: 'MUC', name: 'Munich', city: 'Munich', countryCode: 'DE' },
  { iataCode: 'FRA', name: 'Frankfurt', city: 'Frankfurt', countryCode: 'DE' },
  { iataCode: 'CPH', name: 'Copenhagen', city: 'Copenhagen', countryCode: 'DK' },
  { iataCode: 'KEF', name: 'Keflavik', city: 'Reykjavik', countryCode: 'IS' },
  { iataCode: 'IST', name: 'Istanbul', city: 'Istanbul', countryCode: 'TR' },
  { iataCode: 'DXB', name: 'Dubai International', city: 'Dubai', countryCode: 'AE' },
  { iataCode: 'NYC', name: 'New York (all airports)', city: 'New York', countryCode: 'US', isCity: true },
  { iataCode: 'JFK', name: 'John F. Kennedy', city: 'New York', countryCode: 'US' },
  { iataCode: 'EWR', name: 'Newark', city: 'New York', countryCode: 'US' },
  { iataCode: 'LAX', name: 'Los Angeles', city: 'Los Angeles', countryCode: 'US' },
  { iataCode: 'BOS', name: 'Logan', city: 'Boston', countryCode: 'US' },
  { iataCode: 'YYZ', name: 'Pearson', city: 'Toronto', countryCode: 'CA' },
  { iataCode: 'SIN', name: 'Changi', city: 'Singapore', countryCode: 'SG' },
  { iataCode: 'HND', name: 'Haneda', city: 'Tokyo', countryCode: 'JP' },
  { iataCode: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', countryCode: 'TH' },
  { iataCode: 'SYD', name: 'Kingsford Smith', city: 'Sydney', countryCode: 'AU' },
];

export function findPlace(iataCode: string): Place | undefined {
  return AIRPORTS.find((a) => a.iataCode === iataCode.toUpperCase());
}

/**
 * Airport lookup, live from Duffel with a local fallback.
 *
 * The API route caches aggressively (airport names don't change), so this is
 * cheap despite firing on keystrokes.
 */
export async function searchPlaces(query: string, limit = 6): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const response = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
    if (response.ok) {
      const payload = (await response.json()) as { places?: Place[] };
      if (payload.places && payload.places.length > 0) {
        return payload.places.slice(0, limit);
      }
    }
  } catch {
    // Fall through to the bundled list.
  }

  return searchBundledPlaces(q, limit);
}

/** Ranks matches so an exact code wins, then a city, then a name. */
function searchBundledPlaces(query: string, limit: number): Place[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const scored = AIRPORTS.map((place) => {
    const code = place.iataCode.toLowerCase();
    const city = place.city.toLowerCase();
    const name = place.name.toLowerCase();

    let score = -1;
    if (code === q) score = 0;
    else if (city.startsWith(q)) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (code.startsWith(q)) score = 3;
    else if (city.includes(q) || name.includes(q)) score = 4;

    return { place, score };
  })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.place.iataCode.localeCompare(b.place.iataCode));

  return scored.slice(0, limit).map((entry) => entry.place);
}
