import 'server-only';
import { createOfferRequest, listOffers } from '@/services/duffel/flights';
import {
  DuffelConfigError,
  DuffelRequestError,
  DuffelUnavailableError,
} from '@/services/duffel/errors';
import { mapOffer } from './map';
import { readCachedSearch, writeCachedSearch } from './cache';
import { recordRoutePrice } from '@/features/destinations/prices';
import type { FlightSearchParams } from './schema';
import type { Offer } from './types';

export type SearchResult =
  | {
      status: 'ok';
      offers: Offer[];
      /** True when served from the cache rather than a live airline search. */
      cached: boolean;
      /** When this result set stops being usable. */
      expiresAt: string | null;
    }
  | { status: 'empty' }
  | { status: 'unconfigured' }
  | { status: 'unavailable'; message: string }
  | { status: 'rejected'; message: string };

/**
 * Orchestrates a search: cache, then Duffel, then cache write.
 *
 * Returns a discriminated result rather than throwing. "No flights on this
 * route" is a normal outcome, not an exception, and the results page has a
 * different, more useful thing to say for each branch.
 *
 * Empty results are deliberately NOT cached. A route with no availability today
 * may have some in an hour, and caching nothing for ten minutes would make the
 * site look broken for a cost saving of one request.
 */
export async function runSearch(criteria: FlightSearchParams): Promise<SearchResult> {
  const cached = await readCachedSearch(criteria);
  if (cached) {
    return {
      status: 'ok',
      offers: cached.offers,
      cached: true,
      expiresAt: cached.expiresAt,
    };
  }

  const slices = [
    {
      origin: criteria.origin,
      destination: criteria.destination,
      departureDate: criteria.departureDate,
    },
  ];

  if (criteria.tripType === 'return' && criteria.returnDate) {
    slices.push({
      origin: criteria.destination,
      destination: criteria.origin,
      departureDate: criteria.returnDate,
    });
  }

  try {
    const offerRequest = await createOfferRequest({
      slices,
      passengers: {
        adults: criteria.adults,
        children: criteria.children,
        infants: criteria.infants,
      },
      cabin: criteria.cabin,
      // max_connections of 0 means a single segment per slice, i.e. direct.
      maxConnections: criteria.direct === 'true' ? 0 : 1,
    });

    const raw = await listOffers(offerRequest.id, { sort: 'total_amount', limit: 50 });
    if (raw.length === 0) return { status: 'empty' };

    const offers = raw.map(mapOffer);

    // Awaited on purpose. Un-awaited promises get killed when a serverless
    // invocation ends, which would give us a cache that silently never fills.
    await writeCachedSearch(criteria, offers, offerRequest.id);

    /* Feed the home page from real demand. Only on a live search, never on a
       cache hit — a hit means this route was already recorded, and re-recording
       would move the timestamp without a fresh observation behind it. */
    await recordRoutePrice(
      {
        origin: criteria.origin,
        destination: criteria.destination,
        departureDate: criteria.departureDate,
        returnDate: criteria.returnDate,
      },
      offers,
    );

    const earliestExpiry = offers.reduce<string | null>((soonest, offer) => {
      if (!soonest) return offer.expiresAt;
      return offer.expiresAt < soonest ? offer.expiresAt : soonest;
    }, null);

    return { status: 'ok', offers, cached: false, expiresAt: earliestExpiry };
  } catch (error) {
    if (error instanceof DuffelConfigError) {
      console.error(error.message);
      return { status: 'unconfigured' };
    }
    if (error instanceof DuffelUnavailableError) {
      console.error('Duffel unavailable:', error.message, error.cause);
      return { status: 'unavailable', message: error.message };
    }
    if (error instanceof DuffelRequestError) {
      console.error('Duffel rejected the search:', error.status, error.errors);
      return { status: 'rejected', message: error.message };
    }
    throw error;
  }
}
