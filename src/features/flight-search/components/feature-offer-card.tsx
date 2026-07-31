'use client';

import { AirlineLogo } from './airline-logo';
import { TripDetailsDialog } from './trip-details-dialog';
import { formatDuration, formatLocalTime, formatMoney } from '@/lib/format';
import { formatShort } from '@/lib/date';
import { cn } from '@/lib/cn';
import type { Offer, Slice } from '../types';

/**
 * One of the picks, as a ticket.
 *
 * Deliberately not OfferCard with a different class. That card is the list
 * row — wide, dense, every flight number and terminal on it. This one is a
 * third of the page across and has to stay legible at ~350px, so it carries
 * the shape of the journey and the price and nothing else. The detail is one
 * tap away in the same dialog the list card opens, so nothing is lost, and
 * two components that show different things are honester than one component
 * with a `variant` prop pretending they're the same thing.
 *
 * **Every card says why it is here.** A "selection" that doesn't name its
 * criterion is a ranking, and an unexplained ranking on a price comparison is
 * a regulatory problem rather than a design one (ADR-013). `labels` is
 * required and can hold more than one, because the cheapest flight is often
 * also the fastest and three identical cards read as a fault.
 */
export function FeatureOfferCard({
  offer,
  travellers,
  labels,
}: {
  offer: Offer;
  travellers: number;
  labels: string[];
}) {
  return (
    <article
      /* The notch is a mask, so it bites through the border and the background
         together — which is why its arc has no stroke, and why the footer is a
         fixed height: --notch-y has to land on the divider, and a divider that
         moves with its content would leave the bite floating above or below
         it. Everything in the footer truncates for the same reason. */
      className="ticket-notch flex flex-col rounded-card border border-hairline bg-surface transition-colors hover:border-hairline-strong"
      style={{ '--notch-y': 'calc(100% - 8rem)' } as React.CSSProperties}
    >
      <div className="flex-1 divide-y divide-hairline">
        {offer.slices.map((slice) => (
          <LegRow key={slice.id} slice={slice} />
        ))}
      </div>

      <div className="flex h-32 flex-col justify-between border-t border-hairline p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="flex min-w-0 flex-wrap gap-x-2 text-xs font-medium text-chart">
            {labels.map((label) => (
              <span key={label} className="truncate">
                {label}
              </span>
            ))}
          </p>
          <p className="shrink-0 font-mono text-xl leading-none font-semibold tracking-tight text-chart">
            {formatMoney(offer.totalAmount, offer.currency)}
          </p>
        </div>

        <p className="truncate text-right text-[11px] text-ink-faint">
          {travellers === 1 ? 'Total price' : `Total for ${travellers} travellers`} ·
          incl. {formatMoney(offer.feeAmount, offer.currency)} fee
        </p>

        <TripDetailsDialog offer={offer} travellers={travellers} />
      </div>
    </article>
  );
}

/**
 * A leg, compressed to what fits a third of the page: date, who flies it,
 * departure and arrival, and how long and how many stops.
 */
function LegRow({ slice }: { slice: Slice }) {
  const first = slice.segments[0];
  const last = slice.segments[slice.segments.length - 1];
  if (!first || !last) return null;

  const stops = slice.stopCount;

  return (
    <div className="p-4">
      <p className="text-xs text-ink-faint">
        {formatShort(first.departingAt.slice(0, 10))}
      </p>

      <div className="mt-2 flex items-center gap-3">
        <div className="w-9 shrink-0">
          <AirlineLogo
            src={first.marketingCarrierLogoUrl}
            name={first.marketingCarrier}
            code={first.marketingCarrierCode}
            size="sm"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-semibold text-ink">
            {formatLocalTime(first.departingAt)} – {formatLocalTime(last.arrivingAt)}
          </p>
          <p className="truncate font-mono text-[11px] text-ink-faint">
            {slice.originCode} – {slice.destinationCode}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-[11px] text-ink-faint">
            {formatDuration(slice.durationMinutes)}
          </p>
          <p
            className={cn(
              'font-mono text-[11px]',
              stops === 0 ? 'text-positive' : 'text-caution',
            )}
          >
            {stops === 0 ? 'Direct' : `${stops} stop${stops > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>
    </div>
  );
}
