import 'server-only';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

export interface SearchStats {
  cachedSearches: number;
  cacheHits: number;
  distinctRoutes: number;
}

export interface RouteRow {
  origin: string;
  destination: string;
  searches: number;
  hits: number;
}

interface RouteRpcRow {
  origin: string;
  destination: string;
  searches: number;
  hits: number;
}

/**
 * Admin reads go through the service client because `search_cache` has RLS
 * enabled with no policies — nothing reachable by a user session can read it.
 * The privilege check happens in the /admin layout, before any of this runs.
 */
export async function getSearchStats(): Promise<SearchStats | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('search_cache_stats').maybeSingle<{
    cached_searches: number;
    cache_hits: number;
    distinct_routes: number;
  }>();

  if (error) {
    console.error('Search stats failed:', error.message);
    return null;
  }
  if (!data) return null;

  return {
    cachedSearches: Number(data.cached_searches),
    cacheHits: Number(data.cache_hits),
    distinctRoutes: Number(data.distinct_routes),
  };
}

export async function getTopRoutes(): Promise<RouteRow[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('search_cache_top_routes');

  if (error) {
    console.error('Top routes failed:', error.message);
    return [];
  }

  // Cast rather than generic: we have no generated database types yet. Running
  // `supabase gen types typescript` and wiring them into createClient<Database>
  // would remove this and every other cast in the data layer — worth doing once
  // the schema settles.
  const rows = (data ?? []) as RouteRpcRow[];

  return rows.map((row) => ({
    origin: row.origin,
    destination: row.destination,
    searches: Number(row.searches),
    hits: Number(row.hits),
  }));
}


export interface AttentionAttempt {
  token: string;
  offerId: string;
  status: string;
  failureReason: string | null;
  paymentIntentId: string | null;
  chargeAmount: string | null;
  chargeCurrency: string | null;
  createdAt: string;
}

/**
 * Bookings where money moved and the outcome is unclear.
 *
 * `paid_not_ticketed` — we hold their money and a refund is owed.
 * `needs_reconciliation` — order creation timed out; a ticket MAY exist, so this
 *                          must be checked against Duffel by hand. Never retry:
 *                          a blind retry is how one traveller gets two tickets.
 *
 * This is the highest-priority queue in the business, which is why it sits at
 * the top of the admin dashboard rather than in a log.
 */
export async function getAttentionAttempts(): Promise<AttentionAttempt[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('admin_attention_attempts');
  if (error) {
    console.error('Attention queue failed:', error.message);
    return [];
  }

  const rows = (data ?? []) as Array<{
    token: string;
    offer_id: string;
    status: string;
    failure_reason: string | null;
    payment_intent_id: string | null;
    charge_amount: string | null;
    charge_currency: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    token: row.token,
    offerId: row.offer_id,
    status: row.status,
    failureReason: row.failure_reason,
    paymentIntentId: row.payment_intent_id,
    chargeAmount: row.charge_amount,
    chargeCurrency: row.charge_currency,
    createdAt: row.created_at,
  }));
}

export interface OrderRow {
  id: string;
  duffelOrderId: string;
  bookingReference: string | null;
  origin: string;
  destination: string;
  departureDate: string;
  passengerCount: number;
  totalAmount: string;
  totalCurrency: string;
  status: string;
  contactEmail: string;
  createdAt: string;
}

export async function getRecentOrders(): Promise<OrderRow[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('admin_recent_orders');
  if (error) {
    console.error('Recent orders failed:', error.message);
    return [];
  }

  const rows = (data ?? []) as Array<Record<string, string | number | null>>;

  return rows.map((row) => ({
    id: String(row.id),
    duffelOrderId: String(row.duffel_order_id),
    bookingReference: row.booking_reference ? String(row.booking_reference) : null,
    origin: String(row.origin),
    destination: String(row.destination),
    departureDate: String(row.departure_date),
    passengerCount: Number(row.passenger_count),
    totalAmount: String(row.total_amount),
    totalCurrency: String(row.total_currency),
    status: String(row.status),
    contactEmail: String(row.contact_email),
    createdAt: String(row.created_at),
  }));
}


export interface AirlineChangeRow {
  id: string;
  bookingReference: string | null;
  origin: string;
  destination: string;
  departureDate: string;
  contactEmail: string;
  detectedAt: string | null;
}

/**
 * Orders the airline has changed and nobody has actioned.
 *
 * The highest-priority queue in the business alongside stuck payments: these are
 * confirmed, paid travellers whose flight has moved. Duffel notifies us; telling
 * them is on us.
 */
export async function getPendingAirlineChanges(): Promise<AirlineChangeRow[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, booking_reference, origin, destination, departure_date, contact_email, airline_change_detected_at',
    )
    .eq('airline_change_pending', true)
    .order('airline_change_detected_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('Could not load airline changes:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    bookingReference: row.booking_reference ? String(row.booking_reference) : null,
    origin: String(row.origin),
    destination: String(row.destination),
    departureDate: String(row.departure_date),
    contactEmail: String(row.contact_email),
    detectedAt: row.airline_change_detected_at
      ? String(row.airline_change_detected_at)
      : null,
  }));
}


export interface FailedConfirmation {
  id: string;
  bookingReference: string | null;
  origin: string;
  destination: string;
  contactEmail: string;
  failedAt: string;
  error: string | null;
}

/**
 * Bookings where the confirmation email was claimed and then failed.
 *
 * The send is at-most-once and never retries itself, so nothing will fix these
 * without a person. Each one is a paying traveller who — if they booked as a
 * guest and closed the tab — currently has no copy of their booking reference at
 * all.
 */
export async function getFailedConfirmations(): Promise<FailedConfirmation[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, booking_reference, origin, destination, contact_email, confirmation_email_failed_at, confirmation_email_error',
    )
    .not('confirmation_email_failed_at', 'is', null)
    .order('confirmation_email_failed_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('Could not load failed confirmations:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    bookingReference: row.booking_reference ? String(row.booking_reference) : null,
    origin: String(row.origin),
    destination: String(row.destination),
    contactEmail: String(row.contact_email),
    failedAt: String(row.confirmation_email_failed_at),
    error: row.confirmation_email_error ? String(row.confirmation_email_error) : null,
  }));
}
