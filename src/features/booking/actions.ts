'use server';

import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { getCurrentUser } from '@/features/auth/queries';
import { createOrder } from '@/services/duffel/orders';
import {
  confirmPaymentIntent,
  createPaymentIntent,
  createRefund,
  getPaymentIntent,
} from '@/services/duffel/payments';
import { DuffelUnavailableError } from '@/services/duffel/errors';
import type { DuffelOrderPassengerInput } from '@/services/duffel/api-types';
import {
  accountSignupSchema,
  bookingSchema,
  contactSchema,
  passengerSchema,
  requireIdentityDocuments,
} from './schema';
import { repriceOffer } from './repricing';
import { calculateCharge, chargeCoversFare, coversFare } from './pricing';
import { MIN_OFFER_WINDOW_MS } from './constants';
import { validateSelectedServices } from './services';
import { sendOrderConfirmationEmail } from './email';
import { z } from 'zod';

/* ------------------------------------------------------------------ *
 * Step 1 — start: validate, reprice, create the payment intent.      *
 * ------------------------------------------------------------------ */

export type StartOutcome =
  | { status: 'invalid'; errors: Record<string, string> }
  | { status: 'expired' }
  | { status: 'price_changed'; newAmount: string; currency: string }
  | { status: 'unavailable'; message: string }
  | { status: 'duplicate'; orderId: string }
  | { status: 'unconfigured' }
  | {
      status: 'ready';
      clientToken: string;
      chargeAmount: string;
      currency: string;
    };

export async function startBooking(raw: unknown): Promise<StartOutcome> {
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) return { status: 'invalid', errors: issuesToMap(parsed) };

  const input = parsed.data;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { status: 'unconfigured' };

  // Claim the attempt before anything expensive. The primary key on `token` is
  // what makes a double-click or a retried invocation harmless.
  const { error: claimError } = await supabase.from('booking_attempts').insert({
    token: input.attemptToken,
    offer_id: input.offerId,
    status: 'awaiting_payment',
    contact_email: input.contact.email,
  });

  if (claimError) {
    const { data: existing } = await supabase
      .from('booking_attempts')
      .select('status, order_id, payment_intent_id')
      .eq('token', input.attemptToken)
      .maybeSingle<{
        status: string;
        order_id: string | null;
        payment_intent_id: string | null;
      }>();

    if (existing?.order_id) return { status: 'duplicate', orderId: existing.order_id };

    /* A failed attempt is not an in-progress one, and telling someone to wait
       for something that has already stopped is a dead end: the token lives as
       long as the form is mounted, so every retry hits this branch and gets the
       same useless answer. They are stuck on the payment step with no way
       forward but a page reload nobody thinks to try.

       When the failure happened before a payment intent existed, nothing was
       charged and nothing is orphaned, so the attempt can simply be reopened
       and retried on the same token. That is the ordinary case — a Duffel
       timeout, a transient error — and it is the one that was unrecoverable. */
    if (existing?.status === 'failed' && !existing.payment_intent_id) {
      const { error: reopenError } = await supabase
        .from('booking_attempts')
        .update({
          status: 'awaiting_payment',
          failure_reason: null,
          completed_at: null,
        })
        .eq('token', input.attemptToken)
        .is('payment_intent_id', null);

      if (reopenError) {
        return {
          status: 'unavailable',
          message: 'That didn’t work. Start the booking again — nothing has been charged.',
        };
      }
      /* Fall through and try again. */
    } else if (existing?.status === 'failed') {
      /* An intent exists but never got bound to this attempt. Retrying could
         leave a second one, so this one stops here and says so plainly rather
         than inviting a retry that would compound it. */
      return {
        status: 'unavailable',
        message:
          'We stopped this booking before charging you. Please start again from the search results — nothing has been taken.',
      };
    } else {
      return {
        status: 'unavailable',
        message: 'This booking is already in progress. Give it a moment.',
      };
    }
  }

  const repriced = await repriceOffer(input.offerId);
  if (repriced.status === 'expired') {
    await closeAttempt(input.attemptToken, 'failed', 'offer_expired');
    return { status: 'expired' };
  }
  if (repriced.status === 'unavailable') {
    await closeAttempt(input.attemptToken, 'failed', 'supplier_unavailable');
    return { status: 'unavailable', message: repriced.message };
  }

  const { offer } = repriced;

  const agreed = z.string().safeParse((raw as { agreedAmount?: unknown })?.agreedAmount);
  if (agreed.success && Number(agreed.data) !== offer.totalAmountValue) {
    await closeAttempt(input.attemptToken, 'failed', 'price_changed');
    return {
      status: 'price_changed',
      newAmount: offer.totalAmount,
      currency: offer.currency,
    };
  }

  /* Card entry, 3DS and ticketing take a couple of minutes. Starting a payment
     against an offer with less runway than that manufactures the exact failure
     we would then have to refund. Refuse before charging instead. The countdown
     the traveller sees reads the same constant, so the two cannot disagree. */
  if (Date.parse(offer.expiresAt) - Date.now() < MIN_OFFER_WINDOW_MS) {
    await closeAttempt(input.attemptToken, 'failed', 'offer_window_too_short');
    return { status: 'expired' };
  }

  /* Whether documents are needed is the offer's answer, not the client's. A
     request that omits them for an offer that requires them is rejected here
     rather than by the airline after we've taken the money. */
  if (offer.identityDocumentsRequired) {
    const documentErrors = requireIdentityDocuments(input.passengers);
    if (Object.keys(documentErrors).length > 0) {
      await closeAttempt(input.attemptToken, 'failed', 'documents_missing');
      return { status: 'invalid', errors: documentErrors };
    }
  }

  /* Extras are priced by us, from Duffel's own figures. The browser sent IDs; it
     did not get to say what they cost. */
  const validated = await validateSelectedServices(offer.id, input.services);
  if (validated.status === 'invalid') {
    await closeAttempt(input.attemptToken, 'failed', 'services_invalid');
    return { status: 'unavailable', message: validated.message };
  }

  /* Priced from the supplier amount — `offer.totalAmount` is already the all-in
     figure and feeding it back in would apply our margin twice. */
  const charge = calculateCharge(
    offer.supplierAmount,
    offer.currency,
    validated.result.totalAmount,
  );

  try {
    const intent = await createPaymentIntent({
      amount: charge.chargeAmount,
      currency: charge.currency,
    });

    // Bind the money-relevant facts server-side. `completeBooking` reads the
    // offer and intent from this row, not from its arguments.
    const { error: bindError } = await supabase
      .from('booking_attempts')
      .update({
        payment_intent_id: intent.id,
        charge_amount: charge.chargeAmount,
        charge_currency: charge.currency,
        fare_amount: charge.fareAmount,
        extras_amount: charge.extrasAmount,
        // What the airline is owed. The coverage check after payment compares
        // against this, not the fare.
        supplier_amount: charge.supplierAmount,
        services: validated.result.services,
        updated_at: new Date().toISOString(),
      })
      .eq('token', input.attemptToken);

    /* This write is what binds the offer, the amount and the payment intent to
       this attempt. If it fails, `completeBooking` has nothing to work from — so
       failing here, before the card form is ever shown, is the only safe
       outcome. The payment intent is left unconfirmed and no money moves.
       Previously this error was unchecked, which let a traveller reach payment
       against an attempt we could no longer read. */
    if (bindError) {
      console.error('Could not bind payment intent to attempt:', bindError.message);
      await closeAttempt(input.attemptToken, 'failed', 'attempt_bind_failed');
      return {
        status: 'unavailable',
        message:
          'We couldn’t set up this booking safely, so we’ve stopped before taking payment. Nothing has been charged.',
      };
    }

    return {
      status: 'ready',
      clientToken: intent.client_token,
      chargeAmount: charge.chargeAmount,
      currency: charge.currency,
    };
  } catch (error) {
    /* Logged, because the traveller's message is deliberately vague and ours
       must not be. In live mode this is where "Duffel Payments isn't enabled"
       and "your balance is empty" arrive, and swallowing them leaves nothing to
       debug from but a timestamp. */
    console.error(
      'Could not start payment for attempt %s:',
      input.attemptToken,
      error instanceof Error ? error.message : error,
    );
    await closeAttempt(input.attemptToken, 'failed', 'payment_intent_failed');
    const message =
      error instanceof DuffelUnavailableError
        ? error.message
        : 'We couldn’t start the payment. Nothing has been charged — try again.';
    return { status: 'unavailable', message };
  }
}

/* ------------------------------------------------------------------ *
 * Step 2 — complete: verify payment, then ticket.                    *
 * ------------------------------------------------------------------ */

export type CompleteOutcome =
  | { status: 'invalid'; errors: Record<string, string> }
  | { status: 'not_paid'; message: string }
  | {
      status: 'refunded';
      reason: 'offer_gone' | 'fare_increased' | 'airline_declined';
      message: string;
    }
  | { status: 'needs_reconciliation' }
  | { status: 'unavailable'; message: string }
  | { status: 'booked'; orderId: string; reference: string | null };

const completeSchema = z.object({
  attemptToken: z.string().uuid(),
  contact: contactSchema,
  passengers: z.array(passengerSchema).min(1).max(9),
  /* Present only when the traveller ticked the box and had no session. On
     completeBooking rather than startBooking because this is the call that
     issues the ticket, and the account must not exist before the thing it is
     being opened for does. */
  createAccount: accountSignupSchema.optional(),
});

export async function completeBooking(raw: unknown): Promise<CompleteOutcome> {
  const parsed = completeSchema.safeParse(raw);
  if (!parsed.success) return { status: 'invalid', errors: issuesToMap(parsed) };

  const input = parsed.data;
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { status: 'unavailable', message: 'Booking storage isn’t configured.' };
  }

  const { data: attempt, error: attemptError } = await supabase
    .from('booking_attempts')
    .select(
      'offer_id, payment_intent_id, fare_amount, extras_amount, supplier_amount, charge_currency, status, order_id, services',
    )
    .eq('token', input.attemptToken)
    .maybeSingle<{
      offer_id: string;
      payment_intent_id: string | null;
      fare_amount: string | null;
      extras_amount: string | null;
      supplier_amount: string | null;
      charge_currency: string | null;
      status: string;
      order_id: string | null;
      services: Array<{ id: string; quantity: number }> | null;
    }>();

  /* Two very different situations that used to share one alarming message.
     A failed query is our infrastructure breaking, and it happens at a point
     where the traveller may already have paid — so it is a reconciliation case,
     not a shrug. */
  if (attemptError) {
    console.error('Could not read booking attempt:', attemptError.message);
    return { status: 'needs_reconciliation' };
  }
  if (!attempt) {
    // No row at all means startBooking never completed, so no payment intent was
    // ever created and nothing can have been charged.
    return {
      status: 'not_paid',
      message:
        'This booking wasn’t started properly, so nothing has been charged. Please search again.',
    };
  }
  // Already ticketed: return the same answer rather than booking again.
  if (attempt.order_id) {
    const { data: order } = await supabase
      .from('orders')
      .select('id, booking_reference')
      .eq('id', attempt.order_id)
      .maybeSingle<{ id: string; booking_reference: string | null }>();
    return {
      status: 'booked',
      orderId: order?.id ?? attempt.order_id,
      reference: order?.booking_reference ?? null,
    };
  }
  if (!attempt.payment_intent_id) {
    return { status: 'not_paid', message: 'No payment was started for this booking.' };
  }

  const intentId = attempt.payment_intent_id;

  // ---- Verify the payment independently of the client -----------------------
  //
  // <DuffelPayments onSuccessfulPayment> carries no data and runs in a browser.
  // It is a hint. Confirmation and a status read are the proof.
  let intent = await getPaymentIntent(intentId);

  if (intent.status !== 'succeeded') {
    try {
      intent = await confirmPaymentIntent(intentId);
    } catch {
      return {
        status: 'not_paid',
        message: 'The card payment didn’t complete. Nothing has been charged.',
      };
    }
  }

  if (intent.status !== 'succeeded') {
    return {
      status: 'not_paid',
      message: 'The card payment didn’t complete. Nothing has been charged.',
    };
  }

  // Money is now ours. From here, every failure path must refund.
  await patchAttempt(input.attemptToken, { status: 'paid_not_ticketed' });

  // ---- Re-price once more, now that we know what we hold -------------------
  const repriced = await repriceOffer(attempt.offer_id);

  if (repriced.status !== 'ok') {
    await refundEverything(input.attemptToken, intentId, intent.amount, intent.currency);
    return {
      status: 'refunded',
      reason: 'offer_gone',
      message: 'The airline withdrew this fare before we could issue the ticket.',
    };
  }

  const { offer } = repriced;

  /* Three-way check. `net_amount` can still be null moments after the intent
     reports `succeeded`, and refunding on that would throw away a good payment.
     When it's unknown we fall back to what we can prove from the charge we
     computed, and only refuse on positive evidence of a shortfall. */
  /* What the airline is owed is fare + extras. Comparing the payment against the
     fare alone would happily book a £60 bag we never collected for. The extras
     figure comes from our own row, priced at start. */
  const extras = Number(attempt.extras_amount ?? '0');
  // What the airline is owed: their fare plus their extras. Not the customer
  // total, which includes our fee and never reaches them.
  const supplierAmount = (Number(offer.supplierAmount) + extras).toFixed(2);

  const verdict = coversFare(intent.net_amount, supplierAmount);
  const shortfall =
    verdict === 'short' ||
    (verdict === 'unknown' && !chargeCoversFare(intent.amount, supplierAmount));

  if (shortfall) {
    // The fare rose past what we collected. Booking would sell below cost.
    await refundEverything(input.attemptToken, intentId, intent.amount, intent.currency);
    return {
      status: 'refunded',
      reason: 'fare_increased',
      message: 'The airline raised the fare above the amount you agreed.',
    };
  }

  if (verdict === 'unknown') {
    console.warn(
      'Payment intent %s succeeded without a net_amount; proceeded on the ' +
        'charge-covers-fare bound. Reconcile against Duffel settlement.',
      intentId,
    );
  }

  // ---- Ticket --------------------------------------------------------------
  const passengers: DuffelOrderPassengerInput[] = input.passengers.map((passenger) => ({
    id: passenger.id,
    title: passenger.title,
    given_name: passenger.givenName,
    family_name: passenger.familyName,
    born_on: passenger.bornOn,
    gender: passenger.gender,
    email: input.contact.email,
    phone_number: input.contact.phoneNumber,
    // Passed through, never persisted. This is the only place in the codebase
    // that touches a passport number, and it goes straight out again.
    ...(passenger.passportNumber && passenger.passportCountry && passenger.passportExpiry
      ? {
          identity_documents: [
            {
              type: 'passport' as const,
              unique_identifier: passenger.passportNumber,
              issuing_country_code: passenger.passportCountry,
              expires_on: passenger.passportExpiry,
            },
          ],
        }
      : {}),
  }));

  let created;
  try {
    created = await createOrder({
      offerId: offer.id,
      passengers,
      services: attempt.services ?? [],
      payment: {
        type: 'balance',
        currency: offer.currency,
        // Duffel requires this to equal the offer total plus every selected
        // service. Sending the fare alone is rejected outright.
        amount: supplierAmount,
      },
      metadata: { payment_intent_id: intentId, attempt_token: input.attemptToken },
    });
  } catch (error) {
    // A timeout is NOT a failure. The airline may have ticketed and we simply
    // didn't hear. Refunding here could give away a ticket we've paid for, and
    // retrying could sell two. This needs a human against Duffel's order list.
    if (error instanceof DuffelUnavailableError) {
      await patchAttempt(input.attemptToken, {
        status: 'needs_reconciliation',
        failure_reason: 'order_create_timeout',
      });
      return { status: 'needs_reconciliation' };
    }

    // A definite rejection. Refund.
    await refundEverything(input.attemptToken, intentId, intent.amount, intent.currency);
    return {
      status: 'refunded',
      reason: 'airline_declined',
      message:
        error instanceof Error ? error.message : 'The airline declined the booking.',
    };
  }

  /* A 202 is not a success and not a failure. The order may still confirm or
     fail, retrying could duplicate it, and refunding could give away a ticket
     we've paid for. Record the id, hand it to the reconciliation queue, and let
     the order.created / order.creation_failed webhook decide. */
  if (created.status === 'pending') {
    await patchAttempt(input.attemptToken, {
      status: 'needs_reconciliation',
      failure_reason: 'order_accepted_not_confirmed',
      duffel_order_id: created.orderId,
    });
    return { status: 'needs_reconciliation' };
  }

  const duffelOrder = created.order;

  // ---- Record it ----------------------------------------------------------
  const user = await getCurrentUser();
  const firstSlice = offer.slices[0];
  const lastSlice = offer.slices[offer.slices.length - 1];

  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: user?.id ?? null,
      duffel_order_id: duffelOrder.id,
      booking_reference: duffelOrder.booking_reference,
      origin: firstSlice?.originCode ?? offer.slices[0]?.originCode ?? '???',
      destination: firstSlice?.destinationCode ?? '???',
      departure_date: firstSlice?.segments[0]?.departingAt.slice(0, 10) ?? null,
      return_date:
        offer.slices.length > 1
          ? (lastSlice?.segments[0]?.departingAt.slice(0, 10) ?? null)
          : null,
      passenger_count: input.passengers.length,
      airline_name: offer.airline,
      total_amount: supplierAmount,
      total_currency: offer.currency,
      extras_amount: extras.toFixed(2),
      charged_amount: intent.amount,
      charged_currency: intent.currency,
      contact_email: input.contact.email,
      // Whether we supplied documents, not the documents themselves. Drives the
      // "add your passport with the airline" step on the confirmation.
      documents_provided: input.passengers.every(
        (passenger) => Boolean(passenger.passportNumber),
      ),
      status: 'confirmed',
    })
    .select('id')
    .single<{ id: string }>();

  if (orderError || !orderRow) {
    // The ticket exists. Our bookkeeping failed, which is our problem and not
    // the traveller's — never refund a valid ticket over a database error.
    console.error('Order created at Duffel but not recorded:', orderError?.message);
    await patchAttempt(input.attemptToken, {
      status: 'needs_reconciliation',
      failure_reason: 'order_not_recorded',
    });
    return {
      status: 'booked',
      orderId: duffelOrder.id,
      reference: duffelOrder.booking_reference,
    };
  }

  await patchAttempt(input.attemptToken, {
    status: 'completed',
    order_id: orderRow.id,
    completed_at: new Date().toISOString(),
  });

  /* Send the confirmation now the orders row exists. Claimed before sending so
     the order.created webhook — which fires for this order too — can't send a
     second copy. Cannot throw; a mail failure never touches a ticketed booking. */
  await sendOrderConfirmationEmail(orderRow.id);

  /* Account creation, if they asked for it. Deliberately last, deliberately
     after the ticket exists, and deliberately unable to affect any of the
     above: a payment that succeeded must never be undone by a signup that
     didn't. Supabase will not sign them in here — the address has to be
     confirmed first — so the booking stays attached by contact email until
     they follow the link, at which point signIn claims it. */
  if (!user && input.createAccount) {
    await createAccountForBooking(input.contact.email, input.createAccount.password);
  }

  /* Assistance requests, if any were made at checkout. After the order exists
     because they hang off it, and after ticketing because nothing here may
     interfere with issuing a ticket — an assistance request that fails to save
     is a support ticket, and a booking that fails because of one is a disaster.
     Article 6 says receive and transmit; this is the receive. */
  await recordCheckoutAssistance(orderRow.id, input.passengers);

  return {
    status: 'booked',
    orderId: orderRow.id,
    reference: duffelOrder.booking_reference,
  };
}

/* ---- helpers ---- */

/**
 * Save any assistance requests made during checkout.
 *
 * Never throws. A failure here logs and moves on: the traveller has a ticket,
 * and the request being lost is recoverable — they can make it again from the
 * booking page, and the confirmation tells them to ring the airline anyway.
 * Losing the booking over it would not be recoverable.
 *
 * The passenger label is the name they typed, which is the only identifier we
 * have: passenger names are not stored on the order (ADR-018), so without this
 * a request would say "someone on this booking needs a wheelchair".
 */
async function recordCheckoutAssistance(
  orderId: string,
  passengers: Array<{
    givenName: string;
    familyName: string;
    assistance?: { codes: string[]; notes?: string };
  }>,
) {
  for (const passenger of passengers) {
    const request = passenger.assistance;
    if (!request) continue;
    if (request.codes.length === 0 && !request.notes?.trim()) continue;

    try {
      const supabase = getSupabaseServiceClient();
      if (!supabase) return;
      const { error } = await supabase.from('assistance_requests').insert({
        order_id: orderId,
        passenger_label: `${passenger.givenName} ${passenger.familyName}`.trim(),
        codes: request.codes,
        notes: request.notes?.trim() || null,
      });
      if (error) {
        console.error('Could not save assistance request at checkout:', error.message);
      }
    } catch (cause) {
      console.error('Could not save assistance request at checkout:', cause);
    }
  }
}

/**
 * Open an account off the back of a booking.
 *
 * Never throws and never reports failure to the caller. Everything that can go
 * wrong here — a weak password, an address that already has an account, rate
 * limiting, Supabase being down — happens *after* a ticket has been issued and
 * paid for, and none of it is a reason to trouble someone who has just bought
 * a flight. They keep the booking either way and can sign up later from any
 * page.
 *
 * An address that already has an account is the ordinary case rather than an
 * error: Supabase returns a decoy user rather than confirming the address is
 * taken, and it should stay that way. Enumeration is exactly as bad on this
 * form as on the sign-up page.
 */
async function createAccountForBooking(email: string, password: string) {
  try {
    /* Imported here rather than at the top of the file. The server client reads
       its config at module load and throws when it is absent, so a static
       import makes this whole module — and every test that touches booking
       logic — depend on Supabase env being set. It caught exactly that. */
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.error('Could not create account after booking:', error.message);
    }
  } catch (cause) {
    console.error('Could not create account after booking:', cause);
  }
}

function issuesToMap(parsed: {
  error: { issues: Array<{ path: Array<string | number | symbol>; message: string }> };
}): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    errors[issue.path.join('.')] ??= issue.message;
  }
  return errors;
}

async function patchAttempt(
  token: string,
  patch: Record<string, string | null>,
): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;
  const { error } = await supabase
    .from('booking_attempts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('token', token);
  if (error) console.error('Could not update booking attempt:', error.message);
}

async function closeAttempt(
  token: string,
  status: string,
  reason: string,
): Promise<void> {
  await patchAttempt(token, {
    status,
    failure_reason: reason,
    completed_at: new Date().toISOString(),
  });
}

/**
 * The compensating action. Called on every path where money has been taken and
 * no ticket exists.
 *
 * If the refund itself fails the attempt stays `paid_not_ticketed`, which the
 * admin dashboard surfaces as needing a human. A traveller who has paid and has
 * no ticket must never be silently dropped.
 */
async function refundEverything(
  token: string,
  paymentIntentId: string,
  amount: string,
  currency: string,
): Promise<void> {
  try {
    const refund = await createRefund({ paymentIntentId, amount, currency });
    await patchAttempt(token, {
      status: 'failed',
      failure_reason: 'refunded',
      refund_id: refund.id,
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('REFUND FAILED — manual action required:', paymentIntentId, error);
    await patchAttempt(token, {
      status: 'paid_not_ticketed',
      failure_reason: 'refund_failed',
    });
  }
}
