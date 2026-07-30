import { findPlace } from './airports';

/**
 * Airlines we can't show, and where they fly.
 *
 * Some carriers don't distribute through our supplier at all. Staying quiet about
 * that means a traveller searching Newcastle to Alicante sees no Jet2 or Ryanair,
 * assumes those are our best prices, and finds out otherwise later — which is the
 * same failure as a hidden fee, arriving by omission instead of by design.
 *
 * So we name them. It costs bookings we were going to lose anyway, and it avoids
 * the far worse discovery where someone books with us and then finds a fare we
 * never mentioned.
 *
 * ## Removing one
 *
 * Delete its entry. That's the whole change — the notice recalculates and stops
 * naming it. Check here first whenever supplier coverage changes, because a
 * notice that names an airline we CAN now sell is its own kind of misleading.
 */
export interface UnavailableCarrier {
  name: string;
  /**
   * Rough network, as ISO country codes. The notice only appears when a route
   * plausibly falls inside it — naming Ryanair on a Newcastle–New York search
   * would be noise, and noise is how a genuine warning gets ignored.
   */
  countries: readonly string[];
}

/** Europe plus the near-Europe markets the big low-cost carriers serve. */
const EUROPE_AND_NEAR = [
  'GB', 'IE', 'JE', 'GG', 'IM',
  'PT', 'ES', 'FR', 'IT', 'DE', 'NL', 'BE', 'LU', 'AT', 'CH',
  'DK', 'SE', 'NO', 'FI', 'IS',
  'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'HR', 'SI', 'GR', 'CY', 'MT',
  'EE', 'LV', 'LT',
  'AL', 'RS', 'BA', 'MK', 'ME', 'MD', 'UA', 'GE', 'AM',
  'TR', 'MA', 'TN', 'EG', 'IL', 'JO',
] as const;

export const UNAVAILABLE_CARRIERS: readonly UnavailableCarrier[] = [
  { name: 'Jet2', countries: EUROPE_AND_NEAR },
  { name: 'Ryanair', countries: EUROPE_AND_NEAR },
  /*
   * Wizz Air is NOT listed, deliberately. Duffel's published coverage includes
   * them, so its absence from results may be a sandbox gap rather than a real
   * one. Confirm with Duffel before naming them here — a notice claiming we
   * can't show an airline we can is exactly the sort of inaccuracy this exists
   * to prevent.
   */
];

/**
 * Which carriers to name for a route, if any.
 *
 * Returns nothing when either airport is unknown to us. Better to say nothing
 * than to guess at a network and get it wrong — an unrecognised code is usually
 * somewhere none of these airlines fly anyway.
 */
export function carriersMissingFrom(
  originCode: string,
  destinationCode: string,
): UnavailableCarrier[] {
  const origin = findPlace(originCode);
  const destination = findPlace(destinationCode);
  if (!origin || !destination) return [];

  return UNAVAILABLE_CARRIERS.filter(
    (carrier) =>
      carrier.countries.includes(origin.countryCode) &&
      carrier.countries.includes(destination.countryCode),
  );
}
