import 'server-only';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { getOrder } from '@/services/duffel/orders';
import { createRefund, getPaymentIntent } from '@/services/duffel/payments';
import { sendOrderConfirmationEmail } from '@/features/booking/email';

/**
 * Duffel webhook handlers.
 *
 * Every one must be idempotent. Deliveries are "at least once" and retried for 72
 * hours, so each of these will run more than once for the same event — the
 * dedupe table in the route handler is the first line of defence, but the
 * handlers assume it can fail and are written to be safe if it does.
 */

export type DuffelEventType =
  | 'order.created'
  | 'order.creation_failed'
  | 'payment.created'
  | 'order.airline_initiated_change_detected'
  | 'ping';

interface EventEnvelope {
  id: string;
  type: string;
  data?: { id?: string; order_id?: string; metadata?: Record<string, string> } | null;
}

export async function handleDuffelEvent(event: EventEnvelope): Promise<void> {
  switch (event.type) {
    case 'order.created':
      await onOrderCreated(event);
      return;
    case 'order.creation_failed':
      await onOrderCreationFailed(event);
      return;
    case 'order.airline_initiated_change_detected':
      await onAirlineChange(event);
      return;
    case 'ping':
      return;
    default:
      // Duffel add events over time. An unrecognised type is not an error, and
      // must still be acknowledged or it gets retried for three days.
      console.info('Unhandled Duffel event type:', event.type);
  }
}

/**
 * Resolves a 202. The order confirmed after all — record it and clear the
 * reconciliation flag.
 */
async function onOrderCreated(event: EventEnvelope): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const orderId = event.data?.id;
  if (!supabase || !orderId) return;

  // Match by the id we stored on the 202, or by the attempt token we set as
  // order metadata. Either route works; both exist because the 202 body doesn't
  // always carry an id.
  const attemptToken = event.data?.metadata?.attempt_token ?? null;

  const query = supabase
    .from('booking_attempts')
    .select('token, contact_email, fare_amount, extras_amount, charge_amount, charge_currency, order_id');

  const { data: attempt } = attemptToken
    ? await query.eq('token', attemptToken).maybeSingle()
    : await query.eq('duffel_order_id', orderId).maybeSingle();

  // Already recorded — a redelivery, or the synchronous path won the race.
  if (!attempt || attempt.order_id) return;

  const order = await getOrder(orderId);
  const firstSlice = order.slices[0];
  const lastSlice = order.slices[order.slices.length - 1];

  const { data: row } = await supabase
    .from('orders')
    .upsert(
      {
        duffel_order_id: order.id,
        booking_reference: order.booking_reference,
        origin: firstSlice?.origin.iata_code ?? '???',
        destination: firstSlice?.destination.iata_code ?? '???',
        departure_date: firstSlice?.segments[0]?.departing_at.slice(0, 10) ?? null,
        return_date:
          order.slices.length > 1
            ? (lastSlice?.segments[0]?.departing_at.slice(0, 10) ?? null)
            : null,
        passenger_count: order.passengers.length,
        airline_name: order.owner.name,
        total_amount: order.total_amount,
        total_currency: order.total_currency,
        charged_amount: attempt.charge_amount,
        charged_currency: attempt.charge_currency,
        extras_amount: attempt.extras_amount ?? 0,
        contact_email: attempt.contact_email ?? 'unknown@unrecorded',
        status: 'confirmed',
      },
      { onConflict: 'duffel_order_id' },
    )
    .select('id')
    .maybeSingle<{ id: string }>();

  await supabase
    .from('booking_attempts')
    .update({
      status: 'completed',
      failure_reason: null,
      order_id: row?.id ?? null,
      duffel_order_id: order.id,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('token', attempt.token);

  /* This is the confirmation path for an order that came back 202 — the
     synchronous completeBooking never wrote a row for it, so nothing has emailed
     the traveller yet. The send claims a per-order flag first, so a webhook
     redelivery (at-least-once, retried for 72h) can't send a second copy, and it
     cannot throw. */
  if (row?.id) await sendOrderConfirmationEmail(row.id);
}

/**
 * The 202 ultimately failed. We hold the traveller's money and there is no
 * ticket, so a refund is owed — this is the one handler that moves money.
 */
async function onOrderCreationFailed(event: EventEnvelope): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;

  const attemptToken = event.data?.metadata?.attempt_token ?? null;
  const orderId = event.data?.id ?? null;

  const query = supabase
    .from('booking_attempts')
    .select('token, payment_intent_id, status, refund_id');

  const { data: attempt } = attemptToken
    ? await query.eq('token', attemptToken).maybeSingle()
    : orderId
      ? await query.eq('duffel_order_id', orderId).maybeSingle()
      : { data: null };

  if (!attempt) return;
  // Already refunded — this is a redelivery.
  if (attempt.refund_id) return;

  if (!attempt.payment_intent_id) {
    await supabase
      .from('booking_attempts')
      .update({ status: 'failed', failure_reason: 'order_creation_failed' })
      .eq('token', attempt.token);
    return;
  }

  try {
    const intent = await getPaymentIntent(attempt.payment_intent_id);
    const refund = await createRefund({
      paymentIntentId: intent.id,
      amount: intent.amount,
      currency: intent.currency,
    });
    await supabase
      .from('booking_attempts')
      .update({
        status: 'failed',
        failure_reason: 'order_creation_failed_refunded',
        refund_id: refund.id,
        completed_at: new Date().toISOString(),
      })
      .eq('token', attempt.token);
  } catch (error) {
    console.error('REFUND FAILED after order.creation_failed:', error);
    // Left as paid_not_ticketed so the admin dashboard surfaces it. A traveller
    // who has paid and has no ticket is never silently dropped.
    await supabase
      .from('booking_attempts')
      .update({ status: 'paid_not_ticketed', failure_reason: 'refund_failed' })
      .eq('token', attempt.token);
  }
}

/**
 * The airline changed or cancelled a flight.
 *
 * Flagged rather than acted on. Accepting a change on someone's behalf without
 * asking is not ours to do — and the alternatives (accept, cancel, rebook) have
 * different consequences for them. The flag puts it at the top of the admin
 * dashboard; the traveller still has to be told.
 */
async function onAirlineChange(event: EventEnvelope): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const orderId = event.data?.order_id ?? event.data?.id;
  if (!supabase || !orderId) return;

  const { error } = await supabase
    .from('orders')
    .update({
      airline_change_pending: true,
      airline_change_detected_at: new Date().toISOString(),
    })
    .eq('duffel_order_id', orderId);

  if (error) console.error('Could not flag airline change:', error.message);
}
