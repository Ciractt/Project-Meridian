import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getConfirmation } from '@/features/booking/confirmation';
import { getCurrentUser } from '@/features/auth/queries';
import { RouteLine } from '@/components/route-line';
import { formatMoney } from '@/lib/format';
import { formatFull } from '@/lib/date';
import { buildGuidance } from '@/features/booking/pre-travel';
import { PreTravelPanel } from '@/features/booking/components/pre-travel-panel';
import { CancelBooking } from '@/features/booking/components/cancel-booking';
import { FinancialProtectionNotice } from '@/components/financial-protection-notice';

export const metadata = { title: 'Your booking' };

/**
 * Booking confirmation, at a real URL.
 *
 * Previously this was React state on the checkout page, which meant a refresh, a
 * closed tab or a back button lost the booking reference — and for a guest with
 * no account, lost it permanently. A URL survives all three, can be bookmarked,
 * and is what a confirmation email will link to.
 */
export default async function BookingPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const user = await getCurrentUser();
  const booking = await getConfirmation(orderId, user?.id ?? null);

  if (!booking) notFound();

  /* Guidance needs the itinerary's country codes, which only the live order
     carries. When the fetch failed we show the confirmation without this section
     rather than blocking on it. */
  const guidance = booking.slices
    ? buildGuidance({
        slices: booking.slices,
        departureDate: booking.departureDate,
        documentsCollected: booking.documentsProvided,
      })
    : null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div className="rounded-card border border-positive/30 bg-positive-wash p-6">
        <p className="font-mono text-[10px] tracking-[0.18em] text-positive uppercase">
          {booking.status === 'confirmed' ? 'Confirmed' : booking.status}
        </p>
        <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight">
          You’re booked.
        </h1>
        {booking.bookingReference ? (
          <p className="mt-4 text-sm text-ink-muted">
            Airline reference{' '}
            <span className="font-mono text-lg font-semibold text-ink">
              {booking.bookingReference}
            </span>
          </p>
        ) : null}
        <p className="mt-2 text-sm text-ink-muted">
          Use that on {booking.airlineName ?? 'the airline'}’s own site for seat
          selection, bags and check-in.
        </p>
      </div>

      <section className="mt-6 rounded-card border border-hairline bg-surface p-6">
        <div className="flex items-center gap-4">
          <span className="font-mono text-2xl font-semibold tracking-tight">
            {booking.origin}
          </span>
          <span className="min-w-0 flex-1">
            <RouteLine label={`${booking.origin} to ${booking.destination}`} />
          </span>
          <span className="font-mono text-2xl font-semibold tracking-tight">
            {booking.destination}
          </span>
        </div>

        <dl className="mt-6 space-y-2 border-t border-hairline pt-5 text-sm">
          <Row term="Outbound" value={formatFull(booking.departureDate)} />
          {booking.returnDate ? (
            <Row term="Return" value={formatFull(booking.returnDate)} />
          ) : null}
          <Row
            term="Travellers"
            value={`${booking.passengerCount} ${booking.passengerCount === 1 ? 'traveller' : 'travellers'}`}
          />
          {booking.chargedAmount && booking.chargedCurrency ? (
            <Row
              term="Paid"
              value={formatMoney(booking.chargedAmount, booking.chargedCurrency)}
            />
          ) : null}
          <Row term="Confirmation sent to" value={booking.contactEmail} />
        </dl>
      </section>

      {guidance ? (
        <PreTravelPanel
          guidance={guidance}
          bookingReference={booking.bookingReference}
          airlineName={booking.airlineName}
        />
      ) : null}

      {booking.status === 'cancelled' ? (
        <section className="mt-6 rounded-card border border-hairline bg-paper p-6">
          <h2 className="font-display text-base font-bold tracking-tight">
            This booking is cancelled
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            The airline has released the seats. Any refund due is on its way to the
            card you paid with.
          </p>
        </section>
      ) : (
        <CancelBooking orderId={booking.id} isOwner={booking.ownedByViewer} />
      )}

      <div className="mt-6">
        <FinancialProtectionNotice variant="confirmation" />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={booking.ownedByViewer ? '/account' : '/sign-in'}
          className="rounded-control bg-ink px-5 py-2.5 text-sm font-medium text-white"
        >
          {booking.ownedByViewer ? 'All your trips' : 'Sign in to save this trip'}
        </Link>
        <Link
          href="/"
          className="rounded-control border border-hairline-strong px-5 py-2.5 text-sm font-medium text-ink"
        >
          Book another flight
        </Link>
      </div>

      <p className="mt-6 text-xs text-ink-faint">
        Keep this page or the reference above. Changes and cancellations are subject
        to the airline’s own fare rules.
      </p>
    </div>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4">
      <dt className="text-ink-faint">{term}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
