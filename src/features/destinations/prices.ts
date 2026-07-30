import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import type { Offer } from '@/features/flight-search/types';

export interface RoutePrice {
  amount: string;
  currency: string;
  observedAt: string;
}

/**
 * Cheapest fare recently seen per route, keyed 'ORIGIN-DESTINATION'.
 *
 * Read with the user-session client: the RLS policy already excludes anything
 * older than a week, so the database decides what counts as current rather than a
 * WHERE clause we might forget. Also means the home page needs no secret key.
 */
export async function getRoutePrices(): Promise<Map<string, RoutePrice>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('route_prices')
    .select('origin, destination, cheapest_amount, currency, observed_at');

  if (error) {
    // No prices is a worse home page, not a broken one.
    console.error('Could not load route prices:', error.message);
    return new Map();
  }

  const prices = new Map<string, RoutePrice>();
  for (const row of data ?? []) {
    prices.set(`${row.origin}-${row.destination}`, {
      amount: String(row.cheapest_amount),
      currency: String(row.currency),
      observedAt: String(row.observed_at),
    });
  }
  return prices;
}

/**
 * Record the cheapest offer from a live search.
 *
 * Called only on a cache miss — a cache hit means we already recorded this route
 * when the search first ran, and re-recording would just move the timestamp
 * forward without a new observation behind it.
 *
 * Failures are swallowed: this is a marketing nicety hanging off the critical
 * path of someone trying to buy a flight, and it must never be able to interfere
 * with that.
 */
export async function recordRoutePrice(
  criteria: { origin: string; destination: string; departureDate: string; returnDate?: string },
  offers: Offer[],
): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase || offers.length === 0) return;

  const cheapest = offers.reduce((best, offer) =>
    offer.totalAmountValue < best.totalAmountValue ? offer : best,
  );

  const { error } = await supabase.rpc('record_route_price', {
    p_origin: criteria.origin,
    p_destination: criteria.destination,
    p_amount: cheapest.totalAmount,
    p_currency: cheapest.currency,
    p_departure_date: criteria.departureDate || null,
    p_return_date: criteria.returnDate ?? null,
  });

  if (error) console.error('Could not record route price:', error.message);
}
