'use client';

import dynamic from 'next/dynamic';
import { formatMoney } from '@/lib/format';

/**
 * Duffel's payment component, loaded client-side only.
 *
 * It mounts a Stripe-backed iframe, so it cannot be server-rendered. Loading it
 * dynamically also keeps it out of the bundle for everyone who never reaches
 * checkout, which is most visitors.
 *
 * `onSuccessfulPayment` takes no arguments — by design. It tells us the
 * traveller finished the form; it is not evidence that money moved. The server
 * confirms the payment intent and reads its status before creating any order.
 */
const DuffelPayments = dynamic(
  () => import('@duffel/components').then((module) => module.DuffelPayments),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-card border border-hairline bg-paper" />
    ),
  },
);

export function PaymentStep({
  clientToken,
  chargeAmount,
  currency,
  onPaid,
  onFailed,
  busy,
}: {
  clientToken: string;
  chargeAmount: string;
  currency: string;
  onPaid: () => void;
  onFailed: (message: string) => void;
  busy: boolean;
}) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-5">
      <h2 className="font-display text-base font-bold tracking-tight">Payment</h2>
      <p className="mt-1 mb-5 text-sm text-ink-muted">
        {formatMoney(chargeAmount, currency)} — the total you agreed, including taxes,
        airline charges and card fees. Nothing else will be added.
      </p>

      <div aria-busy={busy || undefined} className={busy ? 'pointer-events-none opacity-50' : ''}>
        <DuffelPayments
          paymentIntentClientToken={clientToken}
          onSuccessfulPayment={onPaid}
          onFailedPayment={(error) =>
            onFailed(
              error.message ??
                'Your card was declined. Nothing has been charged — try another card.',
            )
          }
        />
      </div>

      {busy ? (
        <p role="status" className="mt-4 text-sm text-ink-muted">
          Payment received. Issuing your ticket — don’t close this page.
        </p>
      ) : null}

      <p className="mt-5 border-t border-hairline pt-4 text-xs text-ink-faint">
        Card details go directly to our payment provider and never touch our
        servers. In test mode you must use a Duffel test card.
      </p>
    </section>
  );
}
