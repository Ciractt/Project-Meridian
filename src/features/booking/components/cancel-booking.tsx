'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import { applyCancellation, getCancellationQuote } from '../cancel-actions';
import type { ConfirmResult, QuoteResult } from '../cancellation';

/**
 * Cancellation, quoted before committed.
 *
 * Deliberately behind a disclosure rather than a prominent button — nobody should
 * cancel a flight by mis-clicking — and deliberately two steps, because the
 * airline's refund is often far less than the fare and sometimes nothing, and a
 * traveller has to see that figure before it's irreversible.
 *
 * Guests must type the booking's contact email. The URL alone is enough to view a
 * booking; it should not be enough for a stranger to destroy a flight.
 */
export function CancelBooking({
  orderId,
  isOwner,
}: {
  orderId: string;
  isOwner: boolean;
}) {
  const [quote, quoteAction, quoting] = useActionState<QuoteResult | null, FormData>(
    getCancellationQuote,
    null,
  );
  const [confirmed, confirmAction, confirming] = useActionState<
    ConfirmResult | null,
    FormData
  >(applyCancellation, null);
  const [email, setEmail] = useState('');

  if (confirmed?.status === 'cancelled') {
    return (
      <Panel tone="positive" title="Your booking is cancelled">
        {Number(confirmed.refunded) > 0 ? (
          <>
            {formatMoney(confirmed.refunded, confirmed.currency)} is on its way back to
            the card you paid with. Card refunds usually take a few working days to
            appear.
          </>
        ) : (
          <>
            This fare was non-refundable, so no money is coming back. The booking is
            cancelled and you won’t be charged anything further.
          </>
        )}
      </Panel>
    );
  }

  if (confirmed?.status === 'cancelled_refund_pending') {
    return (
      <Panel tone="danger" title="Cancelled — refund being sorted">
        {confirmed.message} You don’t need to do anything; we’ll be in touch.
      </Panel>
    );
  }

  return (
    <details className="mt-6 rounded-card border border-hairline bg-surface">
      <summary className="cursor-pointer list-none px-6 py-4 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
        Cancel this booking
      </summary>

      <div className="border-t border-hairline px-6 py-5">
        {!quote || quote.status !== 'ok' ? (
          <form action={quoteAction} className="space-y-4">
            <input type="hidden" name="orderId" value={orderId} />

            <p className="text-sm leading-relaxed text-ink-muted">
              We’ll ask the airline what they’d refund and show you the figure before
              anything is cancelled. Getting a quote changes nothing.
            </p>

            {!isOwner ? (
              <div>
                <label
                  htmlFor="cancel-email"
                  className="block text-xs font-medium text-ink-faint"
                >
                  Confirm the email on this booking
                </label>
                <input
                  id="cancel-email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1.5 w-full max-w-sm rounded-control border border-hairline-strong bg-surface px-3 py-2.5 text-sm"
                />
                <p className="mt-1 text-xs text-ink-faint">
                  Anyone with this page’s link can see the booking. Cancelling it needs
                  the email address too.
                </p>
              </div>
            ) : null}

            {quote ? (
              <p role="alert" className="rounded-control bg-caution-wash p-3 text-sm text-caution">
                {quote.status === 'forbidden'
                  ? 'That email doesn’t match this booking.'
                  : quote.status === 'already_cancelled'
                    ? 'This booking has already been cancelled.'
                    : quote.status === 'not_cancellable'
                      ? quote.message
                      : quote.message}
              </p>
            ) : null}

            <Button type="submit" variant="secondary" loading={quoting}>
              Get a cancellation quote
            </Button>
          </form>
        ) : (
          <form action={confirmAction} className="space-y-4">
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="cancellationId" value={quote.cancellationId} />
            {!isOwner ? <input type="hidden" name="email" value={email} /> : null}

            <dl className="space-y-1.5 text-sm">
              <Row
                term="Airline refund"
                value={formatMoney(quote.airlineRefund, quote.currency)}
              />
              <Row
                term="Our fee (not refunded)"
                value={`− ${formatMoney(quote.feeRetained, quote.currency)}`}
              />
              <div className="flex justify-between gap-3 border-t border-hairline pt-1.5 font-medium text-ink">
                <dt>Back to your card</dt>
                <dd className="tabular-nums">
                  {formatMoney(quote.customerRefund, quote.currency)}
                </dd>
              </div>
            </dl>

            {quote.refundTo && quote.refundTo !== 'original_form_of_payment' ? (
              <p className="rounded-control bg-caution-wash p-3 text-sm text-caution">
                The airline is offering this as{' '}
                {quote.refundTo.replace(/_/g, ' ')} rather than money back. We’ll be in
                touch about how to use it.
              </p>
            ) : null}

            {confirmed ? (
              <p role="alert" className="rounded-control bg-chart-wash p-3 text-sm text-danger">
                {confirmed.status === 'stale'
                  ? 'That quote expired. Get a fresh one and the figures will be current.'
                  : confirmed.status === 'forbidden'
                    ? 'That email doesn’t match this booking.'
                    : confirmed.message}
              </p>
            ) : null}

            <p className="text-sm text-ink-muted">
              Cancelling can’t be undone, and the fare can’t be reinstated at this
              price afterwards.
            </p>

            <Button type="submit" variant="accent" loading={confirming}>
              Cancel booking and refund{' '}
              {formatMoney(quote.customerRefund, quote.currency)}
            </Button>
          </form>
        )}
      </div>
    </details>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-faint">{term}</dt>
      <dd className="tabular-nums text-ink-muted">{value}</dd>
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
      role="status"
      className={`mt-6 rounded-card border p-6 ${
        tone === 'positive'
          ? 'border-positive/30 bg-positive-wash'
          : 'border-danger bg-surface'
      }`}
    >
      <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{children}</p>
    </section>
  );
}
