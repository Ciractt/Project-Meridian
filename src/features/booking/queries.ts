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
  totalAmount: string;
  totalCurrency: string;
  status: string;
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
      'id, booking_reference, origin, destination, departure_date, return_date, passenger_count, airline_name, total_amount, total_currency, status',
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
    totalAmount: String(row.total_amount),
    totalCurrency: String(row.total_currency),
    status: String(row.status),
  }));
}
