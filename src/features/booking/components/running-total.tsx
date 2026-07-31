'use client';

import { formatMoney } from '@/lib/format';
import { fromMinorUnits, toMinorUnits } from '../money';
import { useCheckoutTotals } from '../checkout-totals';

/**
 * The headline figure, with anything the traveller has added folded in.
 *
 * Two client leaves inside an otherwise server-rendered panel, rather than
 * making the whole 80-line panel a client component. The fare breakdown, the
 * baggage summary, the conditions and the expiry are all static for the life
 * of the page and there is no reason to ship them to the browser to re-render.
 * Only the numbers that move need to move.
 */
export function RunningTotal({
  baseAmount,
  currency,
}: {
  baseAmount: string;
  currency: string;
}) {
  const { extrasMinor, extrasCurrency } = useCheckoutTotals();
  const base = toMinorUnits(baseAmount);

  /* Mixed currencies would need a conversion we have no rate for, so the
     extras stay out of the sum and ExtrasLine shows them on their own. */
  const combinable =
    base !== null && extrasMinor !== null && extrasCurrency === currency;

  return (
    <p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-chart">
      {combinable
        ? formatMoney(fromMinorUnits(base + extrasMinor), currency)
        : formatMoney(baseAmount, currency)}
    </p>
  );
}

/**
 * The extras as their own line in the breakdown, so the headline figure moving
 * is explained rather than mysterious.
 */
export function ExtrasLine({ currency }: { currency: string }) {
  const { extrasMinor, extrasCurrency } = useCheckoutTotals();
  if (extrasMinor === null || extrasMinor === 0) return null;

  const amount = formatMoney(
    fromMinorUnits(extrasMinor),
    extrasCurrency ?? currency,
  );

  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-muted">Bags and seats</dt>
      <dd className="font-mono">+{amount}</dd>
    </div>
  );
}

/**
 * Replaces the "flights only" caveat once something is actually selected —
 * at that point the figure above is no longer flights only, and saying so
 * would be the wrong way round.
 */
export function ExtrasCaveat() {
  const { extrasMinor } = useCheckoutTotals();
  if (extrasMinor !== null && extrasMinor > 0) {
    return (
      <p className="mt-1 text-xs text-ink-faint">
        Includes what you’ve added. Re-checked with the airline before you pay.
      </p>
    );
  }
  return (
    <p className="mt-1 text-xs text-ink-faint">
      Flights only. Anything you add is priced before you pay.
    </p>
  );
}
