import 'server-only';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { getCurrentUser } from '@/features/auth/queries';
import { addOrderServices, getOrderAvailableServices } from '@/services/duffel/orders';
import {
  confirmPaymentIntent,
  createPaymentIntent,
  createRefund,
  getPaymentIntent,
} from '@/services/duffel/payments';
import { calculateExtrasCharge, extrasMarginRate } from './pricing';

/**
 * Buying bags after booking.
 *
 * Structurally identical to checkout, because the hazards are identical: money
 * moves from the traveller's card to our balance and then to the airline, a
 * double-click must not buy two bags, and a failure after payment owes a refund.
 *
 * Two constraints come from the airline side rather than from us:
 *
 *  - **Bags only.** Duffel's post-booking catalogue supports baggage and nothing
 *    else. There is no seat or meal equivalent, however much a traveller wants
 *    one.
 *  - **Only where bags weren't in the original fare.** An order that already
 *    included baggage returns nothing here, which is why an empty list is a
 *    normal answer rather than an error.
 */

export interface BagOption {
  id: string;
  /** What the traveller pays, inclusive of our margin. */
  price: string;
  currency: string;
  maximumQuantity: number;
  maximumWeightKg: number | null;
  kind: 'checked' | 'carry_on' | 'unknown';
  segmentIds: string[];
  passengerIds: string[];
}

export type BagOptionsResult =
  | { status: 'ok'; options: BagOption[] }
  | { status: 'none' }
  | { status: 'forbidden' }
  | { status: 'unavailable'; message: string };

async function authorise(orderId: string, email?: string) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('orders')
    .select('id, duffel_order_id, contact_email, user_id, cancelled_at')
    .eq('id', orderId)
    .maybeSingle<{
      id: string;
      duffel_order_id: string;
      contact_email: string;
      user_id: string | null;
      cancelled_at: string | null;
    }>();

  if (!data || data.cancelled_at) return null;

  if (email && email.trim().length > 0) {
    return email.trim().toLowerCase() === data.contact_email.trim().toLowerCase()
      ? data
      : null;
  }

  const user = await getCurrentUser();
  return user && data.user_id === user.id ? data : null;
}

/**
 * What the airline will sell, priced as the traveller will pay.
 *
 * Marked up here rather than at purchase so the figure beside a bag is the figure
 * it costs — the same rule the checkout ancillaries follow.
 */
export async function getBagOptions(
  orderId: string,
  email?: string,
): Promise<BagOptionsResult> {
  const order = await authorise(orderId, email);
  if (!order) return { status: 'forbidden' };

  try {
    const services = await getOrderAvailableServices(order.duffel_order_id);
    const bags = services.filter((service) => service.type === 'baggage');
    if (bags.length === 0) return { status: 'none' };

    const rate = extrasMarginRate();

    return {
      status: 'ok',
      options: bags.map((service) => ({
        id: service.id,
        price: (Number(service.total_amount) * (1 + rate)).toFixed(2),
        currency: service.total_currency,
        maximumQuantity: service.maximum_quantity,
        maximumWeightKg: service.metadata?.maximum_weight_kg ?? null,
        kind: service.metadata?.type ?? 'unknown',
        segmentIds: service.segment_ids,
        passengerIds: service.passenger_ids,
      })),
    };
  } catch (error) {
    return {
      status: 'unavailable',
      message:
        error instanceof Error ? error.message : 'Could not reach the airline.',
    };
  }
}

export type StartBagsResult =
  | { status: 'ready'; clientToken: string; chargeAmount: string; currency: string }
  | { status: 'forbidden' }
  | { status: 'duplicate' }
  | { status: 'unavailable'; message: string };

/** Validate, price from the airline's own figures, and take a payment intent. */
export async function startBagPurchase(input: {
  orderId: string;
  token: string;
  selections: Array<{ id: string; quantity: number }>;
  email?: string;
}): Promise<StartBagsResult> {
  const order = await authorise(input.orderId, input.email);
  if (!order) return { status: 'forbidden' };

  const supabase = getSupabaseServiceClient();
  if (!supabase) return { status: 'unavailable', message: 'Storage not configured.' };

  // Claim before anything expensive, exactly as booking does.
  const { error: claimError } = await supabase.from('service_purchases').insert({
    token: input.token,
    order_id: input.orderId,
    status: 'awaiting_payment',
  });
  if (claimError) return { status: 'duplicate' };

  try {
    /* Re-fetch the authoritative prices. The browser chose which bags; it does
       not get to say what they cost. Same rule as checkout extras. */
    const services = await getOrderAvailableServices(order.duffel_order_id);
    const priced = new Map(
      services.map((service) => [
        service.id,
        {
          amount: Number(service.total_amount),
          currency: service.total_currency,
          max: service.maximum_quantity,
        },
      ]),
    );

    let supplierTotal = 0;
    let currency = '';
    for (const choice of input.selections) {
      const entry = priced.get(choice.id);
      if (!entry) throw new Error('One of those bags is no longer available.');
      if (choice.quantity < 1 || choice.quantity > entry.max) {
        throw new Error('That quantity is not available.');
      }
      if (currency && entry.currency !== currency) {
        throw new Error('Those bags can’t be combined in one payment.');
      }
      currency = entry.currency;
      supplierTotal += entry.amount * choice.quantity;
    }
    if (supplierTotal <= 0) throw new Error('Nothing selected.');

    const charge = calculateExtrasCharge(supplierTotal.toFixed(2), currency);
    const intent = await createPaymentIntent({
      amount: charge.chargeAmount,
      currency: charge.currency,
    });

    const { error: bindError } = await supabase
      .from('service_purchases')
      .update({
        services: input.selections,
        supplier_amount: charge.supplierAmount,
        charge_amount: charge.chargeAmount,
        currency: charge.currency,
        payment_intent_id: intent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('token', input.token);

    // Same reasoning as booking: an unbound attempt cannot be completed, so fail
    // before the card form rather than after.
    if (bindError) throw new Error('Could not set up the payment safely.');

    return {
      status: 'ready',
      clientToken: intent.client_token,
      chargeAmount: charge.chargeAmount,
      currency: charge.currency,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from('service_purchases')
      .update({ status: 'failed', failure_reason: message.slice(0, 200) })
      .eq('token', input.token);
    return { status: 'unavailable', message };
  }
}

export type CompleteBagsResult =
  | { status: 'added'; message: string }
  | { status: 'not_paid'; message: string }
  | { status: 'refunded'; message: string }
  | { status: 'needs_attention' }
  | { status: 'unavailable'; message: string };

/** Verify payment server-side, then have the airline add the bags. */
export async function completeBagPurchase(token: string): Promise<CompleteBagsResult> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { status: 'unavailable', message: 'Storage not configured.' };

  const { data: purchase } = await supabase
    .from('service_purchases')
    .select(
      'token, order_id, services, supplier_amount, currency, payment_intent_id, status',
    )
    .eq('token', token)
    .maybeSingle<{
      token: string;
      order_id: string;
      services: Array<{ id: string; quantity: number }>;
      supplier_amount: string | null;
      currency: string | null;
      payment_intent_id: string | null;
      status: string;
    }>();

  if (!purchase) return { status: 'unavailable', message: 'We’ve lost track of that.' };
  if (purchase.status === 'completed') {
    return { status: 'added', message: 'Those bags are already on your booking.' };
  }
  if (!purchase.payment_intent_id) {
    return { status: 'not_paid', message: 'No payment was started.' };
  }

  let intent = await getPaymentIntent(purchase.payment_intent_id);
  if (intent.status !== 'succeeded') {
    try {
      intent = await confirmPaymentIntent(purchase.payment_intent_id);
    } catch {
      return { status: 'not_paid', message: 'The payment didn’t complete.' };
    }
  }
  if (intent.status !== 'succeeded') {
    return { status: 'not_paid', message: 'The payment didn’t complete.' };
  }

  await supabase
    .from('service_purchases')
    .update({ status: 'paid_not_delivered', updated_at: new Date().toISOString() })
    .eq('token', token);

  const { data: order } = await supabase
    .from('orders')
    .select('duffel_order_id, extras_amount')
    .eq('id', purchase.order_id)
    .maybeSingle<{ duffel_order_id: string; extras_amount: string | null }>();

  if (!order) return { status: 'needs_attention' };

  try {
    await addOrderServices({
      orderId: order.duffel_order_id,
      services: purchase.services,
      amount: purchase.supplier_amount ?? '0.00',
      currency: purchase.currency ?? intent.currency,
    });
  } catch (error) {
    /* Charged, and the airline didn't take it. Refund — this is the same
       compensation rule as a failed booking, and the same distinction applies:
       we only get here on a definite rejection, not on a timeout. */
    try {
      const refund = await createRefund({
        paymentIntentId: intent.id,
        amount: intent.amount,
        currency: intent.currency,
      });
      await supabase
        .from('service_purchases')
        .update({
          status: 'failed',
          failure_reason: 'airline_rejected_refunded',
          refund_id: refund.id,
          completed_at: new Date().toISOString(),
        })
        .eq('token', token);
      return {
        status: 'refunded',
        message:
          'The airline wouldn’t add those bags, so your payment has been refunded in full.',
      };
    } catch {
      await supabase
        .from('service_purchases')
        .update({ status: 'paid_not_delivered', failure_reason: 'refund_failed' })
        .eq('token', token);
      console.error('BAGS PAID, NOT DELIVERED, NOT REFUNDED — purchase %s', token, error);
      return { status: 'needs_attention' };
    }
  }

  await supabase
    .from('service_purchases')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('token', token);

  // Keep the order's extras total honest — it feeds the admin figures.
  await supabase
    .from('orders')
    .update({
      extras_amount: (
        Number(order.extras_amount ?? '0') + Number(purchase.supplier_amount ?? '0')
      ).toFixed(2),
    })
    .eq('id', purchase.order_id);

  return {
    status: 'added',
    message: 'Your bags are on the booking. The airline has them on your reference.',
  };
}
