import Link from 'next/link';
import { repriceOffer } from '@/features/booking/repricing';
import { BookingForm } from '@/features/booking/components/booking-form';
import type { PassengerDraft } from '@/features/booking/components/passenger-fields';
import { RouteLine } from '@/components/route-line';
import { toSearchParams } from '@/features/flight-search/schema';
import { getRawOffer } from '@/services/duffel/flights';
import { getSeatMaps } from '@/services/duffel/seat-maps';
import { extrasMarginRate } from '@/features/booking/pricing';
import { buildGuidance } from '@/features/booking/pre-travel';
import { PreTravelNotice } from '@/features/booking/components/pre-travel-panel';
import { FinancialProtectionNotice } from '@/components/financial-protection-notice';
import { AirlineLogo } from '@/features/flight-search/components/airline-logo';
import {
  BaggageSummary,
  FareBrand,
  FareConditionsSummary,
} from '@/features/flight-search/components/fare-details';
import {
  dayOffset,
  formatDuration,
  formatInstantTime,
  formatLocalTime,
  formatMoney,
} from '@/lib/format';
import { formatShort } from '@/lib/date';
import type { Slice } from '@/features/flight-search/types';

export const metadata = { title: 'Review and book' };

/**
 * Review page.
 *
 * Re-prices the offer on load, so the figure shown here is live rather than
 * whatever the results page had cached. If the fare moved, the traveller sees
 * the new one before entering any details — not after.
 */
export default async function BookPage({
  params,
}: {
  params: Promise<{ offerId: string }>;
}) {
  const { offerId } = await params;
  const repriced = await repriceOffer(offerId);

  if (repriced.status === 'expired') {
    return (
      <Notice title="This fare has expired.">
        Airline offers are only held for a few minutes. Nothing has been charged —
        search again and you’ll get current prices.
      </Notice>
    );
  }

  if (repriced.status === 'unavailable') {
    return (
      <Notice title="We couldn’t reach the airline.">
        {repriced.message} Nothing has been charged. Try again in a moment.
      </Notice>
    );
  }

  const { offer } = repriced;

  if (offer.passengers.length === 0) {
    return (
      <Notice title="We can’t collect traveller details for this fare.">
        The airline didn’t return passenger information with this offer, so it
        can’t be booked here. Nothing has been charged.
      </Notice>
    );
  }

  // Duffel's own passenger IDs, carried straight from the offer. Order creation
  // rejects anything else, so these are threaded through rather than generated.
  /**
   * Where an expired fare sends you: the same journey, priced now.
   *
   * Rebuilt from the offer's own slices rather than carried in the URL, so a
   * shared or bookmarked booking link still knows how to recover. Cabin isn't
   * on the offer, so economy is assumed — the traveller can adjust from the
   * search form.
   */
  const outbound = offer.slices[0];
  const inbound = offer.slices[1];
  const searchHref = outbound
    ? `/search?${toSearchParams({
        tripType: inbound ? 'return' : 'one-way',
        origin: outbound.originCode,
        destination: outbound.destinationCode,
        departureDate: outbound.segments[0]?.departingAt.slice(0, 10) ?? '',
        returnDate: inbound?.segments[0]?.departingAt.slice(0, 10),
        adults: offer.passengers.filter((p) => p.type === 'adult').length || 1,
        /* Ages aren't carried on the offer — only the types the airline assigned
           — so a recovery search can't reconstruct them. Falls back to no
           children, and the form asks again. Better than guessing an age. */
        childAges: [],
        cabin: 'economy',
        direct: 'false',
      }).toString()}`
    : '/';

  /**
   * Payloads for Duffel's ancillaries component, fetched in parallel.
   *
   * Both are allowed to fail: bags and seats are optional, and losing them must
   * not block a booking. Seat maps in particular are large and the endpoint is
   * not supported by every airline, so an empty result is normal rather than an
   * error.
   */
  const [rawOffer, seatMaps] = await Promise.all([
    getRawOffer(offer.id).catch((error) => {
      console.error('Could not load raw offer for ancillaries:', error);
      return null;
    }),
    getSeatMaps(offer.id).catch((error) => {
      // Not every airline supports seat maps, so an empty result is normal — but
      // a swallowed error is how you conclude nobody sells seats.
      console.error('Could not load seat maps:', error);
      return [];
    }),
  ]);

  const hasExtras =
    rawOffer !== null &&
    (offer.availableServices.length > 0 ||
      (Array.isArray(seatMaps) && seatMaps.length > 0));

  /* Entry requirements belong before payment as well as after. If a visa is
     needed, that might change whether someone books at all — telling them
     afterwards is close to useless.
     `documentsCollected` is true when the airline requires documents at booking,
     because in that case this form collects them. */
  const guidance = buildGuidance({
    slices: offer.slices,
    departureDate: outbound?.segments[0]?.departingAt.slice(0, 10) ?? '',
    documentsCollected: offer.identityDocumentsRequired,
  });

  const drafts: PassengerDraft[] = offer.passengers.map((passenger) => ({
    id: passenger.id,
    type: passenger.type,
    title: 'mr',
    givenName: '',
    familyName: '',
    bornOn: '',
    gender: 'f',
  }));

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <Link href="/" className="text-airway underline underline-offset-2">
          Search
        </Link>
        <span aria-hidden="true" className="mx-2 text-ink-faint">
          /
        </span>
        <span className="text-ink-muted">Review and book</span>
      </nav>

      <h1 className="font-display text-2xl font-extrabold tracking-tight">
        Check the details before you pay
      </h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-card border border-hairline bg-surface p-5">
            <h2 className="mb-4 font-display text-base font-bold tracking-tight">
              Your flights
            </h2>
            <div className="space-y-5">
              {offer.slices.map((slice) => (
                <SliceReview key={slice.id} slice={slice} />
              ))}
            </div>
          </section>

          <PreTravelNotice guidance={guidance} airlineName={offer.airline} />

          {/* Before payment, not after. Whether a booking is protected is
              information someone might act on. */}
          <FinancialProtectionNotice variant="checkout" />

          <BookingForm
            offerId={offer.id}
            passengers={drafts}
            amount={offer.totalAmount}
            expiresAt={offer.expiresAt}
            searchHref={searchHref}
            needsDocuments={offer.identityDocumentsRequired}
            rawOffer={rawOffer}
            seatMaps={seatMaps}
            hasExtras={hasExtras}
            extrasMarkupRate={extrasMarginRate()}
          />
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-card border border-hairline bg-surface p-5">
            <h2 className="font-display text-base font-bold tracking-tight">
              Price
            </h2>

            {repriced.changed ? (
              <p className="mt-3 rounded-control bg-caution-wash p-3 text-xs text-caution">
                The airline’s price changed since you searched. This is the current
                total.
              </p>
            ) : null}

            <p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-chart">
              {formatMoney(offer.totalAmount, offer.currency)}
            </p>

            <div className="mt-4 space-y-1.5 border-t border-hairline pt-4">
              <FareBrand
                name={offer.slices[0]?.fareBrandName ?? null}
                cabin={offer.slices[0]?.cabinName ?? null}
              />
              <BaggageSummary baggage={offer.baggage} />
              <FareConditionsSummary conditions={offer.conditions} />
            </div>

            <dl className="mt-4 space-y-1.5 border-t border-hairline pt-4 text-sm">
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
              <Row term="Travellers" value={String(offer.passengers.length)} />
            </dl>

            {offer.emissionsKg ? (
              <p className="mt-4 border-t border-hairline pt-4 text-xs text-ink-faint">
                Estimated{' '}
                <span className="font-mono">
                  {Math.round(Number(offer.emissionsKg))} kg
                </span>{' '}
                CO₂ for this itinerary, as reported by the airline.
              </p>
            ) : null}

            {offer.conditionsOfCarriageUrl ? (
              <p className="mt-3 text-xs text-ink-faint">
                <a
                  href={offer.conditionsOfCarriageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-airway underline underline-offset-2"
                >
                  {offer.airline}’s conditions of carriage
                </a>{' '}
                — the contract you’re entering into.
              </p>
            ) : null}

            <p className="mt-4 border-t border-hairline pt-4 text-xs text-ink-faint">
              Held until{' '}
              <span className="font-mono">{formatInstantTime(offer.expiresAt)}</span>.
              After that we re-check the live price before anything is charged.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SliceReview({ slice }: { slice: Slice }) {
  const first = slice.segments[0];
  const last = slice.segments[slice.segments.length - 1];
  if (!first || !last) return null;

  const stops = slice.segments.length - 1;

  return (
    <div className="border-b border-hairline pb-5 last:border-0 last:pb-0">
      <p className="mb-3 text-xs text-ink-muted">
        {formatShort(first.departingAt.slice(0, 10))} · {slice.originName} to{' '}
        {slice.destinationName}
      </p>

      <div className="flex items-center gap-4">
        <div className="w-24 shrink-0">
          <AirlineLogo
            src={first.marketingCarrierLockupUrl ?? first.marketingCarrierLogoUrl}
            name={first.marketingCarrier}
            code={first.marketingCarrierCode}
          />
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Time code={slice.originCode} time={formatLocalTime(first.departingAt)} />
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-center font-mono text-[11px] text-ink-faint">
              {formatDuration(slice.durationMinutes)}
            </p>
            <RouteLine stops={stops} />
            <p className="mt-1 text-center font-mono text-[11px] text-ink-faint">
              {stops === 0
                ? 'Direct'
                : slice.segments
                    .slice(0, -1)
                    .map((segment) => segment.destinationCode)
                    .join(' · ')}
            </p>
          </div>
          <Time
            code={slice.destinationCode}
            time={formatLocalTime(last.arrivingAt)}
            offset={dayOffset(first.departingAt, last.arrivingAt)}
          />
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-xs text-ink-faint">
        {slice.segments.map((segment) => (
          <li key={segment.id} className="font-mono">
            {segment.flightNumber} · {segment.originCode}–{segment.destinationCode}
            {segment.aircraft ? ` · ${segment.aircraft}` : ''}
            {segment.marketingCarrier !== segment.operatingCarrier
              ? ` · operated by ${segment.operatingCarrier}`
              : ''}
          </li>
        ))}
      </ul>
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
          <sup className="ml-0.5 text-[10px] text-caution">+{offset}</sup>
        ) : null}
      </p>
      <p className="mt-1 font-mono text-[11px] text-ink-faint">{code}</p>
    </div>
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

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-20 text-center">
      <p className="font-mono text-[11px] tracking-[0.18em] text-chart uppercase">
        Booking
      </p>
      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">
        {title}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-muted">{children}</p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-control bg-chart px-5 py-3 text-sm font-medium text-white"
      >
        New search
      </Link>
    </div>
  );
}
