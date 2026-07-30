'use client';

import { useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import { beginBagPurchase, finishBagPurchase, loadBagOptions } from '../bags-actions';
import type { BagOption } from '../services-purchase';

const DuffelPayments = dynamic(
  () => import('@duffel/components').then((module) => module.DuffelPayments),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-card border border-hairline bg-paper" />
    ),
  },
);

type Stage =
  | { name: 'closed' }
  | { name: 'choosing'; options: BagOption[] }
  | { name: 'paying'; clientToken: string; amount: string; currency: string }
  | { name: 'adding' }
  | { name: 'done'; message: string };

/**
 * Adding bags to a booking that already exists.
 *
 * Only offered when the airline actually sells them for this order — many fares
 * already include baggage, and Duffel returns nothing for those. An empty list is
 * a normal answer, so the section says so plainly rather than showing an empty
 * shell.
 *
 * The flow is the checkout flow in miniature, and for the same reasons: choose,
 * pay, then have the airline add them, with the price re-taken from the airline
 * server-side before the card is charged.
 */
export function AddBags({
  orderId,
  isOwner,
}: {
  orderId: string;
  isOwner: boolean;
}) {
  const [stage, setStage] = useState<Stage>({ name: 'closed' });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [token] = useState(() => crypto.randomUUID());

  function open() {
    setNotice(null);
    startTransition(async () => {
      const result = await loadBagOptions(orderId, isOwner ? undefined : email);
      if (result.status === 'ok') setStage({ name: 'choosing', options: result.options });
      else if (result.status === 'none')
        setNotice('This booking already includes baggage, so there’s nothing to add.');
      else if (result.status === 'forbidden')
        setNotice('That email doesn’t match this booking.');
      else setNotice(result.message);
    });
  }

  function pay() {
    const selections = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([id, quantity]) => ({ id, quantity }));

    if (selections.length === 0) {
      setNotice('Choose at least one bag.');
      return;
    }

    startTransition(async () => {
      const result = await beginBagPurchase({
        orderId,
        token,
        selections,
        email: isOwner ? undefined : email,
      });
      if (result.status === 'ready') {
        setStage({
          name: 'paying',
          clientToken: result.clientToken,
          amount: result.chargeAmount,
          currency: result.currency,
        });
      } else if (result.status === 'duplicate') {
        setNotice('That purchase is already going through.');
      } else if (result.status === 'forbidden') {
        setNotice('That email doesn’t match this booking.');
      } else {
        setNotice(result.message);
      }
    });
  }

  function onPaid() {
    setStage({ name: 'adding' });
    startTransition(async () => {
      const result = await finishBagPurchase(orderId, token);
      if (result.status === 'added' || result.status === 'refunded') {
        setStage({ name: 'done', message: result.message });
      } else if (result.status === 'needs_attention') {
        setStage({
          name: 'done',
          message:
            'Your payment went through but the airline hasn’t confirmed the bags. Don’t pay again — we’re checking and will email you.',
        });
      } else {
        setStage({ name: 'closed' });
        setNotice(result.message);
      }
    });
  }

  if (stage.name === 'done') {
    return (
      <section role="status" className="mt-6 rounded-card border border-positive/30 bg-positive-wash p-6">
        <h2 className="font-display text-base font-bold tracking-tight">Bags</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{stage.message}</p>
      </section>
    );
  }

  return (
    <details className="mt-6 rounded-card border border-hairline bg-surface">
      <summary className="cursor-pointer list-none px-6 py-4 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
        Add bags to this booking
      </summary>

      <div className="space-y-4 border-t border-hairline px-6 py-5">
        {notice ? (
          <p role="alert" className="rounded-control bg-caution-wash p-3 text-sm text-caution">
            {notice}
          </p>
        ) : null}

        {stage.name === 'closed' ? (
          <>
            <p className="text-sm leading-relaxed text-ink-muted">
              We’ll ask the airline what they’ll sell for this booking. Prices shown
              are what they add to your total — nothing else is applied afterwards.
            </p>
            {!isOwner ? (
              <div>
                <label
                  htmlFor="bags-email"
                  className="block font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase"
                >
                  Confirm the email on this booking
                </label>
                <input
                  id="bags-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1.5 w-full max-w-sm rounded-control border border-hairline-strong bg-surface px-3 py-2.5 text-sm"
                />
              </div>
            ) : null}
            <Button type="button" variant="secondary" loading={isPending} onClick={open}>
              See what’s available
            </Button>
          </>
        ) : null}

        {stage.name === 'choosing' ? (
          <>
            <ul className="space-y-2">
              {stage.options.map((option) => (
                <li
                  key={option.id}
                  className="flex items-center justify-between gap-4 border-b border-hairline pb-2 last:border-0"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">
                      {option.kind === 'checked' ? 'Checked bag' : 'Cabin bag'}
                      {option.maximumWeightKg ? ` · up to ${option.maximumWeightKg}kg` : ''}
                    </span>
                    <span className="block font-mono text-xs text-chart">
                      {formatMoney(option.price, option.currency)} each
                    </span>
                  </span>
                  <select
                    aria-label={`Quantity for ${option.kind} bag`}
                    value={quantities[option.id] ?? 0}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [option.id]: Number(event.target.value),
                      }))
                    }
                    className="rounded-control border border-hairline-strong bg-surface px-2 py-1.5 text-sm"
                  >
                    {Array.from({ length: option.maximumQuantity + 1 }, (_, n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            <Button type="button" variant="accent" loading={isPending} onClick={pay}>
              Continue to payment
            </Button>
          </>
        ) : null}

        {stage.name === 'paying' || stage.name === 'adding' ? (
          <>
            <p className="text-sm text-ink-muted">
              {formatMoney(
                stage.name === 'paying' ? stage.amount : '0',
                stage.name === 'paying' ? stage.currency : 'GBP',
              )}{' '}
              — the total for the bags you chose.
            </p>
            {stage.name === 'paying' ? (
              <DuffelPayments
                paymentIntentClientToken={stage.clientToken}
                onSuccessfulPayment={onPaid}
                onFailedPayment={(error) =>
                  setNotice(error.message ?? 'That card was declined.')
                }
              />
            ) : (
              <p role="status" className="text-sm text-ink-muted">
                Payment received. Adding the bags with the airline — don’t close this
                page.
              </p>
            )}
          </>
        ) : null}
      </div>
    </details>
  );
}
