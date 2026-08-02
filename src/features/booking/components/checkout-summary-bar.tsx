import { formatMoney } from '@/lib/format';
import { formatShort } from '@/lib/date';

/**
 * What you are buying and what it costs, pinned to the bottom of the screen.
 *
 * Below `lg` the price panel is an `<aside>` that follows the form in source
 * order, so on a phone the total sits under a passenger form several screens
 * long: you fill the whole thing in without the figure ever being visible. For
 * a product whose headline is that the price is the price, having it off-screen
 * for the length of checkout is the wrong way round.
 *
 * `lg:hidden` because at that width the sticky aside already does this job, and
 * two totals on one screen is how they end up disagreeing.
 *
 * **The amount is passed in per stage rather than read once.** Extras change
 * what gets charged, so a bar wired to the offer total would keep saying £115
 * while payment took £142. `caption` says which figure this is; both have to
 * move together, which is why they are one prop each and not one component
 * deciding for itself.
 */
export function CheckoutSummaryBar({
  originCode,
  destinationCode,
  departureDate,
  returnDate,
  travellers,
  amount,
  currency,
  caption,
}: {
  originCode: string;
  destinationCode: string;
  /** `YYYY-MM-DD`, airport-local calendar dates — not instants. */
  departureDate: string;
  returnDate?: string;
  travellers: number;
  amount: string;
  currency: string;
  /** Which figure `amount` is. Never omitted — an unlabelled total on a screen
   *  where extras exist is the ambiguity this component was built to remove. */
  caption: string;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface shadow-[0_-4px_16px_-8px] shadow-ink/25 lg:hidden"
      /* Home indicator on iOS sits over the last ~34px. Without this the fee
         line is under it. */
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
        <div className="min-w-0">
          <p className="flex items-baseline gap-1.5 tabular-nums text-sm font-semibold">
            {originCode}
            <span aria-hidden="true" className="text-accent">
              →
            </span>
            {destinationCode}
          </p>
          <p className="mt-0.5 truncate tabular-nums text-[11px] text-ink-faint">
            {formatShort(departureDate)}
            {returnDate ? ` – ${formatShort(returnDate)}` : ''} ·{' '}
            {travellers === 1 ? '1 traveller' : `${travellers} travellers`}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="tabular-nums text-lg leading-none font-semibold tracking-tight text-accent">
            {formatMoney(amount, currency)}
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">{caption}</p>
        </div>
      </div>
    </div>
  );
}
