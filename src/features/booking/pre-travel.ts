import { addDays, formatFull } from '@/lib/date';
import type { Slice } from '@/features/flight-search/types';

/**
 * Pre-travel guidance derived from the itinerary.
 *
 * The governing rule: **state facts about the booking, and point at authorities
 * for anything about the traveller.**
 *
 * We know the route, the dates, and whether we collected documents. We do not
 * know nationality, purpose of travel, length of stay, residency, or previous
 * travel — and every one of those changes the answer to "do I need a visa".
 * Guessing has a real cost: denied boarding, a wasted fare, and a claim against
 * us for having told them wrong.
 *
 * So this module never asserts an entry requirement for a person. It says which
 * borders the itinerary crosses and where the authoritative answer lives. If
 * per-nationality answers are wanted later, that is a licensed data product
 * (IATA Timatic, or a commercial API like Sherpa) — not something to infer.
 */

export interface PreTravelGuidance {
  isInternational: boolean;
  /** Countries the traveller will enter or pass through, excluding home. */
  foreignCountries: string[];
  /** Countries entered only in transit — often have their own rules. */
  transitCountries: string[];
  /** Approximate, and labelled as such. Airlines vary. */
  checkInOpensAround: string;
  /** Recommended time at the airport before departure, in hours. */
  airportHours: number;
  /** True when the airline still needs passport details from the traveller. */
  documentsOutstanding: boolean;
  /** Itinerary touches the US, which has its own pre-travel authorisation. */
  touchesUnitedStates: boolean;
}

const HOME_COUNTRY = 'GB';

/** Rough long-haul threshold. Only used to pick an arrival recommendation. */
const LONG_HAUL_MINUTES = 6 * 60;

export function buildGuidance({
  slices,
  departureDate,
  documentsCollected,
}: {
  slices: Slice[];
  departureDate: string;
  documentsCollected: boolean;
}): PreTravelGuidance {
  const countries = new Set<string>();
  const endpoints = new Set<string>();

  for (const slice of slices) {
    const segments = slice.segments;
    segments.forEach((segment, index) => {
      if (segment.originCountry) countries.add(segment.originCountry);
      if (segment.destinationCountry) countries.add(segment.destinationCountry);

      // A slice's final destination is somewhere they're going; intermediate
      // stops are somewhere they're passing through.
      if (index === segments.length - 1 && segment.destinationCountry) {
        endpoints.add(segment.destinationCountry);
      }
      if (index === 0 && segment.originCountry) endpoints.add(segment.originCountry);
    });
  }

  const foreign = [...countries].filter((code) => code !== HOME_COUNTRY);
  const transit = foreign.filter((code) => !endpoints.has(code));

  const totalMinutes = slices.reduce(
    (total, slice) => total + (slice.durationMinutes ?? 0),
    0,
  );
  const longHaul = totalMinutes / Math.max(1, slices.length) >= LONG_HAUL_MINUTES;

  return {
    isInternational: foreign.length > 0,
    foreignCountries: foreign,
    transitCountries: transit,
    // Most airlines open online check-in 24 to 48 hours ahead. We give the
    // earlier bound and say it's approximate rather than inventing precision.
    checkInOpensAround: formatFull(addDays(departureDate, -2)),
    airportHours: foreign.length === 0 ? 2 : longHaul ? 3 : 2,
    documentsOutstanding: !documentsCollected,
    touchesUnitedStates: countries.has('US'),
  };
}

/** Display names, so we're not showing raw country codes to travellers. */
export function countryName(code: string, locale = 'en-GB'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
