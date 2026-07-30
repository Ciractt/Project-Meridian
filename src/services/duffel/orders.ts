import 'server-only';
import { duffelRequest, duffelRequestDetailed } from './client';
import type { DuffelOrder, DuffelOrderPassengerInput } from './api-types';

/**
 * Order creation.
 *
 * `payment` is deliberately typed narrowly. `balance` pays from the Duffel
 * balance — which is where Duffel Payments deposits a customer's card payment,
 * net of fees. `card` passes a tokenised customer card straight to the airline.
 * Which of those we use is the merchant-of-record decision, and it is not
 * something to leave implicit in a request body.
 */
export type OrderPayment =
  | {
      type: 'balance';
      currency: string;
      amount: string;
      /** Required when the payment needed 3DS authentication. */
      three_d_secure_session_id?: string;
    }
  | {
      type: 'card';
      card_id: string;
      currency: string;
      amount: string;
      three_d_secure_session_id?: string;
    };

interface CreateOrderInput {
  offerId: string;
  passengers: DuffelOrderPassengerInput[];
  payment: OrderPayment;
  /** Bags and seats. The payment amount must include their cost. */
  services?: Array<{ id: string; quantity: number }>;
  /** Our own reference, so a Duffel order can be traced back to a row here. */
  metadata?: Record<string, string>;
}

export type CreateOrderResult =
  | { status: 'confirmed'; order: DuffelOrder }
  /**
   * Duffel accepted the request but hasn't confirmed the order. It may still
   * succeed or fail, and **retrying can create a duplicate booking** — so the
   * only safe actions are to record the id and wait for the `order.created` or
   * `order.creation_failed` webhook.
   */
  | { status: 'pending'; orderId: string | null };

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const response = await duffelRequestDetailed<DuffelOrder>({
    method: 'POST',
    path: '/air/orders',
    // Long timeout on purpose: ticketing can be slow, and abandoning the
    // request does NOT abandon the booking. A timeout here means we may have
    // an order we don't know about — see the reconciliation note in
    // features/booking/actions.ts.
    timeoutMs: 60_000,
    body: {
      data: {
        type: 'instant',
        selected_offers: [input.offerId],
        passengers: input.passengers,
        payments: [input.payment],
        ...(input.services && input.services.length > 0
          ? { services: input.services }
          : {}),
        metadata: input.metadata,
      },
    },
  });

  if (response.status === 202) {
    return { status: 'pending', orderId: response.data?.id ?? null };
  }
  return { status: 'confirmed', order: response.data };
}

export async function getOrder(orderId: string): Promise<DuffelOrder> {
  return duffelRequest<DuffelOrder>({ path: `/air/orders/${orderId}` });
}
