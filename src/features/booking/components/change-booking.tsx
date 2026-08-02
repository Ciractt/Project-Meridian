'use client';

import dynamic from 'next/dynamic';
import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatDateLong, formatMoney } from '@/lib/format';
import { finishChange, getChangeOptions, startChange } from '../change-actions';
import type { ChangeCompletionResult, ChangeConfirmResult, ChangeQuoteResult } from '../order-change';

const DuffelPayments = dynamic(
  () => import('@duffel/components').then((module) => module.DuffelPayments),
  { ssr: false },
);

interface LegSummary {
  id: string;
  originCode: string;
  destinationCode: string;
  /** Airport-local calendar date. */
  departureDate: string;
}

/**
 * Moving a booked flight to another day.
 *
 * ## The journey this is built around
 *
 * Nobody arrives here pleased. They are here because a meeting moved or someone
 * is ill, they half-expect to be punished for it, and the number they are about
 * to see is usually bad news. Three things follow from that.
 *
 * **Show the cost before anything is committed, itemised.** The airline's
 * charge and our fee are separate lines the whole way through. A single "change
 * fee: £97" is the shape of a number designed not to be questioned, and it is
 * the exact thing this product exists not to do (ADR-038).
 *
 * **Say what is NOT changing.** The commonest fear at this screen is that
 * touching one leg will unpick the whole trip. Every step names the legs that
 * stay exactly as booked, because silence there reads as risk.
 *
 * **Say that nothing has happened yet.** Right up to the card, the original
 * booking is untouched and the copy says so. Someone who abandons this halfway
 * should never wonder whether they still have a flight.
 *
 * No urgency, no counts of remaining seats, no "prices may rise" (ADR-024).
 * A change is already stressful; manufacturing more would be indefensible here
 * in a way it is merely tacky on a search page.
 */
export function ChangeBooking({
  orderId,
  isOwner,
  legs,
}: {
  orderId: string;
  isOwner: boolean;
  /** Empty when the itinerary could not be loaded — see below. */
  legs: LegSummary[];
}) {
  const [options, optionsAction, loading] = useActionState<
    ChangeQuoteResult | null,
    FormData
  >(getChangeOptions, null);
  const [started, startAction, starting] = useActionState<
    ChangeConfirmResult | null,
    FormData
  >(startChange, null);
  const [finished, finishAction, finishing] = useActionState<
    ChangeCompletionResult | null,
    FormData
  >(finishChange, null);

  const [email, setEmail] = useState('');
  const [legId, setLegId] = useState(legs[0]?.id ?? '');
  const [date, setDate] = useState('');
  const [paid, setPaid] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /* One token per mount, reused across retries: a declined card followed by a
     second attempt is the same change, not two. Declared before any early
     return, because hooks cannot be conditional. */
  const [token] = useState(() => crypto.randomUUID());

  /* Without an itinerary we cannot say which leg is being replaced, and
     guessing would move the wrong flight. The booking page already degrades to
     null here when Duffel is unreachable. */
  if (legs.length === 0) return null;

  const leg = legs.find((candidate) => candidate.id === legId) ?? legs[0]!;
  const otherLegs = legs.filter((candidate) => candidate.id !== leg.id);

  if (finished?.status === 'changed') {
    return (
      <Panel tone="positive" title="Your flight has moved">
        You’re now on the {formatDateLong(date)} flight. We’ve emailed the updated
        booking. {formatMoney(finished.charged, finished.currency)} was charged.
      </Panel>
    );
  }

  if (finished?.status === 'needs_attention') {
    /* The worst outcome, and the copy is doing real work. They have paid, the
       flight has not moved, and the ticket they still hold is the one they were
       trying to leave. Saying "your original flight is still valid" is the
       difference between someone turning up and someone not. */
    return (
      <Panel tone="danger" title="We’ve taken payment but the change hasn’t gone through">
        <strong>Your original flight is still booked and still valid</strong> — travel
        on it as planned unless you hear from us. Someone here has been alerted and
        will either finish the change or refund you today, and will email you either
        way. Please don’t try again.
      </Panel>
    );
  }

  if (started?.status === 'refund_due') {
    return (
      <Panel tone="positive" title="Your flight has moved">
        The new flight costs less. {formatMoney(started.amount, started.currency)} is
        coming back to you
        {started.refundTo === 'airline_credits' || started.refundTo === 'voucher' ? (
          <>
            {' '}
            <strong>as airline credit rather than cash</strong> — the airline decides
            that, not us. They’ll send the details.
          </>
        ) : (
          <> on the card you paid with, usually within a few working days.</>
        )}
      </Panel>
    );
  }

  if (started?.status === 'changed') {
    return (
      <Panel tone="positive" title="Your flight has moved">
        The airline didn’t charge anything for this change, so neither did we.
        We’ve emailed the updated booking.
      </Panel>
    );
  }

  return (
    <details className="rounded-card border border-hairline bg-surface p-5">
      <summary className="cursor-pointer text-sm font-medium text-ink">
        Change a flight
      </summary>

      <div className="mt-4 space-y-4 text-sm">
        {started?.status === 'needs_payment' ? (
          <>
            <p className="text-ink-muted">
              {formatMoney(started.amount, started.currency)} to move your{' '}
              {leg.originCode}–{leg.destinationCode} flight to {formatDateLong(date)}.
            </p>
            {!paid ? (
              <DuffelPayments
                paymentIntentClientToken={started.clientToken}
                onSuccessfulPayment={() => setPaid(true)}
                onFailedPayment={(error: { message?: string }) =>
                  setNotice(error.message ?? 'That card was declined.')
                }
              />
            ) : (
              <form action={finishAction} className="space-y-3">
                <input type="hidden" name="orderId" value={orderId} />
                <input type="hidden" name="token" value={started.token} />
                <p role="status" className="text-ink-muted">
                  Payment received. Moving your flight with the airline — please don’t
                  close this page.
                </p>
                <Button type="submit" loading={finishing}>
                  Finish the change
                </Button>
              </form>
            )}
            {finished?.status === 'not_paid' ? (
              <p className="text-danger">{finished.message}</p>
            ) : null}
            {notice ? <p className="text-danger">{notice}</p> : null}
          </>
        ) : options?.status === 'ok' ? (
          <>
            <p className="text-ink-muted">
              {leg.originCode}–{leg.destinationCode} on {formatDateLong(date)}.{' '}
              {otherLegs.length > 0 ? (
                <>
                  Your{' '}
                  {otherLegs
                    .map((other) => `${other.originCode}–${other.destinationCode}`)
                    .join(' and ')}{' '}
                  flight stays exactly as booked.
                </>
              ) : null}{' '}
              Nothing has changed yet.
            </p>

            <ul className="space-y-2">
              {options.options.map((option) => (
                <li key={option.offerId}>
                  <form action={startAction} className="rounded-card border border-hairline p-4">
                    <input type="hidden" name="orderId" value={orderId} />
                    <input type="hidden" name="email" value={isOwner ? '' : email} />
                    <input type="hidden" name="offerId" value={option.offerId} />
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="sliceId" value={leg.id} />
                    <input type="hidden" name="origin" value={leg.originCode} />
                    <input type="hidden" name="destination" value={leg.destinationCode} />
                    <input type="hidden" name="departureDate" value={date} />

                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                      <span className="tabular-nums font-semibold">
                        {option.departingAt
                          ? new Date(option.departingAt).toISOString().slice(11, 16)
                          : '—'}
                        {option.arrivingAt
                          ? ` – ${new Date(option.arrivingAt).toISOString().slice(11, 16)}`
                          : ''}
                        <span className="ml-2 text-xs font-normal text-ink-faint">
                          {option.stops === 0
                            ? 'Direct'
                            : `${option.stops} stop${option.stops > 1 ? 's' : ''}`}
                        </span>
                      </span>
                      <span className="tabular-nums text-base font-semibold text-accent">
                        {option.refundAmount
                          ? `−${formatMoney(option.refundAmount, option.currency)}`
                          : formatMoney(option.chargeAmount, option.currency)}
                      </span>
                    </div>

                    {/* Itemised the whole way. The airline's charge and our fee
                        are different things and stay different things. */}
                    <dl className="mt-3 space-y-1 text-xs text-ink-muted">
                      <Row
                        term={
                          Number(option.airlineAmount) < 0
                            ? 'Airline refund'
                            : 'Airline change cost'
                        }
                        value={formatMoney(
                          Math.abs(Number(option.airlineAmount)).toFixed(2),
                          option.currency,
                        )}
                      />
                      {Number(option.handlingFee) > 0 ? (
                        <Row
                          term="Our handling fee"
                          value={formatMoney(option.handlingFee, option.currency)}
                        />
                      ) : null}
                    </dl>

                    {option.refundAmount ? (
                      <p className="mt-2 text-xs text-ink-muted">
                        This one costs less than what you booked.
                        {option.refundTo === 'airline_credits' ||
                        option.refundTo === 'voucher'
                          ? ' The airline returns the difference as credit, not cash.'
                          : ''}
                      </p>
                    ) : null}
                    {Number(option.chargeAmount) === 0 && !option.refundAmount ? (
                      <p className="mt-2 text-xs text-positive">
                        Free — the airline isn’t charging for this, so neither are we.
                      </p>
                    ) : null}

                    <Button type="submit" variant="secondary" loading={starting} className="mt-3">
                      {Number(option.chargeAmount) > 0 ? 'Pay and change' : 'Change to this'}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <form action={optionsAction} className="space-y-4">
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="origin" value={leg.originCode} />
            <input type="hidden" name="destination" value={leg.destinationCode} />

            {legs.length > 1 ? (
              <label className="block">
                <span className="block text-xs font-medium text-ink-faint">
                  Which flight?
                </span>
                <select
                  name="sliceId"
                  value={legId}
                  onChange={(event) => setLegId(event.target.value)}
                  className="mt-1 w-full rounded-control border border-hairline-strong bg-surface px-3 py-2 text-sm"
                >
                  {legs.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.originCode}–{candidate.destinationCode},{' '}
                      {formatDateLong(candidate.departureDate)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="sliceId" value={leg.id} />
            )}

            <label className="block">
              <span className="block text-xs font-medium text-ink-faint">
                New date for this flight
              </span>
              <input
                type="date"
                name="departureDate"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
                className="mt-1 w-full rounded-control border border-hairline-strong bg-surface px-3 py-2 text-sm"
              />
            </label>

            {!isOwner ? (
              <label className="block">
                <span className="block text-xs font-medium text-ink-faint">
                  The email this booking was made with
                </span>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="mt-1 w-full rounded-control border border-hairline-strong bg-surface px-3 py-2 text-sm"
                />
              </label>
            ) : null}

            <p className="text-xs text-ink-muted">
              We’ll ask the airline what’s available and what it costs.{' '}
              {otherLegs.length > 0
                ? 'Only this flight changes — the rest of your trip stays as booked. '
                : ''}
              Looking is free and nothing changes until you say so.
            </p>

            <Button type="submit" variant="secondary" loading={loading}>
              See what’s available
            </Button>

            {options ? (
              <p
                className={
                  options.status === 'forbidden' ? 'text-danger' : 'text-ink-muted'
                }
              >
                {options.status === 'forbidden'
                  ? 'That email doesn’t match this booking.'
                  : options.message}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </details>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt>{term}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function Panel({
  tone,
  title,
  children,
}: {
  tone: 'positive' | 'danger';
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-card border p-5 ${
        tone === 'positive'
          ? 'border-positive/40 bg-positive-wash'
          : 'border-danger bg-surface'
      }`}
    >
      <h2 className="font-display text-base font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{children}</p>
    </section>
  );
}
