import { RouteLine } from '@/components/route-line';
import { cn } from '@/lib/cn';
import { dayOffset, formatDuration, formatLocalTime, formatMoney } from '@/lib/format';
import type { Offer, Slice } from '../types';
import { AirlineLogo } from './airline-logo';
import {
  BaggageSummary,
  FareBrand,
  FareConditionsSummary,
} from './fare-details';
import { TripDetailsDialog } from './trip-details-dialog';

/** A layover this long is worth warning about before someone books it. */
const LONG_LAYOVER_MINUTES = 240;

export function OfferCard({
  offer,
  travellers,
  badge,
}: {
  offer: Offer;
  travellers: number;
  badge?: string;
}) {
  const base = offer.baseAmount ? Number(offer.baseAmount) : null;
  const tax = offer.taxAmount ? Number(offer.taxAmount) : null;
  const perTraveller = offer.totalAmountValue / travellers;

  return (
    <article
      className={cn(
        'overflow-hidden rounded-card border bg-surface transition-colors',
        badge ? 'border-chart' : 'border-hairline hover:border-hairline-strong',
      )}
    >
      {badge ? (
        <p className="bg-chart px-4 py-1.5 text-[10px] font-semibold tracking-[0.1em] text-white uppercase">
          {badge}
        </p>
      ) : null}

      <div className="flex flex-col md:flex-row">
        {/* Outbound and return read better beside each other than stacked —
            you compare the two halves of the trip in one movement rather than
            two. Only from `xl`, because each leg needs roughly 380px before the
            route line collapses to nothing, and below that the list column has
            about 800px to share with a filter rail. */}
        <div
          className={cn(
            'grid min-w-0 flex-1 gap-5 p-4 sm:p-5',
            offer.slices.length > 1 && 'xl:grid-cols-2 xl:gap-6',
          )}
        >
          {offer.slices.map((slice, index) => (
            /* The rule belongs to the second leg rather than to the grid:
               `divide-x` hangs it off the trailing edge of the first column, so
               the gap lands entirely on one side of it. Owning it here gives it
               the same air either side. */
            <div
              key={slice.id}
              className={cn(
                'min-w-0',
                index > 0 &&
                  'xl:border-l xl:border-dashed xl:border-hairline-strong xl:pl-6',
              )}
            >
              <SliceRow slice={slice} />
            </div>
          ))}
        </div>

        <div className="shrink-0 border-t border-hairline bg-paper/60 p-4 sm:p-5 md:w-56 md:border-t-0 md:border-l">
          <p className="font-mono text-2xl leading-none font-semibold tracking-tight text-chart">
            {formatMoney(offer.totalAmount, offer.currency)}
          </p>

          {/* What the price buys, next to the price. Without this, "total price"
              is only true until someone needs a bag. */}
          <div className="mt-2 space-y-0.5">
            <FareBrand
              name={offer.slices[0]?.fareBrandName ?? null}
              cabin={offer.slices[0]?.cabinName ?? null}
            />
            <BaggageSummary baggage={offer.baggage} />
            <FareConditionsSummary conditions={offer.conditions} />
          </div>

          {/* The full split, including our own fee. No comparison site itemises
              what it takes; naming it is the point of the product. The three lines
              sum exactly to the figure above, which is the test of whether a
              breakdown is honest. */}
          <dl className="mt-3 space-y-1 border-t border-hairline pt-3 text-xs">
            {travellers > 1 ? (
              <div className="flex justify-between gap-2">
                <dt className="text-ink-faint">Per traveller</dt>
                <dd className="font-mono text-ink-muted">
                  {formatMoney(perTraveller.toFixed(2), offer.currency)}
                </dd>
              </div>
            ) : null}
            {base !== null ? (
              <div className="flex justify-between gap-2">
                <dt className="text-ink-faint">Airline fare</dt>
                <dd className="font-mono text-ink-muted">
                  {formatMoney(offer.baseAmount ?? '0', offer.currency)}
                </dd>
              </div>
            ) : null}
            {tax !== null ? (
              <div className="flex justify-between gap-2">
                <dt className="text-ink-faint">Taxes and charges</dt>
                <dd className="font-mono text-ink-muted">
                  {formatMoney(offer.taxAmount ?? '0', offer.currency)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-2">
              <dt className="text-ink-faint">Our fee</dt>
              <dd className="font-mono text-ink-muted">
                {formatMoney(offer.feeAmount, offer.currency)}
              </dd>
            </div>
          </dl>

          {/* Select opens the full itinerary rather than jumping straight to
              checkout. Nobody should commit to a flight from a summary — the
              terminals, layover times and operating carrier are all things worth
              seeing before the page changes underneath you. */}
          <TripDetailsDialog offer={offer} travellers={travellers} />
          <p className="mt-2 text-center text-[11px] text-ink-faint">
            {travellers === 1 ? 'Total price' : `Total for ${travellers} travellers`}
          </p>
        </div>
      </div>
    </article>
  );
}

function SliceRow({ slice }: { slice: Slice }) {
  const first = slice.segments[0];
  const last = slice.segments[slice.segments.length - 1];
  if (!first || !last) return null;

  // From the slice, which counts technical stops as well as connections.
  const stops = slice.stopCount;
  const offset = dayOffset(first.departingAt, last.arrivingAt);
  const longLayover = slice.layoverMinutes.some((m) => m >= LONG_LAYOVER_MINUTES);

  /* US DOT rules require the operating carrier to be shown prominently
     wherever an offer is first presented, so codeshares surface here rather
     than behind a details view. */
  /* Grouped by operating carrier rather than listed per segment. A two-leg
     journey wholly operated by one partner produced two near-identical chips,
     which reads as noise; what the traveller needs to know is "this is actually
     KLM", once. Flight numbers stay listed in the detail view. */
  const operatedBy = [
    ...new Set(
      slice.segments
        .filter((segment) => segment.marketingCarrier !== segment.operatingCarrier)
        .map((segment) => segment.operatingCarrier),
    ),
  ];

  return (
    <div>
      <div className="flex items-center gap-4">
      <div className="w-24 shrink-0">
        <AirlineLogo
          src={first.marketingCarrierLockupUrl ?? first.marketingCarrierLogoUrl}
          name={first.marketingCarrier}
          code={first.marketingCarrierCode}
        />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
        <Time code={slice.originCode} time={formatLocalTime(first.departingAt)} />

        <div className="min-w-0 flex-1">
          <p className="mb-1 text-center font-mono text-[11px] text-ink-faint">
            {formatDuration(slice.durationMinutes)}
          </p>
          <RouteLine
            stops={stops}
            label={`${slice.originCode} to ${slice.destinationCode}, ${
              stops === 0 ? 'direct' : `${stops} stop${stops > 1 ? 's' : ''}`
            }`}
          />
          <p
            className={cn(
              'mt-1 truncate text-center font-mono text-[11px]',
              stops === 0 ? 'text-positive' : 'text-ink-faint',
            )}
          >
            {stops === 0 ? 'Direct' : describeStops(slice)}
          </p>
        </div>

        <Time
          code={slice.destinationCode}
          time={formatLocalTime(last.arrivingAt)}
          offset={offset}
        />
      </div>

      </div>

      {/* Aircraft and flight numbers on the result itself. A 787 and a 737 on the
          same route are not the same product, and neither is a turboprop — this is
          the kind of detail sites bury two clicks deep. */}
      {/* One row per segment, each labelled with the leg it describes.
          These were previously concatenated into a single line, so a two-leg
          journey read as an unbroken run of flight numbers and aircraft with no
          way to tell which belonged to which — and a three-stop itinerary would
          have been unreadable. */}
      <ul className="mt-2 space-y-0.5 pl-28 font-mono text-[11px] text-ink-faint">
        {slice.segments.map((segment) => (
          <li key={segment.id} className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-ink-muted">
              {segment.originCode}–{segment.destinationCode}
            </span>
            <span>{segment.flightNumber}</span>
            {segment.aircraft ? <span>· {segment.aircraft}</span> : null}
            {segment.originTerminal || segment.destinationTerminal ? (
              <span>
                · T{segment.originTerminal ?? '?'}→T{segment.destinationTerminal ?? '?'}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {longLayover || operatedBy.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-28">
          {longLayover ? (
            <Tag tone="caution">
              {formatDuration(Math.max(...slice.layoverMinutes))} in{' '}
              {slice.segments[0]?.destinationCode ?? 'transit'}
            </Tag>
          ) : null}
          {operatedBy.slice(0, 2).map((carrier) => (
            <Tag key={carrier} tone="airway">
              Operated by {carrier}
            </Tag>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Time({
  code,
  time,
  offset = 0,
}: {
  code: string;
  time: string;
  offset?: number;
}) {
  return (
    <div className="shrink-0">
      <p className="font-mono text-lg leading-none font-semibold tracking-tight">
        {time}
        {offset > 0 ? (
          <sup className="ml-0.5 text-[10px] font-medium text-caution">+{offset}</sup>
        ) : null}
      </p>
      <p className="mt-1 font-mono text-[11px] tracking-[0.1em] text-ink-faint">{code}</p>
    </div>
  );
}

function Tag({
  tone,
  children,
}: {
  tone: 'caution' | 'airway';
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-[11px]',
        tone === 'caution' ? 'bg-caution-wash text-caution' : 'bg-airway-wash text-airway',
      )}
    >
      {children}
    </span>
  );
}

/**
 * Names every stop, including technical ones.
 *
 * A technical stop keeps the same flight number, so it never appears as a separate
 * segment — meaning naive stop counting reports these flights as direct. Marking
 * them "(plane stops)" tells the traveller the thing they'd otherwise discover on
 * the day: the aircraft lands, and they don't get off.
 */
function describeStops(slice: Slice): string {
  const parts: string[] = [];

  slice.segments.forEach((segment, index) => {
    for (const stop of segment.technicalStops) {
      parts.push(`${stop} (plane stops)`);
    }
    // Every segment but the last ends at a connection point.
    if (index < slice.segments.length - 1) parts.push(segment.destinationCode);
  });

  return parts.join(' · ');
}
