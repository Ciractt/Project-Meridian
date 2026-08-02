import 'server-only';
import { supabasePublic } from '@/lib/supabase/public';
import { findPlace } from '@/features/flight-search/airports';
import { countryName } from '@/features/booking/pre-travel';
import { hasDestinationImage } from './images';
import type { FeaturedRoute } from './routes';
import type { RoutePrice } from './prices';

export interface DemandRoute extends FeaturedRoute {
  price: RoutePrice;
}

/**
 * Routes to feature, drawn from what people actually search.
 *
 * This is the answer to "how does a curated list keep up with a changing world" —
 * it doesn't, so the list stops being curated. `route_prices` fills from real
 * searches (ADR-034), so the home page follows demand without anyone maintaining
 * it, and artwork attaches automatically by destination code.
 *
 * Ordering puts routes we have artwork for first. Not vanity: a grid of nine photo
 * cards and three code cards looks unfinished, whereas photos-then-codes reads as
 * deliberate. Within each group, most recently seen first — a fare observed an hour
 * ago is more likely to still be there than one from Tuesday.
 */
export async function getDemandRoutes(limit = 6): Promise<DemandRoute[]> {
  const supabase = supabasePublic;

  const { data, error } = await supabase
    .from('route_prices')
    .select('origin, destination, cheapest_amount, currency, observed_at')
    .order('observed_at', { ascending: false })
    .limit(40);

  if (error) {
    console.error('Could not load demand routes:', error.message);
    return [];
  }

  const routes: DemandRoute[] = [];

  for (const row of data ?? []) {
    const origin = findPlace(String(row.origin));
    const destination = findPlace(String(row.destination));

    // Unknown airports are skipped rather than shown as bare codes. A home page
    // tile reading "??? → ZZZ" is worse than one fewer tile.
    if (!origin || !destination) continue;

    routes.push({
      from: String(row.origin),
      to: String(row.destination),
      fromCity: origin.city,
      toCity: destination.city,
      country: countryName(destination.countryCode),
      price: {
        amount: String(row.cheapest_amount),
        currency: String(row.currency),
        observedAt: String(row.observed_at),
      },
    });
  }

  return routes
    .sort((a, b) => {
      const imageDelta =
        Number(hasDestinationImage(b.to)) - Number(hasDestinationImage(a.to));
      return imageDelta !== 0 ? imageDelta : 0;
    })
    .slice(0, limit);
}
