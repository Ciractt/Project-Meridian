import 'server-only';
import { duffelRequest } from './client';

/**
 * Duffel Payments: collect a card payment, which credits your Duffel balance
 * net of fees. The order is then paid from balance.
 *
 * The sequence is fixed and each step is server-authoritative except one:
 *
 *   1. createPaymentIntent  (server) → client_token
 *   2. <DuffelPayments>     (client) collects the card and handles 3DS
 *   3. confirmPaymentIntent (server) → funds land in your balance
 *   4. createOrder          (server) paying from balance
 *
 * Step 2 is the only client step, and its success callback carries no data. It
 * is a hint that the traveller finished, never proof of payment. Step 3 and a
 * status read are what establish that money moved.
 */

export interface DuffelPaymentIntent {
  id: string;
  live_mode: boolean;
  /** What the card is charged: flight cost plus our markup. */
  amount: string;
  currency: string;
  /** Duffel's processing fee. Null until confirmed. */
  fees_amount: string | null;
  fees_currency: string | null;
  /** amount less fees_amount, in balance currency. Null until confirmed. */
  net_amount: string | null;
  net_currency: string | null;
  status:
    | 'requires_payment_method'
    | 'requires_confirmation'
    | 'requires_action'
    | 'processing'
    | 'requires_capture'
    | 'cancelled'
    | 'succeeded';
  /** Passed to the browser. Safe client-side; it is scoped to this intent. */
  client_token: string;
  card_country_code: string | null;
  card_last_four_digits: string | null;
  card_network: string | null;
  confirmed_at: string | null;
}

export interface DuffelRefund {
  id: string;
  amount: string;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  payment_intent_id: string;
}

export async function createPaymentIntent(input: {
  amount: string;
  currency: string;
}): Promise<DuffelPaymentIntent> {
  return duffelRequest<DuffelPaymentIntent>({
    method: 'POST',
    path: '/payments/payment_intents',
    body: { data: { amount: input.amount, currency: input.currency } },
  });
}

export async function getPaymentIntent(id: string): Promise<DuffelPaymentIntent> {
  return duffelRequest<DuffelPaymentIntent>({
    path: `/payments/payment_intents/${id}`,
  });
}

export async function confirmPaymentIntent(id: string): Promise<DuffelPaymentIntent> {
  return duffelRequest<DuffelPaymentIntent>({
    method: 'POST',
    path: `/payments/payment_intents/${id}/actions/confirm`,
    timeoutMs: 45_000,
  });
}

/**
 * Refund a confirmed payment intent, in full or in part.
 *
 * This is the compensating action for the worst failure in the whole system:
 * money collected, no ticket issued. Any path that confirms a payment and then
 * fails to create an order MUST call this.
 */
export async function createRefund(input: {
  paymentIntentId: string;
  amount: string;
  currency: string;
}): Promise<DuffelRefund> {
  return duffelRequest<DuffelRefund>({
    method: 'POST',
    path: '/payments/refunds',
    timeoutMs: 45_000,
    body: {
      data: {
        payment_intent_id: input.paymentIntentId,
        amount: input.amount,
        currency: input.currency,
      },
    },
  });
}
