import type { Offer } from './types';

/**
 * Filtering and ranking, all in-memory.
 *
 * This runs on offers we already fetched, never by re-querying Duffel. Every
 * server-side filter change would be another offer request, and offer requests
 * are metered against the search-to-book ratio — so a traveller ticking four
 * filter boxes would cost four searches and produce no extra bookings. In
 * memory it costs nothing and feels instant.
 */

export type SortKey = 'best' | 'cheapest' | 'fastest';

export interface Filters {
  /** Empty means no stop restriction. */
  stops: number[];
  airlines: string[];
  maxPrice: number | null;
  maxDurationMinutes: number | null;
  /** Inclusive hour window for the outbound departure. */
  departFromHour: number;
  departToHour: number;
  /**
   * Fare must include at least one cabin bag / one checked bag.
   *
   * These exclude `unknown` as well as zero, because a filter cannot honestly
   * keep a fare we have no allowance for under a heading that says the bag is
   * included. That makes them the only filters here that hide results on the
   * strength of something we do not know, so the UI states how many and why —
   * see FilterPills. Silently dropping them would be a lie inside a filter.
   */
  carryOnIncluded: boolean;
  checkedBagIncluded: boolean;
  sort: SortKey;
}

export const defaultFilters: Filters = {
  stops: [],
  airlines: [],
  maxPrice: null,
  maxDurationMinutes: null,
  departFromHour: 0,
  departToHour: 23,
  carryOnIncluded: false,
  checkedBagIncluded: false,
  sort: 'best',
};

export interface Facets {
  /** Stop buckets present in the results, with the cheapest price for each. */
  stopBuckets: Array<{ stops: number; cheapest: number; count: number }>;
  airlines: Array<{ code: string; name: string; cheapest: number; count: number }>;
  minPrice: number;
  maxPrice: number;
  minDuration: number;
  maxDuration: number;
  currency: string;
  /** How many fares state an included allowance, and how many say nothing. */
  bags: {
    carryOnIncluded: number;
    carryOnUnknown: number;
    checkedIncluded: number;
    checkedUnknown: number;
  };
}

/**
 * Facets are derived from the UNFILTERED set so the rail doesn't shrink as you
 * use it — a filter list that disappears while you're reading it is hostile.
 * The "from £X" figures are what makes the rail useful rather than decorative.
 */
export function deriveFacets(offers: Offer[]): Facets {
  const stopMap = new Map<number, { cheapest: number; count: number }>();
  const airlineMap = new Map<string, { name: string; cheapest: number; count: number }>();

  let minPrice = Infinity;
  let maxPrice = 0;
  let minDuration = Infinity;
  let maxDuration = 0;
  const bags = {
    carryOnIncluded: 0,
    carryOnUnknown: 0,
    checkedIncluded: 0,
    checkedUnknown: 0,
  };

  for (const offer of offers) {
    const price = offer.totalAmountValue;
    minPrice = Math.min(minPrice, price);
    maxPrice = Math.max(maxPrice, price);
    minDuration = Math.min(minDuration, offer.totalDurationMinutes);
    maxDuration = Math.max(maxDuration, offer.totalDurationMinutes);

    if (offer.baggage.carryOn === 'unknown') bags.carryOnUnknown += 1;
    else if (offer.baggage.carryOn > 0) bags.carryOnIncluded += 1;
    if (offer.baggage.checked === 'unknown') bags.checkedUnknown += 1;
    else if (offer.baggage.checked > 0) bags.checkedIncluded += 1;

    const stopEntry = stopMap.get(offer.maxStops);
    if (!stopEntry) stopMap.set(offer.maxStops, { cheapest: price, count: 1 });
    else {
      stopEntry.cheapest = Math.min(stopEntry.cheapest, price);
      stopEntry.count += 1;
    }

    const airlineEntry = airlineMap.get(offer.airlineCode);
    if (!airlineEntry) {
      airlineMap.set(offer.airlineCode, {
        name: offer.airline,
        cheapest: price,
        count: 1,
      });
    } else {
      airlineEntry.cheapest = Math.min(airlineEntry.cheapest, price);
      airlineEntry.count += 1;
    }
  }

  return {
    stopBuckets: [...stopMap.entries()]
      .map(([stops, data]) => ({ stops, ...data }))
      .sort((a, b) => a.stops - b.stops),
    airlines: [...airlineMap.entries()]
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => a.cheapest - b.cheapest),
    minPrice: minPrice === Infinity ? 0 : minPrice,
    maxPrice,
    minDuration: minDuration === Infinity ? 0 : minDuration,
    maxDuration,
    currency: offers[0]?.currency ?? 'GBP',
    bags,
  };
}

/** `unknown` is not zero, and it is not one either — it fails an "included"
 *  test because we cannot say it passed. */
function includesBag(allowance: number | 'unknown'): boolean {
  return allowance !== 'unknown' && allowance > 0;
}

export function applyFilters(offers: Offer[], filters: Filters): Offer[] {
  return offers.filter((offer) => {
    if (filters.stops.length > 0 && !filters.stops.includes(Math.min(offer.maxStops, 2))) {
      return false;
    }
    if (filters.airlines.length > 0 && !filters.airlines.includes(offer.airlineCode)) {
      return false;
    }
    if (filters.maxPrice !== null && offer.totalAmountValue > filters.maxPrice) {
      return false;
    }
    if (
      filters.maxDurationMinutes !== null &&
      offer.totalDurationMinutes > filters.maxDurationMinutes
    ) {
      return false;
    }
    if (
      offer.outboundDepartureHour < filters.departFromHour ||
      offer.outboundDepartureHour > filters.departToHour
    ) {
      return false;
    }
    if (filters.carryOnIncluded && !includesBag(offer.baggage.carryOn)) return false;
    if (filters.checkedBagIncluded && !includesBag(offer.baggage.checked)) return false;
    return true;
  });
}

/**
 * Our "best" ranking: price and total journey time, each normalised across the
 * current result set, weighted 60/40 toward price.
 *
 * Kept deliberately simple and documented because ranking that isn't purely
 * price has to be disclosed to travellers — see the note the results page
 * shows. Nothing here is influenced by what a supplier pays us, and if that
 * ever changes the disclosure has to change with it.
 */
export function rankBest(offers: Offer[]): Offer[] {
  if (offers.length < 2) return [...offers];

  const prices = offers.map((offer) => offer.totalAmountValue);
  const durations = offers.map((offer) => offer.totalDurationMinutes);
  const priceMin = Math.min(...prices);
  const priceMax = Math.max(...prices);
  const durationMin = Math.min(...durations);
  const durationMax = Math.max(...durations);

  const normalise = (value: number, min: number, max: number) =>
    max === min ? 0 : (value - min) / (max - min);

  return [...offers].sort((a, b) => {
    const scoreA =
      0.6 * normalise(a.totalAmountValue, priceMin, priceMax) +
      0.4 * normalise(a.totalDurationMinutes, durationMin, durationMax);
    const scoreB =
      0.6 * normalise(b.totalAmountValue, priceMin, priceMax) +
      0.4 * normalise(b.totalDurationMinutes, durationMin, durationMax);
    return scoreA - scoreB;
  });
}

export function sortOffers(offers: Offer[], sort: SortKey): Offer[] {
  if (sort === 'cheapest') {
    return [...offers].sort((a, b) => a.totalAmountValue - b.totalAmountValue);
  }
  if (sort === 'fastest') {
    return [...offers].sort(
      (a, b) => a.totalDurationMinutes - b.totalDurationMinutes,
    );
  }
  return rankBest(offers);
}

/** Headline figures for the Best / Cheapest / Fastest strip. */
export interface SummaryEntry {
  offerId: string;
  amount: string;
  /** Sum across all slices — what `fastest` sorts on. */
  durationMinutes: number;
  /** Number of slices, so the UI can decide between "total" and "per leg". */
  legs: number;
}

export type Summary = Record<SortKey, SummaryEntry | null>;

export function buildSummary(offers: Offer[]): Summary {
  const pick = (list: Offer[]): SummaryEntry | null => {
    const first = list[0];
    return first
      ? {
          offerId: first.id,
          amount: first.totalAmount,
          durationMinutes: first.totalDurationMinutes,
          legs: first.slices.length,
        }
      : null;
  };

  return {
    best: pick(sortOffers(offers, 'best')),
    cheapest: pick(sortOffers(offers, 'cheapest')),
    fastest: pick(sortOffers(offers, 'fastest')),
  };
}

/**
 * How many filters the traveller has actually narrowed with — used for the
 * "Clear 3" affordance. A slider still at its maximum is not an active filter,
 * so comparing against the facet bounds matters.
 */
export function countActiveFilters(filters: Filters, facets: Facets): number {
  let count = 0;
  if (filters.stops.length > 0) count += 1;
  if (filters.airlines.length > 0) count += 1;
  if (filters.maxPrice !== null && filters.maxPrice < Math.ceil(facets.maxPrice)) count += 1;
  if (
    filters.maxDurationMinutes !== null &&
    filters.maxDurationMinutes < facets.maxDuration
  ) {
    count += 1;
  }
  if (filters.departFromHour !== 0 || filters.departToHour !== 23) count += 1;
  if (filters.carryOnIncluded) count += 1;
  if (filters.checkedBagIncluded) count += 1;
  return count;
}
