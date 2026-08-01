import 'server-only';
import { randomUUID } from 'node:crypto';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { getCurrentUser } from '@/features/auth/queries';
import { getOrder } from '@/services/duffel/orders';
import {
  confirmOrderChange,
  createOrderChange,
  requestOrderChange,
} from '@/services/duffel/order-changes';
import { createPaymentIntent } from '@/services/duffel/payments';
import { calculateChangeCharge } from './pricing';
import type { DuffelOrderChangeOffer } from '@/services/duffel/api-types';

/**
 * Moving a booked flight to a different day.
 *
 * ## Why this is quote-then-confirm
 *
 * What an airline charges to move a flight is not knowable in advance. It is a
 * fare difference plus whatever penalty the fare rules impose, it varies by the
 * day being moved to, and it is routinely more than the original ticket. A
 * one-shot "change my flight" endpoint would commit someone to a number they
 * have never seen. So: ask what is available, show every option with its real
 * cost, and only move money when they pick one.
 *
 * ## What we charge
 *
 * The airline's figure at cost, plus a flat handling fee, itemised — never a
 * percentage. See `calculateChangeCharge` for the argument. A change that costs
 * nothing is free, and a change in the traveller's favour is refunded without a
 * fee deducted from it.
 *
 * ## Scope
 *
 * One slice, date only. Origin and destination stay as booked. That covers the
 * overwhelming majority of real changes and keeps the interface to a date
 * picker instead of a second search form. Changing where you are flying is a
 * different trip, and it can stay a conversation until there is evidence people
 * want to do it here.
 */

export type ChangeAuth =
  | { kind: 'owner' }
  /** Guests hold a capability URL. Enough to SEE a booking; changing one needs
   *  the contact email too — a link should not let a stranger move someone's
   *  flight, for the same reason it should not let them cancel it. */
  | { kind: 'guest'; email: string };

export interface ChangeOption {
  offerId: string;
  /** Signed, as the airline reports it. */
  airlineAmount: string;
  handlingFee: string;
  /** What the card would be charged. Never negative. */
  chargeAmount: string;
  /** Set when the change is in the traveller's favour. */
  refundAmount: string | null;
  /** 'original_form_of_payment' | 'airline_credits' | 'voucher' | null. */
  refundTo: string | null;
  currency: string;
  expiresAt: string | null;
  /** Departure and arrival of the replacement leg, for display. */
  departingAt: string | null;
  arrivingAt: string | null;
  stops: number;
}

export type ChangeQuoteResult =
  | { status: 'ok'; options: ChangeOption[] }
  | { status: 'not_changeable'; message: string }
  | { status: 'none'; message: string }
  | { status: 'forbidden' }
  | { status: 'unavailable'; message: string };

interface OrderRow {
  id: string;
  duffel_order_id: string;
  contact_email: string;
  user_id: string | null;
  cancelled_at: string | null;
  charged_currency: string | null;
}

async function loadAuthorised(
  orderId: string,
  auth: ChangeAuth,
): Promise<{ row: OrderRow } | { error: 'forbidden' | 'missing' }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { error: 'missing' };

  const { data } = await supabase
    .from('orders')
    .select('id, duffel_order_id, contact_email, user_id, cancelled_at, charged_currency')
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

/** Pulls the display fields off an offer's replacement slice. */
function describeOffer(offer: DuffelOrderChangeOffer, currency: string): ChangeOption {
  const slice = offer.slices.add[0];
  const segments = slice?.segments ?? [];
  const first = segments[0];
  const last = segments[segments.length - 1];

  const breakdown = calculateChangeCharge(
    offer.change_total_amount ?? '0.00',
    offer.change_total_currency ?? currency,
  );

  return {
    offerId: offer.id,
    airlineAmount: breakdown.airlineAmount,
    handlingFee: breakdown.handlingFee,
    chargeAmount: breakdown.chargeAmount,
    refundAmount: breakdown.refundAmount,
    refundTo: offer.refund_to ?? null,
    currency: breakdown.currency,
    expiresAt: offer.expires_at,
    departingAt: first?.departing_at ?? null,
    arrivingAt: last?.arriving_at ?? null,
    stops: Math.max(0, segments.length - 1),
  };
}

/**
 * What the airline will accept, priced.
 *
 * Nothing here moves money or touches the booking.
 */
export async function quoteOrderChange(input: {
  orderId: string;
  auth: ChangeAuth;
  /** Slice on the existing order being replaced. */
  sliceId: string;
  origin: string;
  destination: string;
  /** The new departure date. Airport-local calendar date. */
  departureDate: string;
}): Promise<ChangeQuoteResult> {
  const loaded = await loadAuthorised(input.orderId, input.auth);
  if ('error' in loaded) {
    return loaded.error === 'forbidden'
      ? { status: 'forbidden' }
      : { status: 'unavailable', message: 'Booking not found.' };
  }

  const row = loaded.row;
  if (row.cancelled_at) {
    return {
      status: 'not_changeable',
      message: 'This booking has been cancelled, so there’s nothing to change.',
    };
  }

  try {
    const order = await getOrder(row.duffel_order_id);

    /* Only offer what the airline will actually allow. A change button that
       fails reads as our fault and produces a support ticket either way — the
       same argument the cancellation flow makes. */
    if (!order.available_actions?.includes('change')) {
      return {
        status: 'not_changeable',
        message:
          'This fare can’t be changed online. Get in touch and we’ll ask the airline for you.',
      };
    }

    const request = await requestOrderChange({
      orderId: row.duffel_order_id,
      removeSliceId: input.sliceId,
      add: {
        origin: input.origin,
        destination: input.destination,
        departureDate: input.departureDate,
      },
    });

    const currency = row.charged_currency ?? 'GBP';
    const options = request.order_change_offers.map((offer) =>
      describeOffer(offer, currency),
    );

    if (options.length === 0) {
      return {
        status: 'none',
        message:
          'The airline has nothing available on that date. Try another one — there’s no charge for looking.',
      };
    }

    /* Cheapest first. A change is a grudge purchase and the figure is what
       people are here to compare. */
    options.sort((a, b) => Number(a.chargeAmount) - Number(b.chargeAmount));

    return { status: 'ok', options };
  } catch (error) {
    return {
      status: 'unavailable',
      message:
        error instanceof Error
          ? error.message
          : 'We couldn’t reach the airline for change options.',
    };
  }
}

export type ChangeConfirmResult =
  | { status: 'changed'; charged: string; currency: string }
  | { status: 'refund_due'; amount: string; currency: string; refundTo: string | null }
  | { status: 'needs_payment'; token: string; clientToken: string; amount: string; currency: string }
  | { status: 'stale'; message: string }
  | { status: 'forbidden' }
  | { status: 'unavailable'; message: string };

/**
 * Select an option and take payment for it if one is owed.
 *
 * Stops short of confirming with the airline. The card is charged first, into
 * our balance, and the airline is settled from there — the same two-step every
 * other money path here uses, and the reason `paid_not_changed` exists as a
 * state rather than an error.
 */
export async function beginOrderChange(input: {
  orderId: string;
  auth: ChangeAuth;
  offerId: string;
  /** Client-generated, so a double-click cannot buy two changes. */
  token: string;
}): Promise<ChangeConfirmResult> {
  const loaded = await loadAuthorised(input.orderId, input.auth);
  if ('error' in loaded) {
    return loaded.error === 'forbidden'
      ? { status: 'forbidden' }
      : { status: 'unavailable', message: 'Booking not found.' };
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { status: 'unavailable', message: 'Booking storage isn’t configured.' };
  }

  /* Claim the token before anything else. An insert that conflicts means this
     change is already in flight, and the second attempt must not proceed. */
  const { error: claimError } = await supabase
    .from('order_changes')
    .insert({
      token: input.token,
      order_id: input.orderId,
      duffel_order_change_offer_id: input.offerId,
      status: 'awaiting_payment',
    });

  if (claimError) {
    return {
      status: 'stale',
      message: 'That change is already being processed. Give it a moment.',
    };
  }

  try {
    const change = await createOrderChange(input.offerId);
    const currency = change.change_total_currency ?? loaded.row.charged_currency ?? 'GBP';
    const breakdown = calculateChangeCharge(change.change_total_amount ?? '0.00', currency);

    await supabase
      .from('order_changes')
      .update({
        duffel_order_change_id: change.id,
        airline_amount: breakdown.airlineAmount,
        handling_fee: breakdown.handlingFee,
        charge_amount: breakdown.chargeAmount,
        currency: breakdown.currency,
        updated_at: new Date().toISOString(),
      })
      .eq('token', input.token);

    /* Nothing owed: confirm straight away. Holding a free change behind a
       payment step would be inventing friction. */
    if (Number(breakdown.chargeAmount) === 0) {
      await confirmOrderChange({ orderChangeId: change.id });
      await supabase
        .from('order_changes')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('token', input.token);

      if (breakdown.refundAmount) {
        return {
          status: 'refund_due',
          amount: breakdown.refundAmount,
          currency: breakdown.currency,
          refundTo: change.refund_to ?? null,
        };
      }
      return { status: 'changed', charged: '0.00', currency: breakdown.currency };
    }

    const intent = await createPaymentIntent({
      amount: breakdown.chargeAmount,
      currency: breakdown.currency,
    });

    await supabase
      .from('order_changes')
      .update({ payment_intent_id: intent.id, updated_at: new Date().toISOString() })
      .eq('token', input.token);

    return {
      status: 'needs_payment',
      token: input.token,
      clientToken: intent.client_token,
      amount: breakdown.chargeAmount,
      currency: breakdown.currency,
    };
  } catch (error) {
    await supabase
      .from('order_changes')
      .update({
        status: 'failed',
        failure_reason: 'change_quote_failed',
        updated_at: new Date().toISOString(),
      })
      .eq('token', input.token);

    return {
      status: 'unavailable',
      message:
        error instanceof Error
          ? error.message
          : 'The airline wouldn’t hold that change. Nothing has been charged.',
    };
  }
}

/** A fresh token for a change attempt. */
export function newChangeToken(): string {
  return randomUUID();
}
