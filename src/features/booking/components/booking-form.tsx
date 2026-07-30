'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { completeBooking, startBooking } from '../actions';
import { PassengerFields, type PassengerDraft } from './passenger-fields';
import { PaymentStep } from './payment-step';
import { OfferCountdown } from './offer-countdown';
import { CheckoutSteps, type CheckoutStep } from './checkout-steps';
import { AncillariesStep } from './ancillaries-step';
import { MIN_OFFER_WINDOW_MS } from '../constants';
import type { SelectedService } from '../services';

type Stage =
  | { name: 'details' }
  | { name: 'extras' }
  | { name: 'payment'; clientToken: string; chargeAmount: string; currency: string }
  | { name: 'ticketing'; clientToken: string; chargeAmount: string; currency: string }
  /** Paid, ticket unconfirmed. Needs a human, and must not offer a retry. */
  | { name: 'stuck' };

/**
 * Checkout is two server round trips with one client step between them:
 *
 *   startBooking     → validate, reprice, create payment intent
 *   <DuffelPayments> → collect the card, handle 3DS
 *   completeBooking  → verify payment server-side, then ticket
 *
 * The attempt token is generated once per mount and sent with both calls. It is
 * what makes a double-click, a refresh or a retried request incapable of
 * producing two tickets.
 */
export function BookingForm({
  offerId,
  passengers: initial,
  amount,
  expiresAt,
  searchHref,
  needsDocuments,
  rawOffer,
  seatMaps,
  hasExtras,
  extrasMarkupRate,
}: {
  offerId: string;
  passengers: PassengerDraft[];
  /** The fare shown to the traveller, echoed back so the server can detect a
   *  price move. The amount actually charged is decided server-side. */
  amount: string;
  /** The airline's own offer expiry. Drives the countdown and the submit gate. */
  expiresAt: string;
  /** Same journey, fresh search — where an expired fare sends you. */
  searchHref: string;
  /** From the offer: this airline needs passport details at booking. */
  needsDocuments: boolean;
  /** Raw Duffel payloads for their ancillaries component. Vendor types by
   *  necessity — see AncillariesStep. */
  rawOffer: unknown;
  seatMaps: unknown;
  /** True when the airline offers anything to add. Skips the step when not. */
  hasExtras: boolean;
  /** Our extras margin, so displayed bag prices match what they add. */
  extrasMarkupRate: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [stage, setStage] = useState<Stage>({ name: 'details' });
  const [passengers, setPassengers] = useState<PassengerDraft[]>(initial);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: 'warn' | 'error'; text: string } | null>(
    null,
  );

  const [attemptToken] = useState(() => crypto.randomUUID());

  /* Gate the submit on the same runway the server enforces. Blocking here is
     the difference between "you'll need to refresh" and taking a payment we
     then have to refund. Once payment is in flight we leave it alone —
     completeBooking handles expiry from that point. */
  const [outOfTime, setOutOfTime] = useState(
    () => Date.parse(expiresAt) - Date.now() < MIN_OFFER_WINDOW_MS,
  );

  function submitDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setNotice(null);

    /* Extras come before the payment intent, because they change the amount.
       Nothing is validated server-side yet — that happens in `begin`, and any
       errors send us straight back here. */
    setStage(hasExtras ? { name: 'extras' } : { name: 'details' });
    if (hasExtras) return;
    begin([]);
  }

  function begin(services: SelectedService[]) {
    startTransition(async () => {
      const result = await startBooking({
        offerId,
        attemptToken,
        agreedAmount: amount,
        contact: { email, phoneNumber: phone },
        passengers,
        services,
      });

      switch (result.status) {
        case 'invalid':
          // Server-side validation runs after the extras step, so failures have
          // to send the traveller back to the fields they belong to.
          setStage({ name: 'details' });
          setErrors(result.errors);
          return;
        case 'ready':
          setStage({
            name: 'payment',
            clientToken: result.clientToken,
            chargeAmount: result.chargeAmount,
            currency: result.currency,
          });
          return;
        case 'expired':
          setNotice({
            tone: 'warn',
            text: 'This fare expired while you were filling the form. Nothing has been charged — search again for current prices.',
          });
          router.refresh();
          return;
        case 'price_changed':
          setNotice({
            tone: 'warn',
            text: `The airline’s price changed to ${formatMoney(result.newAmount, result.currency)}. Nothing has been charged. Reload to book at the new price.`,
          });
          return;
        case 'duplicate':
          setNotice({
            tone: 'warn',
            text: 'This booking has already gone through. Check your account before trying again.',
          });
          return;
        case 'unconfigured':
          setNotice({
            tone: 'error',
            text: 'Bookings aren’t connected yet. Add SUPABASE_SECRET_KEY and run the migrations.',
          });
          return;
        default:
          setNotice({ tone: 'error', text: result.message });
      }
    });
  }

  function onPaid() {
    if (stage.name !== 'payment') return;
    setStage({ ...stage, name: 'ticketing' });
    setNotice(null);

    startTransition(async () => {
      const result = await completeBooking({
        attemptToken,
        contact: { email, phoneNumber: phone },
        passengers,
      });

      switch (result.status) {
        case 'booked':
          /* Navigate rather than swap state. Until now the booking reference
             existed only in React state — a refresh, a closed tab or a stray
             back button and it was gone, with no way for a guest to recover it.
             A real URL survives all three and can be bookmarked or sent on. */
          router.replace(`/booking/${result.orderId}`);
          return;
        case 'refunded':
          setStage({ name: 'details' });
          setNotice({
            tone: 'warn',
            // Say which of the three things happened. "The fare moved" was
            // covering a withdrawn fare, a price rise and an airline rejection,
            // and a traveller reading it can't tell whether to try again.
            text: `${result.message} Your payment has been refunded in full and usually clears within a few working days.${
              result.reason === 'fare_increased'
                ? ' Search again to see the current price.'
                : ' Search again to find another flight.'
            }`,
          });
          return;
        case 'needs_reconciliation':
          setStage({ name: 'stuck' });
          return;
        case 'not_paid':
          setStage({ ...stage, name: 'payment' });
          setNotice({ tone: 'warn', text: result.message });
          return;
        case 'invalid':
          setStage({ name: 'details' });
          setErrors(result.errors);
          return;
        default:
          /* Any outcome we haven't named still has to leave the 'ticketing'
             stage. Staying in it disables the panel and keeps showing "issuing
             your ticket" forever — a frozen page at the worst possible moment,
             which is exactly what happened. */
          setStage({ ...stage, name: 'payment' });
          setNotice({ tone: 'error', text: result.message });
      }
    });
  }

  const step: CheckoutStep =
    stage.name === 'details'
      ? 'details'
      : stage.name === 'extras'
        ? 'extras'
        : 'payment';

  if (stage.name === 'stuck') {
    return (
      <section
        role="alert"
        className="rounded-card border-2 border-danger bg-surface p-6"
      >
        <p className="font-mono text-[10px] tracking-[0.18em] text-danger uppercase">
          Action needed from us
        </p>
        <h2 className="mt-3 font-display text-xl font-extrabold tracking-tight">
          Your payment went through. Your ticket didn’t confirm.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          We lost contact with the airline part-way through issuing your ticket, so
          we can’t yet tell you whether it exists. We can, and we’re checking now.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          <strong>Please don’t book this flight again.</strong> If the ticket did
          issue, a second booking would charge you twice. We’ll email{' '}
          {email || 'you'} within a few hours either with your reference or with
          confirmation that your payment has been refunded in full.
        </p>
        <p className="mt-4 border-t border-hairline pt-4 text-xs text-ink-faint">
          This is on us to resolve, not you. There is nothing you need to do.
        </p>
      </section>
    );
  }

  if (stage.name === 'extras') {
    return (
      <div className="space-y-4">
        <CheckoutSteps current="extras" includeExtras={hasExtras} />
        {notice ? <Notice notice={notice} /> : null}
        <OfferCountdown expiresAt={expiresAt} onExpire={() => setOutOfTime(true)} />
        <AncillariesStep
          offer={rawOffer}
          seatMaps={seatMaps}
          passengers={passengers}
          markupRate={extrasMarkupRate}
          busy={isPending}
          onConfirm={(services) => begin(services)}
          onSkip={() => begin([])}
        />
      </div>
    );
  }

  if (stage.name === 'payment' || stage.name === 'ticketing') {
    return (
      <div className="space-y-4">
        <CheckoutSteps current="payment" includeExtras={hasExtras} />
        {notice ? <Notice notice={notice} /> : null}
        {stage.name === 'payment' ? <OfferCountdown expiresAt={expiresAt} /> : null}
        <PaymentStep
          clientToken={stage.clientToken}
          chargeAmount={stage.chargeAmount}
          currency={stage.currency}
          onPaid={onPaid}
          onFailed={(text) => setNotice({ tone: 'warn', text })}
          busy={stage.name === 'ticketing' || isPending}
        />
      </div>
    );
  }

  return (
    <form onSubmit={submitDetails} noValidate className="space-y-4">
      <CheckoutSteps current={step} includeExtras={hasExtras} />

      <OfferCountdown
        expiresAt={expiresAt}
        onExpire={() => setOutOfTime(true)}
      />

      {passengers.map((passenger, index) => (
        <PassengerFields
          key={passenger.id}
          index={index}
          passenger={passenger}
          errors={errors}
          needsDocuments={needsDocuments}
          onChange={(patch) =>
            setPassengers((current) =>
              current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
            )
          }
        />
      ))}

      <fieldset className="rounded-card border border-hairline bg-surface p-5">
        <legend className="px-2 font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
          Contact
        </legend>
        <p className="mb-4 text-xs text-ink-muted">
          The airline uses these to reach you about delays, gate changes and
          cancellations.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="contact-email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            error={errors['contact.email']}
          />
          <TextField
            id="contact-phone"
            label="Mobile"
            type="tel"
            autoComplete="tel"
            placeholder="+447700900123"
            value={phone}
            onChange={setPhone}
            error={errors['contact.phoneNumber']}
          />
        </div>
      </fieldset>

      {notice ? <Notice notice={notice} /> : null}

      {outOfTime ? (
        <div className="rounded-card border border-chart/30 bg-chart-wash p-4">
          <p className="text-sm text-danger">
            The airline’s hold on this fare has run out, so we’ve stopped before
            taking any payment. Nothing has been charged.
          </p>
          <a
            href={searchHref}
            className="mt-3 inline-block rounded-control bg-chart px-4 py-2 text-sm font-medium text-white"
          >
            See the current price
          </a>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-faint">
          We re-check the live price before your card is charged.
        </p>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          loading={isPending}
          disabled={outOfTime}
        >
          Continue to payment
        </Button>
      </div>
    </form>
  );
}

function Notice({ notice }: { notice: { tone: 'warn' | 'error'; text: string } }) {
  return (
    <p
      role="alert"
      className={cn(
        'rounded-card p-4 text-sm',
        notice.tone === 'error'
          ? 'bg-chart-wash text-danger'
          : 'bg-caution-wash text-caution',
      )}
    >
      {notice.text}
    </p>
  );
}

function TextField({
  id,
  label,
  type,
  value,
  onChange,
  error,
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'mt-1.5 w-full rounded-control border bg-surface px-3 py-2.5 text-sm',
          error ? 'border-danger' : 'border-hairline-strong',
        )}
      />
      {error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
