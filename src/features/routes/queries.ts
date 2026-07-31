import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { routeSlug } from './slug';

/**
 * What we actually know about a route.
 *
 * Every field is nullable and every consumer has to handle absence, because the
 * entire design of these pages rests on only saying what a real search produced.
 * A route nobody has searched gets a page that says so.
 */
export interface RouteInsight {
  origin: string;
  destination: string;
  cheapestAmount: string | null;
  currency: string | null;
  airlines: string[];
  fastestMinutes: number | null;
  directAvailable: boolean | null;
  observationCount: number;
  observedAt: string | null;
}

const EMPTY: Omit<RouteInsight, 'origin' | 'destination'> = {
  cheapestAmount: null,
  currency: null,
  airlines: [],
  fastestMinutes: null,
  directAvailable: null,
  observationCount: 0,
  observedAt: null,
};

export async function getRouteInsight(
  origin: string,
  destination: string,
): Promise<RouteInsight> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('route_prices')
    .select(
      'origin, destination, cheapest_amount, currency, airlines, fastest_minutes, direct_available, observation_count, observed_at',
    )
    .eq('origin', origin)
    .eq('destination', destination)
    .maybeSingle();

  if (!data) return { origin, destination, ...EMPTY };

  return {
    origin,
    destination,
    cheapestAmount: data.cheapest_amount ? String(data.cheapest_amount) : null,
    currency: data.currency ? String(data.currency) : null,
    airlines: Array.isArray(data.airlines) ? (data.airlines as string[]) : [],
    fastestMinutes: data.fastest_minutes ? Number(data.fastest_minutes) : null,
    directAvailable:
      typeof data.direct_available === 'boolean' ? data.direct_available : null,
    observationCount: Number(data.observation_count ?? 0),
    observedAt: data.observed_at ? String(data.observed_at) : null,
  };
}

/**
 * Routes with enough behind them to deserve a page.
 *
 * Threshold deliberately above one. A page generated from a single search is
 * thin content by definition — indistinguishable from the auto-generated route
 * pages search engines demote, and a poor advertisement for a site whose pitch is
 * that it tells you things. Better twenty pages that say something than two
 * thousand that don't.
 */
export async function getRoutesWithPages(
  minObservations = 2,
): Promise<Array<{ slug: string; origin: string; destination: string }>> {
  /* Service client, not the session one.
     This runs from `generateStaticParams` and the sitemap, both of which execute
     at build time with no HTTP request — so a cookie-reading client throws.
     Returns null when unconfigured, and an empty list then means pages render on
     demand rather than being prebuilt: a slower first hit, not a failure. */
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('route_prices')
    .select('origin, destination, observation_count')
    .gte('observation_count', minObservations)
    .order('observation_count', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Could not list route pages:', error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => {
      const slug = routeSlug(String(row.origin), String(row.destination));
      return slug
        ? { slug, origin: String(row.origin), destination: String(row.destination) }
        : null;
    })
    .filter((entry): entry is { slug: string; origin: string; destination: string } =>
      entry !== null,
    );
}
