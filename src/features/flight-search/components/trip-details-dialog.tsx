'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { RouteLine } from '@/components/route-line';
import { AirlineLogo } from './airline-logo';
import {
  BaggageSummary,
  FareBrand,
  FareConditionsSummary,
} from './fare-details';
import {
  dayOffset,
  formatDuration,
  formatLocalTime,
  formatMoney,
} from '@/lib/format';
import { formatShort } from '@/lib/date';
import type { Offer, Slice } from '../types';

/**
 * Full itinerary before committing to checkout.
 *
 * A result card has to stay scannable, so it carries times, stops, price and the
 * baggage headline. Everything else — flight numbers, aircraft, terminals,
 * layover lengths, the fee breakdown, emissions, the airline's own conditions —
 * lives here, one click away and without leaving the results.
 *
 * Native `<dialog>` rather than a hand-built overlay: focus trapping, Escape to
 * close, inert background and the top layer all come free and correct. A
 * hand-rolled modal gets the visuals right and the focus management wrong.
 */
export function TripDetailsDialog({
  offer,
  travellers,
}: {
  offer: Offer;
  travellers: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const perTraveller =
    travellers > 1 ? (Number(offer.totalAmount) / travellers).toFixed(2) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full text-center text-xs text-airway underline underline-offset-2 hover:no-underline"
      >
        Full details
      </button>

      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-labelledby="trip-details-heading"
        className="w-full max-w-2xl rounded-card bg-surface p-0 backdrop:bg-ink/50 open:animate-none"
      >
        <div className="flex items-center justify-between gap-4 border-b border-hairline px-6 py-4">
          <h2
            id="trip-details-heading"
            className="font-display text-lg font-bold tracking-tight"
          >
            Trip details
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close trip details"
            className="flex size-8 items-center justify-center rounded-full border border-hairline text-ink-muted hover:border-ink hover:text-ink"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
          {offer.slices.map((slice, index) => (
            <SliceDetail
              key={slice.id}
              slice={slice}
              label={index === 0 ? 'Outbound' : 'Return'}
            />
          ))}

          <section className="rounded-card border border-hairline bg-paper p-4">
            <h3 className="font-display text-sm font-bold tracking-tight">
              What the fare includes
            </h3>
            <div className="mt-2 space-y-1">
              <FareBrand
                name={offer.slices[0]?.fareBrandName ?? null}
                cabin={offer.slices[0]?.cabinName ?? null}
              />
              <BaggageSummary baggage={offer.baggage} />
              <FareConditionsSummary conditions={offer.conditions} />
            </div>

            {offer.conditionsOfCarriageUrl ? (
              <p className="mt-3 text-xs text-ink-faint">
                <a
                  href={offer.conditionsOfCarriageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-airway underline underline-offset-2"
                >
                  {offer.airline}’s conditions of carriage
                </a>
              </p>
            ) : null}
          </section>

          <section>
            <h3 className="mb-2 font-display text-sm font-bold tracking-tight">
              Price
            </h3>
            <dl className="space-y-1 text-sm">
              {offer.baseAmount ? (
                <Row
                  term="Airline fare"
                  value={formatMoney(offer.baseAmount, offer.currency)}
                />
              ) : null}
              {offer.taxAmount ? (
                <Row
                  term="Taxes and charges"
                  value={formatMoney(offer.taxAmount, offer.currency)}
                />
              ) : null}
              <Row term="Our fee" value={formatMoney(offer.feeAmount, offer.currency)} />
              <div className="flex justify-between gap-3 border-t border-hairline pt-1.5 font-medium text-ink">
                <dt>Total for {travellers === 1 ? '1 traveller' : `${travellers} travellers`}</dt>
                <dd className="font-mono">
                  {formatMoney(offer.totalAmount, offer.currency)}
                </dd>
              </div>
              {perTraveller ? (
                <Row
                  term="Per traveller"
                  value={formatMoney(perTraveller, offer.currency)}
                />
              ) : null}
            </dl>

            {offer.emissionsKg ? (
              <p className="mt-3 text-xs text-ink-faint">
                Estimated{' '}
                <span className="font-mono">
                  {Math.round(Number(offer.emissionsKg))} kg
                </span>{' '}
                CO₂ for this itinerary, as reported by the airline.
              </p>
            ) : null}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-6 py-4">
          <span className="font-mono text-xl font-semibold tracking-tight text-chart">
            {formatMoney(offer.totalAmount, offer.currency)}
          </span>
          <Link
            href={`/book/${offer.id}`}
            className="rounded-control bg-ink px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-muted"
          >
            Select this flight
          </Link>
        </div>
      </dialog>
    </>
  );
}

function SliceDetail({ slice, label }: { slice: Slice; label: string }) {
  const first = slice.segments[0];
  const last = slice.segments[slice.segments.length - 1];
  if (!first || !last) return null;

  return (
    <section className="rounded-card border border-hairline p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-bold tracking-tight">
          {label} · {slice.originName} to {slice.destinationName}
        </h3>
        <p className="font-mono text-xs text-ink-faint">
          {formatShort(first.departingAt.slice(0, 10))} ·{' '}
          {formatDuration(slice.durationMinutes)} ·{' '}
          {slice.stopCount === 0
            ? 'Direct'
            : `${slice.stopCount} stop${slice.stopCount > 1 ? 's' : ''}`}
        </p>
      </div>

      <ol className="space-y-3">
        {slice.segments.map((segment, index) => (
          <li key={segment.id}>
            <div className="flex items-center gap-3">
              <div className="w-20 shrink-0">
                <AirlineLogo
                  src={segment.marketingCarrierLockupUrl ?? segment.marketingCarrierLogoUrl}
                  name={segment.marketingCarrier}
                  code={segment.marketingCarrierCode}
                  size="sm"
                />
              </div>

              <div className="shrink-0 text-right">
                <p className="font-mono text-sm font-semibold">
                  {formatLocalTime(segment.departingAt)}
                </p>
                <p className="font-mono text-[11px] text-ink-faint">
                  {segment.originCode}
                  {segment.originTerminal ? ` T${segment.originTerminal}` : ''}
                </p>
              </div>

              <div className="min-w-0 flex-1">
                <p className="mb-1 text-center font-mono text-[11px] text-ink-faint">
                  {formatDuration(segment.durationMinutes)}
                </p>
                <RouteLine stops={segment.technicalStops.length} />
              </div>

              <div className="shrink-0">
                <p className="font-mono text-sm font-semibold">
                  {formatLocalTime(segment.arrivingAt)}
                  {dayOffset(segment.departingAt, segment.arrivingAt) > 0 ? (
                    <sup className="ml-0.5 text-[10px] text-caution">
                      +{dayOffset(segment.departingAt, segment.arrivingAt)}
                    </sup>
                  ) : null}
                </p>
                <p className="font-mono text-[11px] text-ink-faint">
                  {segment.destinationCode}
                  {segment.destinationTerminal ? ` T${segment.destinationTerminal}` : ''}
                </p>
              </div>
            </div>

            <p className="mt-1 pl-23 font-mono text-[11px] text-ink-faint">
              {segment.flightNumber}
              {segment.aircraft ? ` · ${segment.aircraft}` : ''}
              {segment.marketingCarrier !== segment.operatingCarrier
                ? ` · operated by ${segment.operatingCarrier}`
                : ''}
            </p>

            {/* Ground time between this segment and the next — the number that
                decides whether a connection is comfortable or a sprint. */}
            {index < slice.layoverMinutes.length ? (
              <p className="mt-2 rounded-control bg-paper px-3 py-1.5 text-xs text-ink-muted">
                {formatDuration(slice.layoverMinutes[index] ?? null)} in{' '}
                {segment.destinationCode}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-faint">{term}</dt>
      <dd className="font-mono text-ink-muted">{value}</dd>
    </div>
  );
}
