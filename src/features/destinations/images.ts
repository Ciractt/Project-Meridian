import { DESTINATION_IMAGES } from './image-manifest.generated';

/**
 * Airport codes that should use a city's artwork.
 *
 * A photograph of London is a photograph of London whether the traveller lands at
 * Heathrow or Stansted. Keeping this small and explicit rather than pulling in a
 * full airport-to-city dataset: the multi-airport cities that matter for UK
 * outbound demand number about a dozen, and a wrong guess here means showing
 * someone the wrong city.
 */
const CITY_OF: Readonly<Record<string, string>> = {
  LHR: 'LON',
  LGW: 'LON',
  STN: 'LON',
  LTN: 'LON',
  LCY: 'LON',
  JFK: 'NYC',
  EWR: 'NYC',
  LGA: 'NYC',
  CDG: 'PAR',
  ORY: 'PAR',
  FCO: 'ROM',
  CIA: 'ROM',
  MXP: 'MIL',
  LIN: 'MIL',
  HND: 'TYO',
  NRT: 'TYO',
  BCN: 'BCN',
};

/**
 * Artwork for a destination, or null.
 *
 * Resolution order: the exact airport code, then the city it serves. Returning
 * null is a normal outcome — the card has a designed layout for it, so the long
 * tail of destinations works without anyone sourcing an image for Ouagadougou.
 *
 * This is the whole reason images are keyed by code rather than configured per
 * route: the set of destinations we show is demand-driven and changes on its own,
 * so image lookup has to be automatic. Adding artwork is dropping a file.
 */
export function destinationImage(iataCode: string): string | null {
  const code = iataCode.toUpperCase();
  return DESTINATION_IMAGES[code] ?? DESTINATION_IMAGES[CITY_OF[code] ?? ''] ?? null;
}

export function hasDestinationImage(iataCode: string): boolean {
  return destinationImage(iataCode) !== null;
}
