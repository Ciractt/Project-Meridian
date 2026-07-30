import 'server-only';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { getCurrentUser } from '@/features/auth/queries';
import {
  confirmOrderCancellation,
  getOrder,
  quoteOrderCancellation,
} from '@/services/duffel/orders';
import { createRefund, getPaymentIntent } from '@/services/duffel/payments';

/**
 * Self-service cancellation.
 *
 * Two steps, mirroring Duffel's own design and for the same reason: the airline's
 * refund is frequently far less than the fare and sometimes nothing at all, so a
 * traveller has to see the figure before committing. A one-shot cancel would make
 * that impossible.
 *
 * ## The money
 *
 * Cancelling moves money twice:
 *
 *   1. `confirmOrderCancellation` — the airline returns `refund_amount` to OUR
 *      Duffel balance. The traveller's card is untouched at this point.
 *   2. `createRefund` — we return money to their card against the original
 *      payment intent.
 *
 * Doing 1 without 2 leaves us holding their money with their booking cancelled.
 * That is the worst state this system can reach, so a failure at step 2 is
 * recorded and surfaced rather than logged.
 *
 * ## What the traveller gets back
 *
 * The airline's refund, passed through. Our fee is not refunded — the booking was
 * made, the card was processed, and those costs are sunk. That is a policy choice
 * rather than a technical one, and the quote states it in cash before anyone
 * confirms, because a refund figure that turns out to be smaller than advertised
 * is exactly the kind of surprise this product exists not to produce.
 */

export type CancelAuth =
  | { kind: 'owner' }
  /** Guests hold a capability URL. That is enough to SEE a booking; cancelling it
   *  needs the contact email too — the link alone should not let a stranger
   *  destroy someone's flight. */
  | { kind: 'guest'; email: string };

export type QuoteResult =
  | {
      status: 'ok';
      cancellationId: string;
      airlineRefund: string;
      currency: string;
      /** 'original_form_of_payment' | 'airline_credits' | 'voucher' */
      refundTo: string | null;
      /** What we'll return to the card. */
      customerRefund: string;
      /** Retained by us. Stated up front. */
      feeRetained: string;
      expiresAt: string | null;
    }
  | { status: 'not_cancellable'; message: string }
  | { status: 'forbidden' }
  | { status: 'already_cancelled' }
  | { status: 'unavailable'; message: string };

interface OrderRow {
  id: string;
  duffel_order_id: string;
  contact_email: string;
  user_id: string | null;
  cancelled_at: string | null;
  charged_amount: string | null;
  charged_currency: string | null;
  total_amount: string | null;
}

async function loadAuthorised(
  orderId: string,
  auth: CancelAuth,
): Promise<{ row: OrderRow } | { error: 'forbidden' | 'missing' }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { error: 'missing' };

  const { data } = await supabase
    .from('orders')
    .select(
      'id, duffel_order_id, contact_email, user_id, cancelled_at, charged_amount, charged_currency, total_amount',
    )
    .eq('id', orderId)
    .maybeSingle<OrderRow>();

  if (!data) return { error: 'missing' };

  if (auth.kind === 'owner') {
    const user = await getCurrentUser();
    if (!user || data.user_id !== user.id) return { error: 'forbidden' };
    return { row: data };
  }

  const given = auth.email.trim().toLowerCase();
  if (!given || given !== data.contact_email.trim().toLowerCase()) {
    return { error: 'forbidden' };
  }
  return { row: data };
}

export async function quoteCancellation(
  orderId: string,
  auth: CancelAuth,
): Promise<QuoteResult> {
  const loaded = await loadAuthorised(orderId, auth);
  if ('error' in loaded) {
    return loaded.error === 'forbidden'
      ? { status: 'forbidden' }
      : { status: 'unavailable', message: 'Booking not found.' };
  }
  const row = loaded.row;
  if (row.cancelled_at) return { status: 'already_cancelled' };

  try {
    const order = await getOrder(row.duffel_order_id);

    /* Only offer what the airline will actually allow. A cancel button that
       fails is worse than no button — it reads as our fault and produces a
       support ticket either way. */
    if (!order.available_actions?.includes('cancel')) {
      return {
        status: 'not_cancellable',
        message:
          'This fare can’t be cancelled online. Get in touch and we’ll ask the airline for you.',
      };
    }

    const quote = await quoteOrderCancellation(row.duffel_order_id);
    const airlineRefund = quote.refund_amount ?? '0.00';
    const currency = quote.refund_currency ?? row.charged_currency ?? 'GBP';

    /* We pass the airline's refund through. Our fee is the difference between
       what the traveller paid and what the airline was owed, and it is not
       returned — stated here in cash rather than as a percentage. */
    const charged = Number(row.charged_amount ?? '0');
    const feeRetained = Math.max(0, charged - Number(airlineRefund)).toFixed(2);

    return {
      status: 'ok',
      cancellationId: quote.id,
      airlineRefund,
      currency,
      refundTo: quote.refund_to,
      customerRefund: airlineRefund,
      feeRetained,
      expiresAt: quote.expires_at,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      message:
        error instanceof Error
          ? error.message
          : 'We couldn’t get a cancellation quote from the airline.',
    };
  }
}

export type ConfirmResult =
  | { status: 'cancelled'; refunded: string; currency: string }
  | { status: 'cancelled_refund_pending'; message: string }
  | { status: 'stale' }
  | { status: 'forbidden' }
  | { status: 'unavailable'; message: string };

export async function confirmCancellation(
  orderId: string,
  cancellationId: string,
  auth: CancelAuth,
): Promise<ConfirmResult> {
  const loaded = await loadAuthorised(orderId, auth);
  if ('error' in loaded) {
    return loaded.error === 'forbidden'
      ? { status: 'forbidden' }
      : { status: 'unavailable', message: 'Booking not found.' };
  }
  const row = loaded.row;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { status: 'unavailable', message: 'Storage not configured.' };

  // ---- Step 1: cancel with the airline -----------------------------------
  let cancellation;
  try {
    cancellation = await confirmOrderCancellation(cancellationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Duffel rejects a quote that isn't the most recent one for the order.
    if (message.includes('stale')) return { status: 'stale' };
    return { status: 'unavailable', message };
  }

  const airlineRefund = cancellation.refund_amount ?? '0.00';
  const currency = cancellation.refund_currency ?? row.charged_currency ?? 'GBP';

  /* Recorded BEFORE attempting the card refund. From here the booking is gone
     and we may be holding money — if this process dies now, that fact has to
     survive it. */
  await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      duffel_cancellation_id: cancellation.id,
      airline_refund_amount: airlineRefund,
      airline_refund_currency: currency,
      airline_refund_to: cancellation.refund_to,
    })
    .eq('id', orderId);

  // ---- Step 2: refund the traveller's card -------------------------------
  if (Number(airlineRefund) <= 0) {
    // A non-refundable fare. The booking is cancelled and nothing is owed back.
    return { status: 'cancelled', refunded: '0.00', currency };
  }

  const { data: attempt } = await supabase
    .from('booking_attempts')
    .select('payment_intent_id')
    .eq('order_id', orderId)
    .not('payment_intent_id', 'is', null)
    .maybeSingle<{ payment_intent_id: string }>();

  if (!attempt?.payment_intent_id) {
    await flagRefundFailure(orderId, 'no payment intent on record');
    return {
      status: 'cancelled_refund_pending',
      message: 'We couldn’t find the original payment to refund against.',
    };
  }

  try {
    const intent = await getPaymentIntent(attempt.payment_intent_id);
    // Never refund more than was charged, whatever the airline says.
    const amount = Math.min(Number(airlineRefund), Number(intent.amount)).toFixed(2);

    const refund = await createRefund({
      paymentIntentId: intent.id,
      amount,
      currency: intent.currency,
    });

    await supabase
      .from('orders')
      .update({
        customer_refund_amount: amount,
        customer_refund_id: refund.id,
        customer_refund_failed_at: null,
        customer_refund_error: null,
      })
      .eq('id', orderId);

    return { status: 'cancelled', refunded: amount, currency: intent.currency };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await flagRefundFailure(orderId, message);
    return {
      status: 'cancelled_refund_pending',
      message:
        'Your booking is cancelled. The refund to your card didn’t go through automatically and we’re on it.',
    };
  }
}

async function flagRefundFailure(orderId: string, message: string): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;
  await supabase
    .from('orders')
    .update({
      customer_refund_failed_at: new Date().toISOString(),
      customer_refund_error: message.slice(0, 500),
    })
    .eq('id', orderId);
  console.error('CANCELLED BUT NOT REFUNDED — order %s: %s', orderId, message);
}
