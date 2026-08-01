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


export interface StrandedRefund {
  id: string;
  bookingReference: string | null;
  origin: string;
  destination: string;
  contactEmail: string;
  airlineRefund: string | null;
  currency: string | null;
  error: string | null;
  failedAt: string;
}

/**
 * Cancelled with the airline, not refunded to the traveller.
 *
 * The highest-severity state in the system: their booking is gone AND we still
 * have their money. Nothing retries this automatically, because a blind retry on
 * a refund that may have partially succeeded is its own problem.
 */
export async function getStrandedRefunds(): Promise<StrandedRefund[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, booking_reference, origin, destination, contact_email, airline_refund_amount, airline_refund_currency, customer_refund_error, customer_refund_failed_at',
    )
    .not('customer_refund_failed_at', 'is', null)
    .order('customer_refund_failed_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('Could not load stranded refunds:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    bookingReference: row.booking_reference ? String(row.booking_reference) : null,
    origin: String(row.origin),
    destination: String(row.destination),
    contactEmail: String(row.contact_email),
    airlineRefund: row.airline_refund_amount ? String(row.airline_refund_amount) : null,
    currency: row.airline_refund_currency ? String(row.airline_refund_currency) : null,
    error: row.customer_refund_error ? String(row.customer_refund_error) : null,
    failedAt: String(row.customer_refund_failed_at),
  }));
}


export interface UndeliveredBags {
  token: string;
  orderId: string;
  chargeAmount: string | null;
  currency: string | null;
  failureReason: string | null;
  createdAt: string;
}

/** Bags paid for and not added, where the refund also failed. Money held for
 *  something the traveller did not receive. */
export async function getUndeliveredBags(): Promise<UndeliveredBags[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('service_purchases')
    .select('token, order_id, charge_amount, currency, failure_reason, created_at')
    .eq('status', 'paid_not_delivered')
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('Could not load undelivered bags:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    token: String(row.token),
    orderId: String(row.order_id),
    chargeAmount: row.charge_amount ? String(row.charge_amount) : null,
    currency: row.currency ? String(row.currency) : null,
    failureReason: row.failure_reason ? String(row.failure_reason) : null,
    createdAt: String(row.created_at),
  }));
}


export interface StuckChange {
  token: string;
  orderId: string;
  bookingReference: string | null;
  contactEmail: string | null;
  origin: string | null;
  destination: string | null;
  /** Where the leg was being moved to. */
  newDepartureDate: string | null;
  chargeAmount: string | null;
  currency: string | null;
  failureReason: string | null;
  createdAt: string;
}

/**
 * Changes where the card was charged and the flight did not move.
 *
 * The most urgent queue on this page, and unlike the others it is urgent for
 * the traveller rather than for the books. Their original booking is still
 * live, so they hold a valid ticket for a flight they believe they are no
 * longer on — and they will not turn up for it. Every row here is somebody who
 * needs telling, not just refunding (ADR-045).
 *
 * The booking reference and contact email are joined in for that reason: the
 * first thing whoever picks this up needs is a way to reach the person and
 * something to quote at them.
 */
export async function getStuckChanges(): Promise<StuckChange[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('order_changes')
    .select(
      'token, order_id, new_departure_date, charge_amount, currency, failure_reason, created_at, orders (booking_reference, contact_email, origin, destination)',
    )
    .eq('status', 'paid_not_changed')
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('Could not load stuck changes:', error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    /* PostgREST returns an embedded row as an object for a many-to-one, but
       types it as an array. Normalise rather than trusting either. */
    const joined = row.orders as unknown;
    const order = (Array.isArray(joined) ? joined[0] : joined) as
      | {
          booking_reference: string | null;
          contact_email: string | null;
          origin: string | null;
          destination: string | null;
        }
      | undefined;

    return {
      token: String(row.token),
      orderId: String(row.order_id),
      bookingReference: order?.booking_reference ?? null,
      contactEmail: order?.contact_email ?? null,
      origin: order?.origin ?? null,
      destination: order?.destination ?? null,
      newDepartureDate: row.new_departure_date ? String(row.new_departure_date) : null,
      chargeAmount: row.charge_amount ? String(row.charge_amount) : null,
      currency: row.currency ? String(row.currency) : null,
      failureReason: row.failure_reason ? String(row.failure_reason) : null,
      createdAt: String(row.created_at),
    };
  });
}
