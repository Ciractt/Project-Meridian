/**
 * Route shortcuts for the home page and footer.
 *
 * These are the FALLBACK set, used when there isn't yet enough real search demand
 * to build the list from. Once routes have been searched, the home page prefers
 * what people actually look for — see `features/destinations/demand.ts`.
 *
 * Deliberately carries no image path. Artwork is resolved automatically from the
 * destination code (`features/destinations/images.ts`), because the set of
 * destinations on display is demand-driven and changes without anyone editing
 * this file. Configuring an image per route would only work for a list that never
 * moves.
 */
export interface FeaturedRoute {
  from: string;
  to: string;
  fromCity: string;
  toCity: string;
  country: string;
}

export const FEATURED_ROUTES: FeaturedRoute[] = [
  { from: 'NCL', to: 'AGP', fromCity: 'Newcastle', toCity: 'Malaga', country: 'Spain' },
  { from: 'NCL', to: 'FAO', fromCity: 'Newcastle', toCity: 'Faro', country: 'Portugal' },
  {
    from: 'MAN',
    to: 'JFK',
    fromCity: 'Manchester',
    toCity: 'New York',
    country: 'United States',
  },
  { from: 'LHR', to: 'BCN', fromCity: 'London', toCity: 'Barcelona', country: 'Spain' },
  {
    from: 'EDI',
    to: 'AMS',
    fromCity: 'Edinburgh',
    toCity: 'Amsterdam',
    country: 'Netherlands',
  },
  { from: 'BHX', to: 'DUB', fromCity: 'Birmingham', toCity: 'Dublin', country: 'Ireland' },
];

/**
 * Where a route shortcut goes.
 *
 * The home page search form, pre-filled — NOT /search. An earlier version linked
 * straight to results with an empty `departureDate`, which fails validation, so
 * every one of these landed on "this search link isn't complete".
 *
 * Sending them to results would need us to invent dates, and we don't know them.
 * Pre-filling the airports and letting the traveller pick dates is both correct
 * and one fewer thing for them to type.
 */
export function routeSearchHref(route: FeaturedRoute): string {
  const params = new URLSearchParams({
    origin: route.from,
    destination: route.to,
    originCity: route.fromCity,
    destinationCity: route.toCity,
  });
  return `/?${params.toString()}#search`;
}
