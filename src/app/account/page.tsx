import { requireUser } from '@/features/auth/queries';
import { getMyTrips } from '@/features/booking/queries';
import { formatMoney } from '@/lib/format';
import { formatShort } from '@/lib/date';
import { signOut } from '@/features/auth/actions';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Your account' };

export default async function AccountPage() {
  const user = await requireUser('/account');
  const trips = await getMyTrips();

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">
        {user.fullName ? `Hello, ${user.fullName}` : 'Your account'}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">{user.email}</p>

      <h2 className="mt-10 mb-3 font-display text-base font-bold tracking-tight">
        Your trips
      </h2>

      {trips.length === 0 ? (
        <div className="rounded-card border border-hairline bg-surface p-6">
          <p className="text-sm text-ink-muted">
            Nothing booked yet. Anything you book while signed in will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {trips.map((trip) => (
            <li
              key={trip.id}
              className="rounded-card border border-hairline bg-surface p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="flex items-baseline gap-2">
                  <span className="font-mono text-lg font-semibold tracking-tight">
                    {trip.origin}
                  </span>
                  <span aria-hidden="true" className="text-chart">
                    →
                  </span>
                  <span className="font-mono text-lg font-semibold tracking-tight">
                    {trip.destination}
                  </span>
                </p>
                <p className="font-mono text-sm text-ink-muted">
                  {formatMoney(trip.totalAmount, trip.totalCurrency)}
                </p>
              </div>

              <p className="mt-2 text-sm text-ink-muted">
                {formatShort(trip.departureDate)}
                {trip.returnDate ? ` – ${formatShort(trip.returnDate)}` : ''}
                {' · '}
                {trip.passengerCount}{' '}
                {trip.passengerCount === 1 ? 'traveller' : 'travellers'}
                {trip.airlineName ? ` · ${trip.airlineName}` : ''}
              </p>

              {trip.bookingReference ? (
                <p className="mt-2 text-xs text-ink-faint">
                  Airline reference{' '}
                  <span className="font-mono text-ink-muted">
                    {trip.bookingReference}
                  </span>{' '}
                  — use this on the airline’s own site for seats, bags and check-in.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form action={signOut} className="mt-8">
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </div>
  );
}
