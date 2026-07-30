import 'server-only';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { getOrder, listRecentOrders } from '@/services/duffel/orders';
import { createRefund, getPaymentIntent } from '@/services/duffel/payments';
import type { DuffelOrder } from '@/services/duffel/api-types';
import { sendOrderConfirmationEmail } from './email';

/**
 * Resolves booking attempts stuck in an unknown state.
 *
 * Two states land here, and both mean a traveller has paid without a clear
 * outcome:
 *
 *   needs_reconciliation — order creation timed out, or came back 202. A ticket
 *                          MAY exist. Retrying could sell a second one and
 *                          refunding could give away one we've paid for, so
 *                          neither is safe without first finding out.
 *   paid_not_ticketed    — we know there's no ticket and the refund failed.
 *
 * The whole job is to find out which. Duffel is the only source of truth, so
 * every path here starts by asking them rather than inferring from our own
 * records.
 *
 * Safe to run repeatedly: each attempt is re-read, anything already resolved is
 * skipped, and nothing is retried against Duffel.
 */

/** Don't touch an attempt younger than this — completeBooking may still be
 *  running, and racing it is how you create the duplicate you were avoiding. */
const SETTLE_DELAY_MS = 5 * 60 * 1000;

export type ResolutionOutcome =
  | { status: 'ticketed'; orderId: string; reference: string | null }
  | { status: 'refunded'; amount: string; currency: string }
  | { status: 'refund_failed'; message: string }
  | { status: 'no_payment' }
  | { status: 'too_recent' }
  | { status: 'already_resolved' }
  | { status: 'unresolved'; message: string };

export interface ResolutionReport {
  token: string;
  outcome: ResolutionOutcome;
}

interface StuckAttempt {
  token: string;
  offer_id: string;
  status: string;
  order_id: string | null;
  duffel_order_id: string | null;
  payment_intent_id: string | null;
  contact_email: string | null;
  charge_amount: string | null;
  charge_currency: string | null;
  extras_amount: string | null;
  created_at: string;
}

export async function runReconciliation(limit = 25): Promise<ResolutionReport[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('booking_attempts')
    .select(
      'token, offer_id, status, order_id, duffel_order_id, payment_intent_id, contact_email, charge_amount, charge_currency, extras_amount, created_at',
    )
    .in('status', ['needs_reconciliation', 'paid_not_ticketed'])
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Reconciliation could not load attempts:', error.message);
    return [];
  }

  const reports: ResolutionReport[] = [];
  for (const attempt of (data ?? []) as StuckAttempt[]) {
    /* Per-attempt isolation. One unreachable Duffel call must not abort the batch
       and leave the rest unexamined — and it must NOT fall through to the refund
       path, because a failed lookup is unknown, not absent. The attempt keeps its
       status and is retried on the next run. */
    try {
      reports.push({ token: attempt.token, outcome: await resolveAttempt(attempt) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Reconciliation failed for attempt %s:', attempt.token, message);
      reports.push({ token: attempt.token, outcome: { status: 'unresolved', message } });
    }
  }
  return reports;
}

export async function resolveAttemptByToken(token: string): Promise<ResolutionOutcome> {
  try {
    return await resolveAttemptByTokenInner(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Reconciliation failed for attempt %s:', token, message);
    return { status: 'unresolved', message };
  }
}

async function resolveAttemptByTokenInner(token: string): Promise<ResolutionOutcome> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { status: 'unresolved', message: 'Storage not configured.' };

  const { data } = await supabase
    .from('booking_attempts')
    .select(
      'token, offer_id, status, order_id, duffel_order_id, payment_intent_id, contact_email, charge_amount, charge_currency, extras_amount, created_at',
    )
    .eq('token', token)
    .maybeSingle<StuckAttempt>();

  if (!data) return { status: 'unresolved', message: 'Attempt not found.' };
  return resolveAttempt(data, { force: true });
}

async function resolveAttempt(
  attempt: StuckAttempt,
  options: { force?: boolean } = {},
): Promise<ResolutionOutcome> {
  if (attempt.order_id) return { status: 'already_resolved' };

  if (
    !options.force &&
    Date.now() - Date.parse(attempt.created_at) < SETTLE_DELAY_MS
  ) {
    return { status: 'too_recent' };
  }

  const order = await findOrder(attempt);

  if (order) return recordFoundOrder(attempt, order);
  return refundUnticketed(attempt);
}

/**
 * Did an order actually get created?
 *
 * Direct lookup when we captured an id from a 202. Otherwise — the timeout case,
 * where we never received one — list recent orders and match on the
 * `attempt_token` we set as metadata at creation. That metadata exists for
 * exactly this purpose.
 */
async function findOrder(attempt: StuckAttempt): Promise<DuffelOrder | null> {
  if (attempt.duffel_order_id) {
    try {
      return await getOrder(attempt.duffel_order_id);
    } catch (error) {
      console.error('Reconciliation: stored order id did not resolve:', error);
      // Fall through to the metadata scan rather than concluding it doesn't exist.
    }
  }

  try {
    const recent = await listRecentOrders(200);
    return (
      recent.find((order) => order.metadata?.attempt_token === attempt.token) ?? null
    );
  } catch (error) {
    console.error('Reconciliation: could not list orders:', error);
    // Unknown, not absent. Returning null here would trigger a refund for a
    // booking that may well exist, so this case is handled by the caller
    // treating a thrown error as unresolved.
    throw error;
  }
}

/** A ticket exists. Record it, complete the attempt, and send the confirmation
 *  the traveller never received. */
async function recordFoundOrder(
  attempt: StuckAttempt,
  order: DuffelOrder,
): Promise<ResolutionOutcome> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { status: 'unresolved', message: 'Storage not configured.' };

  const firstSlice = order.slices[0];
  const lastSlice = order.slices[order.slices.length - 1];

  const { data: row, error } = await supabase
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

  if (error || !row) {
    return {
      status: 'unresolved',
      message: error?.message ?? 'Could not record the order.',
    };
  }

  await supabase
    .from('booking_attempts')
    .update({
      status: 'completed',
      failure_reason: null,
      order_id: row.id,
      duffel_order_id: order.id,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('token', attempt.token);

  await sendOrderConfirmationEmail(row.id);

  return {
    status: 'ticketed',
    orderId: row.id,
    reference: order.booking_reference,
  };
}

/** No order exists. If money was taken, it has to come back. */
async function refundUnticketed(attempt: StuckAttempt): Promise<ResolutionOutcome> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { status: 'unresolved', message: 'Storage not configured.' };

  if (!attempt.payment_intent_id) {
    await supabase
      .from('booking_attempts')
      .update({
        status: 'failed',
        failure_reason: 'reconciled_no_order_no_payment',
        completed_at: new Date().toISOString(),
      })
      .eq('token', attempt.token);
    return { status: 'no_payment' };
  }

  const intent = await getPaymentIntent(attempt.payment_intent_id);

  // Never confirmed means the card was never charged.
  if (intent.status !== 'succeeded') {
    await supabase
      .from('booking_attempts')
      .update({
        status: 'failed',
        failure_reason: 'reconciled_payment_not_taken',
        completed_at: new Date().toISOString(),
      })
      .eq('token', attempt.token);
    return { status: 'no_payment' };
  }

  try {
    const refund = await createRefund({
      paymentIntentId: intent.id,
      amount: intent.amount,
      currency: intent.currency,
    });
    await supabase
      .from('booking_attempts')
      .update({
        status: 'failed',
        failure_reason: 'reconciled_refunded',
        refund_id: refund.id,
        completed_at: new Date().toISOString(),
      })
      .eq('token', attempt.token);
    return { status: 'refunded', amount: intent.amount, currency: intent.currency };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from('booking_attempts')
      .update({ status: 'paid_not_ticketed', failure_reason: 'refund_failed' })
      .eq('token', attempt.token);
    return { status: 'refund_failed', message };
  }
}
