import 'server-only';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { getPaymentIntent, createRefund } from '@/services/duffel/payments';
import { confirmOrderChange } from '@/services/duffel/order-changes';
import { getOrder } from '@/services/duffel/orders';

/**
 * Resolves changes stuck between payment and confirmation.
 *
 * This is the worst stuck state in the product, and it is worth being precise
 * about why. A booking that fails leaves someone with no flight and their money
 * back — bad, but coherent. A bag that fails leaves the flight intact. A
 * *change* that takes payment and does not confirm leaves someone holding a
 * valid ticket for a flight they believe they are no longer on. They will not
 * turn up for it. Nobody discovers the problem until the gate closes.
 *
 * So the resolution is deliberately asymmetric with the booking one:
 *
 *   Booking reconciliation, finding nothing → refund. Safe, because the absence
 *   of an order means the traveller has no ticket and is owed their money.
 *
 *   Change reconciliation, finding nothing → **do not refund and do not
 *   retry.** The original booking is still live and still correct. Refunding
 *   silently would leave someone believing their flight moved when it did not,
 *   with the refund reading as confirmation that we handled it. Retrying could
 *   apply a change they have stopped expecting. Both are worse than stopping.
 *
 * What we do instead is confirm where confirmation is still possible, and hand
 * everything else to a human with the state written down. That is a smaller
 * automated scope than the booking path on purpose: the failure mode of doing
 * nothing is a support ticket, and the failure mode of guessing is someone
 * missing a flight.
 */

/** Don't touch a change younger than this — beginOrderChange may still be
 *  running, and racing it is how a change gets applied twice. */
const SETTLE_DELAY_MS = 5 * 60 * 1000;

export type ChangeOutcome =
  | { status: 'confirmed' }
  | { status: 'not_paid' }
  | { status: 'too_recent' }
  | { status: 'already_resolved' }
  /** Paid, unconfirmable, and now a person's problem. Deliberate. */
  | { status: 'needs_human'; message: string }
  | { status: 'unresolved'; message: string };

export interface ChangeReport {
  token: string;
  outcome: ChangeOutcome;
}

interface StuckChange {
  token: string;
  order_id: string;
  status: string;
  duffel_order_change_id: string | null;
  payment_intent_id: string | null;
  airline_amount: string | null;
  charge_amount: string | null;
  currency: string | null;
  created_at: string;
}

const SELECT =
  'token, order_id, status, duffel_order_change_id, payment_intent_id, airline_amount, charge_amount, currency, created_at';

export async function runChangeReconciliation(limit = 25): Promise<ChangeReport[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('order_changes')
    .select(SELECT)
    .in('status', ['awaiting_payment', 'paid_not_changed'])
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Change reconciliation could not load changes:', error.message);
    return [];
  }

  const reports: ChangeReport[] = [];
  for (const change of (data ?? []) as StuckChange[]) {
    /* Per-change isolation, same as the booking pass: one unreachable Duffel
       call must not abort the batch and leave the rest unexamined. */
    try {
      reports.push({ token: change.token, outcome: await resolveChange(change) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Change reconciliation failed for %s:', change.token, message);
      reports.push({ token: change.token, outcome: { status: 'unresolved', message } });
    }
  }
  return reports;
}

async function resolveChange(change: StuckChange): Promise<ChangeOutcome> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { status: 'unresolved', message: 'Storage not configured.' };

  if (change.status === 'completed' || change.status === 'failed') {
    return { status: 'already_resolved' };
  }

  if (Date.now() - Date.parse(change.created_at) < SETTLE_DELAY_MS) {
    return { status: 'too_recent' };
  }

  /* Nothing was ever quoted, so nothing can have been charged. Close it and
     move on — this is the ordinary abandonment case, someone who opened the
     change screen and left. */
  if (!change.duffel_order_change_id) {
    await supabase
      .from('order_changes')
      .update({
        status: 'failed',
        failure_reason: 'abandoned_before_quote',
        updated_at: new Date().toISOString(),
      })
      .eq('token', change.token);
    return { status: 'not_paid' };
  }

  /* Did the money actually move? A change quoted but not paid for is an
     abandonment, not an incident, and must not be confirmed — confirming it
     would move someone's flight for free. */
  const paid = await hasSettledPayment(change);
  if (paid === 'unknown') {
    return { status: 'unresolved', message: 'Payment status could not be read.' };
  }
  if (paid === 'no') {
    await supabase
      .from('order_changes')
      .update({
        status: 'failed',
        failure_reason: 'abandoned_after_quote',
        updated_at: new Date().toISOString(),
      })
      .eq('token', change.token);
    return { status: 'not_paid' };
  }

  /* Paid. Try to finish the job — a confirm that succeeds here is the good
     outcome and the whole reason to run this. */
  try {
    await confirmOrderChange({
      orderChangeId: change.duffel_order_change_id,
      payment:
        Number(change.airline_amount ?? '0') > 0
          ? {
              type: 'balance',
              amount: Number(change.airline_amount).toFixed(2),
              currency: change.currency ?? 'GBP',
            }
          : undefined,
    });

    await supabase
      .from('order_changes')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('token', change.token);

    return { status: 'confirmed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    /* This is the fork the whole module exists for. We have their money, the
       change did not apply, and their original flight is still live. Refunding
       would read as "we handled it" to someone who then does not turn up.
       Retrying could apply a change they have stopped expecting. So: record
       everything, flag it, and stop. A human refunds it and tells them, or
       applies it and tells them — but a person decides, not this function. */
    await supabase
      .from('order_changes')
      .update({
        status: 'paid_not_changed',
        failure_reason: `confirm_failed: ${message}`.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('token', change.token);

    console.error(
      'CHANGE PAID BUT NOT APPLIED — manual action required: %s (order %s): %s',
      change.token,
      change.order_id,
      message,
    );

    return {
      status: 'needs_human',
      message:
        'Payment taken, change not applied. The original booking is still valid.',
    };
  }
}

/**
 * Did the card payment settle?
 *
 * Three answers, not two. Duffel's payment intent reports `succeeded` before
 * `net_amount` populates, and a null there means "not yet known" rather than
 * "no money". Reading unknown as no is how you abandon a change somebody paid
 * for — the same mistake `coversFare` exists to prevent on the booking side.
 */
async function hasSettledPayment(change: StuckChange): Promise<'yes' | 'no' | 'unknown'> {
  if (!change.payment_intent_id) return 'no';
  try {
    const intent = await getPaymentIntent(change.payment_intent_id);
    return intent.status === 'succeeded' ? 'yes' : 'no';
  } catch (error) {
    console.error('Change reconciliation: payment intent unreadable:', error);
    return 'unknown';
  }
}

/**
 * Refund a stuck change, by hand, from the admin screen.
 *
 * Not automatic and not reachable from the cron. Someone has to have looked at
 * the booking, decided the change is not going to happen, and told the
 * traveller — and this is the button they press afterwards. Separating the
 * decision from the mechanism is the point.
 */
export async function refundStuckChange(token: string): Promise<
  | { status: 'refunded'; amount: string; currency: string }
  | { status: 'not_found' }
  | { status: 'failed'; message: string }
> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { status: 'failed', message: 'Storage not configured.' };

  const { data } = await supabase
    .from('order_changes')
    .select(SELECT)
    .eq('token', token)
    .maybeSingle<StuckChange>();

  if (!data || !data.payment_intent_id || !data.charge_amount) {
    return { status: 'not_found' };
  }

  try {
    const refund = await createRefund({
      paymentIntentId: data.payment_intent_id,
      amount: data.charge_amount,
      currency: data.currency ?? 'GBP',
    });

    await supabase
      .from('order_changes')
      .update({
        status: 'failed',
        refund_id: refund.id,
        failure_reason: 'refunded_by_hand',
        updated_at: new Date().toISOString(),
      })
      .eq('token', token);

    return {
      status: 'refunded',
      amount: data.charge_amount,
      currency: data.currency ?? 'GBP',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Manual change refund failed for %s: %s', token, message);
    return { status: 'failed', message };
  }
}

/**
 * Is the traveller's original booking still intact?
 *
 * Used by the admin queue so whoever picks up a stuck change can see, without
 * leaving the screen, whether the person still has a flight. That is the first
 * question they will ask and the one that decides what they say.
 */
export async function originalBookingStillLive(orderId: string): Promise<boolean | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('orders')
    .select('duffel_order_id, cancelled_at')
    .eq('id', orderId)
    .maybeSingle<{ duffel_order_id: string; cancelled_at: string | null }>();

  if (!data) return null;
  if (data.cancelled_at) return false;

  try {
    const order = await getOrder(data.duffel_order_id);
    return !order.cancelled_at;
  } catch {
    return null;
  }
}
