import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface TripSummary {
  id: string;
  bookingReference: string | null;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string | null;
  passengerCount: number;
  airlineName: string | null;
  /**
   * What the traveller paid — `charged_amount`, not `total_amount`.
   *
   * `orders.total_amount` is the SUPPLIER amount: what the airline took from our
   * balance. Showing it here meant the account page quoted £688 for a booking the
   * confirmation had correctly called £745. Two different true numbers, only one
   * of which is any of the customer's business.
   */
  paidAmount: string;
  currency: string;
  status: string;
  cancelledAt: string | null;
  /** Null once travelled or cancelled. */
  daysUntilDeparture: number | null;
}

/**
 * A traveller's own bookings.
 *
 * Uses the user-session client, not the service role: RLS on `orders` restricts
 * this to `auth.uid() = user_id`, so the policy is what enforces the boundary
 * rather than a WHERE clause we might forget.
 */
export async function getMyTrips(): Promise<TripSummary[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, booking_reference, origin, destination, departure_date, return_date, passenger_count, airline_name, total_amount, charged_amount, charged_currency, total_currency, status, cancelled_at',
    )
    .order('departure_date', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Could not load trips:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    bookingReference: row.booking_reference ? String(row.booking_reference) : null,
    origin: String(row.origin),
    destination: String(row.destination),
    departureDate: String(row.departure_date),
    returnDate: row.return_date ? String(row.return_date) : null,
    passengerCount: Number(row.passenger_count),
    airlineName: row.airline_name ? String(row.airline_name) : null,
    // Falls back for any row written before the two were kept apart.
    paidAmount: String(row.charged_amount ?? row.total_amount),
    currency: String(row.charged_currency ?? row.total_currency),
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
    daysUntilDeparture: row.cancelled_at
      ? null
      : daysUntil(String(row.departure_date)),
    status: String(row.status),
  }));
}


/**
 * Whole days until a departure date, or null once it has passed.
 *
 * Compared at UTC midnight rather than by elapsed hours, so a flight tomorrow
 * morning reads as "tomorrow" all evening rather than flipping to "today" at some
 * arbitrary point overnight.
 */
function daysUntil(departureDate: string): number | null {
  const departure = Date.parse(`${departureDate}T00:00:00Z`);
  if (!Number.isFinite(departure)) return null;

  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((departure - today) / 86_400_000);
  return days < 0 ? null : days;
}
