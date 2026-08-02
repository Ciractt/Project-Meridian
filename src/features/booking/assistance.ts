import 'server-only';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { getCurrentUser } from '@/features/auth/queries';
import { ASSISTANCE_OPTIONS } from './assistance-options';

/**
 * Assistance at the airport: wheelchairs, guiding, help with steps.
 *
 * ## This is not a purchase
 *
 * Assistance is free by law and cannot be bought. It also cannot currently be
 * attached to an order through Duffel — their available-services endpoint
 * supports baggage only. So there is nothing to price, nothing to charge, and
 * no API call that completes this: what we do is receive the request and pass
 * it to the airline ourselves.
 *
 * ## Why receive it at all, then
 *
 * Regulation (EC) 1107/2006 Article 6 requires carriers, their agents and tour
 * operators to receive assistance notifications at every point of sale
 * including the internet, and to transmit them onward. A ticket seller with no
 * way to say "I need a wheelchair" is the exact gap that regulation closes.
 *
 * ## The line the copy must not cross
 *
 * We can honestly say we received a request and forwarded it. We cannot say
 * assistance is confirmed. The airport managing body provides it, the airline
 * arranges it, and neither tells us it is done. Every string in this feature is
 * written to keep that distinction, because getting it wrong means somebody
 * arrives expecting help that nobody arranged.
 */

export { ASSISTANCE_OPTIONS } from './assistance-options';

const VALID_CODES = new Set(ASSISTANCE_OPTIONS.map((option) => option.code));

export interface AssistanceRequest {
  id: string;
  passengerLabel: string;
  codes: string[];
  notes: string | null;
  status: string;
  forwardedAt: string | null;
  createdAt: string;
}

export type AssistanceResult =
  | { status: 'received' }
  | { status: 'invalid'; message: string }
  | { status: 'forbidden' }
  | { status: 'unavailable'; message: string };

async function authorise(
  orderId: string,
  email: string | undefined,
): Promise<{ ok: true } | { ok: false; result: AssistanceResult }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return {
      ok: false,
      result: { status: 'unavailable', message: 'Booking storage isn’t configured.' },
    };
  }

  const { data } = await supabase
    .from('orders')
    .select('id, contact_email, user_id')
    .eq('id', orderId)
    .maybeSingle<{ id: string; contact_email: string; user_id: string | null }>();

  if (!data) {
    return {
      ok: false,
      result: { status: 'unavailable', message: 'Booking not found.' },
    };
  }

  const user = await getCurrentUser();
  if (user && data.user_id === user.id) return { ok: true };

  const given = (email ?? '').trim().toLowerCase();
  if (given && given === data.contact_email.trim().toLowerCase()) return { ok: true };

  return { ok: false, result: { status: 'forbidden' } };
}

export async function recordAssistanceRequest(input: {
  orderId: string;
  email?: string;
  passengerLabel: string;
  codes: string[];
  notes?: string;
}): Promise<AssistanceResult> {
  const auth = await authorise(input.orderId, input.email);
  if (!auth.ok) return auth.result;

  const codes = input.codes.filter((code) => VALID_CODES.has(code as never));
  const notes = (input.notes ?? '').trim().slice(0, 1000);
  const label = input.passengerLabel.trim().slice(0, 120);

  if (!label) {
    return { status: 'invalid', message: 'Say who the assistance is for.' };
  }

  /* Notes alone are a valid request. Assistance needs are not a closed list,
     and refusing a request because it does not match one of six codes is the
     failure this feature exists to prevent. */
  if (codes.length === 0 && !notes) {
    return {
      status: 'invalid',
      message: 'Choose what’s needed, or describe it in your own words.',
    };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { status: 'unavailable', message: 'Booking storage isn’t configured.' };
  }

  const { error } = await supabase.from('assistance_requests').insert({
    order_id: input.orderId,
    passenger_label: label,
    codes,
    notes: notes || null,
  });

  if (error) {
    console.error('Could not record assistance request:', error.message);
    return {
      status: 'unavailable',
      message: 'We couldn’t save that. Please call the airline directly as well.',
    };
  }

  return { status: 'received' };
}

/** Requests already made against a booking, for the booking page. */
export async function getAssistanceRequests(
  orderId: string,
): Promise<AssistanceRequest[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('assistance_requests')
    .select('id, passenger_label, codes, notes, status, forwarded_at, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Could not load assistance requests:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    passengerLabel: String(row.passenger_label),
    codes: Array.isArray(row.codes) ? row.codes.map(String) : [],
    notes: row.notes ? String(row.notes) : null,
    status: String(row.status),
    forwardedAt: row.forwarded_at ? String(row.forwarded_at) : null,
    createdAt: String(row.created_at),
  }));
}

/**
 * Mark a request as passed to the airline.
 *
 * Recorded by whoever actually did it, not inferred. There is no API call to
 * observe here — someone emailed Duffel support or rang the airline — so the
 * only honest source is a person saying they did it, and `forwarded_via`
 * records how so the trail survives them leaving.
 */
export async function markAssistanceForwarded(
  id: string,
  via: string,
): Promise<{ ok: boolean }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { ok: false };

  const { error } = await supabase
    .from('assistance_requests')
    .update({
      status: 'forwarded',
      forwarded_via: via.slice(0, 120),
      forwarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Could not mark assistance forwarded:', error.message);
    return { ok: false };
  }
  return { ok: true };
}
