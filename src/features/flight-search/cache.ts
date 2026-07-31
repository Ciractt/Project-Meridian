import 'server-only';
import { createHash } from 'node:crypto';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import type { FlightSearchParams } from './schema';
import type { Offer } from './types';

/**
 * Shared search cache.
 *
 * Duffel meters offer requests against a search-to-book ratio, and consumer
 * flight search browses far more than it books. This is the difference between
 * a search bill that scales with bookings and one that scales with traffic.
 *
 * Deliberately Postgres rather than Next's data cache: we want the hit rate
 * visible, the rows inspectable, and the same behaviour in development as in
 * production. It also doubles as the search log the admin screens read.
 */

/** Bump when the shape of `Offer` changes. Old rows then miss instead of
 *  deserialising into a type that no longer matches. v2 added `passengers`,
 *  without which a cached offer cannot be booked; v3 added
 *  `identityDocumentsRequired`; v4 added baggage, fare conditions and services; v5 added segment country codes; v6 moved the customer-facing total to include our fee; v7 added terminals, technical stops, emissions and carriage terms; v8 added supported loyalty programmes. */
const SCHEMA_VERSION = 8;

/** Upper bound on staleness. Fares move; ten minutes is the most we'll risk. */
const MAX_TTL_MS = 10 * 60 * 1000;

/** Never serve an offer this close to its own expiry — the traveller would
 *  reach checkout and find it already dead. */
const EXPIRY_MARGIN_MS = 2 * 60 * 1000;

export interface CacheOutcome {
  offers: Offer[];
  /** How long the cached copy has left, for the "prices as of" note. */
  expiresAt: string;
}

/**
 * Cache key.
 *
 * Every field that changes the Duffel request must be in here. Cabin and
 * passenger mix change pricing; `direct` changes max_connections. Currency and
 * any future loyalty or corporate fare context would need adding too — those
 * make fares user-specific, at which point a shared cache stops being valid.
 */
function cacheKey(criteria: FlightSearchParams): string {
  const canonical = JSON.stringify([
    SCHEMA_VERSION,
    criteria.tripType,
    criteria.origin,
    criteria.destination,
    criteria.departureDate,
    criteria.returnDate ?? null,
    criteria.adults,
    criteria.childAges.join(','),
    criteria.cabin,
    criteria.direct,
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}

export async function readCachedSearch(
  criteria: FlightSearchParams,
): Promise<CacheOutcome | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .rpc('touch_search_cache', {
      cache_key: cacheKey(criteria),
      wanted_schema_version: SCHEMA_VERSION,
    })
    .maybeSingle<{ offers: Offer[]; offer_count: number; expires_at: string }>();

  if (error) {
    // A cache failure must never fail a search.
    console.error('Search cache read failed:', error.message);
    return null;
  }
  if (!data) return null;

  return { offers: data.offers, expiresAt: data.expires_at };
}

/**
 * TTL is the shorter of our staleness ceiling and the earliest offer expiry
 * less a margin. If that leaves nothing useful, we don't cache at all — a
 * cached row that outlives its own offers is worse than a miss.
 */
function resolveTtlMs(offers: Offer[]): number {
  const earliest = offers.reduce<number | null>((soonest, offer) => {
    const at = Date.parse(offer.expiresAt);
    if (!Number.isFinite(at)) return soonest;
    return soonest === null ? at : Math.min(soonest, at);
  }, null);

  if (earliest === null) return MAX_TTL_MS;
  return Math.min(MAX_TTL_MS, earliest - Date.now() - EXPIRY_MARGIN_MS);
}

export async function writeCachedSearch(
  criteria: FlightSearchParams,
  offers: Offer[],
  duffelOfferRequestId: string | null,
): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase || offers.length === 0) return;

  const ttlMs = resolveTtlMs(offers);
  if (ttlMs <= 0) return;

  const { error } = await supabase.from('search_cache').upsert(
    {
      key: cacheKey(criteria),
      schema_version: SCHEMA_VERSION,
      origin: criteria.origin,
      destination: criteria.destination,
      departure_date: criteria.departureDate,
      return_date: criteria.returnDate ?? null,
      cabin: criteria.cabin,
      passenger_count: criteria.adults + criteria.childAges.length,
      direct_only: criteria.direct === 'true',
      offers,
      offer_count: offers.length,
      duffel_offer_request_id: duffelOfferRequestId,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + ttlMs).toISOString(),
      hit_count: 0,
    },
    { onConflict: 'key' },
  );

  if (error) {
    console.error('Search cache write failed:', error.message);
    return;
  }

  // Opportunistic housekeeping instead of a scheduled job. Cheap: expires_at
  // is indexed and the table grows no faster than people search.
  if (Math.random() < 0.02) {
    const { error: pruneError } = await supabase.rpc('prune_search_cache');
    if (pruneError) console.error('Search cache prune failed:', pruneError.message);
  }
}
