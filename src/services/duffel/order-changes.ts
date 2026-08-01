import { duffelRequest } from './client';
import type {
  DuffelOrderChange,
  DuffelOrderChangeRequest,
} from './api-types';

/**
 * Changing a booking, in three steps.
 *
 * Same shape as cancellation and for the same reason: what the airline will
 * charge to move a flight is not knowable in advance — it is a fare difference
 * plus whatever penalty the fare rules impose, and it can be more than the
 * ticket cost. A traveller has to see that figure before committing to it.
 *
 * The steps are: ask what is available (`requestOrderChange`), pick one and get
 * a firm price (`createOrderChange`), then commit (`confirmOrderChange`). Only
 * the last one moves money or touches the booking.
 */

/**
 * Ask the airline what it will accept in place of one slice.
 *
 * `remove` takes the *existing* slice id from the order; `add` describes what
 * to put in its place. Every slice not mentioned stays exactly as it is, which
 * is what makes a single-leg change possible without re-quoting the whole trip.
 *
 * Slow by nature — this is a live availability search against the airline, not
 * a lookup — so the timeout matches the search path rather than the API
 * default.
 */
export async function requestOrderChange(input: {
  orderId: string;
  /** Slice id on the existing order. */
  removeSliceId: string;
  add: {
    origin: string;
    destination: string;
    /** Airport-local calendar date. */
    departureDate: string;
    cabinClass?: string;
  };
}): Promise<DuffelOrderChangeRequest> {
  return duffelRequest<DuffelOrderChangeRequest>({
    method: 'POST',
    path: '/air/order_change_requests',
    timeoutMs: 60_000,
    body: {
      data: {
        order_id: input.orderId,
        slices: {
          remove: [{ slice_id: input.removeSliceId }],
          add: [
            {
              origin: input.add.origin,
              destination: input.add.destination,
              departure_date: input.add.departureDate,
              ...(input.add.cabinClass ? { cabin_class: input.add.cabinClass } : {}),
            },
          ],
        },
      },
    },
  });
}

/**
 * Select one of the offers. Creates a pending change with a firm price.
 *
 * Does NOT change the booking. This is the equivalent of the cancellation
 * quote: the number it returns is what we show, and nothing has moved yet.
 */
export async function createOrderChange(
  orderChangeOfferId: string,
): Promise<DuffelOrderChange> {
  return duffelRequest<DuffelOrderChange>({
    method: 'POST',
    path: '/air/order_changes',
    timeoutMs: 45_000,
    body: { data: { selected_order_change_offer: orderChangeOfferId } },
  });
}

/**
 * Confirm. THIS changes the booking and settles the difference.
 *
 * A payment is required only when the change costs money; a zero or negative
 * change is confirmed without one. Passing a payment for a change that owes
 * nothing is an error, not a no-op, so the caller decides.
 */
export async function confirmOrderChange(input: {
  orderChangeId: string;
  payment?: { type: 'balance'; amount: string; currency: string };
}): Promise<DuffelOrderChange> {
  return duffelRequest<DuffelOrderChange>({
    method: 'POST',
    path: `/air/order_changes/${input.orderChangeId}/actions/confirm`,
    timeoutMs: 60_000,
    body: input.payment ? { data: { payment: input.payment } } : undefined,
  });
}
