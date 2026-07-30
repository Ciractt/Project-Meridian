import 'server-only';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { getOrder } from '@/services/duffel/orders';
import { mapSlice } from '@/features/flight-search/map';
import type { Slice } from '@/features/flight-search/types';

export interface Confirmation {
  id: string;
  bookingReference: string | null;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string | null;
  passengerCount: number;
  airlineName: string | null;
  chargedAmount: string | null;
  chargedCurrency: string | null;
  contactEmail: string;
  status: string;
  documentsProvided: boolean;
  /** True when this booking belongs to the signed-in user. */
  ownedByViewer: boolean;
  /**
   * Itinerary fetched live from Duffel rather than mirrored locally (ADR-018).
   * Null when the fetch fails — the confirmation must still render, because a
   * traveller looking for their reference should never be blocked by an API
   * being slow.
   */
  slices: Slice[] | null;
}

/**
 * Read a confirmation by order ID.
 *
 * The order ID is a v4 UUID, so the URL functions as a capability: unguessable,
 * and shareable by the person who has it. That is the same model as an emailed
 * receipt link, and it is what lets a guest — someone who booked without an
 * account — see their reference at all.
 *
 * The trade-off is deliberate and bounded: this returns route, dates, reference
 * and total only. No dates of birth, no passenger names, no identity documents.
 * Anyone holding the link sees a receipt, not a passenger manifest.
 *
 * A full "manage my booking" flow should require reference plus surname or
 * email before showing more than this.
 */
export async function getConfirmation(
  orderId: string,
  viewerId: string | null,
): Promise<Confirmation | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, user_id, booking_reference, origin, destination, departure_date, return_date, passenger_count, airline_name, charged_amount, charged_currency, contact_email, status, documents_provided, duffel_order_id',
    )
    .eq('id', orderId)
    .maybeSingle<{
      id: string;
      user_id: string | null;
      booking_reference: string | null;
      origin: string;
      destination: string;
      departure_date: string;
      return_date: string | null;
      passenger_count: number;
      airline_name: string | null;
      charged_amount: string | null;
      charged_currency: string | null;
      contact_email: string;
      status: string;
      documents_provided: boolean;
      duffel_order_id: string;
    }>();

  if (error) {
    console.error('Could not load confirmation:', error.message);
    return null;
  }
  if (!data) return null;

  /* Fetched, not stored. Degrades to null rather than throwing: someone who
     just paid needs their reference more than they need a segment list. */
  let slices: Slice[] | null = null;
  try {
    const order = await getOrder(data.duffel_order_id);
    slices = order.slices.map(mapSlice);
  } catch (error) {
    console.error('Could not load order itinerary from Duffel:', error);
  }

  return {
    id: data.id,
    bookingReference: data.booking_reference,
    documentsProvided: data.documents_provided,
    slices,
    origin: data.origin,
    destination: data.destination,
    departureDate: data.departure_date,
    returnDate: data.return_date,
    passengerCount: data.passenger_count,
    airlineName: data.airline_name,
    chargedAmount: data.charged_amount,
    chargedCurrency: data.charged_currency,
    // Masked: enough for the traveller to recognise, not enough to harvest.
    contactEmail: maskEmail(data.contact_email),
    status: data.status,
    ownedByViewer: viewerId !== null && data.user_id === viewerId,
  };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '•••';
  const head = local.slice(0, 2);
  return `${head}${'•'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}
